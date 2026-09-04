/**
 * Screen-level tests for the two interactions that matter most: stripping a day back to
 * essentials, and clearing something out of the inbox so it stays cleared.
 */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { AppShell } from '@/app/AppShell';
import { db } from '@/db/db';
import { importTrip } from '@/db/transfer';
import { europe2026 } from '@/seed/europe-2026';
import { settingsRepo } from '@/db/repo';
import { DayTimelinePage } from '@/features/DayPages';
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
});
