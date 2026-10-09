#!/usr/bin/env bash
set -euo pipefail
# This database is disposable and must never point at hosted infrastructure.
export DATABASE_URL="${BILLING_TEST_DATABASE_URL:-postgresql://$(id -un)@127.0.0.1:55432/zentra_billing_test?schema=public}"
export RUN_BILLING_INTEGRATION=1
exec npx jest tests/billing --runInBand "$@"
