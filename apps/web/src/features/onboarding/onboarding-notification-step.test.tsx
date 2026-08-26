import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { OnboardingNotificationStep } from './onboarding-notification-step';

// Mock next-intl
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

// Mock @festgrid/ui
const mockSetStepCompleted = vi.fn();
vi.mock('@festgrid/ui', () => ({
  useWizardStep: () => ({
    setStepCompleted: mockSetStepCompleted,
  }),
}));

// Mock @festgrid/analytics
const mockCapture = vi.fn();
vi.mock('@festgrid/analytics', () => ({
  usePostHog: () => ({
    capture: mockCapture,
  }),
}));

// Mock graphql queries/mutations
let mockMySettings = { pushNotificationsEnabled: false };
let mockIsLoading = false;
const mockUpdateUserSettings = vi.fn();
const mockRegisterFcmToken = vi.fn();

vi.mock('@/generated/graphql', () => ({
  useGetMySettingsQuery: () => ({
    data: { mySettings: mockMySettings },
    isLoading: mockIsLoading,
  }),
  useUpdateUserSettingsMutation: () => ({
    mutateAsync: mockUpdateUserSettings,
  }),
  useRegisterFcmTokenMutation: () => ({
    mutateAsync: mockRegisterFcmToken,
  }),
}));

// Mock push-notifications utility
const mockRequestPushPermissionAndRegister = vi.fn();
vi.mock('@/lib/push-notifications', () => ({
  requestPushPermissionAndRegister: () => mockRequestPushPermissionAndRegister(),
}));

describe('OnboardingNotificationStep', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMySettings = { pushNotificationsEnabled: false };
    mockIsLoading = false;
    mockRequestPushPermissionAndRegister.mockResolvedValue('test-fcm-token');
    mockUpdateUserSettings.mockResolvedValue({});
    mockRegisterFcmToken.mockResolvedValue({});
  });

  afterEach(() => {
    cleanup();
  });

  it('renders loading state', () => {
    mockIsLoading = true;
    render(<OnboardingNotificationStep />);
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
  });

  it('unconditionally marks step completed on mount', () => {
    render(<OnboardingNotificationStep />);
    expect(mockSetStepCompleted).toHaveBeenCalledWith(true);
  });

  it('renders correct content when loaded', () => {
    render(<OnboardingNotificationStep />);
    expect(screen.getByText('notificationToggleLabel')).toBeInTheDocument();
    expect(screen.getByText('notificationToggleDescription')).toBeInTheDocument();
    expect(screen.getByRole('switch')).toBeInTheDocument();
  });

  it('handles toggle-on success and registers FCM token', async () => {
    mockMySettings = { pushNotificationsEnabled: false };
    render(<OnboardingNotificationStep />);

    const toggle = screen.getByRole('switch');
    expect(toggle).not.toBeChecked();

    fireEvent.click(toggle);

    await waitFor(() => {
      expect(mockUpdateUserSettings).toHaveBeenCalledWith({
        input: { pushNotificationsEnabled: true },
      });
      expect(mockRequestPushPermissionAndRegister).toHaveBeenCalled();
      expect(mockRegisterFcmToken).toHaveBeenCalledWith({ token: 'test-fcm-token' });
      expect(mockCapture).toHaveBeenCalledWith('push_notifications_enabled');
    });

    expect(toggle).toBeChecked();
  });

  it('handles toggle-off success', async () => {
    mockMySettings = { pushNotificationsEnabled: true };
    render(<OnboardingNotificationStep />);

    const toggle = screen.getByRole('switch');
    // Wait for settings to load and sync
    await waitFor(() => {
      expect(toggle).toBeChecked();
    });

    fireEvent.click(toggle);

    await waitFor(() => {
      expect(mockUpdateUserSettings).toHaveBeenCalledWith({
        input: { pushNotificationsEnabled: false },
      });
      expect(mockCapture).toHaveBeenCalledWith('push_notifications_disabled');
    });

    expect(toggle).not.toBeChecked();
  });
});
