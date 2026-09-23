import { describe, expect, it } from 'vitest';
import { europe2026 } from '@/seed/europe-2026';
import { applyOverlay, mimeTypeOf } from '../privateOverlay';

const NOW = '2026-09-24T00:00:00.000Z';
const bytes = (n: number) => new Uint8Array(n).fill(7).buffer;

describe('applyOverlay', () => {
  it('merges booking fields and leaves the seed untouched', () => {
    const out = applyOverlay(
      europe2026,
      { bookings: { 'bk-rail-par-bru': { reference: 'ABC123' } } },
      () => bytes(1),
      NOW,
    );
    const merged = out.bundle.bookings.find((b) => b.id === 'bk-rail-par-bru');
    expect(merged?.reference).toBe('ABC123');
    expect(merged?.depart).toBe('06:49');
    expect(europe2026.bundle.bookings.find((b) => b.id === 'bk-rail-par-bru')?.reference).toBe(
      undefined,
    );
  });

  it('embeds documents and attaches them to their booking', () => {
    const out = applyOverlay(
      europe2026,
      {
        documents: [
          {
            file: 'Trains/ticket.PDF',
            kind: 'ticket',
            attachTo: { kind: 'booking', id: 'bk-rail-par-bru' },
          },
        ],
      },
      () => bytes(5),
      NOW,
    );
    const meta = out.bundle.documents.at(-1);
    expect(meta).toMatchObject({
      name: 'ticket.PDF',
      mimeType: 'application/pdf',
      size: 5,
      attachedTo: { kind: 'booking', id: 'bk-rail-par-bru' },
    });
    expect(out.documents.at(-1)?.data).toBe(btoa('\x07'.repeat(5)));
  });

  it('refuses a patch for a booking that does not exist', () => {
    expect(() =>
      applyOverlay(europe2026, { bookings: { 'bk-typo': { reference: 'X' } } }, () => bytes(1)),
    ).toThrow(/No booking with id bk-typo/);
  });

  it('refuses a document attached to something that does not exist', () => {
    expect(() =>
      applyOverlay(
        europe2026,
        {
          documents: [{ file: 'a.pdf', kind: 'ticket', attachTo: { kind: 'booking', id: 'nope' } }],
        },
        () => bytes(1),
      ),
    ).toThrow(/does not apply cleanly/);
  });

  it('knows the file types in the trip folder', () => {
    expect(mimeTypeOf('x.jpeg')).toBe('image/jpeg');
    expect(mimeTypeOf('x.PNG')).toBe('image/png');
    expect(mimeTypeOf('x.bin')).toBe('application/octet-stream');
  });
});
