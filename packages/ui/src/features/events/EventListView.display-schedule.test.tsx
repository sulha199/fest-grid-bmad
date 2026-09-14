/// <reference types="@testing-library/jest-dom" />
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventListView } from './EventListView';
import { EventListViewItem } from './EventListView.types';

// Spy on the single source of truth so we can assert EventListView routes its
// schedule selection through it (selection correctness itself is covered by
// selectDisplaySchedule.test.ts in @festgrid/domain).
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

describe('EventListView — display schedule selection (Story 2.7)', () => {
  beforeEach(() => {
    selectDisplaySchedule.mockReset();
    selectDisplaySchedule.mockImplementation(
      (schedules: unknown[]) => ((schedules && schedules[0]) as EventListViewItem['schedules'][number]) ?? null
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('routes each event\'s schedules through selectDisplaySchedule', () => {
    const event: EventListViewItem = {
      id: '1',
      slug: 'one',
      eventName: 'One',
      schedules: [
        { isMainSchedule: true, eventStartDate: '2026-08-16', ticketPrice: 50 },
        { isMainSchedule: false, eventStartDate: '2026-09-20', ticketPrice: 40 },
      ],
    };

    render(<EventListView status="success" events={[event]} {...baseProps} />);

    expect(selectDisplaySchedule).toHaveBeenCalledTimes(1);
    expect(selectDisplaySchedule).toHaveBeenCalledWith([
      { isMainSchedule: true, eventStartDate: '2026-08-16', ticketPrice: 50 },
      { isMainSchedule: false, eventStartDate: '2026-09-20', ticketPrice: 40 },
    ]);
    expect(screen.getByText('One')).toBeInTheDocument();
  });

  it('renders gracefully when selectDisplaySchedule returns null (no schedules)', () => {
    selectDisplaySchedule.mockReturnValue(null);
    const event: EventListViewItem = {
      id: '2',
      slug: 'two',
      eventName: 'Two',
      schedules: [],
    };

    render(<EventListView status="success" events={[event]} {...baseProps} />);

    expect(screen.getByText('Two')).toBeInTheDocument();
  });
});
