import { expect, test } from '@playwright/test';

test('load feed, click a work card, and view master notes', async ({ page }) => {
  await page.goto('/');

  // If the onboarding quiz appears, skip it
  const skipButton = page.locator('button:has-text("Skip")').first();
  const skipVisible = await skipButton.isVisible().catch(() => false);
  if (skipVisible) {
    await skipButton.click();
    // Wait a bit for the quiz to close
    await page.waitForTimeout(500);
  }

  // Wait for the Feed page to load
  await expect(page.locator('h2:has-text("Feed")')).toBeVisible({ timeout: 10000 });

  // Wait for the manifest data to load
  await page.waitForFunction(() => document.querySelectorAll('article.work-card').length > 0, {
    timeout: 50000,
  });

  // The steering guide starts collapsed behind a "Steer the feed" toggle
  // and opens on click
  const guideToggle = page.locator('button.guide-toggle');
  await expect(guideToggle).toBeVisible();
  await expect(guideToggle).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#steering-guide')).toHaveCount(0);
  await guideToggle.click();
  await expect(guideToggle).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#steering-guide button.theme-chip').first()).toBeVisible();
  await guideToggle.click();
  await expect(page.locator('#steering-guide')).toHaveCount(0);

  // Expect at least one work card
  const workCards = page.locator('article.work-card');
  const cardCount = await workCards.count();
  expect(cardCount).toBeGreaterThanOrEqual(1);

  // Every card carries a type badge and a type glyph in its cover box
  await expect(workCards.first().locator('.badge-type')).toBeVisible();
  await expect(workCards.first().locator('.cover-glyph path')).toHaveAttribute('d', /^M/);

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

  // The work page's back link returns to the feed
  const backLink = page.locator('a.back-link');
  await expect(backLink).toHaveText(/Back to feed/);
  await backLink.click();
  await expect(page.locator('h2:has-text("Feed")')).toBeVisible();
  await expect(page.locator('article.work-card').first()).toBeVisible();
});

test('navigate to settings and expect Kindle section', async ({ page }) => {
  await page.goto('/#/settings');

  // If the onboarding quiz appears, skip it
  const skipButton = page.locator('button:has-text("Skip")').first();
  const skipVisible = await skipButton.isVisible().catch(() => false);
  if (skipVisible) {
    await skipButton.click();
    // Wait a bit for the quiz to close
    await page.waitForTimeout(500);
  }

  // Expect the Kindle section to be visible
  const kindleSection = page
    .locator('h3:has-text("Kindle")')
    .or(page.locator('h2:has-text("Kindle")'));
  await expect(kindleSection).toBeVisible();
});
