// A SUPRESSÃO QUE DORME SEM VOZ (15/11/2026, auditoria de desempenho): o GTCRN do site custava ~2,2 ms a cada 16 ms, quase
// metade da chamada, e só dormia no silêncio abaixo de −60 dBFS, que um quarto de verdade nunca tem. O worklet ganhou um
// detector de voz (gtcrn.worklet.js, `semVozAgora`). Este teste roda o WORKLET DE VERDADE, aqui no Node, nos três modos:
//
//   nunca   o modelo sempre rodando (a referência: o que a pessoa ouviria sem economia nenhuma)
//   quieto  o de antes: dorme só no silêncio absoluto
//   voz     o novo: dorme sem voz
//
// sobre frases faladas (a voz pt-BR do Windows, gerada na hora) com pausas, em cinco ruídos: quarto, ventilador, teclado, voz
// baixa e ruído alto. Mede: quanto do tempo o modelo roda (a economia); o COMEÇO DAS FRASES, os primeiros 150 ms de cada uma,
// comparados com o "nunca" (é ali que um detector corta: o "s" de "sai daí"); e a voz inteira (a relação entre o que sai no
// "voz" e no "nunca" onde há fala). Guarda os áudios em e2e/fotos/supressao-sem-voz/ para ouvir.
//
//   node e2e/supressao-sem-voz.mjs     (só Windows: a fala vem do System.Speech)
//   MARGEM_DB=6 SEGURA_MS=800 SEM_QUIETO=1 node e2e/supressao-sem-voz.mjs   (varrer o detector)
//
// O RESULTADO (15/11/2026): o detector por energia NÃO foi ao ar, e o padrão do worklet continua o 'quieto'. O "quieto" de
// antes rodou o modelo 100% do tempo em todos os cenários (confirma a auditoria). O "voz", pela margem e pela folga:
//
//   margem/folga   modelo rodando (quarto · ventilador · ruído alto)   começo das frases, pior (quarto · ventilador · ruído alto)
//   4 dB / 500 ms        93% · 90% · 89%                               −0,5 · −0,3 · −2,4 dB
//   6 dB / 800 ms        63% · 59% · 56%                               −1,5 · −3,7 · −7,1 dB
//   6–10 dB / 500 ms     ~55% · ~52% · ~48%                            −1,8 · −5 a −7 · −8 dB a frase inteira cortada
//
// Onde a voz sai intacta, quase não economiza; onde economiza, o começo das frases cai de 4 a 8 dB com ventilador ou ruído
// alto. Com teclado (cliques o tempo todo), o modelo roda sempre em qualquer margem. A voz baixa em quarto silencioso é o
// único caso bom (~55% rodando, sem perda). O caminho, se um dia valer: um detector de voz de verdade (um modelo pequeno).
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RUIDO = join(AQUI, '..', 'web', 'public', 'ruido');
const SAIDA = join(AQUI, 'fotos', 'supressao-sem-voz');
mkdirSync(SAIDA, { recursive: true });
const TAXA = 16000, H = 256, QUANTUM = 128;

// ---- a fala: oito frases de chamada de jogo, pela voz do Windows, a 16 kHz ----
const FRASES = [
  'Sai daí, ele está vindo pela selva de baixo.',
  'Fechou, vou de suporte então.',
  'Shen, chama o Fábio, que ele sabe a fase.',
  'Viu só? Falei que ia funcionar.',
  'Fica de olho no dragão, faltam trinta segundos.',
  'Segura, segura, não entra ainda.',
  'Sério? Foi sem querer, foi mal.',
  'Hum, acho que sim. Vamos tentar de novo depois do jantar.',
];
const pastaDaFala = join(tmpdir(), 'syden-supressao-sem-voz');
mkdirSync(pastaDaFala, { recursive: true });
const script = `Add-Type -AssemblyName System.Speech
$frases = @(${FRASES.map((f) => `'${f.replaceAll("'", "''")}'`).join(',')})
for ($i = 0; $i -lt $frases.Count; $i++) {
  $s = New-Object System.Speech.Synthesis.SpeechSynthesizer; $s.Rate = 1
  $v = $s.GetInstalledVoices() | Where-Object { $_.VoiceInfo.Culture.Name -eq 'pt-BR' } | Select-Object -First 1
  if ($v) { $s.SelectVoice($v.VoiceInfo.Name) }
  $f = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(16000, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
  $s.SetOutputToWaveFile("${pastaDaFala.replaceAll('\\', '\\\\')}\\frase-$i.wav", $f); $s.Speak($frases[$i]); $s.Dispose()
}`;
execFileSync('powershell', ['-NoProfile', '-Command', script], { stdio: 'inherit' });

function lerWav(arq) {
  const b = readFileSync(arq);
  let p = 12;
  while (p < b.length) {
    const id = b.toString('ascii', p, p + 4), tam = b.readUInt32LE(p + 4);
    if (id === 'data') {
      const n = tam / 2, x = new Float32Array(n);
      for (let i = 0; i < n; i++) x[i] = b.readInt16LE(p + 8 + i * 2) / 32768;
      return x;
    }
    p += 8 + tam;
  }
  throw new Error('sem dados: ' + arq);
}
function escreverWav(arq, x) {
  const d = Buffer.alloc(x.length * 2);
  for (let i = 0; i < x.length; i++) d.writeInt16LE(Math.round(Math.max(-1, Math.min(1, x[i])) * 32767), i * 2);
  const c = Buffer.alloc(44);
  c.write('RIFF', 0); c.writeUInt32LE(36 + d.length, 4); c.write('WAVEfmt ', 8); c.writeUInt32LE(16, 16); c.writeUInt16LE(1, 20);
  c.writeUInt16LE(1, 22); c.writeUInt32LE(TAXA, 24); c.writeUInt32LE(TAXA * 2, 28); c.writeUInt16LE(2, 32); c.writeUInt16LE(16, 34);
  c.write('data', 36); c.writeUInt32LE(d.length, 40);
  writeFileSync(arq, Buffer.concat([c, d]));
}
const rms = (x, a = 0, b = x.length) => { let s = 0; for (let i = a; i < b; i++) s += x[i] * x[i]; return Math.sqrt(s / Math.max(1, b - a)); };
const db = (v) => 20 * Math.log10(Math.max(v, 1e-9));

// ---- a linha do tempo: 2 s de ruído só, e as frases com pausas de 1 a 3 s (sempre as mesmas: semente fixa) ----
let semente = 7;
const sorte = () => ((semente = (semente * 1103515245 + 12345) % 2147483648) / 2147483648);
const frases = FRASES.map((_, i) => lerWav(join(pastaDaFala, `frase-${i}.wav`)));
const comecos = []; // onde cada frase começa DE VERDADE (o primeiro trecho de 10 ms com fala), em amostras
let total = 2 * TAXA;
const posicoes = frases.map((f) => { const p = total; total += f.length + Math.round((1 + 2 * sorte()) * TAXA); return p; });
total += TAXA;
const fala = new Float32Array(total);
frases.forEach((f, i) => {
  const r = rms(f);
  for (let k = 0; k < f.length; k++) fala[posicoes[i] + k] = f[k] / r; // cada frase a 0 dB RMS (depois se ajusta o nível)
  for (let k = 0; k + 160 <= f.length; k += 160) if (db(rms(f, k, k + 160) / r) > -30) { comecos.push(posicoes[i] + k); break; }
});
// onde há fala (trechos de 10 ms a menos de 30 dB do RMS da frase), para medir a voz inteira
const temFala = new Uint8Array(total);
for (let k = 0; k + 160 <= total; k += 160) if (db(rms(fala, k, k + 160)) > -30) temFala.fill(1, k, k + 160);

// ---- os ruídos ----
function marrom(n, seed) { let s = seed, m = 0; const x = new Float32Array(n); for (let i = 0; i < n; i++) { s = (s * 1103515245 + 12345) % 2147483648; m = m * 0.98 + ((s / 2147483648) * 2 - 1) * 0.1; x[i] = m; } return x; }
function rosa(n, seed) { // aproximação de Paul Kellet
  let s = seed, b0 = 0, b1 = 0, b2 = 0; const x = new Float32Array(n);
  for (let i = 0; i < n; i++) { s = (s * 1103515245 + 12345) % 2147483648; const w = (s / 2147483648) * 2 - 1; b0 = 0.99765 * b0 + w * 0.099046; b1 = 0.963 * b1 + w * 0.2965164; b2 = 0.57 * b2 + w * 1.0526913; x[i] = b0 + b1 + b2 + w * 0.1848; }
  return x;
}
function ventilador(n) { const x = rosa(n, 11); for (let i = 0; i < n; i++) x[i] += 0.6 * Math.sin((2 * Math.PI * 120 * i) / TAXA) + 0.3 * Math.sin((2 * Math.PI * 240 * i) / TAXA); return x; }
function teclado(n) { // fundo de quarto e cliques de tecla: ~6 por segundo, em rajadas, o ano todo (inclusive no meio da fala)
  const x = marrom(n, 5), s0 = rms(x); for (let i = 0; i < n; i++) x[i] *= 0.05 / s0;
  let s = 99;
  for (let t = 0; t < n; ) {
    s = (s * 1103515245 + 12345) % 2147483648;
    t += Math.round((0.05 + (s / 2147483648) * 0.3) * TAXA);
    for (let k = 0; k < 160 && t + k < n; k++) { s = (s * 1103515245 + 12345) % 2147483648; x[t + k] += ((s / 2147483648) * 2 - 1) * Math.exp(-k / 25) * 2; }
  }
  return x;
}
function nivel(x, alvoDb) { const g = Math.pow(10, alvoDb / 20) / rms(x); return x.map((v) => v * g); }
const CENARIOS = [
  { id: 'quarto', nome: 'quarto (ruído −45, fala −20)', ruido: () => nivel(marrom(total, 3), -45), fala: -20 },
  { id: 'ventilador', nome: 'ventilador (−35, fala −20)', ruido: () => nivel(ventilador(total), -35), fala: -20 },
  { id: 'teclado', nome: 'teclado (cliques, fala −20)', ruido: () => nivel(teclado(total), -38), fala: -20 },
  { id: 'voz-baixa', nome: 'voz baixa (ruído −50, fala −38)', ruido: () => nivel(marrom(total, 9), -50), fala: -38 },
  { id: 'ruido-alto', nome: 'ruído alto (−28, fala −20)', ruido: () => nivel(rosa(total, 4), -28), fala: -20 },
];

// ---- o worklet de verdade, com a thread de áudio de mentira ----
let Classe = null;
globalThis.AudioWorkletProcessor = class { constructor() { this.port = { postMessage() {}, onmessage: null }; } };
globalThis.registerProcessor = (_, c) => { Classe = c; };
await import(pathToFileURL(join(RUIDO, 'gtcrn.worklet.js')).href);
const grafo = JSON.parse(readFileSync(join(RUIDO, 'gtcrn.json'), 'utf8'));
const bin = readFileSync(join(RUIDO, 'gtcrn.bin'));
const pesos = bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength);

function rodar(entrada, sono, extra = {}) {
  const p = new Classe({ processorOptions: { grafo, pesos, sono, ...extra } });
  const saida = new Float32Array(entrada.length);
  const out = [[new Float32Array(QUANTUM)]];
  const t0 = performance.now();
  for (let i = 0; i + QUANTUM <= entrada.length; i += QUANTUM) {
    p.process([[entrada.subarray(i, i + QUANTUM)]], out);
    saida.set(out[0][0], i);
  }
  return { saida, ms: performance.now() - t0, rodados: p.rodados, vistos: p.vistos };
}

// o atraso do worklet (a janela e a folga), achado pela correlação com a fala: para medir o começo no lugar certo
function atrasoDe(ref, x) {
  let melhor = 0, onde = 0;
  for (let a = 0; a <= 1024; a += 16) { let s = 0; for (let i = 2 * TAXA; i < 12 * TAXA; i += 4) s += ref[i] * x[i + a]; if (s > melhor) { melhor = s; onde = a; } }
  return onde;
}

// o nível da fala é o RMS só onde há fala (sem contar as pausas)
const ganhoDaFala = 1 / rms(fala.filter((_, i) => temFala[i]));

// MARGEM_DB e SEGURA_MS mudam o detector (para varrer); sem eles, os padrões do worklet
const EXTRA = { ...(process.env.MARGEM_DB ? { margemDb: +process.env.MARGEM_DB } : {}), ...(process.env.SEGURA_MS ? { seguraMs: +process.env.SEGURA_MS } : {}) };
const resultados = [];
for (const c of CENARIOS) {
  const voz = fala.map((v) => v * ganhoDaFala * Math.pow(10, c.fala / 20));
  const ruido = c.ruido();
  const mix = voz.map((v, i) => v + ruido[i]);
  escreverWav(join(SAIDA, `${c.id}-entrada.wav`), mix);
  const r = {};
  for (const sono of process.env.SEM_QUIETO ? ['nunca', 'voz'] : ['nunca', 'quieto', 'voz']) {
    if (!r.quieto && sono === 'voz') r.quieto = { rodados: NaN, vistos: 1 };
    r[sono] = rodar(mix, sono, sono === 'voz' ? EXTRA : {});
    escreverWav(join(SAIDA, `${c.id}-${sono}.wav`), r[sono].saida);
  }
  const atraso = atrasoDe(voz, r.nunca.saida);
  const ref = r.nunca.saida, nov = r.voz.saida;
  // o começo de cada frase: os 150 ms a partir do primeiro trecho com fala
  const perdas = comecos.map((c0) => {
    const a = c0 + atraso, b = a + Math.round(0.15 * TAXA);
    return db(rms(nov, a, b)) - db(rms(ref, a, b));
  });
  // a voz inteira: quanto o "voz" difere do "nunca" onde há fala (relação sinal/diferença), e a energia que sumiu
  let sRef = 0, sDif = 0, sNov = 0;
  for (let i = 0; i + atraso < total; i++) if (temFala[i]) { const a = ref[i + atraso], b = nov[i + atraso]; sRef += a * a; sNov += b * b; sDif += (a - b) * (a - b); }
  // nas pausas: o que sobra de ruído em cada modo
  const pausas = (x) => { let s = 0, n = 0; for (let i = 0; i + atraso < total; i++) if (!temFala[i] && i > TAXA) { s += x[i + atraso] ** 2; n++; } return db(Math.sqrt(s / n)); };
  resultados.push({
    cenario: c.nome,
    modeloRodando: { nunca: r.nunca.rodados / r.nunca.vistos, quieto: r.quieto.rodados / r.quieto.vistos, voz: r.voz.rodados / r.voz.vistos },
    comecoPiorDb: Math.min(...perdas), comecoMedioDb: perdas.reduce((a, b) => a + b, 0) / perdas.length,
    falaSnrDb: 10 * Math.log10(sRef / Math.max(sDif, 1e-12)), falaPerdidaDb: 10 * Math.log10(sNov / sRef),
    pausasDb: { nunca: pausas(ref), voz: pausas(nov) },
  });
}

const pct = (v) => (v * 100).toFixed(0).padStart(3) + '%';
console.log('\ncenário                              | modelo rodando: nunca quieto  voz | começo das frases: pior  média | fala: relação  perda | pausas: nunca   voz');
for (const r of resultados) {
  console.log(
    `${r.cenario.padEnd(36)} |                ${pct(r.modeloRodando.nunca)}  ${pct(r.modeloRodando.quieto)} ${pct(r.modeloRodando.voz)} |` +
      `            ${r.comecoPiorDb.toFixed(1).padStart(5)} dB ${r.comecoMedioDb.toFixed(1).padStart(5)} dB |` +
      ` ${r.falaSnrDb.toFixed(1).padStart(6)} dB ${r.falaPerdidaDb.toFixed(2).padStart(5)} dB |` +
      ` ${r.pausasDb.nunca.toFixed(0).padStart(5)} dB ${r.pausasDb.voz.toFixed(0).padStart(4)} dB`,
  );
}
writeFileSync(join(SAIDA, 'resultados.json'), JSON.stringify(resultados, null, 2));
console.log(`\nÁudios para ouvir: ${SAIDA}`);
