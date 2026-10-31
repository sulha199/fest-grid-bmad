import '@testing-library/jest-dom/vitest';
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import enMessages from '../../../locales/en.json';
import { ReextractionDedupTier, PostGroupingReason } from '@/generated/graphql';
import { ReextractPreviewResult } from './reextract-preview-result';
import { ModeratorSourcePostsPanel } from './moderator-source-posts-panel';
import { ReextractPostDialog } from './reextract-post-dialog';
import { usePostReextractionPreview, type ReextractionPreview } from './use-post-reextraction-preview';

vi.mock('./use-post-reextraction-preview');
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const wrap = (ui: React.ReactElement) => (
  <NextIntlClientProvider locale="en" messages={enMessages as any}>
    {ui}
  </NextIntlClientProvider>
);

function makePreview(overrides: Partial<ReextractionPreview> = {}): ReextractionPreview {
  return {
    groupingReason: PostGroupingReason.SingleEvent,
    postStored: true,
    rescraped: false,
    imagesAvailable: 1,
    imagesSent: 1,
    applicable: false,
    applied: null,
    events: [
      {
        extractionOrdinal: 0,
        eventName: 'GembiRun Loka 2026',
        alreadyRepresentedBySlug: null,
        isStub: false,
        links: [{ url: 'http://www.gembirunloka.id', label: null }],
        schedules: [{ title: 'Race day', startDate: '2026-11-08', endDate: null, isMain: true }],
        dedup: { tier: ReextractionDedupTier.Mid, score: 0.87, candidateSlug: 'ig_p_DeZE84tha0E', candidateName: 'GembiRun Loka 2026 (race day)' },
      },
    ],
    ...overrides,
  };
}

const idle = { start: vi.fn(), reset: vi.fn(), phase: 'idle', preview: null, errorCode: null, errorMessage: null } as any;

describe('ReextractPreviewResult (AD-40)', () => {
  afterEach(cleanup);

  describe('Apply (AD-40)', () => {
    const summary = {
      groupingReason: PostGroupingReason.Roundup,
      reused: [{ slug: 'ig_p_AAA', eventName: 'Kulon Progo Half Marathon', ordinal: 1 }],
      created: [{ slug: 'ig_p_AAA~2', eventName: 'Merapi Trail Run', ordinal: 2 }],
      linkedToExisting: [],
      queuedForReview: 1,
      skippedDeleted: 0,
      orphans: [{ slug: 'old-orphan', eventName: 'Left Alone Gala' }],
    };
    const applyState = (overrides: Record<string, unknown> = {}) =>
      ({ apply: vi.fn().mockResolvedValue(undefined), phase: 'idle', summary: null, errorMessage: null, ...overrides }) as any;

    it('offers Apply only when the server says the preview is applicable and an apply handler is given', () => {
      const { unmount } = render(wrap(<ReextractPreviewResult preview={makePreview({ applicable: true })} apply={applyState()} />));
      expect(screen.getByRole('button', { name: 'Apply as roundup' })).toBeInTheDocument();
      unmount();
      const { unmount: unmount2 } = render(wrap(<ReextractPreviewResult preview={makePreview({ applicable: false })} apply={applyState()} />));
      expect(screen.queryByRole('button', { name: 'Apply as roundup' })).not.toBeInTheDocument();
      unmount2();
      render(wrap(<ReextractPreviewResult preview={makePreview({ applicable: true })} />));
      expect(screen.queryByTestId('reextract-apply-panel')).not.toBeInTheDocument();
    });

    it('asks for confirmation first: cancel changes nothing, confirm applies once', async () => {
      const user = userEvent.setup();
      const state = applyState();
      render(wrap(<ReextractPreviewResult preview={makePreview({ applicable: true })} apply={state} />));

      await user.click(screen.getByRole('button', { name: 'Apply as roundup' }));
      expect(await screen.findByText('Apply this preview?')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(state.apply).not.toHaveBeenCalled();

      await user.click(screen.getByRole('button', { name: 'Apply as roundup' }));
      await user.click(await screen.findByRole('button', { name: 'Apply' }));
      expect(state.apply).toHaveBeenCalledTimes(1);
    });

    it('shows what was applied, links the events, and lists the events it left alone', () => {
      render(wrap(<ReextractPreviewResult preview={makePreview({ applicable: false })} apply={applyState({ phase: 'done', summary })} />));
      const box = screen.getByTestId('reextract-apply-summary');
      expect(box).toHaveTextContent('1 existing event kept');
      expect(box).toHaveTextContent('1 new event created');
      expect(box).toHaveTextContent('1 possible duplicate queued for review');
      expect(screen.getByRole('link', { name: 'Kulon Progo Half Marathon' })).toHaveAttribute('href', '/events/ig_p_AAA');
      expect(screen.getByRole('link', { name: 'Merapi Trail Run' })).toHaveAttribute('href', '/events/ig_p_AAA~2');
      expect(screen.getByTestId('reextract-apply-orphans')).toHaveTextContent('Left Alone Gala');
      expect(screen.queryByRole('button', { name: 'Apply as roundup' })).not.toBeInTheDocument();
    });

    it('shows the failure and lets the moderator try again', () => {
      render(wrap(<ReextractPreviewResult preview={makePreview({ applicable: true })} apply={applyState({ phase: 'failed', errorMessage: 'This preview is too old to apply. Run the preview again.' })} />));
      expect(screen.getByRole('alert')).toHaveTextContent('too old to apply');
      expect(screen.getByRole('button', { name: 'Apply as roundup' })).toBeEnabled();
    });
  });

  it('warns when fewer images were read than the post lists, and stays quiet otherwise (BUG-097)', () => {
    const { unmount } = render(wrap(<ReextractPreviewResult preview={makePreview({ imagesAvailable: 6, imagesSent: 4 })} />));
    expect(screen.getByTestId('reextract-images-warning')).toHaveTextContent('Only 4 of 6 images were read');
    unmount();
    render(wrap(<ReextractPreviewResult preview={makePreview({ imagesAvailable: 6, imagesSent: 6 })} />));
    expect(screen.queryByTestId('reextract-images-warning')).not.toBeInTheDocument();
  });

  it('shows grouping, the event, its dedup tier with score, and a link to the closest event', () => {
    render(wrap(<ReextractPreviewResult preview={makePreview()} />));
    expect(screen.getByText(/Grouping: single event/)).toBeInTheDocument();
    expect(screen.getByText('GembiRun Loka 2026', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByTestId('reextract-tier')).toHaveTextContent('Would queue for review 0.87');
    expect(screen.getByRole('link', { name: 'GembiRun Loka 2026 (race day)' })).toHaveAttribute('href', '/events/ig_p_DeZE84tha0E');
    expect(screen.getByText(/★ Race day: 2026-11-08/)).toBeInTheDocument();
    expect(screen.getByText(/Venue matching in this preview uses the location text only/)).toBeInTheDocument();
  });

  it('flags an item whose (post, ordinal) slot is already taken, and a stub', () => {
    const preview = makePreview();
    preview.events[0] = { ...preview.events[0], alreadyRepresentedBySlug: 'ig_p_Debx7_4FAhC', isStub: true };
    render(wrap(<ReextractPreviewResult preview={preview} />));
    expect(screen.getByRole('link', { name: 'ig_p_Debx7_4FAhC' })).toHaveAttribute('href', '/events/ig_p_Debx7_4FAhC');
    expect(screen.getByText('Stub')).toBeInTheDocument();
  });

  it('explains a post that is not an event, and an unstored/rescraped post', () => {
    render(wrap(<ReextractPreviewResult preview={makePreview({ events: [], postStored: false, rescraped: true })} />));
    expect(screen.getByText('The post was not recognized as describing an event.')).toBeInTheDocument();
    expect(screen.getByText(/caption re-fetched/)).toBeInTheDocument();
    expect(screen.getByText(/no account signal/)).toBeInTheDocument();
  });

  it('shows "no similar event" when no candidate passed', () => {
    const preview = makePreview();
    preview.events[0] = { ...preview.events[0], dedup: { tier: ReextractionDedupTier.None, score: null, candidateSlug: null, candidateName: null } };
    render(wrap(<ReextractPreviewResult preview={preview} />));
    expect(screen.getByTestId('reextract-tier')).toHaveTextContent('No similar event, new event');
    expect(screen.queryByText('Closest existing event:')).not.toBeInTheDocument();
  });
});

describe('ModeratorSourcePostsPanel (AD-40)', () => {
  beforeEach(() => {
    vi.mocked(usePostReextractionPreview).mockReturnValue(idle);
  });
  afterEach(cleanup);

  it('renders nothing for an event with no source posts', () => {
    const { container } = render(wrap(<ModeratorSourcePostsPanel sourcePosts={[]} />));
    expect(container).toBeEmptyDOMElement();
  });

  it('lists a single source post with a Re-extract button (not gated on more than one post)', () => {
    render(wrap(<ModeratorSourcePostsPanel sourcePosts={[{ postId: 'p1', title: 'Costume contest', sourcePostUrl: 'https://www.instagram.com/p/x/', account: { username: 'gembirunloka' } }]} />));
    expect(screen.getByRole('link', { name: 'Costume contest' })).toBeInTheDocument();
    expect(screen.getByText(/@gembirunloka/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Re-extract' })).toBeInTheDocument();
  });

  it('opens the preview dialog for that post and starts the preview', async () => {
    const start = vi.fn();
    vi.mocked(usePostReextractionPreview).mockReturnValue({ ...idle, start, phase: 'running' });
    render(wrap(<ModeratorSourcePostsPanel sourcePosts={[{ postId: 'p1', title: 'Costume contest' }]} />));
    await userEvent.click(screen.getByRole('button', { name: 'Re-extract' }));
    expect(start).toHaveBeenCalledWith({ postId: 'p1' });
    expect(await screen.findByText('Re-extract preview')).toBeInTheDocument();
  });
});

describe('ReextractPostDialog (AD-40)', () => {
  afterEach(cleanup);

  it('shows the failure message with a retry', async () => {
    const start = vi.fn();
    vi.mocked(usePostReextractionPreview).mockReturnValue({ ...idle, start, phase: 'failed', errorMessage: 'This post was rescraped recently. Try again in 8 minutes.' });
    render(wrap(<ReextractPostDialog isOpen postId="p1" onClose={() => {}} />));
    expect(screen.getByRole('alert')).toHaveTextContent('Try again in 8 minutes');
    start.mockClear();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(start).toHaveBeenCalledWith({ postId: 'p1' });
  });

  it('shows the result once done', () => {
    vi.mocked(usePostReextractionPreview).mockReturnValue({ ...idle, phase: 'done', preview: makePreview() });
    render(wrap(<ReextractPostDialog isOpen postId="p1" onClose={() => {}} />));
    expect(screen.getByTestId('reextract-preview-result')).toBeInTheDocument();
  });
});
