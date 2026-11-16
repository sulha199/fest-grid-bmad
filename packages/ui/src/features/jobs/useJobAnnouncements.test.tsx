import '@testing-library/jest-dom/vitest';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, renderHook, screen } from '@testing-library/react';
import { JobAnnouncer } from './JobAnnouncer';
import { useJobAnnouncements } from './useJobAnnouncements';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const listUpdated = (n: number) => `${n} jobs updated`;
const setup = (isHidden = () => false) => renderHook(() => useJobAnnouncements({ listUpdated, isHidden }));
const ev = (id: string, signature: string, text = `${id}:${signature}`, urgent = false) => ({ id, signature, text, urgent });

describe('useJobAnnouncements', () => {
  it('does not announce a first sighting (a discovered chip) unless asked, nor an unchanged poll', () => {
    const { result } = setup();
    act(() => result.current.observe([ev('a', 'RUNNING|x')]));
    expect(result.current.message).toBeNull();
    act(() => result.current.observe([ev('a', 'RUNNING|x')]));
    expect(result.current.message).toBeNull();
  });

  it('announces the user\'s own start, then only status or step changes', () => {
    const { result } = setup();
    act(() => result.current.observe([ev('a', 'QUEUED|', 'queued')], { announceFirst: true }));
    expect(result.current.message).toMatchObject({ text: 'queued', role: 'status' });
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    act(() => result.current.observe([ev('a', 'RUNNING|s1', 'step 1')]));
    expect(result.current.message?.text).toBe('step 1');
  });

  it('a changed queue position is not a change (same signature, no message)', () => {
    const { result } = setup();
    act(() => result.current.observe([ev('a', 'QUEUED|', 'n3')]));
    act(() => result.current.observe([ev('a', 'QUEUED|', 'n2')]));
    expect(result.current.message).toBeNull();
  });

  it('coalesces a burst in one poll into "3 jobs updated"', () => {
    const { result } = setup();
    act(() => result.current.observe([ev('a', 'RUNNING|'), ev('b', 'RUNNING|'), ev('c', 'RUNNING|')]));
    act(() => result.current.observe([ev('a', 'SUCCEEDED|'), ev('b', 'SUCCEEDED|'), ev('c', 'FAILED|')]));
    expect(result.current.message?.text).toBe('3 jobs updated');
  });

  it('coalesces messages that arrive inside the 3 s window into one message when it closes', () => {
    const { result } = setup();
    act(() => result.current.observe([ev('a', 'RUNNING|'), ev('b', 'RUNNING|'), ev('c', 'RUNNING|')]));
    act(() => result.current.observe([ev('a', 'SUCCEEDED|', 'a done')]));
    expect(result.current.message?.text).toBe('a done');
    act(() => result.current.observe([ev('b', 'SUCCEEDED|', 'b done')]));
    act(() => result.current.observe([ev('c', 'SUCCEEDED|', 'c done')]));
    expect(result.current.message?.text).toBe('a done');
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(result.current.message?.text).toBe('2 jobs updated');
  });

  it('a single buffered message is spoken as itself when the window closes', () => {
    const { result } = setup();
    act(() => result.current.observe([ev('a', 'R|'), ev('b', 'R|')]));
    act(() => result.current.observe([ev('a', 'S|', 'a done')]));
    act(() => result.current.observe([ev('b', 'S|', 'b done')]));
    expect(result.current.message?.text).toBe('a done');
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(result.current.message?.text).toBe('b done');
  });

  it('a failure in a watched dialog is an alert, immediately', () => {
    const { result } = setup();
    act(() => result.current.observe([ev('a', 'RUNNING|')]));
    act(() => result.current.observe([ev('a', 'FAILED|', 'a failed', true)]));
    expect(result.current.message).toMatchObject({ text: 'a failed', role: 'alert' });
    act(() => result.current.announce('urgent', { urgent: true }));
    expect(result.current.message?.role).toBe('alert');
  });

  it('never announces from a hidden tab, but still records the change', () => {
    let hidden = true;
    const { result } = setup(() => hidden);
    act(() => result.current.observe([ev('a', 'RUNNING|')]));
    act(() => result.current.observe([ev('a', 'SUCCEEDED|', 'done', true)]));
    act(() => result.current.announce('x'));
    expect(result.current.message).toBeNull();
    hidden = false;
    act(() => result.current.observe([ev('a', 'SUCCEEDED|', 'done')]));
    expect(result.current.message).toBeNull();
  });

  it('drops a buffered batch if the tab went hidden before the window closed', () => {
    let hidden = false;
    const { result } = setup(() => hidden);
    act(() => result.current.observe([ev('a', 'R|'), ev('b', 'R|')]));
    act(() => result.current.observe([ev('a', 'S|', 'a'), ev('b', 'S|', 'b')]));
    const first = result.current.message;
    act(() => result.current.observe([ev('a', 'X|', 'a2')]));
    hidden = true;
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(result.current.message).toBe(first);
    act(() => {
      vi.advanceTimersByTime(3000);
    });
  });
});

describe('JobAnnouncer', () => {
  it('has a polite atomic status region and a separate alert region', () => {
    const { rerender } = render(<JobAnnouncer message={null} />);
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveAttribute('aria-atomic', 'true');
    expect(status).toHaveClass('sr-only');
    rerender(<JobAnnouncer message={{ text: 'Adding is done.', role: 'status', seq: 1 }} />);
    expect(screen.getByRole('status')).toHaveTextContent('Adding is done.');
    expect(screen.getByTestId('job-announcer-alert')).toBeEmptyDOMElement();
    rerender(<JobAnnouncer message={{ text: 'Failed.', role: 'alert', seq: 2 }} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Failed.');
  });
});
