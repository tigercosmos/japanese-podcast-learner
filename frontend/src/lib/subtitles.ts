interface Timed {
  start: number
  end: number
}

/**
 * Index of the last segment that starts at or before `time`, or -1.
 * `segments` must be sorted by start time.
 */
export function segmentIndexAt(segments: Timed[], time: number): number {
  let low = 0
  let high = segments.length - 1
  let found = -1
  while (low <= high) {
    const middle = (low + high) >> 1
    if (segments[middle].start <= time) {
      found = middle
      low = middle + 1
    } else {
      high = middle - 1
    }
  }
  return found
}

/** Index of the segment being spoken at `time`, or -1 during a gap. */
export function activeSegmentIndex(segments: Timed[], time: number): number {
  const index = segmentIndexAt(segments, time)
  if (index >= 0 && time < segments[index].end) {
    return index
  }
  return -1
}

/** Format seconds as m:ss, or h:mm:ss from one hour up. */
export function formatTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const rest = String(total % 60).padStart(2, '0')
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${rest}`
  }
  return `${minutes}:${rest}`
}

/**
 * Split a sentence around the first occurrence of `part`, so the caller
 * can highlight it. `match` is '' when `part` is empty or absent.
 */
export function splitAround(
  sentence: string,
  part: string,
): { before: string; match: string; after: string } {
  const at = part ? sentence.indexOf(part) : -1
  if (at < 0) {
    return { before: sentence, match: '', after: '' }
  }
  return {
    before: sentence.slice(0, at),
    match: part,
    after: sentence.slice(at + part.length),
  }
}
