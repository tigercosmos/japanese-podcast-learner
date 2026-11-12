interface Voice {
  name: string
  lang: string
  localService: boolean
}

// The Web Speech API does not tell the gender of a voice, so the female
// Japanese voices of macOS, iOS, Windows, and Chrome are listed by name,
// the most natural ones first.
const FEMALE_VOICES = [
  'Kyoko',
  'O-ren',
  'Nanami',
  'Haruka',
  'Ayumi',
  'Sayaka',
  'Google 日本語',
  'Flo',
  'Sandy',
  'Shelley',
]
const MALE_VOICES = [
  'Otoya',
  'Hattori',
  'Keita',
  'Ichiro',
  'Eddy',
  'Reed',
  'Rocko',
  'Grandpa',
]

const named = (voice: Voice, names: string[]) =>
  names.findIndex((name) => voice.name.includes(name))

/**
 * Pick the voice for Japanese text, or undefined when the system has
 * none. A known female voice comes first, then a voice that is not known
 * to be male. A known male voice is the last resort.
 */
export function pickJapaneseVoice<T extends Voice>(voices: T[]) {
  const japanese = voices.filter((voice) =>
    voice.lang.toLowerCase().replace('_', '-').startsWith('ja'),
  )
  const female = japanese
    .filter((voice) => named(voice, FEMALE_VOICES) >= 0)
    .sort((a, b) => named(a, FEMALE_VOICES) - named(b, FEMALE_VOICES))
  return (
    female[0] ??
    japanese.find((voice) => named(voice, MALE_VOICES) < 0) ??
    japanese[0]
  )
}

export function canSpeak(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

const VOICES_TIMEOUT_MS = 1000

/**
 * Resolve with the voices of the system. Chrome loads them in the
 * background: the first `getVoices()` call returns an empty list and only
 * starts the loading.
 */
function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  const synth = window.speechSynthesis
  const voices = synth.getVoices()
  if (voices.length > 0) {
    return Promise.resolve(voices)
  }
  return new Promise((resolve) => {
    const finish = () => {
      window.clearTimeout(timer)
      synth.removeEventListener('voiceschanged', finish)
      resolve(synth.getVoices())
    }
    const timer = window.setTimeout(finish, VOICES_TIMEOUT_MS)
    synth.addEventListener('voiceschanged', finish)
  })
}

// Start loading the voices with the page. Without a voice chosen, the
// browser reads with its default Japanese voice, which can be a male one.
if (canSpeak()) {
  void loadVoices()
}

/** Read Japanese text aloud with the text-to-speech of the system. */
export async function speakJapanese(text: string) {
  if (!canSpeak() || !text.trim()) {
    return
  }
  const synth = window.speechSynthesis
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'ja-JP'
  utterance.rate = 0.9
  const voice = pickJapaneseVoice(await loadVoices())
  if (voice) {
    utterance.voice = voice
  }
  // A new request replaces the one in progress instead of queueing.
  synth.cancel()
  synth.speak(utterance)
}
