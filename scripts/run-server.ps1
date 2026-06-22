$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$BindHost = if ($env:HOST) { $env:HOST } else { "0.0.0.0" }
$BindPort = if ($env:PORT) { $env:PORT } else { "5173" }
$HangulGiyeok = [string] [char] 0x3131
$ResetChars = @("r", "R", $HangulGiyeok)
$StopChars = @("q", "Q")
$serverProcess = $null
$originalTreatControlCAsInput = [Console]::TreatControlCAsInput

function Stop-ExistingProcessOnPort {
  param(
    [string] $Port
  )

  $connections = @(Get-NetTCPConnection -LocalPort ([int] $Port) -State Listen -ErrorAction SilentlyContinue)
  if ($connections.Count -eq 0) {
    return
  }

  $processIds = @($connections | Select-Object -ExpandProperty OwningProcess -Unique)

  foreach ($processId in $processIds) {
    if ($processId -eq 0) {
      continue
    }

    $owner = Get-CimInstance Win32_Process -Filter "ProcessId = $processId" -ErrorAction SilentlyContinue
    $processName = if ($owner -and $owner.Name) { $owner.Name } else { "unknown process" }

    Write-Host ""
    Write-Host "[AI Skill Marketplace] $processName process $processId already uses port $BindPort."
    Write-Host "[AI Skill Marketplace] Stopping it so this launch takes priority..."

    try {
      Stop-Process -Id $processId -Force -ErrorAction Stop
      Wait-Process -Id $processId -Timeout 5 -ErrorAction SilentlyContinue
    } catch {
      throw "Failed to stop process $processId on port $BindPort`: $($_.Exception.Message)"
    }
  }
}

function Start-AppServer {
  Write-Host ""
  Write-Host "[AI Skill Marketplace] Starting server..."
  Write-Host "Host: $BindHost"
  Write-Host "Port: $BindPort"
  Write-Host ""

  $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
  $startInfo.FileName = "node"
  $startInfo.Arguments = "backend/server.js"
  $startInfo.WorkingDirectory = $RepoRoot
  $startInfo.UseShellExecute = $false
  $startInfo.CreateNoWindow = $false
  $startInfo.Environment["HOST"] = $BindHost
  $startInfo.Environment["PORT"] = $BindPort

  $process = [System.Diagnostics.Process]::new()
  $process.StartInfo = $startInfo

  if (-not $process.Start()) {
    throw "Failed to start server process."
  }

  return $process
}

function Stop-AppServer {
  param(
    [System.Diagnostics.Process] $Process,
    [string] $Action = "Stopping server"
  )

  if ($null -eq $Process -or $Process.HasExited) {
    return
  }

  Write-Host ""
  Write-Host "[AI Skill Marketplace] $Action..."

  try {
    $Process.Kill($true)
  } catch {
    try {
      $Process.Kill()
    } catch {
      Write-Host "[WARN] Failed to stop server process: $($_.Exception.Message)"
    }
  }

  try {
    $Process.WaitForExit(5000) | Out-Null
  } catch {
    Write-Host "[WARN] Server process did not exit cleanly."
  }
}

try {
  Set-Location $RepoRoot
  [Console]::TreatControlCAsInput = $true

  Write-Host ""
  Write-Host "Press r, R, or Korean giyeok key to hard reset immediately. No Enter required."
  Write-Host "Press q/Q or Ctrl+C to stop."

  while ($true) {
    Stop-ExistingProcessOnPort -Port $BindPort
    $serverProcess = Start-AppServer
    $shouldRestart = $false

    while (-not $serverProcess.HasExited) {
      if ([Console]::KeyAvailable) {
        $key = [Console]::ReadKey($true)
        $char = [string] $key.KeyChar
        $isCtrlC = ($key.Key -eq [ConsoleKey]::C -and ($key.Modifiers -band [ConsoleModifiers]::Control))

        if ($ResetChars -contains $char) {
          Stop-AppServer -Process $serverProcess -Action "Hard resetting server"
          $shouldRestart = $true
          break
        }

        if (($StopChars -contains $char) -or $isCtrlC) {
          Stop-AppServer -Process $serverProcess -Action "Stopping server"
          exit 0
        }
      }

      Start-Sleep -Milliseconds 80
    }

    if (-not $shouldRestart) {
      $exitCode = if ($null -ne $serverProcess) { $serverProcess.ExitCode } else { 1 }
      Write-Host ""
      Write-Host "[AI Skill Marketplace] Server stopped with exit code $exitCode."
      exit $exitCode
    }
  }
} finally {
  [Console]::TreatControlCAsInput = $originalTreatControlCAsInput
  Stop-AppServer -Process $serverProcess -Action "Stopping server"
}
