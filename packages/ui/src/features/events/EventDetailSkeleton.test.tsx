import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EventDetailSkeleton } from './EventDetailSkeleton';
import { EventDetailView } from './EventDetailView';

describe('EventDetailSkeleton', () => {
  it('is a busy, labelled placeholder', () => {
    render(<EventDetailSkeleton label="Loading event details..." />);
    const el = screen.getByLabelText('Loading event details...');
    expect(el).toHaveAttribute('aria-busy', 'true');
    expect(el).toHaveClass('animate-pulse');
  });

  it("is exactly what EventDetailView renders in its own loading state (one shape, no drift)", () => {
    const labels = { loadingText: 'Loading event details...' } as never;
    const { container: standalone } = render(<EventDetailSkeleton label="Loading event details..." />);
    const { container: inView } = render(
      <EventDetailView loading labels={labels} eventName="" location="" schedules={[]} />,
    );
    expect(inView.innerHTML).toBe(standalone.innerHTML);
  });
});
