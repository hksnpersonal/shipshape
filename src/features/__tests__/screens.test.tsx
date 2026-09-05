/**
 * Screen-level tests for the two interactions that matter most: stripping a day back to
 * essentials, and clearing something out of the inbox so it stays cleared.
 */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { AppShell } from '@/app/AppShell';
import { db } from '@/db/db';
import { importTrip } from '@/db/transfer';
import { europe2026 } from '@/seed/europe-2026';
import { documentsRepo, settingsRepo } from '@/db/repo';
import { BookingDetailPage } from '@/features/BookingPages';
import { DayTimelinePage } from '@/features/DayPages';
import { DocumentsVaultPage, OBJECT_URL_TTL_MS } from '@/features/DocumentPages';
import { ConflictInboxPage } from '@/features/InboxPages';
import { DaysIndexPage, TripHomePage } from '@/features/TripPages';

const TRIP = europe2026.bundle.trip.id;

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: <AppShell />,
        children: [
          { path: 't/:tripId/days/:dayId', element: <DayTimelinePage /> },
          { path: 't/:tripId/conflicts', element: <ConflictInboxPage /> },
          { path: 't/:tripId', element: <TripHomePage /> },
          { path: 't/:tripId/days', element: <DaysIndexPage /> },
          { path: 't/:tripId/documents', element: <DocumentsVaultPage /> },
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
  // Pin the clock so book-by urgency and the Today highlight do not drift with the date.
  await settingsRepo.patch({ simulatedToday: '2026-09-04' });
});

describe('the day timeline', () => {
  it('shows the Paris day with both the booked train and the stale line still in it', async () => {
    renderAt(`/t/${TRIP}/days/${TRIP}-d16`);
    expect(await screen.findByText('TGV Lyria to Paris')).toBeInTheDocument();
    expect(screen.getByText('Arrive Paris Gare de Lyon')).toBeInTheDocument();
    expect(screen.getByText('Check in and rest')).toBeInTheDocument();
  });

  it('strips the day back to what is tagged when a filter is on', async () => {
    const user = userEvent.setup();
    renderAt(`/t/${TRIP}/days/${TRIP}-d16`);
    await screen.findByText('TGV Lyria to Paris');

    await user.click(screen.getByRole('button', { name: 'CONFLICT' }));

    await waitFor(() => {
      expect(screen.queryByText('Train to Interlaken Ost')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Arrive Paris Gare de Lyon')).toBeInTheDocument();
    expect(screen.getByText('Check in and rest')).toBeInTheDocument();
  });

  it('remembers that something has been done', async () => {
    const user = userEvent.setup();
    renderAt(`/t/${TRIP}/days/${TRIP}-d16`);
    await screen.findByText('TGV Lyria to Paris');

    const buttons = screen.getAllByRole('button', { name: 'Mark as done' });
    const first = buttons[0];
    expect(first).toBeDefined();
    await user.click(first as HTMLElement);

    await waitFor(async () => {
      const items = await db.items.where('dayId').equals(`${TRIP}-d16`).toArray();
      expect(items.some((i) => i.status === 'done')).toBe(true);
    });
  });
});

describe('the conflict inbox', () => {
  it('leads with what cannot happen and keeps observations out of the way', async () => {
    renderAt(`/t/${TRIP}/conflicts`);
    expect(await screen.findByText(/Cannot happen as planned/)).toBeInTheDocument();
    expect(screen.getByText(/Worth checking before you go/)).toBeInTheDocument();
    expect(screen.getByText(/smaller observations/)).toBeInTheDocument();
  });

  it('shows the stale Paris arrival as a finding with a fix', async () => {
    renderAt(`/t/${TRIP}/conflicts`);
    expect(
      await screen.findByText(/TGV Lyria to Paris overlaps Arrive Paris Gare de Lyon/),
    ).toBeInTheDocument();
  });

  it('clears a finding and keeps it cleared', async () => {
    const user = userEvent.setup();
    renderAt(`/t/${TRIP}/conflicts`);
    const heading = await screen.findByText(
      /TGV Lyria to Paris overlaps Arrive Paris Gare de Lyon/,
    );
    const card = heading.closest('div.rounded-xl') as HTMLElement;
    await user.click(within(card).getByRole('button', { name: /Sorted/ }));

    await waitFor(() => {
      expect(
        screen.queryByText(/TGV Lyria to Paris overlaps Arrive Paris Gare de Lyon/),
      ).not.toBeInTheDocument();
    });

    // It is recorded, not merely hidden from this render.
    const states = await db.findingStates.toArray();
    expect(states.some((s) => s.status === 'resolved' && s.ruleId === 'time-overlap')).toBe(true);

    // And it comes back under the cleared view.
    await user.click(screen.getByRole('button', { name: 'Show cleared' }));
    expect(
      await screen.findByText(/TGV Lyria to Paris overlaps Arrive Paris Gare de Lyon/),
    ).toBeInTheDocument();
  });
});

describe('nothing is a dead end', () => {
  it('offers a way into the reminders and the playbook from the trip home', async () => {
    // Both screens exist and are routed. Without a link they may as well not.
    renderAt(`/t/${TRIP}`);
    const reminders = await screen.findByText('Reminders');
    expect(reminders.closest('a')).toHaveAttribute('href', `/t/${TRIP}/reminders`);
    expect(screen.getByText('Booking playbook').closest('a')).toHaveAttribute('href', '/playbook');
  });

  it('offers a way to jump to today from the day list', async () => {
    renderAt(`/t/${TRIP}/days`);
    const jump = await screen.findByText('Jump to today');
    expect(jump.closest('a')).toHaveAttribute('href', `/t/${TRIP}/today`);
  });

  it('offers a way into the documents vault from the trip home', async () => {
    renderAt(`/t/${TRIP}`);
    const vault = await screen.findByText('Documents');
    expect(vault.closest('a')).toHaveAttribute('href', `/t/${TRIP}/documents`);
  });
});

describe('the documents vault', () => {
  beforeEach(() => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.spyOn(window, 'open').mockReturnValue(null);
    URL.createObjectURL = vi.fn(() => 'blob:mock');
    URL.revokeObjectURL = vi.fn();
  });

  it('lists a document once it has been attached', async () => {
    renderAt(`/t/${TRIP}/documents`);
    await screen.findByText('Nothing filed yet');

    const user = userEvent.setup();
    const file = new File(['ticket bytes'], 'boat-ticket.pdf', { type: 'application/pdf' });
    await user.upload(screen.getByLabelText('Add a document'), file);

    expect(await screen.findByText('boat-ticket.pdf')).toBeInTheDocument();
    expect(screen.queryByText('Nothing filed yet')).not.toBeInTheDocument();
  });

  it('opens a document, and keeps the object URL alive long enough for the tab to load it', async () => {
    const docId = await documentsRepo.attach(TRIP, new Blob(['x'], { type: 'text/plain' }), {
      name: 'insurance.txt',
    });
    const blobSpy = vi.spyOn(documentsRepo, 'blob');
    const scheduled = vi.spyOn(window, 'setTimeout');

    renderAt(`/t/${TRIP}/documents`);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /Open/ }));

    await waitFor(() => expect(blobSpy).toHaveBeenCalledWith(docId));
    expect(window.open).toHaveBeenCalledWith('blob:mock', '_blank', 'noopener');

    // The new tab is still fetching the URL. Revoking synchronously blanks it - reliably so
    // on iOS Safari - so nothing may be freed until the tab has had time to load.
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();

    const cleanup = scheduled.mock.calls.find((call) => call[1] === OBJECT_URL_TTL_MS)?.[0];
    expect(cleanup).toBeTypeOf('function');
    (cleanup as () => void)();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock');
  });

  it('removing a document deletes both its metadata and its bytes', async () => {
    const docId = await documentsRepo.attach(TRIP, new Blob(['y']), { name: 'rail-pass.pdf' });

    renderAt(`/t/${TRIP}/documents`);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /Remove/ }));

    await waitFor(() => {
      expect(screen.queryByText('rail-pass.pdf')).not.toBeInTheDocument();
    });
    expect(await db.documents.get(docId)).toBeUndefined();
    expect(await db.documentBytes.get(docId)).toBeUndefined();
  });

  it('surfaces the repo message when a file is over the size limit', async () => {
    renderAt(`/t/${TRIP}/documents`);
    const user = userEvent.setup();
    const huge = new File([new Uint8Array(16 * 1024 * 1024)], 'huge.bin');
    await user.upload(await screen.findByLabelText('Add a document'), huge);

    expect(await screen.findByText(/15 MB/)).toBeInTheDocument();
    expect(screen.getByText('Nothing filed yet')).toBeInTheDocument();
  });
});

describe('filing a document from a booking', () => {
  beforeEach(() => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  it('associates the attachment with the booking, and the vault shows that association', async () => {
    const bookingScreen = renderAt(`/t/${TRIP}/bookings/bk-rail-bsl-par`);
    await screen.findByText('TGV Lyria, Basel to Paris');

    const user = userEvent.setup();
    const file = new File(['x'], 'tgv-ticket.pdf', { type: 'application/pdf' });
    await user.upload(screen.getByLabelText('Attach a ticket or confirmation'), file);
    expect(await screen.findByText('tgv-ticket.pdf')).toBeInTheDocument();
    bookingScreen.unmount();

    renderAt(`/t/${TRIP}/documents`);
    expect(await screen.findByText('tgv-ticket.pdf')).toBeInTheDocument();
    expect(screen.getByText(/Filed against TGV Lyria, Basel to Paris/)).toBeInTheDocument();
  });
});
