'use strict';

/**
 * O SYDEN ESTÁ À VISTA? (14/11/2026, relato: FPS baixo no LoL, que um alt-tab no Syden resolvia)
 *
 * O app desliga o freio de segundo plano do Chromium (backgroundThrottling: false), para a chamada não cair com a janela
 * minimizada. O preço, medido no Electron 44: a página fica "visible" e o laço de quadros roda a 60 por segundo coberta
 * por uma janela em tela cheia E minimizada. Então o LiveKit, que pausa o vídeo de página escondida, nunca pausava: a
 * transmissão e as câmeras da chamada continuavam sendo baixadas e decodificadas atrás do jogo.
 *
 * Aqui o processo principal decide, e avisa a página ('app:a-vista'). Fora da vista: minimizado, escondido na bandeja,
 * ou com a janela da frente (de outro programa) cobrindo a do Syden inteira — o jogo em tela cheia no MESMO monitor.
 * No outro monitor, o Syden continua à vista, e quem assiste a uma transmissão ali enquanto faz outra coisa segue vendo.
 * A área de trabalho e a barra de tarefas não contam como "cobrir" (clicar no papel de parede daria a tela inteira).
 */

const path = require('node:path');
const { screen } = require('electron');

/** @type {{ janelaDaFrente?: () => { pid: number, classe: string, x: number, y: number, largura: number, altura: number } | null } | null} */
let native = null;
try {
  const base = __dirname.includes('app.asar') ? __dirname.replace('app.asar', 'app.asar.unpacked') : __dirname;
  native = require(path.join(base, '..', 'native', 'build', 'Release', 'syden_audio.node'));
} catch {
  native = null; // sem o módulo, só minimizado e escondido contam
}

const DA_AREA_DE_TRABALHO = new Set(['Progman', 'WorkerW', 'Shell_TrayWnd', 'Shell_SecondaryTrayWnd']);
const FOLGA = 2; // px: janela "sem bordas" às vezes fica 1 px menor que o monitor

/**
 * Por que o Syden está fora da vista agora (null: à vista). 'coberto' vem com o programa da frente, para o diário de saúde.
 * @param {import('electron').BrowserWindow} janela
 * @returns {{ motivo: 'minimizado' | 'escondido' | 'coberto', exe?: string } | null}
 */
function foraDaVista(janela) {
  if (janela.isDestroyed()) return null;
  if (janela.isMinimized()) return { motivo: 'minimizado' };
  if (!janela.isVisible()) return { motivo: 'escondido' };
  if (janela.isFocused() || !native?.janelaDaFrente) return null;
  let frente;
  try {
    frente = native.janelaDaFrente();
  } catch {
    return null;
  }
  if (!frente || frente.pid === process.pid || DA_AREA_DE_TRABALHO.has(frente.classe)) return null;
  // SÓ UM PROGRAMA EM TELA CHEIA DE VERDADE (15/11/2026, relato: "dependendo do app, em tela cheia, só trava o vídeo";
  // e2e/mudo-e-pausa-no-app.mjs): uma sobreposição transparente (gravador, Game Bar, contador de quadros) cobria a tela e
  // pausava o vídeo com o Syden à vista atrás dela. O módulo nativo diz se a da frente é uma sobreposição e se ocupa o
  // monitor dela inteiro; um módulo de antes não diz, e fica a regra antiga (cobrir o retângulo do Syden).
  if (frente.sobreposicao === true || frente.telaCheia === false) return null;
  // o retângulo do Syden em pixels de tela (o da frente vem assim do Windows)
  const r = process.platform === 'win32' ? screen.dipToScreenRect(janela, janela.getBounds()) : janela.getBounds();
  const cobre =
    frente.x <= r.x + FOLGA &&
    frente.y <= r.y + FOLGA &&
    frente.x + frente.largura >= r.x + r.width - FOLGA &&
    frente.y + frente.altura >= r.y + r.height - FOLGA;
  return cobre ? { motivo: 'coberto', exe: frente.exe || frente.classe || '' } : null;
}

/** @param {import('electron').BrowserWindow} janela */
function estaAVista(janela) {
  return foraDaVista(janela) === null;
}

/**
 * Vigia a janela e manda 'app:a-vista' (true/false) à página quando muda, e ao carregar a página.
 * @param {import('electron').BrowserWindow} janela
 */
function vigiarAVista(janela) {
  let atual = true;
  const conferir = () => {
    if (janela.isDestroyed()) return;
    const fora = foraDaVista(janela);
    const agora = fora === null;
    if (agora === atual) return;
    atual = agora;
    // o motivo vai junto, para o diário de saúde dizer o que pausou o vídeo (o site de antes ignora o segundo argumento)
    janela.webContents.send('app:a-vista', agora, fora);
  };
  for (const evento of ['minimize', 'restore', 'hide', 'show', 'focus', 'blur']) janela.on(evento, () => setTimeout(conferir, 0));
  // Sem foco, a janela da frente pode mudar sem a do Syden saber (alt-tab entre outros programas): uma conferência
  // por segundo, que só lê duas propriedades do Windows.
  const relogio = setInterval(conferir, 1000);
  janela.on('closed', () => clearInterval(relogio));
  janela.webContents.on('did-finish-load', () => janela.webContents.send('app:a-vista', atual));
}

module.exports = { vigiarAVista, estaAVista, foraDaVista };
