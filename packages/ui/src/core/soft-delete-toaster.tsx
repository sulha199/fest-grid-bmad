"use client";

import { Toaster } from 'sonner';
import { SoftDeleteToasterProps } from './soft-delete-toaster.types';

export function SoftDeleteToaster({ className, style }: SoftDeleteToasterProps) {
  return (
    <Toaster
      position="bottom-right"
      className={className}
      style={style}
      toastOptions={{
        classNames: {
          toast: 'rounded-lg shadow-lg',
          info: 'bg-violet-100 text-violet-800',
          success: 'bg-green-100 text-green-800',
          error: 'bg-red-100 text-red-800',
          // Sonner default toast class when no specific type is provided
          default: 'bg-violet-100 text-violet-800',
        },
      }}
    />
  );
}
