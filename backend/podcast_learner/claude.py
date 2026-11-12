"""Run Claude Code in print mode (``claude -p``) for structured output."""

import json
import os
import subprocess
import tempfile


class ClaudeError(Exception):
    pass


def run_json(prompt, system, schema, settings):
    """Return Claude's answer as an object that matches a JSON Schema.

    :param prompt: The user message.
    :param system: The system prompt. It replaces the Claude Code default.
    :param schema: JSON Schema that the answer must satisfy.
    :param settings: A ``config.Settings``.
    """
    command = [
        settings.claude_bin, "-p",
        "--model", settings.claude_model,
        "--effort", settings.claude_effort,
        "--output-format", "json",
        "--json-schema", json.dumps(schema),
        "--system-prompt", system,
        # A plain completion: no tools, no project or user configuration.
        "--tools", "",
        "--strict-mcp-config",
        "--setting-sources", "",
        "--disable-slash-commands",
        "--no-session-persistence",
    ]
    env = dict(os.environ)
    if not settings.claude_keep_api_key:
        env.pop("ANTHROPIC_API_KEY", None)

    with tempfile.TemporaryDirectory() as cwd:
        try:
            completed = subprocess.run(
                command, input=prompt, capture_output=True, text=True,
                cwd=cwd, env=env, timeout=settings.claude_timeout)
        except FileNotFoundError as exc:
            raise ClaudeError(
                f"claude CLI not found: {settings.claude_bin}") from exc
        except subprocess.TimeoutExpired as exc:
            raise ClaudeError("claude -p timed out") from exc

    try:
        reply = json.loads(completed.stdout)
    except json.JSONDecodeError as exc:
        detail = (completed.stderr or completed.stdout).strip()[-500:]
        raise ClaudeError(f"claude -p failed: {detail}") from exc
    if reply.get("is_error"):
        raise ClaudeError(f"claude -p failed: {reply.get('result')}")
    output = reply.get("structured_output")
    if not isinstance(output, dict):
        raise ClaudeError("claude -p returned no structured output")
    return output

# vim: set ff=unix fenc=utf8 et sw=4 ts=4 sts=4 tw=79:
