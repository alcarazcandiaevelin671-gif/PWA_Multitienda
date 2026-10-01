import '../globals.css';
import { CartProvider } from '@/context/CartContext';
import Navbar from '@/components/common/Navbar';
import Footer from '@/components/common/Footer';
import AppMessageLayer from '@/components/ui/AppMessageLayer';
import ThemePreferenceSync from '@/components/configuracion/ThemePreferenceSync';

export const metadata = {
  title: 'Portal Guairá - Multitienda',
  description: 'Directorio Comercial del Guairá',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-[radial-gradient(circle_at_top,_#eff6ff_0%,_#f8fafc_35%,_#f1f5f9_100%)] text-slate-900 antialiased">
        <CartProvider>
          <ThemePreferenceSync />
          <div className="flex min-h-screen flex-col">
            <Navbar />
            <main className="min-w-0 w-full flex-1">
              {children}
            </main>
            <Footer />
            <AppMessageLayer />
          </div>
        </CartProvider>
      </body>
    </html>
  );
}