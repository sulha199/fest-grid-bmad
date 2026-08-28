export interface ViewModeToggleProps {
  viewMode: 'list' | 'masonry';
  onViewModeChange: (mode: 'list' | 'masonry') => void;
  labels: {
    list: string;
    masonry: string;
  };
  className?: string;
}
