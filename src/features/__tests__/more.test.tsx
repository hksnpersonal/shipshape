/**
 * The More tab: the emergency numbers card, since it is the one place on the page with
 * conditional content (a trip file's own essentials, or the hardcoded 112 fallback), and
 * the trip-scoped Settings back link, since Settings is reachable both from More and from
 * the no-trip route and only one of those should offer a way back to it.
 */
import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { AppShell } from '@/app/AppShell';
import { db } from '@/db/db';
import { importTrip } from '@/db/transfer';
import { europe2026 } from '@/seed/europe-2026';
import { tripsRepo } from '@/db/repo';
import { MorePage } from '@/features/MorePages';
import { SettingsPage } from '@/features/InboxPages';

const TRIP = europe2026.bundle.trip.id;

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: <AppShell />,
        children: [
          { path: 't/:tripId/more', element: <MorePage /> },
          { path: 't/:tripId/settings', element: <SettingsPage /> },
          { path: 'settings', element: <SettingsPage /> },
        ],
      },
    ],
    { initialEntries: [path] },
  );
  return render(<RouterProvider router={router} />);
}

beforeEach(async () => {
  await db.delete();
  await db.open();
  await importTrip(europe2026, { mode: 'replace' });
});

describe('the More page', () => {
  it('offers the 112 emergency number even with no essentials on the trip', async () => {
    renderAt(`/t/${TRIP}/more`);
    const call = await screen.findByRole('link', { name: '112' });
    expect(call).toHaveAttribute('href', 'tel:112');
  });

  it('shows a tel: link for a phone essential, spaces stripped', async () => {
    await tripsRepo.patch(TRIP, {
      essentials: [
        { id: 'ess-1', label: 'Travel insurer', value: '+61 2 5550 1234', kind: 'phone' },
      ],
    });

    renderAt(`/t/${TRIP}/more`);
    await screen.findByText('Travel insurer');
    const call = screen.getByRole('link', { name: 'Call' });
    expect(call).toHaveAttribute('href', 'tel:+61255501234');
  });
});

describe('the Settings back link', () => {
  it('shows a way back to More when settings is reached from a trip', async () => {
    renderAt(`/t/${TRIP}/settings`);
    const main = await screen.findByRole('main');
    expect(within(main).getByRole('link', { name: /More/ })).toHaveAttribute(
      'href',
      `/t/${TRIP}/more`,
    );
  });

  it('offers no way back when settings has no trip to return to', async () => {
    renderAt('/settings');
    const main = await screen.findByRole('main');
    await within(main).findByRole('heading', { name: 'Settings' });
    expect(within(main).queryByRole('link', { name: /More/ })).not.toBeInTheDocument();
  });
});
