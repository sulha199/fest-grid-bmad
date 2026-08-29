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

  it('renders pre-existing filters and passes props to LocationRadiusFilter when opened', () => {
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

    // Verify nearby filter trigger renders and is outline variant
    const trigger = screen.getByRole('button', { name: 'Nearby' });
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveClass('border-input'); // outline variant

    // Popover is closed initially, so content is not in the document
    expect(screen.queryByLabelText('Nearby')).not.toBeInTheDocument();

    // Click trigger to open popover
    fireEvent.click(trigger);

    // Verify nearby filter contents render after open
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

  it('renders the active-selection summary when a location/current-location is selected and variant is default', () => {
    const onSelectLocation = vi.fn();
    const onRadiusChange = vi.fn();
    const savedLocations = [
      { id: 'loc-1', name: 'Home', latitude: 12.34, longitude: 56.78, radius: 1000 },
      { id: 'loc-2', name: 'Work', latitude: 23.45, longitude: 67.89, radius: 2000 },
    ];

    const { rerender } = render(
      <FilterHub
        labels={defaultLabels}
        types={mockTypes}
        categories={mockCategories}
        isAuthenticated={true}
        isLoadingLocations={false}
        locationsError={false}
        savedLocations={savedLocations}
        selectedValue="current"
        radiusKm={10}
        isCapturingCurrentLocation={false}
        currentLocationError={null}
        onSelectLocation={onSelectLocation}
        onRadiusChange={onRadiusChange}
      />
    );

    // Active summary for 'current'
    const currentTrigger = screen.getByRole('button', { name: 'Current location · 10 km' });
    expect(currentTrigger).toBeInTheDocument();
    expect(currentTrigger).toHaveClass('bg-primary'); // default variant when active

    // Rerender with a saved location selected
    rerender(
      <FilterHub
        labels={defaultLabels}
        types={mockTypes}
        categories={mockCategories}
        isAuthenticated={true}
        isLoadingLocations={false}
        locationsError={false}
        savedLocations={savedLocations}
        selectedValue="loc-1"
        radiusKm={25}
        isCapturingCurrentLocation={false}
        currentLocationError={null}
        onSelectLocation={onSelectLocation}
        onRadiusChange={onRadiusChange}
      />
    );

    // Active summary for saved location 'loc-1' ("Home")
    const locationTrigger = screen.getByRole('button', { name: 'Home · 25 km' });
    expect(locationTrigger).toBeInTheDocument();
    expect(locationTrigger).toHaveClass('bg-primary'); // default variant when active
  });
  it('renders the AI trigger button when showAITrigger is true and handles click', () => {
    const onAITriggerClick = vi.fn();
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
        showAITrigger={true}
        onAITriggerClick={onAITriggerClick}
      />
    );

    const trigger = screen.getByRole('button', { name: 'Filter with AI' });
    expect(trigger).toBeInTheDocument();
    fireEvent.click(trigger);
    expect(onAITriggerClick).toHaveBeenCalled();
  });

  it('renders the collapsed AI filter summary layout when aiFilterSummary is active', () => {
    const onAIClear = vi.fn();
    const onAIExpand = vi.fn();
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
        aiFilterSummary="Events about jazz in Work"
        aiCaveatsText="Missing ticket price"
        onAIClear={onAIClear}
        onAIExpand={onAIExpand}
      />
    );

    expect(screen.getByText('Events about jazz in Work')).toBeInTheDocument();
    expect(screen.getByText('(Missing ticket price)')).toBeInTheDocument();

    const expandBtn = screen.getByRole('button', { name: 'Edit / Expand' });
    const clearBtn = screen.getByRole('button', { name: 'Clear' });

    fireEvent.click(expandBtn);
    expect(onAIExpand).toHaveBeenCalled();

    fireEvent.click(clearBtn);
    expect(onAIClear).toHaveBeenCalled();
  });

});
