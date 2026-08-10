import { ReactNode } from 'react';

export interface MultiSelectOption {
  value: string;
  label: ReactNode;
}

/**
 * Props for the MultiSelect component.
 */
export interface MultiSelectProps {
  /**
   * The accessible label and visual title for the facet group.
   */
  facetLabel: string;
  /**
   * The list of options to render as toggles.
   */
  options: MultiSelectOption[];
  /**
   * The currently selected values.
   */
  selectedValues: string[];
  /**
   * Callback fired when the selection changes.
   */
  onChange: (values: string[]) => void;
  /**
   * Optional microcopy overrides for i18n.
   */
  labels?: {
    /**
     * Label for the clear action. Defaults to "Clear".
     */
    clearLabel?: string;
  };
  /**
   * If true, hides the individual clear action button.
   */
  hideClearAction?: boolean;
}
