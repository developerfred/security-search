// Security Search - Popup Logic

const STORAGE_KEYS = {
  SCAM_LIST: 'scamList',
  SAFE_LIST: 'safeList',
  STATS: 'stats'
};

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  await loadStats();
  await loadCurrentSite();
  await loadRecentLists();
  setupEventListeners();
});

function setupEventListeners() {
  document.getElementById('reportScamBtn').addEventListener('click', reportScam);
  document.getElementById('markSafeBtn').addEventListener('click', markAsSafe);
  document.getElementById('syncBtn').addEventListener('click', syncCommunityList);
}

async function loadStats() {
  const stats = await browser.storage.local.get(STORAGE_KEYS.STATS);
  const scamList = await browser.storage.local.get(STORAGE_KEYS.SCAM_LIST);
  const safeList = await browser.storage.local.get(STORAGE_KEYS.SAFE_LIST);
  
  const scams = scamList[STORAGE_KEYS.SCAM_LIST] || [];
  const safe = safeList[STORAGE_KEYS.SAFE_LIST] || [];
  
  document.getElementById('scamCount').textContent = stats[STORAGE_KEYS.STATS]?.scamsReported || scams.length;
  document.getElementById('safeCount').textContent = safe.length;
}

async function loadCurrentSite() {
  try {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url) {
      const url = new URL(tab.url);
      document.getElementById('currentSiteUrl').textContent = url.hostname;
      document.getElementById('currentSiteSection').style.display = 'block';
      
      // Pre-fill inputs with current site
      document.getElementById('scamUrl').value = url.href;
      document.getElementById('safeUrl').value = url.href;
    }
  } catch (e) {
    console.log('Could not get current tab:', e);
  }
}

async function loadRecentLists() {
  const scamList = await browser.storage.local.get(STORAGE_KEYS.SCAM_LIST);
  const safeList = await browser.storage.local.get(STORAGE_KEYS.SAFE_LIST);
  
  const scams = scamList[STORAGE_KEYS.SCAM_LIST] || [];
  const safe = safeList[STORAGE_KEYS.SAFE_LIST] || [];
  
  // Show recent 5 scams
  const recentScamsEl = document.getElementById('recentScams');
  if (scams.length === 0) {
    recentScamsEl.innerHTML = '<div class="empty-list">No scam reports yet</div>';
  } else {
    recentScamsEl.innerHTML = scams.slice(0, 5).map(s => 
      `<div class="list-item scam-item">${extractDomain(s.url)}</div>`
    ).join('');
  }
  
  // Show recent 5 safe sites
  const recentSafeEl = document.getElementById('recentSafe');
  if (safe.length === 0) {
    recentSafeEl.innerHTML = '<div class="empty-list">No safe sites marked</div>';
  } else {
    recentSafeEl.innerHTML = safe.slice(0, 5).map(s => 
      `<div class="list-item safe-item">${extractDomain(s.url)}</div>`
    ).join('');
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
  
  // Check if already reported
  if (scamList.some(s => s.url === url)) {
    showMessage(messageEl, 'This site is already reported', 'error');
    return;
  }
  
  const newEntry = {
    url,
    reason: reasonInput.value.trim() || 'No reason provided',
    reportedAt: Date.now()
  };
  
  scamList.unshift(newEntry);
  await browser.storage.local.set({ [STORAGE_KEYS.SCAM_LIST]: scamList });
  
  // Update stats
  const stats = await browser.storage.local.get(STORAGE_KEYS.STATS);
  const currentStats = stats[STORAGE_KEYS.STATS] || { scamsReported: 0 };
  currentStats.scamsReported++;
  await browser.storage.local.set({ [STORAGE_KEYS.STATS]: currentStats });
  
  showMessage(messageEl, 'Scam reported successfully!', 'success');
  
  browser.runtime.sendMessage({
    action: 'submitCommunity',
    type: 'scam',
    url: url,
    reason: reasonInput.value.trim() || 'No reason provided'
  }).catch(() => {});
  
  urlInput.value = '';
  reasonInput.value = '';
  await loadStats();
  await loadRecentLists();
}

async function markAsSafe() {
  const urlInput = document.getElementById('safeUrl');
  const messageEl = document.getElementById('safeMessage');
  
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
  
  // Check if already marked
  if (safeList.some(s => s.url === url)) {
    showMessage(messageEl, 'This site is already marked as safe', 'error');
    return;
  }
  
  const newEntry = {
    url,
    markedAt: Date.now()
  };
  
  safeList.unshift(newEntry);
  await browser.storage.local.set({ [STORAGE_KEYS.SAFE_LIST]: safeList });
  
  showMessage(messageEl, 'Site marked as safe!', 'success');
  
  browser.runtime.sendMessage({
    action: 'submitCommunity',
    type: 'safe',
    url: url
  }).catch(() => {});
  
  urlInput.value = '';
  await loadStats();
  await loadRecentLists();
}

async function syncCommunityList() {
  const messageEl = document.getElementById('syncMessage');
  showMessage(messageEl, 'Syncing remote blocklists...', 'success');
  
  try {
    const result = await browser.runtime.sendMessage({ action: 'syncRemote' });
    
    if (result && result.success) {
      showMessage(messageEl, `Synced! ${result.totalScams} scams, ${result.newAdded} new added.`, 'success');
      await loadStats();
      await loadRecentLists();
    } else {
      showMessage(messageEl, 'Sync failed. Try again.', 'error');
    }
  } catch (error) {
    showMessage(messageEl, 'Sync error: ' + error.message, 'error');
  }
}

function showMessage(element, text, type) {
  element.textContent = text;
  element.className = `message ${type}`;
  setTimeout(() => {
    element.className = 'message';
  }, 3000);
}
