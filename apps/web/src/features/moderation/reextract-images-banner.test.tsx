import '@testing-library/jest-dom/vitest';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import enMessages from '../../../locales/en.json';
import idMessages from '../../../locales/id.json';
import { ReextractImagesBanner, type ReextractImagesBannerProps } from './reextract-images-banner';
import type { ReextractRefreshReport } from './use-reextract-refresh-report';

afterEach(cleanup);

type Image = { position: number; role: 'COVER' | 'SLIDE'; state: 'READ' | 'NOT_READ_EXPIRED' | 'NOT_READ_UNAVAILABLE' | 'NOT_SENT_OVER_CAP' };
const read = (position: number, role: Image['role'] = 'SLIDE'): Image => ({ position, role, state: 'READ' });
const lost = (position: number, role: Image['role'] = 'SLIDE', state: Image['state'] = 'NOT_READ_EXPIRED'): Image => ({ position, role, state });
const overCap = (position: number): Image => lost(position, 'SLIDE', 'NOT_SENT_OVER_CAP');

function makeReport(overrides: Record<string, unknown> = {}, images: Image[] = []): ReextractRefreshReport {
  const imagesRead = images.filter((i) => i.state === 'READ').length;
  return {
    outcome: 'NO_PROVIDER_REACHABLE',
    saved: false,
    lateResultPending: false,
    retryAfter: null,
    expiredLinks: 4,
    images,
    imagesAvailable: images.length,
    imagesRead,
    previewImageCap: 10,
    ...overrides,
  } as unknown as ReextractRefreshReport;
}

// The story's example: the cover and slides 3 to 5 not read (six entries: the cover and five slides).
const SIX_WITH_GAP = [lost(0, 'COVER'), read(1), read(2), lost(3), lost(4), lost(5)];

function ui(props: Partial<ReextractImagesBannerProps> = {}, locale: 'en' | 'id' = 'en') {
  const messages = (locale === 'en' ? enMessages : idMessages) as never;
  return (
    <NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC">
      <ReextractImagesBanner report={null} imagesAvailable={5} imagesRead={2} canRetry={false} onRetry={vi.fn()} {...props} />
    </NextIntlClientProvider>
  );
}

describe('ReextractImagesBanner (Story 10.6a)', () => {
  it('names what is missing: "2 of 6 images were read", "Not read: the cover and slides 3 to 5.", the cause, the apply note and Retry', async () => {
    const onRetry = vi.fn();
    render(ui({ report: makeReport({}, SIX_WITH_GAP), canRetry: true, onRetry }));
    const banner = screen.getByTestId('reextract-images-warning');
    expect(banner).toHaveAttribute('role', 'status');
    expect(screen.getByTestId('reextract-banner-title')).toHaveTextContent('2 of 6 images were read');
    expect(screen.getByTestId('reextract-banner-missing')).toHaveTextContent('Not read: the cover and slides 3 to 5.');
    expect(banner).toHaveTextContent('No provider could be reached to refresh the images.');
    expect(banner).toHaveTextContent('The image links have expired and refreshing them failed.');
    expect(banner).toHaveTextContent('You can still apply this preview. Events shown only on unread images will be missing.');
    const retry = screen.getByRole('button', { name: 'Retry' });
    expect(retry).toHaveAccessibleDescription('Retrying fetches the images again, then reads the post again.');
    await userEvent.click(retry);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('joins several runs with the locale list: a single slide, a range and the cover', () => {
    render(ui({ report: makeReport({}, [lost(0, 'COVER'), read(1), lost(2), read(3), lost(4), lost(5)]) }));
    expect(screen.getByTestId('reextract-banner-missing')).toHaveTextContent('Not read: the cover, slide 2, and slides 4 to 5.');
  });

  it('reads in Indonesian: the same rules, the same copy keys', () => {
    render(ui({ report: makeReport({}, SIX_WITH_GAP) }, 'id'));
    expect(screen.getByTestId('reextract-banner-title')).toHaveTextContent('2 dari 6 gambar dibaca');
    expect(screen.getByTestId('reextract-banner-missing')).toHaveTextContent(/Tidak terbaca: sampul dan slide 3 sampai 5\./);
    expect(screen.getByTestId('reextract-images-warning')).toHaveTextContent('Anda tetap dapat menerapkan pratinjau ini.');
  });

  it.each([
    ['NO_PROVIDER_REACHABLE', { expiredLinks: 0 }, ['causeNoProvider']],
    ['NO_PROVIDER_REACHABLE', { expiredLinks: 3 }, ['causeNoProvider', 'causeExpiredRefreshFailed']],
    ['PROVIDER_OVER_QUOTA', {}, ['causeOverQuota']],
    ['TIMED_OUT', {}, ['causeTimedOut']],
    ['COOLDOWN', { retryAfter: '2026-11-13T14:42:00.000Z' }, ['causeCooldown']],
    ['NOT_SCRAPED', {}, ['causeNotScraped']],
    ['POST_UNAVAILABLE', {}, ['causePostGone']],
    ['IN_FLIGHT', {}, ['causeInFlight']],
    ['REFRESHED', { saved: false, expiredLinks: 2 }, ['causeNotHealed']],
    ['NOT_NEEDED', {}, ['causeImagesUnavailable']],
  ])('outcome %s picks its cause sentences, in order (%j)', (outcome, extra, causes) => {
    render(ui({ report: makeReport({ outcome, ...extra }, [read(0, 'COVER'), lost(1, 'SLIDE', 'NOT_READ_UNAVAILABLE')]) }));
    expect(screen.getAllByTestId('reextract-banner-cause').map((el) => el.getAttribute('data-cause'))).toEqual(causes);
  });

  it('the cooldown cause shows the time the refresh can be tried again, in the locale formatter', () => {
    render(ui({ report: makeReport({ outcome: 'COOLDOWN', retryAfter: '2026-11-13T14:42:00.000Z' }, [lost(0, 'COVER'), read(1)]) }));
    expect(screen.getByTestId('reextract-banner-cause')).toHaveTextContent(/You can try again at .*2:42/);
  });

  it('a refresh that is still running says the fresh images are saved when it finishes', () => {
    render(ui({ report: makeReport({ outcome: 'TIMED_OUT', lateResultPending: true }, [read(0, 'COVER'), lost(1)]) }));
    expect(screen.getAllByTestId('reextract-banner-cause').map((el) => el.getAttribute('data-cause'))).toEqual(['causeRefreshRunning']);
    expect(screen.getByTestId('reextract-banner-cause')).toHaveTextContent('If it finishes later, the fresh images are saved to the post.');
  });

  it('Retry is hidden when the server says it cannot help (account not scraped, post gone, a job that Succeeded)', () => {
    render(ui({ report: makeReport({ outcome: 'NOT_SCRAPED' }, [lost(0, 'COVER'), read(1)]), canRetry: false }));
    expect(screen.getByTestId('reextract-banner-cause')).toHaveTextContent('This account is not scraped');
    expect(screen.queryByRole('button', { name: /Retry/ })).not.toBeInTheDocument();
  });

  it('Retry reads "Retry at {time}" and is aria-disabled with the time in its description during the cooldown; a click does nothing', async () => {
    const onRetry = vi.fn();
    const until = new Date(Date.now() + 3_600_000).toISOString();
    render(ui({ report: makeReport({ outcome: 'COOLDOWN', retryAfter: until }, [lost(0, 'COVER'), read(1)]), canRetry: true, retryNotBefore: until, onRetry }));
    const retry = screen.getByRole('button', { name: /^Retry at / });
    expect(retry).toHaveAttribute('aria-disabled', 'true');
    expect(retry).toHaveAccessibleDescription(/Retry at .*Retrying fetches the images again/);
    await userEvent.click(retry);
    expect(onRetry).not.toHaveBeenCalled();
  });

  it('a pending Retry is blocked', async () => {
    const onRetry = vi.fn();
    render(ui({ report: makeReport({}, [lost(0, 'COVER'), read(1)]), canRetry: true, retryPending: true, onRetry }));
    expect(screen.getByRole('button', { name: 'Retry' })).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).not.toHaveBeenCalled();
  });

  it('a carousel longer than the preview cap: when only slides over the cap are missing the banner is the one cap line, with no title, cause or Retry', () => {
    const images = [read(0, 'COVER'), ...Array.from({ length: 10 }, (_, i) => read(i + 1)), overCap(11), overCap(12)];
    render(ui({ report: makeReport({ outcome: 'NOT_NEEDED', expiredLinks: 0 }, images), canRetry: true }));
    const banner = screen.getByTestId('reextract-images-warning');
    expect(screen.getByTestId('reextract-banner-over-cap')).toHaveTextContent('Only the first 10 slides are read in a preview.');
    expect(screen.queryByTestId('reextract-banner-title')).not.toBeInTheDocument();
    expect(screen.queryByTestId('reextract-banner-cause')).not.toBeInTheDocument();
    expect(banner).not.toHaveTextContent('You can still apply');
    expect(screen.queryByRole('button', { name: /Retry/ })).not.toBeInTheDocument();
  });

  it('a failed refresh and the cap together: both lines show, and Retry follows the server', () => {
    const images = [lost(0, 'COVER'), ...Array.from({ length: 10 }, (_, i) => read(i + 1)), overCap(11)];
    render(ui({ report: makeReport({}, images), canRetry: true }));
    expect(screen.getByTestId('reextract-banner-title')).toHaveTextContent('10 of 12 images were read');
    expect(screen.getByTestId('reextract-banner-missing')).toHaveTextContent('Not read: the cover.');
    expect(screen.getByTestId('reextract-banner-over-cap')).toHaveTextContent('Only the first 10 slides');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('an old job with no report shows the title and nothing else (counts-only fallback)', () => {
    render(ui({ report: null, imagesAvailable: 6, imagesRead: 4 }));
    expect(screen.getByTestId('reextract-banner-title')).toHaveTextContent('4 of 6 images were read');
    expect(screen.queryByTestId('reextract-banner-missing')).not.toBeInTheDocument();
    expect(screen.queryByTestId('reextract-banner-cause')).not.toBeInTheDocument();
  });

  it('a report with the counts but no list names the cause and no images', () => {
    render(ui({ report: makeReport({ outcome: 'TIMED_OUT', imagesAvailable: 6, imagesRead: 4 }, []) }));
    expect(screen.getByTestId('reextract-banner-title')).toHaveTextContent('4 of 6 images were read');
    expect(screen.queryByTestId('reextract-banner-missing')).not.toBeInTheDocument();
    expect(screen.getByTestId('reextract-banner-cause')).toHaveAttribute('data-cause', 'causeTimedOut');
  });

  it('shows nothing when every image was read', () => {
    render(ui({ report: makeReport({ outcome: 'NOT_NEEDED' }, [read(0, 'COVER'), read(1)]), imagesAvailable: 2, imagesRead: 2 }));
    expect(screen.queryByTestId('reextract-images-warning')).not.toBeInTheDocument();
    cleanup();
    render(ui({ report: null, imagesAvailable: 3, imagesRead: 3 }));
    expect(screen.queryByTestId('reextract-images-warning')).not.toBeInTheDocument();
  });

  it('moves focus to the banner title when it opens with a shortfall, and to the cap line when that is all there is', () => {
    const { unmount } = render(ui({ report: makeReport({}, [lost(0, 'COVER'), read(1)]) }));
    expect(screen.getByTestId('reextract-banner-title')).toHaveFocus();
    unmount();
    render(ui({ report: makeReport({ outcome: 'NOT_NEEDED', expiredLinks: 0 }, [read(0, 'COVER'), overCap(1)]) }));
    expect(screen.getByTestId('reextract-banner-over-cap')).toHaveFocus();
  });

  it('the missing-image sentence is real text, not an icon strip', () => {
    render(ui({ report: makeReport({}, SIX_WITH_GAP) }));
    expect(screen.getByTestId('reextract-banner-missing').textContent).toContain('the cover and slides 3 to 5');
    expect(screen.getByTestId('reextract-images-warning').querySelectorAll('img, svg')).toHaveLength(0);
  });
});
