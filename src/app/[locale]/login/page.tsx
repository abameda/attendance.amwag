'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { Button, Input, Card, CardContent, addToast, ToastContainer } from '@/components/ui';
import { LogIn } from 'lucide-react';
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
                // Fetch user profile to determine role
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', data.user.id)
                    .single();

                addToast('Login successful!', 'success');

                // Redirect based on role
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
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4">
            {/* Background decoration */}
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-teal-500/5 to-transparent rounded-full blur-3xl" />
                <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tl from-teal-500/5 to-transparent rounded-full blur-3xl" />
                {/* Grid pattern overlay */}
                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px]" />
            </div>

            <div className="w-full max-w-md relative z-10">
                {/* Logo */}
                <div className="flex justify-center mb-8">
                    <div className="relative w-32 h-32 bg-white/5 backdrop-blur-sm rounded-2xl p-4 border border-slate-800">
                        <Image
                            src="/logo.png"
                            alt="Amwag Transportation"
                            fill
                            className="object-contain p-2"
                            priority
                        />
                    </div>
                </div>

                <Card className="bg-slate-900/80 backdrop-blur-xl border-slate-800">
                    <CardContent className="p-8">
                        {/* Title */}
                        <div className="text-center mb-8">
                            <h1 className="text-2xl font-bold text-slate-50">
                                Amwag Attendance
                            </h1>
                            <p className="text-slate-400 mt-2">
                                Sign in to your account
                            </p>
                        </div>

                        {/* Login Form */}
                        <form onSubmit={handleLogin} className="space-y-5">
                            <Input
                                id="email"
                                label="Email Address"
                                type="email"
                                placeholder="you@company.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />

                            <Input
                                id="password"
                                label="Password"
                                type="password"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />

                            <Button
                                type="submit"
                                className="w-full"
                                size="lg"
                                isLoading={isLoading}
                            >
                                <LogIn className="w-5 h-5 mr-2" />
                                Sign In
                            </Button>
                        </form>

                        {/* Footer */}
                        <p className="text-center text-sm text-slate-500 mt-8">
                            Contact your administrator for account access
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Developer Signature */}
            <Footer className="absolute bottom-4 left-0 right-0 z-10" />

            <ToastContainer />
        </div>
    );
}
