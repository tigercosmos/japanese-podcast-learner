import time

from fastapi.testclient import TestClient
import pytest

from podcast_learner import app as app_module
from podcast_learner import config
from podcast_learner import pipeline as pipeline_module
from podcast_learner import store as store_module

import fakes

URL = f"https://www.youtube.com/watch?v={fakes.VIDEO_ID}"


def make_client(tmp_path, source=None, runner=None):
    pipeline = pipeline_module.Pipeline(
        store_module.Store(tmp_path), config.Settings(data_dir=tmp_path),
        source=source or fakes.FakeSource(),
        transcriber=fakes.fake_transcriber,
        runner=runner or fakes.FakeRunner())
    return TestClient(app_module.create_app(pipeline))


def wait_until_done(client, video_id=fakes.VIDEO_ID):
    deadline = time.monotonic() + 10
    while time.monotonic() < deadline:
        video = client.get(f"/api/videos/{video_id}").json()
        if video["status"] in ("ready", "failed"):
            return video
        time.sleep(0.02)
    pytest.fail("the video was not processed in time")


def test_video_with_japanese_subtitles_uses_them(tmp_path):
    source = fakes.FakeSource(subtitle_lang="ja")
    client = make_client(tmp_path, source=source)

    response = client.post("/api/videos", json={"url": URL})
    video = wait_until_done(client)

    assert response.status_code == 200
    assert response.json()["id"] == fakes.VIDEO_ID
    assert video["status"] == "ready"
    assert video["transcript_source"] == "youtube"
    assert source.audio_downloads == 0
    # The [音楽] cue is not speech, so it is not a subtitle.
    assert [s["ja"] for s in video["segments"]] == ["猫を見てしまいました。"]
    assert video["segments"][0]["zh"] == "譯文0"
    assert video["counts"]["vocabulary"] == len(video["vocabulary"]) > 0


def test_video_without_subtitles_is_transcribed_locally(tmp_path):
    source = fakes.FakeSource(subtitle_lang=None)
    client = make_client(tmp_path, source=source)

    client.post("/api/videos", json={"url": URL})
    video = wait_until_done(client)

    assert video["transcript_source"] == "whisper"
    assert source.audio_downloads == 1
    assert [s["ja"] for s in video["segments"]] == ["犬が好きです。"]
    assert not (tmp_path / "videos" / fakes.VIDEO_ID / "work"
                / "audio.webm").exists()


def test_ready_video_is_not_processed_twice(tmp_path):
    runner = fakes.FakeRunner()
    client = make_client(tmp_path, runner=runner)

    client.post("/api/videos", json={"url": URL})
    wait_until_done(client)
    again = client.post("/api/videos", json={"url": URL})

    assert again.json()["status"] == "ready"
    assert runner.calls == 1


def test_failure_is_reported_and_can_be_retried(tmp_path):
    source = fakes.FakeSource(fail=True)
    client = make_client(tmp_path, source=source)

    client.post("/api/videos", json={"url": URL})
    failed = wait_until_done(client)
    source.fail = False
    client.post("/api/videos", json={"url": URL})
    retried = wait_until_done(client)

    assert failed["status"] == "failed"
    assert "無法取得影片資訊" in failed["error"]
    assert "segments" not in failed
    assert retried["status"] == "ready"
    assert retried["error"] == ""


def test_retry_after_failed_analysis_keeps_the_transcript(tmp_path):
    source = fakes.FakeSource(subtitle_lang=None)

    def broken(prompt, system, schema):
        raise RuntimeError("claude is down")

    make_client(tmp_path, source=source, runner=broken).post(
        "/api/videos", json={"url": URL})
    client = make_client(tmp_path, source=source)
    assert wait_until_done(client)["status"] == "failed"

    client.post("/api/videos", json={"url": URL})

    assert wait_until_done(client)["status"] == "ready"
    assert source.audio_downloads == 1


def test_invalid_url_is_rejected(tmp_path):
    client = make_client(tmp_path)

    response = client.post("/api/videos", json={"url": "https://x.test/1"})

    assert response.status_code == 400
    assert "YouTube" in response.json()["detail"]
    assert client.get("/api/videos").json() == []


def test_list_and_delete(tmp_path):
    client = make_client(tmp_path)
    client.post("/api/videos", json={"url": URL})
    wait_until_done(client)

    listed = client.get("/api/videos").json()
    deleted = client.delete(f"/api/videos/{fakes.VIDEO_ID}")

    assert [video["id"] for video in listed] == [fakes.VIDEO_ID]
    # The list is light: the transcript is served per video.
    assert "segments" not in listed[0]
    assert deleted.status_code == 204
    assert client.get("/api/videos").json() == []
    assert client.get(f"/api/videos/{fakes.VIDEO_ID}").status_code == 404


def test_unknown_video_is_not_found(tmp_path):
    client = make_client(tmp_path)

    assert client.get("/api/videos/abcdefghijk").status_code == 404
    assert client.get("/api/videos/not-an-id").status_code == 404
    assert client.delete("/api/videos/abcdefghijk").status_code == 404


def test_recover_fails_videos_left_by_a_dead_process(tmp_path):
    store = store_module.Store(tmp_path)
    store.save_meta({"id": fakes.VIDEO_ID, "status": "processing"})
    pipeline = pipeline_module.Pipeline(
        store, config.Settings(data_dir=tmp_path))

    pipeline.recover()

    meta = store.get_meta(fakes.VIDEO_ID)
    assert meta["status"] == "failed"
    assert meta["error"]

# vim: set ff=unix fenc=utf8 et sw=4 ts=4 sts=4 tw=79:
