from podcast_learner import transcript


def test_parse_json3_joins_the_pieces_of_a_cue():
    document = {"events": [
        {"tStartMs": 1500, "dDurationMs": 2500,
         "segs": [{"utf8": "こんにちは"}, {"utf8": "、皆さん"}]},
        # A window-style event carries no text.
        {"tStartMs": 0, "dDurationMs": 100},
    ]}

    segments = transcript.parse_json3(document)

    assert segments[0] == {
        "start": 1.5, "end": 4.0, "text": "こんにちは、皆さん"}
    assert segments[1]["text"] == ""


def test_clean_drops_cues_without_speech():
    segments = transcript.clean([
        {"start": 0, "end": 1, "text": "[音楽]"},
        {"start": 1, "end": 2, "text": "音楽"},
        {"start": 2, "end": 3, "text": "♪♪"},
        {"start": 3, "end": 4, "text": "  "},
        {"start": 4, "end": 5, "text": "（笑）そうですね"},
    ])

    assert [segment["text"] for segment in segments] == ["そうですね"]


def test_clean_joins_wrapped_lines():
    segments = transcript.clean(
        [{"start": 0, "end": 1, "text": " 今日は\nいい天気 "}])

    assert segments[0]["text"] == "今日は いい天気"


def test_clean_orders_segments_and_removes_overlap():
    # Two subtitles on screen at once would hide the one being spoken.
    segments = transcript.clean([
        {"start": 2, "end": 6, "text": "二"},
        {"start": 0, "end": 3, "text": "一"},
    ])

    assert [segment["text"] for segment in segments] == ["一", "二"]
    assert segments[0]["end"] == 2

# vim: set ff=unix fenc=utf8 et sw=4 ts=4 sts=4 tw=79:
