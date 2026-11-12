import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useParams } from 'react-router-dom'
import { getVideo, submitVideo } from '../lib/api'
import { isActive, stageLabel } from '../lib/stages'
import type { ReadyVideo, Video } from '../types/video'

const POLL_MS = 2000

function isReady(video: Video): video is ReadyVideo {
  return (
    video.status === 'ready' &&
    !!video.segments &&
    !!video.vocabulary &&
    !!video.grammar
  )
}

function Progress({ video }: { video: Video }) {
  const known = video.stage === 'analyze'
  return (
    <div className="mx-auto mt-16 max-w-md text-center">
      <p className="text-lg font-semibold">正在準備這部影片</p>
      <p className="mt-2 text-muted">{stageLabel(video)}</p>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-line">
        <div
          className={`h-full rounded-full bg-accent transition-all duration-500 ${
            known ? '' : 'w-1/3 animate-pulse'
          }`}
          style={known ? { width: `${video.progress * 100}%` } : undefined}
        />
      </div>
      <p className="mt-4 text-sm text-muted">
        沒有日文字幕的影片需要先在本機做語音辨識，會花比較久的時間。
        可以先離開這個頁面，處理會在背景繼續。
      </p>
    </div>
  )
}

const TAB_CLASS = ({ isActive: active }: { isActive: boolean }) =>
  `rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
    active ? 'bg-ink text-paper' : 'text-muted hover:text-ink'
  }`

export default function VideoLayout() {
  const { id = '' } = useParams()
  const [video, setVideo] = useState<Video | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    let timer: number | undefined

    async function load() {
      try {
        const loaded = await getVideo(id)
        if (cancelled) {
          return
        }
        setVideo(loaded)
        setError('')
        if (isActive(loaded)) {
          timer = window.setTimeout(load, POLL_MS)
        }
      } catch (reason) {
        if (!cancelled) {
          setError((reason as Error).message)
        }
      }
    }

    void load()
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [id, attempt])

  async function retry() {
    if (!video) {
      return
    }
    try {
      await submitVideo(video.url)
      setAttempt((count) => count + 1)
    } catch (reason) {
      setError((reason as Error).message)
    }
  }

  return (
    <div className="mx-auto max-w-[160rem] px-4 py-4">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line pb-3">
        <Link to="/" className="shrink-0 text-sm text-muted hover:text-accent">
          ← 我的影片
        </Link>
        <h1 lang="ja" className="min-w-0 flex-1 truncate font-semibold">
          {video?.title}
        </h1>
        {video && isReady(video) && (
          <nav className="flex gap-1 rounded-full border border-line bg-card p-1">
            <NavLink to="study" className={TAB_CLASS}>
              先學習
            </NavLink>
            <NavLink to="watch" className={TAB_CLASS}>
              邊看邊學
            </NavLink>
          </nav>
        )}
      </header>

      {error && (
        <p role="alert" className="mt-8 text-center text-accent">
          {error}
        </p>
      )}
      {!video && !error && (
        <p className="mt-16 text-center text-muted">載入中…</p>
      )}
      {video && isActive(video) && <Progress video={video} />}
      {video?.status === 'failed' && (
        <div className="mx-auto mt-16 max-w-md text-center">
          <p className="text-lg font-semibold">處理失敗</p>
          <p className="mt-2 text-sm break-words text-muted">{video.error}</p>
          <button
            type="button"
            className="mt-4 rounded-full bg-accent px-5 py-2 font-semibold text-white"
            onClick={retry}
          >
            重試
          </button>
        </div>
      )}
      {video && isReady(video) && <Outlet context={video} />}
    </div>
  )
}
