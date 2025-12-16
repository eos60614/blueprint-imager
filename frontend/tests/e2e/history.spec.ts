import { test, expect } from '@playwright/test';

const TEST_PDF_PATH = '/home/niravsapra/Downloads/Porter Multi Page.pdf.pdf';

// Helper function to upload and start processing
async function uploadAndProcess(page: import('@playwright/test').Page, pageSelection: string, waitForComplete: boolean = true) {
  // Clear localStorage to ensure clean state
  await page.goto('/');
  await page.evaluate(() => localStorage.removeItem('blueprint-imager-history'));

  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles(TEST_PDF_PATH);

  await expect(page.getByText('Upload complete')).toBeVisible({ timeout: 30000 });

  const pageSelector = page.locator('input[placeholder*="e.g."]');
  await pageSelector.fill(pageSelection);

  // Click the convert button
  const pageCount = pageSelection.includes('-')
    ? parseInt(pageSelection.split('-')[1]) - parseInt(pageSelection.split('-')[0]) + 1
    : pageSelection.split(',').length;
  const submitButton = page.getByRole('button', { name: new RegExp(`Convert ${pageCount} page`, 'i') });
  await submitButton.click();

  // Handle the confirmation modal - click "Start Processing"
  await expect(page.getByRole('heading', { name: 'Start Processing' })).toBeVisible({ timeout: 5000 });
  await page.getByRole('button', { name: 'Start Processing' }).click();

  if (waitForComplete) {
    // Wait for job to complete
    await expect(page.getByText('Processing complete!')).toBeVisible({ timeout: 180000 });
  } else {
    // Just wait for processing to start
    await expect(page.getByText(/Processing page|Processing pages/i)).toBeVisible({ timeout: 15000 });
  }
}

test.describe('Browse History Feature', () => {
  test.describe('Navigation', () => {
    test('should display navigation tabs', async ({ page }) => {
      await page.goto('/');

      // Check navigation tabs are visible
      await expect(page.getByRole('link', { name: 'Upload' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'History' })).toBeVisible();
    });

    test('should navigate to history page', async ({ page }) => {
      await page.goto('/');

      // Click History tab
      await page.getByRole('link', { name: 'History' }).click();

      // Should be on history page
      await expect(page).toHaveURL('/history');
      // Use the h1 specifically
      await expect(page.getByRole('heading', { name: 'Upload History', level: 1 })).toBeVisible();
    });

    test('should navigate back to upload page', async ({ page }) => {
      await page.goto('/history');

      // Click Upload tab
      await page.getByRole('link', { name: 'Upload' }).click();

      // Should be on upload page
      await expect(page).toHaveURL('/');
      await expect(page.getByRole('heading', { name: 'Blueprint Imager' })).toBeVisible();
    });
  });

  test.describe('History List', () => {
    test('should show empty state when no history', async ({ page }) => {
      // Clear localStorage before test
      await page.goto('/');
      await page.evaluate(() => localStorage.removeItem('blueprint-imager-history'));

      await page.goto('/history');

      // Should show empty state - check for the heading in empty state
      await expect(page.getByRole('heading', { name: 'No upload history' })).toBeVisible();
      await expect(page.getByText('Your uploaded files will appear here after processing')).toBeVisible();
    });

    test('should show history entries after upload', async ({ page }) => {
      test.setTimeout(60000);
      await uploadAndProcess(page, '1', false);

      // Navigate to history
      await page.getByRole('link', { name: 'History' }).click();

      // Should see the entry in history
      await expect(page.getByText('Porter Multi Page.pdf.pdf')).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('History Entry Details', () => {
    test('should display history entry with correct metadata', async ({ page }) => {
      test.setTimeout(180000);
      await uploadAndProcess(page, '1', true);

      await page.goto('/history');

      // Check entry displays filename
      await expect(page.getByText('Porter Multi Page.pdf.pdf')).toBeVisible();

      // Check status badge
      await expect(page.getByText('Completed')).toBeVisible();

      // Check page info (1 of X pages selected)
      await expect(page.getByText(/1 of \d+ page/)).toBeVisible();

      // Check settings info (DPI)
      await expect(page.getByText(/\d+ DPI/)).toBeVisible();
    });

    test('should navigate to job detail page when clicking entry', async ({ page }) => {
      test.setTimeout(180000);
      await uploadAndProcess(page, '1', true);

      await page.goto('/history');

      // Click on the first history entry link
      const firstEntryLink = page.locator('a[href^="/history/"]').first();
      await firstEntryLink.click();

      // Should be on job detail page
      await expect(page).toHaveURL(/\/history\/\d+/);

      // Should show "Processed Pages" section header
      await expect(page.getByRole('heading', { name: 'Processed Pages' })).toBeVisible({ timeout: 15000 });
    });

    test('should show download button for completed jobs', async ({ page }) => {
      test.setTimeout(180000);
      await uploadAndProcess(page, '1', true);

      await page.goto('/history');

      // Download button should be visible (green download icon)
      const downloadButton = page.locator('button[aria-label="Download tiles"]');
      await expect(downloadButton).toBeVisible();
    });

    test('should show delete button on history entries', async ({ page }) => {
      test.setTimeout(180000);
      await uploadAndProcess(page, '1', true);

      await page.goto('/history');

      // Delete button should be visible
      const deleteButton = page.locator('button[aria-label="Delete from history"]');
      await expect(deleteButton).toBeVisible();
    });
  });

  test.describe('Page Grid (Job Detail)', () => {
    test('should display page thumbnails and info', async ({ page }) => {
      test.setTimeout(240000);
      await uploadAndProcess(page, '1-2', true);

      await page.goto('/history');

      // Click on the first history entry link
      const firstEntryLink = page.locator('a[href^="/history/"]').first();
      await firstEntryLink.click();

      // Wait for page to load
      await expect(page.getByRole('heading', { name: 'Processed Pages' })).toBeVisible({ timeout: 15000 });

      // Should show "Total Pages" and "Selected Pages" labels
      await expect(page.getByText('Total Pages')).toBeVisible();
      await expect(page.getByText('Selected Pages')).toBeVisible();
    });

    test('should navigate to tile grid when clicking a page', async ({ page }) => {
      test.setTimeout(240000);
      await uploadAndProcess(page, '1', true);

      await page.goto('/history');

      // Click on the first history entry link
      const firstEntryLink = page.locator('a[href^="/history/"]').first();
      await firstEntryLink.click();

      // Wait for page grid to load
      await expect(page.getByRole('heading', { name: 'Processed Pages' })).toBeVisible({ timeout: 15000 });
      await page.waitForTimeout(3000);

      // Click on a page thumbnail (look for clickable element with page number)
      const pageThumbnail = page.locator('text=Page 1').first();
      await pageThumbnail.click();

      // Should navigate to tile grid page
      await expect(page).toHaveURL(/\/history\/\d+\/\d+/);
      await expect(page.getByText('Page 1 Tiles')).toBeVisible();
    });
  });

  test.describe('Tile Grid', () => {
    test('should display tile grid with row/col indicators', async ({ page }) => {
      test.setTimeout(180000);
      await uploadAndProcess(page, '1', true);

      // Navigate to tile grid via history
      await page.goto('/history');

      // Click on the first history entry link
      const firstEntryLink = page.locator('a[href^="/history/"]').first();
      await firstEntryLink.click();

      // Wait for page grid
      await expect(page.getByRole('heading', { name: 'Processed Pages' })).toBeVisible({ timeout: 15000 });
      await page.waitForTimeout(3000);

      // Click on first page
      const pageThumbnail = page.locator('text=Page 1').first();
      await pageThumbnail.click();

      // Should be on tile grid page
      await expect(page).toHaveURL(/\/history\/\d+\/\d+/);
      await expect(page.getByText('Page 1 Tiles')).toBeVisible();

      // Should show tile count (X tiles)
      await expect(page.getByText(/\d+ tiles?/)).toBeVisible({ timeout: 10000 });

      // Should show grid dimensions (X rows x Y columns)
      await expect(page.getByText(/\d+ rows x \d+ columns/)).toBeVisible();
    });

    test('should show tile position indicators and preview modal', async ({ page }) => {
      test.setTimeout(180000);
      await uploadAndProcess(page, '1', true);

      await page.goto('/history');

      // Click on the first history entry link
      const firstEntryLink = page.locator('a[href^="/history/"]').first();
      await firstEntryLink.click();

      await expect(page.getByRole('heading', { name: 'Processed Pages' })).toBeVisible({ timeout: 15000 });
      await page.waitForTimeout(3000);

      const pageThumbnail = page.locator('text=Page 1').first();
      await pageThumbnail.click();

      // Wait for tiles to load
      await expect(page.getByText('Page 1 Tiles')).toBeVisible();
      await page.waitForTimeout(3000);

      // Should see position indicators like "1,1" (row,col format)
      await expect(page.getByText('1,1')).toBeVisible({ timeout: 10000 });

      // Click on first tile (aspect-square with cursor-pointer)
      const tile = page.locator('.aspect-square.cursor-pointer').first();
      await tile.click();

      // Should open preview modal with "Row X, Column Y" format
      await expect(page.getByText('Row 1, Column 1')).toBeVisible({ timeout: 5000 });
      await expect(page.getByText('Press ESC to close')).toBeVisible();

      // Press ESC to close
      await page.keyboard.press('Escape');

      // Modal should close
      await expect(page.getByText('Row 1, Column 1')).not.toBeVisible();
    });
  });

  test.describe('Delete History Entry', () => {
    test('should show confirmation modal when clicking delete', async ({ page }) => {
      test.setTimeout(60000);
      await uploadAndProcess(page, '1', false);

      await page.goto('/history');

      // Click delete button
      const deleteButton = page.locator('button[aria-label="Delete from history"]').first();
      await deleteButton.click();

      // Should show confirmation modal - look for the modal title
      await expect(page.getByRole('heading', { name: 'Delete from History' })).toBeVisible();
      await expect(page.getByText(/Remove .* from your history/)).toBeVisible();
    });

    test('should cancel delete when clicking Cancel', async ({ page }) => {
      test.setTimeout(60000);
      await uploadAndProcess(page, '1', false);

      await page.goto('/history');

      const deleteButton = page.locator('button[aria-label="Delete from history"]').first();
      await deleteButton.click();

      // Click Cancel
      await page.getByRole('button', { name: 'Cancel' }).click();

      // Modal should close and entry should still exist
      await expect(page.getByRole('heading', { name: 'Delete from History' })).not.toBeVisible();
      await expect(page.getByText('Porter Multi Page.pdf.pdf')).toBeVisible();
    });

    test('should delete entry when confirming', async ({ page }) => {
      test.setTimeout(60000);
      await uploadAndProcess(page, '1', false);

      await page.goto('/history');

      const deleteButton = page.locator('button[aria-label="Delete from history"]').first();
      await deleteButton.click();

      // Click Delete button in modal (use exact: true to avoid matching "Delete from history" button)
      await page.getByRole('button', { name: 'Delete', exact: true }).click();

      // Entry should be removed (may show empty state or no entries)
      await expect(page.getByText('Porter Multi Page.pdf.pdf')).not.toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Tile Download', () => {
    test('should download selected tiles as ZIP', async ({ page }) => {
      // Use existing job 41, page 47
      await page.goto('/history/41/47');

      // Wait for tiles to load
      await expect(page.getByText('Page 47 Tiles')).toBeVisible({ timeout: 10000 });
      await expect(page.getByText(/\d+ tiles?/)).toBeVisible({ timeout: 10000 });

      // Click "Select Tiles" button to enter selection mode
      const selectButton = page.getByRole('button', { name: 'Select Tiles' });
      await selectButton.click();

      // Button should change to "Cancel Selection"
      await expect(page.getByRole('button', { name: 'Cancel Selection' })).toBeVisible();

      // Select first tile by clicking on it (tiles have aspect-square class)
      const firstTile = page.locator('.aspect-square.cursor-pointer').first();
      await firstTile.click();

      // Should show "1 selected" text
      await expect(page.getByText('1 selected')).toBeVisible();

      // Download button should now be visible with count
      const downloadButton = page.getByRole('button', { name: /Download \(1\)/ });
      await expect(downloadButton).toBeVisible();

      // Set up download handler
      const downloadPromise = page.waitForEvent('download');

      // Click download
      await downloadButton.click();

      // Wait for download to complete
      const download = await downloadPromise;

      // Verify download filename pattern
      expect(download.suggestedFilename()).toMatch(/job_41_page_47_tiles\.zip/);

      // Save and verify file exists
      const path = await download.path();
      expect(path).toBeTruthy();
    });

    test('should allow selecting multiple tiles', async ({ page }) => {
      await page.goto('/history/41/47');

      await expect(page.getByText('Page 47 Tiles')).toBeVisible({ timeout: 10000 });

      // Enter selection mode
      await page.getByRole('button', { name: 'Select Tiles' }).click();

      // Select first two tiles
      const tiles = page.locator('.aspect-square.cursor-pointer');
      await tiles.nth(0).click();
      await tiles.nth(1).click();

      // Should show "2 selected"
      await expect(page.getByText('2 selected')).toBeVisible();

      // Download button should show count of 2
      await expect(page.getByRole('button', { name: /Download \(2\)/ })).toBeVisible();
    });

    test('should use Select All and Deselect All buttons', async ({ page }) => {
      await page.goto('/history/41/47');

      await expect(page.getByText('Page 47 Tiles')).toBeVisible({ timeout: 10000 });

      // Enter selection mode
      await page.getByRole('button', { name: 'Select Tiles' }).click();

      // Click Select All (use exact: true to avoid matching "Deselect All")
      await page.getByRole('button', { name: 'Select All', exact: true }).click();

      // Should show all selected - get tile count from the page
      const tileCountText = await page.getByText(/\d+ tiles?/).textContent();
      const tileCount = parseInt(tileCountText?.match(/(\d+)/)?.[1] || '0');
      await expect(page.getByText(`${tileCount} selected`)).toBeVisible();

      // Click Deselect All
      await page.getByRole('button', { name: 'Deselect All' }).click();

      // Selected count should disappear (no tiles selected)
      await expect(page.getByText(/\d+ selected/)).not.toBeVisible();
    });

    test('should clear selection when canceling selection mode', async ({ page }) => {
      await page.goto('/history/41/47');

      await expect(page.getByText('Page 47 Tiles')).toBeVisible({ timeout: 10000 });

      // Enter selection mode and select a tile
      await page.getByRole('button', { name: 'Select Tiles' }).click();
      await page.locator('.aspect-square.cursor-pointer').first().click();
      await expect(page.getByText('1 selected')).toBeVisible();

      // Cancel selection mode
      await page.getByRole('button', { name: 'Cancel Selection' }).click();

      // Re-enter selection mode - should have no selection
      await page.getByRole('button', { name: 'Select Tiles' }).click();
      await expect(page.getByText(/\d+ selected/)).not.toBeVisible();
    });
  });

  test.describe('Browser Navigation', () => {
    test('should support browser back and forward navigation', async ({ page }) => {
      test.setTimeout(180000);
      await uploadAndProcess(page, '1', true);

      // Navigate: Home -> History -> Job Detail
      await page.goto('/history');

      // Click on the first history entry link
      const firstEntryLink = page.locator('a[href^="/history/"]').first();
      await firstEntryLink.click();

      await expect(page).toHaveURL(/\/history\/\d+/);
      await expect(page.getByRole('heading', { name: 'Processed Pages' })).toBeVisible({ timeout: 15000 });

      // Go back
      await page.goBack();

      // Should be back on history list
      await expect(page).toHaveURL('/history');
      await expect(page.getByRole('heading', { name: 'Upload History', level: 1 })).toBeVisible();

      // Go forward
      await page.goForward();

      // Should be back on job detail
      await expect(page).toHaveURL(/\/history\/\d+/);
      await expect(page.getByRole('heading', { name: 'Processed Pages' })).toBeVisible({ timeout: 15000 });
    });
  });
});
