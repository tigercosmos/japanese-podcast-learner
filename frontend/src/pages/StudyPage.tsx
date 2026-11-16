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
// iOS zooms the page when a field with text under 16px takes focus.
const FIELD_TEXT = 'text-base lg:text-sm'

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
    <div className="mx-auto max-w-7xl py-4">
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
            className={`w-full rounded-full border border-line bg-card px-4 py-1.5 outline-none focus:border-accent sm:w-56 ${FIELD_TEXT}`}
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
              className={`ml-auto rounded-full border border-line bg-card px-3 py-1.5 ${FIELD_TEXT}`}
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
                className="min-w-0 rounded-xl border border-line bg-card p-4"
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
                className="min-w-0 rounded-xl border border-line bg-card p-4"
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
        <div
          className={`mt-4 grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] ${
            lookedUp ? 'max-lg:pb-[55dvh]' : ''
          }`}
        >
          <div className="rounded-xl border border-line bg-card p-2">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-2 py-1">
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
          {/* Below lg the explanation is a sheet over the bottom edge. */}
          <aside
            className={`relative rounded-xl border border-line bg-card lg:sticky lg:top-4 ${
              lookedUp
                ? 'max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-20 max-lg:flex max-lg:max-h-[55dvh] max-lg:flex-col max-lg:rounded-b-none max-lg:pr-[env(safe-area-inset-right)] max-lg:pb-[env(safe-area-inset-bottom)] max-lg:pl-[env(safe-area-inset-left)] max-lg:shadow-[0_-8px_24px_rgb(0_0_0/0.18)]'
                : 'max-lg:hidden'
            }`}
          >
            {lookedUp ? (
              <>
                {/* Outside the scrolling part, so it never scrolls away. */}
                <button
                  type="button"
                  aria-label="關閉"
                  className="absolute top-2 right-[calc(0.5rem+env(safe-area-inset-right))] z-10 rounded-full bg-card p-2 leading-none text-muted hover:text-accent"
                  onClick={() => setLookup(null)}
                >
                  ✕
                </button>
                {/* The key starts each word at the top of the sheet. */}
                <div
                  key={lookedUp.id}
                  className="min-h-0 overflow-y-auto p-4 pr-10"
                >
                  <VocabDetail
                    entry={lookedUp}
                    segments={video.segments}
                    onSeek={watchFrom}
                  />
                </div>
              </>
            ) : (
              <p className="p-4 text-sm text-muted">點選逐字稿裡的單字。</p>
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
