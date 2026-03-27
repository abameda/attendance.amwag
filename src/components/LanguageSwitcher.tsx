'use client';

import { Globe } from 'lucide-react';
import { useLocale } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui';

export default function LanguageSwitcher() {
    const locale = useLocale();
    const router = useRouter();
    const pathname = usePathname();

    const toggleLanguage = () => {
        const newLocale = locale === 'en' ? 'ar' : 'en';
        const newPath = pathname.replace(`/${locale}`, `/${newLocale}`);

        router.push(newPath);
    };

    return (
        <Button
            variant="outline"
            size="sm"
            onClick={toggleLanguage}
            className="flex items-center gap-2 border-[var(--line)] bg-[var(--surface)] text-[var(--foreground-soft)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
        >
            <Globe className="h-4 w-4 text-[var(--accent)]" />
            <span>{locale === 'en' ? 'العربية' : 'English'}</span>
        </Button>
    );
}
