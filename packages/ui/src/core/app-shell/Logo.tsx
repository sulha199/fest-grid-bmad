import * as React from 'react';
import { LogoMark } from './LogoMark';

export function Logo({ className }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className || ''}`}>
      {/* 2x2 grid logomark */}
      <LogoMark />
      {/* Logotype: hidden on tablet rail (hidden xl:flex) */}
      <div className="text-xl tracking-tight hidden xl:flex items-baseline">
        <span className="font-bold">Fest</span>
        <span className="font-light">Grid</span>
      </div>
    </div>
  );
}
