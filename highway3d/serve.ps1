# Tiny static file server for local development (no Node/Python needed).
# Usage:  powershell -ExecutionPolicy Bypass -File serve.ps1 [-Port 8173]
param([int]$Port = 8173, [switch]$Open)

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$types = @{
  '.html' = 'text/html; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'; '.css' = 'text/css; charset=utf-8'
  '.json' = 'application/json'; '.png' = 'image/png'; '.jpg' = 'image/jpeg'; '.svg' = 'image/svg+xml'
  '.mp3' = 'audio/mpeg'; '.ogg' = 'audio/ogg'; '.glb' = 'model/gltf-binary'; '.ico' = 'image/x-icon'
}
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$url = "http://localhost:$Port/"
try { $listener.Start() }
catch {
  # Most likely the server is already running in another window: just open the game.
  Write-Host "Port $Port is already in use, so the game is probably already being served. Opening $url"
  if ($Open) { Start-Process $url }
  exit 0
}
Write-Host "Serving $root at $url  (close this window or press Ctrl+C to stop)"
if ($Open) { Start-Process $url }
try {
  while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $res = $ctx.Response
    try {
      $path = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath.TrimStart('/'))
      if ($path -eq '') { $path = 'index.html' }
      $file = [IO.Path]::GetFullPath((Join-Path $root $path))
      # Like a real web host: a folder URL serves that folder's index.html.
      if (Test-Path $file -PathType Container) { $file = Join-Path $file 'index.html' }
      if ($file.StartsWith($root) -and (Test-Path $file -PathType Leaf)) {
        $ext = [IO.Path]::GetExtension($file).ToLower()
        $res.ContentType = if ($types.ContainsKey($ext)) { $types[$ext] } else { 'application/octet-stream' }
        $res.Headers.Add('Cache-Control', 'no-store')
        if ($ctx.Request.HttpMethod -ne 'HEAD') {
          $bytes = [IO.File]::ReadAllBytes($file)
          $res.OutputStream.Write($bytes, 0, $bytes.Length)
        }
      } else {
        $res.StatusCode = 404
      }
    } catch {
      Write-Host "Request failed: $_"
    } finally {
      try { $res.Close() } catch {}
    }
  }
} finally { $listener.Stop() }
