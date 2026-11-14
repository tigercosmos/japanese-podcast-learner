import { playerErrorMessage } from './youtube'

describe('playerErrorMessage', () => {
  it('names the block on other sites, which a download gets around', () => {
    expect(playerErrorMessage(101)).toContain('不允許在 YouTube 以外')
    expect(playerErrorMessage(150)).toBe(playerErrorMessage(101))
  })

  it('keeps the code of an error it does not know', () => {
    expect(playerErrorMessage(5)).toContain('5')
    expect(playerErrorMessage(100)).not.toBe(playerErrorMessage(5))
  })
})
