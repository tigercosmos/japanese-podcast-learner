"""Run one Claude request per chunk, in parallel, with a disk cache."""

import concurrent.futures
import hashlib
import json
import logging
import pathlib

from podcast_learner import store

ATTEMPTS = 3

_LOG = logging.getLogger(__name__)


def run(chunks, runner, cache_dir, system, schema, check=None,
        on_progress=None, workers=4):
    """Return the answer of every chunk, in the order of ``chunks``.

    :param chunks: JSON-serializable request payloads.
    :param runner: ``runner(prompt, system, schema)`` returning a dict
        that matches ``schema``.
    :param cache_dir: Directory for finished answers. A retry after a
        failure reuses them.
    :param check: ``check(chunk, result)`` raising when the answer cannot
        be used. The chunk is then asked again.
    :param on_progress: Called with ``(done, total)`` after each chunk.
    """
    cache_dir = pathlib.Path(cache_dir)
    results = [None] * len(chunks)
    done = 0
    executor = concurrent.futures.ThreadPoolExecutor(max_workers=workers)
    try:
        futures = {
            executor.submit(
                _run_one, chunk, runner, cache_dir, system, schema,
                check): index
            for index, chunk in enumerate(chunks)
        }
        for future in concurrent.futures.as_completed(futures):
            results[futures[future]] = future.result()
            done += 1
            if on_progress is not None:
                on_progress(done, len(chunks))
    finally:
        executor.shutdown(wait=False, cancel_futures=True)
    return results


def _run_one(chunk, runner, cache_dir, system, schema, check):
    prompt = json.dumps(chunk, ensure_ascii=False)
    digest = hashlib.sha1((system + prompt).encode("utf-8")).hexdigest()
    cache_path = cache_dir / f"chunk-{digest}.json"
    cached = store.read_json(cache_path)
    if cached is not None and _passes(check, chunk, cached):
        return cached

    last_error = None
    for attempt in range(ATTEMPTS):
        try:
            result = runner(prompt, system, schema)
            if check is not None:
                check(chunk, result)
        except Exception as exc:
            _LOG.warning("chunk attempt %d failed: %s", attempt + 1, exc)
            last_error = exc
            continue
        store.write_json(cache_path, result)
        return result
    raise last_error


def _passes(check, chunk, result):
    if check is None:
        return True
    try:
        check(chunk, result)
    except Exception:
        return False
    return True

# vim: set ff=unix fenc=utf8 et sw=4 ts=4 sts=4 tw=79:
