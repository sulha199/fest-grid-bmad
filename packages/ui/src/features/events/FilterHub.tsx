"use client"

import * as React from 'react';
import { useQueryState, parseAsArrayOf, parseAsString } from 'nuqs';
import { MultiSelect } from '../../core/multi-select';

import { LocationRadiusFilter } from './LocationRadiusFilter.js';
import { LocationRadiusFilterProps } from './LocationRadiusFilter.types.js';

export interface FilterHubProps extends Omit<LocationRadiusFilterProps, 'labels'> {
  labels: {
    typeLabel: string;
    categoryLabel: string;
    clearLabel: string;
    locationFilterLabels: LocationRadiusFilterProps['labels'];
  };
  types: { value: string; label: string }[];
  categories: { value: string; label: string }[];
  onChange?: (types: string[], categories: string[]) => void;
  className?: string;
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
}: FilterHubProps) {
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

  return (
    <div className={`flex flex-col gap-6 ${className}`}>
      {hasSelection && (
        <div className="flex justify-end">
          <button 
            type="button" 
            onClick={handleClear}
            className="text-sm font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
          >
            {labels.clearLabel}
          </button>
        </div>
      )}
      <MultiSelect
        facetLabel={labels.typeLabel}
        options={types}
        selectedValues={selectedTypes}
        onChange={handleTypeChange}
        labels={{ clearLabel: labels.clearLabel }}
        hideClearAction
      />
      <MultiSelect
        facetLabel={labels.categoryLabel}
        options={categories}
        selectedValues={selectedCategories}
        onChange={handleCategoryChange}
        labels={{ clearLabel: labels.clearLabel }}
        hideClearAction
      />
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
    </div>
  );
}
