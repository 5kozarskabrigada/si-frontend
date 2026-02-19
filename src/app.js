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
  upgrades: document.getElementById('nav-folder'),
  tasks: document.getElementById('nav-folder'),
  leaderboard: document.getElementById('nav-folder'),
  skins: document.getElementById('nav-folder'),
  transactions: document.getElementById('nav-folder'),
  games: document.getElementById('nav-games'),
};

const mainFolder = {
  title: 'Menu',
  items: [
    { id: 'nav-upgrades', label: 'Upgrades', icon: '<i class="fas fa-gem"></i>', page: 'upgrades' },
    { id: 'nav-leaderboard', label: 'Leaderboard', icon: '<i class="fas fa-trophy"></i>', page: 'leaderboard' },
    { id: 'nav-tasks', label: 'Tasks', icon: '<i class="fas fa-tasks"></i>', page: 'tasks' },
    { id: 'nav-wallet', label: 'Wallet', icon: '<i class="fas fa-wallet"></i>', page: 'transactions' },
    { id: 'nav-skins', label: 'Skins', icon: '<i class="fas fa-tshirt"></i>', page: 'skins' },
  ]
};

let activeFolder = null;

const userInfo = {
  user_id: tg.initDataUnsafe?.user?.id,
  username: tg.initDataUnsafe?.user?.username,
  first_name: tg.initDataUnsafe?.user?.first_name,
  last_name: tg.initDataUnsafe?.user?.last_name,
  language_code: tg.initDataUnsafe?.user?.language_code,
  photo_url: tg.initDataUnsafe?.user?.photo_url,
};

let userId = tg.initDataUnsafe?.user?.id ?? null;
const userName = tg.initDataUnsafe?.user?.username || tg.initDataUnsafe?.user?.first_name || 'Guest';

let playerData = null;
let score = new Decimal(0);
let autoClickRate = new Decimal(0);
let clickValue = new Decimal(0);

const SYNC_INTERVAL = 5000;
let clicksThisSecond = 0;
let pendingClickUpdates = 0;
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
  lifetimeStats: {
    totalClicks: 0,
    totalUpgrades: 0,
    totalScore: '0',
    dailyTasksCompleted: 0,
  }
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

function escapeHtml(text) {
  if (text === null || typeof text === 'undefined') return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function parseBet(inputEl) {
  const raw = (inputEl.value || '0').trim();
  if (!raw || isNaN(Number(raw))) return new Decimal(0);
  return new Decimal(raw);
}

async function initTasksSystem() {
  await loadTasksProgress();
  renderTasksUI();
}

async function loadTasksProgress() {

  try {
    const tasks = await apiRequest('/tasks/active');
    if (tasks) {
      tasksSystem.dailyTasks = tasks;
    }
  } catch (e) {
    console.error('Failed to load active tasks:', e);
  }

  const stats = JSON.parse(localStorage.getItem('lifetimeStats') || '{}');
  tasksSystem.lifetimeStats = {
    totalClicks: stats.totalClicks || 0,
    totalUpgrades: stats.totalUpgrades || 0,
    totalScore: stats.totalScore || '0',
    dailyTasksCompleted: stats.dailyTasksCompleted || 0,
  };
}

async function updateTaskProgress(type, amount = 1) {

  const relevantTasks = tasksSystem.dailyTasks.filter(t => t.type === type && !t.completed);
  for (const task of relevantTasks) {
    try {
        const updated = await apiRequest('/tasks/progress', 'POST', {
            userId: playerData.user_id,
            taskId: task.id,
            increment: amount
        });
        

        task.progress = updated.progress;
        task.completed = updated.completed;
        
        if (task.completed) {
            showGameModal('Task Completed!', `You completed: ${task.title}`, '✓', 'Great!');
        }
    } catch (e) {
        console.error('Failed to update task progress:', e);
    }
  }

  if (type === 'clicks') {
    tasksSystem.lifetimeStats.totalClicks += amount;
  } else if (type === 'upgrades') {
    tasksSystem.lifetimeStats.totalUpgrades += amount;
  }

  saveTasksProgress();
  renderTasksUI();
}

function renderTasksUI() {
  renderDailyTasks();
}

function renderDailyTasks() {
  const container = document.getElementById('daily-tasks-list');
  if (!container) return;

  if (tasksSystem.dailyTasks.length === 0) {
    container.innerHTML = '<p style="text-align:center; padding: 2rem; color: var(--text-secondary);">No active tasks available right now.</p>';
    return;
  }

  container.innerHTML = tasksSystem.dailyTasks
    .sort((a, b) => {




        
        const aReady = a.completed && !a.claimed;
        const bReady = b.completed && !b.claimed;
        
        if (aReady && !bReady) return -1;
        if (!aReady && bReady) return 1;
        
        if (!a.completed && b.completed) return -1;
        if (a.completed && !b.completed) return 1;
        
        return 0;
    })
    .map(task => {
      const isCompleted = task.completed;
      const isClaimed = task.claimed;
      const progressPercent = Math.min((task.progress / task.target_value) * 100, 100);
      
      const rewardDisplay = task.reward_type === 'coins' 
          ? `${new Decimal(task.reward_amount).toFixed(9)} coins`
          : `🎁 ${task.reward_amount}x Present`;

      let actionButton = '';
      
      if (isClaimed) {
          actionButton = '<span class="claimed-text">Claimed</span>';
      } else if (isCompleted) {
          actionButton = `<button class="claim-btn" id="btn-claim-${task.id}" onclick="claimAdminTask('${task.id}')">Claim</button>`;
      } else if (task.type === 'manual' && task.task_url) {

          actionButton = `<button class="claim-btn verify-btn" id="btn-verify-${task.id}" onclick="verifyTask('${task.id}', '${task.task_url}')">Go</button>`;
      } else {
          actionButton = `<div class="task-reward">${rewardDisplay}</div>`;
      }

      return `
      <div class="task-item ${isCompleted ? 'completed' : ''} ${isClaimed ? 'claimed' : ''}">
        <div class="task-info">
          <div class="task-title">${task.title}</div>
          <div class="task-desc">${task.description}</div>
          <div class="task-progress-bar">
            <div class="task-progress-fill" style="width: ${progressPercent}%"></div>
          </div>
          <div class="task-progress-text">${task.progress} / ${task.target_value}</div>
        </div>
        <div class="task-action">
          ${actionButton}
        </div>
      </div>
    `;
    })
    .join('');
}


let skinsList = [];

async function loadSkins() {
  try {
    const res = await apiRequest('/skins');
    skinsList = Array.isArray(res.skins) ? res.skins : (res.skins || []);


    const ownedMap = {};
    (playerData?.owned_skins || []).forEach(s => { if (s && s.id) ownedMap[String(s.id)] = s; });

    skinsList = skinsList.map(s => ({
      ...s,
      owned: Boolean(ownedMap[String(s.id)]),
      owned_meta: ownedMap[String(s.id)] || null
    }));

    renderSkinsUI();
  } catch (e) {
    console.error('Failed to load skins:', e);
  }
}

function renderSkinsUI() {
  const container = document.getElementById('skins-list') || document.getElementById('skins');
  if (!container) return;

  if (!skinsList || skinsList.length === 0) {
    container.innerHTML = '<p style="text-align:center; padding: 2rem; color: var(--text-secondary);">No skins available yet.</p>';
    return;
  }

  const grid = skinsList.map(skin => {
    const owned = skin.owned;
    const isSelected = playerData?.selected_skin && playerData.selected_skin.id === skin.id;
    const priceText = skin.price ? `${new Decimal(skin.price).toFixed(9)} coins` : (skin.task_id ? 'Unlock via task' : 'Free');

    let actionBtn = '';
    if (owned) {
      if (isSelected) actionBtn = '<span class="badge badge-primary">Selected</span>';
      else actionBtn = `<button class="btn btn-outline" onclick="selectSkin('${skin.id}')">Select</button>`;
    } else if (skin.price) {
      actionBtn = `<button class="btn btn-primary" onclick="purchaseSkin('${skin.id}')">Buy for ${new Decimal(skin.price).toFixed(9)}</button>`;
    } else if (skin.task_id) {
      actionBtn = `<button class="btn btn-outline" onclick="showTaskForSkin('${skin.task_id}')">View Task</button>`;
    } else {
      actionBtn = `<button class="btn btn-outline" disabled>Unavailable</button>`;
    }

    return `
      <div class="skin-card content-card" style="display:flex; gap:1rem; align-items:center;">
        <div style="width:96px; height:96px; flex-shrink:0; display:flex; align-items:center; justify-content:center;">
          <img src="${escapeHtml(skin.image_url || '')}" alt="${escapeHtml(skin.name)}" style="max-width:100%; max-height:100%; border-radius:8px; object-fit:contain;" onerror="this.src='https://via.placeholder.com/96?text=No+Image'">
        </div>
        <div style="flex:1; min-width:0;">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:1rem;">
            <div style="min-width:0;">
              <div style="font-weight:700; font-size:1rem; color:var(--text-main);">${escapeHtml(skin.name)}</div>
              <div style="color:var(--text-dim); font-size:0.85rem;">${priceText}</div>
            </div>
            <div style="display:flex; gap:0.5rem; align-items:center;">
              ${actionBtn}
            </div>
          </div>
          ${skin.description ? `<div style="margin-top:0.5rem; color:var(--text-secondary);">${escapeHtml(skin.description)}</div>` : ''}
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = `<div style="display:flex; flex-direction:column; gap:1rem;">${grid}</div>`;
}

window.showTaskForSkin = function(taskId) {
  if (!taskId) return showGameNotification('Task information not available', 'error');

  showPage('tasks');

  setTimeout(() => {
    const el = document.querySelector(`[data-task-id="${taskId}"]`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    else showGameNotification('Open the Tasks tab to view how to unlock this skin', 'info');
  }, 300);
};

window.purchaseSkin = async function(skinId) {
  if (!skinId) return;
  try {
    showGameNotification('Processing purchase...', 'info');
    const result = await apiRequest('/skins/purchase', 'POST', { skinId });
    if (result && result.success) {

      playerData = await apiRequest(`/player/${userId}`);
      score = new Decimal(playerData.score);
      updateUI();
      await loadSkins();
      showGameNotification('Skin purchased!', 'success');
    } else {
      showGameNotification((result && result.error) || 'Purchase failed', 'error');
    }
  } catch (e) {
    console.error('purchaseSkin error', e);
    showGameNotification(e.message || 'Purchase failed', 'error');
  }
};

window.selectSkin = async function(skinId) {
  if (!skinId) return;
  try {
    const res = await apiRequest('/player/select-skin', 'POST', { skinId });
    if (res && res.success) {
      playerData = await apiRequest(`/player/${userId}`);

      const img = playerData.selected_skin?.image_url || (playerData.owned_skins || []).find(s => s.selected)?.image_url;
      if (img) coinImageEl.src = img;
      await loadSkins();
      showGameNotification('Skin applied!', 'success');
    } else {
      showGameNotification(res.error || 'Failed to select skin', 'error');
    }
  } catch (e) {
    console.error('selectSkin error', e);
    showGameNotification(e.message || 'Failed to select skin', 'error');
  }
};


async function verifyTask(taskId, url) {
    const btn = document.getElementById(`btn-verify-${taskId}`);
    if (!btn) return;


    if (window.Telegram?.WebApp?.openLink) {
        window.Telegram.WebApp.openLink(url);
    } else {
        window.open(url, '_blank');
    }


    btn.disabled = true;
    btn.textContent = 'Checking...';
    

    setTimeout(async () => {
        btn.textContent = 'Verify';
        btn.disabled = false;
        btn.onclick = async () => {
            btn.textContent = 'Verifying...';
            btn.disabled = true;
            


            try {

                const updated = await apiRequest('/tasks/progress', 'POST', {
                    userId: playerData.user_id,
                    taskId: taskId,
                    increment: 1 
                });
                
                if (updated.completed) {
                    showGameNotification('Task verified!', 'success');

                    await loadTasksProgress();
                    renderTasksUI();
                } else {

                    showGameNotification('Progress updated!', 'success');
                    await loadTasksProgress();
                    renderTasksUI();
                }
            } catch (e) {
                console.error(e);
                showGameNotification('Verification failed. Try again.', 'error');
                btn.textContent = 'Verify';
                btn.disabled = false;
            }
        };
    }, 5000);
}

window.verifyTask = verifyTask;

async function claimAdminTask(taskId) {
  const btn = document.getElementById(`btn-claim-${taskId}`);
  if (btn) {
      btn.disabled = true;
      btn.textContent = 'Claiming...';
  }

  try {
    const response = await apiRequest('/tasks/claim', 'POST', {
        userId: playerData.user_id,
        taskId: taskId
    });

    if (response.success) {
        showGameModal('Reward Claimed!', 
            response.reward.type === 'coins' 
                ? `You received ${response.reward.amount} coins!` 
                : `You received a special present!`, 
            '🎁'
        );
        

        await initTasksSystem();
        updateUI();
    } else {
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'Claim';
        }
        showGameNotification(response.error || 'Failed to claim reward', 'error');
    }
  } catch (e) {
    console.error('Claim error:', e);
    if (btn) {
        btn.disabled = false;
        btn.textContent = 'Claim';
    }
    showGameNotification('Failed to claim reward', 'error');
  }
}

window.claimAdminTask = claimAdminTask;

function saveTasksProgress() {
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

async function apiRequest(endpoint, method = 'GET', body = null) {
  try {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };
    if (userId !== null && typeof userId !== 'undefined') {
      options.headers['x-user-id'] = String(userId);
    }
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

function showPage(pageId, tabId = null) {
  const page = pages[pageId];
  const btn = navButtons[pageId];
  
  if (!page) return;

  Object.values(pages).forEach(p => {
    if (p) p.classList.remove('active');
  });
  page.classList.add('active');

  Object.values(navButtons).forEach(b => {
    if (b) {
        b.classList.remove('active');
        b.classList.remove('active-folder');
    }
  });

  if (btn) {
    btn.classList.add('active');
    if (btn.classList.contains('folder-btn')) {
        btn.classList.add('active-folder');
    }
  }


  if (pageId === 'leaderboard') {
    fetchAndDisplayLeaderboard('score');
  }


  if (tabId) {
    if (pageId === 'upgrades') {
        const tabBtn = document.querySelector(`#upgrades .tab-link[data-tab="${tabId}"]`);
        if (tabBtn) tabBtn.click();
    }
  }

  closeFolder();
}

function toggleFolder() {
    if (activeFolder) {
        closeFolder();
    } else {
        openFolder();
    }
}

function openFolder() {
    activeFolder = true;
    const overlay = document.getElementById('nav-menu-overlay');
    const submenu = document.getElementById('nav-submenu');
    
    submenu.innerHTML = `
        <div style="padding: 0.5rem 1rem; color: var(--text-secondary); font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700;">${mainFolder.title}</div>
        ${mainFolder.items.map(item => `
            <div class="submenu-item" onclick="showPage('${item.page}')">
                <span class="submenu-icon">${item.icon}</span>
                <span class="submenu-text">${item.label}</span>
          <span class="submenu-arrow">›</span>
            </div>
        `).join('')}
    `;

    overlay.classList.add('active');
    tg.HapticFeedback.impactOccurred('medium');
}

function closeFolder() {
    activeFolder = null;
    const overlay = document.getElementById('nav-menu-overlay');
    if (overlay) overlay.classList.remove('active');
}

window.showPage = showPage; 


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
            <button id="${id}_btn" onclick="purchaseUpgrade('${id}')">
              Cost: <span class="cost" id="${id}_cost">0</span>
            </button>
          </div>
        </div>
      `;
    }
  }
}

async function purchaseUpgrade(upgradeId) {
  const btn = document.getElementById(`${upgradeId}_btn`);
  if (!btn) return;

  btn.disabled = true;
  const oldText = btn.textContent;
  btn.textContent = 'Buying...';

  updateTaskProgress('upgrades', 1);

  try {
    const result = await apiRequest('/player/upgrade', 'POST', { userId, upgradeId });

    if (!result.success) {
      showGameNotification(result.error || 'Failed to buy upgrade', 'error');
      btn.textContent = oldText;
      btn.disabled = false;
      return;
    }

    playerData = result.player;
    score = new Decimal(playerData.score);
    clickValue = new Decimal(playerData.click_value);
    autoClickRate = new Decimal(playerData.auto_click_rate);

    try {
      await loadSkins();
      const img = playerData.selected_skin?.image_url || (playerData.owned_skins || []).find(s => s.selected)?.image_url;
      if (img) coinImageEl.src = img;
    } catch (e) {
      console.warn('Failed to load or apply skin on init:', e);
    }


    try {
      await loadSkins();
      const img = playerData.selected_skin?.image_url || (playerData.owned_skins || []).find(s => s.selected)?.image_url;
      if (img) coinImageEl.src = img;
    } catch (e) {
      console.warn('Failed to load or apply skin:', e);
    }

    updateUI();
    showGameNotification('Upgrade purchased!', 'success');
    tg.HapticFeedback.notificationOccurred('success');
  } catch (e) {
    console.error('Upgrade failed', e);
    showGameNotification('Failed to buy upgrade', 'error');
    tg.HapticFeedback.notificationOccurred('error');
  } finally {
    btn.textContent = oldText;
    updateUI();
  }
}

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

async function initGames() {
  await loadGameState();
  renderSoloParticipants();
  renderGameControls();
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
          '🎁'
        );
      } else {
        showGameNotification(`Winner: ${result.winner.username || 'Anonymous'} won ${result.prize}!`, 'success');
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

function renderMyWinChance() {
  const el = document.getElementById('solo-my-chance');
  if (!el || !gameState.solo) return;

  const potDec = safeDecimal(gameState.solo.pot);
  const myBet = userSoloBet();

  const percent = potDec.gt(0)
    ? myBet.div(potDec).times(100).toFixed(2)
    : '0.00';

  el.textContent = `${percent}%`;
}

function updateGamesUI() {
  const balanceEl = document.getElementById('games-balance');
  if (balanceEl) balanceEl.textContent = score.toFixed(9);

  const soloPotEl = document.getElementById('solo-pot');
  if (soloPotEl) soloPotEl.textContent = safeDecimal(gameState.solo.pot).toFixed(9);

  const yourSoloBetEl = document.getElementById('your-solo-bet');
  if (yourSoloBetEl) yourSoloBetEl.textContent = safeDecimal(gameState.yourBets.solo).toFixed(9);

  const soloCountEl = document.getElementById('solo-participants-count');
  if (soloCountEl) soloCountEl.textContent = gameState.solo.participants.length;

  renderSoloParticipants();
  renderGameControls();
    renderMyWinChance();

  const teamPotEl = document.getElementById('team-pot');
  if (teamPotEl) teamPotEl.textContent = safeDecimal(gameState.team.pot).toFixed(9);

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
        const usernameTag = w.username ? `@${w.username}` : '';

        let avatarHtml = '';
        if (w.profile_photo_url) {
          avatarHtml = `<img src="${w.profile_photo_url}" class="winner-pfp" alt="pfp">`;
        } else {
          const initial = displayName.charAt(0).toUpperCase();
          const color = getColorForUser(w.username || displayName);
          avatarHtml = `<div class="winner-pfp-placeholder" style="background-color: ${color};">${initial}</div>`;
        }

        return `
          <div class="winner-item">
            ${avatarHtml}
            <div class="winner-info">
              <div class="winner-name">${displayName}</div>
              ${usernameTag ? `<div class="winner-username">${usernameTag}</div>` : ''}
              <div class="winner-date">${dateStr}</div>
            </div>
            <div class="winner-amount">${safeDecimal(w.amount).toFixed(9)}</div>
          </div>
        `;
      })
      .join('');
  }
}

function userSoloBet() {
  const me = (gameState.solo.participants || []).find(
    p => String(p.userId) === String(userId),
  );
  if (!me) return new Decimal(0);
  return safeDecimal(me.bet);
}

function renderSoloParticipants() {
  const container = document.getElementById('solo-participants');
  if (!container || !gameState.solo) return;

  container.innerHTML = '';

  const { participants } = gameState.solo;
  const potDec = safeDecimal(gameState.solo.pot);

  participants.forEach(p => {
    const row = document.createElement('div');
    row.className = 'solo-participant-row';

    let avatarHTML;
    if (p.profile_photo_url) {
      avatarHTML = `
        <div class="game-participant-avatar">
          <img src="${p.profile_photo_url}" alt="pfp">
        </div>`;
    } else {
      const uname = p.username || '';
      const initial = uname ? uname.charAt(0).toUpperCase() : '?';
      const color = getColorForUser(uname);
      avatarHTML = `
        <div class="game-participant-avatar-placeholder" style="background-color: ${color};">
          ${initial}
        </div>`;
    }

    const hasFirst = p.first_name && p.first_name.trim().length > 0;
    const hasLast = p.last_name && p.last_name.trim().length > 0;
    const displayName = hasFirst
      ? `${p.first_name}${hasLast ? ' ' + p.last_name : ''}`
      : (p.username || 'Anonymous');

    const betDec = safeDecimal(p.bet);
    const percent = potDec.gt(0)
      ? betDec.div(potDec).times(100).toFixed(2)
      : '0.00';

    row.innerHTML = `
      ${avatarHTML}
      <div class="participant-user-details">
        <div class="participant-display-name">${displayName}</div>
        ${p.username ? `<div class="participant-username-tag">@${p.username}</div>` : ''}
      </div>
      <div class="participant-score-value">
        ${betDec.toFixed(9)}
        <div class="win-chance">${percent}%</div>
      </div>
    `;

    if (p.username) {
      row.dataset.username = p.username;
      row.classList.add('lb-clickable');
      row.addEventListener('click', () => {
        const uname = row.dataset.username;
        if (!uname) return;
        const link = `https://t.me/${uname}`;
        if (window.Telegram && Telegram.WebApp && Telegram.WebApp.openTelegramLink) {
          Telegram.WebApp.openTelegramLink(link);
          Telegram.WebApp.minimize();
        } else {
          window.open(link, '_blank', 'noopener,noreferrer');
        }
      });
    }

    container.appendChild(row);
  });
}

function renderGameControls() {
  const joinBtn = document.getElementById('join-solo-btn');
  if (!joinBtn) return;

  const myBet = userSoloBet();
  if (myBet.gt(0)) {
    joinBtn.textContent = 'Add more money';
  } else {
    joinBtn.textContent = 'Join game';
  }
}

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
      const multiplier = e.target.dataset.multiplier;
      const input = e.target.closest('.bet-amount-input')?.querySelector('input[type=number]');
      if (!input) return;

      if (multiplier === 'all') {
        input.value = score.toFixed(9);
      } else {
        const mult = parseFloat(multiplier);
        if (isNaN(mult)) return;
        const currentValue = safeDecimal(input.value);
        const newValue = currentValue.times(mult);
        input.value = newValue.toFixed(9);
      }
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

function showGameModal(title, message, emoji, buttonText = 'Claim Prize', onClose = null) {
  const modal = document.createElement('div');
  modal.className = 'game-modal active';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="win-animation">${emoji}</div>
      <h3 class="modal-title">${title}</h3>
      <div class="modal-prize">${message}</div>
      <button class="close-modal">${buttonText}</button>
    </div>
  `;
  document.body.appendChild(modal);

  const close = (manual = false) => {
    if (document.body.contains(modal)) document.body.removeChild(modal);
    if (manual && onClose) onClose();
  };

  modal.querySelector('.close-modal').addEventListener('click', () => close(true));
  

  if (!onClose) {
    setTimeout(() => close(false), 5000);
  }
}

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

async function init() {
  tg.ready();
  tg.expand();

  try {
    const maintenance = await fetch(`${BACKEND_URL}/maintenance-status`).then(r => r.json()).catch(() => ({ maintenance_mode: false }));
    
    if (maintenance.maintenance_mode) {
      loadingOverlay.classList.add('active');
      loadingText.innerHTML = `
        <div style="text-align: center; padding: 20px;">
          <i class="fas fa-tools" style="font-size: 3rem; color: #f59e0b; margin-bottom: 1rem;"></i>
          <h2 style="margin-bottom: 1rem;">Under Maintenance</h2>
          <p style="font-size: 0.9rem; color: #cbd5e1; line-height: 1.5;">${maintenance.message}</p>
          <div style="margin-top: 2rem;">
            <button onclick="window.location.reload()" style="background: #6366f1; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-weight: 600;">Check Again</button>
          </div>
        </div>
      `;
      return;
    }

    await syncProfile();
    await initGames();
    await initTasksSystem();

    if (!userId) {
      loadingOverlay.classList.add('active');
      loadingText.innerHTML = '<div style="text-align:center; padding:20px;">Please open the game from the Telegram app to play. <br><small style="color:var(--text-secondary);">No Telegram session detected.</small></div>';
      return;
    }

    playerData = await apiRequest(`/player/${userId}`);
    
    if (playerData.is_banned) {
        loadingOverlay.classList.add('active');
        loadingText.innerHTML = `
            <div style="text-align: center; padding: 20px;">
                <i class="fas fa-ban" style="font-size: 3rem; color: #ef4444; margin-bottom: 1rem;"></i>
                <h2 style="margin-bottom: 1rem;">Account Banned</h2>
                <p style="font-size: 0.9rem; color: #cbd5e1; line-height: 1.5;">Your account has been suspended for violating our terms of service.</p>
                <div style="margin-top: 2rem; font-size: 0.8rem; color: #94a3b8;">
                    ID: ${userId}
                </div>
            </div>
        `;
        return;
    }

    score = new Decimal(playerData.score);
    clickValue = new Decimal(playerData.click_value);
    autoClickRate = new Decimal(playerData.auto_click_rate);

    checkBroadcast();

    generateUpgradesHTML();
    setupEventListeners();
    updateUI();
    updateGamesUI();
     
    setupLeaderboardTabs();
    setupUpgradeTabs();
    setupTransactionSearch();
    setupGameEventListeners();
 
    lastFrameTime = Date.now();
    requestAnimationFrame(gameLoop);
 
    loadingOverlay.classList.remove('active');
    updateTaskProgress('score');
  } catch (error) {
    console.error("Initialization failed:", error);

    loadingText.innerHTML = `
      Connection Error!<br>
      <small>${error.message}</small><br><br>
      <button id="retry-init">Retry</button>
      <button id="open-tg">Open in Telegram</button>
    `;

    const retryBtn = document.getElementById("retry-init");
    const openTgBtn = document.getElementById("open-tg");

    retryBtn?.addEventListener("click", () => {
      loadingText.innerHTML = "Reconnecting...";
      init();
    });

    openTgBtn?.addEventListener("click", () => {
      const link = "https://t.me/@SisiCCoinBot";
      if (window.Telegram?.WebApp?.openTelegramLink) {
        Telegram.WebApp.openTelegramLink(link);
        Telegram.WebApp.minimize();
      } else {
        window.open(link, "_blank", "noopener,noreferrer");
      }
    });
  }
}

async function checkBroadcast() {
  try {
    const data = await apiRequest('/broadcast');
    if (data && data.active && data.message) {
      const broadcastId = String(data.id || '0');
      const viewedId = localStorage.getItem('viewed_broadcast_id');


      if (broadcastId !== viewedId) {
          const type = data.type || 'info';
          const icon = type === 'warning' ? '⚠️' : (type === 'error' ? '🚫' : '📢');
          const title = type === 'warning' ? 'Important Announcement' : (type === 'error' ? 'Critical Alert' : 'Announcement');
        
        showGameModal(title, data.message, icon, 'Got it', () => {
          localStorage.setItem('viewed_broadcast_id', broadcastId);
        });
      }
    }
  } catch (e) {
    console.error('Failed to check broadcast:', e);
  }
}

async function drawSolo() {
  try {
    const result = await apiRequest('/games/draw-solo', 'POST', {});

    if (!result.success) {
      showNotification(result.error || 'Draw failed', 'error');
      return;
    }

    const updatedPlayer = await apiRequest(`/player/${userId}`);
    playerData = updatedPlayer;
    score = new Decimal(playerData.score);
    autoClickRate = new Decimal(playerData.auto_click_rate);
    clickValue = new Decimal(playerData.click_value);
    updateUI();

    await loadGameState();

    showNotification(
      `Winner: ${result.winner?.username || 'Unknown'}\nPrize: ${result.prize}`,
      'success',
    );
  } catch (e) {
    console.error('draw solo failed', e);
    showNotification('Draw failed', 'error');
  }
}

function setupEventListeners() {

  document.getElementById('nav-clicker')?.addEventListener('click', () => showPage('clicker'));
  document.getElementById('nav-games')?.addEventListener('click', () => showPage('games'));
  document.getElementById('nav-folder')?.addEventListener('click', () => toggleFolder());


  document.getElementById('nav-menu-overlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'nav-menu-overlay') {
        closeFolder();
    }
  });

  coinImageEl.addEventListener('mousedown', () => {
    if (!playerData) return;
    score = score.plus(clickValue);
    clicksThisSecond++;
    pendingClickUpdates++;
    tg.HapticFeedback.impactOccurred('light');
    
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
      pendingClickUpdates++;
      tg.HapticFeedback.impactOccurred('light');
      coinImageEl.classList.remove('bounce');
      void coinImageEl.offsetWidth;
      coinImageEl.classList.add('bounce');
      updateUI();
    },
    { passive: false },
  );

  const sendBtn = document.getElementById('send-btn');
  if (sendBtn) {
    sendBtn.addEventListener('click', handleSendCoins);
  }

  setupTransactionSearch();

  const withdrawSoloBtn = document.getElementById('withdraw-solo-btn');
  if (withdrawSoloBtn) {
    withdrawSoloBtn.addEventListener('click', withdrawSoloLottery);
  }

  const drawSoloBtn = document.getElementById('draw-solo-btn');
  if (drawSoloBtn) {
    drawSoloBtn.addEventListener('click', drawSoloLottery);
  }

  const joinSoloBtn = document.getElementById('join-solo-btn');
  if (joinSoloBtn) {
    joinSoloBtn.addEventListener('click', joinSoloLottery);
  }

  const joinTeamBtn = document.getElementById('join-team-btn');
  if (joinTeamBtn) {
    joinTeamBtn.addEventListener('click', () => {
      const availableTeam = gameState.team.teams.find(team => (team.members || []).length < 10);
      if (availableTeam) joinTeamLottery(availableTeam.id);
      else showGameNotification('No available teams. Create a new team!', 'error');
    });
  }

  const createTeamBtn = document.getElementById('create-team-btn');
  if (createTeamBtn) {
    createTeamBtn.addEventListener('click', createNewTeam);
  }

  setInterval(() => {
    cpsElement.textContent = `${clicksThisSecond} CPS`;
    clicksThisSecond = 0;
  }, 1000);

  setInterval(() => {
    if (playerData) {
      apiRequest('/player/sync', 'POST', { userId, score: score.toFixed(9) });
      

      if (pendingClickUpdates > 0) {
          updateTaskProgress('clicks', pendingClickUpdates);
          pendingClickUpdates = 0;
      }
    }
  }, SYNC_INTERVAL);
}

init();

