# 00 — Shared AI Infrastructure

**Build this first.** Every AI feature in this backlog depends on the foundations
established here. Building them now means each subsequent feature spec can import
from one place rather than inventing its own streaming / model setup.

---

## Summary

Add a `SONNET` model constant to the shared Anthropic client, introduce the app's first
streaming pattern (SSE route handler + client `getReader()` consumer), and standardize
JSON extraction across all existing AI routes on the helpers that already exist but are
currently unused.

---

## User story

There is no user-facing UI for this feature. It is an infrastructure task. The observable
outcome is that later features (Chef AI chat, recommendations) stream tokens to the UI in
real time rather than waiting for a full response before rendering anything.

---

## Product considerations

- All current AI routes use `claude-haiku-4-5-20251001` for cost efficiency. Chat and
  skill coaching require stronger reasoning — `claude-sonnet-4-6` is the right upgrade
  for those features. Haiku stays for short classification tasks (ingredient
  categorization, technique tagging, difficulty inference).
- Streaming is the expected UX for chat. A non-streaming chat would feel unresponsive
  because Haiku/Sonnet responses for multi-step guidance can take 3–8 seconds.
- This is a **modified Next.js 16.2.9** — read the relevant guides before writing any
  streaming route or server action:
  - `node_modules/next/dist/docs/01-app/02-guides/streaming.md`
  - `node_modules/next/dist/docs/01-app/02-guides/ai-agents.md`
  - `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`

---

## DB changes

None.

---

## API / server work

### 1. Add `SONNET` constant to `src/lib/anthropic.ts`

```ts
export const SONNET = 'claude-sonnet-4-6'
```

Do not hard-code model IDs in individual route files — always import from here.

### 2. Establish the streaming route pattern

Create a reference implementation at `src/app/api/ai/stream-example/route.ts` (or just
document the pattern inline in this spec — it will be instantiated first by
`01-chef-ai-chat.md`). The pattern:

**Server (route handler):**
```ts
import { anthropic, SONNET } from '@/lib/anthropic'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  // ... build messages array ...

  const stream = await anthropic.messages.stream({
    model: SONNET,
    max_tokens: 2048,
    messages: body.messages,
    system: body.system,
  })

  // Return a ReadableStream that forwards text deltas as SSE
  const readable = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      for await (const event of stream) {
        if (
          event.type === 'content_block_delta' &&
          event.delta.type === 'text_delta'
        ) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`))
        }
      }
      controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      controller.close()
    },
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
```

**Client consumer (inside a `'use client'` component):**
```ts
const res = await fetch('/api/recipes/[id]/chat', { method: 'POST', body: JSON.stringify(payload) })
const reader = res.body!.getReader()
const decoder = new TextDecoder()
let buffer = ''

while (true) {
  const { done, value } = await reader.read()
  if (done) break
  buffer += decoder.decode(value, { stream: true })
  const lines = buffer.split('\n\n')
  buffer = lines.pop() ?? ''
  for (const line of lines) {
    if (!line.startsWith('data: ')) continue
    const data = line.slice(6)
    if (data === '[DONE]') return
    const { text } = JSON.parse(data)
    setMessages(prev => /* append text to last assistant message */)
  }
}
```

Verify the exact SSE / `ReadableStream` API against the modified-Next streaming guide
before shipping — conventions may differ from standard Next.

### 3. Standardize JSON extraction on existing helpers

`src/lib/anthropic.ts` already exports `extractJsonObject` and `extractJsonArray` but no
existing route imports them — each re-implements `.match(/\{[\s\S]*\}/)` inline. On the
next pass through any AI route, swap the inline match for the helper. Not a blocking
requirement for new features, but note it as a cleanup target.

---

## UI work

None for this infrastructure feature.

---

## Reuse pointers

| What | Where |
|------|-------|
| Shared Anthropic client + `HAIKU` constant | `src/lib/anthropic.ts` |
| Server Supabase client (for auth-gating) | `src/lib/supabase/server.ts` |
| `extractJsonObject` / `extractJsonArray` helpers | `src/lib/anthropic.ts` |
| Existing non-streaming AI route (reference) | `src/app/api/recipes/generate-instructions/route.ts` |
| Modified-Next streaming guide | `node_modules/next/dist/docs/01-app/02-guides/streaming.md` |
| Modified-Next AI agents guide | `node_modules/next/dist/docs/01-app/02-guides/ai-agents.md` |

---

## Open questions

- Does the modified Next 16 SSE streaming pattern use `ReadableStream` + `text/event-stream`
  as shown above, or does it use a different primitive? Read the modified-Next
  `streaming.md` before implementing.
- Should streaming errors send an `event: error` SSE line, or close the stream and let
  the client handle? Establish a consistent convention here.

---

## Acceptance criteria

- [ ] `src/lib/anthropic.ts` exports `SONNET = 'claude-sonnet-4-6'` alongside `HAIKU`.
- [ ] A streaming route handler can be instantiated and tested (simplest test: call it
  with a short prompt and observe streamed tokens arriving in the client).
- [ ] No existing AI routes are broken (they still import `HAIKU` and call
  `anthropic.messages.create` identically).
- [ ] The streaming pattern is documented in this spec (or a shared `docs/streaming.md`)
  clearly enough that `01-chef-ai-chat.md` can follow it without re-deriving.
- [ ] `.env.local.example` is updated to note that `ANTHROPIC_API_KEY` must be set.
  (The live key currently committed should be rotated and moved out of git history.)
