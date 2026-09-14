/// <reference types="@testing-library/jest-dom" />
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventListView } from './EventListView';
import { EventListViewItem } from './EventListView.types';

// Capture the props EventListView derives for EventCard so we can assert the
// price fallback (masonry variant hides the price from rendered DOM, so the
// prop itself is the observable contract here).
interface CapturedCardProps {
  eventName?: string;
  priceFrom?: string | number | null;
  [key: string]: unknown;
}
const capturedProps = vi.hoisted(() => ({ all: [] as CapturedCardProps[] }));

vi.mock('./EventCard', () => ({
  EventCard: (props: CapturedCardProps) => {
    capturedProps.all.push(props);
    return <article data-testid="mock-card">{String(props.eventName ?? '')}</article>;
  },
}));

const { selectDisplaySchedule } = vi.hoisted(() => ({
  selectDisplaySchedule: vi.fn(),
}));

vi.mock('@festgrid/domain/events', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@festgrid/domain/events')>();
  return { ...actual, selectDisplaySchedule };
});

const baseProps = {
  emptyState: <div>Empty</div>,
  getCardProps: () => ({}),
  sentinelRef: vi.fn(),
  isFetchingNextPage: false,
  loadingMoreLabel: 'Loading more...',
} as const;

describe('EventListView — price fallback from main schedule (Story 2.7)', () => {
  beforeEach(() => {
    capturedProps.all.length = 0;
    selectDisplaySchedule.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const renderEvent = (event: EventListViewItem) => {
    render(<EventListView status="success" events={[event]} {...baseProps} />);
    return capturedProps.all[0];
  };

  it('inherits the main schedule price when the picked-but-sparse schedule has none', () => {
    // selectDisplaySchedule picks the sparse upcoming sub-schedule (no price);
    // the main schedule does carry a price, so priceFrom must fall back to it.
    selectDisplaySchedule.mockReturnValue({
      isMainSchedule: false,
      eventStartDate: '2026-09-20',
    });
    const event: EventListViewItem = {
      id: 'sparse',
      slug: 'sparse',
      eventName: 'Sparse Priced',
      schedules: [
        { isMainSchedule: false, eventStartDate: '2026-09-20' },
        { isMainSchedule: true, eventStartDate: '2026-08-16', ticketPrice: 75 },
      ],
    };

    const props = renderEvent(event);
    expect(props.priceFrom).toBe(75);
    expect(screen.getByText('Sparse Priced')).toBeInTheDocument();
  });

  it('prefers the display schedule price when it has one (no fallback needed)', () => {
    selectDisplaySchedule.mockReturnValue({
      isMainSchedule: false,
      eventStartDate: '2026-09-20',
      ticketPrice: 40,
    });
    const event: EventListViewItem = {
      id: 'both',
      slug: 'both',
      eventName: 'Both Priced',
      schedules: [
        { isMainSchedule: false, eventStartDate: '2026-09-20', ticketPrice: 40 },
        { isMainSchedule: true, eventStartDate: '2026-08-16', ticketPrice: 75 },
      ],
    };

    const props = renderEvent(event);
    expect(props.priceFrom).toBe(40);
  });

  it('leaves priceFrom undefined when neither schedule has a price', () => {
    selectDisplaySchedule.mockReturnValue({
      isMainSchedule: false,
      eventStartDate: '2026-09-20',
    });
    const event: EventListViewItem = {
      id: 'no-price',
      slug: 'no-price',
      eventName: 'No Price',
      schedules: [
        { isMainSchedule: false, eventStartDate: '2026-09-20' },
        { isMainSchedule: true, eventStartDate: '2026-08-16' },
      ],
    };

    const props = renderEvent(event);
    expect(props.priceFrom).toBeUndefined();
  });
});
