import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useOutletContext, useSearchParams } from 'react-router-dom'
import { GrammarDetail, VocabDetail } from '../components/Details'
import JaText from '../components/JaText'
import SubtitleOverlay from '../components/SubtitleOverlay'
import Toggle from '../components/Toggle'
import TranscriptList from '../components/TranscriptList'
import { useStoredFlag } from '../hooks/useStoredFlag'
import { useYouTubePlayer } from '../hooks/useYouTubePlayer'
import { segmentIndexAt } from '../lib/subtitles'
import type {
  GrammarEntry,
  ReadyVideo,
  Segment,
  Selection,
  VocabEntry,
} from '../types/video'

type PanelTab = 'sentence' | 'transcript'

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
  const [params] = useSearchParams()
  const startAt = Number(params.get('t')) || 0

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
  const stageRef = useRef<HTMLDivElement>(null)

  const handleTime = useCallback(
    (time: number) => {
      const index = segmentIndexAt(segments, time)
      setCurrentIndex(index)
      setSpeaking(index >= 0 && time < segments[index].end)
    },
    [segments],
  )
  const playerRef = useRef<HTMLDivElement>(null)
  const { playing, error, seek, pause, toggle } = useYouTubePlayer(
    playerRef,
    video.id,
    startAt,
    handleTime,
  )

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
      if (isTyping(event.target) || event.metaKey || event.ctrlKey) {
        return
      }
      if (event.key === ' ') {
        toggle()
      } else if (event.key === 'ArrowLeft') {
        step(-1)
      } else if (event.key === 'ArrowRight') {
        step(1)
      } else if (event.key === 'r') {
        step(0)
      } else if (event.key === 'Escape') {
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
        className="absolute top-0 right-0 text-muted hover:text-accent"
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
    <div className="grid items-start gap-4 py-4 lg:grid-cols-[minmax(0,1fr)_24rem]">
      <div>
        <div
          ref={stageRef}
          className="@container relative aspect-video overflow-hidden rounded-xl bg-black"
        >
          <div
            ref={playerRef}
            className="absolute inset-0 [&>iframe]:h-full [&>iframe]:w-full"
          />
          {error && (
            <p className="absolute inset-0 flex items-center justify-center text-white">
              {error}
            </p>
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
          <span className="mx-1 h-5 w-px bg-line" />
          <button
            type="button"
            className={CONTROL_CLASS}
            title="快捷鍵：←"
            onClick={() => step(-1)}
          >
            ⏮ 上一句
          </button>
          <button
            type="button"
            className={CONTROL_CLASS}
            title="快捷鍵：R"
            onClick={() => step(0)}
          >
            ↻ 重聽這句
          </button>
          <button
            type="button"
            className={CONTROL_CLASS}
            title="快捷鍵：→"
            onClick={() => step(1)}
          >
            下一句 ⏭
          </button>
          <button
            type="button"
            className={`${CONTROL_CLASS} ml-auto`}
            onClick={toggleFullscreen}
          >
            ⛶ 全螢幕
          </button>
        </div>
        <p className="mt-2 text-xs text-muted">
          點字幕裡的單字或文法標籤，影片會暫停並顯示解說。快捷鍵：空白鍵
          播放／暫停，← → 上一句／下一句，R 重聽，Esc 關閉解說。
          {video.transcript_source === 'whisper' &&
            ' 這部影片的日文字幕由本機語音辨識產生，可能有錯字。'}
        </p>
      </div>

      <aside className="space-y-3">
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
              className="max-h-[60vh] overflow-y-auto p-2"
            />
          )}
        </div>
      </aside>
    </div>
  )
}
