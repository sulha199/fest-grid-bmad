import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import enMessages from '../../../locales/en.json';
import idMessages from '../../../locales/id.json';
import { usePaginationLabels } from './use-pagination-labels';

const wrapperFor = (locale: 'en' | 'id', messages: unknown) =>
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <NextIntlClientProvider locale={locale} messages={messages as never}>
        {children}
      </NextIntlClientProvider>
    );
  };

describe('usePaginationLabels', () => {
  it('reads "Page N of M" and the total when the list knows its size', () => {
    const { result } = renderHook(() => usePaginationLabels(2, 93, 20), { wrapper: wrapperFor('en', enMessages) });
    expect(result.current).toEqual({
      navigation: 'Pagination',
      previous: 'Previous',
      next: 'Next',
      pageInfo: 'Page 2 of 5',
      total: '93 total',
    });
  });

  it('reads just "Page N", with no total, when the list does not know its size', () => {
    const { result } = renderHook(() => usePaginationLabels(3, undefined, 20), { wrapper: wrapperFor('en', enMessages) });
    expect(result.current.pageInfo).toBe('Page 3');
    expect(result.current.total).toBeUndefined();
  });

  it('treats an empty list as one page', () => {
    const { result } = renderHook(() => usePaginationLabels(1, 0, 20), { wrapper: wrapperFor('en', enMessages) });
    expect(result.current.pageInfo).toBe('Page 1 of 1');
    expect(result.current.total).toBe('0 total');
  });

  it('never reports fewer pages than the current one', () => {
    const { result } = renderHook(() => usePaginationLabels(3, 40, 20), { wrapper: wrapperFor('en', enMessages) });
    expect(result.current.pageInfo).toBe('Page 3 of 3');
  });

  it('formats a large total with the locale\'s grouping', () => {
    const { result } = renderHook(() => usePaginationLabels(1, 12345, 20), { wrapper: wrapperFor('en', enMessages) });
    expect(result.current.total).toBe('12,345 total');
  });

  it('is translated for Indonesian', () => {
    const { result } = renderHook(() => usePaginationLabels(2, 93, 20), { wrapper: wrapperFor('id', idMessages) });
    expect(result.current.previous).toBe('Sebelumnya');
    expect(result.current.next).toBe('Berikutnya');
    expect(result.current.pageInfo).toBe('Halaman 2 dari 5');
  });
});
