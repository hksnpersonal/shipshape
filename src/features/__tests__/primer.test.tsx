/**
 * The "New to Europe?" primer: city notes render in the order the trip actually visits
 * them, search narrows the general tips, and the trip home offers one way in.
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { db } from '@/db/db';
import { importTrip } from '@/db/transfer';
import { europe2026 } from '@/seed/europe-2026';
import { settingsRepo } from '@/db/repo';
import { PrimerPage } from '@/features/PrimerPage';
import { TripHomePage } from '@/features/TripPages';

const TRIP = europe2026.bundle.trip.id;

function renderPrimer() {
  const router = createMemoryRouter([{ path: '/t/:tripId/guide', element: <PrimerPage /> }], {
    initialEntries: [`/t/${TRIP}/guide`],
  });
  return render(<RouterProvider router={router} />);
}

function renderHome() {
  const router = createMemoryRouter([{ path: '/t/:tripId', element: <TripHomePage /> }], {
    initialEntries: [`/t/${TRIP}`],
  });
  return render(<RouterProvider router={router} />);
}

beforeEach(async () => {
  await db.delete();
  await db.open();
  await importTrip(europe2026, { mode: 'replace' });
  await settingsRepo.patch({ simulatedToday: '2026-09-04' });
});

describe('the city notes', () => {
  it('puts Rome before Paris, following the trip route', async () => {
    renderPrimer();
    const cityNotes = (await screen.findByText('City notes')).closest('section') as HTMLElement;

    expect(within(cityNotes).getByText('Rome')).toBeInTheDocument();
    expect(within(cityNotes).getByText('Paris')).toBeInTheDocument();

    const text = cityNotes.textContent ?? '';
    expect(text.indexOf('Rome')).toBeLessThan(text.indexOf('Paris'));
  });
});

describe('search', () => {
  it('narrows the general tips and hides the rest', async () => {
    const user = userEvent.setup();
    renderPrimer();

    await screen.findByText('Trains');
    expect(screen.getByText('Tipping')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Search tips'), 'binario');

    expect(screen.getByText('Trains')).toBeInTheDocument();
    expect(screen.queryByText('Tipping')).not.toBeInTheDocument();
  });
});

describe('the trip home entry point', () => {
  it('links to the primer', async () => {
    renderHome();

    const link = await screen.findByText(/New to Europe\? Read this first/);
    expect(link.closest('a')).toHaveAttribute('href', `/t/${TRIP}/guide`);
  });
});
