// app.js
document.addEventListener('gesturestart', (e) => e.preventDefault());

// --- Element Selection ---
const BACKEND_URL = 'YOUR_RENDER_URL';
const canvas = document.getElementById('circleCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.querySelector('.score');
const cpsElement = document.querySelector('.cps-stat');
const perClickElement = document.querySelector('.per-click-stat');
const perSecondElement = document.querySelector('.per-second-stat');
const canvasContainer = document.querySelector('.canvas-container');

// --- Telegram Setup ---
const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

// --- Game State ---
const userId = tg.initDataUnsafe?.user?.id || 'test-user-01';
let score = 0.0;
let clickValue = 0.000000001;
let autoClickRate = 0.0; // Fetched from server

let lastFrameTime = Date.now();
let clicksThisSecond = 0;
let isSyncing = false;
const SYNC_INTERVAL = 5000;

// --- Backend Communication ---
async function getInitialData() {
    try {
        const response = await fetch(`${BACKEND_URL}/player/${userId}`);
        if (!response.ok) throw new Error(`Backend error: ${response.status}`);
        const data = await response.json();

        // **CRITICAL FIX:** Ensure data from server is always parsed as a number
        score = parseFloat(data.score) || 0.0;
        autoClickRate = parseFloat(data.auto_click_rate) || 0.0;

        updateUI();
    } catch (error) {
        console.error('Failed to fetch data:', error);
        scoreElement.textContent = 'Error';
    }
}

async function syncScore() {
    if (isSyncing) return;
    isSyncing = true;
    try {
        await fetch(`${BACKEND_URL}/player/sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, score }),
        });
    } catch (error) {
        console.error('Failed to sync score:', error);
    } finally {
        isSyncing = false;
    }
}

// Set up periodic tasks
setInterval(syncScore, SYNC_INTERVAL);
setInterval(() => {
    cpsElement.textContent = `CPS: ${clicksThisSecond}`;
    clicksThisSecond = 0;
}, 1000);

// --- UI & Game Logic ---
function updateUI() {
    scoreElement.textContent = score.toFixed(9);
    perClickElement.textContent = `Per Click: ${clickValue.toFixed(9)}`;
    perSecondElement.textContent = `Per Second: ${autoClickRate.toFixed(9)}`;
}

const coinImage = new Image();
coinImage.src = '/assets/skin1.png'; // Path to your full-screen image
let scale = 1, isDistortionActive = false, originalImageData = null;
const BUMP_AMOUNT = 1.05, BUMP_RECOVERY = 0.02;
let distortion = { amplitude: 0, maxAmplitude: 20, centerX: 0, centerY: 0, radius: 150, recovery: 2 };

function setupCanvas() {
    const rect = canvasContainer.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    distortion.radius = Math.min(rect.width, rect.height) * 0.4;
    if (coinImage.complete && coinImage.naturalWidth > 0) {
        ctx.drawImage(coinImage, 0, 0, rect.width, rect.height);
        originalImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    }
}

// --- Main Event Handlers ---
coinImage.onload = () => {
    setupCanvas();
    getInitialData();
    requestAnimationFrame(gameLoop);
};

window.addEventListener('resize', setupCanvas);

canvas.addEventListener('mousedown', (e) => {
    score += clickValue;
    clicksThisSecond++;
    const rect = canvas.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    scale = BUMP_AMOUNT;
    createRipple();
    if (!isDistortionActive) {
        isDistortionActive = true;
        distortion.amplitude = distortion.maxAmplitude;
        distortion.centerX = centerX;
        distortion.centerY = centerY;
    }
});

// --- Game Loop and Animation ---
function gameLoop() {
    const now = Date.now();
    const delta = (now - lastFrameTime) / 1000;
    lastFrameTime = now;

    // This now correctly adds passive income every frame
    score += autoClickRate * delta;

    updateUI();
    animateCanvas();
    requestAnimationFrame(gameLoop);
}

function createRipple() {
    const ripple = document.createElement('span');
    ripple.classList.add('ripple');
    const size = Math.max(canvas.width, canvas.height) * 0.8;
    ripple.style.width = ripple.style.height = `${size}px`;
    canvasContainer.appendChild(ripple);
    ripple.addEventListener('animationend', () => ripple.remove());
}

// ... the animateCanvas function remains unchanged ...
function animateCanvas() {
    if (!originalImageData) return;
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    const frameImageData = new ImageData(new Uint8ClampedArray(originalImageData.data), originalImageData.width, originalImageData.height);

    if (isDistortionActive) {
        const data = frameImageData.data;
        const sourceData = originalImageData.data;
        const dpr = window.devicePixelRatio || 1;
        const { centerX, centerY, radius, amplitude } = distortion;
        for (let y = 0; y < canvas.height; y++) {
            for (let x = 0; x < canvas.width; x++) {
                const dx = x - (centerX * dpr);
                const dy = y - (centerY * dpr);
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < radius * dpr) {
                    const angle = Math.atan2(dy, dx);
                    const displacement = Math.sin(distance / (radius * dpr) * Math.PI) * amplitude;
                    const srcX = Math.round(x + Math.cos(angle) * displacement);
                    const srcY = Math.round(y + Math.sin(angle) * displacement);
                    if (srcX >= 0 && srcX < canvas.width && srcY >= 0 && srcY < canvas.height) {
                        const destIndex = (y * canvas.width + x) * 4;
                        const srcIndex = (srcY * canvas.width + srcX) * 4;
                        data.set(sourceData.slice(srcIndex, srcIndex + 4), destIndex);
                    }
                }
            }
        }
    }

    ctx.save();
    ctx.translate(rect.width / 2, rect.height / 2);
    ctx.scale(scale, scale);
    ctx.translate(-rect.width / 2, -rect.height / 2);
    ctx.putImageData(frameImageData, 0, 0);
    ctx.restore();

    if (scale > 1) scale = Math.max(1, scale - BUMP_RECOVERY);
    if (isDistortionActive) {
        distortion.amplitude -= distortion.recovery;
        if (distortion.amplitude <= 0) {
            distortion.amplitude = 0;
            isDistortionActive = false;
        }
    }
}