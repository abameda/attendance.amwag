import { getRequestConfig } from 'next-intl/server';
import arMessages from '../../messages/ar.json';
import enMessages from '../../messages/en.json';

const messagesByLocale = {
    ar: arMessages,
    en: enMessages,
} as const;

export default getRequestConfig(async ({ requestLocale }) => {
    // This typically corresponds to the `[locale]` segment
    const requestedLocale = await requestLocale;

    // Ensure that a valid locale is used
    const locale = requestedLocale === 'en' || requestedLocale === 'ar' ? requestedLocale : 'ar';

    return {
        locale,
        messages: messagesByLocale[locale]
    };
});
