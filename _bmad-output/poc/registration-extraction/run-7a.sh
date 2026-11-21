#!/usr/bin/env bash
# Runs 7a-queries.sql against prod, READ ONLY, via the readonly role in .env.local.
# The URL is read into a variable and never printed. Output: aggregate counts only.
set -euo pipefail
cd "$(dirname "$0")/../../.."
U=$(sed -n 's/^PROD_READONLY_DATABASE_URL=//p' .env.local | tr -d "\"'\r")
mkdir -p _bmad-output/poc/registration-extraction/out
psql "$U" -X -q -f _bmad-output/poc/registration-extraction/7a-queries.sql \
  | tee _bmad-output/poc/registration-extraction/out/7a-counts.txt
