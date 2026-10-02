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
 * QUEM RESPONDE "ISTO É UM JOGO" É O PRÓPRIO WINDOWS. A primeira versão disto usava tela cheia como
 * aproximação, e a aproximação cobrava: o VS Code em tela cheia virava "jogo", e a janelinha
 * aparecia por cima do trabalho. A Barra de Jogos do Windows já mantém a lista do que ELA reconhece
 * como jogo (é a mesma que decide se o Win+G aparece), e medida aqui ela tinha 75 executáveis e
 * ZERO falsos positivos — nenhum navegador, editor, Discord, Word ou OBS. Cobre Steam, Epic, Riot,
 * Blizzard, EA e jogo solto numa pasta qualquer.
 *
 * A FALHA CONHECIDA, e ela é pequena: um jogo que o Windows ainda não catalogou — a primeiríssima
 * vez que você o abre — não está na lista, e a janelinha não aparece nessa sessão. Da segunda em
 * diante, aparece. Preferi isso a aparecer por cima do editor de código.
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

/** @typedef {{ nome: string, dono: number, conhecido: boolean, caminho: string }} Janela */

/** Lê uma linha do jogo.ps1. Linha vazia (nenhuma janela na frente) ou torta devolve `null`. */
function lerLinha(/** @type {string} */ linha) {
  const campos = linha.split('\t');
  if (campos.length !== 4) return null;
  const [nome, dono, conhecido, caminho] = campos;
  if (!/^\d+$/.test(dono) || (conhecido !== '0' && conhecido !== '1')) return null;
  return { nome, dono: Number(dono), conhecido: conhecido === '1', caminho };
}

/**
 * A REGRA. Está em jogo quem tem, na frente, um programa que o WINDOWS reconhece como jogo.
 *
 * A primeira versão media tela cheia, e a aproximação cobrava: o VS Code em tela cheia virava jogo e
 * a janelinha aparecia por cima do trabalho. Agora quem responde é a lista da Barra de Jogos, lida
 * pelo jogo.ps1 — e as duas linhas abaixo continuam valendo por cima dela, porque uma lista pode
 * conter o que não deveria:
 *
 *   - O PRÓPRIO SYDEN nunca conta. Se ele estiver na frente, a chamada já está na tela, e a
 *     janelinha repetiria a mesma lista duas vezes.
 *   - A CASA DO WINDOWS nunca conta (ver IGNORADOS), por garantia: a área de trabalho é uma janela
 *     como qualquer outra, e já passou por jogo uma vez neste arquivo.
 *
 * @param {Janela | null} janela
 * @param {number} meuPid o processo do próprio Syden
 */
function emJogo(janela, meuPid) {
  if (!janela) return false;
  if (janela.dono === meuPid) return false;
  if (IGNORADOS.has(janela.nome.toLowerCase())) return false;
  return janela.conhecido;
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
