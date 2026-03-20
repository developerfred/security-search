const STORAGE_KEYS = {
  SCAM_LIST: 'scamList',
  SAFE_LIST: 'safeList'
};

const MAX_PROCESSED_URLS = 1000;
const DEBOUNCE_DELAY = 250;

let scamList = [];
let safeList = [];
let processedUrls = new Map();
let hoveredElement = null;
let tooltip = null;
let observer = null;
let scanScheduled = false;
let scanTimeout = null;

async function init() {
  const storage = await browser.storage.local.get([
    STORAGE_KEYS.SCAM_LIST,
    STORAGE_KEYS.SAFE_LIST
  ]);
  
  scamList = validateList(storage[STORAGE_KEYS.SCAM_LIST]);
  safeList = validateList(storage[STORAGE_KEYS.SAFE_LIST]);
  
  createTooltip();
  setupEventListeners();
  
  if (scamList.length > 0 || safeList.length > 0) {
    scheduleScan();
    
    observer = new MutationObserver(scheduleScan);
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
  
  window.addEventListener('unload', cleanup);
}

function validateList(data) {
  if (!Array.isArray(data)) return [];
  return data.filter(item => 
    item && typeof item === 'object' && typeof item.url === 'string'
  ).map(item => ({
    url: item.url,
    reason: typeof item.reason === 'string' ? item.reason : '',
    category: typeof item.category === 'string' ? item.category : ''
  }));
}

function cleanup() {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
  if (scanTimeout) {
    clearTimeout(scanTimeout);
    scanTimeout = null;
  }
  if (tooltip && tooltip.parentNode) {
    tooltip.parentNode.removeChild(tooltip);
  }
  document.removeEventListener('mouseover', handleMouseOver);
  document.removeEventListener('mouseout', handleMouseOut);
  document.removeEventListener('mousemove', handleMouseMove);
}

function scheduleScan() {
  if (scanScheduled) return;
  scanScheduled = true;
  
  scanTimeout = setTimeout(() => {
    scanScheduled = false;
    scanSearchResults();
  }, DEBOUNCE_DELAY);
}

function createTooltip() {
  tooltip = document.createElement('div');
  tooltip.id = 'security-search-tooltip';
  
  const iconEl = document.createElement('div');
  iconEl.className = 'tooltip-icon unknown';
  iconEl.id = 'tooltipIcon';
  iconEl.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#888" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
  
  const titleEl = document.createElement('div');
  titleEl.className = 'tooltip-title unknown';
  titleEl.id = 'tooltipTitle';
  titleEl.textContent = 'Checking...';
  
  const domainEl = document.createElement('div');
  domainEl.className = 'tooltip-domain';
  domainEl.id = 'tooltipDomain';
  
  const reasonEl = document.createElement('div');
  reasonEl.className = 'tooltip-reason hidden';
  reasonEl.id = 'tooltipReason';
  
  tooltip.appendChild(iconEl);
  tooltip.appendChild(titleEl);
  tooltip.appendChild(domainEl);
  tooltip.appendChild(reasonEl);
  
  document.body.appendChild(tooltip);
}

function setupEventListeners() {
  document.addEventListener('mouseover', handleMouseOver, { passive: true });
  document.addEventListener('mouseout', handleMouseOut, { passive: true });
  document.addEventListener('mousemove', handleMouseMove, { passive: true });
  
  browser.runtime.onMessage.addListener((message) => {
    if (message.action === 'listUpdated') {
      refreshLists();
    }
  });
}

async function refreshLists() {
  const storage = await browser.storage.local.get([
    STORAGE_KEYS.SCAM_LIST,
    STORAGE_KEYS.SAFE_LIST
  ]);
  
  scamList = validateList(storage[STORAGE_KEYS.SCAM_LIST]);
  safeList = validateList(storage[STORAGE_KEYS.SAFE_LIST]);
}

function handleMouseOver(e) {
  const resultLink = e.target.closest('a[href]');
  if (!resultLink) return;
  
  const href = resultLink.href || resultLink.getAttribute('href');
  if (!href || !isValidHttpUrl(href)) return;
  
  hoveredElement = resultLink;
  showTooltip(href, resultLink);
}

function handleMouseOut(e) {
  if (e.target.closest('#security-search-tooltip')) return;
  hoveredElement = null;
  hideTooltip();
}

function handleMouseMove(e) {
  if (!hoveredElement) return;
  positionTooltip(e.clientX, e.clientY);
}

function isValidHttpUrl(string) {
  try {
    const url = new URL(string);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function positionTooltip(x, y) {
  if (!tooltip) return;
  
  const tooltipRect = tooltip.getBoundingClientRect();
  const padding = 15;
  
  let left = x + padding;
  let top = y + padding;
  
  if (left + tooltipRect.width > window.innerWidth) {
    left = x - tooltipRect.width - padding;
  }
  
  if (top + tooltipRect.height > window.innerHeight) {
    top = y - tooltipRect.height - padding;
  }
  
  tooltip.style.left = Math.max(0, left) + 'px';
  tooltip.style.top = Math.max(0, top) + 'px';
}

function showTooltip(url, element) {
  const domain = extractDomain(url);
  const scamInfo = checkScam(domain);
  const safeInfo = checkSafe(domain);
  
  const iconEl = document.getElementById('tooltipIcon');
  const titleEl = document.getElementById('tooltipTitle');
  const domainEl = document.getElementById('tooltipDomain');
  const reasonEl = document.getElementById('tooltipReason');
  
  domainEl.textContent = domain;
  
  if (scamInfo) {
    iconEl.className = 'tooltip-icon scam';
    iconEl.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ff4757" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>';
    titleEl.className = 'tooltip-title scam';
    titleEl.textContent = 'Scam Site Reported';
    reasonEl.textContent = scamInfo.reason || 'This site has been reported as a scam';
    reasonEl.classList.remove('hidden');
  } else if (safeInfo) {
    iconEl.className = 'tooltip-icon safe';
    iconEl.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2ed573" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>';
    titleEl.className = 'tooltip-title safe';
    titleEl.textContent = 'Verified Safe Site';
    reasonEl.textContent = safeInfo.category ? 'Category: ' + safeInfo.category : 'This site is verified as safe';
    reasonEl.classList.remove('hidden');
  } else {
    iconEl.className = 'tooltip-icon unknown';
    iconEl.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#888" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
    titleEl.className = 'tooltip-title unknown';
    titleEl.textContent = 'Not in Database';
    reasonEl.textContent = 'This site has not been reported or verified';
    reasonEl.classList.remove('hidden');
  }
  
  tooltip.classList.add('visible');
}

function hideTooltip() {
  if (tooltip) {
    tooltip.classList.remove('visible');
  }
}

function scanSearchResults() {
  const results = getSearchResultElements();
  
  for (const result of results) {
    const href = result.href || result.getAttribute('href');
    if (!href || !isValidHttpUrl(href)) continue;
    
    const processed = processedUrls.get(href);
    if (processed) continue;
    
    processedUrls.set(href, true);
    
    if (processedUrls.size > MAX_PROCESSED_URLS) {
      const oldEntries = Array.from(processedUrls.keys()).slice(0, MAX_PROCESSED_URLS / 2);
      oldEntries.forEach(key => processedUrls.delete(key));
    }
    
    const domain = extractDomain(href);
    
    if (checkScam(domain)) {
      markAsScam(result, domain);
    } else if (checkSafe(domain)) {
      markAsSafe(result, domain);
    }
  }
}

function getSearchResultElements() {
  const selectors = [
    '.g .yuRUbf a',
    '.g .IsZvec a',
    '.b_algo h2 a',
    '.result__a',
    '.algo-sr a',
    '.c-container a'
  ];
  
  const results = [];
  const seenUrls = new Set();
  
  for (const sel of selectors) {
    try {
      document.querySelectorAll(sel).forEach(el => {
        const href = el.href || el.getAttribute('href');
        if (href && !seenUrls.has(href)) {
          seenUrls.add(href);
          results.push(el);
        }
      });
    } catch (e) {
      // Ignore invalid selectors
    }
  }
  
  return results;
}

function extractDomain(url) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

function checkScam(domain) {
  if (!domain) return null;
  
  const normalizedDomain = domain.toLowerCase();
  
  return scamList.find(s => {
    if (!s || !s.url) return false;
    const scamDomain = extractDomain(s.url).toLowerCase();
    return normalizedDomain === scamDomain || 
           normalizedDomain === 'www.' + scamDomain ||
           scamDomain === 'www.' + normalizedDomain;
  }) || null;
}

function checkSafe(domain) {
  if (!domain) return null;
  
  const normalizedDomain = domain.toLowerCase();
  
  return safeList.find(s => {
    if (!s || !s.url) return false;
    const safeDomain = extractDomain(s.url).toLowerCase();
    return normalizedDomain === safeDomain || 
           normalizedDomain === 'www.' + safeDomain ||
           safeDomain === 'www.' + normalizedDomain;
  }) || null;
}

function markAsScam(element, domain) {
  const container = element.closest('.g') || element.closest('.b_algo') || 
                   element.closest('.result') || element.closest('.c-container');
  
  if (container && !container.querySelector('.security-search-warning')) {
    const warning = document.createElement('div');
    warning.className = 'security-search-warning';
    
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('width', '16');
    icon.setAttribute('height', '16');
    icon.setAttribute('viewBox', '0 0 24 24');
    icon.setAttribute('fill', 'none');
    icon.setAttribute('stroke', '#ff4757');
    icon.setAttribute('stroke-width', '2');
    icon.innerHTML = '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>';
    
    const text = document.createElement('span');
    text.textContent = 'Warning: This site has been reported as a scam (' + escapeHtml(domain) + ')';
    
    warning.appendChild(icon);
    warning.appendChild(text);
    
    const parent = container.parentNode;
    if (parent) {
      parent.insertBefore(warning, container.nextSibling);
    }
  }
}

function markAsSafe(element, domain) {
  const container = element.closest('.g') || element.closest('.b_algo') || 
                   element.closest('.result') || element.closest('.c-container');
  
  if (container && !container.querySelector('.security-search-safe')) {
    const badge = document.createElement('span');
    badge.className = 'security-search-safe';
    
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('width', '12');
    icon.setAttribute('height', '12');
    icon.setAttribute('viewBox', '0 0 24 24');
    icon.setAttribute('fill', 'none');
    icon.setAttribute('stroke', '#2ed573');
    icon.setAttribute('stroke-width', '2');
    icon.innerHTML = '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>';
    
    const text = document.createElement('span');
    text.textContent = 'Verified Safe';
    
    badge.appendChild(icon);
    badge.appendChild(text);
    
    element.parentNode.insertBefore(badge, element.nextSibling);
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
