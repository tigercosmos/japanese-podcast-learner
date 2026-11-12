"""JSON file storage for videos, one directory per video."""

import json
import os
import pathlib
import re
import shutil
import threading

VIDEO_ID_RE = re.compile(r"[A-Za-z0-9_-]{11}")


class Store:
    def __init__(self, data_dir):
        self._root = pathlib.Path(data_dir) / "videos"
        self._lock = threading.Lock()

    def video_dir(self, video_id):
        # The id becomes a path component, so it must not be free text.
        if not VIDEO_ID_RE.fullmatch(video_id):
            raise ValueError(f"invalid video id: {video_id!r}")
        return self._root / video_id

    def work_dir(self, video_id):
        """Return the directory for intermediate files, creating it."""
        path = self.video_dir(video_id) / "work"
        path.mkdir(parents=True, exist_ok=True)
        return path

    def list_meta(self):
        if not self._root.is_dir():
            return []
        metas = []
        for path in self._root.iterdir():
            meta = _read(path / "meta.json")
            if meta is not None:
                metas.append(meta)
        metas.sort(key=lambda m: m.get("created_at", 0), reverse=True)
        return metas

    def get_meta(self, video_id):
        return _read(self.video_dir(video_id) / "meta.json")

    def save_meta(self, meta):
        with self._lock:
            _write(self.video_dir(meta["id"]) / "meta.json", meta)

    def update_meta(self, video_id, **fields):
        with self._lock:
            path = self.video_dir(video_id) / "meta.json"
            meta = _read(path)
            if meta is None:
                return None
            meta.update(fields)
            _write(path, meta)
            return meta

    def get_content(self, video_id):
        return _read(self.video_dir(video_id) / "content.json")

    def save_content(self, video_id, content):
        _write(self.video_dir(video_id) / "content.json", content)

    def delete(self, video_id):
        with self._lock:
            shutil.rmtree(self.video_dir(video_id), ignore_errors=True)


def read_json(path):
    """Return the parsed file, or None when it is missing or damaged."""
    return _read(pathlib.Path(path))


def write_json(path, data):
    _write(pathlib.Path(path), data)


def _read(path):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, NotADirectoryError, json.JSONDecodeError):
        return None


def _write(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + ".tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)
    # A reader must never see a half-written file.
    os.replace(tmp, path)

# vim: set ff=unix fenc=utf8 et sw=4 ts=4 sts=4 tw=79:
