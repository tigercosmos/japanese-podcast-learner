import { LEVELS } from '../types/video'
import type { GrammarEntry, Level, VocabEntry } from '../types/video'

export type VocabSort = 'order' | 'count' | 'level'

export interface StudyFilter {
  /** Levels to show. An empty set shows every level. */
  levels: ReadonlySet<Level>
  query: string
}

function matches(filter: StudyFilter, level: Level, fields: string[]) {
  if (filter.levels.size > 0 && !filter.levels.has(level)) {
    return false
  }
  const query = filter.query.trim().toLowerCase()
  return !query || fields.some((field) => field.toLowerCase().includes(query))
}

export function filterVocabulary(
  entries: VocabEntry[],
  filter: StudyFilter,
  sort: VocabSort = 'order',
): VocabEntry[] {
  const shown = entries.filter((entry) =>
    matches(filter, entry.level, [entry.word, entry.reading, entry.meaning]),
  )
  if (sort === 'count') {
    return shown.sort((a, b) => b.count - a.count)
  }
  if (sort === 'level') {
    // Hardest first: those are the words a learner most likely needs.
    return shown.sort(
      (a, b) => LEVELS.indexOf(b.level) - LEVELS.indexOf(a.level),
    )
  }
  return shown
}

export function filterGrammar(
  entries: GrammarEntry[],
  filter: StudyFilter,
): GrammarEntry[] {
  return entries.filter((entry) =>
    matches(filter, entry.level, [entry.pattern, entry.meaning]),
  )
}

export function countByLevel(entries: { level: Level }[]) {
  const counts = Object.fromEntries(LEVELS.map((level) => [level, 0]))
  for (const entry of entries) {
    counts[entry.level] += 1
  }
  return counts as Record<Level, number>
}
