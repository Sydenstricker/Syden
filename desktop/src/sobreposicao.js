// @ts-check
const { BrowserWindow, ipcMain, screen } = require('electron');
const path = require('node:path');
const jogo = require('./jogo');

/**
 * QUEM ESTÁ NA CHAMADA, POR CIMA DO JOGO.
 *
 * Em tela cheia o Syden some, e saber quem está falando vira adivinhação. O Discord resolve isso
 * desenhando DENTRO do jogo — ele engancha o DirectX, o que é a peça mais invasiva que ele tem e a que
 * faz antivírus e anticheat reclamarem dele. O Syden não faz isso, e não vai fazer.
 *
 * O que ele faz é uma janela comum: sem borda, sempre no topo, com fundo transparente e ATRAVESSÁVEL
 * PELO CLIQUE — o mouse passa direto e o tiro vai no jogo. Em tela cheia exclusiva não aparece, e é
 * honesto dizer isso em vez de prometer o que depende do gancho.
 *
 * ELA SÓ APARECE COM UM PROGRAMA OCUPANDO A TELA INTEIRA (ver jogo.js). Antes aparecia sempre que
 * houvesse gente na sala, e a reclamação foi direta: "poluindo a tela fora do Syden" — Syden
 * minimizado, pessoa na área de trabalho, retângulo por cima. Jogo em janela deixou de mostrá-la, e
 * é a troca certa: ali a chamada está a um clique, do lado.
 *
 * ---------------------------------------------------------------------------------------------------
 * TRÊS COISAS QUE PARECEM DETALHE E NÃO SÃO:
 *
 *   `setIgnoreMouseEvents(true, { forward: true })` — sem o `forward`, a janela deixa de receber
 *   clique E deixa de saber que o mouse passou por cima, o que impediria qualquer reação futura. Com
 *   ele, o clique atravessa e a janela ainda enxerga o ponteiro.
 *
 *   `'screen-saver'` no alwaysOnTop, e não `true` — o nível normal perde para jogos, que também pedem
 *   para ficar por cima. Este é o nível acima, o mesmo que protetores de tela usam.
 *
 *   `skipTaskbar` — sem ele, o Syden aparece DUAS vezes na barra de tarefas, e a segunda é uma janela
 *   que não dá para clicar. Confunde e parece defeito.
 * ---------------------------------------------------------------------------------------------------
 */

/** @type {BrowserWindow | null} */
let janela = null;

/** A última lista recebida, para a janela recém-criada já nascer preenchida em vez de piscar vazia. */
let ultimaLista = [];

/** Em que canto ela fica. Escolhido nas configurações do site, guardado lá também. */
let canto = 'superior-esquerdo';

const MARGEM = 24;
const LARGURA = 230;
/** Altura de cada linha, mais o respiro de cima e de baixo. Precisa bater com o CSS do HTML. */
const ALTURA_DA_LINHA = 36;
const RESPIRO = 8;

function posicao(altura) {
  const tela = screen.getPrimaryDisplay().workArea;
  const emCima = canto.startsWith('superior');
  const naEsquerda = canto.endsWith('esquerdo');
  return {
    x: Math.round(naEsquerda ? tela.x + MARGEM : tela.x + tela.width - LARGURA - MARGEM),
    y: Math.round(emCima ? tela.y + MARGEM : tela.y + tela.height - altura - MARGEM),
  };
}

function criar() {
  janela = new BrowserWindow({
    width: LARGURA,
    height: ALTURA_DA_LINHA + RESPIRO * 2,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    focusable: false, // clicar (ou tentar) nunca tira o foco do jogo
    skipTaskbar: true,
    show: false,
    // hasShadow desligado: a sombra de janela do Windows desenharia um retângulo escuro em volta de
    // uma janela que é quase toda transparente, e o retângulo apareceria por cima do jogo.
    hasShadow: false,
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'sobreposicao-preload.js'),
    },
  });

  janela.setIgnoreMouseEvents(true, { forward: true });
  janela.setAlwaysOnTop(true, 'screen-saver');
  // Aparece também nas outras áreas de trabalho e por cima de janelas em tela cheia de outros apps.
  janela.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  void janela.loadFile(path.join(__dirname, 'sobreposicao.html'));

  janela.on('closed', () => {
    janela = null;
  });

  // A lista que chegou antes de a janela existir não se perde: ela é reenviada assim que a página
  // termina de carregar. Sem isto, entrar numa chamada mostraria uma janelinha vazia por um instante.
  janela.webContents.on('did-finish-load', () => desenhar());
  return janela;
}

function desenhar() {
  if (!janela || janela.isDestroyed()) return;
  janela.webContents.send('sobreposicao:lista', ultimaLista);
  const altura = Math.max(1, ultimaLista.length) * ALTURA_DA_LINHA + RESPIRO * 2;
  const { x, y } = posicao(altura);
  janela.setBounds({ x, y, width: LARGURA, height: altura });
}

/**
 * DUAS CONDIÇÕES, NÃO UMA: ter gente na sala E haver um jogo ocupando a tela.
 *
 * Antes bastava a primeira, e por isso a janelinha ficava por cima da área de trabalho com o Syden
 * minimizado. Ela existe para quem está de costas para o Syden; com o Syden à vista, é um retângulo
 * em cima do que a pessoa estiver fazendo. Quem responde a segunda pergunta é jogo.js.
 */
function aplicar() {
  if (ultimaLista.length === 0 || !jogo.estaEmJogo()) return esconder();
  if (!janela || janela.isDestroyed()) criar();
  desenhar();
  // showInactive, e não show: trazer a janelinha para frente COM FOCO tiraria o jogo do primeiro
  // plano, que em tela cheia é o mesmo que minimizar o jogo da pessoa no meio da partida.
  if (janela && !janela.isVisible()) janela.showInactive();
}

/** Mostra (criando se precisar) com a lista dada. Lista vazia esconde. */
function mostrar(lista, cantoEscolhido) {
  ultimaLista = Array.isArray(lista) ? lista : [];
  if (cantoEscolhido) canto = cantoEscolhido;

  // SEM NINGUÉM NA SALA, A SONDA TAMBÉM PARA. Não há o que vigiar, e deixá-la viva faria o Syden
  // carregar um processo a mais o tempo todo por causa de uma janelinha que não ia aparecer.
  if (ultimaLista.length === 0) {
    jogo.parar();
    return esconder();
  }

  jogo.observar(aplicar);
  aplicar();
}

function esconder() {
  if (janela && !janela.isDestroyed()) janela.hide();
}

function fechar() {
  if (janela && !janela.isDestroyed()) janela.destroy();
  janela = null;
  // A sonda é um processo FILHO, e processo filho não morre junto por educação: fechando o Syden sem
  // isto, sobraria um powershell vivo na máquina de quem usa.
  jogo.parar();
}

function ligar() {
  ipcMain.on('sobreposicao:mostrar', (_evento, { lista, canto: c }) => mostrar(lista, c));
  ipcMain.on('sobreposicao:esconder', () => {
    ultimaLista = [];
    jogo.parar();
    esconder();
  });
}

module.exports = { ligar, fechar };
