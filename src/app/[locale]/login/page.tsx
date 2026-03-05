'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { Button, Input, Card, CardContent, addToast, ToastContainer } from '@/components/ui';
import { LogIn, Mail, Lock } from 'lucide-react';
import Footer from '@/components/Footer';

export default function LoginPage() {
    const router = useRouter();
    const supabase = createClient();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
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
                    router.push('/admin');
                } else if (profile?.role === 'accountant') {
                    router.push('/admin/attendance');
                } else {
                    router.push('/employee');
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
        <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4 relative">
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-teal-500/[0.04] rounded-full blur-[120px]" />
                <div className="absolute bottom-0 left-1/4 translate-y-1/2 w-[400px] h-[400px] bg-teal-600/[0.03] rounded-full blur-[100px]" />
                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:72px_72px]" />
            </div>

            <div className="w-full max-w-[400px] relative z-10 animate-fade-in-up">
                <div className="flex justify-center mb-10">
                    <div className="relative w-20 h-20 bg-slate-900/80 backdrop-blur-sm rounded-2xl p-3 border border-slate-800/60 shadow-xl shadow-black/20">
                        <Image
                            src="/logo.png"
                            alt="Amwag Transportation"
                            fill
                            className="object-contain p-2"
                            priority
                        />
                    </div>
                </div>

                <div className="text-center mb-8">
                    <h1 className="text-2xl font-bold text-slate-50 tracking-tight">
                        Welcome back
                    </h1>
                    <p className="text-slate-500 mt-1.5 text-sm">
                        Sign in to Amwag Attendance
                    </p>
                </div>

                <Card className="bg-slate-900/60 backdrop-blur-xl border-slate-800/60">
                    <CardContent className="p-6 sm:p-8">
                        <form onSubmit={handleLogin} className="space-y-5">
                            <Input
                                id="email"
                                label="Email"
                                type="email"
                                placeholder="you@company.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                icon={<Mail className="w-4 h-4" />}
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
                                icon={<Lock className="w-4 h-4" />}
                                required
                                autoComplete="current-password"
                            />

                            <Button
                                type="submit"
                                className="w-full mt-2"
                                size="lg"
                                isLoading={isLoading}
                            >
                                <LogIn className="w-4.5 h-4.5" />
                                Sign In
                            </Button>
                        </form>

                        <p className="text-center text-xs text-slate-600 mt-6">
                            Contact your administrator for account access
                        </p>
                    </CardContent>
                </Card>
            </div>

            <Footer className="absolute bottom-4 left-0 right-0 z-10" />

            <ToastContainer />
        </div>
    );
}
