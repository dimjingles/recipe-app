/**
 * Manual integration test for the video import pipeline (no dev server or
 * auth needed — exercises src/lib/import/video.ts directly, plus the Haiku
 * extraction step when ANTHROPIC_API_KEY is set).
 *
 *   node --env-file=.env.local scripts/test-video-import.mts <video-url>
 *
 * `.mts` on purpose: Node 24 runs it natively (type stripping), while the
 * project's tsc include globs (**\/*.ts) skip it.
 */

import {
  classifyVideoUrl,
  getYouTubeVideoId,
  fetchVideoContext,
  buildVideoContextText,
  videoExtractionPrompt,
  hasRecipeText,
  VideoImportError,
} from '../src/lib/import/video.ts'

function check(label: string, actual: unknown, expected: unknown) {
  const ok = actual === expected
  console.log(`${ok ? '  ✓' : '  ✗'} ${label}: ${JSON.stringify(actual)}${ok ? '' : ` (expected ${JSON.stringify(expected)})`}`)
  if (!ok) process.exitCode = 1
}

// ── URL classification unit checks ───────────────────────────────────────────
console.log('URL classification:')
const cases: Array<[string, string | null]> = [
  ['https://www.youtube.com/watch?v=4h4nP40C0io', 'youtube'],
  ['https://youtu.be/4h4nP40C0io?si=abc', 'youtube'],
  ['https://m.youtube.com/watch?v=4h4nP40C0io', 'youtube'],
  ['https://www.youtube.com/shorts/4h4nP40C0io', 'youtube'],
  ['https://www.tiktok.com/@user/video/7301234567890123456', 'tiktok'],
  ['https://vm.tiktok.com/ZMabcdef/', 'tiktok'],
  ['https://www.instagram.com/reel/C0abcDEfGH1/', 'instagram'],
  ['https://www.instagram.com/p/C0abcDEfGH1/?igsh=xyz', 'instagram'],
  ['https://www.seriouseats.com/pasta-recipe', null],
  ['https://notyoutube.com/watch?v=x', null],
]
for (const [raw, expected] of cases) check(raw, classifyVideoUrl(new URL(raw)), expected)

console.log('YouTube id extraction:')
check('watch?v=', getYouTubeVideoId(new URL('https://www.youtube.com/watch?v=4h4nP40C0io')), '4h4nP40C0io')
check('youtu.be', getYouTubeVideoId(new URL('https://youtu.be/4h4nP40C0io?si=x')), '4h4nP40C0io')
check('shorts', getYouTubeVideoId(new URL('https://www.youtube.com/shorts/4h4nP40C0io')), '4h4nP40C0io')
check('playlist (none)', getYouTubeVideoId(new URL('https://www.youtube.com/playlist?list=PL123')), null)

// ── Live context fetch + extraction ──────────────────────────────────────────
const target = process.argv[2]
if (!target) {
  console.log('\nNo URL argument — skipping live fetch/extraction test.')
  process.exit()
}

const url = new URL(target)
const platform = classifyVideoUrl(url)
if (!platform) throw new Error('URL is not a supported video platform')

console.log(`\nFetching ${platform} context for ${target} …`)
try {
  const ctx = await fetchVideoContext(platform, url)
  console.log('  title      :', ctx.title)
  console.log('  author     :', ctx.author)
  console.log('  description:', ctx.description ? `${ctx.description.length} chars — ${JSON.stringify(ctx.description.slice(0, 120))}…` : '(none)')
  console.log('  transcript :', ctx.transcript ? `${ctx.transcript.length} chars — ${JSON.stringify(ctx.transcript.slice(0, 120))}…` : '(none)')
  console.log('  imageUrl   :', ctx.imageUrl)
  console.log('  hasRecipeText:', hasRecipeText(ctx))

  if (!process.env.ANTHROPIC_API_KEY) {
    console.log('\nANTHROPIC_API_KEY not set — skipping extraction step.')
    process.exit()
  }

  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  const anthropic = new Anthropic()
  const prompt = videoExtractionPrompt(buildVideoContextText(ctx))
  console.log(`\nRunning Haiku extraction (prompt ${prompt.length} chars) …`)
  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 3000,
    messages: [{ role: 'user', content: prompt }],
  })
  const c = msg.content[0]
  if (c.type !== 'text') throw new Error('Unexpected AI response')
  const jsonMatch = c.text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Could not parse AI response')
  console.log(JSON.stringify(JSON.parse(jsonMatch[0]), null, 2))
} catch (err) {
  if (err instanceof VideoImportError) {
    console.log('  → VideoImportError (graceful fallback path)')
    console.log('    hint:', err.hint)
  } else {
    throw err
  }
}
