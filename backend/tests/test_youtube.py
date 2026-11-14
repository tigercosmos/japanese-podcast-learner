import pytest

from podcast_learner import youtube


@pytest.mark.parametrize("url", [
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtube.com/watch?feature=share&v=dQw4w9WgXcQ&t=42s",
    "https://m.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtu.be/dQw4w9WgXcQ?si=abc",
    "https://www.youtube.com/shorts/dQw4w9WgXcQ",
    "https://www.youtube.com/embed/dQw4w9WgXcQ",
    "https://www.youtube.com/live/dQw4w9WgXcQ",
    "youtube.com/watch?v=dQw4w9WgXcQ",
    "  dQw4w9WgXcQ  ",
])
def test_parse_video_id_accepts_the_common_url_forms(url):
    assert youtube.parse_video_id(url) == "dQw4w9WgXcQ"


@pytest.mark.parametrize("url", [
    "",
    "hello",
    "https://example.com/watch?v=dQw4w9WgXcQ",
    "https://www.youtube.com/watch?v=short",
    "https://www.youtube.com/playlist?list=PL123",
    # The id is used as a directory name.
    "https://youtu.be/../../etc",
])
def test_parse_video_id_rejects_everything_else(url):
    assert youtube.parse_video_id(url) is None


@pytest.mark.parametrize("page, status", [
    # The embed page holds the player response as JSON inside a string.
    ('\\"previewPlayabilityStatus\\":{\\"status\\":\\"OK\\",'
     '\\"playableInEmbed\\":true}', "OK"),
    ('\\"previewPlayabilityStatus\\":{\\"status\\":\\"UNPLAYABLE\\",'
     '\\"reason\\":\\"This video is unavailable\\"}', "UNPLAYABLE"),
    ('"previewPlayabilityStatus":{"status":"LOGIN_REQUIRED"}',
     "LOGIN_REQUIRED"),
    ("<html>a page in a format this code does not know</html>", None),
])
def test_parse_embed_status_reads_the_player_answer(page, status):
    assert youtube.parse_embed_status(page) == status

# vim: set ff=unix fenc=utf8 et sw=4 ts=4 sts=4 tw=79:
