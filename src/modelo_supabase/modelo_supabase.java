package modelo_supabase;

import java.util.List;

// 1. Departamentos
public class Departamento {
    public int id;
    public String nombre;
    public String codigo;
    public boolean activo;
    public String creado_en;
    
    public List<Distrito> distritos; // 1 a 0..*
}

// 2. Distritos
public class Distrito {
    public int id;
    public int departamento_id;
    public String nombre;
    public boolean activo;
    public String creado_en;
    
    public Departamento departamento; // 0..* a 1
    public List<Tienda> tiendas;     // 1 a 0..*
    public List<Pedido> pedidos;     // 1 a 0..*
    public List<HistorialBusqueda> historialBusquedas; // 1 a 0..*
}

// 3. Usuarios
public class Usuario {
    public String id;
    public String email;
    public String nombre_completo;
    public String telefono_contacto;
    public String rol;
    public boolean activo;
    public String creado_en;
    public String actualizado_en;

    // Relaciones directas (Multiplicidades corregidas)
    public Tienda tienda;                             // Un usuario puede gestionar 1 tienda (0..1)
    public List<Pedido> pedidos;                      // 1 usuario realiza 0..* pedidos
    public List<Venta> ventas;                        // 1 usuario registra 0..* ventas
    public List<Favorito> favoritos;                  // 1 usuario tiene 0..* favoritos
    public List<RecomendacionIa> recomendaciones;    // 1 usuario recibe 0..* recomendaciones
    public List<Notificacion> notificaciones;         // 1 usuario recibe 0..* notificaciones
    public List<InteraccionClic> interacciones;       // 1 usuario realiza 0..* clics
    public List<HistorialBusqueda> historialBusquedas;// 1 usuario tiene 0..* búsquedas
    public List<Auditoria> auditorias;                // 1 usuario genera 0..* auditorías

    public void registrar() {}
    public void iniciarSesion() {}
    public void actualizarPerfil() {}
}

// 4. Tiendas
public class Tienda {
    public String id;
    public String usuario_id;
    public int distrito_id;
    public String nombre_comercio;
    public String slug;
    public String descripcion;
    public String categoria_principal;
    public String estado;
    public boolean verificada;

    // Relaciones
    public Usuario usuario;                 // 1 tienda pertenece obligatoriamente a 1 usuario (1..1)
    public Distrito distrito;               // 1 tienda pertenece a 1 distrito (1..1)
    public List<Producto> productos;        // 1 tienda ofrece 1..* productos
    public List<Pedido> pedidos;            // 1 tienda recibe 0..* pedidos
    public List<Venta> ventas;              // 1 tienda registra 0..* ventas
    public List<Suscripcion> suscripciones; // 1 tienda tiene 0..* suscripciones
    public List<Favorito> favoritos;        // 1 tienda está en 0..* favoritos
    public List<Factura> facturas;          // 1 tienda emite 0..* facturas
    public List<InteraccionClic> clics;     // 1 tienda recibe 0..* clics

    public void crearTienda() {}
    public void actualizarCatalogo() {}
    public float calcularDistancia(float latUsuario, float lonUsuario) { return 0; }
}

// 5. Categorías
public class Categoria {
    public int id;
    public String nombre;
    public String descripcion;
    public String icono;
    public boolean activo;
    public String creado_en;

    public List<Producto> productos;                  // 1 categoría clasifica 0..* productos
    public List<HistorialBusqueda> historialBusquedas;// 1 categoría asociada a 0..* búsquedas

    public void obtenerProductos() {}
}

// 6. Productos
public class Producto {
    public String id;
    public String tienda_id;
    public int categoria_id;
    public String titulo;
    public String descripcion;
    public double precio_gs;
    public String imagen_url;
    public boolean disponible;
    public boolean destacado;
    public int vistas_count;

    // Relaciones
    public Tienda tienda;                             // 1 producto pertenece obligatoriamente a 1 tienda (1..1)
    public Categoria categoria;                       // 1 producto pertenece a 0..1 categoría
    public List<PedidoDetalle> pedidoDetalles;        // 1 producto está en 1..* detalles de pedido
    public List<VentaDetalle> ventaDetalles;          // 1 producto está en 0..* detalles de venta
    public List<FacturaDetalle> facturaDetalles;      // 1 producto está en 0..* detalles de factura
    public List<RecomendacionIa> recomendaciones;     // 1 producto recibe 0..* recomendaciones IA
    public List<ProductoTag> productoTags;            // 1 producto tiene 0..* tags
    public List<Favorito> favoritos;                  // 1 producto está en 0..* favoritos
    public List<InteraccionClic> clics;               // 1 producto recibe 0..* clics

    public void actualizarStock() {}
    public void obtenerRecomendacionesRelacionadas() {}
}

// 7. Tags IA
public class TagIa {
    public int id;
    public String nombre;
    public List<ProductoTag> productoTags;
}

// 8. Producto Tags (Tabla Intermedia)
public class ProductoTag {
    public String producto_id;
    public int tag_id;

    public Producto producto;
    public TagIa tag;
}

// 9. Planes de Suscripción
public class PlanSuscripcion {
    public int id;
    public String nombre;
    public double precio_gs;
    public int duracion_dias;
    public int limite_productos;
    public boolean activo;

    public List<Suscripcion> suscripciones;
}

// 10. Suscripciones
public class Suscripcion {
    public String id;
    public String tienda_id;
    public int plan_id;
    public double monto_pagado;
    public String estado;

    public Tienda tienda;
    public PlanSuscripcion plan;
}

// 11. Pedidos
public class Pedido {
    public String id;
    public String usuario_id;
    public String tienda_id;
    public String numero_pedido;
    public String estado;
    public double total;

    public Usuario usuario;
    public Tienda tienda;
    public Distrito distrito;
    public List<PedidoDetalle> detalles;
    public List<PedidoEstadoHistorial> historialEstados;
    public Venta venta; // 1 pedido genera 0..1 venta
    public Factura factura; // 1 pedido genera 0..1 factura

    public String generarMensajeWhatsApp() { return ""; }
    public void cambiarEstado() {}
}

// 12. Pedido Detalle
public class PedidoDetalle {
    public String id;
    public String pedido_id;
    public String producto_id;
    public int cantidad;
    public double precio;
    public double subtotal;

    public Pedido pedido;       // 1 detalle pertenece a 1 pedido (1..1)
    public Producto producto;   // 1 detalle referencia a 1 producto (1..1)
}

// 13. Pedido Estado Historial
public class PedidoEstadoHistorial {
    public String id;
    public String pedido_id;
    public String estado_anterior;
    public String estado_nuevo;

    public Pedido pedido;
}

// 14. Ventas
public class Venta {
    public String id;
    public String pedido_id;
    public String tienda_id;
    public String cliente_id;
    public double total;

    public Pedido pedido;
    public Tienda tienda;
    public Usuario cliente;
    public List<VentaDetalle> detalles;
    public Factura factura;
}

// 15. Venta Detalle
public class VentaDetalle {
    public String id;
    public String venta_id;
    public String producto_id;
    public int cantidad;

    public Venta venta;
    public Producto producto;
}

// 16. Facturas
public class Factura {
    public String id;
    public String venta_id;
    public String pedido_id;
    public String tienda_id;
    public String cliente_id;
    public double total;

    public Venta venta;
    public Pedido pedido;
    public Tienda tienda;
    public Usuario cliente;
    public List<FacturaDetalle> detalles;
}

// 17. Factura Detalle
public class FacturaDetalle {
    public String id;
    public String factura_id;
    public String producto_id;
    public int cantidad;

    public Factura factura;
    public Producto producto;
}

// 18. Recomendación IA
public class RecomendacionIa {
    public String id;
    public String usuario_id;
    public String producto_id;
    public double puntuacion;
    public String motivo;

    public Usuario usuario;
    public Producto producto;
}

// 19. Favoritos
public class Favorito {
    public String id;
    public String usuario_id;
    public String tienda_id;
    public String producto_id;

    public Usuario usuario;
    public Tienda tienda;
    public Producto producto;
}

// 20. Interacciones Clics
public class InteraccionClic {
    public long id;
    public String usuario_id;
    public String tienda_id;
    public String producto_id;
    public String tipo;

    public Usuario usuario;
    public Tienda tienda;
    public Producto producto;
}

// 21. Historial de Búsquedas
public class HistorialBusqueda {
    public long id;
    public String usuario_id;
    public String termino;
    public int distrito_id;
    public int categoria_id;

    public Usuario usuario;
    public Distrito distrito;
    public Categoria categoria;
}

// 22. Notificaciones
public class Notificacion {
    public String id;
    public String usuario_id;
    public String mensaje;
    public boolean leida;

    public Usuario usuario;
}

// 23. Auditorías
public class Auditoria {
    public long id;
    public String usuario_id;
    public String accion;
    public String tabla_afectada;

    public Usuario usuario;
}