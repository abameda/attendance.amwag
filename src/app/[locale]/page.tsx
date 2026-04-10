// Force dynamic rendering because this page reads the session cookie.
export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';

import { readSessionCookie } from '@/lib/auth/cookies';
import { getSessionByToken } from '@/lib/auth/session';

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const token = await readSessionCookie();
  const session = token ? await getSessionByToken(token) : null;

  if (!session) {
    redirect(`/${locale}/login`);
  }

  if (session.user.mustChangePassword === 1) {
    redirect(`/${locale}/change-password`);
  }

  if (session.user.role === 'admin') {
    redirect(`/${locale}/admin`);
  }

  if (session.user.role === 'accountant') {
    redirect(`/${locale}/admin/attendance`);
  }

  redirect(`/${locale}/employee`);
}
