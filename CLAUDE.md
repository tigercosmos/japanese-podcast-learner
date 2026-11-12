# Agent Instructions

This file provides guidance to AI coding agents working in this repository
(Claude Code, Codex, and Cursor). `AGENTS.md` at the repo root and
`.cursor/AGENTS.md` are symlinks to this file.

## Project Overview

A web app for learning Japanese from podcasts, for Traditional Chinese
speakers. It has two halves:

- `backend/` -- Python (FastAPI + uvicorn) service. It owns the work that
  cannot run in a browser, for example fetching podcast feeds and audio,
  transcription, and Japanese text analysis.
- `frontend/` -- React 19 + TypeScript + Vite + Tailwind CSS v4 single-page
  app. The UI is in Traditional Chinese.

The repository is a scaffold: the layout, tooling, and configuration are in
place, but no features are implemented yet. `plan.md` holds the system design
and the open decisions.

## Build, Test, Lint

All workflows are driven through `make` from the repo root. The Makefile sets
`PYTHONPATH=backend` so the in-tree `podcast_learner` package imports without
installation.

**Install**

- `make install` -- both halves (`make pyinstall` + `make npminstall`).
- `make pyinstall` -- `pip install -e "backend[dev]"`.
- `make npminstall` -- `npm install` in `frontend/`.

**Run**

- `make serve` -- backend dev server at `http://127.0.0.1:8000` with reload.
  The ASGI app is `BACKEND_APP` (default `podcast_learner.app:app`).
- `make dev` -- frontend dev server at `http://127.0.0.1:5173/`. Vite proxies
  `/api` to the backend, so the frontend uses relative `/api/...` URLs.
- `make build` -- frontend production build into `frontend/dist/`.

**Test**

- `make test` -- backend pytest + frontend Vitest.
- `make pytest` -- backend tests. `make pytest PYTEST_OPTS="-k name"` forwards
  options verbatim to pytest.
- `make vitest` -- frontend unit tests (`frontend/src/**/*.test.ts(x)`).
- `make e2e` -- Playwright tests in `frontend/e2e/` (port 5174, separate from
  dev).

**Lint** (`make lint` runs all four)

- `make flake8` -- Python style and the 79-char line limit.
- `make checktws` -- reject trailing whitespace in tracked files.
- `make eslint` -- frontend ESLint.
- `make tsc` -- frontend type check (`tsc -b`: app, tests, and config files).

Inside `frontend/`, the `npm run dev|build|lint|test|test:e2e` scripts work
directly as well.

## Architecture

```
backend/
  pyproject.toml        Python package metadata and dependencies
  podcast_learner/      Backend package (FastAPI app, services)
  tests/                pytest suite
frontend/
  src/                  React app (components, hooks, lib, pages, types)
  e2e/                  Playwright tests
  public/               Static assets
```

- HTTP routes are mounted under `/api`.
- In development the two servers run separately (`make serve` and
  `make dev`); Vite proxies `/api` to `BACKEND_URL`
  (default `http://127.0.0.1:8000`).
- Python tests are the default for backend logic. Frontend logic goes in
  plain modules under `src/lib/` so Vitest can test it without rendering.

## Agent Tooling (Claude Code, Codex, and Cursor)

### Claude Code (`.claude/`)

- `settings.json` -- `permissions.allow` whitelists the `make` targets,
  test/lint tools, and read-only git/gh. `permissions.deny` blocks `sudo` and
  `rm -rf` of root/home. `hooks` wires `check-source.sh` on `Write|Edit`.
  `statusLine` runs `statusline.sh`.
- `hooks/check-source.sh` -- PostToolUse on Python files. Reports trailing
  whitespace, a missing modeline, and lines over 79 characters; exits 2 with
  `path:line -- rule -- fix`.
- `skills/python-style-review` -- judgment-call Python review (naming,
  imports, comments, test intent), scoped to `git diff`. Invoke after
  editing `backend/`.
- `skills/codex` -- run the Codex CLI for a second opinion.
- `launch.json` -- `frontend` (`make dev`, port 5173) and `backend`
  (`make serve`, port 8000) launch configurations.

### Codex (`.codex/` and `.agents/`)

- `AGENTS.md` at the repository root is a symlink to `CLAUDE.md`.
- `.agents/skills/` is a symlink to `.claude/skills/`.
- `.codex/config.toml` configures the Codex TUI status line.
- `.codex/hooks.json` wires `PostToolUse` to the shared `check-source.sh`.
- `.codex/hooks/` is a symlink to `.claude/hooks/`.

### Cursor (`.cursor/`)

- `cli.json` -- permissions translated from `.claude/settings.json`
  (`Shell(...)` replaces `Bash(...)`).
- `hooks.json` -- wires the shared `check-source.sh`.
- `hooks/`, `skills/`, `statusline.sh`, `AGENTS.md` -- symlinks into
  `.claude/` and to `CLAUDE.md`.

## Code Style

`STYLE.md` is the canonical source. At a glance:

- **Python**: PEP-8, 79-char hard limit, flake8, modeline at EOF, import
  modules rather than names.
- **TypeScript**: ESLint + strict `tsc`; follow the surrounding code.
- **All source**: UTF-8, Unix LF, no trailing whitespace. Japanese text is
  fine in strings, data, and docs; identifiers and comments are English.
- **Comments**: Default to none. Add one only for what the code cannot say.

## Documents

- `plan.md` holds the system design. Update it with every big feature or
  refactoring.
- Update `README.md` for any change that affects users or developers.

## Pull Request Guidelines

- Before pushing, run `make lint` and `make test`, and invoke
  `python-style-review` for changed backend files. Report the actual results;
  never declare the branch clean without running the checks.
- Write the PR subject and body against the real diff. Keep it short and
  accurate.
- Reference related issues ("Related to #12") instead of closing keywords.

## Writing Style for Prose

- Minimize em-dashes. Prefer a comma, a colon, parentheses, or two sentences.
- Write plainly. Short sentences beat long ones.
- Do not hard-wrap GitHub prose (issues, PRs, comments): write one line per
  paragraph. Source files and Markdown in the repo keep their wrap widths.

## Continuous Integration

`.github/workflows/ci.yml` runs two jobs on push and pull request to `main`:
`backend` (flake8, trailing whitespace, pytest) and `frontend` (ESLint, tsc,
Vitest, Playwright, build). Keep each step's `run:` short; move real logic
into a Makefile target or a script.

<!-- vim: set ft=markdown ff=unix fenc=utf8 et sw=2 ts=2 sts=2 tw=79: -->
