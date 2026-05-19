import type { Metadata } from "next";
import { DM_Sans, Space_Grotesk } from "next/font/google";
import localFont from "next/font/local";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import "../globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-body",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
});

const arabicFont = localFont({
  src: [
    {
      path: "../../../public/fonts/Amiri-Regular.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../../public/fonts/Amiri-Bold.ttf",
      weight: "700",
      style: "normal",
    },
  ],
  display: "swap",
  variable: "--font-arabic",
});

export const metadata: Metadata = {
  title: "Amwag Attendance System",
  description: "Employee Attendance Management System for Amwag Transportation",
  keywords: ["attendance", "employee", "management", "transportation"],
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
};

export default async function RootLayout({
  children,
  params
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  // Ensure that the incoming `locale` is valid
  // In Next.js 15, params is a Promise and must be awaited
  const { locale } = await params;
  if (!['en', 'ar'].includes(locale)) {
    notFound();
  }

  // Providing all messages to the client
  // side is the easiest way to get started
  const messages = await getMessages();

  return (
    <html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'} suppressHydrationWarning>
      <body className={`${dmSans.variable} ${spaceGrotesk.variable} ${arabicFont.variable} bg-background text-foreground antialiased`}>
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
