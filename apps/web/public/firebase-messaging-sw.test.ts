import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';

// Story 10.13 (notify when a job finishes): the service worker's click handler. Like instagram-embed-cache-sw.test.ts, the plain
// .js file is evaluated in an isolated vm context with fake globals. Firebase itself is never loaded (importScripts is a no-op and
// the config has no api key, so the worker stays idle).

const ORIGIN = 'https://app.festdaily.test';

function load(windows: Array<Record<string, unknown>> = []) {
  const source = readFileSync(join(__dirname, 'firebase-messaging-sw.js'), 'utf-8');
  const listeners: Record<string, Array<(event: any) => void>> = {};
  const openWindow = vi.fn().mockResolvedValue(undefined);
  const fakeSelf = {
    addEventListener: (type: string, handler: (event: any) => void) => {
      (listeners[type] ||= []).push(handler);
    },
    skipWaiting: vi.fn(),
    location: new URL(`${ORIGIN}/firebase-messaging-sw.js`),
    clients: { claim: vi.fn(), matchAll: vi.fn().mockResolvedValue(windows), openWindow },
    registration: { showNotification: vi.fn() },
  };
  const context: any = { self: fakeSelf, importScripts: vi.fn(), location: fakeSelf.location, URL, console: { log: vi.fn(), warn: vi.fn() } };
  vm.createContext(context);
  vm.runInContext(source, context);
  return { listeners, openWindow, fakeSelf };
}

function click(listeners: Record<string, Array<(e: any) => void>>, data: unknown) {
  let pending: Promise<unknown> | undefined;
  const event = {
    notification: { data, close: vi.fn() },
    stopImmediatePropagation: vi.fn(),
    waitUntil: vi.fn((p: Promise<unknown>) => {
      pending = p;
    }),
  };
  listeners.notificationclick.forEach((h) => h(event));
  return { event, done: async () => pending };
}

describe('firebase-messaging-sw.js notificationclick (Story 10.13)', () => {
  it('opens a same-origin path in a new tab when none is open', async () => {
    const { listeners, openWindow } = load([]);
    const { event, done } = click(listeners, { type: 'JOB_FINISHED', path: '/jobs/abc' });
    await done();
    expect(event.notification.close).toHaveBeenCalled();
    expect(openWindow).toHaveBeenCalledWith(`${ORIGIN}/jobs/abc`);
  });

  it('focuses an open tab of the app and navigates it', async () => {
    const navigate = vi.fn().mockResolvedValue(undefined);
    const focus = vi.fn().mockResolvedValue({ navigate });
    const { listeners, openWindow } = load([{ url: `${ORIGIN}/en/feed`, focus }]);
    await click(listeners, { path: '/jobs' }).done();
    expect(focus).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(`${ORIGIN}/jobs`);
    expect(openWindow).not.toHaveBeenCalled();
  });

  it('opens a new tab when the open tab cannot be focused', async () => {
    const { listeners, openWindow } = load([{ url: `${ORIGIN}/en`, focus: vi.fn().mockRejectedValue(new Error('no')) }]);
    await click(listeners, { path: '/jobs' }).done();
    expect(openWindow).toHaveBeenCalledWith(`${ORIGIN}/jobs`);
  });

  it('reads the path from the SDK-displayed notification data too', async () => {
    const { listeners, openWindow } = load([]);
    await click(listeners, { FCM_MSG: { data: { path: '/jobs/x' } } }).done();
    expect(openWindow).toHaveBeenCalledWith(`${ORIGIN}/jobs/x`);
  });

  it.each([
    ['an absolute URL', 'https://evil.example/jobs'],
    ['a protocol-relative URL', '//evil.example/jobs'],
    ['a backslash trick', '/\\evil.example'],
    ['a script scheme', 'javascript:alert(1)'],
    ['a relative path', 'jobs'],
    ['a number', 7],
    ['nothing', undefined],
  ])('ignores %s', async (_name, path) => {
    const { listeners, openWindow } = load([]);
    const { event, done } = click(listeners, { path });
    await done();
    expect(openWindow).not.toHaveBeenCalled();
    expect(event.waitUntil).not.toHaveBeenCalled();
    expect(event.stopImmediatePropagation).not.toHaveBeenCalled();
  });

  it('leaves a notification with no data (the new-event push) to the SDK', () => {
    const { listeners } = load([]);
    const { event } = click(listeners, undefined);
    expect(event.notification.close).not.toHaveBeenCalled();
  });
});
