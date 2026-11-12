import {
  clampVideoWidth,
  loadVideoWidth,
  MIN_VIDEO_WIDTH,
  saveVideoWidth,
} from './layout'

describe('clampVideoWidth', () => {
  it('keeps a width that fits', () => {
    expect(clampVideoWidth(700.4, 1200)).toBe(700)
  })

  it('never lets the video become too small to watch', () => {
    expect(clampVideoWidth(50, 1200)).toBe(MIN_VIDEO_WIDTH)
  })

  it('leaves room for the resize handle at the full width', () => {
    expect(clampVideoWidth(5000, 1200)).toBe(1176)
  })

  it('prefers the minimum when the container is narrower than it', () => {
    expect(clampVideoWidth(400, 200)).toBe(MIN_VIDEO_WIDTH)
  })
})

describe('stored video width', () => {
  beforeEach(() => localStorage.clear())

  it('is null until the user resizes the video', () => {
    expect(loadVideoWidth()).toBeNull()
  })

  it('survives a reload and can be reset', () => {
    saveVideoWidth(900)
    expect(loadVideoWidth()).toBe(900)

    saveVideoWidth(null)
    expect(loadVideoWidth()).toBeNull()
  })

  it('ignores a damaged value', () => {
    localStorage.setItem('video-width', 'wide')
    expect(loadVideoWidth()).toBeNull()
  })
})
