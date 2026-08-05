import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { EventDiscoveryPanel } from './EventDiscoveryPanel';

// Mock nuqs to use React state for testing
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
    views: [
      { id: 'card', content: <div data-testid="card-view">Card View Content</div> },
      { id: 'calendar', content: <div data-testid="calendar-view">Calendar View Content</div> },
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
});
