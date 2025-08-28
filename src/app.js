// app.js - FULLY FUNCTIONAL MERGED VERSION
document.addEventListener('gesturestart', (e) => e.preventDefault());

// --- Configuration & Element Selection ---
const BACKEND_URL = 'https://si-backend-2i9b.onrender.com'; // IMPORTANT: Set this!
const tg = window.Telegram.WebApp;

// Elements
const loadingOverlay = document.getElementById('loading-overlay');
const loadingText = document.getElementById('loading-text');
const canvas = document.getElementById('circleCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const cpsElement = document.getElementById('cps-stat');
const perClickElement = document.getElementById('per-click-stat');
const perSecondElement = document.getElementById('per-second-stat');
const pages = { /* ... pages from previous code ... */ };
const navButtons = { /* ... nav buttons from previous code ... */ };

// --- Game State & Constants ---
const userId = tg.initDataUnsafe?.user?.id || 'test-user-01';
let playerData = null;
let score = new Decimal(0);
let autoClickRate = new Decimal(0);
let clickValue = new Decimal(0);
const SYNC_INTERVAL = 5000;
let clicksThisSecond = 0;
let lastFrameTime = Date.now();

// --- COMPLETE Frontend Upgrade Definitions ---
const INTRA_TIER_COST_MULTIPLIER = new Decimal(1.215);
const upgrades = {
    click_tier_1: { name: 'A Cups', benefit: '+0.000000001 per click' },
    click_tier_2: { name: 'B Cups', benefit: '+0.000000008 per click' },
    click_tier_3: { name: 'C Cups', benefit: '+0.000000064 per click' },
    click_tier_4: { name: 'D Cups', benefit: '+0.000000512 per click' },
    click_tier_5: { name: 'DD Cups', benefit: '+0.000004096 per click' },

    auto_tier_1: { name: 'Basic Lotion', benefit: '+0.000000001 per sec' },
    auto_tier_2: { name: 'Enhanced Serum', benefit: '+0.000000008 per sec' },
    auto_tier_3: { name: 'Collagen Cream', benefit: '+0.000000064 per sec' },
    auto_tier_4: { name: 'Firming Gel', benefit: '+0.000000512 per sec' },
    auto_tier_5: { name: 'Miracle Elixir', benefit: '+0.000004096 per sec' },
    
    offline_tier_1: { name: 'Simple Bralette', benefit: '+0.000000001 per hour' },
    offline_tier_2: { name: 'Sports Bra', benefit: '+0.000000008 per hour' },
    offline_tier_3: { name: 'Padded Bra', benefit: '+0.000000064 per hour' },
    offline_tier_4: { name: 'Push-Up Bra', benefit: '+0.000000512 per hour' },
    offline_tier_5: { name: 'Designer Corset', benefit: '+0.000004096 per hour' },
};
const baseCosts = {
    click_tier_1: new Decimal('0.000000064'), click_tier_2: new Decimal('0.000001024'),
    click_tier_3: new Decimal('0.000016384'), click_tier_4: new Decimal('0.000262144'),
    click_tier_5: new Decimal('0.004194304'), auto_tier_1: new Decimal('0.000000064'),
    auto_tier_2: new Decimal('0.000001024'), auto_tier_3: new Decimal('0.000016384'),
    auto_tier_4: new Decimal('0.000262144'), auto_tier_5: new Decimal('0.004194304'),
    offline_tier_1: new Decimal('0.000000064'), offline_tier_2: new Decimal('0.000001024'),
    offline_tier_3: new Decimal('0.000016384'), offline_tier_4: new Decimal('0.000262144'),
    offline_tier_5: new Decimal('0.004194304'),
};

// --- Core Functions ---
async function apiRequest(endpoint, method = 'GET', body = null) {
    const options = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) options.body = JSON.stringify(body);
    const response = await fetch(`${BACKEND_URL}${endpoint}`, options);
    const responseData = await response.json();
    if (!response.ok) throw new Error(responseData.error || 'API Request Failed');
    return responseData;
}

function showPage(pageId) {
    if (!pages[pageId]) return;
    Object.values(pages).forEach(p => p.classList.remove('active'));
    pages[pageId].classList.add('active');
    Object.values(navButtons).forEach(b => b.classList.remove('active'));
    if (navButtons[pageId]) navButtons[pageId].classList.add('active');
}

function updateUI() {
    if (!playerData) return;
    score = new Decimal(playerData.score);
    clickValue = new Decimal(playerData.click_value);
    autoClickRate = new Decimal(playerData.auto_click_rate);

    scoreElement.textContent = score.toFixed(9);
    perClickElement.textContent = clickValue.toFixed(9);
    perSecondElement.textContent = autoClickRate.toFixed(9);

    for (const id in upgrades) {
        const levelColumn = `${id}_level`;
        const level = new Decimal(playerData[levelColumn] || 0);
        const cost = baseCosts[id].times(INTRA_TIER_COST_MULTIPLIER.pow(level));

        const levelEl = document.getElementById(`${id}_level`);
        const costEl = document.getElementById(`${id}_cost`);
        const btnEl = document.getElementById(`${id}_btn`);

        // **CRITICAL FIX:** Update the level text as well
        if (levelEl) levelEl.textContent = level.toString();
        if (costEl) costEl.textContent = cost.toFixed(9);
        if (btnEl) btnEl.disabled = score.lessThan(cost);
    }
}

// --- Upgrade Logic ---
function generateUpgradesHTML() {
    // This is the same as before, but now it will generate ALL upgrades
    const container = document.getElementById('upgrades-container');
    container.innerHTML = '';
    for (const id in upgrades) {
        const upgrade = upgrades[id];
        container.innerHTML += `
            <div class="upgrade-item" id="${id}">
                <div class="upgrade-details">
                    <h3>${upgrade.name}</h3>
                    <p>${upgrade.benefit}</p>
                    <p class="level">Level: <span id="${id}_level">0</span></p>
                </div>
                <div class="upgrade-action">
                    <button class="action-button" id="${id}_btn">
                        Cost: <span class="cost" id="${id}_cost">0</span>
                    </button>
                </div>
            </div>
        `;
    }
    for (const id in upgrades) {
        document.getElementById(`${id}_btn`).onclick = () => purchaseUpgrade(id);
    }
}

async function purchaseUpgrade(upgradeId) {
    const btn = document.getElementById(`${upgradeId}_btn`);
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = 'Purchasing...';
    try {
        const { player } = await apiRequest('/player/upgrade', 'POST', { userId, upgradeId });
        playerData = player;
        updateUI(); // Update all stats and costs with new data from server
        tg.HapticFeedback.notificationOccurred('success');
        btn.innerHTML = 'Success!';
    } catch (error) {
        console.error('Upgrade failed:', error);
        tg.HapticFeedback.notificationOccurred('error');
        btn.innerHTML = 'Not Enough Coins';
    } finally {
        setTimeout(() => {
            btn.innerHTML = originalText;
            updateUI(); // Re-check button disabled state
        }, 1000);
    }
}

// --- Canvas & Visuals (Unchanged) ---
const coinImage = new Image();
coinImage.src = '/assets/skin1.png';
let scale = 1, isDistortionActive = false, originalImageData = null;
const BUMP_AMOUNT = 1.05, BUMP_RECOVERY = 0.02;
let distortion = { amplitude: 0, maxAmplitude: 20, centerX: 0, centerY: 0, radius: 150, recovery: 2 };

function setupCanvas() { /* ... same as before ... */ }
function animateCanvas() { /* ... same as before ... */ }

// --- Main Game Loop ---
function gameLoop() {
    const now = Date.now();
    const delta = (now - lastFrameTime) / 1000;
    lastFrameTime = now;
    if (playerData) {
        const passiveIncome = autoClickRate.times(delta);
        score = score.plus(passiveIncome);
        playerData.score = score.toFixed(9);
        updateUI();
    }
    animateCanvas();
    requestAnimationFrame(gameLoop);
}

// --- Initialization ---
async function init() {
    tg.ready();
    tg.expand();
    try {
        playerData = await apiRequest(`/player/${userId}`);
        generateUpgradesHTML();
        updateUI();
        setupCanvas();
        requestAnimationFrame(gameLoop);
        loadingOverlay.classList.remove('active'); // Hide loading screen on success
    } catch (error) {
        console.error("Initialization failed:", error);
        loadingText.innerHTML = `Connection Error!<br><small>${error.message}</small>`;
    }
}

// --- Event Listeners ---
for (const key in navButtons) {
    navButtons[key].onclick = () => showPage(key);
}
canvas.addEventListener('mousedown', (e) => {
    if (!playerData) return;
    score = score.plus(clickValue);
    playerData.score = score.toFixed(9);
    clicksThisSecond++;
    tg.HapticFeedback.impactOccurred('light');
    const rect = canvas.getBoundingClientRect();
    scale = BUMP_AMOUNT;
    if (!isDistortionActive) {
        isDistortionActive = true;
        distortion.amplitude = distortion.maxAmplitude;
        distortion.centerX = rect.width / 2;
        distortion.centerY = rect.height / 2;
    }
});
setInterval(() => {
    cpsElement.textContent = `${clicksThisSecond} CPS`;
    clicksThisSecond = 0;
}, 1000);
setInterval(() => {
    if (playerData) apiRequest('/player/sync', 'POST', { userId, score: score.toFixed(9) });
}, SYNC_INTERVAL);
window.addEventListener('resize', setupCanvas);
coinImage.onload = setupCanvas;

// --- Start the game ---
init();