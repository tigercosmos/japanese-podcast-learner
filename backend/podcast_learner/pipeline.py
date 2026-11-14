"""Turn a YouTube URL into a stored, analyzed video."""

import concurrent.futures
import functools
import logging
import os
import threading
import time

from podcast_learner import analysis
from podcast_learner import claude
from podcast_learner import errors
from podcast_learner import proofread
from podcast_learner import store as store_module
from podcast_learner import transcribe
from podcast_learner import transcript
from podcast_learner import youtube

_LOG = logging.getLogger(__name__)


class Pipeline:
    """Run one video at a time on a background thread.

    :param source: Object with the functions of the ``youtube`` module.
    :param transcriber: ``transcriber(audio_path, model)`` returning
        segments.
    :param runner: ``runner(prompt, system, schema)`` for the proofreading
        and the analysis. The default runs ``claude -p``.
    """

    def __init__(self, store, settings, source=youtube,
                 transcriber=transcribe.transcribe, runner=None):
        self.store = store
        self._settings = settings
        self._source = source
        self._transcriber = transcriber
        self._runner = runner or functools.partial(
            claude.run_json, settings=settings)
        self._executor = concurrent.futures.ThreadPoolExecutor(max_workers=1)
        # A download for a finished video must not wait behind an analysis.
        self._downloads = concurrent.futures.ThreadPoolExecutor(
            max_workers=1)
        self._active = set()
        self._lock = threading.Lock()

    def recover(self):
        """Fail the videos that a previous process left unfinished."""
        for meta in self.store.list_meta():
            if meta["status"] in ("queued", "processing"):
                self.store.update_meta(
                    meta["id"], status="failed",
                    error="伺服器在處理途中重新啟動，請再試一次。")
            if meta.get("video_download") == "running":
                self.store.update_meta(
                    meta["id"], video_download="failed",
                    video_error="伺服器在下載途中重新啟動，請再試一次。")

    def is_active(self, video_id):
        with self._lock:
            return video_id in self._active

    def submit(self, url, download=False):
        """Queue a video and return its metadata.

        A video that is ready or already in the queue is returned as it
        is. A failed video is queued again.

        :param download: Keep a copy of the video and play that. Without
            it, a video that the page cannot embed is refused.
        """
        video_id = self._source.parse_video_id(url)
        if video_id is None:
            raise errors.PipelineError("請輸入有效的 YouTube 影片連結。")
        with self._lock:
            existing = self._existing(video_id)
        if existing is not None:
            return existing

        # The slow steps are wasted on a video that the page cannot play,
        # so this is checked before anything is queued.
        info = self._source.fetch_info(video_id)
        if not info.pop("embeddable", True) and not download:
            raise errors.NotEmbeddableError(
                "這部影片不允許在 YouTube 以外的網站播放（上傳者關閉了嵌入，"
                "或影片有觀看限制）。可以把影片下載到本機來觀看。")
        subtitle_lang = info.pop("subtitle_lang")

        with self._lock:
            existing = self._existing(video_id)
            if existing is not None:
                return existing
            previous = self.store.get_meta(video_id) or {}
            meta = {
                "id": video_id,
                "url": self._source.watch_url(video_id),
                **info,
                "created_at": previous.get("created_at", time.time()),
                "local_video": self.store.video_path(video_id).is_file(),
                "video_download": "",
                "video_error": "",
                "status": "queued",
                "stage": "queued",
                "progress": 0,
                "error": "",
            }
            self.store.save_meta(meta)
            self._active.add(video_id)
        self._executor.submit(self._run, video_id, subtitle_lang, download)
        return meta

    def _existing(self, video_id):
        """Return the metadata of a video that needs no new run.

        The caller holds the lock.
        """
        meta = self.store.get_meta(video_id)
        if meta is not None and (
                meta["status"] == "ready" or video_id in self._active):
            return meta
        return None

    def download_video(self, video_id):
        """Start downloading the video of a finished video.

        The analysis is not run again. ``video_download`` in the metadata
        tells how the download goes.
        """
        with self._lock:
            meta = self.store.get_meta(video_id)
            if meta is None or meta["status"] != "ready":
                raise errors.PipelineError("影片還沒有處理完成。")
            if meta.get("local_video") or video_id in self._active:
                return meta
            self._active.add(video_id)
            meta = self.store.update_meta(
                video_id, video_download="running", video_error="",
                video_progress=0)
        self._downloads.submit(self._run_download, video_id)
        return meta

    def _run_download(self, video_id):
        update = functools.partial(self.store.update_meta, video_id)
        try:
            self._save_video(
                video_id, lambda fraction: update(video_progress=fraction))
            update(local_video=True, video_download="")
        except errors.PipelineError as exc:
            update(video_download="failed", video_error=str(exc))
        except Exception as exc:
            _LOG.exception("downloading %s failed", video_id)
            update(video_download="failed", video_error=f"下載失敗：{exc}")
        finally:
            with self._lock:
                self._active.discard(video_id)

    def _save_video(self, video_id, on_progress):
        """Download into the work directory, then move the whole file."""
        last = -1

        def throttled(fraction):
            nonlocal last
            if fraction - last >= 0.02:
                last = fraction
                on_progress(fraction)

        path = self._source.download_video(
            video_id, self.store.work_dir(video_id), throttled)
        os.replace(path, self.store.video_path(video_id))

    def _run(self, video_id, subtitle_lang, download):
        try:
            self._process(video_id, subtitle_lang, download)
        except errors.PipelineError as exc:
            self.store.update_meta(video_id, status="failed", error=str(exc))
        except Exception as exc:
            _LOG.exception("processing %s failed", video_id)
            self.store.update_meta(
                video_id, status="failed", error=f"處理失敗：{exc}")
        finally:
            with self._lock:
                self._active.discard(video_id)

    def _process(self, video_id, subtitle_lang, download):
        update = functools.partial(self.store.update_meta, video_id)
        work_dir = self.store.work_dir(video_id)
        title = self.store.get_meta(video_id)["title"]

        update(status="processing")
        if download and not self.store.video_path(video_id).is_file():
            update(stage="video", progress=0)
            self._save_video(
                video_id, lambda fraction: update(progress=fraction))
            update(local_video=True)
        segments, transcript_source = self._transcript(
            video_id, subtitle_lang, work_dir, update)
        update(transcript_source=transcript_source)

        def on_progress(done, total):
            update(progress=done / total)

        if transcript_source == "whisper":
            update(stage="proofread", progress=0)
            segments = proofread.proofread(
                title, segments, self._runner,
                work_dir / "proofread", on_progress=on_progress,
                workers=self._settings.claude_workers)

        update(stage="analyze", progress=0)
        content = analysis.analyze(
            title, segments, self._runner, work_dir / "chunks",
            on_progress=on_progress, workers=self._settings.claude_workers)
        self.store.save_content(video_id, content)
        update(
            status="ready", stage="done", progress=1,
            counts={key: len(value) for key, value in content.items()})

    def _transcript(self, video_id, subtitle_lang, work_dir, update):
        # Transcription is the slow step, so a retry reuses its result.
        saved_path = work_dir / "transcript.json"
        saved = store_module.read_json(saved_path)
        if saved is not None:
            return saved["segments"], saved["source"]

        if subtitle_lang is not None:
            update(stage="subtitles")
            document = self._source.download_subtitles(
                video_id, subtitle_lang, work_dir)
            raw = transcript.parse_json3(document)
            source = "youtube"
        else:
            video_path = self.store.video_path(video_id)
            if video_path.is_file():
                audio_path = video_path
            else:
                update(stage="audio")
                audio_path = self._source.download_audio(video_id, work_dir)
            update(stage="transcribe")
            raw = self._transcriber(audio_path, self._settings.whisper_model)
            if audio_path != video_path:
                audio_path.unlink(missing_ok=True)
            source = "whisper"

        segments = transcript.clean(raw)
        if not segments:
            raise errors.PipelineError("這部影片沒有可辨識的日語內容。")
        store_module.write_json(
            saved_path, {"segments": segments, "source": source})
        return segments, source

# vim: set ff=unix fenc=utf8 et sw=4 ts=4 sts=4 tw=79:
