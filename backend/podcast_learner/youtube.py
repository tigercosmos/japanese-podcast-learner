"""YouTube access through yt-dlp: metadata, subtitles, and audio."""

import json
import pathlib
import re
import urllib.parse

import yt_dlp

from podcast_learner import errors

_ID_RE = re.compile(r"[A-Za-z0-9_-]{11}")
_PATH_PREFIXES = ("shorts", "embed", "live", "v")
_QUIET = {"quiet": True, "no_warnings": True, "noprogress": True}


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
    """
    try:
        with yt_dlp.YoutubeDL({**_QUIET, "skip_download": True}) as ydl:
            info = ydl.extract_info(watch_url(video_id), download=False)
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
    }


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

# vim: set ff=unix fenc=utf8 et sw=4 ts=4 sts=4 tw=79:
