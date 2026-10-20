import { expect, test } from '@playwright/test';
import { TRIP, openApp, pretendToday, tabBar } from './helpers';

test.describe('a first-time traveller on 27 September, in Rome', () => {
  test.beforeEach(async ({ page }) => {
    await pretendToday(page, '2026-09-27');
  });

  test('opens straight onto the trip, with the route grouped by country', async ({ page }) => {
    await page.goto('./');
    await expect(page).toHaveURL(new RegExp(`/t/${TRIP}$`));
    await expect(page.getByText('How this app works')).toBeVisible();

    const countries = page.getByRole('heading', {
      name: /^(Italy|Switzerland|France|Netherlands)$/,
    });
    await expect(countries).toHaveText(['Italy', 'Switzerland', 'France', 'Netherlands']);
    await expect(page.getByText('You are here')).toBeVisible();
    await expect(page.getByText(/Frecciarossa 08:35/)).toBeVisible();
  });

  test('moves between the four tabs and marks the current one', async ({ page }) => {
    await page.goto(`t/${TRIP}`);
    const bar = tabBar(page);
    for (const [tab, url] of [
      ['Today', /\/days\/europe-2026-d02$/],
      ['Wallet', /\/bookings$/],
      ['More', /\/more$/],
      ['Trip', new RegExp(`/t/${TRIP}$`)],
    ] as const) {
      await bar.getByRole('link', { name: tab }).click();
      await expect(page).toHaveURL(url);
      await expect(bar.getByRole('link', { name: tab })).toHaveAttribute('aria-current', 'page');
    }
  });

  test('shows today with next up, tonight, and the day in parts', async ({ page }) => {
    await page.goto(`t/${TRIP}/today`);
    await expect(page.getByRole('heading', { name: 'Rome', level: 1 })).toBeVisible();
    await expect(page.getByText(/Night 2 of 3/)).toBeVisible();
    await expect(page.getByText('Hotel Visconti Suites by FNA Hospitality').first()).toBeVisible();

    const morning = page.locator('section').filter({
      has: page.getByRole('heading', { name: 'Morning' }),
    });
    await expect(morning.getByText('Colosseum', { exact: true })).toBeVisible();
    // Local hops are connectors between stops, not rows of their own.
    await expect(page.getByText(/Bus \d+ min/).first()).toBeVisible();
  });

  test('steps to the next and previous day', async ({ page }) => {
    await page.goto(`t/${TRIP}/days/${TRIP}-d02`);
    await page.getByRole('link', { name: 'Next day' }).click();
    await expect(page).toHaveURL(/europe-2026-d03$/);
    await expect(page.getByText(/Monday 28 September/)).toBeVisible();
    await page.getByRole('link', { name: 'Previous day' }).click();
    await expect(page).toHaveURL(/europe-2026-d02$/);
  });

  test('filters the wallet to hotels', async ({ page }) => {
    await page.goto(`t/${TRIP}/bookings`);
    await expect(page.getByRole('heading', { name: 'Wallet', level: 1 })).toBeVisible();
    await page.getByRole('button', { name: /^Hotels/ }).click();
    await expect(page).toHaveURL(/category=stay/);
    await expect(page.getByText('Hotel Baslertor, Lucerne')).toBeVisible();
    await expect(page.getByText('Frecciarossa, Rome to Florence')).toHaveCount(0);
  });

  test('opens a train ticket that leads with its times', async ({ page }) => {
    await page.goto(`t/${TRIP}/bookings/bk-rail-par-bru`);
    await expect(page.getByRole('heading', { name: /Paris.*Brussels/, level: 1 })).toBeVisible();
    await expect(page.getByText('06:49', { exact: true })).toBeVisible();
    await expect(page.getByText('08:14', { exact: true })).toBeVisible();
    await expect(page.getByText(/Return: 13:13/)).toBeVisible();
  });

  test('opens a hotel with its check-in and check-out', async ({ page }) => {
    await page.goto(`t/${TRIP}/bookings/bk-hotel-milan`);
    await expect(page.getByText(/check.?in/i).first()).toBeVisible();
    await expect(page.getByText('15:00').first()).toBeVisible();
    await expect(page.getByText('Via Luigi Galvani 15, 20124 Milan')).toBeVisible();
  });

  test('offers one-tap 112 from More', async ({ page }) => {
    await page.goto(`t/${TRIP}/more`);
    await expect(page.getByRole('link', { name: '112' })).toHaveAttribute('href', 'tel:112');
  });
});

test('the guide for first-time visitors is one tap from the trip', async ({ page }) => {
  await openApp(page);
  await page.getByRole('link', { name: /New to Europe/ }).click();
  await expect(page).toHaveURL(/\/guide$/);
  await expect(page.getByText('City notes')).toBeVisible();
});
