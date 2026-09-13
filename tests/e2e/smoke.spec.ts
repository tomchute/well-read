import { test, expect } from '@playwright/test';

test('load feed, click a work card, and view master notes', async ({ page }) => {
  await page.goto('/');

  // Wait for the Feed page to load
  await expect(page.locator('h2:has-text("Feed")')).toBeVisible({ timeout: 10000 });

  // If the onboarding quiz appears, skip it
  const skipButton = page.locator('button:has-text("Skip")').first();
  const skipVisible = await skipButton.isVisible().catch(() => false);
  if (skipVisible) {
    await skipButton.click();
    // Wait a bit for the quiz to close
    await page.waitForTimeout(500);
  }

  // Wait for the manifest data to load - look for skeleton cards first, then work cards
  // The app shows skeleton cards while loading the manifest
  const skeletonCards = page.locator('div.skeleton-card');
  const skeletonVisible = await skeletonCards.first().isVisible().catch(() => false);

  if (skeletonVisible) {
    // Wait for skeletons to disappear and actual cards to appear
    await page.waitForFunction(
      () => document.querySelectorAll('article.work-card').length > 0,
      { timeout: 20000 }
    );
  } else {
    // If no skeletons, wait for work cards directly
    await page.waitForFunction(
      () => document.querySelectorAll('article.work-card').length > 0,
      { timeout: 20000 }
    );
  }

  // Expect at least one work card
  const workCards = page.locator('article.work-card');
  const cardCount = await workCards.count();
  expect(cardCount).toBeGreaterThanOrEqual(1);

  // Click the first work card
  const firstCardLink = workCards.first().locator('a.card-link');
  await firstCardLink.click();

  // Expect the work heading
  const workHeading = page.locator('h2.work-title');
  await expect(workHeading).toBeVisible();

  // Open Master notes
  const notesButton = page.locator('button:has-text("Master notes")');
  await notesButton.click();

  // Expect Context tab content to be visible
  const contextPanel = page.locator('div[role="tabpanel"]#notes-panel-context');
  await expect(contextPanel).toBeVisible();

  // Close with Escape
  await page.keyboard.press('Escape');
  const sheet = page.locator('div[role="dialog"]');
  await expect(sheet).not.toBeVisible();
});

test('navigate to settings and expect Kindle section', async ({ page }) => {
  await page.goto('/#/settings');

  // Expect the Kindle section to be visible
  const kindleSection = page.locator('h3:has-text("Kindle")').or(page.locator('h2:has-text("Kindle")'));
  await expect(kindleSection).toBeVisible();
});
