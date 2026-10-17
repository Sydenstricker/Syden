// @ts-check
const { ipcMain, MessageChannelMain } = require('electron');

/**
 * Som da transmissão sem devolver a chamada junto.
 *
 * O Windows não entrega o som de um programa só, mas desde a versão 2004 ele sabe fazer o contrário:
 * entregar o som do computador inteiro MENOS o de um programa. Apontando esse "menos" para o próprio
 * Syden, sobra exatamente o que a pessoa quer transmitir (o jogo, o vídeo, o que for) sem as vozes de
 * quem está na chamada. Quem fala com o Windows é um módulo nativo em C++ (syden-audio).
 *
 * QUANDO A TRANSMISSÃO É DE UMA JANELA, o pedido se inverte: "só o som DESTE programa e dos filhos dele".
 * Assim nem o Discord (a turma que usa os dois ouvia as vozes duas vezes) nem o Spotify nem as notificações
 * vão junto — só o jogo. A janela diz o processo pelo seletor (window:<hwnd>:0) e o módulo, pelo Windows.
 *
 * Sem o módulo (ou fora do Windows), isto devolve "indisponível" e o app continua como era: o som vai
 * inteiro, com eco, e o aviso na tela explica isso. Em desenvolvimento, SYDEN_FAKE_AUDIO=1 gera um tom
 * no lugar do módulo, para dar para testar todo o caminho do áudio sem precisar de compilador.
 */

const SAMPLE_RATE = 48000;
const CHANNELS = 2;
const CHUNK_MS = 10;
const CHUNK_FRAMES = (SAMPLE_RATE * CHUNK_MS) / 1000;

/** @type {{ start(onChunk: (pcm: Float32Array | null, erro?: string) => void, options: { sampleRate: number, channels: number, excludePid?: number, includePid?: number }): void, stop(): void, windowProcess?: (hwnd: number) => { pid: number, exe: string } | null } | null} */
let native = null;
try {
  const path = require('node:path');
  // Empacotado, o módulo fica fora do asar (o Windows só carrega biblioteca nativa de arquivo de verdade).
  const base = __dirname.includes('app.asar') ? __dirname.replace('app.asar', 'app.asar.unpacked') : __dirname;
  native = require(path.join(base, '..', 'native', 'build', 'Release', 'syden_audio.node'));
} catch {
  native = null; // ainda não compilado nesta máquina: o app funciona sem, do jeito antigo
}

const fake = process.env.SYDEN_FAKE_AUDIO === '1';

/** @type {NodeJS.Timeout | null} */
let fakeTimer = null;
let running = false;
/** Quando a captura morreu no meio e foi religada sozinha (para não religar em laço se ela morrer de novo e de novo). */
let religadas = /** @type {number[]} */ ([]);

/** Tom de teste no lugar do módulo nativo: 440 Hz nos dois canais. */
function startFake(/** @type {(pcm: Float32Array) => void} */ onChunk) {
  let phase = 0;
  const step = (2 * Math.PI * 440) / SAMPLE_RATE;
  fakeTimer = setInterval(() => {
    const pcm = new Float32Array(CHUNK_FRAMES * CHANNELS);
    for (let i = 0; i < CHUNK_FRAMES; i++) {
      const sample = Math.sin(phase) * 0.25;
      phase += step;
      pcm[i * CHANNELS] = sample;
      pcm[i * CHANNELS + 1] = sample;
    }
    onChunk(pcm);
  }, CHUNK_MS);
}

/**
 * Programas cuja janela não é de quem toca o som. Os apps da Store moram dentro do ApplicationFrameHost:
 * capturar só ele daria silêncio, então nesses casos fica o jeito da tela inteira (tudo menos o Syden).
 */
const DONO_NAO_TOCA = new Set(['applicationframehost.exe', 'explorer.exe']);

/** O que foi escolhido no seletor por último: "window:<hwnd>:0", "screen:0:0" ou nada. */
let fonteEscolhida = /** @type {string | null} */ (null);
/** A janela do app que recebe o som (a da última captura ligada). */
let destino = /** @type {Electron.WebContents | null} */ (null);
function escolherFonte(/** @type {string | null} */ id) {
  const mudou = id !== fonteEscolhida;
  fonteEscolhida = id;
  // TROCOU DE FONTE NO MEIO DA TRANSMISSÃO (revisão de 16/10/2026): a captura seguia com o modo da primeira escolha —
  // da janela A para a B, quem assistia via a B e ouvia a A; da janela para a tela inteira, só um programa. Recomeça.
  if (mudou && running && destino && !destino.isDestroyed()) start(destino);
}

/** Só o som do programa da janela escolhida, quando dá para saber qual é e ele mesmo toca o som. */
function processoDaJanela() {
  const hwnd = /^window:(\d+):/.exec(fonteEscolhida ?? '')?.[1];
  if (!hwnd || !native?.windowProcess) return null; // tela inteira, ou módulo de uma versão anterior
  // (se a consulta falhar, fica o som do computador sem o Syden, e não o silêncio)
  try {
    const dono = native.windowProcess(Number(hwnd));
    if (!dono || dono.pid === process.pid || DONO_NAO_TOCA.has(String(dono.exe).toLowerCase())) return null;
    return dono.pid;
  } catch (error) {
    console.error('Não deu para saber o programa da janela:', error);
    return null;
  }
}

/** O app consegue mandar o som sem devolver a chamada? */
function available() {
  return Boolean(native) || fake;
}

/**
 * A porta que leva os pedaços DIRETO à thread de áudio da página (o tocador em web/public/pcm-player.worklet.js), como a
 * supressão de ruído faz (ver ruido/index.js). Antes cada pedaço de 10 ms ia por webContents.send até a thread
 * principal da página, e de lá ao tocador: dois saltos, e a página divide tempo com o quarto, o salão e a chamada — um
 * engasgo dela era um buraco no som (auditoria do áudio, 17/10/2026). Só existe quando a página pede (site novo); o
 * site anterior continua recebendo por 'screen-audio:chunk'. Sobrevive ao religar a captura: a página não fica sabendo.
 * @type {Electron.MessagePortMain | null}
 */
let porta = null;

function fecharPorta() {
  porta?.close();
  porta = null;
}

/** Para a captura (o módulo ou o tom de teste), sem mexer na porta: religar usa a mesma. */
function pararCaptura() {
  running = false;
  if (fakeTimer) {
    clearInterval(fakeTimer);
    fakeTimer = null;
  }
  native?.stop();
}

/** Para de vez: a captura e a porta. */
function stop() {
  pararCaptura();
  fecharPorta();
}

/** Conta à página o que aconteceu com a captura, para o diário da aba de saúde (ver web/src/screenAudio.ts). */
function avisar(/** @type {Electron.WebContents} */ webContents, /** @type {string} */ motivo) {
  if (!webContents.isDestroyed()) webContents.send('screen-audio:aviso', motivo);
}

/**
 * A captura morreu no meio (o módulo nativo avisa: trocou a saída de som, tirou o fone, o serviço de áudio do Windows
 * reiniciou). Antes isso era silêncio para sempre, com tudo dizendo que o som ia (auditoria do áudio, 17/10/2026).
 * RELIGA SOZINHA, que é o que resolve os casos comuns (a captura de processo segue a saída padrão nova); até 3 vezes por
 * minuto, e depois desiste, porque aí é a máquina que não deixa, e religar em laço só esconderia isso.
 */
function morreuNoMeio(/** @type {Electron.WebContents} */ webContents, /** @type {string} */ erro) {
  console.error('A captura de som parou no meio:', erro);
  if (!running || webContents.isDestroyed()) return;
  const agora = Date.now();
  religadas = religadas.filter((t) => agora - t < 60_000);
  if (religadas.length >= 3) {
    pararCaptura();
    avisar(webContents, `${erro}; desisti de religar (3 vezes no último minuto)`);
    return;
  }
  religadas.push(agora);
  // Fora do aviso do módulo: o stop() do religar espera a thread de captura terminar.
  setImmediate(() => {
    if (!running || webContents.isDestroyed()) return;
    const r = start(webContents);
    avisar(webContents, r.ok ? `${erro}; religada sozinha` : `${erro}; não religou`);
  });
}

/**
 * Liga a captura e passa a mandar os pedaços de som para a janela. `querPorta`: a página pediu a porta direta (só quem
 * chama pelo IPC; religar por dentro mantém a que já existe).
 */
function start(/** @type {Electron.WebContents} */ webContents, querPorta = false) {
  if (!available()) return { ok: false, source: null };
  if (running) pararCaptura();
  running = true;
  destino = webContents;
  if (querPorta) {
    fecharPorta();
    const { port1, port2 } = new MessageChannelMain();
    porta = port1;
    // Vai antes da resposta do start: a página já está esperando por ela (ver web/src/screenAudio.ts).
    webContents.postMessage('screen-audio:porta', null, [port2]);
  }

  const send = (/** @type {Float32Array | null} */ pcm, /** @type {string | undefined} */ erro) => {
    if (!running || webContents.isDestroyed()) return;
    if (!pcm) {
      morreuNoMeio(webContents, erro ?? 'a captura de som parou no meio');
      return;
    }
    if (porta) porta.postMessage(pcm);
    else webContents.send('screen-audio:chunk', pcm);
  };
  const resposta = (/** @type {'native' | 'fake'} */ source) => ({ ok: true, source, porta: Boolean(porta) });

  try {
    if (native) {
      // includePid: só aquele programa. excludePid: tudo menos o próprio Syden, com seus filhos.
      const pid = processoDaJanela();
      if (pid !== null) {
        try {
          native.start(send, { sampleRate: SAMPLE_RATE, channels: CHANNELS, includePid: pid });
          return resposta('native');
        } catch (error) {
          console.error('Só o som da janela não abriu; vai o do computador sem o Syden:', error);
        }
      }
      native.start(send, { sampleRate: SAMPLE_RATE, channels: CHANNELS, excludePid: process.pid });
      return resposta('native');
    }
    startFake(send);
    return resposta('fake');
  } catch (error) {
    console.error('Não foi possível capturar o som do computador:', error);
    running = false;
    if (querPorta) fecharPorta();
    return { ok: false, source: null };
  }
}

function setupScreenAudio() {
  ipcMain.handle('screen-audio:start', (event, opcoes) => start(event.sender, Boolean(opcoes?.porta)));
  ipcMain.on('screen-audio:stop', () => stop());
  ipcMain.handle('screen-audio:available', () => available());
}

module.exports = {
  setupScreenAudio,
  screenAudioAvailable: available,
  stopScreenAudio: stop,
  escolherFonteDoSom: escolherFonte,
  startScreenAudio: start,
  SAMPLE_RATE,
  CHANNELS,
};
