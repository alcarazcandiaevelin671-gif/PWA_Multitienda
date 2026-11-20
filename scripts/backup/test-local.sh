#!/usr/bin/env bash
# =============================================================================
# Prueba completa en tu computadora: hace una copia real de Supabase y la restaura
# en un servidor PostgreSQL TEMPORAL (creado solo para la prueba y borrado al final).
# No toca tu PostgreSQL instalado ni tus datos de producción (solo los lee).
#
# Requisitos en .env.local: SUPABASE_DB_URL y BACKUP_PASSPHRASE.
# Uso (Git Bash, desde la raíz del proyecto):  bash scripts/backup/test-local.sh
# =============================================================================
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."

set -a; . ./.env.local; set +a
export PG_BIN="${PG_BIN:-/c/Program Files/PostgreSQL/18/bin}"
[ -x "$PG_BIN/initdb.exe" ] || [ -x "$PG_BIN/initdb" ] || { echo "No se encontró PostgreSQL en $PG_BIN (define PG_BIN)." >&2; exit 1; }

PORT=55432
TMP_ROOT="${TMPDIR:-${TEMP:-/tmp}}"
CLUSTER="$TMP_ROOT/pg-restore-test-$$"
stop_cluster() {
  "$PG_BIN/pg_ctl" -D "$CLUSTER" -m fast stop >/dev/null 2>&1 || true
  rm -rf "$CLUSTER"
}
trap stop_cluster EXIT

echo "== Servidor PostgreSQL temporal en el puerto $PORT"
"$PG_BIN/initdb" -D "$CLUSTER" -U postgres -A trust -E UTF8 --no-locale >/dev/null
"$PG_BIN/pg_ctl" -D "$CLUSTER" -o "-p $PORT -c listen_addresses=localhost" -l "$CLUSTER/server.log" -w start >/dev/null

echo "== Copia de seguridad (producción, solo lectura)"
bash scripts/backup/backup.sh backups
LAST="$(cat backups/ULTIMA_COPIA.txt)"

echo "== Prueba de restauración"
TEST_DB_URL="postgresql://postgres@localhost:$PORT/postgres" bash scripts/backup/verify-restore.sh "$LAST"
