$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$ports = 3000..3005
$entries = New-Object System.Collections.Generic.List[object]

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

  $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
  $processName = if ($process) { $process.ProcessName } else { $null }
  $startTime = $null
  if ($process) {
    try {
      $startTime = $process.StartTime.ToString('o')
    } catch {
      $startTime = $null
    }
  }

  $isNode = $processName -eq 'node'
  $isLikelyBackend = $false
  if ($isNode) {
    $isLikelyBackend = $true
  }

  $entries.Add([pscustomobject]@{
    port = $port
    pid = $processId
    processName = $processName
    startTime = $startTime
    isNode = $isNode
    isLikelyBackend = $isLikelyBackend
  })
}

$deduped = $entries |
  Sort-Object port, pid -Unique

[pscustomobject]@{
  status = 'ok'
  repoRoot = $repoRoot
  occupiedPorts = @($deduped)
} | ConvertTo-Json -Depth 6
