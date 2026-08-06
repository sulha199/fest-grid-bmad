"use client";

import React, { useRef, useState, useEffect, useCallback } from 'react';
import type { SwipeToRevealProps } from './swipe-to-reveal.types';
export function SwipeToReveal({
  children,
  action,
  onAction,
  revealThreshold,
  disabled = false,
  className,
}: SwipeToRevealProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const actionRef = useRef<HTMLDivElement>(null);
  
  const [offset, setOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [actionWidth, setActionWidth] = useState(0);
  const [direction, setDirection] = useState<'ltr' | 'rtl'>('ltr');
  
  const startXRef = useRef<number | null>(null);
  const startOffsetRef = useRef<number>(0);

  // Measure action width and text direction
  const measure = useCallback(() => {
    if (actionRef.current) {
      setActionWidth(actionRef.current.offsetWidth);
    }
    if (containerRef.current) {
      const computedDir = window.getComputedStyle(containerRef.current).direction;
      setDirection(computedDir === 'rtl' ? 'rtl' : 'ltr');
    }
  }, []);

  useEffect(() => {
    measure();
    
    // ResizeObserver to update width if action content changes dynamically
    if (actionRef.current && typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => measure());
      observer.observe(actionRef.current);
      return () => observer.disconnect();
    }
  }, [action, measure]);

  // Pointer event handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    
    // Do not initiate swipe/drag if the pointer client is clicking an interactive child element (button, link, etc.)
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('a') || target.closest('input') || target.closest('[role="button"]')) {
      return;
    }

    // Only handle primary pointer (usually touch or left click)
    if (e.isPrimary) {
      measure(); // re-measure direction just in case
      startXRef.current = e.clientX;
      startOffsetRef.current = offset;
      setIsDragging(true);
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || disabled || startXRef.current === null) return;
    
    const deltaX = e.clientX - startXRef.current;
    
    let newOffset = startOffsetRef.current + deltaX;
    
    // In LTR, action is on the right, drag left (negative offset) to reveal
    // In RTL, action is on the left, drag right (positive offset) to reveal
    if (direction === 'ltr') {
      // Clamp between -actionWidth and 0
      newOffset = Math.max(-actionWidth, Math.min(0, newOffset));
    } else {
      // Clamp between 0 and actionWidth
      newOffset = Math.max(0, Math.min(actionWidth, newOffset));
    }
    
    setOffset(newOffset);
  };

  const handlePointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || disabled) return;
    
    setIsDragging(false);
    startXRef.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
    
    const threshold = revealThreshold ?? (actionWidth * 0.5);
    
    // Snap logic
    let shouldReveal = false;
    if (direction === 'ltr') {
      shouldReveal = offset < -threshold;
      setOffset(shouldReveal ? -actionWidth : 0);
    } else {
      shouldReveal = offset > threshold;
      setOffset(shouldReveal ? actionWidth : 0);
    }
  };

  const handleAction = () => {
    if (disabled) return;
    onAction();
  };

  // Keyboard accessibility and hover reveal fallback
  const actionTabIndex = disabled ? -1 : 0;
  
  return (
    <div 
      ref={containerRef}
      className={`relative overflow-hidden group/swipe ${className || ''}`.trim()}
    >
      {/* Action wrapper: positioned behind the content */}
      <div 
        ref={actionRef}
        className={`absolute top-0 bottom-0 flex items-center transition-opacity duration-200 ${
          direction === 'ltr' ? "right-0" : "left-0"
        } ${
          (offset !== 0 || isDragging) ? "opacity-100 z-0" : "opacity-0 -z-10 group-hover/swipe:opacity-100 group-hover/swipe:z-0 focus-within:opacity-100 focus-within:z-0"
        }`}
      >
        <button
          type="button"
          onClick={handleAction}
          tabIndex={actionTabIndex}
          disabled={disabled}
          aria-disabled={disabled}
          className="h-full flex items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {action}
        </button>
      </div>

      {/* Content wrapper */}
      <div
        className={`w-full h-full relative z-10 bg-background ${
          !isDragging ? "transition-transform duration-200 ease-out" : ""
        }`}
        style={{
          transform: `translateX(${offset}px)`,
          touchAction: 'pan-y'
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
      >
        {children}
      </div>
    </div>
  );
}
