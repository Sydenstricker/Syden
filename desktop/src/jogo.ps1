# O QUE ESTÁ NA FRENTE, NA TELA DE QUEM.
#
# Este script NÃO DECIDE NADA. Ele mede e escreve uma linha; quem decide se aquilo é um jogo é
# desktop/src/jogo.js, em JavaScript, onde a regra tem teste. A separação é a mesma de
# web/src/sobreposicao.ts: a decisão que faz uma janela aparecer por cima de tudo não pode morar
# num lugar onde ninguém consegue conferi-la.
#
# Formato da linha, separado por tabulação:
#
#   processo  dono  esq  topo  dir  base  telaX  telaY  telaL  telaA
#
# Escreve só quando a linha MUDA, para não haver tráfego enquanto a pessoa fica no mesmo lugar.
#
# POR QUE PowerShell, E NÃO ELECTRON: o Electron não sabe qual janela está na frente. Quem sabe é o
# Windows, pelo user32, e daqui dá para perguntar sem compilar nada — o que importa porque o módulo
# nativo do Syden exige as Ferramentas de Build do Visual Studio, que nem toda máquina tem.
#
# O custo foi medido, não estimado: 63 MB de memória privada e 16 ms de processador a cada 12
# segundos. O processo só existe enquanto houver gente na sua sala de voz e a opção estiver ligada.

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Fg {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  public struct RECT { public int Left, Top, Right, Bottom; }
}
"@

# De quanto em quanto tempo se olha. Um segundo e meio é rápido o bastante para a janelinha aparecer
# junto com o jogo e devagar o bastante para não custar nada.
$PAUSA_MS = 1500

$ultima = ''
while ($true) {
  $linha = ''
  $janela = [Fg]::GetForegroundWindow()

  if ($janela -ne [IntPtr]::Zero) {
    $retangulo = New-Object Fg+RECT
    if ([Fg]::GetWindowRect($janela, [ref]$retangulo)) {
      $dono = 0
      [void][Fg]::GetWindowThreadProcessId($janela, [ref]$dono)

      $nome = ''
      try { $nome = (Get-Process -Id $dono -ErrorAction Stop).ProcessName } catch { $nome = '' }

      # A TELA DO MONITOR EM QUE A JANELA ESTÁ, e não a do monitor principal: com dois monitores, um
      # jogo em tela cheia no segundo precisa ser medido contra o segundo.
      $tela = [System.Windows.Forms.Screen]::FromHandle($janela).Bounds

      $linha = ($nome, $dono, $retangulo.Left, $retangulo.Top, $retangulo.Right, $retangulo.Bottom,
                $tela.X, $tela.Y, $tela.Width, $tela.Height) -join "`t"
    }
  }

  if ($linha -ne $ultima) {
    $ultima = $linha
    [Console]::Out.WriteLine($linha)
    [Console]::Out.Flush()
  }

  Start-Sleep -Milliseconds $PAUSA_MS
}
