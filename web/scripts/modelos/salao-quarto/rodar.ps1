# Roda um dos scripts desta pasta no Blender da Store e espera o "pronto" (o launcher não mostra a saída: ela vai para saida/log.txt).
# Uso: powershell -File rodar.ps1 salao.py [itens...]
param([Parameter(Mandatory = $true)][string]$script, [Parameter(ValueFromRemainingArguments = $true)][string[]]$itens)
$aqui = Split-Path -Parent $MyInvocation.MyCommand.Path
$saida = Join-Path $aqui 'saida'
New-Item -ItemType Directory -Force $saida | Out-Null
$pronto = Join-Path $saida 'pronto.txt'
Remove-Item $pronto -ErrorAction SilentlyContinue
Remove-Item (Join-Path $saida 'log.txt') -ErrorAction SilentlyContinue
$blender = Join-Path $env:LOCALAPPDATA 'Microsoft\WindowsApps\blender-launcher.exe'
$args2 = @('-b', '--factory-startup', '-P', "`"$aqui\$script`"", '--') + @($itens | Where-Object { $_ })
Start-Process -FilePath $blender -ArgumentList $args2 -WindowStyle Hidden | Out-Null
$t = 0
while (-not (Test-Path $pronto) -and $t -lt 900) { Start-Sleep 2; $t += 2 }
if (Test-Path (Join-Path $saida 'log.txt')) { Get-Content (Join-Path $saida 'log.txt') | Select-Object -Last 40 }
