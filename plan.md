# System Design

Status: scaffold only. This document records the intended architecture and
the decisions that are still open. Update it as features land.

## Goal

Help a Traditional Chinese speaker learn Japanese by listening to Japanese
podcasts: follow an episode with its transcript, look up words and grammar in
context, and review what was learned.

## Architecture

```
Browser (React SPA)  --/api-->  Python backend (FastAPI)  -->  storage
     frontend/                      backend/podcast_learner/
```

- The frontend handles playback, the transcript view, and study UI.
- The backend handles work that a browser cannot do well or safely: fetching
  feeds and audio across origins, speech-to-text, Japanese morphological
  analysis, and persistent storage.
- All backend routes live under `/api`. In development Vite proxies `/api`
  to `http://127.0.0.1:8000`.

## Open Decisions

- Podcast source: RSS feeds, uploaded audio files, or both.
- Transcription: local model (for example Whisper variants) or a hosted API.
- Japanese analysis: tokenizer and dictionary (for example MeCab/fugashi with
  UniDic, or Sudachi) for readings, furigana, and word lookup.
- Storage: SQLite file under `data/` (ignored by git) or another store.
- Deployment: how the backend and the built frontend are hosted together.
- Relationship to `japanese-learner`: whether vocabulary found in episodes
  can be exported to its flashcard datasets.

<!-- vim: set ft=markdown ff=unix fenc=utf8 et sw=2 ts=2 sts=2 tw=79: -->
