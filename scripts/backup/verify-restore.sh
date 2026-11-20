#!/usr/bin/env bash
# =============================================================================
# Prueba de restauración: descifra una copia, la restaura en una base VACÍA y
# AISLADA, y comprueba que tenga exactamente las mismas filas y objetos que
# producción tenía al momento de la copia (manifest.txt).
#
# Uso:
#   BACKUP_PASSPHRASE='...' TEST_DB_URL='postgresql://postgres@localhost:55432/postgres' \
#     bash scripts/backup/verify-restore.sh backups/pwa-multitienda-db-XXXX.tar.gz.enc
#
# TEST_DB_URL debe apuntar a un servidor de PRUEBA (nunca a producción): se crea
# y luego se borra una base "restore_check".
# Sale con código 0 si la copia es válida y 1 si falta algo.
# Variables opcionales: PG_BIN (carpeta de binarios), KEEP_RESTORE_DB=1 (no borrar la base).
# =============================================================================
set -euo pipefail
export PGCLIENTENCODING=UTF8  # evita errores de codificación (Windows usa otra por defecto)

ENC_FILE="${1:?Indica el archivo .tar.gz.enc a verificar}"
: "${BACKUP_PASSPHRASE:?Falta BACKUP_PASSPHRASE}"
: "${TEST_DB_URL:?Falta TEST_DB_URL (servidor PostgreSQL de prueba)}"
case "$TEST_DB_URL" in *supabase.co*|*supabase.com*)
  echo "TEST_DB_URL apunta a Supabase: la verificación solo se hace en un servidor de prueba." >&2; exit 1;;
esac

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
bin() { if [ -n "${PG_BIN:-}" ]; then echo "$PG_BIN/$1"; else echo "$1"; fi; }
PSQL="$(bin psql)"
PG_RESTORE="$(bin pg_restore)"
DB_NAME="restore_check"
WORK="$(mktemp -d)"
cleanup() {
  if [ "${KEEP_RESTORE_DB:-0}" != "1" ]; then
    "$PSQL" "$TEST_DB_URL" -X -q -c "DROP DATABASE IF EXISTS $DB_NAME WITH (FORCE)" >/dev/null 2>&1 || true
  fi
  rm -rf "$WORK"
}
trap cleanup EXIT
log() { echo "[$(date -u +%H:%M:%S)] $*"; }

# URL de la base de prueba recién creada (misma conexión, otra base).
TARGET_URL="$(echo "$TEST_DB_URL" | sed -E "s#/[^/?]+(\?|$)#/$DB_NAME\1#")"

log "1/7 Verificar integridad y descifrar"
if [ -f "$ENC_FILE.sha256" ]; then
  ( cd "$(dirname "$ENC_FILE")" && sha256sum -c "$(basename "$ENC_FILE").sha256" >/dev/null ) \
    || { echo "La suma SHA-256 no coincide: el archivo está dañado o fue modificado." >&2; exit 1; }
  log "    SHA-256 correcto"
fi
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:BACKUP_PASSPHRASE -in "$ENC_FILE" -out "$WORK/backup.tar.gz" \
  || { echo "No se pudo descifrar: la clave BACKUP_PASSPHRASE es incorrecta o el archivo está dañado." >&2; exit 1; }
tar -C "$WORK" -xzf "$WORK/backup.tar.gz"
SRC="$(find "$WORK" -mindepth 1 -maxdepth 1 -type d | head -1)"
for f in public.dump auth_schema.dump auth_data.dump storage_schema.dump storage_data.dump extras.sql manifest.txt; do
  [ -s "$SRC/$f" ] || { echo "La copia no contiene $f" >&2; exit 1; }
done
log "    Copia de $(grep '^meta|fecha_utc|' "$SRC/manifest.txt" | cut -d'|' -f3) (Postgres $(grep '^meta|version_postgres|' "$SRC/manifest.txt" | cut -d'|' -f3))"

log "2/7 Crear base de prueba aislada \"$DB_NAME\""
"$PSQL" "$TEST_DB_URL" -X -q -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS $DB_NAME WITH (FORCE)" -c "CREATE DATABASE $DB_NAME"
"$PSQL" "$TARGET_URL" -X -q -v ON_ERROR_STOP=1 -f "$SCRIPT_DIR/restore-prereqs.sql" >/dev/null

COMPAT=0
if "$PSQL" "$TARGET_URL" -X -q -c "CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions" >/dev/null 2>&1; then
  log "    PostGIS disponible: verificación completa"
else
  COMPAT=1
  log "    PostGIS NO disponible: modo compatible (columnas geográficas como texto; se comparan todas las filas)"
fi

ERRLOG="$WORK/errores.log"
: > "$ERRLOG"
restore_sql() {  # $1 = archivo .dump, $2.. = opciones de pg_restore
  local dump="$1"; shift
  # Las políticas RLS y triggers de auth/storage dependen de funciones de la app (public) que aún
  # no existen en este punto: se omiten aquí y se aplican al final con extras.sql.
  case "$(basename "$dump")" in
    auth_schema.dump|storage_schema.dump) "$PG_RESTORE" -l "$dump" | grep -vE ' (POLICY|TRIGGER) ' > "$WORK/lista.txt" ;;
    *) "$PG_RESTORE" -l "$dump" > "$WORK/lista.txt" ;;
  esac
  "$PG_RESTORE" --no-owner -L "$WORK/lista.txt" "$@" -f "$WORK/tmp.sql" "$dump"
  if [ "$COMPAT" = "1" ]; then
    sed -i -E 's/(extensions|public)\.geography(\([^)]*\))?/text/g; s/(extensions|public)\.geometry(\([^)]*\))?/text/g' "$WORK/tmp.sql"
  fi
  "$PSQL" "$TARGET_URL" -X -q -v ON_ERROR_STOP=0 -f "$WORK/tmp.sql" >/dev/null 2>>"$ERRLOG" || true
}

log "3/7 Restaurar estructura de auth y storage"
restore_sql "$SRC/auth_schema.dump"
restore_sql "$SRC/storage_schema.dump"
# Los triggers de la app sí se restauran con public.dump; solo se filtran los de auth/storage.

log "4/7 Restaurar cuentas y registro de archivos (sin disparar triggers)"
restore_sql "$SRC/auth_data.dump" --disable-triggers
restore_sql "$SRC/storage_data.dump" --disable-triggers

log "5/7 Restaurar la app (public: tablas, datos, funciones, triggers, RLS)"
"$PSQL" "$TARGET_URL" -X -q -c "DROP SCHEMA IF EXISTS public CASCADE" >/dev/null
restore_sql "$SRC/public.dump"

log "6/7 Aplicar extras (triggers de auth, políticas de storage, buckets)"
"$PSQL" "$TARGET_URL" -X -q -v ON_ERROR_STOP=0 -f "$SRC/extras.sql" >/dev/null 2>>"$ERRLOG" || true

log "7/7 Comparar con el manifiesto de producción"
"$PSQL" "$TARGET_URL" -X -At -v ON_ERROR_STOP=1 -f "$SCRIPT_DIR/manifest.sql" > "$WORK/restaurado.txt"

FALLOS=0
AVISOS=0
while IFS='|' read -r tipo nombre esperado; do
  [ "$tipo" = "filas" ] || [ "$tipo" = "objetos" ] || continue
  esperado="${esperado%$'\r'}"  # psql en Windows termina las líneas con \r\n
  obtenido="$(grep -F "$tipo|$nombre|" "$WORK/restaurado.txt" | cut -d'|' -f3 | tr -d '\r' || true)"
  if [ "$obtenido" = "$esperado" ]; then
    printf '    OK     %-48s %s\n' "$nombre" "$esperado"
  elif [ "$tipo" = "objetos" ] && [ "$COMPAT" = "1" ]; then
    printf '    AVISO  %-48s esperado %s, restaurado %s (requiere PostGIS)\n' "$nombre" "$esperado" "${obtenido:-0}"
    AVISOS=$((AVISOS + 1))
  else
    printf '    FALLA  %-48s esperado %s, restaurado %s\n' "$nombre" "$esperado" "${obtenido:-0}"
    FALLOS=$((FALLOS + 1))
  fi
done < "$SRC/manifest.txt"

# En modo compatible, lo que exige PostGIS (índices GiST, funciones geográficas) es esperable.
ESPERABLES='gist|geography|geometry|postgis|st_[a-z]+'
errores_inesperados() {  # nunca falla aunque no haya coincidencias (set -e / pipefail)
  { grep 'ERROR' "$ERRLOG" || true; } | { if [ "$COMPAT" = "1" ]; then grep -viE "$ESPERABLES" || true; else cat; fi; }
}
ERRORES="$(errores_inesperados | wc -l | tr -d ' ')"
if [ "$ERRORES" -gt 0 ]; then
  echo "    Errores durante la restauración: $ERRORES (primeros 8):"
  errores_inesperados | sed -E 's/^.*ERROR: +/      - /' | sort | uniq -c | sort -rn | head -8
elif [ "$COMPAT" = "1" ] && grep -q 'ERROR' "$ERRLOG"; then
  echo "    Sin errores inesperados (solo los propios de no tener PostGIS en esta máquina)."
fi

TOTAL="$(grep -cE '^(filas|objetos)\|' "$SRC/manifest.txt")"
if [ "$FALLOS" -gt 0 ]; then
  log "RESULTADO: COPIA NO VÁLIDA — $FALLOS de $TOTAL comprobaciones fallaron."
  exit 1
fi
if [ "$COMPAT" = "1" ]; then
  log "RESULTADO: COPIA VÁLIDA (modo compatible) — $TOTAL comprobaciones, $AVISOS avisos por falta de PostGIS."
else
  log "RESULTADO: COPIA VÁLIDA — $TOTAL de $TOTAL comprobaciones correctas."
fi
