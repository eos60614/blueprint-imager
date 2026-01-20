import { test, expect } from '@playwright/test';
import path from 'path';

const TEST_PDF_PATH = path.join(__dirname, '../fixtures/test-sample.pdf');

// Test that captures and reports console errors
test.describe('Console Error Check', () => {
  test('should have no console errors on main pages', async ({ page }) => {
    const consoleErrors: string[] = [];
    const consoleWarnings: string[] = [];

    // Listen for console messages
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        // Ignore expected API errors (Procore database not configured in test)
        if (text.includes('500') && text.includes('Internal Server Error')) {
          return;
        }
        consoleErrors.push(`[ERROR] ${text}`);
      } else if (msg.type() === 'warning') {
        consoleWarnings.push(`[WARN] ${msg.text()}`);
      }
    });

    // Listen for page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      consoleErrors.push(`[PAGE ERROR] ${err.message}`);
    });

    // Visit home page
    console.log('--- Visiting Home Page ---');
    await page.goto('/');
    await page.waitForTimeout(2000);

    // Visit browse page (may have expected 500 errors if Procore DB not configured)
    console.log('--- Visiting Browse Page ---');
    await page.goto('/browse');
    await page.waitForTimeout(2000);

    // Visit history page
    console.log('--- Visiting History Page ---');
    await page.goto('/history');
    await page.waitForTimeout(2000);

    // Log all warnings
    if (consoleWarnings.length > 0) {
      console.log('\n=== Console Warnings ===');
      consoleWarnings.forEach((w) => console.log(w));
    }

    // Log and fail on errors
    if (consoleErrors.length > 0) {
      console.log('\n=== Console Errors ===');
      consoleErrors.forEach((e) => console.log(e));
    }

    // Fail test if there are errors
    expect(consoleErrors, `Found ${consoleErrors.length} console errors`).toHaveLength(0);
  });

  test('should have no console errors during upload flow', async ({ page }) => {
    const consoleErrors: string[] = [];
    const consoleWarnings: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(`[ERROR] ${msg.text()}`);
      } else if (msg.type() === 'warning') {
        consoleWarnings.push(`[WARN] ${msg.text()}`);
      }
    });

    page.on('pageerror', (err) => {
      consoleErrors.push(`[PAGE ERROR] ${err.message}`);
    });

    // Upload flow
    console.log('--- Starting Upload Flow ---');
    await page.goto('/');

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(TEST_PDF_PATH);

    await expect(page.getByText('Upload complete')).toBeVisible({ timeout: 30000 });
    console.log('--- Upload Complete ---');

    // Select a page and start processing
    const pageSelector = page.locator('input[placeholder*="e.g."]');
    await pageSelector.fill('1');

    const submitButton = page.getByRole('button', { name: /Convert 1 page/i });
    await submitButton.click();

    // Handle the confirmation modal
    await expect(page.getByRole('heading', { name: 'Start Processing' })).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: 'Start Processing' }).click();
    console.log('--- Processing Started ---');

    // Wait for processing to complete
    await expect(page.getByText('Processing complete!')).toBeVisible({ timeout: 180000 });
    console.log('--- Processing Complete ---');

    // Navigate to history
    await page.getByRole('link', { name: 'History' }).click();
    await page.waitForTimeout(2000);
    console.log('--- On History Page ---');

    // Click into the job
    const firstEntryLink = page.locator('a[href^="/history/"]').first();
    await firstEntryLink.click();
    await expect(page.getByRole('heading', { name: 'Processed Pages' })).toBeVisible({ timeout: 15000 });
    console.log('--- On Job Detail Page ---');

    // Click into tile grid
    const pageThumbnail = page.locator('.cursor-pointer').first();
    await pageThumbnail.click();
    await expect(page.getByText(/Page \d+ Tiles/)).toBeVisible({ timeout: 10000 });
    console.log('--- On Tile Grid Page ---');

    await page.waitForTimeout(3000);

    // Log all warnings
    if (consoleWarnings.length > 0) {
      console.log('\n=== Console Warnings ===');
      consoleWarnings.forEach((w) => console.log(w));
    }

    // Log and fail on errors
    if (consoleErrors.length > 0) {
      console.log('\n=== Console Errors ===');
      consoleErrors.forEach((e) => console.log(e));
    }

    expect(consoleErrors, `Found ${consoleErrors.length} console errors`).toHaveLength(0);
  });
});
