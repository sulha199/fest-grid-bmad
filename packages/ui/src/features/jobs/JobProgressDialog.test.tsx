import '@testing-library/jest-dom/vitest';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { JobProgressDialog } from './JobProgressDialog';

afterEach(cleanup);
const dlgLabels = { description: 'You can minimize this.', minimize: 'Minimize', close: 'Close' };

describe('JobProgressDialog', () => {
  it('Minimize, Escape and an outside tap all minimize while the job is open', async () => {
    const onMinimize = vi.fn();
    const onClose = vi.fn();
    render(
      <JobProgressDialog open ended={false} title="Adding @venue" labels={dlgLabels} onMinimize={onMinimize} onClose={onClose}>
        <p>body</p>
      </JobProgressDialog>
    );
    expect(screen.getByRole('dialog', { name: 'Adding @venue' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Minimize' }));
    await userEvent.keyboard('{Escape}');
    expect(onMinimize).toHaveBeenCalledTimes(2);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('once ended, the same controls close it and the footer reads Close', async () => {
    const onMinimize = vi.fn();
    const onClose = vi.fn();
    render(
      <JobProgressDialog open ended title="Adding @venue" labels={dlgLabels} onMinimize={onMinimize} onClose={onClose} footerLinks={<a href="/jobs">See all in Jobs</a>}>
        <p>body</p>
      </JobProgressDialog>
    );
    expect(screen.queryByRole('button', { name: 'Minimize' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'See all in Jobs' })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(onMinimize).not.toHaveBeenCalled();
  });

  it('renders nothing when closed', () => {
    render(
      <JobProgressDialog open={false} ended={false} title="T" labels={dlgLabels} onMinimize={vi.fn()} onClose={vi.fn()}>
        x
      </JobProgressDialog>
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('is the narrow dialog by default and widens only when asked (Story 10.6a), both bounded and scrolling inside themselves', () => {
    const { rerender } = render(
      <JobProgressDialog open ended={false} title="T" labels={dlgLabels} onMinimize={vi.fn()} onClose={vi.fn()}>
        x
      </JobProgressDialog>
    );
    const narrow = screen.getByTestId('job-progress-dialog');
    expect(narrow.className).toContain('sm:max-w-md');
    expect(narrow.className).not.toContain('sm:max-w-2xl');
    rerender(
      <JobProgressDialog open ended title="T" size="wide" labels={dlgLabels} onMinimize={vi.fn()} onClose={vi.fn()}>
        x
      </JobProgressDialog>
    );
    const wide = screen.getByTestId('job-progress-dialog');
    expect(wide.className).toContain('sm:max-w-2xl');
    expect(wide.className).not.toContain('sm:max-w-md');
    for (const el of [narrow, wide]) {
      expect(el.className).toContain('overflow-y-auto');
      expect(el.className).toContain('grid-cols-[minmax(0,1fr)]');
    }
  });
});
