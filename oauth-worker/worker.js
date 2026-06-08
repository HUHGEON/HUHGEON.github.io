/**
 * GitHub OAuth broker for HUHGEON's blog admin (Cloudflare Worker).
 *
 * 왜 필요한가:
 *   GitHub 로그인은 마지막에 client_secret 으로 토큰을 교환해야 하는데,
 *   이 비밀키는 정적 사이트(브라우저)에 두면 안 되므로 이 작은 서버가 대신 처리합니다.
 *
 * 배포 후 설정해야 하는 값(시크릿/변수):
 *   GITHUB_CLIENT_ID      (시크릿 또는 변수)  - GitHub OAuth App 의 Client ID
 *   GITHUB_CLIENT_SECRET  (시크릿)            - GitHub OAuth App 의 Client Secret
 *   ALLOWED_ORIGIN        (변수)              - 블로그 주소 (예: https://huhgeon.github.io)
 *
 * 조회수 카운터(선택)를 쓰려면 KV 네임스페이스를 만들고 이 워커에 `VIEWS` 라는 이름으로 바인딩하세요.
 *
 * GitHub OAuth App 의 "Authorization callback URL" 은 이 워커의 /callback 으로:
 *   예) https://hg-oauth.<subdomain>.workers.dev/callback
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const allowOrigin = env.ALLOWED_ORIGIN || '*';

    // 0) 조회수 카운터 (KV 바인딩 `VIEWS` 필요). 방문 시 +1, 현재 카운트 반환.
    if (url.pathname === '/views') {
      const cors = {
        'Access-Control-Allow-Origin': allowOrigin,
        'Access-Control-Allow-Methods': 'GET,OPTIONS',
        'Content-Type': 'application/json',
      };
      if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
      if (!env.VIEWS) return new Response(JSON.stringify({ count: null, error: 'no-kv' }), { headers: cors });
      const p = (url.searchParams.get('path') || '/').slice(0, 300);
      const key = 'v:' + p;
      const n = (parseInt((await env.VIEWS.get(key)) || '0', 10) || 0) + 1;
      await env.VIEWS.put(key, String(n));
      const t = (parseInt((await env.VIEWS.get('v:__total__')) || '0', 10) || 0) + 1;
      await env.VIEWS.put('v:__total__', String(t));
      return new Response(JSON.stringify({ count: n, total: t }), { headers: cors });
    }

    // 0-2) 좋아요 카운터 (KV 바인딩 `VIEWS` 재사용). GET=조회, POST=±1
    if (url.pathname === '/like') {
      const cors = {
        'Access-Control-Allow-Origin': allowOrigin,
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
        'Content-Type': 'application/json',
      };
      if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
      if (!env.VIEWS) return new Response(JSON.stringify({ count: null, error: 'no-kv' }), { headers: cors });
      const p = (url.searchParams.get('path') || '/').slice(0, 300);
      const key = 'l:' + p;
      let n = parseInt((await env.VIEWS.get(key)) || '0', 10) || 0;
      if (request.method === 'POST') {
        n = Math.max(0, n + (url.searchParams.get('op') === 'dec' ? -1 : 1));
        await env.VIEWS.put(key, String(n));
      }
      return new Response(JSON.stringify({ count: n }), { headers: cors });
    }

    // 1) 로그인 시작 → GitHub 인증 페이지로
    if (url.pathname === '/auth' || url.pathname === '/') {
      const redirectUri = url.origin + '/callback';
      const gh = new URL('https://github.com/login/oauth/authorize');
      gh.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
      gh.searchParams.set('redirect_uri', redirectUri);
      gh.searchParams.set('scope', 'public_repo');   // 공개 저장소 쓰기 권한
      gh.searchParams.set('state', crypto.randomUUID());
      return Response.redirect(gh.toString(), 302);
    }

    // 2) GitHub 콜백 → 토큰 교환 → 팝업을 연 admin 창으로 postMessage
    if (url.pathname === '/callback') {
      const code = url.searchParams.get('code');
      if (!code) return new Response('missing code', { status: 400 });

      const res = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: env.GITHUB_CLIENT_ID,
          client_secret: env.GITHUB_CLIENT_SECRET,
          code: code,
        }),
      });
      const data = await res.json();
      const origin = env.ALLOWED_ORIGIN || '*';
      const msg = { type: 'gh-oauth', token: data.access_token || '', error: data.error || null };

      const html = '<!doctype html><meta charset="utf-8"><body style="font:15px sans-serif;background:#0e1014;color:#c9d1da;display:grid;place-items:center;height:100vh;margin:0">'
        + '<div>로그인 처리 중… 이 창은 곧 닫힙니다.</div><script>'
        + '(function(){var d=' + JSON.stringify(msg) + ';'
        + 'try{ if(window.opener){ window.opener.postMessage(d, ' + JSON.stringify(origin) + '); } }catch(e){}'
        + 'setTimeout(function(){ window.close(); }, 400);})();'
        + '</script></body>';
      return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }

    return new Response('Not found', { status: 404 });
  },
};
