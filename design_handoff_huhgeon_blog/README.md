# Handoff: HUHGEON's Blog — Satellite 테마 리디자인 (Jekyll)

## Overview
`HUHGEON/HUHGEON.github.io` (Jekyll "Satellite" 테마 기반 개발 블로그)를 **차분한 다크 / "Docs × Terminal" 하이브리드** 디자인으로 리디자인하고 기능을 추가하는 작업입니다. 이 번들의 `blog.html` + CSS/JS는 **완성된 인터랙티브 프로토타입(=명세서)** 이며, 목표는 이걸 **실제 Jekyll 테마 코드(`_sass`, `_includes`, `_layouts`, `assets`)로 이식**하는 것입니다.

> ⚠️ 이 HTML 파일들은 **디자인/동작 레퍼런스**입니다. 그대로 배포하는 게 아니라, 원본 Jekyll 레포의 Liquid 템플릿 + SCSS 구조에 맞춰 **재구현**해야 합니다.

## 시작 방법 (중요)
1. 원본 레포를 클론: `git clone https://github.com/HUHGEON/HUHGEON.github.io`
2. 로컬 빌드 확인: `bundle install && bundle exec jekyll serve` → http://localhost:4000
3. 이 번들의 `blog.html`을 브라우저로 열어 **실제 동작/디자인을 직접 확인**하면서 이식하세요. (오너 전용 기능은 주소 끝에 `#owner`)
4. 원본 테마 구조 파악: `_layouts/{default,page}.html`, `_includes/{head,sidebar,navigation,post,pagination,category,search,...}.html`, `_sass/{vars,layout,sidebar,navigation,post,darkmode,...}.scss`, `assets/css/style.scss`, `assets/js/{common,post,subject,...}.js`

## Fidelity
**High-fidelity.** 색/타이포/간격/인터랙션이 모두 최종값입니다. 픽셀 단위로 맞춰 재현하세요. 단, Jekyll은 정적 사이트이므로 **인터랙티브 전용 기능은 아래 "정적 사이트 매핑"을 따르세요.**

---

## ✅ 필수 기능 체크리스트 — 하나도 빼지 말 것
아래 기능은 **전부** 구현해야 합니다. 정적 사이트라 형태(파일/CMS/JS)가 바뀌는 건 OK지만, **기능 자체를 생략하면 안 됩니다.** 인터랙티브 기능은 "삭제"가 아니라 **"정적/CMS/giscus로 치환"** 입니다.

- [ ] 다크/라이트 토글 (선택 기억)
- [ ] 사이드바: 터미널 프롬프트 + 깜빡이는 커서
- [ ] 프로필 아바타(me.jpg) + accent 링 + 온라인 점
- [ ] 탐색: 최신글 / 전체글
- [ ] 카테고리 디렉토리 트리 (기본 접힘 → 클릭 펼침, ├/└ 커넥터, 글 수 badge)
- [ ] 카테고리/세부 카테고리 클릭 → 해당 글 목록 필터
- [ ] 인기 태그 칩
- [ ] Featured(추천 글) 히어로 + 대표 이미지(그 글 thumbnail)
- [ ] 포스트 행 리스트 (인덱스·카테고리·태그 우측상단·제목·발췌·메타·썸네일)
- [ ] 썸네일 없을 때 기본 이미지 = me.jpg
- [ ] 전체글: offset 페이지네이션 (6개/페이지)
- [ ] 글 상세: 커버 · 태그(상단) · byline 스탯 · prose · 코드블록(traffic light + Copy + 토큰 하이라이트)
- [ ] TOC "On this page" + 스크롤 스파이
- [ ] 관련 글 = 같은 카테고리 우선 노출
- [ ] ♥ 좋아요(블루 토글) — byline ♥/댓글 수와 항상 일치
- [ ] 댓글 + 대댓글(들여쓰기 스레드) + 작성/삭제 → **giscus**
- [ ] 댓글 아바타: 본인 me.jpg / 타인 GitHub identicon (giscus면 자동)
- [ ] 인라인 검색 (상단바 타이핑 → 드롭다운, ⌘K/Esc) → search.json + JS
- [ ] 글쓰기 에디터 (마크다운 + 실시간 미리보기 + 이미지 드래그&드롭/붙여넣기 + 발행→글페이지, 첫 이미지=커버) → 로컬 전용/Decap CMS
- [ ] 카테고리·태그 관리 (추가/삭제/이름변경/드래그 순서) → 로컬 전용/CMS, 또는 폴더·front matter
- [ ] 오너 모드 (글쓰기·관리·수정/삭제·발행 = 오너만)
- [ ] 반응형 (모바일 드로어)

> ⚠️ 에디터·관리 같은 인터랙티브 기능을 정적 빌드에 그대로 못 넣겠으면 **별도 admin 페이지(빌드 제외) 또는 Decap/Netlify(Git 기반) CMS** 로 보존하세요. **"기능 없음"은 허용되지 않습니다.**

---

## Design Tokens

### Fonts (CDN webfont)
- **본문/UI/제목 (sans / display)**: **MinSans (민산스)** — `https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_2201-2@1.0/MinSans-{Regular(400),Medium(500),Bold(700)}.woff`
- **메타·코드·라벨 (mono)**: **JetBrains Mono** — Google Fonts (400/500/600/700)
- 제목(h1/h2/h3, 로고, 카드/행 제목, 에디터 제목)은 MinSans **700**, letter-spacing −.01em. 본문은 MinSans 400.

### Colors — Dark (default)
```
--bg:#0e1014  --bg-2:#111419  --surface:#14171d  --card:#161a21  --card-2:#1c212a
--border:#232a33  --border-soft:#181d24
--text:#c9d1da  --dim:#8b94a1  --faint:#586271
--line:rgba(255,255,255,.018)   /* 아주 옅은 터미널 그리드 배경 */
/* primary accent = dusty blue */
--accent:#7aa2c9  --accent-2:#9bbbde  --accent-deep:#5b82a8
--accent-soft:rgba(122,162,201,.13)  --accent-line:rgba(122,162,201,.26)
--glow:radial-gradient(58% 70% at 50% -4%, rgba(122,162,201,.06), transparent 70%)
/* 역할별 뮤트 컬러 (단조로움 방지) */
--c-cat:#86ad8e   /* 카테고리 라벨 = 세이지 그린 */
--c-tag:#7fb2d6   /* 태그 = 맑은 스카이블루 */
--c-tag-bg:rgba(127,178,214,.14)  --c-tag-line:rgba(127,178,214,.26)
--str:#86ad8e (code string)  --num:#c2a06a (code number, amber)  --rose:#cf8a93
--radius:15px  --radius-lg:20px  --sidebar-w:274px  --content-w:1000px
```
### Colors — Light (body.light)
```
--bg:#fbfbfa --bg-2:#f3f4f1 --surface/card:#fff --card-2:#f3f4f0
--border:#e5e6e0 --border-soft:#eeefe9 --text:#1a1d22 --dim:#5a626d --faint:#9aa1aa
--accent:#4f7aa6 --accent-2:#6a93bd --accent-deep:#3c6390
--c-cat:#4f7d5e --c-tag:#3f6f97 --str:#4f7d5e --num:#a87f3e
```
다크가 기본. 라이트는 `<body class="light">` 토글. 선택은 localStorage(`hg-theme`)에 기억. (원본 테마의 darkmode.scss 토글 로직 재사용 가능)

### 기타
- 그림자: `--shadow:0 22px 50px -26px rgba(0,0,0,.7)` (light: 더 옅게)
- `::selection { background:var(--accent-soft); color:var(--accent); }`
- `body::before` = 46px 그리드 라인 텍스처(아주 옅음), `body::after` = 상단 glow.

---

## 레이아웃 (전 페이지 공통 셸)
2단 그리드 `.app { grid-template-columns: 274px 1fr; max-width:1420px; margin:0 auto; }`
- **좌측 사이드바** (sticky, 100vh): 터미널 프롬프트 + 프로필 + 글쓰기/관리 버튼(오너) + 네비 + 태그 + 푸터
- **우측 main**: sticky 상단바(topbar) + 콘텐츠
- 모바일(≤940px): 사이드바가 드로어로 슬라이드(햄버거), scrim 오버레이.

### 사이드바 (`_includes/sidebar.html` + `_sass/sidebar.scss`)
- **터미널 프롬프트** 한 줄: `huhgeon@blog:~$` + 깜빡이는 커서(accent). (mono, faint, `huhgeon`은 accent)
- **프로필**: 50×50 라운드 사각(`--radius` 13px) 아바타 + accent 링(`box-shadow:0 0 0 3px var(--bg),0 0 0 4px var(--accent-line)`) + 우하단 온라인 점(`--c-cat`). 이름(MinSans 800), 설명(mono 10.5px). **아바타 이미지 = 번들의 `assets/img/me.jpg`** (강아지 사진, 사용자 제공).
- **오너 전용 버튼 2개**: `새 글 쓰기`(accent 채움 버튼), `카테고리·태그 관리`(accent 외곽선 버튼). `body.owner`일 때만 표시.
- **네비 "탐색"**: `최신글`(기본 active), `전체글`(badge 12).
- **네비 "카테고리"** — 디렉토리 트리:
  - 기본 **접힘**. 카테고리 클릭 시 펼침(▸ 회전) + 해당 카테고리 글 목록으로 이동.
  - 세부 카테고리는 트리 커넥터(`├`/`└` — 마지막 항목은 `└`로 닫히고 세로선이 다음 카테고리로 안 이어짐). 각 항목에 글 수 badge.
  - 색: 폴더 아이콘 `--c-cat`. (Jekyll에선 원본 `navigation.html`의 계층 구조 + 접기 로직으로 구현)
- **인기 태그**: 태그 칩(스카이블루).
- **푸터**: `● owner mode`(오너만), 방문 수, 카피라이트(mono, faint).

### 상단바 topbar
- 햄버거(모바일), breadcrumb(mono), **검색 입력창**(우측, 아래 참조), 다크/라이트 토글 버튼.
- 글 상세/목록에선 표시. **에디터 뷰에선 topbar 숨김**(`body.editing`).

---

## Screens / Views & Features

> 프로토타입은 SPA(뷰 전환)지만, Jekyll에선 각 뷰가 **실제 페이지/레이아웃**이 됩니다. 매핑은 각 항목에 표기.

### 1) 최신글 (홈) — `index` / `page.html`의 category 분기
- 헤더: `$ ls -la ~/posts --sort=date`(mono cmd, `$`는 accent) + h1 **"최신글"**(MinSans) + 설명.
- **Featured(추천 글) 히어로**: 큰 카드(높이 318px, radius 20). 배경 = 그 글의 thumbnail 이미지 + 어두운 그라데이션 오버레이. `FEATURED` 배지(mono, accent 채움), 제목(흰색 33px), 발췌, 메타(mono). 클릭 → 그 글로.
  - **추천 글 선정 기준**: front matter `bookmark: true`(또는 `featured: true`)인 글, 없으면 최신 글. 메인 이미지 = 그 글의 `thumbnail`.
- 태그 필터 칩(`all` + 인기태그) — 시각 토글.
- 섹션 헤더 `최근 글` + `12 posts` + **`모두 보기 →`** 링크 → **전체글(전체 목록)** 로 이동.
- **포스트 행(row) 리스트** (터미널 파일 리스팅 스타일):
  - grid `30px(인덱스) | 본문 | 썸네일(104×68)`. 인덱스 `01`(mono, faint→hover accent), 좌측 accent 보더 hover.
  - **상단 줄**: 카테고리 라벨(`Category · Sub`, 세이지, mono) **왼쪽** + **태그 칩 오른쪽 정렬** (이미지 상단 높이에 맞춤). 그 아래 제목(h4) + 발췌(2줄 클램프) + 메타(mono: 날짜 · 분).
  - 썸네일 없으면 → **기본 이미지 = `assets/img/me.jpg`** (cover).
  - **오너 hover 시** 우측 상단에 ✎수정 / 🗑삭제 버튼(`body.owner`만).

### 2) 전체글 (offset 페이지네이션) — listing 페이지
- `전체글` 네비 또는 `모두 보기` 클릭 시. 헤더 `$ ls -la ~/posts | wc -l → N` + h1 "전체 글" + `← 최신글` 백버튼.
- **6개씩 페이지네이션**(← 이전 / 1 / 2 / 다음 →, 현재 페이지 accent). Jekyll에선 `jekyll-paginate` 또는 `paginate` 로직 사용.
- 진입 시 사이드바 카테고리 선택 해제 + `전체글` active.

### 3) 카테고리 / 세부 카테고리 목록
- 카테고리 클릭 → 그 카테고리 글만. 세부 카테고리 클릭 → 그 세부만. 헤더에 카테고리명 + 글 수 + `← 전체 글`.
- 글 없으면 빈 상태(점선 박스, "아직 이 카테고리에 글이 없어요").
- Jekyll: 원본의 카테고리 계층(`_pages/Category .../`) 구조 + `subject.js` 목록 로직을 이 디자인으로.

### 4) 글 상세 — `_includes/post.html` + `_sass/post.scss`
- (오너) 우측 상단 **수정 / 삭제** 버튼.
- 헤더: 카테고리(폴더아이콘+`Cat · Sub`, mono 세이지) → **제목 h1**(MinSans 39px) → 리드 → **byline**(아바타 me.jpg + 이름 + 날짜 + `views / ♥ / comments` 스탯) → **태그(맨 위, 본문 이미지 위)**.
- **커버 이미지**(21:9): 그 글의 thumbnail. 없으면 숨김.
- **prose**(본문): h2에 `## `(mono accent) 프리픽스, 코드블록(상단 traffic-light 점 + 언어 + Copy, 토큰 하이라이트: key=accent, string=세이지, number=amber, comment=faint), 인용/리스트/이미지 등. 원본 post.scss의 마크다운 스타일을 이 토큰으로 교체.
- **참여(engage) 바**: **♥ 좋아요 버튼(토글, accent 블루로 채워짐, 카운트)** + 댓글 수. ⚠️ byline의 `♥`·`comments` 숫자는 **좋아요 버튼/댓글 수와 항상 일치**해야 함.
- **댓글 + 대댓글**: 댓글 목록(아바타 + 이름 + 시간 + 본문 + 답글/삭제), 답글은 들여쓰기(스레드 라인). 입력창 + 등록.
  - 아바타: 본인="me.jpg", **다른 사람 = GitHub 스타일 identicon** (`https://api.dicebear.com/7.x/identicon/svg?seed=NAME`).
  - **정적 매핑**: 실제로는 **giscus(GitHub Discussions)** 로 구현 → 방문자 GitHub 로그인 시 댓글/대댓글, 아바타 자동. 원본 테마에 giscus 설정 자리(`docs/Comment System.md`) 있음. 좋아요는 giscus 반응(👍) 또는 생략.
- **TOC** "On this page"(우측 sticky, 스크롤 스파이, active=accent). 원본 `toc.scss`/`post.js` 재사용.
- **관련 글**(`$ related --limit 2`): **같은 카테고리 글 우선** 노출(부족하면 채움). 카드 클릭 → 그 글로.

### 5) 글쓰기 에디터 (velog 스타일) — **인터랙티브/오너 전용**
- 좌측 마크다운 입력(제목/카테고리 select/태그 입력 + 툴바 H2·B·I·인용·코드·링크·이미지) + 우측 **실시간 미리보기**(글 상세 스타일). 좌우 인셋 26px로 균형.
- **이미지 드래그&드롭 / 붙여넣기** → 마크다운 본문에 `![](dataURL)` 삽입 + 미리보기 즉시 반영. **발행 시 본문 첫 이미지 = 대표(커버) 이미지.**
- **발행하기** → 작성한 제목/카테고리/태그/본문으로 글 상세 페이지로 이동.
- **정적 매핑**: Jekyll엔 브라우저 에디터가 없음 → 글 작성 = `_pages/.../*.md` 파일 추가(front matter `title/date/tags/thumbnail/bookmark`). 이 화면은 **로컬 전용 작성 보조툴**로 남기거나(예: 별도 admin.html, 빌드에서 제외), **Netlify CMS/Decap CMS** 같은 Git 기반 CMS로 대체 권장.

### 6) 카테고리·태그 관리 — **인터랙티브/오너 전용**
- 카테고리 트리 추가/삭제/이름변경/세부추가, 태그 추가/삭제/**드래그 순서변경**. 변경 시 사이드바·필터·에디터 select 실시간 반영(localStorage `hg-taxonomy-v2`).
- **정적 매핑**: Jekyll에선 카테고리=`_pages` 폴더 구조, 태그=글 front matter. 이 관리툴은 **로컬 전용** 또는 Git 기반 CMS로. 정적 빌드엔 미포함 권장.

### 7) 검색 — 상단바 인라인
- topbar 입력창에 **직접 타이핑** → 바로 아래 드롭다운에 결과(제목·태그·카테고리 매칭, 최대 8개). 클릭 → 그 글로. `⌘K`/`Ctrl+K` 포커스, Esc 닫기.
- **정적 매핑**: 클라이언트 JS 검색. 빌드 시 `search.json`(모든 글의 title/tags/category/url/excerpt) 생성 → fetch 후 필터. (원본 `search.html`/`search_event.html` 자리 활용)

### 8) 오너 모드
- 글쓰기·관리·수정/삭제·발행은 **오너에게만** 노출. 프로토타입은 localStorage `hg-owner` 플래그(주소 `#owner`로 on, `#guest`로 off).
- **정적 매핑**: 진짜 인증 아님 — 정적 사이트라 화면 표시용. 실제 보안은 **GitHub 레포 권한**(나만 push 가능). 에디터/관리/발행은 로컬 전용으로 두는 게 안전.

---

## Interactions & Behavior (요약)
- 다크/라이트 토글(localStorage 기억), 사이드바 카테고리 접기/펼치기 + 필터, 행 hover 액션, 좋아요 토글, 댓글/대댓글 추가·삭제, 드래그&드롭 이미지, 페이지네이션, 인라인 검색, 모바일 드로어.
- 트랜지션: 대부분 .15~.28s ease. 커서 깜빡임 1.15s steps. 모션 과하지 않게.

## Assets
- `assets/img/me.jpg` — 프로필 + 기본 썸네일(강아지 사진, 사용자 제공). 원본 레포의 `assets/img/thumbnail/*`(bricks.webp 등)은 샘플 썸네일로 사용 중 — 실제 글 이미지로 교체.
- 폰트: MinSans(jsDelivr woff), JetBrains Mono(Google Fonts). 댓글 아바타: dicebear identicon.

## Files (이 번들)
- `blog.html` — 전체 프로토타입(셸 + 모든 뷰 마크업). **메인 명세.**
- `assets/css/blog.css` — 전체 디자인 시스템(토큰, 레이아웃, 모든 컴포넌트, 반응형, 라이트/다크). **SCSS 이식의 기준.**
- `assets/js/blog.js` — 뷰전환·테마·필터·검색·좋아요·댓글/대댓글·에디터(드래그드롭)·페이지네이션·마크다운 파서.
- `assets/js/manage.js` — 카테고리/태그 관리 + 사이드바 트리 렌더 로직.
- `assets/img/me.jpg` — 프로필/기본 이미지.

## 권장 작업 순서 (단계)
1. **디자인 토큰 → `_sass/vars.scss` 교체** + 폰트 로드(head.html) + `style.scss`에 MinSans/JetBrains 적용. 라이트/다크 토큰.
2. **레이아웃 셸**: `_sass/layout.scss`(2단 그리드, 모바일 드로어) + `sidebar.html`/`sidebar.scss`(프롬프트·프로필·트리·태그).
3. **목록/홈**: 행 리스트 + Featured 히어로 + 카테고리 필터 + 페이지네이션(`pagination.scss`/`subject.js`).
4. **글 상세**: `post.html`/`post.scss`(헤더·커버·prose·코드블록·TOC·관련글).
5. **검색**(search.json + JS), **giscus 댓글** 연결.
6. (선택) 에디터/관리 = 로컬 전용 보조툴 또는 Decap CMS.
