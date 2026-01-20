import { test, expect } from '@playwright/test';
import path from 'path';

const TEST_PDF_PATH = path.join(__dirname, '../fixtures/test-sample.pdf');

test.describe('PDF Upload', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display upload area on page load', async ({ page }) => {
    // Check page title and header
    await expect(page.locator('h1')).toContainText('Blueprint Imager');

    // Check upload area is visible
    await expect(page.getByText('Upload a PDF file', { exact: true })).toBeVisible();
    await expect(page.getByText('Drag and drop or click to select')).toBeVisible();
  });

  test('should upload a PDF file and show page count', async ({ page }) => {
    // Get the file input (hidden, but we can use it with setInputFiles)
    const fileInput = page.locator('input[type="file"]');

    // Upload the test PDF
    await fileInput.setInputFiles(TEST_PDF_PATH);

    // Wait for upload to complete - look for the success indicator
    await expect(page.getByText('Upload complete')).toBeVisible({ timeout: 30000 });

    // Verify the filename is displayed
    await expect(page.getByText('test-sample.pdf')).toBeVisible();

    // Step 2 should now be visible with page selection
    await expect(page.getByText('Step 2: Select Pages')).toBeVisible();

    // The page selector input should be available (placeholder contains "e.g.")
    const pageSelector = page.locator('input[placeholder*="e.g."]');
    await expect(pageSelector).toBeVisible();
  });

  test('should show thumbnails after upload', async ({ page }) => {
    // Upload the test PDF
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(TEST_PDF_PATH);

    // Wait for upload to complete
    await expect(page.getByText('Upload complete')).toBeVisible({ timeout: 30000 });

    // Scroll down to make thumbnails visible
    await page.getByText('Click thumbnails to toggle selection').scrollIntoViewIfNeeded();

    // Wait for thumbnail grid - look for thumbnail containers with page numbers
    // The page number badge shows just "1" and "2"
    const thumbnail1 = page.locator('div').filter({ hasText: /^1$/ }).first();
    const thumbnail2 = page.locator('div').filter({ hasText: /^2$/ }).first();

    await expect(thumbnail1).toBeVisible({ timeout: 15000 });
    await expect(thumbnail2).toBeVisible({ timeout: 15000 });

    // Wait for thumbnail images to render and capture screenshot
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-results/thumbnails-debug.png', fullPage: true });
  });

  test('should allow page selection after upload', async ({ page }) => {
    // Upload the test PDF
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(TEST_PDF_PATH);

    // Wait for upload to complete
    await expect(page.getByText('Upload complete')).toBeVisible({ timeout: 30000 });

    // Enter page selection in the input
    const pageSelector = page.locator('input[placeholder*="e.g."]');
    await pageSelector.fill('1-2');

    // The submit button should become enabled and show correct count
    const submitButton = page.getByRole('button', { name: /Convert 2 page/i });
    await expect(submitButton).toBeVisible();
    await expect(submitButton).toBeEnabled();
  });

  test('should toggle page selection via thumbnails', async ({ page }) => {
    // Upload the test PDF
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(TEST_PDF_PATH);

    // Wait for upload to complete
    await expect(page.getByText('Upload complete')).toBeVisible({ timeout: 30000 });

    // Scroll down to make thumbnails visible
    await page.getByText('Click thumbnails to toggle selection').scrollIntoViewIfNeeded();

    // Wait a moment for thumbnails to render
    await page.waitForTimeout(1000);

    // Find thumbnail containers - they have the page number badge
    // Click on the first thumbnail (page 1)
    const thumbnailGrid = page.locator('text=Click thumbnails to toggle selection').locator('..').locator('..');
    const thumbnails = thumbnailGrid.locator('div.cursor-pointer');

    // Click first thumbnail
    await thumbnails.first().click();

    // Submit button should show 1 page selected
    await expect(page.getByRole('button', { name: /Convert 1 page/i })).toBeVisible({ timeout: 5000 });

    // Click second thumbnail
    await thumbnails.nth(1).click();

    // Submit button should show 2 pages selected
    await expect(page.getByRole('button', { name: /Convert 2 page/i })).toBeVisible({ timeout: 5000 });
  });
});
