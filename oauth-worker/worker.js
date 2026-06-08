/**
 * HUHGEON's blog — Cloudflare Worker
 *   ① GitHub OAuth 로그인 브로커 (/auth, /callback)
 *   ② 조회수 카운터 (/views)  — 글별 + 총합
 *   ③ 좋아요 카운터 (/like)   — GET 조회 / POST ±1
 *   ④ 댓글 (/comments)        — GET/POST/PUT/DELETE, KV 저장
 *
 * 카운터 저장:
 *   - Durable Object `COUNTER` 가 바인딩돼 있으면 그걸로 (동시성 100% 안전, 유료플랜)
 *   - 없으면 KV `VIEWS` 로 폴백 (무료, 댓글도 이 KV에 저장됨)
 *
 * 설정값:
 *   GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET (시크릿)
 *   ALLOWED_ORIGIN  (예: https://huhgeon.github.io)
 *   OWNER_LOGIN     (예: HUHGEON) — 이 사람은 모든 댓글 삭제 가능(관리자)
 * 바인딩(선택):
 *   Durable Object: 변수 COUNTER / 클래스 Counter   ← 동시성 안전(권장)
 *   KV namespace : 변수 VIEWS                       ← 폴백
 */

/* ---- 동시성 안전 카운터 (Durable Object) ---- */
export class Counter {
  constructor(state) { this.state = state; }
  async fetch(request) {
    const op = new URL(request.url).searchParams.get('op') || 'get';
    // blockConcurrencyWhile: 같은 객체(=같은 글)의 요청을 순차 처리 → 경쟁상태 없음
    return this.state.blockConcurrencyWhile(async () => {
      let n = (await this.state.storage.get('n')) || 0;
      if (op === 'inc') n++;
      else if (op === 'dec') n = Math.max(0, n - 1);
      if (op !== 'get') await this.state.storage.put('n', n);
      return new Response(JSON.stringify({ count: n }), { headers: { 'Content-Type': 'application/json' } });
    });
  }
}

async function doCount(env, name, op) {
  const id = env.COUNTER.idFromName(name);
  const r = await env.COUNTER.get(id).fetch('https://do/?op=' + op);
  return (await r.json()).count;
}
async function kvCount(env, key, delta) {
  let n = (parseInt((await env.VIEWS.get(key)) || '0', 10) || 0);
  if (delta) { n = Math.max(0, n + delta); await env.VIEWS.put(key, String(n)); }
  return n;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const allowOrigin = env.ALLOWED_ORIGIN || '*';
    const cors = {
      'Access-Control-Allow-Origin': allowOrigin,
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Content-Type': 'application/json',
    };

    // ② 카운터: 조회수(글별)와 방문자수 공용. inc=1 일 때만 +1(쓰기), 아니면 읽기만.
    //    /views?path=<글경로>  → 글 조회수,  /views?path=__visitors__ → 고유 방문자수
    if (url.pathname === '/views') {
      if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
      const p = (url.searchParams.get('path') || '/').slice(0, 300);
      const inc = url.searchParams.get('inc') === '1';
      if (env.COUNTER) {
        const count = await doCount(env, 'v:' + p, inc ? 'inc' : 'get');
        return new Response(JSON.stringify({ count }), { headers: cors });
      }
      if (!env.VIEWS) return new Response(JSON.stringify({ count: null, error: 'no-store' }), { headers: cors });
      const count = await kvCount(env, 'v:' + p, inc ? 1 : 0);
      return new Response(JSON.stringify({ count }), { headers: cors });
    }

    // ③ 좋아요: 로그인한 사람만, 사람당 1번(토글). GET=개수, POST=내 좋아요 토글
    if (url.pathname === '/like') {
      const cors2 = Object.assign({}, cors, { 'Access-Control-Allow-Headers': 'Authorization,Content-Type' });
      if (request.method === 'OPTIONS') return new Response(null, { headers: cors2 });
      if (!env.VIEWS) return new Response(JSON.stringify({ count: null, error: 'no-store' }), { headers: cors2 });
      const p = (url.searchParams.get('path') || '/').slice(0, 300);
      const key = 'lk:' + p;
      let likers; try { likers = JSON.parse((await env.VIEWS.get(key)) || '[]'); } catch (e) { likers = []; }

      if (request.method === 'GET') {
        return new Response(JSON.stringify({ count: likers.length }), { headers: cors2 });
      }
      if (request.method === 'POST') {
        const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
        if (!token) return new Response(JSON.stringify({ error: 'no-auth', message: '좋아요는 로그인이 필요해요' }), { headers: cors2, status: 401 });
        let user;
        try {
          const ur = await fetch('https://api.github.com/user', { headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'User-Agent': 'hg-blog' } });
          if (!ur.ok) throw 0; user = await ur.json();
        } catch (e) { return new Response(JSON.stringify({ error: 'bad-auth' }), { headers: cors2, status: 401 }); }
        const i = likers.indexOf(user.login);
        let liked;
        if (i >= 0) { likers.splice(i, 1); liked = false; } else { likers.push(user.login); liked = true; }
        await env.VIEWS.put(key, JSON.stringify(likers));
        return new Response(JSON.stringify({ count: likers.length, liked }), { headers: cors2 });
      }
      return new Response(JSON.stringify({ error: 'method' }), { headers: cors2, status: 405 });
    }

    // ④ 댓글: GET 목록 / POST 작성 / PUT 수정 / DELETE 삭제 (KV 저장)
    if (url.pathname === '/comments') {
      const cors2 = Object.assign({}, cors, {
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization,Content-Type',
      });
      if (request.method === 'OPTIONS') return new Response(null, { headers: cors2 });
      if (!env.VIEWS) return new Response(JSON.stringify({ error: 'no-store' }), { headers: cors2, status: 200 });
      const p = (url.searchParams.get('path') || '/').slice(0, 300);
      const key = 'c:' + p;
      const load = async () => { try { return JSON.parse((await env.VIEWS.get(key)) || '[]'); } catch (e) { return []; } };

      if (request.method === 'GET') {
        return new Response(JSON.stringify({ comments: await load() }), { headers: cors2 });
      }

      // 쓰기 작업은 GitHub 로그인 토큰 필요 → 토큰으로 실제 사용자 검증(위조 방지)
      const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
      if (!token) return new Response(JSON.stringify({ error: 'no-auth' }), { headers: cors2, status: 401 });
      let user;
      try {
        const ur = await fetch('https://api.github.com/user', { headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'User-Agent': 'hg-blog' } });
        if (!ur.ok) throw 0;
        user = await ur.json();
      } catch (e) { return new Response(JSON.stringify({ error: 'bad-auth' }), { headers: cors2, status: 401 }); }
      const isOwner = (user.login || '').toLowerCase() === (env.OWNER_LOGIN || '').toLowerCase();
      let list = await load();

      if (request.method === 'POST') {
        let b = {}; try { b = await request.json(); } catch (e) {}
        const text = (b.body || '').toString().trim().slice(0, 4000);
        if (!text) return new Response(JSON.stringify({ error: 'empty' }), { headers: cors2, status: 400 });
        const topCount = list.filter((c) => !c.parent).length;
        if (!b.parent && topCount >= 5) return new Response(JSON.stringify({ error: 'limit', message: '이 글은 댓글 5개까지만 남길 수 있어요' }), { headers: cors2, status: 403 });
        const c = { id: crypto.randomUUID().slice(0, 8), login: user.login, name: user.name || user.login, avatar: user.avatar_url, body: text, ts: Date.now(), parent: b.parent || null };
        list.push(c);
        await env.VIEWS.put(key, JSON.stringify(list));
        return new Response(JSON.stringify({ comment: c }), { headers: cors2 });
      }
      if (request.method === 'PUT') {
        const id = url.searchParams.get('id');
        let b = {}; try { b = await request.json(); } catch (e) {}
        const text = (b.body || '').toString().trim().slice(0, 4000);
        const c = list.find((x) => x.id === id);
        if (!c) return new Response(JSON.stringify({ error: 'not-found' }), { headers: cors2, status: 404 });
        if (c.login !== user.login) return new Response(JSON.stringify({ error: 'forbidden', message: '본인 댓글만 수정할 수 있어요' }), { headers: cors2, status: 403 });
        if (!text) return new Response(JSON.stringify({ error: 'empty' }), { headers: cors2, status: 400 });
        c.body = text; c.edited = true;
        await env.VIEWS.put(key, JSON.stringify(list));
        return new Response(JSON.stringify({ comment: c }), { headers: cors2 });
      }
      if (request.method === 'DELETE') {
        const id = url.searchParams.get('id');
        const c = list.find((x) => x.id === id);
        if (!c) return new Response(JSON.stringify({ error: 'not-found' }), { headers: cors2, status: 404 });
        if (c.login !== user.login && !isOwner) return new Response(JSON.stringify({ error: 'forbidden', message: '본인 댓글이나 관리자만 삭제할 수 있어요' }), { headers: cors2, status: 403 });
        list = list.filter((x) => x.id !== id && x.parent !== id);   // 댓글 + 그 답글들 삭제
        await env.VIEWS.put(key, JSON.stringify(list));
        return new Response(JSON.stringify({ ok: true }), { headers: cors2 });
      }
      return new Response(JSON.stringify({ error: 'method' }), { headers: cors2, status: 405 });
    }

    // ① 로그인 시작 → GitHub 인증
    if (url.pathname === '/auth' || url.pathname === '/') {
      const redirectUri = url.origin + '/callback';
      const gh = new URL('https://github.com/login/oauth/authorize');
      gh.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
      gh.searchParams.set('redirect_uri', redirectUri);
      gh.searchParams.set('scope', 'public_repo');
      gh.searchParams.set('state', crypto.randomUUID());
      return Response.redirect(gh.toString(), 302);
    }

    // ① 콜백 → 토큰 교환 → 팝업에 postMessage
    if (url.pathname === '/callback') {
      const code = url.searchParams.get('code');
      if (!code) return new Response('missing code', { status: 400 });
      const res = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET, code }),
      });
      const data = await res.json();
      const msg = { type: 'gh-oauth', token: data.access_token || '', error: data.error || null };
      const html = '<!doctype html><meta charset="utf-8"><body style="font:15px sans-serif;background:#0e1014;color:#c9d1da;display:grid;place-items:center;height:100vh;margin:0">'
        + '<div>로그인 처리 중… 이 창은 곧 닫힙니다.</div><script>'
        + '(function(){var d=' + JSON.stringify(msg) + ';'
        + 'try{ if(window.opener){ window.opener.postMessage(d, ' + JSON.stringify(allowOrigin) + '); } }catch(e){}'
        + 'setTimeout(function(){ window.close(); }, 400);})();'
        + '</script></body>';
      return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }

    return new Response('Not found', { status: 404 });
  },
};
