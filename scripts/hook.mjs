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

const buildContext = (converted, fence) =>
  [
    '[dot-gksrmf] 사용자가 한글 자판 상태를 확인하지 않고 영문으로 입력했습니다.',
    '위 프롬프트의 영문 문자열은 실제 영어가 아니라 한글 오타이며, 의도한 내용은 다음과 같습니다.',
    '아래 한글 문장만을 사용자의 요청으로 간주해 응답하세요. 원문 영문 나열은 무시합니다.',
    ...(converted.includes(fence)
      ? [
          `${fence} 로 감싼 구간은 이 도구가 변환하지 않고 넘긴 코드 원문입니다.`,
          '마크다운 문법이 아니라 이 도구의 구분자이므로, 백틱을 쓰라는 안내를 하지 마세요.',
        ]
      : []),
    '',
    '--- 변환된 사용자 입력 ---',
    converted,
    '--- 변환 끝 ---',
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
        additionalContext: buildContext(result.converted, fence),
      },
      systemMessage: `⌨️  한글 변환: ${result.converted.replace(/\s+/g, ' ').slice(0, 120)}`,
    }),
  )
}

// 훅 실패가 사용자 프롬프트를 막지 않도록 모든 예외를 삼킨다.
main().catch(() => {}).finally(() => process.exit(0))
