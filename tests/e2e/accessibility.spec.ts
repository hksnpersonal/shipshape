import { expect, test } from '@playwright/test';
import { TRIP, pretendToday, tabBar } from './helpers';

const SCREENS = [
  ['Trip', `t/${TRIP}`],
  ['Today', `t/${TRIP}/days/${TRIP}-d02`],
  ['Wallet', `t/${TRIP}/bookings`],
  ['Ticket', `t/${TRIP}/bookings/bk-rail-par-bru`],
  ['Hotel', `t/${TRIP}/bookings/bk-hotel-rome`],
  ['More', `t/${TRIP}/more`],
  ['Plan check', `t/${TRIP}/conflicts`],
  ['Documents', `t/${TRIP}/documents`],
] as const;

test.describe('every screen at phone width', () => {
  test.beforeEach(async ({ page }) => {
    await pretendToday(page, '2026-09-27');
  });

  for (const [name, path] of SCREENS) {
    test(`${name}: no sideways scrolling, and every button has a name`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator('h1').first()).toBeVisible();

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, 'page scrolls sideways').toBeLessThanOrEqual(0);

      const unnamed = await page.evaluate(() =>
        [...document.querySelectorAll('button, a[href]')]
          .filter((el) => (el as HTMLElement).offsetParent !== null)
          .filter((el) => {
            const label = el.getAttribute('aria-label') ?? '';
            const text = (el.textContent ?? '').trim();
            return !label && !text;
          })
          .map((el) => el.outerHTML.slice(0, 120)),
      );
      expect(unnamed, 'buttons or links with no accessible name').toEqual([]);
    });
  }
});

test('the tab bar targets are big enough to hit with a thumb', async ({ page }) => {
  await pretendToday(page, '2026-09-27');
  await page.goto(`t/${TRIP}`);
  for (const link of await tabBar(page).getByRole('link').all()) {
    const box = await link.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  }
});

test('the tabs can be reached and followed from the keyboard', async ({ page, browserName }) => {
  // WebKit only tabs to links when "Press Tab to highlight each item" is switched on.
  test.skip(browserName === 'webkit', 'Safari skips links on Tab by default');
  await pretendToday(page, '2026-09-27');
  await page.goto(`t/${TRIP}`);
  const wallet = tabBar(page).getByRole('link', { name: 'Wallet' });
  for (let i = 0; i < 60 && !(await wallet.evaluate((el) => el === document.activeElement)); i++) {
    await page.keyboard.press('Tab');
  }
  await expect(wallet).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/bookings$/);
});
