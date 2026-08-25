/// <reference types="@testing-library/jest-dom" />
import React from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { TabbedShell } from './TabbedShell';
import { TabbedShellTab } from './TabbedShell.types';

afterEach(() => {
  cleanup();
});

const TabOne = () => <div data-testid="tab-one-content">Content One</div>;
const TabTwo = () => <div data-testid="tab-two-content">Content Two</div>;
const TabThree = () => <div data-testid="tab-three-content">Content Three</div>;

const mockTabs: TabbedShellTab[] = [
  { key: 'tab1', label: 'Tab One', Component: TabOne },
  { key: 'tab2', label: 'Tab Two', Component: TabTwo },
  { key: 'tab3', label: 'Tab Three', Component: TabThree },
];

describe('TabbedShell', () => {
  it('mounts only the active tab content component in the DOM', () => {
    render(
      <TabbedShell
        tabs={mockTabs}
        activeKey="tab2"
        onTabChange={vi.fn()}
      />
    );

    // Active tab (tab2) content is in DOM
    expect(screen.getByTestId('tab-two-content')).toBeInTheDocument();
    expect(screen.getByText('Content Two')).toBeInTheDocument();

    // Inactive tabs (tab1, tab3) content components are NOT in DOM
    expect(screen.queryByTestId('tab-one-content')).not.toBeInTheDocument();
    expect(screen.queryByTestId('tab-three-content')).not.toBeInTheDocument();
  });

  it('exposes correct standard ARIA roles and state attributes', () => {
    render(
      <TabbedShell
        tabs={mockTabs}
        activeKey="tab2"
        onTabChange={vi.fn()}
      />
    );

    // Tablist role
    const tablist = screen.getByRole('tablist');
    expect(tablist).toBeInTheDocument();

    // Tab roles
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(3);

    // Labels are pre-resolved from the props
    expect(tabs[0]).toHaveTextContent('Tab One');
    expect(tabs[1]).toHaveTextContent('Tab Two');
    expect(tabs[2]).toHaveTextContent('Tab Three');

    // aria-selected
    expect(tabs[0]).toHaveAttribute('aria-selected', 'false');
    expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
    expect(tabs[2]).toHaveAttribute('aria-selected', 'false');

    // Tabpanel role
    const tabpanel = screen.getByRole('tabpanel');
    expect(tabpanel).toBeInTheDocument();
  });

  it('handles free navigation: clicking an inactive tab calls onTabChange with its key', async () => {
    const mockOnTabChange = vi.fn();
    const user = userEvent.setup();

    function TestWrapper() {
      const [activeKey, setActiveKey] = React.useState('tab1');
      return (
        <TabbedShell
          tabs={mockTabs}
          activeKey={activeKey}
          onTabChange={(key) => {
            setActiveKey(key);
            mockOnTabChange(key);
          }}
        />
      );
    }

    render(<TestWrapper />);

    const tabs = screen.getAllByRole('tab');

    // Click Tab Three directly from active Tab One (free navigation)
    await user.click(tabs[2]);

    expect(mockOnTabChange).toHaveBeenCalledTimes(1);
    expect(mockOnTabChange).toHaveBeenCalledWith('tab3');
  });

  it('supports roving tabindex focus movements via keyboard arrow keys (regression check)', async () => {
    const user = userEvent.setup();
    const onTabChange = vi.fn();

    render(
      <TabbedShell
        tabs={mockTabs}
        activeKey="tab1"
        onTabChange={onTabChange}
      />
    );

    const tabs = screen.getAllByRole('tab');

    // Focus first tab
    tabs[0].focus();
    expect(tabs[0]).toHaveFocus();

    // Press right arrow to move focus to next tab
    await user.keyboard('{ArrowRight}');
    expect(tabs[1]).toHaveFocus();

    // Press right arrow again to move focus to third tab
    await user.keyboard('{ArrowRight}');
    expect(tabs[2]).toHaveFocus();
  });
});
