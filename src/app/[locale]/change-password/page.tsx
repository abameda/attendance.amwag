'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { KeyRound, Lock, ShieldCheck } from 'lucide-react';
import { useLocale } from 'next-intl';

import Footer from '@/components/Footer';
import {
    Button,
    Input,
    ToastContainer,
    addToast,
    motion,
} from '@/components/ui';

export default function ChangePasswordPage() {
    const router = useRouter();
    const locale = useLocale();

    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const submit = async (event: React.FormEvent) => {
        event.preventDefault();

        if (newPassword !== confirmPassword) {
            addToast('Passwords do not match', 'error');
            return;
        }

        if (newPassword.length < 8) {
            addToast('New password must be at least 8 characters', 'error');
            return;
        }

        setIsLoading(true);

        try {
            const response = await fetch('/api/auth/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currentPassword, newPassword }),
            });
            const json = await response.json();

            if (!response.ok || !json.success) {
                addToast(json.error ?? 'Update failed', 'error');
                return;
            }

            addToast('Password updated successfully', 'success');
            router.push(`/${locale}/employee`);
            router.refresh();
        } catch {
            addToast('Network error', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen flex-col">
            <div className="flex flex-1 items-center justify-center px-4 py-12">
                <div className="w-full max-w-md space-y-6">
                    <div className="flex justify-center">
                        <div className="relative h-20 w-20 overflow-hidden rounded-2xl bg-[var(--surface-strong)] shadow-[0_0_0_1px_var(--line),_var(--shadow-glow-blue)]">
                            <Image
                                src="/logo.png"
                                alt="Amwag Transportation"
                                fill
                                className="object-contain p-2"
                                priority
                            />
                        </div>
                    </div>

                    <div className="rounded-3xl border border-[var(--line)] bg-[var(--surface-strong)] p-6 backdrop-blur-[24px] sm:p-8">
                        <div className="space-y-6">
                            <div className="space-y-1">
                                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">
                                    Security update
                                </p>
                                <h1 className="text-3xl font-bold text-[var(--foreground)]">
                                    Change your password
                                </h1>
                            </div>

                            <div className="relative overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 ps-5">
                                <div className="absolute inset-y-0 start-0 w-0.5 bg-[var(--accent)]" />
                                <p className="text-sm font-medium text-[var(--foreground-soft)]">
                                    One more step
                                </p>
                                <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                                    You must set a new password before continuing to the workspace.
                                </p>
                            </div>

                            <form onSubmit={submit} className="space-y-4">
                                <Input
                                    id="currentPassword"
                                    label="Current password"
                                    type="password"
                                    placeholder="Enter your current password"
                                    value={currentPassword}
                                    onChange={(event) => setCurrentPassword(event.target.value)}
                                    icon={<ShieldCheck className="h-4 w-4" />}
                                    required
                                    autoComplete="current-password"
                                />

                                <Input
                                    id="newPassword"
                                    label="New password"
                                    type="password"
                                    placeholder="Choose a new password"
                                    value={newPassword}
                                    onChange={(event) => setNewPassword(event.target.value)}
                                    icon={<KeyRound className="h-4 w-4" />}
                                    required
                                    autoComplete="new-password"
                                />

                                <Input
                                    id="confirmPassword"
                                    label="Confirm password"
                                    type="password"
                                    placeholder="Re-enter your new password"
                                    value={confirmPassword}
                                    onChange={(event) => setConfirmPassword(event.target.value)}
                                    icon={<Lock className="h-4 w-4" />}
                                    required
                                    autoComplete="new-password"
                                />

                                <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}>
                                    <Button
                                        type="submit"
                                        className="w-full justify-between"
                                        size="lg"
                                        isLoading={isLoading}
                                    >
                                        <span>Update password</span>
                                        <ShieldCheck className="h-4 w-4" />
                                    </Button>
                                </motion.div>
                            </form>
                        </div>
                    </div>
                </div>

                <ToastContainer />
            </div>
            <Footer className="pb-3 pt-4" />
        </div>
    );
}
