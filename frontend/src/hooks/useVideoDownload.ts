import { useCallback, useEffect, useState } from 'react'
import { downloadVideo, getVideo } from '../lib/api'
import type { VideoMeta } from '../types/video'

const POLL_MS = 1000

type DownloadFields = Pick<
  VideoMeta,
  'local_video' | 'video_download' | 'video_progress' | 'video_error'
>

/**
 * Follow the copy of a video on this computer. `start` asks the backend
 * to download it; the state then follows the backend until it is done.
 */
export function useVideoDownload(video: VideoMeta) {
  const [fields, setFields] = useState<DownloadFields>(video)
  const [error, setError] = useState('')
  const running = fields.video_download === 'running'

  useEffect(() => {
    if (!running) {
      return
    }
    const timer = window.setInterval(() => {
      getVideo(video.id)
        .then(setFields)
        .catch(() => undefined)
    }, POLL_MS)
    return () => window.clearInterval(timer)
  }, [running, video.id])

  const start = useCallback(() => {
    setError('')
    downloadVideo(video.id)
      .then(setFields)
      .catch((reason: Error) => setError(reason.message))
  }, [video.id])

  return {
    local: !!fields.local_video,
    running,
    progress: fields.video_progress ?? 0,
    error:
      error ||
      (fields.video_download === 'failed' ? (fields.video_error ?? '') : ''),
    start,
  }
}
