# Roda um script deste grupo no Blender da Store e espera o "pronto" (o launcher não mostra a saída: ela vai para o log.txt
# de e2e/fotos/modelos/tabuleiro-capitais/). Uso: powershell -File rodar.ps1 cenoura.py [args...]
param([Parameter(Mandatory = $true)][string]$script, [Parameter(ValueFromRemainingArguments = $true)][string[]]$resto)
$aqui = Split-Path -Parent $MyInvocation.MyCommand.Path
$repo = Resolve-Path (Join-Path $aqui '..\..\..\..')
$fotos = Join-Path $repo 'e2e\fotos\modelos\tabuleiro-capitais'
New-Item -ItemType Directory -Force $fotos | Out-Null
$pronto = Join-Path $fotos 'pronto.txt'
$log = Join-Path $fotos 'log.txt'
Remove-Item $pronto, $log -ErrorAction SilentlyContinue
$blender = Join-Path $env:LOCALAPPDATA 'Microsoft\WindowsApps\blender-launcher.exe'
$args2 = @('-b', '--factory-startup', '-P', "`"$aqui\$script`"", '--')
if ($resto) { $args2 += $resto }
Start-Process -FilePath $blender -ArgumentList $args2 -WindowStyle Hidden | Out-Null
$t = 0
while (-not (Test-Path $pronto) -and $t -lt 240) { Start-Sleep 2; $t += 2 }
if (Test-Path $log) { Get-Content $log | Select-Object -Last 40 } else { 'sem log' }
