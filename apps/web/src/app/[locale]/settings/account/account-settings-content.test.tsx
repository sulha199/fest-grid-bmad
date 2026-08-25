import '@testing-library/jest-dom/vitest';
import React from 'react';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AccountSettingsContent } from './account-settings-content';
import { graphqlClient } from '@/lib/graphql-client';
import enMessages from '../../../../../locales/en.json';

const mockPush = vi.fn();
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn(), back: vi.fn() }),
  Link: ({ children, href }: any) => <a href={href}>{children}</a>,
}));

vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }));
vi.mock('@festgrid/analytics', () => ({ usePostHog: () => ({ capture: vi.fn() }) }));

const mockReg = vi.fn().mockResolvedValue('token');
vi.mock('@/lib/push-notifications', () => ({ requestPushPermissionAndRegister: () => mockReg() }));
vi.mock('@/lib/graphql-client', () => ({ graphqlClient: { request: vi.fn() } }));

let mockTab = 'api-keys';
const mockSetTab = vi.fn((val) => { mockTab = typeof val === 'function' ? val(mockTab) : val; });

vi.mock('nuqs', () => ({
  useQueryState: (k: string) => k === 'tab' ? [mockTab, mockSetTab] : ['', vi.fn()],
  parseAsStringEnum: () => ({ withDefault: (val: any) => ({ defaultValue: val }) }),
}));

// Merge real translations with our new AccountSettings translations
const mergedMessages = {
  ...enMessages,
  AccountSettings: {
    apiKeysTabLabel: 'API Keys',
    subscribedAccountsTabLabel: 'Subscribed Accounts',
    postsTabLabel: 'Posts',
    notificationsTabLabel: 'Notifications',
  },
};

const mockSubs = [
  { id: 'sub-1', accountId: 'acc-1', isNewlyAdded: false, isInactive: false, pendingExtractionCount: 0,
    account: { id: 'acc-1', platform: 'instagram', displayName: 'Jakarta Info', username: 'j' } },
  { id: 'sub-2', accountId: 'acc-2', isNewlyAdded: false, isInactive: false, pendingExtractionCount: 0,
    account: { id: 'acc-2', platform: 'instagram', displayName: 'Second Info', username: 'j2' } },
];

vi.mock('@/components/providers/auth-session-provider', () => ({
  useAuthSession: () => ({ session: { user: { id: 'user-1' } }, isLoading: false }),
}));

describe('AccountSettingsContent Integration', () => {
  let qc: QueryClient;
  beforeEach(() => {
    const mockNotification = { permission: 'granted' };
    (global as any).Notification = mockNotification;
    if (typeof window !== 'undefined') {
      (window as any).Notification = mockNotification;
    }

    qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    vi.mocked(graphqlClient.request).mockImplementation(async (arg1: any) => {
      const doc = (arg1?.document?.toString() || arg1?.toString() || '').toLowerCase();
      if (doc.includes('apikeys')) return { myApiKeys: [] };
      if (doc.includes('subscriptions')) return { mySubscriptions: mockSubs };
      if (doc.includes('settings')) return { mySettings: { id: 's1', hidePastEventsAfterDays: 7, pushNotificationsEnabled: true } } ;
      if (doc.includes('quota')) return { myExtractionQuota: { remaining: 3 } };
      if (doc.includes('posts')) return { postsByAccount: { items: [] } };
      return {};
    });
  });
  afterEach(() => {
    cleanup();
    mockTab = 'api-keys';
    vi.clearAllMocks();
    delete (global as any).Notification;
    if (typeof window !== 'undefined') {
      delete (window as any).Notification;
    }
  });

  it('renders and passes AC8 and AC9', async () => {
    const { rerender } = render(
      <QueryClientProvider client={qc}>
        <NextIntlClientProvider locale="en" messages={mergedMessages}>
          <AccountSettingsContent />
        </NextIntlClientProvider>
      </QueryClientProvider>
    );
    await waitFor(() => { expect(screen.getByText('API Keys')).toBeInTheDocument(); });

    // Test AC8
    mockTab = 'notifications';
    rerender(
      <QueryClientProvider client={qc}>
        <NextIntlClientProvider locale="en" messages={mergedMessages}>
          <AccountSettingsContent />
        </NextIntlClientProvider>
      </QueryClientProvider>
    );
    await waitFor(() => { expect(mockReg).toHaveBeenCalledTimes(1); });

    mockTab = 'subscriptions';
    rerender(
      <QueryClientProvider client={qc}>
        <NextIntlClientProvider locale="en" messages={mergedMessages}>
          <AccountSettingsContent />
        </NextIntlClientProvider>
      </QueryClientProvider>
    );

    mockTab = 'notifications';
    rerender(
      <QueryClientProvider client={qc}>
        <NextIntlClientProvider locale="en" messages={mergedMessages}>
          <AccountSettingsContent />
        </NextIntlClientProvider>
      </QueryClientProvider>
    );
    expect(mockReg).toHaveBeenCalledTimes(1);

    // Test AC9
    mockTab = 'posts';
    rerender(
      <QueryClientProvider client={qc}>
        <NextIntlClientProvider locale="en" messages={mergedMessages}>
          <AccountSettingsContent />
        </NextIntlClientProvider>
      </QueryClientProvider>
    );
    await waitFor(() => { expect(screen.getByText('Jakarta Info')).toBeInTheDocument(); });
    fireEvent.click(screen.getByText('Second Info'));

    mockTab = 'subscriptions';
    rerender(
      <QueryClientProvider client={qc}>
        <NextIntlClientProvider locale="en" messages={mergedMessages}>
          <AccountSettingsContent />
        </NextIntlClientProvider>
      </QueryClientProvider>
    );

    mockTab = 'posts';
    rerender(
      <QueryClientProvider client={qc}>
        <NextIntlClientProvider locale="en" messages={mergedMessages}>
          <AccountSettingsContent />
        </NextIntlClientProvider>
      </QueryClientProvider>
    );
    await waitFor(() => { expect(screen.getByText('Second Info').closest('button')).toHaveClass('border-primary'); });
  });
});
