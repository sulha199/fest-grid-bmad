'use client';

import { useEffect, useRef, useState } from 'react';

/** `document.visibilityState !== 'hidden'`, kept in state. SSR-safe (visible). */
export function usePageVisible(): boolean {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const update = () => setVisible(document.visibilityState !== 'hidden');
    update();
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);
  return visible;
}

/** Runs `onReturn` once each time the tab goes from hidden back to visible (the one immediate fetch on return). */
export function useOnReturnToVisible(visible: boolean, onReturn: () => void): void {
  const was = useRef(visible);
  const latest = useRef(onReturn);
  latest.current = onReturn;
  useEffect(() => {
    if (visible && !was.current) latest.current();
    was.current = visible;
  }, [visible]);
}
