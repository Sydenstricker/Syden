// Recebe pedaços de som crus do app de desktop (Float32 intercalado, dois canais, 48 kHz) e os entrega ao Web
// Audio sem buracos. Fica no meio do caminho entre o Windows e a chamada.
//
// O CAMINHO (auditoria do áudio, 17/10/2026): os pedaços chegam por uma MessagePort ligada direto ao processo
// principal do app, como a supressão de ruído nativa faz (ver web/public/ruido/ponte.worklet.js). Antes cada pedaço
// de 10 ms ainda passava pela thread principal da página, que divide tempo com o quarto, o salão e a chamada inteira:
// qualquer engasgo dela virava buraco no som da transmissão. Apps anteriores, sem a porta, ainda mandam pela página
// (this.port), e os dois caminhos chegam ao mesmo lugar.
//
// A FOLGA: o som só começa a tocar com ~40 ms guardados, e depois de cada falta a folga se refaz (e cresce um pouco,
// até 120 ms, porque faltar de novo diz que esta máquina entrega mais irregular). Antes a fila começava vazia e cada
// atraso de 1 ms do outro lado virava zeros no meio do som, amostra a amostra: o chiado picotado.
//
// O EXCESSO SAI AOS POUCOS: se o som chega mais rápido do que a placa consome, o atraso cresceria sem parar, e quem
// assiste veria a imagem adiantada em relação ao som. Passando do alvo com sobra, cada bloco toca ~1,5% mais rápido
// (interpolando, sem pular amostra) até voltar. Antes, passando de 250 ms, jogava-se fora tudo de uma vez: um tranco.
// Só acima de meio segundo (a página esteve congelada) o pulo é de uma vez.

const TAXA = 48000;
const CAP = 1 << 16; // quadros no anel (~1,36 s)
const ALVO_MIN = Math.round(TAXA * 0.04);
const ALVO_MAX = Math.round(TAXA * 0.12);
const PASSO_DE_FALTA = Math.round(TAXA * 0.01);
const SOBRA = Math.round(TAXA * 0.06); // acima de alvo + isto, acelera
const PULO = Math.round(TAXA * 0.5); // acima disto, pula de uma vez
const ACELERADO = 1 + 2 / 128;

class PcmPlayer extends AudioWorkletProcessor {
  constructor() {
    super();
    this.esq = new Float32Array(CAP);
    this.dir = new Float32Array(CAP);
    this.escritos = 0; // quadros escritos (inteiro)
    this.lidos = 0; // quadros lidos (pode ser fracionário, por causa da aceleração)
    this.tocando = false;
    this.alvo = ALVO_MIN;
    this.semFalta = 0; // blocos seguidos sem falta: a folga volta a encolher devagar
    this.ultimoE = 0;
    this.ultimoD = 0;
    this.entrada = 0; // amostras de rampa de entrada que faltam (depois de uma falta)
    // O que a página mostra no diário de saúde: pedaços que chegaram, o pico, as faltas e o que foi acelerado.
    this.pedacos = 0;
    this.pico = 0;
    this.faltas = 0;
    this.aparados = 0;
    this.ultimoRelato = 0;
    this.port.onmessage = (e) => {
      const d = e.data;
      if (d instanceof Float32Array) this.receber(d); // app anterior: pela página
      else if (d?.porta) {
        this.porta = d.porta;
        this.porta.onmessage = (m) => {
          if (m.data instanceof Float32Array) this.receber(m.data);
        };
      } else if (d?.fechar) {
        this.porta?.close();
        this.porta = null;
      }
    };
  }

  receber(pcm) {
    this.pedacos++;
    const quadros = pcm.length >> 1;
    for (let i = 0; i < quadros; i++) {
      const j = (this.escritos + i) % CAP;
      const l = pcm[2 * i], r = pcm[2 * i + 1];
      this.esq[j] = l;
      this.dir[j] = r;
      if ((i & 15) === 0) { const v = Math.abs(l); if (v > this.pico) this.pico = v; }
    }
    this.escritos += quadros;
    // Mais do que o anel guarda, ou a página esteve congelada: pula para o alvo de uma vez.
    if (this.escritos - this.lidos > Math.min(PULO, CAP - 256)) this.lidos = this.escritos - this.alvo;
  }

  process(_inputs, outputs) {
    const [left, right] = outputs[0];
    const n = left.length;
    const prontos = this.escritos - this.lidos;

    if (currentTime - this.ultimoRelato >= 1) {
      this.ultimoRelato = currentTime;
      this.port.postMessage({ pedacos: this.pedacos, pico: this.pico, faltas: this.faltas, aparadosMs: Math.round((this.aparados / TAXA) * 1000) });
    }

    if (!this.tocando) {
      if (prontos < this.alvo) {
        left.fill(0);
        right.fill(0);
        return true;
      }
      this.tocando = true;
      this.entrada = n; // volta com uma rampa curta, sem estalo
    }

    const passo = prontos > this.alvo + SOBRA ? ACELERADO : 1;
    if (prontos < n * passo + 1) {
      // FALTOU: o que havia toca, e o resto desce do último valor até zero (sem o degrau que estala). A folga se
      // refaz, um pouco maior.
      const tem = Math.max(0, Math.floor(prontos));
      for (let i = 0; i < n; i++) {
        if (i < tem) {
          const j = Math.floor(this.lidos + i) % CAP;
          this.ultimoE = left[i] = this.esq[j];
          this.ultimoD = right[i] = this.dir[j];
        } else {
          const k = 1 - (i - tem + 1) / (n - tem);
          left[i] = this.ultimoE * k;
          right[i] = this.ultimoD * k;
        }
      }
      this.lidos += tem;
      this.tocando = false;
      this.faltas++;
      this.semFalta = 0;
      this.alvo = Math.min(ALVO_MAX, this.alvo + PASSO_DE_FALTA);
      return true;
    }

    for (let i = 0; i < n; i++) {
      const pos = this.lidos + i * passo;
      const a = Math.floor(pos), f = pos - a;
      const j = a % CAP, k = (a + 1) % CAP;
      let l = this.esq[j], r = this.dir[j];
      if (f) { l += (this.esq[k] - l) * f; r += (this.dir[k] - r) * f; }
      if (this.entrada > 0) { const g = 1 - this.entrada / n; l *= g; r *= g; this.entrada--; }
      left[i] = l;
      right[i] = r;
    }
    this.ultimoE = left[n - 1];
    this.ultimoD = right[n - 1];
    this.lidos += n * passo;
    if (passo !== 1) this.aparados += n * (passo - 1);
    // ~20 s sem faltar: a folga encolhe 10 ms, até o mínimo. Folga grande para sempre seria atraso para sempre.
    if (++this.semFalta >= 7500 && this.alvo > ALVO_MIN) {
      this.semFalta = 0;
      this.alvo = Math.max(ALVO_MIN, this.alvo - PASSO_DE_FALTA);
    }
    return true;
  }
}

registerProcessor('syden-pcm', PcmPlayer);
