/**
 * Cookieless usage counts for the public build (Umami Cloud).
 *
 * Privacy is the point of this file. Screens are reported as route patterns
 * (`/t/:tripId/days/:dayId`), never with the ids in them; named actions carry no free text;
 * there is no referrer and the title is fixed. Nothing is sent from a private build, from
 * localhost, with Do Not Track on, or once the traveller has switched it off in Settings.
 * Sending is fire and forget and can never throw into the app.
 */
import { matchRoutes } from 'react-router';
import { settingsRepo } from '@/db/repo';

const ENDPOINT = 'https://gateway.umami.is/api/send';
const QUEUE_CAP = 50;

/** Every event and the only props it may carry: enum literals, never free text. */
interface EventMap {
  document_opened: undefined;
  reference_revealed: undefined;
  reference_copied: undefined;
  emergency_copied: undefined;
  item_ticked: undefined;
  trip_exported: { kind: 'itinerary' | 'full' };
  trip_imported: { mode: 'replace' | 'keep_both' };
  trip_reset_to_sample: undefined;
  install_prompt: { outcome: 'accepted' | 'dismissed' };
  offline_ready: undefined;
}

export interface UmamiBody {
  type: 'event';
  payload: {
    website: string;
    hostname: string;
    url: string;
    title: string;
    language: string;
    screen: string;
    name?: string;
    data?: Record<string, string>;
  };
}

export type Sender = (body: UmamiBody) => Promise<unknown> | void;

export interface AnalyticsConfig {
  send: Sender;
  websiteId: string;
  isPrivate: boolean;
  hostname: string;
  doNotTrack: boolean;
  online: () => boolean;
  basePath: string;
  /** undefined until read from settings; anything but false counts as on. */
  shareUsage: boolean | undefined;
}

/** Same order as `src/app/routes.tsx`; a path matching none of these is '/other'. */
const SCREENS = [
  '/',
  '/t/:tripId',
  '/t/:tripId/today',
  '/t/:tripId/days',
  '/t/:tripId/days/:dayId',
  '/t/:tripId/items/:itemId',
  '/t/:tripId/bookings',
  '/t/:tripId/bookings/:bookingId',
  '/t/:tripId/conflicts',
  '/t/:tripId/reminders',
  '/t/:tripId/documents',
  '/t/:tripId/guide',
  '/t/:tripId/more',
  '/t/:tripId/settings',
  '/t/:tripId/playbook',
  '/t/:tripId/playbook/:guideId',
  '/playbook',
  '/playbook/:guideId',
  '/settings',
];
const SCREEN_ROUTES = SCREENS.map((path) => ({ path }));

const defaultSend: Sender = (body) =>
  fetch(ENDPOINT, {
    method: 'POST',
    keepalive: true,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

const defaults = (): AnalyticsConfig => ({
  send: defaultSend,
  websiteId: import.meta.env.VITE_UMAMI_WEBSITE_ID ?? '',
  isPrivate: import.meta.env.VITE_PRIVATE_TRIP === '1',
  hostname: typeof window === 'undefined' ? '' : window.location.hostname,
  doNotTrack: typeof navigator !== 'undefined' && navigator.doNotTrack === '1',
  online: () => typeof navigator === 'undefined' || navigator.onLine !== false,
  basePath: import.meta.env.BASE_URL,
  shareUsage: undefined,
});

let config: AnalyticsConfig = defaults();
let settingsRead: Promise<void> | null = null;
let queue: UmamiBody[] = [];
let listening = false;
let screen = '/other';

/** For tests: replace parts of the config and reset the queue and read-once state. */
export function configureAnalytics(overrides: Partial<AnalyticsConfig> = {}): void {
  config = { ...defaults(), ...overrides };
  settingsRead = overrides.shareUsage === undefined ? null : Promise.resolve();
  queue = [];
  screen = '/other';
}

export function setShareUsage(on: boolean): void {
  config.shareUsage = on;
  settingsRead = Promise.resolve();
  if (!on) queue = [];
}

/** The route pattern for a path, with every id replaced by its `:param` name. */
export function toScreen(pathname: string, basePath: string = config.basePath): string {
  let path = pathname;
  const base = basePath.replace(/\/+$/, '');
  if (base && (path === base || path.startsWith(`${base}/`))) path = path.slice(base.length);
  path = path.replace(/\/+$/, '') || '/';
  return matchRoutes(SCREEN_ROUTES, path)?.[0]?.route.path ?? '/other';
}

const enabled = (c: AnalyticsConfig) =>
  c.websiteId !== '' &&
  !c.isPrivate &&
  c.hostname !== 'localhost' &&
  c.hostname !== '127.0.0.1' &&
  !c.doNotTrack &&
  c.shareUsage !== false;

function deliver(body: UmamiBody): void {
  try {
    void Promise.resolve(config.send(body)).catch(() => undefined);
  } catch {
    // Analytics must never break the app.
  }
}

function flush(): void {
  if (!enabled(config) || !config.online()) return;
  const pending = queue;
  queue = [];
  pending.forEach(deliver);
}

function emit(name?: string, data?: Record<string, string>): void {
  try {
    settingsRead ??= settingsRepo
      .get()
      .then((s) => {
        if (config.shareUsage === undefined) config.shareUsage = s.shareUsage;
      })
      .catch(() => undefined);
    if (!listening && typeof window !== 'undefined') {
      listening = true;
      window.addEventListener('online', flush);
    }
    // The screen at the moment of the action, not after the settings read resolves.
    const c = config;
    const url = screen;
    void settingsRead.then(() => {
      if (!enabled(c)) return;
      const body: UmamiBody = {
        type: 'event',
        payload: {
          website: c.websiteId,
          hostname: c.hostname,
          url,
          title: 'Shipshape',
          language: typeof navigator === 'undefined' ? '' : navigator.language,
          screen:
            typeof window === 'undefined' ? '' : `${window.screen.width}x${window.screen.height}`,
          ...(name ? { name } : {}),
          ...(data ? { data } : {}),
        },
      };
      if (c.online()) {
        deliver(body);
      } else {
        queue.push(body);
        if (queue.length > QUEUE_CAP) queue.shift();
      }
    });
  } catch {
    // Analytics must never break the app.
  }
}

export function trackView(pathname: string): void {
  screen = toScreen(pathname);
  emit();
}

export function trackEvent<N extends keyof EventMap>(
  name: N,
  ...args: EventMap[N] extends undefined ? [] : [props: EventMap[N]]
): void {
  emit(name, args[0] as Record<string, string> | undefined);
}
