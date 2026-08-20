import Navbar from '@/components/common/Navbar';
import Footer from '@/components/common/Footer';
import '@/globals.css';
//import '../globals.css';

export const metadata = {
  title: 'Portal Comercial Guairá',
  description: 'Directorio comercial e industrial del Guairá',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="bg-white text-slate-900 min-h-screen flex flex-col justify-between">
        <Navbar />
        <div className="flex-grow">{children}</div>
        <Footer />
      </body>
    </html>
  );
}