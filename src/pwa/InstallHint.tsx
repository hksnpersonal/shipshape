/**
 * Getting the app onto a home screen.
 *
 * Android fires an install event the app can act on. iOS does not, so the only honest
 * thing to do there is tell people where the button is.
 */
import { useEffect, useState } from 'react';
import { Button, Card } from '@/components/ui';

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
}

export function InstallHint() {
  const [deferred, setDeferred] = useState<InstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setDeferred(event as InstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  const standalone =
    typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches;
  const isIos = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);

  if (dismissed || standalone) return null;
  if (!deferred && !isIos) return null;

  return (
    <Card className="mb-4">
      <p className="text-sm font-medium">Put Shipshape on your home screen</p>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        {isIos
          ? 'Tap the share button, then "Add to Home Screen". It then opens full screen and works with no signal.'
          : 'It then opens full screen and works with no signal.'}
      </p>
      <div className="mt-2 flex gap-2">
        {deferred ? (
          <Button variant="primary" onClick={() => void deferred.prompt()}>
            Install
          </Button>
        ) : null}
        <Button onClick={() => setDismissed(true)}>No thanks</Button>
      </div>
    </Card>
  );
}
