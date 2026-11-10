# Roda o camadas.py no Blender da Store e espera o "pronto" (o launcher não mostra a saída; ela vai para saida/log.txt).
# Uso: powershell -File rodar.ps1     No ambiente: ETAPA=medir só mede; SO=pixel|anim|normal|glb faz uma parte; MALHA=novo usa o corpo novo (saida-novo/).
$aqui = Split-Path -Parent $MyInvocation.MyCommand.Path
$saida = if ($env:MALHA -and $env:MALHA -ne 't') { Join-Path $aqui "saida-$($env:MALHA)" } else { Join-Path $aqui 'saida' }
New-Item -ItemType Directory -Force $saida | Out-Null
$pronto = Join-Path $saida 'pronto.txt'
Remove-Item $pronto -ErrorAction SilentlyContinue
$blender = Join-Path $env:LOCALAPPDATA 'Microsoft\WindowsApps\blender-launcher.exe'
Start-Process -FilePath $blender -ArgumentList @('-b', '-P', "`"$aqui\camadas.py`"") -WindowStyle Hidden | Out-Null
$t = 0
while (-not (Test-Path $pronto) -and $t -lt 1800) { Start-Sleep 2; $t += 2 }
Get-Content (Join-Path $saida 'log.txt') | Where-Object { $_ -notmatch '^(Fra:|Saved|\s*Time:)|DeprecationWarning|use_nodes' } | Select-Object -Last 40
