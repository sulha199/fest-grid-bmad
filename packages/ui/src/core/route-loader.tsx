import * as React from 'react';
import { LogoMark } from './app-shell/LogoMark';
import { usePrefersReducedMotion } from '../hooks';

export function RouteLoader() {
  const prefersReducedMotion = usePrefersReducedMotion();

  return (
    <div className="w-full h-full min-h-32 flex items-center justify-center">
      <LogoMark className={`h-10 w-10 ${prefersReducedMotion ? '' : 'animate-heartbeat'}`} />
    </div>
  );
}
