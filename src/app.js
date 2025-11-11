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



// Task System
const tasksSystem = {
    dailyTasks: [],
    achievements: [],
    lastDailyRefresh: null,

    // Daily task templates
    dailyTaskTemplates: [
        { type: 'clicks', target: 100, title: 'Click Master', description: 'Perform {target} clicks', reward: '0.000000100' },
        { type: 'score', target: '0.000001000', title: 'Coin Collector', description: 'Reach {target} total coins', reward: '0.000000050' },
        { type: 'upgrades', target: 3, title: 'Upgrade Enthusiast', description: 'Purchase {target} upgrades', reward: '0.000000075' },
        { type: 'login', target: 1, title: 'Daily Login', description: 'Log in today', reward: '0.000000025' },
        { type: 'clicks_5s', target: 10, title: 'Rapid Clicker', description: 'Achieve {target} CPS', reward: '0.000000080' }
    ],

    // Permanent achievements
    permanentAchievements: [
        { id: 'first_click', type: 'clicks', target: 1, title: 'First Click!', description: 'Make your first click', reward: '0.000000010', completed: false },
        { id: 'click_100', type: 'clicks', target: 100, title: 'Hundred Clicks', description: 'Reach 100 total clicks', reward: '0.000000050', completed: false },
        { id: 'click_1000', type: 'clicks', target: 1000, title: 'Click Master', description: 'Reach 1,000 total clicks', reward: '0.000000200', completed: false },
        { id: 'first_upgrade', type: 'upgrades', target: 1, title: 'First Upgrade', description: 'Purchase your first upgrade', reward: '0.000000030', completed: false },
        { id: 'upgrade_10', type: 'upgrades', target: 10, title: 'Upgrade Collector', description: 'Purchase 10 upgrades', reward: '0.000000150', completed: false },
        { id: 'score_million', type: 'score', target: '0.000001000', title: 'Millionaire', description: 'Reach 1 million coins', reward: '0.000000500', completed: false },
        { id: 'daily_complete', type: 'daily_complete', target: 5, title: 'Task Master', description: 'Complete 5 daily tasks', reward: '0.000000300', completed: false }
    ]
};

// Initialize tasks system
async function initTasksSystem() {
    await loadTasksProgress();
    generateDailyTasks();
    renderTasksUI();
    startDailyTimer();
}

// Generate random daily tasks
function generateDailyTasks() {
    const today = new Date().toDateString();
    const lastRefresh = localStorage.getItem('lastDailyRefresh');

    // Only generate new tasks if it's a new day or first time
    if (lastRefresh !== today) {
        const shuffled = [...tasksSystem.dailyTaskTemplates].sort(() => 0.5 - Math.random());
        tasksSystem.dailyTasks = shuffled.slice(0, 5).map((task, index) => ({
            ...task,
            id: `daily_${index}`,
            progress: 0,
            completed: false,
            claimed: false
        }));

        localStorage.setItem('lastDailyRefresh', today);
        localStorage.setItem('dailyTasks', JSON.stringify(tasksSystem.dailyTasks));
    } else {
        // Load existing tasks
        const savedTasks = localStorage.getItem('dailyTasks');
        if (savedTasks) {
            tasksSystem.dailyTasks = JSON.parse(savedTasks);
        }
    }
}

// Load achievements progress
async function loadTasksProgress() {
    const savedAchievements = localStorage.getItem('achievementsProgress');
    if (savedAchievements) {
        tasksSystem.achievements = JSON.parse(savedAchievements);
    } else {
        tasksSystem.achievements = tasksSystem.permanentAchievements.map(ach => ({
            ...ach,
            progress: 0,
            completed: false,
            claimed: false
        }));
    }

    // Load lifetime stats
    const stats = JSON.parse(localStorage.getItem('lifetimeStats') || '{}');
    tasksSystem.lifetimeStats = {
        totalClicks: stats.totalClicks || 0,
        totalUpgrades: stats.totalUpgrades || 0,
        totalScore: stats.totalScore || '0',
        dailyTasksCompleted: stats.dailyTasksCompleted || 0
    };
}

// Update task progress
function updateTaskProgress(type, amount = 1) {
    // Update daily tasks
    tasksSystem.dailyTasks.forEach(task => {
        if (!task.completed && task.type === type) {
            if (type === 'score') {
                const currentScore = new Decimal(score);
                const targetScore = new Decimal(task.target);
                if (currentScore.greaterThanOrEqualTo(targetScore)) {
                    task.progress = task.target;
                    task.completed = true;
                }
            } else {
                task.progress += amount;
                if (task.progress >= task.target) {
                    task.completed = true;
                    task.progress = task.target;
                }
            }
        }
    });

    // Update achievements
    tasksSystem.achievements.forEach(achievement => {
        if (!achievement.completed && achievement.type === type) {
            if (type === 'score') {
                const currentScore = new Decimal(score);
                const targetScore = new Decimal(achievement.target);
                if (currentScore.greaterThanOrEqualTo(targetScore)) {
                    achievement.progress = achievement.target;
                    achievement.completed = true;
                }
            } else {
                achievement.progress += amount;
                if (achievement.progress >= achievement.target) {
                    achievement.completed = true;
                    achievement.progress = achievement.target;
                }
            }
        }
    });

    // Update lifetime stats
    if (type === 'clicks') {
        tasksSystem.lifetimeStats.totalClicks += amount;
    } else if (type === 'upgrades') {
        tasksSystem.lifetimeStats.totalUpgrades += amount;
    }

    saveTasksProgress();
    renderTasksUI();
}

// Claim task reward
async function claimTaskReward(taskId, isAchievement = false) {
    const tasks = isAchievement ? tasksSystem.achievements : tasksSystem.dailyTasks;
    const task = tasks.find(t => t.id === taskId);

    if (!task || !task.completed || task.claimed) return;

    try {
        const reward = new Decimal(task.reward);
        score = score.plus(reward);

        // Update UI immediately
        updateUI();

        // Mark as claimed
        task.claimed = true;

        // For daily completion achievement
        if (!isAchievement) {
            tasksSystem.lifetimeStats.dailyTasksCompleted += 1;
            updateTaskProgress('daily_complete', 1);
        }

        // Save progress
        saveTasksProgress();
        renderTasksUI();

        tg.HapticFeedback.notificationOccurred('success');

        // Show reward notification
        showRewardNotification(`+${reward.toFixed(9)} coins!`);

    } catch (error) {
        console.error('Failed to claim reward:', error);
        tg.HapticFeedback.notificationOccurred('error');
    }
}

// Render tasks UI
function renderTasksUI() {
    renderDailyTasks();
    renderAchievements();
}

function renderDailyTasks() {
    const container = document.getElementById('daily-tasks-list');
    if (!container) return;

    if (tasksSystem.dailyTasks.length === 0) {
        container.innerHTML = '<p>No daily tasks available.</p>';
        return;
    }

    container.innerHTML = tasksSystem.dailyTasks.map(task => `
        <div class="task-item ${task.completed ? 'task-completed' : ''}">
            <div class="task-info">
                <div class="task-title">${task.title}</div>
                <div class="task-description">${task.description.replace('{target}', task.target)}</div>
                <div class="task-progress">
                    Progress: ${task.progress}/${task.target}
                    ${task.completed ? '<span class="completed-badge"> ✓ Completed</span>' : ''}
                </div>
                <div class="task-reward">Reward: ${task.reward} coins</div>
            </div>
            <div class="task-action">
                <button class="claim-btn" 
                    onclick="claimTaskReward('${task.id}', false)"
                    ${task.completed && !task.claimed ? '' : 'disabled'}>
                    ${task.claimed ? 'Claimed' : 'Claim'}
                </button>
            </div>
        </div>
    `).join('');
}

function renderAchievements() {
    const container = document.getElementById('achievements-list');
    if (!container) return;

    container.innerHTML = tasksSystem.achievements.map(achievement => `
        <div class="achievement-item ${achievement.completed ? 'achievement-completed' : ''}">
            <div class="task-info">
                <div class="task-title">${achievement.title}</div>
                <div class="task-description">${achievement.description}</div>
                <div class="task-progress">
                    Progress: ${achievement.progress}/${achievement.target}
                    ${achievement.completed ? '<span class="completed-badge"> ✓ Completed</span>' : ''}
                </div>
                <div class="task-reward">Reward: ${achievement.reward} coins</div>
            </div>
            <div class="task-action">
                <button class="claim-btn" 
                    onclick="claimTaskReward('${achievement.id}', true)"
                    ${achievement.completed && !achievement.claimed ? '' : 'disabled'}>
                    ${achievement.claimed ? 'Claimed' : 'Claim'}
                </button>
            </div>
        </div>
    `).join('');
}

// Daily timer
function startDailyTimer() {
    function updateTimer() {
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);

        const diff = tomorrow - now;
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        const timerElement = document.getElementById('refresh-timer');
        if (timerElement) {
            timerElement.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
    }

    updateTimer();
    setInterval(updateTimer, 1000);
}

// Save progress
function saveTasksProgress() {
    localStorage.setItem('dailyTasks', JSON.stringify(tasksSystem.dailyTasks));
    localStorage.setItem('achievementsProgress', JSON.stringify(tasksSystem.achievements));
    localStorage.setItem('lifetimeStats', JSON.stringify(tasksSystem.lifetimeStats));
}

// Reward notification
function showRewardNotification(message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: var(--primary-accent);
        color: white;
        padding: 1rem 2rem;
        border-radius: var(--border-radius);
        font-weight: 600;
        z-index: 1000;
        animation: fadeInOut 2s ease-in-out;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        document.body.removeChild(notification);
    }, 2000);
}

// Add to your existing CSS
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeInOut {
        0% { opacity: 0; transform: translate(-50%, -40%); }
        20% { opacity: 1; transform: translate(-50%, -50%); }
        80% { opacity: 1; transform: translate(-50%, -50%); }
        100% { opacity: 0; transform: translate(-50%, -60%); }
    }
`;
document.head.appendChild(style);

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

    updateTaskProgress('upgrades', 1);

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


const userColors = ['#4A90E2', '#50E3C2', '#B8E986', '#F8E71C', '#F5A623', '#BD10E0', '#D0021B'];
function getColorForUser(username = '') {
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
        hash = username.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash % userColors.length);
    return userColors[index];
}


async function handleSendCoins() {
    const sendBtn = document.getElementById('send-btn');
    const statusEl = document.getElementById('transfer-status');
    const receiverUsername = document.getElementById('receiverUsername').value;
    const amount = document.getElementById('transferAmount').value;

    if (!receiverUsername || !amount) {
        statusEl.textContent = 'Please fill in both fields.';
        statusEl.className = 'status-message error';
        return;
    }

    sendBtn.disabled = true;
    sendBtn.textContent = 'Sending...';
    statusEl.textContent = '';

    try {
        const result = await apiRequest('/wallet/transfer', 'POST', {
            senderId: userId,
            receiverUsername: receiverUsername,
            amount: amount
        });

        if (result.success) {
            statusEl.textContent = 'Transfer successful!';
            statusEl.className = 'status-message success';
            // Refresh player data to show updated score
            playerData = await apiRequest(`/player/${userId}`);
            score = new Decimal(playerData.score);
            updateUI();
            fetchTransactionHistory(); // Refresh history
        }
    } catch (error) {
        statusEl.textContent = `Error: ${error.message}`;
        statusEl.className = 'status-message error';
    } finally {
        sendBtn.disabled = false;
        sendBtn.textContent = 'Send';
        // Clear form after a short delay
        setTimeout(() => {
            document.getElementById('receiverUsername').value = '';
            document.getElementById('transferAmount').value = '';
        }, 2000);
    }
}

// Add search functionality
function setupTransactionSearch() {
    const searchInput = document.getElementById('transaction-search');
    searchInput.addEventListener('input', filterTransactions);
}

function filterTransactions() {
    const searchTerm = document.getElementById('transaction-search').value.toLowerCase();
    const transactionItems = document.querySelectorAll('.transaction-item');

    transactionItems.forEach(item => {
        const text = item.textContent.toLowerCase();
        if (text.includes(searchTerm)) {
            item.classList.remove('hidden');
        } else {
            item.classList.add('hidden');
        }
    });
}

// Update fetchTransactionHistory to include searchable data
async function fetchTransactionHistory() {
    const historyList = document.getElementById('transaction-history-list');
    historyList.innerHTML = '<p>Loading history...</p>';

    try {
        const history = await apiRequest(`/wallet/history/${userId}`);
        if (!history || history.length === 0) {
            historyList.innerHTML = '<p>No transactions yet.</p>';
            return;
        }

        historyList.innerHTML = history.map(tx => {
            const isSent = tx.type === 'sent';
            const txDetails = isSent
                ? `Sent to @${tx.receiver_username}`
                : `Received from User ID ${tx.sender_id}`;

            const amountClass = isSent ? 'tx-amount sent' : 'tx-amount received';
            const amountSign = isSent ? '-' : '+';
            const amount = new Decimal(tx.amount).toFixed(9);

            return `
                <div class="transaction-item" data-amount="${amount}" data-type="${isSent ? 'sent' : 'received'}" data-date="${tx.created_at}">
                    <div class="tx-details">
                        <span class="tx-type">${txDetails}</span>
                        <span class="tx-date">${new Date(tx.created_at).toLocaleString()}</span>
                    </div>
                    <div class="${amountClass}">${amountSign}${amount}</div>
                </div>
            `;
        }).join('');

    } catch (error) {
        historyList.innerHTML = '<p class="error">Could not load history.</p>';
    }
}

// Don't forget to call setupTransactionSearch in your init function



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
    await initTasksSystem();

    // Update score-based tasks
    updateTaskProgress('score');

    try {
        // 2) now load/create the player row
        playerData = await apiRequest(`/player/${userId}`);
        score = new Decimal(playerData.score);
        clickValue = new Decimal(playerData.click_value);
        autoClickRate = new Decimal(playerData.auto_click_rate);

        generateUpgradesHTML();
        setupEventListeners();
        updateUI();
        setupTransactionSearch();

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

        updateTaskProgress('clicks', 1);
        updateTaskProgress('clicks_5s', 0);

        coinImageEl.classList.remove('bounce');
        void coinImageEl.offsetWidth; // Trigger reflow
        coinImageEl.classList.add('bounce');

        updateUI(); // Update score immediately on click
    });


    coinImageEl.addEventListener('touchstart', (event) => {
        if (!playerData) return;
        event.preventDefault();

        score = score.plus(clickValue);
        clicksThisSecond++;
        tg.HapticFeedback.impactOccurred('light');

        coinImageEl.classList.remove('bounce');
        void coinImageEl.offsetWidth;
        coinImageEl.classList.add('bounce');

        updateUI();
    }, { passive: false });


    document.querySelectorAll('#tasks .tab-link').forEach(tab => {
        tab.addEventListener('click', (e) => {
            const tabName = e.currentTarget.dataset.tab;
            document.querySelectorAll('#tasks .tasks-tab-content').forEach(content => {
                content.classList.remove('active');
            });
            document.querySelectorAll('#tasks .tab-link').forEach(link => {
                link.classList.remove('active');
            });
            document.getElementById(tabName).classList.add('active');
            e.currentTarget.classList.add('active');
        });
    });

    // Don't forget to call setupTransactionSearch
    setupTransactionSearch();


    document.getElementById('send-btn').addEventListener('click', handleSendCoins);

    // Fetch history when the wallet page is shown
    navButtons.transactions.addEventListener('click', () => {
        showPage('transactions');
        fetchTransactionHistory();
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