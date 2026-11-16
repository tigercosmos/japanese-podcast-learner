import type { GrammarEntry, Segment, Selection } from '../types/video'
import JaText from './JaText'

interface Props {
  segment: Segment
  grammar: GrammarEntry[]
  showJa: boolean
  showZh: boolean
  showFurigana: boolean
  /** Draw at the top, for videos with burned-in subtitles at the bottom. */
  atTop: boolean
  selection: Selection | null
  onSelect: (selection: Selection) => void
}

/** The subtitles drawn over the video. Only the box takes pointer input. */
export default function SubtitleOverlay({
  segment,
  grammar,
  showJa,
  showZh,
  showFurigana,
  atTop,
  selection,
  onSelect,
}: Props) {
  if (!showJa && !showZh) {
    return null
  }
  return (
    <div
      className={`pointer-events-none absolute inset-x-0 flex justify-center px-1.5 @md:px-3 ${
        atTop ? 'top-[12%]' : 'bottom-[14%]'
      }`}
    >
      <div
        data-testid="subtitle"
        className="pointer-events-auto max-w-[98%] rounded-lg bg-black/75 px-2 py-1 text-center @md:max-w-[94%] @md:px-4 @md:py-2 text-white shadow-lg"
      >
        {showJa && (
          <p
            className={`text-[clamp(0.9rem,2.6cqw,2.2rem)] font-medium ${
              showFurigana ? 'leading-[2]' : 'leading-normal'
            }`}
          >
            <JaText
              tokens={segment.tokens}
              showFurigana={showFurigana}
              selectedWord={selection?.kind === 'vocab' ? selection.id : null}
              wordClass="hover:bg-white/25"
              selectedClass="bg-amber-300/30 text-amber-200"
              onWord={(id) => onSelect({ kind: 'vocab', id })}
            />
          </p>
        )}
        {showZh && segment.zh && (
          <p className="text-[clamp(0.8rem,2.1cqw,1.7rem)] text-amber-100">
            {segment.zh}
          </p>
        )}
        {showJa && grammar.length > 0 && (
          <div className="mt-1 flex flex-wrap justify-center gap-1.5">
            {grammar.map((entry) => (
              <button
                key={entry.id}
                type="button"
                lang="ja"
                title={entry.meaning}
                className={`rounded-full border px-2 py-0.5 text-[clamp(0.7rem,1.3cqw,1rem)] transition-colors ${
                  selection?.kind === 'grammar' && selection.id === entry.id
                    ? 'border-sky-200 bg-sky-200 text-slate-900'
                    : 'border-sky-200/60 text-sky-100 hover:bg-sky-200/25'
                }`}
                onClick={() => onSelect({ kind: 'grammar', id: entry.id })}
              >
                {entry.pattern}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
