import '@testing-library/jest-dom/vitest';
import React, { useEffect } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import enMessages from '../../../locales/en.json';
import { JobAnnouncerProvider, useJobAnnouncer } from './job-announcer-provider';
import { useAnnounceReconnecting } from './use-announce-reconnecting';

let pathname = '/en/jobs/a';
vi.mock('next/navigation', () => ({ usePathname: () => pathname }));

function Observe({ signature, text }: { signature: string; text: string }) {
  const announcer = useJobAnnouncer();
  useEffect(() => {
    announcer.observe([{ id: 'job-1', signature, text }]);
  }, [announcer, signature, text]);
  return null;
}
function Reconnecting({ on }: { on: boolean }) {
  useAnnounceReconnecting(on);
  return null;
}
const wrap = (children: React.ReactNode) => (
  <NextIntlClientProvider locale="en" messages={enMessages as never} timeZone="UTC">
    <JobAnnouncerProvider>{children}</JobAnnouncerProvider>
  </NextIntlClientProvider>
);

afterEach(() => {
  cleanup();
  pathname = '/en/jobs/a';
});

describe('JobAnnouncerProvider', () => {
  it('announces a change within a page, but returning to a page does not announce a change the user did not watch', () => {
    const { rerender } = render(wrap(<Observe signature="RUNNING|a" text="running" />));
    expect(screen.getByTestId('job-announcer')).toBeEmptyDOMElement();
    act(() => rerender(wrap(<Observe signature="SUCCEEDED|" text="done" />)));
    expect(screen.getByTestId('job-announcer')).toHaveTextContent('done');

    // Leave the page (job moves on unseen), come back: the first sighting is silent.
    pathname = '/en/feed';
    act(() => rerender(wrap(<div />)));
    pathname = '/en/jobs/a';
    act(() => rerender(wrap(<Observe signature="FAILED|" text="failed later" />)));
    expect(screen.getByTestId('job-announcer')).not.toHaveTextContent('failed later');
  });

  it('says "Reconnecting" once when the poll starts failing, not on every render', () => {
    const { rerender } = render(wrap(<Reconnecting on={false} />));
    expect(screen.getByTestId('job-announcer')).toBeEmptyDOMElement();
    act(() => rerender(wrap(<Reconnecting on />)));
    expect(screen.getByTestId('job-announcer')).toHaveTextContent('Reconnecting');
    const seq = screen.getByTestId('job-announcer').innerHTML;
    act(() => rerender(wrap(<Reconnecting on />)));
    expect(screen.getByTestId('job-announcer').innerHTML).toBe(seq);
  });
});
