import { useCallback, useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'

const POLL_MS = 100

/**
 * Play a video file in the element that `containerRef` points to. A null
 * `src` plays nothing. The result has the shape of `useYouTubePlayer`, so
 * the page drives both players the same way.
 */
export function useLocalPlayer(
  containerRef: RefObject<HTMLDivElement | null>,
  src: string | null,
  startAt: number,
  autoplay: boolean,
  onTime: (seconds: number) => void,
) {
  const elementRef = useRef<HTMLVideoElement | null>(null)
  const onTimeRef = useRef(onTime)
  const [playing, setPlaying] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    onTimeRef.current = onTime
  })

  useEffect(() => {
    const container = containerRef.current
    if (!container || !src) {
      return
    }
    const element = document.createElement('video')
    element.className = 'h-full w-full bg-black'
    element.controls = true
    element.playsInline = true
    element.preload = 'metadata'
    // The page has its own fullscreen, which keeps the subtitles.
    element.setAttribute('controlslist', 'nofullscreen')
    element.src = src
    container.appendChild(element)

    const report = () => onTimeRef.current(element.currentTime)
    element.addEventListener('loadedmetadata', () => {
      if (startAt > 0) {
        element.currentTime = startAt
      }
      elementRef.current = element
      if (autoplay) {
        void element.play().catch(() => undefined)
      }
    })
    element.addEventListener('play', () => setPlaying(true))
    element.addEventListener('pause', () => setPlaying(false))
    // The viewer can drag the native progress bar while paused.
    element.addEventListener('seeked', report)
    element.addEventListener('error', () =>
      setError('無法播放下載到本機的影片檔。'),
    )
    const timer = window.setInterval(() => {
      if (!element.paused) {
        report()
      }
    }, POLL_MS)

    return () => {
      window.clearInterval(timer)
      elementRef.current = null
      element.pause()
      element.removeAttribute('src')
      element.load()
      container.replaceChildren()
    }
  }, [containerRef, src, startAt, autoplay])

  const seek = useCallback((seconds: number) => {
    const element = elementRef.current
    if (!element) {
      return
    }
    element.currentTime = seconds
    void element.play().catch(() => undefined)
    onTimeRef.current(seconds)
  }, [])

  const pause = useCallback(() => elementRef.current?.pause(), [])

  const toggle = useCallback(() => {
    const element = elementRef.current
    if (!element) {
      return
    }
    if (element.paused) {
      void element.play().catch(() => undefined)
    } else {
      element.pause()
    }
  }, [])

  return { playing, error, seek, pause, toggle }
}
