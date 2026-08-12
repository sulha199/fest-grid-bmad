import '@testing-library/jest-dom/vitest';
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { SummaryBar } from './summary-bar';

afterEach(() => {
  cleanup();
});

describe('SummaryBar Component', () => {
  it('renders selected counts and quota correctly', () => {
    render(<SummaryBar selectedCount={3} quota={5} />);
    const countText = screen.getByText('Selected Posts: 3 / 5');
    expect(countText).toBeInTheDocument();
    expect(countText).toHaveClass('text-slate-700');
  });

  it('colors text red when over quota', () => {
    render(<SummaryBar selectedCount={6} quota={5} />);
    const countText = screen.getByText('Selected Posts: 6 / 5');
    expect(countText).toBeInTheDocument();
    expect(countText).toHaveClass('text-red-500');
  });

  it('disables button when count is 0', () => {
    render(<SummaryBar selectedCount={0} quota={5} />);
    const btn = screen.getByRole('button', { name: 'Extract Events' });
    expect(btn).toBeDisabled();
  });

  it('disables button when over quota', () => {
    render(<SummaryBar selectedCount={6} quota={5} />);
    const btn = screen.getByRole('button', { name: 'Extract Events' });
    expect(btn).toBeDisabled();
  });

  it('calls onExtract handler when clicked', () => {
    const onExtract = vi.fn();
    render(<SummaryBar selectedCount={3} quota={5} onExtract={onExtract} />);
    const btn = screen.getByRole('button', { name: 'Extract Events' });
    fireEvent.click(btn);
    expect(onExtract).toHaveBeenCalled();
  });
});
