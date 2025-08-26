const BACKEND_URL = 'https://si-backend-2i9b.onrender.com';
const canvas = document.getElementById('circleCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.querySelector('.score');

// Set canvas size
canvas.width = 500;
canvas.height = 800; // Adjusted for a square aspect ratio, change if needed

// --- Telegram Mini App Setup ---
const tg = window.Telegram.WebApp;
tg.ready(); // Notify Telegram that the app is ready

// Get user info. For local testing, we'll use a default.
const userId = tg.initDataUnsafe?.user?.id || 'test-user-01';

// --- Game State ---
let score = 0;
let isSyncing = false; // Prevents sending too many requests

// --- Backend Communication ---

// Fetches the initial score when the app loads
async function getInitialScore() {
    console.log(`Fetching initial score for user: ${userId}`);
    try {
        const response = await fetch(`${BACKEND_URL}/score/${userId}`);
        if (!response.ok) {
            // If the response is not 2xx, it's an error
            console.error(`Backend returned an error: ${response.status}`);
            scoreElement.textContent = 'Error';
            return;
        }
        const data = await response.json();
        score = data.score;
        scoreElement.textContent = score;
    } catch (error) {
        console.error('Failed to fetch score:', error);
        scoreElement.textContent = 'Error';
    }
}

// Sends the updated score to the backend
async function syncScore() {
    if (isSyncing) return;
    isSyncing = true;
    try {
        await fetch(`${BACKEND_URL}/score`, {
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

// --- Visual Effects Setup ---
const coinImage = new Image();
coinImage.src = '/assets/skin1.png';

let scale = 1;
const BUMP_AMOUNT = 1.05;
const BUMP_RECOVERY = 0.02;

let distortion = {
    amplitude: 0,
    maxAmplitude: 20,
    centerX: 0,
    centerY: 0,
    radius: 150,
    recovery: 2
};

let isDistortionActive = false;
let originalImageData = null;

// --- Main Event Handlers ---

// This SINGLE onload function runs once the image is ready
coinImage.onload = () => {
    console.log("Image loaded successfully.");
    // 1. Cache the clean image data for animations
    ctx.drawImage(coinImage, 0, 0, canvas.width, canvas.height);
    originalImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // 2. Fetch the user's score from the backend
    getInitialScore();

    // 3. Start the animation loop
    requestAnimationFrame(animate);
};

// This SINGLE mousedown listener handles all click actions
canvas.addEventListener('mousedown', (e) => {
    // Game Logic
    score++;
    scoreElement.textContent = score;
    syncScore(); // Sync with backend

    // Visual Effects
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

// --- Helper Functions and Animation Loop ---

function createRipple(e) {
    const circle = document.querySelector('.circle');
    const ripple = document.createElement('span');
    ripple.classList.add('ripple');
    const rect = circle.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    ripple.style.width = ripple.style.height = `${size}px`;
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top - size / 2;
    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;
    circle.appendChild(ripple);
    ripple.addEventListener('animationend', () => ripple.remove());
}

function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const frameImageData = new ImageData(new Uint8ClampedArray(originalImageData.data), originalImageData.width, originalImageData.height);

    if (isDistortionActive) {
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

    if (scale > 1) {
        scale = Math.max(1, scale - BUMP_RECOVERY);
    }
    if (isDistortionActive) {
        distortion.amplitude -= distortion.recovery;
        if (distortion.amplitude <= 0) {
            distortion.amplitude = 0;
            isDistortionActive = false;
        }
    }
    requestAnimationFrame(animate);
} 