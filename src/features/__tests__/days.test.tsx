/**
 * The redesigned day timeline: a summary card that answers "where do I sleep" and "what's
 * already booked" without scrolling, items grouped by time of day, and every edit control
 * (done/skip/move, the tag filter, add an item) tucked behind an explicit "Edit day" toggle
 * so the default view stays short enough to read standing up.
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
import { BookingDetailPage, BookingsBoardPage } from '@/features/BookingPages';
import { DayTimelinePage, ItemDetailPage } from '@/features/DayPages';

const TRIP = europe2026.bundle.trip.id;

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: <AppShell />,
        children: [
          { path: 't/:tripId/days/:dayId', element: <DayTimelinePage /> },
          { path: 't/:tripId/items/:itemId', element: <ItemDetailPage /> },
          { path: 't/:tripId/bookings', element: <BookingsBoardPage /> },
          { path: 't/:tripId/bookings/:bookingId', element: <BookingDetailPage /> },
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
  await settingsRepo.patch({ simulatedToday: '2026-09-04' });
});

describe('the day summary card', () => {
  it("shows tonight's hotel and groups the day by time, with edit controls hidden", async () => {
    renderAt(`/t/${TRIP}/days/${TRIP}-d02`);

    expect(await screen.findByText(/Tonight:.*Hotel Visconti/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Morning' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Afternoon' })).toBeInTheDocument();

    // Edit machinery - move, tag filter - stays out of sight until asked for.
    expect(screen.queryByRole('button', { name: 'Move earlier' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Move later' })).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Filter this day by tag' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add an item' })).not.toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Edit day' }));

    expect(await screen.findAllByRole('button', { name: 'Move earlier' })).not.toHaveLength(0);
    expect(screen.getByRole('group', { name: 'Filter this day by tag' })).toBeInTheDocument();
    // Role queries over a full real day are slow in jsdom, not in a browser.
  }, 15000);

  it('lists the booked restaurant under Tickets today', async () => {
    renderAt(`/t/${TRIP}/days/${TRIP}-d02`);
    await screen.findByText(/Tonight:/);
    // Scoped to the Tickets today block: the day's items also mention Roscioli by name
    // ("Lunch at Roscioli..."), so an unscoped query would match both.
    const ticketsHeading = screen.getByText('Tickets today');
    const ticketsSection = ticketsHeading.closest('div') as HTMLElement;
    const ticket = within(ticketsSection).getByRole('link', { name: /Roscioli/ });
    expect(ticket).toHaveTextContent('12:30');
  });

  it('shows both the checkout and the new check-in on a travel day', async () => {
    renderAt(`/t/${TRIP}/days/${TRIP}-d04`);
    expect(await screen.findByText(/Check out by 10:00/)).toBeInTheDocument();
    expect(screen.getByText(/Tonight:.*Sant'Antonino/)).toBeInTheDocument();
    expect(screen.getByText(/check-in from 14:00/)).toBeInTheDocument();
  });

  it('shows the move on a day that changes city', async () => {
    renderAt(`/t/${TRIP}/days/${TRIP}-d06`);
    expect(await screen.findByText(/Florence.*Venice.*by train 08:39/)).toBeInTheDocument();
  });
});

describe('plain-word chips on a compact row', () => {
  it('reads "Must do" rather than the raw tag code', async () => {
    renderAt(`/t/${TRIP}/days/${TRIP}-d02`);
    await screen.findByText(/Tonight:/);
    expect((await screen.findAllByText('Must do')).length).toBeGreaterThan(0);
  });

  it('reads "Booked" for an item linked to a confirmed booking', async () => {
    renderAt(`/t/${TRIP}/days/${TRIP}-d02`);
    await screen.findByText(/Tonight:/);
    expect(screen.getAllByText('Booked').length).toBeGreaterThan(0);
  });
});

describe('day navigation', () => {
  it('moves to the next and previous day from the arrows', async () => {
    renderAt(`/t/${TRIP}/days/${TRIP}-d02`);
    await screen.findByText(/Tonight:/);

    const user = userEvent.setup();
    await user.click(screen.getByRole('link', { name: 'Next day' }));
    expect(
      await screen.findByText('Wear clothing that meets the Vatican dress code'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Previous day' }));
    expect(await screen.findByText(/Tonight:.*Hotel Visconti/)).toBeInTheDocument();
  });
});

describe('the item detail page', () => {
  it('puts the category icon and time at the top', async () => {
    const itemId = `${TRIP}-d01-i01`; // "Arrive Rome Fiumicino", time 14:10
    renderAt(`/t/${TRIP}/items/${itemId}`);
    await screen.findByText('Arrive Rome Fiumicino');

    const header = screen.getByText('14:10').closest('div');
    expect(header).not.toBeNull();
    expect(within(header as HTMLElement).getByText('Transport')).toBeInTheDocument();
  });
});
