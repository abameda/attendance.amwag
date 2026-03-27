'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ArrowRight, Clock3, Lock, Mail, ShieldCheck, Sparkles } from 'lucide-react';
import { useLocale } from 'next-intl';
import Footer from '@/components/Footer';
import { createClient } from '@/lib/supabase/client';
import {
    Button,
    Card,
    CardContent,
    Input,
    PageReveal,
    StaggerGroup,
    StaggerItem,
    ToastContainer,
    addToast,
} from '@/components/ui';

const highlights = [
    {
        icon: ShieldCheck,
        title: 'Trusted access',
        description: 'Secure sign-in for admin, accounting, and employee workflows.',
    },
    {
        icon: Clock3,
        title: 'Live attendance',
        description: 'Check-ins, departures, and shift timing stay visible in one flow.',
    },
    {
        icon: Sparkles,
        title: 'Refined reporting',
        description: 'Daily summaries and exports keep operations sharp and reviewable.',
    },
];

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
        <div className="relative min-h-screen overflow-hidden px-4 py-6 sm:px-6 lg:px-8">
            <div className="pointer-events-none absolute inset-0">
                <div className="absolute left-[8%] top-[12%] h-40 w-40 rounded-full bg-rose-300/30 blur-3xl" />
                <div className="absolute bottom-[12%] right-[10%] h-56 w-56 rounded-full bg-amber-300/30 blur-3xl" />
                <div className="absolute inset-x-0 top-0 h-52 bg-gradient-to-b from-white/70 to-transparent" />
            </div>

            <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-6xl gap-6 lg:grid-cols-[1.12fr_0.88fr]">
                <PageReveal className="editorial-frame relative hidden overflow-hidden rounded-[2.6rem] p-8 lg:flex lg:flex-col lg:justify-between">
                    <div className="relative z-10 flex items-center gap-4">
                        <div className="relative h-16 w-16 rounded-[1.7rem] bg-[rgba(255,255,255,0.75)] p-3 shadow-[0_24px_50px_-28px_rgba(72,47,56,0.55)]">
                            <Image
                                src="/logo.png"
                                alt="Amwag Transportation"
                                fill
                                className="object-contain p-2"
                                priority
                            />
                        </div>
                        <div>
                            <p className="section-kicker">Amwag attendance</p>
                            <h1 className="display-serif mt-2 text-4xl text-[#1c171b]">
                                A more polished way to run the day.
                            </h1>
                        </div>
                    </div>

                    <div className="relative z-10 max-w-xl space-y-5">
                        <p className="text-lg leading-8 text-[#4d4347]">
                            From employee check-in to admin reporting, the workspace now feels
                            closer to an editorial operations desk than a default dashboard.
                        </p>

                        <div className="grid gap-4">
                            {highlights.map((highlight) => (
                                <div
                                    key={highlight.title}
                                    className="glass rounded-[1.8rem] p-5"
                                >
                                    <div className="flex items-start gap-4">
                                        <div className="rounded-2xl bg-[rgba(255,255,255,0.7)] p-3 text-[#9d174d] shadow-[0_18px_30px_-24px_rgba(157,23,77,0.5)]">
                                            <highlight.icon className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <h2 className="text-base font-semibold text-[#1f1a1e]">
                                                {highlight.title}
                                            </h2>
                                            <p className="mt-1 text-sm leading-6 text-[#665c61]">
                                                {highlight.description}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="relative z-10 flex items-end justify-between gap-4 text-sm text-[#5d5358]">
                        <div>
                            <p className="section-kicker">Designed for movement</p>
                            <p className="mt-2 max-w-sm leading-6">
                                Smooth motion, sharper hierarchy, and calmer surfaces across the
                                full attendance journey.
                            </p>
                        </div>
                        <div className="rounded-full border border-[rgba(66,42,50,0.12)] bg-white/70 px-4 py-2 font-medium text-[#241d22]">
                            Cairo operations
                        </div>
                    </div>
                </PageReveal>

                <PageReveal delay={0.08} className="flex items-center justify-center">
                    <div className="w-full max-w-xl">
                        <div className="mb-6 flex justify-center lg:hidden">
                            <div className="relative h-20 w-20 rounded-[1.8rem] bg-[rgba(255,255,255,0.85)] p-3 shadow-[0_24px_50px_-28px_rgba(72,47,56,0.55)]">
                                <Image
                                    src="/logo.png"
                                    alt="Amwag Transportation"
                                    fill
                                    className="object-contain p-2"
                                    priority
                                />
                            </div>
                        </div>

                        <Card className="rounded-[2.4rem] border-[rgba(66,42,50,0.08)] bg-[rgba(255,251,247,0.84)]">
                            <CardContent className="p-6 sm:p-8">
                                <StaggerGroup className="space-y-6">
                                    <StaggerItem className="space-y-3">
                                        <p className="section-kicker">Welcome back</p>
                                        <div className="space-y-2">
                                            <h2 className="display-serif text-4xl text-[#1c171b] sm:text-5xl">
                                                Sign in to Amwag Attendance
                                            </h2>
                                            <p className="max-w-lg text-sm leading-7 text-[#6b6064]">
                                                Access attendance tracking, employee workflows, and
                                                reporting from one refined workspace.
                                            </p>
                                        </div>
                                    </StaggerItem>

                                    <StaggerItem>
                                        <form onSubmit={handleLogin} className="space-y-5">
                                            <Input
                                                id="email"
                                                label="Email"
                                                type="email"
                                                placeholder="you@company.com"
                                                value={email}
                                                onChange={(event) => setEmail(event.target.value)}
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
                                                onChange={(event) => setPassword(event.target.value)}
                                                icon={<Lock className="h-4 w-4" />}
                                                required
                                                autoComplete="current-password"
                                            />

                                            <Button
                                                type="submit"
                                                className="w-full justify-between"
                                                size="lg"
                                                isLoading={isLoading}
                                            >
                                                <span>Enter workspace</span>
                                                <ArrowRight className="h-4 w-4" />
                                            </Button>
                                        </form>
                                    </StaggerItem>

                                    <StaggerItem className="rounded-[1.8rem] border border-[rgba(66,42,50,0.08)] bg-[rgba(255,255,255,0.52)] p-4">
                                        <p className="text-sm font-medium text-[#342c31]">
                                            Need access?
                                        </p>
                                        <p className="mt-1 text-sm leading-6 text-[#73666a]">
                                            Contact your administrator to get credentials or role
                                            updates.
                                        </p>
                                    </StaggerItem>
                                </StaggerGroup>
                            </CardContent>
                        </Card>
                    </div>
                </PageReveal>
            </div>

            <Footer className="relative z-10 pb-3 pt-6" />
            <ToastContainer />
        </div>
    );
}
