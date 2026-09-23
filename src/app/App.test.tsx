import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import App from '@/app/App';
import { db } from '@/db/db';

describe('the app on a fresh device', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('loads the sample trip and lists it', async () => {
    render(<App />);
    expect(await screen.findByText('Europe 2026', {}, { timeout: 5000 })).toBeInTheDocument();
  });

  it('opens the trip and shows what still needs booking', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByText('Europe 2026', {}, { timeout: 5000 }));

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Europe 2026' })).toBeInTheDocument(),
    );
    expect(screen.getByText(/still to book/)).toBeInTheDocument();
    expect(screen.getByText(/Plan check/)).toBeInTheDocument();
  });
});
