import json

import pytest

from podcast_learner import analysis
from podcast_learner import errors
from podcast_learner import japanese

import fakes


def segments_of(*texts):
    return [
        {"start": float(index), "end": index + 1.0, "text": text}
        for index, text in enumerate(texts)]


def test_build_chunks_lists_a_word_only_where_it_first_appears(monkeypatch):
    monkeypatch.setattr(analysis, "MAX_CHUNK_SEGMENTS", 2)
    segments = segments_of("猫を見る。", "犬を見る。", "猫と犬を飼う。")
    tokens = [japanese.tokenize(segment["text"]) for segment in segments]

    chunks = analysis.build_chunks("題", segments, tokens)

    assert [[s["id"] for s in chunk["segments"]] for chunk in chunks] == [
        [0, 1], [2]]
    assert chunks[0]["words"] == ["猫", "見る", "犬"]
    assert chunks[1]["words"] == ["飼う"]
    assert chunks[1]["context"] == ["猫を見る。", "犬を見る。"]


def test_build_chunks_starts_a_new_chunk_at_the_character_budget(
        monkeypatch):
    monkeypatch.setattr(analysis, "MAX_CHUNK_CHARS", 10)
    segments = segments_of("あ" * 6, "い" * 6, "う" * 3)
    tokens = [[] for _ in segments]

    chunks = analysis.build_chunks("題", segments, tokens)

    assert [len(chunk["segments"]) for chunk in chunks] == [1, 2]


def test_analyze_links_tokens_to_vocabulary(tmp_path):
    segments = segments_of("猫を見る。", "猫が好き。")

    content = analysis.analyze("題", segments, fakes.FakeRunner(), tmp_path)

    assert [s["zh"] for s in content["segments"]] == ["譯文0", "譯文1"]
    words = {entry["id"]: entry for entry in content["vocabulary"]}
    assert words["猫"]["count"] == 2
    assert words["猫"]["segments"] == [0, 1]
    assert words["猫"]["example"] == {"ja": "例文。", "zh": "例句。"}
    linked = [t["v"] for t in content["segments"][0]["tokens"] if "v" in t]
    assert linked == ["猫", "見る"]


def test_analyze_unlinks_words_that_claude_left_out(tmp_path):
    def runner(prompt, system, schema):
        result = fakes.FakeRunner()(prompt, system, schema)
        result["vocabulary"] = [
            entry for entry in result["vocabulary"] if entry["word"] != "猫"]
        # An entry that was never requested has nothing to link to.
        result["vocabulary"].append(fakes.vocab_entry("幽霊"))
        return result

    content = analysis.analyze(
        "題", segments_of("猫を見る。"), runner, tmp_path)

    assert [entry["id"] for entry in content["vocabulary"]] == ["見る"]
    linked = [t.get("v") for t in content["segments"][0]["tokens"]]
    assert "猫" not in linked


def test_analyze_merges_one_grammar_pattern_across_chunks(
        tmp_path, monkeypatch):
    monkeypatch.setattr(analysis, "MAX_CHUNK_SEGMENTS", 1)

    def runner(prompt, system, schema):
        result = fakes.FakeRunner()(prompt, system, schema)
        index = json.loads(prompt)["segments"][0]["id"]
        pattern = "〜てしまう" if index == 0 else "～て しまう（完了）"
        result["grammar"] = [fakes.grammar_entry(pattern, [
            (index, "てしまい"),
            # Claude may cite a segment that it was not given.
            (99, "てしまい"),
        ])]
        return result

    content = analysis.analyze(
        "題", segments_of("見てしまいました。", "食べてしまった。"),
        runner, tmp_path, workers=1)

    assert len(content["grammar"]) == 1
    entry = content["grammar"][0]
    assert entry["pattern"] == "〜てしまう"
    # The second sentence has no てしまい, so there is nothing to mark.
    assert entry["occurrences"] == [
        {"segment": 0, "text": "てしまい"}, {"segment": 1, "text": ""}]
    assert [s["grammar"] for s in content["segments"]] == [["g1"], ["g1"]]


def test_analyze_reuses_finished_chunks(tmp_path):
    segments = segments_of("猫を見る。")
    first = fakes.FakeRunner()
    second = fakes.FakeRunner()

    analysis.analyze("題", segments, first, tmp_path)
    analysis.analyze("題", segments, second, tmp_path)

    assert first.calls == 1
    assert second.calls == 0


def test_analyze_retries_when_a_translation_is_missing(tmp_path):
    good = fakes.FakeRunner()
    calls = []

    def runner(prompt, system, schema):
        calls.append(prompt)
        result = good(prompt, system, schema)
        if len(calls) == 1:
            result["translations"].pop()
        return result

    content = analysis.analyze(
        "題", segments_of("猫を見る。", "犬を見る。"), runner, tmp_path)

    assert len(calls) == 2
    assert all(segment["zh"] for segment in content["segments"])


def test_analyze_reports_a_failing_runner(tmp_path):
    def runner(prompt, system, schema):
        raise RuntimeError("boom")

    with pytest.raises(errors.PipelineError, match="boom"):
        analysis.analyze("題", segments_of("猫を見る。"), runner, tmp_path)

# vim: set ff=unix fenc=utf8 et sw=4 ts=4 sts=4 tw=79:
