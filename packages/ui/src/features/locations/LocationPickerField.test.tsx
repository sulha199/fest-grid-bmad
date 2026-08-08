import React from 'react';
import { render, fireEvent, screen, act, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { LocationPickerField } from './LocationPickerField';

describe('LocationPickerField Component', () => {
  afterEach(() => {
    cleanup();
  });

  const defaultProps = {
    suggestions: [],
    isSuggestionsLoading: false,
    onSearchInputChange: vi.fn(),
    onSelectSuggestion: vi.fn(),
    onUseCurrentLocation: vi.fn(),
    onPickOnMap: vi.fn(),
    resolvedPreview: null,
    error: null,
  };

  it('renders standard labels and buttons', () => {
    render(<LocationPickerField {...defaultProps} />);
    expect(screen.getByLabelText('Address')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Use my current location' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pick on map' })).toBeInTheDocument();
  });

  it('renders custom labels', () => {
    render(
      <LocationPickerField
        {...defaultProps}
        labels={{
          addressLabel: 'Alamat',
          addressPlaceholder: 'Cari alamat...',
          useCurrentLocationLabel: 'Gunakan lokasi saat ini',
          pickOnMapLabel: 'Pilih di peta',
        }}
      />
    );
    expect(screen.getByLabelText('Alamat')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Cari alamat...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Gunakan lokasi saat ini' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pilih di peta' })).toBeInTheDocument();
  });

  it('handles text input and fires onSearchInputChange', () => {
    const onSearchInputChange = vi.fn();
    render(<LocationPickerField {...defaultProps} onSearchInputChange={onSearchInputChange} />);

    const input = screen.getByLabelText('Address');
    fireEvent.change(input, { target: { value: 'Jakarta' } });

    expect(onSearchInputChange).toHaveBeenCalledWith('Jakarta');
  });

  it('shows searching loading indicator in suggestions dropdown', () => {
    const { rerender } = render(
      <LocationPickerField
        {...defaultProps}
        isSuggestionsLoading={true}
      />
    );

    // Dropdown is not visible when length < 3
    expect(screen.queryByText('Searching...')).not.toBeInTheDocument();

    // Type 3 characters
    rerender(
      <LocationPickerField
        {...defaultProps}
        isSuggestionsLoading={true}
      />
    );
    const input = screen.getByLabelText('Address');
    fireEvent.change(input, { target: { value: 'Jak' } });

    expect(screen.getByText('Searching...')).toBeInTheDocument();
  });

  it('renders empty suggestions state', () => {
    render(<LocationPickerField {...defaultProps} suggestions={[]} />);
    const input = screen.getByLabelText('Address');
    fireEvent.change(input, { target: { value: 'UnknownPlaceThatDoesNotExist' } });

    expect(screen.getByText('No addresses found.')).toBeInTheDocument();
  });

  it('renders suggestions list and calls onSelectSuggestion', () => {
    const onSelectSuggestion = vi.fn();
    const suggestions = [
      { placeId: '1', description: 'Jakarta, Indonesia' },
      { placeId: '2', description: 'Jakarta Selatan, Jakarta, Indonesia' },
    ];

    render(
      <LocationPickerField
        {...defaultProps}
        suggestions={suggestions}
        onSelectSuggestion={onSelectSuggestion}
      />
    );

    const input = screen.getByLabelText('Address');
    fireEvent.change(input, { target: { value: 'Jak' } });

    expect(screen.getByText('Jakarta, Indonesia')).toBeInTheDocument();
    expect(screen.getByText('Jakarta Selatan, Jakarta, Indonesia')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Jakarta, Indonesia'));
    expect(onSelectSuggestion).toHaveBeenCalledWith('1', 'Jakarta, Indonesia');
  });

  it('disables buttons and shows spinner when geo capturing', () => {
    render(
      <LocationPickerField
        {...defaultProps}
        isCurrentLocationDisabled={true}
        isGeoCapturing={true}
      />
    );

    const useCurrentBtn = screen.getByRole('button', { name: 'Use my current location' });
    expect(useCurrentBtn).toBeDisabled();
    expect(useCurrentBtn.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('displays geolocation error message', () => {
    render(<LocationPickerField {...defaultProps} error="Geolocation permission denied" />);
    expect(screen.getByTestId('geolocation-error')).toBeInTheDocument();
    expect(screen.getByText('Geolocation permission denied')).toBeInTheDocument();
  });

  it('overrides input value with resolvedPreview text', () => {
    const { rerender } = render(<LocationPickerField {...defaultProps} />);
    const input = screen.getByLabelText('Address') as HTMLInputElement;

    fireEvent.change(input, { target: { value: 'typing...' } });
    expect(input.value).toBe('typing...');

    rerender(
      <LocationPickerField
        {...defaultProps}
        resolvedPreview={{ status: 'resolved', text: 'Resolved Address from GPS' }}
      />
    );

    expect(input.value).toBe('Resolved Address from GPS');
  });
});
