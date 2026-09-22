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
 * Sem o módulo (ou fora do Windows), isto devolve "indisponível" e o app continua como era: o som vai
 * inteiro, com eco, e o aviso na tela explica isso. Em desenvolvimento, SYDEN_FAKE_AUDIO=1 gera um tom
 * no lugar do módulo, para dar para testar todo o caminho do áudio sem precisar de compilador.
 */

const SAMPLE_RATE = 48000;
const CHANNELS = 2;
const CHUNK_MS = 10;
const CHUNK_FRAMES = (SAMPLE_RATE * CHUNK_MS) / 1000;

/** @type {{ start(onChunk: (pcm: Float32Array) => void, options: { sampleRate: number, channels: number, excludePid: number }): void, stop(): void } | null} */
let native = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  native = require('syden-audio');
} catch {
  native = null; // ainda não compilado para esta máquina: o app funciona sem
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
      // excludePid: o processo a NÃO capturar — o próprio Syden, com seus filhos.
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

module.exports = { setupScreenAudio, screenAudioAvailable: available, stopScreenAudio: stop, SAMPLE_RATE, CHANNELS };
