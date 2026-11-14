"""Correct the recognition errors of a speech-to-text transcript.

Whisper writes what it hears, so it picks the wrong homophone or misspells
a name. Claude reads the lines in context and fixes only what is clearly
wrong. The timing and the number of lines never change.
"""

import difflib

from podcast_learner import analysis
from podcast_learner import chunks as chunks_module
from podcast_learner import errors

SHORT_LINE = 8
MIN_SIMILARITY = 0.5

SYSTEM = """\
你是日語逐字稿的校對者。你會收到一份 JSON，內容是語音辨識（Whisper）產生的
日語 Podcast 逐字稿片段：
- title：節目標題。
- context：這個片段之前的幾句話，只供理解上下文，不要修改。
- segments：要校對的字幕，每筆有 id 和日文 ja。

請找出明顯的辨識錯誤並修正，例如：
- 同音或近音的錯字（漢字選錯、助詞聽錯、清濁音或長音聽錯）。
- 依上下文或標題可以確定的人名、節目名、專有名詞的錯誤寫法。
- 不成詞、語意不通，但依上下文可以確定原本說了什麼的片段。

規則：
- 只改有把握的錯誤。不確定原本說了什麼就保持原樣。
- 這是口語逐字稿。口語、方言、省略、重複、語助詞、不完整的句子都不是
  錯誤，不要潤飾、改寫、補字或刪字，也不要把口語改成書面語。
- 不要合併、拆開或搬動字幕。每一筆的內容仍然對應原本那一段聲音。
- 不要只為了統一寫法而改（例如漢字和假名的互換、標點符號）。

corrections 只列出需要修改的字幕：id 是字幕的 id，ja 是修正後的整句日文。
沒有錯誤就回傳空陣列。
"""

SCHEMA = {
    "type": "object",
    "properties": {
        "corrections": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "id": {"type": "integer"},
                    "ja": {"type": "string"},
                },
                "required": ["id", "ja"],
            },
        },
    },
    "required": ["corrections"],
}


def proofread(title, segments, runner, cache_dir, on_progress=None,
              workers=4):
    """Return the segments with their recognition errors corrected.

    :param segments: Cleaned transcript segments.
    :param runner: ``runner(prompt, system, schema)`` returning a dict
        that matches ``SCHEMA``.
    :param cache_dir: Directory for finished chunk results.
    :param on_progress: Called with ``(done, total)`` after each chunk.
    """
    payloads = analysis.build_chunks(
        title, segments, [[] for _ in segments])
    for payload in payloads:
        del payload["words"]
    try:
        results = chunks_module.run(
            payloads, runner, cache_dir, SYSTEM, SCHEMA,
            check=_check_corrections, on_progress=on_progress, workers=workers)
    except Exception as exc:
        raise errors.PipelineError(f"逐字稿校對失敗：{exc}") from exc

    corrected = [dict(segment) for segment in segments]
    for payload, result in zip(payloads, results):
        ids = {segment["id"] for segment in payload["segments"]}
        for item in result["corrections"]:
            text = item["ja"].strip()
            if item["id"] in ids and _is_small_change(
                    segments[item["id"]]["text"], text):
                corrected[item["id"]]["text"] = text
    return corrected


def _check_corrections(chunk, result):
    for item in result["corrections"]:
        if type(item["id"]) is not int or not isinstance(item["ja"], str):
            raise ValueError("a correction is malformed")


def _is_small_change(old, new):
    """Tell a correction from a rewrite.

    A fixed word leaves the length and most of the characters of a line
    alone. An answer that does not is dropped or invented speech, so it
    is ignored. A short line can be one misheard name, where every
    character changes, so only its length is compared.
    """
    if not new or not len(old) / 2 <= len(new) <= len(old) * 2:
        return False
    if len(old) <= SHORT_LINE:
        return True
    matcher = difflib.SequenceMatcher(None, old, new, autojunk=False)
    return matcher.ratio() >= MIN_SIMILARITY

# vim: set ff=unix fenc=utf8 et sw=4 ts=4 sts=4 tw=79:
