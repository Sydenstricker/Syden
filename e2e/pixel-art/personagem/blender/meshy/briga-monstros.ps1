# Roda o briga-monstros.py no Blender da Store e espera o "pronto" (o launcher não mostra a saída).
# Uso: powershell -File briga-monstros.ps1   (SO_M=cogumelo,sapo no ambiente faz só alguns)
$aqui = Split-Path -Parent $MyInvocation.MyCommand.Path
$saida = Join-Path $aqui 't\saida\briga-monstros'
New-Item -ItemType Directory -Force $saida | Out-Null
$pronto = Join-Path $saida 'pronto.txt'
Remove-Item $pronto -ErrorAction SilentlyContinue
$blender = Join-Path $env:LOCALAPPDATA 'Microsoft\WindowsApps\blender-launcher.exe'
Start-Process -FilePath $blender -ArgumentList @('-b', '-P', "`"$aqui\briga-monstros.py`"") -WindowStyle Hidden | Out-Null
$t = 0
while (-not (Test-Path $pronto) -and $t -lt 3000) { Start-Sleep 2; $t += 2 }
Get-Content (Join-Path $saida 'log.txt') | Where-Object { $_ -notmatch '^(Fra:|Saved|\s*Time:)|DeprecationWarning|use_nodes|INFO' } | Select-Object -Last 30
