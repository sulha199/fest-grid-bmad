import { getRequestConfig } from 'next-intl/server';

export const locales = ['en'];
export const defaultLocale = 'en';

export default getRequestConfig(async ({ locale }) => {
  const resolvedLocale = locale ?? defaultLocale;
  const messages = (await import(`./messages/${resolvedLocale}.json`)).default;

  return {
    locale: resolvedLocale,
    messages,
  };
});
