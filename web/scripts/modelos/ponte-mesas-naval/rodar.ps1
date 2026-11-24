# Roda um script deste grupo no Blender da Store e espera o pronto (o launcher não mostra a saída).
# Uso: powershell -File rodar.ps1 <script-sem-.py>
param([string]$nome)
$aqui = Split-Path -Parent $MyInvocation.MyCommand.Path
$repo = Resolve-Path (Join-Path $aqui '..\..\..\..')
$saida = Join-Path $repo 'e2e\fotos\modelos\ponte-mesas-naval'
New-Item -ItemType Directory -Force $saida | Out-Null
$pronto = Join-Path $saida "pronto-$nome.txt"
Remove-Item $pronto -ErrorAction SilentlyContinue
$blender = Join-Path $env:LOCALAPPDATA 'Microsoft\WindowsApps\blender-launcher.exe'
Start-Process -FilePath $blender -ArgumentList @('-b', '--factory-startup', '-P', "`"$aqui\$nome.py`"", '--', "`"$saida`"") -WindowStyle Hidden | Out-Null
$t = 0
while (-not (Test-Path $pronto) -and $t -lt 900) { Start-Sleep 2; $t += 2 }
Get-Content (Join-Path $saida "log-$nome.txt") | Select-Object -Last 40
