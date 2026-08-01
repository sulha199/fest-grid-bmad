/// <reference types="@testing-library/jest-dom" />
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ScopedLocaleProvider, useScopedLocale, useScopedTimezone } from './useScopedLocale';

function Probe() {
  const timezone = useScopedTimezone();
  return (
    <span>
      {useScopedLocale()}|{timezone ?? 'undefined'}
    </span>
  );
}

describe('useScopedLocale / useScopedTimezone / ScopedLocaleProvider', () => {
  it('falls back to en-US locale and undefined timezone when no provider is present', () => {
    render(<Probe />);
    expect(screen.getByText('en-US|undefined')).toBeInTheDocument();
  });

  it('resolves to the nearest ancestor provider', () => {
    render(
      <ScopedLocaleProvider locale="id" timezone="Asia/Jakarta">
        <Probe />
      </ScopedLocaleProvider>
    );
    expect(screen.getByText('id|Asia/Jakarta')).toBeInTheDocument();
  });

  it('lets a nested provider override an outer one when both fields are set', () => {
    render(
      <ScopedLocaleProvider locale="id" timezone="Asia/Jakarta">
        <ScopedLocaleProvider locale="en" timezone="America/New_York">
          <Probe />
        </ScopedLocaleProvider>
      </ScopedLocaleProvider>
    );
    expect(screen.getByText('en|America/New_York')).toBeInTheDocument();
  });

  it('supports a locale-only provider at the root (timezone stays undefined)', () => {
    render(
      <ScopedLocaleProvider locale="id">
        <Probe />
      </ScopedLocaleProvider>
    );
    expect(screen.getByText('id|undefined')).toBeInTheDocument();
  });

  it('inherits the ambient timezone when a nested provider only overrides locale', () => {
    render(
      <ScopedLocaleProvider locale="id" timezone="Asia/Jakarta">
        <ScopedLocaleProvider locale="en">
          <Probe />
        </ScopedLocaleProvider>
      </ScopedLocaleProvider>
    );
    // The inner provider only changes `locale` — it must not silently reset
    // the ambient timezone back to "unset".
    expect(screen.getByText('en|Asia/Jakarta')).toBeInTheDocument();
  });
});
