import { loadPosition, savePosition } from './position'

describe('playback position', () => {
  beforeEach(() => localStorage.clear())

  it('starts a video that was never watched from the beginning', () => {
    expect(loadPosition('a', 600)).toBe(0)
  })

  it('resumes where the viewer stopped', () => {
    savePosition('a', 123.7)
    expect(loadPosition('a', 600)).toBe(123)
  })

  it('keeps a position per video', () => {
    savePosition('a', 100)
    savePosition('b', 200)
    expect(loadPosition('a', 600)).toBe(100)
    expect(loadPosition('b', 600)).toBe(200)
  })

  it('starts over when the video was watched to the end', () => {
    savePosition('a', 598)
    expect(loadPosition('a', 600)).toBe(0)
  })

  it('still resumes when the duration is unknown', () => {
    savePosition('a', 598)
    expect(loadPosition('a', 0)).toBe(598)
  })

  it('ignores a damaged value', () => {
    localStorage.setItem('position:a', 'later')
    expect(loadPosition('a', 600)).toBe(0)
  })
})
