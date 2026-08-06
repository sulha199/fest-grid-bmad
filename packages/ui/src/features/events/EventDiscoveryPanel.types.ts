import { ReactNode } from 'react';

export interface EventDiscoveryPanelView {
  id: string;
  label: string;       // new — switcher button text, pre-translated
  icon?: ReactNode;     // new — optional switcher button icon
  content: ReactNode;
}

export interface EventDiscoveryPanelProps {
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
  };
  types: { value: string; label: string }[];
  categories: { value: string; label: string }[];
  onFilterChange?: (types: string[], categories: string[]) => void;
  // View content
  views: EventDiscoveryPanelView[];
  className?: string;
}
