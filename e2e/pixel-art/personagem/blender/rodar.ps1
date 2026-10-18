# Roda o coelho.py no Blender da Store (o atalho blender-launcher solta o processo e não mostra a saída:
# esperamos o arquivo "pronto" e mostramos o log). Uso: powershell -File rodar.ps1 [escala] [projecao|c]
param([int]$Escala = 4, [string]$Modo = '')
$aqui = Split-Path -Parent $MyInvocation.MyCommand.Path
$suf = if ($Modo -eq 'projecao') { '-proj' } elseif ($Modo -eq 'c') { '-c' } else { '' }
$pronto = Join-Path $aqui "saida\pronto$suf-${Escala}x.txt"
Remove-Item $pronto -ErrorAction SilentlyContinue
$blender = Join-Path $env:LOCALAPPDATA 'Microsoft\WindowsApps\blender-launcher.exe'
$args_ = @('-b', '-P', "`"$aqui\coelho.py`"", '--', "$Escala")
if ($Modo) { $args_ += $Modo }
Start-Process -FilePath $blender -ArgumentList $args_ -WindowStyle Hidden | Out-Null
$t = 0
while (-not (Test-Path $pronto) -and $t -lt 900) { Start-Sleep 2; $t += 2 }
Get-Content (Join-Path $aqui "saida\log$suf-${Escala}x.txt") | Select-Object -Last 15
