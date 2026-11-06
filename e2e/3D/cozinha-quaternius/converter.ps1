# Roda o converter.py no Blender da Store e espera o "pronto" (o launcher não mostra a saída).
$aqui = Split-Path -Parent $MyInvocation.MyCommand.Path
$pronto = Join-Path $aqui 'pronto.txt'
Remove-Item $pronto -ErrorAction SilentlyContinue
$blender = Join-Path $env:LOCALAPPDATA 'Microsoft\WindowsApps\blender-launcher.exe'
Start-Process -FilePath $blender -ArgumentList @('-b', '-P', "`"$aqui\converter.py`"") -WindowStyle Hidden | Out-Null
$t = 0
while (-not (Test-Path $pronto) -and $t -lt 300) { Start-Sleep 2; $t += 2 }
Get-Content (Join-Path $aqui 'log.txt')
