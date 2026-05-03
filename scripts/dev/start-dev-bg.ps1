param(
  [double]$StartupWaitSeconds = 1,
  [int]$BasePort = 3000,
  [int]$MaxPort = 3005
)

$ErrorActionPreference = 'Stop'

function Get-ListenersInRange {
  param(
    [int]$StartPort,
    [int]$EndPort
  )

  $listeners = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
    Where-Object { $_.LocalPort -ge $StartPort -and $_.LocalPort -le $EndPort } |
    Select-Object LocalAddress, LocalPort, OwningProcess

  return @($listeners)
}

function Get-TextContent {
  param([string]$Path)

  if (-not (Test-Path -LiteralPath $Path)) {
    return ''
  }

  $content = Get-Content -LiteralPath $Path -Raw -ErrorAction SilentlyContinue
  if ($null -eq $content) {
    return ''
  }

  return [string]$content
}

$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$runtimeDir = Join-Path $repoRoot '.codex-runtime'
$sessionPath = Join-Path $runtimeDir 'start-dev-bg.session.json'
$launchConfigPath = Join-Path $runtimeDir 'start-dev-bg.launch.json'
$buildStdoutPath = Join-Path $runtimeDir 'start-dev-build.stdout.log'
$buildStderrPath = Join-Path $runtimeDir 'start-dev-build.stderr.log'
$appStdoutPath = Join-Path $runtimeDir 'start-dev-app.stdout.log'
$appStderrPath = Join-Path $runtimeDir 'start-dev-app.stderr.log'
$launcherScriptPath = Join-Path $repoRoot 'scripts\dev\launch-start-dev-bg.js'

New-Item -ItemType Directory -Path $runtimeDir -Force | Out-Null

if (-not (Test-Path -LiteralPath $launcherScriptPath)) {
  throw "Detached launcher script not found: $launcherScriptPath"
}

$existingSession = $null
if (Test-Path -LiteralPath $sessionPath) {
  try {
    $existingSession = Get-Content -LiteralPath $sessionPath -Raw | ConvertFrom-Json
  } catch {
    $existingSession = $null
  }
}

if ($existingSession) {
  $buildProcess = $null
  $appProcess = $null
  if ($existingSession.buildWatchPid) {
    $buildProcess = Get-Process -Id ([int]$existingSession.buildWatchPid) -ErrorAction SilentlyContinue
  }
  if ($existingSession.appWatchPid) {
    $appProcess = Get-Process -Id ([int]$existingSession.appWatchPid) -ErrorAction SilentlyContinue
  }
  if ($buildProcess -or $appProcess) {
    [pscustomobject]@{
      status = 'already-running'
      launcherPid = $existingSession.launcherPid
      buildWatchPid = $existingSession.buildWatchPid
      appWatchPid = $existingSession.appWatchPid
      sessionPath = $sessionPath
      stdoutReady = (Test-Path -LiteralPath $buildStdoutPath) -or (Test-Path -LiteralPath $appStdoutPath)
      stderrHasError = $false
    } | ConvertTo-Json -Depth 6
    exit 0
  }
}

Remove-Item -LiteralPath $sessionPath, $launchConfigPath -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $buildStdoutPath, $buildStderrPath, $appStdoutPath, $appStderrPath -Force -ErrorAction SilentlyContinue

$listenersBefore = Get-ListenersInRange -StartPort $BasePort -EndPort $MaxPort
$preExistingPorts = @($listenersBefore | Select-Object -ExpandProperty LocalPort -Unique | Sort-Object | ForEach-Object { [int]$_ })

$launchConfig = [pscustomobject]@{
  basePort = $BasePort
  maxPort = $MaxPort
  preExistingPorts = $preExistingPorts
}
$launchConfig | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $launchConfigPath -Encoding UTF8

$launcher = Start-Process -FilePath 'node' `
  -ArgumentList @($launcherScriptPath) `
  -WorkingDirectory $repoRoot `
  -PassThru `
  -WindowStyle Hidden

Start-Sleep -Seconds $StartupWaitSeconds

$session = $null
if (Test-Path -LiteralPath $sessionPath) {
  $session = Get-Content -LiteralPath $sessionPath -Raw | ConvertFrom-Json
}

$buildStderr = Get-TextContent -Path $buildStderrPath
$appStderr = Get-TextContent -Path $appStderrPath

[pscustomobject]@{
  status = 'starting'
  launcherPid = $launcher.Id
  buildWatchPid = if ($session) { $session.buildWatchPid } else { $null }
  appWatchPid = if ($session) { $session.appWatchPid } else { $null }
  sessionPath = $sessionPath
  stdoutReady = (Test-Path -LiteralPath $buildStdoutPath) -or (Test-Path -LiteralPath $appStdoutPath)
  stderrHasError = (-not [string]::IsNullOrWhiteSpace($buildStderr)) -or (-not [string]::IsNullOrWhiteSpace($appStderr))
} | ConvertTo-Json -Depth 6
