import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { canonicalSessionID, deriveRequestIDs } from '../src/adapter/ids.ts'

// OpenCode schema/src/identifier.ts emits six big-endian bytes from the
// descending timestamp. Compare exact bytes, including the 48-bit wrap.
function upstreamTimeHex(timestamp: number): string {
  const value = ~(BigInt(timestamp) * 0x1000n + 1n)
  return Array.from({ length: 6 }, (_, index) =>
    Number((value >> BigInt(40 - 8 * index)) & 0xffn).toString(16).padStart(2, '0'),
  ).join('')
}

test('session time matches OpenCode byte encoding for fixed clocks (#62)', (t) => {
  for (const clock of [0, 1, 1_000_000_000_000, 1_791_884_044_070]) {
    t.mock.method(Date, 'now', () => clock)
    const session = canonicalSessionID(`timestamp-vector-${clock}`)
    assert.match(session, /^ses_[0-9a-f]{12}[0-9A-Za-z]{14}$/)
    assert.equal(session.slice(4, 16), upstreamTimeHex(clock))
    t.mock.restoreAll()
  }
})

test('the old digest field was shape-valid but did not carry the clock/counter', (t) => {
  const clock = 1_791_884_044_070
  t.mock.method(Date, 'now', () => clock)
  const signal = '"hello"'
  const oldHex = createHash('sha256').update('ses\x00' + signal).digest().subarray(0, 6).toString('hex')
  assert.notEqual(oldHex, upstreamTimeHex(clock))
  assert.notEqual((~BigInt('0x' + oldHex)) & 0xfffn, 1n)
  assert.equal(canonicalSessionID(signal).slice(4, 16), upstreamTimeHex(clock))
})

test('retry and later turns keep the session when the wall clock advances', (t) => {
  let clock = 1_791_884_044_070
  t.mock.method(Date, 'now', () => clock)
  const messages = [{ role: 'user', content: 'session-timestamp-multi-turn' }]
  const first = deriveRequestIDs(messages)
  clock += 5_000
  const retry = deriveRequestIDs(messages)
  const later = deriveRequestIDs([...messages, { role: 'assistant', content: 'OK' }, { role: 'user', content: 'next' }])
  assert.equal(retry.session, first.session)
  assert.equal(later.session, first.session)
  assert.notEqual(retry.request, first.request)
  assert.notEqual(later.request, first.request)
})

test('different conversations minted in one millisecond have different sessions', (t) => {
  t.mock.method(Date, 'now', () => 1_791_884_044_070)
  const first = canonicalSessionID('same-ms-conversation-a')
  const second = canonicalSessionID('same-ms-conversation-b')
  assert.equal(first.slice(4, 16), second.slice(4, 16))
  assert.notEqual(first, second)
})

test('the session memo evicts old entries at its bound and retains recent ones', (t) => {
  let clock = 1_791_884_044_070
  t.mock.method(Date, 'now', () => clock)
  const first = canonicalSessionID('memo-oldest-conversation')
  let newest = ''
  for (let i = 0; i < 1024; i++) newest = canonicalSessionID(`memo-fill-${i}`)
  clock += 5_000
  assert.equal(canonicalSessionID('memo-fill-1023'), newest)
  assert.notEqual(canonicalSessionID('memo-oldest-conversation'), first)
})
