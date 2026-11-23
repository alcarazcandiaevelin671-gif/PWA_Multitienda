# Ofertas, stock y logs de auditoría

Migración: `supabase/migrations/20261123120000_ofertas_stock_auditoria.sql` (ya aplicada en producción).

## Ofertas

- El vendedor activa **"Poner en oferta"** al crear un producto, o con ✏️ **Editar** en la lista.
- La oferta debe ser **mayor a 0 y menor al precio normal**. La app lo valida, y la base también, con la restricción `productos_precio_oferta_check`.
- En la tienda, el buscador, los favoritos, las recomendaciones, el carrito y el checkout se ve:
  - el precio anterior tachado arriba;
  - el precio de oferta en rojo;
  - una insignia `-X%`.

  Componente: `src/frontend/components/products/PriceTag.tsx`. Cálculo: `src/shared/lib/product-pricing.ts`.

## Stock

| Campo | Significado |
|---|---|
| `stock` | Unidades disponibles. **Vacío (NULL) = no se controla stock** (como antes). |
| `stock_minimo` | Con esta cantidad o menos se avisa al vendedor (por defecto 5). |
| `oculto_por_stock` | `true` si la base ocultó el producto al llegar a 0. |

Todo lo automático lo hace la **base de datos**, así funciona igual desde la app, la API o SQL:

| Situación | Qué pasa | Aviso al vendedor |
|---|---|---|
| El stock baja al mínimo o menos | — | 🔔 "Quedan pocas unidades" |
| El stock llega a 0 | El producto se **oculta** (`disponible = false`) | 🔔 "Producto agotado" |
| Se repone stock | Si se había ocultado por stock, **vuelve a mostrarse** | 🔔 "Producto visible otra vez" |
| Un cliente compra | Se **descuenta** el stock; si no alcanza, el pedido se rechaza con un mensaje claro | — |
| Se cancela un pedido | Se **devuelve** el stock | — |

Si el vendedor oculta un producto a mano, la reposición de stock no lo vuelve a mostrar.

En la vitrina aparece "🔥 ¡Últimas N unidades!" cuando el stock llega al mínimo. El carrito no deja pedir más unidades de las que hay.

## Logs de auditoría (Administración → Logs de sistema)

Cada cambio queda registrado en `auditorias` por triggers de la base:

| Tipo (`operacion`) | Qué registra | Trigger |
|---|---|---|
| `INSERT` | Registros creados | `zz_auditoria_fila` (en las 23 tablas de `public`) |
| `UPDATE` | Registros modificados (solo si cambió algo real) | `zz_auditoria_fila` |
| `DELETE` | Registros borrados | `zz_auditoria_fila` |
| `TRUNCATE` | Tablas vaciadas | `zz_auditoria_truncate` |
| `DDL` | `CREATE`, `ALTER`, `DROP` de tablas, funciones, etc. | Event triggers `auditoria_ddl_fin` y `auditoria_ddl_borrado` |
| `APP` | Acciones registradas por la aplicación (historial anterior) | — |

Cada log guarda:

- **Quién:** `usuario_id`, `usuario_email`, `usuario_rol` (rol en la app) y `rol_bd` (rol de Postgres).
- **Qué:** `accion`, `tabla_afectada`, `registro_id`, `objeto` y `campos_modificados`.
- **Antes y después:** `datos_anteriores` y `datos_nuevos`.
- **Cuándo:** `fecha_hora`.
- **Desde dónde:**
  - `ip`: IP de conexión;
  - `ip_cliente`: IP real del visitante cuando la operación pasa por el servidor de la app;
  - `user_agent`;
  - `metodo_http` y `ruta`;
  - `origen`: `app` (navegador), `servidor` o `sql`.
- **Comando:** `comando_sql`, solo en los cambios de estructura.

La pantalla permite:

- filtrar por tipo con botones que muestran el total de cada uno;
- filtrar por tabla, correo del usuario, origen, IP y rango de fechas;
- buscar texto libre.

"Ver detalle" muestra todo lo anterior, con la tabla de antes y después.

API: `GET /api/admin/auditorias?operacion=UPDATE&tabla=productos&usuario=correo&origen=app&ip=1.2.3.4&desde=2026-11-01&hasta=2026-11-30&q=texto`.

**Mantenimiento:** los logs crecen con cada cambio. Para borrar los de más de un año:

```sql
SELECT public.auditoria_limpiar(365);
```

Un error al registrar un log nunca bloquea la operación del usuario: solo deja una advertencia en el registro de Postgres.
