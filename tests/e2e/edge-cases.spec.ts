import { expect, test } from '@playwright/test';
import { TRIP, openApp, pretendToday } from './helpers';

test('before the trip it counts down, and Today opens the departure day', async ({ page }) => {
  await pretendToday(page, '2026-09-20');
  await page.goto(`t/${TRIP}`);
  await expect(page.getByText('Starts in 5 days')).toBeVisible();
  await page.goto(`t/${TRIP}/today`);
  await expect(page).toHaveURL(/europe-2026-d00$/);
});

test('the day after landing home says so, and never "Day 0"', async ({ page }) => {
  await pretendToday(page, '2026-10-18');
  await page.goto(`t/${TRIP}`);
  await expect(page.getByText('On the way home')).toBeVisible();
  await expect(page.getByText(/Day 0/)).toHaveCount(0);
});

test('after the trip, Today lands on the last day rather than the first', async ({ page }) => {
  await pretendToday(page, '2026-10-19');
  await page.goto(`t/${TRIP}`);
  await expect(page.getByText('Trip finished')).toBeVisible();
  await page.goto(`t/${TRIP}/today`);
  await expect(page).toHaveURL(/europe-2026-d22$/);
});

test('a day trip names the train, not the walk to the station', async ({ page }) => {
  await pretendToday(page, '2026-10-14');
  await page.goto(`t/${TRIP}/days/${TRIP}-d19`);
  await expect(page.getByText(/by train 06:49/)).toBeVisible();
  await expect(page.getByText(/by walk/)).toHaveCount(0);
});

test('a trip that is not on this device says so', async ({ page }) => {
  await openApp(page);
  await page.goto('t/not-a-trip');
  await expect(page.getByText('That trip is not on this device.')).toBeVisible();
});

test('a deep link opened cold still loads', async ({ page }) => {
  await page.goto(`t/${TRIP}/bookings/bk-hotel-rome`);
  await expect(page.getByText('Hotel Visconti Suites, Rome').first()).toBeVisible();
});

test('a search that matches nothing hides the rows, and treats markup as text', async ({
  page,
}) => {
  await openApp(page);
  await page.goto(`t/${TRIP}/documents`);
  // Search only appears once something is filed.
  await page.getByLabel('Add a document').setInputFiles({
    name: 'boat.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4\n'),
  });
  await expect(page.getByText('boat.pdf').first()).toBeVisible();

  let dialogs = 0;
  page.on('dialog', (dialog) => {
    dialogs += 1;
    void dialog.dismiss();
  });
  await page.getByLabel('Search documents').fill('<img src=x onerror=alert(1)>');
  await expect(page.getByText('boat.pdf')).toHaveCount(0);
  expect(dialogs).toBe(0);
});
