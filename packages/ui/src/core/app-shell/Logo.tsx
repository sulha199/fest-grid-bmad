import * as React from 'react';

export function Logo({ className }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className || ''}`}>
      {/* 2x2 grid logomark */}
      <div className="grid grid-cols-2 grid-rows-2 gap-[2px] w-6 h-6">
        <div className="bg-foreground rounded-sm"></div>
        <div className="bg-foreground rounded-sm"></div>
        <div className="bg-foreground rounded-sm"></div>
        {/* Spark square */}
        <div className="bg-primary rounded-sm rotate-45 transform origin-center scale-75"></div>
      </div>
      {/* Logotype */}
      <div className="text-xl tracking-tight flex items-baseline">
        <span className="font-bold">Fest</span>
        <span className="font-light">Daily</span>
      </div>
    </div>
  );
}
