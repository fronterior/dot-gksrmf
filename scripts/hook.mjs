#!/usr/bin/env node
/**
 * Claude Code UserPromptSubmit 훅 엔트리.
 * 프롬프트가 프리픽스로 시작하면 두벌식 역변환 결과를 additionalContext 로 주입한다.
 * UserPromptSubmit 은 프롬프트 자체를 교체할 수 없어 컨텍스트 주입 방식을 쓴다.
 */

import { DEFAULT_FENCE, handlePrompt } from './convert.mjs'

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

async function main() {
  if (process.env.DOT_HANGUL_DISABLE === '1') return

  const input = await readStdin()
  if (!input.trim()) return

  const payload = JSON.parse(input)
  if (payload.hook_event_name && payload.hook_event_name !== 'UserPromptSubmit') return

  const fence = process.env.DOT_HANGUL_FENCE || DEFAULT_FENCE
  const result = handlePrompt(payload.prompt, {
    prefix: process.env.DOT_HANGUL_PREFIX || undefined,
    fence,
    preserveTokens: process.env.DOT_HANGUL_PRESERVE_TOKENS !== '0',
  })
  if (!result.matched) return

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'UserPromptSubmit',
        additionalContext: buildContext(result.converted),
      },
      systemMessage: `⌨️: ${result.converted.replace(/\s+/g, ' ').slice(0, 120)}`,
    }),
  )
}

// 훅 실패가 사용자 프롬프트를 막지 않도록 모든 예외를 삼킨다.
main().catch(() => {}).finally(() => process.exit(0))
