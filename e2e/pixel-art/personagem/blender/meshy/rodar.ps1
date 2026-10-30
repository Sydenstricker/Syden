# Roda o mascote.py no Blender da Store e espera o "pronto" (o launcher não mostra a saída). Uso: powershell -File rodar.ps1
# No ambiente: MODELO=t usa a malha de braços abertos (sai em t/); SO=andando faz só uma animação;
# VISTAS=frente:0,lado:90 troca as direções (para conferir).
$aqui = Split-Path -Parent $MyInvocation.MyCommand.Path
$saida = if ($env:MODELO) { Join-Path $aqui "$($env:MODELO)\saida" } else { Join-Path $aqui 'saida' }
$pronto = Join-Path $saida 'pronto.txt'
Remove-Item $pronto -ErrorAction SilentlyContinue
$blender = Join-Path $env:LOCALAPPDATA 'Microsoft\WindowsApps\blender-launcher.exe'
Start-Process -FilePath $blender -ArgumentList @('-b', '-P', "`"$aqui\mascote.py`"") -WindowStyle Hidden | Out-Null
$t = 0
while (-not (Test-Path $pronto) -and $t -lt 1200) { Start-Sleep 2; $t += 2 }
Get-Content (Join-Path $saida 'log.txt') | Where-Object { $_ -notmatch '^(Fra:|Saved|\s*Time:)|DeprecationWarning|use_nodes' } | Select-Object -Last 25
