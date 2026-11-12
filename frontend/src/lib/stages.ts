import type { VideoMeta } from '../types/video'

const STAGES: Record<string, string> = {
  queued: '排隊中',
  metadata: '取得影片資訊',
  subtitles: '下載日文字幕',
  audio: '下載音訊',
  transcribe: '本機語音辨識中（Whisper）',
  analyze: '翻譯並整理單字與文法',
  done: '完成',
}

export function isActive(meta: Pick<VideoMeta, 'status'>): boolean {
  return meta.status === 'queued' || meta.status === 'processing'
}

/** Describe what the backend is doing with a video, in Chinese. */
export function stageLabel(meta: Pick<VideoMeta, 'stage' | 'progress'>) {
  const label = STAGES[meta.stage] ?? '處理中'
  if (meta.stage === 'analyze') {
    return `${label}（${Math.round(meta.progress * 100)}%）`
  }
  return label
}
