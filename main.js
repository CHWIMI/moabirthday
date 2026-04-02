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

        // Start preloading high-res gallery images in the background
        if (typeof preloadGalleryImages === 'function') {
            preloadGalleryImages();
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

        // 탭 전환 시 다른 섹션의 비디오 재생 중단 (팬영상 등)
        resetTheaterVideos();

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

        // 방명록 탭이 활성화될 때 guestbook.js로 신호를 보냄 (지연 로딩 용도)
        if (hash === 'guestbook') {
            window.dispatchEvent(new CustomEvent('guestbookTabOpened'));
        }

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

    // Handle image load event for smooth fade-in and spinner removal
    if (modalImg) {
        modalImg.addEventListener('load', () => {
            modal.classList.remove('loading');
            modalImg.classList.add('loaded');
        });
    }

    // Event delegation for opening modal
    const galleryGrid = document.querySelector('.gallery-grid');
    if (galleryGrid) {
        galleryGrid.addEventListener('click', (e) => {
            const item = e.target.closest('.gallery-item');
            if (!item) return;

            const imageSrc = item.getAttribute('data-src');
            const authorName = item.getAttribute('data-author');
            const descriptionText = item.getAttribute('data-desc');
            const hasWhiteBg = item.getAttribute('data-bg-white') === 'true';

            if (imageSrc) {
                modal.classList.add('loading'); // Show spinner
                modalImg.classList.remove('loaded'); // Hide image initially
                modalImg.src = ''; // Clear previous image to avoid flickering
                modalImg.src = imageSrc;
                modalImg.alt = `Fanart by ${authorName}`;
                modalAuthor.textContent = `Artist: ${authorName}`;
                modalDesc.textContent = descriptionText;

                // Toggle white background for transparent images
                if (hasWhiteBg) {
                    modalImg.classList.add('has-white-bg');
                } else {
                    modalImg.classList.remove('has-white-bg');
                }

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
            modalImg.src = ''; // Clear source to prevent stale image flickering
            modal.classList.remove('loading');
            modalImg.classList.remove('loaded');
        });
    }

    /* --- Edit Guestbook Modal Close Logic --- */
    const editModal = document.getElementById('edit-modal');
    const closeEditBtn = document.querySelector('.close-edit-modal');
    if (closeEditBtn) {
        closeEditBtn.addEventListener('click', () => {
            editModal.close();
            document.body.style.overflow = 'auto';
        });
    }
    if (editModal) {
        editModal.addEventListener('click', (event) => {
            if (event.target === editModal) {
                editModal.close();
                document.body.style.overflow = 'auto';
            }
        });
        editModal.addEventListener('close', () => {
            document.body.style.overflow = 'auto';
        });
    }

    /* --- YouTube Facade Logic --- */
    function resetTheaterVideos() {
        const theaterSection = document.getElementById('theater');
        if (!theaterSection) return;

        const videoContainers = theaterSection.querySelectorAll('.video-container');
        videoContainers.forEach(container => {
            // iframe이 있는 경우(facade 클래스가 없는 경우) 원래 상태로 복구
            if (!container.classList.contains('facade')) {
                const embedId = container.getAttribute('data-embed');
                if (embedId) {
                    container.innerHTML = `
                        <img src="https://img.youtube.com/vi/${embedId}/hqdefault.jpg" alt="YouTube Thumbnail">
                        <button class="play-button" aria-label="Play Video"></button>
                    `;
                    container.classList.add('facade');
                }
            }
        });
    }

    const facadeVideos = document.querySelectorAll('.video-container.facade');
    facadeVideos.forEach(video => {
        video.addEventListener('click', () => {
            const embedId = video.getAttribute('data-embed');
            if (!embedId) return;

            const iframe = document.createElement('iframe');
            iframe.setAttribute('frameborder', '0');
            iframe.setAttribute('allowfullscreen', 'true');
            iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share');
            iframe.setAttribute('src', `https://www.youtube.com/embed/${embedId}?autoplay=1`);

            iframe.style.width = '100%';
            iframe.style.aspectRatio = '16 / 9';
            iframe.style.height = 'auto';
            iframe.style.borderRadius = '10px';

            // 썸네일 비우고 iframe 삽입
            video.innerHTML = '';
            video.appendChild(iframe);
            video.classList.remove('facade');
        });
    });

    /* --- Easter Egg #1: 빨간 모아의 복구 작전 (1회성) --- */
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

                // 3.5초 후 빨간 모아 복구 시퀀스 시작
                setTimeout(() => startRedMoaRestoration(), 3500);
            }
        });
    }

    function startRedMoaRestoration() {
        const plaque = document.querySelector('.artwork-plaque');
        const plaqueHeader = document.querySelector('.plaque-header');
        if (!artworkTitle || !plaque || !plaqueHeader) return;

        // 현재 텍스트를 개별 span으로 분해
        const currentText = '모아는 티라노가 맞다';
        artworkTitle.innerHTML = '';

        const charSpans = [];
        for (const ch of currentText) {
            const span = document.createElement('span');
            span.textContent = ch;
            span.style.display = 'inline-block';
            span.style.transition = 'opacity 0.3s ease, color 0.3s ease';
            artworkTitle.appendChild(span);
            charSpans.push(span);
        }

        // favicon 컨테이너 재생성
        const favSpan = document.createElement('span');
        favSpan.style.display = 'inline-block';
        favSpan.style.transition = 'opacity 0.3s ease';
        favSpan.innerHTML = '\u00A0';
        const favImg = document.createElement('img');
        favImg.src = 'favicon.png';
        favImg.alt = '';
        favImg.classList.add('easter-egg-icon');
        favSpan.appendChild(favImg);
        artworkTitle.appendChild(favSpan);

        // 빨간 모아 생성
        const redMoa = document.createElement('img');
        redMoa.src = 'img/egg red.gif';
        redMoa.alt = '';
        redMoa.classList.add('egg-walker');
        redMoa.style.transform = 'scaleX(-1)'; // 왼쪽을 바라봄
        redMoa.style.top = '50%';
        redMoa.style.marginTop = '-24px';
        redMoa.style.transition = 'left 0.5s ease, opacity 0.4s ease';

        // plaque 오른쪽 바깥에서 시작
        plaqueHeader.style.position = 'relative';
        redMoa.style.left = (plaqueHeader.offsetWidth + 10) + 'px';
        plaqueHeader.appendChild(redMoa);

        // 복구 단계 정의 (오른쪽→왼쪽)
        // charSpans: [모0 아1 는2 ' '3 티4 라5 노6 가7 ' '8 맞9 다10]
        const steps = [
            // favicon 제거
            () => { favSpan.style.opacity = '0'; },
            // 다(10) — 유지, 통과
            null,
            // 맞(9) — 유지, 통과
            null,
            // ' '(8) — 유지, 통과
            null,
            // 가(7) — 유지, 통과
            null,
            // 노(6) — 삭제 (페이드아웃+가로축소)
            () => {
                charSpans[6].classList.add('char-fade-collapse');
            },
            // 라(5) → 초
            () => {
                charSpans[5].textContent = '초';
                charSpans[5].classList.add('char-restore-flash');
            },
            // 티(4) → 청
            () => {
                charSpans[4].textContent = '청';
                charSpans[4].classList.add('char-restore-flash');
            },
        ];

        // 스텝 실행에 사용할 요소들 (오른쪽→왼쪽 순서)
        const stepTargets = [favSpan, charSpans[10], charSpans[9], charSpans[8], charSpans[7], charSpans[6], charSpans[5], charSpans[4]];

        let stepIdx = 0;

        // Phase 1: 입장 — favicon 옆으로 이동
        setTimeout(() => {
            const favRect = favSpan.getBoundingClientRect();
            const headerRect = plaqueHeader.getBoundingClientRect();
            redMoa.style.left = (favRect.right - headerRect.left + 4) + 'px';
        }, 50);

        // Phase 2: 복구 시퀀스
        setTimeout(() => {
            const interval = setInterval(() => {
                if (stepIdx >= steps.length) {
                    clearInterval(interval);
                    // Phase 3: 퇴장 — 왼쪽으로 걸어나감
                    redMoa.style.left = '-60px';
                    redMoa.style.opacity = '0';
                    setTimeout(() => {
                        redMoa.remove();
                        // 최종 텍스트로 깔끔하게 정리
                        artworkTitle.textContent = '모아는 청초가 맞다';
                    }, 600);
                    return;
                }

                // 현재 스텝의 타겟 요소 옆으로 빨간 모아 이동
                const target = stepTargets[stepIdx];
                if (target) {
                    const tRect = target.getBoundingClientRect();
                    const hRect = plaqueHeader.getBoundingClientRect();
                    redMoa.style.left = (tRect.left - hRect.left - 50) + 'px';
                }

                // 액션 실행
                if (steps[stepIdx]) steps[stepIdx]();
                stepIdx++;
            }, 400);
        }, 800); // 입장 애니메이션 대기
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

    /* --- Easter Egg #2: 04:09 & 16:09 크레딧 산책 --- */
    let isTimeEggActive = false;

    function checkTimeEasterEgg() {
        if (isTimeEggActive) return;
        const now = new Date();
        const h = now.getHours();
        const m = now.getMinutes();
        if ((h === 4 || h === 16) && m === 9) {
            startTimeWalker();
        }
    }

    function startTimeWalker() {
        isTimeEggActive = true;
        const creditsList = document.querySelector('.credits-list');
        if (!creditsList) return;

        const walker = document.createElement('img');
        walker.src = 'img/egg.gif';
        walker.alt = '';
        walker.classList.add('egg-walker');
        walker.style.top = '10px';
        walker.style.left = '20px';
        walker.style.opacity = '0';
        walker.style.transition = 'opacity 0.6s ease';
        creditsList.appendChild(walker);

        // 텍스트 요소 위치 계산 (충돌 회피용)
        function getTextRects() {
            const listRect = creditsList.getBoundingClientRect();
            const children = creditsList.querySelectorAll('p, .secret-credit-area');
            return Array.from(children).map(el => {
                const r = el.getBoundingClientRect();
                return {
                    left: r.left - listRect.left - 8,
                    top: r.top - listRect.top - 8,
                    right: r.right - listRect.left + 8,
                    bottom: r.bottom - listRect.top + 8,
                };
            });
        }

        function overlapsText(x, y, textRects) {
            return textRects.some(tr =>
                x < tr.right && (x + 48) > tr.left &&
                y < tr.bottom && (y + 48) > tr.top
            );
        }

        // 페이드 인
        requestAnimationFrame(() => {
            requestAnimationFrame(() => { walker.style.opacity = '1'; });
        });

        // 랜덤 워크 (글자 회피)
        let walkTimeout;
        function randomWalk() {
            const maxX = creditsList.offsetWidth - 58;
            const maxY = creditsList.offsetHeight - 58;
            const textRects = getTextRects();

            let targetX, targetY;
            let attempts = 0;
            do {
                targetX = 10 + Math.random() * Math.max(0, maxX);
                targetY = 10 + Math.random() * Math.max(0, maxY);
                attempts++;
            } while (overlapsText(targetX, targetY, textRects) && attempts < 30);

            const currentLeft = parseFloat(walker.style.left) || 20;

            // 이동 방향에 따라 좌우 반전
            if (targetX < currentLeft) {
                walker.style.transform = 'scaleX(-1)';
            } else {
                walker.style.transform = 'scaleX(1)';
            }

            walker.style.transition = 'left 2.5s ease-in-out, top 2.5s ease-in-out, opacity 0.6s ease, transform 0.15s';
            walker.style.left = targetX + 'px';
            walker.style.top = targetY + 'px';

            walkTimeout = setTimeout(randomWalk, 2800 + Math.random() * 1200);
        }

        setTimeout(randomWalk, 600);

        // 60초 후 자동 종료 — 멈춘 자리에서 사라짐
        setTimeout(() => {
            clearTimeout(walkTimeout);

            // 현재 이동 중인 transition을 즉시 정지
            const computed = window.getComputedStyle(walker);
            const frozenLeft = computed.left;
            const frozenTop = computed.top;
            walker.style.transition = 'none';
            walker.style.left = frozenLeft;
            walker.style.top = frozenTop;

            // 정지 후 페이드 아웃
            requestAnimationFrame(() => {
                walker.style.transition = 'opacity 0.8s ease';
                walker.style.opacity = '0';
                setTimeout(() => {
                    walker.remove();
                    isTimeEggActive = false;
                }, 900);
            });
        }, 60000);
    }

    // 30초마다 시간 체크 (페이지가 열려 있을 때만 동작)
    setInterval(checkTimeEasterEgg, 30000);
    checkTimeEasterEgg(); // 초기 로드 시에도 체크

    /* --- Easter Egg #3: 카페 안내원 모아 (SNS footer 산책 + 점프) --- */
    let idleTimer = null;
    let isFooterEggActive = false;
    let footerWalkerEl = null;
    let footerAnimFrame = null;

    // idle 감지: 유저 활동 시 타이머 리셋
    function resetIdleTimer() {
        clearTimeout(idleTimer);
        if (isFooterEggActive) {
            dismissFooterWalker();
        }
        idleTimer = setTimeout(spawnFooterWalker, 30000);
    }

    const idleEvents = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'];
    idleEvents.forEach(evt => window.addEventListener(evt, resetIdleTimer, { passive: true }));
    idleTimer = setTimeout(spawnFooterWalker, 30000);

    function spawnFooterWalker() {
        if (isFooterEggActive) return;
        const footer = document.querySelector('#main-page footer');
        if (!footer) return;

        // 메인 페이지가 활성화된 상태에서만 동작
        const mainPage = document.getElementById('main-page');
        if (!mainPage || mainPage.classList.contains('hidden')) return;

        isFooterEggActive = true;

        const walker = document.createElement('img');
        walker.src = 'img/egg.gif';
        walker.alt = '';
        walker.classList.add('egg-walker');
        walker.style.bottom = '6px';
        walker.style.left = '-48px';
        walker.style.opacity = '0';
        walker.style.transition = 'opacity 0.5s ease';
        footer.appendChild(walker);
        footerWalkerEl = walker;

        // SNS 버튼 위치 계산 (점프 트리거용)
        const snsButtons = footer.querySelectorAll('.sns-btn');
        const footerRect = footer.getBoundingClientRect();
        const jumpTriggerXs = Array.from(snsButtons).map(btn => {
            const bRect = btn.getBoundingClientRect();
            return bRect.left - footerRect.left + bRect.width / 2;
        });

        // 페이드 인
        requestAnimationFrame(() => {
            requestAnimationFrame(() => { walker.style.opacity = '1'; });
        });

        // 걷기 로직 (requestAnimationFrame)
        let currentX = -48;
        let direction = 1; // 1=오른쪽, -1=왼쪽
        let isJumping = false;
        const speed = 0.8; // px/frame
        const jumpedOver = new Set(); // 이미 점프한 버튼 (방향별)

        function walkLoop() {
            if (!footerWalkerEl) return;

            const footerW = footer.offsetWidth;
            currentX += direction * speed;

            // 방향 전환 (경계 도달)
            if (currentX >= footerW - 48) {
                direction = -1;
                walker.style.transform = 'scaleX(-1)';
                jumpedOver.clear();
            } else if (currentX <= 0) {
                direction = 1;
                walker.style.transform = 'scaleX(1)';
                jumpedOver.clear();
            }

            walker.style.left = currentX + 'px';

            // SNS 아이콘 위를 지날 때 점프
            if (!isJumping) {
                const walkerCenter = currentX + 24;
                for (let i = 0; i < jumpTriggerXs.length; i++) {
                    const btnX = jumpTriggerXs[i];
                    const key = i + '_' + direction;
                    if (!jumpedOver.has(key) && Math.abs(walkerCenter - btnX) < 5) {
                        jumpedOver.add(key);
                        triggerFooterJump(walker, direction);
                        break;
                    }
                }
            }

            footerAnimFrame = requestAnimationFrame(walkLoop);
        }

        function triggerFooterJump(el, dir) {
            if (isJumping) return;
            isJumping = true;
            const jumpHeight = 18;
            const jumpDuration = 420;
            const startTime = performance.now();

            function jumpFrame(now) {
                const elapsed = now - startTime;
                const t = Math.min(elapsed / jumpDuration, 1);
                // 포물선: y = -4h(t-0.5)² + h
                const y = Math.max(0, -4 * jumpHeight * (t - 0.5) * (t - 0.5) + jumpHeight);
                const scaleDir = dir === -1 ? -1 : 1;
                el.style.transform = `scaleX(${scaleDir}) translateY(${-y}px)`;

                if (t < 1) {
                    requestAnimationFrame(jumpFrame);
                } else {
                    el.style.transform = `scaleX(${scaleDir})`;
                    isJumping = false;
                }
            }
            requestAnimationFrame(jumpFrame);
        }

        // 입장 후 걷기 시작
        setTimeout(() => {
            currentX = 5;
            walker.style.left = '5px';
            walkLoop();
        }, 600);
    }

    function dismissFooterWalker() {
        if (!footerWalkerEl) return;
        cancelAnimationFrame(footerAnimFrame);
        footerAnimFrame = null;

        const walker = footerWalkerEl;
        const footer = walker.parentElement;
        if (!footer) { footerWalkerEl = null; isFooterEggActive = false; return; }

        // 가장 가까운 가장자리로 퇴장
        const currentLeft = parseFloat(walker.style.left) || 0;
        const footerW = footer.offsetWidth;
        const exitLeft = currentLeft < footerW / 2 ? -60 : footerW + 10;
        const exitDir = exitLeft < 0 ? -1 : 1;

        walker.style.transform = `scaleX(${exitDir})`;
        walker.style.transition = 'left 0.8s ease, opacity 0.6s ease 0.3s';
        walker.style.left = exitLeft + 'px';
        walker.style.opacity = '0';

        setTimeout(() => {
            walker.remove();
            footerWalkerEl = null;
            isFooterEggActive = false;
        }, 1000);
    }

    /* --- Smart Sequential Preloading --- */
    function preloadGalleryImages() {
        const galleryItems = document.querySelectorAll('.gallery-item');
        const sources = Array.from(galleryItems)
            .map(item => item.getAttribute('data-src'))
            .filter(src => src && src.trim() !== '');

        if (sources.length === 0) return;

        let currentIndex = 0;

        function loadNext() {
            if (currentIndex >= sources.length) return;

            const img = new Image();
            img.onload = () => {
                // Success - wait a bit then load next to be gentle on network/CPU
                currentIndex++;
                setTimeout(loadNext, 150);
            };
            img.onerror = () => {
                // Skip if load fails
                currentIndex++;
                loadNext();
            };
            img.src = sources[currentIndex];
        }

        // Delay preloading slightly after main page loads to ensure UI smoothness
        if ('requestIdleCallback' in window) {
            window.requestIdleCallback(() => {
                setTimeout(loadNext, 1000);
            });
        } else {
            setTimeout(loadNext, 2000);
        }
    }
});
