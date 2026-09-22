# Database backup, restore, and retention

Production must use the managed PostgreSQL provider's automated point-in-time
recovery. The repository scripts provide an additional portable logical backup
and a repeatable restore drill; they do not replace provider backups.

## Create and verify a logical backup

Install PostgreSQL client tools, use a direct (not pooled) connection URL, and
run:

```sh
DATABASE_URL='<source direct URL>' BACKUP_DIR=./backups pnpm db:backup
```

The command creates a timestamped custom-format dump and validates its catalog
with `pg_restore --list`. The repository ignores `backups/`, but dumps must
still be moved to encrypted, access-controlled storage with an expiry policy.

## Restore drill

Always restore into a new, disposable database first. The restore command uses
`--clean --if-exists` and is destructive to its target, so it requires an
explicit confirmation value:

```sh
TARGET_DATABASE_URL='<empty drill database URL>' \
BACKUP_FILE='/secure/path/kachko-YYYYMMDDTHHMMSSZ.dump' \
CONFIRM_RESTORE=RESTORE \
pnpm db:restore
```

Afterward run `pnpm db:status`, the API infrastructure tests, and the Robot
smoke suite against the restored database. Record the date, dump identifier,
restore duration, row-count checks, and operator. Run this drill at least once
per quarter and before relying on a new provider or backup policy.

## Analytics retention

`.github/workflows/analytics-retention.yml` executes the 12-month pruning SQL
daily using the protected `production` GitHub environment. Configure its
`DATABASE_URL` secret with the least-privileged production maintenance role and
enable required reviewers for manual runs. Monitor failed scheduled workflows.
