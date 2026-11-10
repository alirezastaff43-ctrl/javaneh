#!/usr/bin/env bash
set -euo pipefail

: "${BACKUP_AGE_RECIPIENT:?Set BACKUP_AGE_RECIPIENT to the off-site age public recipient}"
: "${BACKUP_DESTINATION:?Set BACKUP_DESTINATION to a restricted rclone destination}"

command -v age >/dev/null
command -v rclone >/dev/null
command -v docker >/dev/null

backup_name="javaneh-$(date -u +%Y%m%dT%H%M%SZ)-$$.dump.age"
temporary_file="$(mktemp)"
trap 'rm -f -- "$temporary_file"' EXIT

docker compose exec -T database sh -ec \
  'pg_dump --format=custom --no-owner --no-acl -U "$POSTGRES_USER" "$POSTGRES_DB"' |
  age --recipient "$BACKUP_AGE_RECIPIENT" --output "$temporary_file"

rclone copyto "$temporary_file" "${BACKUP_DESTINATION%/}/$backup_name"
printf 'Encrypted database backup uploaded: %s\n' "$backup_name"
