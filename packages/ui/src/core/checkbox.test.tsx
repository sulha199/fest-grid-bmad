/// <reference types="@testing-library/jest-dom" />
import React, { useState } from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { Checkbox } from './checkbox';

describe('Checkbox Component', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders with label and correct accessibility attributes', () => {
    render(<Checkbox id="test-check" label="Accept terms" checked={false} onChange={vi.fn()} />);

    const checkbox = screen.getByLabelText('Accept terms');
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).not.toBeChecked();
    expect(checkbox).toHaveAttribute('type', 'checkbox');
  });

  it('fires onChange when clicked', () => {
    const onChange = vi.fn();
    render(<Checkbox id="test-check" label="Accept terms" checked={false} onChange={onChange} />);

    const checkbox = screen.getByLabelText('Accept terms');
    fireEvent.click(checkbox);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('respects checked prop', () => {
    render(<Checkbox id="test-check" label="Accept terms" checked={true} onChange={vi.fn()} />);

    const checkbox = screen.getByLabelText('Accept terms');
    expect(checkbox).toBeChecked();
  });

  it('can be disabled', () => {
    render(<Checkbox id="test-check" label="Accept terms" checked={false} onChange={vi.fn()} disabled={true} />);

    const checkbox = screen.getByLabelText('Accept terms');
    expect(checkbox).toBeDisabled();
  });
});
