// app.js
// --- Configuration ---
const BACKEND_URL = 'https://si-backend-2i9b.onrender.com';
const canvas = document.getElementById('circleCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.querySelector('.score');
const cpsElement = document.querySelector('.cps-display');
const circleContainer = document.querySelector('.circle');

// --- Telegram Mini App Setup ---
const tg = window.Telegram.WebApp;
tg.ready();
tg.expand(); // Make the mini app expand to full height

// --- Game State ---
const userId = tg.initDataUnsafe?.user?.id || 'test-user-01';
let score = 0;
let isSyncing = false;
let clicksThisSecond = 0;
let cps = 0;

// --- Backend Communication (Updated for new server routes) ---
async function getInitialData() {
    console.log(`Fetching initial data for user: ${userId}`);
    try {
        const response = await fetch(`${BACKEND_URL}/player/${userId}`);
        if (!response.ok) throw new Error(`Backend error: ${response.status}`);
        const data = await response.json();
        score = data.score;
        scoreElement.textContent = Math.floor(score);
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

// --- Clicks Per Second Logic ---
setInterval(() => {
    cps = clicksThisSecond;
    clicksThisSecond = 0;
    cpsElement.textContent = `CPS: ${cps}`;
    // Optional: Sync score every few seconds instead of every click to reduce server load
    // syncScore(); 
}, 1000);


// --- Visual Effects & Canvas Setup ---
const coinImage = new Image();
coinImage.src = '/assets/skin1.png';

let scale = 1, isDistortionActive = false, originalImageData = null;
const BUMP_AMOUNT = 1.05, BUMP_RECOVERY = 0.02;
let distortion = { amplitude: 0, maxAmplitude: 20, centerX: 0, centerY: 0, radius: 150, recovery: 2 };


// --- Responsive Canvas Logic ---
function setupCanvas() {
    // Get the size of the container from the CSS
    const size = circleContainer.getBoundingClientRect().width;
    canvas.width = size;
    canvas.height = size;

    // Recalculate distortion radius based on new canvas size
    distortion.radius = size * 0.4;

    console.log("Canvas resized to:", size, "x", size);

    // Re-draw and cache the image at the new size
    if (coinImage.complete && coinImage.naturalWidth > 0) {
        ctx.drawImage(coinImage, 0, 0, canvas.width, canvas.height);
        originalImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    }
}


// --- Main Event Handlers ---
coinImage.onload = () => {
    console.log("Image loaded successfully.");
    setupCanvas();      // 1. Set initial canvas size
    getInitialData();   // 2. Fetch user's score
    requestAnimationFrame(animate); // 3. Start animation loop
};

// Redraw canvas if the window is resized
window.addEventListener('resize', setupCanvas);

canvas.addEventListener('mousedown', (e) => {
    score++;
    clicksThisSecond++;
    scoreElement.textContent = Math.floor(score);
    syncScore(); // Sync on every click for instant feedback

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    scale = BUMP_AMOUNT;
    createRipple(e);

    if (!isDistortionActive) {
        isDistortionActive = true;
        distortion.amplitude = distortion.maxAmplitude;
        distortion.centerX = x;
        distortion.centerY = y;
    }
});


// --- Animation Loop and Helper Functions ---
function createRipple(e) {
    // ... createRipple code is unchanged ...
    const ripple = document.createElement('span');
    ripple.classList.add('ripple');
    const rect = circleContainer.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    ripple.style.width = ripple.style.height = `${size}px`;
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top - size / 2;
    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;
    circleContainer.appendChild(ripple);
    ripple.addEventListener('animationend', () => ripple.remove());
}

function animate() {
    if (!originalImageData) {
        requestAnimationFrame(animate);
        return; // Don't draw if the image isn't cached yet
    }

    // ... animation and distortion logic is mostly unchanged ...
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const frameImageData = new ImageData(new Uint8ClampedArray(originalImageData.data), originalImageData.width, originalImageData.height);

    if (isDistortionActive) {
        // ... (distortion calculation loop) ...
        const data = frameImageData.data;
        const sourceData = originalImageData.data;
        const { centerX, centerY, radius, amplitude } = distortion;
        for (let y = 0; y < canvas.height; y++) {
            for (let x = 0; x < canvas.width; x++) {
                const dx = x - centerX;
                const dy = y - centerY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < radius) {
                    const angle = Math.atan2(dy, dx);
                    const displacement = Math.sin(distance / radius * Math.PI) * amplitude;
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
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(scale, scale);
    ctx.translate(-canvas.width / 2, -canvas.height / 2);
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
    requestAnimationFrame(animate);
}