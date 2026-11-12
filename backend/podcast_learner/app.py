"""FastAPI application. All routes live under ``/api``."""

from fastapi import APIRouter, FastAPI, HTTPException
import pydantic

from podcast_learner import config
from podcast_learner import errors
from podcast_learner import pipeline as pipeline_module
from podcast_learner import store as store_module


class SubmitRequest(pydantic.BaseModel):
    url: str


def create_app(pipeline=None):
    """Return the application.

    :param pipeline: A ``pipeline.Pipeline``. The default one stores data
        under the configured data directory.
    """
    if pipeline is None:
        settings = config.load()
        pipeline = pipeline_module.Pipeline(
            store_module.Store(settings.data_dir), settings)
        pipeline.recover()
    store = pipeline.store
    router = APIRouter(prefix="/api")

    def require_meta(video_id):
        try:
            meta = store.get_meta(video_id)
        except ValueError:
            meta = None
        if meta is None:
            raise HTTPException(status_code=404, detail="找不到這部影片。")
        return meta

    @router.get("/health")
    def health():
        return {"status": "ok"}

    @router.get("/videos")
    def list_videos():
        return store.list_meta()

    @router.post("/videos")
    def submit_video(request: SubmitRequest):
        try:
            return pipeline.submit(request.url)
        except errors.PipelineError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.get("/videos/{video_id}")
    def get_video(video_id: str):
        meta = require_meta(video_id)
        if meta["status"] == "ready":
            content = store.get_content(video_id)
            if content is not None:
                meta.update(content)
        return meta

    @router.delete("/videos/{video_id}", status_code=204)
    def delete_video(video_id: str):
        require_meta(video_id)
        if pipeline.is_active(video_id):
            raise HTTPException(
                status_code=409, detail="影片還在處理中，無法刪除。")
        store.delete(video_id)

    app = FastAPI(title="Japanese Podcast Learner")
    app.include_router(router)
    return app


app = create_app()

# vim: set ff=unix fenc=utf8 et sw=4 ts=4 sts=4 tw=79:
