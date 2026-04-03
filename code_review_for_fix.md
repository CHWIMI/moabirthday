# 🔍 Moa Birthday Cafe — 전체 코드 리뷰 (v2)

!중요 : 코드 수정 후 항목 옆에 (완료) 라고 적고 취소선 처리, 수정하지 않은 항목은 그대로 둠
!중요 : 코드 수정 내역 어떤 로직인지 대략적으로 요약해서 아래에 추가

## 프로젝트 개요

| 항목 | 내용 |
|---|---|
| **목적** | 모아(Moa) 생일 축하 인터넷 카페 (버추얼 생카) |
| **구성** | Vanilla HTML/CSS/JS + Firebase (Firestore, Auth, Analytics) |
| **호스팅** | GitHub Pages (`chwimi.github.io/moabirthday/`) |
| **주요 기능** | 전광판, 팬아트 갤러리, 팬영상, 방명록(CRUD+관리), 후원자 목록, 크레딧, 이스터에그 4종, 러너 미니게임 |

---

## 1. 🔒 보안 — Firestore Rules 심층 분석

> [!NOTE]
> Firestore Rules 원문을 제공받아 프론트엔드 코드와 대조 분석했습니다.

### ✅ 잘 설계된 부분

| 규칙 | 평가 |
|---|---|
| **Create 시 `request.resource.data.uid == request.auth.uid`** | 타인 UID 위조 작성 원천 차단 ✅ |
| **Update 시 `affectedKeys().hasAny(['isBlinded', 'uid'])` 차단** | 일반 유저가 블라인드 플래그/UID 변조 불가 ✅ |
| **블라인드된 글 수정 차단** (`resource.data.get('isBlinded', false) == false`) | 블라인드 글 텍스트 조작 방지 ✅ |
| **마감일 이후 관리자만 update/delete 허용** | 시간 기반 잠금 + 관리자 예외 ✅ |
| **메시지 길이/줄 수 검증** (서버 측 regex 포함) | 프론트만 믿지 않고 백엔드 이중 검증 ✅ |
| **닉네임 15자 제한** (`request.resource.data.get('name', '').size() <= 15`) | 서버 측 길이 제한 ✅ |

### ⚠️ 잠재적 우려 사항

#### ~~1-1. 미니게임 리더보드 write 규칙이 너무 열려 있음~~ (완료)

```
match /minigame/minigame_leaderboard {
    allow read: if true;
    allow write: if request.auth != null;  // ← 인증만 되면 누구나 쓸 수 있음
}
```

> [!WARNING]
> 현재 규칙은 **로그인한 사람이면 누구나 리더보드를 임의의 값으로 덮어쓸 수 있습니다**. 악의적인 유저가 DevTools에서 아래처럼 호출할 수 있습니다:
> ```javascript
> await setDoc(docRef, { entries: [{ name: "해커", score: 999999, date: "..." }] });
> ```
>
> 프론트엔드의 `runTransaction` 로직은 클라이언트에서만 동작하므로 우회 가능합니다.

**완화 방안 (Firestore Rules 수준)**:

```
// 예시: entries 배열의 각 원소가 올바른 형식인지 검증
allow write: if request.auth != null
              && request.resource.data.keys().hasOnly(['entries'])
              && request.resource.data.entries.size() <= 10;
```

> 완벽한 서버 측 검증은 어렵지만, 최소한 entries 필드만 저장되도록 제한하고 배열 크기를 제한하면 피해를 줄일 수 있습니다. 정밀 검증이 필요하면 Cloud Functions를 통한 서버 측 처리가 가장 확실합니다.

> **✏️ 수정 내역**: Firebase Console에서 미니게임 리더보드 규칙을 아래로 교체 필요 (프로젝트 코드가 아닌 Firebase Console 설정):
> ```
> match /minigame/minigame_leaderboard {
>     allow read: if true;
>     allow write: if request.auth != null
>                   && request.resource.data.keys().hasOnly(['entries'])
>                   && request.resource.data.entries.size() <= 10;
> }
> ```
> `entries` 필드만 저장 허용 + 배열 최대 10개로 제한하여 임의 데이터 삽입 피해를 최소화.

#### 1-2. 방명록 create 시 `name` 필드 누락 허용

Rules에서 `request.resource.data.get('name', '').size() <= 15`로 처리하고 있어서 `name` 필드 자체 없이 작성이 가능합니다. 이건 프론트엔드에서 `name: name || '익명'`으로 항상 채워주므로 **실질적으로 문제없지만**, 만약 API를 직접 호출하면 name 없는 문서가 생길 수 있습니다. 다만 읽기 측에서도 `data.name || '익명'`으로 처리하고 있으므로 영향도는 낮습니다.

#### 1-3. 프론트-서버 마감일 불일치 리스크

```javascript
// guestbook.js:77
const GUESTBOOK_DEADLINE = new Date('2026-04-15T00:00:00+09:00');

// Firestore Rules
request.time < timestamp.date(2026, 4, 15)  // UTC 기준
```

> [!IMPORTANT]
> 프론트엔드는 **KST(+09:00) 기준 4월 15일 00:00**이고, Firestore Rules의 `timestamp.date(2026, 4, 15)`는 **UTC 기준 4월 15일 00:00**입니다.
> 즉 실제로는 **KST 4월 15일 09:00**까지 서버 측에서 허용됩니다. 프론트에서는 자정에 막지만, API 직접 호출 시 KST 09:00까지 작성 가능합니다.
>
> 현실적으로 큰 문제는 아니지만 (프론트 UI에서 이미 막힘), 정확히 맞추려면 Rules를:
> ```
> request.time < timestamp.date(2026, 4, 14) + duration.value(15, 'h')
> ```
> 처럼 쓸 수 있습니다. 다만 이 정도는 무시해도 무방합니다.

---

## 2. 🏗️ 아키텍처 & 구조

### ✅ 잘한 점

- **SPA 해시 라우팅** — `pushState` + `popstate` + `hashchange` 조합으로 뒤로가기가 자연스럽게 동작
- **YouTube Facade 패턴** — iframe 지연 삽입으로 초기 로딩 3개 iframe 분량 절감
- **방명록 지연 로딩** — `guestbookTabOpened` 커스텀 이벤트로 탭 전환 시에만 Firebase 통신 시작
- **이벤트 위임** — 갤러리, SNS 버튼, 방명록 액션 모두 부모 컨테이너에서 이벤트 위임 적용
- **Firebase 앱 재사용** — `minigame.js`에서 `getApps()` 체크 후 기존 앱 재활용

### ⚠️ 구조적 고려 사항

#### 2-1. main.js가 915줄 — 단일 파일에 너무 많은 책임

현재 `main.js`가 담당하는 역할:
1. 페이지 진입 로직
2. 해시 라우팅 + 네비게이션
3. 헤더 숨김 처리
4. SNS 링크 처리
5. 갤러리 모달 로직
6. 수정 모달 닫기 로직
7. YouTube Facade
8. Easter Egg #1 (복구 시퀀스, ~120줄)
9. Easter Egg #2 (시간 기반 산책)
10. Easter Egg #3 (footer walker + 미니게임 연동, ~180줄)
11. Easter Egg #4 (Billboard idle)
12. 미니게임 모달 닫기
13. 이미지 프리로딩

> 기능이 섞여있지만, 프레임워크 없는 바닐라 JS 프로젝트에서 이 정도는 감수할만하고, 모든 기능이 잘 격리되어 동작하므로 급하게 분리할 필요는 없습니다.

---

## 3. 🐛 실제 버그 & 이슈

#### ~~3-1. `visibilitychange` 미구현 (이전 대화에서 논의됨)~~ (완료)

[main.js](file:///c:/Users/harru/Desktop/moabirthday/main.js)에 탭 비활성 시 비디오 중단 처리가 빠져있습니다. `resetTheaterVideos()`는 **탭 전환(SPA 내)**에서만 호출되고, **브라우저 탭 전환**에서는 호출되지 않습니다.

```javascript
// 추가 필요 (main.js 내)
document.addEventListener('visibilitychange', () => {
    if (document.hidden) resetTheaterVideos();
});
```

> **✏️ 수정 내역**: `main.js` YouTube Facade 로직 직후(L272)에 `visibilitychange` 이벤트 리스너 추가. 브라우저 탭 전환 시 `document.hidden`이면 `resetTheaterVideos()`를 호출하여 iframe을 썸네일 facade로 되돌림.

#### ~~3-2. 방명록 렌더링 로직 중 관리자 본인 글 조건 분기 오류~~ (완료)

[guestbook.js:273-301](file:///c:/Users/harru/Desktop/moabirthday/guestbook.js#L273-L301) (added 블록 기준):

```javascript
// L273: 블라인드 아닌 일반 글
if (isOwner) {
    actionButtons += `...수정/삭제...`;  // ← isOwner이면서 isAdmin일 때 여기로 빠짐
}
if (isAdmin() && !isOwner) {
    actionButtons += `...숨기기/삭제...`;
} else if (isAdmin() && isOwner) {
    actionButtons = `...수정/숨기기/삭제...`;  // ← 여기서 = 으로 덮어씀
}
```

**문제**: 관리자 본인 글일 때, 먼저 `isOwner` 블록에서 수정/삭제 버튼이 `+=`로 추가되고, 그 다음 `else if (isAdmin() && isOwner)` 블록에서 `=`로 덮어씁니다. 결과적으로 의도한 대로 동작하긴 하지만, **첫 번째 `if (isOwner)` 블록의 실행이 무의미합니다** (바로 덮어써지므로). 이건 `if-else`로 정리하면 더 깔끔해집니다:

```javascript
if (data.isBlinded) {
    // ...
} else {
    if (isAdmin() && isOwner) {
        // 관리자 본인: 수정+숨기기+삭제
    } else if (isAdmin()) {
        // 관리자, 타인 글: 숨기기+삭제
    } else if (isOwner) {
        // 일반 유저 본인 글: 수정+삭제
    }
}
```

이 로직이 `added`와 `modified` 양쪽에 동일하게 존재하므로, 함수로 추출하면 한 번만 고치면 됩니다.

> **✏️ 수정 내역**: `buildEntryHTML()` 공통 함수로 추출 시 관리자/소유자 분기를 `if (isAdmin() && isOwner) → else if (isAdmin()) → else if (isOwner)` 체인으로 정리. 기존의 `+=` 후 `=` 덮어쓰기 패턴 제거.

#### ~~3-3. 미니게임 `draw()`에서 매 프레임 `Math.random()` 호출~~ (완료)

[minigame.js:322](file:///c:/Users/harru/Desktop/moabirthday/minigame.js#L320-L322):
```javascript
ctx.fillRect(dash.x, dash.y, 8 + Math.random() * 4, 1.5);
```

매 프레임 바닥 격자의 너비가 달라져 **깜빡이는 시각적 노이즈**가 발생합니다. 각 dash에 `w` 속성을 미리 부여하세요:

```javascript
// resetGame() 안에서
groundDashes.push({ x: ..., y: ..., w: 8 + Math.random() * 4 });

// draw() 안에서
ctx.fillRect(dash.x, dash.y, dash.w, 1.5);
```

> **✏️ 수정 내역**: `resetGame()`에서 `groundDashes`에 `w` 속성 사전 계산, `draw()`에서 `dash.w` 사용, 재활용 시에도 `dash.w` 재계산 적용.

---

## 4. 📝 코드 품질

#### ~~4-1. 방명록 렌더링 코드 중복 (~130줄)~~ (완료)

`added`(L241~L316)와 `modified`(L318~L376)의 HTML 생성 로직이 **거의 동일**합니다. 이 중에서도 블라인드/관리자/소유자 분기 로직까지 완전히 반복됩니다.

```javascript
// 권장: 공통 함수 추출
function buildEntryHTML(docId, data, createdAt) {
    // ... 블라인드/관리자/소유자 분기 로직 한 번만 작성
    return { html, opacityStyle };
}
```

> **✏️ 수정 내역**: `buildEntryHTML(docId, data, createdAt, isOwner)` 공통 함수를 `loadGuestbook()` 앞에 정의. `added`/`modified` 블록에서 각각 `entryDiv.innerHTML = buildEntryHTML(...)`으로 호출하여 ~100줄 절감.

#### ~~4-2. 인라인 스타일 과다~~ (완료)

[index.html:421~436](file:///c:/Users/harru/Desktop/moabirthday/index.html#L421-L436) — 방명록 제출 영역에 `style` 속성이 과도하게 사용됩니다:

```html
<!-- 현재 (약 6개 요소에 style 속성) -->
<div class="gb-submit-group"
    style="display: flex; gap: 10px; justify-content: center; width: 100%; align-items: flex-start; margin-top: 10px;">
    <button type="button" id="google-login-btn" class="google-btn"
        style="background-color: #fff; color: #555; border: 1px solid #ddd; padding: 0.8rem 1rem; ...">
```

이미 `style.css`에 `.google-btn:hover` 스타일이 정의되어 있고, `guestbook.js`에서도 인라인 스타일을 동적으로 바꾸고 있어서 **세 곳에서 같은 요소를 스타일링**하는 상황입니다. CSS 클래스로 통합하면 관리 포인트가 줄어듭니다.

> **✏️ 수정 내역**: `style.css`에 `.google-btn`, `.gb-submit-group`, `.submit-wrapper`, `.gb-deadline-text`, `.google-btn img` 클래스 추가. `index.html`에서 해당 요소들의 인라인 style 속성 전체 제거. `guestbook.js`의 Google 아이콘 img 태그에서도 인라인 크기 제거 (CSS `.google-btn img`로 대체).

#### ~~4-3. `escapeHtml` 함수 중복 + 불일치~~ (완료)

| 파일 | 이스케이프 대상 |
|---|---|
| [guestbook.js:181](file:///c:/Users/harru/Desktop/moabirthday/guestbook.js#L181-L190) | `&`, `<`, `>`, `"`, `'` (5개) |
| [minigame.js:207](file:///c:/Users/harru/Desktop/moabirthday/minigame.js#L207-L210) | `&`, `<`, `>`, `"` (4개, **`'` 누락**) |

닉네임에 작은따옴표가 포함되면 minigame 쪽에서만 비정상 렌더링될 수 있습니다. 기능상 큰 위험은 없지만 (innerHTML에 attribute 바인딩이 없어 XSS까지는 아님) 일관성을 위해 맞춰주는 게 좋습니다.

> **✏️ 수정 내역**: `minigame.js`의 `escapeHtml()`에 `.replace(/'/g, '&#039;')` 추가하여 guestbook.js와 동일한 5개 문자 이스케이프 적용.

#### 4-4. 수정 시 `name` 변경 가능 여부

[guestbook.js:611-616](file:///c:/Users/harru/Desktop/moabirthday/guestbook.js#L611-L616):
```javascript
await updateDoc(docRef, {
    message: newMessage,
    updatedAt: serverTimestamp()
});
```

수정 모달은 메시지만 변경하고 name은 건드리지 않습니다. Firestore Rules에서도 update 시 `name` 필드 변경을 적극적으로 차단하지는 않습니다 (블라인드/uid만 차단). 의도된 설계라면 OK이고, name 변경도 막고 싶다면 Rules에 `!request.resource.data.diff(resource.data).affectedKeys().hasAny(['name', 'isBlinded', 'uid'])` 조건 추가가 필요합니다.

---

## 5. ⚡ 성능

### ✅ 잘한 점

| 기법 | 위치 | 효과 |
|---|---|---|
| YouTube Facade | main.js:249~271 | iframe 3개 → 썸네일만 로딩, 클릭 시 교체 |
| 갤러리 순차 프리로딩 | main.js:872~913 | `requestIdleCallback` + 150ms 간격 |
| 이스터에그 이미지 프리캐싱 | main.js:874~877 | `new Image().src`로 3개 미리 로딩 |
| 방명록 지연 로딩 | guestbook.js:93~99 | 탭 전환 이벤트로 트리거 |
| Billboard 시크릿 이미지 | main.js:830~838 | 발동 10초 전(290초)에 preload 시작 |
| WebP + `<picture>` | index.html:60~63 | 최적 포맷 자동 선택 |

### ⚠️ 개선 가능점

#### 5-1. footer walker `requestAnimationFrame` 누적

[main.js:715](file:///c:/Users/harru/Desktop/moabirthday/main.js#L715) — `walkLoop()`이 프레임마다 rAF를 요청하는데, **스크롤 시 footer가 보이지 않더라도** 항상 동작합니다. `IntersectionObserver`를 사용해 footer가 뷰포트에 있을 때만 애니메이션을 돌리면 좋지만, 현재 CSS `left` 이동은 레이아웃 트리거를 일으키지 않으므로(transform이 아님) 실질적 성능 영향은 미미합니다.

#### 5-2. SNS 점프 위치가 spawn 시점에 고정됨

[main.js:663-668](file:///c:/Users/harru/Desktop/moabirthday/main.js#L662-L668) — `jumpTriggerXs`가 walker 생성 시점의 `getBoundingClientRect()` 값으로 고정됩니다. **뷰포트 리사이즈**(모바일 키보드 열림/닫힘, 화면 회전 등) 시 점프 트리거 위치가 실제 SNS 버튼과 어긋날 수 있습니다. 실제로 footer walker는 30초 idle 후에만 등장하고 모바일 키보드가 열리는 상황과 겹칠 가능성이 낮으므로 우선순위는 낮습니다.

---

## 6. 🎮 미니게임 분석

### ✅ 잘한 점

- **`runTransaction`으로 리더보드 경합 조건 해결** — 동시 제출 시 데이터 유실 방지
- **캐시 우선 UI 업데이트 → 백그라운드 Firebase 동기화** — 즉각적인 사용자 피드백
- **`onSnapshot` 실시간 리스너** — 다른 유저의 랭킹 등록이 실시간 반영
- **IIFE + `'use strict'`** — 전역 스코프 오염 방지
- **닉네임 입력 중 게임 입력 차단** — `document.activeElement` 체크
- **히트박스 축소** (`px + 6`, `pw - 12`) — 공정한 충돌 판정

### ⚠️ 문제점

#### 6-1. 랭킹 조작 가능 (Rules 수준)

위 1-1에서 설명한 대로, `write: if request.auth != null`이므로 DevTools에서 임의의 점수를 직접 기록할 수 있습니다. 서버 측에서 점수 유효성을 검증하는 건 클라이언트 게임 특성상 완벽하게 막기 어렵지만, 최소한 **entries 배열의 max size와 score의 min/max 범위**를 Rules에 추가하는 게 좋습니다.

#### ~~6-2. Canvas 고정 해상도 (Retina에서 흐림)~~ (완료)

```javascript
const CANVAS_W = 700;
const CANVAS_H = 200;
canvas.width = CANVAS_W;  // 논리 해상도
// CSS: width: 100%         // 표시 해상도
```

`devicePixelRatio`를 고려하지 않아 Retina 디스플레이에서 약간 흐릿하게 보입니다. 게임 플레이에 큰 지장은 없지만, 선명하게 만들려면:

```javascript
const dpr = window.devicePixelRatio || 1;
canvas.width = CANVAS_W * dpr;
canvas.height = CANVAS_H * dpr;
ctx.scale(dpr, dpr);
```

> **✏️ 수정 내역**: `resizeCanvas()`에서 `devicePixelRatio`로 물리 해상도를 스케일링하고 `ctx.setTransform(dpr, 0, 0, dpr, 0, 0)`으로 논리 좌표계(CANVAS_W×CANVAS_H) 유지. 게임 로직/충돌 판정 영향 없음.

---

## 7. 🎨 CSS 분석

### ✅ 잘한 점

- **CSS 변수 시스템** — `:root`에 색상/그림자/전환 토큰 정의
- **`clamp()` 반응형 타이포** — `.main-title { font-size: clamp(1.1rem, 6vw, 2rem) }`
- **후원자 Tier별 시각적 차별화** — gradient border, glow 효과의 단계적 적용
- **`@media (hover: hover) and (pointer: fine)`** — 터치 기기에서의 불필요한 hover 효과 방지
- **`image-rendering: pixelated`** — 도트 스프라이트가 선명하게 렌더링
- **`<dialog>` 네이티브 활용** — 자동 포커스 트래핑, ESC 닫기 내장

### ⚠️ 개선 가능점

#### ~~7-1. `@media (max-width: 480px)` 미디어 쿼리 분산~~ (완료)

[style.css:934](file:///c:/Users/harru/Desktop/moabirthday/style.css#L934)와 [style.css:1570](file:///c:/Users/harru/Desktop/moabirthday/style.css#L1570) 두 곳에 같은 브레이크포인트가 있습니다. 기능적 문제는 없지만 하나로 합치면 관리가 편해집니다.

> **✏️ 수정 내역**: 두 번째 480px 블록(미니게임용)의 내용을 첫 번째 블록으로 이동하고 두 번째 블록 제거.

#### 7-2. `.hidden` 클래스의 `!important`

```css
.hidden { display: none !important; }
```

유틸리티 클래스에서의 `!important`는 일반적으로 허용되는 패턴이고, 현재 프로젝트에서도 의도대로 동작합니다. 다만 `.char-fade-collapse`에도 `!important`가 사용되는데 이건 Easter Egg 한정이므로 OK.

---

## 8. ♿ 접근성 & SEO

### ✅ 잘한 점
- **Open Graph 태그** 완비 (og:title, og:description, og:image, og:url)
- **`lang="ko"`** 올바른 언어 선언
- **`<dialog>` 네이티브 요소** 사용 (접근성 내장)
- **동영상 play 버튼에 `aria-label`** 지정

### ⚠️ 개선 가능점

| 위치 | 이슈 | 권장 |
|---|---|---|
| SNS 버튼 (`<button class="sns-btn">`) | 버튼 내에 `<img>`만 있고 텍스트 없음 | `aria-label="치지직"` 등 추가 |
| 팬아트 `<div class="gallery-item">` | 클릭 가능하지만 `role`, `tabindex` 없음 | `role="button" tabindex="0"` 또는 `<button>` 래핑 |
| `<meta name="description">` | 누락 | OG description은 있지만 일반 meta description 추가 권장 |

> **✏️ 수정 내역 (SNS aria-label)**: `index.html`의 4개 SNS 버튼에 `aria-label="치지직"`, `aria-label="유튜브"`, `aria-label="인스타그램"`, `aria-label="네이버 카페"` 추가. (완료)

---

## 9. 📊 파일별 요약

| 파일 | 라인 | 핵심 역할 | 코드 품질 | 비고 |
|---|---|---|---|---|
| [index.html](file:///c:/Users/harru/Desktop/moabirthday/index.html) | 560 | 전체 마크업 + 모달 3개 | ⭐⭐⭐ | 인라인 스타일 정리 필요 |
| [style.css](file:///c:/Users/harru/Desktop/moabirthday/style.css) | 1,590 | 전체 + 미니게임 스타일링 | ⭐⭐⭐⭐ | CSS 변수 활용 우수 |
| [main.js](file:///c:/Users/harru/Desktop/moabirthday/main.js) | 915 | 라우팅 + Easter Egg 4종 | ⭐⭐⭐⭐ | 크지만 기능 격리 양호 |
| [minigame.js](file:///c:/Users/harru/Desktop/moabirthday/minigame.js) | 634 | 러너 게임 + 리더보드 | ⭐⭐⭐⭐ | 트랜잭션 사용 좋음 |
| [guestbook.js](file:///c:/Users/harru/Desktop/moabirthday/guestbook.js) | 643 | CRUD + 인증 + 관리 | ⭐⭐⭐ | 렌더링 중복 개선 여지 |
| [404.html](file:///c:/Users/harru/Desktop/moabirthday/404.html) | 39 | 점검 안내 | — | 독립적, 문제 없음 |

---

## 10. 🏆 종합 평가

| 항목 | 점수 | 코멘트 |
|---|---|---|
| **보안 (Firestore Rules)** | ⭐⭐⭐⭐ | 방명록 Rules는 매우 꼼꼼함. 미니게임 규칙만 보강 필요 |
| **구조/아키텍처** | ⭐⭐⭐⭐ | 프레임워크 없이 깔끔한 SPA + 이벤트 위임 |
| **성능** | ⭐⭐⭐⭐ | Facade, 지연 로딩, 프리로딩, requestIdleCallback |
| **코드 품질** | ⭐⭐⭐ | 렌더링 중복과 인라인 스타일이 유지보수 걸림돌 |
| **접근성** | ⭐⭐⭐ | `<dialog>` 좋지만 aria 보강 여지 |
| **UX/디자인** | ⭐⭐⭐⭐⭐ | 파스텔 톤 일관, 이스터에그 연출 매우 세심 |
| **보안 (프론트)** | ⭐⭐⭐⭐ | CSP, escapeHtml, 이중 권한 체크 |

---

## 📋 우선순위별 액션 아이템 요약

### 즉시 (운영 영향)
1. ~~**미니게임 리더보드 Firestore Rules 보강** — entries size 제한, 필드 화이트리스트~~ (완료)
2. ~~**`visibilitychange` 이벤트 추가** — 탭 비활성 시 비디오 정리~~ (완료)

### 권장 (코드 품질)
3. ~~**guestbook.js 렌더링 함수 통합** — `added`/`modified` 공통 함수 추출 (~60줄 절감)~~ (완료)
4. ~~**관리자/소유자 분기 로직 정리** — `if-else if` 체인으로 명확하게~~ (완료)
5. ~~**index.html 인라인 스타일 → CSS 클래스 분리**~~ (완료)
6. ~~**minigame.js `escapeHtml`에 `'` 이스케이프 추가**~~ (완료)

### 여유 있을 때
7. ~~**미디어 쿼리 통합** (480px 블록 하나로)~~ (완료)
8. ~~**SNS 버튼에 `aria-label` 추가**~~ (완료)
9. ~~**미니게임 Canvas Retina 대응**~~ (완료)
10. ~~**`draw()` 내 `Math.random()` → 사전 계산**~~ (완료)

### 추가 수정
11. ~~**미니게임 장애물 간격 동적 조절** — 고속에서 불가능 패턴 방지~~ (완료)
