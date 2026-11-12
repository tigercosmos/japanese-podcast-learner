/** Do not resume this close to the end: start the video over instead. */
const END_MARGIN = 5

const key = (videoId: string) => `position:${videoId}`

/**
 * Where to resume a video, in seconds. It is 0 when nothing is stored or
 * when the stored position is at the end of the video.
 */
export function loadPosition(videoId: string, duration: number): number {
  let stored: number
  try {
    stored = Number(localStorage.getItem(key(videoId)))
  } catch {
    return 0
  }
  if (!(stored > 0) || (duration > 0 && stored > duration - END_MARGIN)) {
    return 0
  }
  return stored
}

export function savePosition(videoId: string, seconds: number) {
  try {
    localStorage.setItem(key(videoId), String(Math.floor(seconds)))
  } catch {
    // Private browsing can refuse storage. Playback still works.
  }
}
