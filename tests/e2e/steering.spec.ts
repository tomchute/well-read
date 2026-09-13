import { expect, test } from '@playwright/test';

/**
 * Regression cover for the steering chips.
 *
 * Theme chips render `aria-pressed`, so they read as toggles — but every tap
 * used to send `more-about-theme`, which only ever adds. Tapping an active
 * chip stacked `theme[X]` +3 at a time and pushed a duplicate session pin,
 * and `aria-pressed` latched `true` for good: a steer could be switched on and
 * never off, short of "Surprise me" wiping every steer at once.
 *
 * The related second fix — SteeringBar applied each action to its own copy of
 * the scoring state *and* reported it to Feed, which applied it to the store,
 * so every delta landed twice — is only partly covered here. Measured on the
 * pre-fix build, the form row displayed one delta ahead of the scorer 300ms
 * after a click in 4 of 5 runs (each preceded by "Surprise me"), but it
 * settles correct within about a second, so the assertions below wait it out
 * and pass either way. Treat the last test as a guard on the invariant
 * "displayed chip state matches stored weight", not as cover for that fix.
 */

const STORAGE = {
  weights: 'wellread:v1:weights',
  pins: 'wellread:v1:sessionPins',
};

async function openSteeringGuide(page: import('@playwright/test').Page) {
  await page.goto('/');
  const skip = page.locator('button:has-text("Skip")').first();
  if (await skip.isVisible().catch(() => false)) await skip.click();
  await expect(page.locator('h2:has-text("Feed")')).toBeVisible({ timeout: 10000 });

  const toggle = page.locator('button.guide-toggle');
  await expect(toggle).toBeVisible();
  if ((await toggle.getAttribute('aria-expanded')) === 'false') await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
}

/** The persisted scoring state — what actually drives the feed order. */
function readStored(page: import('@playwright/test').Page, key: string) {
  return page.evaluate((k) => {
    try {
      return JSON.parse(localStorage.getItem(k) ?? 'null');
    } catch {
      return null;
    }
  }, key);
}

test('a theme chip switches a steer on and back off', async ({ page }) => {
  await openSteeringGuide(page);

  const chip = page.locator('button.theme-chip').first();
  const theme = ((await chip.textContent()) ?? '').trim().toLowerCase();
  await expect(chip).toHaveAttribute('aria-pressed', 'false');

  await chip.click();
  await expect(chip).toHaveAttribute('aria-pressed', 'true');
  expect((await readStored(page, STORAGE.weights))?.theme?.[theme]).toBeGreaterThan(0);

  // The tap that used to do nothing but pile on more weight.
  await chip.click();
  await expect(chip).toHaveAttribute('aria-pressed', 'false');
  expect((await readStored(page, STORAGE.weights))?.theme?.[theme]).toBeUndefined();
  expect(await readStored(page, STORAGE.pins)).toEqual([]);
});

test('repeat taps on a theme chip never stack weight or session pins', async ({ page }) => {
  await openSteeringGuide(page);

  const chip = page.locator('button.theme-chip').first();
  const theme = ((await chip.textContent()) ?? '').trim().toLowerCase();

  // On, off, on — the weight should be the single-tap value, not three taps' worth.
  await chip.click();
  await chip.click();
  await chip.click();
  await expect(chip).toHaveAttribute('aria-pressed', 'true');

  const weights = await readStored(page, STORAGE.weights);
  const pins = await readStored(page, STORAGE.pins);
  expect(weights?.theme?.[theme]).toBe(3);
  expect(pins).toHaveLength(1);
});

test('form chip state matches the stored weight after undoing a steer', async ({ page }) => {
  await openSteeringGuide(page);

  const more = page.locator('button.form-chip', { hasText: 'More poems' });
  const less = page.locator('button.form-chip', { hasText: 'Less poems' });
  const storedPoem = async () => (await readStored(page, STORAGE.weights))?.form?.poem ?? 0;

  // "Surprise me" first: this is the sequence the double-application showed up
  // on — once the component had written to its own copy of the state, the copy
  // shadowed the prop and the row displayed one delta ahead of the scorer.
  await page.locator('#steering-guide button', { hasText: 'Surprise me' }).click();
  await expect(more).toHaveAttribute('aria-pressed', 'false');

  await more.click();
  await more.click();
  expect(await storedPoem()).toBe(4);

  // One "Less" leaves the weight positive, so "More" must still read as on.
  // The double-applied state used to show both sides off at this point.
  await less.click();
  expect(await storedPoem()).toBe(2);
  await expect(more).toHaveAttribute('aria-pressed', 'true');
  await expect(less).toHaveAttribute('aria-pressed', 'false');

  await less.click();
  expect(await storedPoem()).toBe(0);
  await expect(more).toHaveAttribute('aria-pressed', 'false');
  await expect(less).toHaveAttribute('aria-pressed', 'false');
});
