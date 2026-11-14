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


def wait_for_download(client, video_id=fakes.VIDEO_ID):
    deadline = time.monotonic() + 10
    while time.monotonic() < deadline:
        video = client.get(f"/api/videos/{video_id}").json()
        if video["video_download"] != "running":
            return video
        time.sleep(0.02)
    pytest.fail("the video was not downloaded in time")


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


def test_whisper_transcript_is_proofread_before_analysis(tmp_path):
    source = fakes.FakeSource(subtitle_lang=None)
    runner = fakes.FakeRunner(corrections={0: "猫が好きです。"})
    client = make_client(tmp_path, source=source, runner=runner)

    client.post("/api/videos", json={"url": URL})
    video = wait_until_done(client)

    assert [s["ja"] for s in video["segments"]] == ["猫が好きです。"]
    # The vocabulary comes from the corrected line, not from what Whisper
    # heard.
    words = [entry["word"] for entry in video["vocabulary"]]
    assert "猫" in words and "犬" not in words


def test_uploaded_subtitles_are_not_proofread(tmp_path):
    runner = fakes.FakeRunner(corrections={0: "犬を見てしまいました。"})
    client = make_client(tmp_path, runner=runner)

    client.post("/api/videos", json={"url": URL})
    video = wait_until_done(client)

    assert [s["ja"] for s in video["segments"]] == ["猫を見てしまいました。"]
    assert runner.calls == 1


def test_ready_video_is_not_processed_twice(tmp_path):
    runner = fakes.FakeRunner()
    client = make_client(tmp_path, runner=runner)

    client.post("/api/videos", json={"url": URL})
    wait_until_done(client)
    again = client.post("/api/videos", json={"url": URL})

    assert again.json()["status"] == "ready"
    assert runner.calls == 1


def test_video_that_cannot_be_embedded_is_rejected_at_once(tmp_path):
    source = fakes.FakeSource(embeddable=False)
    runner = fakes.FakeRunner()
    client = make_client(tmp_path, source=source, runner=runner)

    response = client.post("/api/videos", json={"url": URL})

    assert response.status_code == 400
    assert response.json()["code"] == "not_embeddable"
    assert "不允許在 YouTube 以外的網站播放" in response.json()["detail"]
    # Nothing is stored, so the list shows no video that cannot be watched.
    assert client.get("/api/videos").json() == []
    assert runner.calls == 0


def test_video_that_cannot_be_embedded_can_be_downloaded(tmp_path):
    source = fakes.FakeSource(embeddable=False)
    client = make_client(tmp_path, source=source)

    client.post("/api/videos", json={"url": URL, "download": True})
    video = wait_until_done(client)
    served = client.get(f"/api/videos/{fakes.VIDEO_ID}/file")

    assert video["status"] == "ready"
    assert video["local_video"] is True
    assert served.content == fakes.VIDEO_BYTES
    assert served.headers["content-type"] == "video/mp4"


def test_video_file_supports_seeking(tmp_path):
    client = make_client(tmp_path)
    client.post("/api/videos", json={"url": URL, "download": True})
    wait_until_done(client)

    part = client.get(
        f"/api/videos/{fakes.VIDEO_ID}/file", headers={"Range": "bytes=10-19"})

    # A <video> element asks for ranges. Without them it cannot seek.
    assert part.status_code == 206
    assert part.content == fakes.VIDEO_BYTES[10:20]


def test_embeddable_video_keeps_no_file(tmp_path):
    source = fakes.FakeSource()
    client = make_client(tmp_path, source=source)

    client.post("/api/videos", json={"url": URL})
    video = wait_until_done(client)

    assert video["local_video"] is False
    assert source.video_downloads == 0
    assert client.get(
        f"/api/videos/{fakes.VIDEO_ID}/file").status_code == 404


def test_downloaded_video_is_transcribed_without_a_second_download(tmp_path):
    source = fakes.FakeSource(subtitle_lang=None, embeddable=False)
    client = make_client(tmp_path, source=source)

    client.post("/api/videos", json={"url": URL, "download": True})
    video = wait_until_done(client)

    assert video["transcript_source"] == "whisper"
    assert source.audio_downloads == 0
    # The file is the video to watch, so transcription must not remove it.
    assert client.get(
        f"/api/videos/{fakes.VIDEO_ID}/file").status_code == 200


def test_retry_does_not_download_the_video_again(tmp_path):
    source = fakes.FakeSource(embeddable=False)

    def broken(prompt, system, schema):
        raise RuntimeError("claude is down")

    request = {"url": URL, "download": True}
    make_client(tmp_path, source=source, runner=broken).post(
        "/api/videos", json=request)
    client = make_client(tmp_path, source=source)
    assert wait_until_done(client)["status"] == "failed"

    client.post("/api/videos", json=request)

    assert wait_until_done(client)["local_video"] is True
    assert source.video_downloads == 1


def test_finished_video_can_be_downloaded_later(tmp_path):
    source = fakes.FakeSource()
    runner = fakes.FakeRunner()
    client = make_client(tmp_path, source=source, runner=runner)
    client.post("/api/videos", json={"url": URL})
    wait_until_done(client)

    started = client.post(f"/api/videos/{fakes.VIDEO_ID}/download")
    video = wait_for_download(client)
    client.post(f"/api/videos/{fakes.VIDEO_ID}/download")

    assert started.json()["video_download"] == "running"
    assert video["local_video"] is True
    assert video["status"] == "ready"
    assert video["segments"]
    # Only the file is fetched: no second analysis, no second download.
    assert runner.calls == 1
    assert source.video_downloads == 1
    assert client.get(
        f"/api/videos/{fakes.VIDEO_ID}/file").content == fakes.VIDEO_BYTES


def test_failed_download_is_reported_and_can_be_retried(tmp_path):
    source = fakes.FakeSource()
    source.video_fails = True
    client = make_client(tmp_path, source=source)
    client.post("/api/videos", json={"url": URL})
    wait_until_done(client)

    client.post(f"/api/videos/{fakes.VIDEO_ID}/download")
    failed = wait_for_download(client)
    source.video_fails = False
    client.post(f"/api/videos/{fakes.VIDEO_ID}/download")
    retried = wait_for_download(client)

    assert failed["video_download"] == "failed"
    assert "無法下載影片" in failed["video_error"]
    assert failed["status"] == "ready"
    assert retried["local_video"] is True
    assert retried["video_error"] == ""


def test_unfinished_video_cannot_be_downloaded_separately(tmp_path):
    def broken(prompt, system, schema):
        raise RuntimeError("claude is down")

    client = make_client(tmp_path, runner=broken)
    client.post("/api/videos", json={"url": URL})
    wait_until_done(client)

    response = client.post(f"/api/videos/{fakes.VIDEO_ID}/download")

    assert response.status_code == 400


def test_delete_removes_the_downloaded_video(tmp_path):
    client = make_client(tmp_path)
    client.post("/api/videos", json={"url": URL, "download": True})
    wait_until_done(client)
    path = tmp_path / "videos" / fakes.VIDEO_ID / "video.mp4"
    assert path.is_file()

    client.delete(f"/api/videos/{fakes.VIDEO_ID}")

    assert not path.exists()


def test_unreachable_video_is_rejected_and_can_be_retried(tmp_path):
    source = fakes.FakeSource(fail=True)
    client = make_client(tmp_path, source=source)

    failed = client.post("/api/videos", json={"url": URL})
    source.fail = False
    client.post("/api/videos", json={"url": URL})
    retried = wait_until_done(client)

    assert failed.status_code == 400
    assert "無法取得影片資訊" in failed.json()["detail"]
    assert retried["status"] == "ready"
    assert retried["error"] == ""


def test_ready_video_is_returned_without_asking_youtube_again(tmp_path):
    source = fakes.FakeSource()
    client = make_client(tmp_path, source=source)
    client.post("/api/videos", json={"url": URL})
    wait_until_done(client)

    source.embeddable = False
    again = client.post("/api/videos", json={"url": URL})

    assert again.json()["status"] == "ready"
    assert source.info_fetches == 1


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


def test_recover_fails_a_download_left_by_a_dead_process(tmp_path):
    store = store_module.Store(tmp_path)
    store.save_meta({
        "id": fakes.VIDEO_ID, "status": "ready",
        "video_download": "running"})
    pipeline = pipeline_module.Pipeline(
        store, config.Settings(data_dir=tmp_path))

    pipeline.recover()

    meta = store.get_meta(fakes.VIDEO_ID)
    assert meta["status"] == "ready"
    assert meta["video_download"] == "failed"
    assert meta["video_error"]

# vim: set ff=unix fenc=utf8 et sw=4 ts=4 sts=4 tw=79:
