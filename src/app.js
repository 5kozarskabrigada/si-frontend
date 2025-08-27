// app.js
document.addEventListener('gesturestart', (e) => e.preventDefault()); // Prevent pinch zoom

// --- Configuration ---
const BACKEND_URL = 'https://si-backend-2i9b.onrender.com';
const canvas = document.getElementById('circleCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.querySelector('.score');
const cpsElement = document.querySelector('.cps-stat');
const perClickElement = document.querySelector('.per-click-stat');
const perSecondElement = document.querySelector('.per-second-stat');
const circleContainer = document.querySelector('.circle');

// --- Telegram Mini App Setup ---
const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

// --- Game State ---
const userId = tg.initDataUnsafe?.user?.id || 'test-user-01';
let score = 0.0;
let clickValue = 0.000000001;
let autoClickRate = 0.0; // This will be fetched from the server

// --- Timers and Syncing ---
let lastFrameTime = Date.now();
let clicksThisSecond = 0;
let isSyncing = false;
const SYNC_INTERVAL = 5000; // Sync with backend every 5 seconds

// --- Backend Communication ---
async function getInitialData() {
    try {
        const response = await fetch(`${BACKEND_URL}/player/${userId}`);
        if (!response.ok) throw new Error(`Backend error: ${response.status}`);
        const data = await response.json();
        score = data.score;
        autoClickRate = data.autoClickRate; // Get passive income rate
        updateUI(); // Initial UI update
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

// Set up periodic syncing
setInterval(syncScore, SYNC_INTERVAL);

// --- Clicks Per Second Counter ---
setInterval(() => {
    cpsElement.textContent = `CPS: ${clicksThisSecond}`;
    clicksThisSecond = 0;
}, 1000);

// --- UI Update Function ---
function updateUI() {
    scoreElement.textContent = score.toFixed(9);
    perClickElement.textContent = `Per Click: ${clickValue.toFixed(9)}`;
    perSecondElement.textContent = `Per Second: ${autoClickRate.toFixed(9)}`;
}

// --- Visual Effects & Canvas Setup ---
const coinImage = new Image();
coinImage.src = '/assets/skin1.png';
let scale = 1, isDistortionActive = false, originalImageData = null;
const BUMP_AMOUNT = 1.05, BUMP_RECOVERY = 0.02;
let distortion = { amplitude: 0, maxAmplitude: 20, centerX: 0, centerY: 0, radius: 150, recovery: 2 };

function setupCanvas() {
    const size = circleContainer.getBoundingClientRect().width;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    distortion.radius = (size * 0.4);
    if (coinImage.complete && coinImage.naturalWidth > 0) {
        ctx.drawImage(coinImage, 0, 0, size, size);
        originalImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    }
}

// --- Main Event Handlers ---
coinImage.onload = () => {
    setupCanvas();
    getInitialData();
    requestAnimationFrame(gameLoop); // Start the main game loop
};

window.addEventListener('resize', setupCanvas);

canvas.addEventListener('mousedown', (e) => {
    score += clickValue;
    clicksThisSecond++;

    // Always trigger effects from the center
    const rect = canvas.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    scale = BUMP_AMOUNT;
    createRipple(e); // Pass original event for visual placement

    if (!isDistortionActive) {
        isDistortionActive = true;
        distortion.amplitude = distortion.maxAmplitude;
        distortion.centerX = centerX; // Use center for distortion
        distortion.centerY = centerY; // Use center for distortion
    }
});

// --- Game Loop and Animation ---
function gameLoop() {
    const now = Date.now();
    const delta = (now - lastFrameTime) / 1000; // Time since last frame in seconds
    lastFrameTime = now;

    // Add passive income
    score += autoClickRate * delta;

    updateUI(); // Update score and stats text
    animateCanvas(); // Run the visual effects animation

    requestAnimationFrame(gameLoop);
}

function createRipple(e) {
    const ripple = document.createElement('span');
    ripple.classList.add('ripple');
    const rect = circleContainer.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    ripple.style.width = ripple.style.height = `${size}px`;

    // Always position ripple in the center of the container
    ripple.style.left = `${(rect.width - size) / 2}px`;
    ripple.style.top = `${(rect.height - size) / 2}px`;

    circleContainer.appendChild(ripple);
    ripple.addEventListener('animationend', () => ripple.remove());
}

function animateCanvas() {
    if (!originalImageData) return;
    // ... (Your existing canvas animation/distortion logic is fine here) ...
    const size = parseFloat(canvas.style.width);
    ctx.clearRect(0, 0, size, size);
    const frameImageData = new ImageData(new Uint8ClampedArray(originalImageData.data), originalImageData.width, originalImageData.height);

    if (isDistortionActive) {
        const data = frameImageData.data;
        const sourceData = originalImageData.data;
        const { centerX, centerY, radius, amplitude } = distortion;
        for (let y = 0; y < canvas.height; y++) {
            for (let x = 0; x < canvas.width; x++) {
                const dx = x - (centerX * window.devicePixelRatio);
                const dy = y - (centerY * window.devicePixelRatio);
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < radius * window.devicePixelRatio) {
                    const angle = Math.atan2(dy, dx);
                    const displacement = Math.sin(distance / (radius * window.devicePixelRatio) * Math.PI) * amplitude;
                    const srcX = Math.round(x + Math.cos(angle) * displacement);
                    const srcY = Math.round(y + Math.sin(angle) * displacement);
                    if (srcX >= 0 && srcX < canvas.width && srcY >= 0 && srcY < canvas.height) {
                        const destIndex = (y * canvas.width + x) * 4;
                        const srcIndex = (srcY * canvas.width + srcX) * 4;
                        data[destIndex] = sourceData[srcIndex];
                        data[destIndex + 1] = sourceData[srcIndex + 1];
                        data[destIndex + 2] = sourceData[srcIndex + 2];
                        data[destIndex + 3] = sourceData[srcIndex + 3];
                    }
                }
            }
        }
    }

    ctx.save();
    ctx.translate(size / 2, size / 2);
    ctx.scale(scale, scale);
    ctx.translate(-size / 2, -size / 2);
    ctx.putImageData(frameImageData, 0, 0, 0, 0, size, size);
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