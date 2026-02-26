import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

// TODO: 파이어베이스 설정
// 1. 파이어베이스 콘솔 -> 프로젝트 설정 -> 내 앱 -> Firebase SDK snippet의 설정을 복사해서 교체하세요.
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// DOM 요소를 가져옵니다.
const form = document.getElementById('guestbook-form');
const nameInput = document.getElementById('gb-name');
const messageInput = document.getElementById('gb-message');
const listContainer = document.getElementById('guestbook-list');
const submitBtn = form?.querySelector('.submit-btn');

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
            `;
            listContainer.appendChild(entryDiv);
        });
    }, (error) => {
        console.error("방명록 로딩 중 권한/설정 에러:", error);

        if (firebaseConfig.apiKey === "YOUR_API_KEY") {
            listContainer.innerHTML = '<p style="text-align:center; color: red; font-weight: bold;">※ guestbook.js 파일에서 파이어베이스 설정을 먼저 완료해주세요.</p>';
        } else if (error.code === 'permission-denied') {
            listContainer.innerHTML = '<p style="text-align:center; color: red;">파이어베이스 Firestore 규칙(Rules) 설정이 필요합니다.</p>';
        }
    });
}

// 2. 새로운 방명록 데이터 저장하기
if (form) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // 설정이 제대로 되었는지 기본적인 체크
        if (firebaseConfig.apiKey === "YOUR_API_KEY") {
            alert('guestbook.js 파일에서 파이어베이스 설정(firebaseConfig)을 먼저 입력해주세요!');
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
                message: message,
                createdAt: serverTimestamp() // 파이어베이스 서버의 시간을 기록
            });

            // 등록 성공시 폼 지우기
            nameInput.value = '';
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
