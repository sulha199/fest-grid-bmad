import '@testing-library/jest-dom/vitest';
import React from 'react';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll, afterEach, afterAll, beforeEach } from 'vitest';
import { graphql, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import enMessages from '../../../../../locales/en.json';
import { NotificationsContent } from './notifications-content';
import { graphqlClient } from '@/lib/graphql-client';
import { Toaster } from 'sonner';

const mockRouterPush = vi.fn();
const mockPosthogCapture = vi.fn();
const mockRequestPushPermissionAndRegister = vi.fn();

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({
    push: mockRouterPush,
    replace: vi.fn(),
    back: vi.fn(),
  }),
}));

let mockSession: any = { user: { id: 'user-1', email: 'user@test.dev' } };
let mockAuthLoading = false;
vi.mock('@/components/providers/auth-session-provider', () => ({
  useAuthSession: () => ({
    session: mockSession,
    isLoading: mockAuthLoading,
  }),
}));

vi.mock('@/lib/graphql-client', async () => {
  const { GraphQLClient } = await import('graphql-request');
  return {
    graphqlClient: new GraphQLClient('http://localhost:4000/graphql'),
  };
});

vi.mock('@festgrid/analytics', () => ({
  usePostHog: () => ({
    capture: mockPosthogCapture,
  }),
}));

vi.mock('@/lib/push-notifications', () => ({
  requestPushPermissionAndRegister: () => mockRequestPushPermissionAndRegister(),
}));

let updateUserSettingsVariables: any = null;
let registerFcmTokenVariables: any = null;
let settingsEnabledValue = false;

const server = setupServer(
  graphql.query('getMySettings', () => {
    return HttpResponse.json({
      data: {
        mySettings: {
          id: 'settings-1',
          hidePastEventsAfterDays: 7,
          pushNotificationsEnabled: settingsEnabledValue,
          createdAt: '2026-08-01',
          updatedAt: '2026-08-01',
        },
      },
    });
  }),
  graphql.mutation('updateUserSettings', ({ variables }) => {
    updateUserSettingsVariables = variables;
    return HttpResponse.json({
      data: {
        updateUserSettings: {
          id: 'settings-1',
          hidePastEventsAfterDays: 7,
          pushNotificationsEnabled: variables.input.pushNotificationsEnabled,
          updatedAt: '2026-08-01',
        },
      },
    });
  }),
  graphql.mutation('registerFcmToken', ({ variables }) => {
    registerFcmTokenVariables = variables;
    return HttpResponse.json({
      data: {
        registerFcmToken: 'success',
      },
    });
  })
);

beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
  cleanup();
  vi.clearAllMocks();
  updateUserSettingsVariables = null;
  registerFcmTokenVariables = null;
});
afterAll(() => server.close());

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <Toaster />
        {ui}
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
}

describe('NotificationsContent', () => {
  beforeEach(() => {
    // Mock window.Notification
    (global as any).Notification = {
      permission: 'granted',
      requestPermission: vi.fn().mockResolvedValue('granted'),
    };
  });

  afterEach(() => {
    delete (global as any).Notification;
  });

  it('redirects unauthenticated users to /login', async () => {
    mockSession = null;
    renderWithProviders(<NotificationsContent />);
    expect(mockRouterPush).toHaveBeenCalledWith('/login');
  });

  it('renders with initial toggle value reflecting settings (checked=false)', async () => {
    mockSession = { user: { id: 'user-1' } };
    settingsEnabledValue = false;
    renderWithProviders(<NotificationsContent />);

    await waitFor(() => {
      expect(screen.getByText('Notification Settings')).toBeInTheDocument();
    });

    const toggle = screen.getByRole('switch');
    expect(toggle).not.toBeChecked();
  });

  it('renders with initial toggle value reflecting settings (checked=true) and starts service worker', async () => {
    mockSession = { user: { id: 'user-1' } };
    settingsEnabledValue = true;
    mockRequestPushPermissionAndRegister.mockResolvedValue('test-fcm-token');

    renderWithProviders(<NotificationsContent />);

    await waitFor(() => {
      expect(screen.getByText('Notification Settings')).toBeInTheDocument();
    });

    const toggle = screen.getByRole('switch');
    expect(toggle).toBeChecked();

    await waitFor(() => {
      expect(mockRequestPushPermissionAndRegister).toHaveBeenCalled();
      expect(registerFcmTokenVariables).toEqual({ token: 'test-fcm-token' });
    });
  });

  it('handles null push notification settings by defaulting to true, saving, and starting service worker', async () => {
    mockSession = { user: { id: 'user-1' } };
    // @ts-ignore
    settingsEnabledValue = null;
    mockRequestPushPermissionAndRegister.mockResolvedValue('default-fcm-token');

    renderWithProviders(<NotificationsContent />);

    await waitFor(() => {
      expect(screen.getByText('Notification Settings')).toBeInTheDocument();
    });

    const toggle = screen.getByRole('switch');
    expect(toggle).toBeChecked();

    await waitFor(() => {
      expect(updateUserSettingsVariables).toEqual({
        input: { pushNotificationsEnabled: true },
      });
      expect(mockRequestPushPermissionAndRegister).toHaveBeenCalled();
      expect(registerFcmTokenVariables).toEqual({ token: 'default-fcm-token' });
    });
  });

  it('handles toggle-on success with push permission granted', async () => {
    mockSession = { user: { id: 'user-1' } };
    settingsEnabledValue = false;
    mockRequestPushPermissionAndRegister.mockResolvedValue('test-fcm-token');

    renderWithProviders(<NotificationsContent />);

    await waitFor(() => {
      expect(screen.getByText('Notification Settings')).toBeInTheDocument();
    });

    const toggle = screen.getByRole('switch');
    fireEvent.click(toggle);

    // Verify updateUserSettings mutation called with true
    await waitFor(() => {
      expect(updateUserSettingsVariables).toEqual({
        input: { pushNotificationsEnabled: true },
      });
    });

    // Verify analytics fired and permission/token registered
    await waitFor(() => {
      expect(mockPosthogCapture).toHaveBeenCalledWith('push_notifications_enabled');
      expect(mockRequestPushPermissionAndRegister).toHaveBeenCalled();
      expect(registerFcmTokenVariables).toEqual({ token: 'test-fcm-token' });
    });

    expect(toggle).toBeChecked();
  });

  it('handles toggle-on success with push permission denied and syncs to disabled', async () => {
    mockSession = { user: { id: 'user-1' } };
    settingsEnabledValue = false;
    
    // Explicitly mock permission as denied
    (global as any).Notification = {
      permission: 'denied',
      requestPermission: vi.fn().mockResolvedValue('denied'),
    };
    mockRequestPushPermissionAndRegister.mockResolvedValue(null);

    renderWithProviders(<NotificationsContent />);

    await waitFor(() => {
      expect(screen.getByText('Notification Settings')).toBeInTheDocument();
    });

    const toggle = screen.getByRole('switch');
    fireEvent.click(toggle);

    // Verify it is synced and saved as false because permission is denied
    await waitFor(() => {
      expect(updateUserSettingsVariables).toEqual({
        input: { pushNotificationsEnabled: false },
      });
    });

    // Verify analytics fired, permission denied fired, toast displayed, and synced to disabled
    await waitFor(() => {
      expect(mockPosthogCapture).toHaveBeenCalledWith('push_notifications_enabled');
      expect(mockPosthogCapture).toHaveBeenCalledWith('push_notifications_permission_denied');
      expect(mockPosthogCapture).toHaveBeenCalledWith('push_notifications_disabled');
      expect(screen.getByText(/enable notification permissions in your browser/i)).toBeInTheDocument();
    });

    // Switch should be unchecked to keep in sync with denied browser permission
    expect(toggle).not.toBeChecked();
  });

  it('handles toggle-off success', async () => {
    mockSession = { user: { id: 'user-1' } };
    settingsEnabledValue = true;

    renderWithProviders(<NotificationsContent />);

    await waitFor(() => {
      expect(screen.getByText('Notification Settings')).toBeInTheDocument();
    });

    const toggle = screen.getByRole('switch');
    fireEvent.click(toggle);

    // Verify updateUserSettings mutation called with false
    await waitFor(() => {
      expect(updateUserSettingsVariables).toEqual({
        input: { pushNotificationsEnabled: false },
      });
    });

    await waitFor(() => {
      expect(mockPosthogCapture).toHaveBeenCalledWith('push_notifications_disabled');
    });

    expect(toggle).not.toBeChecked();
  });

  it('reverts switch state and shows toast on mutation failure', async () => {
    mockSession = { user: { id: 'user-1' } };
    settingsEnabledValue = false;

    // Override the mutation endpoint to fail
    server.use(
      graphql.mutation('updateUserSettings', () => {
        return HttpResponse.json({
          errors: [{ message: 'Database failure' }],
        });
      })
    );

    renderWithProviders(<NotificationsContent />);

    await waitFor(() => {
      expect(screen.getByText('Notification Settings')).toBeInTheDocument();
    });

    const toggle = screen.getByRole('switch');
    expect(toggle).not.toBeChecked();

    fireEvent.click(toggle);

    // Verify error toast is displayed and state is reverted back to unchecked
    await waitFor(() => {
      expect(screen.getByText(/failed to update notification settings/i)).toBeInTheDocument();
    });

    expect(toggle).not.toBeChecked();
    expect(mockPosthogCapture).not.toHaveBeenCalled();
  });
});
