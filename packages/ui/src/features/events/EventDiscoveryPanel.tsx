"use client";

import * as React from 'react';
import { useQueryState, parseAsString } from 'nuqs';
import { SearchBar } from './SearchBar';
import { FilterHub } from './FilterHub';
import { EventDiscoveryPanelProps } from './EventDiscoveryPanel.types';

export function EventDiscoveryPanel({
  query,
  onSearchSubmit,
  onSearchEnter,
  searchPlaceholder,
  searchClearLabel,
  filterLabels,
  types,
  categories,
  onFilterChange,
  views,
  className = '',
}: EventDiscoveryPanelProps) {
  const [activeView, setActiveView] = useQueryState(
    'view',
    parseAsString.withDefault(views[0]?.id || '')
  );

  // If activeView does not match any views[].id, fall back to views[0].id
  const viewExists = views.some((v) => v.id === activeView);
  const currentViewId = viewExists ? activeView : (views[0]?.id || '');
  const activeContent = views.find((v) => v.id === currentViewId)?.content ?? null;

  return (
    <div className={`space-y-8 ${className}`}>
      <div className="flex flex-col gap-6">
        <SearchBar
          query={query}
          onChange={() => {}} // Wired to a no-op internally per AC4
          onSubmit={onSearchSubmit}
          onEnter={onSearchEnter}
          placeholder={searchPlaceholder}
          clearLabel={searchClearLabel}
        />

        <FilterHub
          labels={filterLabels}
          types={types}
          categories={categories}
          onChange={onFilterChange}
        />
      </div>
      {activeContent}
    </div>
  );
}
