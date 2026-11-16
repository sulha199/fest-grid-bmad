import '@testing-library/jest-dom/vitest';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { graphqlClient } from '@/lib/graphql-client';
import { installGraphqlFake, makeFragment, setVisibility, TestProviders } from '@/features/jobs/job-test-support';
import { ReextractContent } from './reextract-content';

vi.mock('@/lib/graphql-client', () => ({ graphqlClient: { request: vi.fn() } }));
vi.mock('@festgrid/analytics', () => ({ capturePostHogEvent: vi.fn() }));
vi.mock('@/features/auth/use-require-moderator', () => ({ useRequireModerator: () => ({ status: 'authorized' }) }));
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...rest }: { href: string; children?: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const request = vi.mocked(graphqlClient.request) as unknown as ReturnType<typeof vi.fn>;
let start: unknown;
let log: ReturnType<typeof installGraphqlFake>;

beforeEach(() => {
  setVisibility('visible');
  start = { jobId: 'job-1', errorCode: null, errorMessage: null };
  log = installGraphqlFake(request, (operation) => {
    if (operation === 'PreviewPostReextraction') return { previewPostReextraction: start };
    if (operation === 'JobById') return { job: makeFragment({ subject: { kind: 'POST', accountId: null, platform: null, username: null, displayName: null, profileImageUrl: null, postCount: null, postCode: null, postId: null } }) };
    throw new Error(`unexpected ${operation}`);
  });
});
afterEach(() => {
  cleanup();
  request.mockReset();
});

const ui = () => (
  <TestProviders>
    <ReextractContent />
  </TestProviders>
);

describe('Moderator Tools, Re-extract (Post URL tab) on the shared host (Story 10.6a)', () => {
  it('Preview starts the job from the typed URL, attaches to it from the start result and opens the progress dialog; nothing is looked up on mount', async () => {
    render(ui());
    expect(log.filter((l) => l.operation === 'ActiveJobs')).toHaveLength(0);
    await userEvent.type(screen.getByLabelText('Post URL'), ' https://www.instagram.com/p/DcntzF0mB7z/ ');
    await userEvent.click(screen.getByRole('button', { name: 'Preview' }));
    const dialog = await screen.findByRole('dialog');
    expect(log.find((l) => l.operation === 'PreviewPostReextraction')?.variables).toEqual({ url: 'https://www.instagram.com/p/DcntzF0mB7z/' });
    expect(within(dialog).getAllByRole('listitem')[0]).toHaveTextContent('Fetching fresh images');
    expect(screen.queryByText(/Extracting. This can take up to a minute/)).not.toBeInTheDocument();
  });

  it('the dialog can be minimized to a chip beside the form and re-opened, and closing never drops the job (no second start)', async () => {
    render(ui());
    await userEvent.type(screen.getByLabelText('Post URL'), 'https://www.instagram.com/p/DcntzF0mB7z/');
    await userEvent.click(screen.getByRole('button', { name: 'Preview' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Minimize' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const chip = await screen.findByTestId('job-chip');
    await userEvent.click(chip);
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(log.filter((l) => l.operation === 'PreviewPostReextraction')).toHaveLength(1);
  });

  it('a refused start shows the plain line, and Preview stays available', async () => {
    start = { jobId: null, errorCode: 'UNSUPPORTED_PLATFORM', errorMessage: 'This URL is not from a supported platform.' };
    render(ui());
    await userEvent.type(screen.getByLabelText('Post URL'), 'https://example.com/x');
    await userEvent.click(screen.getByRole('button', { name: 'Preview' }));
    expect(await screen.findByTestId('reextract-start-refused')).toHaveTextContent('Re-extract could not be started.');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Preview' })).toBeEnabled();
  });

  it('Preview is disabled until a URL is typed', () => {
    render(ui());
    expect(screen.getByRole('button', { name: 'Preview' })).toBeDisabled();
  });
});
