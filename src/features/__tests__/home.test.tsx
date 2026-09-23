/**
 * The redesigned trip home: a first-time traveller's overview rather than an auditor's
 * dashboard. Covers the route summary, the next-up card's "tonight" line, the welcome
 * card's dismissal, and the nav swap that dropped Inbox for Documents.
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { AppShell } from '@/app/AppShell';
import { db } from '@/db/db';
import { importTrip } from '@/db/transfer';
import { europe2026 } from '@/seed/europe-2026';
import { settingsRepo } from '@/db/repo';
import { TripHomePage } from '@/features/TripPages';

const TRIP = europe2026.bundle.trip.id;

function renderHome() {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: <AppShell />,
        children: [{ path: 't/:tripId', element: <TripHomePage /> }],
      },
    ],
    { initialEntries: [`/t/${TRIP}`] },
  );
  return render(<RouterProvider router={router} />);
}

beforeEach(async () => {
  await db.delete();
  await db.open();
  await importTrip(europe2026, { mode: 'replace' });
  localStorage.clear();
});

describe('the trip route', () => {
  beforeEach(async () => {
    await settingsRepo.patch({ simulatedToday: '2026-09-04' });
  });

  it('lists one stop per hotel, in order, each with its nights', async () => {
    renderHome();
    const route = (await screen.findByText('Your route')).closest('section') as HTMLElement;

    const stops = [
      'Rome',
      'Florence',
      'Venice',
      'Milan',
      'Lucerne',
      'Grindelwald',
      'Paris',
      'Amsterdam',
    ];
    for (const city of stops) {
      expect(within(route).getByText(city)).toBeInTheDocument();
    }

    // Presence is not enough - the whole point of the section is the order.
    const text = route.textContent ?? '';
    const positions = stops.map((city) => text.indexOf(city));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));

    // A couple of stops checked in full: dates, nights and the hotel actually booked.
    expect(
      within(route).getByText(/26–29 Sep · 3 nights · Hotel Visconti Suites/),
    ).toBeInTheDocument();
    expect(
      within(route).getByText(/7–11 Oct · 4 nights · Hotel Central Wolter/),
    ).toBeInTheDocument();

    // The connecting flight into the trip and the Rome-Florence train both show as legs.
    expect(within(route).getByText(/Flight · Turkish Airlines/)).toBeInTheDocument();
    expect(within(route).getByText(/Train · Frecciarossa/)).toBeInTheDocument();
  });

  it('does not turn a day trip into a stop of its own', async () => {
    renderHome();
    const route = (await screen.findByText('Your route')).closest('section') as HTMLElement;

    // Varenna, Brussels and Kandersteg are days out from a hotel that doesn't change.
    expect(within(route).queryByText('Varenna')).not.toBeInTheDocument();
    expect(within(route).queryByText('Brussels')).not.toBeInTheDocument();
    expect(within(route).queryByText('Kandersteg')).not.toBeInTheDocument();
  });
});

describe('the next-up card', () => {
  it("names tonight's hotel", async () => {
    // The first night on the ground, in Rome.
    await settingsRepo.patch({ simulatedToday: '2026-09-26' });
    renderHome();

    expect(await screen.findByText('Today')).toBeInTheDocument();
    expect(
      screen.getByText('Tonight: Hotel Visconti Suites by FNA Hospitality'),
    ).toBeInTheDocument();
  });
});

describe('the welcome card', () => {
  it('dismisses and stays dismissed', async () => {
    const user = userEvent.setup();
    await settingsRepo.patch({ simulatedToday: '2026-09-04' });
    renderHome();

    expect(await screen.findByText('How this app works')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByText('How this app works')).not.toBeInTheDocument();

    // The preference is remembered, not merely reset for this render.
    expect(localStorage.getItem('shipshape:home-welcome-dismissed')).toBe('1');
  });

  it('stays away on a later visit once it was dismissed', async () => {
    localStorage.setItem('shipshape:home-welcome-dismissed', '1');
    await settingsRepo.patch({ simulatedToday: '2026-09-04' });
    renderHome();

    await screen.findByText('Your route');
    expect(screen.queryByText('How this app works')).not.toBeInTheDocument();
  });

  it('still renders when storage throws', async () => {
    const original = window.localStorage.getItem;
    window.localStorage.getItem = () => {
      throw new Error('storage disabled');
    };
    await settingsRepo.patch({ simulatedToday: '2026-09-04' });
    try {
      renderHome();
      expect(await screen.findByText('How this app works')).toBeInTheDocument();
    } finally {
      window.localStorage.getItem = original;
    }
  });
});

describe('the trip nav', () => {
  it('offers Documents and has dropped Inbox', async () => {
    await settingsRepo.patch({ simulatedToday: '2026-09-04' });
    renderHome();

    const documentLinks = await screen.findAllByText('Documents');
    expect(
      documentLinks.some((el) => el.closest('a')?.getAttribute('href') === `/t/${TRIP}/documents`),
    ).toBe(true);
    expect(screen.queryByText('Inbox')).not.toBeInTheDocument();
  });
});
