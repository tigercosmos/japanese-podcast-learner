import { canSpeak, speakJapanese } from '../lib/speech'

interface Props {
  /** The Japanese text to read aloud. */
  text: string
  /** What is read, for the accessible name: 「朗讀單字」. */
  label: string
}

/** Read Japanese text aloud with the voice of the system. */
export default function SpeakButton({ text, label }: Props) {
  if (!canSpeak()) {
    return null
  }
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-accent-soft hover:text-accent"
      onClick={(event) => {
        event.stopPropagation()
        void speakJapanese(text)
      }}
    >
      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor">
        <path d="M9.4 3.3a.75.75 0 0 1 1.1.66v12.08a.75.75 0 0 1-1.22.58L5.3 13.4H3.25A1.25 1.25 0 0 1 2 12.15v-4.3A1.25 1.25 0 0 1 3.25 6.6H5.3l3.98-3.22a.75.75 0 0 1 .12-.08Zm4.3 3.2a.75.75 0 0 1 1.06.02 5 5 0 0 1 0 6.96.75.75 0 1 1-1.08-1.04 3.5 3.5 0 0 0 0-4.88.75.75 0 0 1 .02-1.06Z" />
      </svg>
    </button>
  )
}
