// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-analytics.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, limit, serverTimestamp, doc, deleteDoc, updateDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import { getAuth, signInAnonymously, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: "AIzaSyBc4G014Sx42HHQNSfKFttHLGWpEIdK9CA",
    authDomain: "moabirthday-2b4f2.firebaseapp.com",
    projectId: "moabirthday-2b4f2",
    storageBucket: "moabirthday-2b4f2.firebasestorage.app",
    messagingSenderId: "920202474585",
    appId: "1:920202474585:web:0e1a0364bbd1eb1bbead48",
    measurementId: "G-XETYJBWWZ7"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);
const auth = getAuth(app);

// DOM 요소를 가져옵니다.
const form = document.getElementById('guestbook-form');
const nameInput = document.getElementById('gb-name');
const messageInput = document.getElementById('gb-message');
const listContainer = document.getElementById('guestbook-list');
const submitBtn = form?.querySelector('.submit-btn');

let currentUser = null;
let guestbookLoaded = false;
let currentLimit = 20; // 2번 최적화: 초기 로드 20개로 제한
let unsubscribe = null; // onSnapshot 리스너 해제용
let isGuestbookVisible = false; // 방명록 탭 활성화 여부 확인

const ADMIN_UIDS = ["A9a96wJRgidw9jXUy2B4GhtmDsB2", "GOOGLE_UID_2"]; // 관리자 구글 UID를 여기에 입력하세요

function isAdmin() {
    return currentUser && ADMIN_UIDS.includes(currentUser.uid);
}

// 방명록 탭이 열렸을 때 통신을 시작하기 위한 커스텀 이벤트 리스너 (지연 로딩)
window.addEventListener('guestbookTabOpened', () => {
    isGuestbookVisible = true;
    if (currentUser && !guestbookLoaded) {
        guestbookLoaded = true;
        loadGuestbook();
    }
});

// 로그인 상태 감지
onAuthStateChanged(auth, (user) => {
    if (!user) {
        // 세션이 완전히 없을 때만 익명 로그인 수행하여 구글 세션 덮어쓰기 방지
        signInAnonymously(auth).catch((error) => {
            console.error("익명 로그인 실패:", error);
        });
        return;
    }

    currentUser = user;

    // 구글 로그인 버튼 상태 업데이트
    const googleLoginBtn = document.getElementById('google-login-btn');
    if (googleLoginBtn && user) {
        if (!user.isAnonymous) {
            googleLoginBtn.innerHTML = '<img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" style="width: 20px; height: 20px;">구글 로그아웃';
            googleLoginBtn.style.backgroundColor = '#f8d7da';
            googleLoginBtn.style.color = '#721c24';
            googleLoginBtn.style.borderColor = '#f5c6cb';
            // 닉네임 자동 채우기 (기존 값이 없을 때만)
            if (nameInput && !nameInput.value && user.displayName) {
                nameInput.value = user.displayName;
            }
        } else {
            googleLoginBtn.innerHTML = '<img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" style="width: 20px; height: 20px;">구글 로그인';
            googleLoginBtn.style.backgroundColor = '#fff';
            googleLoginBtn.style.color = '#555';
            googleLoginBtn.style.borderColor = '#ddd';
        }
    }

    // 로그인 완료 시, 방명록 탭이 켜져있을 때만 불러옵니다.
    if (isGuestbookVisible && !guestbookLoaded && user) {
        guestbookLoaded = true;
        loadGuestbook();
    }
});

// 구글 로그인 이벤트 연결
const googleBtn = document.getElementById('google-login-btn');
if (googleBtn) {
    googleBtn.addEventListener('click', async () => {
        if (currentUser && !currentUser.isAnonymous) {
            if (confirm('구글 계정에서 로그아웃 하시겠습니까? (익명 작성 모드로 되돌아갑니다)')) {
                try {
                    guestbookLoaded = false;
                    listContainer.innerHTML = '';
                    await signOut(auth);
                    alert('정상적으로 로그아웃되었습니다.');
                } catch (error) {
                    console.error("로그아웃 실패:", error);
                }
            }
            return;
        }
        try {
            const provider = new GoogleAuthProvider();
            await signInWithPopup(auth, provider);
            // 성공시 onAuthStateChanged가 발생하며 기존 목록 다시 렌더링을 위해 초기화
            guestbookLoaded = false;
            listContainer.innerHTML = '';
            if (isGuestbookVisible) {
                guestbookLoaded = true;
                loadGuestbook();
            }
        } catch (error) {
            console.error("구글 로그인 실패:", error);
            alert("구글 로그인을 취소했거나 실패했습니다.");
        }
    });
}

// XSS 방지를 위한 HTML 이스케이프 함수
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

// 날짜 포맷팅 함수 (YYYY.MM.DD HH:mm)
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

// 1. 방명록 데이터 불러오기 (실시간 청취)
function loadGuestbook() {
    if (!listContainer) return;

    if (unsubscribe) {
        unsubscribe(); // 기존 리스너 해제 후 limit을 늘려 재요청
    }

    const q = query(collection(db, "guestbook"), orderBy("createdAt", "desc"), limit(currentLimit));

    unsubscribe = onSnapshot(q, (snapshot) => {
        if (snapshot.empty) {
            listContainer.innerHTML = '<p style="text-align:center; color: var(--text-light);">아직 작성된 메시지가 없습니다. 첫 번째 축하 메시지를 남겨주세요!</p>';
            return;
        }

        const emptyMsg = listContainer.querySelector('p');
        if (emptyMsg && listContainer.children.length === 1) {
            emptyMsg.remove();
        }

        const loadMoreBtn = document.getElementById('load-more-btn');
        if (loadMoreBtn) {
            // 현재 불러온 문서 수가 리미트와 같다면 더 있을 확률이 높으므로 더보기 버튼 노출
            if (snapshot.docs.length >= currentLimit) {
                loadMoreBtn.classList.remove('hidden');
            } else {
                loadMoreBtn.classList.add('hidden');
            }
        }

        snapshot.docChanges().forEach((change) => {
            const data = change.doc.data();
            const createdAt = data.createdAt ? data.createdAt.toDate() : new Date();
            const isOwner = currentUser && data.uid === currentUser.uid;

            if (change.type === "added") {
                // DOM 중복 방어 로직: 이미 id가 존재하는 요소라면 건너뛴다.
                const existingEntry = listContainer.querySelector(`.guestbook-entry[data-doc-id="${change.doc.id}"]`);
                if (existingEntry) return;

                const entryDiv = document.createElement('div');
                entryDiv.className = 'guestbook-entry';
                entryDiv.setAttribute('data-doc-id', change.doc.id);

                let actionButtons = '';
                let displayMessage = escapeHtml(data.message).replace(/\n/g, '<br>');
                let displayName = escapeHtml(data.name || '익명');
                let opacityStyle = '';

                // 블라인드 처리 로직
                if (data.isBlinded) {
                    if (isAdmin()) {
                        // 관리자에게는 희미하게 원본 노출 + 복구 버튼
                        displayMessage = `[블라인드 됨]<br>${displayMessage}`;
                        opacityStyle = 'style="opacity: 0.5;"';
                        actionButtons += `
                            <div class="guestbook-entry-actions">
                                <button class="guestbook-action-btn unblind-btn" data-id="${change.doc.id}" style="color: #28a745; border-color: #28a745;">👁️ 복구하기</button>
                                <button class="guestbook-action-btn delete-btn" data-id="${change.doc.id}">삭제</button>
                            </div>
                        `;
                    } else {
                        // 일반 유저에게는 블라인드 메시지 노출 (수정버튼 등 숨김)
                        displayMessage = `🚨 관리자에 의해 블라인드 처리된 게시글입니다.`;
                        displayName = `알 수 없음`;
                        opacityStyle = 'style="color: var(--text-light); font-style: italic;"';
                    }
                } else {
                    // 블라인드 되지 않은 일반 글
                    if (isOwner) {
                        actionButtons += `
                            <div class="guestbook-entry-actions">
                                <button class="guestbook-action-btn edit-btn" data-id="${change.doc.id}">수정</button>
                                <button class="guestbook-action-btn delete-btn" data-id="${change.doc.id}">삭제</button>
                            </div>
                        `;
                    }
                    if (isAdmin() && !isOwner) {
                        // 관리자는 언제나 다른 사람의 글을 블라인드/삭제할 수 있음
                        actionButtons += `
                            <div class="guestbook-entry-actions">
                                <button class="guestbook-action-btn blind-btn" data-id="${change.doc.id}" style="color: #dc3545; border-color: #dc3545;">🚨 숨기기</button>
                                <button class="guestbook-action-btn delete-btn" data-id="${change.doc.id}">삭제</button>
                            </div>
                        `;
                    } else if (isAdmin() && isOwner) {
                        // 관리자 본인 글
                        actionButtons = `
                            <div class="guestbook-entry-actions">
                                <button class="guestbook-action-btn edit-btn" data-id="${change.doc.id}">수정</button>
                                <button class="guestbook-action-btn blind-btn" data-id="${change.doc.id}" style="color: #dc3545; border-color: #dc3545;">🚨 숨기기</button>
                                <button class="guestbook-action-btn delete-btn" data-id="${change.doc.id}">삭제</button>
                            </div>
                        `;
                    }
                }

                entryDiv.innerHTML = `
                    <div class="guestbook-entry-header" ${opacityStyle}>
                        <span class="guestbook-entry-name">${displayName}</span>
                        <span class="guestbook-entry-date">${formatDate(createdAt)}</span>
                    </div>
                    <div class="guestbook-entry-message" ${opacityStyle}>${displayMessage}</div>
                    ${actionButtons}
                `;

                if (listContainer.children.length === 0 || change.newIndex >= listContainer.children.length) {
                    listContainer.appendChild(entryDiv);
                } else {
                    listContainer.insertBefore(entryDiv, listContainer.children[change.newIndex]);
                }
            }
            if (change.type === "modified") {
                const entryDiv = listContainer.querySelector(`.guestbook-entry[data-doc-id="${change.doc.id}"]`);
                if (entryDiv) {
                    let actionButtons = '';
                    let displayMessage = escapeHtml(data.message).replace(/\n/g, '<br>');
                    let displayName = escapeHtml(data.name || '익명');
                    let opacityStyle = '';

                    if (data.isBlinded) {
                        if (isAdmin()) {
                            displayMessage = `[블라인드 됨]<br>${displayMessage}`;
                            opacityStyle = 'style="opacity: 0.5;"';
                            actionButtons += `
                                <div class="guestbook-entry-actions">
                                    <button class="guestbook-action-btn unblind-btn" data-id="${change.doc.id}" style="color: #28a745; border-color: #28a745;">👁️ 복구하기</button>
                                    <button class="guestbook-action-btn delete-btn" data-id="${change.doc.id}">삭제</button>
                                </div>
                            `;
                        } else {
                            displayMessage = `🚨 관리자에 의해 블라인드 처리된 게시글입니다.`;
                            displayName = `알 수 없음`;
                            opacityStyle = 'style="color: var(--text-light); font-style: italic;"';
                        }
                    } else {
                        if (isOwner) {
                            actionButtons += `
                                <div class="guestbook-entry-actions">
                                    <button class="guestbook-action-btn edit-btn" data-id="${change.doc.id}">수정</button>
                                    <button class="guestbook-action-btn delete-btn" data-id="${change.doc.id}">삭제</button>
                                </div>
                            `;
                        }
                        if (isAdmin() && !isOwner) {
                            actionButtons += `
                                <div class="guestbook-entry-actions">
                                    <button class="guestbook-action-btn blind-btn" data-id="${change.doc.id}" style="color: #dc3545; border-color: #dc3545;">🚨 숨기기</button>
                                    <button class="guestbook-action-btn delete-btn" data-id="${change.doc.id}">삭제</button>
                                </div>
                            `;
                        } else if (isAdmin() && isOwner) {
                            actionButtons = `
                                <div class="guestbook-entry-actions">
                                    <button class="guestbook-action-btn edit-btn" data-id="${change.doc.id}">수정</button>
                                    <button class="guestbook-action-btn blind-btn" data-id="${change.doc.id}" style="color: #dc3545; border-color: #dc3545;">🚨 숨기기</button>
                                    <button class="guestbook-action-btn delete-btn" data-id="${change.doc.id}">삭제</button>
                                </div>
                            `;
                        }
                    }

                    entryDiv.innerHTML = `
                        <div class="guestbook-entry-header" ${opacityStyle}>
                            <span class="guestbook-entry-name">${displayName}</span>
                            <span class="guestbook-entry-date">${formatDate(createdAt)}</span>
                        </div>
                        <div class="guestbook-entry-message" ${opacityStyle}>${displayMessage}</div>
                        ${actionButtons}
                    `;
                }
            }
            if (change.type === "removed") {
                const entryDiv = listContainer.querySelector(`.guestbook-entry[data-doc-id="${change.doc.id}"]`);
                if (entryDiv) {
                    entryDiv.remove();
                }
            }
        });

    }, (error) => {
        console.error("방명록 로딩 중 권한/설정 에러:", error);

        if (error.code === 'permission-denied') {
            listContainer.innerHTML = '<p style="text-align:center; color: red;">파이어베이스 Firestore 규칙(Rules) 설정이 필요합니다.</p>';
        } else {
            const errorP = document.createElement('p');
            errorP.style.cssText = 'text-align:center; color: red;';
            errorP.textContent = '데이터를 불러오는 데 실패했습니다: ' + error.message;
            listContainer.innerHTML = '';
            listContainer.appendChild(errorP);
        }
    });
}

// 2. 새로운 방명록 데이터 저장하기
if (form) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // --- 도배 방지 (프론트엔드 로컬 스토리지 기반 1분 제한) ---
        const lastSubmitTime = localStorage.getItem('lastGuestbookSubmit');
        const now = new Date().getTime();
        const cooldown = 60 * 1000; // 1분 (밀리초)

        if (lastSubmitTime && now - parseInt(lastSubmitTime) < cooldown) {
            const remainingSeconds = Math.ceil((cooldown - (now - parseInt(lastSubmitTime))) / 1000);
            alert(`도배 방지를 위해 1분에 한 번만 글을 작성할 수 있습니다.\n${remainingSeconds}초 후에 다시 시도해주세요.`);
            return;
        }

        if (!currentUser) {
            alert('인증 정보를 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
            return;
        }

        const name = nameInput.value.trim() || '익명';
        const message = messageInput.value.trim();

        if (!message) {
            alert('메시지를 입력해주세요.');
            return;
        }

        if (message.split(/\r\n|\r|\n/).length > 7) {
            alert('메시지는 최대 7줄까지만 입력할 수 있습니다.');
            return;
        }

        // 중복 제출 방지 버튼 비활성화
        submitBtn.disabled = true;
        submitBtn.textContent = '메시지 등록 중...';

        try {
            await addDoc(collection(db, "guestbook"), {
                name: name,
                uid: currentUser.uid, // 익명 로그인 사용자 UID 저장
                message: message,
                createdAt: serverTimestamp() // 파이어베이스 서버의 시간을 기록
            });

            // 등록 성공시 폼 지우기
            nameInput.value = '';
            messageInput.value = '';

            // 성공 시 현재 시간 로컬 스토리지에 저장 (도배 방지용)
            localStorage.setItem('lastGuestbookSubmit', new Date().getTime().toString());

        } catch (error) {
            console.error("데이터 저장 중 에러 발생: ", error);
            alert('메시지 등록에 실패했습니다. Firestore의 권한 규칙을 확인해주세요. 상세 에러: ' + error.message);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = '메시지 남기기';
        }
    });
}

// --- 방명록 수정/삭제 기능 리스너 (이벤트 위임 적용) ---
if (listContainer) {
    listContainer.addEventListener('click', (e) => {
        const targetBtn = e.target;
        if (targetBtn.classList.contains('delete-btn')) {
            const id = targetBtn.getAttribute('data-id');
            handleEntryAction(id, 'delete');
        } else if (targetBtn.classList.contains('edit-btn')) {
            const id = targetBtn.getAttribute('data-id');
            handleEntryAction(id, 'edit');
        } else if (targetBtn.classList.contains('blind-btn')) {
            const id = targetBtn.getAttribute('data-id');
            handleEntryAction(id, 'blind');
        } else if (targetBtn.classList.contains('unblind-btn')) {
            const id = targetBtn.getAttribute('data-id');
            handleEntryAction(id, 'unblind');
        }
    });
}

// 작업 처리 함수 (비밀번호 확인 생략)
let currentEditDocId = null; // 커스텀 모달에서 사용하기 위한 수정 중인 문서 아이디 상태

async function handleEntryAction(docId, action) {
    try {
        const docRef = doc(db, "guestbook", docId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();

            // 관리자인지 검증
            const userIsAdmin = isAdmin();

            // 백엔드는 규칙으로 막지만, 프론트엔드에서도 한 번 더 본인 글이 맞는지 혹은 관리자인지 체크
            if (userIsAdmin || (currentUser && data.uid === currentUser.uid)) {
                if (action === 'delete') {
                    if (confirm('정말로 이 메시지를 삭제하시겠습니까?')) {
                        await deleteDoc(docRef);
                        alert('삭제되었습니다.');
                    }
                } else if (action === 'edit' && (data.uid === currentUser.uid)) {
                    // 커스텀 모달창을 띄우는 로직으로 변경 (기존 prompt 제거)
                    // 관리자라도 타인의 글은 수정 불가 (삭제 및 블라인드만)
                    currentEditDocId = docId;
                    const editModal = document.getElementById('edit-modal');
                    const editMessageInput = document.getElementById('edit-gb-message');
                    if (editModal && editMessageInput) {
                        editMessageInput.value = data.message;
                        document.body.style.overflow = 'hidden';
                        editModal.showModal();
                    }
                } else if (action === 'blind' && userIsAdmin) {
                    if (confirm('이 메시지를 숨김(블라인드) 처리하시겠습니까? 일반 유저에게 보이지 않게 됩니다.')) {
                        await updateDoc(docRef, { isBlinded: true });
                        alert('블라인드 처리되었습니다.');
                    }
                } else if (action === 'unblind' && userIsAdmin) {
                    if (confirm('이 메시지의 숨김을 해제하시겠습니까? 다시 일반 유저에게 보이게 됩니다.')) {
                        await updateDoc(docRef, { isBlinded: false });
                        alert('복구되었습니다.');
                    }
                } else {
                    alert('해당 작업을 수행할 권한이 없습니다.');
                }
            } else {
                alert('요청을 처리할 권한이 없습니다.');
            }
        } else {
            alert('해당 글을 찾을 수 없습니다.');
        }
    } catch (error) {
        console.error("작업 중 오류 발생:", error);
        alert('처리 중 오류가 발생했습니다. 권한이 없거나 네트워크 문제입니다.');
    }
}

// 4. 모달창 내 수정 폼 Submit 이벤트 처리 (비동기 처리)
const editForm = document.getElementById('edit-guestbook-form');
if (editForm) {
    editForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!currentEditDocId) return;

        const editMessageInput = document.getElementById('edit-gb-message');
        const newMessage = editMessageInput.value.trim();
        const submitBtn = editForm.querySelector('.submit-btn');

        if (!newMessage) {
            alert('메시지를 입력해주세요.');
            return;
        }

        if (newMessage.split(/\r\n|\r|\n/).length > 7) {
            alert('메시지는 최대 7줄까지만 입력할 수 있습니다.');
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = '수정 중...';

        try {
            const docRef = doc(db, "guestbook", currentEditDocId);
            await updateDoc(docRef, {
                message: newMessage,
                updatedAt: serverTimestamp() // 수정 시간 기록
            });

            const editModal = document.getElementById('edit-modal');
            if (editModal) {
                editModal.close();
                document.body.style.overflow = 'auto';
            }
            alert('수정되었습니다.');
        } catch (error) {
            console.error("수정 중 오류 발생:", error);
            alert('수정 중 오류가 발생했습니다.');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = '수정 완료';
            currentEditDocId = null; // 상태 초기화
        }
    });
}

// 5. 더 보기 버튼 기능 연결
const loadMoreBtn = document.getElementById('load-more-btn');
if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', () => {
        currentLimit += 50; // 50개 추가로 제한을 늘림
        loadGuestbook(); // 데이터 재요청
    });
}
