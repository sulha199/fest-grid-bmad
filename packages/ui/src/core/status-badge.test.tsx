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

  it('renders correctly with pendingReview variant', () => {
    render(<StatusBadge variant="pendingReview" label="Pending Review" />);
    const badge = screen.getByText('Pending Review');
    expect(badge).toBeDefined();
    expect(badge.className).toContain('text-amber-800');
  });

  it('renders correctly with accepted variant', () => {
    render(<StatusBadge variant="accepted" label="Accepted" />);
    const badge = screen.getByText('Accepted');
    expect(badge).toBeDefined();
    expect(badge.className).toContain('text-green-800');
  });

  it('renders correctly with reverted variant', () => {
    render(<StatusBadge variant="reverted" label="Reverted" />);
    const badge = screen.getByText('Reverted');
    expect(badge).toBeDefined();
    expect(badge.className).toContain('text-red-800');
  });

  it('renders correctly with expired variant', () => {
    render(<StatusBadge variant="expired" label="Expired" />);
    const badge = screen.getByText('Expired');
    expect(badge).toBeDefined();
    expect(badge.className).toContain('text-slate-800');
  });

  it('renders correctly with removedByModeration variant', () => {
    render(<StatusBadge variant="removedByModeration" label="Removed" />);
    const badge = screen.getByText('Removed');
    expect(badge).toBeDefined();
    expect(badge.className).toContain('text-red-800');
  });

  it('renders correctly with hiddenByMe variant', () => {
    render(<StatusBadge variant="hiddenByMe" label="Hidden" />);
    const badge = screen.getByText('Hidden');
    expect(badge).toBeDefined();
    expect(badge.className).toContain('text-amber-800');
  });
});
