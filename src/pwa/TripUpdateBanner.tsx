/**
 * "Your trip has been updated": shown when the private site carries a newer trip file than
 * the one this phone loaded. Updating keeps ticks, Plan check decisions, documents and
 * anything added on the phone (see `applyTripUpdate`), so it is safe to say yes.
 */
import { useEffect, useState } from 'react';
import { applyTripUpdate, checkForTripUpdate, fetchMissingDocuments } from '@/db/seedLoader';

export function TripUpdateBanner() {
  const [file, setFile] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void checkForTripUpdate().then((found) => {
      if (live) setFile(found);
    });
    return () => {
      live = false;
    };
  }, []);

  if (!file) return null;

  const update = async () => {
    setBusy(true);
    setError(null);
    try {
      await applyTripUpdate(file);
      setFile(null);
      void fetchMissingDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The update could not be applied.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="status"
      className="bg-slate-900 px-4 py-3 text-sm text-white dark:bg-slate-100 dark:text-slate-900"
    >
      <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-3">
        <p className="min-w-0 flex-1">
          <span className="font-semibold">Your trip has been updated.</span> Your ticks, decisions
          and documents stay as they are.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setFile(null)}
            className="min-h-[40px] rounded-xl px-3 font-semibold opacity-80"
          >
            Later
          </button>
          <button
            type="button"
            onClick={() => void update()}
            disabled={busy}
            className="bg-brand-600 min-h-[40px] rounded-xl px-4 font-semibold text-white disabled:opacity-50"
          >
            {busy ? 'Updating…' : 'Update'}
          </button>
        </div>
        {error ? <p className="w-full text-rose-200">{error}</p> : null}
      </div>
    </div>
  );
}
