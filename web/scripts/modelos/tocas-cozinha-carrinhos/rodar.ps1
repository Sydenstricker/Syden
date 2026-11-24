# Roda um script deste grupo no Blender da Store e espera o "pronto" (o launcher não mostra a saída; ela vai para o log).
# Uso: powershell -File rodar.ps1 <script.py> [saida] [mais argumentos...]
param([Parameter(Mandatory = $true)][string]$script, [string]$saida = '', [Parameter(ValueFromRemainingArguments = $true)][string[]]$resto)
$aqui = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $saida) { $saida = Join-Path $env:TEMP ('modelos-tcc-' + [IO.Path]::GetFileNameWithoutExtension($script)) }
New-Item -ItemType Directory -Force $saida | Out-Null
$pronto = Join-Path $saida 'pronto.txt'
Remove-Item $pronto -ErrorAction SilentlyContinue
$blender = Join-Path $env:LOCALAPPDATA 'Microsoft\WindowsApps\blender-launcher.exe'
$args2 = @('-b', '--factory-startup', '-P', "`"$aqui\$script`"", '--', "`"$saida`"") + ($resto | ForEach-Object { "`"$_`"" })
Start-Process -FilePath $blender -ArgumentList $args2 -WindowStyle Hidden | Out-Null
$t = 0
while (-not (Test-Path $pronto) -and $t -lt 900) { Start-Sleep 2; $t += 2 }
Get-Content (Join-Path $saida 'log.txt') -ErrorAction SilentlyContinue | Select-Object -Last 40
