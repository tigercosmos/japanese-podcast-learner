"""Stand-ins for YouTube, Whisper, and Claude."""

import json

from podcast_learner import errors
from podcast_learner import youtube

VIDEO_ID = "abcdefghijk"
VIDEO_BYTES = bytes(range(100))


class FakeSource:
    """A ``youtube`` module replacement that never touches the network."""

    parse_video_id = staticmethod(youtube.parse_video_id)
    watch_url = staticmethod(youtube.watch_url)

    def __init__(self, subtitle_lang="ja", fail=False, embeddable=True):
        self.subtitle_lang = subtitle_lang
        self.fail = fail
        self.embeddable = embeddable
        self.info_fetches = 0
        self.video_downloads = 0
        self.video_fails = False
        self.audio_downloads = 0

    def fetch_info(self, video_id):
        self.info_fetches += 1
        if self.fail:
            raise errors.PipelineError("無法取得影片資訊：測試")
        return {
            "title": "テスト",
            "channel": "チャンネル",
            "duration": 10,
            "thumbnail": "",
            "subtitle_lang": self.subtitle_lang,
            "embeddable": self.embeddable,
        }

    def download_subtitles(self, video_id, lang, dest_dir):
        return {"events": [
            {"tStartMs": 0, "dDurationMs": 2000,
             "segs": [{"utf8": "猫を見てしまいました。"}]},
            {"tStartMs": 2000, "dDurationMs": 2000,
             "segs": [{"utf8": "[音楽]"}]},
        ]}

    def download_audio(self, video_id, dest_dir):
        self.audio_downloads += 1
        path = dest_dir / "audio.webm"
        path.write_bytes(b"")
        return path

    def download_video(self, video_id, dest_dir, on_progress=None):
        self.video_downloads += 1
        if self.video_fails:
            raise errors.PipelineError("無法下載影片：測試")
        if on_progress is not None:
            on_progress(1)
        path = dest_dir / "video.mp4"
        path.write_bytes(VIDEO_BYTES)
        return path


def fake_transcriber(audio_path, model):
    return [{"start": 0.0, "end": 2.0, "text": " 犬が好きです。"}]


class FakeRunner:
    """Answer every chunk the way Claude would, and count the calls.

    :param corrections: Proofread answer, as ``{segment id: text}``.
    """

    def __init__(self, corrections=None):
        self.calls = 0
        self.corrections = corrections or {}

    def __call__(self, prompt, system, schema):
        self.calls += 1
        chunk = json.loads(prompt)
        if "corrections" in schema["properties"]:
            return {"corrections": [
                {"id": index, "ja": text}
                for index, text in self.corrections.items()]}
        return {
            "translations": [
                {"id": segment["id"], "zh": f"譯文{segment['id']}"}
                for segment in chunk["segments"]],
            "vocabulary": [vocab_entry(word) for word in chunk["words"]],
            "grammar": [],
        }


def vocab_entry(word):
    return {
        "word": word, "reading": "よみ", "pos": "名詞", "level": "N5",
        "meaning": f"{word}的意思", "usage": "用法",
        "example_ja": "例文。", "example_zh": "例句。",
    }


def grammar_entry(pattern, occurrences):
    return {
        "pattern": pattern, "level": "N4", "meaning": "意思",
        "explanation": "說明", "usage": "接續",
        "examples": [{"ja": "例文。", "zh": "例句。"}],
        "occurrences": [
            {"id": index, "text": text} for index, text in occurrences],
    }

# vim: set ff=unix fenc=utf8 et sw=4 ts=4 sts=4 tw=79:
