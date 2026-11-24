# Roda um script de modelo da Rota Estelar no Blender da Store e espera o "pronto" (o launcher não mostra a saída; ela vai
# para saida/log.txt). Uso: powershell -File rodar.ps1 nave.py
param([string]$script)
$aqui = Split-Path -Parent $MyInvocation.MyCommand.Path
$saida = Join-Path $aqui 'saida'
New-Item -ItemType Directory -Force $saida | Out-Null
$pronto = Join-Path $saida 'pronto.txt'
Remove-Item $pronto -ErrorAction SilentlyContinue
$blender = Join-Path $env:LOCALAPPDATA 'Microsoft\WindowsApps\blender-launcher.exe'
Start-Process -FilePath $blender -ArgumentList @('-b', '--factory-startup', '-P', "`"$aqui\$script`"") -WindowStyle Hidden | Out-Null
$t = 0
while (-not (Test-Path $pronto) -and $t -lt 900) { Start-Sleep 2; $t += 2 }
Get-Content (Join-Path $saida 'log.txt') | Select-Object -Last 40
