import * as React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MultiSelect } from './multi-select';

const mockOptions = [
  { value: 'music', label: 'Music' },
  { value: 'tech', label: 'Technology' },
  { value: 'food', label: 'Food & Drink' },
];

describe('MultiSelect', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders a facet label and options', () => {
    const onChange = vi.fn();
    render(
      <MultiSelect
        facetLabel="Categories"
        options={mockOptions}
        selectedValues={[]}
        onChange={onChange}
      />
    );

    expect(screen.getByText('Categories')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Music' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Technology' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Food & Drink' })).toBeInTheDocument();
  });

  it('toggles a single option and calls onChange with it added', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <MultiSelect
        facetLabel="Categories"
        options={mockOptions}
        selectedValues={[]}
        onChange={onChange}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Music' }));
    expect(onChange).toHaveBeenCalledWith(['music']);
  });

  it('toggles a selected option and calls onChange with it removed', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <MultiSelect
        facetLabel="Categories"
        options={mockOptions}
        selectedValues={['music', 'tech']}
        onChange={onChange}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Music' }));
    expect(onChange).toHaveBeenCalledWith(['tech']);
  });

  it('reflects multiple simultaneous selections via aria-pressed', () => {
    const onChange = vi.fn();
    render(
      <MultiSelect
        facetLabel="Categories"
        options={mockOptions}
        selectedValues={['music', 'tech']}
        onChange={onChange}
      />
    );

    expect(screen.getByRole('button', { name: 'Music' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Technology' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Food & Drink' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('renders Clear button only when selection is not empty, and Clear calls onChange([])', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(
      <MultiSelect
        facetLabel="Categories"
        options={mockOptions}
        selectedValues={[]}
        onChange={onChange}
      />
    );

    expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument();

    rerender(
      <MultiSelect
        facetLabel="Categories"
        options={mockOptions}
        selectedValues={['music']}
        onChange={onChange}
      />
    );

    const clearButton = screen.getByRole('button', { name: 'Clear' });
    expect(clearButton).toBeInTheDocument();

    await user.click(clearButton);
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('empty options array renders no option buttons and no Clear action without throwing', () => {
    const onChange = vi.fn();
    render(
      <MultiSelect
        facetLabel="Empty Facet"
        options={[]}
        selectedValues={['music']} // Even if selected values exist, Clear is not rendered if options are empty
        onChange={onChange}
      />
    );

    expect(screen.getByText('Empty Facet')).toBeInTheDocument();
    expect(screen.queryByRole('group')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Music' })).not.toBeInTheDocument();
  });

  it('supports keyboard Tab+Enter/Space to activate an option', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <MultiSelect
        facetLabel="Categories"
        options={mockOptions}
        selectedValues={[]}
        onChange={onChange}
      />
    );

    const musicButton = screen.getByRole('button', { name: 'Music' });
    const techButton = screen.getByRole('button', { name: 'Technology' });

    await user.tab(); // focus Music
    expect(musicButton).toHaveFocus();
    
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledWith(['music']);

    await user.tab(); // focus Technology
    expect(techButton).toHaveFocus();

    await user.keyboard(' '); // Space to toggle
    expect(onChange).toHaveBeenCalledWith(['tech']);
  });

  it('custom labels.clearLabel overrides the default Clear text', () => {
    const onChange = vi.fn();
    render(
      <MultiSelect
        facetLabel="Categories"
        options={mockOptions}
        selectedValues={['music']}
        onChange={onChange}
        labels={{ clearLabel: 'Reset All' }}
      />
    );

    expect(screen.getByRole('button', { name: 'Reset All' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument();
  });
});
