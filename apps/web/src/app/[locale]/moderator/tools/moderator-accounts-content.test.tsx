import '@testing-library/jest-dom/vitest';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cleanup, render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { toast } from 'sonner';
import enMessages from '../../../../../locales/en.json';
import { ModeratorAccountsContent } from './moderator-accounts-content';
import { useQueryModeratorAccountProfiles, useSetImageStorageOptInMutation, useClearAccountDefaultLocationMutation } from './moderator-accounts-hooks';
import { useRequireModerator } from '@/features/auth/use-require-moderator';

vi.mock('./moderator-accounts-hooks');
vi.mock('@/features/auth/use-require-moderator');
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@festgrid/analytics', () => ({ usePostHog: () => ({ capture: vi.fn() }) }));

vi.mock('../../settings/account/set-default-location-dialog', () => ({
  SetDefaultLocationDialog: ({ accountId, isOpen, mode }: any) =>
    isOpen ? (
      <div data-testid="mock-set-default-location-dialog">
        <span>Account: {accountId}</span>
        <span>Mode: {mode}</span>
      </div>
    ) : null,
}));

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
    (useClearAccountDefaultLocationMutation as any).mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue({ id: '1', defaultLocation: null }), isPending: false });
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

  it('renders the location text and pending-review badge when defaultLocation is set', () => {
    (useRequireModerator as any).mockReturnValue({ status: 'authorized' });
    (useQueryModeratorAccountProfiles as any).mockReturnValue({
      data: {
        queryModeratorAccountProfiles: {
          edges: [{
            node: {
              id: '1', accountId: 'acc-123', platform: 'INSTAGRAM', username: 'testuser', displayName: 'Test User', isImageStorageOptedIn: false,
              defaultLocation: { formattedAddress: '123 Main St, Jakarta', placeName: 'Main St' },
              hasPendingDefaultLocationReview: true,
            },
            cursor: 'cursor-1',
          }],
          pageInfo: { hasNextPage: false, endCursor: null }, totalCount: 1,
        },
      },
      isLoading: false, error: null, refetch: vi.fn(),
    });
    render(<ModeratorAccountsContent />, { wrapper: createWrapper() });
    expect(screen.getByText('123 Main St, Jakarta')).toBeInTheDocument();
    expect(screen.getByText('Pending Review')).toBeInTheDocument();
    expect(screen.queryByText('Set Default Location')).not.toBeInTheDocument();
  });

  it('renders the "Set Location" trigger when defaultLocation is unset and opens the dialog in "set" mode', () => {
    (useRequireModerator as any).mockReturnValue({ status: 'authorized' });
    (useQueryModeratorAccountProfiles as any).mockReturnValue({
      data: {
        queryModeratorAccountProfiles: {
          edges: [{
            node: {
              id: '1', accountId: 'acc-123', platform: 'INSTAGRAM', username: 'testuser', displayName: 'Test User', isImageStorageOptedIn: false,
              defaultLocation: null, hasPendingDefaultLocationReview: false,
            },
            cursor: 'cursor-1',
          }],
          pageInfo: { hasNextPage: false, endCursor: null }, totalCount: 1,
        },
      },
      isLoading: false, error: null, refetch: vi.fn(),
    });
    render(<ModeratorAccountsContent />, { wrapper: createWrapper() });
    const setLocationTrigger = screen.getByText('Set Default Location');
    expect(setLocationTrigger).toBeInTheDocument();
    expect(screen.queryByTestId('mock-set-default-location-dialog')).not.toBeInTheDocument();

    fireEvent.click(setLocationTrigger);

    expect(screen.getByTestId('mock-set-default-location-dialog')).toBeInTheDocument();
    expect(screen.getByText('Mode: set')).toBeInTheDocument();
    expect(screen.getByText('Account: 1')).toBeInTheDocument();
  });

  it('opens the edit dialog in "edit" mode when the Pencil icon is clicked on a set location', () => {
    (useRequireModerator as any).mockReturnValue({ status: 'authorized' });
    (useQueryModeratorAccountProfiles as any).mockReturnValue({
      data: {
        queryModeratorAccountProfiles: {
          edges: [{
            node: {
              id: '1', accountId: 'acc-123', platform: 'INSTAGRAM', username: 'testuser', displayName: 'Test User', isImageStorageOptedIn: false,
              defaultLocation: { formattedAddress: '123 Main St, Jakarta', placeName: 'Main St' },
              hasPendingDefaultLocationReview: false,
            },
            cursor: 'cursor-1',
          }],
          pageInfo: { hasNextPage: false, endCursor: null }, totalCount: 1,
        },
      },
      isLoading: false, error: null, refetch: vi.fn(),
    });
    render(<ModeratorAccountsContent />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByRole('button', { name: 'Edit Default Location' }));

    expect(screen.getByTestId('mock-set-default-location-dialog')).toBeInTheDocument();
    expect(screen.getByText('Mode: edit')).toBeInTheDocument();
    expect(screen.getByText('Account: 1')).toBeInTheDocument();
  });

  it('opens the clear-confirm dialog and calls the clear mutation, showing a success toast on confirm', async () => {
    const mockClearMutateAsync = vi.fn().mockResolvedValue({ id: '1', defaultLocation: null });
    (useClearAccountDefaultLocationMutation as any).mockReturnValue({ mutateAsync: mockClearMutateAsync, isPending: false });
    (useRequireModerator as any).mockReturnValue({ status: 'authorized' });
    const refetch = vi.fn();
    (useQueryModeratorAccountProfiles as any).mockReturnValue({
      data: {
        queryModeratorAccountProfiles: {
          edges: [{
            node: {
              id: '1', accountId: 'acc-123', platform: 'INSTAGRAM', username: 'testuser', displayName: 'Test User', isImageStorageOptedIn: false,
              defaultLocation: { formattedAddress: '123 Main St, Jakarta', placeName: 'Main St' },
              hasPendingDefaultLocationReview: false,
            },
            cursor: 'cursor-1',
          }],
          pageInfo: { hasNextPage: false, endCursor: null }, totalCount: 1,
        },
      },
      isLoading: false, error: null, refetch,
    });
    render(<ModeratorAccountsContent />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByRole('button', { name: 'Clear location' }));

    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toBeInTheDocument();
    const confirmButton = within(dialog).getByRole('button', { name: 'Clear location' });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(mockClearMutateAsync).toHaveBeenCalledWith({ accountId: '1' });
    });
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Default location cleared successfully');
    });
    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });
    expect(refetch).toHaveBeenCalled();
  });

  it('shows an error toast and leaves the clear-confirm dialog open when the clear mutation fails', async () => {
    const mockClearMutateAsync = vi.fn().mockRejectedValue(new Error('boom'));
    (useClearAccountDefaultLocationMutation as any).mockReturnValue({ mutateAsync: mockClearMutateAsync, isPending: false });
    (useRequireModerator as any).mockReturnValue({ status: 'authorized' });
    (useQueryModeratorAccountProfiles as any).mockReturnValue({
      data: {
        queryModeratorAccountProfiles: {
          edges: [{
            node: {
              id: '1', accountId: 'acc-123', platform: 'INSTAGRAM', username: 'testuser', displayName: 'Test User', isImageStorageOptedIn: false,
              defaultLocation: { formattedAddress: '123 Main St, Jakarta', placeName: 'Main St' },
              hasPendingDefaultLocationReview: false,
            },
            cursor: 'cursor-1',
          }],
          pageInfo: { hasNextPage: false, endCursor: null }, totalCount: 1,
        },
      },
      isLoading: false, error: null, refetch: vi.fn(),
    });
    render(<ModeratorAccountsContent />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByRole('button', { name: 'Clear location' }));
    const dialog = screen.getByRole('alertdialog');
    const confirmButton = within(dialog).getByRole('button', { name: 'Clear location' });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to clear default location');
    });
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });

  // Story 0.i5c / AD-18: the page pages through the shared useListPaginationController, so it gains
  // previous-page navigation and a page/total readout, and a filter change returns to page 1.
  describe('pagination', () => {
    // Three pages of 20 over 45 accounts: the cursor each page is fetched with picks the page.
    const pages: Record<string, { name: string; hasNextPage: boolean; endCursor: string | null }> = {
      first: { name: 'Account On Page One', hasNextPage: true, endCursor: 'c1' },
      c1: { name: 'Account On Page Two', hasNextPage: true, endCursor: 'c2' },
      c2: { name: 'Account On Page Three', hasNextPage: false, endCursor: null },
    };

    const queryWith = (filters: any, cursor: string | undefined) => {
      const page = pages[cursor ?? 'first'];
      return {
        data: {
          queryModeratorAccountProfiles: {
            edges: [{ node: { id: page.name, accountId: page.name, platform: 'INSTAGRAM', username: 'u', displayName: page.name, isImageStorageOptedIn: false }, cursor: page.endCursor ?? 'last' }],
            pageInfo: { hasNextPage: page.hasNextPage, endCursor: page.endCursor },
            totalCount: 45,
          },
        },
        isLoading: false, error: null, refetch: vi.fn(),
      };
    };

    beforeEach(() => {
      (useRequireModerator as any).mockReturnValue({ status: 'authorized' });
      (useQueryModeratorAccountProfiles as any).mockImplementation(queryWith);
    });

    const lastCall = () => {
      const calls = (useQueryModeratorAccountProfiles as any).mock.calls;
      return calls[calls.length - 1] as [{ search?: string }, string | undefined, number, boolean];
    };

    it('shows the current page and the total, with Previous disabled on the first page', () => {
      render(<ModeratorAccountsContent />, { wrapper: createWrapper() });
      expect(screen.getByText('Account On Page One')).toBeInTheDocument();
      expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
      expect(screen.getByText('45 total')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Previous' })).toHaveAttribute('aria-disabled', 'true');
      expect(screen.getByRole('button', { name: 'Next' })).toHaveAttribute('aria-disabled', 'false');
    });

    it('goes forward and back, fetching each page with its own cursor', () => {
      render(<ModeratorAccountsContent />, { wrapper: createWrapper() });

      fireEvent.click(screen.getByRole('button', { name: 'Next' }));
      expect(lastCall()[1]).toBe('c1');
      expect(screen.getByText('Account On Page Two')).toBeInTheDocument();
      expect(screen.getByText('Page 2 of 3')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Previous' })).toHaveAttribute('aria-disabled', 'false');

      fireEvent.click(screen.getByRole('button', { name: 'Next' }));
      expect(lastCall()[1]).toBe('c2');
      expect(screen.getByText('Page 3 of 3')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Next' })).toHaveAttribute('aria-disabled', 'true');

      fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
      expect(lastCall()[1]).toBe('c1');
      expect(screen.getByText('Account On Page Two')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
      expect(lastCall()[1]).toBeUndefined();
      expect(screen.getByText('Account On Page One')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Previous' })).toHaveAttribute('aria-disabled', 'true');
    });

    it('returns to page 1 when the search changes (BUG-019: a filter change must not append to or stay on a later page)', () => {
      render(<ModeratorAccountsContent />, { wrapper: createWrapper() });

      fireEvent.click(screen.getByRole('button', { name: 'Next' }));
      expect(screen.getByText('Page 2 of 3')).toBeInTheDocument();

      fireEvent.change(screen.getByPlaceholderText('Search by display name, username, or platform...'), { target: { value: 'taylor' } });

      const [filters, cursor] = lastCall();
      expect(filters.search).toBe('taylor');
      expect(cursor).toBeUndefined();
      expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Previous' })).toHaveAttribute('aria-disabled', 'true');
      // Next works again straight away: the reset did not leave the controller thinking there is nothing more.
      expect(screen.getByRole('button', { name: 'Next' })).toHaveAttribute('aria-disabled', 'false');
    });
  });
});
