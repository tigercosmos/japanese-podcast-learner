import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

const META = {
  id: 'abcdefghijk',
  url: 'https://www.youtube.com/watch?v=abcdefghijk',
  title: 'テストのポッドキャスト',
  channel: 'テスト放送',
  duration: 65,
  thumbnail: '',
  created_at: 1,
  status: 'ready',
  stage: 'done',
  progress: 1,
  error: '',
  transcript_source: 'youtube',
  counts: { segments: 2, vocabulary: 2, grammar: 1 },
}

const VIDEO = {
  ...META,
  segments: [
    {
      id: 0,
      start: 0,
      end: 3,
      ja: '猫を見てしまいました。',
      zh: '不小心看到貓了。',
      tokens: [
        { s: '猫', f: [['猫', 'ねこ']], v: '猫' },
        { s: 'を' },
        { s: '見', f: [['見', 'み']], v: '見る' },
        { s: 'てしまいました。' },
      ],
      grammar: ['g1'],
    },
    {
      id: 1,
      start: 3,
      end: 6,
      ja: '猫が好きです。',
      zh: '我喜歡貓。',
      tokens: [{ s: '猫', f: [['猫', 'ねこ']], v: '猫' }, { s: 'が好きです。' }],
      grammar: [],
    },
  ],
  vocabulary: [
    {
      id: '猫',
      word: '猫',
      reading: 'ねこ',
      pos: '名詞',
      level: 'N5',
      meaning: '貓',
      usage: '指家貓，也可以泛指貓科動物。',
      example: { ja: '猫を飼っています。', zh: '我有養貓。' },
      count: 2,
      segments: [0, 1],
    },
    {
      id: '見る',
      word: '見る',
      reading: 'みる',
      pos: '一段動詞',
      level: 'N4',
      meaning: '看',
      usage: '用眼睛看的最基本說法。',
      example: { ja: '映画を見る。', zh: '看電影。' },
      count: 1,
      segments: [0],
    },
  ],
  grammar: [
    {
      id: 'g1',
      pattern: '〜てしまう',
      level: 'N4',
      meaning: '不小心做了某事',
      explanation: '表示動作完成，常帶有遺憾或後悔的語感。',
      usage: '動詞て形＋しまう',
      examples: [{ ja: '財布を忘れてしまった。', zh: '我忘了帶錢包。' }],
      occurrences: [{ segment: 0, text: 'てしまいました' }],
    },
  ],
}

async function mockBackend(page: Page) {
  await page.route('**/api/videos', (route) => route.fulfill({ json: [META] }))
  await page.route('**/api/videos/abcdefghijk', (route) =>
    route.fulfill({ json: VIDEO }),
  )
  // The tests must not depend on YouTube being reachable.
  await page.route('https://www.youtube.com/**', (route) => route.abort())
}

test.beforeEach(async ({ page }) => {
  await mockBackend(page)
})

test('the library opens a video in study mode', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('テストのポッドキャスト')).toBeVisible()

  await page.getByRole('link', { name: '先學習' }).click()

  await expect(page).toHaveURL(/\/v\/abcdefghijk\/study$/)
  await expect(page.getByText('指家貓，也可以泛指貓科動物。')).toBeVisible()
  await expect(page.getByText('用眼睛看的最基本說法。')).toBeVisible()
})

test('study mode filters vocabulary and lists grammar', async ({ page }) => {
  await page.goto('/v/abcdefghijk/study')

  await page.getByRole('switch', { name: /N4/ }).click()
  await expect(page.getByText('用眼睛看的最基本說法。')).toBeVisible()
  await expect(page.getByText('指家貓，也可以泛指貓科動物。')).toBeHidden()

  await page.getByRole('button', { name: /^文法/ }).click()
  await expect(page.getByText('動詞て形＋しまう')).toBeVisible()
  await expect(page.locator('mark')).toHaveText('てしまいました')
})

test('watch mode explains a word picked from a sentence', async ({ page }) => {
  await page.goto('/v/abcdefghijk/watch')

  await page.locator('aside [data-word="見る"]').first().click()

  const detail = page.getByTestId('detail')
  await expect(detail.getByText('みる')).toBeVisible()
  await expect(detail.getByText('映画を見る。')).toBeVisible()

  await page.getByRole('button', { name: /〜てしまう/ }).click()
  await expect(detail.getByText('動詞て形＋しまう')).toBeVisible()
})

// A stand-in for the YouTube API that records where the app seeks.
const FAKE_YOUTUBE_API = `
  window.seeks = []
  class Player {
    constructor(element, options) {
      setTimeout(() => {
        options.events.onReady()
        window.playerReady = true
      })
    }
    getCurrentTime() { return window.seeks.at(-1) ?? 0 }
    getPlayerState() { return 2 }
    seekTo(seconds) { window.seeks.push(seconds) }
    playVideo() {}
    pauseVideo() {}
    destroy() {}
  }
  window.YT = { Player }
  window.onYouTubeIframeAPIReady()
`

test('A, S and D move between sentences', async ({ page }) => {
  await page.route('https://www.youtube.com/iframe_api', (route) =>
    route.fulfill({ contentType: 'text/javascript', body: FAKE_YOUTUBE_API }),
  )
  await page.goto('/v/abcdefghijk/watch')
  // Until the player is ready there is nothing to seek.
  await page.waitForFunction('window.playerReady')
  const sentence = page.locator('aside')
  await expect(sentence.getByText('不小心看到貓了。')).toBeVisible()

  await page.keyboard.press('d')
  await expect(sentence.getByText('我喜歡貓。')).toBeVisible()
  await page.keyboard.press('s')
  await page.keyboard.press('a')
  await expect(sentence.getByText('不小心看到貓了。')).toBeVisible()

  expect(await page.evaluate('window.seeks')).toEqual([3, 3, 0])
})

test('the video can be resized and keeps its size', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 800 })
  await page.goto('/v/abcdefghijk/watch')
  const video = page.getByTestId('video-column')
  const handle = page.getByRole('separator')
  const width = async () => (await video.boundingBox())!.width

  const handleBox = (await handle.boundingBox())!
  await page.mouse.move(handleBox.x + 4, handleBox.y + 50)
  await page.mouse.down()
  await page.mouse.move(600, handleBox.y + 50, { steps: 5 })
  await page.mouse.up()

  const resized = await width()
  expect(resized).toBeGreaterThan(550)
  expect(resized).toBeLessThan(620)

  await page.reload()
  expect(await width()).toBe(resized)

  await handle.dblclick()
  expect(await width()).toBeGreaterThan(resized + 100)
})

test('a study sentence links to that moment in watch mode', async ({
  page,
}) => {
  await page.goto('/v/abcdefghijk/study')

  await page.getByRole('button', { name: /我喜歡貓。/ }).click()

  await expect(page).toHaveURL(/\/v\/abcdefghijk\/watch\?t=3$/)
  await expect(page.locator('aside').getByText('我喜歡貓。')).toBeVisible()
})
