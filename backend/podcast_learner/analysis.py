"""Translate a transcript and extract its vocabulary and grammar.

The transcript is cut into chunks, and each chunk is one Claude request.
The tokenizer decides which words need an entry, so every entry links back
to the tokens in the subtitles by its dictionary form.
"""

import re

from podcast_learner import chunks as chunks_module
from podcast_learner import errors
from podcast_learner import japanese

LEVELS = ["N5", "N4", "N3", "N2", "N1"]
MAX_CHUNK_CHARS = 1200
MAX_CHUNK_SEGMENTS = 40
CONTEXT_SEGMENTS = 3

SYSTEM = """\
你是專業的日語老師，學生是台灣的繁體中文母語者，正在用日語 Podcast 學日語。
你會收到一份 JSON，內容是 Podcast 逐字稿的一個片段：
- title：節目標題。
- context：這個片段之前的幾句話，只供理解上下文，不要翻譯。
- segments：要處理的字幕，每筆有 id 和日文 ja。
- words：斷詞器從這個片段找出的單字（辭書形）。

請完成三件事，所有說明一律使用台灣慣用的繁體中文。中文一律使用全形標點符號
（，。？！；：「」），不要使用半形的 , ; ? !。

1. translations：segments 的每一筆都要有一筆翻譯，id 相同。zh 是自然、簡潔、
   適合當字幕的台灣繁體中文。一句話可能被切成好幾段字幕，每段的譯文要對應
   該段的內容。逐字稿可能來自語音辨識而有錯字，請依上下文合理翻譯。

2. vocabulary：words 的每個單字各一筆。
   - word：必須和 words 裡的字串完全相同。
   - reading：辭書形的平假名讀音（片假名單字就寫片假名）。
   - pos：詞性，例如 名詞、五段動詞、一段動詞、サ變動詞、い形容詞、
     な形容詞、副詞、連體詞、接續詞、感嘆詞、代名詞、專有名詞。
   - level：估計的 JLPT 等級。
   - meaning：簡短的中文意思，以這段內容裡的意思為主。
   - usage：一到兩句的用法說明，例如語感、常見搭配、容易混淆的地方。
   - example_ja、example_zh：一個簡短自然的例句和它的中文翻譯。例句要自己
     造，不要照抄逐字稿。
   如果單字在文中其實是慣用語的一部分（例如 はじめまして 的 はじめる），
   請在 usage 說明這個慣用語。
   沒有意義的填充詞（例如 えー、あのー）和明顯是斷詞錯誤的碎片可以省略。

3. grammar：這個片段裡值得學習的文法、句型和慣用表現。最基本的助詞
   （は、が、を、に）和 です／ます 不用列。
   - pattern：用「〜」表示的句型，例如 〜てしまう、〜わけではない。
   - level：估計的 JLPT 等級。
   - meaning：一句話的中文意思。
   - explanation：詳細說明，包含語感、使用情境、和相近文法的差別。
   - usage：接續方式，例如「動詞て形＋しまう」。
   - examples：兩個自己造的例句，各有 ja 和 zh。
   - occurrences：這個文法出現在哪些字幕。id 是字幕的 id，text 是那句字幕
     裡對應這個文法的原文片段，必須是該字幕 ja 的子字串。
"""

_TEXT = {"type": "string"}
_LEVEL = {"type": "string", "enum": LEVELS}


def _object(**properties):
    return {
        "type": "object",
        "properties": properties,
        "required": list(properties),
    }


def _array(items):
    return {"type": "array", "items": items}


SCHEMA = _object(
    translations=_array(_object(id={"type": "integer"}, zh=_TEXT)),
    vocabulary=_array(_object(
        word=_TEXT, reading=_TEXT, pos=_TEXT, level=_LEVEL, meaning=_TEXT,
        usage=_TEXT, example_ja=_TEXT, example_zh=_TEXT)),
    grammar=_array(_object(
        pattern=_TEXT, level=_LEVEL, meaning=_TEXT, explanation=_TEXT,
        usage=_TEXT,
        examples=_array(_object(ja=_TEXT, zh=_TEXT)),
        occurrences=_array(_object(id={"type": "integer"}, text=_TEXT)))),
)


def build_chunks(title, segments, tokens):
    """Return the request payload of every chunk.

    A word is listed only in the chunk where it first appears, so each word
    is explained once.

    :param segments: Cleaned transcript segments.
    :param tokens: The token list of each segment, in the same order.
    """
    chunks = []
    seen = set()
    current = None
    chars = 0
    for index, segment in enumerate(segments):
        full = current is not None and (
            len(current["segments"]) >= MAX_CHUNK_SEGMENTS
            or chars + len(segment["text"]) > MAX_CHUNK_CHARS)
        if current is None or full:
            context = segments[max(0, index - CONTEXT_SEGMENTS):index]
            current = {
                "title": title,
                "context": [item["text"] for item in context],
                "segments": [],
                "words": [],
            }
            chunks.append(current)
            chars = 0

        current["segments"].append({"id": index, "ja": segment["text"]})
        chars += len(segment["text"])
        for token in tokens[index]:
            word = token.get("v")
            if word and word not in seen:
                seen.add(word)
                current["words"].append(word)
    return chunks


def analyze(title, segments, runner, cache_dir, on_progress=None,
            workers=4):
    """Return the content document of a video.

    :param segments: Cleaned transcript segments.
    :param runner: ``runner(prompt, system, schema)`` returning a dict
        that matches ``SCHEMA``.
    :param cache_dir: Directory for finished chunk results. A retry after
        a failure reuses them.
    :param on_progress: Called with ``(done, total)`` after each chunk.
    :return: A dict with ``segments``, ``vocabulary``, and ``grammar``.
    """
    tokens = [japanese.tokenize(segment["text"]) for segment in segments]
    chunks = build_chunks(title, segments, tokens)
    try:
        results = chunks_module.run(
            chunks, runner, cache_dir, SYSTEM, SCHEMA,
            check=_check_translations, on_progress=on_progress,
            workers=workers)
    except Exception as exc:
        raise errors.PipelineError(f"翻譯與分析失敗：{exc}") from exc
    return _assemble(segments, tokens, chunks, results)


def _check_translations(chunk, result):
    expected = {segment["id"] for segment in chunk["segments"]}
    translated = {item["id"] for item in result["translations"]}
    missing = expected - translated
    if missing:
        raise ValueError(f"{len(missing)} segments were not translated")


def _assemble(segments, tokens, chunks, results):
    translations = {}
    entries = {}
    grammar = {}
    for chunk, result in zip(chunks, results):
        for item in result["translations"]:
            translations[item["id"]] = item["zh"].strip()

        requested = set(chunk["words"])
        for item in result["vocabulary"]:
            if item["word"] in requested:
                entries.setdefault(item["word"], item)

        ids = {segment["id"] for segment in chunk["segments"]}
        for item in result["grammar"]:
            _merge_grammar(grammar, item, ids, segments)

    out_segments = []
    usage = {}
    for index, segment in enumerate(segments):
        for token in tokens[index]:
            word = token.get("v")
            if word is None:
                continue
            if word in entries:
                usage.setdefault(word, []).append(index)
            else:
                del token["v"]
        out_segments.append({
            "id": index,
            "start": segment["start"],
            "end": segment["end"],
            "ja": segment["text"],
            "zh": translations.get(index, ""),
            "tokens": tokens[index],
            "grammar": [],
        })

    vocabulary = []
    for word, found in usage.items():
        entry = entries[word]
        vocabulary.append({
            "id": word,
            "word": word,
            "reading": entry["reading"],
            "pos": entry["pos"],
            "level": entry["level"],
            "meaning": entry["meaning"],
            "usage": entry["usage"],
            "example": {
                "ja": entry["example_ja"], "zh": entry["example_zh"]},
            "count": len(found),
            "segments": list(dict.fromkeys(found)),
        })

    grammar_list = []
    for number, item in enumerate(grammar.values(), start=1):
        item["id"] = f"g{number}"
        item["occurrences"].sort(key=lambda found: found["segment"])
        for occurrence in item["occurrences"]:
            out_segments[occurrence["segment"]]["grammar"].append(item["id"])
        grammar_list.append(item)

    return {
        "segments": out_segments,
        "vocabulary": vocabulary,
        "grammar": grammar_list,
    }


def _pattern_key(pattern):
    """Return a key that is equal for two spellings of one pattern.

    Chunks are analyzed independently, so the same pattern can come back as
    ``〜から（理由）`` and ``～から(原因)``.
    """
    pattern = re.sub(r"[（(][^）)]*[）)]", "", pattern)
    return re.sub(r"[\s~～〜…]", "", pattern)


def _merge_grammar(grammar, item, chunk_ids, segments):
    occurrences = []
    seen = set()
    for occurrence in item["occurrences"]:
        index = occurrence["id"]
        if index not in chunk_ids or index in seen:
            continue
        seen.add(index)
        text = occurrence["text"]
        # The UI highlights this text inside the sentence, so it is kept
        # only when it really is part of the sentence.
        if text not in segments[index]["text"]:
            text = ""
        occurrences.append({"segment": index, "text": text})
    if not occurrences:
        return

    key = _pattern_key(item["pattern"])
    if key in grammar:
        grammar[key]["occurrences"].extend(occurrences)
        return
    grammar[key] = {
        "pattern": item["pattern"],
        "level": item["level"],
        "meaning": item["meaning"],
        "explanation": item["explanation"],
        "usage": item["usage"],
        "examples": item["examples"],
        "occurrences": occurrences,
    }

# vim: set ff=unix fenc=utf8 et sw=4 ts=4 sts=4 tw=79:
