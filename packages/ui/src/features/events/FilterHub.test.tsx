import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { FilterHub } from './FilterHub';
import * as nuqs from 'nuqs';

// Mock nuqs to use React state for testing
vi.mock('nuqs', () => {
  const ReactMock = require('react');
  const store: Record<string, any> = {};
  const listeners: Record<string, Set<Function>> = {};

  return {
    __reset: () => {
      Object.keys(store).forEach((key) => delete store[key]);
      Object.keys(listeners).forEach((key) => listeners[key].clear());
    },
    useQueryState: (key: string, options?: any) => {
      const defaultValue = options?.defaultValue ?? '';
      if (!(key in store)) {
        store[key] = defaultValue;
      }
      const [state, setState] = ReactMock.useState(store[key]);

      ReactMock.useEffect(() => {
        if (!listeners[key]) listeners[key] = new Set();
        listeners[key].add(setState);
        return () => {
          listeners[key].delete(setState);
        };
      }, [key]);

      const setSharedState = ReactMock.useCallback((val: any) => {
        const newValue = typeof val === 'function' ? val(store[key]) : val;
        const resolvedValue = newValue === null ? defaultValue : newValue;
        store[key] = resolvedValue;
        if (listeners[key]) {
          listeners[key].forEach((listener: any) => listener(resolvedValue));
        }
      }, [key, defaultValue]);

      return [state, setSharedState];
    },
    parseAsString: { withDefault: (val: any) => ({ defaultValue: val }) },
    parseAsArrayOf: () => ({ withDefault: (val: any) => ({ defaultValue: val }) }),
  };
});

const defaultLabels = {
  typeLabel: 'Types',
  categoryLabel: 'Categories',
  clearLabel: 'Clear all',
  locationFilterLabels: {
    filterLabel: 'Nearby',
    offOptionLabel: 'All locations',
    currentLocationOptionLabel: 'Current location',
    radiusLabel: 'Radius',
    radiusUnit: (count: number) => `${count} km`,
    detectingLocationLabel: 'Detecting...',
    permissionDeniedLabel: 'Denied',
    unavailableLabel: 'Unavailable',
    locationsErrorLabel: 'Error',
    noSavedLocationsHint: 'Hint',
  },
};

const mockTypes = [{ value: 'festival', label: 'Festival' }];
const mockCategories = [{ value: 'music', label: 'Music' }];

describe('FilterHub', () => {
  afterEach(() => {
    cleanup();
    (nuqs as unknown as { __reset: () => void }).__reset();
  });

  it('renders pre-existing filters and passes props to LocationRadiusFilter', () => {
    const onSelectLocation = vi.fn();
    const onRadiusChange = vi.fn();

    render(
      <FilterHub
        labels={defaultLabels}
        types={mockTypes}
        categories={mockCategories}
        isAuthenticated={true}
        isLoadingLocations={false}
        locationsError={false}
        savedLocations={[]}
        selectedValue="off"
        radiusKm={5}
        isCapturingCurrentLocation={false}
        currentLocationError={null}
        onSelectLocation={onSelectLocation}
        onRadiusChange={onRadiusChange}
      />
    );

    // Verify types/categories render
    expect(screen.getByText('Types')).toBeInTheDocument();
    expect(screen.getByText('Categories')).toBeInTheDocument();

    // Verify nearby filter renders
    expect(screen.getByLabelText('Nearby')).toBeInTheDocument();
  });

  it('Clear all action also resets nearby selection and other filters', () => {
    const onSelectLocation = vi.fn();
    const onRadiusChange = vi.fn();

    // Set selectedValue to 'current' to make nearby filter active
    render(
      <FilterHub
        labels={defaultLabels}
        types={mockTypes}
        categories={mockCategories}
        isAuthenticated={true}
        isLoadingLocations={false}
        locationsError={false}
        savedLocations={[]}
        selectedValue="current"
        radiusKm={5}
        isCapturingCurrentLocation={false}
        currentLocationError={null}
        onSelectLocation={onSelectLocation}
        onRadiusChange={onRadiusChange}
      />
    );

    const clearButton = screen.getByRole('button', { name: 'Clear all' });
    expect(clearButton).toBeInTheDocument();

    fireEvent.click(clearButton);

    expect(onSelectLocation).toHaveBeenCalledWith('off');
  });

  it('keeps facet controls closed until opened and shows selection state on the trigger', () => {
    render(
      <FilterHub
        labels={defaultLabels}
        types={mockTypes}
        categories={mockCategories}
        isAuthenticated={false}
        isLoadingLocations={false}
        locationsError={false}
        savedLocations={[]}
        selectedValue="off"
        radiusKm={5}
        isCapturingCurrentLocation={false}
        currentLocationError={null}
        onSelectLocation={vi.fn()}
        onRadiusChange={vi.fn()}
      />
    );

    const typeTrigger = screen.getByRole('button', { name: 'Types' });
    expect(screen.queryByRole('group', { name: 'Types' })).not.toBeInTheDocument();

    fireEvent.click(typeTrigger);
    expect(screen.getByRole('group', { name: 'Types' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Festival' }));

    expect(screen.getByRole('button', { name: /Types\s*1/ })).toBeInTheDocument();
  });

  it('clears only the facet whose popover clear action is used', () => {
    render(
      <FilterHub
        labels={defaultLabels}
        types={mockTypes}
        categories={mockCategories}
        isAuthenticated={false}
        isLoadingLocations={false}
        savedLocations={[]}
        selectedValue="off"
        radiusKm={5}
        isCapturingCurrentLocation={false}
        currentLocationError={null}
        onSelectLocation={vi.fn()}
        onRadiusChange={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Types' }));
    fireEvent.click(screen.getByRole('button', { name: 'Festival' }));
    fireEvent.click(screen.getByRole('button', { name: /Types\s*1/ }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Clear all' })[0]);

    expect(screen.getByRole('button', { name: 'Types' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Categories' })).toBeInTheDocument();
  });
});
