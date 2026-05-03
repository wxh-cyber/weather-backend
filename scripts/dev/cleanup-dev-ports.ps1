$ErrorActionPreference = 'Stop'

$ports = 3000..3005
$candidates = @()
$stopped = @()
$skipped = @()

$netstatLines = netstat -ano -p TCP | Select-String 'LISTENING'

foreach ($line in $netstatLines) {
  $parts = ($line.ToString() -replace '\s+', ' ').Trim().Split(' ')
  if ($parts.Length -lt 5) {
    continue
  }

  $localAddress = $parts[1]
  $state = $parts[3]
  $pidText = $parts[4]

  if ($state -ne 'LISTENING') {
    continue
  }

  $portText = $localAddress.Split(':')[-1]
  $port = 0
  if (-not [int]::TryParse($portText, [ref]$port)) {
    continue
  }
  if ($ports -notcontains $port) {
    continue
  }

  $processId = 0
  if (-not [int]::TryParse($pidText, [ref]$processId)) {
    continue
  }

  if ($candidates | Where-Object { $_.pid -eq $processId }) {
    continue
  }

  $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
  if (-not $process) {
    continue
  }

  $isNode = $process.ProcessName -eq 'node'
  $candidate = [pscustomobject]@{
    pid = $processId
    port = $port
    processName = $process.ProcessName
    canCleanup = $isNode
  }
  $candidates += $candidate

  if ($isNode) {
    Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    $stopped += $processId
  } else {
    $skipped += $processId
  }
}

[pscustomobject]@{
  status = 'ok'
  candidates = @($candidates)
  stoppedPids = @($stopped)
  skippedPids = @($skipped)
} | ConvertTo-Json -Depth 6
