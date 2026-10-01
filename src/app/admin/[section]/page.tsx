import { notFound, redirect } from 'next/navigation';
import AdminRecordsPage from '../AdminRecordsPage';

const availableSections = new Set([
  'usuarios', 'comercios', 'categorias', 'departamentos', 'distritos', 'auditoria', 'auditorias', 'notificaciones',
]);
const removedSections = new Set([
  'productos', 'pedidos', 'pedido_detalles', 'pedido_estado_historial',
  'ventas', 'venta_detalles', 'facturas', 'factura_detalles', 'reportes',
]);

export default function AdminSectionPage({ params }: { params: { section: string } }) {
  if (removedSections.has(params.section)) redirect('/admin');
  if (!availableSections.has(params.section)) notFound();
  return <AdminRecordsPage section={params.section} />;
}