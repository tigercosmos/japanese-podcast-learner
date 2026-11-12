import { useMemo, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { GrammarDetail, VocabDetail } from '../components/Details'
import Toggle from '../components/Toggle'
import TranscriptList from '../components/TranscriptList'
import { useStoredFlag } from '../hooks/useStoredFlag'
import { countByLevel, filterGrammar, filterVocabulary } from '../lib/study'
import type { VocabSort } from '../lib/study'
import { LEVELS } from '../types/video'
import type { Level, ReadyVideo, Segment } from '../types/video'

type Tab = 'vocabulary' | 'grammar' | 'transcript'

const PAGE_SIZE = 60

const SORTS: { value: VocabSort; label: string }[] = [
  { value: 'order', label: '依出現順序' },
  { value: 'count', label: '依出現次數' },
  { value: 'level', label: '依難度' },
]

export default function StudyPage() {
  const video = useOutletContext<ReadyVideo>()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('vocabulary')
  const [levels, setLevels] = useState<ReadonlySet<Level>>(new Set())
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<VocabSort>('order')
  const [limit, setLimit] = useState(PAGE_SIZE)
  const [lookup, setLookup] = useState<string | null>(null)
  const [showFurigana, setShowFurigana] = useStoredFlag('furigana', true)

  const vocabulary = useMemo(
    () => filterVocabulary(video.vocabulary, { levels, query }, sort),
    [video.vocabulary, levels, query, sort],
  )
  const grammar = useMemo(
    () => filterGrammar(video.grammar, { levels, query }),
    [video.grammar, levels, query],
  )
  const levelCounts = useMemo(
    () =>
      countByLevel(tab === 'grammar' ? video.grammar : video.vocabulary),
    [tab, video.grammar, video.vocabulary],
  )
  const lookedUp = lookup
    ? video.vocabulary.find((entry) => entry.id === lookup)
    : undefined

  const tabs: { value: Tab; label: string }[] = [
    { value: 'vocabulary', label: `單字 ${video.vocabulary.length}` },
    { value: 'grammar', label: `文法 ${video.grammar.length}` },
    { value: 'transcript', label: '逐字稿' },
  ]

  function watchFrom(segment: Segment) {
    navigate(`/v/${video.id}/watch?t=${Math.floor(segment.start)}`)
  }

  function toggleLevel(level: Level) {
    const next = new Set(levels)
    if (!next.delete(level)) {
      next.add(level)
    }
    setLevels(next)
    setLimit(PAGE_SIZE)
  }

  return (
    <div className="py-4">
      <div className="flex flex-wrap items-center gap-2">
        {tabs.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            className={`border-b-2 px-3 py-2 font-semibold transition-colors ${
              tab === value
                ? 'border-accent text-accent'
                : 'border-transparent text-muted hover:text-ink'
            }`}
            onClick={() => {
              setTab(value)
              setLimit(PAGE_SIZE)
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab !== 'transcript' && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setLimit(PAGE_SIZE)
            }}
            placeholder="搜尋日文、讀音或中文"
            aria-label="搜尋"
            className="w-56 rounded-full border border-line bg-card px-4 py-1.5 text-sm outline-none focus:border-accent"
          />
          {LEVELS.map((level) => (
            <Toggle
              key={level}
              label={`${level}（${levelCounts[level]}）`}
              checked={levels.has(level)}
              onChange={() => toggleLevel(level)}
            />
          ))}
          {tab === 'vocabulary' && (
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as VocabSort)}
              aria-label="排序"
              className="ml-auto rounded-full border border-line bg-card px-3 py-1.5 text-sm"
            >
              {SORTS.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {tab === 'vocabulary' && (
        <>
          <ul className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {vocabulary.slice(0, limit).map((entry) => (
              <li
                key={entry.id}
                className="rounded-xl border border-line bg-card p-4"
              >
                <VocabDetail
                  entry={entry}
                  segments={video.segments}
                  onSeek={watchFrom}
                />
              </li>
            ))}
          </ul>
          {vocabulary.length === 0 && <Empty />}
          {vocabulary.length > limit && (
            <button
              type="button"
              className="mx-auto mt-6 block rounded-full border border-ink px-5 py-2 hover:border-accent hover:text-accent"
              onClick={() => setLimit(limit + PAGE_SIZE)}
            >
              顯示更多（還有 {vocabulary.length - limit} 個）
            </button>
          )}
        </>
      )}

      {tab === 'grammar' && (
        <>
          <ul className="mt-4 grid gap-3 lg:grid-cols-2">
            {grammar.map((entry) => (
              <li
                key={entry.id}
                className="rounded-xl border border-line bg-card p-4"
              >
                <GrammarDetail
                  entry={entry}
                  segments={video.segments}
                  onSeek={watchFrom}
                />
              </li>
            ))}
          </ul>
          {grammar.length === 0 && <Empty />}
        </>
      )}

      {tab === 'transcript' && (
        <div className="mt-4 grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="rounded-xl border border-line bg-card p-2">
            <div className="flex items-center gap-3 px-2 py-1">
              <Toggle
                label="假名"
                checked={showFurigana}
                onChange={setShowFurigana}
              />
              <span className="text-xs text-muted">
                點單字看解說，點時間從那一句開始看影片。
              </span>
            </div>
            <TranscriptList
              segments={video.segments}
              activeIndex={-1}
              showFurigana={showFurigana}
              selectedWord={lookup}
              onSeek={watchFrom}
              onWord={setLookup}
            />
          </div>
          <aside className="sticky top-4 rounded-xl border border-line bg-card p-4">
            {lookedUp ? (
              <VocabDetail
                entry={lookedUp}
                segments={video.segments}
                onSeek={watchFrom}
              />
            ) : (
              <p className="text-sm text-muted">點選逐字稿裡的單字。</p>
            )}
          </aside>
        </div>
      )}
    </div>
  )
}

function Empty() {
  return <p className="mt-8 text-center text-muted">沒有符合條件的項目。</p>
}
