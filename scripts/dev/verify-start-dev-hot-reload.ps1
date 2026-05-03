param(
  [int]$StartupTimeoutSeconds = 18,
  [int]$ReloadTimeoutSeconds = 18
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
. (Join-Path $repoRoot 'scripts\dev\start-dev-core.ps1')

$result = Invoke-StartDevHotReloadValidation `
  -RepoRoot $repoRoot `
  -StartupTimeoutSeconds $StartupTimeoutSeconds `
  -ReloadTimeoutSeconds $ReloadTimeoutSeconds

$result | ConvertTo-Json -Depth 8

switch ($result.status) {
  'hot-reload-passed' { exit 0 }
  'hot-reload-failed' { exit 7 }
  'http-probe-failed' { exit 5 }
  'port-blocked' { exit 4 }
  'startup-error' { exit 1 }
  default { exit 6 }
}
