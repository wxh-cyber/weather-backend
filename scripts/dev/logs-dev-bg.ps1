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

$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$runtimeDir = Join-Path $repoRoot '.codex-runtime'
$sessionPath = Join-Path $runtimeDir 'start-dev-bg.session.json'
$defaultBuildStdoutPath = Join-Path $runtimeDir 'start-dev-build.stdout.log'
$defaultBuildStderrPath = Join-Path $runtimeDir 'start-dev-build.stderr.log'
$defaultAppStdoutPath = Join-Path $runtimeDir 'start-dev-app.stdout.log'
$defaultAppStderrPath = Join-Path $runtimeDir 'start-dev-app.stderr.log'

if (-not (Test-Path -LiteralPath $sessionPath)) {
  [pscustomobject]@{
    status = 'missing-session'
    buildStdoutPreview = ''
    buildStderrPreview = ''
    appStdoutPreview = ''
    appStderrPreview = ''
  } | ConvertTo-Json -Depth 6
  exit 0
}

$session = Get-Content -LiteralPath $sessionPath -Raw | ConvertFrom-Json

$buildStdoutPath = if ($session.buildStdoutPath -and (Test-Path -LiteralPath $session.buildStdoutPath)) { $session.buildStdoutPath } else { $defaultBuildStdoutPath }
$buildStderrPath = if ($session.buildStderrPath -and (Test-Path -LiteralPath $session.buildStderrPath)) { $session.buildStderrPath } else { $defaultBuildStderrPath }
$appStdoutPath = if ($session.appStdoutPath -and (Test-Path -LiteralPath $session.appStdoutPath)) { $session.appStdoutPath } else { $defaultAppStdoutPath }
$appStderrPath = if ($session.appStderrPath -and (Test-Path -LiteralPath $session.appStderrPath)) { $session.appStderrPath } else { $defaultAppStderrPath }

$buildStdout = Get-TextContent -Path $buildStdoutPath
$buildStderr = Get-TextContent -Path $buildStderrPath
$appStdout = Get-TextContent -Path $appStdoutPath
$appStderr = Get-TextContent -Path $appStderrPath

[pscustomobject]@{
  status = 'ok'
  buildStdoutPreview = $buildStdout.Substring(0, [Math]::Min($buildStdout.Length, 1200))
  buildStderrPreview = $buildStderr.Substring(0, [Math]::Min($buildStderr.Length, 800))
  appStdoutPreview = $appStdout.Substring(0, [Math]::Min($appStdout.Length, 1200))
  appStderrPreview = $appStderr.Substring(0, [Math]::Min($appStderr.Length, 800))
} | ConvertTo-Json -Depth 6
