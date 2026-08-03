import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SoftDeleteToaster } from './soft-delete-toaster';
import { useSoftDeleteWithUndo } from '../hooks/useSoftDeleteWithUndo';

// Test harness component to trigger a toast
function TestHarness() {
  const { markPending } = useSoftDeleteWithUndo();
  
  return (
    <div>
      <SoftDeleteToaster />
      <button 
        data-testid="trigger-btn"
        onClick={() => markPending('test-id', vi.fn().mockResolvedValue(undefined))}
      >
        Trigger Toast
      </button>
    </div>
  );
}

describe('SoftDeleteToaster', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a Toaster and shows toast content when triggered', async () => {
    render(<TestHarness />);
    
    // Initial state: no toast
    expect(screen.queryByText('Item removed')).not.toBeInTheDocument();
    
    // Trigger toast
    act(() => {
      screen.getByTestId('trigger-btn').click();
    });
    
    // Toast should appear (we don't need await findByText because sonner is fast in tests,
    // but findByText is safer if there are microtasks)
    expect(await screen.findByText('Item removed')).toBeInTheDocument();
    expect(await screen.findByText('Undo')).toBeInTheDocument();
  });
});
