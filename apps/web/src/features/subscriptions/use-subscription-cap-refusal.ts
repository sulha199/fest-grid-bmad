'use client';

import { useCallback, useRef, useState } from 'react';
import { readSubscriptionCapRefusal, type SubscriptionCapRefusal } from './subscription-cap-error';
import type { SubscriptionCapSurface } from './subscription-cap-analytics';

export interface SubscriptionCapShowContext {
  surface: SubscriptionCapSurface;
  /** The platform account id when the screen has it. */
  accountId?: string | null;
  /** The account's handle when the screen has it, used only to make sure a handle-keyed id is never sent as `accountId`. */
  username?: string | null;
}

export interface SubscriptionCapState {
  refusal: SubscriptionCapRefusal;
  surface: SubscriptionCapSurface;
  accountId?: string;
  /** Increments per refusal, so a notice keyed by it fires its "shown" event once per refusal. */
  refusalId: number;
}

export interface UseSubscriptionCapRefusalResult {
  state: SubscriptionCapState | null;
  /** Reads the error; when it is a cap refusal, stores it and returns true (the caller skips its generic toast). */
  show: (err: unknown, ctx: SubscriptionCapShowContext) => boolean;
  clear: () => void;
}

/** Story 10.3a: the one hook every subscribe or restore entry point uses to hold a cap refusal. */
export function useSubscriptionCapRefusal(): UseSubscriptionCapRefusalResult {
  const [state, setState] = useState<SubscriptionCapState | null>(null);
  const counter = useRef(0);

  const show = useCallback((err: unknown, ctx: SubscriptionCapShowContext): boolean => {
    const refusal = readSubscriptionCapRefusal(err);
    if (!refusal) return false;
    counter.current += 1;
    const accountId = ctx.accountId && ctx.accountId.toLowerCase() !== (ctx.username ?? '').toLowerCase() ? ctx.accountId : undefined;
    setState({ refusal, surface: ctx.surface, accountId, refusalId: counter.current });
    return true;
  }, []);

  const clear = useCallback(() => setState(null), []);

  return { state, show, clear };
}
