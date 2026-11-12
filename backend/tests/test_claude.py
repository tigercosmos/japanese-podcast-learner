import dataclasses
import json
import stat

import pytest

from podcast_learner import claude
from podcast_learner import config


def make_settings(tmp_path, script, **overrides):
    """Return settings whose ``claude`` binary is a shell script."""
    path = tmp_path / "claude"
    path.write_text("#!/bin/sh\n" + script, encoding="utf-8")
    path.chmod(path.stat().st_mode | stat.S_IEXEC)
    settings = config.Settings(data_dir=tmp_path, claude_bin=str(path))
    return dataclasses.replace(settings, **overrides)


def reply(**fields):
    return "cat >/dev/null; echo '" + json.dumps(fields) + "'\n"


def test_run_json_returns_the_structured_output(tmp_path):
    settings = make_settings(
        tmp_path, reply(is_error=False, structured_output={"zh": "早安"}))

    assert claude.run_json("おはよう", "system", {}, settings) == {
        "zh": "早安"}


def test_run_json_sends_the_prompt_on_stdin_in_print_mode(tmp_path):
    script = (
        'printf \'{"structured_output": {"prompt": "%s", "args": "%s"}}\''
        ' "$(cat)" "$*"\n')
    settings = make_settings(
        tmp_path, script, claude_model="haiku", claude_effort="low")

    output = claude.run_json("hello", "system", {}, settings)

    assert output["prompt"] == "hello"
    assert output["args"].startswith("-p --model haiku --effort low")


def test_default_is_opus_at_medium_effort(tmp_path):
    settings = config.Settings(data_dir=tmp_path)

    assert (settings.claude_model, settings.claude_effort) == (
        "opus", "medium")


def test_run_json_hides_the_api_key_unless_asked_to_keep_it(
        tmp_path, monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "secret")
    script = (
        'cat >/dev/null; printf \'{"structured_output": {"key": "%s"}}\''
        ' "$ANTHROPIC_API_KEY"\n')

    hidden = claude.run_json(
        "p", "s", {}, make_settings(tmp_path, script))
    kept = claude.run_json(
        "p", "s", {}, make_settings(tmp_path, script,
                                    claude_keep_api_key=True))

    assert hidden == {"key": ""}
    assert kept == {"key": "secret"}


@pytest.mark.parametrize("script", [
    reply(is_error=True, result="Credit balance is too low"),
    reply(is_error=False, result="plain text, no structured output"),
    "cat >/dev/null; echo 'not json'; exit 1\n",
])
def test_run_json_raises_on_a_failed_call(tmp_path, script):
    with pytest.raises(claude.ClaudeError):
        claude.run_json("p", "s", {}, make_settings(tmp_path, script))


def test_run_json_raises_when_the_cli_is_missing(tmp_path):
    settings = config.Settings(
        data_dir=tmp_path, claude_bin=str(tmp_path / "missing"))

    with pytest.raises(claude.ClaudeError, match="not found"):
        claude.run_json("p", "s", {}, settings)

# vim: set ff=unix fenc=utf8 et sw=4 ts=4 sts=4 tw=79:
