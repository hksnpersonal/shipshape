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
import { bookingsRepo, documentsRepo, settingsRepo } from '@/db/repo';
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
  it('shows the Amsterdam day with both the booked train and the stale line still in it', async () => {
    renderAt(`/t/${TRIP}/days/${TRIP}-d20`);
    expect(await screen.findByText('Eurostar to Amsterdam Centraal')).toBeInTheDocument();
    expect(screen.getByText('Arrive Amsterdam Centraal')).toBeInTheDocument();
  });

  it('strips the day back to what is tagged when a filter is on', async () => {
    const user = userEvent.setup();
    renderAt(`/t/${TRIP}/days/${TRIP}-d20`);
    await screen.findByText('Eurostar to Amsterdam Centraal');

    // The tag filter is edit machinery, hidden until asked for.
    await user.click(screen.getByRole('button', { name: 'Edit day' }));
    await user.click(screen.getByRole('button', { name: /CONFLICT/ }));

    await waitFor(() => {
      expect(
        screen.queryByText('Breakfast, check out, buy food for the train'),
      ).not.toBeInTheDocument();
    });
    expect(screen.getByText('Arrive Amsterdam Centraal')).toBeInTheDocument();
  });

  it('remembers that something has been done', async () => {
    const user = userEvent.setup();
    renderAt(`/t/${TRIP}/days/${TRIP}-d16`);
    await screen.findByText('TGV Lyria to Paris');

    // Done/skip is edit machinery, hidden until asked for.
    await user.click(screen.getByRole('button', { name: 'Edit day' }));
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
  it('leads with every place the notes and the tickets disagree, unfolded', async () => {
    renderAt(`/t/${TRIP}/conflicts`);
    const heading = await screen.findByText(/^To decide \(\d+\)$/);
    const section = heading.closest('section') as HTMLElement;
    const flags = europe2026.bundle.conflicts.filter((c) => c.id.startsWith('mc-review-'));
    expect(flags.length).toBeGreaterThan(0);
    for (const flag of flags) {
      expect(within(section).getByText(flag.title)).toBeInTheDocument();
    }
  }, 15000);

  it('shows each open thing to decide as its own card, sorted or ignored in one tap', async () => {
    const user = userEvent.setup();
    renderAt(`/t/${TRIP}/conflicts`);
    const heading = await screen.findByText(/^To decide \(\d+\)$/);
    const section = heading.closest('section') as HTMLElement;
    const flags = europe2026.bundle.conflicts.filter((c) => c.id.startsWith('mc-review-'));
    expect(within(section).getAllByRole('button', { name: 'Sorted' })).toHaveLength(flags.length);

    await user.click(within(section).getAllByRole('button', { name: 'Sorted' })[0] as HTMLElement);
    await waitFor(() => {
      expect(within(section).getAllByRole('button', { name: 'Sorted' })).toHaveLength(
        flags.length - 1,
      );
    });

    await user.click(within(section).getAllByRole('button', { name: 'Ignore' })[0] as HTMLElement);
    await waitFor(() => {
      expect(within(section).getAllByRole('button', { name: 'Sorted' })).toHaveLength(
        flags.length - 2,
      );
    });

    const states = await db.findingStates.toArray();
    expect(states.some((s) => s.status === 'resolved')).toBe(true);
    expect(states.some((s) => s.status === 'dismissed')).toBe(true);
  }, 15000);

  it('renames itself Plan check and groups findings by day, minor notes hidden', async () => {
    renderAt(`/t/${TRIP}/conflicts`);
    expect(await screen.findByRole('heading', { name: 'Plan check' })).toBeInTheDocument();
    expect(screen.getByText(/Nothing here stops the trip/)).toBeInTheDocument();
    // Amsterdam day 20 has an error on it, so its group is named for the day and open by
    // default. The same day's own "to decide" card carries the same day line, so this
    // looks for the one that sits inside a disclosure rather than assuming there is one.
    const dayLabels = await screen.findAllByText('Thu 15 Oct · Amsterdam');
    const disclosureLabel = dayLabels.find((el) => el.closest('details'));
    expect(disclosureLabel).toBeDefined();
    expect((disclosureLabel?.closest('details') as HTMLDetailsElement).open).toBe(true);
    // Info-severity findings start hidden behind the toggle.
    expect(screen.getByRole('button', { name: /Show minor notes/ })).toBeInTheDocument();
  });

  it('shows the stale Amsterdam arrival as a finding with a fix', async () => {
    renderAt(`/t/${TRIP}/conflicts`);
    expect(
      await screen.findByText(/Eurostar to Amsterdam Centraal overlaps Arrive Amsterdam Centraal/),
    ).toBeInTheDocument();
  });

  it('clears a finding and keeps it cleared', async () => {
    const user = userEvent.setup();
    renderAt(`/t/${TRIP}/conflicts`);
    const heading = await screen.findByText(
      /Eurostar to Amsterdam Centraal overlaps Arrive Amsterdam Centraal/,
    );
    const card = heading.closest('div.rounded-2xl') as HTMLElement;
    // Compact by default: expand the finding to reach its actions.
    await user.click(heading);
    await user.click(within(card).getByRole('button', { name: /Sorted/ }));

    await waitFor(() => {
      expect(
        screen.queryByText(/Eurostar to Amsterdam Centraal overlaps Arrive Amsterdam Centraal/),
      ).not.toBeInTheDocument();
    });

    // It is recorded, not merely hidden from this render.
    const states = await db.findingStates.toArray();
    expect(states.some((s) => s.status === 'resolved' && s.ruleId === 'time-overlap')).toBe(true);

    // And it comes back under the cleared view.
    await user.click(screen.getByRole('button', { name: /Cleared/ }));
    expect(
      await screen.findByText(/Eurostar to Amsterdam Centraal overlaps Arrive Amsterdam Centraal/),
    ).toBeInTheDocument();
  });
});

describe('nothing is a dead end', () => {
  // Reminders, the playbook, the documents vault and trip essentials all moved off the
  // Trip tab to More/Wallet in the Direction A redesign - covered where they now live,
  // not here.

  it('offers a way to jump to today from the day list', async () => {
    renderAt(`/t/${TRIP}/days`);
    // Scoped to the page header: the app shell's own nav also has a "Today" tab, rendered
    // twice (desktop rail and mobile bar), which a bare text query would also match.
    const heading = await screen.findByRole('heading', { name: 'Days' });
    const header = heading.closest('header') as HTMLElement;
    const jump = within(header).getByText('Today');
    expect(jump.closest('a')).toHaveAttribute('href', `/t/${TRIP}/today`);
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
    const tab = { location: { href: '' }, close: vi.fn() };
    vi.mocked(window.open).mockReturnValue(tab as unknown as Window);

    renderAt(`/t/${TRIP}/documents`);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /Open/ }));

    // The tab opens inside the tap itself - iPhone Safari blocks one opened after an
    // await - and receives the file once it has been read.
    expect(window.open).toHaveBeenCalledWith('', '_blank');
    await waitFor(() => expect(blobSpy).toHaveBeenCalledWith(docId));
    await waitFor(() => expect(tab.location.href).toBe('blob:mock'));

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
    await screen.findByRole('heading', { name: 'Basel → Paris' });

    const user = userEvent.setup();
    const file = new File(['x'], 'tgv-ticket.pdf', { type: 'application/pdf' });
    await user.upload(screen.getByLabelText('Attach a ticket or confirmation'), file);
    expect(await screen.findByText('tgv-ticket.pdf')).toBeInTheDocument();
    bookingScreen.unmount();

    renderAt(`/t/${TRIP}/documents`);
    expect(await screen.findByText('tgv-ticket.pdf')).toBeInTheDocument();
    expect(screen.getByText(/for TGV Lyria, Basel to Paris/)).toBeInTheDocument();
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
    // "Add an item" is edit machinery, hidden until asked for.
    await user.click(screen.getByRole('button', { name: 'Edit day' }));
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
    // The tag filter and "Add an item" are both edit machinery, hidden until asked for.
    await user.click(screen.getByRole('button', { name: 'Edit day' }));
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
    // "Add an item" is edit machinery, hidden until asked for.
    await user.click(screen.getByRole('button', { name: 'Edit day' }));
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
    // "Add an item" is edit machinery, hidden until asked for.
    await user.click(screen.getByRole('button', { name: 'Edit day' }));
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

  it('re-runs the audit: removing the stale Amsterdam arrival clears its finding', async () => {
    const itemId = `${TRIP}-d20-i05`; // "Arrive Amsterdam Centraal"
    const itemScreen = renderAt(`/t/${TRIP}/items/${itemId}`);
    await screen.findByText('Arrive Amsterdam Centraal');

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
    await screen.findByRole('heading', { name: 'Plan check' });
    expect(
      screen.queryByText(/Eurostar to Amsterdam Centraal overlaps Arrive Amsterdam Centraal/),
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
  it('adds a booking that shows up once the still-to-book filter is followed, and persists with the right ids', async () => {
    renderAt(`/t/${TRIP}/bookings`);
    await screen.findByRole('heading', { name: 'Wallet' });

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'New' }));
    await user.type(screen.getByLabelText('Title'), 'Ferry to Bellagio');
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-09-10' } });
    await user.click(screen.getByRole('button', { name: 'Add' }));

    // The board groups by date, not status, so "still needs booking" is a single strip
    // rather than a section of its own - the new booking shows up once that strip's own
    // filter is followed.
    await user.click(screen.getByText(/still to book/));
    expect(await screen.findByText('Ferry to Bellagio')).toBeInTheDocument();

    const stored = (await db.bookings.toArray()).find((b) => b.title === 'Ferry to Bellagio');
    expect(stored?.tripId).toBe(TRIP);
    expect(stored?.date).toBe('2026-09-10');
  });

  it('defaults a new booking to to_book, not booked', async () => {
    renderAt(`/t/${TRIP}/bookings`);
    await screen.findByRole('heading', { name: 'Wallet' });

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'New' }));
    await user.type(screen.getByLabelText('Title'), 'Airport transfer');
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-09-11' } });
    await user.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(async () => {
      const stored = (await db.bookings.toArray()).find((b) => b.title === 'Airport transfer');
      expect(stored?.status).toBe('to_book');
    });
  });

  it('refuses a blank title and a missing date', async () => {
    renderAt(`/t/${TRIP}/bookings`);
    await screen.findByRole('heading', { name: 'Wallet' });
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
    await screen.findByRole('heading', { name: 'Wallet' });

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
    const link = await screen.findByRole('link', { name: /Leonardo Express to Roma Termini/ });
    expect(within(link).getByText('Booked')).toBeInTheDocument();
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

  it('edits a title, date and reference, and persists them - the route heading is unaffected', async () => {
    renderAt(`/t/${TRIP}/bookings/${BOOKING_ID}`);
    await screen.findByRole('heading', { name: 'Basel → Paris' });

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    const titleInput = screen.getByDisplayValue('TGV Lyria, Basel to Paris');
    await user.clear(titleInput);
    await user.type(titleInput, 'TGV Lyria to Paris, rebooked');
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-10-12' } });
    await user.type(screen.getByLabelText('Reference'), 'PNR-84421');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    // The heading is the route, derived from the booking's from/to - not the title - so
    // it survives a title edit unchanged; the new date shows up in the subtitle instead.
    expect(await screen.findByRole('heading', { name: 'Basel → Paris' })).toBeInTheDocument();
    expect(await screen.findByText(/Mon 12 Oct/)).toBeInTheDocument();

    const stored = await db.bookings.get(BOOKING_ID);
    expect(stored?.title).toBe('TGV Lyria to Paris, rebooked');
    expect(stored?.date).toBe('2026-10-12');
    expect(stored?.reference).toBe('PNR-84421');
  });

  it('leaves the booking untouched when the edit is cancelled', async () => {
    const before = await db.bookings.get(BOOKING_ID);
    renderAt(`/t/${TRIP}/bookings/${BOOKING_ID}`);
    await screen.findByRole('heading', { name: 'Basel → Paris' });

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    const titleInput = screen.getByDisplayValue('TGV Lyria, Basel to Paris');
    await user.clear(titleInput);
    await user.type(titleInput, 'Something else entirely');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.getByRole('heading', { name: 'Basel → Paris' })).toBeInTheDocument();
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
    await screen.findByRole('heading', { name: 'Basel → Paris' });

    expect(screen.getByText('Alex Henson')).toBeInTheDocument();
    expect(screen.getByText('Coach 5 · Seat 74')).toBeInTheDocument();
  });
});

// Trip essentials moved off the Trip tab in the Direction A redesign - covered wherever
// the More screen that owns them now tests it, not here.

describe('deleting a booking', () => {
  const BOOKING_ID = 'bk-rail-bsl-par'; // "TGV Lyria, Basel to Paris"

  beforeEach(() => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  it('removes the booking, returns to the board, and leaves a linked item with bookingId null', async () => {
    const itemId = `${TRIP}-d16-i05`; // "TGV Lyria to Paris", linked to this booking
    expect((await db.items.get(itemId))?.bookingId).toBe(BOOKING_ID);

    renderAt(`/t/${TRIP}/bookings/${BOOKING_ID}`);
    await screen.findByRole('heading', { name: 'Basel → Paris' });

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(async () => {
      expect(await db.bookings.get(BOOKING_ID)).toBeUndefined();
    });
    // The delete navigates within the same router - no fresh mount needed to see it.
    expect(await screen.findByRole('heading', { name: 'Wallet' })).toBeInTheDocument();

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
