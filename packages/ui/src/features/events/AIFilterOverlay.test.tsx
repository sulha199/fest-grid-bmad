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

  it('renders resolved summary, and triggers save, apply, re-prompt', () => {
    const onSave = vi.fn();
    const onApply = vi.fn();
    const onRePrompt = vi.fn();
    const saveLabels = {
      ...defaultLabels,
      saveFilter: 'Save Filter',
      saving: 'Saving...',
      saveSuccess: 'Saved!',
      resolvedSummaryTitle: 'Resolved Filter Summary',
      rePrompt: 'Try Another Prompt',
    };

    render(
      <AIFilterOverlay
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        labels={saveLabels}
        resolvedSummary="Filtered events about jazz in Berlin"
        resolvedCaveats="Caveat: price limit ignored"
        onSave={onSave}
        onApply={onApply}
        onRePrompt={onRePrompt}
      />
    );

    expect(screen.getByText('Resolved Filter Summary')).toBeInTheDocument();
    expect(screen.getByText('Filtered events about jazz in Berlin')).toBeInTheDocument();
    expect(screen.getByText('Caveat: price limit ignored')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Save Filter' }));
    expect(onSave).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Apply Filter' }));
    expect(onApply).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Try Another Prompt' }));
    expect(onRePrompt).toHaveBeenCalled();
  });

  it('shows save success state', () => {
    const saveLabels = {
      ...defaultLabels,
      saveFilter: 'Save Filter',
      saveSuccess: 'Saved successfully!',
    };

    render(
      <AIFilterOverlay
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        labels={saveLabels}
        resolvedSummary="Filtered events about jazz in Berlin"
        saveSuccess={true}
      />
    );

    expect(screen.getAllByText('Saved successfully!').length).toBeGreaterThan(0);
  });

  it('renders example prompt chips and fills the textarea on click, disabled while loading', () => {
    const { rerender } = render(
      <AIFilterOverlay
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        labels={{ ...defaultLabels, examplePromptsLabel: 'Try an example:' }}
        examplePrompts={['prompt one', 'jazz or blues, not workshops']}
      />
    );

    expect(screen.getByText('Try an example:')).toBeInTheDocument();
    const promptOne = screen.getByRole('button', { name: 'prompt one' });
    const groupedPrompt = screen.getByRole('button', { name: 'jazz or blues, not workshops' });
    expect(promptOne).toBeInTheDocument();
    expect(groupedPrompt).toBeInTheDocument();

    fireEvent.click(groupedPrompt);
    const textarea = screen.getByPlaceholderText('e.g. music festivals this weekend') as HTMLTextAreaElement;
    expect(textarea.value).toBe('jazz or blues, not workshops');

    rerender(
      <AIFilterOverlay
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        labels={{ ...defaultLabels, examplePromptsLabel: 'Try an example:' }}
        examplePrompts={['prompt one', 'jazz or blues, not workshops']}
        isLoading={true}
      />
    );

    expect(screen.getByRole('button', { name: 'prompt one' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'jazz or blues, not workshops' })).toBeDisabled();
  });

  it('hides example prompt chips once resolvedSummary is set', () => {
    render(
      <AIFilterOverlay
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        labels={{ ...defaultLabels, examplePromptsLabel: 'Try an example:' }}
        examplePrompts={['prompt one', 'jazz or blues, not workshops']}
        resolvedSummary="Filtered events about jazz in Berlin"
      />
    );

    expect(screen.queryByText('Try an example:')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'prompt one' })).not.toBeInTheDocument();
  });

  it('renders the Story 9.4 "too complex" caveat text verbatim in the existing amber block', () => {
    const tooComplexCaveat =
      '- Your prompt described more conditions than the filter supports, so some were dropped.';

    render(
      <AIFilterOverlay
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        labels={defaultLabels}
        resolvedSummary="Filtered events about jazz in Berlin"
        resolvedCaveats={tooComplexCaveat}
      />
    );

    expect(screen.getByText(tooComplexCaveat)).toBeInTheDocument();
  });
});
