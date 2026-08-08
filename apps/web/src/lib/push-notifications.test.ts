import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { requestPushPermissionAndRegister } from './push-notifications';
import { getToken } from 'firebase/messaging';
import { capturePostHogEvent } from '@festgrid/analytics';
import { graphqlClient } from './graphql-client';

vi.mock('firebase/messaging', () => ({
  getMessaging: vi.fn(),
  getToken: vi.fn(),
}));

vi.mock('./firebase-client', () => ({
  getFirebaseApp: vi.fn(() => ({})),
}));

vi.mock('@festgrid/analytics', () => ({
  capturePostHogEvent: vi.fn(),
}));

vi.mock('./graphql-client', () => ({
  graphqlClient: {
    request: vi.fn(() => Promise.resolve(true)),
  },
}));

describe('push-notifications', () => {
  const mockUpdate = vi.fn().mockResolvedValue(undefined);
  const mockRegistration = {
    update: mockUpdate,
  };

  const mockDeleteDatabase = vi.fn(() => ({
    onsuccess: null,
    onerror: null,
    onblocked: null,
  }));

  beforeEach(() => {
    vi.clearAllMocks();

    // Set up standard environment variables
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY = 'test-api-key';
    process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY = 'test-vapid-key';

    const mockRequestPermission = vi.fn().mockResolvedValue('granted');

    // Mock window and navigator globals
    vi.stubGlobal('window', {
      indexedDB: {
        deleteDatabase: mockDeleteDatabase,
      },
      Notification: {
        requestPermission: mockRequestPermission,
      },
    });

    vi.stubGlobal('Notification', {
      requestPermission: mockRequestPermission,
    });

    vi.stubGlobal('navigator', {
      serviceWorker: {
        register: vi.fn().mockResolvedValue(mockRegistration),
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('Scenario 1: registers successfully and calls update()', async () => {
    vi.mocked(getToken).mockResolvedValue('mock-fcm-token');

    const result = await requestPushPermissionAndRegister();

    expect(result).toBe('mock-fcm-token');
    expect(navigator.serviceWorker.register).toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalled();
    expect(getToken).toHaveBeenCalled();
    expect(capturePostHogEvent).not.toHaveBeenCalled();
  });

  it('Scenario 2: handles VersionError, deletes DB, retries and succeeds', async () => {
    // First call to getToken throws VersionError, second succeeds
    const versionError = new Error('IndexedDB version error');
    versionError.name = 'VersionError';

    vi.mocked(getToken)
      .mockRejectedValueOnce(versionError)
      .mockResolvedValueOnce('retry-fcm-token');

    // Make mockDeleteDatabase execute onsuccess immediately
    mockDeleteDatabase.mockImplementation(() => {
      const req: any = {};
      setTimeout(() => {
        if (req.onsuccess) req.onsuccess();
      }, 0);
      return req;
    });

    const result = await requestPushPermissionAndRegister();

    expect(result).toBe('retry-fcm-token');
    expect(mockDeleteDatabase).toHaveBeenCalledWith('firebase-messaging-database');
    expect(navigator.serviceWorker.register).toHaveBeenCalledTimes(2);
    expect(mockUpdate).toHaveBeenCalledTimes(2);
    expect(capturePostHogEvent).toHaveBeenCalledWith('push_notifications_sw_error', {
      errorName: 'VersionError',
      retrySucceeded: true,
    });
    expect(graphqlClient.request).toHaveBeenCalled();
  });

  it('Scenario 3: handles VersionError, retry fails, reports to backend and returns null', async () => {
    const versionError = new Error('IndexedDB version error');
    versionError.name = 'VersionError';

    const secondError = new Error('Other error');

    vi.mocked(getToken)
      .mockRejectedValueOnce(versionError)
      .mockRejectedValueOnce(secondError);

    mockDeleteDatabase.mockImplementation(() => {
      const req: any = {};
      setTimeout(() => {
        if (req.onsuccess) req.onsuccess();
      }, 0);
      return req;
    });

    const result = await requestPushPermissionAndRegister();

    expect(result).toBeNull();
    expect(mockDeleteDatabase).toHaveBeenCalledWith('firebase-messaging-database');
    expect(capturePostHogEvent).toHaveBeenCalledWith('push_notifications_sw_error', {
      errorName: 'VersionError',
      retrySucceeded: false,
    });
    expect(graphqlClient.request).toHaveBeenCalled();
  });

  it('Scenario 4: other non-VersionError error falls through to fallback catch', async () => {
    const regularError = new Error('Permission denied or something else');
    regularError.name = 'Error';

    vi.mocked(getToken).mockRejectedValueOnce(regularError);

    const result = await requestPushPermissionAndRegister();

    expect(result).toBeNull();
    expect(mockDeleteDatabase).not.toHaveBeenCalled();
    expect(capturePostHogEvent).not.toHaveBeenCalled();
    expect(graphqlClient.request).not.toHaveBeenCalled();
  });
});
