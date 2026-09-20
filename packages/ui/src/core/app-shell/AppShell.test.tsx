/// <reference types="@testing-library/jest-dom" />
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import { AppShell } from './AppShell';

// Minimal `renderLink` stand-in — AppShell only needs an anchor-compatible component.
function TestLink({ href, children, className, ...rest }: any) {
  return (
    <a href={href} className={className} {...rest}>
      {children}
    </a>
  );
}

const labels = {
  discover: 'Discover',
  feed: 'Feed',
  favorites: 'Favorites',
  calendar: 'Calendar',
  login: 'Login',
};

function renderAppShell(props: Partial<React.ComponentProps<typeof AppShell>> = {}) {
  return render(
    <AppShell
      isAuthenticated={false}
      currentPath="/"
      renderLink={TestLink}
      labels={labels}
      {...props}
    >
      <div data-testid="page-content">Page content</div>
    </AppShell>
  );
}

describe('AppShell (Story 0.42 AC1-AC3)', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders ambientBanner as the first child of <main>, before children', () => {
    renderAppShell({ ambientBanner: <div data-testid="ambient-banner">Banner</div> });

    const main = screen.getByRole('main');
    const banner = screen.getByTestId('ambient-banner');
    const content = screen.getByTestId('page-content');

    expect(main).toContainElement(banner);
    expect(main).toContainElement(content);

    // Banner must precede content in DOM order.
    const position = banner.compareDocumentPosition(content);
    // eslint-disable-next-line no-bitwise
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('renders unchanged (no extra node) when ambientBanner is omitted', () => {
    renderAppShell();

    const main = screen.getByRole('main');
    expect(screen.getByTestId('page-content')).toBeInTheDocument();
    // Only the page content should be present inside <main> — no stray node
    // for an absent ambientBanner (React renders `undefined` as nothing).
    expect(main.childNodes.length).toBe(1);
  });
});
