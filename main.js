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

        // Initialize hash history if needed
        if (!window.location.hash) {
            window.history.replaceState(null, '', '#billboard');
        } else {
            handleHashChange(); // If entered with a hash, show it immediately
        }
    });

    /* --- Hash-based Navigation Logic (History API) --- */
    const menuBar = document.querySelector('.menu-bar');
    if (menuBar) {
        // Clicking nav button changes the hash (instead of directly changing DOM)
        menuBar.addEventListener('click', (e) => {
            const btn = e.target.closest('.nav-btn');
            if (!btn) return;
            e.preventDefault();
            const targetId = btn.getAttribute('data-target');

            // Use pushState to avoid native scroll jump to ID
            window.history.pushState(null, '', '#' + targetId);
            handleHashChange(); // Manually trigger update

            // Blur the button to fix sticky hover/focus on mobile
            btn.blur();
        });
    }

    // Listen to history changes (back button or nav click) and hash changes
    window.addEventListener('popstate', handleHashChange);
    window.addEventListener('hashchange', handleHashChange);

    function handleHashChange() {
        const hash = window.location.hash.replace('#', '') || 'billboard';
        const targetSection = document.getElementById(hash);
        const targetBtn = document.querySelector(`.nav-btn[data-target="${hash}"]`);

        if (!targetSection || !targetBtn) return;

        // Remove active classes
        document.querySelectorAll('.nav-btn.active').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.content-section.active').forEach(section => {
            section.classList.add('hidden');
            section.classList.remove('active', 'fade-in');
        });

        // Add active class to targets
        targetBtn.classList.add('active');
        targetSection.classList.remove('hidden');
        targetSection.classList.add('active', 'fade-in');

        // Scroll to top to ensure consistent view position
        window.scrollTo(0, 0);
    }

    /* --- Hide-On-Scroll Header Logic --- */
    const header = document.querySelector('header');
    if (header) {
        let isScrolling = false;
        window.addEventListener('scroll', () => {
            if (!isScrolling) {
                window.requestAnimationFrame(() => {
                    if (window.scrollY > 50) {
                        header.classList.add('hide-header');
                    } else {
                        header.classList.remove('hide-header');
                    }
                    isScrolling = false;
                });
                isScrolling = true;
            }
        });
    }

    /* --- SNS Footer Logic --- */
    const snsLinks = {
        '치지직': 'https://chzzk.naver.com/61958008140886fe1eda9910cfef5812',
        '유튜브': 'https://youtube.com/@모아',
        '인스타그램': 'https://instagram.com/serenity_moa',
        '네이버 카페': 'https://cafe.naver.com/moa0409',
    };

    const snsContainer = document.querySelector('.sns-container');
    if (snsContainer) {
        snsContainer.addEventListener('click', (e) => {
            const btn = e.target.closest('.sns-btn');
            if (!btn) return;
            e.preventDefault();
            const snsName = btn.getAttribute('data-sns');
            const link = snsLinks[snsName];

            if (link) {
                window.open(link, '_blank', 'noopener,noreferrer');
            } else {
                alert(`[${snsName}] 올바른 링크가 아닙니다.`);
            }
        });
    }

    /* --- Gallery Modal Logic (<dialog>) --- */
    const modal = document.getElementById('image-modal');
    const modalImg = document.getElementById('modal-img');
    const modalAuthor = document.getElementById('modal-author');
    const modalDesc = document.getElementById('modal-desc');
    const closeBtn = document.querySelector('.close-modal');

    // Event delegation for opening modal
    const galleryGrid = document.querySelector('.gallery-grid');
    if (galleryGrid) {
        galleryGrid.addEventListener('click', (e) => {
            const item = e.target.closest('.gallery-item');
            if (!item) return;

            const imageSrc = item.getAttribute('data-src');
            const authorName = item.getAttribute('data-author');
            const descriptionText = item.getAttribute('data-desc');

            if (imageSrc) {
                modalImg.src = imageSrc;
                modalImg.alt = `Fanart by ${authorName}`;
                modalAuthor.textContent = `Artist: ${authorName}`;
                modalDesc.textContent = descriptionText;

                modal.showModal();
                document.body.style.overflow = 'hidden';
            }
        });
    }

    // Close on 'X' click
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            modal.close();
            document.body.style.overflow = 'auto';
        });
    }

    // Close on background click
    if (modal) {
        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                modal.close();
                document.body.style.overflow = 'auto';
            }
        });
    }
    // Note: <dialog> handles Escape key automatically.
    if (modal) {
        modal.addEventListener('close', () => {
            document.body.style.overflow = 'auto'; // Restore scroll state when dialog closes natively
        });
    }

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
                artworkTitle.textContent = '모아는 티라노가 ';

                const wrapper = document.createElement('span');
                wrapper.style.whiteSpace = 'nowrap';
                wrapper.textContent = '맞다\u00A0';

                const img = document.createElement('img');
                img.src = 'favicon.png';
                img.alt = '티라노 뫄';
                img.classList.add('easter-egg-icon');

                wrapper.appendChild(img);
                artworkTitle.appendChild(wrapper);

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
                    window.clipboardData.setData('Text', hiddenMessage);
                }
            }
        });
    }

    const secretCreditArea = document.querySelector('.secret-credit-area');
    if (secretCreditArea) {
        secretCreditArea.addEventListener('click', () => {
            secretCreditArea.classList.toggle('revealed');
        });
    }
});
