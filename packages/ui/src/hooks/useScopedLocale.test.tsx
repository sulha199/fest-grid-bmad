/// <reference types="@testing-library/jest-dom" />
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import { ScopedLocaleProvider, useScopedLocale, useScopedTimezone, useEventTimezone } from './useScopedLocale';

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

describe('useEventTimezone', () => {
  afterEach(() => cleanup());

  function EventProbe({ override, event }: { override?: string | null; event?: string | null }) {
    return <span>{useEventTimezone(override, event) ?? 'undefined'}</span>;
  }

  it('returns the ambient timezone when there is no override', () => {
    render(
      <ScopedLocaleProvider locale="en" timezone="America/New_York">
        <EventProbe />
      </ScopedLocaleProvider>
    );
    expect(screen.getByText('America/New_York')).toBeInTheDocument();
  });

  it('lets an explicit override beat the ambient timezone', () => {
    render(
      <ScopedLocaleProvider locale="en" timezone="America/New_York">
        <EventProbe override="Asia/Jakarta" />
      </ScopedLocaleProvider>
    );
    expect(screen.getByText('Asia/Jakarta')).toBeInTheDocument();
  });

  it.each([['an empty string', ''], ['null', null]])('treats %s as no override, never passing it to Intl', (_label, override) => {
    render(
      <ScopedLocaleProvider locale="en" timezone="America/New_York">
        <EventProbe override={override} />
      </ScopedLocaleProvider>
    );
    expect(screen.getByText('America/New_York')).toBeInTheDocument();
  });

  it('the event timezone beats the ambient one, and an explicit override beats both', () => {
    render(
      <ScopedLocaleProvider locale="en" timezone="America/New_York">
        <EventProbe event="Asia/Jakarta" />
      </ScopedLocaleProvider>
    );
    expect(screen.getByText('Asia/Jakarta')).toBeInTheDocument();
    cleanup();
    render(
      <ScopedLocaleProvider locale="en" timezone="America/New_York">
        <EventProbe override="Europe/Paris" event="Asia/Jakarta" />
      </ScopedLocaleProvider>
    );
    expect(screen.getByText('Europe/Paris')).toBeInTheDocument();
  });

  it.each([['undefined', undefined], ['null', null], ['an empty string', '']])('an event timezone of %s falls through to the ambient one', (_label, event) => {
    render(
      <ScopedLocaleProvider locale="en" timezone="America/New_York">
        <EventProbe event={event} />
      </ScopedLocaleProvider>
    );
    expect(screen.getByText('America/New_York')).toBeInTheDocument();
  });

  it('is undefined (runtime default) with no provider and no override', () => {
    render(<EventProbe />);
    expect(screen.getByText('undefined')).toBeInTheDocument();
  });
});
