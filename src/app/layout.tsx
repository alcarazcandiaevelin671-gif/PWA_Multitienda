/**
 * [PÁGINA] Layout raíz de toda la app: fuente, script de apariencia (antes del primer pintado), carrito, barra superior, pie, mensajes, PWA y panel "Personalizar".
 */
import '@/frontend/styles/globals.css';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { CartProvider } from '@/frontend/context/CartContext';
import Navbar from '@/frontend/components/common/Navbar';
import Footer from '@/frontend/components/common/Footer';
import RealtimeNotificationListener from '@/frontend/components/common/RealtimeNotificationListener';
import AppMessageLayer from '@/frontend/components/ui/AppMessageLayer';
import ThemePreferenceSync from '@/frontend/components/configuracion/ThemePreferenceSync';
import PwaProvider from '@/frontend/components/pwa/PwaProvider';
import AppearanceDrawer from '@/frontend/components/apariencia/AppearanceDrawer';
import { APPEARANCE_BOOT_SCRIPT } from '@/shared/lib/appearance';
import type { Metadata, Viewport } from 'next';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-jakarta',
  // 'optional': sin repintado al llegar la fuente (mejora el LCP en celulares); se precarga y casi siempre llega a tiempo.
  display: 'optional',
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