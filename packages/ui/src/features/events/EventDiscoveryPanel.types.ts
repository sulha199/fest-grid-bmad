import { ReactNode } from 'react';
import { FilterHubProps } from './FilterHub.js';
import { LocationRadiusFilterProps } from './LocationRadiusFilter.types.js';
import { TemporalFilterToggleLabels, TemporalFilterValue } from './TemporalFilterToggle.types.js';

export interface EventDiscoveryPanelView {
  id: string;
  label: string;       // new — switcher button text, pre-translated
  icon?: ReactNode;     // new — optional switcher button icon
  content: ReactNode;
}

export interface EventDiscoveryPanelProps extends Omit<FilterHubProps, 'labels' | 'types' | 'categories' | 'onChange'> {
  // Search (SearchBar pass-through)
  query: string;
  onSearchSubmit: (query: string) => void;
  onSearchEnter?: (query: string) => void;
  searchPlaceholder: string;
  searchClearLabel: string;
  // Filter (FilterHub pass-through)
  filterLabels: {
    typeLabel: string;
    categoryLabel: string;
    clearLabel: string;
    locationFilterLabels: LocationRadiusFilterProps['labels'];
    aiTriggerTooltip?: string;
    aiClearLabel?: string;
    aiExpandLabel?: string;
  };
  types: { value: string; label: string }[];
  categories: { value: string; label: string }[];
  onFilterChange?: (types: string[], categories: string[]) => void;
  // View content
  views: EventDiscoveryPanelView[];
  className?: string;
  showFiltersLabel?: string;
  // Temporal filter (Story 0.i5d, AC6) -- card view only. Optional: this story wires it into
  // Discovery's card view (home-content.tsx) only -- Feed/Favorites/the account page/widget
  // embeds don't pass these yet (out of scope, see story Dev Notes), so the toggle simply
  // doesn't render for those callers rather than requiring every existing consumer to adopt it.
  temporalFilter?: TemporalFilterValue;
  onTemporalFilterChange?: (value: TemporalFilterValue) => void;
  temporalFilterLabels?: TemporalFilterToggleLabels;
}
