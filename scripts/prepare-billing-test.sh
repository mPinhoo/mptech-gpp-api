#!/usr/bin/env bash
set -euo pipefail
export DATABASE_URL="${BILLING_TEST_DATABASE_URL:-postgresql://$(id -un)@127.0.0.1:55432/zentra_billing_test?schema=public}"
node - <<'NODE'
const url = new URL(process.env.DATABASE_URL);
if (url.hostname !== '127.0.0.1' || !['/zentra_billing_test','/zentra_billing_migration_check'].includes(url.pathname)) {
  throw new Error('Refusing a non-local or non-test database.');
}
NODE
billing_sql=$(mktemp)
trap 'rm -f "$billing_sql"' EXIT
# Requires an EMPTY, already created local test database. Never resets a database.
npx prisma migrate diff --from-empty --to-schema-datamodel tests/fixtures/pre-billing.prisma --script > "$billing_sql"
npx prisma db execute --file "$billing_sql" --schema prisma/schema.prisma
for migration in prisma/migrations/20261009000000_add_billing prisma/migrations/20261009150000_billing_checkout_link prisma/migrations/20261010000000_notificacoes_push; do
  npx prisma db execute --file "$migration/migration.sql" --schema prisma/schema.prisma
done
