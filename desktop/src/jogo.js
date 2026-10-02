// @ts-check
const { spawn } = require('node:child_process');
const path = require('node:path');

/**
 * "A PESSOA ESTÁ EM JOGO?" — a pergunta que a janelinha da chamada precisava fazer e não fazia.
 *
 * A janelinha de quem está na sala (sobreposicao.js) aparecia o tempo todo, inclusive na área de
 * trabalho, com o Syden minimizado. A reclamação foi essa: "poluindo a tela fora do Syden". Ela foi
 * desenhada para quem está de costas para o Syden, dentro de um jogo — fora disso, é um retângulo
 * por cima do que a pessoa estiver fazendo.
 *
 * O QUE DÁ PARA SABER DE VERDADE, E O QUE NÃO DÁ. Não existe API do Windows que diga "isto é um
 * jogo"; o Discord resolve com um cadastro de dezenas de milhares de executáveis, que é um produto
 * inteiro à parte. O que dá para saber com certeza é se ALGUM PROGRAMA ESTÁ OCUPANDO A TELA INTEIRA
 * — que é precisamente o caso em que o Syden está invisível e a janelinha tem função. Jogo em
 * janela fica de fora, e é honesto: ali a chamada está a um clique, do lado.
 *
 * A MEDIÇÃO VEM DE FORA (jogo.ps1, que só lê o Windows e escreve uma linha) E A DECISÃO MORA AQUI,
 * em `emJogo()`, que é uma função pura e tem teste. É a mesma divisão de web/src/sobreposicao.ts, e
 * pelo mesmo motivo: a regra que faz uma janela aparecer por cima de tudo não pode morar onde
 * ninguém consegue conferi-la.
 */

/**
 * Quem NÃO conta, por mais que ocupe a tela inteira.
 *
 * O `explorer` é a entrada que faz a função existir, e foi medida antes de ser escrita: a área de
 * trabalho do Windows é uma janela de classe Progman, do explorer, com retângulo 0,0 1536x864 — a
 * tela inteira. Sem tirá-la da conta, estar na área de trabalho contaria como estar em jogo, que é
 * exatamente a reclamação que originou tudo isto.
 */
const IGNORADOS = new Set([
  'explorer',
  'dwm',
  'searchhost',
  'shellexperiencehost',
  'startmenuexperiencehost',
  'lockapp',
  'textinputhost',
]);

/**
 * @typedef {{ nome: string, dono: number, esq: number, topo: number, dir: number, base: number,
 *             telaX: number, telaY: number, telaL: number, telaA: number }} Janela
 */

/** Lê uma linha do jogo.ps1. Linha vazia (nenhuma janela na frente) ou torta devolve `null`. */
function lerLinha(/** @type {string} */ linha) {
  const campos = linha.split('\t');
  if (campos.length !== 10) return null;
  const [nome, ...numeros] = campos;
  const [dono, esq, topo, dir, base, telaX, telaY, telaL, telaA] = numeros.map(Number);
  if (numeros.some((valor) => !Number.isFinite(Number(valor)))) return null;
  return { nome, dono, esq, topo, dir, base, telaX, telaY, telaL, telaA };
}

/**
 * A REGRA. Está em jogo quem tem, na frente, uma janela que cobre o monitor inteiro e não é da casa.
 *
 * COBRIR A TELA INTEIRA É O QUE SEPARA TELA CHEIA DE MAXIMIZADO, e a diferença não é teórica: uma
 * janela maximizada do Firefox mede -6,-6 até 1543,823 num monitor de 1536x864 — mais LARGA que a
 * tela, por causa das bordas invisíveis de redimensionar, e mais BAIXA, porque para na barra de
 * tarefas. Por isso os quatro lados são conferidos, e não a área.
 *
 * @param {Janela | null} janela
 * @param {number} meuPid o processo do próprio Syden: Syden em tela cheia não é jogo, a chamada já está na tela
 */
function emJogo(janela, meuPid) {
  if (!janela) return false;
  if (janela.dono === meuPid) return false;
  if (IGNORADOS.has(janela.nome.toLowerCase())) return false;
  return (
    janela.esq <= janela.telaX &&
    janela.topo <= janela.telaY &&
    janela.dir >= janela.telaX + janela.telaL &&
    janela.base >= janela.telaY + janela.telaA
  );
}

/** O interpretador do Windows, por caminho absoluto: `powershell` solto depende do PATH de quem abriu o app. */
const POWERSHELL = path.join(
  process.env.SystemRoot || 'C:\\Windows',
  'System32',
  'WindowsPowerShell',
  'v1.0',
  'powershell.exe',
);

/** @type {import('node:child_process').ChildProcess | null} */
let sonda = null;

/** @type {(() => void) | null} */
let avisar = null;

let ligado = false;

/** O que sobrou de uma linha partida entre dois pedaços de saída. */
let resto = '';

function definir(/** @type {boolean} */ novo) {
  if (novo === ligado) return;
  ligado = novo;
  avisar?.();
}

function trataSaida(/** @type {Buffer} */ pedaco) {
  resto += pedaco.toString('utf8');
  const linhas = resto.split(/\r?\n/);
  resto = linhas.pop() ?? '';
  for (const linha of linhas) definir(emJogo(lerLinha(linha.replace(/\r$/, '')), process.pid));
}

/**
 * Sem Windows, ou com a sonda fora do ar, a janelinha VOLTA A APARECER SEMPRE.
 *
 * É o comportamento antigo, e é a escolha menos ruim: a alternativa seria uma janelinha que nunca
 * mais aparece, sem ninguém saber por quê. A falha vai para o console do processo principal em vez
 * de ficar calada.
 */
function desistir(/** @type {string} */ porque, /** @type {unknown} */ erro) {
  console.error(`Syden: ${porque}; a janelinha da chamada volta a aparecer sempre.`, erro ?? '');
  sonda = null;
  definir(true);
}

/**
 * Liga a sonda, se ainda não estiver ligada. Chamar de novo não custa nada.
 *
 * `aoMudar` é chamado só quando a resposta MUDA — o script do outro lado também só escreve nessas
 * horas, então não há tráfego enquanto a pessoa fica no mesmo lugar.
 */
function observar(/** @type {() => void} */ aoMudar) {
  avisar = aoMudar;
  if (sonda) return;

  if (process.platform !== 'win32') {
    definir(true); // fora do Windows não há o que medir
    return;
  }

  try {
    sonda = spawn(
      POWERSHELL,
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, 'jogo.ps1')],
      { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] },
    );
  } catch (erro) {
    desistir('não consegui iniciar a sonda de tela cheia', erro);
    return;
  }

  sonda.stdout?.on('data', trataSaida);
  sonda.stderr?.on('data', (pedaco) => console.error('Syden/jogo.ps1:', String(pedaco).trim()));
  sonda.on('error', (erro) => desistir('a sonda de tela cheia falhou', erro));
  sonda.on('exit', () => {
    if (sonda) desistir('a sonda de tela cheia morreu sozinha', null);
  });
}

/** Desliga a sonda. Chamado quando não há mais ninguém na sala — não há o que vigiar. */
function parar() {
  const indo = sonda;
  sonda = null; // antes do kill, para o 'exit' saber que a saída foi pedida
  resto = '';
  ligado = false;
  if (indo) indo.kill();
}

/** A última resposta. Antes da primeira leitura é `false`: na dúvida, não aparecer por cima de nada. */
function estaEmJogo() {
  return ligado;
}

module.exports = { observar, parar, estaEmJogo, emJogo, lerLinha, IGNORADOS };
