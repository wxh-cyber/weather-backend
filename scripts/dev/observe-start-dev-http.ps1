param(
  [int]$ObservationSeconds = 45,
  [int]$HardTimeoutSeconds = 60
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
. (Join-Path $repoRoot 'scripts\dev\start-dev-core.ps1')

$result = Invoke-StartDevObservation `
  -RepoRoot $repoRoot `
  -ObservationSeconds $ObservationSeconds `
  -HardTimeoutSeconds $HardTimeoutSeconds `
  -EnableHttpProbe

$result | ConvertTo-Json -Depth 6

switch ($result.status) {
  'started-with-http' { exit 0 }
  'http-probe-failed' { exit 5 }
  'port-blocked' { exit 4 }
  'startup-error' { exit 1 }
  'hard-timeout' { exit 3 }
  default { exit 2 }
}
