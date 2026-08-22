# static-server.ps1 - zero-dependency static file server (uses only .NET HttpListener)
# Used to serve this app locally when Node.js / Python are not available.
param(
  [int]$Port = 8790,
  [string]$Root = (Split-Path -Parent $PSScriptRoot)
)

$listener = New-Object System.Net.HttpListener
$prefix = "http://localhost:$Port/"
$listener.Prefixes.Add($prefix)
$listener.Start()
Write-Host "Serving '$Root' at $prefix (Ctrl+C to stop)"

$mimeMap = @{
  ".html" = "text/html; charset=utf-8"
  ".css"  = "text/css; charset=utf-8"
  ".js"   = "application/javascript; charset=utf-8"
  ".json" = "application/json; charset=utf-8"
  ".svg"  = "image/svg+xml"
  ".png"  = "image/png"
  ".jpg"  = "image/jpeg"
  ".jpeg" = "image/jpeg"
  ".ico"  = "image/x-icon"
}

$fullRoot = (Resolve-Path $Root).Path

try {
  while ($listener.IsListening) {
    $context = $listener.GetContext()
    $request = $context.Request
    $response = $context.Response
    try {
      $path = $request.Url.AbsolutePath
      if ($path -eq "/") { $path = "/index.html" }
      $relative = $path.TrimStart("/") -replace "/", [IO.Path]::DirectorySeparatorChar
      $filePath = Join-Path $fullRoot $relative

      if (Test-Path $filePath -PathType Leaf) {
        $resolved = (Resolve-Path $filePath).Path
        if ($resolved.StartsWith($fullRoot)) {
          $ext = [IO.Path]::GetExtension($filePath).ToLower()
          $contentType = $mimeMap[$ext]
          if (-not $contentType) { $contentType = "application/octet-stream" }
          $bytes = [IO.File]::ReadAllBytes($resolved)
          $response.ContentType = $contentType
          $response.ContentLength64 = $bytes.Length
          $response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
          $response.StatusCode = 403
        }
      } else {
        $response.StatusCode = 404
        $notFound = [Text.Encoding]::UTF8.GetBytes("404 Not Found: $path")
        $response.OutputStream.Write($notFound, 0, $notFound.Length)
      }
    } catch {
      $response.StatusCode = 500
    } finally {
      $response.OutputStream.Close()
    }
  }
} finally {
  $listener.Stop()
}
