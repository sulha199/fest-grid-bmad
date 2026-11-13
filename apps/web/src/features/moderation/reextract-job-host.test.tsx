import '@testing-library/jest-dom/vitest';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { capturePostHogEvent } from '@festgrid/analytics';
import { graphqlClient } from '@/lib/graphql-client';
import { installGraphqlFake, makeFragment, setVisibility, TestProviders } from '@/features/jobs/job-test-support';
import { PostGroupingReason, ReextractionDedupTier } from '@/generated/graphql';
import { ModeratorSourcePostsPanel } from './moderator-source-posts-panel';

vi.mock('@/lib/graphql-client', () => ({ graphqlClient: { request: vi.fn() } }));
vi.mock('@festgrid/analytics', () => ({ capturePostHogEvent: vi.fn() }));
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...rest }: { href: string; children?: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const request = vi.mocked(graphqlClient.request) as unknown as ReturnType<typeof vi.fn>;
const capture = vi.mocked(capturePostHogEvent);

const POSTS = [{ postId: 'p1', title: 'Costume contest', sourcePostUrl: 'https://www.instagram.com/p/x/', account: { username: 'gembirunloka' } }];

const DONE_STEPS = [
  { key: 'refresh', state: 'DONE', done: null, total: null },
  { key: 'preview', state: 'DONE', done: null, total: null },
];
const endedJob = (overrides: Record<string, unknown> = {}) =>
  makeFragment({
    status: 'SUCCEEDED_WITH_LIMITS',
    reasonCode: 'NO_PROVIDER_REACHABLE',
    finishedAt: '2026-11-13T14:01:20.000Z',
    steps: DONE_STEPS,
    outcome: { kind: 'PREVIEW', eventCount: null, postCount: null, previewApplyUntil: new Date(Date.now() + 25 * 60_000).toISOString(), previewApplied: false },
    ...overrides,
  });

const PREVIEW = {
  applicable: true,
  applied: null,
  groupingReason: PostGroupingReason.SingleEvent,
  postStored: true,
  rescraped: false,
  imagesAvailable: 5,
  imagesSent: 2,
  events: [
    {
      extractionOrdinal: 0,
      eventName: 'GembiRun Loka 2026',
      alreadyRepresentedBySlug: null,
      isStub: false,
      links: [],
      schedules: [{ title: 'Race day', startDate: '2026-11-08', endDate: null, isMain: true }],
      dedup: { tier: ReextractionDedupTier.None, score: null, candidateSlug: null, candidateName: null },
    },
  ],
};

const REPORT = {
  outcome: 'NO_PROVIDER_REACHABLE',
  saved: false,
  lateResultPending: false,
  retryAfter: null,
  expiredLinks: 4,
  images: [
    { position: 0, role: 'COVER', state: 'NOT_READ_EXPIRED' },
    { position: 1, role: 'SLIDE', state: 'READ' },
    { position: 2, role: 'SLIDE', state: 'READ' },
    { position: 3, role: 'SLIDE', state: 'NOT_READ_EXPIRED' },
    { position: 4, role: 'SLIDE', state: 'NOT_READ_EXPIRED' },
    { position: 5, role: 'SLIDE', state: 'NOT_READ_EXPIRED' },
  ],
  imagesAvailable: 6,
  imagesRead: 2,
  previewImageCap: 10,
};

type Fragment = ReturnType<typeof makeFragment>;
interface State {
  jobs: Record<string, Fragment | null>;
  active: Fragment[];
  start: unknown;
  preview: unknown;
  report: unknown;
  retry: unknown;
  apply?: unknown;
}
let state: State;
let log: ReturnType<typeof installGraphqlFake>;

const notFound = () => Object.assign(new Error('Extraction job not found'), { response: { errors: [{ extensions: { code: 'NOT_FOUND' } }] } });
const ops = (name: string) => log.filter((l) => l.operation === name);

beforeEach(() => {
  setVisibility('visible');
  state = {
    jobs: { 'job-1': makeFragment() },
    active: [],
    start: { jobId: 'job-1', errorCode: null, errorMessage: null },
    preview: { status: 'SUCCEEDED', errorCode: null, errorMessage: null, preview: PREVIEW },
    report: { id: 'job-1', outcome: { previewApplyUntil: new Date(Date.now() + 25 * 60_000).toISOString(), previewApplied: false }, refresh: REPORT },
    retry: undefined,
  };
  log = installGraphqlFake(request, (operation, variables) => {
    switch (operation) {
      case 'JobById':
        return { job: state.jobs[String(variables.id)] ?? null };
      case 'ActiveJobs':
        return { activeJobs: state.active.map((j) => ({ ...j, owner: null })) };
      case 'PreviewPostReextraction':
        if (state.start instanceof Error) throw state.start;
        return { previewPostReextraction: state.start };
      case 'PostReextractionPreview':
        if (state.preview instanceof Error) throw state.preview;
        return { postReextractionPreview: state.preview };
      case 'ReextractJobReport':
        if (state.report instanceof Error) throw state.report;
        return { job: state.report };
      case 'RetryJob':
        return { retryJob: state.retry };
      case 'ApplyPostReextraction':
        return { applyPostReextraction: state.apply };
      default:
        throw new Error(`unexpected ${operation}`);
    }
  });
  capture.mockClear();
});
afterEach(() => {
  cleanup();
  request.mockReset();
});

const ui = () => (
  <TestProviders>
    <h1>Event page</h1>
    <ModeratorSourcePostsPanel sourcePosts={POSTS} />
  </TestProviders>
);

describe('ModeratorSourcePostsPanel on the shared progress host (Story 10.6a)', () => {
  it('renders nothing for an event with no source posts', () => {
    render(
      <TestProviders>
        <ModeratorSourcePostsPanel sourcePosts={[]} />
      </TestProviders>
    );
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
    expect(screen.queryByText('Source posts (moderator)')).not.toBeInTheDocument();
    expect(request).not.toHaveBeenCalled();
  });

  it('lists a single source post with a Re-extract button (not gated on more than one post) in a wrapping row', async () => {
    render(ui());
    expect(screen.getByRole('link', { name: 'Costume contest' })).toBeInTheDocument();
    expect(screen.getByText(/@gembirunloka/)).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Re-extract' })).toBeInTheDocument();
    const row = screen.getByTestId('reextract-row');
    expect(row.className).toContain('flex-wrap');
    expect(row.className).toContain('min-w-0');
    // Nothing started by showing the row: the only call is the lookup of an existing job.
    expect(ops('PreviewPostReextraction')).toHaveLength(0);
    expect(ops('ActiveJobs')[0].variables).toMatchObject({ subject: { type: 'REEXTRACT_REFRESH', postId: 'p1' }, endedWithinMinutes: 30 });
  });

  it('Re-extract starts the job through previewPostReextraction and opens the shared progress dialog (no private spinner line)', async () => {
    render(ui());
    await userEvent.click(await screen.findByRole('button', { name: 'Re-extract' }));
    const dialog = await screen.findByRole('dialog', { name: /Re-extracting a post/ });
    expect(ops('PreviewPostReextraction')[0].variables).toEqual({ postId: 'p1' });
    expect(within(dialog).getAllByRole('listitem')[0]).toHaveTextContent('Fetching fresh images');
    expect(within(dialog).getAllByRole('listitem')[1]).toHaveAttribute('aria-current', 'step');
    expect(screen.queryByText(/Extracting. This can take up to a minute/)).not.toBeInTheDocument();
    // The preview is read only after the job has ended.
    expect(ops('PostReextractionPreview')).toHaveLength(0);
    expect(ops('ReextractJobReport')).toHaveLength(0);
  });

  it('Minimize turns the row button into the chip, the job keeps running, and tapping the chip re-opens at the last progress; closing never starts a second job', async () => {
    render(ui());
    await userEvent.click(await screen.findByRole('button', { name: 'Re-extract' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Minimize' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const chip = await screen.findByTestId('job-chip');
    expect(chip).toHaveTextContent('In progress: step 2 of 2');
    expect(screen.queryByRole('button', { name: 'Re-extract' })).not.toBeInTheDocument();
    await userEvent.click(chip);
    const again = await screen.findByRole('dialog');
    expect(within(again).getByText('Step 2 of 2')).toBeInTheDocument();
    expect(ops('PreviewPostReextraction')).toHaveLength(1);
    expect(capture).toHaveBeenCalledWith('job_progress_minimized', { jobType: 'REEXTRACT_REFRESH', status: 'RUNNING' });
    expect(capture).toHaveBeenCalledWith('job_progress_reopened', { jobType: 'REEXTRACT_REFRESH', status: 'RUNNING', source: 'chip' });
  });

  it('finds the job again from the server on mount (after a reload or on another device): the chip, never the dialog, and never browser storage', async () => {
    state.active = [makeFragment()];
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    render(ui());
    const chip = await screen.findByTestId('job-chip');
    expect(chip).toHaveTextContent('In progress: step 2 of 2');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Re-extract' })).not.toBeInTheDocument();
    expect(setItem).not.toHaveBeenCalled();
    await userEvent.click(chip);
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(ops('PreviewPostReextraction')).toHaveLength(0);
  });

  it('an ended job found on mount shows the ended chip text of Re-extract ("Preview ready (some images missing)", "Preview ready")', async () => {
    state.jobs['job-1'] = endedJob();
    state.active = [endedJob()];
    const { unmount } = render(ui());
    expect(await screen.findByTestId('job-chip')).toHaveTextContent('Preview ready (some images missing)');
    unmount();
    state.jobs['job-1'] = endedJob({ status: 'SUCCEEDED', reasonCode: null });
    state.active = [endedJob({ status: 'SUCCEEDED', reasonCode: null })];
    render(ui());
    expect(await screen.findByTestId('job-chip')).toHaveTextContent(/^Preview ready$/);
  });

  describe('the preview result of an ended job', () => {
    beforeEach(() => {
      state.jobs['job-1'] = endedJob();
    });

    it('opens at the result: the banner names the missing images, the cause and Retry, with the preview and Apply as before; focus goes to the banner title', async () => {
      render(ui());
      await userEvent.click(await screen.findByRole('button', { name: 'Re-extract' }));
      const dialog = await screen.findByRole('dialog');
      expect(dialog.className).toContain('sm:max-w-2xl');
      expect(await within(dialog).findByTestId('reextract-preview-result')).toBeInTheDocument();
      const banner = within(dialog).getByTestId('reextract-images-warning');
      expect(within(banner).getByTestId('reextract-banner-title')).toHaveTextContent('2 of 6 images were read');
      expect(within(banner).getByTestId('reextract-banner-missing')).toHaveTextContent('Not read: the cover and slides 3 to 5.');
      expect(banner).toHaveTextContent('No provider could be reached to refresh the images.');
      expect(within(dialog).getByText('GembiRun Loka 2026', { selector: 'span' })).toBeInTheDocument();
      expect(within(dialog).getByRole('button', { name: 'Apply this preview' })).toBeInTheDocument();
      await waitFor(() => expect(within(banner).getByTestId('reextract-banner-title')).toHaveFocus());
      // Server state only: one read of each, no poll.
      expect(ops('PostReextractionPreview')).toHaveLength(1);
      expect(ops('ReextractJobReport')).toHaveLength(1);
    });

    it('Apply is unchanged: confirm first, then one applyPostReextraction for this job id and the applied summary; an EXPIRED refusal leaves only the message', async () => {
      state.apply = {
        errorCode: null,
        errorMessage: null,
        summary: { groupingReason: 'SINGLE_EVENT', reused: [{ slug: 'ig_p_AAA', eventName: 'GembiRun Loka 2026', ordinal: 0 }], created: [], linkedToExisting: [], queuedForReview: 0, skippedDeleted: 0, orphans: [] },
      };
      render(ui());
      await userEvent.click(await screen.findByRole('button', { name: 'Re-extract' }));
      const dialog = await screen.findByRole('dialog');
      await userEvent.click(await within(dialog).findByRole('button', { name: 'Apply this preview' }));
      await userEvent.click(await screen.findByRole('button', { name: 'Apply' }));
      expect(await within(dialog).findByTestId('reextract-apply-summary')).toHaveTextContent('1 existing event kept');
      expect(ops('ApplyPostReextraction')).toHaveLength(1);
      expect(ops('ApplyPostReextraction')[0].variables).toEqual({ jobId: 'job-1' });
    });

    it('an Apply refused as too old shows the message and hides the button', async () => {
      state.apply = { errorCode: 'EXPIRED', errorMessage: 'This preview is too old to apply. Run the preview again.', summary: null };
      render(ui());
      await userEvent.click(await screen.findByRole('button', { name: 'Re-extract' }));
      const dialog = await screen.findByRole('dialog');
      await userEvent.click(await within(dialog).findByRole('button', { name: 'Apply this preview' }));
      await userEvent.click(await screen.findByRole('button', { name: 'Apply' }));
      expect(await within(dialog).findByText('This preview is too old to apply. Run the preview again.')).toBeInTheDocument();
      expect(within(dialog).queryByRole('button', { name: 'Apply this preview' })).not.toBeInTheDocument();
    });

    it('Retry in the banner goes through retryJob, moves the dialog back to the progress view of the new job and says "Started again."', async () => {
      state.jobs['job-1'] = endedJob({ canRetry: true });
      state.jobs['job-2'] = makeFragment({ id: 'job-2' });
      state.retry = { outcome: 'STARTED', errorCode: null, job: makeFragment({ id: 'job-2' }) };
      render(ui());
      await userEvent.click(await screen.findByRole('button', { name: 'Re-extract' }));
      const dialog = await screen.findByRole('dialog');
      await userEvent.click(await within(dialog).findByRole('button', { name: 'Retry' }));
      expect(ops('RetryJob')[0].variables).toEqual({ jobId: 'job-1' });
      expect(await within(dialog).findByText('Step 2 of 2')).toBeInTheDocument();
      expect(within(dialog).queryByTestId('reextract-images-warning')).not.toBeInTheDocument();
      await waitFor(() => expect(screen.getByTestId('job-announcer')).toHaveTextContent('Started again.'));
      expect(capture).toHaveBeenCalledWith('job_retry_clicked', { jobType: 'REEXTRACT_REFRESH', reasonCode: 'NO_PROVIDER_REACHABLE' });
    });

    it('a refused Retry shows the shared notice in the result and keeps the preview', async () => {
      state.jobs['job-1'] = endedJob({ canRetry: true });
      state.retry = { outcome: 'REFUSED', errorCode: 'JOB_QUEUE_FULL', maxQueued: 10, job: null };
      render(ui());
      await userEvent.click(await screen.findByRole('button', { name: 'Re-extract' }));
      const dialog = await screen.findByRole('dialog');
      await userEvent.click(await within(dialog).findByRole('button', { name: 'Retry' }));
      expect(await within(dialog).findByTestId('job-retry-failure')).toHaveTextContent('Too many jobs are waiting (10).');
      expect(within(dialog).getByTestId('reextract-preview-result')).toBeInTheDocument();
    });

    it('there is no Retry when the server says it cannot help', async () => {
      state.report = { ...(state.report as object), refresh: { ...REPORT, outcome: 'NOT_SCRAPED' } };
      render(ui());
      await userEvent.click(await screen.findByRole('button', { name: 'Re-extract' }));
      const dialog = await screen.findByRole('dialog');
      await within(dialog).findByTestId('reextract-images-warning');
      expect(within(dialog).queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
    });

    it('an old job with no report falls back to the preview counts: the title and no named images', async () => {
      state.report = { id: 'job-1', outcome: { previewApplyUntil: new Date(Date.now() + 60_000).toISOString(), previewApplied: false }, refresh: null };
      render(ui());
      await userEvent.click(await screen.findByRole('button', { name: 'Re-extract' }));
      const dialog = await screen.findByRole('dialog');
      expect(await within(dialog).findByTestId('reextract-banner-title')).toHaveTextContent('2 of 5 images were read');
      expect(within(dialog).queryByTestId('reextract-banner-missing')).not.toBeInTheDocument();
    });

    it('a failed report read never blocks the preview (the banner falls back to the counts)', async () => {
      state.report = new Error('boom');
      render(ui());
      await userEvent.click(await screen.findByRole('button', { name: 'Re-extract' }));
      const dialog = await screen.findByRole('dialog');
      expect(await within(dialog).findByTestId('reextract-preview-result')).toBeInTheDocument();
      expect(within(dialog).getByTestId('reextract-banner-title')).toHaveTextContent('2 of 5 images were read');
    });

    it('another moderator\'s preview is "not available to you", not an error', async () => {
      state.preview = notFound();
      render(ui());
      await userEvent.click(await screen.findByRole('button', { name: 'Re-extract' }));
      const dialog = await screen.findByRole('dialog');
      expect(await within(dialog).findByTestId('reextract-preview-unavailable')).toHaveTextContent('This preview is not available to you.');
      expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument();
    });

    it('any other failed read says so and offers Try again', async () => {
      state.preview = new Error('network');
      render(ui());
      await userEvent.click(await screen.findByRole('button', { name: 'Re-extract' }));
      const dialog = await screen.findByRole('dialog');
      expect(await within(dialog).findByTestId('reextract-preview-error')).toHaveTextContent('The preview could not be completed.');
      state.preview = { status: 'SUCCEEDED', errorCode: null, errorMessage: null, preview: PREVIEW };
      await userEvent.click(within(dialog).getByRole('button', { name: 'Try again' }));
      expect(await within(dialog).findByTestId('reextract-preview-result')).toBeInTheDocument();
    });

    it('a preview older than the Apply window reads "too old to apply" with a Re-extract again button that starts a new job and attaches to it', async () => {
      state.report = { id: 'job-1', outcome: { previewApplyUntil: new Date(Date.now() - 60_000).toISOString(), previewApplied: false }, refresh: REPORT };
      state.preview = { status: 'SUCCEEDED', errorCode: null, errorMessage: null, preview: { ...PREVIEW, applicable: false } };
      state.jobs['job-2'] = makeFragment({ id: 'job-2' });
      render(ui());
      await userEvent.click(await screen.findByRole('button', { name: 'Re-extract' }));
      const dialog = await screen.findByRole('dialog');
      state.start = { jobId: 'job-2', errorCode: null, errorMessage: null };
      expect(await within(dialog).findByTestId('reextract-preview-too-old')).toHaveTextContent('This preview is too old to apply. Start a new one.');
      expect(within(dialog).queryByRole('button', { name: 'Apply this preview' })).not.toBeInTheDocument();
      await userEvent.click(within(dialog).getByRole('button', { name: 'Re-extract again' }));
      expect(await within(dialog).findByText('Step 2 of 2')).toBeInTheDocument();
      expect(ops('PreviewPostReextraction')).toHaveLength(2);
      expect(ops('PreviewPostReextraction')[1].variables).toEqual({ postId: 'p1' });
    });

    it('closing an ended job drops the chip and brings the Re-extract button back, with focus on it (the 30-minute window is on the server)', async () => {
      render(ui());
      const start = await screen.findByRole('button', { name: 'Re-extract' });
      await userEvent.click(start);
      const dialog = await screen.findByRole('dialog');
      await within(dialog).findByTestId('reextract-preview-result');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(screen.queryByTestId('job-chip')).not.toBeInTheDocument();
      const button = await screen.findByRole('button', { name: 'Re-extract' });
      await waitFor(() => expect(button).toHaveFocus());
    });

    it('Escape on an ended job closes it and drops the chip (the shared rule); the job comes back from the server after a reload', async () => {
      render(ui());
      await userEvent.click(await screen.findByRole('button', { name: 'Re-extract' }));
      const dialog = await screen.findByRole('dialog');
      await within(dialog).findByTestId('reextract-preview-result');
      await userEvent.keyboard('{Escape}');
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(screen.queryByTestId('job-chip')).not.toBeInTheDocument();
    });
  });

  it('a Failed job keeps the shared red box with the plain reason, and no banner', async () => {
    state.jobs['job-1'] = makeFragment({ status: 'FAILED', reasonCode: 'POST_NOT_FOUND', finishedAt: '2026-11-13T14:01:20.000Z', canRetry: false });
    render(ui());
    await userEvent.click(await screen.findByRole('button', { name: 'Re-extract' }));
    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByTestId('job-failed-box')).toBeInTheDocument();
    expect(within(dialog).queryByTestId('reextract-images-warning')).not.toBeInTheDocument();
    expect(ops('PostReextractionPreview')).toHaveLength(0);
  });

  describe('a refused start', () => {
    it('queue full: the shared message with a link to Jobs, and the button stays', async () => {
      state.start = { jobId: null, errorCode: 'JOB_QUEUE_FULL', errorMessage: null, maxQueued: 10 };
      render(ui());
      await userEvent.click(await screen.findByRole('button', { name: 'Re-extract' }));
      expect(await screen.findByTestId('job-retry-failure')).toHaveTextContent('Too many jobs are waiting (10).');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Re-extract' })).toBeEnabled();
    });

    it('any other refusal: the plain start-refused line and the server\'s own note; a thrown error reads the same line', async () => {
      state.start = { jobId: null, errorCode: 'EXTRACTION_FAILED', errorMessage: 'This post is still being extracted in steps.' };
      render(ui());
      await userEvent.click(await screen.findByRole('button', { name: 'Re-extract' }));
      const refused = await screen.findByTestId('reextract-start-refused');
      expect(refused).toHaveTextContent('Re-extract could not be started. Try again in a moment.');
      expect(refused).toHaveTextContent('This post is still being extracted in steps.');
      state.start = new Error('network');
      await userEvent.click(screen.getByRole('button', { name: 'Re-extract' }));
      await waitFor(() => expect(ops('PreviewPostReextraction')).toHaveLength(2));
      expect(screen.getByTestId('reextract-start-refused')).toHaveTextContent('Re-extract could not be started.');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});
