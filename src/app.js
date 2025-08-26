const BACKEND_URL = 'https://si-backend-2i9b.onrender.com'; // This will need to change for live testing
const canvas = document.getElementById('circleCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.querySelector('.score');
canvas.width = 500;
canvas.height = 500;

// --- Telegram Mini App Setup ---
const tg = window.Telegram.WebApp;
tg.ready(); // Notify Telegram that the app is ready

// Get user info. For local testing, we'll use a default.
let userId = tg.initDataUnsafe?.user?.id || 'test-user-01';

// --- Game State ---
let score = 0;
let isSyncing = false; // Prevents sending too many requests

// --- Backend Communication ---

// Fetches the initial score when the app loads
async function getInitialScore() {
    try {
        const response = await fetch(`${BACKEND_URL}/score/${userId}`);
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

// --- Game Logic ---

const coinImage = new Image();
coinImage.src = '/assets/skin1.png'; // Make sure this path is correct

coinImage.onload = () => {
    getInitialScore(); // Load user's score from backend once the image is ready
    requestAnimationFrame(animate); // Start the animation loop
};

canvas.addEventListener('mousedown', (e) => {
    score++;
    scoreElement.textContent = score;
    // We can sync the score on every click or batch updates.
    // For a clicker, syncing every few seconds is better to reduce server load.
    // But for this example, we'll sync on click.
    syncScore();

    // Trigger visual effects (your bump/distortion code is needed here)
    createRipple(e);
});
// Set canvas size
canvas.width = 500;
canvas.height = 800;

const coinImage = new Image();
// Ensure this path is correct
coinImage.src = '/assets/skin1.png';



// --- Effect Parameters (easier to tweak) ---
let scale = 1;
const BUMP_AMOUNT = 1.08; // How big the bump is
const BUMP_RECOVERY = 0.02; // How fast it returns to normal

let distortion = {
    amplitude: 0,
    maxAmplitude: 20, // The maximum strength of the distortion
    centerX: 0,
    centerY: 0,
    radius: 150,
    recovery: 4 // How fast the distortion wave fades
};

// --- Performance Optimizations ---
let isDistortionActive = false; // Flag to prevent the heavy effect from stacking
let originalImageData = null; // Variable to hold the clean, original image data

// This function runs only once after the image is loaded
coinImage.onload = () => {
    // Draw the image to the canvas once to get its pixel data
    ctx.drawImage(coinImage, 0, 0, canvas.width, canvas.height);
    // Cache the original pixel data. We will use this as a clean source for all future frames.
    originalImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    // Start the animation loop
    requestAnimationFrame(animate);
};

canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // --- These effects are cheap and run on EVERY click ---
    score++;
    scoreElement.textContent = score;
    scale = BUMP_AMOUNT; // Apply the bump
    createRipple(e); // Create the CSS ripple

    // --- This expensive effect only runs if it's not already active ---
    if (!isDistortionActive) {
        isDistortionActive = true;
        distortion.amplitude = distortion.maxAmplitude;
        distortion.centerX = x;
        distortion.centerY = y;
    }
});

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

    ripple.addEventListener('animationend', () => {
        ripple.remove();
    });
}

// The main animation loop
function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Create a temporary copy of the image data for this frame's manipulation
    const frameImageData = new ImageData(
        new Uint8ClampedArray(originalImageData.data),
        originalImageData.width,
        originalImageData.height
    );

    // Apply distortion only if the effect is active
    if (isDistortionActive) {
        const data = frameImageData.data;
        const sourceData = originalImageData.data; // Read from the clean source

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

    // Apply the bump effect (scale) and draw the final image for this frame
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(scale, scale);
    ctx.translate(-canvas.width / 2, -canvas.height / 2);

    // Draw the manipulated pixel data to the canvas
    ctx.putImageData(frameImageData, 0, 0);

    ctx.restore();

    // --- Update the state of the effects for the next frame ---

    // Gradually reduce the bump effect
    if (scale > 1) {
        scale = Math.max(1, scale - BUMP_RECOVERY);
    }

    // Gradually reduce the distortion effect
    if (isDistortionActive) {
        distortion.amplitude -= distortion.recovery;
        if (distortion.amplitude <= 0) {
            distortion.amplitude = 0;
            isDistortionActive = false; // The effect is finished, allow it to be triggered again
        }
    }

    // Request the next frame
    requestAnimationFrame(animate);
}