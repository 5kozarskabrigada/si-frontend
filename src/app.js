// app.js (Largely the same, just verified against new backend)
document.addEventListener('gesturestart', (e) => e.preventDefault());

const BACKEND_URL = 'YOUR_RENDER_URL'; // e.g. https://si-backend-2i9b.onrender.com
const canvas = document.getElementById('circleCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.querySelector('.score');
const cpsElement = document.querySelector('.cps-stat');
const perClickElement = document.querySelector('.per-click-stat');
const perSecondElement = document.querySelector('.per-second-stat');
const circleContainer = document.querySelector('.circle');

const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

const userId = tg.initDataUnsafe?.user?.id || 'test-user-01';
let score = 0.0;
let clickValue = 0.000000001;
let autoClickRate = 0.0;

let lastFrameTime = Date.now();
let clicksThisSecond = 0;
let isSyncing = false;
const SYNC_INTERVAL = 5000;

async function getInitialData() {
    try {
        const response = await fetch(`${BACKEND_URL}/player/${userId}`);
        if (!response.ok) throw new Error(`Backend error: ${response.status}`);
        const data = await response.json();
        score = parseFloat(data.score); // Ensure score is a number
        autoClickRate = parseFloat(data.auto_click_rate);
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

setInterval(syncScore, SYNC_INTERVAL);

setInterval(() => {
    cpsElement.textContent = `CPS: ${clicksThisSecond}`;
    clicksThisSecond = 0;
}, 1000);

function updateUI() {
    scoreElement.textContent = score.toFixed(9);
    perClickElement.textContent = `Per Click: ${clickValue.toFixed(9)}`;
    perSecondElement.textContent = `Per Second: ${autoClickRate.toFixed(9)}`;
}

const coinImage = new Image();
coinImage.src = '/assets/skin1.png'; // Use your anime image here
let scale = 1, isDistortionActive = false, originalImageData = null;
const BUMP_AMOUNT = 1.05, BUMP_RECOVERY = 0.02;
let distortion = { amplitude: 0, maxAmplitude: 20, centerX: 0, centerY: 0, radius: 150, recovery: 2 };

function setupCanvas() {
    const rect = circleContainer.getBoundingClientRect();
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
    createRipple(e);
    if (!isDistortionActive) {
        isDistortionActive = true;
        distortion.amplitude = distortion.maxAmplitude;
        distortion.centerX = centerX;
        distortion.centerY = centerY;
    }
});

function gameLoop() {
    const now = Date.now();
    const delta = (now - lastFrameTime) / 1000;
    lastFrameTime = now;
    score += autoClickRate * delta;
    updateUI();
    animateCanvas();
    requestAnimationFrame(gameLoop);
}

function createRipple(e) {
    const ripple = document.createElement('span');
    ripple.classList.add('ripple');
    const rect = circleContainer.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    ripple.style.width = ripple.style.height = `${size}px`;
    ripple.style.left = `${(rect.width - size) / 2}px`;
    ripple.style.top = `${(rect.height - size) / 2}px`;
    circleContainer.appendChild(ripple);
    ripple.addEventListener('animationend', () => ripple.remove());
}

function animateCanvas() {
    if (!originalImageData) return;
    const rect = canvas.getBoundingClientRect();
    const sizeW = rect.width;
    const sizeH = rect.height;
    ctx.clearRect(0, 0, sizeW, sizeH);
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
    ctx.translate(sizeW / 2, sizeH / 2);
    ctx.scale(scale, scale);
    ctx.translate(-sizeW / 2, -sizeH / 2);
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