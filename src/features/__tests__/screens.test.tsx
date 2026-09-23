/**
 * Screen-level tests for the two interactions that matter most: stripping a day back to
 * essentials, and clearing something out of the inbox so it stays cleared.
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { AppShell } from '@/app/AppShell';
import { db } from '@/db/db';
import { importTrip } from '@/db/transfer';
import { europe2026 } from '@/seed/europe-2026';
import { bookingsRepo, documentsRepo, settingsRepo, tripsRepo } from '@/db/repo';
import { BookingDetailPage, BookingsBoardPage } from '@/features/BookingPages';
import { DayTimelinePage, ItemDetailPage } from '@/features/DayPages';
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
          { path: 't/:tripId/bookings', element: <BookingsBoardPage /> },
          { path: 't/:tripId/bookings/:bookingId', element: <BookingDetailPage /> },
          { path: 't/:tripId/items/:itemId', element: <ItemDetailPage /> },
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

    await user.click(screen.getByRole('button', { name: /CONFLICT/ }));

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
    expect(await screen.findByRole('heading', { name: /Blocked/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Check/ })).toBeInTheDocument();
    expect(screen.getByText(/Smaller observations/)).toBeInTheDocument();
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
    await user.click(screen.getByRole('button', { name: /Cleared/ }));
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
    expect(screen.getByText('Playbook').closest('a')).toHaveAttribute('href', '/playbook');
  });

  it('offers a way to jump to today from the day list', async () => {
    renderAt(`/t/${TRIP}/days`);
    const jump = await screen.findByText('Today');
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
    // Filed as a ticket without being asked: the common case should cost nothing.
    expect(screen.getByText(/^Ticket ·/)).toBeInTheDocument();
  });

  it('files a document as the kind that was chosen', async () => {
    renderAt(`/t/${TRIP}/documents`);
    await screen.findByText('Nothing filed yet');

    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText('Kind of document'), 'insurance');
    const file = new File(['policy'], 'policy.pdf', { type: 'application/pdf' });
    await user.upload(screen.getByLabelText('Add a document'), file);

    expect(await screen.findByText('policy.pdf')).toBeInTheDocument();
    expect(screen.getByText(/^Insurance ·/)).toBeInTheDocument();
    const stored = await db.documents.where('tripId').equals(TRIP).toArray();
    expect(stored[0]?.kind).toBe('insurance');
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

describe('editing an item inline', () => {
  // Runs 15:45 to Roma Termini, arriving 30 minutes into the immigration line that ends
  // at 15:30. Nothing else on the day is timed to clash, so this pair is the clean way
  // to manufacture exactly one new finding.
  const ITEM_ID = `${TRIP}-d01-i03`; // "Leonardo Express to Roma Termini"

  it('edits a title, saves it, and shows and persists the new title', async () => {
    renderAt(`/t/${TRIP}/items/${ITEM_ID}`);
    await screen.findByText('Leonardo Express to Roma Termini');

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    const titleInput = screen.getByDisplayValue('Leonardo Express to Roma Termini');
    await user.clear(titleInput);
    await user.type(titleInput, 'Leonardo Express to the station');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(
      await screen.findByRole('heading', { name: 'Leonardo Express to the station' }),
    ).toBeInTheDocument();
    expect((await db.items.get(ITEM_ID))?.title).toBe('Leonardo Express to the station');
  });

  it('clears a time and persists null rather than an empty string', async () => {
    renderAt(`/t/${TRIP}/items/${ITEM_ID}`);
    await screen.findByText('Leonardo Express to Roma Termini');

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByLabelText('Start time'), { target: { value: '' } });
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(async () => {
      const stored = await db.items.get(ITEM_ID);
      expect(stored?.time).toBeNull();
    });
  });

  it('leaves the item untouched when the edit is cancelled', async () => {
    const before = await db.items.get(ITEM_ID);
    renderAt(`/t/${TRIP}/items/${ITEM_ID}`);
    await screen.findByText('Leonardo Express to Roma Termini');

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    const titleInput = screen.getByDisplayValue('Leonardo Express to Roma Termini');
    await user.clear(titleInput);
    await user.type(titleInput, 'Something else entirely');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(
      screen.getByRole('heading', { name: 'Leonardo Express to Roma Termini' }),
    ).toBeInTheDocument();
    expect(await db.items.get(ITEM_ID)).toEqual(before);
  });

  // The seed marks this one "~15:45" because the source notes were vague about it. The
  // tilde is rendered on the timeline, so it has to stop being true the moment someone
  // states the time exactly - and go on being true when they only touched something else.
  it('stops calling a time approximate once it has been typed exactly', async () => {
    expect((await db.items.get(ITEM_ID))?.timeApprox).toBe(true);

    renderAt(`/t/${TRIP}/items/${ITEM_ID}`);
    await screen.findByText('Leonardo Express to Roma Termini');

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByLabelText('Start time'), { target: { value: '15:50' } });
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(async () => {
      const stored = await db.items.get(ITEM_ID);
      expect(stored?.time).toBe('15:50');
      expect(stored?.timeApprox).toBe(false);
    });
  });

  it('can put the tilde back, so an exact time is not a one-way door', async () => {
    renderAt(`/t/${TRIP}/items/${ITEM_ID}`);
    await screen.findByText('Leonardo Express to Roma Termini');

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    const approx = screen.getByLabelText('Around this time, not exactly');
    expect(approx).toBeChecked();

    // Typing a time clears it, and the box is right there to say otherwise.
    fireEvent.change(screen.getByLabelText('Start time'), { target: { value: '16:05' } });
    expect(approx).not.toBeChecked();
    await user.click(approx);
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(async () => {
      const stored = await db.items.get(ITEM_ID);
      expect(stored?.time).toBe('16:05');
      expect(stored?.timeApprox).toBe(true);
    });
  });

  it('leaves an approximate time approximate when only the title is corrected', async () => {
    renderAt(`/t/${TRIP}/items/${ITEM_ID}`);
    await screen.findByText('Leonardo Express to Roma Termini');

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    const titleInput = screen.getByDisplayValue('Leonardo Express to Roma Termini');
    await user.clear(titleInput);
    await user.type(titleInput, 'Leonardo Express');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(async () => {
      const stored = await db.items.get(ITEM_ID);
      expect(stored?.title).toBe('Leonardo Express');
      expect(stored?.timeApprox).toBe(true);
      expect(stored?.time).toBe('15:45');
    });
  });

  it('re-runs the audit the moment an edit creates a collision, reflected in the inbox', async () => {
    const itemScreen = renderAt(`/t/${TRIP}/items/${ITEM_ID}`);
    await screen.findByText('Leonardo Express to Roma Termini');

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    // Immigration and luggage runs until 15:30. Moving this to 15:00 collides with it.
    fireEvent.change(screen.getByLabelText('Start time'), { target: { value: '15:00' } });
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(async () => {
      expect((await db.items.get(ITEM_ID))?.time).toBe('15:00');
    });
    itemScreen.unmount();

    // A fresh mount of the inbox, not a query against the same live subtree: the point is
    // that the plan re-checks itself, not that this render happened to already hold it.
    renderAt(`/t/${TRIP}/conflicts`);
    expect(
      await screen.findByText(/Immigration and luggage overlaps Leonardo Express to Roma Termini/),
    ).toBeInTheDocument();
  });
});

describe('adding an item', () => {
  const DAY_ID = `${TRIP}-d01`;

  it('adds an item with a title, which appears on the day and persists', async () => {
    renderAt(`/t/${TRIP}/days/${DAY_ID}`);
    await screen.findByText('Leonardo Express to Roma Termini');

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add an item' }));
    await user.type(screen.getByLabelText('Title'), 'Buy gelato');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    expect(await screen.findByText('Buy gelato')).toBeInTheDocument();
    const items = await db.items.where('dayId').equals(DAY_ID).toArray();
    const stored = items.find((i) => i.title === 'Buy gelato');
    expect(stored?.tripId).toBe(TRIP);
    expect(stored?.dayId).toBe(DAY_ID);
  });

  // A new line has no tags, so under a filter it would land out of sight. Appearing to
  // discard what someone just typed is worse than any amount of filter state.
  it('drops the tag filter so a new item cannot land out of sight', async () => {
    renderAt(`/t/${TRIP}/days/${DAY_ID}`);
    await screen.findByText('Leonardo Express to Roma Termini');

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /MUST/ }));
    await waitFor(() => {
      expect(screen.queryByText('Leonardo Express to Roma Termini')).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Add an item' }));
    await user.type(screen.getByLabelText('Title'), 'Buy a metro pass');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    expect(await screen.findByText('Buy a metro pass')).toBeInTheDocument();
    // The filter gave way, so the rest of the day is back too.
    expect(screen.getByText('Leonardo Express to Roma Termini')).toBeInTheDocument();
  });

  it('persists an empty start time as null, not an empty string', async () => {
    renderAt(`/t/${TRIP}/days/${DAY_ID}`);
    await screen.findByText('Leonardo Express to Roma Termini');

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add an item' }));
    await user.type(screen.getByLabelText('Title'), 'Buy stamps');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    await screen.findByText('Buy stamps');
    const items = await db.items.where('dayId').equals(DAY_ID).toArray();
    const stored = items.find((i) => i.title === 'Buy stamps');
    expect(stored?.time).toBeNull();
  });

  it('refuses a blank title', async () => {
    renderAt(`/t/${TRIP}/days/${DAY_ID}`);
    await screen.findByText('Leonardo Express to Roma Termini');
    const before = await db.items.where('dayId').equals(DAY_ID).count();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add an item' }));
    await user.click(screen.getByRole('button', { name: 'Add' }));

    expect(await screen.findByText('Give it a title.')).toBeInTheDocument();
    expect(await db.items.where('dayId').equals(DAY_ID).count()).toBe(before);
  });
});

describe('deleting an item', () => {
  beforeEach(() => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  it('removes the row and returns to the day', async () => {
    const itemId = `${TRIP}-d01-i03`; // "Leonardo Express to Roma Termini"
    renderAt(`/t/${TRIP}/items/${itemId}`);
    await screen.findByText('Leonardo Express to Roma Termini');

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(async () => {
      expect(await db.items.get(itemId)).toBeUndefined();
    });
    expect(await screen.findByText(/Arrival and a romantic Rome evening/)).toBeInTheDocument();
  });

  it('re-runs the audit: removing the stale Paris arrival clears its finding', async () => {
    const itemId = `${TRIP}-d16-i06`; // "Arrive Paris Gare de Lyon"
    const itemScreen = renderAt(`/t/${TRIP}/items/${itemId}`);
    await screen.findByText('Arrive Paris Gare de Lyon');

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(async () => {
      expect(await db.items.get(itemId)).toBeUndefined();
    });
    itemScreen.unmount();

    // A fresh mount, not the same live subtree: proves the plan re-checks itself when a
    // line goes, not only when one changes.
    renderAt(`/t/${TRIP}/conflicts`);
    await screen.findByRole('heading', { name: /Blocked/ });
    expect(
      screen.queryByText(/TGV Lyria to Paris overlaps Arrive Paris Gare de Lyon/),
    ).not.toBeInTheDocument();
  });

  it('does not touch the booking behind the item', async () => {
    const itemId = `${TRIP}-d16-i05`; // "TGV Lyria to Paris", linked to bk-rail-bsl-par
    renderAt(`/t/${TRIP}/items/${itemId}`);
    await screen.findByText('TGV Lyria to Paris');

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(async () => {
      expect(await db.items.get(itemId)).toBeUndefined();
    });
    expect(await db.bookings.get('bk-rail-bsl-par')).toBeDefined();
  });
});

describe('adding a booking', () => {
  it('adds a booking that appears under Still to book, and persists with the right ids', async () => {
    renderAt(`/t/${TRIP}/bookings`);
    await screen.findByRole('heading', { name: 'Bookings' });

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'New' }));
    await user.type(screen.getByLabelText('Title'), 'Ferry to Bellagio');
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-09-10' } });
    await user.click(screen.getByRole('button', { name: 'Add' }));

    const heading = await screen.findByText('Ferry to Bellagio');
    expect(heading.closest('section')?.querySelector('h2')).toHaveTextContent('Still to book');

    const stored = (await db.bookings.toArray()).find((b) => b.title === 'Ferry to Bellagio');
    expect(stored?.tripId).toBe(TRIP);
    expect(stored?.date).toBe('2026-09-10');
  });

  it('defaults a new booking to to_book, not booked', async () => {
    renderAt(`/t/${TRIP}/bookings`);
    await screen.findByRole('heading', { name: 'Bookings' });

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'New' }));
    await user.type(screen.getByLabelText('Title'), 'Airport transfer');
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-09-11' } });
    await user.click(screen.getByRole('button', { name: 'Add' }));

    await screen.findByText('Airport transfer');
    const stored = (await db.bookings.toArray()).find((b) => b.title === 'Airport transfer');
    expect(stored?.status).toBe('to_book');
  });

  it('refuses a blank title and a missing date', async () => {
    renderAt(`/t/${TRIP}/bookings`);
    await screen.findByRole('heading', { name: 'Bookings' });
    const before = await db.bookings.count();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'New' }));
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(await screen.findByText('Give it a title.')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Title'), 'Something to book');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(await screen.findByText('Give it a date.')).toBeInTheDocument();

    expect(await db.bookings.count()).toBe(before);
  });

  it('shows a matching guide as the title is typed, linking to the playbook', async () => {
    renderAt(`/t/${TRIP}/bookings`);
    await screen.findByRole('heading', { name: 'Bookings' });

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'New' }));
    expect(screen.queryByText('Frecciarossa and other Trenitalia high-speed trains')).toBeNull();

    await user.selectOptions(screen.getByLabelText('Kind'), 'train');
    await user.type(screen.getByLabelText('Title'), 'Frecciarossa to Florence');

    const guideLink = await screen.findByText(
      'Frecciarossa and other Trenitalia high-speed trains',
    );
    expect(guideLink.closest('a')).toHaveAttribute('href', '/playbook/it-trenitalia-highspeed');
  });
});

describe('linking a booking to an item', () => {
  it('links an unlinked item, which then shows the booking on the item screen', async () => {
    const itemId = `${TRIP}-d01-i03`; // "Leonardo Express to Roma Termini", unlinked
    renderAt(`/t/${TRIP}/items/${itemId}`);
    await screen.findByText('Leonardo Express to Roma Termini');
    expect(screen.queryByText('TGV Lyria, Basel to Paris')).not.toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.getByRole('option', { name: /TGV Lyria, Basel to Paris/ })).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Booking'), 'bk-rail-bsl-par');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('TGV Lyria, Basel to Paris')).toBeInTheDocument();
    expect((await db.items.get(itemId))?.bookingId).toBe('bk-rail-bsl-par');
  });

  it('unlinking writes null, not an empty string', async () => {
    const itemId = `${TRIP}-d16-i05`; // "TGV Lyria to Paris", linked to bk-rail-bsl-par
    renderAt(`/t/${TRIP}/items/${itemId}`);
    await screen.findByText('TGV Lyria to Paris');

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.selectOptions(screen.getByLabelText('Booking'), 'Not linked');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(async () => {
      const stored = await db.items.get(itemId);
      expect(stored?.bookingId).toBeNull();
    });
  });

  it('shows the linked booking as a status chip on the day timeline', async () => {
    const itemId = `${TRIP}-d01-i03`;
    const itemScreen = renderAt(`/t/${TRIP}/items/${itemId}`);
    await screen.findByText('Leonardo Express to Roma Termini');

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.selectOptions(screen.getByLabelText('Booking'), 'bk-rail-bsl-par');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(async () => {
      expect((await db.items.get(itemId))?.bookingId).toBe('bk-rail-bsl-par');
    });
    itemScreen.unmount();

    // A fresh mount of the day, where a traveller actually reads their plan - not the
    // item detail screen the link was made on.
    renderAt(`/t/${TRIP}/days/${TRIP}-d01`);
    const link = await screen.findByRole('link', { name: 'Leonardo Express to Roma Termini' });
    const row = link.closest('div.rounded-xl') as HTMLElement;
    expect(within(row).getByText('booked')).toBeInTheDocument();
  });

  it('leaves the booking itself untouched when unlinked', async () => {
    const itemId = `${TRIP}-d16-i05`;
    const before = await db.bookings.get('bk-rail-bsl-par');
    renderAt(`/t/${TRIP}/items/${itemId}`);
    await screen.findByText('TGV Lyria to Paris');

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.selectOptions(screen.getByLabelText('Booking'), 'Not linked');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(async () => {
      expect((await db.items.get(itemId))?.bookingId).toBeNull();
    });
    expect(await db.bookings.get('bk-rail-bsl-par')).toEqual(before);
  });
});

describe('editing a booking', () => {
  const BOOKING_ID = 'bk-rail-bsl-par'; // "TGV Lyria, Basel to Paris"

  it('edits a title, date and reference, and shows them on the detail screen', async () => {
    renderAt(`/t/${TRIP}/bookings/${BOOKING_ID}`);
    await screen.findByRole('heading', { name: 'TGV Lyria, Basel to Paris' });

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    const titleInput = screen.getByDisplayValue('TGV Lyria, Basel to Paris');
    await user.clear(titleInput);
    await user.type(titleInput, 'TGV Lyria to Paris, rebooked');
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-10-12' } });
    await user.type(screen.getByLabelText('Reference'), 'PNR-84421');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(
      await screen.findByRole('heading', { name: 'TGV Lyria to Paris, rebooked' }),
    ).toBeInTheDocument();
    const stored = await db.bookings.get(BOOKING_ID);
    expect(stored?.title).toBe('TGV Lyria to Paris, rebooked');
    expect(stored?.date).toBe('2026-10-12');
    expect(stored?.reference).toBe('PNR-84421');
  });

  it('leaves the booking untouched when the edit is cancelled', async () => {
    const before = await db.bookings.get(BOOKING_ID);
    renderAt(`/t/${TRIP}/bookings/${BOOKING_ID}`);
    await screen.findByRole('heading', { name: 'TGV Lyria, Basel to Paris' });

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    const titleInput = screen.getByDisplayValue('TGV Lyria, Basel to Paris');
    await user.clear(titleInput);
    await user.type(titleInput, 'Something else entirely');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.getByRole('heading', { name: 'TGV Lyria, Basel to Paris' })).toBeInTheDocument();
    expect(await db.bookings.get(BOOKING_ID)).toEqual(before);
  });
});

describe('passengers on a booking', () => {
  const BOOKING_ID = 'bk-rail-bsl-par'; // "TGV Lyria, Basel to Paris"

  it('shows a passenger’s coach and seat on the booking detail', async () => {
    await bookingsRepo.patch(BOOKING_ID, {
      passengers: [{ name: 'Alex Henson', coach: '5', seat: '74' }],
    });

    renderAt(`/t/${TRIP}/bookings/${BOOKING_ID}`);
    await screen.findByRole('heading', { name: 'TGV Lyria, Basel to Paris' });

    expect(screen.getByText('Alex Henson')).toBeInTheDocument();
    expect(screen.getByText('Coach 5 · Seat 74')).toBeInTheDocument();
  });
});

describe('trip essentials', () => {
  it('renders a tel: link for a phone essential on the trip home', async () => {
    await tripsRepo.patch(TRIP, {
      essentials: [
        { id: 'ess-1', label: 'Travel insurer', value: '+61 2 5550 1234', kind: 'phone' },
      ],
    });

    renderAt(`/t/${TRIP}`);
    await screen.findByText('Travel insurer');

    const call = screen.getByRole('link', { name: 'Call' });
    expect(call).toHaveAttribute('href', 'tel:+61255501234');
  });
});

describe('deleting a booking', () => {
  const BOOKING_ID = 'bk-rail-bsl-par'; // "TGV Lyria, Basel to Paris"

  beforeEach(() => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  it('removes the booking, returns to the board, and leaves a linked item with bookingId null', async () => {
    const itemId = `${TRIP}-d16-i05`; // "TGV Lyria to Paris", linked to this booking
    expect((await db.items.get(itemId))?.bookingId).toBe(BOOKING_ID);

    renderAt(`/t/${TRIP}/bookings/${BOOKING_ID}`);
    await screen.findByRole('heading', { name: 'TGV Lyria, Basel to Paris' });

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(async () => {
      expect(await db.bookings.get(BOOKING_ID)).toBeUndefined();
    });
    // The delete navigates within the same router - no fresh mount needed to see it.
    expect(await screen.findByRole('heading', { name: 'Bookings' })).toBeInTheDocument();

    const item = await db.items.get(itemId);
    expect(item).toBeDefined();
    expect(item?.bookingId).toBeNull();
  });

  it('does not delete a document filed against the booking it removes', async () => {
    const docId = await documentsRepo.attach(TRIP, new Blob(['x'], { type: 'application/pdf' }), {
      name: 'tgv-ticket.pdf',
      attachedTo: { kind: 'booking', id: BOOKING_ID },
    });

    const bookingScreen = renderAt(`/t/${TRIP}/bookings/${BOOKING_ID}`);
    await screen.findByText('tgv-ticket.pdf');

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(async () => {
      expect(await db.bookings.get(BOOKING_ID)).toBeUndefined();
    });
    expect(await db.documents.get(docId)).toBeDefined();
    expect(await db.documentBytes.get(docId)).toBeDefined();
    bookingScreen.unmount();

    // Still filed and visible from the vault, not merely surviving in the database.
    renderAt(`/t/${TRIP}/documents`);
    expect(await screen.findByText('tgv-ticket.pdf')).toBeInTheDocument();
  });
});
