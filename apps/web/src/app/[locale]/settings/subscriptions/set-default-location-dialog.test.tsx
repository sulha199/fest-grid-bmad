vi.mock('@/lib/graphql-client', async () => {
  const { GraphQLClient } = await import('graphql-request');
  return {
    graphqlClient: new GraphQLClient('http://localhost:4000/graphql'),
  };
});

vi.mock('../../../../lib/graphql-client', async () => {
  const { GraphQLClient } = await import('graphql-request');
  return {
    graphqlClient: new GraphQLClient('http://localhost:4000/graphql'),
  };
});

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll, afterEach, afterAll } from 'vitest';
import { http, graphql, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import enMessages from '../../../../../locales/en.json';
import { Toaster } from 'sonner';

const mockPosthogCapture = vi.fn();
const mockCaptureGeo = vi.fn();

vi.mock('@festgrid/analytics', () => ({
  usePostHog: () => ({
    capture: mockPosthogCapture,
  }),
}));

vi.mock('@festgrid/ui', async () => {
  const actual = await vi.importActual<any>('@festgrid/ui');
  return {
    ...actual,
    useCurrentLocationCapture: () => ({
      isAvailable: true,
      isCapturing: false,
      capture: mockCaptureGeo,
    }),
  };
});

import { SetDefaultLocationDialog } from './set-default-location-dialog';
import { server as globalServer } from '../../../../../../../packages/testing-config/vitest.setup';

let mutationVariables: any = null;
let mutationShouldFail = false;

const handleRequest = async ({ request }: { request: any }) => {
  const { query, variables, operationName } = await request.json() as any;

  if (operationName === 'addressAutocomplete' || query?.includes('addressAutocomplete')) {
    return HttpResponse.json({
      data: {
        addressAutocomplete: [
          { placeId: 'place-id-123', description: 'Jakarta Park Suggestion' },
        ],
      },
    });
  }

  if (operationName === 'previewLocation' || query?.includes('previewLocation')) {
    return HttpResponse.json({
      data: {
        previewLocation: {
          coordinates: { lat: -6.2, lng: 106.8 },
          formattedAddress: 'Jakarta, Indonesia (Preview)',
          placeName: 'Jakarta Park',
        },
      },
    });
  }

  if (operationName === 'setAccountDefaultLocation' || query?.includes('setAccountDefaultLocation')) {
    mutationVariables = variables;
    if (mutationShouldFail) {
      return HttpResponse.json({
        errors: [{ message: 'Failed to set default location' }],
      });
    }
    return HttpResponse.json({
      data: {
        setAccountDefaultLocation: {
          id: variables.accountId,
          defaultLocation: {
            coordinates: { lat: -6.2, lng: 106.8 },
            formattedAddress: 'Jakarta, Indonesia (Preview)',
            placeName: 'Jakarta Park',
          },
        },
      },
    });
  }

  if (operationName === 'editAccountDefaultLocation' || query?.includes('editAccountDefaultLocation')) {
    mutationVariables = variables;
    if (mutationShouldFail) {
      return HttpResponse.json({
        errors: [{ message: 'Failed to edit default location' }],
      });
    }
    return HttpResponse.json({
      data: {
        editAccountDefaultLocation: {
          id: variables.accountId,
          defaultLocation: {
            coordinates: { lat: -6.2, lng: 106.8 },
            formattedAddress: 'Jakarta, Indonesia (Preview)',
            placeName: 'Jakarta Park',
          },
          hasPendingDefaultLocationReview: true,
        },
      },
    });
  }

  return new HttpResponse('Not found', { status: 404 });
};

const server = setupServer(
  http.post('http://localhost:4000/graphql', handleRequest),
  http.post('http://localhost:3000/api/graphql', handleRequest),
  http.post('/api/graphql', handleRequest)
);

beforeAll(() => {
  globalServer.close();
  server.listen({ onUnhandledRequest: 'bypass' });
});
afterEach(() => {
  server.resetHandlers();
  cleanup();
  vi.clearAllMocks();
  mutationVariables = null;
  mutationShouldFail = false;
});
afterAll(() => {
  server.close();
  globalServer.listen({ onUnhandledRequest: 'error' });
});

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

describe('SetDefaultLocationDialog', () => {
  it('happy path: types address, selects suggestion, and saves successfully', async () => {
    const handleClose = vi.fn();
    renderWithProviders(
      <SetDefaultLocationDialog accountId="acc-1" isOpen={true} onClose={handleClose} />
    );

    expect(screen.getByText('Set Default Location')).toBeInTheDocument();

    // Type in address autocomplete field
    const input = screen.getByPlaceholderText('Search for an address...');
    fireEvent.change(input, { target: { value: 'Jaka' } });

    // Wait for the mock suggestion to appear
    const suggestion = await screen.findByText('Jakarta Park Suggestion');
    fireEvent.click(suggestion);

    // Click save
    const saveButton = screen.getByRole('button', { name: 'Save' });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mutationVariables).toEqual({
        accountId: 'acc-1',
        input: {
          placeId: 'place-id-123',
        },
      });
    });

    expect(mockPosthogCapture).toHaveBeenCalledWith('subscription_default_location_set', {
      accountId: 'acc-1',
    });

    expect(handleClose).toHaveBeenCalled();
  });

  it('failure path: shows error toast and keeps dialog open on mutation error', async () => {
    mutationShouldFail = true;
    const handleClose = vi.fn();
    renderWithProviders(
      <SetDefaultLocationDialog accountId="acc-1" isOpen={true} onClose={handleClose} />
    );

    const input = screen.getByPlaceholderText('Search for an address...');
    fireEvent.change(input, { target: { value: 'Jaka' } });

    const suggestion = await screen.findByText('Jakarta Park Suggestion');
    fireEvent.click(suggestion);

    const saveButton = screen.getByRole('button', { name: 'Save' });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('Failed to set default location')).toBeInTheDocument();
    });

    expect(handleClose).not.toHaveBeenCalled();
  });

  it('edit mode: pre-populates coordinates and formattedAddress from initialLocation, and saves via edit mutation', async () => {
    const handleClose = vi.fn();
    const initialLocation = {
      coordinates: { lat: -6.1, lng: 106.7 },
      formattedAddress: 'Bali, Indonesia',
      placeName: 'Bali Temple',
      placeId: 'bali-place-id',
    };

    renderWithProviders(
      <SetDefaultLocationDialog
        accountId="acc-1"
        isOpen={true}
        onClose={handleClose}
        mode="edit"
        initialLocation={initialLocation as any}
      />
    );

    expect(screen.getByText('Edit Default Location')).toBeInTheDocument();

    // Verify input prefill
    const input = screen.getByPlaceholderText('Search for an address...');
    expect(input).toHaveValue('Bali, Indonesia');

    // Click save
    const saveButton = screen.getByRole('button', { name: 'Save' });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mutationVariables).toEqual({
        accountId: 'acc-1',
        input: {
          placeId: 'bali-place-id',
        },
      });
    });

    expect(mockPosthogCapture).toHaveBeenCalledWith('subscription_default_location_edited', {
      accountId: 'acc-1',
    });

    expect(handleClose).toHaveBeenCalled();
  });
});
