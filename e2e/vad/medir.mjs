// O GTCRN QUE DORME PELO SILERO VAD (15/11/2026): o irmão de e2e/supressao-sem-voz.mjs, com a MESMA montagem de áudio (as oito
// frases pt-BR da voz do Windows, as mesmas pausas, os mesmos cinco ruídos e níveis), mas quem decide se o modelo dorme é um
// detector de voz de verdade: o Silero VAD v6 em JS puro (e2e/vad/silero.mjs), no lugar da energia (`semVozAgora`).
//
// Roda o WORKLET DE VERDADE (web/public/ruido/gtcrn.worklet.js), sem mudar nada nele: a classe é estendida AQUI e só o
// `semVozAgora` é trocado (ele só é chamado no modo sono 'voz'). Compara cada detector com o "nunca" (o modelo sempre rodando)
// e mede o mesmo que o teste de antes: quanto do tempo o modelo roda, o COMEÇO DAS FRASES (os primeiros 150 ms de cada uma,
// contra o "nunca"), a voz inteira e o que sobra nas pausas. Mais um detector de referência: o ORÁCULO, que sabe onde há fala
// (a régua: o melhor que um detector perfeito, sem antecipação, conseguiria — e quanto se perde só por acordar o modelo).
//
//   node e2e/vad/medir.mjs                (só Windows: a fala vem do System.Speech; os modelos em e2e/vad/modelos/, ver README)
//   SO=quarto,ventilador node e2e/vad/medir.mjs
//   DET=oraculo-300,sil+agudo6x3s-150 node e2e/vad/medir.mjs   (só esses detectores)
//
// O RESULTADO (15/11/2026, tabelas em e2e/vad/README.md): o Silero SOZINHO acorda na hora nas vogais, mas deixa MUDA a
// fricativa surda do começo ("Shen", "Sério") com ventilador, teclado ou ruído alto (−150 dB nos primeiros 150 ms). Com o
// AGUDO junto (a faixa de 3,5–8 kHz, 6 dB acima do piso por 3 quadros seguidos, segura 150 ms), o 'sil+agudo6x3s-150': o modelo
// roda ~50% do tempo (é a fração com fala nesta linha do tempo) e o começo das frases fica perto do oráculo nos cinco ruídos,
// com uma exceção no teclado (uma frase a −24 dB).
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { criarSilero, pesosDoOnnx } from './silero.mjs';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RUIDO = join(AQUI, '..', '..', 'web', 'public', 'ruido');
const SAIDA = join(AQUI, '..', 'fotos', 'vad');
mkdirSync(SAIDA, { recursive: true });
const TAXA = 16000, H = 256, QUANTUM = 128;

// ---- a fala: as mesmas oito frases de e2e/supressao-sem-voz.mjs ----
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

// ---- a linha do tempo: idêntica à de e2e/supressao-sem-voz.mjs (semente 7) ----
let semente = 7;
const sorte = () => ((semente = (semente * 1103515245 + 12345) % 2147483648) / 2147483648);
const frases = FRASES.map((_, i) => lerWav(join(pastaDaFala, `frase-${i}.wav`)));
const comecos = [];
let total = 2 * TAXA;
const posicoes = frases.map((f) => { const p = total; total += f.length + Math.round((1 + 2 * sorte()) * TAXA); return p; });
total += TAXA;
const fala = new Float32Array(total);
frases.forEach((f, i) => {
  const r = rms(f);
  for (let k = 0; k < f.length; k++) fala[posicoes[i] + k] = f[k] / r;
  for (let k = 0; k + 160 <= f.length; k += 160) if (db(rms(f, k, k + 160) / r) > -30) { comecos.push(posicoes[i] + k); break; }
});
const temFala = new Uint8Array(total);
for (let k = 0; k + 160 <= total; k += 160) if (db(rms(fala, k, k + 160)) > -30) temFala.fill(1, k, k + 160);

// ---- os ruídos: idênticos ----
function marrom(n, seed) { let s = seed, m = 0; const x = new Float32Array(n); for (let i = 0; i < n; i++) { s = (s * 1103515245 + 12345) % 2147483648; m = m * 0.98 + ((s / 2147483648) * 2 - 1) * 0.1; x[i] = m; } return x; }
function rosa(n, seed) {
  let s = seed, b0 = 0, b1 = 0, b2 = 0; const x = new Float32Array(n);
  for (let i = 0; i < n; i++) { s = (s * 1103515245 + 12345) % 2147483648; const w = (s / 2147483648) * 2 - 1; b0 = 0.99765 * b0 + w * 0.099046; b1 = 0.963 * b1 + w * 0.2965164; b2 = 0.57 * b2 + w * 1.0526913; x[i] = b0 + b1 + b2 + w * 0.1848; }
  return x;
}
function ventilador(n) { const x = rosa(n, 11); for (let i = 0; i < n; i++) x[i] += 0.6 * Math.sin((2 * Math.PI * 120 * i) / TAXA) + 0.3 * Math.sin((2 * Math.PI * 240 * i) / TAXA); return x; }
function teclado(n) {
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
].filter((c) => !process.env.SO || process.env.SO.split(',').includes(c.id));

// ---- o worklet de verdade, com a thread de áudio de mentira ----
let Classe = null;
globalThis.AudioWorkletProcessor = class { constructor() { this.port = { postMessage() {}, onmessage: null }; } };
globalThis.registerProcessor = (_, c) => { Classe = c; };
await import(pathToFileURL(join(RUIDO, 'gtcrn.worklet.js')).href);
const grafo = JSON.parse(readFileSync(join(RUIDO, 'gtcrn.json'), 'utf8'));
const bin = readFileSync(join(RUIDO, 'gtcrn.bin'));
const pesos = bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength);
const pesosVad = pesosDoOnnx(join(AQUI, 'modelos', 'silero_vad_16k_op15.onnx'));

// O DETECTOR NO LUGAR DO DE ENERGIA. A cada quadro do GTCRN (256 amostras novas, 16 ms):
//   silero    o Silero roda a cada DOIS quadros, nas 512 amostras novas (o pedaço para o qual ele foi treinado, 32 ms)
//   silero16  o Silero roda a CADA quadro, na janela das últimas 512 (passo de 16 ms: decide mais cedo, custa o dobro, e o
//             estado dele anda no dobro do ritmo do treino)
//   oraculo   sabe onde há fala (a régua)
// Voz é a probabilidade passar de `liga`; ela só deixa de ser voz abaixo de `desliga` (histerese), e o modelo continua
// rodando `seguraMs` depois da última voz (o fim das palavras).
// O AGUDO, companheiro do Silero (medido no 1º turno: o Silero acorda na hora nas VOGAIS, mas não vê a fricativa surda do
// começo — o "Sh" de "Shen" e o "S" de "Sério" com ventilador ou ruído alto saíam MUDOS, −150 dB nos primeiros 150 ms). A
// fricativa é quase só energia entre 3,5 e 8 kHz, onde ventilador e ruído rosa têm pouco. Então: a energia dessa faixa no
// quadro novo (FFT de 512 com Hann, ~0,02 ms), suavizada e comparada com o seu PISO (o mínimo, que sobe ~1 dB/s, como o
// detector de energia do worklet). Passou `agudoDb` acima do piso, o modelo acorda e fica acordado `agudoMs`; se o Silero
// confirmar voz nesse meio-tempo, vale a folga dele. Um clique de tecla acorda o modelo por `agudoMs` e só.
const NA = 512, bitsA = new Uint16Array(NA), cosA = new Float32Array(NA / 2), senA = new Float32Array(NA / 2), hannA = new Float32Array(NA);
for (let i = 0, j = 0; i < NA; i++) { bitsA[i] = j; let bit = NA >> 1; while (j & bit) { j ^= bit; bit >>= 1; } j |= bit; }
for (let i = 0; i < NA / 2; i++) { cosA[i] = Math.cos((2 * Math.PI * i) / NA); senA[i] = Math.sin((2 * Math.PI * i) / NA); }
for (let i = 0; i < NA; i++) hannA[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / NA);
const reA = new Float32Array(NA), imA = new Float32Array(NA);
function energiaAguda(x) { // x: 512 amostras; devolve a energia entre 3,5 e 8 kHz
  for (let i = 0; i < NA; i++) { const j = bitsA[i]; reA[j] = x[i] * hannA[i]; imA[j] = 0; }
  for (let len = 2; len <= NA; len <<= 1) {
    const meio = len >> 1, salto = NA / len;
    for (let i = 0; i < NA; i += len) for (let k = 0; k < meio; k++) {
      const wr = cosA[k * salto], wi = -senA[k * salto], a = i + k, b = a + meio;
      const tr = reA[b] * wr - imA[b] * wi, ti = reA[b] * wi + imA[b] * wr;
      reA[b] = reA[a] - tr; imA[b] = imA[a] - ti; reA[a] += tr; imA[a] += ti;
    }
  }
  let e = 1e-12;
  for (let k = 112; k <= 256; k++) e += reA[k] * reA[k] + imA[k] * imA[k]; // bin k = k·31,25 Hz
  return e;
}

class ComDetector extends Classe {
  constructor(options) {
    super(options);
    const d = options.processorOptions.detector;
    this.det = d;
    this.vad = d.tipo.startsWith('silero') ? criarSilero(pesosVad) : null;
    this.ultimas = new Float32Array(512);
    this.prob = 0; this.emVoz = false; this.depois = Infinity;
    this.segura = Math.round((d.seguraMs / 1000) * TAXA / H);
    this.vadMs = 0; this.vadVezes = 0;
    this.agudo = d.agudoDb ? { margem: Math.pow(10, d.agudoDb / 10), segura: Math.round((d.agudoMs / 1000) * TAXA / H), piso: 0, es: 0, depois: Infinity, seguidos: 0, exige: d.agudoSeguidos || 1, suave: d.agudoSuave ?? 0.5 } : null;
    this.acordadosPeloAgudo = 0;
  }
  semVozAgora() {
    const d = this.det, n = this.vistos; // este quadro: as amostras [(n − 1)·256, n·256)
    const t0 = performance.now();
    if (d.tipo === 'oraculo') {
      let v = false;
      for (let i = (n - 1) * H; i < n * H && i < total; i++) if (temFala[i]) { v = true; break; }
      this.emVoz = v;
    } else {
      this.ultimas.copyWithin(0, H);
      this.ultimas.set(this.entrada.subarray(512 - H), 512 - H);
      if (d.tipo === 'silero16' || n % 2 === 0) { this.prob = this.vad.rodar(this.ultimas); this.vadVezes++; }
      this.emVoz = this.emVoz ? this.prob >= d.desliga : this.prob >= d.liga;
    }
    let pelaFaixa = false;
    const a = this.agudo;
    if (a) {
      const e = energiaAguda(this.entrada);
      const primeiro = a.piso === 0;
      a.es = primeiro ? e : a.es + (e - a.es) * a.suave;
      const acima = !primeiro && a.es > a.piso * a.margem;
      if (primeiro) a.piso = a.es; else a.piso = a.es < a.piso ? a.es : a.piso * (acima ? 1.0004 : 1.004);
      // `agudoSeguidos`: só conta depois de N quadros seguidos acima (o clique de tecla dura um quadro; a fricativa, 5 a 12)
      a.seguidos = acima ? a.seguidos + 1 : 0;
      a.depois = a.seguidos >= a.exige ? 0 : a.depois + 1;
      pelaFaixa = a.depois <= a.segura;
    }
    this.vadMs += performance.now() - t0;
    this.depois = this.emVoz ? 0 : this.depois + 1;
    const dormir = this.depois > this.segura && !pelaFaixa;
    if (!dormir && this.depois > this.segura) this.acordadosPeloAgudo++;
    return dormir;
  }
}

function rodar(entrada, sono, detector) {
  const p = new (detector ? ComDetector : Classe)({ processorOptions: { grafo, pesos, sono, detector } });
  const saida = new Float32Array(entrada.length);
  const out = [[new Float32Array(QUANTUM)]];
  for (let i = 0; i + QUANTUM <= entrada.length; i += QUANTUM) {
    p.process([[entrada.subarray(i, i + QUANTUM)]], out);
    saida.set(out[0][0], i);
  }
  return { saida, rodados: p.rodados, vistos: p.vistos, vadMsPorQuadro: p.vadVezes ? p.vadMs / p.vistos : 0, peloAgudo: p.acordadosPeloAgudo ? p.acordadosPeloAgudo / p.vistos : 0 };
}
function atrasoDe(ref, x) {
  let melhor = 0, onde = 0;
  for (let a = 0; a <= 1024; a += 16) { let s = 0; for (let i = 2 * TAXA; i < 12 * TAXA; i += 4) s += ref[i] * x[i + a]; if (s > melhor) { melhor = s; onde = a; } }
  return onde;
}
const ganhoDaFala = 1 / rms(fala.filter((_, i) => temFala[i]));

const DETECTORES = [
  { id: 'oraculo-300', tipo: 'oraculo', seguraMs: 300 },
  { id: 'silero-.5/.35-300', tipo: 'silero', liga: 0.5, desliga: 0.35, seguraMs: 300 },
  { id: 'silero-.3/.2-300', tipo: 'silero', liga: 0.3, desliga: 0.2, seguraMs: 300 },
  { id: 'silero-.3/.2-500', tipo: 'silero', liga: 0.3, desliga: 0.2, seguraMs: 500 },
  { id: 'silero16-.3/.2-300', tipo: 'silero16', liga: 0.3, desliga: 0.2, seguraMs: 300 },
  { id: 'sil+agudo6-200', tipo: 'silero', liga: 0.3, desliga: 0.2, seguraMs: 300, agudoDb: 6, agudoMs: 200 },
  { id: 'sil+agudo9-200', tipo: 'silero', liga: 0.3, desliga: 0.2, seguraMs: 300, agudoDb: 9, agudoMs: 200 },
  { id: 'sil+agudo12-200', tipo: 'silero', liga: 0.3, desliga: 0.2, seguraMs: 300, agudoDb: 12, agudoMs: 200 },
  { id: 'sil+agudo6x2-150', tipo: 'silero', liga: 0.3, desliga: 0.2, seguraMs: 300, agudoDb: 6, agudoMs: 150, agudoSeguidos: 2 },
  { id: 'sil+agudo6x3-150', tipo: 'silero', liga: 0.3, desliga: 0.2, seguraMs: 300, agudoDb: 6, agudoMs: 150, agudoSeguidos: 3 },
  { id: 'sil+agudo6x3s-150', tipo: 'silero', liga: 0.3, desliga: 0.2, seguraMs: 300, agudoDb: 6, agudoMs: 150, agudoSeguidos: 3, agudoSuave: 1 },
  { id: 'sil+agudo6x4s-150', tipo: 'silero', liga: 0.3, desliga: 0.2, seguraMs: 300, agudoDb: 6, agudoMs: 150, agudoSeguidos: 4, agudoSuave: 1 },
  { id: 'sil+agudo6x5s-100', tipo: 'silero', liga: 0.3, desliga: 0.2, seguraMs: 300, agudoDb: 6, agudoMs: 100, agudoSeguidos: 5, agudoSuave: 1 },
  { id: 'sil+agudo4x3-150', tipo: 'silero', liga: 0.3, desliga: 0.2, seguraMs: 300, agudoDb: 4, agudoMs: 150, agudoSeguidos: 3 },
].filter((d) => !process.env.DET || process.env.DET.split(',').includes(d.id));

const resultados = [];
for (const c of CENARIOS) {
  const voz = fala.map((v) => v * ganhoDaFala * Math.pow(10, c.fala / 20));
  const ruido = c.ruido();
  const mix = voz.map((v, i) => v + ruido[i]);
  const ref = rodar(mix, 'nunca').saida;
  const atraso = atrasoDe(voz, ref);
  const pausas = (x) => { let s = 0, n = 0; for (let i = 0; i + atraso < total; i++) if (!temFala[i] && i > TAXA) { s += x[i + atraso] ** 2; n++; } return db(Math.sqrt(s / n)); };
  console.log(`\n${c.nome}   (pausas com o modelo sempre ligado: ${pausas(ref).toFixed(0)} dB)`);
  console.log('detector               | modelo rodando (só pelo agudo) | começo das frases: pior  média | fala: relação  perda | pausas | detector ms/quadro | começo, frase a frase');
  for (const d of DETECTORES) {
    const r = rodar(mix, 'voz', d);
    escreverWav(join(SAIDA, `${c.id}-${d.id.replaceAll('/', '_')}.wav`), r.saida);
    const nov = r.saida;
    const perdas = comecos.map((c0) => { const a = c0 + atraso, b = a + Math.round(0.15 * TAXA); return db(rms(nov, a, b)) - db(rms(ref, a, b)); });
    let sRef = 0, sDif = 0, sNov = 0;
    for (let i = 0; i + atraso < total; i++) if (temFala[i]) { const a = ref[i + atraso], b = nov[i + atraso]; sRef += a * a; sNov += b * b; sDif += (a - b) * (a - b); }
    const res = {
      cenario: c.id, detector: d.id, modeloRodando: r.rodados / r.vistos,
      comecoPiorDb: Math.min(...perdas), comecoMedioDb: perdas.reduce((a, b) => a + b, 0) / perdas.length, perdas,
      falaSnrDb: 10 * Math.log10(sRef / Math.max(sDif, 1e-12)), falaPerdidaDb: 10 * Math.log10(sNov / sRef),
      pausasDb: pausas(nov), vadMsPorQuadro: r.vadMsPorQuadro, peloAgudo: r.peloAgudo,
    };
    resultados.push(res);
    console.log(
      `${d.id.padEnd(22)} |      ${(res.modeloRodando * 100).toFixed(0).padStart(3)}% (${(res.peloAgudo * 100).toFixed(0).padStart(2)}%)          |` +
        `            ${res.comecoPiorDb.toFixed(1).padStart(5)} dB ${res.comecoMedioDb.toFixed(1).padStart(5)} dB |` +
        ` ${res.falaSnrDb.toFixed(1).padStart(6)} dB ${res.falaPerdidaDb.toFixed(2).padStart(5)} dB |` +
        ` ${res.pausasDb.toFixed(0).padStart(4)} dB | ${res.vadMsPorQuadro ? res.vadMsPorQuadro.toFixed(3) : '  —  '}              |` + perdas.map((v) => v.toFixed(0).padStart(5)).join(''),
    );
  }
}
writeFileSync(join(SAIDA, 'resultados.json'), JSON.stringify(resultados, null, 2));
console.log(`\nÁudios para ouvir: ${SAIDA}`);
