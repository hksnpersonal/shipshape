/**
 * Loading a trip file from Settings. The one case that matters most: the file on the
 * phone already has a trip with this id (the built-in sample, or last time's import), and
 * bringing in the real thing must not leave a confusing second copy behind.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { AppShell } from '@/app/AppShell';
import { db } from '@/db/db';
import { exportTrip, importTrip } from '@/db/transfer';
import { europe2026 } from '@/seed/europe-2026';
import { documentsRepo, tripsRepo } from '@/db/repo';
import { SettingsPage } from '@/features/InboxPages';
import { TripHomePage } from '@/features/TripPages';

const TRIP = europe2026.bundle.trip.id;

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: <AppShell />,
        children: [
          { path: 'settings', element: <SettingsPage /> },
          { path: 't/:tripId', element: <TripHomePage /> },
        ],
      },
    ],
    { initialEntries: [path] },
  );
  return render(<RouterProvider router={router} />);
}

function fileFor(content: unknown): File {
  return new File([JSON.stringify(content)], 'trip.shipshape.json', {
    type: 'application/json',
  });
}

beforeEach(async () => {
  await db.delete();
  await db.open();
  await importTrip(europe2026, { mode: 'replace' });
  vi.spyOn(window, 'alert').mockImplementation(() => {});
});

describe('loading a trip file whose id is already on this phone', () => {
  it('offers Replace and Keep both instead of importing straight away', async () => {
    renderAt('/settings');
    const user = userEvent.setup();
    await user.upload(screen.getByLabelText('Load your trip file'), fileFor(europe2026));

    expect(await screen.findByText(/This replaces Europe 2026 on this phone/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Replace' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Keep both' })).toBeInTheDocument();
    // Nothing has happened to the database yet - the traveller has not decided.
    expect(await db.trips.count()).toBe(1);
  });

  it('Replace leaves exactly one trip, with the file’s own documents and not the old ones', async () => {
    await documentsRepo.attach(TRIP, new Blob(['old']), { name: 'old-ticket.pdf' });
    const incoming = await exportTrip(TRIP, { includeDocuments: true });
    // The file being loaded does not know about the old ticket already on this phone.
    incoming.documents = [];

    renderAt('/settings');
    const user = userEvent.setup();
    await user.upload(screen.getByLabelText('Load your trip file'), fileFor(incoming));
    await user.click(await screen.findByRole('button', { name: 'Replace' }));

    // The trip count is already 1 before the import starts, so wait for the import's own
    // completion signal before reading anything it changed.
    await waitFor(
      () => expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('documents')),
      { timeout: 5000 },
    );
    expect(await db.trips.count()).toBe(1);
    expect(await db.documents.where('tripId').equals(TRIP).count()).toBe(0);
    // Navigated straight to the trip, not left looking at Settings.
    expect(
      await screen.findByRole('heading', { name: 'Europe 2026' }, { timeout: 5000 }),
    ).toBeInTheDocument();
  });

  it('replacing twice in a row still leaves one trip and the file’s document count, not double', async () => {
    const docId = await documentsRepo.attach(TRIP, new Blob(['x']), { name: 'ticket.pdf' });
    const file = await exportTrip(TRIP, { includeDocuments: true });

    const user = userEvent.setup();

    const first = renderAt('/settings');
    await user.upload(screen.getByLabelText('Load your trip file'), fileFor(file));
    await user.click(await screen.findByRole('button', { name: 'Replace' }));
    await waitFor(async () => expect(await db.trips.count()).toBe(1));
    first.unmount();

    renderAt('/settings');
    await user.upload(screen.getByLabelText('Load your trip file'), fileFor(file));
    await user.click(await screen.findByRole('button', { name: 'Replace' }));
    await waitFor(async () => expect(await db.trips.count()).toBe(1));

    expect(await db.documents.where('tripId').equals(TRIP).count()).toBe(1);
    expect(await db.documentBytes.get(docId)).toBeDefined();
  });

  it('Keep both brings the file in alongside the trip already here', async () => {
    const file = await exportTrip(TRIP, { includeDocuments: false });

    renderAt('/settings');
    const user = userEvent.setup();
    await user.upload(screen.getByLabelText('Load your trip file'), fileFor(file));
    await user.click(await screen.findByRole('button', { name: 'Keep both' }));

    await waitFor(async () => {
      expect(await db.trips.count()).toBe(2);
    });
    // The original is untouched under its own id.
    expect(await db.trips.get(TRIP)).toBeDefined();
  });
});

describe('loading a trip file with no matching trip on this phone', () => {
  it('imports it straight away, keeping the file’s own id, with no confirmation step', async () => {
    // A trip id nothing on this device shares, built from a copy import and then removed
    // again so only its export file remains.
    const copy = await importTrip(europe2026, { mode: 'copy' });
    const freshFile = await exportTrip(copy.tripId, { includeDocuments: false });
    await tripsRepo.remove(copy.tripId);
    expect(await db.trips.count()).toBe(1);

    renderAt('/settings');
    const user = userEvent.setup();
    await user.upload(screen.getByLabelText('Load your trip file'), fileFor(freshFile));

    await waitFor(async () => {
      expect(await db.trips.count()).toBe(2);
    });
    expect(screen.queryByText(/This replaces/)).not.toBeInTheDocument();
    expect(await db.trips.get(freshFile.bundle.trip.id)).toBeDefined();
  });
});
