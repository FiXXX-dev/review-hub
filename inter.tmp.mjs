import { chromium } from 'playwright'
const OUT = '/tmp/claude-0/-home-user-Casting-BOT/8efc8d03-d87a-55a2-9c0e-bd33279ac305/scratchpad'
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const results = []
const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 2 })
const page = await ctx.newPage()
page.on('pageerror', (e) => results.push('PAGEERROR: ' + e.message))
await page.goto('http://localhost:4173/review-hub/')
await page.waitForSelector('.lp-tag')

// reveal при скролле
await page.locator('.lp-trump').scrollIntoViewIfNeeded()
await page.waitForTimeout(900)
const inCount = await page.locator('.lp-reveal.in').count()
const total = await page.locator('.lp-reveal').count()
results.push(`reveal: ${inCount}/${total} видимых секций проявились`)

// звёзды козыря: 2★ → правая колонка активна, левая тускнеет
await page.click('.lp-tstar >> nth=1')
await page.waitForTimeout(500)
results.push('2★ dim good col: ' + ((await page.locator('.lp-trump-col.dim').count()) === 1 ? 'OK' : 'FAIL'))
results.push('caption: ' + (await page.textContent('.lp-trump-caption')))
await page.screenshot({ path: `${OUT}/trump-bad.png`, clip: { x: 0, y: 0, width: 1280, height: 860 } })

// 5★
await page.click('.lp-tstar >> nth=4')
await page.waitForTimeout(500)
results.push('5★ caption: ' + (await page.textContent('.lp-trump-caption')))
await page.screenshot({ path: `${OUT}/trump-good.png` })
console.log(results.join('\n'))
await browser.close()
