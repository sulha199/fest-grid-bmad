import * as React from 'react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PageHeader } from './page-header';

describe('PageHeader', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders title-only correctly without description or action', () => {
    render(<PageHeader title="My Test Title" />);

    const titleElement = screen.getByRole('heading', { level: 1 });
    expect(titleElement).toBeInTheDocument();
    expect(titleElement.textContent).toBe('My Test Title');
    expect(titleElement.className).toContain('text-3xl');
    expect(titleElement.className).toContain('font-bold');

    // Description and action should not be in the DOM
    expect(screen.queryByText('My Test Description')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders description when passed, and omits it when not passed', () => {
    const { rerender } = render(<PageHeader title="Test Title" description="Test Description" />);

    const descElement = screen.getByText('Test Description');
    expect(descElement).toBeInTheDocument();
    expect(descElement.tagName.toLowerCase()).toBe('p');
    expect(descElement.className).toContain('text-muted-foreground');

    // Re-render without description
    rerender(<PageHeader title="Test Title" />);
    expect(screen.queryByText('Test Description')).not.toBeInTheDocument();
  });

  it('renders action button with icon and responsive label when passed', () => {
    const mockOnClick = vi.fn();
    const testIcon = <span data-testid="test-icon">MockIcon</span>;

    render(
      <PageHeader
        title="Test Title"
        action={{
          label: 'Add Item',
          icon: testIcon,
          onClick: mockOnClick,
        }}
      />
    );

    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
    expect(button.className).toContain('inline-flex');
    expect(button.className).toContain('bg-primary');

    // Verify icon renders
    const icon = screen.getByTestId('test-icon');
    expect(icon).toBeInTheDocument();
    expect(icon.textContent).toBe('MockIcon');

    // Verify label is wrapped in a span with responsive classes
    const labelSpan = screen.getByText('Add Item');
    expect(labelSpan).toBeInTheDocument();
    expect(labelSpan.tagName.toLowerCase()).toBe('span');
    expect(labelSpan.className).toContain('hidden');
    expect(labelSpan.className).toContain('sm:inline');
  });

  it('correctly passes disabled prop to action button and prevents clicking', async () => {
    const mockOnClick = vi.fn();
    const user = userEvent.setup();

    const { rerender } = render(
      <PageHeader
        title="Test Title"
        action={{
          label: 'Add Item',
          icon: <span>Icon</span>,
          onClick: mockOnClick,
          disabled: false,
        }}
      />
    );

    const button = screen.getByRole('button');
    expect(button).not.toBeDisabled();

    // Click enabled button
    await user.click(button);
    expect(mockOnClick).toHaveBeenCalledTimes(1);

    // Re-render with disabled: true
    rerender(
      <PageHeader
        title="Test Title"
        action={{
          label: 'Add Item',
          icon: <span>Icon</span>,
          onClick: mockOnClick,
          disabled: true,
        }}
      />
    );

    const disabledButton = screen.getByRole('button');
    expect(disabledButton).toBeDisabled();
    expect(disabledButton.className).toContain('disabled:opacity-50');

    // Attempting click should not call mockOnClick again
    await user.click(disabledButton);
    expect(mockOnClick).toHaveBeenCalledTimes(1); // Still 1
  });
});
