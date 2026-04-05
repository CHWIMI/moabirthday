/**
 * minigame.js
 * Chrome Dino-style runner game for Moa's Birthday Cafe
 * Triggered by catching the footer easter egg walker
 */

(function () {
    'use strict';

    // ========== Firebase Config (same as guestbook) ==========
    const FIREBASE_CONFIG = {
        apiKey: "AIzaSyBc4G014Sx42HHQNSfKFttHLGWpEIdK9CA",
        authDomain: "moabirthday-2b4f2.firebaseapp.com",
        projectId: "moabirthday-2b4f2",
        storageBucket: "moabirthday-2b4f2.firebasestorage.app",
    };
    const LEADERBOARD_DOC = 'minigame_leaderboard';
    const LEADERBOARD_COLLECTION = 'minigame';
    const MAX_LEADERBOARD = 10;

    // ========== DOM Elements ==========
    const modal = document.getElementById('minigame-modal');
    const canvas = document.getElementById('game-canvas');
    const ctx = canvas ? canvas.getContext('2d') : null;
    const scoreDisplay = document.getElementById('minigame-score');
    const overlay = document.getElementById('game-overlay');
    const overlayTitle = document.getElementById('game-overlay-title');
    const overlaySubtitle = document.getElementById('game-overlay-subtitle');
    const leaderboardList = document.getElementById('leaderboard-list');
    const playerEl = document.getElementById('game-player');

    // ========== Game Constants ==========
    const CANVAS_W = 700;
    const CANVAS_H = 200;
    const GROUND_Y = CANVAS_H - 30;
    const PLAYER_W = 40;
    const PLAYER_H = 40;
    const GRAVITY = 0.6;
    const JUMP_FORCE = -11;
    const INITIAL_SPEED = 4;
    const MAX_SPEED = 18;
    const SPEED_INCREMENT = 0.003;
    const OBSTACLE_MIN_GAP = 120;
    const OBSTACLE_MAX_GAP = 200;
    // 캐릭터 변경 추가 (409점 이상)
    const EVOLUTION_SCORE = 409; // 캐릭터가 변경될 점수
    const DEFAULT_PLAYER_GIF = 'img/egg.gif'; // 기본 캐릭터
    const EVOLVED_PLAYER_GIF = 'game.gif'; // 409점 이후 캐릭터

    // Theme colors (matching site's pastel pink)
    const COLOR_GROUND = '#FF8DA1';
    const COLOR_GROUND_LINE = '#FFB6C1';
    const COLOR_OBSTACLE = '#FF8DA1';
    const COLOR_OBSTACLE_DARK = '#FF6680';
    const COLOR_BG = '#FFF5F6';
    const COLOR_CLOUD = 'rgba(255, 182, 193, 0.25)';

    // ========== Game State ==========
    let gameState = 'idle'; // idle | running | over
    let score = 0;
    let highScore = parseInt(localStorage.getItem('moaMiniHighScore') || '0', 10);
    let speed = INITIAL_SPEED;
    let frameCount = 0;
    let animFrameId = null;
    let isEvolved = false;

    // Player
    let player = { x: 60, y: GROUND_Y - PLAYER_H, vy: 0, jumping: false };

    // Obstacles
    let obstacles = [];
    let nextObstacleDistance = 0;

    // Clouds (decorative)
    let clouds = [];

    // Ground particles
    let groundDashes = [];

    // Leaderboard cache
    let cachedLeaderboard = null;
    let leaderboardLoaded = false;
    let firebaseReady = false;
    let firestoreDb = null;
    let leaderboardUnsubscribe = null;

    // ========== Firebase Lazy Init ==========
    async function initFirebase() {
        if (firebaseReady) return;
        try {
            const { initializeApp, getApps } = await import('https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js');
            const { getFirestore } = await import('https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js');
            const { getAuth, signInAnonymously } = await import('https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js');

            // Reuse existing app if already initialized by guestbook.js
            let app;
            const existingApps = getApps();
            if (existingApps.length > 0) {
                app = existingApps[0];
            } else {
                app = initializeApp(FIREBASE_CONFIG);
            }
            firestoreDb = getFirestore(app);

            // Ensure user is signed in (anonymously) for Firestore rules
            const auth = getAuth(app);
            if (!auth.currentUser) {
                await signInAnonymously(auth);
            }

            firebaseReady = true;
        } catch (err) {
            console.warn('Minigame: Firebase 초기화 실패, 로컬 랭킹만 사용합니다.', err);
        }
    }

    // ========== Leaderboard ==========
    async function fetchLeaderboard() {
        if (leaderboardUnsubscribe) return; // 이미 리스너가 동작 중이면 중복 실행 방지

        try {
            await initFirebase();
            if (!firestoreDb) throw new Error('No Firestore');

            const { doc, onSnapshot } = await import('https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js');
            const docRef = doc(firestoreDb, LEADERBOARD_COLLECTION, LEADERBOARD_DOC);

            leaderboardUnsubscribe = onSnapshot(docRef, (docSnap) => {
                if (docSnap.exists()) {
                    cachedLeaderboard = docSnap.data().entries || [];
                } else {
                    cachedLeaderboard = [];
                }
                leaderboardLoaded = true;
                renderLeaderboard(cachedLeaderboard);
            }, (err) => {
                console.error('Minigame: 리더보드 실시간 로드 실패', err);
            });
        } catch (err) {
            console.warn('Minigame: 리더보드 초기 로드 실패', err);
            cachedLeaderboard = [];
            leaderboardLoaded = true;
            renderLeaderboard(cachedLeaderboard);
        }
    }

    // 캐시에 즉시 반영 (UI 즉시 업데이트)
    function submitScoreToCache(name, newScore) {
        if (!cachedLeaderboard) cachedLeaderboard = [];
        const entry = { name: name || '익명', score: newScore, date: new Date().toISOString() };
        cachedLeaderboard.push(entry);
        cachedLeaderboard.sort((a, b) => b.score - a.score);
        cachedLeaderboard = cachedLeaderboard.slice(0, MAX_LEADERBOARD);
        renderLeaderboard(cachedLeaderboard);
    }

    // Firebase에 백그라운드 동기화 (fire-and-forget)
    async function syncLeaderboardToFirebase(name, newScore) {
        try {
            if (!firestoreDb) await initFirebase();
            if (firestoreDb) {
                const { doc, runTransaction } = await import('https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js');
                const docRef = doc(firestoreDb, LEADERBOARD_COLLECTION, LEADERBOARD_DOC);

                await runTransaction(firestoreDb, async (transaction) => {
                    const sfDoc = await transaction.get(docRef);
                    let currentEntries = [];
                    if (sfDoc.exists()) {
                        currentEntries = sfDoc.data().entries || [];
                    }

                    // 내 점수 추가
                    const entry = {
                        name: name || '익명',
                        score: newScore,
                        date: new Date().toISOString()
                    };
                    currentEntries.push(entry);

                    // 정렬 및 자르기
                    currentEntries.sort((a, b) => b.score - a.score);
                    const updatedEntries = currentEntries.slice(0, MAX_LEADERBOARD);

                    // 서버에 저장
                    transaction.set(docRef, { entries: updatedEntries });
                });
                console.log('Minigame: 랭킹 트랜잭션 동기화 완료');
            }
        } catch (err) {
            console.error('Minigame: 점수 트랜잭션 저장 실패.', err);
            if (err.code === 'permission-denied') {
                console.error('에러 코드: permission-denied. Firebase Console의 보안 규칙을 확인하세요');
            }
        }
    }

    function getCutlineScore() {
        if (!cachedLeaderboard || cachedLeaderboard.length < MAX_LEADERBOARD) return 0;
        return cachedLeaderboard[cachedLeaderboard.length - 1].score;
    }

    function renderLeaderboard(entries) {
        if (!leaderboardList) return;
        if (!entries || entries.length === 0) {
            leaderboardList.innerHTML = '<li class="leaderboard-empty">아직 기록이 없습니다. 첫 번째 기록을 남겨보세요!</li>';
            return;
        }
        leaderboardList.innerHTML = entries.map(e =>
            `<li><span class="lb-name">${escapeHtml(e.name)}</span><span class="lb-score">${e.score}</span></li>`
        ).join('');
    }

    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }

    // ========== Canvas Resize ==========
    function resizeCanvas() {
        if (!canvas || !ctx) return;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = CANVAS_W * dpr;
        canvas.height = CANVAS_H * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // 논리 좌표계는 CANVAS_W × CANVAS_H 유지
    }

    // ========== Game Logic ==========
    function resetGame() {
        score = 0;
        speed = INITIAL_SPEED;
        frameCount = 0;
        player.x = 60;
        player.y = GROUND_Y - PLAYER_H;
        player.vy = 0;
        player.jumping = false;
        obstacles = [];
        nextObstacleDistance = CANVAS_W;
        // 캐릭터 초기화 로직
        isEvolved = false; // 다시 미진화 상태로 초기화
        if (playerEl) {
            playerEl.src = DEFAULT_PLAYER_GIF;
        }
        //
        clouds = [
            { x: 100, y: 30, w: 50 },
            { x: 320, y: 50, w: 40 },
            { x: 550, y: 25, w: 60 },
        ];
        groundDashes = [];
        for (let i = 0; i < 20; i++) {
            groundDashes.push({ x: Math.random() * CANVAS_W, y: GROUND_Y + 5 + Math.random() * 15, w: 8 + Math.random() * 4 });
        }
        updateScoreDisplay();
    }

    function jump() {
        if (!player.jumping) {
            player.vy = JUMP_FORCE;
            player.jumping = true;
        }
    }

    function spawnObstacle() {
        const h = 25 + Math.random() * 25;
        const w = 15 + Math.random() * 15;
        obstacles.push({
            x: CANVAS_W + 10,
            y: GROUND_Y - h,
            w: w,
            h: h,
        });
        // 속도에 비례하여 최소 간격을 동적으로 보장 (고속에서도 점프 시간 확보)
        const speedFactor = Math.max(1, speed / INITIAL_SPEED);
        const dynamicMinGap = OBSTACLE_MIN_GAP * speedFactor;
        nextObstacleDistance = dynamicMinGap + Math.random() * OBSTACLE_MAX_GAP;
    }

    function update() {
        frameCount++;

        // Score
        if (frameCount % 4 === 0) {
            score++;
            updateScoreDisplay();
        }
        // 캐릭터 변경 로직
        if (score >= EVOLUTION_SCORE && playerEl && !isEvolved) {
            playerEl.src = EVOLVED_PLAYER_GIF;
            isEvolved = true;
        }

        // Speed up
        speed = Math.min(MAX_SPEED, INITIAL_SPEED + frameCount * SPEED_INCREMENT);

        // Player physics
        player.vy += GRAVITY;
        player.y += player.vy;
        if (player.y >= GROUND_Y - PLAYER_H) {
            player.y = GROUND_Y - PLAYER_H;
            player.vy = 0;
            player.jumping = false;
        }

        // Obstacles
        nextObstacleDistance -= speed;
        if (nextObstacleDistance <= 0) {
            spawnObstacle();
        }

        for (let i = obstacles.length - 1; i >= 0; i--) {
            obstacles[i].x -= speed;
            if (obstacles[i].x + obstacles[i].w < 0) {
                obstacles.splice(i, 1);
            }
        }

        // Clouds
        for (const cloud of clouds) {
            cloud.x -= speed * 0.3;
            if (cloud.x + cloud.w < 0) {
                cloud.x = CANVAS_W + Math.random() * 100;
                cloud.y = 20 + Math.random() * 50;
            }
        }

        // Ground dashes
        for (const dash of groundDashes) {
            dash.x -= speed;
            if (dash.x < -5) {
                dash.x = CANVAS_W + Math.random() * 20;
                dash.w = 8 + Math.random() * 4; // 재활용 시 너비 재계산
            }
        }

        // Collision detection (AABB)
        const px = player.x + 6; // slight hitbox shrink for fairness
        const py = player.y + 6;
        const pw = PLAYER_W - 12;
        const ph = PLAYER_H - 6;

        for (const obs of obstacles) {
            if (px < obs.x + obs.w && px + pw > obs.x &&
                py < obs.y + obs.h && py + ph > obs.y) {
                gameOver();
                return;
            }
        }
    }

    function draw() {
        if (!ctx) return;

        // Background
        ctx.fillStyle = COLOR_BG;
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

        // Clouds
        ctx.fillStyle = COLOR_CLOUD;
        for (const cloud of clouds) {
            ctx.beginPath();
            ctx.ellipse(cloud.x, cloud.y, cloud.w / 2, 10, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(cloud.x - cloud.w * 0.25, cloud.y + 5, cloud.w * 0.3, 8, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(cloud.x + cloud.w * 0.3, cloud.y + 3, cloud.w * 0.25, 7, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        // Ground line
        ctx.strokeStyle = COLOR_GROUND_LINE;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, GROUND_Y);
        ctx.lineTo(CANVAS_W, GROUND_Y);
        ctx.stroke();

        // Ground dashes
        ctx.fillStyle = COLOR_GROUND_LINE;
        for (const dash of groundDashes) {
            ctx.fillRect(dash.x, dash.y, dash.w, 1.5);
        }

        // Obstacles — rounded cute blocks
        for (const obs of obstacles) {
            const r = Math.min(5, obs.w / 3);
            // Shadow
            ctx.fillStyle = 'rgba(255, 141, 161, 0.15)';
            roundRect(ctx, obs.x + 2, obs.y + 2, obs.w, obs.h, r);
            ctx.fill();
            // Body gradient
            const grad = ctx.createLinearGradient(obs.x, obs.y, obs.x, obs.y + obs.h);
            grad.addColorStop(0, COLOR_OBSTACLE_DARK);
            grad.addColorStop(1, COLOR_OBSTACLE);
            ctx.fillStyle = grad;
            roundRect(ctx, obs.x, obs.y, obs.w, obs.h, r);
            ctx.fill();
            // Highlight
            ctx.fillStyle = 'rgba(255,255,255,0.35)';
            roundRect(ctx, obs.x + 2, obs.y + 2, obs.w - 4, obs.h * 0.35, r);
            ctx.fill();
        }

        // Player — rendered as DOM img for GIF animation
        if (playerEl) {
            // Canvas는 CSS에 의해 실제 표시 크기가 달라질 수 있으므로 비율 계산
            const canvasRect = canvas.getBoundingClientRect();
            const scaleX = canvasRect.width / CANVAS_W;
            const scaleY = canvasRect.height / CANVAS_H;
            playerEl.style.left = (player.x * scaleX) + 'px';
            playerEl.style.top = (player.y * scaleY) + 'px';
            playerEl.style.width = (PLAYER_W * scaleX) + 'px';
            playerEl.style.height = (PLAYER_H * scaleY) + 'px';
        }
    }

    // Rounded rectangle helper
    function roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }

    function updateScoreDisplay() {
        if (scoreDisplay) scoreDisplay.textContent = score;
    }

    // ========== Game Loop ==========
    function gameLoop() {
        if (gameState !== 'running') return;
        update();
        draw();
        animFrameId = requestAnimationFrame(gameLoop);
    }

    function startGame() {
        if (gameState === 'running') return;
        resetGame();
        gameState = 'running';
        overlay.classList.add('hidden-overlay');
        gameLoop();
    }

    function gameOver() {
        gameState = 'over';
        cancelAnimationFrame(animFrameId);
        animFrameId = null;

        // Update local high score
        if (score > highScore) {
            highScore = score;
            localStorage.setItem('moaMiniHighScore', highScore.toString());
        }

        // Check if score qualifies for leaderboard
        const cutline = getCutlineScore();
        const qualifies = !cachedLeaderboard || cachedLeaderboard.length < MAX_LEADERBOARD || score > cutline;

        if (qualifies && score > 0) {
            showGameOverWithSubmit();
        } else {
            showGameOverNormal();
        }
    }

    function showGameOverNormal() {
        overlayTitle.textContent = 'GAME OVER';
        overlaySubtitle.innerHTML = `점수: <strong>${score}</strong> | 최고: <strong>${highScore}</strong><br><span style="font-size:0.85rem; color:#aaa;">스페이스바 또는 터치로 재시작</span>`;
        overlay.classList.remove('hidden-overlay');
        // Remove any existing nickname input
        const existingInput = overlay.querySelector('.game-nickname-input');
        if (existingInput) existingInput.remove();
        const existingBtn = overlay.querySelector('.game-submit-btn');
        if (existingBtn) existingBtn.remove();
    }

    function showGameOverWithSubmit() {
        overlayTitle.textContent = '🎉 TOP 10 진입!';

        const content = overlay.querySelector('.game-overlay-content');
        overlaySubtitle.innerHTML = `점수: <strong>${score}</strong>`;

        // Remove existing inputs
        const existingInput = overlay.querySelector('.game-nickname-input');
        if (existingInput) existingInput.remove();
        const existingBtn = overlay.querySelector('.game-submit-btn');
        if (existingBtn) existingBtn.remove();

        // Nickname input
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'game-nickname-input';
        input.placeholder = '닉네임 (최대 6자)';
        input.maxLength = 6;
        content.appendChild(input);

        // Submit button
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'game-submit-btn';
        btn.textContent = '랭킹 등록';
        content.appendChild(btn);

        const doSubmit = () => {
            const name = input.value.trim() || '익명';
            btn.disabled = true;
            // 캐시 즉시 업데이트 → UI 즉시 반영
            submitScoreToCache(name, score);
            btn.textContent = '등록 완료!';
            // Firebase 동기화는 백그라운드에서
            syncLeaderboardToFirebase(name, score);
            // 잠시 후 재시작 안내 UI로 전환
            setTimeout(() => {
                input.remove();
                btn.remove();
                overlayTitle.textContent = 'GAME OVER';
                overlaySubtitle.innerHTML = `점수: <strong>${score}</strong> | 최고: <strong>${highScore}</strong><br><span style="font-size:0.85rem; color:#aaa;">스페이스바 또는 터치로 재시작</span>`;
            }, 1200);
        };

        btn.addEventListener('click', doSubmit);
        input.addEventListener('keydown', (e) => {
            e.stopPropagation(); // Prevent game input during typing
            if (e.key === 'Enter') doSubmit();
        });

        overlay.classList.remove('hidden-overlay');
        setTimeout(() => input.focus(), 100);
    }

    // ========== Input Handling ==========
    function handleGameInput(e) {
        if (!window._isMinigameOpen) return;

        // Don't handle input when typing nickname
        if (document.activeElement && document.activeElement.classList.contains('game-nickname-input')) return;

        if (gameState === 'idle' || gameState === 'over') {
            // Make sure submit UI isn't active
            const existingInput = overlay.querySelector('.game-nickname-input');
            if (existingInput) return;
            startGame();
        } else if (gameState === 'running') {
            jump();
        }
    }

    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space' || e.key === ' ' || e.key === 'ArrowUp') {
            if (window._isMinigameOpen) {
                e.preventDefault();
                handleGameInput(e);
            }
        }
    });

    // Touch handling on canvas container
    if (canvas) {
        const container = canvas.parentElement;
        if (container) {
            container.addEventListener('touchstart', (e) => {
                if (window._isMinigameOpen) {
                    e.preventDefault();
                    handleGameInput(e);
                }
            }, { passive: false });

            container.addEventListener('click', (e) => {
                if (window._isMinigameOpen && e.target !== document.querySelector('.game-nickname-input')) {
                    handleGameInput(e);
                }
            });
        }
    }

    // Touch handling on overlay (now a sibling of canvas container)
    if (overlay) {
        overlay.addEventListener('touchstart', (e) => {
            if (window._isMinigameOpen) {
                const target = e.target;
                // 닉네임 입력칸이나 등록 버튼 터치 시에는 기본 동작 유지
                if (target.classList.contains('game-nickname-input') || target.classList.contains('game-submit-btn')) {
                    return;
                }
                e.preventDefault();
                handleGameInput(e);
            }
        }, { passive: false });

        overlay.addEventListener('click', (e) => {
            if (window._isMinigameOpen && !e.target.classList.contains('game-nickname-input') && !e.target.classList.contains('game-submit-btn')) {
                handleGameInput(e);
            }
        });
    }

    // ========== Public API (called from main.js) ==========
    window.openMiniGame = function () {
        if (!modal || !canvas) return;
        window._isMinigameOpen = true;
        resizeCanvas();

        gameState = 'idle';
        resetGame();
        draw(); // Draw initial frame

        // Show player sprite
        if (playerEl) {
            playerEl.style.display = 'block';
        }

        // Show start overlay
        overlayTitle.textContent = '모아를 잡았다!';
        overlaySubtitle.textContent = '스페이스바 또는 터치로 시작';
        overlay.classList.remove('hidden-overlay');
        // Clean up any leftover input/btn
        const existingInput = overlay.querySelector('.game-nickname-input');
        if (existingInput) existingInput.remove();
        const existingBtn = overlay.querySelector('.game-submit-btn');
        if (existingBtn) existingBtn.remove();

        modal.showModal();
        document.body.style.overflow = 'hidden';

        // Fetch leaderboard (1 read, cached afterwards)
        fetchLeaderboard();
    };

    window.closeMiniGame = function () {
        gameState = 'idle';
        if (animFrameId) {
            cancelAnimationFrame(animFrameId);
            animFrameId = null;
        }
        window._isMinigameOpen = false;
        if (playerEl) {
            playerEl.style.display = 'none';
        }
        // 리더보드 리스너 해제 (트래픽 최적화)
        if (leaderboardUnsubscribe) {
            leaderboardUnsubscribe();
            leaderboardUnsubscribe = null;
        }
    };

})();
