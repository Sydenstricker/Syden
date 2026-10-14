// @ts-check
const { ipcMain } = require('electron');

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

/** @type {{ start(onChunk: (pcm: Float32Array) => void, options: { sampleRate: number, channels: number, excludePid?: number, includePid?: number }): void, stop(): void, windowProcess?: (hwnd: number) => { pid: number, exe: string } | null } | null} */
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
function escolherFonte(/** @type {string | null} */ id) {
  fonteEscolhida = id;
}

/** Só o som do programa da janela escolhida, quando dá para saber qual é e ele mesmo toca o som. */
function processoDaJanela() {
  const hwnd = /^window:(\d+):/.exec(fonteEscolhida ?? '')?.[1];
  if (!hwnd || !native?.windowProcess) return null; // tela inteira, ou módulo de uma versão anterior
  const dono = native.windowProcess(Number(hwnd));
  if (!dono || dono.pid === process.pid || DONO_NAO_TOCA.has(dono.exe.toLowerCase())) return null;
  return dono.pid;
}

/** O app consegue mandar o som sem devolver a chamada? */
function available() {
  return Boolean(native) || fake;
}

function stop() {
  running = false;
  if (fakeTimer) {
    clearInterval(fakeTimer);
    fakeTimer = null;
  }
  native?.stop();
}

/** Liga a captura e passa a mandar os pedaços de som para a janela. */
function start(/** @type {Electron.WebContents} */ webContents) {
  if (!available()) return { ok: false, source: null };
  if (running) stop();
  running = true;

  const send = (/** @type {Float32Array} */ pcm) => {
    if (!running || webContents.isDestroyed()) return;
    webContents.send('screen-audio:chunk', pcm);
  };

  try {
    if (native) {
      // includePid: só aquele programa. excludePid: tudo menos o próprio Syden, com seus filhos.
      const pid = processoDaJanela();
      if (pid !== null) {
        try {
          native.start(send, { sampleRate: SAMPLE_RATE, channels: CHANNELS, includePid: pid });
          return { ok: true, source: 'native' };
        } catch (error) {
          console.error('Só o som da janela não abriu; vai o do computador sem o Syden:', error);
        }
      }
      native.start(send, { sampleRate: SAMPLE_RATE, channels: CHANNELS, excludePid: process.pid });
      return { ok: true, source: 'native' };
    }
    startFake(send);
    return { ok: true, source: 'fake' };
  } catch (error) {
    console.error('Não foi possível capturar o som do computador:', error);
    running = false;
    return { ok: false, source: null };
  }
}

function setupScreenAudio() {
  ipcMain.handle('screen-audio:start', (event) => start(event.sender));
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
