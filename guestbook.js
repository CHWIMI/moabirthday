// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-analytics.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, doc, deleteDoc, updateDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

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

// DOM 요소를 가져옵니다.
const form = document.getElementById('guestbook-form');
const nameInput = document.getElementById('gb-name');
const passwordInput = document.getElementById('gb-password');
const messageInput = document.getElementById('gb-message');
const listContainer = document.getElementById('guestbook-list');
const submitBtn = form?.querySelector('.submit-btn');

// 비밀번호 해시 암호화 함수 (SHA-256)
async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
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
if (listContainer) {
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

            entryDiv.innerHTML = `
                <div class="guestbook-entry-header">
                    <span class="guestbook-entry-name">${data.name || '익명'}</span>
                    <span class="guestbook-entry-date">${formatDate(createdAt)}</span>
                </div>
                <div class="guestbook-entry-message">${data.message}</div>
                <div class="guestbook-entry-actions">
                    <button class="guestbook-action-btn edit-btn" data-id="${doc.id}">수정</button>
                    <button class="guestbook-action-btn delete-btn" data-id="${doc.id}">삭제</button>
                </div>
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

        // 빈 칸 제출 체크

        const name = nameInput.value.trim() || '익명';
        const password = passwordInput.value.trim();
        const message = messageInput.value.trim();

        if (!password || password.length < 4) {
            alert('비밀번호 4자리를 입력해주세요.');
            return;
        }

        if (!message) {
            alert('메시지를 입력해주세요.');
            return;
        }

        // 중복 제출 방지 버튼 비활성화
        submitBtn.disabled = true;
        submitBtn.textContent = '메시지 등록 중...';

        try {
            const hashedPassword = await hashPassword(password);
            await addDoc(collection(db, "guestbook"), {
                name: name,
                password: hashedPassword, // 암호화된 비밀번호 저장
                message: message,
                createdAt: serverTimestamp() // 파이어베이스 서버의 시간을 기록
            });

            // 등록 성공시 폼 지우기
            nameInput.value = '';
            passwordInput.value = '';
            messageInput.value = '';
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
            showPasswordPrompt(id, 'delete');
        });
    });

    editBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-id');
            showPasswordPrompt(id, 'edit');
        });
    });
}

// 비밀번호 확인 프롬프트
async function showPasswordPrompt(docId, action) {
    const actionText = action === 'delete' ? '삭제' : '수정';
    const inputPwd = prompt(`글을 ${actionText}하시려면 비밀번호 4자리를 입력하세요.`);
    if (!inputPwd) return; // 취소 누름

    try {
        // 서버에서 해당 문서 정보 가져오기
        const docRef = doc(db, "guestbook", docId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            const inputHash = await hashPassword(inputPwd);

            // 구버전(비밀번호 없는 글)이거나 비밀번호가 일치하는 경우
            if (!data.password || data.password === inputHash) {
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
                alert('비밀번호가 일치하지 않습니다.');
            }
        } else {
            alert('해당 글을 찾을 수 없습니다.');
        }
    } catch (error) {
        console.error("수정/삭제 중 오류 발생:", error);
        alert('처리 중 오류가 발생했습니다. 권한이 없거나 네트워크 문제입니다.');
    }
}
