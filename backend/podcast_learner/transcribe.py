"""Local Japanese speech-to-text with Whisper on Apple Silicon (MLX)."""

from podcast_learner import errors


def transcribe(audio_path, model):
    """Return the transcript segments of an audio file.

    :param audio_path: Any file that ffmpeg can decode.
    :param model: Hugging Face repository of an MLX Whisper model.
    """
    try:
        import mlx_whisper
    except ImportError as exc:
        raise errors.PipelineError(
            "這部影片沒有日文字幕，而且尚未安裝本機語音辨識模型。"
            "請執行 make pyinstall PYEXTRAS=dev,whisper 後再試一次。"
        ) from exc

    result = mlx_whisper.transcribe(
        str(audio_path),
        path_or_hf_repo=model,
        language="ja",
        verbose=None,
        # Feeding earlier output back in can lock Whisper into repeating one
        # line for the rest of a long recording.
        condition_on_previous_text=False,
    )
    return [
        {"start": seg["start"], "end": seg["end"], "text": seg["text"]}
        for seg in result["segments"]
    ]

# vim: set ff=unix fenc=utf8 et sw=4 ts=4 sts=4 tw=79:
