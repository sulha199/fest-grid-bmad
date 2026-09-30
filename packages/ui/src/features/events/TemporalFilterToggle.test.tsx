import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { TemporalFilterToggle } from './TemporalFilterToggle';

afterEach(() => {
  cleanup();
});

const labels = {
  today: 'Today',
  upcoming: 'Upcoming',
  all: 'All',
  groupLabel: 'Filter events by time',
};

describe('TemporalFilterToggle', () => {
  it('renders a role="radiogroup" with three role="radio" options, accessibly labeled', () => {
    render(<TemporalFilterToggle value={null} onChange={vi.fn()} labels={labels} />);

    const group = screen.getByRole('radiogroup', { name: labels.groupLabel });
    expect(group).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(3);
  });

  it('marks the "All" option checked when value is null', () => {
    render(<TemporalFilterToggle value={null} onChange={vi.fn()} labels={labels} />);

    expect(screen.getByRole('radio', { name: labels.all })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: labels.today })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('radio', { name: labels.upcoming })).toHaveAttribute('aria-checked', 'false');
  });

  it('marks the "Today" option checked when value is TODAY', () => {
    render(<TemporalFilterToggle value="TODAY" onChange={vi.fn()} labels={labels} />);

    expect(screen.getByRole('radio', { name: labels.today })).toHaveAttribute('aria-checked', 'true');
  });

  it('calls onChange with "TODAY"/"UPCOMING" when those options are selected', () => {
    const onChange = vi.fn();
    render(<TemporalFilterToggle value={null} onChange={onChange} labels={labels} />);

    fireEvent.click(screen.getByRole('radio', { name: labels.today }));
    expect(onChange).toHaveBeenLastCalledWith('TODAY');

    fireEvent.click(screen.getByRole('radio', { name: labels.upcoming }));
    expect(onChange).toHaveBeenLastCalledWith('UPCOMING');
  });

  it('calls onChange with null (not the "ALL" sentinel) when the "All" option is selected', () => {
    const onChange = vi.fn();
    render(<TemporalFilterToggle value="TODAY" onChange={onChange} labels={labels} />);

    fireEvent.click(screen.getByRole('radio', { name: labels.all }));
    expect(onChange).toHaveBeenLastCalledWith(null);
  });
});
