---
name: python-style-review
description: Apply the project's judgment-call Python style rules (naming, imports, comments, test intent) to changed lines in backend/. Use after editing Python sources.
tools: Read, Grep, Glob, Edit, Bash
---

# Python Style Review

Authoritative reference is `STYLE.md` at the repo root; `CLAUDE.md` is a
summary. If they disagree, follow `STYLE.md` and flag the drift in the
verdict.

## Scope

Review the lines that appear in `git diff` against the merge base (or
`HEAD` if explicitly requested), plus every line of new untracked Python
files. Do NOT flag pre-existing violations on unchanged lines.

When there is no commit yet (`git rev-parse HEAD` fails), or no `main`
branch to take a merge base from, every Python file is new: review them
all in full.

Deterministic checks (trailing whitespace, modeline, 79-char limit,
flake8) are handled by `.claude/hooks/check-source.sh` (PostToolUse) and
`make flake8`. Do not duplicate them.

## Judgment-call rules

**Naming**
- Classes: `CamelCase`.
- Functions and variables: `snake_case`.
- Constants: `UPPER_CASE`.

**Imports**
- Import modules, not module content, per "Python import" in STYLE.md.
  Third-party frameworks whose idiom is to import names (for example
  `from fastapi import APIRouter`) are an accepted exception.
- Never `import *`.

**Project conventions**
- Backend code lives in `backend/podcast_learner/`; tests live in
  `backend/tests/` and are named `test_*.py`.
- HTTP routes are mounted under `/api` so the Vite dev proxy reaches them.
- Japanese text in string literals and test data is fine; identifiers
  and comments stay in English.

**Line economy**
- Prefer fewer lines per STYLE.md. Flag unnecessary blank lines inside
  short blocks and needlessly spread-out code. Do not flag structural
  blank lines (between functions, logical sections).
- Never put two consecutive executable statements (separated by `;`) on
  one line.

**Comments**
- Check all comments in the diff for clarity, accuracy, and relevance.
  Flag any comment that is unclear, misleading, trivial, or outdated.
- Refer to "Comments" in STYLE.md for what counts as a useful comment.

**Intent**
- Tests should encode why behavior matters, not just what. If a new test
  would still pass under an obvious bug in the code it exercises,
  question it.

## Workflow

1. Collect the changed files: `git diff --name-only <merge-base> --
   '*.py'` for tracked files, and
   `git ls-files --others --exclude-standard -- '*.py'` for new files.
2. Read the diff hunks of tracked files and the whole of each new file.
3. Apply rules to changed lines.
4. Output each finding as
   `path:line -- rule -- (fix applied | suggestion): <description>`.
5. End with a single verdict line:
   `verdict: clean | issues found | blocking`. Use `clean` only when no
   findings remain after any hand-fixes.

## Output

- Bullets only.
- Don't paste long code excerpts; point to `file:line`.
- Be explicit when uncertain.
- Try to hand-fix formatting nits. `make flake8` verifies but does not fix.
