# dot-gksrmf

한글 자판인 줄 알고 쳤는데 영문으로 나갔을 때, 다시 치지 않고 그대로 보내는 Claude Code 플러그인.

`gksrmf` 는 영문 자판으로 친 `한글` 입니다. 플러그인 이름이 곧 동작 예시입니다.

```
.dlrjs qusghksehlqslek
   -> 이건 변환됩니다
```

## 동작 방식

`UserPromptSubmit` 훅이 프롬프트를 가로채, 점(`.`)으로 시작하는 입력을 두벌식 자판 기준으로 한글로 역변환한 뒤 그 결과를 Claude 의 컨텍스트에 주입합니다. Claude 는 영문 나열 대신 변환된 한글 문장을 요청으로 읽습니다.

점으로 시작하지 않는 프롬프트는 전혀 건드리지 않습니다.

## 설치

```
/plugin marketplace add fronterior/dot-gksrmf
/plugin install dot-gksrmf@fronterior
```

의존성은 없습니다. Node.js 16 이상에서 동작합니다.

## 변환 규칙

기본적으로 문장 전체를 한글로 변환하되, 아래는 영문 원문 그대로 둡니다.

### 코드블록

여는 줄과 닫는 줄을 파이프 세 개(`|||`)로 시작합니다. 뒤에 언어 표기 같은 문자가 붙어도 구분자로 인식하며, 그 줄은 원문 그대로 유지됩니다. 중첩은 지원하지 않아 안쪽에 `|||` 로 시작하는 줄이 나오면 거기서 닫힙니다.

```
.dhkstjd ehlsms zhem

|||js
const a = 0;
|||
```

마크다운 백틱 펜스(```` ``` ````)는 코드 안에서 자주 등장해 오인될 수 있어 쓰지 않습니다. 쉼표 세 개(`,,,`)도 후보였지만 CSV 의 빈 필드 행과 JavaScript 희소 배열에서 실제로 나오는 형태라 제외했습니다. `|||` 는 JavaScript 와 셸 모두에서 문법 오류라 코드 본문에 등장하지 않습니다.

### 인라인 영문

백틱으로 감싸면 그대로 유지됩니다.

```
.`useEffect` sms djswp tlfgodehlsi
   -> `useEffect` 는 언제 실행되냐
```

작은따옴표도 유지되지만, 안에 공백이 없을 때만 적용됩니다. 공백이 있으면 한글 인용문으로 보고 변환합니다.

```
.'js'rkxdms rjs      ->  'js'같은 것
.'dlfjgrp gks'       ->  '이렇게 한'
```

### 자동 보존

아래 형태의 토큰은 표시가 없어도 변환하지 않습니다.

- URL: `https://...`, `www....`
- 경로: 슬래시가 포함되거나 슬래시로 시작하는 토큰
- 플래그: `-` 로 시작하는 토큰
- 파일명: `index.ts`, `package.json` 등 알려진 확장자
- 도메인: `github.com` 등
- `@` 또는 `_` 가 포함된 토큰 (스코프 패키지, snake_case)
- 이미 한글이 섞여 있는 토큰

## 설정

환경 변수로 조정합니다.

| 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `DOT_HANGUL_PREFIX` | `.` | 변환을 발동시키는 프리픽스 |
| `DOT_HANGUL_FENCE` | `\|\|\|` | 코드블록 구분자 |
| `DOT_HANGUL_PRESERVE_TOKENS` | `1` | `0` 이면 자동 보존 규칙을 끄고 전부 변환 |
| `DOT_HANGUL_DISABLE` | - | `1` 이면 훅을 비활성화 |

## 개발

```bash
node --test test/convert.test.mjs
```

테스트 러너(`node --test`)는 Node.js 18 이상이 필요합니다. 훅 실행 자체는 16 이상이면 됩니다.

변환 코어(`scripts/convert.mjs`)는 의존성이 없고 순수 함수로만 이뤄져 있어 단독으로도 쓸 수 있습니다.

```js
import { convertPrompt } from './scripts/convert.mjs'

convertPrompt('gksrmf').converted // '한글'
```

## 라이선스

MIT
