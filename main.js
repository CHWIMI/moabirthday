/**
 * main.js
 * Logic for Moa's Birthday Cafe web application
 */

document.addEventListener('DOMContentLoaded', () => {

    /* --- Page Entry Logic --- */
    const enterBtn = document.getElementById('enter-btn');
    const introPage = document.getElementById('intro-page');
    const mainPage = document.getElementById('main-page');

    enterBtn.addEventListener('click', () => {
        introPage.classList.add('hidden');
        introPage.classList.remove('active');
        mainPage.classList.remove('hidden');
        mainPage.classList.add('active');
        mainPage.classList.add('fade-in'); // Add animation class
    });

    /* --- Navigation Logic --- */
    const navButtons = document.querySelectorAll('.nav-btn');
    const contentSections = document.querySelectorAll('.content-section');

    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active classes from all buttons
            navButtons.forEach(b => b.classList.remove('active'));
            // Add active class to clicked button
            btn.classList.add('active');

            // Hide all sections
            contentSections.forEach(section => {
                section.classList.add('hidden');
                section.classList.remove('active', 'fade-in');
            });

            // Show target section
            const targetId = btn.getAttribute('data-target');
            const targetSection = document.getElementById(targetId);

            if (targetSection) {
                targetSection.classList.remove('hidden');
                targetSection.classList.add('active', 'fade-in'); // Add fade-in for smooth transition
            }
        });
    });

    /* --- SNS Footer Logic --- */
    const snsButtons = document.querySelectorAll('.sns-btn');

    // SNS Link
    const snsLinks = {
        '치지직': 'https://chzzk.naver.com/61958008140886fe1eda9910cfef5812',
        '유튜브': 'https://youtube.com/@모아',
        '인스타그램': 'https://instagram.com/serenity_moa',
        '네이버 카페': 'https://cafe.naver.com/moa0409',
    };

    snsButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault(); // Prevent default link behavior if wrapped in <a>
            const snsName = btn.getAttribute('data-sns');
            const link = snsLinks[snsName];

            if (link && link !== 'https://chzzk.naver.com/' && link !== 'https://youtube.com/' && link !== 'https://instagram.com/' && link !== 'https://cafe.naver.com/') {
                // 정확한 주소가 입력되었을 때만 열리도록 처리 (임시 방어코드)
                window.open(link, '_blank');
            } else if (link) {
                window.open(link, '_blank'); // 현재는 기본 링크로도 열리게 둠
            } else {
                alert(`[${snsName}] 기능은 준비중입니다.`);
            }
        });
    });

    /* --- Modal Close Logic --- */
    const modal = document.getElementById('image-modal');
    const closeBtn = document.querySelector('.close-modal');

    // Close on 'X' click
    closeBtn.addEventListener('click', () => {
        closeModal();
    });

    // Close on background click
    window.addEventListener('click', (event) => {
        if (event.target === modal) {
            closeModal();
        }
    });

    // Close on Escape key press
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.style.display === 'block') {
            closeModal();
        }
    });

    /* --- Easter Egg Logic --- */
    const artworkTitle = document.querySelector('.artwork-title');
    let clickCount = 0;
    let clickTimer;
    let isEasterEggTriggered = false;

    if (artworkTitle) {
        artworkTitle.addEventListener('click', () => {
            if (isEasterEggTriggered) return;

            clickCount++;

            clearTimeout(clickTimer);
            clickTimer = setTimeout(() => {
                clickCount = 0;
            }, 1500);

            if (clickCount >= 5) {
                artworkTitle.textContent = "모아는 티라노가 맞다 🦖";
                isEasterEggTriggered = true;
                clickCount = 0;
            }
        });
    }

    /* --- Hidden Message Easter Egg --- */
    const creditsSection = document.getElementById('credits');
    if (creditsSection) {
        creditsSection.addEventListener('copy', (event) => {
            const selectedText = window.getSelection().toString();
            if (selectedText.length > 0) {
                event.preventDefault();
                const hiddenMessage = selectedText + "\n\n[SYSTEM] SERENITY : TO BE CONTINUED...";

                if (event.clipboardData) {
                    event.clipboardData.setData('text/plain', hiddenMessage);
                } else if (window.clipboardData) {
                    // For older IE support, just in case
                    window.clipboardData.setData('Text', hiddenMessage);
                }
            }
        });
    }
});

/* --- Gallery Modal Functions (Global scope for onclick attributes) --- */
const modal = document.getElementById('image-modal');
const modalImg = document.getElementById('modal-img');
const modalAuthor = document.getElementById('modal-author');
const modalDesc = document.getElementById('modal-desc');

// Function called by inline onclick in HTML
window.openModal = function (imageSrc, authorName, descriptionText) {
    if (!modal) return;

    modalImg.src = imageSrc;
    modalImg.alt = `Fanart by ${authorName}`;
    modalAuthor.textContent = `Artist: ${authorName}`;
    modalDesc.textContent = descriptionText;

    modal.style.display = 'block';
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
};

window.closeModal = function () {
    if (!modal) return;
    modal.style.display = 'none';
    modalImg.src = ''; // Clear source
    document.body.style.overflow = 'auto'; // Restore background scrolling
};
