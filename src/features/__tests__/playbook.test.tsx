/**
 * The playbook screens. The index is a browse surface with no database behind it, so these
 * render the pages directly: what matters is that every guide is reachable, that narrowing
 * actually narrows, and that the booking timeline is drawn from the guide's own numbers
 * rather than always drawn.
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { PlaybookDetailPage, PlaybookIndexPage } from '@/features/PlaybookPages';
import { allGuides } from '@/content/guides';

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      { path: '/playbook', element: <PlaybookIndexPage /> },
      { path: '/playbook/:guideId', element: <PlaybookDetailPage /> },
    ],
    { initialEntries: [path] },
  );
  return render(<RouterProvider router={router} />);
}

describe('the playbook index', () => {
  it('offers every guide as a card carrying its country and its booking window', () => {
    renderAt('/playbook');

    // One card, one link, per guide: nothing is only reachable through search.
    expect(screen.getAllByRole('link')).toHaveLength(allGuides.length);

    const card = screen.getByText('Galleria Borghese').closest('a') as HTMLElement;
    expect(within(card).getByLabelText('Italy')).toBeInTheDocument();
    expect(within(card).getByLabelText('Book 3 weeks ahead')).toBeInTheDocument();
  });

  it('files every card under a named kind, so the category is read and not deduced', () => {
    renderAt('/playbook');

    // A colour only means something to someone who has already learnt it. The heading is
    // what tells a first-time reader that this card is a train guide.
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(7);
    expect(screen.getByRole('heading', { level: 2, name: 'Trains' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Airports' })).toBeInTheDocument();

    const museums = screen.getByRole('heading', { level: 2, name: 'Museums' });
    const group = museums.closest('div')?.parentElement as HTMLElement;
    expect(within(group).getByText('Galleria Borghese')).toBeInTheDocument();
    expect(within(group).queryByText('Lake Como ferries')).not.toBeInTheDocument();
  });

  it('drops the kinds a search rules out rather than leaving empty headings', async () => {
    const user = userEvent.setup();
    renderAt('/playbook');

    await user.type(screen.getByLabelText('Search guides'), 'Uffizi');
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 2, name: 'Museums' })).toBeInTheDocument();
  });

  it('narrows to one kind when its tile is pressed', async () => {
    const user = userEvent.setup();
    renderAt('/playbook');

    await user.click(screen.getByRole('button', { name: /Museums/ }));

    expect(screen.getByText('Galleria Borghese')).toBeInTheDocument();
    expect(screen.queryByText('Lake Como ferries')).not.toBeInTheDocument();
  });

  it('narrows on a search, and puts everything back when the filter is cleared', async () => {
    const user = userEvent.setup();
    renderAt('/playbook');

    await user.type(screen.getByLabelText('Search guides'), 'Uffizi');
    expect(screen.getByText('Uffizi Gallery')).toBeInTheDocument();
    expect(screen.queryByText('Venice gondola rides')).not.toBeInTheDocument();

    await user.clear(screen.getByLabelText('Search guides'));
    expect(screen.getAllByRole('link')).toHaveLength(allGuides.length);
  });

  it('says so rather than showing an empty page when nothing matches', async () => {
    const user = userEvent.setup();
    renderAt('/playbook');

    await user.type(screen.getByLabelText('Search guides'), 'funicular to nowhere');
    expect(screen.getByText('No matching guides.')).toBeInTheDocument();
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });
});

describe('one guide in detail', () => {
  it('draws the timeline from the guide own numbers', () => {
    // Galleria Borghese sells 90 days out and must be bought 21 days before.
    renderAt('/playbook/it-galleria-borghese');

    expect(screen.getByText('Tickets open')).toBeInTheDocument();
    expect(screen.getByText('90d before')).toBeInTheDocument();
    expect(screen.getByText('Book by')).toBeInTheDocument();
    expect(screen.getByText('21d before')).toBeInTheDocument();
    expect(screen.getByText('Travel day')).toBeInTheDocument();
  });

  it('draws no timeline for something bought on the day', () => {
    // Italian regional trains have no booking window to draw.
    renderAt('/playbook/it-regional-trains');

    expect(screen.queryByText('Travel day')).not.toBeInTheDocument();
    expect(screen.queryByText('Book by')).not.toBeInTheDocument();
  });

  it('leads with the country and kind rather than repeating the title', () => {
    // The hero used to print the title the page heading had just printed, and the card
    // under it printed a third. Trenitalia is the check because its official channel is
    // named differently from the guide, so a second hit would be a real repetition.
    const title = 'Frecciarossa and other Trenitalia high-speed trains';
    renderAt('/playbook/it-trenitalia-highspeed');

    expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
    expect(screen.getAllByText(title)).toHaveLength(1);
    expect(screen.getByText('Trains')).toBeInTheDocument();
    expect(screen.getByLabelText('Italy')).toBeInTheDocument();
  });

  it('never promises a refund the rules do not state', () => {
    // The Swiss Travel Pass says refunds depend on the seller, which is not a yes.
    renderAt('/playbook/ch-swiss-travel-pass');
    expect(screen.queryByText('Refundable')).not.toBeInTheDocument();
    expect(screen.getByText('Check refund rules')).toBeInTheDocument();
  });

  it('keeps the detail behind a disclosure rather than on the surface', async () => {
    const user = userEvent.setup();
    renderAt('/playbook/it-galleria-borghese');

    const gotchas = screen.getByText(/Common mistakes/);
    const details = gotchas.closest('details') as HTMLDetailsElement;
    expect(details.open).toBe(false);

    await user.click(gotchas);
    expect(details.open).toBe(true);
  });
});
