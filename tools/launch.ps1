# launch.ps1 - desktop-shortcut entry point.
# Starts the local static server (if not already running) and opens the app in the default browser.
param(
  [int]$Port = 8790
)

$ServerScript = Join-Path $PSScriptRoot 'static-server.ps1'

function Test-PortOpen([int]$PortNumber) {
  try {
    $client = New-Object System.Net.Sockets.TcpClient
    $iar = $client.BeginConnect('127.0.0.1', $PortNumber, $null, $null)
    $ok = $iar.AsyncWaitHandle.WaitOne(300, $false)
    if ($ok -and $client.Connected) { $client.Close(); return $true }
    $client.Close()
    return $false
  } catch {
    return $false
  }
}

if (-not (Test-PortOpen -PortNumber $Port)) {
  Start-Process -FilePath "powershell.exe" -WindowStyle Hidden -ArgumentList @(
    "-NoProfile", "-ExecutionPolicy", "Bypass", "-WindowStyle", "Hidden",
    "-File", $ServerScript, "-Port", $Port
  )
  Start-Sleep -Milliseconds 900
}

Start-Process "http://localhost:$Port/"
