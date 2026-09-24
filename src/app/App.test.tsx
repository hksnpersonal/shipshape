import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import App from '@/app/App';
import { db } from '@/db/db';

describe('the app on a fresh device', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('loads the sample trip and lands straight on it, there being only the one', async () => {
    render(<App />);
    expect(
      await screen.findByRole('heading', { name: 'Europe 2026' }, { timeout: 5000 }),
    ).toBeInTheDocument();
  });

  it('shows the whole route, grouped by country', async () => {
    render(<App />);
    await waitFor(
      () => expect(screen.getByRole('heading', { name: 'Europe 2026' })).toBeInTheDocument(),
      { timeout: 5000 },
    );
    expect(screen.getByText('Italy')).toBeInTheDocument();
    expect(screen.getByText('Rome')).toBeInTheDocument();
  });
});
