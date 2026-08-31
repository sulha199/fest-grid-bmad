import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import React from 'react';
import { EventDiscoveryPanel } from './EventDiscoveryPanel';

// Mock nuqs to use React state for testing
// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});


vi.mock('nuqs', () => {
  const ReactMock = require('react');
  const store: Record<string, any> = {};
  const listeners: Record<string, Set<Function>> = {};

  return {
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

describe('EventDiscoveryPanel', () => {
  afterEach(() => {
    cleanup();
  });

  const defaultProps = {
    query: '',
    onSearchSubmit: vi.fn(),
    onSearchEnter: vi.fn(),
    searchPlaceholder: 'Search events...',
    searchClearLabel: 'Clear search',
    filterLabels: {
      typeLabel: 'All Types',
      categoryLabel: 'All Categories',
      clearLabel: 'Clear filters',
      locationFilterLabels: {
        filterLabel: "Nearby",
        offOptionLabel: "All locations",
        currentLocationOptionLabel: "Current location",
        radiusLabel: "Radius",
        radiusUnit: (count: number) => `${count} km`,
        detectingLocationLabel: "Detecting your location...",
        permissionDeniedLabel: "Location access denied — showing all events.",
        unavailableLabel: "Couldn't detect your location — showing all events.",
        locationsErrorLabel: "Couldn't load your saved locations.",
        noSavedLocationsHint: "Save a location in My Locations to filter by a specific place.",
      },
    },
    types: [
      { value: 'MUSIC', label: 'Music' },
      { value: 'ART', label: 'Art' },
    ],
    categories: [
      { value: 'CONCERT', label: 'Concert' },
      { value: 'EXHIBIT', label: 'Exhibit' },
    ],
    onFilterChange: vi.fn(),
    isAuthenticated: true,
    isLoadingLocations: false,
    locationsError: false,
    savedLocations: [],
    selectedValue: 'off',
    radiusKm: 5,
    isCapturingCurrentLocation: false,
    currentLocationError: null,
    onSelectLocation: vi.fn(),
    onRadiusChange: vi.fn(),
    views: [
      { id: 'card', label: 'Card View', content: <div data-testid="card-view">Card View Content</div> },
      { id: 'calendar', label: 'Calendar View', content: <div data-testid="calendar-view">Calendar View Content</div> },
    ],
  };

  it('renders search, filter, and active view content (single-view render / composition)', () => {
    render(<EventDiscoveryPanel {...defaultProps} />);

    expect(screen.getByPlaceholderText('Search events...')).toBeInTheDocument();
    expect(screen.getByText('All Types')).toBeInTheDocument();
    expect(screen.getByText('All Categories')).toBeInTheDocument();
    expect(screen.getByTestId('card-view')).toBeInTheDocument();
    expect(screen.queryByTestId('calendar-view')).not.toBeInTheDocument();
  });

  it('no crash when optional callbacks onSearchEnter or onFilterChange are omitted', () => {
    const { onSearchEnter, onFilterChange, ...propsWithoutCallbacks } = defaultProps;
    
    expect(() => {
      render(<EventDiscoveryPanel {...propsWithoutCallbacks} />);
    }).not.toThrow();
  });

  it('DOM order is SearchBar, then FilterHub, then active view content (tab-order assertion)', () => {
    const { container } = render(<EventDiscoveryPanel {...defaultProps} />);

    // Query elements
    const searchBar = container.querySelector('input');
    // FilterHub renders standard text triggers for MultiSelect dropdowns
    const typeFilter = screen.getByText('All Types');
    const activeView = screen.getByTestId('card-view');

    expect(searchBar).toBeInTheDocument();
    expect(typeFilter).toBeInTheDocument();
    expect(activeView).toBeInTheDocument();

    // Verify DOM layout order (which dictates default tab order when tabIndex is not manipulated)
    const allElements = Array.from(container.querySelectorAll('*'));
    const searchIdx = allElements.indexOf(searchBar!);
    const filterIdx = allElements.indexOf(typeFilter);
    const viewIdx = allElements.indexOf(activeView);

    expect(searchIdx).toBeLessThan(filterIdx);
    expect(filterIdx).toBeLessThan(viewIdx);
  });

  it('renders a switcher control when multiple views are provided', () => {
    render(<EventDiscoveryPanel {...defaultProps} />);
    expect(screen.getByRole('tablist')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Card View' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Calendar View' })).toBeInTheDocument();
  });

  it('omits the switcher control when only a single view is provided', () => {
    const singleViewProps = {
      ...defaultProps,
      views: [defaultProps.views[0]],
    };
    render(<EventDiscoveryPanel {...singleViewProps} />);
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Card View' })).not.toBeInTheDocument();
  });

  it('updates the active view content when a switcher tab is clicked', async () => {
    const { fireEvent } = require('@testing-library/react');
    
    render(<EventDiscoveryPanel {...defaultProps} />);
    
    // Default is card view
    expect(screen.getByTestId('card-view')).toBeInTheDocument();
    expect(screen.queryByTestId('calendar-view')).not.toBeInTheDocument();

    const calendarTab = screen.getByRole('tab', { name: 'Calendar View' });
    fireEvent.click(calendarTab);

    expect(screen.queryByTestId('card-view')).not.toBeInTheDocument();
    expect(screen.getByTestId('calendar-view')).toBeInTheDocument();
  });

  describe('scroll collapse behavior', () => {
    let originalScrollY: number;

    beforeEach(() => {
      originalScrollY = window.scrollY;
      vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    });

    afterEach(() => {
      Object.defineProperty(window, 'scrollY', { value: originalScrollY, writable: true });
      vi.restoreAllMocks();
    });

    it('renders normal header when scroll is below threshold', () => {
      Object.defineProperty(window, 'scrollY', { value: 0, writable: true });
      render(<EventDiscoveryPanel {...defaultProps} />);

      // Both states stay mounted (toggled via the `hidden` attribute, not
      // conditional rendering) so `aria-controls` always references a real
      // element -- assert visibility, not DOM presence.
      expect(screen.getByPlaceholderText('Search events...')).toBeVisible();
      expect(screen.queryByRole('button', { name: 'Show filters' })).not.toBeInTheDocument();
    });

    it('renders collapse button when scroll is above threshold', () => {
      const { act } = require('@testing-library/react');
      Object.defineProperty(window, 'scrollY', { value: 0, writable: true });
      render(<EventDiscoveryPanel {...defaultProps} />);

      act(() => {
        Object.defineProperty(window, 'scrollY', { value: 100, writable: true });
        window.dispatchEvent(new Event('scroll'));
      });

      expect(screen.getByPlaceholderText('Search events...')).not.toBeVisible();
      const expandBtn = screen.getByRole('button', { name: 'Show filters' });
      expect(expandBtn).toBeVisible();
    });

    it('clicking expand button scrolls to top and immediately re-expands the header', () => {
      const { act, fireEvent } = require('@testing-library/react');
      Object.defineProperty(window, 'scrollY', { value: 0, writable: true });
      render(<EventDiscoveryPanel {...defaultProps} />);

      act(() => {
        Object.defineProperty(window, 'scrollY', { value: 100, writable: true });
        window.dispatchEvent(new Event('scroll'));
      });

      const expandBtn = screen.getByRole('button', { name: 'Show filters' });
      expect(expandBtn).toHaveAttribute('aria-expanded', 'false');

      fireEvent.click(expandBtn);

      expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
      // The header re-expands immediately -- doesn't wait for the (async,
      // possibly-interrupted) scroll animation to cross the threshold.
      expect(screen.getByPlaceholderText('Search events...')).toBeVisible();
    });

    it('links the expand button to the header content via aria-controls', () => {
      const { act } = require('@testing-library/react');
      Object.defineProperty(window, 'scrollY', { value: 0, writable: true });
      render(<EventDiscoveryPanel {...defaultProps} />);

      act(() => {
        Object.defineProperty(window, 'scrollY', { value: 100, writable: true });
        window.dispatchEvent(new Event('scroll'));
      });

      const expandBtn = screen.getByRole('button', { name: 'Show filters' });
      const controlsId = expandBtn.getAttribute('aria-controls');
      expect(controlsId).toBeTruthy();
      expect(document.getElementById(controlsId!)).not.toBeNull();
    });

    it('does not collapse while focus is inside the header', () => {
      const { act } = require('@testing-library/react');
      Object.defineProperty(window, 'scrollY', { value: 0, writable: true });
      render(<EventDiscoveryPanel {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText('Search events...');
      searchInput.focus();

      act(() => {
        Object.defineProperty(window, 'scrollY', { value: 100, writable: true });
        window.dispatchEvent(new Event('scroll'));
      });

      expect(searchInput).toBeVisible();
      expect(screen.queryByRole('button', { name: 'Show filters' })).not.toBeInTheDocument();
    });
  });
});
