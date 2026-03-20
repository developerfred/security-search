const STORAGE_KEYS = {
  SCAM_LIST: 'scamList',
  SAFE_LIST: 'safeList',
  STATS: 'stats',
  THEME: 'theme'
};

const STATE = {
  currentSite: null,
  currentSiteStatus: null,
  isScam: false,
  isSafe: false
};

document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  await loadStats();
  await loadCurrentSite();
  setupEventListeners();
  setupTabs();
});

function initTheme() {
  const savedTheme = localStorage.getItem(STORAGE_KEYS.THEME) || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
}

function setupEventListeners() {
  document.getElementById('themeToggle').addEventListener('click', toggleTheme);
  document.getElementById('reportScamBtn').addEventListener('click', reportScam);
  document.getElementById('markSafeBtn').addEventListener('click', markAsSafe);
  document.getElementById('syncBtn').addEventListener('click', syncWithLoading);
  document.getElementById('quickReportBtn').addEventListener('click', () => switchToTab('report'));
  document.getElementById('quickSafeBtn').addEventListener('click', () => switchToTab('safe'));
  document.getElementById('openOptions').addEventListener('click', (e) => {
    e.preventDefault();
  });
}

function setupTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.dataset.tab;
      switchToTab(tabName);
    });
  });
}

function switchToTab(tabName) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  
  document.querySelector(`.tab[data-tab="${tabName}"]`).classList.add('active');
  document.getElementById(`${tabName}Tab`).classList.add('active');
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const newTheme = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem(STORAGE_KEYS.THEME, newTheme);
}

async function loadStats() {
  const scamList = await browser.storage.local.get(STORAGE_KEYS.SCAM_LIST);
  const safeList = await browser.storage.local.get(STORAGE_KEYS.SAFE_LIST);
  const storageStats = await browser.storage.local.get(STORAGE_KEYS.STATS);
  
  const scams = scamList[STORAGE_KEYS.SCAM_LIST] || [];
  const safe = safeList[STORAGE_KEYS.SAFE_LIST] || [];
  const stats = storageStats[STORAGE_KEYS.STATS] || {};
  
  document.getElementById('scamCount').textContent = scams.length;
  document.getElementById('safeCount').textContent = safe.length;
  document.getElementById('syncCount').textContent = stats.scamsReported || 0;
}

async function loadCurrentSite() {
  try {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url && tab.url.startsWith('http')) {
      const url = new URL(tab.url);
      STATE.currentSite = url.href;
      
      document.getElementById('currentSiteUrl').textContent = url.hostname;
      document.getElementById('currentSiteSection').style.display = 'block';
      
      document.getElementById('scamUrl').value = url.href;
      document.getElementById('safeUrl').value = url.href;
      
      await checkCurrentSiteStatus(url.hostname);
    } else {
      document.getElementById('currentSiteSection').style.display = 'none';
    }
  } catch (e) {
    console.log('Could not get current tab:', e);
    document.getElementById('currentSiteSection').style.display = 'none';
  }
}

async function checkCurrentSiteStatus(hostname) {
  const scamList = await browser.storage.local.get(STORAGE_KEYS.SCAM_LIST);
  const safeList = await browser.storage.local.get(STORAGE_KEYS.SAFE_LIST);
  
  const scams = scamList[STORAGE_KEYS.SCAM_LIST] || [];
  const safe = safeList[STORAGE_KEYS.SAFE_LIST] || [];
  
  const domain = hostname.toLowerCase().replace(/^www\./, '');
  
  STATE.isScam = scams.some(s => {
    const scamDomain = extractDomain(s.url).toLowerCase().replace(/^www\./, '');
    return domain === scamDomain || domain.includes(scamDomain);
  });
  
  STATE.isSafe = safe.some(s => {
    const safeDomain = extractDomain(s.url).toLowerCase().replace(/^www\./, '');
    return domain === safeDomain || domain.includes(safeDomain);
  });
  
  const statusBadge = document.getElementById('currentSiteStatus');
  
  if (STATE.isScam) {
    statusBadge.className = 'status-badge danger';
    STATE.currentSiteStatus = 'scam';
  } else if (STATE.isSafe) {
    statusBadge.className = 'status-badge safe';
    STATE.currentSiteStatus = 'safe';
  } else {
    statusBadge.className = 'status-badge';
    STATE.currentSiteStatus = 'unknown';
  }
}

function extractDomain(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

async function reportScam() {
  const urlInput = document.getElementById('scamUrl');
  const reasonInput = document.getElementById('scamReason');
  const messageEl = document.getElementById('scamMessage');
  const btn = document.getElementById('reportScamBtn');
  
  const url = urlInput.value.trim();
  if (!url) {
    showMessage(messageEl, 'Please enter a URL', 'error');
    return;
  }
  
  try {
    new URL(url);
  } catch {
    showMessage(messageEl, 'Please enter a valid URL', 'error');
    return;
  }
  
  const storage = await browser.storage.local.get(STORAGE_KEYS.SCAM_LIST);
  const scamList = storage[STORAGE_KEYS.SCAM_LIST] || [];
  
  if (scamList.some(s => s.url === url)) {
    showMessage(messageEl, 'This site is already reported', 'error');
    return;
  }
  
  btn.disabled = true;
  
  const newEntry = {
    url,
    reason: reasonInput.value.trim() || 'No reason provided',
    reportedAt: Date.now()
  };
  
  scamList.unshift(newEntry);
  await browser.storage.local.set({ [STORAGE_KEYS.SCAM_LIST]: scamList });
  
  const stats = await browser.storage.local.get(STORAGE_KEYS.STATS);
  const currentStats = stats[STORAGE_KEYS.STATS] || { scamsReported: 0 };
  currentStats.scamsReported++;
  await browser.storage.local.set({ [STORAGE_KEYS.STATS]: currentStats });
  
  browser.runtime.sendMessage({
    action: 'submitCommunity',
    type: 'scam',
    url: url,
    reason: reasonInput.value.trim() || 'No reason provided'
  }).catch(() => {});
  
  showMessage(messageEl, 'Scam reported successfully!', 'success');
  urlInput.value = '';
  reasonInput.value = '';
  btn.disabled = false;
  
  await loadStats();
}

async function markAsSafe() {
  const urlInput = document.getElementById('safeUrl');
  const messageEl = document.getElementById('safeMessage');
  const btn = document.getElementById('markSafeBtn');
  
  const url = urlInput.value.trim();
  if (!url) {
    showMessage(messageEl, 'Please enter a URL', 'error');
    return;
  }
  
  try {
    new URL(url);
  } catch {
    showMessage(messageEl, 'Please enter a valid URL', 'error');
    return;
  }
  
  const storage = await browser.storage.local.get(STORAGE_KEYS.SAFE_LIST);
  const safeList = storage[STORAGE_KEYS.SAFE_LIST] || [];
  
  if (safeList.some(s => s.url === url)) {
    showMessage(messageEl, 'This site is already marked as safe', 'error');
    return;
  }
  
  btn.disabled = true;
  
  const newEntry = {
    url,
    markedAt: Date.now()
  };
  
  safeList.unshift(newEntry);
  await browser.storage.local.set({ [STORAGE_KEYS.SAFE_LIST]: safeList });
  
  browser.runtime.sendMessage({
    action: 'submitCommunity',
    type: 'safe',
    url: url
  }).catch(() => {});
  
  showMessage(messageEl, 'Site marked as safe!', 'success');
  urlInput.value = '';
  btn.disabled = false;
  
  await loadStats();
}

async function syncWithLoading() {
  const btn = document.getElementById('syncBtn');
  const messageEl = document.getElementById('syncMessage');
  
  btn.classList.add('loading');
  btn.innerHTML = '<div class="spinner"></div> Syncing...';
  
  showMessage(messageEl, 'Syncing remote blocklists...', 'success');
  
  try {
    const result = await browser.runtime.sendMessage({ action: 'syncRemote' });
    
    btn.classList.remove('loading');
    btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg> Sync Now';
    
    if (result && result.success) {
      showMessage(messageEl, `Synced! ${result.totalScams} scams, ${result.newAdded} new added.`, 'success');
      await loadStats();
    } else {
      showMessage(messageEl, 'Sync failed. Try again.', 'error');
    }
  } catch (error) {
    btn.classList.remove('loading');
    btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg> Sync Now';
    showMessage(messageEl, 'Sync error: ' + error.message, 'error');
  }
}

function showMessage(element, text, type) {
  element.textContent = text;
  element.className = `message ${type}`;
  
  setTimeout(() => {
    element.className = 'message';
  }, 4000);
}
