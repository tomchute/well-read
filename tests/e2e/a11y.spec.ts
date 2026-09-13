import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

/**
 * Accessibility audit (WP-5.2): runs axe-core against every major surface —
 * the feed, a work detail page with the master-notes sheet open, the
 * library, and settings. Fails the run on any `serious` or `critical`
 * violation; `moderate` (and `minor`) violations are printed to the report
 * but do not fail the test, so they stay visible without blocking CI on
 * lower-severity findings.
 */

/** Dismisses the onboarding quiz via "Skip quiz" if it appears, so every page loads its real content. */
async function skipOnboardingIfPresent(page: Page): Promise<void> {
  const skipButton = page.locator('button:has-text("Skip")').first();
  const visible = await skipButton.isVisible().catch(() => false);
  if (visible) {
    await skipButton.click();
    await page.waitForTimeout(300);
  }
}

/** Runs axe against the current page state, fails on serious/critical, and prints moderate violations. */
async function runAxe(page: Page, label: string): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  const serious = results.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical'
  );
  const moderate = results.violations.filter((v) => v.impact === 'moderate');
  const minor = results.violations.filter((v) => v.impact === 'minor' || !v.impact);

  if (moderate.length > 0 || minor.length > 0) {
    // Intentional: surfaces non-blocking findings in the test report per
    // WP-5.2 scope, without failing the run.
    console.log(
      `[a11y:${label}] moderate/minor violations (non-blocking):\n${[...moderate, ...minor]
        .map((v) => `  - [${v.impact}] ${v.id}: ${v.description} (${v.nodes.length} node(s))`)
        .join('\n')}`
    );
  }

  if (serious.length > 0) {
    const detail = serious
      .map(
        (v) =>
          `  - [${v.impact}] ${v.id}: ${v.description}\n${v.nodes
            .map((n) => `      ${n.target.join(' ')}`)
            .join('\n')}`
      )
      .join('\n');
    throw new Error(`[a11y:${label}] serious/critical violations:\n${detail}`);
  }

  expect(serious).toEqual([]);
}

test('feed (after skipping onboarding) has no serious/critical a11y violations', async ({
  page,
}) => {
  await page.goto('/');
  await skipOnboardingIfPresent(page);
  await expect(page.locator('h2:has-text("Feed")')).toBeVisible({ timeout: 10000 });
  await page.waitForFunction(() => document.querySelectorAll('article.work-card').length > 0, {
    timeout: 50000,
  });
  await runAxe(page, 'feed');
});

test('work detail with master-notes sheet open has no serious/critical a11y violations', async ({
  page,
}) => {
  await page.goto('/');
  await skipOnboardingIfPresent(page);
  await page.waitForFunction(() => document.querySelectorAll('article.work-card').length > 0, {
    timeout: 50000,
  });
  await page.locator('article.work-card').first().locator('a.card-link').click();
  await expect(page.locator('h2.work-title')).toBeVisible();

  await page.locator('button:has-text("Master notes")').click();
  await expect(page.locator('div[role="dialog"]')).toBeVisible();
  // Let the sheet's open transition finish — axe reads rendered colour, and
  // mid-fade opacity blends with whatever's behind it, which can misreport
  // contrast on elements that are perfectly opaque once settled.
  await page.waitForTimeout(400);

  await runAxe(page, 'work-detail-with-master-notes');
});

test('library has no serious/critical a11y violations', async ({ page }) => {
  await page.goto('/#/library');
  await skipOnboardingIfPresent(page);
  await expect(page.locator('h2:has-text("Library")')).toBeVisible();
  await runAxe(page, 'library');
});

test('settings has no serious/critical a11y violations', async ({ page }) => {
  await page.goto('/#/settings');
  await skipOnboardingIfPresent(page);
  await expect(page.locator('h2:has-text("Settings")')).toBeVisible();
  await runAxe(page, 'settings');
});
