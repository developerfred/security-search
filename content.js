const STORAGE_KEYS = {
  SCAM_LIST: 'scamList',
  SAFE_LIST: 'safeList'
};

let scamList = [];
let safeList = [];
let processedUrls = new Set();
let hoveredElement = null;
let tooltip = null;

async function init() {
  const storage = await browser.storage.local.get([
    STORAGE_KEYS.SCAM_LIST,
    STORAGE_KEYS.SAFE_LIST
  ]);
  
  scamList = storage[STORAGE_KEYS.SCAM_LIST] || [];
  safeList = storage[STORAGE_KEYS.SAFE_LIST] || [];
  
  createTooltip();
  setupEventListeners();
  
  if (scamList.length > 0 || safeList.length > 0) {
    scanSearchResults();
    
    const observer = new MutationObserver(scanSearchResults);
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
}

function createTooltip() {
  tooltip = document.createElement('div');
  tooltip.id = 'security-search-tooltip';
  tooltip.innerHTML = `
    <style>
      #security-search-tooltip {
        position: fixed;
        z-index: 999999;
        background: #1a1a2e;
        border: 1px solid #333;
        border-radius: 10px;
        padding: 12px 16px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 13px;
        color: #eee;
        max-width: 280px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        pointer-events: none;
        opacity: 0;
        transform: translateY(8px);
        transition: opacity 0.2s, transform 0.2s;
      }
      #security-search-tooltip.visible {
        opacity: 1;
        transform: translateY(0);
      }
      #security-search-tooltip .tooltip-header {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 8px;
      }
      #security-search-tooltip .tooltip-icon {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      #security-search-tooltip .tooltip-icon.safe {
        background: rgba(46, 213, 115, 0.2);
      }
      #security-search-tooltip .tooltip-icon.scam {
        background: rgba(255, 71, 87, 0.2);
      }
      #security-search-tooltip .tooltip-icon.unknown {
        background: rgba(136, 136, 136, 0.2);
      }
      #security-search-tooltip .tooltip-title {
        font-weight: 600;
        font-size: 14px;
      }
      #security-search-tooltip .tooltip-title.safe {
        color: #2ed573;
      }
      #security-search-tooltip .tooltip-title.scam {
        color: #ff4757;
      }
      #security-search-tooltip .tooltip-title.unknown {
        color: #888;
      }
      #security-search-tooltip .tooltip-domain {
        color: #00d9ff;
        word-break: break-all;
      }
      #security-search-tooltip .tooltip-reason {
        color: #888;
        font-size: 12px;
        margin-top: 6px;
        padding-top: 6px;
        border-top: 1px solid #333;
      }
      #security-search-tooltip .tooltip-actions {
        margin-top: 10px;
        padding-top: 10px;
        border-top: 1px solid #333;
        display: flex;
        gap: 8px;
      }
      #security-search-tooltip .tooltip-btn {
        flex: 1;
        padding: 6px 12px;
        border: none;
        border-radius: 6px;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        pointer-events: auto;
        transition: opacity 0.2s;
      }
      #security-search-tooltip .tooltip-btn:hover {
        opacity: 0.8;
      }
      #security-search-tooltip .tooltip-btn.report {
        background: #ff4757;
        color: white;
      }
      #security-search-tooltip .tooltip-btn.safe {
        background: #2ed573;
        color: #1a1a2e;
      }
    </style>
    <div class="tooltip-header">
      <div class="tooltip-icon unknown" id="tooltipIcon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#888" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
      </div>
      <div>
        <div class="tooltip-title unknown" id="tooltipTitle">Checking...</div>
        <div class="tooltip-domain" id="tooltipDomain"></div>
      </div>
    </div>
    <div class="tooltip-reason hidden" id="tooltipReason"></div>
  `;
  document.body.appendChild(tooltip);
}

function setupEventListeners() {
  document.addEventListener('mouseover', handleMouseOver);
  document.addEventListener('mouseout', handleMouseOut);
  document.addEventListener('mousemove', handleMouseMove);
  
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
  
  scamList = storage[STORAGE_KEYS.SCAM_LIST] || [];
  safeList = storage[STORAGE_KEYS.SAFE_LIST] || [];
}

function handleMouseOver(e) {
  const resultLink = e.target.closest('a[href]');
  if (!resultLink) return;
  
  const url = extractUrlFromResult(resultLink);
  if (!url) return;
  
  hoveredElement = resultLink;
  showTooltip(url, resultLink);
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

function positionTooltip(x, y) {
  const tooltipWidth = 280;
  const tooltipHeight = 150;
  const padding = 15;
  
  let left = x + padding;
  let top = y + padding;
  
  if (left + tooltipWidth > window.innerWidth) {
    left = x - tooltipWidth - padding;
  }
  
  if (top + tooltipHeight > window.innerHeight) {
    top = y - tooltipHeight - padding;
  }
  
  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
}

function showTooltip(url, element) {
  const domain = extractDomain(url);
  const scamInfo = checkScam(domain);
  const safeInfo = checkSafe(domain);
  
  const iconEl = document.getElementById('tooltipIcon');
  const titleEl = document.getElementById('tooltipTitle');
  const domainEl = document.getElementById('tooltipDomain');
  const reasonEl = document.getElementById('tooltipReason');
  
  if (scamInfo) {
    iconEl.className = 'tooltip-icon scam';
    iconEl.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ff4757" stroke-width="2">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
    `;
    titleEl.className = 'tooltip-title scam';
    titleEl.textContent = '⚠️ Scam Site Reported';
    domainEl.textContent = domain;
    reasonEl.textContent = scamInfo.reason || 'This site has been reported as a scam';
    reasonEl.classList.remove('hidden');
  } else if (safeInfo) {
    iconEl.className = 'tooltip-icon safe';
    iconEl.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2ed573" stroke-width="2">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
    `;
    titleEl.className = 'tooltip-title safe';
    titleEl.textContent = '✓ Verified Safe Site';
    domainEl.textContent = domain;
    reasonEl.textContent = safeInfo.category ? `Category: ${safeInfo.category}` : 'This site is verified as safe';
    reasonEl.classList.remove('hidden');
  } else {
    iconEl.className = 'tooltip-icon unknown';
    iconEl.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#888" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
    `;
    titleEl.className = 'tooltip-title unknown';
    titleEl.textContent = 'Not in Database';
    domainEl.textContent = domain;
    reasonEl.textContent = 'This site has not been reported or verified';
    reasonEl.classList.remove('hidden');
  }
  
  tooltip.classList.add('visible');
}

function hideTooltip() {
  tooltip.classList.remove('visible');
}

function scanSearchResults() {
  const results = getSearchResultElements();
  
  results.forEach(result => {
    const url = extractUrlFromResult(result);
    if (!url || processedUrls.has(url)) return;
    
    processedUrls.add(url);
    
    const domain = extractDomain(url);
    
    if (checkScam(domain)) {
      markAsScam(result, domain);
    } else if (checkSafe(domain)) {
      markAsSafe(result, domain);
    }
  });
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
  selectors.forEach(sel => {
    document.querySelectorAll(sel).forEach(el => {
      if (el.href) results.push(el);
    });
  });
  
  return results;
}

function extractUrlFromResult(element) {
  return element.href || element.getAttribute('href');
}

function extractDomain(url) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

function checkScam(domain) {
  return scamList.find(s => {
    const scamDomain = extractDomain(s.url).toLowerCase().replace(/^www\./, '');
    return domain === scamDomain || domain.includes(scamDomain);
  });
}

function checkSafe(domain) {
  return safeList.find(s => {
    const safeDomain = extractDomain(s.url).toLowerCase().replace(/^www\./, '');
    return domain === safeDomain || domain.includes(safeDomain);
  });
}

function markAsScam(element, domain) {
  const container = element.closest('.g') || element.closest('.b_algo') || 
                    element.closest('.result') || element.closest('.c-container');
  
  if (container && !container.querySelector('.security-search-warning')) {
    const warning = document.createElement('div');
    warning.className = 'security-search-warning';
    warning.innerHTML = `
      <style>
        .security-search-warning {
          background: #fff3f3;
          border-left: 4px solid #ff4757;
          padding: 8px 12px;
          margin: 8px 0;
          font-size: 13px;
          color: #c0392b;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .security-search-warning svg {
          flex-shrink: 0;
        }
      </style>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ff4757" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <span><strong>Warning:</strong> This site has been reported as a scam (${domain})</span>
    `;
    
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
    const badge = document.createElement('div');
    badge.className = 'security-search-safe';
    badge.innerHTML = `
      <style>
        .security-search-safe {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          background: #e8f8f0;
          border: 1px solid #2ed573;
          border-radius: 4px;
          padding: 2px 6px;
          font-size: 11px;
          color: #27ae60;
          margin-left: 8px;
        }
      </style>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2ed573" stroke-width="2">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
        <polyline points="22 4 12 14.01 9 11.01"/>
      </svg>
      <span>Verified Safe</span>
    `;
    
    element.parentNode.insertBefore(badge, element.nextSibling);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
