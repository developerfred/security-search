const STORAGE_KEYS = {
  SCAM_LIST: 'scamList',
  SAFE_LIST: 'safeList',
  LAST_SYNC: 'lastSync',
  INITIALIZED: 'initialized'
};

const REMOTE_SOURCES = {
  SCAM_LISTS: [
    'https://raw.githubusercontent.com/MetaMask/eth-phishing-detect/main/src/config.json',
    'https://raw.githubusercontent.com/scamsniffer/scam-database/main/domains.json'
  ],
  COMMUNITY_API: 'https://security-search-api.yourdomain.workers.dev/api'
};

browser.runtime.onInstalled.addListener(() => {
  console.log('Security Search extension installed');
  initializeStorage();
});

browser.runtime.onStartup.addListener(() => {
  initializeStorage();
});

async function initializeStorage() {
  const existing = await browser.storage.local.get([
    STORAGE_KEYS.SCAM_LIST,
    STORAGE_KEYS.SAFE_LIST,
    STORAGE_KEYS.INITIALIZED
  ]);
  
  if (!existing[STORAGE_KEYS.INITIALIZED]) {
    await loadInitialData();
    await browser.storage.local.set({ [STORAGE_KEYS.INITIALIZED]: true });
  }
}

async function loadInitialData() {
  try {
    const response = await fetch('data/initial-data.json');
    const data = await response.json();
    
    const safeList = data.safeSites.map(site => ({
      url: site.url,
      name: site.name,
      category: site.category,
      markedAt: Date.now()
    }));
    
    const scamList = data.scamSites.map(site => ({
      url: site.url,
      reason: site.reason,
      detected: site.detected,
      reportedAt: Date.now()
    }));
    
    await browser.storage.local.set({
      [STORAGE_KEYS.SAFE_LIST]: safeList,
      [STORAGE_KEYS.SCAM_LIST]: scamList
    });
    
    console.log(`Loaded ${safeList.length} safe sites and ${scamList.length} scam sites`);
  } catch (error) {
    console.error('Failed to load initial data:', error);
    await browser.storage.local.set({
      [STORAGE_KEYS.SAFE_LIST]: [],
      [STORAGE_KEYS.SCAM_LIST]: []
    });
  }
}

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getLists') {
    return getLists();
  }
  
  if (message.action === 'addScam') {
    return addScam(message.url, message.reason);
  }
  
  if (message.action === 'addSafe') {
    return addSafe(message.url);
  }
  
  if (message.action === 'removeScam') {
    return removeScam(message.url);
  }
  
  if (message.action === 'removeSafe') {
    return removeSafe(message.url);
  }
  
  if (message.action === 'syncRemote') {
    return syncRemoteLists();
  }
  
  if (message.action === 'getStats') {
    return getStats();
  }
  
  if (message.action === 'syncCommunity') {
    return syncCommunityList();
  }
  
  if (message.action === 'submitCommunity') {
    return submitToCommunity(
      message.type,
      message.url,
      message.reason,
      message.protocolName,
      message.category
    );
  }
  
  if (message.action === 'getCommunityStats') {
    return getCommunityStats();
  }
  
  return false;
});

async function getLists() {
  const storage = await browser.storage.local.get([
    STORAGE_KEYS.SCAM_LIST,
    STORAGE_KEYS.SAFE_LIST
  ]);
  
  return {
    scams: storage[STORAGE_KEYS.SCAM_LIST] || [],
    safe: storage[STORAGE_KEYS.SAFE_LIST] || []
  };
}

async function addScam(url, reason = '') {
  const storage = await browser.storage.local.get(STORAGE_KEYS.SCAM_LIST);
  const list = storage[STORAGE_KEYS.SCAM_LIST] || [];
  
  if (list.some(s => s.url === url)) {
    return { success: false, error: 'Already reported' };
  }
  
  list.unshift({
    url,
    reason,
    reportedAt: Date.now()
  });
  
  await browser.storage.local.set({ [STORAGE_KEYS.SCAM_LIST]: list });
  
  notifyContentScripts('listUpdated');
  
  return { success: true };
}

async function addSafe(url) {
  const storage = await browser.storage.local.get(STORAGE_KEYS.SAFE_LIST);
  const list = storage[STORAGE_KEYS.SAFE_LIST] || [];
  
  if (list.some(s => s.url === url)) {
    return { success: false, error: 'Already marked as safe' };
  }
  
  list.unshift({
    url,
    markedAt: Date.now()
  });
  
  await browser.storage.local.set({ [STORAGE_KEYS.SAFE_LIST]: list });
  
  notifyContentScripts('listUpdated');
  
  return { success: true };
}

async function removeScam(url) {
  const storage = await browser.storage.local.get(STORAGE_KEYS.SCAM_LIST);
  const list = storage[STORAGE_KEYS.SCAM_LIST] || [];
  
  const filtered = list.filter(s => s.url !== url);
  
  await browser.storage.local.set({ [STORAGE_KEYS.SCAM_LIST]: filtered });
  
  notifyContentScripts('listUpdated');
  
  return { success: true };
}

async function removeSafe(url) {
  const storage = await browser.storage.local.get(STORAGE_KEYS.SAFE_LIST);
  const list = storage[STORAGE_KEYS.SAFE_LIST] || [];
  
  const filtered = list.filter(s => s.url !== url);
  
  await browser.storage.local.set({ [STORAGE_KEYS.SAFE_LIST]: filtered });
  
  notifyContentScripts('listUpdated');
  
  return { success: true };
}

async function notifyContentScripts(action) {
  const tabs = await browser.tabs.query({});
  
  tabs.forEach(tab => {
    if (tab.id) {
      browser.tabs.sendMessage(tab.id, { action }).catch(() => {});
    }
  });
}

async function syncRemoteLists() {
  const storage = await browser.storage.local.get(STORAGE_KEYS.SCAM_LIST);
  let existingScams = storage[STORAGE_KEYS.SCAM_LIST] || [];
  let newScamsAdded = 0;
  
  for (const source of REMOTE_SOURCES.SCAM_LISTS) {
    try {
      const response = await fetch(source);
      const data = await response.json();
      
      let domains = [];
      
      if (data.blacklist) {
        domains = data.blacklist;
      } else if (Array.isArray(data)) {
        domains = data;
      }
      
      for (const domain of domains) {
        const url = domain.startsWith('http') ? domain : `https://${domain}`;
        if (!existingScams.some(s => s.url === url || s.url === domain)) {
          existingScams.push({
            url: url,
            reason: 'Remote blocklist',
            reportedAt: Date.now(),
            source: source
          });
          newScamsAdded++;
        }
      }
    } catch (error) {
      console.error(`Failed to fetch ${source}:`, error);
    }
  }
  
  await browser.storage.local.set({
    [STORAGE_KEYS.SCAM_LIST]: existingScams,
    [STORAGE_KEYS.LAST_SYNC]: Date.now()
  });
  
  notifyContentScripts('listUpdated');
  
  return { 
    success: true, 
    totalScams: existingScams.length,
    newAdded: newScamsAdded 
  };
}

async function getStats() {
  const storage = await browser.storage.local.get([
    STORAGE_KEYS.SCAM_LIST,
    STORAGE_KEYS.SAFE_LIST,
    STORAGE_KEYS.LAST_SYNC
  ]);
  
  return {
    scamCount: (storage[STORAGE_KEYS.SCAM_LIST] || []).length,
    safeCount: (storage[STORAGE_KEYS.SAFE_LIST] || []).length,
    lastSync: storage[STORAGE_KEYS.LAST_SYNC] || null
  };
}

async function syncCommunityList() {
  try {
    const response = await fetch(`${REMOTE_SOURCES.COMMUNITY_API}/list`);
    const data = await response.json();
    
    if (!data.scams || !data.safe) {
      return { success: false, error: 'Invalid community data' };
    }
    
    const storage = await browser.storage.local.get([
      STORAGE_KEYS.SCAM_LIST,
      STORAGE_KEYS.SAFE_LIST
    ]);
    
    let localScams = storage[STORAGE_KEYS.SCAM_LIST] || [];
    let localSafe = storage[STORAGE_KEYS.SAFE_LIST] || [];
    
    let newScams = 0;
    for (const scam of data.scams) {
      if (!localScams.some(s => s.url === scam.url)) {
        localScams.push({
          url: scam.url,
          reason: scam.reason || 'Community reported',
          reportedAt: scam.reportedAt || Date.now(),
          source: 'community',
          votes: scam.votes
        });
        newScams++;
      }
    }
    
    let newSafe = 0;
    for (const safe of data.safe) {
      if (!localSafe.some(s => s.url === safe.url)) {
        localSafe.push({
          url: safe.url,
          protocolName: safe.protocolName,
          category: safe.category,
          markedAt: safe.reportedAt || Date.now(),
          source: 'community',
          votes: safe.votes
        });
        newSafe++;
      }
    }
    
    await browser.storage.local.set({
      [STORAGE_KEYS.SCAM_LIST]: localScams,
      [STORAGE_KEYS.SAFE_LIST]: localSafe,
      [STORAGE_KEYS.LAST_SYNC]: Date.now()
    });
    
    notifyContentScripts('listUpdated');
    
    return {
      success: true,
      newScams,
      newSafe,
      totalScams: localScams.length,
      totalSafe: localSafe.length
    };
  } catch (error) {
    console.error('Community sync failed:', error);
    return { success: false, error: error.message };
  }
}

async function submitToCommunity(type, url, reason = '', protocolName = '', category = '') {
  try {
    const response = await fetch(`${REMOTE_SOURCES.COMMUNITY_API}/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, url, reason, protocolName, category })
    });
    
    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Failed to submit to community:', error);
    return { success: false, error: error.message };
  }
}

async function getCommunityStats() {
  try {
    const response = await fetch(`${REMOTE_SOURCES.COMMUNITY_API}/stats`);
    return await response.json();
  } catch (error) {
    return { error: error.message };
  }
}
