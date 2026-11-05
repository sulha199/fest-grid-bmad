import * as React from 'react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PaginationControls } from './pagination-controls';

const labels = {
  navigation: 'Pagination',
  previous: 'Previous',
  next: 'Next',
  pageInfo: 'Page 2 of 5',
  total: '93 total',
};

const baseProps = {
  hasPrevPage: true,
  hasNextPage: true,
  onPrev: () => {},
  onNext: () => {},
  labels,
};

describe('PaginationControls', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders a labelled navigation landmark with both buttons and the page and total readout', () => {
    render(<PaginationControls {...baseProps} />);

    expect(screen.getByRole('navigation', { name: 'Pagination' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();
    expect(screen.getByText('Page 2 of 5')).toBeInTheDocument();
    expect(screen.getByText('93 total')).toBeInTheDocument();
  });

  it('announces the readout politely so a page change is spoken without stealing focus', () => {
    render(<PaginationControls {...baseProps} />);
    expect(screen.getByText('Page 2 of 5').closest('p')).toHaveAttribute('aria-live', 'polite');
  });

  it('omits the total when none is given', () => {
    render(<PaginationControls {...baseProps} labels={{ ...labels, total: undefined }} />);
    expect(screen.getByText('Page 2 of 5')).toBeInTheDocument();
    expect(screen.queryByText('93 total')).not.toBeInTheDocument();
  });

  it('disables Previous on the first page and Next on the last', () => {
    const { rerender } = render(<PaginationControls {...baseProps} hasPrevPage={false} />);
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();

    rerender(<PaginationControls {...baseProps} hasNextPage={false} />);
    expect(screen.getByRole('button', { name: 'Previous' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });

  it('calls onPrev and onNext once per click', async () => {
    const onPrev = vi.fn();
    const onNext = vi.fn();
    const user = userEvent.setup();
    render(<PaginationControls {...baseProps} onPrev={onPrev} onNext={onNext} />);

    await user.click(screen.getByRole('button', { name: 'Previous' }));
    expect(onPrev).toHaveBeenCalledTimes(1);
    expect(onNext).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('disables both buttons while a page is loading, whatever the paging flags say', async () => {
    const onPrev = vi.fn();
    const onNext = vi.fn();
    const user = userEvent.setup();
    render(<PaginationControls {...baseProps} onPrev={onPrev} onNext={onNext} disabled />);

    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(onNext).not.toHaveBeenCalled();
  });
});
