import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const TAIL_BYTES = 2 * 1024 * 1024
const STATE_LIMIT = 200

/**
 * transcript 는 세션이 길어지면 수십 MB 가 되므로 끝부분만 읽는다.
 * 중간부터 읽으면 첫 줄이 잘려 있을 수 있어 버린다.
 */
export function readTailLines(file, bytes = TAIL_BYTES) {
  let fd
  try {
    fd = fs.openSync(file, 'r')
    const size = fs.fstatSync(fd).size
    const start = Math.max(0, size - bytes)
    const buf = Buffer.alloc(size - start)
    fs.readSync(fd, buf, 0, buf.length, start)
    const lines = buf.toString('utf8').split('\n')
    if (start > 0) lines.shift()
    return lines
  } catch {
    return []
  } finally {
    if (fd !== undefined) fs.closeSync(fd)
  }
}

const isPromptEntry = (entry) => {
  if (entry.type !== 'user' || entry.isMeta) return false
  const content = entry.message?.content
  if (typeof content === 'string') return true
  return Array.isArray(content) && !content.some((block) => block?.type === 'tool_result')
}

/**
 * Claude 가 작업 중일 때 입력한 메시지는 UserPromptSubmit 을 거치지 않고
 * `queue-operation`(enqueue) 으로 transcript 에 먼저 기록된 뒤 다음 툴 결과에 붙어 전달된다.
 * 현재 턴(마지막 유저 프롬프트 이후)에 큐잉된 메시지를 순서대로 돌려준다.
 * @returns {{ key: string, prompt: string }[]}
 */
export function findQueuedPrompts(lines) {
  let found = []
  for (const line of lines) {
    if (!line) continue
    let entry
    try {
      entry = JSON.parse(line)
    } catch {
      continue
    }
    if (isPromptEntry(entry)) {
      found = []
      continue
    }
    if (entry.type === 'queue-operation' && entry.operation === 'enqueue' && typeof entry.content === 'string') {
      found.push({ key: `${entry.timestamp}|${entry.content}`, prompt: entry.content })
    }
  }
  return found
}

const stateFile = (sessionId) => path.join(os.tmpdir(), 'dot-gksrmf', `${sessionId}.json`)

/** PostToolBatch 는 턴 안에서 여러 번 발화하므로 이미 변환한 메시지는 세션별 파일로 기억한다. */
export function loadProcessed(sessionId) {
  try {
    return new Set(JSON.parse(fs.readFileSync(stateFile(sessionId), 'utf8')))
  } catch {
    return new Set()
  }
}

export function saveProcessed(sessionId, keys) {
  const file = stateFile(sessionId)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify([...keys].slice(-STATE_LIMIT)))
}
