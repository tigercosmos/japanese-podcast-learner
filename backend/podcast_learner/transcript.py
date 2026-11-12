"""Timed transcript segments: parsing and cleanup.

A segment is a dict with ``start`` and ``end`` in seconds and ``text``.
"""

import re

# Cues that only describe sound, for example [音楽] or （拍手）.
_NOISE_RE = re.compile(r"[\[\(（［【][^\]\)）］】]*[\]\)）］】]|[♪♫]+")
# Whisper labels music and applause with a bare word instead of speech.
_SOUND_LABELS = frozenset(["音楽", "拍手", "笑", "笑い"])


def parse_json3(data):
    """Return the segments of a YouTube ``json3`` subtitle document."""
    segments = []
    for event in data.get("events", []):
        text = "".join(seg.get("utf8", "") for seg in event.get("segs", []))
        start = event.get("tStartMs", 0) / 1000
        duration = event.get("dDurationMs", 0) / 1000
        segments.append(
            {"start": start, "end": start + duration, "text": text})
    return segments


def clean(segments):
    """Return display-ready segments in time order.

    Whitespace is collapsed, sound-only cues are dropped, and a segment
    never runs past the start of the next one.
    """
    cleaned = []
    for segment in sorted(segments, key=lambda s: s["start"]):
        text = _NOISE_RE.sub("", segment["text"])
        text = re.sub(r"\s+", " ", text).strip()
        if not text or text in _SOUND_LABELS:
            continue
        start = round(float(segment["start"]), 2)
        end = round(max(float(segment["end"]), start + 0.1), 2)
        cleaned.append({"start": start, "end": end, "text": text})

    for current, following in zip(cleaned, cleaned[1:]):
        if following["start"] > current["start"]:
            current["end"] = min(current["end"], following["start"])
    return cleaned

# vim: set ff=unix fenc=utf8 et sw=4 ts=4 sts=4 tw=79:
