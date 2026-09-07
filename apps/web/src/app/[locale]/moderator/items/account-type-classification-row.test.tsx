import '@testing-library/jest-dom/vitest';
import React from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import enMessages from '../../../../../locales/en.json';
import { AccountTypeClassificationRow, type AccountTypeClassificationReview } from './account-type-classification-row';

afterEach(() => {
  cleanup();
});

function renderRow(review: AccountTypeClassificationReview, onResolve = vi.fn().mockResolvedValue(undefined)) {
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <AccountTypeClassificationRow review={review} onResolve={onResolve} />
    </NextIntlClientProvider>
  );
  return { onResolve };
}

const lowConfidenceReview: AccountTypeClassificationReview = {
  id: 'review-1',
  accountId: 'account-1',
  proposedAccountType: 'ORGANIZER_VENUE_EVENT',
  confidenceScore: 0.42,
  failureReason: null,
  createdAt: '2026-09-01T00:00:00.000Z',
  account: {
    id: 'account-1',
    displayName: 'Low Confidence Account',
    platform: 'instagram',
    username: 'low_conf',
    profileImageUrl: null,
    description: 'Some account bio text',
  },
};

const failedReview: AccountTypeClassificationReview = {
  id: 'review-2',
  accountId: 'account-2',
  proposedAccountType: null,
  confidenceScore: null,
  failureReason: 'AI classification attempt failed after retries',
  createdAt: '2026-09-01T00:00:00.000Z',
  account: {
    id: 'account-2',
    displayName: 'Failed Account',
    platform: 'tiktok',
    username: 'failed_acc',
    profileImageUrl: null,
    description: null,
  },
};

describe('AccountTypeClassificationRow', () => {
  it('renders the proposed-type + confidence branch with percent-formatted confidence', () => {
    renderRow(lowConfidenceReview);

    expect(screen.getByText('Low Confidence Account')).toBeInTheDocument();
    expect(screen.getByText('@low_conf')).toBeInTheDocument();
    expect(screen.getByText('Some account bio text')).toBeInTheDocument();
    expect(screen.getByText('Organizer / Venue / Event')).toBeInTheDocument();
    expect(screen.getByText('42%')).toBeInTheDocument();
    expect(screen.queryByText('Classification Failed')).not.toBeInTheDocument();
  });

  it('renders the failure-reason branch when proposedAccountType is null', () => {
    renderRow(failedReview);

    expect(screen.getByText('Failed Account')).toBeInTheDocument();
    expect(screen.getByText('Classification Failed')).toBeInTheDocument();
    expect(screen.getByText('AI classification attempt failed after retries')).toBeInTheDocument();
    // fallback dash for missing bio
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.queryByText('Organizer / Venue / Event')).not.toBeInTheDocument();
  });

  it('fires onResolve with (id, "ORGANIZER_VENUE_EVENT") when that button is clicked', () => {
    const { onResolve } = renderRow(lowConfidenceReview);
    fireEvent.click(screen.getByText('Organizer/Venue/Event'));
    expect(onResolve).toHaveBeenCalledWith('review-1', 'ORGANIZER_VENUE_EVENT');
  });

  it('fires onResolve with (id, "PERSONAL") when that button is clicked', () => {
    const { onResolve } = renderRow(lowConfidenceReview);
    fireEvent.click(screen.getByText('Personal'));
    expect(onResolve).toHaveBeenCalledWith('review-1', 'PERSONAL');
  });

  it('fires onResolve with (id, "CURATOR_GUIDE") when that button is clicked', () => {
    const { onResolve } = renderRow(lowConfidenceReview);
    fireEvent.click(screen.getByText('Curator/Guide'));
    expect(onResolve).toHaveBeenCalledWith('review-1', 'CURATOR_GUIDE');
  });

  it('falls back to initials avatar and handles onError for a broken profileImageUrl', () => {
    const reviewWithImage: AccountTypeClassificationReview = {
      ...lowConfidenceReview,
      account: { ...lowConfidenceReview.account, profileImageUrl: 'https://example.com/broken.jpg' },
    };
    renderRow(reviewWithImage);

    const img = screen.getByAltText('Low Confidence Account') as HTMLImageElement;
    expect(img).toBeInTheDocument();
    fireEvent.error(img);
    expect(img.style.display).toBe('none');
  });

  it('renders initials fallback directly when no profileImageUrl is present', () => {
    renderRow(lowConfidenceReview);
    expect(screen.getByText('lo')).toBeInTheDocument();
  });
});
