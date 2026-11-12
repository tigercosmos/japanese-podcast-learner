# System Design

This document records the architecture and the decisions that are still
open. Update it as features land.

## Goal

Help a Traditional Chinese speaker learn Japanese from Japanese podcasts on
YouTube: watch an episode with Chinese subtitles, look up words and grammar
in context, and study the vocabulary and grammar of the episode.

## Architecture

```
Browser (React SPA)  --/api-->  Python backend (FastAPI)  -->  data/ (JSON)
     frontend/                      backend/podcast_learner/
                                       |-- yt-dlp        (subtitles, audio)
                                       |-- mlx-whisper   (speech-to-text)
                                       |-- SudachiPy     (tokens, furigana)
                                       `-- claude -p     (translate, explain)
```

- All backend routes live under `/api`. In development Vite proxies `/api`
  to `http://127.0.0.1:8000`.
- The frontend embeds the YouTube player and draws its own subtitles over
  it. The video itself is never downloaded.

## Processing Pipeline

`POST /api/videos` queues a video. One worker thread processes the queue
(`pipeline.py`) and records the stage and the progress in `meta.json`. The
frontend polls `GET /api/videos/{id}`.

1. **Metadata.** yt-dlp reads the title, channel, duration, and the list of
   subtitle tracks.
2. **Transcript.**
   - The video has uploaded Japanese subtitles: download that track.
   - Otherwise: download the audio and transcribe it locally with
     mlx-whisper (`whisper-large-v3-turbo` by default). The audio file is
     deleted afterwards.
   - YouTube auto-generated captions are not used. They have no punctuation
     and no sentence boundaries, so Whisper gives better lines to study.
   - The cleaned transcript is saved, so a retry never transcribes twice.
3. **Tokens.** SudachiPy splits every line. Each token gets furigana when it
   has kanji. Content words (nouns, verbs, adjectives, adverbs, and so on)
   get a link to a vocabulary entry: the dictionary form is the entry id.
4. **Analysis.** The transcript is cut into chunks of about 1200 characters.
   Each chunk is one `claude -p` call with a JSON Schema
   (`--json-schema`), and several calls run in parallel. A call returns:
   - the Traditional Chinese translation of every line,
   - an entry for every word that first appears in the chunk,
   - the grammar patterns in the chunk, with the lines that use them.

   The word list comes from the tokenizer, not from Claude. This makes the
   vocabulary complete and makes every entry link back to the subtitles.
   Grammar patterns from different chunks are merged by pattern text.
   Finished chunks are cached on disk, so a retry resumes.
5. **Store.** `content.json` holds the segments, vocabulary, and grammar.

`claude -p` runs with no tools, no MCP servers, and no user or project
settings. `ANTHROPIC_API_KEY` is removed from its environment by default so
that it uses the Claude Code login.

## Data Model

```
data/videos/<video id>/
  meta.json       id, url, title, status, stage, progress, error, counts
  content.json    segments, vocabulary, grammar
  work/           transcript.json, chunks/ (cached Claude results)
```

- Segment: `id`, `start`, `end`, `ja`, `zh`, `tokens`, `grammar` (ids).
- Token: `s` (surface), `f` (furigana pairs, optional), `v` (vocabulary id,
  optional).
- Vocabulary entry: `word`, `reading`, `pos`, `level` (JLPT), `meaning`,
  `usage`, `example`, `count`, `segments`.
- Grammar entry: `pattern`, `level`, `meaning`, `explanation`, `usage`,
  `examples`, `occurrences` (segment and the matching text).

## Frontend

- `/` lists the videos and accepts a new link.
- `/v/:id/study` (先學習): vocabulary and grammar lists with level filter,
  search, and sort, and the full transcript. A sentence links to its moment
  in watch mode.
- `/v/:id/watch` (邊看邊學): the player with the subtitle overlay. A click on
  a word or a grammar tag pauses the video and shows the entry. The side
  panel shows the current sentence and the transcript.
- Logic that does not need rendering lives in `src/lib/` with Vitest tests.

## Open Decisions

- Podcast sources other than YouTube: RSS feeds or uploaded audio files.
- Existing Traditional Chinese subtitles are ignored. The translation always
  comes from Claude so that it lines up with the Japanese segments.
- Review: marking words as known, spaced repetition, and export to the
  `japanese-learner` flashcard datasets.
- Storage: JSON files are enough for one user. Move to SQLite if the app
  needs queries across videos.
- Deployment: how the backend and the built frontend are hosted together.

<!-- vim: set ft=markdown ff=unix fenc=utf8 et sw=2 ts=2 sts=2 tw=79: -->
