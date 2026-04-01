# 방명록 아카이빙 가이드 (2단계 전환)

> **Phase 1**: 마감일 기준으로 쓰기만 차단 (Firebase 유지, 읽기는 실시간)
> **Phase 2**: 충분히 지난 후 Firebase를 완전히 제거하고 정적 JSON으로 전환

---

# Phase 1 — 날짜 기반 쓰기 잠금

마감일이 지나면 자동으로 작성 폼이 숨겨지고, Firebase 보안 규칙에서도 쓰기가 차단됩니다.
읽기(방명록 열람)는 기존과 동일하게 실시간으로 유지됩니다.

---

## 1-1. 마감일 상수 정의 (`guestbook.js`)

파일 상단(Firebase 초기화 아래쪽)에 마감일 상수를 추가합니다:

```js
// ===== 방명록 마감일 설정 =====
// 이 날짜 이후에는 새 글 작성, 수정, 삭제가 불가합니다.
const GUESTBOOK_DEADLINE = new Date('2026-04-30T23:59:59+09:00'); // ← 날짜 수정 필요
const isGuestbookClosed = new Date() > GUESTBOOK_DEADLINE;
```

> ⚠️ `2026-04-30T23:59:59+09:00` 부분을 실제 마감일로 변경하세요.

---

## 1-2. 작성 폼 숨기기 (`guestbook.js`)

기존 폼 관련 코드를 마감 여부로 분기 처리합니다.

### 방법: 폼 이벤트 리스너를 감싸기

기존 코드:
```js
// 2. 새로운 방명록 데이터 저장하기
if (form) {
    form.addEventListener('submit', async (e) => {
```

변경 후:
```js
// 2. 새로운 방명록 데이터 저장하기
if (form) {
    if (isGuestbookClosed) {
        // 마감 후: 폼 전체를 안내 메시지로 교체
        form.innerHTML = '<p class="notice-text" style="text-align:center; padding: 1rem 0;">방명록 작성 기간이 종료되었습니다. 감사합니다! 🎂</p>';
    } else {
        form.addEventListener('submit', async (e) => {
            // ... 기존 submit 로직 전체 ...
        });
    }
}
```

> 기존 `form.addEventListener` 블록 전체를 `else` 안에 넣으면 됩니다.

---

## 1-3. 수정/삭제 버튼 숨기기 (`guestbook.js`)

`loadGuestbook()` 함수 내에서 수정/삭제 버튼을 렌더링하는 부분을 수정합니다.

기존 코드:
```js
const isOwner = currentUser && data.uid === currentUser.uid;
```

변경 후:
```js
const isOwner = !isGuestbookClosed && currentUser && data.uid === currentUser.uid;
```

이렇게 하면 마감 후에는 `isOwner`가 항상 `false`가 되어 수정/삭제 버튼이 렌더링되지 않습니다.

---

## 1-4. Firebase 보안 규칙 수정 (Firestore Rules)

Firebase Console → Firestore Database → Rules에서 수정합니다.

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /guestbook/{docId} {
      // 읽기: 항상 허용
      allow read: if true;

      // 쓰기: 마감일 이전에만 허용
      allow create: if request.auth != null
                    && request.time < timestamp.date(2026, 4, 30);  // ← 날짜 수정 필요

      // 수정/삭제: 마감일 이전 + 본인 글만
      allow update, delete: if request.auth != null
                            && request.auth.uid == resource.data.uid
                            && request.time < timestamp.date(2026, 4, 30);  // ← 날짜 수정 필요
    }
  }
}
```

> ⚠️ `timestamp.date(2026, 4, 30)` — 년, 월, 일 순서. JS와 날짜를 맞춰야 합니다.
> 
> 이 규칙이 있으면 프론트엔드 우회를 시도해도 서버에서 차단됩니다.

---

## 1-5. Phase 1 배포

```bash
git add .
git commit -m "방명록 마감일 잠금 적용"
git push
```

---

## Phase 1 체크리스트

- [ ] `guestbook.js`에 `GUESTBOOK_DEADLINE` 상수 추가
- [ ] 폼 submit 이벤트를 `isGuestbookClosed` 분기로 감싸기
- [ ] `isOwner` 조건에 `!isGuestbookClosed` 추가
- [ ] Firebase 보안 규칙에 날짜 조건 추가
- [ ] 배포 및 동작 확인

---
---

# Phase 2 — 완전 아카이빙 (Firebase 제거)

Phase 1 적용 후 충분한 시간이 지나면, Firebase 의존성을 완전히 제거합니다.

---

## 2-1. Firestore 데이터 Export

현재 배포된 사이트를 브라우저에서 열고 → **개발자 도구 콘솔(F12)**에서 아래 실행:

```js
import('https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js').then(async ({ getFirestore, collection, getDocs, query, orderBy }) => {
  const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js');
  const app = initializeApp({
    apiKey: "AIzaSyBc4G014Sx42HHQNSfKFttHLGWpEIdK9CA",
    projectId: "moabirthday-2b4f2"
  }, 'export-app');
  const db = getFirestore(app);
  const q = query(collection(db, "guestbook"), orderBy("createdAt", "desc"));
  const snapshot = await getDocs(q);
  const data = snapshot.docs.map(doc => ({
    name: doc.data().name || '익명',
    message: doc.data().message,
    createdAt: doc.data().createdAt?.toDate()?.toISOString() || null
  }));
  // uid는 제외 (수정/삭제 기능이 없어지므로 불필요)
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'guestbook-data.json';
  a.click();
  console.log(`✅ ${data.length}개 메시지 export 완료`);
});
```

→ `guestbook-data.json` 파일이 자동 다운로드됩니다.

---

## 2-2. 프로젝트에 JSON 파일 배치

다운로드된 `guestbook-data.json`을 **프로젝트 루트 폴더**에 넣습니다.

```
moabirthday-main/
├── index.html
├── style.css
├── guestbook.js
├── guestbook-data.json   ← 여기!
├── main.js
└── ...
```

---

## 2-3. `guestbook.js` 전면 교체

Firebase SDK를 전부 제거하고, 정적 JSON을 fetch하는 코드로 교체합니다.

```js
// guestbook.js (아카이브 버전)
// Firebase SDK import 전부 제거됨

const listContainer = document.getElementById('guestbook-list');

// XSS 방지를 위한 HTML 이스케이프 함수 (기존 코드 유지)
function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
        .toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// 날짜 포맷팅 함수 (기존 코드 유지)
function formatDate(date) {
    if (!date) return '';
    const formatter = new Intl.DateTimeFormat('ko-KR', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false
    });
    return formatter.format(new Date(date))
        .replace(/\.\s/g, '.')
        .replace(/\.$/, '')
        .trim();
}

// 정적 JSON에서 방명록 데이터 로드
let guestbookLoaded = false;

async function loadGuestbook() {
    if (guestbookLoaded || !listContainer) return;
    guestbookLoaded = true;

    try {
        const res = await fetch('guestbook-data.json');
        const data = await res.json();

        if (data.length === 0) {
            listContainer.innerHTML = '<p style="text-align:center; color: var(--text-light);">작성된 메시지가 없습니다.</p>';
            return;
        }

        const fragment = document.createDocumentFragment();
        data.forEach(entry => {
            const div = document.createElement('div');
            div.className = 'guestbook-entry';
            div.innerHTML = `
                <div class="guestbook-entry-header">
                    <span class="guestbook-entry-name">${escapeHtml(entry.name)}</span>
                    <span class="guestbook-entry-date">${formatDate(entry.createdAt)}</span>
                </div>
                <div class="guestbook-entry-message">${escapeHtml(entry.message).replace(/\n/g, '<br>')}</div>
            `;
            // 수정/삭제 버튼 없음 (읽기 전용)
            fragment.appendChild(div);
        });
        listContainer.appendChild(fragment);
    } catch (error) {
        console.error('방명록 로딩 실패:', error);
        listContainer.innerHTML = '<p style="text-align:center; color: red;">방명록 데이터를 불러오지 못했습니다.</p>';
    }
}

// 방명록 탭이 열렸을 때 로드 (기존 이벤트와 동일)
window.addEventListener('guestbookTabOpened', loadGuestbook, { once: true });
```

---

## 2-4. `index.html` 수정

### 작성 폼 제거

아래 부분을 **통째로 삭제**합니다:

```html
<!-- 삭제할 부분 -->
<form id="guestbook-form" class="guestbook-form">
    <div class="gb-input-row gb-input-row--single">
        <input type="text" id="gb-name" placeholder="이름 (생략가능)" maxlength="15">
    </div>
    <textarea id="gb-message" placeholder="모아에게 축하 메시지를 남겨주세요! (최대 200자)" maxlength="200"
        required></textarea>
    <p class="notice-text notice-text--guestbook">
        ※ 브라우저 캐시나 쿠키 초기화 및 기기 변경 시 수정과 삭제가 불가합니다.</p>
    <button type="submit" class="primary-btn submit-btn">메시지 남기기</button>
</form>
```

### 더보기 버튼 제거

```html
<!-- 삭제 -->
<div class="guestbook-footer">
    <button id="load-more-btn" class="primary-btn hidden load-more-btn-spacing">더 보기</button>
</div>
```

### 수정 모달 제거

```html
<!-- 삭제: <dialog id="edit-modal"> 전체 -->
<dialog id="edit-modal" class="modal">
    ...전체 삭제...
</dialog>
```

### script 태그 수정

```html
<!-- 변경 전 -->
<script type="module" src="guestbook.js"></script>

<!-- 변경 후 (Firebase import가 없으므로 type="module" 불필요) -->
<script src="guestbook.js" defer></script>
```

### CSP 헤더 정리 (선택사항)

`<meta http-equiv="Content-Security-Policy">` 에서 아래 도메인들 제거 가능:

- `script-src`에서: `https://www.gstatic.com`, `https://apis.google.com`
- `connect-src`에서: Firebase 관련 도메인 전부
  - `https://firestore.googleapis.com`
  - `https://www.googleapis.com`
  - `https://identitytoolkit.googleapis.com`
  - `https://securetoken.googleapis.com`
  - `https://firebase.googleapis.com`

> Google Analytics도 제거할 경우 `https://www.google-analytics.com` 등도 제거

---

## 2-5. Firebase 콘솔 정리

| 작업 | 위치 |
|------|------|
| 익명 인증 비활성화 | Firebase Console → Authentication → Sign-in method → 익명 OFF |
| Firestore 규칙 잠금 | Firebase Console → Firestore → Rules → `allow read, write: if false;` |
| (선택) 프로젝트 삭제 | Firebase Console → 프로젝트 설정 → 프로젝트 삭제 |

---

## 2-6. Phase 2 배포

```bash
git add .
git commit -m "방명록 완전 아카이브: Firebase 제거, 정적 JSON 전환"
git push
```

---

## Phase 2 체크리스트

- [ ] Firestore 데이터 export (`guestbook-data.json` 다운로드)
- [ ] JSON 파일을 프로젝트 루트에 배치
- [ ] `guestbook.js` 아카이브 버전으로 교체
- [ ] `index.html`에서 작성 폼, 더보기 버튼, 수정 모달 제거
- [ ] `index.html` script 태그 수정 (`type="module"` 제거)
- [ ] (선택) CSP 헤더에서 Firebase 도메인 제거
- [ ] Firebase 콘솔에서 인증/규칙 정리
- [ ] 배포 및 동작 확인

---
---

# 전환 전/후 비교

| 항목 | 현재 | Phase 1 적용 후 | Phase 2 적용 후 |
|------|------|----------------|----------------|
| 데이터 소스 | Firestore (실시간) | Firestore (실시간) | 정적 JSON 파일 |
| 쓰기 기능 | ✅ 가능 | ❌ 마감일 이후 차단 | ❌ 완전 제거 |
| 수정/삭제 | ✅ 본인 글 가능 | ❌ 마감일 이후 차단 | ❌ 완전 제거 |
| Firebase 의존성 | SDK + Auth + Firestore | SDK + Auth + Firestore | 없음 |
| 무료 할당량 소모 | 계속 발생 | 계속 발생 | 0 |
| 로딩 속도 | 네트워크 의존 | 네트워크 의존 | 매우 빠름 |
| 수동 작업 필요 | - | 날짜만 설정 | JSON export 필요 |
