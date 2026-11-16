import { memo, useEffect, useRef } from 'react'
import { formatTime } from '../lib/subtitles'
import type { Segment } from '../types/video'
import JaText from './JaText'

interface Props {
  segments: Segment[]
  /** Index of the sentence to highlight, or -1. */
  activeIndex: number
  /** Keep the highlighted sentence in view. */
  follow?: boolean
  showFurigana: boolean
  selectedWord?: string | null
  onSeek: (segment: Segment) => void
  onWord: (id: string) => void
  className?: string
}

/** The whole transcript. Click a time to play, a word to look it up. */
function TranscriptList({
  segments,
  activeIndex,
  follow = false,
  showFurigana,
  selectedWord,
  onSeek,
  onWord,
  className = '',
}: Props) {
  const listRef = useRef<HTMLOListElement>(null)

  useEffect(() => {
    const list = listRef.current
    const row = list?.children[activeIndex] as HTMLElement | undefined
    if (!follow || !list || !row) {
      return
    }
    // scrollIntoView would also scroll the page; only the list may move.
    list.scrollTop = row.offsetTop - list.clientHeight / 2 + row.clientHeight
  }, [activeIndex, follow])

  return (
    <ol ref={listRef} className={`relative ${className}`}>
      {segments.map((segment, index) => (
        <li
          key={segment.id}
          className={`flex gap-3 rounded-lg px-2 py-2 ${
            index === activeIndex ? 'bg-accent-soft' : ''
          }`}
        >
          <button
            type="button"
            className="mt-1 shrink-0 self-start font-mono text-xs text-accent hover:underline"
            title="從這一句開始播放"
            onClick={() => onSeek(segment)}
          >
            {formatTime(segment.start)}
          </button>
          <div className="min-w-0">
            <p className={showFurigana ? 'leading-[2]' : ''}>
              <JaText
                tokens={segment.tokens}
                showFurigana={showFurigana}
                selectedWord={selectedWord}
                wordClass="hover:bg-card"
                onWord={onWord}
              />
            </p>
            <p className="text-sm text-muted">{segment.zh}</p>
          </div>
        </li>
      ))}
    </ol>
  )
}

export default memo(TranscriptList)
