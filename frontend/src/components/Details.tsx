import { formatTime, splitAround } from '../lib/subtitles'
import type {
  Example,
  GrammarEntry,
  Segment,
  VocabEntry,
} from '../types/video'
import LevelBadge from './LevelBadge'

const MAX_OCCURRENCES = 5

function ExampleLine({ example }: { example: Example }) {
  return (
    <div className="border-l-2 border-line pl-3">
      <p lang="ja">{example.ja}</p>
      <p className="text-sm text-muted">{example.zh}</p>
    </div>
  )
}

function Label({ children }: { children: string }) {
  return (
    <h4 className="mt-3 mb-1 text-xs font-semibold tracking-wider text-muted">
      {children}
    </h4>
  )
}

interface OccurrenceProps {
  segment: Segment
  /** Part of the sentence to highlight. */
  mark?: string
  onSeek: (segment: Segment) => void
}

function Occurrence({ segment, mark = '', onSeek }: OccurrenceProps) {
  const parts = splitAround(segment.ja, mark)
  return (
    <button
      type="button"
      className="flex w-full gap-2 rounded px-1 py-1 text-left hover:bg-paper"
      title="從這一句開始播放"
      onClick={() => onSeek(segment)}
    >
      <span className="mt-0.5 shrink-0 font-mono text-xs text-accent">
        ▶ {formatTime(segment.start)}
      </span>
      <span>
        <span lang="ja" className="block">
          {parts.before}
          {parts.match && (
            <mark className="rounded-sm bg-indigo-soft text-indigo">
              {parts.match}
            </mark>
          )}
          {parts.after}
        </span>
        <span className="block text-sm text-muted">{segment.zh}</span>
      </span>
    </button>
  )
}

function OccurrenceList({
  items,
  onSeek,
}: {
  items: { segment: Segment; mark?: string }[]
  onSeek: (segment: Segment) => void
}) {
  const shown = items.slice(0, MAX_OCCURRENCES)
  return (
    <>
      <Label>{`影片中的句子（${items.length}）`}</Label>
      <div className="space-y-0.5">
        {shown.map(({ segment, mark }) => (
          <Occurrence
            key={segment.id}
            segment={segment}
            mark={mark}
            onSeek={onSeek}
          />
        ))}
      </div>
      {items.length > shown.length && (
        <p className="mt-1 text-xs text-muted">
          還有 {items.length - shown.length} 句
        </p>
      )}
    </>
  )
}

interface VocabProps {
  entry: VocabEntry
  segments: Segment[]
  onSeek: (segment: Segment) => void
}

export function VocabDetail({ entry, segments, onSeek }: VocabProps) {
  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span lang="ja" className="text-2xl font-bold">
          {entry.word}
        </span>
        <span lang="ja" className="text-accent">
          {entry.reading}
        </span>
        <span className="text-xs text-muted">{entry.pos}</span>
        <LevelBadge level={entry.level} />
      </div>
      <p className="mt-2 font-medium">{entry.meaning}</p>

      <Label>用法</Label>
      <p className="text-sm leading-relaxed">{entry.usage}</p>

      <Label>例句</Label>
      <ExampleLine example={entry.example} />

      <OccurrenceList
        items={entry.segments.map((id) => ({ segment: segments[id] }))}
        onSeek={onSeek}
      />
    </div>
  )
}

interface GrammarProps {
  entry: GrammarEntry
  segments: Segment[]
  onSeek: (segment: Segment) => void
}

export function GrammarDetail({ entry, segments, onSeek }: GrammarProps) {
  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span lang="ja" className="text-xl font-bold text-indigo">
          {entry.pattern}
        </span>
        <LevelBadge level={entry.level} />
      </div>
      <p className="mt-2 font-medium">{entry.meaning}</p>

      <Label>接續</Label>
      <p lang="ja" className="text-sm">
        {entry.usage}
      </p>

      <Label>說明</Label>
      <p className="text-sm leading-relaxed">{entry.explanation}</p>

      <Label>例句</Label>
      <div className="space-y-2">
        {entry.examples.map((example, index) => (
          <ExampleLine key={index} example={example} />
        ))}
      </div>

      <OccurrenceList
        items={entry.occurrences.map((occurrence) => ({
          segment: segments[occurrence.segment],
          mark: occurrence.text,
        }))}
        onSeek={onSeek}
      />
    </div>
  )
}
