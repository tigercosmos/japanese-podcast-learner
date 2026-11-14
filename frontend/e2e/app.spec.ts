import { fileURLToPath } from 'node:url'
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

test('words and example sentences can be read aloud', async ({ page }) => {
  await page.addInitScript(() => {
    const spoken: { text: string; lang: string }[] = []
    Object.assign(window, { spoken })
    Object.defineProperty(window.speechSynthesis, 'speak', {
      value: (utterance: SpeechSynthesisUtterance) =>
        spoken.push({ text: utterance.text, lang: utterance.lang }),
    })
  })
  await page.goto('/v/abcdefghijk/study')

  const card = page.getByRole('listitem').filter({ hasText: '用眼睛看' })
  await card.getByRole('button', { name: '朗讀單字' }).click()
  await card.getByRole('button', { name: '朗讀例句' }).click()

  await page.getByRole('button', { name: /^文法/ }).click()
  await page.getByRole('button', { name: '朗讀例句' }).click()

  expect(await page.evaluate('window.spoken')).toEqual([
    { text: 'みる', lang: 'ja-JP' },
    { text: '映画を見る。', lang: 'ja-JP' },
    { text: '財布を忘れてしまった。', lang: 'ja-JP' },
  ])
})

// A stand-in for the YouTube API that records where the app seeks.
const FAKE_YOUTUBE_API = `
  window.seeks = []
  class Player {
    constructor(element, options) {
      window.startAt = options.playerVars.start
      this.events = options.events
      setTimeout(() => {
        options.events.onReady()
        window.playerReady = true
      })
    }
    getCurrentTime() { return window.seeks.at(-1) ?? 0 }
    getPlayerState() { return 2 }
    seekTo(seconds) { window.seeks.push(seconds) }
    playVideo() { this.events.onStateChange({ data: 1 }) }
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

test('a reload resumes the video where it stopped', async ({ page }) => {
  await page.route('https://www.youtube.com/iframe_api', (route) =>
    route.fulfill({ contentType: 'text/javascript', body: FAKE_YOUTUBE_API }),
  )
  await page.goto('/v/abcdefghijk/watch')
  await page.waitForFunction('window.playerReady')
  expect(await page.evaluate('window.startAt')).toBe(0)

  await page.keyboard.press('d')
  const sentence = page.locator('aside')
  await expect(sentence.getByText('我喜歡貓。')).toBeVisible()
  await page.reload()
  await page.waitForFunction('window.playerReady')

  expect(await page.evaluate('window.startAt')).toBe(3)
  await expect(sentence.getByText('我喜歡貓。')).toBeVisible()
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

  await expect(page.locator('aside').getByText('我喜歡貓。')).toBeVisible()
  // The request is used once, so that a reload resumes and does not jump
  // back to this sentence.
  await expect(page).toHaveURL(/\/v\/abcdefghijk\/watch$/)
})

test('a video that cannot be embedded can be downloaded instead', async ({
  page,
}) => {
  const requests: { url: string; download: boolean }[] = []
  await page.route('**/api/videos', (route) => {
    if (route.request().method() !== 'POST') {
      return route.fulfill({ json: [] })
    }
    const body = route.request().postDataJSON()
    requests.push(body)
    if (body.download) {
      return route.fulfill({ json: META })
    }
    return route.fulfill({
      status: 400,
      json: { detail: '這部影片不允許在其他網站播放。', code: 'not_embeddable' },
    })
  })
  await page.goto('/')

  await page.getByLabel('YouTube 影片連結').fill(META.url)
  await page.getByRole('button', { name: '開始分析' }).click()
  await expect(page.getByRole('alert')).toHaveText(
    '這部影片不允許在其他網站播放。',
  )
  await page.getByRole('button', { name: '下載影片到本機' }).click()

  await expect(page).toHaveURL(/\/v\/abcdefghijk/)
  expect(requests).toEqual([
    { url: META.url, download: false },
    { url: META.url, download: true },
  ])
})

// Bundled Chromium has no H.264 decoder, so the stand-in file is WebM.
async function mockVideoFile(page: Page) {
  await page.route('**/api/videos/abcdefghijk/file', (route) =>
    route.fulfill({
      contentType: 'video/webm',
      path: fileURLToPath(new URL('fixtures/tiny.webm', import.meta.url)),
    }),
  )
}

test('a downloaded video plays from the local file', async ({ page }) => {
  await page.route('**/api/videos/abcdefghijk', (route) =>
    route.fulfill({ json: { ...VIDEO, local_video: true } }),
  )
  await mockVideoFile(page)
  await page.goto('/v/abcdefghijk/watch')
  const player = page.getByTestId('player').locator('video')
  await expect(player).toHaveAttribute('src', '/api/videos/abcdefghijk/file')
  await expect(page.getByTestId('player').locator('iframe')).toHaveCount(0)
  await expect
    .poll(() => player.evaluate((v: HTMLVideoElement) => v.readyState))
    .toBeGreaterThan(0)

  await page.keyboard.press('d')

  // The shortcuts and the subtitles follow the file as they follow YouTube.
  await expect(page.locator('aside').getByText('我喜歡貓。')).toBeVisible()
  await expect(page.getByTestId('subtitle')).toContainText('我喜歡貓。')
  expect(
    await player.evaluate((v: HTMLVideoElement) => v.currentTime),
  ).toBeGreaterThanOrEqual(3)
})

const BLOCKED_YOUTUBE_API = `
  class Player {
    constructor(element, options) {
      setTimeout(() => options.events.onError({ data: 150 }))
    }
    destroy() {}
  }
  window.YT = { Player }
  window.onYouTubeIframeAPIReady()
`

test('a blocked player offers the download and then plays the file', async ({
  page,
}) => {
  let downloaded = false
  await page.route('https://www.youtube.com/iframe_api', (route) =>
    route.fulfill({
      contentType: 'text/javascript',
      body: BLOCKED_YOUTUBE_API,
    }),
  )
  await page.route('**/api/videos/abcdefghijk', (route) =>
    route.fulfill({ json: { ...VIDEO, local_video: downloaded } }),
  )
  await page.route('**/api/videos/abcdefghijk/download', (route) => {
    downloaded = true
    return route.fulfill({
      json: { ...META, video_download: 'running', video_progress: 0 },
    })
  })
  await mockVideoFile(page)
  await page.goto('/v/abcdefghijk/watch')

  const alert = page.getByRole('alert')
  await expect(alert).toContainText('不允許在 YouTube 以外的網站播放')
  await alert.getByRole('button', { name: '下載影片到本機' }).click()

  await expect(page.getByTestId('player').locator('video')).toBeVisible()
  await expect(alert).toBeHidden()
})
