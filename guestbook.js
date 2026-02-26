// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-analytics.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, doc, deleteDoc, updateDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";

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

// 익명 로그인 수행
signInAnonymously(auth).catch((error) => {
    console.error("익명 로그인 실패:", error);
});

// 로그인 상태 감지
onAuthStateChanged(auth, (user) => {
    currentUser = user;
    // 처음 로그인 상태가 확인되면 방명록을 불러옵니다.
    if (!guestbookLoaded && user) {
        guestbookLoaded = true;
        loadGuestbook();
    }
});

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
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${year}.${month}.${day} ${hours}:${minutes}`;
}

// 1. 방명록 데이터 불러오기 (실시간 청취)
function loadGuestbook() {
    if (!listContainer) return;
    const q = query(collection(db, "guestbook"), orderBy("createdAt", "desc"));

    onSnapshot(q, (snapshot) => {
        listContainer.innerHTML = ''; // 기존 목록 초기화

        if (snapshot.empty) {
            listContainer.innerHTML = '<p style="text-align:center; color: var(--text-light);">아직 작성된 메시지가 없습니다. 첫 번째 축하 메시지를 남겨주세요!</p>';
            return;
        }

        snapshot.forEach((doc) => {
            const data = doc.data();
            const createdAt = data.createdAt ? data.createdAt.toDate() : new Date(); // 로컬에선 아직 서버 반영 안됐을 수 있으므로 대비

            const entryDiv = document.createElement('div');
            entryDiv.className = 'guestbook-entry';

            // 자신이 작성한 글인지 확인하여 수정/삭제 버튼 노출 여부 결정
            const isOwner = currentUser && data.uid === currentUser.uid;
            const actionButtons = isOwner ? `
                <div class="guestbook-entry-actions">
                    <button class="guestbook-action-btn edit-btn" data-id="${doc.id}">수정</button>
                    <button class="guestbook-action-btn delete-btn" data-id="${doc.id}">삭제</button>
                </div>
            ` : '';

            entryDiv.innerHTML = `
                <div class="guestbook-entry-header">
                    <span class="guestbook-entry-name">${escapeHtml(data.name || '익명')}</span>
                    <span class="guestbook-entry-date">${formatDate(createdAt)}</span>
                </div>
                <div class="guestbook-entry-message">${escapeHtml(data.message).replace(/\n/g, '<br>')}</div>
                ${actionButtons}
            `;
            listContainer.appendChild(entryDiv);
        });

        // 삭제/수정 버튼 이벤트 리스너 등록
        attachActionListeners();
    }, (error) => {
        console.error("방명록 로딩 중 권한/설정 에러:", error);

        if (error.code === 'permission-denied') {
            listContainer.innerHTML = '<p style="text-align:center; color: red;">파이어베이스 Firestore 규칙(Rules) 설정이 필요합니다.</p>';
        } else {
            listContainer.innerHTML = `<p style="text-align:center; color: red;">데이터를 불러오는 데 실패했습니다: ${error.message}</p>`;
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

// --- 수정/삭제 기능 로직 ---
function attachActionListeners() {
    const deleteBtns = document.querySelectorAll('.delete-btn');
    const editBtns = document.querySelectorAll('.edit-btn');

    deleteBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-id');
            handleEntryAction(id, 'delete');
        });
    });

    editBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-id');
            handleEntryAction(id, 'edit');
        });
    });
}

// 작업 처리 함수 (비밀번호 확인 생략)
async function handleEntryAction(docId, action) {
    try {
        const docRef = doc(db, "guestbook", docId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();

            // 백엔드는 규칙으로 막지만, 프론트엔드에서도 한 번 더 본인 글이 맞는지 체크
            if (currentUser && data.uid === currentUser.uid) {
                if (action === 'delete') {
                    if (confirm('정말로 이 메시지를 삭제하시겠습니까?')) {
                        await deleteDoc(docRef);
                        alert('삭제되었습니다.');
                    }
                } else if (action === 'edit') {
                    const newMessage = prompt('수정할 메시지를 입력하세요.', data.message);
                    if (newMessage !== null && newMessage.trim() !== '') {
                        await updateDoc(docRef, {
                            message: newMessage.trim(),
                            updatedAt: serverTimestamp() // 수정 시간 기록
                        });
                        alert('수정되었습니다.');
                    }
                }
            } else {
                alert('본인이 작성한 글만 수정/삭제할 수 있습니다.');
            }
        } else {
            alert('해당 글을 찾을 수 없습니다.');
        }
    } catch (error) {
        console.error("수정/삭제 중 오류 발생:", error);
        alert('처리 중 오류가 발생했습니다. 권한이 없거나 네트워크 문제입니다.');
    }
}
