import '@testing-library/jest-dom/vitest';
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import { AccountSettingsContent } from './account-settings-content';

// Mock sub-components
vi.mock('./api-keys-content', () => ({
  ApiKeysContent: () => <div data-testid="api-keys-content">API Keys Content</div>,
}));

vi.mock('./subscriptions-content', () => ({
  SubscriptionsContent: () => <div data-testid="subscriptions-content">Subscriptions Content</div>,
}));

vi.mock('./notifications-content', () => ({
  NotificationsContent: () => <div data-testid="notifications-content">Notifications Content</div>,
}));

vi.mock('@/app/[locale]/posts/select/posts-select-content', () => ({
  PostsSelectContent: () => <div data-testid="posts-select-content">Posts Content</div>,
}));

// Mock routing & analytics
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  }),
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}));

// Mock nuqs
let mockTabState = 'api-keys';
const mockSetTabState = vi.fn((val) => {
  if (typeof val === 'function') {
    mockTabState = val(mockTabState);
  } else {
    mockTabState = val;
  }
});

vi.mock('nuqs', () => {
  return {
    useQueryState: (key: string, options?: any) => {
      if (key === 'tab') {
        return [mockTabState, mockSetTabState];
      }
      return ['', vi.fn()];
    },
    parseAsStringEnum: () => ({
      withDefault: (val: any) => ({ defaultValue: val }),
    }),
  };
});

const mockMessages = {
  AccountSettings: {
    apiKeysTabLabel: 'API Keys',
    subscribedAccountsTabLabel: 'Subscribed Accounts',
    postsTabLabel: 'Posts',
    notificationsTabLabel: 'Notifications',
  },
};

describe('AccountSettingsContent', () => {
  afterEach(() => {
    cleanup();
    mockTabState = 'api-keys';
    vi.clearAllMocks();
  });

  it('renders all four tab triggers with correct labels', () => {
    render(
      <NextIntlClientProvider locale="en" messages={mockMessages}>
        <AccountSettingsContent />
      </NextIntlClientProvider>
    );

    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(4);
    expect(tabs[0]).toHaveTextContent('API Keys');
    expect(tabs[1]).toHaveTextContent('Subscribed Accounts');
    expect(tabs[2]).toHaveTextContent('Posts');
    expect(tabs[3]).toHaveTextContent('Notifications');
  });

  it('renders API Keys by default and responds to tab change', () => {
    render(
      <NextIntlClientProvider locale="en" messages={mockMessages}>
        <AccountSettingsContent />
      </NextIntlClientProvider>
    );

    // Default tab should be active
    expect(screen.getByTestId('api-keys-content')).toBeInTheDocument();
    expect(screen.queryByTestId('subscriptions-content')).not.toBeInTheDocument();

    const tabs = screen.getAllByRole('tab');
    
    // Click on Subscribed Accounts tab
    fireEvent.click(tabs[1]);
    expect(mockSetTabState).toHaveBeenCalledWith('subscriptions');
  });
});
