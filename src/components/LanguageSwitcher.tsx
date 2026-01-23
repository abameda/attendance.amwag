'use client';

import { useLocale } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui';
import { Globe } from 'lucide-react';

export default function LanguageSwitcher() {
    const locale = useLocale();
    const router = useRouter();
    const pathname = usePathname();

    const toggleLanguage = () => {
        const newLocale = locale === 'en' ? 'ar' : 'en';
        // Replace the locale segment in the pathname
        // The pathname usually looks like `/en/admin` or `/ar/employee`
        // We want to replace the first segment
        const newPath = pathname.replace(`/${locale}`, `/${newLocale}`);

        router.push(newPath);
    };

    return (
        <Button
            variant="outline"
            size="sm"
            onClick={toggleLanguage}
            className="flex items-center gap-2"
        >
            <Globe className="w-4 h-4" />
            <span>{locale === 'en' ? 'العربية' : 'English'}</span>
        </Button>
    );
}
