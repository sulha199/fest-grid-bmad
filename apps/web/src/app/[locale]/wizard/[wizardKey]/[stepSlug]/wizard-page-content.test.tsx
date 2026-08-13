import '@testing-library/jest-dom/vitest';
import React from 'react';
import { render, screen, act, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { notFound, useSearchParams, useParams } from 'next/navigation';
import { useRouter } from '@/i18n/navigation';
import { wizardRegistry } from '@/features/wizard/wizard-registry';
import { useWizardStep } from '@festgrid/ui';
import { WizardPageContent } from './wizard-page-content';
import enMessages from '../../../../../../locales/en.json';

// Mock Router
const mockRouterPush = vi.fn();
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({
    push: mockRouterPush,
    replace: vi.fn(),
    back: vi.fn(),
  }),
}));

// Mock Next Navigation
let mockSearchParams = new URLSearchParams();
let mockParams = { locale: 'en' };
vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('notFound() called');
  }),
  useSearchParams: () => mockSearchParams,
  useParams: () => mockParams,
}));

// Test step components
function StepOneComponent() {
  const { setStepCompleted } = useWizardStep();
  return (
    <div>
      <h3>Step One Component</h3>
      <button data-testid="complete-step-btn" onClick={() => setStepCompleted(true)}>
        Complete Step
      </button>
    </div>
  );
}

function StepTwoComponent() {
  return (
    <div>
      <h3>Step Two Component</h3>
    </div>
  );
}

describe('WizardPageContent Client Component', () => {
  const testMessages = {
    ...enMessages,
    Wizards: {
      ...enMessages.Wizards,
      'test-wizard': {
        title: 'Test Wizard',
        description: 'Test wizard description',
        steps: {
          'step-1': {
            title: 'Step 1',
            description: 'Step 1 description',
          },
          'step-2': {
            title: 'Step 2',
            description: 'Step 2 description',
          },
        },
      },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams();
    mockParams = { locale: 'en' };

    // Register a mock wizard into the real imported wizardRegistry
    wizardRegistry['test-wizard'] = {
      key: 'test-wizard',
      defaultExitPath: '/dashboard',
      steps: [
        { slug: 'step-1', canSkipStep: true, Component: StepOneComponent },
        { slug: 'step-2', Component: StepTwoComponent },
      ],
    };
  });

  afterEach(() => {
    cleanup();
    delete wizardRegistry['test-wizard'];
  });

  const renderWithI18n = (ui: React.ReactElement) => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    return render(
      <QueryClientProvider client={queryClient}>
        <NextIntlClientProvider locale="en" messages={testMessages}>
          {ui}
        </NextIntlClientProvider>
      </QueryClientProvider>
    );
  };

  it('triggers notFound() when wizardKey is invalid', () => {
    expect(() => {
      renderWithI18n(<WizardPageContent wizardKey="non-existent" stepSlug="step-1" />);
    }).toThrow('notFound() called');
    expect(notFound).toHaveBeenCalled();
  });

  it('triggers notFound() when stepSlug is invalid', () => {
    expect(() => {
      renderWithI18n(<WizardPageContent wizardKey="test-wizard" stepSlug="invalid-step" />);
    }).toThrow('notFound() called');
    expect(notFound).toHaveBeenCalled();
  });

  it('renders Step Summary, Navigation, and current Step Component', () => {
    renderWithI18n(<WizardPageContent wizardKey="test-wizard" stepSlug="step-1" />);

    // Check step summary horizontal items
    const listitems = screen.getAllByRole('listitem');
    expect(listitems).toHaveLength(2);
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();

    // Expect current step Component content to render
    expect(screen.getByText('Step One Component')).toBeInTheDocument();

    // Check navigation buttons
    const prevBtn = screen.getByRole('button', { name: enMessages.WizardChrome.previousStepLabel });
    const nextBtn = screen.getByRole('button', { name: enMessages.WizardChrome.nextStepLabel });
    const skipBtn = screen.getByRole('button', { name: enMessages.WizardChrome.skipStepLabel });

    expect(prevBtn).toBeDisabled(); // First step disables previous
    expect(nextBtn).toBeDisabled(); // Initially incomplete, so next is disabled
    expect(skipBtn).not.toBeDisabled(); // canSkipStep: true and not last step
  });

  it('renders the wizard-level title and description for a real registered wizard', () => {
    renderWithI18n(<WizardPageContent wizardKey="onboarding" stepSlug="api-key" />);

    expect(
      screen.getByRole('heading', { level: 1, name: enMessages.Wizards.onboarding.title })
    ).toBeInTheDocument();
    expect(screen.getByText(enMessages.Wizards.onboarding.description)).toBeInTheDocument();
  });

  it('enables next button and preserves redirect param on transition', () => {
    mockSearchParams = new URLSearchParams({ redirect: '/my-favorites' });
    renderWithI18n(<WizardPageContent wizardKey="test-wizard" stepSlug="step-1" />);

    const nextBtn = screen.getByRole('button', { name: enMessages.WizardChrome.nextStepLabel });
    expect(nextBtn).toBeDisabled();

    // Click trigger to set step completed
    act(() => {
      screen.getByTestId('complete-step-btn').click();
    });

    expect(nextBtn).not.toBeDisabled();

    // Click Next button
    act(() => {
      nextBtn.click();
    });

    expect(mockRouterPush).toHaveBeenCalledWith('/wizard/test-wizard/step-2?redirect=%2Fmy-favorites');
  });

  it('navigates to next step on Skip and preserves redirect', () => {
    mockSearchParams = new URLSearchParams({ redirect: '/my-favorites' });
    renderWithI18n(<WizardPageContent wizardKey="test-wizard" stepSlug="step-1" />);

    const skipBtn = screen.getByRole('button', { name: enMessages.WizardChrome.skipStepLabel });
    
    act(() => {
      skipBtn.click();
    });

    expect(mockRouterPush).toHaveBeenCalledWith('/wizard/test-wizard/step-2?redirect=%2Fmy-favorites');
  });

  it('navigates to safe redirect or defaultExitPath on Complete', () => {
    // Step 2 is the last step
    mockSearchParams = new URLSearchParams({ redirect: '/my-favorites' });
    const { rerender } = renderWithI18n(<WizardPageContent wizardKey="test-wizard" stepSlug="step-2" />);

    const completeBtn = screen.getByRole('button', { name: enMessages.WizardChrome.completeLabel });
    
    // Complete button is disabled by default because isStepCompleted is false
    expect(completeBtn).toBeDisabled();

    // Let's rerender with isStepCompleted true (we can mock useWizardStep or trigger it by rendering a step component that completes itself)
    // Wait, let's just make a test registry entry where step-2 is completed automatically on mount
    function AutoCompleteStep() {
      const { setStepCompleted } = useWizardStep();
      React.useEffect(() => {
        setStepCompleted(true);
      }, [setStepCompleted]);
      return <div>Auto Complete Step</div>;
    }

    wizardRegistry['test-wizard'].steps[1].Component = AutoCompleteStep;

    rerender(
      <NextIntlClientProvider locale="en" messages={testMessages}>
        <WizardPageContent wizardKey="test-wizard" stepSlug="step-2" />
      </NextIntlClientProvider>
    );

    const completedCompleteBtn = screen.getByRole('button', { name: enMessages.WizardChrome.completeLabel });
    expect(completedCompleteBtn).not.toBeDisabled();

    act(() => {
      completedCompleteBtn.click();
    });

    // Same origin safe redirect is used
    expect(mockRouterPush).toHaveBeenCalledWith('/my-favorites');

    // Test without redirect / unsafe redirect
    mockSearchParams = new URLSearchParams({ redirect: 'https://evil.com' }); // Unsafe
    rerender(
      <NextIntlClientProvider locale="en" messages={testMessages}>
        <WizardPageContent wizardKey="test-wizard" stepSlug="step-2" />
      </NextIntlClientProvider>
    );

    act(() => {
      screen.getByRole('button', { name: enMessages.WizardChrome.completeLabel }).click();
    });

    // Unsafe redirect falls back to defaultExitPath
    expect(mockRouterPush).toHaveBeenCalledWith('/dashboard');
  });
});
