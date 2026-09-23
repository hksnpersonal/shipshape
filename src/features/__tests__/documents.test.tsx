/**
 * The documents vault, grouped by what a document belongs to rather than shown as one
 * flat list. A traveller with thirty-odd tickets needs "which hotel is this for", not
 * "here is everything, newest first".
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { AppShell } from '@/app/AppShell';
import { db } from '@/db/db';
import { importTrip } from '@/db/transfer';
import { europe2026 } from '@/seed/europe-2026';
import { BK } from '@/seed/europe-2026/ids';
import { documentsRepo, settingsRepo } from '@/db/repo';
import { DocumentsVaultPage } from '@/features/DocumentPages';

const TRIP = europe2026.bundle.trip.id;

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: <AppShell />,
        children: [{ path: 't/:tripId/documents', element: <DocumentsVaultPage /> }],
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
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});

describe('grouping by what a document is for', () => {
  it('files a document attached to a hotel booking under Hotels', async () => {
    await documentsRepo.attach(TRIP, new Blob(['x'], { type: 'application/pdf' }), {
      name: 'visconti-confirmation.pdf',
      attachedTo: { kind: 'booking', id: BK.hotelRome },
    });

    renderAt(`/t/${TRIP}/documents`);
    const heading = await screen.findByRole('heading', { name: /^Hotels/ });
    expect(heading).toBeInTheDocument();
    expect(heading.closest('section')?.textContent).toContain('visconti-confirmation.pdf');
    expect(screen.getByText(/for Hotel Visconti Suites, Rome/)).toBeInTheDocument();
  });

  it('files a document attached to a train booking under Transport', async () => {
    await documentsRepo.attach(TRIP, new Blob(['x']), {
      name: 'tgv-ticket.pdf',
      attachedTo: { kind: 'booking', id: 'bk-rail-bsl-par' },
    });

    renderAt(`/t/${TRIP}/documents`);
    const heading = await screen.findByRole('heading', { name: /^Transport/ });
    expect(heading.closest('section')?.textContent).toContain('tgv-ticket.pdf');
  });

  it('files a document with no owner under Trip papers', async () => {
    await documentsRepo.attach(TRIP, new Blob(['x']), { name: 'travel-insurance.pdf' });

    renderAt(`/t/${TRIP}/documents`);
    const heading = await screen.findByRole('heading', { name: /^Trip papers/ });
    expect(heading.closest('section')?.textContent).toContain('travel-insurance.pdf');
  });
});

describe('searching the vault', () => {
  it('filters by document name', async () => {
    await documentsRepo.attach(TRIP, new Blob(['x']), {
      name: 'visconti-confirmation.pdf',
      attachedTo: { kind: 'booking', id: BK.hotelRome },
    });
    await documentsRepo.attach(TRIP, new Blob(['y']), {
      name: 'tgv-ticket.pdf',
      attachedTo: { kind: 'booking', id: 'bk-rail-bsl-par' },
    });

    renderAt(`/t/${TRIP}/documents`);
    await screen.findByText('visconti-confirmation.pdf');

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Search documents'), 'tgv');

    expect(screen.getByText('tgv-ticket.pdf')).toBeInTheDocument();
    expect(screen.queryByText('visconti-confirmation.pdf')).not.toBeInTheDocument();
  });

  it('filters by the booking it is for, not only the file name', async () => {
    await documentsRepo.attach(TRIP, new Blob(['x']), {
      name: 'confirmation.pdf',
      attachedTo: { kind: 'booking', id: BK.hotelRome },
    });

    renderAt(`/t/${TRIP}/documents`);
    await screen.findByText('confirmation.pdf');

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Search documents'), 'visconti');

    expect(screen.getByText('confirmation.pdf')).toBeInTheDocument();
  });
});
