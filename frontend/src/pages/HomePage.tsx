import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  deleteVideo,
  isNotEmbeddable,
  listVideos,
  submitVideo,
} from '../lib/api'
import { isActive, stageLabel } from '../lib/stages'
import { formatTime } from '../lib/subtitles'
import type { VideoMeta } from '../types/video'

const REFRESH_MS = 3000

function VideoCard({
  video,
  onDelete,
  onRetry,
}: {
  video: VideoMeta
  onDelete: (video: VideoMeta) => void
  onRetry: (video: VideoMeta) => void
}) {
  const title = video.title || video.url
  return (
    <li className="flex gap-3 rounded-xl border border-line bg-card p-3">
      <Link
        to={`/v/${video.id}`}
        className="relative block aspect-video w-32 shrink-0 self-start overflow-hidden rounded-lg bg-line sm:w-48"
      >
        {video.thumbnail && (
          <img
            src={video.thumbnail}
            alt=""
            className="h-full w-full object-cover"
          />
        )}
        {video.duration > 0 && (
          <span className="absolute right-1 bottom-1 rounded bg-black/75 px-1 font-mono text-xs text-white">
            {formatTime(video.duration)}
          </span>
        )}
      </Link>

      <div className="flex min-w-0 flex-1 flex-col">
        <Link
          to={`/v/${video.id}`}
          lang="ja"
          className="line-clamp-2 font-semibold hover:text-accent"
        >
          {title}
        </Link>
        <p lang="ja" className="truncate text-sm text-muted">
          {video.channel}
        </p>

        <div className="mt-auto flex flex-wrap items-center gap-2 pt-2 text-sm">
          {video.status === 'ready' && (
            <>
              <Link
                to={`/v/${video.id}/study`}
                className="rounded-full bg-ink px-3 py-1 text-paper hover:bg-accent"
              >
                先學習
              </Link>
              <Link
                to={`/v/${video.id}/watch`}
                className="rounded-full border border-ink px-3 py-1 hover:border-accent hover:text-accent"
              >
                邊看邊學
              </Link>
              {video.counts && (
                <span className="text-xs text-muted">
                  單字 {video.counts.vocabulary}・文法 {video.counts.grammar}
                </span>
              )}
            </>
          )}
          {isActive(video) && (
            <span className="flex items-center gap-2 text-muted">
              <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
              {stageLabel(video)}
            </span>
          )}
          {video.status === 'failed' && (
            <>
              <span className="text-accent" title={video.error}>
                處理失敗
              </span>
              <button
                type="button"
                className="rounded-full border border-ink px-3 py-1 hover:border-accent hover:text-accent"
                onClick={() => onRetry(video)}
              >
                重試
              </button>
            </>
          )}
          {!isActive(video) && (
            <button
              type="button"
              className="ml-auto text-xs text-muted hover:text-accent"
              onClick={() => onDelete(video)}
            >
              刪除
            </button>
          )}
        </div>
      </div>
    </li>
  )
}

export default function HomePage() {
  const navigate = useNavigate()
  const [videos, setVideos] = useState<VideoMeta[] | null>(null)
  const [url, setUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  // The submitted video cannot be embedded, so a download is offered.
  const [blocked, setBlocked] = useState(false)

  const refresh = useCallback(
    () =>
      listVideos()
        .then(setVideos)
        .catch((reason: Error) => setError(reason.message)),
    [],
  )

  useEffect(() => {
    void refresh()
    const timer = window.setInterval(refresh, REFRESH_MS)
    return () => window.clearInterval(timer)
  }, [refresh])

  async function submit(download: boolean) {
    if (!url.trim()) {
      return
    }
    setSubmitting(true)
    setError('')
    setBlocked(false)
    try {
      const video = await submitVideo(url, download)
      navigate(`/v/${video.id}`)
    } catch (reason) {
      setError((reason as Error).message)
      setBlocked(isNotEmbeddable(reason))
      setSubmitting(false)
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    void submit(false)
  }

  async function handleDelete(video: VideoMeta) {
    if (!window.confirm(`確定要刪除「${video.title || video.url}」嗎？`)) {
      return
    }
    try {
      await deleteVideo(video.id)
      setError('')
    } catch (reason) {
      setError((reason as Error).message)
    }
    void refresh()
  }

  async function handleRetry(video: VideoMeta) {
    try {
      await submitVideo(video.url)
      setError('')
    } catch (reason) {
      setError((reason as Error).message)
    }
    void refresh()
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
      <header>
        <p className="text-sm tracking-[0.3em] text-accent">にほんご</p>
        <h1 className="mt-1 text-3xl font-bold">日語 Podcast 學習</h1>
        <p className="mt-2 text-muted">
          貼上日語 YouTube
          影片的連結，自動產生繁體中文字幕，並整理出單字和文法。
        </p>
      </header>

      <form onSubmit={handleSubmit} className="mt-6 flex gap-2">
        <input
          type="text"
          inputMode="url"
          value={url}
          onChange={(event) => {
            setUrl(event.target.value)
            setBlocked(false)
          }}
          placeholder="https://www.youtube.com/watch?v=..."
          aria-label="YouTube 影片連結"
          className="min-w-0 flex-1 rounded-xl border border-line bg-card px-4 py-3 outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={submitting || !url.trim()}
          className="shrink-0 rounded-xl bg-accent px-4 py-3 font-semibold sm:px-5 text-white transition-opacity disabled:opacity-40"
        >
          {submitting ? '送出中…' : '開始分析'}
        </button>
      </form>
      {error && (
        <p role="alert" className="mt-2 text-sm text-accent">
          {error}
        </p>
      )}
      {blocked && (
        <button
          type="button"
          disabled={submitting}
          className="mt-2 rounded-xl border border-accent px-4 py-2 text-sm font-semibold text-accent disabled:opacity-40"
          onClick={() => void submit(true)}
        >
          下載影片到本機
        </button>
      )}

      <section className="mt-10">
        <h2 className="text-sm font-semibold tracking-wider text-muted">
          我的影片
        </h2>
        {videos === null && !error && (
          <p className="mt-4 text-muted">載入中…</p>
        )}
        {videos?.length === 0 && (
          <p className="mt-4 rounded-xl border border-dashed border-line p-8 text-center text-muted">
            還沒有影片。貼上第一個連結開始學習吧！
          </p>
        )}
        <ul className="mt-3 space-y-3">
          {videos?.map((video) => (
            <VideoCard
              key={video.id}
              video={video}
              onDelete={handleDelete}
              onRetry={handleRetry}
            />
          ))}
        </ul>
      </section>
    </main>
  )
}
