# Pending GitHub workflow change (needs a human push)

`backfill-post-media-keys.yml` here is the corrected version of
`.github/workflows/backfill-post-media-keys.yml`: it adds a `pnpm run build` step before the
backfill, because the script imports `@festgrid/database`, which resolves to its gitignored
`dist/` (run 36815684995 failed with MODULE_NOT_FOUND without it).

The Claude Code session token cannot push files under `.github/workflows/` (GitHub requires
the `workflow` scope). Copy this file over `.github/workflows/backfill-post-media-keys.yml`
with credentials that have that scope, then delete this folder.
