export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type TipoInteraccion = 'vista' | 'click' | 'favorito' | 'compra' | 'contacto';
export type EstadoPago = 'pendiente' | 'pagado' | 'cancelado' | 'vencido' | 'reembolsado';
export type RolUsuario = 'vendedor' | 'cliente' | 'administrador';
export type EstadoPedido = 'pendiente' | 'confirmado' | 'en_preparacion' | 'listo' | 'completado' | 'cancelado';
export type MetodoPagoPedido = 'efectivo' | 'transferencia';

export interface Pedido {
  id: string;
  usuario_id: string | null;
  tienda_id: string;
  numero_pedido: string;
  estado: EstadoPedido | string;
  subtotal: number;
  descuento: number;
  envio: number;
  total: number;
  metodo_pago: MetodoPagoPedido | string;
  estado_pago: string;
  direccion_entrega: string;
  distrito_id: number | null;
  latitud: number | null;
  longitud: number | null;
  notas: string | null;
  created_at: string;
  updated_at: string;
}

export interface PedidoDetalle {
  id: string;
  pedido_id: string;
  producto_id: string | null;
  cantidad: number;
  precio: number;
  descuento: number;
  subtotal: number;
  nombre_producto_snapshot: string;
  descripcion_snapshot: string | null;
  created_at: string;
}

export interface PedidoEstadoHistorial {
  id: string;
  pedido_id: string;
  estado_anterior: string | null;
  estado_nuevo: string;
  observacion: string | null;
  created_at: string;
}

export interface Venta {
  id: string;
  pedido_id: string;
  tienda_id: string;
  cliente_id: string | null;
  numero_venta: string;
  subtotal: number;
  descuento: number;
  total: number;
  metodo_pago: string;
  estado: string;
  created_at: string;
  updated_at: string;
}

export interface VentaDetalle {
  id: string;
  venta_id: string;
  producto_id: string | null;
  cantidad: number;
  precio: number;
  descuento: number;
  subtotal: number;
  nombre_producto_snapshot: string;
  descripcion_snapshot: string | null;
  created_at: string;
}

export interface FacturaInterna {
  id: string;
  venta_id: string;
  pedido_id: string;
  tienda_id: string;
  cliente_id: string | null;
  tipo_documento: string;
  numero: string;
  estado: string;
  fecha: string;
  moneda: string;
  subtotal: number;
  descuento: number;
  total: number;
  iva: number;
  created_at: string;
  updated_at: string;
}

export interface FacturaDetalle {
  id: string;
  factura_id: string;
  producto_id: string | null;
  cantidad: number;
  precio: number;
  descuento: number;
  subtotal: number;
  descripcion_snapshot: string;
  created_at: string;
}

export interface CheckoutCreatedRecords {
  pedido_id: string;
  numero_pedido: string;
  venta_id: string;
  factura_id: string;
}

export interface CheckoutConfirmation {
  pedido: Pick<Pedido, 'id' | 'numero_pedido' | 'estado'>;
  registros: CheckoutCreatedRecords;
}

export interface CheckoutInput {
  tienda_id: string;
  items: Array<{ producto_id: string; cantidad: number }>;
  metodo_pago: MetodoPagoPedido;
  direccion_entrega: string;
  distrito_id?: number | null;
  latitud?: number | null;
  longitud?: number | null;
  notas?: string | null;
}

export interface Auditoria {
  id: number | null;
  usuario_id: string | null;
  accion: string | null;
  tabla_afectada: string | null;
  registro_id: string | null;
  datos_anteriores: Json | null;
  datos_nuevos: Json | null;
  fecha_hora: string | null;
}

export interface Categoria {
  id: number | null;
  nombre: string | null;
  descripcion: string | null;
  icono: string | null;
  activo: boolean | null;
  creado_en: string | null;
}

export interface Comercio {
  id: string | null;
  nombre: string | null;
  descripcion: string | null;
  direccion: string | null;
  telefono: string | null;
  categoria: string | null;
  ubicacion: unknown | null;
  creado_en: string | null;
}

export interface Departamento {
  id: number | null;
  nombre: string | null;
  codigo: string | null;
  activo: boolean | null;
  creado_en: string | null;
}

export interface Distrito {
  id: number | null;
  departamento_id: number | null;
  nombre: string | null;
  activo: boolean | null;
  creado_en: string | null;
}

export interface Favorito {
  id: string | null;
  usuario_id: string | null;
  tienda_id: string | null;
  producto_id: string | null;
  creado_en: string | null;
}

export interface HistorialBusqueda {
  id: number | null;
  usuario_id: string | null;
  termino: string | null;
  distrito_id: number | null;
  categoria_id: number | null;
  fecha_hora: string | null;
}

export interface InteraccionClick {
  id: number | null;
  usuario_id: string | null;
  tienda_id: string | null;
  producto_id: string | null;
  tipo: TipoInteraccion | null;
  fecha_hora: string | null;
}

export interface PlanSuscripcion {
  id: number | null;
  nombre: string | null;
  descripcion: string | null;
  precio_gs: number | string | null;
  duracion_dias: number | null;
  limite_productos: number | null;
  destacado: boolean | null;
  activo: boolean | null;
  creado_en: string | null;
  actualizado_en: string | null;
}

export interface ProductoTag {
  producto_id: string | null;
  tag_id: number | null;
}

export interface Producto {
  id: string | null;
  tienda_id: string | null;
  categoria_id: number | null;
  titulo: string | null;
  descripcion: string | null;
  precio_gs: number | string | null;
  imagen_url: string | null;
  disponible: boolean | null;
  destacado: boolean | null;
  vistas_count: number | null;
  creado_en: string | null;
  actualizado_en: string | null;
}

export interface RecomendacionIa {
  id: string | null;
  usuario_id: string | null;
  producto_id: string | null;
  puntuacion: number | string | null;
  motivo: string | null;
  creado_en: string | null;
}

export interface Suscripcion {
  id: string | null;
  tienda_id: string | null;
  plan_id: number | null;
  monto_pagado: number | string | null;
  metodo_pago: string | null;
  comprobante_url: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  estado: EstadoPago | null;
  notas_admin: string | null;
  creado_en: string | null;
  actualizado_en: string | null;
}

export interface TagIa {
  id: number | null;
  nombre: string | null;
  creado_en: string | null;
}

export interface Tienda {
  id: string | null;
  usuario_id: string | null;
  distrito_id: number | null;
  nombre_comercio: string | null;
  slug: string | null;
  descripcion: string | null;
}

export interface Usuario {
  id: string;
  email: string;
  nombre_completo: string;
  telefono_contacto: string | null;
  rol: RolUsuario;
  activo: boolean;
  creado_en: string;
  actualizado_en: string;
}

export type Database = {
  public: {
    Tables: {
      auditorias: {
        Row: Auditoria;
        Insert: Partial<Auditoria>;
        Update: Partial<Auditoria>;
      };
      categorias: {
        Row: Categoria;
        Insert: Partial<Categoria>;
        Update: Partial<Categoria>;
      };
      comercios: {
        Row: Comercio;
        Insert: Partial<Comercio>;
        Update: Partial<Comercio>;
      };
      departamentos: {
        Row: Departamento;
        Insert: Partial<Departamento>;
        Update: Partial<Departamento>;
      };
      distritos: {
        Row: Distrito;
        Insert: Partial<Distrito>;
        Update: Partial<Distrito>;
      };
      favoritos: {
        Row: Favorito;
        Insert: Partial<Favorito>;
        Update: Partial<Favorito>;
      };
      historial_busquedas: {
        Row: HistorialBusqueda;
        Insert: Partial<HistorialBusqueda>;
        Update: Partial<HistorialBusqueda>;
      };
      interacciones_clics: {
        Row: InteraccionClick;
        Insert: Partial<InteraccionClick>;
        Update: Partial<InteraccionClick>;
      };
      planes_suscripcion: {
        Row: PlanSuscripcion;
        Insert: Partial<PlanSuscripcion>;
        Update: Partial<PlanSuscripcion>;
      };
      pedidos: {
        Row: Pedido;
        Insert: Partial<Pedido>;
        Update: Partial<Pedido>;
      };
      pedido_detalles: {
        Row: PedidoDetalle;
        Insert: Partial<PedidoDetalle>;
        Update: Partial<PedidoDetalle>;
      };
      pedido_estado_historial: {
        Row: PedidoEstadoHistorial;
        Insert: Partial<PedidoEstadoHistorial>;
        Update: Partial<PedidoEstadoHistorial>;
      };
      ventas: {
        Row: Venta;
        Insert: Partial<Venta>;
        Update: Partial<Venta>;
      };
      venta_detalles: {
        Row: VentaDetalle;
        Insert: Partial<VentaDetalle>;
        Update: Partial<VentaDetalle>;
      };
      facturas: {
        Row: FacturaInterna;
        Insert: Partial<FacturaInterna>;
        Update: Partial<FacturaInterna>;
      };
      factura_detalles: {
        Row: FacturaDetalle;
        Insert: Partial<FacturaDetalle>;
        Update: Partial<FacturaDetalle>;
      };
      producto_tags: {
        Row: ProductoTag;
        Insert: Partial<ProductoTag>;
        Update: Partial<ProductoTag>;
      };
      productos: {
        Row: Producto;
        Insert: Partial<Producto>;
        Update: Partial<Producto>;
      };
      recomendaciones_ia: {
        Row: RecomendacionIa;
        Insert: Partial<RecomendacionIa>;
        Update: Partial<RecomendacionIa>;
      };
      suscripciones: {
        Row: Suscripcion;
        Insert: Partial<Suscripcion>;
        Update: Partial<Suscripcion>;
      };
      tags_ia: {
        Row: TagIa;
        Insert: Partial<TagIa>;
        Update: Partial<TagIa>;
      };
      tiendas: {
        Row: Tienda;
        Insert: Partial<Tienda>;
        Update: Partial<Tienda>;
      };
      usuarios: {
        Row: Usuario;
        Insert: Partial<Usuario>;
        Update: Partial<Usuario>;
      };
    };
    Views: Record<string, never>;
    Functions: {
      crear_pedido_checkout: {
        Args: {
          p_tienda_id: string;
          p_items: Json;
          p_metodo_pago: string;
          p_direccion_entrega: string;
          p_distrito_id?: number | null;
          p_latitud?: number | null;
          p_longitud?: number | null;
          p_notas?: string | null;
        };
        Returns: string;
      };
      procesar_checkout_pedido_venta_factura: {
        Args: {
          p_tienda_id: string;
          p_items: Json;
          p_metodo_pago: string;
          p_direccion_entrega: string;
          p_distrito_id?: number | null;
          p_latitud?: number | null;
          p_longitud?: number | null;
          p_notas?: string | null;
        };
        Returns: CheckoutCreatedRecords;
      };
      obtener_pedidos_mis_tiendas: {
        Args: Record<PropertyKey, never>;
        Returns: Pedido[];
      };
    };
    Enums: {
      estado_pago: EstadoPago;
      tipo_interaccion: TipoInteraccion;
    };
    CompositeTypes: {
      [_ in string]: never;
    };
  };
};
