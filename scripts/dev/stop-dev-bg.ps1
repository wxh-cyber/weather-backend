$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$runtimeDir = Join-Path $repoRoot '.codex-runtime'
$sessionPath = Join-Path $runtimeDir 'start-dev-bg.session.json'

if (-not (Test-Path -LiteralPath $sessionPath)) {
  [pscustomobject]@{
    status = 'missing-session'
    stoppedPids = @()
    missingPids = @()
  } | ConvertTo-Json -Depth 6
  exit 0
}

$session = Get-Content -LiteralPath $sessionPath -Raw | ConvertFrom-Json
$stopped = @()
$notFound = @()

foreach ($pidValue in @($session.appWatchPid, $session.buildWatchPid, $session.launcherPid)) {
  if (-not $pidValue) {
    continue
  }

  $processId = [int]$pidValue
  $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
  if ($process) {
    Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    $stopped += $processId
  } else {
    $notFound += $processId
  }
}

Remove-Item -LiteralPath $sessionPath -Force -ErrorAction SilentlyContinue

[pscustomobject]@{
  status = 'stopped'
  stoppedPids = @($stopped)
  missingPids = @($notFound)
} | ConvertTo-Json -Depth 6
