// @ts-check
/**
 * DPDFNet em tempo real: o mesmo caminho do StreamEnhancer oficial (pacote `dpdfnet`, da Ceva), em Node.
 *
 * Por quadro de 10 ms (160 amostras a 16 kHz): janela de Vorbis sobre as últimas 320 amostras, FFT, a rede
 * neural devolve o espectro limpo e o estado novo, FFT inversa, janela de novo, soma com sobreposição.
 * A janela de Vorbis cumpre w[n]² + w[n+160]² = 1, então cada quadro entrega 160 amostras prontas.
 *
 * Depois do modelo, o volume volta ao que era — ver `compensar` abaixo e web/public/ruido/gtcrn.worklet.js,
 * onde a mesma conta nasceu.
 *
 * Este arquivo não sabe de Electron: recebe uma sessão do onnxruntime e números, devolve números. É o que
 * deixa testá-lo em Node puro (desktop/test).
 */

/** @typedef {{ taxa: number, janela: number, passo: number, tamanhoDoEstado: number, erbNorm: number[], specNorm: number[] }} Config */

/**
 * QUIETO: o quadro inteiro com pico abaixo de −60 dBFS. A voz falada fica entre −40 e −10 (até o sussurro perto do microfone
 * passa de −50), e o ruído que o modelo existe para tirar (ventilador, teclado, rua) também fica acima; abaixo disto, o modelo
 * devolveria silêncio. O microfone mudo (zeros) é o caso extremo.
 */
const QUIETO = 1e-3;
/** Quantos quadros de 10 ms seguidos quietos antes de parar o modelo: 300 ms, para o fim da sílaba sair como o modelo faz. */
const SEGURA = 30;

/** Janela de Vorbis, igual à de `dpdfnet.audio.vorbis_window`. */
function janelaVorbis(n) {
  const w = new Float32Array(n);
  const meio = n / 2;
  for (let i = 0; i < n; i++) {
    const s = Math.sin((0.5 * Math.PI * (i + 0.5)) / meio);
    w[i] = Math.sin(0.5 * Math.PI * s * s);
  }
  return w;
}

/**
 * Transformada de Fourier real de tamanho N (320 = 4·4·4·5, então não serve a FFT de base 2): uma FFT de base mista,
 * recursiva, com as tabelas de giro do tamanho N.
 *
 * ERA UMA TABELA DE N×(N/2+1) senos e cossenos (até 06/11/2026), "barata" no papel: ~0,1 ms. Medido no Electron em tempo
 * real, não era: a tabela tem ~400 KB e passava inteira pela memória duas vezes a cada 10 ms, tirando da cache os pesos da
 * rede neural, que então rodava mais devagar. A FFT faz ~10 mil contas e só toca 2,5 KB de tabela.
 */
function criarDft(n) {
  const fatores = [];
  for (let m = n; m > 1; ) {
    const p = m % 4 === 0 ? 4 : m % 2 === 0 ? 2 : [3, 5, 7].find((f) => m % f === 0) ?? m;
    fatores.push(p);
    m /= p;
  }
  if (Math.max(...fatores) > 8) throw new Error(`tamanho de janela sem FFT: ${n}`);
  const cosN = new Float64Array(n), senN = new Float64Array(n);
  for (let e = 0; e < n; e++) { cosN[e] = Math.cos((2 * Math.PI * e) / n); senN[e] = -Math.sin((2 * Math.PI * e) / n); }
  const tmpRe = new Float64Array(8), tmpIm = new Float64Array(8);
  const zRe = new Float64Array(n), zIm = new Float64Array(n), xRe = new Float64Array(n), xIm = new Float64Array(n);

  /** A transformada direta (e^−i) de in[ini + j·passo], j < m, gravada em out[saida…saida+m). */
  function fft(inRe, inIm, ini, passo, m, nivel, outRe, outIm, saida) {
    if (m === 1) { outRe[saida] = inRe[ini]; outIm[saida] = inIm[ini]; return; }
    const p = fatores[nivel], q = m / p;
    for (let r = 0; r < p; r++) fft(inRe, inIm, ini + r * passo, passo * p, q, nivel + 1, outRe, outIm, saida + r * q);
    const giro = n / m;
    for (let k = 0; k < q; k++) {
      for (let r = 0; r < p; r++) { tmpRe[r] = outRe[saida + r * q + k]; tmpIm[r] = outIm[saida + r * q + k]; }
      for (let s = 0; s < p; s++) {
        const kk = k + s * q;
        let a = 0, b = 0;
        for (let r = 0; r < p; r++) {
          const e = ((r * kk) % m) * giro;
          const c = cosN[e], d = senN[e];
          a += tmpRe[r] * c - tmpIm[r] * d;
          b += tmpRe[r] * d + tmpIm[r] * c;
        }
        outRe[saida + kk] = a; outIm[saida + kk] = b;
      }
    }
  }

  const b = n / 2 + 1;
  return {
    /** x real (n) → re, im (b), como numpy.fft.rfft */
    direta(x, re, im) {
      for (let t = 0; t < n; t++) { zRe[t] = x[t]; zIm[t] = 0; }
      fft(zRe, zIm, 0, 1, n, 0, xRe, xIm, 0);
      for (let k = 0; k < b; k++) { re[k] = xRe[k]; im[k] = xIm[k]; }
    },
    /** re, im (b) → x real (n), como numpy.fft.irfft (a parte imaginária do 0 e do N/2 não conta) */
    inversa(re, im, x) {
      // inversa = conjugado da direta do conjugado, dividido por n
      for (let k = 0; k < b; k++) { zRe[k] = re[k]; zIm[k] = -im[k]; }
      zIm[0] = 0;
      if (n % 2 === 0) zIm[b - 1] = 0;
      for (let k = b; k < n; k++) { zRe[k] = zRe[n - k]; zIm[k] = -zIm[n - k]; }
      fft(zRe, zIm, 0, 1, n, 0, xRe, xIm, 0);
      for (let t = 0; t < n; t++) x[t] = xRe[t] / n;
    },
  };
}

/**
 * Um fluxo de voz (uma pessoa, um microfone). Guarda o estado da rede neural entre os quadros.
 *
 * @param {import('onnxruntime-common').InferenceSession} sessao
 * @param {typeof import('onnxruntime-common').Tensor} Tensor
 * @param {Config} cfg
 * @param {{ compensarVolume?: boolean }} [opcoes] desligar só para comparar com o pacote oficial
 */
function criarFluxo(sessao, Tensor, cfg, { compensarVolume = true } = {}) {
  const N = cfg.janela, H = cfg.passo, B = N / 2 + 1;
  const w = janelaVorbis(N);
  const dft = criarDft(N);
  let estado = new Float32Array(cfg.tamanhoDoEstado);
  estado.set(cfg.erbNorm, 0);
  estado.set(cfg.specNorm, cfg.erbNorm.length);

  let entrada = new Float32Array(0);
  const soma = new Float32Array(N);
  const quadro = new Float32Array(N), re = new Float32Array(B), im = new Float32Array(B), tempo = new Float32Array(N);
  let ganho = 1;
  let custoMs = 0, quadros = 0, pulados = 0, quietos = 0;

  /** Iguala a fala de saída à de entrada: ver o comentário no topo do arquivo. */
  function compensar(entradaHop, saidaHop) {
    let eEnt = 0, eSai = 0;
    for (let i = 0; i < H; i++) { eEnt += entradaHop[i] ** 2; eSai += saidaHop[i] ** 2; }
    if (eSai / H > 1e-5) {
      const alvo = Math.min(4, Math.max(1, Math.sqrt(eEnt / eSai)));
      ganho += (alvo - ganho) * 0.02;
    }
    for (let i = 0; i < H; i++) {
      let y = saidaHop[i] * ganho;
      if (y > 0.8) y = 0.8 + 0.2 * Math.tanh((y - 0.8) / 0.2);
      else if (y < -0.8) y = -0.8 + 0.2 * Math.tanh((y + 0.8) / 0.2);
      saidaHop[i] = y;
    }
  }

  return {
    /**
     * Entrega amostras a 16 kHz (qualquer quantidade) e recebe de volta as já limpas — múltiplo de 160,
     * possivelmente zero. A ordem importa: chamar uma de cada vez, esperando a anterior.
     * @param {Float32Array} pedaco
     */
    async processar(pedaco) {
      const juntos = new Float32Array(entrada.length + pedaco.length);
      juntos.set(entrada);
      juntos.set(pedaco, entrada.length);
      entrada = juntos;
      const prontos = [];
      while (entrada.length >= N) {
        // O QUIETO NÃO PASSA PELO MODELO (06/11/2026): o microfone mudo (o LiveKit desliga a faixa e chegam zeros) e o
        // quarto em silêncio entre uma frase e outra. Medido no Electron: o modelo é ~90% do custo do processo, ~20% de um
        // núcleo com som e ~2% mudo. Depois de 300 ms quietos, o modelo para; o primeiro quadro acima de −60 dBFS o
        // religa, com o estado da rede de antes (ele se refaz em poucos quadros). A saída parada é silêncio: o resto da
        // soma do último quadro do modelo, e depois zeros.
        let pico = 0;
        for (let i = 0; i < N; i++) { const a = entrada[i] < 0 ? -entrada[i] : entrada[i]; if (a > pico) pico = a; }
        quietos = pico < QUIETO ? quietos + 1 : 0;
        if (quietos > SEGURA) {
          pulados++;
          const pronto = soma.slice(0, H);
          if (compensarVolume) for (let i = 0; i < H; i++) pronto[i] *= ganho;
          prontos.push(pronto);
          soma.copyWithin(0, H);
          soma.fill(0, N - H);
          entrada = entrada.slice(H);
          continue;
        }
        for (let i = 0; i < N; i++) quadro[i] = entrada[i] * w[i];
        dft.direta(quadro, re, im);
        const spec = new Float32Array(B * 2);
        for (let k = 0; k < B; k++) { spec[2 * k] = re[k]; spec[2 * k + 1] = im[k]; }
        const t0 = performance.now();
        const r = await sessao.run({ spec: new Tensor('float32', spec, [1, 1, B, 2]), state_in: new Tensor('float32', estado, [estado.length]) });
        custoMs += performance.now() - t0;
        quadros++;
        estado = /** @type {Float32Array} */ (r.state_out.data);
        const e = /** @type {Float32Array} */ (r.spec_e.data);
        for (let k = 0; k < B; k++) { re[k] = e[2 * k]; im[k] = e[2 * k + 1]; }
        dft.inversa(re, im, tempo);
        for (let i = 0; i < N; i++) soma[i] += tempo[i] * w[i];
        const pronto = soma.slice(0, H);
        // As H amostras prontas são as mais antigas da janela: compara com elas na entrada.
        if (compensarVolume) compensar(entrada.subarray(0, H), pronto);
        prontos.push(pronto);
        soma.copyWithin(0, H);
        soma.fill(0, N - H);
        entrada = entrada.slice(H);
      }
      const saida = new Float32Array(prontos.length * H);
      prontos.forEach((p, i) => saida.set(p, i * H));
      return saida;
    },
    /** Quanto custou cada quadro de 10 ms, em média, desde a última pergunta. */
    custo() {
      const m = quadros ? custoMs / quadros : 0;
      custoMs = 0; quadros = 0;
      return m;
    },
    /** Quantos quadros quietos passaram sem o modelo, desde a última pergunta. */
    pulados() {
      const n = pulados;
      pulados = 0;
      return n;
    },
  };
}

module.exports = { criarFluxo, janelaVorbis, criarDft };
