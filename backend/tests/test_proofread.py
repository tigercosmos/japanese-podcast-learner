import json

import pytest

from podcast_learner import analysis
from podcast_learner import errors
from podcast_learner import proofread

import fakes


def segments_of(*texts):
    return [
        {"start": float(index), "end": index + 1.0, "text": text}
        for index, text in enumerate(texts)]


def test_proofread_replaces_only_the_corrected_lines(tmp_path):
    segments = segments_of("今日は雨が振っています。", "傘を持ちました。")
    runner = fakes.FakeRunner(corrections={0: "今日は雨が降っています。"})

    result = proofread.proofread("題", segments, runner, tmp_path)

    assert result == [
        {"start": 0.0, "end": 1.0, "text": "今日は雨が降っています。"},
        {"start": 1.0, "end": 2.0, "text": "傘を持ちました。"}]
    assert segments[0]["text"] == "今日は雨が振っています。"


def test_proofread_ignores_a_rewrite(tmp_path):
    segments = segments_of("今日は雨が振っています。", "傘を持ちました。")
    runner = fakes.FakeRunner(corrections={
        0: "雨。",
        1: "傘を持ちました。そして家を出て、駅まで歩いて行きました。"})

    result = proofread.proofread("題", segments, runner, tmp_path)

    assert result == segments


def test_proofread_ignores_a_different_sentence_of_similar_length(tmp_path):
    segments = segments_of("今日は雨が振っています。")
    runner = fakes.FakeRunner(corrections={0: "明日の朝に出かけましょう。"})

    result = proofread.proofread("題", segments, runner, tmp_path)

    assert result == segments


def test_proofread_accepts_a_short_line_that_is_one_misheard_name(tmp_path):
    segments = segments_of("ミサイ！")
    runner = fakes.FakeRunner(corrections={0: "みさえ！"})

    result = proofread.proofread("題", segments, runner, tmp_path)

    assert result[0]["text"] == "みさえ！"


def test_proofread_asks_again_after_a_malformed_answer(tmp_path):
    segments = segments_of("猫を見る。", "犬を見る。")
    answers = [
        {"corrections": [{"id": True, "ja": "鳥を見る。"}]},
        {"corrections": [{"id": 1, "ja": None}]},
        {"corrections": []}]

    def runner(prompt, system, schema):
        return answers.pop(0)

    result = proofread.proofread("題", segments, runner, tmp_path)

    assert result == segments
    assert answers == []


def test_proofread_does_not_trust_a_malformed_cached_answer(tmp_path):
    segments = segments_of("猫を見る。")
    proofread.proofread("題", segments, fakes.FakeRunner(), tmp_path)
    for path in tmp_path.iterdir():
        path.write_text('{"corrections": [{"id": 0}]}')
    runner = fakes.FakeRunner()

    result = proofread.proofread("題", segments, runner, tmp_path)

    assert result == segments
    assert runner.calls == 1


def test_proofread_ignores_a_line_outside_the_chunk(tmp_path, monkeypatch):
    monkeypatch.setattr(analysis, "MAX_CHUNK_SEGMENTS", 1)
    segments = segments_of("猫を見る。", "犬を見る。")

    def runner(prompt, system, schema):
        chunk = json.loads(prompt)
        if chunk["segments"][0]["id"] == 0:
            return {"corrections": [{"id": 1, "ja": "魚を見る。"}]}
        return {"corrections": []}

    result = proofread.proofread("題", segments, runner, tmp_path)

    assert result == segments


def test_proofread_reuses_finished_chunks(tmp_path):
    segments = segments_of("猫を見る。")
    first = fakes.FakeRunner()
    second = fakes.FakeRunner()

    proofread.proofread("題", segments, first, tmp_path)
    proofread.proofread("題", segments, second, tmp_path)

    assert first.calls == 1
    assert second.calls == 0


def test_proofread_reports_a_failing_runner(tmp_path):
    def runner(prompt, system, schema):
        raise RuntimeError("boom")

    with pytest.raises(errors.PipelineError, match="校對失敗：boom"):
        proofread.proofread("題", segments_of("猫を見る。"), runner, tmp_path)

# vim: set ff=unix fenc=utf8 et sw=4 ts=4 sts=4 tw=79:
