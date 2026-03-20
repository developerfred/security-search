// Security Search - Content Script
// Detects search results and warns about scam sites

(function() {
  'use strict';

  const STORAGE_KEYS = {
    SCAM_LIST: 'scamList',
    SAFE_LIST: 'safeList'
  };

  let scamList = [];
  let safeList = [];
  let processedUrls = new Set();

  async function init() {
    const storage = await browser.storage.local.get([
      STORAGE_KEYS.SCAM_LIST,
      STORAGE_KEYS.SAFE_LIST
    ]);
    
    scamList = storage[STORAGE_KEYS.SCAM_LIST] || [];
    safeList = storage[STORAGE_KEYS.SAFE_LIST] || [];
    
    if (scamList.length > 0 || safeList.length > 0) {
      scanSearchResults();
      
      const observer = new MutationObserver(scanSearchResults);
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    }
  }

  function scanSearchResults() {
    const results = getSearchResultElements();
    
    results.forEach(result => {
      const url = extractUrlFromResult(result);
      if (!url || processedUrls.has(url)) return;
      
      processedUrls.add(url);
      
      const domain = extractDomain(url);
      
      if (isScam(domain)) {
        markAsScam(result, domain);
      } else if (isSafe(domain)) {
        markAsSafe(result, domain);
      }
    });
  }

  function getSearchResultElements() {
    const selectors = [
      // Google
      '.g .yuRUbf a',
      '.g .IsZvec a',
      // Bing
      '.b_algo h2 a',
      '.b_algo .b_attribution',
      // DuckDuckGo
      '.result__a',
      // Yahoo
      '.algo-sr a',
      // Baidu
      '.c-container a'
    ];
    
    let results = [];
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

  function isScam(domain) {
    return scamList.some(s => {
      const scamDomain = extractDomain(s.url).toLowerCase().replace(/^www\./, '');
      return domain === scamDomain || domain.includes(scamDomain);
    });
  }

  function isSafe(domain) {
    return safeList.some(s => {
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
})();
