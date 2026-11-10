#!/usr/bin/env bash
set -euo pipefail

: "${BACKUP_FILE:?Set BACKUP_FILE to a downloaded encrypted backup file}"
: "${BACKUP_AGE_IDENTITY:?Set BACKUP_AGE_IDENTITY to the protected age identity file}"
: "${RESTORE_DATABASE:?Set RESTORE_DATABASE to a new, non-production database name}"
: "${RESTORE_COMPOSE_PROJECT:?Set RESTORE_COMPOSE_PROJECT to a unique disposable Compose project}"

case "$RESTORE_COMPOSE_PROJECT" in
  javaneh-restore-*) ;;
  *)
    echo "RESTORE_COMPOSE_PROJECT must start with 'javaneh-restore-'." >&2
    exit 1
    ;;
esac
export COMPOSE_PROJECT_NAME="$RESTORE_COMPOSE_PROJECT"

if [ ! -f "$BACKUP_FILE" ] || [ ! -f "$BACKUP_AGE_IDENTITY" ]; then
  echo "Backup file or age identity file does not exist." >&2
  exit 1
fi
if ! [[ "$RESTORE_DATABASE" =~ ^[A-Za-z][A-Za-z0-9_]{0,62}$ ]]; then
  echo "RESTORE_DATABASE must be a valid PostgreSQL database name." >&2
  exit 1
fi

production_database="$(
  docker compose exec -T database sh -ec 'printf %s "$POSTGRES_DB"'
)"
if [ "$RESTORE_DATABASE" = "$production_database" ]; then
  echo "Refusing to restore into the configured application database." >&2
  exit 1
fi

docker compose exec -T database sh -ec \
  'createdb -U "$POSTGRES_USER" "$1"' restore "$RESTORE_DATABASE"
age --decrypt --identity "$BACKUP_AGE_IDENTITY" "$BACKUP_FILE" |
  docker compose exec -T database sh -ec \
    'pg_restore --exit-on-error --no-owner --no-acl -U "$POSTGRES_USER" --dbname="$1"' restore "$RESTORE_DATABASE"

docker compose exec -T database sh -ec \
  'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$1" -c "SELECT COUNT(*) AS restored_users FROM \"User\""' \
  restore "$RESTORE_DATABASE"
printf 'Restore test completed into isolated database: %s\n' "$RESTORE_DATABASE"
