import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import React from 'react';
import { StatusBadge } from './status-badge';

describe('StatusBadge Component', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders correctly with active variant', () => {
    render(<StatusBadge variant="active" label="Active Label" />);
    const badge = screen.getByText('Active Label');
    expect(badge).toBeDefined();
    expect(badge.className).toContain('text-green-800');
  });

  it('renders correctly with invalid variant', () => {
    render(<StatusBadge variant="invalid" label="Invalid Label" />);
    const badge = screen.getByText('Invalid Label');
    expect(badge).toBeDefined();
    expect(badge.className).toContain('text-red-800');
  });

  it('renders correctly with pending variant', () => {
    render(<StatusBadge variant="pending" label="Pending Label" />);
    const badge = screen.getByText('Pending Label');
    expect(badge).toBeDefined();
    expect(badge.className).toContain('text-amber-800');
  });

  it('renders correctly with upheld variant', () => {
    render(<StatusBadge variant="upheld" label="Upheld Label" />);
    const badge = screen.getByText('Upheld Label');
    expect(badge).toBeDefined();
    expect(badge.className).toContain('text-red-800');
  });

  it('renders correctly with dismissed variant', () => {
    render(<StatusBadge variant="dismissed" label="Dismissed Label" />);
    const badge = screen.getByText('Dismissed Label');
    expect(badge).toBeDefined();
    expect(badge.className).toContain('text-green-800');
  });
});
