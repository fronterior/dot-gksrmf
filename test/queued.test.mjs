import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { findQueuedPrompts, readTailLines } from '../scripts/queued.mjs'

const j = (o) => JSON.stringify(o)
const prompt = (text) => j({ type: 'user', message: { role: 'user', content: text } })
const toolResult = () => j({ type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'x', content: 'ok' }] } })
const meta = (text) => j({ type: 'user', isMeta: true, message: { role: 'user', content: text } })
const enqueue = (content, ts) => j({ type: 'queue-operation', operation: 'enqueue', content, timestamp: ts })
const remove = (content, ts) => j({ type: 'queue-operation', operation: 'remove', content, timestamp: ts })
const assistant = () => j({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_use', name: 'Bash', input: {} }] } })

test('현재 턴에 큐잉된 메시지를 순서대로 찾는다', () => {
  const lines = [
    prompt('.first'),
    enqueue('.stale', 't0'),
    prompt('.second'),
    assistant(),
    enqueue('.a', 't1'),
    meta('caveat'),
    enqueue('.b', 't2'),
    toolResult(),
  ]
  assert.deepEqual(findQueuedPrompts(lines), [
    { key: 't1|.a', prompt: '.a' },
    { key: 't2|.b', prompt: '.b' },
  ])
})

test('remove 가 기록돼도 같은 배치 안에서는 그대로 돌려준다 (중복 제거는 processed 상태가 담당)', () => {
  const lines = [prompt('q'), enqueue('.a', 't1'), remove('.a', 't2')]
  assert.deepEqual(findQueuedPrompts(lines), [{ key: 't1|.a', prompt: '.a' }])
})

test('깨진 줄과 빈 줄은 무시한다', () => {
  const lines = ['', '{broken', prompt('q'), 'not json', enqueue('.a', 't1'), '']
  assert.deepEqual(findQueuedPrompts(lines), [{ key: 't1|.a', prompt: '.a' }])
})

test('readTailLines 는 끝부분만 읽고 잘린 첫 줄을 버린다', () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'dot-gksrmf-')), 't.jsonl')
  const rows = Array.from({ length: 50 }, (_, i) => enqueue(`.m${i}`, `t${i}`))
  fs.writeFileSync(file, [prompt('q'), ...rows].join('\n') + '\n')
  const tail = readTailLines(file, 300)
  assert.ok(tail.length > 1)
  assert.ok(tail.every((l) => l === '' || l.startsWith('{')))
  assert.equal(readTailLines(file, 1 << 20).length, 52)
  assert.deepEqual(readTailLines('/nonexistent/path.jsonl'), [])
})
