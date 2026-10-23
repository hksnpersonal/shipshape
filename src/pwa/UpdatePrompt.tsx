/**
 * Offline readiness and updates.
 *
 * The service worker never reloads the page on its own. Someone reading a platform
 * number on a concourse should not have the screen replaced underneath them, so a new
 * version waits behind a button until they tap it.
 */
import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { trackEvent } from '@/analytics/track';
import { Button } from '@/components/ui';

export function UpdatePrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      // Look for a new version hourly while the app is open.
      if (registration) setInterval(() => void registration.update(), 60 * 60 * 1000);
    },
  });

  useEffect(() => {
    if (offlineReady) trackEvent('offline_ready');
  }, [offlineReady]);

  // "Ready offline" is news, not a question: it clears itself rather than sitting over
  // the bottom of the screen until someone finds the button. A new version still waits.
  useEffect(() => {
    if (!offlineReady || needRefresh) return;
    const timer = window.setTimeout(() => setOfflineReady(false), 5000);
    return () => window.clearTimeout(timer);
  }, [offlineReady, needRefresh, setOfflineReady]);

  if (!offlineReady && !needRefresh) return null;

  return (
    <div className="fixed inset-x-3 bottom-20 z-50 rounded-xl border border-slate-300 bg-white p-3 shadow-lg md:bottom-4 md:left-auto md:w-80 dark:border-slate-600 dark:bg-slate-800">
      <p className="text-sm font-medium">
        {needRefresh ? 'A new version is ready.' : 'Ready to use without a connection.'}
      </p>
      <div className="mt-2 flex gap-2">
        {needRefresh ? (
          <Button variant="primary" onClick={() => void updateServiceWorker(true)}>
            Reload now
          </Button>
        ) : null}
        <Button
          onClick={() => {
            setOfflineReady(false);
            setNeedRefresh(false);
          }}
        >
          {needRefresh ? 'Later' : 'Got it'}
        </Button>
      </div>
    </div>
  );
}
