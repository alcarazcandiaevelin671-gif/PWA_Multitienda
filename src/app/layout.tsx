import '../globals.css';
import { CartProvider } from '@/context/CartContext';
import Navbar from '@/components/common/Navbar';
import Footer from '@/components/common/Footer';

export const metadata = {
  title: 'Portal Guairá - Multitienda',
  description: 'Directorio Comercial del Guairá',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="bg-slate-50 text-slate-900 antialiased min-h-screen flex flex-col justify-between">
        <CartProvider>
          <Navbar />
          <main className="flex-1">
            {children}
          </main>
          <Footer />
        </CartProvider>
      </body>
    </html>
  );
}