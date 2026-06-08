# GitHub 로그인용 OAuth 브로커 (Cloudflare Worker) 설정

정적 사이트(GitHub Pages)는 client_secret 을 숨길 수 없어서, 로그인 토큰 교환만 해주는
아주 작은 무료 서버(Cloudflare Worker)가 필요합니다. **한 번만** 설정하면 됩니다.

소요 시간 ~10분. 모두 무료입니다.

---

## 1. GitHub OAuth App 등록
1. https://github.com/settings/developers → **OAuth Apps** → **New OAuth App**
2. 입력:
   - **Application name**: `HUHGEON blog admin` (아무거나)
   - **Homepage URL**: `https://huhgeon.github.io`
   - **Authorization callback URL**: `https://hg-oauth.<당신의-subdomain>.workers.dev/callback`
     - (워커 주소는 3번에서 정해집니다. 일단 임시로 두고 나중에 수정해도 됩니다.)
3. **Register application** → **Client ID** 복사, **Generate a new client secret** → secret 복사

## 2. Cloudflare 계정 (무료)
- https://dash.cloudflare.com 가입/로그인

## 3. 워커 배포 (둘 중 편한 방법)

### 방법 A — 대시보드(복붙, 가장 쉬움)
1. Cloudflare 대시보드 → **Workers & Pages** → **Create** → **Create Worker**
2. 이름을 `hg-oauth` 로 → **Deploy** (기본 코드로 일단 배포)
3. **Edit code** → `oauth-worker/worker.js` 내용을 **전부 붙여넣기** → **Deploy**
4. 워커 주소 확인: `https://hg-oauth.<subdomain>.workers.dev`
5. **Settings → Variables and Secrets** 에서 추가:
   - `GITHUB_CLIENT_ID` (Secret) = 1번의 Client ID
   - `GITHUB_CLIENT_SECRET` (Secret) = 1번의 Client Secret
   - `ALLOWED_ORIGIN` (Text) = `https://huhgeon.github.io`
6. 1번의 OAuth App **callback URL** 을 `https://hg-oauth.<subdomain>.workers.dev/callback` 로 정확히 맞춰 저장

### 방법 B — wrangler CLI
```bash
npm i -g wrangler
cd oauth-worker
wrangler deploy worker.js --name hg-oauth
wrangler secret put GITHUB_CLIENT_ID
wrangler secret put GITHUB_CLIENT_SECRET
wrangler secret put ALLOWED_ORIGIN   # 또는 wrangler.toml 의 [vars]
```

## 4. 블로그에 워커 주소 연결
`_config.yml` 의 `oauth_url` 에 워커 주소를 넣고 커밋:
```yaml
oauth_url: "https://hg-oauth.<subdomain>.workers.dev"
```

## 끝!
- 블로그 `/admin.html` → **GitHub로 로그인** → GitHub 인증 → 끝.
- 로그인 계정이 저장소 주인(**HUHGEON**)이면 자동으로 **오너/admin**, 아니면 방문자입니다.
- `oauth_url` 을 비워두면 예전처럼 PAT(토큰 붙여넣기) 방식으로 자동 대체됩니다.

---

## (선택) 조회수 카운터 켜기 — 무료 KV
글 조회수 / 총 방문수를 표시하려면 워커에 KV 저장소만 붙이면 됩니다.
1. Cloudflare 대시보드 → **Storage & Databases → KV** → **Create namespace** (이름 예: `hg-views`)
2. 워커 → **Settings → Bindings → Add → KV namespace**:
   - **Variable name**: `VIEWS`  (반드시 이 이름)
   - **KV namespace**: 방금 만든 `hg-views`
3. 끝. 글을 열 때마다 조회수가 +1 되고, 사이드바에 총 방문수가 표시됩니다.
   (wrangler: `wrangler kv namespace create hg-views` 후 `wrangler.toml` 에 `[[kv_namespaces]] binding="VIEWS" id="..."`)

> 조회수는 `oauth_url` 이 설정돼 있으면 자동으로 이 워커를 사용합니다. KV를 안 붙이면 조회수만 표시되지 않을 뿐 다른 기능은 정상입니다. (goatcounter 를 쓰려면 `_config.yml` 의 `goatcounter_code` 사용)

---

## 댓글 (giscus) — 로그인해야 작성, 비로그인은 조회만
댓글은 **giscus**(GitHub Discussions 기반)로 동작합니다. 구조상 **누구나 읽을 수 있고, 댓글 작성은 GitHub 로그인(giscus 승인) 후에만** 가능합니다 — 원하시는 동작 그대로입니다.
설정: https://giscus.app 에서 저장소 선택 → 나온 `data-repo / repo-id / category / category-id` 4개를 `_config.yml` 의 `giscus_*` 에 넣으면 끝. (docs/Comment System.md 참고)
