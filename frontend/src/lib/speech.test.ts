import { pickJapaneseVoice } from './speech'

const voice = (name: string, lang = 'ja-JP') => ({
  name,
  lang,
  localService: true,
})
const pick = (...voices: ReturnType<typeof voice>[]) =>
  pickJapaneseVoice(voices)?.name

describe('pickJapaneseVoice', () => {
  it('picks a female voice over a male one, whatever the order', () => {
    expect(pick(voice('Otoya'), voice('Kyoko'))).toBe('Kyoko')
    expect(pick(voice('Kyoko'), voice('Otoya'))).toBe('Kyoko')
    expect(
      pick(voice('Microsoft Keita Online'), voice('Microsoft Nanami Online')),
    ).toBe('Microsoft Nanami Online')
  })

  it('prefers the most natural female voice of macOS', () => {
    const picked = pick(
      voice('Eddy (日本語（日本）)'),
      voice('Flo (日本語（日本）)'),
      voice('Grandma (日本語（日本）)'),
      voice('Kyoko'),
      voice('Sandy (日本語（日本）)'),
    )
    expect(picked).toBe('Kyoko')
  })

  it('never picks a voice of another language', () => {
    expect(pick(voice('Samantha', 'en-US'), voice('Otoya'))).toBe('Otoya')
    expect(pick(voice('Mei-Jia', 'zh-TW'))).toBeUndefined()
    expect(pick()).toBeUndefined()
  })

  it('prefers an unknown voice to a known male one', () => {
    expect(pick(voice('Otoya'), voice('New Voice'))).toBe('New Voice')
  })

  it('accepts the language tag forms that browsers report', () => {
    expect(pick(voice('Kyoko', 'ja_JP'))).toBe('Kyoko')
    expect(pick(voice('Kyoko', 'ja'))).toBe('Kyoko')
  })
})
