<#
.SYNOPSIS
  Deterministically create or remove an isolated git worktree for cline-cli
  delegation, instead of relying on cline's own `--worktree` auto-setup.

.DESCRIPTION
  cline's built-in `--worktree` flag creates the worktree itself as part of
  its own agent loop, which means worktree creation shares fate with
  whatever else that run does (including the hub-daemon/session hangs this
  project has hit repeatedly). This script does the mechanical setup
  up front, deterministically, so a `cline --cwd <path> ...` call (no
  `--worktree`) runs in an already-prepared, already-installed worktree.

  Worktrees are created under a short root (C:\wt\<slug>) rather than under
  the project path, to avoid Windows MAX_PATH (260 char) failures in
  pnpm's nested .pnpm store -- a real, previously-hit failure mode for
  worktrees nested under a long project path.

.PARAMETER Action
  'Create' (default) or 'Remove'.

.PARAMETER Slug
  Short kebab-case name for the worktree, e.g. 'batch-11'. Used as both the
  directory name under the worktree root and (unless -Detached) the branch
  name. Required.

.PARAMETER BaseRef
  Ref to branch/checkout from. Default: master.

.PARAMETER WorktreeRoot
  Root directory all worktrees are created under. Default: C:\wt.

.PARAMETER Branch
  Create a real branch (<Slug>) instead of a detached checkout. Default:
  off (detached), matching cline's own --worktree convention and this
  project's established diff-against-base-commit review workflow.

.PARAMETER SkipInstall
  Skip the `pnpm install` step (Create only). Useful for a worktree that
  will only be used for read-only inspection, not a real build/test run.

.PARAMETER Path
  (Remove only) exact worktree path to remove. If omitted, derived from
  -WorktreeRoot and -Slug the same way Create would.

.EXAMPLE
  ./scripts/cline-worktree.ps1 -Slug batch-11
  Creates C:\wt\batch-11, copies env files, runs pnpm install, prints the
  path. Feed that path to: cline --cwd C:\wt\batch-11 --auto-approve true
  --timeout 600 "<prompt>"

.EXAMPLE
  ./scripts/cline-worktree.ps1 -Action Remove -Slug batch-11
  Removes the worktree (git worktree remove --force, falling back to a
  plain recursive delete if that leaves files behind -- a real, previously
  -hit Windows file-lock issue) and prunes stale worktree metadata.
#>
[CmdletBinding()]
param(
    [ValidateSet('Create', 'Remove')]
    [string]$Action = 'Create',

    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[a-z0-9][a-z0-9-]*$')]
    [string]$Slug,

    [string]$BaseRef = 'master',

    [string]$WorktreeRoot = 'C:\wt',

    [switch]$Branch,

    [switch]$SkipInstall,

    [string]$Path
)

$ErrorActionPreference = 'Stop'

# Resolve the repo root as the directory this script's parent (scripts/) sits in.
$RepoRoot = Split-Path -Parent $PSScriptRoot

function Get-WorktreePath {
    param([string]$Slug, [string]$Root)
    return Join-Path $Root $Slug
}

function New-ClineWorktree {
    $target = Get-WorktreePath -Slug $Slug -Root $WorktreeRoot

    if (Test-Path $target) {
        throw "Worktree path already exists: $target -- pick a different -Slug, or remove it first with -Action Remove."
    }

    if (-not (Test-Path $WorktreeRoot)) {
        New-Item -ItemType Directory -Force -Path $WorktreeRoot | Out-Null
    }

    Push-Location $RepoRoot
    try {
        Write-Host "Creating worktree at $target (base: $BaseRef)..." -ForegroundColor Cyan
        if ($Branch) {
            git worktree add $target -b $Slug $BaseRef
        }
        else {
            git worktree add --detach $target $BaseRef
        }
    }
    finally {
        Pop-Location
    }

    # Copy the real env files a fresh checkout won't have (gitignored).
    # Only copy ones that actually exist in the source repo -- don't fail
    # the whole setup over an optional file.
    $envFiles = @('.env', 'apps\backend\.env', 'apps\web\.env.local')
    foreach ($rel in $envFiles) {
        $src = Join-Path $RepoRoot $rel
        if (Test-Path $src) {
            $dst = Join-Path $target $rel
            $dstDir = Split-Path -Parent $dst
            if (-not (Test-Path $dstDir)) {
                New-Item -ItemType Directory -Force -Path $dstDir | Out-Null
            }
            Copy-Item -Path $src -Destination $dst -Force
            Write-Host "Copied $rel" -ForegroundColor DarkGray
        }
    }

    if (-not $SkipInstall) {
        Write-Host "Running pnpm install in the worktree (this is the slow step -- doing it here, deterministically, so a later delegated agent's own tool-call timeout can't kill it mid-install)..." -ForegroundColor Cyan
        Push-Location $target
        try {
            pnpm install
            if ($LASTEXITCODE -ne 0) {
                throw "pnpm install failed with exit code $LASTEXITCODE"
            }
        }
        finally {
            Pop-Location
        }
    }

    Write-Host ""
    Write-Host "Worktree ready: $target" -ForegroundColor Green
    Write-Host "Next: cline --cwd `"$target`" --auto-approve true --timeout 600 `"<prompt>`"  (no --worktree -- setup is already done)" -ForegroundColor Green
    return $target
}

function Remove-ClineWorktree {
    $target = if ($Path) { $Path } else { Get-WorktreePath -Slug $Slug -Root $WorktreeRoot }

    if (-not (Test-Path $target)) {
        Write-Host "Nothing at $target -- checking git worktree list for a matching registration to prune..." -ForegroundColor Yellow
        Push-Location $RepoRoot
        try { git worktree prune -v } finally { Pop-Location }
        return
    }

    Push-Location $RepoRoot
    try {
        Write-Host "Removing worktree $target..." -ForegroundColor Cyan
        try {
            git worktree remove --force $target
        }
        catch {
            Write-Host "git worktree remove failed ($($_.Exception.Message)) -- falling back to a plain recursive delete + prune (a known Windows file-lock issue, not necessarily a real problem)." -ForegroundColor Yellow
        }

        if (Test-Path $target) {
            Remove-Item -Path $target -Recurse -Force -ErrorAction SilentlyContinue
        }
        git worktree prune -v
    }
    finally {
        Pop-Location
    }

    if (Test-Path $target) {
        Write-Warning "Directory still present at $target after cleanup -- likely a locked file handle (e.g. an antivirus scan or a still-running process inside it). Retry in a moment."
    }
    else {
        Write-Host "Removed." -ForegroundColor Green
    }
}

switch ($Action) {
    'Create' { New-ClineWorktree }
    'Remove' { Remove-ClineWorktree }
}
