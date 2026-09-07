<#
.SYNOPSIS
  Spawn a brand-new, empty-context Claude Code background session with
  Remote Control enabled from the start, and print its pairing URL.

.DESCRIPTION
  `claude --bg` starts a genuine background session (its own process,
  listable via `claude agents`, controllable via `claude attach/logs/stop/
  rm`) with a fresh conversation (no --resume passed here). Combining it
  with `--remote-control [name]` enables pairing from the very first
  prompt -- there is no documented way to auto-run the `/remote-control`
  slash command on startup, and none is needed: `--remote-control` is
  itself a startup flag on this CLI (`claude --help` confirms it, v2.1.259),
  so this script never needs to type anything into the new session.

  Verified live (2026-09-08): `claude --bg --remote-control "<name>"` prints
  a short id and registers a "background"/"idle" entry in `claude agents
  --json`; `claude logs <id>` (heavy ANSI TUI dump) eventually contains the
  line `/remote-control is active ... at https://claude.ai/code/<session>`
  once pairing finishes connecting (a few seconds after start, not
  immediate) -- this script polls for that line rather than assuming a
  fixed delay is enough.

  The spawned session is NOT tied to this script's own process in any way
  once it prints its id -- it keeps running (and stays remote-control-
  reachable) after this script exits, exactly like `claude --bg` alone.
  It only goes offline if its own process is stopped (`claude stop <id>`)
  or the machine shuts down -- see the CLI's own Remote Control docs'
  "local process must keep running" limitation.

.PARAMETER Cwd
  Working directory the new session starts in (its CLAUDE.md/project
  context). Default: current directory.

.PARAMETER Name
  Remote Control session name (shown in the mobile/web picker). Default:
  a timestamped slug so repeated invocations don't collide.

.PARAMETER PermissionMode
  Optional `--permission-mode` passthrough (acceptEdits, auto,
  bypassPermissions, manual, dontAsk, plan). Default: unset (CLI default).

.PARAMETER TimeoutSeconds
  How long to poll `claude logs <id>` for the pairing URL before giving up
  and returning just the id. Default: 20.

.PARAMETER InitialPrompt
  Optional first prompt to send immediately, instead of leaving the session
  idle waiting for one. Verified live (2026-09-08): a trailing positional
  prompt argument works alongside `--bg --remote-control` -- the session
  starts working on it right away rather than showing "(idle -- send a
  prompt to start)". Useful for a task you already know you want run, not
  just for a pure "hand this to my phone" session.

.EXAMPLE
  ./scripts/spawn-remote-control-session.ps1 -Name "phone-session"

.EXAMPLE
  ./scripts/spawn-remote-control-session.ps1 -Cwd "C:\projects\portfolio\festgrid\bmad" -PermissionMode acceptEdits

.EXAMPLE
  ./scripts/spawn-remote-control-session.ps1 -Name "hello-test" -InitialPrompt 'say "hello"'
#>
param(
    [string]$Cwd = (Get-Location).Path,
    [string]$Name = "mobile-$(Get-Date -Format 'yyyyMMdd-HHmmss')",
    [ValidateSet("acceptEdits", "auto", "bypassPermissions", "manual", "dontAsk", "plan")]
    [string]$PermissionMode,
    [int]$TimeoutSeconds = 20,
    [string]$InitialPrompt
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $Cwd)) {
    throw "Working directory does not exist: $Cwd"
}

Push-Location $Cwd
try {
    $claudeArgs = @("--bg", "--remote-control", $Name)
    if ($PermissionMode) {
        $claudeArgs += @("--permission-mode", $PermissionMode)
    }
    if ($InitialPrompt) {
        $claudeArgs += $InitialPrompt
    }

    Write-Host "Spawning background session in $Cwd (name: $Name)..."
    $output = & claude @claudeArgs 2>&1 | Out-String

    # "backgrounded · <id> (idle -- send a prompt to start)"
    $idMatch = [regex]::Match($output, "backgrounded\s*[·\-]\s*([0-9a-f]+)")
    if (-not $idMatch.Success) {
        Write-Host $output
        throw "Could not find a background session id in claude's output (shown above) -- CLI output shape may have changed."
    }
    $id = $idMatch.Groups[1].Value
    Write-Host "Session id: $id"

    $pairingUrl = $null
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline -and -not $pairingUrl) {
        Start-Sleep -Seconds 2
        $rawLog = & claude logs $id 2>&1 | Out-String
        # Strip ANSI/CSI escape sequences (ESC [ ... letter) before matching text.
        $cleanLog = $rawLog -replace "`e\[[0-9;]*[a-zA-Z]", ""
        $urlMatch = [regex]::Match($cleanLog, "remote-control is active.*?at (https://\S+)")
        if ($urlMatch.Success) {
            $pairingUrl = $urlMatch.Groups[1].Value
        }
    }

    Write-Host ""
    if ($pairingUrl) {
        Write-Host "Remote Control pairing URL: $pairingUrl"
    } else {
        Write-Host "Session started but pairing URL didn't appear within ${TimeoutSeconds}s -- check manually:"
        Write-Host "  claude logs $id"
    }
    Write-Host ""
    Write-Host "Manage this session with:"
    Write-Host "  claude attach $id   (open it in this terminal)"
    Write-Host "  claude logs $id     (see recent output)"
    Write-Host "  claude stop $id     (stop it -- conversation is kept)"
    Write-Host "  claude rm $id       (delete it once stopped)"

    [PSCustomObject]@{
        Id         = $id
        Name       = $Name
        Cwd        = $Cwd
        PairingUrl = $pairingUrl
    }
}
finally {
    Pop-Location
}
