import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { AIFilterOverlay } from './AIFilterOverlay';

const defaultLabels = {
  title: 'Search with AI',
  description: 'Describe what you are looking for',
  placeholder: 'e.g. music festivals this weekend',
  submit: 'Apply Filter',
  cancel: 'Cancel',
  errorTitle: 'Error occurred',
};

describe('AIFilterOverlay', () => {
  afterEach(cleanup);

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <AIFilterOverlay
        isOpen={false}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        labels={defaultLabels}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders title, description, and handles submit and close', () => {
    const onClose = vi.fn();
    const onSubmit = vi.fn();

    render(
      <AIFilterOverlay
        isOpen={true}
        onClose={onClose}
        onSubmit={onSubmit}
        labels={defaultLabels}
      />
    );

    expect(screen.getByText('Search with AI')).toBeInTheDocument();
    expect(screen.getByText('Describe what you are looking for')).toBeInTheDocument();

    const textarea = screen.getByPlaceholderText('e.g. music festivals this weekend');
    expect(textarea).toBeInTheDocument();

    fireEvent.change(textarea, { target: { value: 'jazz festival' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply Filter' }));

    expect(onSubmit).toHaveBeenCalledWith('jazz festival');

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('surfaces error message when provided', () => {
    render(
      <AIFilterOverlay
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        labels={defaultLabels}
        error="Invalid natural language query"
      />
    );

    expect(screen.getByText('Invalid natural language query')).toBeInTheDocument();
  });
});
