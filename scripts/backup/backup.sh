#!/usr/bin/env bash
# =============================================================================
# Copia de seguridad cifrada de la base de datos de Supabase.
#
# Uso:
#   SUPABASE_DB_URL='postgresql://...' BACKUP_PASSPHRASE='...' bash scripts/backup/backup.sh [carpeta]
#   (PG_BIN=/ruta/a/postgres/bin si pg_dump/psql no están en el PATH)
#
# Contenido de la copia (archivo .tar.gz.enc, cifrado AES-256):
#   public.dump        esquema + datos de la app: tablas, funciones, triggers, políticas RLS, permisos
#   auth_schema.dump   estructura del esquema auth (solo para restaurar en una base que no sea Supabase)
#   auth_data.dump     cuentas: auth.users, auth.identities (Google), auth.mfa_factors
#   storage_schema.dump estructura del esquema storage (solo para restaurar fuera de Supabase)
#   storage_data.dump  registro de archivos: storage.buckets y storage.objects
#   extras.sql         triggers de auth.users, políticas de storage, configuración de buckets
#   manifest.txt       filas por tabla y objetos críticos (para verificar la restauración)
#
# No incluye los archivos (imágenes) de Storage: viven en el almacenamiento de objetos
# de Supabase, no en Postgres. Ver docs/BACKUPS.md.
# =============================================================================
set -euo pipefail
export PGCLIENTENCODING=UTF8  # evita errores de codificación (Windows usa otra por defecto)

: "${SUPABASE_DB_URL:?Falta SUPABASE_DB_URL (cadena de conexión del Session pooler de Supabase)}"
: "${BACKUP_PASSPHRASE:?Falta BACKUP_PASSPHRASE (clave para cifrar la copia)}"
if [ "${#BACKUP_PASSPHRASE}" -lt 16 ]; then
  echo "BACKUP_PASSPHRASE debe tener al menos 16 caracteres." >&2
  exit 1
fi

OUT_DIR="${1:-backups}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
bin() { if [ -n "${PG_BIN:-}" ]; then echo "$PG_BIN/$1"; else echo "$1"; fi; }
PG_DUMP="$(bin pg_dump)"
PSQL="$(bin psql)"

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
NAME="pwa-multitienda-db-$STAMP"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
mkdir -p "$WORK/$NAME" "$OUT_DIR"
DEST="$WORK/$NAME"

log() { echo "[$(date -u +%H:%M:%S)] $*"; }

log "Versión de pg_dump: $("$PG_DUMP" --version)"
log "1/6 Esquema y datos de la app (public)"
"$PG_DUMP" "$SUPABASE_DB_URL" -Fc --no-owner --schema=public -f "$DEST/public.dump"

log "2/6 Estructura del esquema auth"
"$PG_DUMP" "$SUPABASE_DB_URL" -Fc --no-owner --no-privileges --schema-only --schema=auth -f "$DEST/auth_schema.dump"

log "3/6 Cuentas de usuario (auth)"
"$PG_DUMP" "$SUPABASE_DB_URL" -Fc --no-owner --data-only \
  --table=auth.users --table=auth.identities --table=auth.mfa_factors -f "$DEST/auth_data.dump"

log "4/6 Registro de archivos (storage)"
"$PG_DUMP" "$SUPABASE_DB_URL" -Fc --no-owner --no-privileges --schema-only --schema=storage -f "$DEST/storage_schema.dump"
"$PG_DUMP" "$SUPABASE_DB_URL" -Fc --no-owner --data-only \
  --table=storage.buckets --table=storage.objects -f "$DEST/storage_data.dump"

log "5/6 Extras (triggers de auth, políticas de storage) y manifiesto"
"$PSQL" "$SUPABASE_DB_URL" -X -At -v ON_ERROR_STOP=1 -f "$SCRIPT_DIR/extras.sql" > "$DEST/extras.sql"
"$PSQL" "$SUPABASE_DB_URL" -X -At -v ON_ERROR_STOP=1 -f "$SCRIPT_DIR/manifest.sql" > "$DEST/manifest.txt"

log "6/6 Comprimir y cifrar (AES-256-CBC, PBKDF2 200.000 iteraciones)"
tar -C "$WORK" -czf "$WORK/$NAME.tar.gz" "$NAME"
openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass env:BACKUP_PASSPHRASE \
  -in "$WORK/$NAME.tar.gz" -out "$OUT_DIR/$NAME.tar.gz.enc"
( cd "$OUT_DIR" && sha256sum "$NAME.tar.gz.enc" > "$NAME.tar.gz.enc.sha256" )

FILAS="$(grep -c '^filas|' "$DEST/manifest.txt")"
log "Listo: $OUT_DIR/$NAME.tar.gz.enc ($(du -h "$OUT_DIR/$NAME.tar.gz.enc" | cut -f1), $FILAS tablas)"
grep '^meta|' "$DEST/manifest.txt" | sed 's/^/    /'
echo "$OUT_DIR/$NAME.tar.gz.enc" > "$OUT_DIR/ULTIMA_COPIA.txt"
