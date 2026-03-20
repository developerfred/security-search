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

const ALLOWED_ORIGINS = [
  'https://google.com',
  'https://www.google.com',
  'https://bing.com',
  'https://www.bing.com',
  'https://duckduckgo.com',
  'https://www.duckduckgo.com',
  'https://yahoo.com',
  'https://www.yahoo.com',
  'https://baidu.com',
  'https://www.baidu.com'
];

browser.runtime.onInstalled.addListener(() => {
  initializeStorage();
});

browser.runtime.onStartup.addListener(() => {
  initializeStorage();
});

function validateSender(sender) {
  if (!sender || !sender.tab) return false;
  
  const url = sender.tab.url;
  if (!url || !url.startsWith('http')) return false;
  
  try {
    const origin = new URL(url).origin;
    
    const isAllowed = ALLOWED_ORIGINS.some(allowed => {
      return url.startsWith(allowed) || url.includes(allowed.replace('https://', ''));
    });
    
    if (isAllowed) return true;
    
    if (url.includes('google.com/search') || 
        url.includes('bing.com/search') ||
        url.includes('duckduckgo.com') ||
        url.includes('yahoo.com/search') ||
        url.includes('baidu.com/s')) {
      return true;
    }
    
    return false;
  } catch {
    return false;
  }
}

function validateReportData(url, reason) {
  if (!url || typeof url !== 'string') return { valid: false, error: 'Invalid URL' };
  
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { valid: false, error: 'Only HTTP/HTTPS allowed' };
    }
    
    if (parsed.username || parsed.password) {
      return { valid: false, error: 'Credentials in URL not allowed' };
    }
    
    const hostname = parsed.hostname.toLowerCase();
    if (hostname.includes('@') || /[<>{}|\\^`]/.test(hostname)) {
      return { valid: false, error: 'Invalid characters in hostname' };
    }
    
    return { valid: true };
  } catch {
    return { valid: false, error: 'Malformed URL' };
  }
}

function sanitizeString(str, maxLength = 500) {
  if (typeof str !== 'string') return '';
  return str.slice(0, maxLength).replace(/<[^>]*>/g, '');
}

function validateListItem(item) {
  if (!item || typeof item !== 'object') return null;
  if (typeof item.url !== 'string') return null;
  
  const urlValidation = validateReportData(item.url, item.reason);
  if (!urlValidation.valid) return null;
  
  return {
    url: item.url.toLowerCase().trim(),
    reason: sanitizeString(item.reason, 500),
    category: sanitizeString(item.category, 100),
    reportedAt: typeof item.reportedAt === 'number' ? item.reportedAt : Date.now(),
    source: typeof item.source === 'string' ? item.source : 'local'
  };
}

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
    
    if (!data.safeSites || !Array.isArray(data.safeSites)) {
      throw new Error('Invalid initial data format');
    }
    
    const safeList = data.safeSites
      .filter(site => site && typeof site.url === 'string')
      .map(site => ({
        url: site.url.toLowerCase().trim(),
        name: sanitizeString(site.name, 100),
        category: sanitizeString(site.category, 50),
        markedAt: Date.now()
      }));
    
    const scamList = (data.scamSites || [])
      .filter(site => site && typeof site.url === 'string')
      .map(site => ({
        url: site.url.toLowerCase().trim(),
        reason: sanitizeString(site.reason, 500),
        detected: site.detected,
        reportedAt: Date.now()
      }));
    
    await browser.storage.local.set({
      [STORAGE_KEYS.SAFE_LIST]: safeList,
      [STORAGE_KEYS.SCAM_LIST]: scamList
    });
  } catch (error) {
    console.error('Failed to load initial data:', error);
    await browser.storage.local.set({
      [STORAGE_KEYS.SAFE_LIST]: [],
      [STORAGE_KEYS.SCAM_LIST]: []
    });
  }
}

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!validateSender(sender)) {
    console.warn('Message rejected: invalid sender origin');
    sendResponse({ error: 'Unauthorized' });
    return true;
  }
  
  handleMessage(message, sender).then(sendResponse);
  return true;
});

async function handleMessage(message, sender) {
  switch (message.action) {
    case 'getLists':
      return await getLists();
      
    case 'addScam':
      return await addScam(message.url, message.reason);
      
    case 'addSafe':
      return await addSafe(message.url);
      
    case 'removeScam':
      return await removeScam(message.url);
      
    case 'removeSafe':
      return await removeSafe(message.url);
      
    case 'syncRemote':
      return await syncRemoteLists();
      
    case 'getStats':
      return await getStats();
      
    case 'syncCommunity':
      return await syncCommunityList();
      
    case 'submitCommunity':
      return await submitToCommunity(
        message.type,
        message.url,
        message.reason,
        message.protocolName,
        message.category
      );
      
    case 'getCommunityStats':
      return await getCommunityStats();
      
    default:
      return { error: 'Unknown action' };
  }
}

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
  const validation = validateReportData(url, reason);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }
  
  const storage = await browser.storage.local.get(STORAGE_KEYS.SCAM_LIST);
  const list = storage[STORAGE_KEYS.SCAM_LIST] || [];
  
  const normalizedUrl = url.toLowerCase().trim();
  if (list.some(s => s.url === normalizedUrl)) {
    return { success: false, error: 'Already reported' };
  }
  
  const newEntry = {
    url: normalizedUrl,
    reason: sanitizeString(reason, 500),
    reportedAt: Date.now(),
    source: 'local'
  };
  
  list.unshift(newEntry);
  await browser.storage.local.set({ [STORAGE_KEYS.SCAM_LIST]: list });
  await notifyContentScripts('listUpdated');
  
  return { success: true };
}

async function addSafe(url) {
  const validation = validateReportData(url, '');
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }
  
  const storage = await browser.storage.local.get(STORAGE_KEYS.SAFE_LIST);
  const list = storage[STORAGE_KEYS.SAFE_LIST] || [];
  
  const normalizedUrl = url.toLowerCase().trim();
  if (list.some(s => s.url === normalizedUrl)) {
    return { success: false, error: 'Already marked as safe' };
  }
  
  const newEntry = {
    url: normalizedUrl,
    markedAt: Date.now(),
    source: 'local'
  };
  
  list.unshift(newEntry);
  await browser.storage.local.set({ [STORAGE_KEYS.SAFE_LIST]: list });
  await notifyContentScripts('listUpdated');
  
  return { success: true };
}

async function removeScam(url) {
  if (!url || typeof url !== 'string') {
    return { success: false, error: 'Invalid URL' };
  }
  
  const storage = await browser.storage.local.get(STORAGE_KEYS.SCAM_LIST);
  const list = storage[STORAGE_KEYS.SCAM_LIST] || [];
  
  const normalizedUrl = url.toLowerCase().trim();
  const filtered = list.filter(s => s.url !== normalizedUrl);
  
  if (filtered.length === list.length) {
    return { success: false, error: 'Not found' };
  }
  
  await browser.storage.local.set({ [STORAGE_KEYS.SCAM_LIST]: filtered });
  await notifyContentScripts('listUpdated');
  
  return { success: true };
}

async function removeSafe(url) {
  if (!url || typeof url !== 'string') {
    return { success: false, error: 'Invalid URL' };
  }
  
  const storage = await browser.storage.local.get(STORAGE_KEYS.SAFE_LIST);
  const list = storage[STORAGE_KEYS.SAFE_LIST] || [];
  
  const normalizedUrl = url.toLowerCase().trim();
  const filtered = list.filter(s => s.url !== normalizedUrl);
  
  if (filtered.length === list.length) {
    return { success: false, error: 'Not found' };
  }
  
  await browser.storage.local.set({ [STORAGE_KEYS.SAFE_LIST]: filtered });
  await notifyContentScripts('listUpdated');
  
  return { success: true };
}

async function notifyContentScripts(action) {
  try {
    const tabs = await browser.tabs.query({});
    for (const tab of tabs) {
      if (tab.id && tab.url && tab.url.startsWith('http')) {
        browser.tabs.sendMessage(tab.id, { action }).catch(() => {});
      }
    }
  } catch (e) {
    // Ignore
  }
}

async function syncRemoteLists() {
  const storage = await browser.storage.local.get(STORAGE_KEYS.SCAM_LIST);
  let existingScams = storage[STORAGE_KEYS.SCAM_LIST] || [];
  const existingUrls = new Set(existingScams.map(s => s.url));
  let newScamsAdded = 0;
  
  for (const source of REMOTE_SOURCES.SCAM_LISTS) {
    if (!source.startsWith('https://raw.githubusercontent.com') && 
        !source.startsWith('https://api.github.com')) {
      console.warn('Invalid source skipped:', source);
      continue;
    }
    
    try {
      const response = await fetch(source, {
        headers: { 'Accept': 'application/json' }
      });
      
      if (!response.ok) continue;
      
      const data = await response.json();
      
      let domains = [];
      
      if (data.blacklist && Array.isArray(data.blacklist)) {
        domains = data.blacklist;
      } else if (Array.isArray(data)) {
        domains = data;
      }
      
      for (const domain of domains) {
        if (typeof domain !== 'string') continue;
        
        const cleanDomain = domain.toLowerCase().trim().slice(0, 253);
        const url = cleanDomain.includes('.') ? 
          (cleanDomain.startsWith('http') ? cleanDomain : `https://${cleanDomain}`) : 
          null;
        
        if (!url || existingUrls.has(url)) continue;
        
        existingScams.push({
          url: url,
          reason: 'Remote blocklist',
          reportedAt: Date.now(),
          source: 'remote'
        });
        existingUrls.add(url);
        newScamsAdded++;
      }
    } catch (error) {
      console.error(`Failed to fetch ${source}:`, error);
    }
  }
  
  await browser.storage.local.set({
    [STORAGE_KEYS.SCAM_LIST]: existingScams.slice(0, 50000),
    [STORAGE_KEYS.LAST_SYNC]: Date.now()
  });
  
  await notifyContentScripts('listUpdated');
  
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
    
    if (!response.ok) {
      return { success: false, error: 'API request failed' };
    }
    
    const data = await response.json();
    
    if (!data.scams || !Array.isArray(data.scams)) {
      return { success: false, error: 'Invalid community data' };
    }
    
    const storage = await browser.storage.local.get([
      STORAGE_KEYS.SCAM_LIST,
      STORAGE_KEYS.SAFE_LIST
    ]);
    
    let localScams = storage[STORAGE_KEYS.SCAM_LIST] || [];
    let localSafe = storage[STORAGE_KEYS.SAFE_LIST] || [];
    const existingUrls = new Set([
      ...localScams.map(s => s.url),
      ...localSafe.map(s => s.url)
    ]);
    
    let newScams = 0;
    for (const scam of data.scams.slice(0, 10000)) {
      const validated = validateListItem(scam);
      if (validated && !existingUrls.has(validated.url)) {
        localScams.push(validated);
        existingUrls.add(validated.url);
        newScams++;
      }
    }
    
    let newSafe = 0;
    for (const safe of data.safe.slice(0, 10000)) {
      const validated = validateListItem(safe);
      if (validated && !existingUrls.has(validated.url)) {
        localSafe.push(validated);
        existingUrls.add(validated.url);
        newSafe++;
      }
    }
    
    await browser.storage.local.set({
      [STORAGE_KEYS.SCAM_LIST]: localScams.slice(0, 50000),
      [STORAGE_KEYS.SAFE_LIST]: localSafe.slice(0, 50000),
      [STORAGE_KEYS.LAST_SYNC]: Date.now()
    });
    
    await notifyContentScripts('listUpdated');
    
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
  if (!['scam', 'safe'].includes(type)) {
    return { success: false, error: 'Invalid type' };
  }
  
  const validation = validateReportData(url, reason);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }
  
  try {
    const response = await fetch(`${REMOTE_SOURCES.COMMUNITY_API}/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type,
        url: url.toLowerCase().trim(),
        reason: sanitizeString(reason, 500),
        protocolName: sanitizeString(protocolName, 100),
        category: sanitizeString(category, 50)
      })
    });
    
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      return { success: false, error: errData.error || 'Submission failed' };
    }
    
    return await response.json();
  } catch (error) {
    console.error('Failed to submit to community:', error);
    return { success: false, error: error.message };
  }
}

async function getCommunityStats() {
  try {
    const response = await fetch(`${REMOTE_SOURCES.COMMUNITY_API}/stats`);
    
    if (!response.ok) {
      return { error: 'Failed to fetch stats' };
    }
    
    return await response.json();
  } catch (error) {
    return { error: error.message };
  }
}
