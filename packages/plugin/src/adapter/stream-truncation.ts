/**
 * pi-ai stream-truncation wordings that are TRANSPORT-grade (issue #103).
 *
 * pi-ai throws these when a provider stream dies before its terminal event:
 * a transport/protocol truncation, not a model refusal. The native
 * dsh-llm-pi-ai adapter classifies the same texts as TRANSPORT (its
 * tests/convert.spec.ts:839-855); this port's classifyError() fell through to
 * the UPSTREAM catch-all, which FREE_LANE_RETRY_POLICY.retryableCodes does
 * not include, so the host's dsh-llm-retry never fired.
 *
 * Dependency-free leaf shared by adapter/events.ts (post-content finish code)
 * and pool/rotate.ts (pre-content rotation) so the two classifiers stay in
 * sync. Enumerated substrings rather than a broad regex: no false positives
 * on unrelated error bodies.
 *
 * Every fragment is grounded in the installed pi-ai dist, throw site file:line
 * for 0.82.1 / 0.87.1 (the @opencode2dsh/pi-ai-0.87 alias) respectively:
 * - 'stream ended without finish_reason'
 *     api/openai-completions.js:438 / :485
 * - 'anthropic stream ended before message_stop'
 *     api/anthropic-messages.js:316 / :330 (also pi-ai's own transient-retry
 *     list, utils/retry.js:63 / :66)
 * - 'stream ended before a terminal response event'
 *     api/openai-responses-shared.js:618 / :657 (retry.js:64 / :67)
 * - 'stream ended without a terminal event'
 *     api/pi-messages.js:290 / :296 — template
 *     `${model.provider} stream ended without a terminal event`, e.g.
 *     "openrouter stream ended without a terminal event"
 * - 'websocket closed'
 *     api/openai-codex-responses.js:928,934 / :969,975 — `WebSocket closed`
 *     plus optional close code/reason; also retry.js:57 / :60 (`websocket.?
 *     closed`). (The issue proposed the exact text "WebSocket closed
 *     unexpectedly", which exists in neither dist; this fragment covers it
 *     and every code/reason-suffixed variant of the real throw.)
 * - 'websocket stream closed before response.completed'
 *     api/openai-codex-responses.js:1054 / :1095
 * - 'other side closed'
 *     undici SocketError throw site lib/dispatcher/client-h1.js:999 and
 *     client-h2.js:762 (in node_modules/undici); also pi-ai's transient list
 *     utils/retry.js:44 / :47
 * - 'http2 request did not get a response'
 *     pi-ai's transient list utils/retry.js:65 / :68 (pi-ai #3594); the throw
 *     site IS in this repo's graph — @smithy/node-http-handler
 *     dist-cjs/index.js:816,830,833 (Bedrock/Smithy HTTP/2 no-response,
 *     "Unexpected error: http2 request did not get a response").
 * - 'stream ended without a stop reason' / 'stream ended without a finish reason'
 *     0.87.1-only family (absent in the pinned 0.82.1 dist, verified by
 *     sweep): anthropic-messages.js:606, openai-responses.js:138,
 *     azure-openai-responses.js:99, bedrock-converse-stream.js:218,
 *     google-generative-ai.js:209, google-vertex.js:211,
 *     mistral-conversations.js:42, openai-codex-responses.js:43 — carried so
 *     the next pi-ai bump cannot silently regress these paths to UPSTREAM.
 */
const STREAM_TRUNCATION_FRAGMENTS: readonly string[] = [
  'stream ended without finish_reason',
  'anthropic stream ended before message_stop',
  'stream ended before a terminal response event',
  'stream ended without a terminal event',
  'websocket closed',
  'websocket stream closed before response.completed',
  'other side closed',
  'http2 request did not get a response',
  'stream ended without a stop reason',
  'stream ended without a finish reason',
]

/** True when the (any-case) error text names a transport-grade truncation. */
export function isStreamTruncation(text: string): boolean {
  const lowered = text.toLowerCase()
  return STREAM_TRUNCATION_FRAGMENTS.some((fragment) => lowered.includes(fragment))
}
