# Roda o mascote.py no Blender da Store e espera o "pronto" (o launcher não mostra a saída). Uso: powershell -File rodar.ps1
# SO=andando no ambiente renderiza só uma animação.
$aqui = Split-Path -Parent $MyInvocation.MyCommand.Path
$pronto = Join-Path $aqui 'saida\pronto.txt'
Remove-Item $pronto -ErrorAction SilentlyContinue
$blender = Join-Path $env:LOCALAPPDATA 'Microsoft\WindowsApps\blender-launcher.exe'
Start-Process -FilePath $blender -ArgumentList @('-b', '-P', "`"$aqui\mascote.py`"") -WindowStyle Hidden | Out-Null
$t = 0
while (-not (Test-Path $pronto) -and $t -lt 1200) { Start-Sleep 2; $t += 2 }
Get-Content (Join-Path $aqui 'saida\log.txt') | Where-Object { $_ -notmatch '^(Fra:|Saved|\s*Time:)' } | Select-Object -Last 25
