import { getRequestConfig } from 'next-intl/server';
import { routing } from './i18n.config';

export default getRequestConfig(async ({ locale }) => {
  const resolvedLocale = locale ?? routing.defaultLocale;
  const messages = (await import(`./src/messages/${resolvedLocale}.json`)).default;

  return {
    locale: resolvedLocale,
    messages,
  };
});
