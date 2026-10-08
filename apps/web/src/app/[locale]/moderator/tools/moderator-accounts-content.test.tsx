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
});