import type { Token } from '../types/video'

interface Props {
  tokens: Token[]
  showFurigana: boolean
  /** Called with the vocabulary id when an explained word is clicked. */
  onWord?: (id: string) => void
  selectedWord?: string | null
  /** Classes for an explained word. They differ on dark backgrounds. */
  wordClass?: string
  selectedClass?: string
}

function TokenText({ token, ruby }: { token: Token; ruby: boolean }) {
  if (!ruby || !token.f) {
    return token.s
  }
  return token.f.map(([text, reading], index) =>
    reading ? (
      <ruby key={index}>
        {text}
        <rt>{reading}</rt>
      </ruby>
    ) : (
      text
    ),
  )
}

/** A Japanese sentence with optional furigana and clickable words. */
export default function JaText({
  tokens,
  showFurigana,
  onWord,
  selectedWord,
  wordClass = 'hover:bg-accent-soft',
  selectedClass = 'bg-accent-soft text-accent',
}: Props) {
  return (
    <span lang="ja">
      {tokens.map((token, index) => {
        const id = token.v
        if (!id || !onWord) {
          return (
            <span key={index}>
              <TokenText token={token} ruby={showFurigana} />
            </span>
          )
        }
        return (
          <span
            key={index}
            role="button"
            tabIndex={0}
            data-word={id}
            className={`cursor-pointer rounded-sm underline decoration-current/30 decoration-dotted underline-offset-4 transition-colors ${
              selectedWord === id ? selectedClass : wordClass
            }`}
            onClick={(event) => {
              event.stopPropagation()
              onWord(id)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.stopPropagation()
                onWord(id)
              }
            }}
          >
            <TokenText token={token} ruby={showFurigana} />
          </span>
        )
      })}
    </span>
  )
}
