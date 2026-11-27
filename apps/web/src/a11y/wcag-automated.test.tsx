/// <reference types="@testing-library/jest-dom" />
/**
 * Automated WCAG 2.2 A/AA ratchet (axe-core, jsdom) for the popups of the event list and event detail that live in
 * `apps/web` (the report dialog). The shared components are covered in `packages/ui/src/a11y/wcag-automated.test.tsx`.
 * See project-context.md "Accessibility" for what this cannot see (contrast, target size, focus order, screen readers).
 */
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReportDialog } from '../features/events/report-dialog';
import { describeViolations, wcagViolations } from './axe-helper';

class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = MockResizeObserver;

vi.mock('@festgrid/analytics', () => ({ usePostHog: () => ({ capture: vi.fn() }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('next-intl', () => ({ useTranslations: (namespace: string) => (key: string) => `${namespace}.${key}` }));

describe('WCAG automated ratchet (apps/web popups)', () => {
  afterEach(cleanup);

  it('report dialog: open, and with a reason chosen', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <ReportDialog isOpen onClose={vi.fn()} eventId="evt_1" onReported={vi.fn()} />
      </QueryClientProvider>,
    );
    let violations = await wcagViolations(document.body);
    expect(violations, '\n' + describeViolations(violations)).toEqual([]);

    fireEvent.click(document.getElementById('reason-personal') as HTMLButtonElement);
    expect(screen.getByRole('button', { name: 'EventReportForm.submitButtonLabel' })).not.toBeDisabled();
    violations = await wcagViolations(document.body);
    expect(violations, '\n' + describeViolations(violations)).toEqual([]);
  });
});
