# Levanta un servidor local y ejecuta prueba-modulos.html en Chrome headless
# para validar los módulos ES de la tienda sin necesidad de Node.
# Uso: powershell -ExecutionPolicy Bypass -File scripts/prueba-automatica.ps1

param([int]$Puerto = 5199)

$raiz = Split-Path -Parent $PSScriptRoot
$resultado = Join-Path $raiz 'prueba-resultado.txt'
$chrome = 'C:\Program Files\Google\Chrome\Application\chrome.exe'

$job = Start-Job -ArgumentList $raiz, $Puerto -ScriptBlock {
    param($raiz, $Puerto)

    $listener = New-Object System.Net.HttpListener
    $listener.Prefixes.Add("http://localhost:$Puerto/")
    $listener.Start()

    $tipos = @{
        '.html' = 'text/html; charset=utf-8'
        '.js'   = 'text/javascript; charset=utf-8'
        '.css'  = 'text/css; charset=utf-8'
        '.json' = 'application/json; charset=utf-8'
        '.svg'  = 'image/svg+xml'
        '.png'  = 'image/png'
        '.jpg'  = 'image/jpeg'
        '.ico'  = 'image/x-icon'
    }

    $fin = (Get-Date).AddSeconds(90)

    while ((Get-Date) -lt $fin) {
        $ctx = $listener.GetContext()
        $ruta = $ctx.Request.Url.LocalPath.TrimStart('/')
        if ([string]::IsNullOrWhiteSpace($ruta)) { $ruta = 'index.html' }

        $archivo = Join-Path $raiz $ruta

        if (Test-Path -LiteralPath $archivo -PathType Leaf) {
            $extension = [System.IO.Path]::GetExtension($archivo).ToLower()
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
}

Start-Sleep -Seconds 3

$dom = & $chrome --headless=new --disable-gpu --no-sandbox --virtual-time-budget=20000 --dump-dom "http://localhost:$Puerto/prueba-modulos.html" 2>$null

Stop-Job $job -ErrorAction SilentlyContinue
Remove-Job $job -Force -ErrorAction SilentlyContinue

$texto = ($dom -join ' ')
$coincidencia = [regex]::Match($texto, '(?s)<div id="salida">(.*?)</div>')

if ($coincidencia.Success) {
    $contenido = $coincidencia.Groups[1].Value
    $contenido | Out-File -FilePath $resultado -Encoding UTF8
    Write-Output 'PRUEBA COMPLETADA'
} else {
    'SIN RESULTADO: el DOM no contiene #salida' | Out-File -FilePath $resultado -Encoding UTF8
    Write-Output 'PRUEBA SIN RESULTADO'
}