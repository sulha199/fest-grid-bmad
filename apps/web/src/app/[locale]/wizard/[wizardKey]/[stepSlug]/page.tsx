import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { RouteLoader } from '@festgrid/ui';
import { getTranslations } from 'next-intl/server';
import { buildPageMetadata } from '@/lib/metadata';
import { wizardRegistry } from '@/features/wizard/wizard-registry';
import { buildWizardMetadataKeys } from '@/features/wizard/metadata-key';
import { WizardPageContent } from './wizard-page-content';

export const dynamic = 'force-dynamic';

interface PageParams {
  locale: string;
  wizardKey: string;
  stepSlug: string;
}

export async function generateMetadata({ params }: { params: Promise<PageParams> }) {
  const { locale, wizardKey, stepSlug } = await params;

  const wizard = wizardRegistry[wizardKey];
  if (!wizard) {
    notFound();
  }

  const step = wizard.steps.find((s) => s.slug === stepSlug);
  if (!step) {
    notFound();
  }

  const { titleKey, descriptionKey } = buildWizardMetadataKeys(wizardKey, stepSlug);
  const t = await getTranslations({ locale, namespace: 'Metadata' });

  return buildPageMetadata({
    title: t(titleKey),
    description: t(descriptionKey),
  });
}

export default async function WizardStepPage({ params }: { params: Promise<PageParams> }) {
  const { wizardKey, stepSlug } = await params;

  // Defense-in-depth Server-side check
  const wizard = wizardRegistry[wizardKey];
  if (!wizard) {
    notFound();
  }

  const step = wizard.steps.find((s) => s.slug === stepSlug);
  if (!step) {
    notFound();
  }

  return (
    <Suspense fallback={<RouteLoader />}>
      <WizardPageContent wizardKey={wizardKey} stepSlug={stepSlug} />
    </Suspense>
  );
}
