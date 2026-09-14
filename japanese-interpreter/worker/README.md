# 젠지 API 프록시 (Cloudflare Worker) 설치 — 약 5분

배포된 사이트에 API 키를 넣지 않고 사용하기 위한 프록시입니다.
키는 Worker(서버)의 시크릿에만 저장되고, 접속 비밀번호를 아는 사람만 쓸 수 있습니다.

## 방법 A: 대시보드에서 (권장, CLI 불필요)

1. https://dash.cloudflare.com 가입/로그인 (무료 플랜이면 충분 — 일 10만 요청)
2. 왼쪽 메뉴 **Workers & Pages** → **Create** → **Create Worker**
   - 이름: `zenji-proxy` → **Deploy** (기본 코드로 일단 배포됨)
3. **Edit code** → 기본 코드를 전부 지우고 이 폴더의 `worker.js` 내용을 붙여넣기 → **Deploy**
4. Worker 화면 → **Settings** → **Variables and Secrets** 에서 추가:
   | 이름 | 타입 | 값 |
   |---|---|---|
   | `ANTHROPIC_API_KEY` | **Secret** | `sk-ant-...` (본인 API 키) |
   | `ACCESS_PASSWORD` | **Secret** | 원하는 접속 비밀번호 (길고 추측 어려운 문자열) |
   | `ALLOWED_ORIGINS` | Text | `https://kimdoyun0806.github.io,http://localhost:5173` |
   | `USER_CODES` | Text | 이용 코드 목록, 쉼표 구분 (예: `minsu,younghee,jiho`) |
   | `ADMIN_CODE` | **Secret** | 관리자용 코드 (무제한 — 다른 코드와 겹치지 않게) |
   | `DAILY_LIMIT` | Text | 코드당 하루 분석 횟수 (예: `10`) |

4-1. **일일 제한용 KV 저장소 연결** (이게 없으면 제한 없이 동작):
   1. 대시보드 왼쪽 **Storage & Databases → KV** → **Create namespace** → 이름 `zenji-usage`
   2. Worker → **Settings → Bindings** → **Add** → **KV Namespace**
      - Variable name: `USAGE` (정확히 이 이름)
      - KV namespace: `zenji-usage` 선택 → 저장(Deploy)
5. Worker URL 확인 (예: `https://zenji-proxy.<계정>.workers.dev`)
6. 젠지 앱 → 설정 탭 → **프록시 모드**에 Worker URL과 접속 비밀번호 입력 → 끝!
   (이후 API 키 입력은 필요 없음)

## 방법 B: wrangler CLI

```bash
cd japanese-interpreter/worker
npx wrangler login
npx wrangler deploy
npx wrangler secret put ANTHROPIC_API_KEY   # 키 입력
npx wrangler secret put ACCESS_PASSWORD     # 비밀번호 입력
```

## 동작 확인

```bash
curl -s https://zenji-proxy.<계정>.workers.dev/v1/messages \
  -X POST -H "x-access-password: 비밀번호" -H "content-type: application/json" \
  -H "Origin: https://kimdoyun0806.github.io" \
  -d '{"model":"claude-haiku-4-5","max_tokens":10,"messages":[{"role":"user","content":"hi"}]}'
```
JSON 응답이 오면 성공. `401`이면 비밀번호, `403`이면 ALLOWED_ORIGINS 확인.

## 공용 사이트로 쓰기 (방문자 설정 불필요)

Worker 설치 후, GitHub 저장소에 변수 2개를 넣으면 배포 사이트에 프록시가 내장되어
**모든 방문자가 아무 설정 없이 바로 사용**할 수 있습니다:

1. GitHub 저장소 → **Settings** → **Secrets and variables** → **Actions** → **Variables** 탭
2. **New repository variable** 로 2개 추가:
   | Name | Value |
   |---|---|
   | `ZENJI_PROXY_URL` | `https://zenji-proxy.<계정>.workers.dev` |
   | `ZENJI_PROXY_PASSWORD` | Worker의 ACCESS_PASSWORD와 같은 값 |
3. **Actions** 탭 → "Deploy to GitHub Pages" → **Run workflow** (또는 아무 커밋 푸시)
4. 배포 후 설정 탭에 "✅ 이 사이트는 내장 프록시로 동작합니다" 표시 확인

⚠️ 이렇게 하면 사이트 방문자 전원이 내 크레딧으로 API를 씁니다.
Worker에 모델·토큰 상한 가드가 있지만, **Anthropic 콘솔 지출 한도 설정은 필수**입니다.
사이트 주소를 공개된 곳에 올리지 말고 스터디원에게만 공유하세요.

## 로그인·일일 제한 동작 방식

- 사이트 첫 접속 시 **이용 코드** 입력 화면이 나옵니다. `USER_CODES`에 있는 코드만 통과.
- 코드별로 **하루 `DAILY_LIMIT`회(기본 10) 문장 분석** 가능. 한→일 번역·손글씨 인식 등
  부가 호출은 횟수에 포함되지 않습니다. 자정(KST) 리셋.
- `ADMIN_CODE`로 입력하면 **무제한** + 헤더에 "관리자 · 무제한" 표시.
- 스터디원 추가/삭제 = `USER_CODES` 변수만 수정하면 즉시 반영 (재배포 불필요).
- 헤더 오른쪽 배지(오늘 N/10회)를 탭하면 코드를 변경할 수 있습니다.

## 보안 메모

- 접속 비밀번호를 아는 사람은 내 크레딧으로 API를 쓸 수 있습니다 — 비밀번호를 공유하지 마세요.
- Anthropic 콘솔에서 지출 한도를 함께 설정해 두는 것을 권장합니다.
- 비밀번호가 유출되면 Worker의 `ACCESS_PASSWORD` 시크릿만 바꾸면 즉시 차단됩니다.
