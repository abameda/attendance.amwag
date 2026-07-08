'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

const socialLinks = [
    {
        label: 'GitHub',
        href: 'https://github.com/abameda',
        path: 'M12 .5C5.649.5.5 5.649.5 12a11.5 11.5 0 0 0 7.861 10.921c.575.107.786-.25.786-.557 0-.275-.01-1.004-.016-1.97-3.198.695-3.873-1.541-3.873-1.541-.523-1.329-1.277-1.682-1.277-1.682-1.044-.714.079-.699.079-.699 1.154.081 1.761 1.186 1.761 1.186 1.026 1.758 2.691 1.25 3.347.956.104-.743.401-1.25.729-1.538-2.553-.29-5.238-1.276-5.238-5.682 0-1.255.448-2.282 1.183-3.086-.119-.29-.513-1.457.112-3.038 0 0 .965-.309 3.162 1.179a10.988 10.988 0 0 1 5.758 0c2.195-1.488 3.159-1.179 3.159-1.179.627 1.581.233 2.748.114 3.038.737.804 1.181 1.831 1.181 3.086 0 4.417-2.689 5.389-5.251 5.673.412.355.779 1.057.779 2.131 0 1.539-.014 2.779-.014 3.157 0 .31.207.67.792.556A11.502 11.502 0 0 0 23.5 12C23.5 5.649 18.351.5 12 .5Z',
    },
    {
        label: 'Instagram',
        href: 'https://www.instagram.com/abamedax/',
        path: 'M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z',
    },
    {
        label: 'LinkedIn',
        href: 'https://www.linkedin.com/in/elshorbagy/',
        path: 'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z',
    },
] as const;

interface FooterProps {
    className?: string;
    compact?: boolean;
}

interface SocialLinksProps {
    className?: string;
    iconClassName?: string;
    linkClassName?: string;
    githubHoverClassName?: string;
    accentHoverClassName?: string;
}

export function SocialLinks({
    className,
    iconClassName = 'h-5 w-5',
    linkClassName = 'text-[var(--footer-muted)] transition-colors',
    githubHoverClassName = 'hover:text-[var(--footer-strong)]',
    accentHoverClassName = 'hover:text-[var(--footer-accent)]',
}: SocialLinksProps) {
    return (
        <div className={cn('flex items-center justify-center gap-4', className)}>
            {socialLinks.map((link) => (
                <a
                    key={link.href}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                        linkClassName,
                        link.label === 'GitHub' ? githubHoverClassName : accentHoverClassName
                    )}
                    title={link.label}
                >
                    <svg className={iconClassName} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path d={link.path} />
                    </svg>
                    <span className="sr-only">{link.label}</span>
                </a>
            ))}
        </div>
    );
}

export default function Footer({ className, compact = false }: FooterProps) {
    const tc = useTranslations('Common');

    const iconSize = compact ? 'w-4 h-4' : 'w-5 h-5';
    const textSize = compact ? 'text-xs' : 'text-sm';
    const socialGap = compact ? 'mt-1' : 'mt-2';

    return (
        <footer className={cn('text-center', className)}>
            <p className={`${textSize} text-[var(--footer-muted)]`}>
                {tc('developedBy')}{' '}
                <a
                    href="https://aelshorbagy.vercel.app/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-[var(--footer-strong)] transition-colors hover:text-[var(--footer-accent)]"
                >
                    {tc('devName')}
                </a>
            </p>
            <SocialLinks className={socialGap} iconClassName={iconSize} />
        </footer>
    );
}
