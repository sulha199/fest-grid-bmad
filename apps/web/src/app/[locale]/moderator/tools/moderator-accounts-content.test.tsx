import '@testing-library/jest-dom/vitest';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { toast } from 'sonner';
import enMessages from '../../../../../locales/en.json';
import { ModeratorAccountsContent } from './moderator-accounts-content';
import { useQueryModeratorAccountProfiles, useSetImageStorageOptInMutation } from './moderator-accounts-hooks';
import { useRequireModerator } from '@/features/auth/use-require-moderator';

vi.mock('./moderator-accounts-hooks');
vi.mock('@/features/auth/use-require-moderator');
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@festgrid/analytics', () => ({ usePostHog: () => ({ capture: vi.fn() }) }));

const createWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: any) => (
    <QueryClientProvider client={queryClient}>
      <NextIntlClientProvider locale="en" messages={enMessages as any}>{children}</NextIntlClientProvider>
    </QueryClientProvider>
  );
};

describe('ModeratorAccountsContent', () => {
  let mockMutateAsync: any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('matchMedia', vi.fn().mockImplementation(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })));
    mockMutateAsync = vi.fn().mockResolvedValue({ id: '1', isImageStorageOptedIn: true });
    (useSetImageStorageOptInMutation as any).mockReturnValue({ mutateAsync: mockMutateAsync, isPending: false });
    (useQueryModeratorAccountProfiles as any).mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('handles loading & auth states', () => {
    (useRequireModerator as any).mockReturnValue({ status: 'unauthorized' });
    render(<ModeratorAccountsContent />, { wrapper: createWrapper() });
    expect(screen.queryByPlaceholderText('Search by display name, username, or platform...')).not.toBeInTheDocument();
  });

  it('renders empty state', () => {
    (useRequireModerator as any).mockReturnValue({ status: 'authorized' });
    (useQueryModeratorAccountProfiles as any).mockReturnValue({
      data: { queryModeratorAccountProfiles: { edges: [], pageInfo: { hasNextPage: false, endCursor: null }, totalCount: 0 } },
      isLoading: false, error: null, refetch: vi.fn(),
    });
    render(<ModeratorAccountsContent />, { wrapper: createWrapper() });
    expect(screen.getByText('No accounts found')).toBeInTheDocument();
  });

  it('renders accounts in list', () => {
    (useRequireModerator as any).mockReturnValue({ status: 'authorized' });
    (useQueryModeratorAccountProfiles as any).mockReturnValue({
      data: {
        queryModeratorAccountProfiles: {
          edges: [{ node: { id: '1', accountId: 'acc-123', platform: 'INSTAGRAM', username: 'testuser', displayName: 'Test User', isImageStorageOptedIn: false }, cursor: 'cursor-1' }],
          pageInfo: { hasNextPage: false, endCursor: null }, totalCount: 1,
        },
      },
      isLoading: false, error: null, refetch: vi.fn(),
    });
    render(<ModeratorAccountsContent />, { wrapper: createWrapper() });
    expect(screen.getByText('Test User')).toBeInTheDocument();
    expect(screen.getByText('@testuser')).toBeInTheDocument();
  });

  it('triggers mutation and shows success toast when toggled', async () => {
    (useRequireModerator as any).mockReturnValue({ status: 'authorized' });
    (useQueryModeratorAccountProfiles as any).mockReturnValue({
      data: {
        queryModeratorAccountProfiles: {
          edges: [{ node: { id: '1', accountId: 'acc-123', platform: 'INSTAGRAM', username: 'testuser', displayName: 'Test User', isImageStorageOptedIn: false }, cursor: 'cursor-1' }],
          pageInfo: { hasNextPage: false, endCursor: null }, totalCount: 1,
        },
      },
      isLoading: false, error: null, refetch: vi.fn(),
    });

    render(<ModeratorAccountsContent />, { wrapper: createWrapper() });
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);

    expect(mockMutateAsync).toHaveBeenCalledWith({ accountId: '1', optedIn: true });
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Successfully opted in Test User to durable image storage');
    });
  });

  it('shows error toast when mutation fails', async () => {
    mockMutateAsync.mockRejectedValue(new Error('Failed'));
    (useRequireModerator as any).mockReturnValue({ status: 'authorized' });
    (useQueryModeratorAccountProfiles as any).mockReturnValue({
      data: {
        queryModeratorAccountProfiles: {
          edges: [{ node: { id: '1', accountId: 'acc-123', platform: 'INSTAGRAM', username: 'testuser', displayName: 'Test User', isImageStorageOptedIn: false }, cursor: 'cursor-1' }],
          pageInfo: { hasNextPage: false, endCursor: null }, totalCount: 1,
        },
      },
      isLoading: false, error: null, refetch: vi.fn(),
    });

    render(<ModeratorAccountsContent />, { wrapper: createWrapper() });
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to update image storage opt-in status for Test User');
    });
  });
});