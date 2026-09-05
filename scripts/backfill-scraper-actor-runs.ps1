<#
.SYNOPSIS
  Windows-friendly wrapper around packages/database/backfill-scraper-actor-runs.ts,
  the sizing/backfill tool for the 2026-09-05 scraper audit-trail gap.

.DESCRIPTION
  See docs/infrastructure/incidents/2026-09-05-scraper-audit-trail-gap.md for the
  full incident writeup and the exact input JSON shape. This script only handles
  the mechanical part (cd into packages/database, invoke tsx with the right args)
  so the runbook doesn't require remembering pnpm/tsx invocation details.

  Requires DATABASE_URL to be reachable the same way any other packages/database
  script needs it (root .env or packages/database/.env), per this repo's normal
  local-dev setup.

.PARAMETER Mode
  'Sizing' (default) -- read-only orphan counts, no input file needed.
  'Backfill' -- requires -InputFile.

.PARAMETER InputFile
  (Backfill only) path to the JSON array of run records. See the incident doc for
  the exact shape (vendor, vendor_run_id, instagram_profile_id, started_at,
  raw_input, raw_output).

.PARAMETER Apply
  (Backfill only) actually write changes. Without this switch, backfill mode is a
  dry run: it reports what it would insert/link but writes nothing.

.PARAMETER WindowHours
  (Backfill only) how many hours before/after each run's started_at to search for
  candidate posts/unprocessed_scraper_payloads rows to relink. Default: 2.

.EXAMPLE
  ./scripts/backfill-scraper-actor-runs.ps1
  Runs sizing mode -- prints current orphan counts across every affected table.

.EXAMPLE
  ./scripts/backfill-scraper-actor-runs.ps1 -Mode Backfill -InputFile .\backfill-data.json
  Dry run: reports what would be inserted/linked from backfill-data.json, writes nothing.

.EXAMPLE
  ./scripts/backfill-scraper-actor-runs.ps1 -Mode Backfill -InputFile .\backfill-data.json -Apply
  Commits the backfill: inserts scraper_actor_runs rows and relinks orphaned children.
#>
[CmdletBinding()]
param(
    [ValidateSet('Sizing', 'Backfill')]
    [string]$Mode = 'Sizing',

    [string]$InputFile,

    [switch]$Apply,

    [int]$WindowHours = 2
)

$ErrorActionPreference = 'Stop'

$RepoRoot = (git rev-parse --show-toplevel 2>$null)
if (-not $RepoRoot) {
    $RepoRoot = Split-Path -Parent $PSScriptRoot
}
$DatabaseDir = Join-Path $RepoRoot 'packages\database'

if (-not (Test-Path $DatabaseDir)) {
    Write-Error "Could not find packages/database under repo root '$RepoRoot'. Run this from inside the fest-grid-bmad repo."
    exit 1
}

Push-Location $DatabaseDir
try {
    if ($Mode -eq 'Sizing') {
        npx tsx backfill-scraper-actor-runs.ts sizing
    } else {
        if (-not $InputFile) {
            Write-Error "-InputFile is required for -Mode Backfill. See docs/infrastructure/incidents/2026-09-05-scraper-audit-trail-gap.md for the expected JSON shape."
            exit 1
        }
        $ResolvedInput = Resolve-Path $InputFile -ErrorAction Stop

        $TsxArgs = @('backfill-scraper-actor-runs.ts', 'backfill', '--input', "$ResolvedInput", '--window-hours', "$WindowHours")
        if ($Apply) {
            $TsxArgs += '--apply'
        } else {
            Write-Host "Running in DRY RUN mode -- nothing will be written. Pass -Apply to commit." -ForegroundColor Yellow
        }

        npx tsx @TsxArgs
    }
} finally {
    Pop-Location
}
