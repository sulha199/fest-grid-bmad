#!/usr/bin/env bash
# Pulls the stratified caption sample (READ ONLY) into the gitignored private/ folder.
set -euo pipefail
cd "$(dirname "$0")/../../.."
U=$(sed -n 's/^PROD_READONLY_DATABASE_URL=//p' .env.local | tr -d "\"'\r")
OUT=_bmad-output/poc/registration-extraction/private/sample.jsonl
psql "$U" -X -A -t -q -f _bmad-output/poc/registration-extraction/sample-captions.sql | grep '^{' > "$OUT"
echo "rows: $(wc -l < "$OUT")"
node -e "const c={};require('fs').readFileSync('$OUT','utf8').trim().split('\n').forEach(l=>{const r=JSON.parse(l);c[r.stratum]=(c[r.stratum]||0)+1});console.log(c)"
