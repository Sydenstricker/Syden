// Supressão de ruído com o GTCRN, dentro da thread de áudio do navegador (AudioWorklet).
//
// Roda num AudioContext de 16 kHz, que é a taxa do modelo: o próprio navegador converte o microfone
// para 16 kHz na entrada e a faixa de volta na saída. A cada 256 amostras (16 ms) entra um quadro:
// janela de 512, FFT, a rede neural dá o espectro limpo, FFT inversa, soma com sobreposição.
//
// O atraso que isto põe na voz é o da janela: 512 amostras, 32 ms, mais um quadro de folga.
//
// E O VOLUME VOLTA AO QUE ERA. Medido numa chamada de verdade (04/10/2026): o GTCRN entrega a voz uns
// 10 dB abaixo do que recebeu — nos momentos mais altos da fala, onde o ruído não pesa. Sem
// compensar, quem liga a supressão passa a soar baixo para todo mundo, e o controle automático de
// volume do navegador não ajuda, porque ele roda ANTES, no microfone. Então aqui, depois do modelo, um
// ganho lento iguala a fala de saída à de entrada: só aprende nos quadros com voz (nas pausas a saída é
// quase silêncio, e a conta mandaria o ruído de volta), sobe no máximo 12 dB e tem um limitador suave
// para nenhum pico estourar.
//
// Os pesos chegam pelo processorOptions: a thread de áudio não tem fetch, então a página baixa o
// modelo e entrega aqui. Ver web/src/microfone.ts.
import { criarMotor } from './motor.js';

const N = 512, H = 256, B = N / 2 + 1;
const QUANTUM = 128;

// FFT complexa radix-2 com tabelas prontas — nada de objeto novo por quadro.
const bits = new Uint16Array(N);
for (let i = 0, j = 0; i < N; i++) {
  bits[i] = j;
  let bit = N >> 1;
  while (j & bit) { j ^= bit; bit >>= 1; }
  j |= bit;
}
const cosT = new Float32Array(N / 2), senT = new Float32Array(N / 2);
for (let i = 0; i < N / 2; i++) { cosT[i] = Math.cos((2 * Math.PI * i) / N); senT[i] = Math.sin((2 * Math.PI * i) / N); }
function fft(re, im, inversa) {
  for (let i = 0; i < N; i++) {
    const j = bits[i];
    if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
  }
  const sinal = inversa ? 1 : -1;
  for (let len = 2; len <= N; len <<= 1) {
    const meio = len >> 1, salto = N / len;
    for (let i = 0; i < N; i += len) {
      for (let k = 0; k < meio; k++) {
        const wr = cosT[k * salto], wi = sinal * senT[k * salto];
        const a = i + k, b = a + meio;
        const tr = re[b] * wr - im[b] * wi, ti = re[b] * wi + im[b] * wr;
        re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
      }
    }
  }
  if (inversa) for (let i = 0; i < N; i++) { re[i] /= N; im[i] /= N; }
}

const janela = new Float32Array(N);
for (let i = 0; i < N; i++) janela[i] = Math.sqrt(0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N));

class SupressorGtcrn extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const { grafo, pesos } = options.processorOptions;
    this.motor = criarMotor(grafo, pesos);
    this.caches = {
      conv_cache: new Float32Array(2 * 1 * 16 * 16 * 33),
      tra_cache: new Float32Array(2 * 3 * 1 * 1 * 16),
      inter_cache: new Float32Array(2 * 1 * 33 * 16),
    };
    this.entrada = new Float32Array(N); // as últimas 512 amostras
    this.novas = 0; // quantas chegaram desde o último quadro
    this.soma = new Float32Array(N); // soma com sobreposição, ainda por terminar
    // Saída já pronta, esperando a vez. Começa com um quadro de silêncio: como o quadro só sai a cada
    // dois blocos de 128, sem essa folga o bloco do meio ficaria sem nada para tocar.
    this.fila = new Float32Array(N * 2);
    this.lidos = 0;
    this.escritos = H;
    this.re = new Float32Array(N); this.im = new Float32Array(N);
    this.mix = new Float32Array(B * 2);
    // O mesmo objeto de entradas a cada quadro: montar um novo por quadro seria lixo para o coletor.
    this.entradas = { mix: this.mix, ...this.caches };
    this.ligado = true;
    this.ganho = 1;
    // Quanto custa, medido aqui dentro, para o Syden poder mostrar e o diário poder registrar.
    this.custoMs = 0; this.quadros = 0;
    this.port.onmessage = (e) => { if (typeof e.data?.ligado === 'boolean') this.ligado = e.data.ligado; };
  }

  quadro() {
    const { re, im, mix } = this;
    for (let i = 0; i < N; i++) { re[i] = this.entrada[i] * janela[i]; im[i] = 0; }
    fft(re, im, false);
    for (let k = 0; k < B; k++) { mix[2 * k] = re[k]; mix[2 * k + 1] = im[k]; }

    const t0 = Date.now();
    const s = this.motor.rodar(this.entradas);
    this.caches.conv_cache.set(s.conv_cache_out);
    this.caches.tra_cache.set(s.tra_cache_out);
    this.caches.inter_cache.set(s.inter_cache_out);
    this.custoMs += Date.now() - t0;
    this.quadros++;

    const e = s.enh;
    for (let k = 0; k < B; k++) { re[k] = e[2 * k]; im[k] = e[2 * k + 1]; }
    for (let k = 1; k < N / 2; k++) { re[N - k] = re[k]; im[N - k] = -im[k]; }
    fft(re, im, true);
    for (let i = 0; i < N; i++) this.soma[i] += re[i] * janela[i];

    // Compensação de volume: compara a energia do trecho que sai com a do mesmo trecho na entrada.
    let eEnt = 0, eSai = 0;
    for (let i = 0; i < H; i++) { const a = this.entrada[i]; eEnt += a * a; const b = this.soma[i]; eSai += b * b; }
    if (eSai / H > 1e-5) { // só onde há voz de verdade saindo (acima de -50 dBFS)
      const alvo = Math.min(4, Math.max(1, Math.sqrt(eEnt / eSai)));
      this.ganho += (alvo - this.ganho) * 0.02; // ~0,8 s para chegar: não bombeia sílaba a sílaba
    }

    // As primeiras H amostras da soma estão completas: vão para a fila de saída.
    const g = this.ganho;
    for (let i = 0; i < H; i++) {
      let y = this.soma[i] * g;
      if (y > 0.8) y = 0.8 + 0.2 * Math.tanh((y - 0.8) / 0.2); // limitador suave: o pico encosta, não estoura
      else if (y < -0.8) y = -0.8 + 0.2 * Math.tanh((y + 0.8) / 0.2);
      this.fila[(this.escritos + i) % this.fila.length] = y;
    }
    this.escritos += H;
    this.soma.copyWithin(0, H);
    this.soma.fill(0, N - H);

    if (this.quadros === 300) { // a cada ~5 s
      this.port.postMessage({ custoMsPorQuadro: this.custoMs / this.quadros });
      this.custoMs = 0; this.quadros = 0;
    }
  }

  process(inputs, outputs) {
    const ent = inputs[0]?.[0];
    const sai = outputs[0][0];
    if (!ent) { sai.fill(0); return true; }
    if (!this.ligado) { sai.set(ent); return true; }

    // Empurra o bloco novo para o fim da janela.
    this.entrada.copyWithin(0, QUANTUM);
    this.entrada.set(ent, N - QUANTUM);
    this.novas += QUANTUM;
    if (this.novas >= H) { this.novas -= H; this.quadro(); }

    for (let i = 0; i < QUANTUM; i++) {
      sai[i] = this.lidos < this.escritos ? this.fila[this.lidos % this.fila.length] : 0;
      if (this.lidos < this.escritos) this.lidos++;
    }
    return true;
  }
}

registerProcessor('syden-gtcrn', SupressorGtcrn);
