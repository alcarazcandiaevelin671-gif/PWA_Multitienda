# Copias de seguridad de la base de datos

Las copias se hacen **automáticamente todos los días a las 04:00 (hora de Paraguay)** con
GitHub Actions, se **verifican restaurándolas** en una base vacía y se guardan **cifradas
durante 30 días**. Si una copia o su verificación falla, el workflow queda en rojo y GitHub
envía un correo.

> El plan gratuito de Supabase no ofrece copias descargables. Este sistema funciona en
> cualquier plan. Si más adelante se pasa a Pro, conviene activar además **PITR**
> (recuperación a un punto en el tiempo) en Supabase → Database → Backups.

## Qué incluye cada copia

| Archivo (dentro de la copia) | Contenido |
|---|---|
| `public.dump` | Toda la app: tablas, datos, funciones, triggers, políticas RLS y permisos |
| `auth_data.dump` | Cuentas: `auth.users` (incluye contraseñas cifradas), `auth.identities` (Google), `auth.mfa_factors` |
| `storage_data.dump` | Registro de archivos: `storage.buckets`, `storage.objects` |
| `auth_schema.dump`, `storage_schema.dump` | Estructura de auth y storage (solo para restaurar fuera de Supabase) |
| `extras.sql` | Trigger que crea el perfil al registrarse, políticas de Storage, configuración de buckets |
| `manifest.txt` | Filas por tabla y cantidad de políticas, funciones y triggers al momento de la copia |

Todo se comprime y se cifra con **AES-256** (`openssl`, PBKDF2 con 200.000 iteraciones),
porque contiene datos personales y contraseñas cifradas de los usuarios. Junto a cada copia se
guarda su suma **SHA-256** para detectar archivos dañados.

**No incluye** los archivos de imágenes (logos, portadas, productos): viven en el
almacenamiento de objetos de Supabase, no en Postgres. La copia guarda su **registro**
(qué archivo pertenece a qué bucket).

## Configuración (una sola vez)

1. **GitHub → el repositorio → Settings → Secrets and variables → Actions → New repository secret**:
   - `SUPABASE_DB_URL`: el valor de `SUPABASE_DB_URL` de `.env.local`
     (Supabase → Connect → **Session pooler**, con la contraseña de la base).
   - `BACKUP_PASSPHRASE`: el valor de `BACKUP_PASSPHRASE` de `.env.local`.
2. Guarda también `BACKUP_PASSPHRASE` **fuera de la computadora** (gestor de contraseñas o papel
   en un lugar seguro). **Sin esa clave las copias no se pueden abrir.**
3. El archivo `.github/workflows/db-backup.yml` debe estar en la rama **principal (`main`)**:
   GitHub solo ejecuta los workflows programados desde la rama principal.

## Uso

- **Copia manual:** GitHub → Actions → "Copia de seguridad de la base de datos" → **Run workflow**.
- **Descargar una copia:** abre una ejecución en verde → sección **Artifacts** → `copia-db-N`.
- **Prueba completa en tu PC** (copia real + restauración en un PostgreSQL temporal que se
  borra al terminar):
  ```bash
  bash scripts/backup/test-local.sh
  ```
  Requiere PostgreSQL instalado (por defecto `C:\Program Files\PostgreSQL\18`, o define `PG_BIN`).
  Sin PostGIS se usa el *modo compatible*: la columna geográfica se restaura como texto y se
  comparan igual todas las filas. GitHub Actions hace la verificación completa con PostGIS.

## Cómo se verifica que la copia sirve

`scripts/backup/verify-restore.sh`:

1. comprueba la suma SHA-256 y descifra la copia;
2. crea una base **vacía y aislada** (`restore_check`) en un servidor de prueba;
3. restaura auth, storage, la app y los extras;
4. compara cada tabla y los objetos críticos con `manifest.txt`;
5. termina con error si falta **una sola fila**, una política, una función o un trigger.

### Resultados de las pruebas (20/11/2026, Postgres 17.6)

| Prueba | Resultado |
|---|---|
| Copia real de producción y restauración | ✅ Válida: 33/33 comprobaciones (29 tablas, 85 políticas RLS, 27 funciones, 19 triggers, 24 tablas con RLS) |
| Clave de cifrado equivocada | ✅ Detectado: "No se pudo descifrar" |
| Archivo dañado (1 byte cambiado) | ✅ Detectado: "La suma SHA-256 no coincide" |
| Copia incompleta (falta 1 fila de `pedidos`) | ✅ Detectado: "public.pedidos esperado 9, restaurado 8" |

## Restaurar ante una pérdida de datos

> Haz esto con calma y, si es posible, primero en un **proyecto Supabase nuevo** para comprobar
> los datos antes de tocar el original. Nunca restaures encima de producción sin una copia
> reciente de lo que hay ahora.

1. **Descarga y descifra** la copia elegida (Git Bash):
   ```bash
   openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -in pwa-multitienda-db-XXXX.tar.gz.enc -out copia.tar.gz
   tar -xzf copia.tar.gz && cd pwa-multitienda-db-XXXX
   ```
2. **Destino:** crea un proyecto Supabase nuevo (o usa el original vacío) y copia su cadena del
   **Session pooler** en `DESTINO`. Activa la extensión **postgis** (Database → Extensions).
3. **Restaura en este orden** (las cuentas primero, porque la app depende de ellas):
   ```bash
   export PGOPTIONS='-c session_replication_role=replica'   # no disparar triggers mientras se cargan datos
   pg_restore --no-owner --data-only -d "$DESTINO" auth_data.dump
   pg_restore --no-owner -d "$DESTINO" public.dump          # el aviso "schema public already exists" es normal
   pg_restore --no-owner --data-only -d "$DESTINO" storage_data.dump
   unset PGOPTIONS
   psql "$DESTINO" -f extras.sql
   ```
4. **Comprueba** que las cantidades coincidan con `manifest.txt`:
   `psql "$DESTINO" -At -f ../scripts/backup/manifest.sql`
5. **Archivos de Storage:** súbelos de nuevo a los buckets (o cópialos desde el proyecto
   original si sigue disponible).
6. Si es un proyecto nuevo, actualiza en `.env.local` y en el hosting la URL y las claves
   (publishable y secret) del proyecto restaurado.

## Retención y costos

- Se conservan las copias de los **últimos 30 días** (artifacts de GitHub Actions).
- Cada copia pesa ~100 KB hoy; el uso de GitHub Actions es de pocos minutos por día, dentro del
  límite gratuito.
- Efecto secundario útil: la conexión diaria evita que Supabase **pause** el proyecto del plan
  gratuito por inactividad.
