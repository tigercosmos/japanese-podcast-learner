import { useCallback, useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { loadYouTubeApi, PLAYER_STATE_PLAYING } from '../lib/youtube'
import type { YouTubePlayer } from '../lib/youtube'

const POLL_MS = 100

/**
 * Embed a YouTube player in the element that `containerRef` points to.
 * `onTime` is called with the playback position about ten times a second,
 * from the moment the video first plays.
 */
export function useYouTubePlayer(
  containerRef: RefObject<HTMLDivElement | null>,
  videoId: string,
  startAt: number,
  autoplay: boolean,
  onTime: (seconds: number) => void,
) {
  const playerRef = useRef<YouTubePlayer | null>(null)
  const onTimeRef = useRef(onTime)
  const [playing, setPlaying] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    onTimeRef.current = onTime
  })

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }
    let cancelled = false
    let timer: number | undefined
    // Before the first play the player reports 0, not `startAt`. Passing
    // that on would move the app back to the start of the video.
    let started = false
    let player: YouTubePlayer | null = null
    // The API replaces its target element with an iframe. React must not
    // own that element, so it is created by hand.
    const target = document.createElement('div')
    container.appendChild(target)

    loadYouTubeApi()
      .then((api) => {
        if (cancelled) {
          return
        }
        const created = new api.Player(target, {
          videoId,
          width: '100%',
          height: '100%',
          playerVars: {
            start: Math.floor(startAt),
            autoplay: autoplay ? 1 : 0,
            playsinline: 1,
            rel: 0,
            hl: 'zh-TW',
          },
          events: {
            onReady: () => {
              if (cancelled) {
                return
              }
              playerRef.current = created
              timer = window.setInterval(() => {
                if (started) {
                  onTimeRef.current(created.getCurrentTime())
                }
              }, POLL_MS)
            },
            onStateChange: (event) => {
              started ||= event.data === PLAYER_STATE_PLAYING
              setPlaying(event.data === PLAYER_STATE_PLAYING)
              // The viewer's YouTube settings can turn captions on. They
              // would sit under the subtitles that this app draws. The
              // captions module loads late, so it is removed on each
              // state change and not only once.
              created.unloadModule?.('captions')
            },
          },
        })
        player = created
      })
      .catch((reason: Error) => {
        if (!cancelled) {
          setError(reason.message)
        }
      })

    return () => {
      cancelled = true
      window.clearInterval(timer)
      playerRef.current = null
      player?.destroy()
      container.replaceChildren()
    }
  }, [containerRef, videoId, startAt, autoplay])

  const seek = useCallback((seconds: number) => {
    const player = playerRef.current
    if (!player) {
      return
    }
    player.seekTo(seconds, true)
    player.playVideo()
    // Report at once, so the app follows a seek made before the first play.
    onTimeRef.current(seconds)
  }, [])

  const pause = useCallback(() => playerRef.current?.pauseVideo(), [])

  const toggle = useCallback(() => {
    const player = playerRef.current
    if (!player) {
      return
    }
    if (player.getPlayerState() === PLAYER_STATE_PLAYING) {
      player.pauseVideo()
    } else {
      player.playVideo()
    }
  }, [])

  return { playing, error, seek, pause, toggle }
}
