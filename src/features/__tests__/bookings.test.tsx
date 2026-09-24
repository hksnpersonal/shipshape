/**
 * The redesigned Wallet board and detail screen: category filtering and the still-to-book
 * status filter that both survive the URL, pass cards for what's coming up next, and a
 * detail layout shaped by what the booking actually is - a ticket, a stay, or plain facts.
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { AppShell } from '@/app/AppShell';
import { db } from '@/db/db';
import { importTrip } from '@/db/transfer';
import { europe2026 } from '@/seed/europe-2026';
import { BK } from '@/seed/europe-2026/ids';
import { bookingsRepo, documentsRepo, settingsRepo } from '@/db/repo';
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
    await screen.findByRole('heading', { name: 'Wallet' });

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
    await screen.findByRole('heading', { name: 'Wallet' });

    const transportChip = screen.getByRole('button', { name: /Transport/ });
    expect(transportChip).toHaveAttribute('aria-pressed', 'true');

    const hotelsChip = screen.getByRole('button', { name: /Hotels/ });
    expect(hotelsChip).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('the Wallet board still-to-book strip', () => {
  it('shows only to-book bookings once ?status=to_book is followed', async () => {
    renderAt(`/t/${TRIP}/bookings`);
    await screen.findByRole('heading', { name: 'Wallet' });

    const user = userEvent.setup();
    await user.click(screen.getByText(/still to book/));

    const toBookTitles = europe2026.bundle.bookings
      .filter((b) => b.status === 'to_book')
      .map((b) => b.title);
    expect(toBookTitles.length).toBeGreaterThan(0);

    for (const title of toBookTitles) {
      expect(await screen.findByText(title)).toBeInTheDocument();
    }
    // Nothing already booked leaks into the filtered view.
    const booked = europe2026.bundle.bookings.find((b) => b.status === 'booked');
    if (booked) expect(screen.queryByText(booked.title)).not.toBeInTheDocument();
  });
});

describe('the Wallet board next-up pass cards', () => {
  it('shows the next 3 upcoming bookings as pass cards, in date order', async () => {
    await settingsRepo.patch({ simulatedToday: '2026-09-27' });
    renderAt(`/t/${TRIP}/bookings`);
    await screen.findByRole('heading', { name: 'Wallet' });

    const expectedTitles = europe2026.bundle.bookings
      .filter(
        (b) =>
          // Held bookings only: a buy-on-the-day sight is not a ticket card.
          (b.status === 'booked' || b.status === 'confirmed') && b.date >= '2026-09-27',
      )
      .sort(
        (a, b) => a.date.localeCompare(b.date) || (a.depart ?? '').localeCompare(b.depart ?? ''),
      )
      .slice(0, 3)
      .map((b) => b.title);
    expect(expectedTitles).toHaveLength(3);

    const nextUpHeading = await screen.findByText('Next up');
    const nextUpSection = nextUpHeading.closest('div') as HTMLElement;
    const cards = within(nextUpSection).getAllByRole('link');
    expect(cards).toHaveLength(3);
    cards.forEach((card, index) => {
      expect(card).toHaveTextContent(expectedTitles[index] as string);
    });
  });
});

describe('the booking detail layout', () => {
  it('shows the reference masked, then reveals it, before the status controls', async () => {
    const BOOKING_ID = BK.frecciarossaRomFlr;
    await bookingsRepo.patch(BOOKING_ID, { reference: 'PNR-9490' });
    renderAt(`/t/${TRIP}/bookings/${BOOKING_ID}`);
    await screen.findByRole('heading', { name: 'Rome → Florence' });

    // Masked by default - the raw reference is nowhere in the document until asked for.
    expect(screen.queryByText('PNR-9490')).not.toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Show reference' }));

    const reference = await screen.findByText('PNR-9490');
    const statusHeading = screen.getByText('Change booking status');
    const copyButton = screen.getByRole('button', { name: 'Copy reference' });

    // DOM order, not visibility: the status controls sit inside a collapsed disclosure
    // further down the page, regardless of whether it happens to be open.
    expect(
      reference.compareDocumentPosition(statusHeading) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      reference.compareDocumentPosition(copyButton) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('masks a reference until the eye button reveals it', async () => {
    const BOOKING_ID = BK.trenitaliaMilChiasso;
    await bookingsRepo.patch(BOOKING_ID, { reference: 'ABCD1234ZK' });
    renderAt(`/t/${TRIP}/bookings/${BOOKING_ID}`);
    await screen.findByRole('heading', { name: 'Milan → Chiasso' });

    expect(screen.queryByText('ABCD1234ZK')).not.toBeInTheDocument();
    expect(screen.getByText(/••/)).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Show reference' }));
    expect(screen.getByText('ABCD1234ZK')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Hide reference' }));
    expect(screen.queryByText('ABCD1234ZK')).not.toBeInTheDocument();
  });

  it('shows a hotel check-in time in the stay card', async () => {
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
    await screen.findByRole('heading', { name: 'Milan → Chiasso' });

    expect(screen.queryByText(/Non-refundable/i)).not.toBeInTheDocument();
    // The plain-words refund line reads the fact straight off the booking.
    expect(screen.getByText('Refundable, can be changed.')).toBeInTheDocument();
  });

  it('shows per-person seats on a transport ticket', async () => {
    const BOOKING_ID = BK.frecciarossaRomFlr;
    await bookingsRepo.patch(BOOKING_ID, {
      passengers: [
        { name: 'Alex Henson', coach: '5', seat: '74' },
        { name: 'Erfinna', coach: '5', seat: '73' },
      ],
    });
    renderAt(`/t/${TRIP}/bookings/${BOOKING_ID}`);
    await screen.findByRole('heading', { name: 'Rome → Florence' });

    expect(screen.getByText('Alex Henson')).toBeInTheDocument();
    expect(screen.getByText('Coach 5 · Seat 74')).toBeInTheDocument();
    expect(screen.getByText('Erfinna')).toBeInTheDocument();
    expect(screen.getByText('Coach 5 · Seat 73')).toBeInTheDocument();
  });

  it('opens the single attached document straight from "Show tickets"', async () => {
    vi.spyOn(window, 'open').mockReturnValue(null);
    const BOOKING_ID = BK.frecciarossaRomFlr;
    await documentsRepo.attach(TRIP, new Blob(['x'], { type: 'application/pdf' }), {
      name: 'frecciarossa-ticket.pdf',
      attachedTo: { kind: 'booking', id: BOOKING_ID },
    });

    renderAt(`/t/${TRIP}/bookings/${BOOKING_ID}`);
    await screen.findByRole('heading', { name: 'Rome → Florence' });

    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Show tickets (1)' }));

    expect(window.open).toHaveBeenCalledWith('', '_blank');
  });
});
