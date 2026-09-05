import { useEffect, useState } from 'react';
import { RouterProvider } from 'react-router';
import { ensureSeed } from '@/db/seedLoader';
import { UpdatePrompt } from '@/pwa/UpdatePrompt';
import { requestPersistentStorage } from '@/pwa/storage';
import { router } from './routes';

export default function App() {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    void requestPersistentStorage();
    ensureSeed()
      .then(() => setReady(true))
      .catch((error: unknown) => {
        setFailed(error instanceof Error ? error.message : 'Storage is not available.');
        setReady(true);
      });
  }, []);

  if (!ready) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-900">
        <h1 className="text-lg font-semibold text-slate-500">Shipshape</h1>
      </main>
    );
  }

  return (
    <>
      {failed ? (
        <div className="bg-rose-600 px-4 py-2 text-sm text-white">
          The sample trip could not load: {failed}
        </div>
      ) : null}
      <RouterProvider router={router} />
      <UpdatePrompt />
    </>
  );
}
