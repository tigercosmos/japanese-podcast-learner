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
  it. The video is downloaded only when the viewer asks for it, for a video
  that YouTube does not play on other sites. The page then plays the local
  file in a `<video>` element, with the same subtitles and controls.

## Processing Pipeline

`POST /api/videos` checks the video and queues it. One worker thread
processes the queue (`pipeline.py`) and records the stage and the progress
in `meta.json`. The frontend polls `GET /api/videos/{id}`.

1. **Metadata and embed check.** This step runs inside the request, so a
   problem shows in the form at once. yt-dlp reads the title, channel,
   duration, and the list of subtitle tracks. The backend also reads the
   embed page of the video (`/embed/<id>` with a `Referer`) and its
   `previewPlayabilityStatus`. The `playable_in_embed` field of yt-dlp is
   not enough: it stays true for a video that the owner blocks on other
   sites (player error 150). A blocked video is refused with the code
   `not_embeddable`, and the form offers to download it
   (`{"download": true}`).
   - **Video download** (only on request). yt-dlp saves `video.mp4`, at
     most 720p, H.264 and AAC when the video has them. It needs ffmpeg.
     When the video also needs Whisper, the file is the audio source, so
     nothing is downloaded twice.
   - `POST /api/videos/{id}/download` does the same for a video that is
     already analyzed. It runs on its own thread and reports through
     `video_download`, `video_progress`, and `video_error` in `meta.json`.
     The watch page offers it when the YouTube player reports an error.
   - `GET /api/videos/{id}/file` serves the file with HTTP Range support.
2. **Transcript.**
   - The video has uploaded Japanese subtitles: download that track.
   - Otherwise: download the audio and transcribe it locally with
     mlx-whisper (`whisper-large-v3-turbo` by default). The audio file is
     deleted afterwards.
   - YouTube auto-generated captions are not used. They have no punctuation
     and no sentence boundaries, so Whisper gives better lines to study.
   - The cleaned transcript is saved, so a retry never transcribes twice.
3. **Proofreading** (Whisper transcripts only, `proofread.py`). Whisper
   picks wrong homophones and misspells names. Claude reads the transcript
   in chunks and returns only the lines that have a clear recognition
   error. Spoken style is kept. A correction that halves or doubles the
   length of a line is a rewrite, so it is ignored. The timing and the
   number of lines never change. Uploaded subtitles are not proofread.
4. **Tokens.** SudachiPy splits every line. Each token gets furigana when it
   has kanji. Content words (nouns, verbs, adjectives, adverbs, and so on)
   get a link to a vocabulary entry: the dictionary form is the entry id.
5. **Analysis.** The transcript is cut into chunks of about 1200 characters.
   Each chunk is one `claude -p` call with a JSON Schema
   (`--json-schema`), and several calls run in parallel. A call returns:
   - the Traditional Chinese translation of every line,
   - an entry for every word that first appears in the chunk,
   - the grammar patterns in the chunk, with the lines that use them.

   The word list comes from the tokenizer, not from Claude. This makes the
   vocabulary complete and makes every entry link back to the subtitles.
   Grammar patterns from different chunks are merged by pattern text.
   Finished chunks are cached on disk, so a retry resumes.
6. **Store.** `content.json` holds the segments, vocabulary, and grammar.

`claude -p` runs with no tools, no MCP servers, and no user or project
settings. `ANTHROPIC_API_KEY` is removed from its environment by default so
that it uses the Claude Code login.

## Data Model

```
data/videos/<video id>/
  meta.json       id, url, title, status, stage, progress, error, counts,
                  local_video, video_download
  content.json    segments, vocabulary, grammar
  video.mp4       the downloaded video, only when the viewer asked for it
  work/           transcript.json, proofread/ and chunks/ (cached Claude results)
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
