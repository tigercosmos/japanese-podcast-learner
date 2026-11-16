import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent } from 'react'
import { useOutletContext, useSearchParams } from 'react-router-dom'
import { GrammarDetail, VocabDetail } from '../components/Details'
import JaText from '../components/JaText'
import SubtitleOverlay from '../components/SubtitleOverlay'
import Toggle from '../components/Toggle'
import TranscriptList from '../components/TranscriptList'
import { useLocalPlayer } from '../hooks/useLocalPlayer'
import { useStoredFlag } from '../hooks/useStoredFlag'
import { useVideoDownload } from '../hooks/useVideoDownload'
import { useYouTubePlayer } from '../hooks/useYouTubePlayer'
import { videoFileUrl } from '../lib/api'
import {
  clampVideoWidth,
  loadVideoWidth,
  saveVideoWidth,
} from '../lib/layout'
import { loadPosition, savePosition } from '../lib/position'
import { segmentIndexAt } from '../lib/subtitles'
import type {
  GrammarEntry,
  ReadyVideo,
  Segment,
  Selection,
  VocabEntry,
} from '../types/video'

type PanelTab = 'sentence' | 'transcript'

// An iPhone cannot put anything but a video element in fullscreen.
const CAN_FULLSCREEN = document.fullscreenEnabled

const CONTROL_CLASS =
  'rounded-full border border-line bg-card px-3 py-1 text-sm hover:border-accent hover:text-accent'

function isTyping(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
  )
}

export default function WatchPage() {
  const video = useOutletContext<ReadyVideo>()
  const { segments } = video
  const [params, setParams] = useSearchParams()
  // `?t=` is a one-time request to play from a sentence. Without it the
  // video resumes where the viewer stopped.
  const [requested] = useState(() => Number(params.get('t')) || 0)
  const [startAt] = useState(
    () => requested || loadPosition(video.id, video.duration),
  )
  const hasTimeParam = params.has('t')

  useEffect(() => {
    // Dropping the parameter makes a reload resume at the saved position
    // and not jump back to the requested sentence.
    if (hasTimeParam) {
      setParams({}, { replace: true })
    }
  }, [hasTimeParam, setParams])

  const vocabById = useMemo(
    () => new Map(video.vocabulary.map((entry) => [entry.id, entry])),
    [video.vocabulary],
  )
  const grammarById = useMemo(
    () => new Map(video.grammar.map((entry) => [entry.id, entry])),
    [video.grammar],
  )

  // The sentence that started last. It stays current during the pause
  // after it, so the side panel does not go blank between sentences.
  const [currentIndex, setCurrentIndex] = useState(() =>
    segmentIndexAt(segments, startAt),
  )
  const [speaking, setSpeaking] = useState(false)
  const [selection, setSelection] = useState<Selection | null>(null)
  const [panelTab, setPanelTab] = useState<PanelTab>('sentence')
  const [fullscreen, setFullscreen] = useState(false)
  const [showJa, setShowJa] = useStoredFlag('subtitle-ja', true)
  const [showZh, setShowZh] = useStoredFlag('subtitle-zh', true)
  const [showFurigana, setShowFurigana] = useStoredFlag('furigana', true)
  const [atTop, setAtTop] = useStoredFlag('subtitle-top', false)
  // null keeps the default split: the video takes the room that the side
  // panel leaves.
  const [videoWidth, setVideoWidth] = useState(loadVideoWidth)
  const stageRef = useRef<HTMLDivElement>(null)
  const layoutRef = useRef<HTMLDivElement>(null)

  const handleTime = useCallback(
    (time: number) => {
      const index = segmentIndexAt(segments, time)
      setCurrentIndex(index)
      setSpeaking(index >= 0 && time < segments[index].end)
      savePosition(video.id, time)
    },
    [segments, video.id],
  )
  const playerRef = useRef<HTMLDivElement>(null)
  const download = useVideoDownload(video)
  const youtubePlayer = useYouTubePlayer(
    playerRef,
    download.local ? null : video.id,
    startAt,
    requested > 0,
    handleTime,
  )
  const localPlayer = useLocalPlayer(
    playerRef,
    download.local ? videoFileUrl(video.id) : null,
    startAt,
    requested > 0,
    handleTime,
  )
  const { playing, error, seek, pause, toggle } = download.local
    ? localPlayer
    : youtubePlayer

  const current: Segment | undefined = segments[Math.max(currentIndex, 0)]
  const currentGrammar = useMemo(
    () =>
      (current?.grammar ?? [])
        .map((id) => grammarById.get(id))
        .filter((entry): entry is GrammarEntry => !!entry),
    [current, grammarById],
  )
  const currentWords = useMemo(() => {
    const ids = new Set(current?.tokens.map((token) => token.v))
    return [...ids]
      .map((id) => (id ? vocabById.get(id) : undefined))
      .filter((entry): entry is VocabEntry => !!entry)
  }, [current, vocabById])

  const select = useCallback(
    (next: Selection) => {
      pause()
      setSelection(next)
    },
    [pause],
  )
  const selectWord = useCallback(
    (id: string) => select({ kind: 'vocab', id }),
    [select],
  )
  const seekTo = useCallback(
    (segment: Segment) => seek(segment.start),
    [seek],
  )
  const step = useCallback(
    (offset: number) => {
      const target = segments[currentIndex + offset] ?? segments[0]
      if (target) {
        seek(target.start)
      }
    },
    [segments, currentIndex, seek],
  )

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (
        isTyping(event.target) ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      ) {
        return
      }
      const key = event.key.toLowerCase()
      if (key === ' ') {
        toggle()
      } else if (key === 'a' || key === 'arrowleft') {
        step(-1)
      } else if (key === 'd' || key === 'arrowright') {
        step(1)
      } else if (key === 's' || key === 'r') {
        step(0)
      } else if (key === 'escape') {
        setSelection(null)
        return
      } else {
        return
      }
      event.preventDefault()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [toggle, step])

  useEffect(() => {
    const onChange = () =>
      setFullscreen(document.fullscreenElement === stageRef.current)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  function resizeVideo(event: PointerEvent<HTMLDivElement>) {
    const layout = layoutRef.current
    if (!layout || !event.currentTarget.hasPointerCapture(event.pointerId)) {
      return
    }
    const box = layout.getBoundingClientRect()
    setVideoWidth(clampVideoWidth(event.clientX - box.left, box.width))
  }

  function resetVideoWidth() {
    setVideoWidth(null)
    saveVideoWidth(null)
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      void document.exitFullscreen()
    } else {
      void stageRef.current?.requestFullscreen()
    }
  }

  const selectedVocab =
    selection?.kind === 'vocab' ? vocabById.get(selection.id) : undefined
  const selectedGrammar =
    selection?.kind === 'grammar' ? grammarById.get(selection.id) : undefined
  const detail = (selectedVocab || selectedGrammar) && (
    <div data-testid="detail" className="relative">
      <button
        type="button"
        aria-label="關閉"
        className="absolute top-0 right-0 p-1 text-muted hover:text-accent"
        onClick={() => setSelection(null)}
      >
        ✕
      </button>
      {selectedVocab && (
        <VocabDetail
          entry={selectedVocab}
          segments={segments}
          onSeek={seekTo}
        />
      )}
      {selectedGrammar && (
        <GrammarDetail
          entry={selectedGrammar}
          segments={segments}
          onSeek={seekTo}
        />
      )}
    </div>
  )

  return (
    <div
      ref={layoutRef}
      className="items-start gap-4 py-4 lg:flex lg:flex-wrap"
    >
      <div
        data-testid="video-column"
        className={
          // Below lg the column dissolves, so that the video can stay
          // in view while the rest of the page scrolls under it.
          `max-lg:contents ${
            videoWidth === null
              ? 'lg:min-w-0 lg:flex-1'
              : 'lg:w-(--video-width) lg:max-w-full lg:shrink-0'
          }`
        }
        style={{ '--video-width': `${videoWidth}px` } as CSSProperties}
      >
        <div
          ref={stageRef}
          className="@container relative aspect-video overflow-hidden rounded-xl bg-black max-lg:z-10 max-lg:mx-auto max-lg:portrait:sticky max-lg:portrait:top-[env(safe-area-inset-top)] max-lg:landscape:w-[min(100%,calc((100dvh-1rem)*16/9))]"
        >
          <div
            ref={playerRef}
            data-testid="player"
            className="absolute inset-0 [&>iframe]:h-full [&>iframe]:w-full"
          />
          {error && (
            <div
              role="alert"
              className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/90 p-4 text-center text-white"
            >
              <p>{error}</p>
              {!download.local && download.running && (
                <p className="text-sm">
                  正在下載影片到本機…（
                  {Math.round(download.progress * 100)}%）
                </p>
              )}
              {!download.local && !download.running && (
                <button
                  type="button"
                  className="rounded-full bg-accent px-4 py-2 font-semibold"
                  onClick={download.start}
                >
                  下載影片到本機
                </button>
              )}
              {download.error && (
                <p className="text-sm text-white/80">{download.error}</p>
              )}
            </div>
          )}
          {current && speaking && (
            <SubtitleOverlay
              segment={current}
              grammar={currentGrammar}
              showJa={showJa}
              showZh={showZh}
              showFurigana={showFurigana}
              atTop={atTop}
              selection={selection}
              onSelect={select}
            />
          )}
          {fullscreen && detail && (
            <div className="absolute top-4 right-4 max-h-[70%] w-88 max-w-[45%] overflow-y-auto rounded-xl bg-card p-4 shadow-2xl">
              {detail}
            </div>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Toggle label="日文字幕" checked={showJa} onChange={setShowJa} />
          <Toggle
            label="假名"
            checked={showFurigana}
            onChange={setShowFurigana}
          />
          <Toggle label="中文字幕" checked={showZh} onChange={setShowZh} />
          <Toggle label="字幕置頂" checked={atTop} onChange={setAtTop} />
          <span className="mx-1 hidden h-5 w-px bg-line sm:block" />
          <button
            type="button"
            className={CONTROL_CLASS}
            title="快捷鍵：A 或 ←"
            onClick={() => step(-1)}
          >
            ⏮ 上一句
          </button>
          <button
            type="button"
            className={CONTROL_CLASS}
            title="快捷鍵：空白鍵"
            onClick={toggle}
          >
            {playing ? '⏸ 暫停' : '▶ 播放'}
          </button>
          <button
            type="button"
            className={CONTROL_CLASS}
            title="快捷鍵：S 或 R"
            onClick={() => step(0)}
          >
            ↻ 重聽這句
          </button>
          <button
            type="button"
            className={CONTROL_CLASS}
            title="快捷鍵：D 或 →"
            onClick={() => step(1)}
          >
            下一句 ⏭
          </button>
          {CAN_FULLSCREEN && (
            <button
              type="button"
              className={`${CONTROL_CLASS} ml-auto`}
              onClick={toggleFullscreen}
            >
              ⛶ 全螢幕
            </button>
          )}
        </div>
        <p className="mt-2 text-xs text-muted">
          點字幕裡的單字或文法標籤，影片會暫停並顯示解說。
          <span className="hidden lg:inline">
            拖曳影片右邊的直條可以調整影片大小。快捷鍵：空白鍵
            播放／暫停，A 上一句，S 重聽這句，D 下一句（← R →
            也可以），Esc 關閉解說。
          </span>
          {download.local && ' 這部影片播放的是下載到本機的檔案。'}
          {video.transcript_source === 'whisper' &&
            ' 這部影片的日文字幕由本機語音辨識產生，可能有錯字。'}
        </p>
      </div>

      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="調整影片大小"
        title="拖曳調整影片大小，按兩下恢復預設"
        className="hidden w-2 shrink-0 cursor-col-resize touch-none self-stretch rounded-full bg-line transition-colors hover:bg-accent active:bg-accent lg:block"
        onPointerDown={(event) =>
          event.currentTarget.setPointerCapture(event.pointerId)
        }
        onPointerMove={resizeVideo}
        onPointerUp={() => saveVideoWidth(videoWidth)}
        onDoubleClick={resetVideoWidth}
      />

      <aside
        className={`mt-4 space-y-3 lg:mt-0 ${
          videoWidth === null ? 'lg:w-96 lg:shrink-0' : 'lg:min-w-80 lg:flex-1'
        }`}
      >
        {detail && !fullscreen && (
          <div className="rounded-xl border-2 border-accent/40 bg-card p-4">
            {detail}
          </div>
        )}

        <div className="rounded-xl border border-line bg-card">
          <div className="flex border-b border-line">
            {(
              [
                ['sentence', '這一句'],
                ['transcript', '逐字稿'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={`flex-1 border-b-2 py-2 text-sm font-semibold ${
                  panelTab === value
                    ? 'border-accent text-accent'
                    : 'border-transparent text-muted hover:text-ink'
                }`}
                onClick={() => setPanelTab(value)}
              >
                {label}
              </button>
            ))}
          </div>

          {panelTab === 'sentence' && current && (
            <div className="p-4">
              <p className="text-xl leading-[2.1]">
                <JaText
                  tokens={current.tokens}
                  showFurigana={showFurigana}
                  selectedWord={selectedVocab?.id}
                  onWord={selectWord}
                />
              </p>
              <p className="mt-1 text-muted">{current.zh}</p>

              {currentWords.length > 0 && (
                <>
                  <h3 className="mt-4 mb-1 text-xs font-semibold tracking-wider text-muted">
                    單字
                  </h3>
                  <ul>
                    {currentWords.map((entry) => (
                      <li key={entry.id}>
                        <button
                          type="button"
                          className="flex w-full items-baseline gap-2 rounded px-1 py-1 text-left hover:bg-paper"
                          onClick={() => selectWord(entry.id)}
                        >
                          <span lang="ja" className="font-semibold">
                            {entry.word}
                          </span>
                          <span lang="ja" className="text-xs text-accent">
                            {entry.reading}
                          </span>
                          <span className="truncate text-sm text-muted">
                            {entry.meaning}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {currentGrammar.length > 0 && (
                <>
                  <h3 className="mt-4 mb-1 text-xs font-semibold tracking-wider text-muted">
                    文法
                  </h3>
                  <ul>
                    {currentGrammar.map((entry) => (
                      <li key={entry.id}>
                        <button
                          type="button"
                          className="flex w-full items-baseline gap-2 rounded px-1 py-1 text-left hover:bg-paper"
                          onClick={() =>
                            select({ kind: 'grammar', id: entry.id })
                          }
                        >
                          <span
                            lang="ja"
                            className="shrink-0 font-semibold text-indigo"
                          >
                            {entry.pattern}
                          </span>
                          <span className="truncate text-sm text-muted">
                            {entry.meaning}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}

          {panelTab === 'transcript' && (
            <TranscriptList
              segments={segments}
              activeIndex={currentIndex}
              follow={playing}
              showFurigana={showFurigana}
              selectedWord={selectedVocab?.id}
              onSeek={seekTo}
              onWord={selectWord}
              className="max-h-[50dvh] overflow-y-auto p-2 lg:max-h-[60vh]"
            />
          )}
        </div>
      </aside>
    </div>
  )
}
