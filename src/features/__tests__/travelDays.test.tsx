/**
 * The app on the days it will actually be opened: mid-trip, on a day trip, and after the
 * flight home. Found by driving the real app with a simulated date.
 */
import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { db } from '@/db/db';
import { importTrip } from '@/db/transfer';
import { settingsRepo } from '@/db/repo';
import { europe2026 } from '@/seed/europe-2026';
import { DayTimelinePage } from '@/features/DayPages';
import { TodayRedirectPage, TripHomePage } from '@/features/TripPages';

const TRIP = europe2026.bundle.trip.id;

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      { path: 't/:tripId', element: <TripHomePage /> },
      { path: 't/:tripId/today', element: <TodayRedirectPage /> },
      { path: 't/:tripId/days/:dayId', element: <DayTimelinePage /> },
    ],
    { initialEntries: [path] },
  );
  return render(<RouterProvider router={router} />);
}

beforeEach(async () => {
  await db.delete();
  await db.open();
  await importTrip(europe2026, { mode: 'replace' });
  localStorage.clear();
});

describe('the countdown on the trip home', () => {
  it('numbers days the way the Days list and the notes do', async () => {
    await settingsRepo.patch({ simulatedToday: '2026-09-26' });
    renderAt(`/t/${TRIP}`);
    expect(await screen.findByText('Day 1 of 22')).toBeInTheDocument();
  });

  it('says the trip is on its way home, then finished, rather than day 0', async () => {
    await settingsRepo.patch({ simulatedToday: '2026-10-18' });
    const { unmount } = renderAt(`/t/${TRIP}`);
    expect(await screen.findByText('On the way home')).toBeInTheDocument();
    unmount();

    await settingsRepo.patch({ simulatedToday: '2026-10-19' });
    renderAt(`/t/${TRIP}`);
    expect(await screen.findByText('Trip finished')).toBeInTheDocument();
    expect(screen.queryByText(/Day 0/)).not.toBeInTheDocument();
  });
});

describe('the Today button after the trip', () => {
  it('lands on the last day, not the first', async () => {
    await settingsRepo.patch({ simulatedToday: '2026-10-19' });
    renderAt(`/t/${TRIP}/today`);
    expect(await screen.findByText('Sat 17 Oct')).toBeInTheDocument();
  });
});

describe('the Brussels day summary', () => {
  it('names the Eurostar as the journey, and lists tickets in departure order', async () => {
    await settingsRepo.patch({ simulatedToday: '2026-10-14' });
    renderAt(`/t/${TRIP}/days/${TRIP}-d19`);

    expect(await screen.findByText(/Paris → Brussels by train 06:49/)).toBeInTheDocument();
    expect(screen.queryByText(/by walk/)).not.toBeInTheDocument();

    const tickets = screen.getByText('Tickets today').parentElement as HTMLElement;
    const times = within(tickets)
      .getAllByRole('link')
      .map((link) => link.textContent ?? '');
    expect(times[0]).toContain('06:49');
    expect(times[1]).toContain('13:13');
  }, 15000);
});
