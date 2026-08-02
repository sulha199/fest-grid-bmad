import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { BlockingLoaderProps } from './blocking-loader.types';

/**
 * A reusable, full-screen blocking loader/overlay component.
 * Prevents screen interaction and contains keyboard focus during critical async operations.
 */
export function BlockingLoader({
  active,
  label,
  labels,
}: BlockingLoaderProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!active) return;

    // Capture the element that currently holds focus
    const previousActiveElement = document.activeElement as HTMLElement | null;
    const container = containerRef.current;

    if (container) {
      container.focus();
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      if (!container) return;

      // Query focusable elements within the overlay container
      const focusable = container.querySelectorAll<HTMLElement>(
        'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, object, embed, [tabindex="0"], [contenteditable]'
      );

      const focusableElements = Array.from(focusable).filter(
        (el) => el.tabIndex !== -1
      );

      if (focusableElements.length === 0) {
        // If there are no focusable elements, prevent default tab and keep focus on the container
        e.preventDefault();
        container.focus();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === firstElement || document.activeElement === container) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (previousActiveElement && typeof previousActiveElement.focus === 'function') {
        previousActiveElement.focus();
      }
    };
  }, [active]);

  if (!active) return null;

  const fallbackLabel = labels?.busyLabel ?? 'Loading';

  return (
    <div
      ref={containerRef}
      tabIndex={-1}
      aria-busy="true"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 outline-none"
    >
      <div className="flex flex-col items-center gap-4 text-white">
        <Loader2 className="animate-spin h-10 w-10 text-white" aria-hidden="true" />
        <div role="status" aria-live="polite" className="text-sm font-medium">
          {label || fallbackLabel}
        </div>
      </div>
    </div>
  );
}

export * from './blocking-loader.types';
