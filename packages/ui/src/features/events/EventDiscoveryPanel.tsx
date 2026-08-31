"use client";

import * as React from 'react';
import { useQueryState, parseAsString } from 'nuqs';
import { SlidersHorizontal } from 'lucide-react';
import { SearchBar } from './SearchBar';
import { FilterHub } from './FilterHub';
import { EventDiscoveryPanelProps } from './EventDiscoveryPanel.types';
import { useCollapseHeaderOnScroll } from '../../hooks';

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
  isAuthenticated,
  isLoadingLocations,
  locationsError,
  savedLocations,
  selectedValue,
  radiusKm,
  isCapturingCurrentLocation,
  currentLocationError,
  onSelectLocation,
  onRadiusChange,
  showAITrigger,
  onAITriggerClick,
  aiFilterSummary,
  aiCaveatsText,
  onAIClear,
  onAIExpand,
  showFiltersLabel,
}: EventDiscoveryPanelProps) {
  const [activeView, setActiveView] = useQueryState(
    'view',
    parseAsString.withDefault(views[0]?.id || '')
  );

  // If activeView does not match any views[].id, fall back to views[0].id
  const viewExists = views.some((v) => v.id === activeView);
  const currentViewId = viewExists ? activeView : (views[0]?.id || '');
  const activeContent = views.find((v) => v.id === currentViewId)?.content ?? null;

  const headerContainerRef = React.useRef<HTMLDivElement>(null);
  const { isCollapsed, expand } = useCollapseHeaderOnScroll(80, headerContainerRef);
  const headerContentId = React.useId();

  return (
    <div className={`space-y-8 ${className}`}>
      <div
        ref={headerContainerRef}
        className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-gray-200 dark:border-gray-800 pt-4 pb-2 -mt-4"
      >
        {/* Both states stay mounted (toggled via `hidden`, not conditional
            rendering) so `aria-controls` always references a real element
            and neither branch's internal state/effects churn on toggle. */}
        <div hidden={!isCollapsed} className="flex justify-center py-2">
          <button
            type="button"
            onClick={expand}
            aria-expanded={!isCollapsed}
            aria-controls={headerContentId}
            className="flex items-center gap-2 rounded-full border bg-background px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <SlidersHorizontal className="h-4 w-4" />
            <span>{showFiltersLabel || 'Show filters'}</span>
          </button>
        </div>
        <div id={headerContentId} hidden={isCollapsed}>
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
              isAuthenticated={isAuthenticated}
              isLoadingLocations={isLoadingLocations}
              locationsError={locationsError}
              savedLocations={savedLocations}
              selectedValue={selectedValue}
              radiusKm={radiusKm}
              isCapturingCurrentLocation={isCapturingCurrentLocation}
              currentLocationError={currentLocationError}
              onSelectLocation={onSelectLocation}
              onRadiusChange={onRadiusChange}
              showAITrigger={showAITrigger}
              onAITriggerClick={onAITriggerClick}
              aiFilterSummary={aiFilterSummary}
              aiCaveatsText={aiCaveatsText}
              onAIClear={onAIClear}
              onAIExpand={onAIExpand}
            />
          </div>

          {views.length > 1 && (
            <div className="flex border-b border-gray-200 dark:border-gray-800 mt-6" role="tablist">
              {views.map((v) => {
                const isActive = v.id === currentViewId;
                return (
                  <button
                    key={v.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setActiveView(v.id)}
                    className={`flex items-center gap-2 px-4 py-2 border-b-2 font-medium text-sm transition-all -mb-px ${
                      isActive
                        ? 'border-blue-600 text-blue-600 dark:border-blue-500 dark:text-blue-500'
                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                    }`}
                  >
                    {v.icon && <span className="w-4 h-4 flex items-center justify-center">{v.icon}</span>}
                    <span>{v.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {activeContent}
    </div>
  );
}
