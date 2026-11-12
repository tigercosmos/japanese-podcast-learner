import {
  activeSegmentIndex,
  formatTime,
  segmentIndexAt,
  splitAround,
} from './subtitles'

const segments = [
  { start: 1, end: 3 },
  { start: 3, end: 5 },
  { start: 8, end: 10 },
]

describe('segmentIndexAt', () => {
  it('returns -1 before the first segment', () => {
    expect(segmentIndexAt(segments, 0.5)).toBe(-1)
  })

  it('returns the latest started segment, also during a gap', () => {
    expect(segmentIndexAt(segments, 1)).toBe(0)
    expect(segmentIndexAt(segments, 3)).toBe(1)
    expect(segmentIndexAt(segments, 6)).toBe(1)
    expect(segmentIndexAt(segments, 99)).toBe(2)
  })
})

describe('activeSegmentIndex', () => {
  it('hides the subtitle once the segment has ended', () => {
    expect(activeSegmentIndex(segments, 4.9)).toBe(1)
    expect(activeSegmentIndex(segments, 5)).toBe(-1)
    expect(activeSegmentIndex(segments, 6)).toBe(-1)
  })

  it('switches at the boundary of back-to-back segments', () => {
    expect(activeSegmentIndex(segments, 2.99)).toBe(0)
    expect(activeSegmentIndex(segments, 3)).toBe(1)
  })
})

describe('formatTime', () => {
  it('formats minutes and hours', () => {
    expect(formatTime(0)).toBe('0:00')
    expect(formatTime(75.9)).toBe('1:15')
    expect(formatTime(3725)).toBe('1:02:05')
  })
})

describe('splitAround', () => {
  it('isolates the matching part', () => {
    expect(splitAround('食べてしまいました', 'てしまい')).toEqual({
      before: '食べ',
      match: 'てしまい',
      after: 'ました',
    })
  })

  it('keeps the sentence whole when there is nothing to mark', () => {
    expect(splitAround('食べました', '')).toEqual({
      before: '食べました',
      match: '',
      after: '',
    })
    expect(splitAround('食べました', '飲む').match).toBe('')
  })
})
