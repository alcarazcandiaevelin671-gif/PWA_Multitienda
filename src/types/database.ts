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
  identificacion: string | null;
  correo_electronico: string | null;
  nombre_completo: string | null;
  telefono_contacto: string | null;
  rol: RolUsuario | null;
  activo: boolean | null;
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
      [_ in string]: never;
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
