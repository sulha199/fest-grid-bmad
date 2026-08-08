import '@testing-library/jest-dom/vitest';
import React from 'react';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll, afterEach, afterAll, beforeEach } from 'vitest';
import { graphql, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import enMessages from '../../../../../locales/en.json';
import { LocationsContent } from './locations-content';
import { graphqlClient } from '@/lib/graphql-client';
import { Toaster } from 'sonner';

// Mock LocationPickerMapPanel to avoid WebGL/Canvas/CSS issues in JSDOM
vi.mock('@festgrid/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@festgrid/ui')>();
  return {
    ...actual,
    LocationPickerMapPanel: (props: any) => {
      return (
        <div
          data-testid="mock-map"
          data-center={JSON.stringify(props.center)}
          data-zoom={props.zoom}
          data-marker={JSON.stringify(props.marker)}
        >
          <button
            type="button"
            data-testid="mock-map-click"
            onClick={() => props.onMarkerChange({ latitude: -6.2000, longitude: 106.8000 })}
          >
            Click Map
          </button>
          <button type="button" onClick={props.onCancel}>Cancel</button>
          <button type="button" disabled={props.isConfirmDisabled} onClick={props.onConfirm}>Confirm location</button>
        </div>
      );
    },
  };
});

const mockRouterPush = vi.fn();
const mockPosthogCapture = vi.fn();

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

const mockLocations = [
  {
    id: 'loc-1',
    name: 'Home',
    locationDetails: {
      formattedAddress: '123 Main St, Springfield',
      placeName: 'Springfield',
      coordinates: { lat: 10, lng: 20 },
    },
    radius: 5000,
    createdAt: '2026-08-01',
    updatedAt: '2026-08-01',
  },
  {
    id: 'loc-2',
    name: 'Work',
    locationDetails: {
      formattedAddress: '456 Business Rd, Metropolis',
      placeName: 'Metropolis',
      coordinates: { lat: 11, lng: 21 },
    },
    radius: 10000,
    createdAt: '2026-08-02',
    updatedAt: '2026-08-02',
  },
];

let deleteCalls: { id: string; action: string }[] = [];

const server = setupServer(
  graphql.query('getMyLocations', () => {
    return HttpResponse.json({
      data: {
        myLocations: mockLocations,
      },
    });
  }),
  graphql.mutation('deleteUserLocation', ({ variables }) => {
    deleteCalls.push({ id: variables.id, action: variables.action });
    return HttpResponse.json({
      data: {
        deleteUserLocation: { id: variables.id },
      },
    });
  })
);

beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
  cleanup();
  vi.clearAllMocks();
  deleteCalls = [];
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

describe('LocationsContent', () => {
  it('redirects unauthenticated users to /login', async () => {
    mockSession = null;
    renderWithProviders(<LocationsContent />);
    expect(mockRouterPush).toHaveBeenCalledWith('/login');
  });

  it('renders loading states and then displays saved locations', async () => {
    mockSession = { user: { id: 'user-1' } };
    renderWithProviders(<LocationsContent />);

    // Shows locations list once loaded
    await waitFor(() => {
      expect(screen.getByText('Home')).toBeInTheDocument();
      expect(screen.getByText('Work')).toBeInTheDocument();
    });

    expect(screen.getByText('123 Main St, Springfield')).toBeInTheDocument();
    expect(screen.getByText('456 Business Rd, Metropolis')).toBeInTheDocument();
  });

  it('triggers soft delete immediately when clicking Delete button and RESTORE on Undo', async () => {
    mockSession = { user: { id: 'user-1' } };
    renderWithProviders(<LocationsContent />);

    await waitFor(() => {
      expect(screen.getByText('Home')).toBeInTheDocument();
    });

    // Tap Delete button for Home
    const deleteButtons = screen.getAllByLabelText('Delete');
    fireEvent.click(deleteButtons[0]);

    // Deletion call is fired immediately with DELETE (AC9)
    await waitFor(() => {
      expect(deleteCalls).toContainEqual({ id: 'loc-1', action: 'DELETE' });
    });

    // Find and click Undo in the toast to fire RESTORE mutation (AC10)
    const undoButton = await screen.findByText('Undo');
    fireEvent.click(undoButton);

    await waitFor(() => {
      expect(deleteCalls).toContainEqual({ id: 'loc-1', action: 'RESTORE' });
    });
  });
});
