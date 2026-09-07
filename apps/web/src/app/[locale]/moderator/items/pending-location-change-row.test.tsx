import '@testing-library/jest-dom/vitest';
import React from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import enMessages from '../../../../../locales/en.json';
import { PendingLocationChangeRow, type PendingLocationChange } from './pending-location-change-row';

afterEach(() => {
  cleanup();
});

function renderRow(change: PendingLocationChange, onResolve = vi.fn().mockResolvedValue(undefined), onEditRequest = vi.fn()) {
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <PendingLocationChangeRow change={change} onResolve={onResolve} onEditRequest={onEditRequest} />
    </NextIntlClientProvider>
  );
  return { onResolve, onEditRequest };
}

const pendingReviewChange: PendingLocationChange = {
  id: 'change-1',
  accountId: 'account-1',
  status: 'PENDING_REVIEW',
  createdAt: '2026-08-11T13:00:00.000Z',
  account: {
    id: 'account-1',
    displayName: 'Test Account',
    platform: 'instagram',
    username: 'test_user',
    profileImageUrl: null,
  },
  previousLocation: {
    placeName: 'Jakarta, ID',
    formattedAddress: 'Jakarta, Indonesia',
    coordinates: { lat: -6.2, lng: 106.8 },
  },
  newLocation: {
    placeName: 'Monas, ID',
    formattedAddress: 'Monumen Nasional, Jakarta, Indonesia',
    coordinates: { lat: -6.17, lng: 106.82 },
  },
};

const awaitingApprovalChange: PendingLocationChange = {
  ...pendingReviewChange,
  id: 'change-2',
  status: 'AWAITING_APPROVAL',
  previousLocation: null,
};

describe('PendingLocationChangeRow', () => {
  it('renders Accept/Revert buttons for a PENDING_REVIEW row (no Awaiting Approval badge)', () => {
    renderRow(pendingReviewChange);

    expect(screen.getByRole('button', { name: 'Accept' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Revert' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reject' })).not.toBeInTheDocument();
    expect(screen.queryByText('Awaiting Approval')).not.toBeInTheDocument();
  });

  it('renders Approve/Reject buttons and an Awaiting Approval badge for an AWAITING_APPROVAL row', () => {
    renderRow(awaitingApprovalChange);

    expect(screen.getByText('Awaiting Approval')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reject' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Accept' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Revert' })).not.toBeInTheDocument();
  });

  it('calls onResolve with (id, "ACCEPT") for a PENDING_REVIEW row', () => {
    const { onResolve } = renderRow(pendingReviewChange);
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));
    expect(onResolve).toHaveBeenCalledWith('change-1', 'ACCEPT');
  });

  it('calls onResolve with (id, "REVERT") for a PENDING_REVIEW row', () => {
    const { onResolve } = renderRow(pendingReviewChange);
    fireEvent.click(screen.getByRole('button', { name: 'Revert' }));
    expect(onResolve).toHaveBeenCalledWith('change-1', 'REVERT');
  });

  it('calls onResolve with (id, "APPROVE") for an AWAITING_APPROVAL row', () => {
    const { onResolve } = renderRow(awaitingApprovalChange);
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    expect(onResolve).toHaveBeenCalledWith('change-2', 'APPROVE');
  });

  it('calls onResolve with (id, "REJECT") for an AWAITING_APPROVAL row', () => {
    const { onResolve } = renderRow(awaitingApprovalChange);
    fireEvent.click(screen.getByRole('button', { name: 'Reject' }));
    expect(onResolve).toHaveBeenCalledWith('change-2', 'REJECT');
  });
});
