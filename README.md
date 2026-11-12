# Japanese Podcast Learner (日語 Podcast 學習)

A web app for learning Japanese from podcasts, built for Traditional Chinese
speakers. It has a Python backend and a React frontend.

> **Status:** Scaffold only. The repository layout, tooling, and configuration
> are in place. No features are implemented yet. See `plan.md` for the design.

## Tech Stack

- **Backend:** Python 3.12+, FastAPI, uvicorn, pytest, flake8
- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4, React Router v7
- **Frontend tests:** Vitest (unit), Playwright (end-to-end)

## Getting Started

### Prerequisites

- Python 3.12 or later
- Node.js 22 or later, with npm
- GNU Make

### Installation

```bash
git clone https://github.com/tigercosmos/japanese-podcast-learner.git
cd japanese-podcast-learner
make install
```

`make install` runs `pip install -e "backend[dev]"` for the backend and
`npm install` in `frontend/`. Use `make pyinstall` or `make npminstall` to
install only one half. Activate the Python environment you want before you run
it.

### Development

Run the backend and the frontend in two terminals:

```bash
make serve   # Backend at http://127.0.0.1:8000 (auto-reload)
make dev     # Frontend at http://127.0.0.1:5173/
```

The frontend dev server forwards requests under `/api` to the backend. To use
a backend at a different address, set `BACKEND_URL`:

```bash
BACKEND_URL=http://127.0.0.1:9000 make dev
```

### Build

```bash
make build
```

Writes the frontend production build to `frontend/dist/`.

### Testing

```bash
make test                       # Backend pytest + frontend Vitest
make pytest                     # Backend tests only
make pytest PYTEST_OPTS="-k x"  # Pass options to pytest
make vitest                     # Frontend unit tests
make e2e                        # Frontend end-to-end tests (Playwright)
```

Before you run `make e2e` for the first time, install the browser:
`cd frontend && npx playwright install chromium`.

### Linting

```bash
make lint    # flake8, trailing whitespace, ESLint, tsc
```

## Project Structure

```
backend/
  pyproject.toml        Package metadata and dependencies
  podcast_learner/      Backend package
  tests/                pytest suite
frontend/
  src/                  React app
  e2e/                  Playwright tests
  public/               Static assets
Makefile                Entry point for install, run, test, and lint
plan.md                 System design and open decisions
STYLE.md                Coding style guide
CLAUDE.md               Guide for AI coding agents (AGENTS.md links here)
LICENSE                 MIT license
```

## AI Agent Tooling

The repository includes configuration for Claude Code (`.claude/`), Codex
(`.codex/`, `.agents/`), and Cursor (`.cursor/`). They share one guide
(`CLAUDE.md`), one set of hooks, and one set of skills. See `CLAUDE.md` for
details.

## License

MIT
