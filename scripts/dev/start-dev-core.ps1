function New-ManagedProcess {
  param(
    [string]$RepoRoot,
    [string]$RuntimeDir,
    [string]$Name,
    [string]$FilePath,
    [string[]]$Arguments
  )

  $stdoutPath = Join-Path $RuntimeDir ("{0}.stdout.log" -f $Name)
  $stderrPath = Join-Path $RuntimeDir ("{0}.stderr.log" -f $Name)

  Remove-Item -LiteralPath $stdoutPath, $stderrPath -Force -ErrorAction SilentlyContinue

  $process = Start-Process `
    -FilePath $FilePath `
    -ArgumentList $Arguments `
    -WorkingDirectory $RepoRoot `
    -RedirectStandardOutput $stdoutPath `
    -RedirectStandardError $stderrPath `
    -PassThru `
    -WindowStyle Hidden

  if (-not $process) {
    throw "Failed to start process: $Name"
  }

  return [pscustomobject]@{
    Name = $Name
    Process = $process
    StdoutPath = $stdoutPath
    StderrPath = $stderrPath
    StdoutOffset = 0L
    StderrOffset = 0L
    StdoutBuilder = (New-Object System.Text.StringBuilder)
    StderrBuilder = (New-Object System.Text.StringBuilder)
  }
}

function Read-AppendedText {
  param(
    [string]$Path,
    [long]$Offset
  )

  if (-not (Test-Path -LiteralPath $Path)) {
    return [pscustomobject]@{
      Text = ''
      Offset = $Offset
    }
  }

  $fileInfo = Get-Item -LiteralPath $Path
  $length = [long]$fileInfo.Length

  if ($length -le $Offset) {
    return [pscustomobject]@{
      Text = ''
      Offset = $Offset
    }
  }

  $stream = [System.IO.File]::Open($Path, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
  try {
    [void]$stream.Seek($Offset, [System.IO.SeekOrigin]::Begin)
    $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::UTF8, $true, 4096, $true)
    try {
      $text = $reader.ReadToEnd()
    } finally {
      $reader.Dispose()
    }

    return [pscustomobject]@{
      Text = $text
      Offset = $length
    }
  } finally {
    $stream.Dispose()
  }
}

function Write-PrefixedChunk {
  param(
    [string]$StreamKind,
    [string]$Prefix,
    [string]$Chunk,
    [System.Text.StringBuilder]$Builder
  )

  if ([string]::IsNullOrEmpty($Chunk)) {
    return
  }

  [void]$Builder.Append($Chunk)

  $normalized = $Chunk -replace "`r`n", "`n"
  $lines = $normalized.Split("`n")
  for ($index = 0; $index -lt $lines.Length; $index++) {
    $line = $lines[$index]
    $isLastEmptyLine = ($index -eq ($lines.Length - 1)) -and ($line -eq '')
    if ($isLastEmptyLine) {
      continue
    }
    $message = "[{0}] {1}" -f $Prefix, $line
    if ($StreamKind -eq 'stderr') {
      [Console]::Error.WriteLine($message)
    } else {
      [Console]::Out.WriteLine($message)
    }
  }
}

function Flush-ManagedProcessOutput {
  param($ManagedProcess)

  $stdoutChunk = Read-AppendedText -Path $ManagedProcess.StdoutPath -Offset $ManagedProcess.StdoutOffset
  $ManagedProcess.StdoutOffset = $stdoutChunk.Offset
  Write-PrefixedChunk -StreamKind 'stdout' -Prefix $ManagedProcess.Name -Chunk $stdoutChunk.Text -Builder $ManagedProcess.StdoutBuilder

  $stderrChunk = Read-AppendedText -Path $ManagedProcess.StderrPath -Offset $ManagedProcess.StderrOffset
  $ManagedProcess.StderrOffset = $stderrChunk.Offset
  Write-PrefixedChunk -StreamKind 'stderr' -Prefix ("{0}:err" -f $ManagedProcess.Name) -Chunk $stderrChunk.Text -Builder $ManagedProcess.StderrBuilder
}

function Stop-ManagedProcess {
  param($ManagedProcess)

  if (-not $ManagedProcess) {
    return
  }

  $process = $ManagedProcess.Process
  $startedAppPids = @()
  if ($ManagedProcess.Name -eq 'app-fg' -and $ManagedProcess.StdoutBuilder) {
    $stdoutText = $ManagedProcess.StdoutBuilder.ToString()
    $pidMatches = [regex]::Matches($stdoutText, 'Started app process (\d+)\.')
    foreach ($match in $pidMatches) {
      $pidValue = 0
      if ([int]::TryParse($match.Groups[1].Value, [ref]$pidValue)) {
        $startedAppPids += $pidValue
      }
    }
    $startedAppPids = $startedAppPids | Select-Object -Unique
  }

  foreach ($pid in $startedAppPids) {
    try {
      $childProcess = Get-Process -Id $pid -ErrorAction SilentlyContinue
      if ($childProcess -and -not $childProcess.HasExited) {
        Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
        $childProcess.WaitForExit(1500) | Out-Null
      }
    } catch {
    }
  }

  if ($process -and -not $process.HasExited) {
    try {
      Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
      $process.WaitForExit(1500) | Out-Null
    } catch {
    }
  }

  foreach ($path in @($ManagedProcess.StdoutPath, $ManagedProcess.StderrPath)) {
    Remove-Item -LiteralPath $path -Force -ErrorAction SilentlyContinue
  }
}

function Get-PreviewText {
  param(
    [System.Text.StringBuilder]$Builder,
    [int]$MaxLength
  )

  $text = $Builder.ToString()
  return $text.Substring(0, [Math]::Min($text.Length, $MaxLength))
}

function Get-BuildStatePath {
  param(
    [string]$RuntimeDir
  )

  return (Join-Path $RuntimeDir 'start-dev-build-state.json')
}

function Set-BuildState {
  param(
    [string]$StatePath,
    [string]$Status,
    [int]$Generation
  )

  [pscustomobject]@{
    generation = $Generation
    status = $Status
    updatedAt = (Get-Date).ToString('o')
  } | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $StatePath -Encoding UTF8
}

function Get-BuildState {
  param(
    [string]$StatePath
  )

  if (-not (Test-Path -LiteralPath $StatePath)) {
    return $null
  }

  try {
    return (Get-Content -LiteralPath $StatePath -Raw | ConvertFrom-Json)
  } catch {
    return $null
  }
}

function Update-BuildStateFromOutput {
  param(
    $BuildProcess,
    [string]$StatePath,
    [ref]$GenerationRef,
    [ref]$LastBuildStdoutLengthRef,
    [ref]$LastBuildStderrLengthRef
  )

  $stdoutText = $BuildProcess.StdoutBuilder.ToString()
  $stderrText = $BuildProcess.StderrBuilder.ToString()
  $stdoutDelta = if ($stdoutText.Length -gt $LastBuildStdoutLengthRef.Value) {
    $stdoutText.Substring($LastBuildStdoutLengthRef.Value)
  } else {
    ''
  }
  $stderrDelta = if ($stderrText.Length -gt $LastBuildStderrLengthRef.Value) {
    $stderrText.Substring($LastBuildStderrLengthRef.Value)
  } else {
    ''
  }

  $LastBuildStdoutLengthRef.Value = $stdoutText.Length
  $LastBuildStderrLengthRef.Value = $stderrText.Length

  $combined = "$stdoutDelta`n$stderrDelta"
  $setBuilding = $combined -match 'Starting compilation in watch mode'
  $setReady = $combined -match 'Found 0 errors\. Watching for file changes\.'
  $hasCompileError = $combined -match ' error TS\d+:'

  if ($setBuilding) {
    Set-BuildState -StatePath $StatePath -Status 'building' -Generation $GenerationRef.Value
  }

  if ($setReady -and -not $hasCompileError) {
    $GenerationRef.Value += 1
    Set-BuildState -StatePath $StatePath -Status 'ready' -Generation $GenerationRef.Value
  }
}

function Invoke-JsonHttpProbe {
  param(
    [int[]]$Ports,
    [int]$TimeoutSeconds = 2
  )

  foreach ($port in $Ports) {
    $rootUri = "http://127.0.0.1:$port/"
    $citiesUri = "http://127.0.0.1:$port/cities?keyword=%E5%8C%97%E4%BA%AC"

    try {
      $rootResponse = Invoke-RestMethod -Uri $rootUri -TimeoutSec $TimeoutSeconds -ErrorAction Stop
      $citiesResponse = Invoke-RestMethod -Uri $citiesUri -TimeoutSec $TimeoutSeconds -ErrorAction Stop

      $rootSucceeded =
        $null -ne $rootResponse -and
        $rootResponse.code -eq 0 -and
        $rootResponse.message -eq 'success' -and
        $rootResponse.data -eq 'Hello World!'

      $citiesData = if ($null -ne $citiesResponse) { $citiesResponse.data } else { $null }
      $citiesDataItems = @()
      if ($null -ne $citiesData) {
        if ($citiesData -is [string]) {
          $citiesDataItems = @($citiesData)
        } elseif ($citiesData -is [System.Collections.IEnumerable]) {
          $citiesDataItems = @($citiesData)
        } else {
          $citiesDataItems = @($citiesData)
        }
      }
      $citiesSucceeded =
        $null -ne $citiesResponse -and
        $citiesResponse.code -eq 0 -and
        $citiesDataItems.Count -ge 1

      if ($rootSucceeded -or $citiesSucceeded) {
        return [pscustomobject]@{
          activePort = $port
          rootProbeSucceeded = $rootSucceeded
          citiesProbeSucceeded = $citiesSucceeded
          rootResponsePreview = ($rootResponse | ConvertTo-Json -Depth 6 -Compress)
          citiesResponsePreview = ($citiesResponse | ConvertTo-Json -Depth 6 -Compress)
        }
      }
    } catch {
      continue
    }
  }

  return $null
}

function Invoke-StartDevSession {
  param(
    [string]$RepoRoot,
    [switch]$ProbeMode,
    [int]$ProbeTimeoutSeconds = 10,
    [int]$HardTimeoutSeconds = 12
  )

  $nestCliPath = Join-Path $RepoRoot 'node_modules\@nestjs\cli\bin\nest.js'
  $appRunnerPath = Join-Path $RepoRoot 'scripts\dev\app-watch-runner.js'
  $runtimeDir = Join-Path $RepoRoot '.codex-runtime'
  $buildStatePath = Get-BuildStatePath -RuntimeDir $runtimeDir
  New-Item -ItemType Directory -Path $runtimeDir -Force | Out-Null
  Set-BuildState -StatePath $buildStatePath -Status 'building' -Generation 0

  $managedProcesses = New-Object System.Collections.Generic.List[object]
  $resultStatus = $null
  $buildGeneration = 0
  $lastBuildStdoutLength = 0
  $lastBuildStderrLength = 0

  try {
    [Console]::Out.WriteLine('[start:dev] starting build and app watchers in current terminal')

    $buildProcess = New-ManagedProcess -RepoRoot $RepoRoot -RuntimeDir $runtimeDir -Name 'build-fg' -FilePath 'node' -Arguments @($nestCliPath, 'build', '--watch')
    $managedProcesses.Add($buildProcess) | Out-Null

    $appProcess = New-ManagedProcess -RepoRoot $RepoRoot -RuntimeDir $runtimeDir -Name 'app-fg' -FilePath 'node' -Arguments @($appRunnerPath)
    $managedProcesses.Add($appProcess) | Out-Null

    $startedAt = Get-Date

    while ($true) {
      Start-Sleep -Milliseconds 300

      foreach ($managedProcess in $managedProcesses) {
        Flush-ManagedProcessOutput -ManagedProcess $managedProcess
      }

      Update-BuildStateFromOutput `
        -BuildProcess $buildProcess `
        -StatePath $buildStatePath `
        -GenerationRef ([ref]$buildGeneration) `
        -LastBuildStdoutLengthRef ([ref]$lastBuildStdoutLength) `
        -LastBuildStderrLengthRef ([ref]$lastBuildStderrLength)

      foreach ($managedProcess in $managedProcesses) {
        if ($managedProcess.Process.HasExited) {
          $resultStatus = 'startup-error'
          break
        }
      }

      if ($resultStatus) {
        break
      }

      if (-not $ProbeMode) {
        continue
      }

      $elapsedSeconds = ((Get-Date) - $startedAt).TotalSeconds
      if ($elapsedSeconds -ge $HardTimeoutSeconds) {
        $resultStatus = 'hard-timeout'
        break
      }

      if ($elapsedSeconds -ge $ProbeTimeoutSeconds) {
        $hasBuildSignal = $buildProcess.Process -and -not $buildProcess.Process.HasExited
        $hasAppSignal = $appProcess.Process -and -not $appProcess.Process.HasExited
        $resultStatus = if ($hasBuildSignal -and $hasAppSignal) { 'started' } else { 'timed-out-without-signal' }
        break
      }
    }
  } finally {
    [Console]::Out.WriteLine('[start:dev] stopping foreground watchers')
    Remove-Item -LiteralPath $buildStatePath -Force -ErrorAction SilentlyContinue
    for ($index = $managedProcesses.Count - 1; $index -ge 0; $index--) {
      Flush-ManagedProcessOutput -ManagedProcess $managedProcesses[$index]
      Stop-ManagedProcess -ManagedProcess $managedProcesses[$index]
    }
  }

  if (-not $ProbeMode) {
    return $null
  }

  $elapsedSeconds = [Math]::Round(((Get-Date) - $startedAt).TotalSeconds, 1)
  $buildStdout = if ($buildProcess) { Get-PreviewText -Builder $buildProcess.StdoutBuilder -MaxLength 1200 } else { '' }
  $buildStderr = if ($buildProcess) { Get-PreviewText -Builder $buildProcess.StderrBuilder -MaxLength 800 } else { '' }
  $appStdout = if ($appProcess) { Get-PreviewText -Builder $appProcess.StdoutBuilder -MaxLength 1200 } else { '' }
  $appStderr = if ($appProcess) { Get-PreviewText -Builder $appProcess.StderrBuilder -MaxLength 800 } else { '' }

  return [pscustomobject]@{
    status = $resultStatus
    elapsedSeconds = $elapsedSeconds
    hardTimeoutSeconds = $HardTimeoutSeconds
    probeTimeoutSeconds = $ProbeTimeoutSeconds
    buildStdoutPreview = $buildStdout
    buildStderrPreview = $buildStderr
    appStdoutPreview = $appStdout
    appStderrPreview = $appStderr
  }
}

function Invoke-StartDevProbe {
  param(
    [string]$RepoRoot,
    [int]$HardTimeoutSeconds = 5
  )

  $nestCliPath = Join-Path $RepoRoot 'node_modules\@nestjs\cli\bin\nest.js'
  $appRunnerPath = Join-Path $RepoRoot 'scripts\dev\app-watch-runner.js'
  $foregroundScriptPath = Join-Path $RepoRoot 'scripts\dev\start-dev-fg.ps1'
  $runtimeDir = Join-Path $RepoRoot '.codex-runtime'
  New-Item -ItemType Directory -Path $runtimeDir -Force | Out-Null

  foreach ($requiredPath in @($nestCliPath, $appRunnerPath, $foregroundScriptPath)) {
    if (-not (Test-Path -LiteralPath $requiredPath)) {
      return [pscustomobject]@{
        status = 'startup-error'
        elapsedSeconds = 0
        hardTimeoutSeconds = $HardTimeoutSeconds
        stdoutPreview = ''
        stderrPreview = "Missing required path: $requiredPath"
      }
    }
  }

  [Console]::Out.WriteLine('[start:dev:probe] validating foreground start pipeline')

  $probeProcess = $null
  $startedAt = Get-Date

  try {
    $probeProcess = New-ManagedProcess -RepoRoot $RepoRoot -RuntimeDir $runtimeDir -Name 'probe-child' -FilePath 'node' -Arguments @('-e', "console.log('probe-child-ok')")

    while ($true) {
      Start-Sleep -Milliseconds 200
      Flush-ManagedProcessOutput -ManagedProcess $probeProcess

      if ($probeProcess.Process.HasExited) {
        $status = if ($probeProcess.Process.ExitCode -eq 0) { 'started' } else { 'startup-error' }
        break
      }

      $elapsedSeconds = ((Get-Date) - $startedAt).TotalSeconds
      if ($elapsedSeconds -ge $HardTimeoutSeconds) {
        $status = 'hard-timeout'
        break
      }
    }
  } finally {
    if ($probeProcess) {
      Flush-ManagedProcessOutput -ManagedProcess $probeProcess
      Stop-ManagedProcess -ManagedProcess $probeProcess
    }
  }

  $elapsedSeconds = [Math]::Round(((Get-Date) - $startedAt).TotalSeconds, 1)
  $stdoutPreview = if ($probeProcess) { Get-PreviewText -Builder $probeProcess.StdoutBuilder -MaxLength 600 } else { '' }
  $stderrPreview = if ($probeProcess) { Get-PreviewText -Builder $probeProcess.StderrBuilder -MaxLength 600 } else { '' }

  return [pscustomobject]@{
    status = $status
    elapsedSeconds = $elapsedSeconds
    hardTimeoutSeconds = $HardTimeoutSeconds
    stdoutPreview = $stdoutPreview
    stderrPreview = $stderrPreview
  }
}

function Invoke-StartDevObservation {
  param(
    [string]$RepoRoot,
    [int]$ObservationSeconds = 8,
    [int]$HardTimeoutSeconds = 12,
    [switch]$EnableHttpProbe
  )

  $nestCliPath = Join-Path $RepoRoot 'node_modules\@nestjs\cli\bin\nest.js'
  $appRunnerPath = Join-Path $RepoRoot 'scripts\dev\app-watch-runner.js'
  $runtimeDir = Join-Path $RepoRoot '.codex-runtime'
  $buildStatePath = Get-BuildStatePath -RuntimeDir $runtimeDir
  New-Item -ItemType Directory -Path $runtimeDir -Force | Out-Null
  Set-BuildState -StatePath $buildStatePath -Status 'building' -Generation 0

  foreach ($requiredPath in @($nestCliPath, $appRunnerPath)) {
    if (-not (Test-Path -LiteralPath $requiredPath)) {
      return [pscustomobject]@{
        status = 'startup-error'
        elapsedSeconds = 0
        observationSeconds = $ObservationSeconds
        hardTimeoutSeconds = $HardTimeoutSeconds
        sawForegroundBanner = $false
        buildOutputSeen = $false
        appOutputSeen = $false
        stdoutPreview = ''
        stderrPreview = "Missing required path: $requiredPath"
      }
    }
  }

  $managedProcesses = New-Object System.Collections.Generic.List[object]
  $resultStatus = $null
  $banner = '[start:dev] starting build and app watchers in current terminal'
  $sawForegroundBanner = $false
  $buildOutputSeen = $false
  $appOutputSeen = $false
  $httpProbeResult = $null
  $startedAt = Get-Date
  $buildGeneration = 0
  $lastBuildStdoutLength = 0
  $lastBuildStderrLength = 0

  try {
    [Console]::Out.WriteLine($banner)
    $sawForegroundBanner = $true

    $buildProcess = New-ManagedProcess -RepoRoot $RepoRoot -RuntimeDir $runtimeDir -Name 'build-fg' -FilePath 'node' -Arguments @($nestCliPath, 'build', '--watch')
    $managedProcesses.Add($buildProcess) | Out-Null

    $appProcess = New-ManagedProcess -RepoRoot $RepoRoot -RuntimeDir $runtimeDir -Name 'app-fg' -FilePath 'node' -Arguments @($appRunnerPath)
    $managedProcesses.Add($appProcess) | Out-Null

    while ($true) {
      Start-Sleep -Milliseconds 300

      foreach ($managedProcess in $managedProcesses) {
        Flush-ManagedProcessOutput -ManagedProcess $managedProcess
      }

      Update-BuildStateFromOutput `
        -BuildProcess $buildProcess `
        -StatePath $buildStatePath `
        -GenerationRef ([ref]$buildGeneration) `
        -LastBuildStdoutLengthRef ([ref]$lastBuildStdoutLength) `
        -LastBuildStderrLengthRef ([ref]$lastBuildStderrLength)

      $buildOutputSeen = $buildOutputSeen -or ($buildProcess.StdoutBuilder.Length -gt 0) -or ($buildProcess.StderrBuilder.Length -gt 0)
      $appOutputSeen = $appOutputSeen -or ($appProcess.StdoutBuilder.Length -gt 0) -or ($appProcess.StderrBuilder.Length -gt 0)

      foreach ($managedProcess in $managedProcesses) {
        if ($managedProcess.Process.HasExited) {
          $resultStatus = 'startup-error'
          break
        }
      }

      $stderrCombined = ''
      foreach ($managedProcess in $managedProcesses) {
        $stderrCombined += $managedProcess.StderrBuilder.ToString()
      }
      if ($stderrCombined -match 'EADDRINUSE') {
        $resultStatus = 'port-blocked'
      }

      if ($resultStatus) {
        break
      }

      if ($EnableHttpProbe -and -not $httpProbeResult) {
        $buildState = Get-BuildState -StatePath $buildStatePath
        if ($buildState -and $buildState.status -eq 'ready') {
          $httpProbeResult = Invoke-JsonHttpProbe -Ports @(3000..3005) -TimeoutSeconds 2
          if ($httpProbeResult) {
            if ($httpProbeResult.rootProbeSucceeded -and $httpProbeResult.citiesProbeSucceeded) {
              $resultStatus = 'started-with-http'
            } elseif ($httpProbeResult.rootProbeSucceeded) {
              $resultStatus = 'http-probe-failed'
            }
          }
        }
      }

      $elapsedSeconds = ((Get-Date) - $startedAt).TotalSeconds
      if ($elapsedSeconds -ge $HardTimeoutSeconds) {
        $resultStatus = 'hard-timeout'
        break
      }

      if ($elapsedSeconds -ge $ObservationSeconds) {
        $resultStatus = if ($EnableHttpProbe) { 'http-probe-failed' } else { 'started-in-foreground' }
        break
      }
    }
  } finally {
    [Console]::Out.WriteLine('[start:dev] stopping foreground watchers')
    Remove-Item -LiteralPath $buildStatePath -Force -ErrorAction SilentlyContinue
    for ($index = $managedProcesses.Count - 1; $index -ge 0; $index--) {
      Flush-ManagedProcessOutput -ManagedProcess $managedProcesses[$index]
      Stop-ManagedProcess -ManagedProcess $managedProcesses[$index]
    }
  }

  $elapsedSeconds = [Math]::Round(((Get-Date) - $startedAt).TotalSeconds, 1)
  $stdoutPreviewParts = New-Object System.Collections.Generic.List[string]
  $stderrPreviewParts = New-Object System.Collections.Generic.List[string]

  if ($buildProcess) {
    $stdoutPreviewParts.Add("[build] $(Get-PreviewText -Builder $buildProcess.StdoutBuilder -MaxLength 700)") | Out-Null
    $stderrPreviewParts.Add("[build] $(Get-PreviewText -Builder $buildProcess.StderrBuilder -MaxLength 500)") | Out-Null
  }
  if ($appProcess) {
    $stdoutPreviewParts.Add("[app] $(Get-PreviewText -Builder $appProcess.StdoutBuilder -MaxLength 700)") | Out-Null
    $stderrPreviewParts.Add("[app] $(Get-PreviewText -Builder $appProcess.StderrBuilder -MaxLength 500)") | Out-Null
  }

  $stdoutPreview = (($stdoutPreviewParts | Where-Object { $_ -ne '[build] ' -and $_ -ne '[app] ' }) -join "`n").Trim()
  $stderrPreview = (($stderrPreviewParts | Where-Object { $_ -ne '[build] ' -and $_ -ne '[app] ' }) -join "`n").Trim()

  return [pscustomobject]@{
    status = $resultStatus
    elapsedSeconds = $elapsedSeconds
    observationSeconds = $ObservationSeconds
    hardTimeoutSeconds = $HardTimeoutSeconds
    sawForegroundBanner = $sawForegroundBanner
    buildOutputSeen = $buildOutputSeen
    appOutputSeen = $appOutputSeen
    activePort = if ($httpProbeResult) { $httpProbeResult.activePort } else { $null }
    rootProbeSucceeded = if ($httpProbeResult) { [bool]$httpProbeResult.rootProbeSucceeded } else { $false }
    citiesProbeSucceeded = if ($httpProbeResult) { [bool]$httpProbeResult.citiesProbeSucceeded } else { $false }
    rootResponsePreview = if ($httpProbeResult) { $httpProbeResult.rootResponsePreview } else { '' }
    citiesResponsePreview = if ($httpProbeResult) { $httpProbeResult.citiesResponsePreview } else { '' }
    stdoutPreview = $stdoutPreview
    stderrPreview = $stderrPreview
  }
}

function Invoke-StartDevHotReloadValidation {
  param(
    [string]$RepoRoot,
    [string]$TargetFileRelativePath = 'src\app.service.ts',
    [string]$OriginalMarker = "return 'Hello World!';",
    [string]$TemporaryMarker = "return 'Hello World! [hot-reload]';",
    [int]$StartupTimeoutSeconds = 18,
    [int]$ReloadTimeoutSeconds = 18
  )

  $nestCliPath = Join-Path $RepoRoot 'node_modules\@nestjs\cli\bin\nest.js'
  $appRunnerPath = Join-Path $RepoRoot 'scripts\dev\app-watch-runner.js'
  $runtimeDir = Join-Path $RepoRoot '.codex-runtime'
  $buildStatePath = Get-BuildStatePath -RuntimeDir $runtimeDir
  $targetFile = Join-Path $RepoRoot $TargetFileRelativePath
  New-Item -ItemType Directory -Path $runtimeDir -Force | Out-Null
  Set-BuildState -StatePath $buildStatePath -Status 'building' -Generation 0

  foreach ($requiredPath in @($nestCliPath, $appRunnerPath, $targetFile)) {
    if (-not (Test-Path -LiteralPath $requiredPath)) {
      return [pscustomobject]@{
        status = 'startup-error'
        activePort = $null
        reloadObserved = $false
        restoreObserved = $false
        rootResponsePreview = ''
        reloadResponsePreview = ''
        restoreResponsePreview = ''
        stdoutPreview = ''
        stderrPreview = "Missing required path: $requiredPath"
      }
    }
  }

  $originalContent = Get-Content -LiteralPath $targetFile -Raw
  $temporaryContent = $originalContent -replace [regex]::Escape($OriginalMarker), $TemporaryMarker
  if ($temporaryContent -eq $originalContent) {
    return [pscustomobject]@{
      status = 'startup-error'
      activePort = $null
      reloadObserved = $false
      restoreObserved = $false
      rootResponsePreview = ''
      reloadResponsePreview = ''
      restoreResponsePreview = ''
      stdoutPreview = ''
      stderrPreview = "Failed to prepare hot reload mutation for $TargetFileRelativePath"
    }
  }

  $managedProcesses = New-Object System.Collections.Generic.List[object]
  $buildProcess = $null
  $appProcess = $null
  $activePort = $null
  $initialRootResponse = ''
  $reloadResponsePreview = ''
  $restoreResponsePreview = ''
  $reloadObserved = $false
  $restoreObserved = $false
  $sawAddressInUse = $false
  $status = $null
  $buildGeneration = 0
  $lastBuildStdoutLength = 0
  $lastBuildStderrLength = 0
  $startupGeneration = 0

  try {
    [Console]::Out.WriteLine('[start:dev] starting build and app watchers in current terminal')

    $buildProcess = New-ManagedProcess -RepoRoot $RepoRoot -RuntimeDir $runtimeDir -Name 'build-fg' -FilePath 'node' -Arguments @($nestCliPath, 'build', '--watch')
    $managedProcesses.Add($buildProcess) | Out-Null

    $appProcess = New-ManagedProcess -RepoRoot $RepoRoot -RuntimeDir $runtimeDir -Name 'app-fg' -FilePath 'node' -Arguments @($appRunnerPath)
    $managedProcesses.Add($appProcess) | Out-Null

    $startupDeadline = (Get-Date).AddSeconds($StartupTimeoutSeconds)
    while ((Get-Date) -lt $startupDeadline) {
      Start-Sleep -Milliseconds 300
      foreach ($managedProcess in $managedProcesses) {
        Flush-ManagedProcessOutput -ManagedProcess $managedProcess
      }

      Update-BuildStateFromOutput `
        -BuildProcess $buildProcess `
        -StatePath $buildStatePath `
        -GenerationRef ([ref]$buildGeneration) `
        -LastBuildStdoutLengthRef ([ref]$lastBuildStdoutLength) `
        -LastBuildStderrLengthRef ([ref]$lastBuildStderrLength)

      foreach ($managedProcess in $managedProcesses) {
        if ($managedProcess.Process.HasExited) {
          $status = 'startup-error'
          break
        }
      }

      if ($status) {
        break
      }

      $stderrCombined = $buildProcess.StderrBuilder.ToString() + $appProcess.StderrBuilder.ToString()
      if ($stderrCombined -match 'EADDRINUSE') {
        $sawAddressInUse = $true
      }

      $buildState = Get-BuildState -StatePath $buildStatePath
      if ($buildState -and $buildState.status -eq 'ready') {
        $startupProbe = Invoke-JsonHttpProbe -Ports @(3000..3005) -TimeoutSeconds 2
        $appStdoutText = $appProcess.StdoutBuilder.ToString()
        $appReportedStarted = $appStdoutText -match 'Nest application successfully started'
        if ($startupProbe -and $startupProbe.rootProbeSucceeded -and $startupProbe.citiesProbeSucceeded -and $appReportedStarted) {
          $activePort = [int]$startupProbe.activePort
          $initialRootResponse = $startupProbe.rootResponsePreview
          $startupGeneration = [int]$buildState.generation
          break
        }
      }
    }

    if (-not $status -and -not $activePort) {
      $status = if ($sawAddressInUse) { 'port-blocked' } else { 'http-probe-failed' }
    }

    if (-not $status) {
      Set-Content -LiteralPath $targetFile -Value $temporaryContent -NoNewline

      $reloadDeadline = (Get-Date).AddSeconds($ReloadTimeoutSeconds)
      while ((Get-Date) -lt $reloadDeadline) {
        Start-Sleep -Milliseconds 350
        foreach ($managedProcess in $managedProcesses) {
          Flush-ManagedProcessOutput -ManagedProcess $managedProcess
        }

        Update-BuildStateFromOutput `
          -BuildProcess $buildProcess `
          -StatePath $buildStatePath `
          -GenerationRef ([ref]$buildGeneration) `
          -LastBuildStdoutLengthRef ([ref]$lastBuildStdoutLength) `
          -LastBuildStderrLengthRef ([ref]$lastBuildStderrLength)

        $buildState = Get-BuildState -StatePath $buildStatePath
        if (-not $buildState -or $buildState.status -ne 'ready' -or [int]$buildState.generation -le $startupGeneration) {
          continue
        }

        $reloadProbe = Invoke-JsonHttpProbe -Ports @(3000..3005) -TimeoutSeconds 2
        if ($reloadProbe -and $reloadProbe.rootResponsePreview -match '\[hot-reload\]') {
          $reloadObserved = $true
          $activePort = [int]$reloadProbe.activePort
          $reloadResponsePreview = $reloadProbe.rootResponsePreview
          $startupGeneration = [int]$buildState.generation
          break
        }
      }

      Set-Content -LiteralPath $targetFile -Value $originalContent -NoNewline

      $restoreDeadline = (Get-Date).AddSeconds($ReloadTimeoutSeconds)
      while ((Get-Date) -lt $restoreDeadline) {
        Start-Sleep -Milliseconds 350
        foreach ($managedProcess in $managedProcesses) {
          Flush-ManagedProcessOutput -ManagedProcess $managedProcess
        }

        Update-BuildStateFromOutput `
          -BuildProcess $buildProcess `
          -StatePath $buildStatePath `
          -GenerationRef ([ref]$buildGeneration) `
          -LastBuildStdoutLengthRef ([ref]$lastBuildStdoutLength) `
          -LastBuildStderrLengthRef ([ref]$lastBuildStderrLength)

        $buildState = Get-BuildState -StatePath $buildStatePath
        if (-not $buildState -or $buildState.status -ne 'ready' -or [int]$buildState.generation -le $startupGeneration) {
          continue
        }

        $restoreProbe = Invoke-JsonHttpProbe -Ports @(3000..3005) -TimeoutSeconds 2
        if (
          $restoreProbe -and
          $restoreProbe.rootResponsePreview -match 'Hello World!' -and
          $restoreProbe.rootResponsePreview -notmatch '\[hot-reload\]'
        ) {
          $restoreObserved = $true
          $activePort = [int]$restoreProbe.activePort
          $restoreResponsePreview = $restoreProbe.rootResponsePreview
          $startupGeneration = [int]$buildState.generation
          break
        }
      }

      $status = if ($reloadObserved -and $restoreObserved) { 'hot-reload-passed' } else { 'hot-reload-failed' }
    }
  } finally {
    $currentContent = Get-Content -LiteralPath $targetFile -Raw
    if ($currentContent -ne $originalContent) {
      Set-Content -LiteralPath $targetFile -Value $originalContent -NoNewline
    }

    [Console]::Out.WriteLine('[start:dev] stopping foreground watchers')
    Remove-Item -LiteralPath $buildStatePath -Force -ErrorAction SilentlyContinue
    for ($index = $managedProcesses.Count - 1; $index -ge 0; $index--) {
      Flush-ManagedProcessOutput -ManagedProcess $managedProcesses[$index]
      Stop-ManagedProcess -ManagedProcess $managedProcesses[$index]
    }
  }

  $stdoutPreviewParts = New-Object System.Collections.Generic.List[string]
  $stderrPreviewParts = New-Object System.Collections.Generic.List[string]
  if ($buildProcess) {
    $stdoutPreviewParts.Add("[build] $(Get-PreviewText -Builder $buildProcess.StdoutBuilder -MaxLength 1200)") | Out-Null
    $stderrPreviewParts.Add("[build] $(Get-PreviewText -Builder $buildProcess.StderrBuilder -MaxLength 700)") | Out-Null
  }
  if ($appProcess) {
    $stdoutPreviewParts.Add("[app] $(Get-PreviewText -Builder $appProcess.StdoutBuilder -MaxLength 2200)") | Out-Null
    $stderrPreviewParts.Add("[app] $(Get-PreviewText -Builder $appProcess.StderrBuilder -MaxLength 700)") | Out-Null
  }

  return [pscustomobject]@{
    status = $status
    activePort = $activePort
    reloadObserved = $reloadObserved
    restoreObserved = $restoreObserved
    rootResponsePreview = $initialRootResponse
    reloadResponsePreview = $reloadResponsePreview
    restoreResponsePreview = $restoreResponsePreview
    stdoutPreview = (($stdoutPreviewParts | Where-Object { $_ -ne '[build] ' -and $_ -ne '[app] ' }) -join "`n").Trim()
    stderrPreview = (($stderrPreviewParts | Where-Object { $_ -ne '[build] ' -and $_ -ne '[app] ' }) -join "`n").Trim()
  }
}
