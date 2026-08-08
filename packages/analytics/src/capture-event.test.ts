import { expect, test, vi } from 'vitest';
import posthog from 'posthog-js';
import { capturePostHogEvent } from './capture-event';

vi.mock('posthog-js', () => ({
  default: {
    capture: vi.fn(),
  },
}));

test('capturePostHogEvent', () => {
  // Scenario 1: window is defined
  vi.stubGlobal('window', {});
  capturePostHogEvent('test_event', { key: 'value' });
  expect(posthog.capture).toHaveBeenCalledWith('test_event', { key: 'value' });

  // Scenario 2: window is undefined
  vi.mocked(posthog.capture).mockClear();
  vi.stubGlobal('window', undefined);
  capturePostHogEvent('test_event', { key: 'value' });
  expect(posthog.capture).not.toHaveBeenCalled();

  vi.unstubAllGlobals();
});
