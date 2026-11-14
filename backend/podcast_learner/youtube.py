"""YouTube access through yt-dlp: metadata, subtitles, and audio."""

import json
import pathlib
import re
import shutil
import urllib.parse

import yt_dlp

from podcast_learner import errors

# H.264 and AAC in MP4 play in every browser on macOS. Other codecs are a
# fallback, for a video that has no such streams.
_VIDEO_FORMAT = (
    "bv*[height<=720][vcodec^=avc1]+ba[ext=m4a]/"
    "b[height<=720][ext=mp4]/bv*[height<=720]+ba/b[height<=720]/b")

_ID_RE = re.compile(r"[A-Za-z0-9_-]{11}")
_PATH_PREFIXES = ("shorts", "embed", "live", "v")
_QUIET = {"quiet": True, "no_warnings": True, "noprogress": True}
# YouTube answers the embed page only when an embedding site is named.
_EMBED_REFERER = "http://127.0.0.1:5173/"
_EMBED_STATUS_RE = re.compile(
    r'previewPlayabilityStatus\\?":\{\\?"status\\?":\\?"([A-Z_]+)')


def parse_video_id(url):
    """Return the video id in a YouTube URL, or None."""
    url = url.strip()
    if _ID_RE.fullmatch(url):
        return url
    if "://" not in url:
        url = "https://" + url
    parsed = urllib.parse.urlparse(url)
    host = (parsed.hostname or "").removeprefix("www.").removeprefix("m.")
    parts = [part for part in parsed.path.split("/") if part]

    candidate = None
    if host == "youtu.be" and parts:
        candidate = parts[0]
    elif host in ("youtube.com", "music.youtube.com",
                  "youtube-nocookie.com"):
        if parts[:1] == ["watch"]:
            query = urllib.parse.parse_qs(parsed.query)
            candidate = query.get("v", [None])[0]
        elif len(parts) >= 2 and parts[0] in _PATH_PREFIXES:
            candidate = parts[1]
    if candidate and _ID_RE.fullmatch(candidate):
        return candidate
    return None


def watch_url(video_id):
    return f"https://www.youtube.com/watch?v={video_id}"


def fetch_info(video_id):
    """Return the metadata of a video.

    ``subtitle_lang`` is the key of the uploaded Japanese subtitle track,
    or None. Auto-generated captions do not count: they have no punctuation
    or sentence boundaries, so local transcription gives a better result.

    ``embeddable`` is False when the player on another site refuses the
    video.
    """
    try:
        with yt_dlp.YoutubeDL({**_QUIET, "skip_download": True}) as ydl:
            info = ydl.extract_info(watch_url(video_id), download=False)
            embeddable = _is_embeddable(ydl, video_id)
    except yt_dlp.utils.DownloadError as exc:
        raise errors.PipelineError(f"無法取得影片資訊：{exc}") from exc

    languages = sorted(info.get("subtitles") or {})
    subtitle_lang = next(
        (lang for lang in languages if lang == "ja"),
        next((lang for lang in languages if lang.startswith("ja")), None))
    return {
        "title": info.get("title") or video_id,
        "channel": info.get("channel") or info.get("uploader") or "",
        "duration": info.get("duration") or 0,
        "thumbnail": f"https://i.ytimg.com/vi/{video_id}/mqdefault.jpg",
        "subtitle_lang": subtitle_lang,
        "embeddable": embeddable,
    }


def _is_embeddable(ydl, video_id):
    """Ask the embed page, the way the player on our page does.

    The ``playable_in_embed`` field of yt-dlp comes from the watch page.
    It stays true for a video that the owner blocks on other sites.
    A failed request must not block a video, so it counts as embeddable.
    """
    request = yt_dlp.networking.Request(
        f"https://www.youtube.com/embed/{video_id}",
        headers={"Referer": _EMBED_REFERER})
    try:
        page = ydl.urlopen(request).read().decode("utf-8", "replace")
    except yt_dlp.utils.YoutubeDLError:
        return True
    return parse_embed_status(page) in (None, "OK")


def parse_embed_status(page):
    """Return the playability status in an embed page, or None."""
    match = _EMBED_STATUS_RE.search(page)
    return match.group(1) if match else None


def download_subtitles(video_id, lang, dest_dir):
    """Return the parsed ``json3`` document of one subtitle track."""
    dest_dir = pathlib.Path(dest_dir)
    options = {
        **_QUIET,
        "skip_download": True,
        "writesubtitles": True,
        "subtitleslangs": [lang],
        "subtitlesformat": "json3",
        "outtmpl": str(dest_dir / "subs.%(ext)s"),
    }
    try:
        with yt_dlp.YoutubeDL(options) as ydl:
            ydl.download([watch_url(video_id)])
    except yt_dlp.utils.DownloadError as exc:
        raise errors.PipelineError(f"無法下載字幕：{exc}") from exc

    path = dest_dir / f"subs.{lang}.json3"
    if not path.is_file():
        raise errors.PipelineError("無法下載字幕。")
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def download_audio(video_id, dest_dir):
    """Download the audio track and return its path."""
    dest_dir = pathlib.Path(dest_dir)
    options = {
        **_QUIET,
        "format": "bestaudio/best",
        "outtmpl": str(dest_dir / "audio.%(ext)s"),
    }
    try:
        with yt_dlp.YoutubeDL(options) as ydl:
            info = ydl.extract_info(watch_url(video_id), download=True)
            return pathlib.Path(ydl.prepare_filename(info))
    except yt_dlp.utils.DownloadError as exc:
        raise errors.PipelineError(f"無法下載音訊：{exc}") from exc


def download_video(video_id, dest_dir, on_progress=None):
    """Download the video as ``video.mp4``, at most 720p, and return it.

    :param on_progress: Called with a fraction between 0 and 1.
    """
    if shutil.which("ffmpeg") is None:
        raise errors.PipelineError(
            "下載影片需要 ffmpeg。請先執行 brew install ffmpeg 後再試一次。")
    dest_dir = pathlib.Path(dest_dir)
    best = 0

    def hook(status):
        nonlocal best
        total = status.get("total_bytes") or status.get(
            "total_bytes_estimate")
        if on_progress is None or not total:
            return
        # The audio stream comes second and starts from zero again.
        fraction = min(status.get("downloaded_bytes", 0) / total, 1)
        if fraction > best:
            best = fraction
            on_progress(fraction)

    options = {
        **_QUIET,
        "format": _VIDEO_FORMAT,
        "merge_output_format": "mp4",
        "postprocessors": [
            {"key": "FFmpegVideoRemuxer", "preferedformat": "mp4"}],
        "outtmpl": str(dest_dir / "video.%(ext)s"),
        "progress_hooks": [hook],
    }
    try:
        with yt_dlp.YoutubeDL(options) as ydl:
            ydl.download([watch_url(video_id)])
    except yt_dlp.utils.DownloadError as exc:
        raise errors.PipelineError(f"無法下載影片：{exc}") from exc
    path = dest_dir / "video.mp4"
    if not path.is_file():
        raise errors.PipelineError("無法下載影片。")
    return path

# vim: set ff=unix fenc=utf8 et sw=4 ts=4 sts=4 tw=79:
