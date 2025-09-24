// app.js - FINAL CANVAS-FREE AND COMPLETE VERSION
document.addEventListener('gesturestart', (e) => e.preventDefault());

// --- Configuration & Element Selection ---
const BACKEND_URL = 'https://si-backend-2i9b.onrender.com'; // IMPORTANT: Set this to your Render backend URL!
const tg = window.Telegram.WebApp;

const loadingOverlay = document.getElementById('loading-overlay');
const loadingText = document.getElementById('loading-text');
const scoreElement = document.getElementById('score');
const cpsElement = document.getElementById('cps-stat');
const perClickElement = document.getElementById('per-click-stat');
const perSecondElement = document.getElementById('per-second-stat');
const coinImageEl = document.getElementById('coinImage');

const pages = {
    clicker: document.getElementById('clicker'),
    upgrades: document.getElementById('upgrades'),
    tasks: document.getElementById('tasks'),
    leaderboard: document.getElementById('leaderboard'), 
    skins: document.getElementById('skins'),
    transactions: document.getElementById('transactions'),
};
const navButtons = {
    clicker: document.getElementById('nav-clicker'),
    upgrades: document.getElementById('nav-upgrades'),
    tasks: document.getElementById('nav-tasks'),
    leaderboard: document.getElementById('nav-leaderboard'),
    skins: document.getElementById('nav-skins'),
    transactions: document.getElementById('nav-transactions'),
};


const userInfo = {
    user_id: tg.initDataUnsafe?.user?.id,
    username: tg.initDataUnsafe?.user?.username,
    first_name: tg.initDataUnsafe?.user?.first_name,
    last_name: tg.initDataUnsafe?.user?.last_name,
    language_code: tg.initDataUnsafe?.user?.language_code,
    photo_url: tg.initDataUnsafe?.user?.photo_url
};


// --- Game State & Constants ---
let userId = tg.initDataUnsafe?.user?.id ?? Date.now(); // numeric fallback


const userName = tg.initDataUnsafe?.user?.username || tg.initDataUnsafe?.user?.first_name || 'Guest'; // New
let playerData = null;
let score = new Decimal(0);
let autoClickRate = new Decimal(0);
let clickValue = new Decimal(0);
const SYNC_INTERVAL = 5000;
let clicksThisSecond = 0;
let lastFrameTime = Date.now();
let scale = 1; // For the bump effect
const BUMP_AMOUNT = 1.05;
const BUMP_RECOVERY = 0.04;

// --- COMPLETE Frontend Upgrade Definitions ---
const INTRA_TIER_COST_MULTIPLIER = new Decimal(1.215);
const upgrades = {
    click: {
        click_tier_1: { name: 'A Cups', benefit: '+0.000000001 per click' },
        click_tier_2: { name: 'B Cups', benefit: '+0.000000008 per click' },
        click_tier_3: { name: 'C Cups', benefit: '+0.000000064 per click' },
        click_tier_4: { name: 'D Cups', benefit: '+0.000000512 per click' },
        click_tier_5: { name: 'DD Cups', benefit: '+0.000004096 per click' },
    },
    auto: {
        auto_tier_1: { name: 'Basic Lotion', benefit: '+0.000000001 per sec' },
        auto_tier_2: { name: 'Enhanced Serum', benefit: '+0.000000008 per sec' },
        auto_tier_3: { name: 'Collagen Cream', benefit: '+0.000000064 per sec' },
        auto_tier_4: { name: 'Firming Gel', benefit: '+0.000000512 per sec' },
        auto_tier_5: { name: 'Miracle Elixir', benefit: '+0.000004096 per sec' },
    },
    offline: {
        offline_tier_1: { name: 'Simple Bralette', benefit: '+0.000000001 per hour' },
        offline_tier_2: { name: 'Sports Bra', benefit: '+0.000000008 per hour' },
        offline_tier_3: { name: 'Padded Bra', benefit: '+0.000000064 per hour' },
        offline_tier_4: { name: 'Push-Up Bra', benefit: '+0.000000512 per hour' },
        offline_tier_5: { name: 'Designer Corset', benefit: '+0.000004096 per hour' },
    }
};
const baseCosts = {
    click_tier_1: new Decimal('0.000000064'), click_tier_2: new Decimal('0.000001024'), click_tier_3: new Decimal('0.000016384'), click_tier_4: new Decimal('0.000262144'), click_tier_5: new Decimal('0.004194304'),
    auto_tier_1: new Decimal('0.000000064'), auto_tier_2: new Decimal('0.000001024'), auto_tier_3: new Decimal('0.000016384'), auto_tier_4: new Decimal('0.000262144'), auto_tier_5: new Decimal('0.004194304'),
    offline_tier_1: new Decimal('0.000000064'), offline_tier_2: new Decimal('0.000001024'), offline_tier_3: new Decimal('0.000016384'), offline_tier_4: new Decimal('0.000262144'), offline_tier_5: new Decimal('0.004194304'),
};

// --- Core Functions ---
async function apiRequest(endpoint, method = 'GET', body = null) {
    try {
        const options = { method, headers: { 'Content-Type': 'application/json' } };
        if (body) options.body = JSON.stringify(body);
        const response = await fetch(`${BACKEND_URL}${endpoint}`, options);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Invalid JSON response from server' }));
            throw new Error(errorData.error || `HTTP error! Status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`API request to ${endpoint} failed:`, error);
        throw error;
    }
}

function showPage(pageId) {
    if (!pages[pageId] || !navButtons[pageId]) return;
    Object.values(pages).forEach(p => p.classList.remove('active'));
    pages[pageId].classList.add('active');
    Object.values(navButtons).forEach(b => b.classList.remove('active'));
    navButtons[pageId].classList.add('active');
}

function updateUI() {
    if (!playerData) return;

    // Update score from current game state (the Decimal object)
    scoreElement.textContent = score.toFixed(9); // Display with fixed precision

    // Update per click/per second values from player data
    // These should reflect the current 'static' values, not a real-time count
    perClickElement.textContent = clickValue.toFixed(9); // Use local Decimal
    perSecondElement.textContent = autoClickRate.toFixed(9); // Use local Decimal



    // Update upgrade buttons
    for (const type in upgrades) {
        for (const id in upgrades[type]) {
            const level = new Decimal(playerData[`${id}_level`] || 0);
            const cost = baseCosts[id].times(INTRA_TIER_COST_MULTIPLIER.pow(level));
            const levelEl = document.getElementById(`${id}_level`);
            const costEl = document.getElementById(`${id}_cost`);
            const btnEl = document.getElementById(`${id}_btn`);
            if (levelEl) levelEl.textContent = level.toString();
            if (costEl) costEl.textContent = cost.toFixed(9);
            if (btnEl) btnEl.disabled = score.lessThan(cost);
        }
    }
}

// --- Upgrade Logic ---
function generateUpgradesHTML() {
    const containers = {
        click: document.getElementById('clickUpgrades'),
        auto: document.getElementById('autoUpgrades'),
        offline: document.getElementById('offlineUpgrades'),
    };
    for (const type in containers) {
        if (!containers[type]) continue;
        containers[type].innerHTML = '';
        for (const id in upgrades[type]) {
            const upgrade = upgrades[type][id];
            containers[type].innerHTML += `
                <div class="upgrade-item" id="${id}">
                    <div class="upgrade-details">
                        <h3>${upgrade.name}</h3>
                        <p>${upgrade.benefit}</p>
                        <p class="level">Level: <span id="${id}_level">0</span></p>
                    </div>
                    <div class="upgrade-action">
                        <button id="${id}_btn">
                            Cost: <span class="cost" id="${id}_cost">0</span>
                        </button>
                    </div>
                </div>`;
        }
    }
    for (const type in upgrades) {
        for (const id in upgrades[type]) {
            const btn = document.getElementById(`${id}_btn`);
            if (btn) btn.onclick = () => purchaseUpgrade(id);
        }
    }
}

function openUpgradeTab(event) {
    const tabName = event.currentTarget.dataset.tab;
    const upgradesPage = document.getElementById('upgrades');
    upgradesPage.querySelectorAll('.upgrade-tab-content').forEach(c => c.classList.remove('active'));
    upgradesPage.querySelectorAll('.upgrade-tab-link').forEach(l => l.classList.remove('active'));
    document.getElementById(tabName).classList.add('active');
    event.currentTarget.classList.add('active');
}

async function purchaseUpgrade(upgradeId) {
    const btn = document.getElementById(`${upgradeId}_btn`);
    const originalText = btn.innerHTML;
    btn.disabled = true;

    try {
        const { player } = await apiRequest('/player/upgrade', 'POST', { userId, upgradeId });
        playerData = player;
        // Update local game state based on new player data
        score = new Decimal(playerData.score);
        clickValue = new Decimal(playerData.click_value);
        autoClickRate = new Decimal(playerData.auto_click_rate);
        updateUI();

        tg.HapticFeedback.notificationOccurred('success');
        btn.innerHTML = 'Success!';
    } 
    
    catch (error) {
        console.error('Upgrade failed:', error);
        tg.HapticFeedback.notificationOccurred('error');
        btn.innerHTML = 'Not Enough Coins';
    } 
    
    finally {
        setTimeout(() => {
            btn.innerHTML = originalText;
            updateUI(); // Re-enable button if enough score, or keep disabled if not.
        }, 1000);
    }
}

async function fetchAndDisplayLeaderboard(sortBy = 'score') {
    const listContainer = document.getElementById('leaderboard-list');
    listContainer.innerHTML = '<div class="loading-spinner" style="margin: 2rem auto;"></div>';

    try {
        const players = await apiRequest(`/leaderboard/${sortBy}`);
        listContainer.innerHTML = '';

        if (players.length === 0) {
            listContainer.innerHTML = '<p style="text-align: center;">The leaderboard is empty!</p>';
            return;
        }

        players.forEach((player, index) => {
            const rank = index + 1;
            const item = document.createElement('div');
            item.className = 'leaderboard-item';

            let pfpElement;
            if (player.profile_photo_url) {
                pfpElement = `<img src="${player.profile_photo_url}" class="pfp" alt="pfp">`;
            } else {
                const initial = player.username ? player.username.charAt(0).toUpperCase() : '?';
                const color = getColorForUser(player.username || ''); // THE FIX IS HERE
                pfpElement = `<div class="pfp-placeholder" style="background-color: ${color};">${initial}</div>`;
            }

            let displayValue;
            switch (sortBy) {
                case 'click_value':
                    displayValue = `${new Decimal(player.click_value).toFixed(9)}`;
                    break;
                case 'auto_click_rate':
                    displayValue = `${new Decimal(player.auto_click_rate).toFixed(9)}`;
                    break;
                default:
                    displayValue = `${new Decimal(player.score).toFixed(9)}`;
            }

            item.innerHTML = `
                <div class="rank rank-${rank}">${rank}</div>
                ${pfpElement}
                <div class="user-details">
                    <div class="username">${player.username || 'Anonymous'}</div>
                </div>
                <div class="score-value">${displayValue}</div>
            `;
            listContainer.appendChild(item);
        });
    } catch (error) {
        listContainer.innerHTML = `<p style="text-align: center;">Error loading leaderboard.</p>`;
        console.error('Failed to load leaderboard:', error);
    }
}





// --- Main Game Loop ---
function gameLoop() {
    requestAnimationFrame(gameLoop);

    const now = Date.now();
    const delta = (now - lastFrameTime) / 1000;
    lastFrameTime = now;

    if (playerData) {
        // Use the local autoClickRate (which is kept in sync with playerData)
        const passiveIncome = autoClickRate.times(delta);
        score = score.plus(passiveIncome);
        // Do NOT update playerData.score here; it will be synced periodically
        updateUI(); // This is crucial for real-time score display
    }

    if (scale > 1) {
        scale = Math.max(1, scale - BUMP_RECOVERY);
        coinImageEl.style.transform = `scale(${scale})`;
    }
}
// --- Initialization and Event Listeners ---
function getTWAUser() {
    const u = tg?.initDataUnsafe?.user;
    if (!u) return null;
    return {
        user_id: u.id,
        username: u.username ?? null,
        first_name: u.first_name ?? null,
        last_name: u.last_name ?? null,
        language_code: u.language_code ?? null,
        photo_url: u.photo_url ?? null, // backend maps this to profile_photo_url
    };
}

async function syncProfile() {
    const info = getTWAUser();
    if (!info) return; // skip if not in Telegram
    try {
        await apiRequest('/player/syncProfile', 'POST', info);
    } catch (e) {
        console.warn('Profile sync failed:', e?.message || e);
    }
}

// --- Initialization and Event Listeners ---
async function init() {
    let userId; // declare here

    tg.ready(() => {
        tg.expand();
        const u = tg?.initDataUnsafe?.user;
        userId = u?.id ?? Date.now();
        initGame();
    });
    
    tg.expand();

    // ensure we have the final Telegram user id
    const u = tg?.initDataUnsafe?.user;
    if (u?.id) userId = u.id;

    // 1) sync Telegram profile to DB (username, names, photo, language)
    await syncProfile();

    try {
        // 2) now load/create the player row
        playerData = await apiRequest(`/player/${userId}`);
        score = new Decimal(playerData.score);
        clickValue = new Decimal(playerData.click_value);
        autoClickRate = new Decimal(playerData.auto_click_rate);

        generateUpgradesHTML();
        setupEventListeners();
        updateUI();

        lastFrameTime = Date.now();
        requestAnimationFrame(gameLoop);

        loadingOverlay.classList.remove('active');
    } catch (error) {
        console.error("Initialization failed:", error);
        loadingText.innerHTML = `Connection Error!<br><small>${error.message}</small>`;
    }
}


function setupEventListeners() {
    // This part is for the main bottom navigation, it's already correct.
    for (const key in navButtons) {
        if (navButtons[key] && key !== 'leaderboard') { // Exclude leaderboard to handle it specially
            navButtons[key].onclick = () => showPage(key);
        }
    }

    // --- THE FIX IS HERE ---
    // We now use a single selector for all tab links
    document.querySelectorAll('.tab-link').forEach(tab => {
        tab.onclick = (event) => {
            const currentNav = event.currentTarget.parentElement;
            // Remove 'active' from sibling tabs within the same navigation group
            currentNav.querySelectorAll('.tab-link').forEach(t => t.classList.remove('active'));
            // Add 'active' to the clicked tab
            event.currentTarget.classList.add('active');

            // Check which page we're on to decide what action to take
            if (currentNav.parentElement.id === 'upgrades') {
                openUpgradeTab(event.currentTarget.dataset.tab);
            } else if (currentNav.parentElement.id === 'leaderboard') {
                fetchAndDisplayLeaderboard(event.currentTarget.dataset.sort);
            }
        };
    });

    // We also need to simplify the 'openUpgradeTab' function since the active class is handled above.
    function openUpgradeTab(tabName) {
        const upgradesPage = document.getElementById('upgrades');
        upgradesPage.querySelectorAll('.upgrade-tab-content').forEach(c => c.classList.remove('active'));
        document.getElementById(tabName).classList.add('active');
    }

    // Special handler for the main leaderboard nav button to trigger the initial fetch
    navButtons.leaderboard.addEventListener('click', () => {
        showPage('leaderboard');
        // Find the "Total Coins" tab using the NEW class and simulate a click to load data
        const defaultTab = document.querySelector('#leaderboard .tab-link[data-sort="score"]');
        if (defaultTab && !defaultTab.classList.contains('active')) {
            defaultTab.click();
        } else if (!document.querySelector('.leaderboard-item')) {
            // If the tab is already active but the list is empty, re-fetch
            fetchAndDisplayLeaderboard('score');
        }
    });


    // The rest of your event listeners
    coinImageEl.addEventListener('mousedown', () => {
        if (!playerData) return;
        score = score.plus(clickValue); // Use local clickValue
        clicksThisSecond++;
        tg.HapticFeedback.impactOccurred('light');
        scale = BUMP_AMOUNT;
        coinImageEl.style.transform = `scale(${scale})`;
        updateUI(); // Update score immediately on click
    });

    setInterval(() => {
        cpsElement.textContent = `${clicksThisSecond} CPS`;
        clicksThisSecond = 0; // Reset manual clicks per second
    }, 1000);

    // Sync only the score and last_updated to the backend
    setInterval(() => {
        if (playerData) apiRequest('/player/sync', 'POST', { userId, score: score.toFixed(9) });
    }, SYNC_INTERVAL);
}

// --- Start the game ---
init();