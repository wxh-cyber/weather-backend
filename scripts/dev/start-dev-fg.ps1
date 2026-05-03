param(
  [switch]$ProbeMode,
  [int]$ProbeTimeoutSeconds = 10
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
. (Join-Path $repoRoot 'scripts\dev\start-dev-core.ps1')

$result = if ($ProbeMode) {
  Invoke-StartDevProbe -RepoRoot $repoRoot -HardTimeoutSeconds $ProbeTimeoutSeconds
} else {
  Invoke-StartDevSession -RepoRoot $repoRoot
}

if ($ProbeMode) {
  switch ($result.status) {
    'started' { exit 0 }
    'startup-error' { exit 1 }
    'hard-timeout' { exit 3 }
    default { exit 2 }
  }
}
