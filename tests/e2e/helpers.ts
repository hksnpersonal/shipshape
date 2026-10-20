import { expect, type Page } from '@playwright/test';

export const TRIP = 'europe-2026';

/** Opens the app and waits for the sample trip to finish loading on first run. */
export async function openApp(page: Page): Promise<void> {
  await page.goto('./');
  // First launch loads the sample trip into storage; WebKit on Windows is slow at it.
  await expect(page).toHaveURL(new RegExp(`/t/${TRIP}$`), { timeout: 45_000 });
  await expect(page.getByRole('heading', { name: 'Europe 2026', level: 1 })).toBeVisible();
}

/**
 * Pins "today" with the app's own setting, so a test reads the same on any real date.
 * Leaves the page on Settings.
 */
export async function pretendToday(page: Page, date: string): Promise<void> {
  await openApp(page);
  await page.goto('settings');
  await page.locator('input[type="date"]').fill(date);
  await expect(page.locator('input[type="date"]')).toHaveValue(date);
}

/** The bottom tab bar (the phone one; the side rail is hidden at phone width). */
export function tabBar(page: Page) {
  return page.getByRole('navigation', { name: 'Main' }).filter({ visible: true });
}
