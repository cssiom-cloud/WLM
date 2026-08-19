$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$port = 4173
if ($env:WLR_LOCAL_PORT) {
  $port = [int]$env:WLR_LOCAL_PORT
}

$prefix = "http://127.0.0.1:$port/"
$mime = @{
  ".html" = "text/html; charset=utf-8"
  ".js"   = "text/javascript; charset=utf-8"
  ".css"  = "text/css; charset=utf-8"
  ".json" = "application/json; charset=utf-8"
  ".jpg"  = "image/jpeg"
  ".jpeg" = "image/jpeg"
  ".gif"  = "image/gif"
  ".png"  = "image/png"
  ".webp" = "image/webp"
  ".svg"  = "image/svg+xml"
  ".ico"  = "image/x-icon"
  ".txt"  = "text/plain; charset=utf-8"
  ".md"   = "text/markdown; charset=utf-8"
  ".sql"  = "text/plain; charset=utf-8"
  ".lua"  = "text/plain; charset=utf-8"
}

function Get-SafePath {
  param([string]$RequestPath)

  $relative = [Uri]::UnescapeDataString($RequestPath)
  if ([string]::IsNullOrWhiteSpace($relative) -or $relative -eq "/") {
    $relative = "/login.html"
  }

  $combined = [System.IO.Path]::GetFullPath((Join-Path $repoRoot ($relative.TrimStart("/").Replace("/", [IO.Path]::DirectorySeparatorChar))))
  $rootFull = [System.IO.Path]::GetFullPath($repoRoot)
  if (-not $combined.StartsWith($rootFull, [System.StringComparison]::OrdinalIgnoreCase)) {
    return $null
  }
  if ($combined -match "[\\/]\.git([\\/]|$)") {
    return $null
  }
  return $combined
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)

try {
  $listener.Start()
} catch {
  Write-Host "Could not start http://127.0.0.1:$port/ - close the program using that port, then try again."
  throw
}

$url = "${prefix}login.html"
Write-Host "W.L.R local test server: $url"
Write-Host "Press Ctrl+C to stop."
Start-Process $url | Out-Null

try {
  while ($listener.IsListening) {
    $context = $listener.GetContext()
    $response = $context.Response
    $filePath = Get-SafePath -RequestPath $context.Request.Url.AbsolutePath

    if (-not $filePath -or -not (Test-Path -LiteralPath $filePath -PathType Leaf)) {
      $response.StatusCode = 404
      $bytes = [Text.Encoding]::UTF8.GetBytes("Not found")
      $response.ContentType = "text/plain; charset=utf-8"
      $response.OutputStream.Write($bytes, 0, $bytes.Length)
      $response.Close()
      continue
    }

    $extension = [IO.Path]::GetExtension($filePath).ToLowerInvariant()
    $bytes = [IO.File]::ReadAllBytes($filePath)
    $response.StatusCode = 200
    $response.ContentType = $(if ($mime.ContainsKey($extension)) { $mime[$extension] } else { "application/octet-stream" })
    $response.Headers.Add("Cache-Control", "no-store")
    $response.OutputStream.Write($bytes, 0, $bytes.Length)
    $response.Close()
  }
} finally {
  if ($listener.IsListening) {
    $listener.Stop()
  }
  $listener.Close()
}
