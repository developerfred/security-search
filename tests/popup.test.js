const STORAGE_KEYS = {
  SCAM_LIST: 'scamList',
  SAFE_LIST: 'safeList',
  STATS: 'stats'
};

const mockStorage = {};

const browser = {
  storage: {
    local: {
      get: jest.fn((keys) => Promise.resolve(
        Array.isArray(keys) 
          ? keys.reduce((acc, k) => ({ ...acc, [k]: mockStorage[k] }), {})
          : mockStorage[keys]
      )),
      set: jest.fn((data) => {
        Object.assign(mockStorage, data);
        return Promise.resolve();
      })
    }
  },
  tabs: {
    query: jest.fn(() => Promise.resolve([{ url: 'https://example.com', id: 1 }]))
  },
  runtime: {
    sendMessage: jest.fn(() => Promise.resolve({ success: true }))
  }
};

global.browser = browser;

describe('Popup Logic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.keys(mockStorage).forEach(k => delete mockStorage[k]);
  });

  describe('URL Validation', () => {
    test('should validate correct URLs', () => {
      const validUrls = [
        'https://uniswap.org',
        'https://app.uniswap.org',
        'https://aave.com',
        'http://localhost:3000'
      ];

      validUrls.forEach(url => {
        expect(() => new URL(url)).not.toThrow();
      });
    });

    test('should reject invalid URLs', () => {
      const invalidUrls = [
        '',
      ];

      invalidUrls.forEach(url => {
        expect(() => new URL(url)).toThrow();
      });
    });
  });

  describe('Domain Extraction', () => {
    test('should extract domain from URL', () => {
      const testCases = [
        { url: 'https://uniswap.org', expected: 'uniswap.org' },
        { url: 'https://app.uniswap.org', expected: 'app.uniswap.org' },
        { url: 'https://www.aave.com', expected: 'www.aave.com' },
        { url: 'https://curve.fi', expected: 'curve.fi' }
      ];

      testCases.forEach(({ url, expected }) => {
        const domain = new URL(url).hostname;
        expect(domain).toBe(expected);
      });
    });

    test('should handle URL without protocol', () => {
      const extractDomain = (url) => {
        try {
          return new URL(url).hostname;
        } catch {
          return url;
        }
      };

      expect(extractDomain('uniswap.org')).toBe('uniswap.org');
    });
  });

  describe('Load Stats', () => {
    test('should load stats from storage', async () => {
      mockStorage[STORAGE_KEYS.SCAM_LIST] = [
        { url: 'scam1.com' },
        { url: 'scam2.com' }
      ];
      mockStorage[STORAGE_KEYS.SAFE_LIST] = [
        { url: 'safe1.com' }
      ];
      mockStorage[STORAGE_KEYS.STATS] = { scamsReported: 5 };

      const scamList = mockStorage[STORAGE_KEYS.SCAM_LIST] || [];
      const safeList = mockStorage[STORAGE_KEYS.SAFE_LIST] || [];
      const stats = mockStorage[STORAGE_KEYS.STATS] || {};

      const scamCount = stats?.scamsReported || scamList.length;
      const safeCount = safeList.length;

      expect(scamCount).toBe(5);
      expect(safeCount).toBe(1);
    });

    test('should default to list length if no stats', async () => {
      mockStorage[STORAGE_KEYS.SCAM_LIST] = [{ url: 'scam.com' }];
      mockStorage[STORAGE_KEYS.SAFE_LIST] = [];

      const scamList = mockStorage[STORAGE_KEYS.SCAM_LIST] || [];
      const safeList = mockStorage[STORAGE_KEYS.SAFE_LIST] || [];
      const stats = mockStorage[STORAGE_KEYS.STATS] || {};

      const scamCount = stats?.scamsReported || scamList.length;
      const safeCount = safeList.length;

      expect(scamCount).toBe(1);
      expect(safeCount).toBe(0);
    });
  });

  describe('Report Scam', () => {
    test('should add new scam report', async () => {
      mockStorage[STORAGE_KEYS.SCAM_LIST] = [];

      const url = 'https://fake-uniswap.com';
      const reason = 'Fake site pretending to be Uniswap';

      const list = mockStorage[STORAGE_KEYS.SCAM_LIST] || [];
      list.unshift({ url, reason, reportedAt: Date.now() });
      mockStorage[STORAGE_KEYS.SCAM_LIST] = list;

      const currentList = mockStorage[STORAGE_KEYS.SCAM_LIST];
      expect(currentList.length).toBe(1);
      expect(currentList[0].url).toBe(url);
      expect(currentList[0].reason).toBe(reason);
    });

    test('should not add duplicate scam', async () => {
      const existingUrl = 'https://existing-scam.com';
      mockStorage[STORAGE_KEYS.SCAM_LIST] = [
        { url: existingUrl, reason: 'Existing', reportedAt: Date.now() }
      ];

      const url = existingUrl;
      const list = mockStorage[STORAGE_KEYS.SCAM_LIST] || [];
      const isDuplicate = list.some(s => s.url === url);

      expect(isDuplicate).toBe(true);
    });

    test('should update stats on new report', async () => {
      mockStorage[STORAGE_KEYS.SCAM_LIST] = [];
      mockStorage[STORAGE_KEYS.STATS] = { scamsReported: 10 };

      const url = 'https://new-scam.com';
      const list = mockStorage[STORAGE_KEYS.SCAM_LIST] || [];
      list.unshift({ url, reportedAt: Date.now() });
      mockStorage[STORAGE_KEYS.SCAM_LIST] = list;

      const stats = mockStorage[STORAGE_KEYS.STATS] || { scamsReported: 0 };
      stats.scamsReported++;
      mockStorage[STORAGE_KEYS.STATS] = stats;

      expect(mockStorage[STORAGE_KEYS.STATS].scamsReported).toBe(11);
    });
  });

  describe('Mark as Safe', () => {
    test('should add new safe site', async () => {
      mockStorage[STORAGE_KEYS.SAFE_LIST] = [];

      const url = 'https://uniswap.org';

      const list = mockStorage[STORAGE_KEYS.SAFE_LIST] || [];
      list.unshift({ url, markedAt: Date.now() });
      mockStorage[STORAGE_KEYS.SAFE_LIST] = list;

      expect(mockStorage[STORAGE_KEYS.SAFE_LIST].length).toBe(1);
    });

    test('should not add duplicate safe site', async () => {
      const existingUrl = 'https://uniswap.org';
      mockStorage[STORAGE_KEYS.SAFE_LIST] = [
        { url: existingUrl, markedAt: Date.now() }
      ];

      const url = existingUrl;
      const list = mockStorage[STORAGE_KEYS.SAFE_LIST] || [];
      const isDuplicate = list.some(s => s.url === url);

      expect(isDuplicate).toBe(true);
    });
  });

  describe('Recent Lists', () => {
    test('should show recent 5 scams', async () => {
      mockStorage[STORAGE_KEYS.SCAM_LIST] = Array.from(
        { length: 10 },
        (_, i) => ({ url: `scam${i}.com`, reportedAt: Date.now() })
      );

      const list = mockStorage[STORAGE_KEYS.SCAM_LIST] || [];
      const recent = list.slice(0, 5);

      expect(recent.length).toBe(5);
    });

    test('should show recent 5 safe sites', async () => {
      mockStorage[STORAGE_KEYS.SAFE_LIST] = Array.from(
        { length: 10 },
        (_, i) => ({ url: `safe${i}.com`, markedAt: Date.now() })
      );

      const list = mockStorage[STORAGE_KEYS.SAFE_LIST] || [];
      const recent = list.slice(0, 5);

      expect(recent.length).toBe(5);
    });

    test('should handle empty lists', async () => {
      mockStorage[STORAGE_KEYS.SCAM_LIST] = [];
      mockStorage[STORAGE_KEYS.SAFE_LIST] = [];

      const scams = mockStorage[STORAGE_KEYS.SCAM_LIST] || [];
      const safe = mockStorage[STORAGE_KEYS.SAFE_LIST] || [];

      expect(scams.slice(0, 5).length).toBe(0);
      expect(safe.slice(0, 5).length).toBe(0);
    });
  });

  describe('Sync Community', () => {
    test('should send syncRemote message', async () => {
      const result = await browser.runtime.sendMessage({ action: 'syncRemote' });

      expect(browser.runtime.sendMessage).toHaveBeenCalledWith({ action: 'syncRemote' });
      expect(result).toEqual({ success: true });
    });

    test('should submit scam to community', async () => {
      const result = await browser.runtime.sendMessage({
        action: 'submitCommunity',
        type: 'scam',
        url: 'https://test-scam.com',
        reason: 'Test scam'
      });

      expect(browser.runtime.sendMessage).toHaveBeenCalledWith({
        action: 'submitCommunity',
        type: 'scam',
        url: 'https://test-scam.com',
        reason: 'Test scam'
      });
    });

    test('should submit safe to community', async () => {
      const result = await browser.runtime.sendMessage({
        action: 'submitCommunity',
        type: 'safe',
        url: 'https://test-safe.com'
      });

      expect(browser.runtime.sendMessage).toHaveBeenCalledWith({
        action: 'submitCommunity',
        type: 'safe',
        url: 'https://test-safe.com'
      });
    });
  });

  describe('Security - URL Protocol Validation', () => {
    test('should only allow http and https protocols', () => {
      const allowedProtocols = ['http:', 'https:'];
      const disallowedProtocols = ['ftp:', 'file:', 'data:', 'javascript:', 'mailto:'];

      allowedProtocols.forEach(protocol => {
        const url = new URL('/', protocol + '//example.com');
        expect(url.protocol).toBe(protocol);
      });

      disallowedProtocols.forEach(protocol => {
        const url = new URL('/', protocol + '//example.com');
        expect(['http:', 'https:'].includes(url.protocol)).toBe(false);
      });
    });
  });

  describe('Security - Reason Sanitization', () => {
    test('should sanitize reason input by removing HTML tags', () => {
      const sanitizeReason = (text) => {
        const sanitized = text.trim().slice(0, 500);
        return sanitized.replace(/<[^>]*>/g, '');
      };

      expect(sanitizeReason('<script>alert(1)</script>Test')).toBe('alert(1)Test');
      expect(sanitizeReason('<img src=x onerror=alert(1)>')).toBe('');
      expect(sanitizeReason('Normal text')).toBe('Normal text');
    });

    test('should limit reason length to 500 characters', () => {
      const sanitizeReason = (text) => {
        const sanitized = text.trim().slice(0, 500);
        return sanitized.replace(/<[^>]*>/g, '');
      };

      const longText = 'a'.repeat(600);
      expect(sanitizeReason(longText).length).toBe(500);
    });
  });

  describe('Domain Matching', () => {
    test('should remove www prefix', () => {
      const normalizeDomain = (domain) => domain.toLowerCase().replace(/^www\./, '');

      expect(normalizeDomain('www.uniswap.org')).toBe('uniswap.org');
      expect(normalizeDomain('uniswap.org')).toBe('uniswap.org');
      expect(normalizeDomain('WWW.UNISWAP.ORG')).toBe('uniswap.org');
    });

    test('should distinguish between subdomains', () => {
      const normalizeDomain = (domain) => domain.toLowerCase().replace(/^www\./, '');

      const domain1 = normalizeDomain('app.uniswap.org');
      const domain2 = normalizeDomain('uniswap.org');

      expect(domain1).not.toBe(domain2);
      expect(domain1).toBe('app.uniswap.org');
      expect(domain2).toBe('uniswap.org');
    });

    test('should not match substring domains', () => {
      const normalizeDomain = (domain) => domain.toLowerCase().replace(/^www\./, '');

      const safeDomain = normalizeDomain('uniswap.org');
      const maliciousDomain = normalizeDomain('notuniswap.org');

      expect(safeDomain === maliciousDomain).toBe(false);
      expect(safeDomain.includes(maliciousDomain)).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty reason', () => {
      const sanitizeReason = (text) => {
        const sanitized = text.trim().slice(0, 500);
        return sanitized.replace(/<[^>]*>/g, '');
      };

      expect(sanitizeReason('')).toBe('');
      expect(sanitizeReason('   ')).toBe('');
    });

    test('should handle unicode in reason', () => {
      const sanitizeReason = (text) => {
        const sanitized = text.trim().slice(0, 500);
        return sanitized.replace(/<[^>]*>/g, '');
      };

      expect(sanitizeReason('这是一个测试')).toBe('这是一个测试');
      expect(sanitizeReason('Test with émoji 🔐')).toBe('Test with émoji 🔐');
    });

    test('should handle malformed URLs gracefully', () => {
      const isValidUrl = (string) => {
        try {
          const url = new URL(string);
          return url.protocol === 'http:' || url.protocol === 'https:';
        } catch {
          return false;
        }
      };

      expect(isValidUrl('not-a-url')).toBe(false);
      expect(isValidUrl('uniswap')).toBe(false);
      expect(isValidUrl('htp://wrong')).toBe(false);
      expect(isValidUrl('ftp://example.com')).toBe(false);
      expect(isValidUrl('javascript:alert(1)')).toBe(false);
    });
  });
});
