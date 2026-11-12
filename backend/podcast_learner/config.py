"""Runtime settings, read from the environment."""

import dataclasses
import os
import pathlib

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]


@dataclasses.dataclass(frozen=True)
class Settings:
    data_dir: pathlib.Path
    claude_bin: str = "claude"
    claude_model: str = "opus"
    claude_effort: str = "medium"
    claude_timeout: int = 900
    claude_workers: int = 4
    # The CLI prefers ANTHROPIC_API_KEY over its own login. Dropping the key
    # makes the subprocess use the Claude Code subscription instead.
    claude_keep_api_key: bool = False
    whisper_model: str = "mlx-community/whisper-large-v3-turbo"


def load():
    """Return the settings for this process."""
    env = os.environ
    return Settings(
        data_dir=pathlib.Path(
            env.get("PODCAST_LEARNER_DATA", REPO_ROOT / "data")),
        claude_bin=env.get("PODCAST_LEARNER_CLAUDE_BIN", "claude"),
        claude_model=env.get("PODCAST_LEARNER_CLAUDE_MODEL", "opus"),
        claude_effort=env.get("PODCAST_LEARNER_CLAUDE_EFFORT", "medium"),
        claude_timeout=int(env.get("PODCAST_LEARNER_CLAUDE_TIMEOUT", "900")),
        claude_workers=int(env.get("PODCAST_LEARNER_CLAUDE_WORKERS", "4")),
        claude_keep_api_key=env.get(
            "PODCAST_LEARNER_CLAUDE_KEEP_API_KEY", "") == "1",
        whisper_model=env.get(
            "PODCAST_LEARNER_WHISPER_MODEL",
            "mlx-community/whisper-large-v3-turbo"),
    )

# vim: set ff=unix fenc=utf8 et sw=4 ts=4 sts=4 tw=79:
