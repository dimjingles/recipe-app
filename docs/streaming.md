# AI Streaming Pattern

Route handlers return Server-Sent Events from Anthropic streams using `ReadableStream` and `text/event-stream`. Client components consume `response.body.getReader()`, split on double newlines, parse `data: { text }`, and stop on `data: [DONE]`.

Errors are sent as `event: error` with `{ error }` when possible, then the stream closes. Auth failures still return normal JSON 401 responses before streaming starts.
