#!/bin/sh
set -eu

admin_password=$(tr -d '\r\n' < "${CRYSTRA_EVIDENCE_ADMIN_PASSWORD_FILE:?}")
runtime_password=$(tr -d '\r\n' < "${CRYSTRA_EVIDENCE_RUNTIME_PASSWORD_FILE:?}")
backup_password=$(tr -d '\r\n' < "${CRYSTRA_EVIDENCE_BACKUP_PASSWORD_FILE:?}")
state_identity=${CRYSTRA_EVIDENCE_STATE_IDENTITY:?}
test -n "$admin_password" && test -n "$runtime_password" && test -n "$backup_password" && test -n "$state_identity"
case "$state_identity" in *[!0-9a-f]* | "") printf 'Invalid CRYSTRA Evidence state identity.\n' >&2; exit 2;; esac
if test "${#state_identity}" -ne 64; then printf 'Invalid CRYSTRA Evidence state identity.\n' >&2; exit 2; fi

marker="$PGDATA/.crystra-state-identity"
if test -s "$marker"; then
  recorded_identity=$(tr -d '\r\n' < "$marker")
  if test "$recorded_identity" != "$state_identity"; then
    printf 'Evidence volume belongs to a different CRYSTRA state directory; refusing credential rotation.\n' >&2
    exit 20
  fi
else
  umask 077
  printf '%s\n' "$state_identity" > "$marker.new"
  mv "$marker.new" "$marker"
fi

psql --set=ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  --set=admin_password="$admin_password" --set=runtime_password="$runtime_password" --set=backup_password="$backup_password" <<'SQL'
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON DATABASE crystra_evidence FROM PUBLIC;
SELECT 'CREATE ROLE crystra_evidence_runtime LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION'
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'crystra_evidence_runtime') \gexec
SELECT 'CREATE ROLE crystra_evidence_backup LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION'
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'crystra_evidence_backup') \gexec
SELECT format('ALTER ROLE crystra_evidence_admin LOGIN PASSWORD %L', :'admin_password') \gexec
SELECT format('ALTER ROLE crystra_evidence_runtime LOGIN PASSWORD %L', :'runtime_password') \gexec
SELECT format('ALTER ROLE crystra_evidence_backup LOGIN PASSWORD %L', :'backup_password') \gexec
ALTER ROLE crystra_evidence_backup SET default_transaction_read_only = on;
GRANT CONNECT ON DATABASE crystra_evidence TO crystra_evidence_runtime, crystra_evidence_backup;
GRANT USAGE ON SCHEMA public TO crystra_evidence_runtime, crystra_evidence_backup;
ALTER DEFAULT PRIVILEGES FOR ROLE crystra_evidence_admin IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO crystra_evidence_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE crystra_evidence_admin IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO crystra_evidence_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE crystra_evidence_admin IN SCHEMA public GRANT SELECT ON TABLES TO crystra_evidence_backup;
ALTER DEFAULT PRIVILEGES FOR ROLE crystra_evidence_admin IN SCHEMA public GRANT SELECT ON SEQUENCES TO crystra_evidence_backup;
SQL
