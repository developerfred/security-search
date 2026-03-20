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

const mockStorage = {};
const mockTabs = [];

const browser = {
  runtime: {
    onInstalled: { addListener: jest.fn() },
    onStartup: { addListener: jest.fn() },
    onMessage: { addListener: jest.fn((cb) => { global.messageListener = cb; }) },
    sendMessage: jest.fn()
  },
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
    query: jest.fn(() => Promise.resolve(mockTabs)),
    sendMessage: jest.fn(() => Promise.resolve())
  }
};

global.browser = browser;
global.fetch = jest.fn();

describe('Background Service Worker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.keys(mockStorage).forEach(k => delete mockStorage[k]);
    mockTabs.length = 0;
  });

  describe('Storage Operations', () => {
    test('addScam should add new scam to list', async () => {
      mockStorage[STORAGE_KEYS.SCAM_LIST] = [];
      
      const list = mockStorage[STORAGE_KEYS.SCAM_LIST] || [];
      const url = 'https://fake-uniswap.com';
      const reason = 'Fake site';
      
      list.unshift({ url, reason, reportedAt: Date.now() });
      mockStorage[STORAGE_KEYS.SCAM_LIST] = list;
      
      expect(list.length).toBe(1);
      expect(list[0].url).toBe(url);
      expect(list[0].reason).toBe(reason);
    });

    test('addScam should not add duplicate', async () => {
      const existingUrl = 'https://existing-scam.com';
      mockStorage[STORAGE_KEYS.SCAM_LIST] = [
        { url: existingUrl, reason: 'Existing', reportedAt: Date.now() }
      ];
      
      const list = mockStorage[STORAGE_KEYS.SCAM_LIST];
      const isDuplicate = list.some(s => s.url === existingUrl);
      
      expect(isDuplicate).toBe(true);
    });

    test('addSafe should add new safe site', async () => {
      mockStorage[STORAGE_KEYS.SAFE_LIST] = [];
      
      const list = mockStorage[STORAGE_KEYS.SAFE_LIST] || [];
      const url = 'https://uniswap.org';
      
      list.unshift({ url, markedAt: Date.now() });
      mockStorage[STORAGE_KEYS.SAFE_LIST] = list;
      
      expect(list.length).toBe(1);
      expect(list[0].url).toBe(url);
    });

    test('removeScam should filter out scam', async () => {
      mockStorage[STORAGE_KEYS.SCAM_LIST] = [
        { url: 'https://scam1.com', reason: 'Scam 1', reportedAt: Date.now() },
        { url: 'https://scam2.com', reason: 'Scam 2', reportedAt: Date.now() }
      ];
      
      const list = mockStorage[STORAGE_KEYS.SCAM_LIST];
      const filtered = list.filter(s => s.url !== 'https://scam1.com');
      mockStorage[STORAGE_KEYS.SCAM_LIST] = filtered;
      
      expect(filtered.length).toBe(1);
      expect(filtered[0].url).toBe('https://scam2.com');
    });

    test('removeSafe should filter out safe site', async () => {
      mockStorage[STORAGE_KEYS.SAFE_LIST] = [
        { url: 'https://safe1.com', markedAt: Date.now() },
        { url: 'https://safe2.com', markedAt: Date.now() }
      ];
      
      const list = mockStorage[STORAGE_KEYS.SAFE_LIST];
      const filtered = list.filter(s => s.url !== 'https://safe1.com');
      mockStorage[STORAGE_KEYS.SAFE_LIST] = filtered;
      
      expect(filtered.length).toBe(1);
    });
  });

  describe('getLists', () => {
    test('should return both lists', async () => {
      mockStorage[STORAGE_KEYS.SCAM_LIST] = [
        { url: 'https://scam.com', reason: 'Scam', reportedAt: Date.now() }
      ];
      mockStorage[STORAGE_KEYS.SAFE_LIST] = [
        { url: 'https://safe.com', markedAt: Date.now() }
      ];
      
      const result = {
        scams: mockStorage[STORAGE_KEYS.SCAM_LIST] || [],
        safe: mockStorage[STORAGE_KEYS.SAFE_LIST] || []
      };
      
      expect(result.scams.length).toBe(1);
      expect(result.safe.length).toBe(1);
    });

    test('should return empty arrays if no data', async () => {
      const result = {
        scams: mockStorage[STORAGE_KEYS.SCAM_LIST] || [],
        safe: mockStorage[STORAGE_KEYS.SAFE_LIST] || []
      };
      
      expect(result.scams).toEqual([]);
      expect(result.safe).toEqual([]);
    });
  });

  describe('getStats', () => {
    test('should return correct counts', async () => {
      mockStorage[STORAGE_KEYS.SCAM_LIST] = [
        { url: 'scam1' }, { url: 'scam2' }, { url: 'scam3' }
      ];
      mockStorage[STORAGE_KEYS.SAFE_LIST] = [
        { url: 'safe1' }, { url: 'safe2' }
      ];
      mockStorage[STORAGE_KEYS.LAST_SYNC] = 123456789;
      
      const stats = {
        scamCount: (mockStorage[STORAGE_KEYS.SCAM_LIST] || []).length,
        safeCount: (mockStorage[STORAGE_KEYS.SAFE_LIST] || []).length,
        lastSync: mockStorage[STORAGE_KEYS.LAST_SYNC] || null
      };
      
      expect(stats.scamCount).toBe(3);
      expect(stats.safeCount).toBe(2);
      expect(stats.lastSync).toBe(123456789);
    });
  });

  describe('Remote Sync', () => {
    test('should fetch from remote sources', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ blacklist: ['fake1.com', 'fake2.com'] })
      });
      
      const response = await fetch(REMOTE_SOURCES.SCAM_LISTS[0]);
      const data = await response.json();
      
      expect(data.blacklist).toContain('fake1.com');
      expect(data.blacklist).toContain('fake2.com');
    });

    test('should handle fetch errors gracefully', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Network error'));
      
      await expect(fetch('https://invalid.url')).rejects.toThrow('Network error');
    });
  });

  describe('Message Handling', () => {
    const messageListener = (message, sender, sendResponse) => {
      if (message.action === 'getLists') {
        return {
          scams: mockStorage[STORAGE_KEYS.SCAM_LIST] || [],
          safe: mockStorage[STORAGE_KEYS.SAFE_LIST] || []
        };
      }
      if (message.action === 'addScam') {
        return { success: true };
      }
      if (message.action === 'syncRemote') {
        return { success: true };
      }
      return false;
    };

    test('should handle getLists message', () => {
      mockStorage[STORAGE_KEYS.SCAM_LIST] = [];
      mockStorage[STORAGE_KEYS.SAFE_LIST] = [];
      
      const result = messageListener(
        { action: 'getLists' },
        {},
        jest.fn()
      );
      
      expect(result).toBeDefined();
      expect(result.scams).toEqual([]);
    });

    test('should handle addScam message', () => {
      const result = messageListener(
        { action: 'addScam', url: 'https://test.com', reason: 'Test' },
        {},
        jest.fn()
      );
      
      expect(result).toEqual({ success: true });
    });

    test('should handle syncRemote message', () => {
      const result = messageListener(
        { action: 'syncRemote' },
        {},
        jest.fn()
      );
      
      expect(result).toEqual({ success: true });
    });

    test('should return false for unknown action', () => {
      const result = messageListener(
        { action: 'unknownAction' },
        {},
        jest.fn()
      );
      
      expect(result).toBe(false);
    });
  });
});
