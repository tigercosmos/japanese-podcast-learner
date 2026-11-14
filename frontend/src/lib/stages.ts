import type { VideoMeta } from '../types/video'

const STAGES: Record<string, string> = {
  queued: '排隊中',
  metadata: '取得影片資訊',
  video: '下載影片到本機',
  subtitles: '下載日文字幕',
  audio: '下載音訊',
  transcribe: '本機語音辨識中（Whisper）',
  proofread: '校對語音辨識的逐字稿',
  analyze: '翻譯並整理單字與文法',
  done: '完成',
}

export function isActive(meta: Pick<VideoMeta, 'status'>): boolean {
  return meta.status === 'queued' || meta.status === 'processing'
}

/** Whether the stage reports how far along it is. */
export function hasProgress(meta: Pick<VideoMeta, 'stage'>): boolean {
  return ['video', 'proofread', 'analyze'].includes(meta.stage)
}

/** Describe what the backend is doing with a video, in Chinese. */
export function stageLabel(meta: Pick<VideoMeta, 'stage' | 'progress'>) {
  const label = STAGES[meta.stage] ?? '處理中'
  if (hasProgress(meta)) {
    return `${label}（${Math.round(meta.progress * 100)}%）`
  }
  return label
}
