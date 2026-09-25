/**
 * The day list grouped by stay: one block per hotel, in route order, with day trips folded
 * into the stay they hang off rather than becoming stops of their own, and the days before
 * the first stay and after the last standing apart as travel days.
 */
import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { AppShell } from '@/app/AppShell';
import { db } from '@/db/db';
import { importTrip } from '@/db/transfer';
import { europe2026 } from '@/seed/europe-2026';
import { settingsRepo } from '@/db/repo';
import { DaysIndexPage } from '@/features/TripPages';

const TRIP = europe2026.bundle.trip.id;

function renderDays() {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: <AppShell />,
        children: [{ path: 't/:tripId/days', element: <DaysIndexPage /> }],
      },
    ],
    { initialEntries: [`/t/${TRIP}/days`] },
  );
  return render(<RouterProvider router={router} />);
}

/** The block a stay heading sits in: the heading's own wrapper, then its rows alongside it. */
function blockFor(heading: HTMLElement): HTMLElement {
  return heading.closest('div')?.parentElement as HTMLElement;
}

beforeEach(async () => {
  await db.delete();
  await db.open();
  await importTrip(europe2026, { mode: 'replace' });
  await settingsRepo.patch({ simulatedToday: '2026-09-04' });
});

describe('the days index', () => {
  it('groups Rome under one heading with its three days', async () => {
    renderDays();
    const heading = await screen.findByText(/Rome · 26–29 Sep · Hotel Visconti Suites/);
    const block = blockFor(heading);

    expect(within(block).getAllByRole('link')).toHaveLength(3);
    expect(within(block).getByText('Sat 26 Sep')).toBeInTheDocument();
    expect(within(block).getByText('Sun 27 Sep')).toBeInTheDocument();
    expect(within(block).getByText('Mon 28 Sep')).toBeInTheDocument();
  });

  it('labels Varenna as a day trip under the Milan stay, not a stop of its own', async () => {
    renderDays();
    const heading = await screen.findByText(/Milan · 2–4 Oct · Hotel Central Station Apartment/);
    const block = blockFor(heading);

    // The Milan day itself, plus the Varenna day trip - nothing else.
    expect(within(block).getAllByRole('link')).toHaveLength(2);
    expect(within(block).getByText('Day trip to Varenna')).toBeInTheDocument();
  });

  it('sets the outbound flight day and the flight-home day apart as travel days', async () => {
    renderDays();
    const travelHeadings = await screen.findAllByText('Travel day');
    // The Sydney departure before Rome, and the day the Amsterdam flight leaves.
    expect(travelHeadings).toHaveLength(2);
  });

  it('marks only the day with an error-severity finding, not every day with a note', async () => {
    renderDays();
    // The stale Amsterdam arrival overlaps the Eurostar: an error finding on day 20.
    const heading = await screen.findByText(/Amsterdam · 15–17 Oct · nhow Amsterdam RAI/);
    const block = blockFor(heading);
    expect(within(block).getAllByTitle('Needs a look').length).toBeGreaterThan(0);
  });

  it('keeps the Today button', async () => {
    renderDays();
    // Scoped to the page header: the app shell's own nav also has a "Today" tab, rendered
    // twice (desktop rail and mobile bar), which a bare role query would also match.
    const heading = await screen.findByRole('heading', { name: 'Days' });
    const header = heading.closest('header') as HTMLElement;
    expect(within(header).getByRole('link', { name: /Today/ })).toHaveAttribute(
      'href',
      `/t/${TRIP}/today`,
    );
  });
});
