# O QUE ESTÁ NA FRENTE, E SE O WINDOWS O CONSIDERA UM JOGO.
#
# Este script NÃO DECIDE NADA. Ele mede e escreve uma linha; quem decide é desktop/src/jogo.js, em
# JavaScript, onde a regra tem teste. A separação é a mesma de web/src/sobreposicao.ts: a decisão que
# faz uma janela aparecer por cima de tudo não pode morar num lugar onde ninguém consegue conferi-la.
#
# Formato da linha, separado por tabulação:
#
#   processo  dono  conhecido  caminho
#
# `conhecido` é 1 quando o executável está na lista de jogos do próprio Windows (ver abaixo). Escreve
# só quando a linha MUDA, para não haver tráfego enquanto a pessoa fica no mesmo lugar.
#
# O custo foi medido, não estimado: 63 MB de memória privada e 16 ms de processador a cada 12
# segundos. O processo só existe enquanto houver gente na sua sala de voz e a opção estiver ligada.

$ErrorActionPreference = 'Stop'
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Fg {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
}
"@

# ---------------------------------------------------------------------------------------------------
# A LISTA DE JOGOS É DO WINDOWS, E NÃO NOSSA.
#
# HKCU\System\GameConfigStore\Children é onde a Barra de Jogos guarda o que ELA reconheceu como jogo.
# É a mesma lista que decide se o Win+G aparece. Medido na máquina do Sydenstricker: 75 executáveis,
# ZERO falsos positivos — nenhum navegador, editor, Discord, Word ou OBS entrou nela. E cobre o que
# uma regra de pasta não cobriria: 50 vieram da Steam, 6 da Epic e 19 de lugar nenhum (Riot, Blizzard,
# EA, Origin, um Ragnarok solto em F:\).
#
# POR QUE ELA E NÃO UMA LISTA ONLINE: a lista pública da Steam (ISteamApps/GetAppList) saiu do ar para
# quem não tem chave — medido, 404, e o método não aparece mais entre os que a Steam serve sem chave.
# E mesmo que estivesse lá, casar nome de janela com nome de jogo erraria feio: uma aba do YouTube
# chamada "ELDEN RING - gameplay" viraria "está jogando Elden Ring".
#
# O QUE ISTO NÃO FAZ: não lê a sua biblioteca, não enumera o que você comprou e não manda nada para
# lugar nenhum. A lista é carregada uma vez, fica na memória deste processo, e serve para responder
# UMA pergunta sobre UM programa — o que já está na sua frente.
#
# A FALHA CONHECIDA: um jogo que o Windows ainda não catalogou (a primeiríssima vez que você o abre)
# não está na lista, e a janelinha não aparece nessa sessão. Da segunda em diante, aparece.
# ---------------------------------------------------------------------------------------------------
$JOGOS = [System.Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
try {
  Get-ChildItem 'HKCU:\System\GameConfigStore\Children' -ErrorAction Stop | ForEach-Object {
    $caminho = (Get-ItemProperty $_.PSPath -ErrorAction SilentlyContinue).MatchedExeFullPath
    if ($caminho) { [void]$JOGOS.Add($caminho) }
  }
} catch {
  # Sem a chave (Windows sem Barra de Jogos, perfil novo), a lista fica vazia e nada é reconhecido
  # como jogo. É o lado seguro: a janelinha não aparece em vez de aparecer onde não devia.
}

# De quanto em quanto tempo se olha. Um segundo e meio é rápido o bastante para a janelinha aparecer
# junto com o jogo e devagar o bastante para não custar nada.
$PAUSA_MS = 1500

$ultima = ''
while ($true) {
  $linha = ''
  $janela = [Fg]::GetForegroundWindow()

  if ($janela -ne [IntPtr]::Zero) {
    $dono = 0
    [void][Fg]::GetWindowThreadProcessId($janela, [ref]$dono)

    $nome = ''
    $caminho = ''
    try {
      $processo = Get-Process -Id $dono -ErrorAction Stop
      $nome = $processo.ProcessName
      # Processo elevado (anticheat, por exemplo) recusa o caminho. Fica vazio, e aí ele não casa com
      # a lista — de novo o lado seguro.
      $caminho = try { $processo.Path } catch { '' }
    } catch { }

    $conhecido = if ($caminho -and $JOGOS.Contains($caminho)) { 1 } else { 0 }
    $linha = ($nome, $dono, $conhecido, $caminho) -join "`t"
  }

  if ($linha -ne $ultima) {
    $ultima = $linha
    [Console]::Out.WriteLine($linha)
    [Console]::Out.Flush()
  }

  Start-Sleep -Milliseconds $PAUSA_MS
}
