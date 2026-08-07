'use client';

import React from 'react';
import { notFound, useSearchParams, useParams } from 'next/navigation';
import { useRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import {
  WizardStepProvider,
  useWizardStep,
  WizardStepSummary,
  WizardNavigation,
} from '@festgrid/ui';
import { wizardRegistry } from '@/features/wizard/wizard-registry';
import { isSafeRedirectPath } from '@/features/wizard/is-safe-redirect-path';

interface WizardPageContentProps {
  wizardKey: string;
  stepSlug: string;
}

function WizardPageInner({ wizardKey, stepSlug }: WizardPageContentProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams();
  const locale = (params?.locale as string) || 'en';
  const t = useTranslations();
  
  const { isStepCompleted } = useWizardStep();

  const wizard = wizardRegistry[wizardKey];
  if (!wizard) {
    notFound();
  }

  const currentIndex = wizard.steps.findIndex((s) => s.slug === stepSlug);
  if (currentIndex === -1) {
    notFound();
  }

  const currentStep = wizard.steps[currentIndex];

  const redirect = searchParams?.get('redirect');
  const safeRedirect = isSafeRedirectPath(redirect) ? redirect : null;

  // Build i18n steps for the Step Summary chrome
  const summarySteps = wizard.steps.map((s) => ({
    slug: s.slug,
    title: t(`Wizards.${wizardKey}.steps.${s.slug}.title`),
  }));

  // Handlers for step transitions preserving redirect parameter
  const buildTargetUrl = (targetSlug: string) => {
    const query = redirect ? `?redirect=${encodeURIComponent(redirect)}` : '';
    return `/wizard/${wizardKey}/${targetSlug}${query}`;
  };

  const onPrevious = () => {
    const prevStep = wizard.steps[currentIndex - 1];
    if (prevStep) {
      router.push(buildTargetUrl(prevStep.slug));
    }
  };

  const onNext = () => {
    const nextStep = wizard.steps[currentIndex + 1];
    if (nextStep) {
      router.push(buildTargetUrl(nextStep.slug));
    }
  };

  const onSkip = () => {
    const nextStep = wizard.steps[currentIndex + 1];
    if (nextStep && currentStep.canSkipStep) {
      router.push(buildTargetUrl(nextStep.slug));
    }
  };

  const onComplete = () => {
    const exitPath = safeRedirect || wizard.defaultExitPath;
    router.push(exitPath);
  };

  const chromeLabels = {
    previous: t('WizardChrome.previousStepLabel'),
    next: t('WizardChrome.nextStepLabel'),
    skip: t('WizardChrome.skipStepLabel'),
    complete: t('WizardChrome.completeLabel'),
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <WizardStepSummary steps={summarySteps} currentStepSlug={stepSlug} />
      
      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100 min-h-[300px]">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900">
            {t(`Wizards.${wizardKey}.steps.${stepSlug}.title`)}
          </h2>
          <p className="text-gray-500 text-sm mt-1">
            {t(`Wizards.${wizardKey}.steps.${stepSlug}.description`)}
          </p>
        </div>
        
        <currentStep.Component />
      </div>

      <WizardNavigation
        isFirstStep={currentIndex === 0}
        isLastStep={currentIndex === wizard.steps.length - 1}
        isStepCompleted={isStepCompleted}
        canSkipStep={!!currentStep.canSkipStep}
        labels={chromeLabels}
        onPrevious={onPrevious}
        onNext={onNext}
        onSkip={onSkip}
        onComplete={onComplete}
      />
    </div>
  );
}

export function WizardPageContent({ wizardKey, stepSlug }: WizardPageContentProps) {
  return (
    <WizardStepProvider>
      <WizardPageInner wizardKey={wizardKey} stepSlug={stepSlug} />
    </WizardStepProvider>
  );
}
