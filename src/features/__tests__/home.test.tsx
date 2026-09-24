/**
 * The redesigned trip home: the whole route, grouped by country, with the welcome card,
 * the missing-documents nudge and the guide link kept compact below it. Covers the route
 * grouping and connectors, the "You are here" marker, the welcome card's dismissal, and
 * the one-trip redirect from "/".
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
import { TripHomePage, TripsListPage } from '@/features/TripPages';

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

describe('the route', () => {
  beforeEach(async () => {
    await settingsRepo.patch({ simulatedToday: '2026-09-04' });
  });

  it('groups stops under one country heading each, in the order the trip visits them', async () => {
    renderHome();
    const headings = await screen.findAllByRole('heading', { level: 2 });
    const countries = headings
      .map((h) => h.textContent)
      .filter((text): text is string =>
        ['Italy', 'Switzerland', 'France', 'Netherlands'].includes(text ?? ''),
      );
    expect(countries).toEqual(['Italy', 'Switzerland', 'France', 'Netherlands']);
  });

  it('lists one stop per hotel, in order, each with its dates and nights', async () => {
    renderHome();
    await screen.findByText('Italy');

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
      expect(screen.getByText(city)).toBeInTheDocument();
    }

    // Presence is not enough - the whole point of the route is the order.
    const main = screen.getByText('Italy').closest('main') ?? document.body;
    const text = main.textContent ?? '';
    const positions = stops.map((city) => text.indexOf(city));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));

    expect(screen.getByText('26–29 Sep · 3 nights')).toBeInTheDocument();
    expect(screen.getByText('Hotel Visconti Suites by FNA Hospitality')).toBeInTheDocument();
    expect(
      screen.getByText(/Hotel Central Station Apartment · day trip to Varenna/),
    ).toBeInTheDocument();
  });

  it('does not turn a day trip into a stop of its own', async () => {
    renderHome();
    await screen.findByText('Italy');

    // Varenna and Brussels are days out from a hotel that doesn't change.
    expect(screen.queryByText('Varenna')).not.toBeInTheDocument();
    expect(screen.queryByText('Brussels')).not.toBeInTheDocument();
  });

  it('shows the leg between two stops', async () => {
    renderHome();
    expect(await screen.findByText(/Frecciarossa 08:35/)).toBeInTheDocument();
  });

  it('shows the flight in at the start of the route and the flight home at the end', async () => {
    renderHome();
    expect(await screen.findByText('Fly in · lands 14:10')).toBeInTheDocument();
    expect(
      screen.getByText('Thai Airways 14:15 Sat 17 · lands Sydney 21:30 Sun 18'),
    ).toBeInTheDocument();
  });
});

describe('"You are here"', () => {
  it('marks the stop covering today, and no other', async () => {
    await settingsRepo.patch({ simulatedToday: '2026-09-27' });
    renderHome();

    const rome = await screen.findByRole('link', { name: /Rome/ });
    expect(within(rome).getByText('You are here')).toBeInTheDocument();

    const florence = screen.getByRole('link', { name: /Florence/ });
    expect(within(florence).queryByText('You are here')).not.toBeInTheDocument();
  });
});

describe('the welcome card', () => {
  it('dismisses and stays dismissed', async () => {
    const user = userEvent.setup();
    await settingsRepo.patch({ simulatedToday: '2026-09-04' });
    renderHome();

    expect(await screen.findByText('How this app works')).toBeInTheDocument();
    expect(screen.getByText('Trip is the whole route.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByText('How this app works')).not.toBeInTheDocument();

    // The preference is remembered, not merely reset for this render.
    expect(localStorage.getItem('shipshape:home-welcome-dismissed')).toBe('1');
  });

  it('stays away on a later visit once it was dismissed', async () => {
    localStorage.setItem('shipshape:home-welcome-dismissed', '1');
    await settingsRepo.patch({ simulatedToday: '2026-09-04' });
    renderHome();

    await screen.findByText('Italy');
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

describe('the trips list', () => {
  it('redirects straight to the trip when there is exactly one', async () => {
    const router = createMemoryRouter(
      [
        { path: '/', element: <TripsListPage /> },
        { path: '/t/:tripId', element: <TripHomePage /> },
      ],
      { initialEntries: ['/'] },
    );
    render(<RouterProvider router={router} />);

    expect(await screen.findByText('Europe 2026')).toBeInTheDocument();
    expect(screen.getByText('Italy')).toBeInTheDocument();
  });
});
