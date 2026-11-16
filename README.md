# Japanese Podcast Learner (日語 Podcast 學習)

A web app for learning Japanese from podcasts, built for Traditional Chinese
speakers. It has a Python backend and a React frontend. The UI and every
explanation are in Taiwanese Traditional Chinese.

## What It Does

Paste the link of a Japanese YouTube video. The backend then:

1. Gets the Japanese transcript. It uses the uploaded Japanese subtitles when
   the video has them. Otherwise it downloads the audio and transcribes it on
   your Mac with Whisper (MLX). Claude then corrects the clear recognition
   errors of the Whisper transcript.
2. Translates every line to Traditional Chinese with Claude Code
   (`claude -p`).
3. Lists the vocabulary (reading, meaning, usage, example) and the grammar
   patterns (explanation, how to connect, examples), also with Claude Code.

Some videos cannot be played on other sites, because the owner turned
embedding off. The app tells you so when you paste the link, before it does
any work, and offers a button to download the video to your Mac. It then
plays the local file with the same subtitles. The watch page offers the same
button when the YouTube player reports an error. A downloaded file stays in
`data/videos/<id>/video.mp4` until you delete the video in the app. Download
only videos that you are allowed to keep a copy of.

You can then learn in two ways:

- **先學習 (study first):** browse the vocabulary and grammar lists, filter by
  JLPT level, search, and read the transcript. Each entry links to the
  sentences in the video that use it.
  A speaker button reads a word or an example sentence aloud with the
  Japanese voice of your system (Web Speech API).
- **邊看邊學 (learn while watching):** the video plays with Japanese and
  Chinese subtitles drawn over it. Click a word or a grammar tag in the
  subtitle and the video pauses and shows the explanation.

See `plan.md` for the design.

## Tech Stack

- **Backend:** Python 3.12+, FastAPI, uvicorn, pytest, flake8
- **Transcript:** yt-dlp (subtitles and audio), mlx-whisper (speech-to-text)
- **Japanese analysis:** SudachiPy (tokens and furigana), Claude Code
  (translation, vocabulary, grammar)
- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4, React Router v7
- **Frontend tests:** Vitest (unit), Playwright (end-to-end)

## Getting Started

### Prerequisites

- Python 3.12 or later
- Node.js 22 or later, with npm
- GNU Make
- [Claude Code](https://claude.com/claude-code), logged in, with `claude` on
  your `PATH`
- `ffmpeg` (`brew install ffmpeg`), for videos without Japanese subtitles
  and for downloading a video
- For videos without Japanese subtitles: a Mac with Apple Silicon

### Installation

```bash
git clone https://github.com/tigercosmos/japanese-podcast-learner.git
cd japanese-podcast-learner
make install
```

`make install` runs `pip install -e "backend[dev]"` for the backend and
`npm install` in `frontend/`. Use `make pyinstall` or `make npminstall` to
install only one half. The Makefile uses the Python in `.venv/` when that
directory exists (`python3 -m venv .venv`). Otherwise it uses `python3`, so
activate the environment you want first.

To transcribe videos that have no Japanese subtitles, also install the local
Whisper model runner:

```bash
make pyinstall PYEXTRAS=dev,whisper
```

The first transcription downloads the model (about 1.6 GB).

### Development

Start both servers with one command (Ctrl-C stops both):

```bash
make run
```

Or run the backend and the frontend in two terminals:

```bash
make serve   # Backend at http://127.0.0.1:8000 (auto-reload)
make dev     # Frontend at http://127.0.0.1:5173/
```

Both servers listen on `0.0.0.0`, so a phone on the same network can open
`http://<address of the computer>:5173/`. The pages fit a phone screen. There
is no login: anyone on the network can use the app. To listen on this
computer only:

```bash
make run HOST=127.0.0.1
```

The frontend dev server answers only to an IP address, to `localhost`, and to
the hostnames in `server.allowedHosts` in `frontend/vite.config.ts`. Add the
hostname of the computer there to open the app by name.

The frontend dev server forwards requests under `/api` to the backend. To use
a backend at a different address, set `BACKEND_URL`:

```bash
BACKEND_URL=http://127.0.0.1:9000 make dev
```

Open the frontend, paste a YouTube link, and wait for the analysis. A video
with subtitles takes a few minutes. Results are stored under `data/`, so each
video is analyzed only once.

### Configuration

The backend reads these environment variables:

| Variable | Default | Meaning |
| --- | --- | --- |
| `PODCAST_LEARNER_DATA` | `data/` | Where videos are stored |
| `PODCAST_LEARNER_CLAUDE_BIN` | `claude` | Claude Code executable |
| `PODCAST_LEARNER_CLAUDE_MODEL` | `opus` | Model for `claude -p` |
| `PODCAST_LEARNER_CLAUDE_EFFORT` | `medium` | Reasoning effort for `claude -p` |
| `PODCAST_LEARNER_CLAUDE_WORKERS` | `4` | Parallel `claude -p` calls |
| `PODCAST_LEARNER_CLAUDE_TIMEOUT` | `900` | Seconds for one call |
| `PODCAST_LEARNER_CLAUDE_KEEP_API_KEY` | unset | Set to `1` to pass `ANTHROPIC_API_KEY` to Claude Code |
| `PODCAST_LEARNER_WHISPER_MODEL` | `mlx-community/whisper-large-v3-turbo` | MLX Whisper model |

By default the backend removes `ANTHROPIC_API_KEY` from the environment of
`claude -p`, so Claude Code uses its own login (your subscription) and not
API billing.

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
  podcast_learner/      Backend package (API, pipeline, analysis)
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
