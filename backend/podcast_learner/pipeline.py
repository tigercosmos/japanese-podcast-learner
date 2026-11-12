"""Turn a YouTube URL into a stored, analyzed video."""

import concurrent.futures
import functools
import logging
import threading
import time

from podcast_learner import analysis
from podcast_learner import claude
from podcast_learner import errors
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
    :param runner: ``runner(prompt, system, schema)`` for the analysis.
        The default runs ``claude -p``.
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
        self._active = set()
        self._lock = threading.Lock()

    def recover(self):
        """Fail the videos that a previous process left unfinished."""
        for meta in self.store.list_meta():
            if meta["status"] in ("queued", "processing"):
                self.store.update_meta(
                    meta["id"], status="failed",
                    error="伺服器在處理途中重新啟動，請再試一次。")

    def is_active(self, video_id):
        with self._lock:
            return video_id in self._active

    def submit(self, url):
        """Queue a video and return its metadata.

        A video that is ready or already in the queue is returned as it
        is. A failed video is queued again.
        """
        video_id = self._source.parse_video_id(url)
        if video_id is None:
            raise errors.PipelineError("請輸入有效的 YouTube 影片連結。")

        with self._lock:
            meta = self.store.get_meta(video_id)
            if meta is not None and (
                    meta["status"] == "ready" or video_id in self._active):
                return meta
            previous = meta or {}
            meta = {
                "id": video_id,
                "url": self._source.watch_url(video_id),
                "title": previous.get("title", ""),
                "channel": previous.get("channel", ""),
                "duration": previous.get("duration", 0),
                "thumbnail": previous.get("thumbnail", ""),
                "created_at": previous.get("created_at", time.time()),
                "status": "queued",
                "stage": "queued",
                "progress": 0,
                "error": "",
            }
            self.store.save_meta(meta)
            self._active.add(video_id)
        self._executor.submit(self._run, video_id)
        return meta

    def _run(self, video_id):
        try:
            self._process(video_id)
        except errors.PipelineError as exc:
            self.store.update_meta(video_id, status="failed", error=str(exc))
        except Exception as exc:
            _LOG.exception("processing %s failed", video_id)
            self.store.update_meta(
                video_id, status="failed", error=f"處理失敗：{exc}")
        finally:
            with self._lock:
                self._active.discard(video_id)

    def _process(self, video_id):
        update = functools.partial(self.store.update_meta, video_id)
        work_dir = self.store.work_dir(video_id)

        update(status="processing", stage="metadata")
        info = self._source.fetch_info(video_id)
        subtitle_lang = info.pop("subtitle_lang")
        update(**info)

        segments, transcript_source = self._transcript(
            video_id, subtitle_lang, work_dir, update)
        update(transcript_source=transcript_source)

        def on_progress(done, total):
            update(progress=done / total)

        update(stage="analyze", progress=0)
        content = analysis.analyze(
            info["title"], segments, self._runner, work_dir / "chunks",
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
            update(stage="audio")
            audio_path = self._source.download_audio(video_id, work_dir)
            update(stage="transcribe")
            raw = self._transcriber(audio_path, self._settings.whisper_model)
            audio_path.unlink(missing_ok=True)
            source = "whisper"

        segments = transcript.clean(raw)
        if not segments:
            raise errors.PipelineError("這部影片沒有可辨識的日語內容。")
        store_module.write_json(
            saved_path, {"segments": segments, "source": source})
        return segments, source

# vim: set ff=unix fenc=utf8 et sw=4 ts=4 sts=4 tw=79:
