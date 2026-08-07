import * as React from 'react';

export function LogoMark({ className }: { className?: string }) {
  return (
    <div className={`grid grid-cols-2 grid-rows-2 gap-[2px] shrink-0 ${className || 'w-6 h-6'}`}>
      <div className="bg-foreground rounded-sm"></div>
      {/* Spark square: upper right (second slot) in bg-accent */}
      <div className="bg-accent rounded-sm rotate-45 transform origin-center scale-75"></div>
      <div className="bg-foreground rounded-sm"></div>
      <div className="bg-foreground rounded-sm"></div>
    </div>
  );
}
