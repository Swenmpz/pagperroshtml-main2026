$raiz = Split-Path -Parent $PSScriptRoot
$info = @()

$job = Start-Job -ArgumentList $raiz -ScriptBlock {
    param($raiz)
    try {
        $listener = New-Object System.Net.HttpListener
        $listener.Prefixes.Add('http://127.0.0.1:5211/')
        $listener.Start()
        "LISTENER OK: $($listener.IsListening)"
        $fin = (Get-Date).AddSeconds(25)
        while ((Get-Date) -lt $fin) {
            $ctx = $listener.GetContext()
            $bytes = [System.Text.Encoding]::UTF8.GetBytes('hola')
            $ctx.Response.ContentType = 'text/plain'
            $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
            $ctx.Response.Close()
        }
        $listener.Stop()
    } catch {
        "ERROR LISTENER: $($_.Exception.Message)"
    }
}

Start-Sleep -Seconds 4
$estado = (Get-Job -Id $job.Id).State

try {
    $respuesta = Invoke-WebRequest -Uri 'http://127.0.0.1:5211/' -UseBasicParsing -TimeoutSec 5
    $info += "HTTP: $($respuesta.StatusCode) / $($respuesta.Content)"
} catch {
    $info += "HTTP ERROR: $($_.Exception.Message)"
}

$info += "JOB: $estado"
$info += (Receive-Job -Id $job.Id -Keep | Out-String)

Stop-Job -Id $job.Id -ErrorAction SilentlyContinue
Remove-Job -Id $job.Id -Force -ErrorAction SilentlyContinue

$info | Out-File (Join-Path $raiz 'diag-servidor.txt') -Encoding UTF8
'diagnostico listo'