import '@testing-library/jest-dom/vitest';
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ModeratorToolsContent } from './moderator-tools-content';
import enMessages from '../../../../../locales/en.json';

// Mock useRouter/Link
const mockPush = vi.fn();
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn(), back: vi.fn() }),
  Link: ({ children, href }: any) => <a href={href}>{children}</a>,
}));

vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }));
vi.mock('@festgrid/analytics', () => ({ usePostHog: () => ({ capture: vi.fn() }) }));

vi.mock('@/features/auth/use-require-moderator', () => ({
  useRequireModerator: () => ({ status: 'authorized' }),
}));

// Mock sub-components so we don't need to mock all their internal queries/hooks
vi.mock('./actor-runs-content', () => ({
  ActorRunsContent: () => <div data-testid="actor-runs-content">Actor Runs Content Panel</div>,
}));
vi.mock('./unprocessed-payloads-content', () => ({
  UnprocessedPayloadsContent: () => <div data-testid="unprocessed-payloads-content">Unprocessed Payloads Content Panel</div>,
}));

let mockTab = 'actor-runs';
const mockSetTab = vi.fn((val) => { mockTab = typeof val === 'function' ? val(mockTab) : val; });

vi.mock('nuqs', () => ({
  useQueryState: (k: string) => k === 'tab' ? [mockTab, mockSetTab] : ['', vi.fn()],
  parseAsStringEnum: () => ({ withDefault: (val: any) => ({ defaultValue: val }) }),
}));

const mergedMessages = {
  ...enMessages,
  ModeratorToolsPage: {
    actorRunsTabLabel: 'Actor Runs',
    unprocessedPayloadsTabLabel: 'Unprocessed Payloads',
    pageHeading: 'Moderator Tools',
    pageDescription: 'Manage scraper operations, runs, and payloads.',
  },
};

describe('ModeratorToolsContent Integration', () => {
  let qc: QueryClient;
  beforeEach(() => {
    qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    vi.clearAllMocks();
  });
  afterEach(() => {
    cleanup();
    mockTab = 'actor-runs';
  });

  it('renders both tab triggers, matches active tab, and updates URL on tab switch', async () => {
    const { rerender } = render(
      <QueryClientProvider client={qc}>
        <NextIntlClientProvider locale="en" messages={mergedMessages}>
          <ModeratorToolsContent />
        </NextIntlClientProvider>
      </QueryClientProvider>
    );

    // Verify page headers are rendered
    expect(screen.getByText('Moderator Tools')).toBeInTheDocument();
    expect(screen.getByText('Manage scraper operations, runs, and payloads.')).toBeInTheDocument();

    // Verify triggers are present
    const actorRunsTrigger = screen.getByRole('tab', { name: /actor runs/i });
    const unprocessedTrigger = screen.getByRole('tab', { name: /unprocessed payloads/i });
    expect(actorRunsTrigger).toBeInTheDocument();
    expect(unprocessedTrigger).toBeInTheDocument();

    // Verify default active tab is Actor Runs
    expect(screen.getByTestId('actor-runs-content')).toBeInTheDocument();
    expect(screen.queryByTestId('unprocessed-payloads-content')).not.toBeInTheDocument();

    // Click unprocessed payloads trigger
    fireEvent.click(unprocessedTrigger);

    // Expect mockSetTab to have been called to update query param
    expect(mockSetTab).toHaveBeenCalledWith('unprocessed-payloads');

    // Simulate query param change
    mockTab = 'unprocessed-payloads';
    rerender(
      <QueryClientProvider client={qc}>
        <NextIntlClientProvider locale="en" messages={mergedMessages}>
          <ModeratorToolsContent />
        </NextIntlClientProvider>
      </QueryClientProvider>
    );

    // Verify it changed panel
    expect(screen.queryByTestId('actor-runs-content')).not.toBeInTheDocument();
    expect(screen.getByTestId('unprocessed-payloads-content')).toBeInTheDocument();
  });
});
