'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ArrowRight, Lock, Mail } from 'lucide-react';
import { useLocale } from 'next-intl';
import Footer from '@/components/Footer';
import { createClient } from '@/lib/supabase/client';
import {
    Button,
    Input,
    ToastContainer,
    addToast,
    motion,
} from '@/components/ui';

export default function LoginPage() {
    const router = useRouter();
    const locale = useLocale();
    const supabase = createClient();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleLogin = async (event: React.FormEvent) => {
        event.preventDefault();
        setIsLoading(true);

        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) {
                addToast(error.message, 'error');
                return;
            }

            if (data.user) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', data.user.id)
                    .single();

                addToast('Login successful!', 'success');

                if (profile?.role === 'admin') {
                    router.push(`/${locale}/admin`);
                } else if (profile?.role === 'accountant') {
                    router.push(`/${locale}/admin/attendance`);
                } else {
                    router.push(`/${locale}/employee`);
                }

                router.refresh();
            }
        } catch {
            addToast('An unexpected error occurred', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen flex-col">
            <div className="flex flex-1 items-center justify-center px-4 py-12">
            <div className="w-full max-w-md space-y-6">
                {/* Logo */}
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

                {/* Form card */}
                <div className="rounded-3xl border border-[var(--line)] bg-[var(--surface-strong)] backdrop-blur-[24px] p-6 sm:p-8">
                    <div className="space-y-6">
                        <div className="space-y-1">
                            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">
                                Welcome back
                            </p>
                            <h1 className="text-3xl font-bold text-[var(--foreground)]">
                                Sign in to Amwag
                            </h1>
                        </div>

                        <form onSubmit={handleLogin} className="space-y-4">
                            <Input
                                id="email"
                                label="Email"
                                type="email"
                                placeholder="you@company.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                icon={<Mail className="h-4 w-4" />}
                                required
                                autoComplete="email"
                            />

                            <Input
                                id="password"
                                label="Password"
                                type="password"
                                placeholder="Enter your password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                icon={<Lock className="h-4 w-4" />}
                                required
                                autoComplete="current-password"
                            />

                            <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}>
                                <Button
                                    type="submit"
                                    className="w-full justify-between"
                                    size="lg"
                                    isLoading={isLoading}
                                >
                                    <span>Enter workspace</span>
                                    <ArrowRight className="h-4 w-4" />
                                </Button>
                            </motion.div>
                        </form>

                        <div className="relative overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 ps-5">
                            <div className="absolute inset-y-0 start-0 w-0.5 bg-[var(--accent)]" />
                            <p className="text-sm font-medium text-[var(--foreground-soft)]">Need access?</p>
                            <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                                Contact your administrator to get credentials or role updates.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

                <ToastContainer />
            </div>
            <Footer className="pb-3 pt-4" />
        </div>
    );
}
