"use client";

import { LogoMark } from './app-shell/LogoMark';
import { usePrefersReducedMotion } from '../hooks';

export function RouteLoader() {
  const prefersReducedMotion = usePrefersReducedMotion();

  return (
    <div className="w-full h-full flex-1 min-h-32 flex items-center justify-center">
      <LogoMark className={`h-10 w-10 ${prefersReducedMotion ? '' : 'animate-heartbeat'}`} />
    </div>
  );
}
