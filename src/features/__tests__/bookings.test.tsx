/**
 * The redesigned bookings board and detail screen: category filtering that survives the
 * URL, and a detail layout that puts the reference and key facts ahead of the status
 * controls and the playbook marketing.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { AppShell } from '@/app/AppShell';
import { db } from '@/db/db';
import { importTrip } from '@/db/transfer';
import { europe2026 } from '@/seed/europe-2026';
import { BK } from '@/seed/europe-2026/ids';
import { bookingsRepo, settingsRepo } from '@/db/repo';
import { BookingDetailPage, BookingsBoardPage } from '@/features/BookingPages';

const TRIP = europe2026.bundle.trip.id;

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: <AppShell />,
        children: [
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

describe('the bookings board category filter', () => {
  it('filters to hotels only, matching the eight hotels in the seed', async () => {
    renderAt(`/t/${TRIP}/bookings`);
    await screen.findByRole('heading', { name: 'Bookings' });

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Hotels/ }));

    // Every visible booking row is a link into its detail screen; eight hotels in the
    // seed means eight links once the filter is applied.
    const rows = screen
      .getAllByRole('link')
      .filter((link) => link.getAttribute('href')?.includes('/bookings/'));
    expect(rows).toHaveLength(8);
  });

  it('preselects Transport from the ?category=transport URL', async () => {
    renderAt(`/t/${TRIP}/bookings?category=transport`);
    await screen.findByRole('heading', { name: 'Bookings' });

    const transportChip = screen.getByRole('button', { name: /Transport/ });
    expect(transportChip).toHaveAttribute('aria-pressed', 'true');

    const hotelsChip = screen.getByRole('button', { name: /Hotels/ });
    expect(hotelsChip).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('the booking detail layout', () => {
  it('shows the reference and a Copy button before the status controls', async () => {
    const BOOKING_ID = BK.frecciarossaRomFlr;
    await bookingsRepo.patch(BOOKING_ID, { reference: 'PNR-9490' });
    renderAt(`/t/${TRIP}/bookings/${BOOKING_ID}`);
    await screen.findByRole('heading', { name: 'Frecciarossa, Rome to Florence' });

    const reference = await screen.findByText('PNR-9490');
    const statusHeading = screen.getByText('Change booking status');
    const copyButton = screen.getByRole('button', { name: 'Copy' });

    // DOM order, not visibility: the status controls sit inside a collapsed disclosure
    // further down the page, regardless of whether it happens to be open.
    expect(
      reference.compareDocumentPosition(statusHeading) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      reference.compareDocumentPosition(copyButton) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('shows a hotel check-in time in the key facts', async () => {
    const BOOKING_ID = BK.hotelFlorence;
    renderAt(`/t/${TRIP}/bookings/${BOOKING_ID}`);
    await screen.findByRole('heading', { name: "Sant'Antonino First Floor Relais, Florence" });

    expect(screen.getByText(/14:00/)).toBeInTheDocument();
  });

  it('does not call a refundable booking "Non-refundable", even when its guide would', async () => {
    // Trenitalia, Milan to Chiasso is refundable, but the Trenitalia high-speed guide it
    // matches has generic refund rules that say "not refundable" for the cheapest fare -
    // the override exists precisely so those two facts do not contradict each other.
    const BOOKING_ID = BK.trenitaliaMilChiasso;
    renderAt(`/t/${TRIP}/bookings/${BOOKING_ID}`);
    await screen.findByRole('heading', { name: 'Trenitalia, Milan to Chiasso' });

    expect(screen.queryByText(/Non-refundable/i)).not.toBeInTheDocument();
    // The plain-words refund line reads the fact straight off the booking.
    expect(screen.getByText('Refundable, can be changed.')).toBeInTheDocument();
  });
});
