# 일본어 통역 학습 (JP Interpreter)

한국인 일본어 학습자를 위한 **음성 통역 + 학습 웹앱**입니다.
일본어로 말하거나 문장을 입력하면:

- **3단 발음 표기**: 로마자(위) · 일본어 원문(중) · 한글 발음(아래) — 듀오링고 스타일
- **색상 매핑 번역**: 일본어 의미 구간과 한국어 번역 조각을 **같은 색**으로 표시해
  어떤 일본어가 어떤 한국어 뜻인지 한눈에 구분 (마우스를 올리면 상대편도 강조)
- **문법 포인트 해설**: 〜なら, 〜派 같은 문형을 자동 감지해 한국어로 설명
- **어휘장 + SRS 복습**: 단어/문장을 탭해서 저장, SM-2 간격 반복으로 복습
- **발음 따라하기**: TTS로 듣고 → 따라 말하면 → 일치도(%) 채점 + 다른 부분 표시
- **퀴즈 3종**: 빈칸 채우기 · 단어 배열 · 듣기 받아쓰기 (저장한 문장으로 생성, 추가 API 비용 없음)

번역·발음·색상 매핑은 **Claude API**(브라우저 직접 호출)로 수행하며,
분석 결과는 브라우저(IndexedDB)에 캐시되어 같은 문장을 다시 분석할 때 비용이 들지 않습니다.

## 실행 방법

```bash
cd japanese-interpreter
npm install
npm run dev        # http://localhost:5173
```

- **API 키 없이 체험**: 설정 탭 → "목(체험) 모드" 켜기 → 통역 탭의 "✨ 예시 문장 분석해 보기"
- **실제 사용**: [Anthropic 콘솔](https://console.anthropic.com)에서 API 키 발급 → 설정 탭에 입력
  - 키는 이 브라우저의 localStorage에만 저장됩니다 (서버 전송 없음)
  - 모델: Opus 5(최고 품질) / Sonnet 5(균형) / Haiku 4.5(저비용, 일상 학습 권장)

```bash
npm test           # 단위 테스트 (vitest)
npm run build      # 타입체크 + 프로덕션 빌드 (dist/)
```

## 알아두세요 (제약 사항)

| 항목 | 내용 |
|---|---|
| 음성 인식 | Web Speech API — **Chrome/Edge 전용** (Firefox 미지원). Chrome은 음성을 구글 서버로 전송해 처리. 미지원 브라우저에서는 텍스트 입력으로 자동 전환 |
| 마이크 | HTTPS 또는 localhost에서만 동작 |
| TTS | OS의 일본어(ja-JP) 보이스에 의존 — 없으면 듣기 버튼 비활성 (OS 언어팩 설치로 해결) |
| API 키 | 개인 기기 전제. 공용 PC 사용 금지, Anthropic 콘솔에서 지출 한도 설정 권장 |
| 로마자 표기 | 모라 단위 반복 표기 일관 채택 (りょこう → `ryo-ko-o`) — ryokō/ryokou 등 타 교재와 다를 수 있음 |
| 한글 발음 표기 | 교재식 관용 표기(카/타 격음 통일, つ=츠, っ=받침 ㅅ)의 **근사치** — 실제 발음은 듣기·발음 연습으로 |
| 데이터 | 어휘장은 브라우저 IndexedDB에 저장 — 브라우저 데이터 삭제 시 유실될 수 있으니 설정 탭의 JSON 내보내기로 백업 |

## 구조

```
src/
├─ types/analysis.ts      # 분석 결과 Zod 스키마 (API 구조화 출력 + UI 타입의 단일 원천)
├─ api/claude.ts          # Claude API 호출 (messages.parse + 구조화 출력 + 프롬프트 캐싱)
├─ api/validate.ts        # 응답 후검증 (토큰/세그먼트 연결 == 원문) + 실패 시 1회 재시도
├─ api/mockClient.ts      # 목 모드 (fixture 기반, API 키 불필요)
├─ services/              # 순수 로직: SM-2 SRS, 유사도 채점, 퀴즈 생성, 문장 분리, 저장소
├─ hooks/                 # useAnalysis(캐시→API 파이프라인), useSpeechRecognition, useSrsQueue
├─ pages/                 # 통역 / 어휘장 / 복습 / 퀴즈 / 설정
└─ components/            # SentenceCard(3단 루비 + 색상 매핑), 발음 연습, 퀴즈 3종
```

### GitHub Pages 배포 시

`vite.config.ts`의 `base`를 저장소 경로로 변경 후 빌드:

```ts
export default defineConfig({ plugins: [react()], base: "/Test/" });
```
