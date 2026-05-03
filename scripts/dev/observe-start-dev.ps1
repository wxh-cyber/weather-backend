param(
  [int]$ObservationSeconds = 8,
  [int]$HardTimeoutSeconds = 12
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
. (Join-Path $repoRoot 'scripts\dev\start-dev-core.ps1')

$result = Invoke-StartDevObservation `
  -RepoRoot $repoRoot `
  -ObservationSeconds $ObservationSeconds `
  -HardTimeoutSeconds $HardTimeoutSeconds

$result | ConvertTo-Json -Depth 6

switch ($result.status) {
  'started-in-foreground' { exit 0 }
  'port-blocked' { exit 4 }
  'startup-error' { exit 1 }
  'hard-timeout' { exit 3 }
  default { exit 2 }
}
