import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { ClientError } from 'graphql-request';
import { useSubscriptionCapRefusal } from './use-subscription-cap-refusal';

const capError = (cap = 5) => new ClientError({ status: 200, errors: [{ message: 'x', extensions: { code: 'SUBSCRIPTION_CAP_REACHED', activeCount: 3, reservedCount: 2, cap } }] } as never, { query: 'm' });

describe('useSubscriptionCapRefusal', () => {
  it('stores a cap refusal and returns true', () => {
    const { result } = renderHook(() => useSubscriptionCapRefusal());
    let handled = false;
    act(() => {
      handled = result.current.show(capError(), { surface: 'subscribe_dialog', accountId: '99', username: 'someone' });
    });
    expect(handled).toBe(true);
    expect(result.current.state).toMatchObject({ refusal: { activeCount: 3, reservedCount: 2, cap: 5 }, surface: 'subscribe_dialog', accountId: '99', refusalId: 1 });
  });

  it('returns false and stores nothing for another error or a network error', () => {
    const { result } = renderHook(() => useSubscriptionCapRefusal());
    let handled = true;
    act(() => {
      handled = result.current.show(new TypeError('Failed to fetch'), { surface: 'restore' });
    });
    expect(handled).toBe(false);
    act(() => {
      handled = result.current.show(new ClientError({ status: 200, errors: [{ message: 'x', extensions: { code: 'SCRAPER_CAPACITY_EXCEEDED' } }] } as never, { query: 'm' }), { surface: 'restore' });
    });
    expect(handled).toBe(false);
    expect(result.current.state).toBeNull();
  });

  it('a second refusal while one stands updates it in place with a new refusal id', () => {
    const { result } = renderHook(() => useSubscriptionCapRefusal());
    act(() => void result.current.show(capError(5), { surface: 'subscribe_dialog' }));
    act(() => void result.current.show(capError(6), { surface: 'subscribe_dialog' }));
    expect(result.current.state?.refusal.cap).toBe(6);
    expect(result.current.state?.refusalId).toBe(2);
  });

  it('never keeps a handle-keyed id as accountId, nor an empty one', () => {
    const { result } = renderHook(() => useSubscriptionCapRefusal());
    act(() => void result.current.show(capError(), { surface: 'event_detail_source', accountId: 'SomeHandle', username: 'somehandle' }));
    expect(result.current.state?.accountId).toBeUndefined();
    act(() => void result.current.show(capError(), { surface: 'restore', accountId: null }));
    expect(result.current.state?.accountId).toBeUndefined();
  });

  it('clear drops the refusal', () => {
    const { result } = renderHook(() => useSubscriptionCapRefusal());
    act(() => void result.current.show(capError(), { surface: 'restore' }));
    act(() => result.current.clear());
    expect(result.current.state).toBeNull();
  });
});
