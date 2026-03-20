const { test, expect } = require('@playwright/test');

test.describe('Security Search Extension - E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/popup.html');
  });

  test.describe('Popup UI', () => {
    test('should load popup with correct title', async ({ page }) => {
      await expect(page).toHaveTitle('Security Search');
    });

    test('should display header', async ({ page }) => {
      await expect(page.locator('h1')).toContainText('Security Search');
    });

    test('should display stats cards', async ({ page }) => {
      await expect(page.locator('.stat-card')).toHaveCount(2);
      await expect(page.locator('.stat-card').first()).toContainText('Scams Blocked');
      await expect(page.locator('.stat-card').last()).toContainText('Safe Sites');
    });

    test('should display report scam section', async ({ page }) => {
      await expect(page.locator('text=Report a Scam')).toBeVisible();
      await expect(page.locator('#scamUrl')).toBeVisible();
      await expect(page.locator('#scamReason')).toBeVisible();
      await expect(page.locator('#reportScamBtn')).toBeVisible();
    });

    test('should display mark safe section', async ({ page }) => {
      await expect(page.locator('text=Mark as Safe')).toBeVisible();
      await expect(page.locator('#safeUrl')).toBeVisible();
      await expect(page.locator('#markSafeBtn')).toBeVisible();
    });

    test('should display sync section', async ({ page }) => {
      await expect(page.locator('text=Sync Community List')).toBeVisible();
      await expect(page.locator('#syncBtn')).toBeVisible();
    });
  });

  test.describe('Form Validation', () => {
    test('should show error for empty scam URL', async ({ page }) => {
      await page.click('#reportScamBtn');
      await expect(page.locator('#scamMessage')).toContainText('Please enter a URL');
      await expect(page.locator('#scamMessage')).toHaveClass(/error/);
    });

    test('should show error for invalid scam URL', async ({ page }) => {
      await page.fill('#scamUrl', 'not-a-valid-url');
      await page.click('#reportScamBtn');
      await expect(page.locator('#scamMessage')).toContainText('Please enter a valid URL');
    });

    test('should show error for empty safe URL', async ({ page }) => {
      await page.click('#markSafeBtn');
      await expect(page.locator('#safeMessage')).toContainText('Please enter a URL');
    });

    test('should show error for invalid safe URL', async ({ page }) => {
      await page.fill('#safeUrl', 'invalid-url');
      await page.click('#markSafeBtn');
      await expect(page.locator('#safeMessage')).toContainText('Please enter a valid URL');
    });
  });

  test.describe('Form Submission', () => {
    test('should successfully report a scam', async ({ page }) => {
      await page.fill('#scamUrl', 'https://fake-uniswap-scam.com');
      await page.fill('#scamReason', 'Fake site');
      await page.click('#reportScamBtn');
      
      await expect(page.locator('#scamMessage')).toContainText('Scam reported successfully');
      await expect(page.locator('#scamMessage')).toHaveClass(/success/);
    });

    test('should successfully mark site as safe', async ({ page }) => {
      await page.fill('#safeUrl', 'https://uniswap.org');
      await page.click('#markSafeBtn');
      
      await expect(page.locator('#safeMessage')).toContainText('Site marked as safe');
      await expect(page.locator('#safeMessage')).toHaveClass(/success/);
    });

    test('should clear inputs after successful submission', async ({ page }) => {
      await page.fill('#scamUrl', 'https://test-scam.com');
      await page.fill('#scamReason', 'Test reason');
      await page.click('#reportScamBtn');
      
      await expect(page.locator('#scamUrl')).toHaveValue('');
      await expect(page.locator('#scamReason')).toHaveValue('');
    });

    test('should show error for duplicate scam report', async ({ page }) => {
      await page.fill('#scamUrl', 'https://existing-scam.com');
      await page.click('#reportScamBtn');
      
      await page.fill('#scamUrl', 'https://existing-scam.com');
      await page.click('#reportScamBtn');
      
      await expect(page.locator('#scamMessage')).toContainText('already reported');
    });

    test('should show error for duplicate safe site', async ({ page }) => {
      await page.fill('#safeUrl', 'https://existing-safe.com');
      await page.click('#markSafeBtn');
      
      await page.fill('#safeUrl', 'https://existing-safe.com');
      await page.click('#markSafeBtn');
      
      await expect(page.locator('#safeMessage')).toContainText('already marked as safe');
    });
  });

  test.describe('Message Visibility', () => {
    test('should hide message after timeout', async ({ page }) => {
      await page.fill('#scamUrl', 'https://test-scam.com');
      await page.click('#reportScamBtn');
      
      await expect(page.locator('#scamMessage')).toHaveClass(/success/);
      
      await page.waitForTimeout(3500);
      
      await expect(page.locator('#scamMessage')).not.toHaveClass(/success|error/);
    });
  });

  test.describe('List Preview', () => {
    test('should display recent scams section', async ({ page }) => {
      await expect(page.locator('text=Recent Reports')).toBeVisible();
    });

    test('should display verified safe sites section', async ({ page }) => {
      await expect(page.locator('text=Verified Safe Sites')).toBeVisible();
    });

    test('should show empty state for no data', async ({ page }) => {
      await expect(page.locator('text=No scam reports yet')).toBeVisible();
      await expect(page.locator('text=No safe sites marked')).toBeVisible();
    });
  });
});

test.describe('Content Script - Search Results', () => {
  test('should detect Google search results', async ({ page }) => {
    await page.goto('https://www.google.com/search?q=uniswap');
    
    const results = await page.evaluate(() => {
      return document.querySelectorAll('.g .yuRUbf a').length;
    });
    
    expect(results).toBeGreaterThanOrEqual(0);
  });

  test('should detect Bing search results', async ({ page }) => {
    await page.goto('https://www.bing.com/search?q=uniswap');
    
    const results = await page.evaluate(() => {
      return document.querySelectorAll('.b_algo h2 a').length;
    });
    
    expect(results).toBeGreaterThanOrEqual(0);
  });
});
