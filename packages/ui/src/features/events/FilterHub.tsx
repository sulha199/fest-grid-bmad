"use client"

import * as React from 'react';
import { useQueryState, parseAsArrayOf, parseAsString } from 'nuqs';
import { MultiSelect } from '../../core/multi-select';
import { Badge } from '../../core/ui/badge';
import { Button } from '../../core/ui/button';
import { X, Sparkles } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../../core/ui/popover';

import { LocationRadiusFilter } from './LocationRadiusFilter';
import { LocationRadiusFilterProps } from './LocationRadiusFilter.types';

export interface FilterHubProps extends Omit<LocationRadiusFilterProps, 'labels'> {
  labels: {
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
  onChange?: (types: string[], categories: string[]) => void;
  className?: string;
  showAITrigger?: boolean;
  onAITriggerClick?: () => void;
  aiFilterSummary?: string;
  aiCaveatsText?: string;
  onAIClear?: () => void;
  onAIExpand?: () => void;
  aiTriggerTooltip?: string;
  aiClearLabel?: string;
  aiExpandLabel?: string;
}

export function FilterHub({
  labels,
  types,
  categories,
  onChange,
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
  aiTriggerTooltip,
  aiClearLabel,
  aiExpandLabel,
}: FilterHubProps) {
  if (aiFilterSummary) {
    return (
      <div className={`flex flex-wrap items-center gap-3 py-1.5 px-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-100 dark:border-blue-900/50 text-sm ${className}`}>
        <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300 font-medium mr-auto">
          <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 animate-pulse" />
          <span className="sr-only">AI Filter active:</span>
          <span className="leading-tight">{aiFilterSummary}</span>
          {aiCaveatsText && (
            <span className="text-xs text-muted-foreground ml-1 font-normal block mt-0.5">
              ({aiCaveatsText})
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onAIExpand}
            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:bg-blue-100/50 dark:hover:bg-blue-900/30 text-xs font-semibold h-8"
          >
            {aiExpandLabel || labels.aiExpandLabel || 'Edit / Expand'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onAIClear}
            className="text-muted-foreground hover:text-foreground hover:bg-muted text-xs font-semibold h-8"
          >
            {aiClearLabel || labels.aiClearLabel || 'Clear'}
          </Button>
        </div>
      </div>
    );
  }


  const [selectedTypes, setSelectedTypes] = useQueryState(
    'types',
    parseAsArrayOf(parseAsString).withDefault([])
  );
  
  const [selectedCategories, setSelectedCategories] = useQueryState(
    'categories',
    parseAsArrayOf(parseAsString).withDefault([])
  );

  const handleClear = () => {
    setSelectedTypes(null);
    setSelectedCategories(null);
    onSelectLocation('off');
    if (onChange) onChange([], []);
  };

  const handleTypeChange = (newTypes: string[]) => {
    const val = newTypes.length > 0 ? newTypes : null;
    setSelectedTypes(val);
    if (onChange) onChange(newTypes, selectedCategories);
  };

  const handleCategoryChange = (newCategories: string[]) => {
    const val = newCategories.length > 0 ? newCategories : null;
    setSelectedCategories(val);
    if (onChange) onChange(selectedTypes, newCategories);
  };

  const isNearbyActive = selectedValue !== null && selectedValue !== 'off';
  const hasSelection = selectedTypes.length > 0 || selectedCategories.length > 0 || isNearbyActive;

  let nearbyTriggerText = labels.locationFilterLabels.filterLabel;
  if (isNearbyActive) {
    const locationName =
      selectedValue === 'current'
        ? labels.locationFilterLabels.currentLocationOptionLabel
        : savedLocations.find((l) => l.id === selectedValue)?.name || labels.locationFilterLabels.filterLabel;
    nearbyTriggerText = `${locationName} · ${labels.locationFilterLabels.radiusUnit(radiusKm)}`;
  }

  const renderFacet = (
    label: string,
    options: { value: string; label: string }[],
    selectedValues: string[],
    onChange: (values: string[]) => void
  ) => (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={selectedValues.length > 0 ? 'default' : 'outline'}
          className={selectedValues.length > 0 ? "pr-1.5 gap-1.5" : ""}
        >
          <span>{label}</span>
          {selectedValues.length > 0 && (
            <span className="flex items-center gap-1">
              <Badge variant="secondary" className="px-1 text-[10px]">{selectedValues.length}</Badge>
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  onChange([]);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    onChange([]);
                  }
                }}
                className="hover:bg-primary-foreground/20 rounded-full p-0.5 transition-colors text-primary-foreground shrink-0 inline-flex items-center justify-center cursor-pointer"
                aria-label={`${labels.clearLabel} ${label}`}
              >
                <X className="w-3 h-3" />
              </span>
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent>
        <MultiSelect
          facetLabel={label}
          options={options}
          selectedValues={selectedValues}
          onChange={onChange}
          labels={{ clearLabel: labels.clearLabel }}
          hideClearAction
        />
        <button
          type="button"
          onClick={() => onChange([])}
          className="mt-3 text-xs font-medium text-blue-600 transition-colors hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
        >
          {labels.clearLabel}
        </button>
      </PopoverContent>
    </Popover>
  );

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {renderFacet(labels.typeLabel, types, selectedTypes, handleTypeChange)}
      {renderFacet(labels.categoryLabel, categories, selectedCategories, handleCategoryChange)}
      {isAuthenticated && (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={isNearbyActive ? 'default' : 'outline'}
              className={isNearbyActive ? "pr-1.5 gap-1.5" : ""}
            >
              <span>{nearbyTriggerText}</span>
              {isNearbyActive && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectLocation('off');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      e.stopPropagation();
                      onSelectLocation('off');
                    }
                  }}
                  className="hover:bg-primary-foreground/20 rounded-full p-0.5 transition-colors text-primary-foreground shrink-0 inline-flex items-center justify-center ml-1.5 cursor-pointer"
                  aria-label={`${labels.clearLabel} ${labels.locationFilterLabels.filterLabel}`}
                >
                  <X className="w-3 h-3" />
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80">
            <LocationRadiusFilter
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
              labels={labels.locationFilterLabels}
            />
          </PopoverContent>
        </Popover>
      )}
      {showAITrigger && (
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={onAITriggerClick}
          className="w-10 h-10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900 hover:bg-blue-50 dark:hover:bg-blue-950/40 shrink-0"
          title={aiTriggerTooltip || labels.aiTriggerTooltip || 'Filter with AI'}
          aria-label={aiTriggerTooltip || labels.aiTriggerTooltip || 'Filter with AI'}
        >
          <Sparkles className="w-4 h-4" />
        </Button>
      )}

      {hasSelection && (
        <button
          type="button"
            onClick={handleClear}
            className="text-sm font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
        >
          {labels.clearLabel}
        </button>
      )}
    </div>
  );
}
