import { expect, test } from '@playwright/test';
import { TRIP, openApp, pretendToday } from './helpers';

test('a ticked item stays ticked after the app is reopened', async ({ page }) => {
  await pretendToday(page, '2026-09-27');
  await page.goto(`t/${TRIP}/days/${TRIP}-d02`);
  await page.getByRole('button', { name: 'Edit day' }).click();
  await page.getByRole('button', { name: 'Mark as done' }).first().click();
  await expect(page.getByRole('button', { name: 'Mark as still to do' })).toHaveCount(1);

  await page.reload();
  await page.getByRole('button', { name: 'Edit day' }).click();
  await expect(page.getByRole('button', { name: 'Mark as still to do' })).toHaveCount(1);
});

test('a booking added in the wallet is still there after a reload', async ({ page }) => {
  await openApp(page);
  await page.goto(`t/${TRIP}/bookings`);
  await page.getByRole('button', { name: /New/ }).click();
  await page.getByPlaceholder('Frecciarossa to Florence').fill('Bike tour in Amsterdam');
  await page.locator('input[type="date"]').first().fill('2026-10-16');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByText('Bike tour in Amsterdam').first()).toBeVisible();

  await page.reload();
  await expect(page.getByText('Bike tour in Amsterdam').first()).toBeVisible();
});

test('a decision in Plan check is remembered', async ({ page }) => {
  await openApp(page);
  await page.goto(`t/${TRIP}/conflicts`);
  const title = 'To review: Rome to Florence arrives 10:11, not 10:00';
  const card = page
    .locator('div')
    .filter({ hasText: title })
    .filter({
      has: page.getByRole('button', { name: 'Sorted' }),
    });
  await card.last().getByRole('button', { name: 'Sorted' }).click();
  await expect(page.getByText(title)).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Plan check', level: 1 })).toBeVisible();
  await expect(page.getByText(title)).toHaveCount(0);
});

test('a document filed in the vault opens and survives a reload', async ({ page, context }) => {
  await openApp(page);
  await page.goto(`t/${TRIP}/documents`);
  await page.getByLabel('Add a document').setInputFiles({
    name: 'ferry-ticket.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4\n% test ticket\n'),
  });
  await expect(page.getByText('ferry-ticket.pdf').first()).toBeVisible();

  const [tab] = await Promise.all([
    context.waitForEvent('page'),
    // The whole row opens the file; the small trash button beside it is named Remove.
    page.getByRole('button', { name: /ferry-ticket\.pdf.*Open/ }).click(),
  ]);
  expect(tab).toBeTruthy();

  await page.reload();
  await expect(page.getByText('ferry-ticket.pdf').first()).toBeVisible();
});

test('the trip can be exported as a file', async ({ page }) => {
  await openApp(page);
  await page.goto('settings');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /Export the itinerary only/ }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.shipshape\.json$/);
});
