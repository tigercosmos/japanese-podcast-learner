import type { Level } from '../types/video'

const STYLES: Record<Level, string> = {
  N5: 'bg-emerald-100 text-emerald-800',
  N4: 'bg-teal-100 text-teal-800',
  N3: 'bg-amber-100 text-amber-800',
  N2: 'bg-orange-100 text-orange-800',
  N1: 'bg-rose-100 text-rose-800',
}

export default function LevelBadge({ level }: { level: Level }) {
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-xs font-semibold ${
        STYLES[level] ?? 'bg-stone-100 text-stone-700'
      }`}
    >
      {level}
    </span>
  )
}
