import '../globals.css';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { CartProvider } from '@/context/CartContext';
import Navbar from '@/components/common/Navbar';
import Footer from '@/components/common/Footer';
import RealtimeNotificationListener from '@/components/common/RealtimeNotificationListener';
import AppMessageLayer from '@/components/ui/AppMessageLayer';
import ThemePreferenceSync from '@/components/configuracion/ThemePreferenceSync';
import PwaProvider from '@/components/pwa/PwaProvider';
import AppearanceDrawer from '@/components/apariencia/AppearanceDrawer';
import { APPEARANCE_BOOT_SCRIPT } from '@/lib/appearance';
import type { Metadata, Viewport } from 'next';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-jakarta',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Portal Guairá - Multitienda',
  description: 'Directorio Comercial del Guairá',
  manifest: '/manifest.webmanifest',
  applicationName: 'Portal Guairá',
  icons: { icon: '/icon.svg' },
  appleWebApp: { capable: true, title: 'Portal Guairá', statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  themeColor: '#db2777',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: el script de apariencia modifica <html> antes de que React hidrate.
    <html lang="es" className={jakarta.variable} suppressHydrationWarning>
      <head>
        {/* Aplica la personalización guardada antes del primer pintado (sin parpadeo de colores). */}
        <script dangerouslySetInnerHTML={{ __html: APPEARANCE_BOOT_SCRIPT }} />
      </head>
      <body className="bg-page min-h-screen font-sans text-slate-900 antialiased">
        <CartProvider>
          <ThemePreferenceSync />
          <AppearanceDrawer />
          <div className="flex min-h-screen flex-col">
            <Navbar />
            <RealtimeNotificationListener />
            <main className="min-w-0 w-full flex-1">
              {children}
            </main>
            <Footer />
            <AppMessageLayer />
            <PwaProvider />
          </div>
        </CartProvider>
      </body>
    </html>
  );
}