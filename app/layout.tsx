import { Analytics } from '@vercel/analytics/next'
import { Inter } from 'next/font/google'
import type { Metadata, Viewport } from 'next'
import { getCurrentLocale } from '@/lib/locale-server'
import { LanguageProvider } from './components/LanguageProvider'
import { LanguageToggle } from './components/LanguageToggle'
import './globals.css'
import './monochrome-overrides.css'

const inter = Inter({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Spotted AI · Attendance intelligence',
  description: 'A smarter attendance workspace for modern schools.',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
  colorScheme: 'light',
  themeColor: '#ffffff',
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const locale = await getCurrentLocale()

  return (
    <html lang={locale}>
      <body className={`${inter.variable} antialiased`}>
        <LanguageProvider initialLocale={locale}>
          {children}
          <LanguageToggle />
        </LanguageProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
