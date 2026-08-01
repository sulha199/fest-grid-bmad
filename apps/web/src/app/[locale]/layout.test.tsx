import { expect, test, vi } from 'vitest';
import { generateMetadata } from './layout';

vi.mock('next/font/google', () => ({
  Inter: () => ({
    style: { fontFamily: 'Inter' },
    className: 'className',
    variable: 'variable',
  }),
}));

vi.mock('next-intl/server', () => ({
  getTranslations: async ({ locale, namespace }: any) => {
    const messages = await import(`../../../locales/${locale}.json`);
    return (key: string) => messages.default[namespace][key];
  },
  getMessages: vi.fn(),
  setRequestLocale: vi.fn()
}));

test('generateMetadata resolves root layout default localized title and description', async () => {
  const metadataEN = await generateMetadata({ params: Promise.resolve({ locale: 'en' }) });
  expect(metadataEN).toEqual({
    title: 'FestDaily',
    description: 'AI-Powered Music Festival Grid and Scheduler',
    openGraph: {
      title: 'FestDaily',
      description: 'AI-Powered Music Festival Grid and Scheduler',
    }
  });
  
  const metadataID = await generateMetadata({ params: Promise.resolve({ locale: 'id' }) });
  expect(metadataID).toEqual({
    title: 'FestDaily',
    description: 'Jadwal dan Grid Festival Musik Berbasis AI',
    openGraph: {
      title: 'FestDaily',
      description: 'Jadwal dan Grid Festival Musik Berbasis AI',
    }
  });
});
