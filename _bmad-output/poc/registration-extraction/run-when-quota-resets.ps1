# POC autostart: runs the pending Gemini replays in priority order, a daily budget at a time, until they are all done (resumable across days).
# Started by the Windows scheduled task "festgrid-poc-autostart" at the free-tier reset (Pacific midnight = 15:00 WIB in winter); also safe to start by hand.
# Only the POC scripts in this folder run. It never commits, pushes, or touches apps/ or packages/. Log: private/autostart.log (no keys, no captions).
# Remove: Unregister-ScheduledTask -TaskName festgrid-poc-autostart -Confirm:$false      Stop a running chain: kill the powershell and node processes.
$ErrorActionPreference = 'Continue' # native stderr must not abort the chain; exit codes are checked explicitly
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root
$node = 'C:\nvm4w\nodejs\node.exe'
$tsx = Join-Path $root 'node_modules\tsx\dist\cli.mjs'
$log = Join-Path $root 'private\autostart.log'
$lock = Join-Path $root 'private\autostart.lock'
$counter = Join-Path $root 'private\quota-counter.json'
$budget = 440
function Log($m) { Add-Content -Path $log -Encoding utf8 -Value ("{0} {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $m) }

# one chain at a time: a second replay process writing the same files double-counts the quota and duplicates rows
if (Test-Path $lock) {
  $old = [int](Get-Content $lock -ErrorAction SilentlyContinue)
  if ($old -and (Get-Process -Id $old -ErrorAction SilentlyContinue)) { Log "another chain is running (pid $old); exiting"; exit 0 }
}
Set-Content -Path $lock -Value $PID
try {
  function SpentToday {
    if (-not (Test-Path $counter)) { return 0 }
    $c = Get-Content $counter -Raw | ConvertFrom-Json
    $tz = [TimeZoneInfo]::FindSystemTimeZoneById('Pacific Standard Time')
    $today = [TimeZoneInfo]::ConvertTime([DateTime]::UtcNow, $tz).ToString('yyyy-MM-dd')
    if ($c.day -eq $today) { return [int]$c.n } else { return 0 }
  }
  function SecondsToNextReset {
    $tz = [TimeZoneInfo]::FindSystemTimeZoneById('Pacific Standard Time')
    $nowPt = [TimeZoneInfo]::ConvertTime([DateTime]::UtcNow, $tz)
    $nextPt = [DateTime]::SpecifyKind($nowPt.Date.AddDays(1).AddMinutes(5), [DateTimeKind]::Unspecified)
    $nextUtc = [TimeZoneInfo]::ConvertTimeToUtc($nextPt, $tz)
    return [int][Math]::Max(60, ($nextUtc - [DateTime]::UtcNow).TotalSeconds)
  }
  $steps = @(
    # Trimmed 2026-11-21 (owner question: are hundreds of calls needed?): one screening run each, paired by post; extend with --runs 3 only if a result is ambiguous.
    @{ name = 'highlight arms F-end and F-inline on captions, 1 run'; args = @('ab-highlight.ts', '--mode', 'captions', '--runs', '1'); after = @('ab-highlight-analyze.mjs') },
    @{ name = 'highlight arms A, G-end, G-inline on live posts, 1 run'; args = @('ab-highlight.ts', '--mode', 'live', '--runs', '1'); after = @('ab-highlight-analyze.mjs') },
    @{ name = 'stage classification call, run 2 on the first 60 events (stability)'; args = @('classify-titles-call.ts', '--runs', '2', '--limit', '60'); after = @('classify-call-analyze.mjs') }
  )
  foreach ($s in $steps) {
    Log "START $($s.name)"
    $quotaWaits = 0
    for ($attempt = 1; $attempt -le 12; $attempt++) {
      & $node $tsx @($s.args) 2>&1 | Out-File -FilePath $log -Append -Encoding utf8
      $code = $LASTEXITCODE
      if ($code -eq 0) { Log "DONE  $($s.name)"; break }
      if ($code -ne 3) { Log "FAILED $($s.name) with exit code $code; moving on"; break }
      if ((SpentToday) -ge $budget -or $quotaWaits -ge 3) { $w = SecondsToNextReset; $quotaWaits = 0; Log "daily budget or quota spent (counter $(SpentToday)/$budget); sleeping $([int]($w/60)) min until the next Pacific-midnight window" }
      else { $quotaWaits++; $w = 900; Log "quota refused before the budget was spent (the window may not have rolled yet); retrying in 15 min ($quotaWaits/3)" }
      Start-Sleep -Seconds $w
    }
    foreach ($a in $s.after) { Log "ANALYSE $a"; & $node $a 2>&1 | Out-File -FilePath $log -Append -Encoding utf8 }
  }
  Log 'ALL STEPS FINISHED'
} finally {
  Remove-Item $lock -ErrorAction SilentlyContinue
}
