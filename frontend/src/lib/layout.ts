export const MIN_VIDEO_WIDTH = 320
/** Room that the resize handle and the gap before it take in the row. */
const HANDLE_SPACE = 24
const STORAGE_KEY = 'video-width'

/** Keep a dragged video width usable and inside its container. */
export function clampVideoWidth(width: number, containerWidth: number) {
  const max = Math.max(MIN_VIDEO_WIDTH, containerWidth - HANDLE_SPACE)
  return Math.round(Math.min(Math.max(width, MIN_VIDEO_WIDTH), max))
}

/** The width that the user chose earlier, or null for the default. */
export function loadVideoWidth(): number | null {
  try {
    const stored = Number(localStorage.getItem(STORAGE_KEY))
    return stored >= MIN_VIDEO_WIDTH ? stored : null
  } catch {
    return null
  }
}

export function saveVideoWidth(width: number | null) {
  try {
    if (width === null) {
      localStorage.removeItem(STORAGE_KEY)
    } else {
      localStorage.setItem(STORAGE_KEY, String(width))
    }
  } catch {
    // Private browsing can refuse storage. Resizing still works.
  }
}
