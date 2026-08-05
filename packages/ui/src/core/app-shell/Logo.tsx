import * as React from 'react';

export function Logo({ className }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className || ''}`}>
      {/* 2x2 grid logomark */}
      <div className="grid grid-cols-2 grid-rows-2 gap-[2px] w-6 h-6 shrink-0">
        <div className="bg-foreground rounded-sm"></div>
        {/* Spark square: upper right (second slot) in bg-accent */}
        <div className="bg-accent rounded-sm rotate-45 transform origin-center scale-75"></div>
        <div className="bg-foreground rounded-sm"></div>
        <div className="bg-foreground rounded-sm"></div>
      </div>
      {/* Logotype: hidden on tablet rail (hidden xl:flex) */}
      <div className="text-xl tracking-tight hidden xl:flex items-baseline">
        <span className="font-bold">Fest</span>
        <span className="font-light">Grid</span>
      </div>
    </div>
  );
}
