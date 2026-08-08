import '@testing-library/jest-dom/vitest';
import React from 'react';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, beforeAll, afterEach, afterAll } from 'vitest';
import { graphql, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import enMessages from '../../../../../locales/en.json';
import { LocationFormDialog, UserLocation } from './location-form-dialog';
import { graphqlClient } from '@/lib/graphql-client';

vi.mock('@/lib/graphql-client', async () => {
  const { GraphQLClient } = await import('graphql-request');
  return {
    graphqlClient: new GraphQLClient('http://localhost:4000/graphql'),
  };
});

// Mock LocationPickerMapPanel to avoid WebGL/Canvas issues in JSDOM
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
          <input
            type="text"
            placeholder={props.labels?.mapSearchPlaceholder ?? "Search address inside map..."}
            value={props.searchValue}
            onChange={(e) => props.onSearchInputChange(e.target.value)}
          />
          {props.suggestions.map((s: any) => (
            <button
              key={s.placeId}
              type="button"
              onClick={() => props.onSelectSuggestion(s.placeId, s.description)}
            >
              {s.description}
            </button>
          ))}
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

const mockSuggestions = [
  { placeId: 'place-1', description: '123 Main St, Springfield' },
  { placeId: 'place-2', description: '456 Business Rd, Metropolis' },
];

let createCalls: any[] = [];
let updateCalls: any[] = [];

const server = setupServer(
  graphql.query('addressAutocomplete', () => {
    return HttpResponse.json({
      data: {
        addressAutocomplete: mockSuggestions,
      },
    });
  }),
  graphql.query('previewLocation', ({ variables }) => {
    const lat = variables.latitude !== undefined && variables.latitude !== null ? variables.latitude : -6.2088;
    const lng = variables.longitude !== undefined && variables.longitude !== null ? variables.longitude : 106.8456;
    return HttpResponse.json({
      data: {
        previewLocation: {
          formattedAddress: `Resolved Address at ${lat}, ${lng}`,
          placeName: 'Resolved Location',
          coordinates: { lat, lng },
          provider: 'GEOAPIFY',
        },
      },
    });
  }),
  graphql.mutation('createUserLocation', ({ variables }) => {
    createCalls.push(variables.input);
    return HttpResponse.json({
      data: {
        createUserLocation: {
          id: 'new-loc-id',
          name: variables.input.name,
          locationDetails: {
            formattedAddress: 'Resolved Address at -6.2088, 106.8456',
            coordinates: { lat: -6.2088, lng: 106.8456 },
          },
          radius: variables.input.radius,
          createdAt: '2026-08-01',
          updatedAt: '2026-08-01',
        },
      },
    });
  }),
  graphql.mutation('updateUserLocation', ({ variables }) => {
    updateCalls.push({ id: variables.id, input: variables.input });
    return HttpResponse.json({
      data: {
        updateUserLocation: {
          id: variables.id,
          name: variables.input.name || 'Updated Name',
          locationDetails: {
            formattedAddress: 'Resolved Address at -6.2088, 106.8456',
            coordinates: { lat: -6.2088, lng: 106.8456 },
          },
          radius: variables.input.radius || 5000,
          createdAt: '2026-08-01',
          updatedAt: '2026-08-01',
        },
      },
    });
  })
);

beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
  cleanup();
  vi.clearAllMocks();
  createCalls = [];
  updateCalls = [];
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
        {ui}
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
}

describe('LocationFormDialog', () => {
  beforeEach(() => {
    // Stub Geolocation by default
    vi.stubGlobal('navigator', {
      geolocation: {
        getCurrentPosition: vi.fn((success) =>
          success({
            coords: { latitude: -6.2088, longitude: 106.8456 },
          })
        ),
      },
    });
  });

  it('renders correctly in Add mode and validates inputs', async () => {
    const handleClose = vi.fn();
    renderWithProviders(<LocationFormDialog isOpen={true} onClose={handleClose} />);

    expect(screen.getByText('Add a New Location')).toBeInTheDocument();

    const saveButton = screen.getByRole('button', { name: 'Save' });
    expect(saveButton).toBeDisabled();

    // Fill out Name
    const nameInput = screen.getByLabelText('Name');
    fireEvent.change(nameInput, { target: { value: 'Home' } });
    expect(saveButton).toBeDisabled(); // Address still missing

    // Type address search
    const addressInput = screen.getByLabelText('Address');
    fireEvent.change(addressInput, { target: { value: 'Springfield' } });

    // Wait for autocomplete suggestions and select one
    await waitFor(() => {
      expect(screen.getByText('123 Main St, Springfield')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('123 Main St, Springfield'));

    // Save should now be enabled
    expect(saveButton).toBeEnabled();

    // Submit form
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(createCalls.length).toBeGreaterThanOrEqual(1);
    });

    expect(createCalls[0]).toEqual({
      name: 'Home',
      placeId: 'place-1',
      radius: 5000, // default 5 km in meters
    });
  });

  it('renders correctly in Edit mode and omits placeId if address is untouched', async () => {
    const handleClose = vi.fn();
    const existingLocation: UserLocation = {
      id: 'loc-1',
      name: 'Work',
      locationDetails: {
        formattedAddress: '456 Business Rd, Metropolis',
        coordinates: { lat: 10, lng: 20 },
      },
      radius: 10000,
    };

    renderWithProviders(
      <LocationFormDialog isOpen={true} onClose={handleClose} location={existingLocation} />
    );

    expect(screen.getByText('Edit Location')).toBeInTheDocument();

    const nameInput = screen.getByLabelText('Name');
    expect(nameInput).toHaveValue('Work');

    const addressInput = screen.getByLabelText('Address');
    expect(addressInput).toHaveValue('456 Business Rd, Metropolis');

    const saveButton = screen.getByRole('button', { name: 'Save' });
    expect(saveButton).toBeEnabled();

    // Modify name only
    fireEvent.change(nameInput, { target: { value: 'New Work Name' } });

    // Submit form
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(updateCalls.length).toBeGreaterThanOrEqual(1);
    });

    expect(updateCalls[0]).toEqual({
      id: 'loc-1',
      input: {
        name: 'New Work Name',
        radius: 10000,
        placeId: undefined, // omitted because address was untouched
      },
    });
  });

  it('renders a spinner and searching text when autocomplete is loading', async () => {
    const handleClose = vi.fn();
    // Intercept addressAutocomplete query to delay its response
    server.use(
      graphql.query('addressAutocomplete', async () => {
        await new Promise((resolve) => setTimeout(resolve, 500));
        return HttpResponse.json({
          data: {
            addressAutocomplete: mockSuggestions,
          },
        });
      })
    );

    renderWithProviders(<LocationFormDialog isOpen={true} onClose={handleClose} />);

    // Type address search (requires >= 3 chars)
    const addressInput = screen.getByLabelText('Address');
    fireEvent.change(addressInput, { target: { value: 'Spring' } });

    // While it is loading, check for the "Searching..." text and the spinner element
    await waitFor(() => {
      const searchingContainer = screen.getByText('Searching...');
      expect(searchingContainer).toBeInTheDocument();
      expect(searchingContainer.querySelector('.animate-spin')).toBeInTheDocument();
    });
  });

  // Story 2.4 Specific Tests
  it('supports the "Use my current location" happy path', async () => {
    const handleClose = vi.fn();
    renderWithProviders(<LocationFormDialog isOpen={true} onClose={handleClose} />);

    // Fill name
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'My Current Spot' } });

    // Click "Use my current location"
    const currentLocBtn = screen.getByRole('button', { name: 'Use my current location' });
    fireEvent.click(currentLocBtn);

    const addressInput = screen.getByLabelText('Address');

    // Should resolve address successfully and enable Save button
    await waitFor(() => {
      expect(addressInput).toHaveValue('Resolved Address at -6.2088, 106.8456');
    });

    const saveButton = screen.getByRole('button', { name: 'Save' });
    expect(saveButton).toBeEnabled();

    // Submit
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(createCalls.length).toBeGreaterThanOrEqual(1);
    });

    expect(createCalls[0]).toEqual({
      name: 'My Current Spot',
      latitude: -6.2088,
      longitude: 106.8456,
      radius: 5000,
    });
  });

  it('handles "Use my current location" failure states', async () => {
    const handleClose = vi.fn();

    // Mock geolocation error (Permission Denied)
    vi.stubGlobal('navigator', {
      geolocation: {
        getCurrentPosition: vi.fn((success, error) =>
          error({
            code: 1, // PERMISSION_DENIED
            PERMISSION_DENIED: 1,
            POSITION_UNAVAILABLE: 2,
            TIMEOUT: 3,
          })
        ),
      },
    });

    renderWithProviders(<LocationFormDialog isOpen={true} onClose={handleClose} />);

    // Click "Use my current location"
    const currentLocBtn = screen.getByRole('button', { name: 'Use my current location' });
    fireEvent.click(currentLocBtn);

    // Expect inline permission-denied error message
    await waitFor(() => {
      expect(screen.getByTestId('geolocation-error')).toHaveTextContent(
        'Permission to access location was denied.'
      );
    });

    // Address input should not have coordinates set
    const addressInput = screen.getByLabelText('Address');
    expect(addressInput).toHaveValue('');
  });

  it('supports the "Pick on map" happy path', async () => {
    const handleClose = vi.fn();
    renderWithProviders(<LocationFormDialog isOpen={true} onClose={handleClose} />);

    // Fill name
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Map Spot' } });

    // Click "Pick on map" to open sheet
    const pickOnMapBtn = screen.getByRole('button', { name: 'Pick on map' });
    fireEvent.click(pickOnMapBtn);

    // Expect MapPickerSheet content to render (Select location on map title)
    expect(screen.getByText('Select location on map')).toBeInTheDocument();

    // Confirm button should be disabled initially on map because no coordinates clicked yet
    const confirmBtn = screen.getByRole('button', { name: 'Confirm location' });
    expect(confirmBtn).toBeDisabled();

    // Simulate clicking on the map (emitted by MockMapView)
    fireEvent.click(screen.getByTestId('mock-map-click'));

    // Confirm should now be enabled
    expect(confirmBtn).toBeEnabled();

    // Click confirm
    fireEvent.click(confirmBtn);

    // Sheet should close and immediately show "resolving address..."
    const addressInput = screen.getByLabelText('Address');
    expect(addressInput).toHaveValue('resolving address...');

    // Should resolve address successfully
    await waitFor(() => {
      expect(addressInput).toHaveValue('Resolved Address at -6.2, 106.8');
    });

    const saveButton = screen.getByRole('button', { name: 'Save' });
    expect(saveButton).toBeEnabled();

    // Submit
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(createCalls.length).toBeGreaterThanOrEqual(1);
    });

    expect(createCalls[0]).toEqual({
      name: 'Map Spot',
      latitude: -6.2,
      longitude: 106.8,
      radius: 5000,
    });
  });

  it('leaves state unchanged when Map Picker is cancelled', async () => {
    const handleClose = vi.fn();
    renderWithProviders(<LocationFormDialog isOpen={true} onClose={handleClose} />);

    const addressInput = screen.getByLabelText('Address');
    expect(addressInput).toHaveValue('');

    // Open map sheet
    fireEvent.click(screen.getByRole('button', { name: 'Pick on map' }));

    // Click map
    fireEvent.click(screen.getByTestId('mock-map-click'));

    // Cancel map picking
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    // Expect sheet is closed and address stays completely empty
    expect(screen.queryByText('Select location on map')).not.toBeInTheDocument();
    expect(addressInput).toHaveValue('');
  });

  it('reverts coordinate selection to search mode if user types in Address field', async () => {
    const handleClose = vi.fn();
    renderWithProviders(<LocationFormDialog isOpen={true} onClose={handleClose} />);

    // Capture coordinates via Current Location
    fireEvent.click(screen.getByRole('button', { name: 'Use my current location' }));

    await waitFor(() => {
      expect(screen.getByLabelText('Address')).toHaveValue('Resolved Address at -6.2088, 106.8456');
    });

    // Type in address field directly
    const addressInput = screen.getByLabelText('Address');
    fireEvent.change(addressInput, { target: { value: 'Something Else' } });

    // Expect save button to be disabled since coordinates are cleared and autocomplete placeId is not selected yet
    const saveButton = screen.getByRole('button', { name: 'Save' });
    expect(saveButton).toBeDisabled();
  });

  it('falls back to raw coordinates if preview query fails', async () => {
    const handleClose = vi.fn();

    // Mock previewLocation query failure
    server.use(
      graphql.query('previewLocation', () => {
        return HttpResponse.error();
      })
    );

    renderWithProviders(<LocationFormDialog isOpen={true} onClose={handleClose} />);

    // Fill name
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Failed Preview Spot' } });

    // Use current location
    fireEvent.click(screen.getByRole('button', { name: 'Use my current location' }));

    // Address input should display raw coordinates as fallback
    await waitFor(() => {
      expect(screen.getByLabelText('Address')).toHaveValue('Current location (-6.2088, 106.8456)');
    });

    // Save should still be enabled (failure is non-blocking)
    const saveButton = screen.getByRole('button', { name: 'Save' });
    expect(saveButton).toBeEnabled();

    // Submit
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(createCalls.length).toBeGreaterThanOrEqual(1);
    });

    expect(createCalls[0]).toEqual({
      name: 'Failed Preview Spot',
      latitude: -6.2088,
      longitude: 106.8456,
      radius: 5000,
    });
  });

  // Story 2.4 correct-course continuity & in-sheet search tests (AC18-AC20)
  it('updates mapViewState continuity on outside-field search suggestion selection (AC18b)', async () => {
    const handleClose = vi.fn();
    renderWithProviders(<LocationFormDialog isOpen={true} onClose={handleClose} />);

    // Type in Address field
    const addressInput = screen.getByLabelText('Address');
    fireEvent.change(addressInput, { target: { value: 'Springfield' } });

    // Wait for suggestion to render
    await waitFor(() => {
      expect(screen.getByText('123 Main St, Springfield')).toBeInTheDocument();
    });

    // Select the suggestion
    fireEvent.click(screen.getByText('123 Main St, Springfield'));

    // The Address input immediately updates
    expect(addressInput).toHaveValue('123 Main St, Springfield');

    // Wait for background previewLocation resolution to finish updating mapViewState
    await waitFor(() => {
      // Click "Pick on map"
      fireEvent.click(screen.getByRole('button', { name: 'Pick on map' }));
      expect(screen.getByText('Select location on map')).toBeInTheDocument();
    });

    // Verify map is initialized with zoom 15 and is centered on the background-resolved coords
    await waitFor(() => {
      const mockMap = screen.getByTestId('mock-map');
      expect(mockMap).toHaveAttribute('data-zoom', '15');
      const center = JSON.parse(mockMap.getAttribute('data-center') || '{}');
      expect(center.latitude).toBe(-6.2088);
      expect(center.longitude).toBe(106.8456);
    });
  });

  it('preserves mapViewState continuity on cancel and reopen (AC18a)', async () => {
    const handleClose = vi.fn();
    renderWithProviders(<LocationFormDialog isOpen={true} onClose={handleClose} />);

    // Open map sheet
    fireEvent.click(screen.getByRole('button', { name: 'Pick on map' }));

    // Click/interact with map to set marker to -6.2000, 106.8000
    fireEvent.click(screen.getByTestId('mock-map-click'));

    // Cancel map sheet
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    // Reopen map sheet
    fireEvent.click(screen.getByRole('button', { name: 'Pick on map' }));

    // Verify mapViewState survived cancel and the sheet reopened at that exact same marker
    await waitFor(() => {
      const mockMap = screen.getByTestId('mock-map');
      const marker = JSON.parse(mockMap.getAttribute('data-marker') || '{}');
      expect(marker.latitude).toBe(-6.2000);
      expect(marker.longitude).toBe(106.8000);
    });
  });

  it('supports in-sheet search input and dropdown selection without closing the sheet (AC19)', async () => {
    const handleClose = vi.fn();
    renderWithProviders(<LocationFormDialog isOpen={true} onClose={handleClose} />);

    // Open map sheet
    fireEvent.click(screen.getByRole('button', { name: 'Pick on map' }));

    // Verify in-sheet search input is rendered
    const mapSearchInput = screen.getByPlaceholderText('Search address inside map...');
    expect(mapSearchInput).toBeInTheDocument();

    // Type inside map search
    fireEvent.change(mapSearchInput, { target: { value: 'Spring' } });

    // Wait for in-sheet autocomplete suggestions
    await waitFor(() => {
      expect(screen.getByText('123 Main St, Springfield')).toBeInTheDocument();
    });

    // Selecting suggestion updates map marker/center and does NOT close the sheet
    fireEvent.click(screen.getByText('123 Main St, Springfield'));

    // Sheet is still open
    expect(screen.getByText('Select location on map')).toBeInTheDocument();

    // Wait for async previewLocation query inside sheet to resolve and enable confirm button
    const confirmBtn = screen.getByRole('button', { name: 'Confirm location' });
    await waitFor(() => {
      expect(confirmBtn).toBeEnabled();
    });

    fireEvent.click(confirmBtn);

    // Form now resolves the address for the selected coordinates
    const addressInput = screen.getByLabelText('Address');
    await waitFor(() => {
      expect(addressInput).not.toHaveValue('resolving address...');
      expect(addressInput.value).toContain('Resolved Address at');
    });
  });
});
