"""Japanese tokenization, furigana, and vocabulary candidates."""

import functools
import re

import sudachipy

# Parts of speech worth a vocabulary entry. Particles, auxiliaries, affixes,
# and symbols are left out.
CONTENT_POS = frozenset([
    "名詞", "代名詞", "動詞", "形容詞", "形状詞", "副詞", "連体詞", "接続詞",
    "感動詞",
])

_KANA_RE = re.compile(r"[ぁ-ゖァ-ヺー]+")
_KANJI_RE = re.compile(r"[一-鿿㐀-䶿々〆ヶ]")
_JAPANESE_RE = re.compile(r"[ぁ-ゖァ-ヺ一-鿿㐀-䶿々]")
_KATAKANA_TO_HIRAGANA = {code: code - 0x60 for code in range(0x30A1, 0x30F7)}


@functools.cache
def _dictionary():
    return sudachipy.Dictionary()


def to_hiragana(text):
    return text.translate(_KATAKANA_TO_HIRAGANA)


def furigana(surface, reading):
    """Split a word into ``[text, ruby]`` pairs.

    The ruby covers only the kanji: 食べる with reading タベル gives
    ``[["食", "た"], ["べる", None]]``.

    :param surface: The word as written.
    :param reading: Its reading in kana.
    :return: The pairs, or None when the word has no kanji.
    """
    if not _KANJI_RE.search(surface):
        return None
    reading = to_hiragana(reading)

    runs = []
    position = 0
    for match in _KANA_RE.finditer(surface):
        if match.start() > position:
            runs.append((surface[position:match.start()], False))
        runs.append((match.group(), True))
        position = match.end()
    if position < len(surface):
        runs.append((surface[position:], False))

    pattern = "".join(
        re.escape(to_hiragana(text)) if is_kana else "(.+)"
        for text, is_kana in runs)
    match = re.fullmatch(pattern, reading)
    if match is None:
        return [[surface, reading]]

    rubies = iter(match.groups())
    return [
        [text, None if is_kana else next(rubies)] for text, is_kana in runs]


def tokenize(text):
    """Return the tokens of a sentence.

    Each token is a dict with ``s`` (surface). A token with kanji has
    ``f`` (furigana pairs). A content word has ``v``, its dictionary
    form, which is the key of its vocabulary entry.
    """
    tokenizer = _dictionary().tokenizer(mode=sudachipy.SplitMode.C)
    tokens = []
    for morpheme in tokenizer.tokenize(text):
        surface = morpheme.surface()
        token = {"s": surface}
        ruby = furigana(surface, morpheme.reading_form())
        if ruby is not None:
            token["f"] = ruby
        pos = morpheme.part_of_speech()
        lemma = morpheme.dictionary_form()
        if (pos[0] in CONTENT_POS and pos[1] != "数詞"
                and _JAPANESE_RE.search(lemma)):
            token["v"] = lemma
        tokens.append(token)
    return tokens

# vim: set ff=unix fenc=utf8 et sw=4 ts=4 sts=4 tw=79:
