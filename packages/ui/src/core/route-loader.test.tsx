import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { RouteLoader } from './route-loader';

// Mock the usePrefersReducedMotion hook
vi.mock('../hooks/usePrefersReducedMotion', () => ({
  usePrefersReducedMotion: vi.fn(),
}));

import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';

describe('RouteLoader', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('renders LogoMark with animate-heartbeat when reduced motion is false', () => {
    vi.mocked(usePrefersReducedMotion).mockReturnValue(false);
    
    const { container } = render(<RouteLoader />);
    const rootDiv = container.firstChild as HTMLElement;
    expect(rootDiv).toBeInTheDocument();
    
    // The LogoMark div is the first child of RouteLoader
    const logoMark = rootDiv.firstChild as HTMLElement;
    expect(logoMark.className).toContain('animate-heartbeat');
  });

  it('renders LogoMark without animate-heartbeat when reduced motion is true', () => {
    vi.mocked(usePrefersReducedMotion).mockReturnValue(true);
    
    const { container } = render(<RouteLoader />);
    const rootDiv = container.firstChild as HTMLElement;
    
    const logoMark = rootDiv.firstChild as HTMLElement;
    expect(logoMark.className).not.toContain('animate-heartbeat');
  });
});
