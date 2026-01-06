document.addEventListener('gesturestart', e => e.preventDefault());

const BACKEND_URL = 'https://si-backend-2i9b.onrender.com';
const tg = window.Telegram.WebApp;

const loadingOverlay = document.getElementById('loading-overlay');
const loadingText = document.getElementById('loading-text');
const scoreElement = document.getElementById('score');
const cpsElement = document.getElementById('cps-stat');
const perClickElement = document.getElementById('per-click-stat');
const perSecondElement = document.getElementById('per-second-stat');
const coinImageEl = document.getElementById('coinImage');

let lastSoloWinId = localStorage.getItem('lastSoloWinId') || null;

const pages = {
  clicker: document.getElementById('clicker'),
  upgrades: document.getElementById('upgrades'),
  tasks: document.getElementById('tasks'),
  leaderboard: document.getElementById('leaderboard'),
  skins: document.getElementById('skins'),
  transactions: document.getElementById('transactions'),
  games: document.getElementById('games'),
};

const navButtons = {
  clicker: document.getElementById('nav-clicker'),
  upgrades: document.getElementById('nav-upgrades'),
  tasks: document.getElementById('nav-tasks'),
  leaderboard: document.getElementById('nav-leaderboard'),
  skins: document.getElementById('nav-skins'),
  transactions: document.getElementById('nav-transactions'),
  games: document.getElementById('nav-games'),
};

const userInfo = {
  user_id: tg.initDataUnsafe?.user?.id,
  username: tg.initDataUnsafe?.user?.username,
  first_name: tg.initDataUnsafe?.user?.first_name,
  last_name: tg.initDataUnsafe?.user?.last_name,
  language_code: tg.initDataUnsafe?.user?.language_code,
  photo_url: tg.initDataUnsafe?.user?.photo_url,
};

let userId = tg.initDataUnsafe?.user?.id ?? Date.now();
const userName = tg.initDataUnsafe?.user?.username || tg.initDataUnsafe?.user?.first_name || 'Guest';

let playerData = null;
let score = new Decimal(0);
let autoClickRate = new Decimal(0);
let clickValue = new Decimal(0);

const SYNC_INTERVAL = 5000;
let clicksThisSecond = 0;
let lastFrameTime = Date.now();

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
  },
};

const baseCosts = {
  click_tier_1: new Decimal('0.000000064'),
  click_tier_2: new Decimal('0.000001024'),
  click_tier_3: new Decimal('0.000016384'),
  click_tier_4: new Decimal('0.000262144'),
  click_tier_5: new Decimal('0.004194304'),
  auto_tier_1: new Decimal('0.000000064'),
  auto_tier_2: new Decimal('0.000001024'),
  auto_tier_3: new Decimal('0.000016384'),
  auto_tier_4: new Decimal('0.000262144'),
  auto_tier_5: new Decimal('0.004194304'),
  offline_tier_1: new Decimal('0.000000064'),
  offline_tier_2: new Decimal('0.000001024'),
  offline_tier_3: new Decimal('0.000016384'),
  offline_tier_4: new Decimal('0.000262144'),
  offline_tier_5: new Decimal('0.004194304'),
};

const tasksSystem = {
  dailyTasks: [],
  achievements: [],
  lastDailyRefresh: null,
  dailyTaskTemplates: [
    { type: 'clicks', target: 100, title: 'Click Master', description: 'Perform {target} clicks', reward: '0.000000100' },
    { type: 'score', target: '0.000001000', title: 'Coin Collector', description: 'Reach {target} total coins', reward: '0.000000050' },
    { type: 'upgrades', target: 3, title: 'Upgrade Enthusiast', description: 'Purchase {target} upgrades', reward: '0.000000075' },
    { type: 'login', target: 1, title: 'Daily Login', description: 'Log in today', reward: '0.000000025' },
    { type: 'clicks_5s', target: 10, title: 'Rapid Clicker', description: 'Achieve {target} CPS', reward: '0.000000080' },
  ],
  permanentAchievements: [
    { id: 'first_click', type: 'clicks', target: 1, title: 'First Click!', description: 'Make your first click', reward: '0.000000010', completed: false },
    { id: 'click_100', type: 'clicks', target: 100, title: 'Hundred Clicks', description: 'Reach 100 total clicks', reward: '0.000000050', completed: false },
    { id: 'click_1000', type: 'clicks', target: 1000, title: 'Click Master', description: 'Reach 1,000 total clicks', reward: '0.000000200', completed: false },
    { id: 'first_upgrade', type: 'upgrades', target: 1, title: 'First Upgrade', description: 'Purchase your first upgrade', reward: '0.000000030', completed: false },
    { id: 'upgrade_10', type: 'upgrades', target: 10, title: 'Upgrade Collector', description: 'Purchase 10 upgrades', reward: '0.000000150', completed: false },
    { id: 'score_million', type: 'score', target: '0.000001000', title: 'Millionaire', description: 'Reach 1 million coins', reward: '0.000000500', completed: false },
    { id: 'daily_complete', type: 'daily_complete', target: 5, title: 'Task Master', description: 'Complete 5 daily tasks', reward: '0.000000300', completed: false },
  ],
};

let gameState = {
  solo: {
    pot: new Decimal(0),
    participants: [],
    endTime: null,
    isActive: false,
  },
  team: {
    teams: [],
    pot: new Decimal(0),
    endTime: null,
    isActive: false,
  },
  recentWinners: [],
  yourBets: {
    solo: new Decimal(0),
    team: null,
  },
};



function safeDecimal(value) {
  try {
    return new Decimal(value || 0);
  } catch {
    return new Decimal(0);
  }
}

function parseBet(inputEl) {
  const raw = (inputEl.value || '0').trim();
  if (!raw || isNaN(Number(raw))) return new Decimal(0);
  return new Decimal(raw);
}

/* ---------- Tasks / Achievements ---------- */

async function initTasksSystem() {
  await loadTasksProgress();
  generateDailyTasks();
  renderTasksUI();
  startDailyTimer();
}

function generateDailyTasks() {
  const today = new Date().toDateString();
  const lastRefresh = localStorage.getItem('lastDailyRefresh');

  if (lastRefresh !== today) {
    const shuffled = [...tasksSystem.dailyTaskTemplates].sort(() => 0.5 - Math.random());
    tasksSystem.dailyTasks = shuffled.slice(0, 5).map((task, index) => ({
      ...task,
      id: `daily_${index}`,
      progress: 0,
      completed: false,
      claimed: false,
    }));

    localStorage.setItem('lastDailyRefresh', today);
    localStorage.setItem('dailyTasks', JSON.stringify(tasksSystem.dailyTasks));
  } else {
    const savedTasks = localStorage.getItem('dailyTasks');
    if (savedTasks) {
      tasksSystem.dailyTasks = JSON.parse(savedTasks);
    }
  }
}

async function loadTasksProgress() {
  const savedAchievements = localStorage.getItem('achievementsProgress');
  if (savedAchievements) {
    tasksSystem.achievements = JSON.parse(savedAchievements);
  } else {
    tasksSystem.achievements = tasksSystem.permanentAchievements.map(ach => ({
      ...ach,
      progress: 0,
      completed: false,
      claimed: false,
    }));
  }

  const stats = JSON.parse(localStorage.getItem('lifetimeStats') || '{}');
  tasksSystem.lifetimeStats = {
    totalClicks: stats.totalClicks || 0,
    totalUpgrades: stats.totalUpgrades || 0,
    totalScore: stats.totalScore || '0',
    dailyTasksCompleted: stats.dailyTasksCompleted || 0,
  };
}

function updateTaskProgress(type, amount = 1) {
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

  if (type === 'clicks') {
    tasksSystem.lifetimeStats.totalClicks += amount;
  } else if (type === 'upgrades') {
    tasksSystem.lifetimeStats.totalUpgrades += amount;
  }

  saveTasksProgress();
  renderTasksUI();
}

async function claimTaskReward(taskId, isAchievement = false) {
  const tasks = isAchievement ? tasksSystem.achievements : tasksSystem.dailyTasks;
  const task = tasks.find(t => t.id === taskId);

  if (!task || !task.completed || task.claimed) return;

  try {
    const reward = new Decimal(task.reward);
    score = score.plus(reward);
    updateUI();
    task.claimed = true;

    if (!isAchievement) {
      tasksSystem.lifetimeStats.dailyTasksCompleted += 1;
      updateTaskProgress('daily_complete', 1);
    }

    saveTasksProgress();
    renderTasksUI();
    tg.HapticFeedback.notificationOccurred('success');
    showRewardNotification(`+${reward.toFixed(9)} coins!`);
  } catch (error) {
    console.error('Failed to claim reward:', error);
    tg.HapticFeedback.notificationOccurred('error');
  }
}

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

  container.innerHTML = tasksSystem.dailyTasks
    .map(
      task => `
        <div class="task-item ${task.completed ? 'task-completed' : ''}">
          <div class="task-info">
            <div class="task-title">${task.title}</div>
            <div class="task-description">${task.description.replace('{target}', task.target)}</div>
            <div class="task-progress">
              Progress: ${task.progress}/${task.target}
              ${
                task.completed
                  ? '<span class="completed-badge"> ✓ Completed</span>'
                  : ''
              }
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
      `,
    )
    .join('');
}

function renderAchievements() {
  const container = document.getElementById('achievements-list');
  if (!container) return;

  container.innerHTML = tasksSystem.achievements
    .map(
      achievement => `
        <div class="achievement-item ${achievement.completed ? 'achievement-completed' : ''}">
          <div class="task-info">
            <div class="task-title">${achievement.title}</div>
            <div class="task-description">${achievement.description}</div>
            <div class="task-progress">
              Progress: ${achievement.progress}/${achievement.target}
              ${
                achievement.completed
                  ? '<span class="completed-badge"> ✓ Completed</span>'
                  : ''
              }
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
      `,
    )
    .join('');
}

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
      timerElement.textContent = `${hours
        .toString()
        .padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds
        .toString()
        .padStart(2, '0')}`;
    }
  }

  updateTimer();
  setInterval(updateTimer, 1000);
}

function saveTasksProgress() {
  localStorage.setItem('dailyTasks', JSON.stringify(tasksSystem.dailyTasks));
  localStorage.setItem('achievementsProgress', JSON.stringify(tasksSystem.achievements));
  localStorage.setItem('lifetimeStats', JSON.stringify(tasksSystem.lifetimeStats));
}

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

const style = document.createElement('style');
style.textContent = `
    @keyframes fadeInOut {
        0% { opacity: 0; transform: translate(-50%, -40%); }
        20% { opacity: 1; transform: translate(-50%, -50%); }
        80% { opacity: 1; transform: translate(-50%, -50%); }
        100% { opacity: 0; transform: translate(-50%, -60%); }
    }

    @keyframes slideDown {
        from {
            opacity: 0;
            transform: translateX(-50%) translateY(-20px);
        }
        to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
        }
    }

    @keyframes slideUp {
        from {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
        }
        to {
            opacity: 0;
            transform: translateX(-50%) translateY(-20px);
        }
    }
`;
document.head.appendChild(style);

/* ---------- API + UI Core ---------- */

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

  Object.values(pages).forEach(p => {
    if (p) p.classList.remove('active');
  });

  pages[pageId].classList.add('active');
  Object.values(navButtons).forEach(b => {
    if (b) b.classList.remove('active');
  });
  navButtons[pageId].classList.add('active');
}

function updateUI() {
  if (!playerData) return;
  scoreElement.textContent = score.toFixed(9);
  perClickElement.textContent = clickValue.toFixed(9);
  perSecondElement.textContent = autoClickRate.toFixed(9);

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
        </div>
      `;
    }
  }
  for (const type in upgrades) {
    for (const id in upgrades[type]) {
      const btn = document.getElementById(`${id}_btn`);
      if (btn) btn.onclick = () => purchaseUpgrade(id);
    }
  }
}

async function purchaseUpgrade(upgradeId) {
  const btn = document.getElementById(`${upgradeId}_btn`);
  const originalText = btn.innerHTML;
  btn.disabled = true;

  updateTaskProgress('upgrades', 1);

  try {
    const { player } = await apiRequest('/player/upgrade', 'POST', { userId, upgradeId });
    playerData = player;

    score = new Decimal(playerData.score);
    clickValue = new Decimal(playerData.click_value);
    autoClickRate = new Decimal(playerData.auto_click_rate);
    updateUI();

    tg.HapticFeedback.notificationOccurred('success');
    btn.innerHTML = 'Success!';
  } catch (error) {
    console.error('Upgrade failed:', error);
    tg.HapticFeedback.notificationOccurred('error');
    btn.innerHTML = 'Not Enough Coins';
  } finally {
    setTimeout(() => {
      btn.innerHTML = originalText;
      updateUI();
    }, 1000);
  }
}

/* ---------- Leaderboard ---------- */

async function fetchAndDisplayLeaderboard(sortBy = 'score') {
  const listContainer = document.getElementById('leaderboard-list');
  listContainer.innerHTML = '<div class="loading-spinner" style="margin: 2rem auto;"></div>';

  try {
    const players = await apiRequest(`/leaderboard/${sortBy}`);
    listContainer.innerHTML = '';

    if (!players || players.length === 0) {
      listContainer.innerHTML = '<p style="text-align: center;">The leaderboard is empty!</p>';
      return;
    }

    players.forEach((player, index) => {
      const rank = index + 1;
      const item = document.createElement('div');
      item.className = 'leaderboard-item';

      // avatar
      let pfpElement;
      if (player.profile_photo_url) {
        pfpElement = `<img src="${player.profile_photo_url}" class="pfp" alt="pfp">`;
      } else {
        const initial = player.username ? player.username.charAt(0).toUpperCase() : '?';
        const color = getColorForUser(player.username || '');
        pfpElement = `<div class="pfp-placeholder" style="background-color: ${color};">${initial}</div>`;
      }

        const hasFirst = player.first_name && player.first_name.trim().length > 0;
        const hasLast = player.last_name && player.last_name.trim().length > 0;
        const displayName = hasFirst
        ? `${player.first_name}${hasLast ? ' ' + player.last_name : ''}`
        : (player.username || 'Anonymous');

        const hasUsername = Boolean(player.username);
        const displayUsername = hasUsername ? `@${player.username}` : '';


      let displayValue;
      switch (sortBy) {
        case 'click_value':
          displayValue = new Decimal(player.click_value).toFixed(9);
          break;
        case 'auto_click_rate':
          displayValue = new Decimal(player.auto_click_rate).toFixed(9);
          break;
        default:
          displayValue = new Decimal(player.score).toFixed(9);
      }

        item.innerHTML = `
        <div class="rank rank-${rank}">${rank}</div>
        ${pfpElement}
        <div class="user-details">
            <div class="display-name">${displayName}</div>
            ${displayUsername ? `<div class="username-tag">${displayUsername}</div>` : ''}
        </div>
        <div class="score-value">${displayValue}</div>
        `;


      if (hasUsername) {
        item.dataset.username = player.username;
        item.classList.add('lb-clickable');
      }

      listContainer.appendChild(item);
    });

    listContainer.querySelectorAll('.leaderboard-item.lb-clickable').forEach(row => {
      row.addEventListener('click', () => {
        const uname = row.dataset.username;
        if (!uname) return;

        const link = `https://t.me/${uname}`;

        if (window.Telegram && Telegram.WebApp && Telegram.WebApp.openTelegramLink) {
          Telegram.WebApp.openTelegramLink(`https://t.me/${uname}`);
          Telegram.WebApp.minimize();
        } else {

          window.open(link, '_blank', 'noopener,noreferrer');
        }
      });
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

/* ---------- Wallet ---------- */

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
      receiverUsername,
      amount,
    });

    if (result.success) {
      statusEl.textContent = 'Transfer successful!';
      statusEl.className = 'status-message success';

      playerData = await apiRequest(`/player/${userId}`);
      score = new Decimal(playerData.score);
      updateUI();
      fetchTransactionHistory();
    }
  } catch (error) {
    statusEl.textContent = `Error: ${error.message}`;
    statusEl.className = 'status-message error';
  } finally {
    sendBtn.disabled = false;
    sendBtn.textContent = 'Send';
    setTimeout(() => {
      document.getElementById('receiverUsername').value = '';
      document.getElementById('transferAmount').value = '';
    }, 2000);
  }
}

function setupTransactionSearch() {
  const searchInput = document.getElementById('transaction-search');
  if (!searchInput) return;
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

async function fetchTransactionHistory() {
  const historyList = document.getElementById('transaction-history-list');
  historyList.innerHTML = '<p>Loading history...</p>';

  try {
    const history = await apiRequest(`/wallet/history/${userId}`);
    if (!history || history.length === 0) {
      historyList.innerHTML = '<p>No transactions yet.</p>';
      return;
    }

    historyList.innerHTML = history
      .map(tx => {
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
      })
      .join('');
  } catch (error) {
    historyList.innerHTML = '<p class="error">Could not load history.</p>';
  }
}

/* ---------- Games (solo + team) ---------- */

async function initGames() {
  await loadGameState();
  setupGameEventListeners();
  startGameTimers();
  updateGamesUI();
}

async function loadGameState() {
  try {
    const state = await apiRequest(`/games/state/${userId}`);
    if (state) applyGameStateFromServer(state);
  } catch (error) {
    console.error('Failed to load game state:', error);
  }
}

function applyGameStateFromServer(state) {
  gameState = {
    solo: {
      pot: new Decimal(state.solo?.pot || 0),
      participants: state.solo?.participants || [],
      endTime: state.solo?.endTime ? new Date(state.solo.endTime) : null,
      isActive: !!state.solo?.isActive,
    },
    team: {
      teams: state.team?.teams || [],
      pot: new Decimal(state.team?.pot || 0),
      endTime: state.team?.endTime ? new Date(state.team.endTime) : null,
      isActive: !!state.team?.isActive,
    },
    recentWinners: state.recentWinners || [],
    yourBets: {
      solo: new Decimal(state.yourBets?.solo || 0),
      team: state.yourBets?.team || null,
    },
  };

  updateGamesUI();
}

async function refreshGameState() {
  try {
    const state = await apiRequest(`/games/state/${userId}`);
    if (state) applyGameStateFromServer(state);
  } catch (e) {
    console.error('refreshGameState failed', e);
  }
}

function startGameTimers() {
  updateTimers();
  setInterval(updateTimers, 1000);
  setInterval(refreshGameState, 5000);
}

function updateTimers() {
  const now = new Date();

  const soloTimerEl = document.getElementById('solo-timer');
  if (gameState.solo.endTime && gameState.solo.isActive) {
    const soloTimeLeft = Math.max(0, gameState.solo.endTime - now);
    const soloMinutes = Math.floor(soloTimeLeft / 60000);
    const soloSeconds = Math.floor((soloTimeLeft % 60000) / 1000);
    if (soloTimerEl) {
      soloTimerEl.textContent =
        soloMinutes.toString().padStart(2, '0') +
        ':' +
        soloSeconds.toString().padStart(2, '0');
    }
  } else if (soloTimerEl) {
    soloTimerEl.textContent = '--:--';
  }

  const teamTimerEl = document.getElementById('team-timer');
  if (gameState.team.endTime && gameState.team.isActive) {
    const teamTimeLeft = Math.max(0, gameState.team.endTime - now);
    const teamMinutes = Math.floor(teamTimeLeft / 60000);
    const teamSeconds = Math.floor((teamTimeLeft % 60000) / 1000);
    if (teamTimerEl) {
      teamTimerEl.textContent =
        teamMinutes.toString().padStart(2, '0') +
        ':' +
        teamSeconds.toString().padStart(2, '0');
    }
  } else if (teamTimerEl) {
    teamTimerEl.textContent = '--:--';
  }
}

async function joinSoloLottery() {
  const betAmountInput = document.getElementById('solo-bet-amount');
  const betAmount = parseBet(betAmountInput);
  if (betAmount.isZero() || betAmount.isNegative()) {
    showGameNotification('Please enter a valid bet amount', 'error');
    return;
  }

  try {
    const result = await apiRequest('/games/join-solo', 'POST', {
      userId,
      betAmount: betAmount.toFixed(9),
    });
    if (!result.success) {
      showGameNotification(result.error || 'Failed to join', 'error');
      return;
    }
    score = new Decimal(result.newBalance);
    playerData.score = score.toFixed(9);
    applyGameStateFromServer(result.state);
    updateUI();
    showGameNotification('Joined solo lottery', 'success');
  } catch (error) {
    console.error('joinSoloLottery failed', error);
    showGameNotification('Failed to join lottery', 'error');
  }
}

async function drawSoloLottery() {
  try {
    const result = await apiRequest('/games/draw-solo', 'POST', { userId });

    if (!result.success) {
      showGameNotification(result.error || 'Cannot draw yet', 'error');
      return;
    }

    if (result.winner && result.prize) {
      const winId = String(result.winner.userId);

      if (String(result.winner.userId) === String(userId) && winId !== lastSoloWinId) {
        lastSoloWinId = winId;
        localStorage.setItem('lastSoloWinId', winId);

        showGameModal(
          'You Won!',
          `+${result.prize} SISI`,
          '🎉'
        );
      }
    }

    await initGames();
    updateGamesUI();
  } catch (e) {
    console.error('draw-solo failed', e);
    showGameNotification(e.message || 'Failed to draw winner', 'error');
  }
}

async function withdrawSoloLottery() {
  try {
    const result = await apiRequest('/games/withdraw-solo', 'POST', { userId });

    if (!result.success) {
      showGameNotification(result.error || 'Failed to withdraw', 'error');
      return;
    }

    score = new Decimal(result.newBalance);
    playerData.score = score.toFixed(9);
    applyGameStateFromServer(result.state);
    updateUI();
    showGameNotification('Withdrawn from solo game', 'success');
  } catch (e) {
    console.error('withdrawSoloLottery failed', e);
    showGameNotification(e.message || 'Failed to withdraw', 'error');
  }
}



async function joinTeamLottery(teamId) {
  const betAmountInput = document.getElementById('team-bet-amount');
  const betAmount = parseBet(betAmountInput);
  if (betAmount.isZero() || betAmount.isNegative()) {
    showGameNotification('Please enter a valid bet amount', 'error');
    return;
  }

  try {
    const result = await apiRequest('/games/team/join', 'POST', {
      userId,
      teamId,
      betAmount: betAmount.toFixed(9),
    });
    if (!result.success) {
      showGameNotification(result.error || 'Failed to join team', 'error');
      return;
    }
    score = new Decimal(result.newBalance);
    playerData.score = score.toFixed(9);
    applyGameStateFromServer(result.state);
    updateUI();
    showGameNotification('Joined team', 'success');
  } catch (error) {
    console.error('joinTeamLottery failed', error);
    showGameNotification('Failed to join team', 'error');
  }
}

async function createNewTeam() {
  const betAmountInput = document.getElementById('team-bet-amount');
  const betAmount = parseBet(betAmountInput);
  if (betAmount.isZero() || betAmount.isNegative()) {
    showGameNotification('Please enter a valid bet amount', 'error');
    return;
  }

  const teamName = prompt('Enter team name (max 20 characters):');
  if (!teamName || teamName.trim().length === 0 || teamName.length > 20) {
    showGameNotification('Invalid team name', 'error');
    return;
  }

  try {
    const result = await apiRequest('/games/team/create', 'POST', {
      userId,
      teamName: teamName.trim(),
      betAmount: betAmount.toFixed(9),
    });
    if (!result.success) {
      showGameNotification(result.error || 'Failed to create team', 'error');
      return;
    }
    score = new Decimal(result.newBalance);
    playerData.score = score.toFixed(9);
    applyGameStateFromServer(result.state);
    updateUI();
    showGameNotification(`Created team "${teamName.trim()}"`, 'success');
  } catch (error) {
    console.error('createNewTeam failed', error);
    showGameNotification('Failed to create team', 'error');
  }
}

function updateGamesUI() {
  const balanceEl = document.getElementById('games-balance');
  if (balanceEl) balanceEl.textContent = score.toFixed(9);

  const soloPotEl = document.getElementById('solo-pot');
  if (soloPotEl) soloPotEl.textContent = gameState.solo.pot.toFixed(9);

  const yourSoloBetEl = document.getElementById('your-solo-bet');
  if (yourSoloBetEl) yourSoloBetEl.textContent = gameState.yourBets.solo.toFixed(9);

  const soloCountEl = document.getElementById('solo-participants-count');
  if (soloCountEl) soloCountEl.textContent = gameState.solo.participants.length;

  const soloParticipantsContainer = document.getElementById('solo-participants');
  if (soloParticipantsContainer) {
    soloParticipantsContainer.innerHTML = gameState.solo.participants
      .sort((a, b) => safeDecimal(b.bet).minus(safeDecimal(a.bet)).toNumber())
      .map(p => {
        const bet = safeDecimal(p.bet);

        const hasFirst = p.first_name && p.first_name.trim().length > 0;
        const hasLast = p.last_name && p.last_name.trim().length > 0;
        const displayName = hasFirst
          ? `${p.first_name}${hasLast ? ' ' + p.last_name : ''}`
          : (p.username || 'Anonymous');

        return `
          <div class="participant-item">
            <span class="participant-name">${displayName}</span>
            <span class="participant-bet">${bet.toFixed(9)}</span>
          </div>
        `;
      })
      .join('');
  }

  const teamPotEl = document.getElementById('team-pot');
  if (teamPotEl) teamPotEl.textContent = gameState.team.pot.toFixed(9);

  const yourTeamBetEl = document.getElementById('your-team-bet');
  const teamBetText = gameState.yourBets.team
    ? (() => {
        const team = gameState.team.teams.find(t => t.id === gameState.yourBets.team);
        if (!team) return '0';
        return safeDecimal(team.total).toFixed(9);
      })()
    : '0';
  if (yourTeamBetEl) yourTeamBetEl.textContent = teamBetText;

  const activeTeamsEl = document.getElementById('active-teams-count');
  if (activeTeamsEl) activeTeamsEl.textContent = gameState.team.teams.length;

  const teamsContainer = document.getElementById('teams-container');
  if (teamsContainer) {
    teamsContainer.innerHTML = gameState.team.teams
      .sort((a, b) => safeDecimal(b.total).minus(safeDecimal(a.total)).toNumber())
      .map(team => {
        const total = safeDecimal(team.total);
        const memberCount = (team.members || []).length;
        return `
          <div class="team-item" data-team-id="${team.id}">
            <div>
              <div class="team-name">${team.name || 'Unnamed Team'}</div>
              <div style="font-size: 0.8rem; color: var(--text-secondary);">${memberCount}/10 members</div>
            </div>
            <span class="team-total">${total.toFixed(9)}</span>
          </div>
        `;
      })
      .join('');
  }

  const winnersContainer = document.getElementById('solo-winners-list');
  if (winnersContainer) {
    winnersContainer.innerHTML = gameState.recentWinners
      .map(w => {
        const dateStr = new Date(w.date).toLocaleString();

        const hasFirst = w.first_name && w.first_name.trim().length > 0;
        const hasLast = w.last_name && w.last_name.trim().length > 0;
        const displayName = hasFirst
          ? `${w.first_name}${hasLast ? ' ' + w.last_name : ''}`
          : (w.username || 'Anonymous');

        return `
          <div class="winner-item">
            <div>
              <div class="winner-name">${displayName}</div>
              <div class="winner-date">${dateStr}</div>
            </div>
            <div class="winner-amount">${safeDecimal(w.amount).toFixed(9)}</div>
          </div>
        `;
      })
      .join('');
  }
}


// ---------- Tasks / Achievements tab switching ----------
function setupTaskTabs() {
  const taskTabs = document.querySelectorAll('#tasks .tab-link');
  const contents = {
    'daily-tasks': document.getElementById('daily-tasks'),
    achievements: document.getElementById('achievements'),
  };

  taskTabs.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;

      taskTabs.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      Object.values(contents).forEach(c => c && c.classList.remove('active'));
      if (contents[target]) contents[target].classList.add('active');
    });
  });
}

// ---------- Leaderboard tab switching ----------
function setupLeaderboardTabs() {
  const sortButtons = document.querySelectorAll('#leaderboard .tab-link');

  sortButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const sortBy = btn.dataset.sort || 'score';

      sortButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      fetchAndDisplayLeaderboard(sortBy);
    });
  });
}

    function setupUpgradeTabs() {
    const tabButtons = document.querySelectorAll('#upgrades .tab-link');
    const tabContents = {
        clickUpgrades: document.getElementById('clickUpgrades'),
        autoUpgrades: document.getElementById('autoUpgrades'),
        offlineUpgrades: document.getElementById('offlineUpgrades'),
    };

    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
        const target = btn.dataset.tab;

        tabButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        Object.values(tabContents).forEach(c => c && c.classList.remove('active'));
        if (tabContents[target]) tabContents[target].classList.add('active');
        });
    });
    }


function setupGameEventListeners() {
  document.querySelectorAll('.quick-bet-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      const multiplier = parseFloat(e.target.dataset.multiplier);
      const input = e.target.closest('.bet-amount-input')?.querySelector('input[type=number]');
      if (!input || isNaN(multiplier)) return;
      const currentValue = safeDecimal(input.value);
      const newValue = currentValue.times(multiplier);
      input.value = newValue.toFixed(9);
    });
  });

  document.querySelectorAll('.game-switch-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      const game = e.currentTarget.dataset.game;
      document.querySelectorAll('.game-switch-btn').forEach(b => b.classList.remove('active'));
      e.currentTarget.classList.add('active');
      document.querySelectorAll('.game-page').forEach(p => p.classList.remove('active'));
      const page = document.getElementById(`${game}-page`);
      if (page) page.classList.add('active');
    });
  });

  document.querySelectorAll('.solo-tab-link').forEach(tab => {
    tab.addEventListener('click', e => {
      const tabName = e.currentTarget.dataset.tab;
      document.querySelectorAll('.solo-tab-link').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.solo-tab-content').forEach(c => c.classList.remove('active'));
      e.currentTarget.classList.add('active');
      const content = document.getElementById(tabName);
      if (content) content.classList.add('active');
    });
  });

  const joinSoloBtn = document.getElementById('join-solo-btn');
  if (joinSoloBtn) joinSoloBtn.addEventListener('click', joinSoloLottery);

  const joinTeamBtn = document.getElementById('join-team-btn');
  if (joinTeamBtn) {
    joinTeamBtn.addEventListener('click', () => {
      const availableTeam = gameState.team.teams.find(team => (team.members || []).length < 10);
      if (availableTeam) joinTeamLottery(availableTeam.id);
      else showGameNotification('No available teams. Create a new team!', 'error');
    });
  }

  const createTeamBtn = document.getElementById('create-team-btn');
  if (createTeamBtn) createTeamBtn.addEventListener('click', createNewTeam);

  document.addEventListener('click', e => {
    const teamItem = e.target.closest('.team-item');
    if (!teamItem) return;
    const teamId = teamItem.dataset.teamId;
    const team = gameState.team.teams.find(t => t.id === teamId);
    if (team && confirm(`Join team "${team.name}"?`)) {
      joinTeamLottery(teamId);
    }
  });
}

function showGameNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: ${type === 'success'
    ? 'var(--accent-green)'
    : type === 'error'
    ? 'var(--accent-red)'
    : 'var(--accent-teal)'};
    color: white;
    padding: 1rem 2rem;
    border-radius: var(--border-radius);
    font-weight: 600;
    z-index: 1000;
    animation: slideDown 0.3s ease-out;
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
  `;
  notification.textContent = message;
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.animation = 'slideUp 0.3s ease-in';
    setTimeout(() => {
      if (document.body.contains(notification)) document.body.removeChild(notification);
    }, 300);
  }, 3000);
}

function showGameModal(title, message, emoji) {
  const modal = document.createElement('div');
  modal.className = 'game-modal active';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="win-animation">${emoji}</div>
      <h3 class="modal-title">${title}</h3>
      <div class="modal-prize">${message}</div>
      <button class="close-modal">Claim Prize</button>
    </div>
  `;
  document.body.appendChild(modal);

  const close = () => {
    if (document.body.contains(modal)) document.body.removeChild(modal);
  };
  modal.querySelector('.close-modal').addEventListener('click', close);
  setTimeout(close, 5000);
}

/* ---------- Telegram profile ---------- */

function getTWAUser() {
  const u = tg?.initDataUnsafe?.user;
  if (!u) return null;
  return {
    user_id: u.id,
    username: u.username ?? null,
    first_name: u.first_name ?? null,
    last_name: u.last_name ?? null,
    language_code: u.language_code ?? null,
    photo_url: u.photo_url ?? null,
  };
}

async function syncProfile() {
  const info = getTWAUser();
  if (!info) return;
  try {
    await apiRequest('/player/syncProfile', 'POST', info);
  } catch (e) {
    console.warn('Profile sync failed:', e?.message || e);
  }
}

/* ---------- Passive loop ---------- */

function gameLoop() {
  requestAnimationFrame(gameLoop);
  const now = Date.now();
  const delta = (now - lastFrameTime) / 1000;
  lastFrameTime = now;

  if (playerData) {
    const passiveIncome = autoClickRate.times(delta);
    score = score.plus(passiveIncome);
    updateUI();
  }
}

/* ---------- Init ---------- */

async function init() {
  tg.ready();
  tg.expand();

  try {
    await syncProfile();
    await initGames();
    await initTasksSystem();
    

    playerData = await apiRequest(`/player/${userId}`);
    score = new Decimal(playerData.score);
    clickValue = new Decimal(playerData.click_value);
    autoClickRate = new Decimal(playerData.auto_click_rate);

    generateUpgradesHTML();
    setupEventListeners();
    updateUI();
    updateGamesUI();
    setupTaskTabs();
    setupLeaderboardTabs();
    setupUpgradeTabs();
    setupTransactionSearch();
    

    lastFrameTime = Date.now();
    requestAnimationFrame(gameLoop);

    loadingOverlay.classList.remove('active');
    updateTaskProgress('score');
  } catch (error) {
    console.error('Initialization failed:', error);
    loadingText.innerHTML = `Connection Error!<br><small>${error.message}</small>`;
  }
}

function setupEventListeners() {
  for (const key in navButtons) {
    if (!navButtons[key]) continue;
    if (key !== 'leaderboard') {
      navButtons[key].onclick = () => showPage(key);
    }
  }

    const withdrawSoloBtn = document.getElementById('withdraw-solo-btn');
    if (withdrawSoloBtn) withdrawSoloBtn.addEventListener('click', withdrawSoloLottery);


    const drawSoloBtn = document.getElementById('draw-solo-btn');
    if (drawSoloBtn) {
    drawSoloBtn.addEventListener('click', drawSoloLottery);
    }

  navButtons.leaderboard?.addEventListener('click', () => {
    showPage('leaderboard');
    fetchAndDisplayLeaderboard('score');
  });

  coinImageEl.addEventListener('mousedown', () => {
    if (!playerData) return;
    score = score.plus(clickValue);
    clicksThisSecond++;
    tg.HapticFeedback.impactOccurred('light');
    updateTaskProgress('clicks', 1);
    coinImageEl.classList.remove('bounce');
    void coinImageEl.offsetWidth;
    coinImageEl.classList.add('bounce');
    updateUI();
  });

  coinImageEl.addEventListener(
    'touchstart',
    event => {
      if (!playerData) return;
      event.preventDefault();
      score = score.plus(clickValue);
      clicksThisSecond++;
      tg.HapticFeedback.impactOccurred('light');
      coinImageEl.classList.remove('bounce');
      void coinImageEl.offsetWidth;
      coinImageEl.classList.add('bounce');
      updateUI();
    },
    { passive: false },
  );

  document.getElementById('send-btn')?.addEventListener('click', handleSendCoins);
  setupTransactionSearch();

  setInterval(() => {
    cpsElement.textContent = `${clicksThisSecond} CPS`;
    clicksThisSecond = 0;
  }, 1000);

  setInterval(() => {
    if (playerData) {
      apiRequest('/player/sync', 'POST', { userId, score: score.toFixed(9) });
    }
  }, SYNC_INTERVAL);
}

init();
