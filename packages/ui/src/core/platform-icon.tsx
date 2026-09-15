import * as React from 'react';
import { Instagram, Link } from 'lucide-react';

export function PlatformIcon({ platform, className }: { platform: string; className?: string }) {
  const norm = platform.toLowerCase();
  if (norm === 'instagram') {
    return <Instagram className={className} />;
  }
  return <Link className={className} />;
}
