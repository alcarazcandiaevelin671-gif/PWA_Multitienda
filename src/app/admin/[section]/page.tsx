import { notFound } from 'next/navigation';
import AdminRecordsPage from '../AdminRecordsPage';
import AdminReportsPage from '../AdminReportsPage';

const availableSections = new Set([
  'usuarios', 'comercios', 'productos', 'pedidos', 'pedido_detalles', 'pedido_estado_historial',
  'ventas', 'venta_detalles', 'facturas', 'factura_detalles',
  'categorias', 'departamentos', 'distritos', 'auditoria', 'auditorias', 'notificaciones',
  'reportes',
]);

export default function AdminSectionPage({ params }: { params: { section: string } }) {
  if (!availableSections.has(params.section)) notFound();
  if (params.section === 'reportes') return <AdminReportsPage />;
  return <AdminRecordsPage section={params.section} />;
}