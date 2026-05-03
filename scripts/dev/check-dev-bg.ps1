$ErrorActionPreference = 'Stop'

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

function Test-Endpoint {
  param(
    [int]$Port,
    [string]$Path
  )

  $url = "http://127.0.0.1:$Port$Path"
  try {
    $response = Invoke-WebRequest -Uri $url -TimeoutSec 2 -UseBasicParsing
    $content = [string]$response.Content
    return [pscustomobject]@{
      url = $url
      ok = $true
      statusCode = [int]$response.StatusCode
      snippet = $content.Substring(0, [Math]::Min($content.Length, 200))
    }
  } catch {
    $statusCode = $null
    if ($_.Exception.Response -and $_.Exception.Response.StatusCode) {
      $statusCode = [int]$_.Exception.Response.StatusCode
    }

    return [pscustomobject]@{
      url = $url
      ok = $false
      statusCode = $statusCode
      snippet = $_.Exception.Message
    }
  }
}

$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$runtimeDir = Join-Path $repoRoot '.codex-runtime'
$sessionPath = Join-Path $runtimeDir 'start-dev-bg.session.json'

if (-not (Test-Path -LiteralPath $sessionPath)) {
  [pscustomobject]@{
    status = 'missing-session'
    activePort = $null
    rootProbe = $null
    citiesProbe = $null
    errorSummary = @('No tracked background session found.')
    successMarkers = $null
  } | ConvertTo-Json -Depth 6
  exit 0
}

$session = Get-Content -LiteralPath $sessionPath -Raw | ConvertFrom-Json
$buildStdout = Get-TextContent -Path $session.buildStdoutPath
$buildStderr = Get-TextContent -Path $session.buildStderrPath
$appStdout = Get-TextContent -Path $session.appStdoutPath
$appStderr = Get-TextContent -Path $session.appStderrPath
$appRuntimeStderr = (($appStderr -split "`r?`n") | Where-Object {
  -not [string]::IsNullOrWhiteSpace($_) -and ($_ -notmatch '^\[app-watch ')
}) -join "`n"

$buildProcess = $null
$appProcess = $null
if ($session.buildWatchPid) {
  $buildProcess = Get-Process -Id ([int]$session.buildWatchPid) -ErrorAction SilentlyContinue
}
if ($session.appWatchPid) {
  $appProcess = Get-Process -Id ([int]$session.appWatchPid) -ErrorAction SilentlyContinue
}

$keyword = [uri]::EscapeDataString('北京')
$rootProbe = $null
$citiesProbe = $null
$activePort = $null
$errorSummary = New-Object System.Collections.Generic.List[string]

$successMarkers = [pscustomobject]@{
  buildWatchAlive = $null -ne $buildProcess
  appWatchAlive = $null -ne $appProcess
  buildHasCompileError = ($buildStdout -match 'Found [1-9]\d* error') -or ($buildStderr -match 'TS\d{4}')
  appHasPortConflict = $appStderr -match 'EADDRINUSE'
  appHasRuntimeError = -not [string]::IsNullOrWhiteSpace($appRuntimeStderr)
  appStarted = ($appStdout -match 'Nest application successfully started') -or ($appStdout -match '\[app-watch .*\] Started app process \d+\.')
}

if ($successMarkers.buildHasCompileError) {
  $errorSummary.Add('Build watch reported TypeScript errors.')
}
if ($successMarkers.appHasPortConflict) {
  $errorSummary.Add('Detected EADDRINUSE in app stderr.')
}
if ($successMarkers.appHasRuntimeError -and -not $successMarkers.appHasPortConflict) {
  $errorSummary.Add('App watch reported runtime errors.')
}
if (-not $successMarkers.buildWatchAlive -and -not $successMarkers.buildHasCompileError) {
  $errorSummary.Add('Build watch process is not running.')
}
if (-not $successMarkers.appWatchAlive -and -not $successMarkers.appHasRuntimeError) {
  $errorSummary.Add('App watch process is not running.')
}

if (-not $successMarkers.buildHasCompileError -and -not $successMarkers.appHasRuntimeError -and -not $successMarkers.appHasPortConflict) {
  foreach ($port in ([int]$session.basePort)..([int]$session.maxPort)) {
    $probe = Test-Endpoint -Port $port -Path '/'
    if ($probe.ok) {
      $rootProbe = $probe
      $citiesProbe = Test-Endpoint -Port $port -Path "/cities?keyword=$keyword"
      $activePort = [int]$port
      break
    }
  }
}

$status = 'starting'
if ($successMarkers.buildHasCompileError) {
  $status = 'compile-error'
} elseif ($successMarkers.appHasPortConflict) {
  $status = 'blocked-by-port'
} elseif ($successMarkers.appHasRuntimeError) {
  $status = 'runtime-error'
} elseif ($rootProbe -and $rootProbe.ok -and $citiesProbe -and $citiesProbe.ok) {
  $status = 'started'
}

[pscustomobject]@{
  status = $status
  buildWatchPid = $session.buildWatchPid
  appWatchPid = $session.appWatchPid
  activePort = $activePort
  rootProbe = $rootProbe
  citiesProbe = $citiesProbe
  errorSummary = @($errorSummary)
  successMarkers = $successMarkers
  buildStdoutPreview = $buildStdout.Substring(0, [Math]::Min($buildStdout.Length, 800))
  buildStderrPreview = $buildStderr.Substring(0, [Math]::Min($buildStderr.Length, 400))
  appStdoutPreview = $appStdout.Substring(0, [Math]::Min($appStdout.Length, 800))
  appStderrPreview = $appStderr.Substring(0, [Math]::Min($appStderr.Length, 400))
} | ConvertTo-Json -Depth 6
