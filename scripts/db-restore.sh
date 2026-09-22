#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${TARGET_DATABASE_URL:-}" || -z "${BACKUP_FILE:-}" ]]; then
  echo "TARGET_DATABASE_URL and BACKUP_FILE are required" >&2
  exit 1
fi
if [[ "${CONFIRM_RESTORE:-}" != "RESTORE" ]]; then
  echo "Restore refused. Set CONFIRM_RESTORE=RESTORE after verifying the target database." >&2
  exit 1
fi
if [[ ! -f "$BACKUP_FILE" ]]; then
  echo "Backup file not found: $BACKUP_FILE" >&2
  exit 1
fi

pg_restore --list "$BACKUP_FILE" >/dev/null
pg_restore --dbname="$TARGET_DATABASE_URL" --clean --if-exists --no-owner --no-acl --exit-on-error "$BACKUP_FILE"
echo "Restore completed and validated by pg_restore: $BACKUP_FILE"
