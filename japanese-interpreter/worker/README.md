# 젠지 API 프록시 (Cloudflare Worker) 설치 — 약 5분

배포된 사이트에 API 키를 넣지 않고 사용하기 위한 프록시입니다.
키는 Worker(서버)의 시크릿에만 저장되고, 접속 비밀번호를 아는 사람만 쓸 수 있습니다.

## 방법 A: 대시보드에서 (권장, CLI 불필요)

1. https://dash.cloudflare.com 가입/로그인 (무료 플랜이면 충분 — 일 10만 요청)
2. 왼쪽 메뉴 **Workers & Pages** → **Create** → **Create Worker**
   - 이름: `zenji-proxy` → **Deploy** (기본 코드로 일단 배포됨)
3. **Edit code** → 기본 코드를 전부 지우고 이 폴더의 `worker.js` 내용을 붙여넣기 → **Deploy**
4. Worker 화면 → **Settings** → **Variables and Secrets** 에서 3개 추가:
   | 이름 | 타입 | 값 |
   |---|---|---|
   | `ANTHROPIC_API_KEY` | **Secret** | `sk-ant-...` (본인 API 키) |
   | `ACCESS_PASSWORD` | **Secret** | 원하는 접속 비밀번호 (길고 추측 어려운 문자열) |
   | `ALLOWED_ORIGINS` | Text | `https://kimdoyun0806.github.io,http://localhost:5173` |
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

## 보안 메모

- 접속 비밀번호를 아는 사람은 내 크레딧으로 API를 쓸 수 있습니다 — 비밀번호를 공유하지 마세요.
- Anthropic 콘솔에서 지출 한도를 함께 설정해 두는 것을 권장합니다.
- 비밀번호가 유출되면 Worker의 `ACCESS_PASSWORD` 시크릿만 바꾸면 즉시 차단됩니다.
