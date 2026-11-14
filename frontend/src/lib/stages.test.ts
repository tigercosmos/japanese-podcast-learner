import { isActive, stageLabel } from './stages'

describe('stageLabel', () => {
  it('shows the percentage only for the stages that report progress', () => {
    expect(stageLabel({ stage: 'analyze', progress: 0.25 })).toBe(
      '翻譯並整理單字與文法（25%）',
    )
    expect(stageLabel({ stage: 'proofread', progress: 0.5 })).toBe(
      '校對語音辨識的逐字稿（50%）',
    )
    expect(stageLabel({ stage: 'video', progress: 0.1 })).toBe(
      '下載影片到本機（10%）',
    )
    expect(stageLabel({ stage: 'transcribe', progress: 0 })).toBe(
      '本機語音辨識中（Whisper）',
    )
  })

  it('falls back to a generic label for an unknown stage', () => {
    expect(stageLabel({ stage: 'new-stage', progress: 0 })).toBe('處理中')
  })
})

describe('isActive', () => {
  it('is true only while the backend still works on the video', () => {
    expect(isActive({ status: 'queued' })).toBe(true)
    expect(isActive({ status: 'processing' })).toBe(true)
    expect(isActive({ status: 'ready' })).toBe(false)
    expect(isActive({ status: 'failed' })).toBe(false)
  })
})
