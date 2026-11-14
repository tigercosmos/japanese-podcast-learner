/** The part of the YouTube IFrame Player API that this app uses. */
export interface YouTubePlayer {
  getCurrentTime(): number
  getPlayerState(): number
  seekTo(seconds: number, allowSeekAhead: boolean): void
  playVideo(): void
  pauseVideo(): void
  destroy(): void
  /** Undocumented, but the only way to turn the player's captions off. */
  unloadModule?(name: string): void
}

interface PlayerOptions {
  videoId: string
  width?: string
  height?: string
  playerVars?: Record<string, string | number>
  events?: {
    onReady?: () => void
    onStateChange?: (event: { data: number }) => void
    onError?: (event: { data: number }) => void
  }
}

interface YouTubeApi {
  Player: new (element: HTMLElement, options: PlayerOptions) => YouTubePlayer
}

declare global {
  interface Window {
    YT?: YouTubeApi
    onYouTubeIframeAPIReady?: () => void
  }
}

export const PLAYER_STATE_PLAYING = 1

/** Describe an `onError` code of the player, in Chinese. */
export function playerErrorMessage(code: number): string {
  if (code === 101 || code === 150) {
    return '這部影片不允許在 YouTube 以外的網站播放。'
  }
  if (code === 100) {
    return '這部影片已經被移除或設為私人影片。'
  }
  return `YouTube 無法播放這部影片（錯誤 ${code}）。`
}

let apiPromise: Promise<YouTubeApi> | null = null

/** Load the IFrame Player API script once and resolve with `window.YT`. */
export function loadYouTubeApi(): Promise<YouTubeApi> {
  if (apiPromise) {
    return apiPromise
  }
  apiPromise = new Promise((resolve, reject) => {
    if (window.YT?.Player) {
      resolve(window.YT)
      return
    }
    const previous = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      previous?.()
      resolve(window.YT!)
    }
    const script = document.createElement('script')
    script.src = 'https://www.youtube.com/iframe_api'
    script.onerror = () => {
      apiPromise = null
      reject(new Error('無法載入 YouTube 播放器。'))
    }
    document.head.appendChild(script)
  })
  return apiPromise
}
