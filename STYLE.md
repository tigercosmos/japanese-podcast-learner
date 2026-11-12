# Coding Style Guide

Consistent code costs less to maintain. The rules of thumb are:

1. The linters must be clean. Before you open or update a pull request, run:

   ```bash
   make lint
   ```

2. Read the nearby code and follow its style.
3. Use this guide.

The backend (`backend/`) uses [flake8](https://flake8.pycqa.org/) and
[PEP-8](https://peps.python.org/pep-0008/). The frontend (`frontend/`) uses
ESLint and the TypeScript compiler in strict mode.

## Line Economy and Breathing Room

Keep a single thought on as few lines as it honestly needs, and separate
distinct thoughts with one blank line.

- Group related short statements together. Do not pad a short block with
  blank lines.
- Let a longer body breathe: put one blank line at each seam between groups
  of statements. Do not use a narrating comment to mark the seam.
- Never put two executable statements on one line (separated by `;`).
  Debuggers and stack traces need line granularity.
- Respect the line-width limits. Never break them to save lines.

## File Format

- UTF-8, Unix LF line endings, no trailing whitespace, 4-space indent in
  Python (2-space in TypeScript, as the existing frontend code does).
- Japanese text is allowed in string literals, test data, and documentation.
  Identifiers and code comments are in English.
- Python lines are at most 79 characters.
- End every Python file with the modeline:

  ```python
  # vim: set ff=unix fenc=utf8 et sw=4 ts=4 sts=4 tw=79:
  ```

## Python Naming

- Classes: `CamelCase`. Treat acronyms as words (`HttpClient`, not
  `HTTPClient`).
- Functions, methods, and variables: `snake_case`.
- Constants: `UPPER_CASE`.

## Python Import

Never import everything (`import *`).

Import modules, not module content. Group the imports in this order, with one
blank line between groups:

```python
# Standard library.
import json
import pathlib

# Third-party.
import httpx

# Current project.
from podcast_learner import transcript
from . import _util
```

Frameworks whose documented idiom is to import names directly (for example
`from fastapi import APIRouter`) are an accepted exception.

## Testing

- Backend tests: pytest, in `backend/tests/`, files named `test_*.py`.
- Frontend unit tests: Vitest, next to the source as `src/**/*.test.ts(x)`.
- Frontend end-to-end tests: Playwright, in `frontend/e2e/`.

A test encodes why a behavior matters, not only what it does. A test that
cannot fail when the logic it covers changes is not pulling its weight.

## Comments

Code says what happens. A comment says why, and what a reader must know but
cannot see. The default is no comment.

- Never restate the code. Do not label obvious structure or narrate a step.
- Prefer a clear name over a comment.
- Write comments as full sentences with a closing period.
- A comment describes the code, never the task or conversation that produced
  it.
- Give a public Python module, class, or function a `"""docstring"""` (PEP
  257) when its use is not obvious. Begin with a one-line imperative summary
  ("Return the episode transcript."). Use the Sphinx field syntax (`:param
  name:`, `:return:`) for arguments and return values.

## Commit Log

- Write the subject in the imperative mood ("Add the transcript endpoint"),
  capitalized, with no period. Aim for 50 characters; 72 is the hard limit.
- Do not use semantic prefixes such as `feat:` or `fix:`.
- Separate the subject from the body with one blank line. Wrap the body at 72
  characters. The body explains why the change happened.
- Backtick-quote code tokens: paths, identifiers, commands, and flags.

<!-- vim: set ft=markdown ff=unix fenc=utf8 et sw=2 ts=2 sts=2 tw=79: -->
