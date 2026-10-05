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
 * Transformada de Fourier real de tamanho N qualquer (320 não é potência de 2), por tabela.
 * Custa N×(N/2+1) multiplicações por quadro: ~50 mil, menos de 0,1 ms. Não vale uma FFT de base mista.
 */
function criarDft(n) {
  const b = n / 2 + 1;
  const cos = new Float32Array(b * n), sen = new Float32Array(b * n);
  for (let k = 0; k < b; k++) {
    for (let t = 0; t < n; t++) {
      const a = (2 * Math.PI * k * t) / n;
      cos[k * n + t] = Math.cos(a);
      sen[k * n + t] = Math.sin(a);
    }
  }
  return {
    /** x real (n) → re, im (b) */
    direta(x, re, im) {
      for (let k = 0; k < b; k++) {
        let r = 0, i = 0;
        const base = k * n;
        for (let t = 0; t < n; t++) { r += x[t] * cos[base + t]; i -= x[t] * sen[base + t]; }
        re[k] = r; im[k] = i;
      }
    },
    /** re, im (b) → x real (n), como numpy.fft.irfft */
    inversa(re, im, x) {
      for (let t = 0; t < n; t++) {
        let s = re[0] + (n % 2 === 0 ? re[b - 1] * (t % 2 === 0 ? 1 : -1) : 0);
        for (let k = 1; k < (n % 2 === 0 ? b - 1 : b); k++) s += 2 * (re[k] * cos[k * n + t] - im[k] * sen[k * n + t]);
        x[t] = s / n;
      }
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
  let custoMs = 0, quadros = 0;

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
  };
}

module.exports = { criarFluxo, janelaVorbis };
