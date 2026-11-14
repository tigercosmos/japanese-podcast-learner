export const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'] as const
export type Level = (typeof LEVELS)[number]

/** A run of text and the reading shown above it, if any. */
export type FuriganaPart = [text: string, ruby: string | null]

export interface Token {
  /** Surface form, as written in the sentence. */
  s: string
  /** Furigana, present when the token has kanji. */
  f?: FuriganaPart[]
  /** Id of the vocabulary entry, present for explained words. */
  v?: string
}

export interface Segment {
  id: number
  start: number
  end: number
  ja: string
  zh: string
  tokens: Token[]
  /** Ids of the grammar entries that appear in this sentence. */
  grammar: string[]
}

export interface Example {
  ja: string
  zh: string
}

export interface VocabEntry {
  id: string
  word: string
  reading: string
  pos: string
  level: Level
  meaning: string
  usage: string
  example: Example
  count: number
  segments: number[]
}

export interface GrammarOccurrence {
  segment: number
  /** The part of the sentence that uses the pattern, or ''. */
  text: string
}

export interface GrammarEntry {
  id: string
  pattern: string
  level: Level
  meaning: string
  explanation: string
  usage: string
  examples: Example[]
  occurrences: GrammarOccurrence[]
}

export type VideoStatus = 'queued' | 'processing' | 'ready' | 'failed'

export interface VideoMeta {
  id: string
  url: string
  title: string
  channel: string
  duration: number
  thumbnail: string
  created_at: number
  status: VideoStatus
  stage: string
  progress: number
  error: string
  transcript_source?: 'youtube' | 'whisper'
  counts?: { segments: number; vocabulary: number; grammar: number }
  /** A copy of the video is on this computer and is the one to play. */
  local_video?: boolean
  /** A download asked for after the analysis: its state and progress. */
  video_download?: '' | 'running' | 'failed'
  video_progress?: number
  video_error?: string
}

export interface Video extends VideoMeta {
  segments?: Segment[]
  vocabulary?: VocabEntry[]
  grammar?: GrammarEntry[]
}

export interface ReadyVideo extends VideoMeta {
  segments: Segment[]
  vocabulary: VocabEntry[]
  grammar: GrammarEntry[]
}

export type Selection =
  | { kind: 'vocab'; id: string }
  | { kind: 'grammar'; id: string }
