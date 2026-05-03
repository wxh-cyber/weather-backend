param(
  [int]$HardTimeoutSeconds = 5
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
. (Join-Path $repoRoot 'scripts\dev\start-dev-core.ps1')

$result = Invoke-StartDevProbe -RepoRoot $repoRoot -HardTimeoutSeconds $HardTimeoutSeconds

[pscustomobject]@{
  status = $result.status
  elapsedSeconds = $result.elapsedSeconds
  hardTimeoutSeconds = $result.hardTimeoutSeconds
  stdoutPreview = $result.stdoutPreview
  stderrPreview = $result.stderrPreview
} | ConvertTo-Json -Depth 6

switch ($result.status) {
  'started' { exit 0 }
  'startup-error' { exit 1 }
  'hard-timeout' { exit 3 }
  default { exit 1 }
}
