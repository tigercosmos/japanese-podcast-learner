import pytest

from podcast_learner import japanese


@pytest.mark.parametrize("surface, reading, expected", [
    ("食べる", "タベル", [["食", "た"], ["べる", None]]),
    ("お好み焼き", "オコノミヤキ", [
        ["お", None], ["好", "この"], ["み", None], ["焼", "や"],
        ["き", None]]),
    ("昨日", "キノウ", [["昨日", "きのう"]]),
    ("東京タワー", "トウキョウタワー", [
        ["東京", "とうきょう"], ["タワー", None]]),
])
def test_furigana_covers_only_the_kanji(surface, reading, expected):
    assert japanese.furigana(surface, reading) == expected


def test_furigana_is_not_needed_without_kanji():
    assert japanese.furigana("ラーメン", "ラーメン") is None
    assert japanese.furigana("たべる", "タベル") is None


def test_furigana_falls_back_to_the_whole_word():
    # The reading does not contain the kana of the surface, so the kanji
    # cannot be aligned one by one.
    assert japanese.furigana("行き", "ユク") == [["行き", "ゆく"]]


def test_tokenize_links_content_words_by_dictionary_form():
    tokens = japanese.tokenize("ラーメンを食べました。")

    assert "".join(token["s"] for token in tokens) == "ラーメンを食べました。"
    linked = {token["s"]: token.get("v") for token in tokens}
    assert linked["ラーメン"] == "ラーメン"
    assert linked["食べ"] == "食べる"
    # Particles, auxiliaries, and punctuation get no vocabulary entry.
    assert linked["を"] is None
    assert linked["た"] is None
    assert linked["。"] is None


def test_tokenize_skips_numbers_and_latin_words():
    tokens = japanese.tokenize("iPhoneを3台買う")

    assert [token["v"] for token in tokens if "v" in token] == ["台", "買う"]

# vim: set ff=unix fenc=utf8 et sw=4 ts=4 sts=4 tw=79:
