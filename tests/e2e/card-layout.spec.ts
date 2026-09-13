import { expect, test } from '@playwright/test';

/**
 * Regression cover for the feed card's fixed-height flex column.
 *
 * `.card-main` is a flex column inside a card pinned to Feed.svelte's
 * CARD_HEIGHT, so any content overrun is absorbed by shrinking its children.
 * That silently squashed `.title` — which clips its overflow — to a fraction
 * of a line whenever a title wrapped to two lines, a badge row wrapped, or a
 * long translator credit pushed the block down: the title rendered as glyphs
 * cut through the middle. Eleven of the thirty seeded cards did this at phone
 * width and nothing failed.
 *
 * The invariant these tests hold: every card's title box is a whole number of
 * line boxes. A title clamped to two lines with an ellipsis is correct; a
 * title box 0.4 lines tall is the bug.
 */

/** Phone width is where the badge row wraps and text columns are narrowest. */
const PHONE = { width: 393, height: 850 };

async function openFeed(page: import('@playwright/test').Page) {
  await page.goto('/');
  const skip = page.locator('button:has-text("Skip")').first();
  if (await skip.isVisible().catch(() => false)) await skip.click();
  await expect(page.locator('h2:has-text("Feed")')).toBeVisible({ timeout: 10000 });
  await page.waitForFunction(() => document.querySelectorAll('article.work-card').length > 0, {
    timeout: 50000,
  });
}

/**
 * Scrolls the virtualised feed end to end, measuring every card that mounts.
 * Cards are recycled, so a card only reports while it is on screen.
 */
async function measureEveryCard(page: import('@playwright/test').Page) {
  return page.evaluate(async () => {
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const scroller = document.querySelector('.feed-scroll');
    if (!scroller) throw new Error('no .feed-scroll');

    const seen = new Map<string, { titleLines: number; actionsOverflow: number }>();
    for (let y = 0; y <= scroller.scrollHeight; y += 200) {
      scroller.scrollTop = y;
      await sleep(60);
      for (const card of document.querySelectorAll('article.work-card')) {
        const title = card.querySelector('.title') as HTMLElement | null;
        const actions = card.querySelector('.actions') as HTMLElement | null;
        if (!title || !actions) continue;
        const key = title.textContent?.trim() ?? '';
        if (!key || seen.has(key)) continue;

        const lineHeight = Number.parseFloat(getComputedStyle(title).lineHeight);
        seen.set(key, {
          // Visible height of the title box, in line boxes.
          titleLines: title.clientHeight / lineHeight,
          // How far the action row sits below the card's own bottom edge.
          actionsOverflow:
            actions.getBoundingClientRect().bottom - card.getBoundingClientRect().bottom,
        });
      }
    }
    return [...seen.entries()].map(([title, m]) => ({ title, ...m }));
  });
}

test('every feed card title renders in whole lines, never a clipped part-line', async ({
  page,
}) => {
  await page.setViewportSize(PHONE);
  await openFeed(page);

  const cards = await measureEveryCard(page);
  expect(cards.length).toBeGreaterThan(1);

  const squashed = cards
    .filter(({ titleLines }) => Math.abs(titleLines - Math.round(titleLines)) > 0.08)
    .map(({ title, titleLines }) => `${title} (${titleLines.toFixed(2)} lines)`);
  expect(squashed, 'titles squashed to a part-line by the flex column').toEqual([]);

  // The clamp bounds the title at two lines; anything taller means the card's
  // height is no longer predictable from its content.
  const overTall = cards
    .filter(({ titleLines }) => titleLines > 2.08)
    .map(({ title, titleLines }) => `${title} (${titleLines.toFixed(2)} lines)`);
  expect(overTall, 'titles past the two-line clamp').toEqual([]);
});

test('feed card content stays inside the card at phone width', async ({ page }) => {
  await page.setViewportSize(PHONE);
  await openFeed(page);

  const cards = await measureEveryCard(page);
  const spilling = cards
    .filter(({ actionsOverflow }) => actionsOverflow > 1)
    .map(({ title, actionsOverflow }) => `${title} (+${actionsOverflow.toFixed(0)}px)`);
  expect(spilling, 'action rows pushed past the card edge').toEqual([]);
});
