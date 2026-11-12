import { countByLevel, filterGrammar, filterVocabulary } from './study'
import type { GrammarEntry, Level, VocabEntry } from '../types/video'

function vocab(
  word: string,
  reading: string,
  meaning: string,
  level: Level,
  count: number,
): VocabEntry {
  return {
    id: word,
    word,
    reading,
    meaning,
    level,
    count,
    pos: '名詞',
    usage: '',
    example: { ja: '', zh: '' },
    segments: [],
  }
}

const words = [
  vocab('食べる', 'たべる', '吃', 'N5', 2),
  vocab('曖昧', 'あいまい', '模糊、含糊', 'N2', 1),
  vocab('友達', 'ともだち', '朋友', 'N5', 5),
]

const all = { levels: new Set<Level>(), query: '' }

describe('filterVocabulary', () => {
  it('shows every level when none is selected', () => {
    expect(filterVocabulary(words, all)).toHaveLength(3)
  })

  it('keeps only the selected levels', () => {
    const shown = filterVocabulary(words, { ...all, levels: new Set(['N2']) })
    expect(shown.map((entry) => entry.word)).toEqual(['曖昧'])
  })

  it('searches the word, the reading, and the Chinese meaning', () => {
    const search = (query: string) =>
      filterVocabulary(words, { ...all, query }).map((entry) => entry.word)
    expect(search('友')).toEqual(['友達'])
    expect(search('たべ')).toEqual(['食べる'])
    expect(search('含糊')).toEqual(['曖昧'])
  })

  it('sorts by frequency or by difficulty without touching the input', () => {
    const byCount = filterVocabulary(words, all, 'count')
    expect(byCount.map((entry) => entry.word)).toEqual([
      '友達',
      '食べる',
      '曖昧',
    ])
    expect(filterVocabulary(words, all, 'level')[0].word).toBe('曖昧')
    expect(words[0].word).toBe('食べる')
  })
})

describe('filterGrammar', () => {
  const grammar = [
    { pattern: '〜てしまう', meaning: '不小心做了', level: 'N4' },
    { pattern: '〜わけではない', meaning: '並不是', level: 'N3' },
  ] as GrammarEntry[]

  it('filters by level and by pattern text', () => {
    expect(
      filterGrammar(grammar, { ...all, levels: new Set(['N3']) }),
    ).toHaveLength(1)
    expect(filterGrammar(grammar, { ...all, query: 'しまう' })).toHaveLength(1)
  })
})

describe('countByLevel', () => {
  it('counts every level, including the empty ones', () => {
    expect(countByLevel(words)).toEqual({ N5: 2, N4: 0, N3: 0, N2: 1, N1: 0 })
  })
})
