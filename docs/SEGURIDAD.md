# Seguridad — Portal Guairá Multitienda

Última auditoría: 19/11/2026.

## Alcance y marco de referencia

Este documento describe los **controles técnicos** implementados en la aplicación y en la base de
datos, y su correspondencia con:

- **OWASP Top 10 (2021)** y **OWASP ASVS 4.0** (nivel 1–2): verificación de seguridad de aplicaciones web.
- **ISO/IEC 27001:2022 / 27002:2022**, controles tecnológicos del Anexo A (sección 8).
- Principios de protección de datos personales (minimización, finalidad, acceso del titular).

> **Importante:** la conformidad con ISO/IEC 27001 es una **certificación de la organización**
> (sistema de gestión, análisis de riesgos, políticas, roles, auditorías internas y externas).
> El código puede implementar controles técnicos, pero no "certifica" el cumplimiento. Los
> requisitos organizativos están listados en [Pendientes de la organización](#pendientes-de-la-organización).
> IEEE no publica una norma de seguridad web aplicable a este sistema; las referencias técnicas
> de la industria son OWASP, NIST e ISO/IEC.

## Hallazgos de la auditoría y estado

| # | Severidad | Hallazgo | Estado |
|---|---|---|---|
| 1 | **Crítica** | Un cliente podía modificar su propia fila en `usuarios`, incluido `rol` (podía convertirse en administrador) y `activo`. Verificado con una actualización real. | ✅ Corregido y **verificado** (19/11): el intento de cambiar el rol se rechaza; editar nombre/teléfono sigue funcionando. |
| 2 | **Alta** | Cualquier usuario registrado podía subir cualquier archivo (HTML con scripts, ejecutables, sin límite de tamaño) a los buckets públicos `productos` y `tiendas-media`. Verificado (archivos de prueba borrados). | ✅ Corregido y **verificado**: HTML rechazado (415) y un cliente no puede subir ni imágenes (403). |
| 3 | Media | Un comerciante podía cambiar `estado`/`verificada`/plan de su tienda (auto-aprobación). | ✅ Corregido (trigger `proteger_campos_tienda`). |
| 4 | Media | El bucket `tiendas-media` permitía a anónimos listar todos los archivos. | ✅ Corregido y **verificado**. |
| 5 | Media | Sin encabezados de seguridad HTTP (CSP, HSTS, anti-clickjacking, etc.). | Corregido (`next.config.mjs`). |
| 6 | Media | Sin límite de peticiones en la API (fuerza bruta, registro masivo, abuso). | Corregido (`src/lib/rate-limit.ts` + middleware). |
| 7 | Media | Sin verificación de origen en peticiones que modifican datos (CSRF). | Corregido (middleware: se rechaza `Origin` de otro sitio con 403). |
| 8 | Media | Next.js 14 tiene vulnerabilidades publicadas (principalmente denegación de servicio). | **Pendiente:** requiere migrar a Next.js 16 (cambio mayor). Ver pendientes técnicos. |
| 9 | Media | Los correos no se verifican al registrarse (`mailer_autoconfirm = true`). | **Pendiente:** configuración en Supabase (ver pendientes). |
| 10 | Baja | Íconos del mapa cargados desde unpkg.com (tercero: cadena de suministro y filtración de IP). | Corregido: se sirven desde la propia app. |
| 11 | Baja | El contenido de las notificaciones se registraba en la consola del navegador. | Corregido. |
| 12 | Baja | `X-Powered-By: Next.js` revelaba la tecnología del servidor. | Corregido. |
| 13 | Baja | Funciones `SECURITY DEFINER` sin `search_path` fijo. | Corregido en la migración. |
| 15 | **Alta** | La función `notificar_a_todos_los_clientes` (creada desde el panel, no usada por la app) era ejecutable por cualquiera, incluso sin sesión: permitía notificaciones masivas. | Corregido en `20261119130000_restrict_definer_functions.sql`. **Requiere aplicar la migración.** |
| 14 | Info | La clave `service_role` se compartió fuera del repositorio (conversación de soporte). Nunca se subió a git (verificado en todo el historial; solo se subieron la URL y la clave anónima, que son públicas por diseño). | **Pendiente:** rotar la clave. |

Pruebas que **pasaron** en la auditoría (sin cambios necesarios):

- Lecturas con la clave anónima: solo el catálogo público (tiendas, productos, categorías, distritos).
- Aislamiento entre usuarios (RLS): un cliente solo ve sus propios pedidos, facturas, ventas, notificaciones y configuración.
- Un cliente o anónimo **no** puede modificar pedidos, facturas, tiendas, productos ni categorías ajenos.
- Inicio de sesión sin redirección abierta; API de administración con lista blanca de recursos.
- Una cookie de rol falsificada (rol cambiado o firma inventada) se rechaza.

## Controles implementados

| Control | Implementación | OWASP | ISO/IEC 27002:2022 |
|---|---|---|---|
| Autorización en la base de datos | RLS en todas las tablas; triggers que impiden cambiar `rol`, `activo`, `email`, estado de tienda y plan salvo administradores o servidor | A01 · ASVS V4 | 8.3 Restricción de acceso a la información |
| Autorización en la app | Middleware por ruta (`/admin`, `/vendedor`, privadas) + verificación en cada ruta API | A01 · ASVS V4.1 | 8.3, 5.15 Control de acceso |
| Autenticación | Supabase Auth; firma ES256 verificada localmente (`getClaims`); rol en cookie httpOnly firmada con HMAC-SHA256 y vida de 2 min | A07 · ASVS V2, V3 | 8.5 Autenticación segura |
| Gestión de sesión | Cookies `SameSite=Lax`, `httpOnly` para el rol, `Secure` en producción; cierre de sesión elimina cookies | ASVS V3 | 8.5 |
| Protección CSRF | Rechazo de `Origin` ajeno en métodos no seguros + cookies SameSite | A01 · ASVS V4.2.2 | 8.26 Requisitos de seguridad de aplicaciones |
| Anti-automatización | Límite por IP: registro 5/15 min, checkout 15/min, exportación de datos 5/h, API general 120/min | A04 · ASVS V11.1 | 8.6 Gestión de capacidad |
| Validación de entradas | Validación de tipos y rangos en checkout, configuración, sesión; consultas parametrizadas (PostgREST/RPC, sin SQL concatenado) | A03 · ASVS V5 | 8.28 Codificación segura |
| XSS | React escapa la salida; sin HTML de usuarios; CSP `script-src 'self'` bloquea scripts de terceros | A03 · ASVS V5.3 | 8.28 |
| Encabezados de seguridad | CSP, HSTS (2 años), `X-Frame-Options: DENY`, `frame-ancestors 'none'`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, COOP | A05 · ASVS V14.4 | 8.9 Gestión de la configuración |
| Archivos subidos | Solo imágenes (JPEG/PNG/WebP/GIF), máx. 5 MB, solo comerciantes/admin; avatares en carpeta propia | A04 · ASVS V12 | 8.3, 8.26 |
| Secretos | `.env.local` fuera de git; `service_role` solo en el servidor; nunca en el navegador | A02 · ASVS V6.4 | 8.24 Uso de criptografía |
| Cifrado en tránsito | HTTPS obligatorio (HSTS); Supabase solo por HTTPS/WSS | A02 · ASVS V9 | 8.24 |
| Registro de eventos | Tabla `auditorias`; cambios de rol/estado de cuentas se registran automáticamente | A09 · ASVS V7 | 8.15 Registro de eventos |
| Errores | Mensajes genéricos al usuario; detalle solo en el log del servidor | A05 · ASVS V7.4 | 8.15 |
| Datos personales | Exportación de datos del titular, desactivación de cuenta, datos privados borrados del dispositivo al cerrar sesión (modo offline) | — | 5.34 Privacidad y protección de DCP |
| Dependencias | `npm audit`; correcciones compatibles aplicadas | A06 · ASVS V14.2 | 8.8 Gestión de vulnerabilidades técnicas |

## Pendientes técnicos (prioridad)

1. ~~Aplicar `20261119120000_security_hardening.sql`~~ (aplicada y verificada el 19/11). **Aplicar `20261119130000_restrict_definer_functions.sql`**: el reporte final debe listar solo `categorias_mas_interactuadas`, `productos_mas_comprados` y `es_administrador_actual` (y otras funciones de solo lectura intencionales).
2. **Rotar la clave `service_role`** (Supabase → Project Settings → API → JWT keys / API keys) y actualizar `.env.local` y el servidor.
3. **Supabase → Authentication:**
   - Activar **Confirm email** (verificación de correo).
   - Contraseña mínima de **10+ caracteres** con letras y números, y **Leaked password protection** (HaveIBeenPwned).
   - **MFA (TOTP)** obligatorio para administradores.
   - Revisar *Rate limits* de Auth (inicio de sesión, envío de correos).
4. **Migrar a Next.js 16** para cerrar las vulnerabilidades publicadas de Next 14 (requiere React 19 y adaptar `cookies()` asíncrono). Hacerlo en una rama con pruebas.
5. En despliegues con **varias instancias o serverless**, reemplazar el limitador en memoria por uno compartido (Redis/Upstash).
6. Habilitar **copias de seguridad con recuperación a un punto en el tiempo (PITR)** en Supabase y probar una restauración.

## Pendientes de la organización

Requisitos de ISO/IEC 27001 y de protección de datos que no se resuelven con código:

- Política de seguridad de la información y de uso aceptable, aprobadas por la dirección.
- Análisis y tratamiento de riesgos; declaración de aplicabilidad (SoA).
- Responsable de seguridad y de protección de datos; roles y responsabilidades.
- **Política de privacidad y términos de uso** publicados en el sitio, con finalidad del tratamiento,
  derechos del titular (acceso, rectificación, cancelación, oposición) y canal de contacto.
- Consentimiento informado en el registro.
- Procedimiento de gestión de incidentes y de notificación de brechas.
- Gestión de accesos de administradores (altas, bajas, revisión periódica).
- Revisión periódica de dependencias y pruebas de penetración antes de cada versión mayor.
- Validar con asesoría legal la normativa paraguaya aplicable (p. ej. Ley N.° 1682/2001 de información
  de carácter privado y sus modificaciones, y Ley N.° 4017/2010 de mensajes de datos, ya referida en el sistema).

## Cómo volver a auditar

- Lecturas/escrituras anónimas y entre usuarios: repetir las pruebas de esta auditoría con la cuenta
  de prueba `TEST_CLIENT_EMAIL` (definida en `.env.local`).
- Encabezados: `curl -I https://<dominio>/` o securityheaders.com.
- Dependencias: `npm audit --omit=dev`.
- Base de datos: Supabase → Advisors → Security Advisor, y el reporte final de la migración de seguridad.
