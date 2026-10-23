import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  configureAnalytics,
  type Sender,
  setShareUsage,
  toScreen,
  trackEvent,
  trackView,
} from '../track';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function setup(overrides: Parameters<typeof configureAnalytics>[0] = {}) {
  const send = vi.fn<Sender>(async () => undefined);
  configureAnalytics({
    send,
    websiteId: 'site-id',
    hostname: 'example.github.io',
    shareUsage: true,
    online: () => true,
    basePath: '/shipshape/',
    ...overrides,
  });
  return send;
}

beforeEach(() => {
  configureAnalytics({ shareUsage: true });
});

describe('when nothing is sent', () => {
  const cases: [string, Parameters<typeof configureAnalytics>[0]][] = [
    ['the website id is missing', { websiteId: '' }],
    ['the build is private', { isPrivate: true }],
    ['the traveller opted out', { shareUsage: false }],
    ['Do Not Track is on', { doNotTrack: true }],
    ['the host is localhost', { hostname: 'localhost' }],
    ['the host is 127.0.0.1', { hostname: '127.0.0.1' }],
  ];
  it.each(cases)('%s', async (_label, overrides) => {
    const send = setup(overrides);
    trackView('/shipshape/');
    trackEvent('item_ticked');
    await flush();
    expect(send).not.toHaveBeenCalled();
  });

  it('switching the setting off stops sending at once', async () => {
    const send = setup();
    setShareUsage(false);
    trackEvent('item_ticked');
    await flush();
    expect(send).not.toHaveBeenCalled();
  });
});

describe('what is sent', () => {
  it('sends a view with the route pattern, a fixed title and no ids', async () => {
    const send = setup();
    trackView('/shipshape/t/europe-2026/bookings/bk-hotel-rome');
    trackEvent('trip_exported', { kind: 'full' });
    await flush();
    expect(send).toHaveBeenCalledTimes(2);
    const bodies = send.mock.calls.map(([body]) => body);
    expect(bodies[0]?.payload).toMatchObject({
      website: 'site-id',
      url: '/t/:tripId/bookings/:bookingId',
      title: 'Shipshape',
    });
    expect(bodies[0]?.payload).not.toHaveProperty('name');
    expect(bodies[1]?.payload).toMatchObject({ name: 'trip_exported', data: { kind: 'full' } });
    const everything = JSON.stringify(send.mock.calls);
    expect(everything).not.toContain('europe-2026');
    expect(everything).not.toContain('bk-');
  });

  it('never throws, even when the sender rejects or throws', async () => {
    const rejecting = vi.fn<Sender>(() => Promise.reject(new Error('blocked')));
    setup({ send: rejecting });
    expect(() => trackEvent('document_opened')).not.toThrow();
    await flush();
    expect(rejecting).toHaveBeenCalledTimes(1);
    setup({
      send: () => {
        throw new Error('sync');
      },
    });
    expect(() => trackEvent('document_opened')).not.toThrow();
    await flush();
  });
});

describe('offline', () => {
  it('holds events, then flushes them when the connection returns', async () => {
    let online = false;
    const send = setup({ online: () => online });
    trackEvent('item_ticked');
    trackEvent('reference_copied');
    await flush();
    expect(send).not.toHaveBeenCalled();
    online = true;
    window.dispatchEvent(new Event('online'));
    await flush();
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('keeps at most 50', async () => {
    let online = false;
    const send = setup({ online: () => online });
    for (let i = 0; i < 60; i += 1) trackEvent('item_ticked');
    await flush();
    online = true;
    window.dispatchEvent(new Event('online'));
    await flush();
    expect(send).toHaveBeenCalledTimes(50);
  });
});

describe('toScreen', () => {
  const B = '/shipshape/';
  const cases: [string, string][] = [
    ['/shipshape/', '/'],
    ['/shipshape', '/'],
    ['/shipshape/t/europe-2026', '/t/:tripId'],
    ['/shipshape/t/europe-2026/today', '/t/:tripId/today'],
    ['/shipshape/t/europe-2026/days', '/t/:tripId/days'],
    ['/shipshape/t/europe-2026/days/europe-2026-d03', '/t/:tripId/days/:dayId'],
    ['/shipshape/t/europe-2026/items/it-1', '/t/:tripId/items/:itemId'],
    ['/shipshape/t/europe-2026/bookings', '/t/:tripId/bookings'],
    ['/shipshape/t/europe-2026/bookings/bk-hotel-rome', '/t/:tripId/bookings/:bookingId'],
    ['/shipshape/t/europe-2026/conflicts', '/t/:tripId/conflicts'],
    ['/shipshape/t/europe-2026/reminders', '/t/:tripId/reminders'],
    ['/shipshape/t/europe-2026/documents', '/t/:tripId/documents'],
    ['/shipshape/t/europe-2026/guide', '/t/:tripId/guide'],
    ['/shipshape/t/europe-2026/more', '/t/:tripId/more'],
    ['/shipshape/t/europe-2026/settings', '/t/:tripId/settings'],
    ['/shipshape/t/europe-2026/playbook', '/t/:tripId/playbook'],
    ['/shipshape/t/europe-2026/playbook/lost-card', '/t/:tripId/playbook/:guideId'],
    ['/shipshape/playbook', '/playbook'],
    ['/shipshape/playbook/lost-card', '/playbook/:guideId'],
    ['/shipshape/settings', '/settings'],
    ['/shipshape/t/europe-2026/days/', '/t/:tripId/days'],
  ];
  it.each(cases)('%s -> %s', (path, expected) => {
    expect(toScreen(path, B)).toBe(expected);
  });

  it('works at the root too', () => {
    expect(toScreen('/t/europe-2026/days/d1', '/')).toBe('/t/:tripId/days/:dayId');
  });

  it('gives /other for anything unknown, never a raw id', () => {
    expect(toScreen('/shipshape/t/europe-2026/secret/bk-1', B)).toBe('/other');
    expect(toScreen('/shipshape/whatever', B)).toBe('/other');
  });
});
