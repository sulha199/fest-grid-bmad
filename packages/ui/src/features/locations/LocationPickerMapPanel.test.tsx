import React from 'react';
import { render, fireEvent, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { LocationPickerMapPanel } from './LocationPickerMapPanel';

// Mock maplibre-gl to avoid WebGL context errors in jsdom
vi.mock('maplibre-gl', () => {
  class MockMap {
    addControl = vi.fn();
    remove = vi.fn();
    setCenter = vi.fn();
    setZoom = vi.fn();
    on = vi.fn();
    getCenter = () => ({ lat: 0, lng: 0 });
    getZoom = () => 12;
  }
  class MockMarker {
    setLngLat = vi.fn().mockReturnThis();
    addTo = vi.fn().mockReturnThis();
    remove = vi.fn();
  }
  return {
    Map: MockMap,
    Marker: MockMarker,
    NavigationControl: vi.fn(),
    setWorkerUrl: vi.fn(),
  };
});

describe('LocationPickerMapPanel Component', () => {
  afterEach(() => {
    cleanup();
  });

  const defaultProps = {
    apiKey: 'test-api-key',
    center: { latitude: -6.2088, longitude: 106.8456 },
    zoom: 12,
    marker: null,
    onMarkerChange: vi.fn(),
    onViewStateChange: vi.fn(),
    searchValue: '',
    onSearchInputChange: vi.fn(),
    suggestions: [],
    isSuggestionsLoading: false,
    onSelectSuggestion: vi.fn(),
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  };

  it('renders search input and action buttons', () => {
    render(<LocationPickerMapPanel {...defaultProps} />);
    expect(screen.getByPlaceholderText('Search address inside map...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm location' })).toBeInTheDocument();
  });

  it('renders custom labels', () => {
    render(
      <LocationPickerMapPanel
        {...defaultProps}
        labels={{
          mapSearchPlaceholder: 'Cari alamat...',
          mapCancelLabel: 'Batal',
          mapConfirmLabel: 'Konfirmasi',
        }}
      />
    );
    expect(screen.getByPlaceholderText('Cari alamat...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Batal' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Konfirmasi' })).toBeInTheDocument();
  });

  it('handles typing in search input', () => {
    const onSearchInputChange = vi.fn();
    render(<LocationPickerMapPanel {...defaultProps} onSearchInputChange={onSearchInputChange} />);

    const input = screen.getByPlaceholderText('Search address inside map...');
    fireEvent.change(input, { target: { value: 'Kemang' } });

    expect(onSearchInputChange).toHaveBeenCalledWith('Kemang');
  });

  it('displays suggestions dropdown when searchValue length >= 3', () => {
    const suggestions = [{ placeId: 'p1', description: 'Kemang, Jakarta' }];
    render(
      <LocationPickerMapPanel
        {...defaultProps}
        searchValue="Kem"
        suggestions={suggestions}
      />
    );

    expect(screen.getByText('Kemang, Jakarta')).toBeInTheDocument();
  });

  it('calls onSelectSuggestion on suggestion click', () => {
    const onSelectSuggestion = vi.fn();
    const suggestions = [{ placeId: 'p1', description: 'Kemang, Jakarta' }];
    render(
      <LocationPickerMapPanel
        {...defaultProps}
        searchValue="Kem"
        suggestions={suggestions}
        onSelectSuggestion={onSelectSuggestion}
      />
    );

    fireEvent.click(screen.getByText('Kemang, Jakarta'));
    expect(onSelectSuggestion).toHaveBeenCalledWith('p1', 'Kemang, Jakarta');
  });

  it('calls onConfirm and onCancel correctly', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const marker = { latitude: -6.2, longitude: 106.8 };

    render(
      <LocationPickerMapPanel
        {...defaultProps}
        marker={marker}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Confirm location' }));
    expect(onConfirm).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
  });

  it('disables confirm button when marker is null or isConfirmDisabled is true', () => {
    const { rerender } = render(<LocationPickerMapPanel {...defaultProps} marker={null} />);
    expect(screen.getByRole('button', { name: 'Confirm location' })).toBeDisabled();

    rerender(<LocationPickerMapPanel {...defaultProps} marker={{ latitude: -6, longitude: 106 }} isConfirmDisabled={true} />);
    expect(screen.getByRole('button', { name: 'Confirm location' })).toBeDisabled();
  });
});
