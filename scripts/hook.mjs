#!/usr/bin/env node
/**
 * Claude Code 훅 엔트리.
 * - UserPromptSubmit: 프롬프트가 프리픽스로 시작하면 두벌식 역변환 결과를 additionalContext 로 주입한다.
 *   UserPromptSubmit 은 프롬프트 자체를 교체할 수 없어 컨텍스트 주입 방식을 쓴다.
 * - PostToolBatch: Claude 가 작업 중일 때 입력한(큐잉된) 메시지는 UserPromptSubmit 을 타지 않으므로,
 *   툴 배치가 끝나고 다음 모델 호출 직전에 transcript 에서 큐잉된 메시지를 찾아 같은 방식으로 주입한다.
 */

import { DEFAULT_FENCE, handlePrompt } from './convert.mjs'
import { findQueuedPrompts, loadProcessed, readTailLines, saveProcessed } from './queued.mjs'

const readStdin = async () => {
  const chunks = []
  for await (const chunk of process.stdin) chunks.push(chunk)
  return Buffer.concat(chunks).toString('utf8')
}

const buildContext = (converted) =>
  [
    '[dot-gksrmf] Alphabet input has been converted to Hangul and appended.',
    'Treat only the Korean text below as the user request.',
    '',
    converted,
  ].join('\n')

const buildQueuedContext = (convertedList) =>
  [
    '[dot-gksrmf] The message(s) the user sent while you were working have been converted from alphabet to Hangul.',
    'Treat only the Korean text below as those messages.',
    '',
    convertedList.join('\n\n'),
  ].join('\n')

const summarize = (text) => `⌨️: ${text.replace(/\s+/g, ' ').slice(0, 120)}`

const emit = (hookEventName, additionalContext, systemMessage) =>
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName, additionalContext }, systemMessage }))

const convertOptions = () => ({
  prefix: process.env.DOT_HANGUL_PREFIX || undefined,
  fence: process.env.DOT_HANGUL_FENCE || DEFAULT_FENCE,
  preserveTokens: process.env.DOT_HANGUL_PRESERVE_TOKENS !== '0',
})

function onUserPromptSubmit(payload) {
  const result = handlePrompt(payload.prompt, convertOptions())
  if (!result.matched) return
  emit('UserPromptSubmit', buildContext(result.converted), summarize(result.converted))
}

function onPostToolBatch(payload) {
  if (!payload.transcript_path || !payload.session_id) return

  const processed = loadProcessed(payload.session_id)
  const fresh = findQueuedPrompts(readTailLines(payload.transcript_path)).filter((q) => !processed.has(q.key))
  if (!fresh.length) return

  // 변환 대상이 아닌 메시지도 처리됨으로 기록해야 매 배치마다 다시 훑지 않는다.
  saveProcessed(payload.session_id, [...processed, ...fresh.map((q) => q.key)])

  const options = convertOptions()
  const converted = fresh.map((q) => handlePrompt(q.prompt, options)).filter((r) => r.matched).map((r) => r.converted)
  if (!converted.length) return

  emit('PostToolBatch', buildQueuedContext(converted), summarize(converted.join(' / ')))
}

async function main() {
  if (process.env.DOT_HANGUL_DISABLE === '1') return

  const input = await readStdin()
  if (!input.trim()) return

  const payload = JSON.parse(input)
  switch (payload.hook_event_name ?? 'UserPromptSubmit') {
    case 'UserPromptSubmit':
      return onUserPromptSubmit(payload)
    case 'PostToolBatch':
      return onPostToolBatch(payload)
    default:
      return
  }
}

// 훅 실패가 사용자 프롬프트를 막지 않도록 모든 예외를 삼킨다.
main().catch(() => {}).finally(() => process.exit(0))
