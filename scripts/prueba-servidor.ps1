# Servidor temporal para validar los modulos con Chrome headless.
# Uso: powershell -File scripts/prueba-servidor.ps1
param([int]$Puerto = 5199, [int]$Segundos = 45)

$raiz = Split-Path -Parent $PSScriptRoot

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Puerto/")
$listener.Start()

Write-Host "Servidor de prueba en http://localhost:$Puerto/"

$fin = (Get-Date).AddSeconds($Segundos)

while ((Get-Date) -lt $fin) {
    $ctx = $listener.GetContext()
    $ruta = $ctx.Request.Url.LocalPath.TrimStart('/')
    if ([string]::IsNullOrWhiteSpace($ruta)) { $ruta = 'index.html' }

    $archivo = Join-Path $raiz $ruta

    if (Test-Path -LiteralPath $archivo -PathType Leaf) {
        $extension = [System.IO.Path]::GetExtension($archivo).ToLower()
        $tipos = @{
            '.html' = 'text/html; charset=utf-8'
            '.js'   = 'text/javascript; charset=utf-8'
            '.css'  = 'text/css; charset=utf-8'
            '.json' = 'application/json; charset=utf-8'
            '.svg'  = 'image/svg+xml'
        }
        $tipo = if ($tipos.ContainsKey($extension)) { $tipos[$extension] } else { 'application/octet-stream' }

        $bytes = [System.IO.File]::ReadAllBytes($archivo)
        $ctx.Response.ContentType = $tipo
        $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
        $ctx.Response.StatusCode = 404
    }

    $ctx.Response.Close()
}

$listener.Stop()
Write-Host 'Servidor de prueba detenido.'