import assert from 'node:assert/strict'
import test from 'node:test'
import { convertPrompt, handlePrompt } from '../scripts/convert.mjs'

const conv = (s) => convertPrompt(s).converted

test('기본 음절 조합', () => {
  assert.equal(conv('dkssudgktpdy'), '안녕하세요')
  assert.equal(conv('gksrmf'), '한글')
  assert.equal(conv('skfTl'), '날씨')
})

test('복합 모음', () => {
  assert.equal(conv('rhkdlf'), '과일')
  assert.equal(conv('dmlwk'), '의자')
  assert.equal(conv('dnjsdnjs'), '원원')
  assert.equal(conv('dnleh'), '위도')
  assert.equal(conv('dhlrhk'), '외과')
  assert.equal(conv('dhoworkd'), '왜재강')
})

test('겹받침과 받침 이동', () => {
  assert.equal(conv('djqtek'), '없다')
  assert.equal(conv('dkswek'), '앉다')
  assert.equal(conv('qkfrrp'), '밝게')
  assert.equal(conv('tlfgek'), '싫다')
  assert.equal(conv('rkqtdms'), '값은')
})

test('된소리(shift) 입력', () => {
  assert.equal(conv('EhEhgo'), '또또해')
  assert.equal(conv('QkfrkTek'), '빨갔다')
})

test('문장부호와 숫자는 그대로 통과', () => {
  assert.equal(conv('dkssud, 2026sus!'), '안녕, 2026년!')
})

test('백틱 인라인은 원문 유지', () => {
  assert.equal(conv('`js` sms rmsprkxdms'), '`js` 는 그네같은')
  assert.equal(conv('zhemsms `const a = 0` dlek'), '코드는 `const a = 0` 이다')
})

test('공백 없는 작은따옴표는 원문 유지, 공백이 있으면 인용문으로 보고 변환', () => {
  assert.equal(conv("'js'rkxdms"), "'js'같은")
  assert.equal(conv("'dlfjrp' gks"), "'dlfjrp' 한")
  assert.equal(conv("'dlfjgrp gks'"), "'이렇게 한'")
})

test('코드블록 펜스 내부는 원문 유지', () => {
  const input = ['zhemqmffhr', '|||', 'const a = 0;', '|||', 'dlek'].join('\n')
  const expected = ['코드블록', '|||', 'const a = 0;', '|||', '이다'].join('\n')
  assert.equal(conv(input), expected)
})

test('쉼표가 든 데이터를 넣어도 펜스가 조기 종료되지 않음', () => {
  const input = ['zhem', '|||', 'a,b,c,d', ',,,', '1,2,3,4', '|||', 'gksrmf'].join('\n')
  const expected = ['코드', '|||', 'a,b,c,d', ',,,', '1,2,3,4', '|||', '한글'].join('\n')
  assert.equal(conv(input), expected)
})

test('펜스 뒤에 문자가 붙어도 구분자로 인식', () => {
  const input = ['zhem', '|||js', 'const a = 0;', '|||', 'gksrmf'].join('\n')
  const expected = ['코드', '|||js', 'const a = 0;', '|||', '한글'].join('\n')
  assert.equal(conv(input), expected)
})

test('닫는 펜스 뒤에 문자가 붙어도 인식하며 펜스 줄은 원문 유지', () => {
  const input = ['zhem', '||| python', 'x = 1', '||| end', 'gksrmf'].join('\n')
  const expected = ['코드', '||| python', 'x = 1', '||| end', '한글'].join('\n')
  assert.equal(conv(input), expected)
})

test('펜스 내부의 영타는 변환되지 않고 바깥만 변환', () => {
  const input = ['|||ts', 'const gksrmf = 1', '|||', 'gksrmf'].join('\n')
  const expected = ['|||ts', 'const gksrmf = 1', '|||', '한글'].join('\n')
  assert.equal(conv(input), expected)
})

test('URL·경로·플래그·파일명 토큰 보존', () => {
  assert.equal(conv('https://github.com/foo rhkswjd'), 'https://github.com/foo 관정')
  assert.equal(conv('src/index.ts vkdlf'), 'src/index.ts 파일')
  assert.equal(conv('--verbose dhqtus'), '--verbose 옵션')
  assert.equal(conv('package.json dmf'), 'package.json 을')
  assert.equal(conv('foo_bar sms'), 'foo_bar 는')
})

test('이미 한글이 섞인 토큰은 건드리지 않음', () => {
  assert.equal(conv('한글abc'), '한글abc')
})

test('handlePrompt 는 프리픽스가 있을 때만 동작', () => {
  assert.equal(handlePrompt('dkssudgktpdy').matched, false)
  assert.equal(handlePrompt('.dkssudgktpdy').converted, '안녕하세요')
  assert.equal(handlePrompt('.12345').matched, false)
  assert.equal(handlePrompt('.한글 그대로').matched, false)
})

test('여러 줄 입력 처리', () => {
  const input = ['.gks', 'en', 'tpt'].join('\n')
  assert.equal(handlePrompt(input).converted, ['한', '두', '셋'].join('\n'))
})
