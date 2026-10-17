// Ponte entre a thread de áudio da página e a supressão de ruído NATIVA do app de desktop.
//
// Só existe dentro do app (ver desktop/src/ruido). A página entrega aqui uma MessagePort ligada direto
// ao processo da supressão: cada bloco do microfone (16 kHz) vai por ela, e o som limpo volta por ela.
// Nada passa pela thread principal da página, que pode estar ocupada desenhando.
//
// O som limpo chega em pedaços de 160 amostras (10 ms), num ritmo que não é o desta thread. Uma folga
// absorve a diferença; sem ela, cada atraso pequeno do outro lado viraria um estalo aqui.
//
// A FOLGA SE AJUSTA (auditoria do áudio, 17/10/2026): eram 20 ms fixos, e na máquina ocupada com o jogo a voz
// picotava — cada falta era um bloco de zeros seguido de silêncio até a folga se refazer. Agora ela começa em 30 ms,
// cresce 10 ms a cada falta (até 80 ms) e volta a encolher devagar depois de ~20 s sem faltar. Na falta, o último
// bloco se repete descendo até zero, em vez do degrau de zeros que estala. E o excesso (som chegando mais rápido que
// esta thread consome) sai aos poucos, tocando cada bloco ~1,5% mais rápido, em vez de 80 ms jogados fora de uma vez.
//
// O VIGIA: se o processo nativo cair, a porta fica muda — o Electron não avisa a página. Sem resposta
// por 1 s com o microfone mandando som, esta ponte declara falha: a página tira a ponte do caminho, a
// voz segue SEM supressão (não há modelo de reserva, por decisão) e Configurações diz que o DPDFNet
// parou. Ver web/src/microfone.ts. Até lá, o som passa direto: pior que limpo, melhor que mudo.

const QUANTUM = 128;
const FOLGA_MIN = 480; // 30 ms a 16 kHz
const FOLGA_MAX = 1280; // 80 ms
const PASSO = 160; // 10 ms a mais (ou a menos) de folga por vez
const SOBRA = 960; // acima da folga + 60 ms, acelera
const PULO = 4000; // acima de 250 ms acumulados (a thread esteve parada), pula de uma vez: atraso assim não serve
const ACELERADO = 1 + 2 / QUANTUM;
const TAM = 1 << 15;

class PonteDeRuido extends AudioWorkletProcessor {
  constructor() {
    super();
    this.porta = null;
    this.fila = new Float32Array(TAM);
    this.lidos = 0; // pode ser fracionário, por causa da aceleração
    this.escritos = 0;
    this.folga = FOLGA_MIN;
    this.semFalta = 0;
    this.ultimo = new Float32Array(QUANTUM); // o último bloco que saiu, repetido descendo na falta
    this.entrada = 0; // amostras de rampa de volta depois de uma falta
    this.tocando = false;
    this.jaTocou = false;
    this.falhou = false;
    this.ultimaResposta = 0;
    this.faltas = 0;
    this.port.onmessage = (e) => {
      // A página desmontou o microfone: fecha a porta, e o processo nativo solta este fluxo.
      if (e.data?.fechar) {
        this.porta?.close();
        this.porta = null;
        this.falhou = true;
        return;
      }
      const porta = e.data?.porta;
      if (!porta) return;
      this.porta = porta;
      this.ultimaResposta = currentTime;
      porta.onmessage = (m) => this.receber(m.data);
    };
  }

  receber(d) {
    if (d instanceof Float32Array) {
      for (let i = 0; i < d.length; i++) this.fila[(this.escritos + i) % TAM] = d[i];
      this.escritos += d.length;
      if (this.escritos - this.lidos > PULO) this.lidos = this.escritos - this.folga;
      this.ultimaResposta = currentTime;
    } else if (typeof d?.custoMsPorQuadro === 'number') {
      this.port.postMessage({ custoMsPorQuadro: d.custoMsPorQuadro, quadroMs: d.quadroMs, faltas: this.faltas });
      this.faltas = 0;
    } else if (d?.erro) {
      this.falhar(d.erro);
    } else if (d?.pronto) {
      this.ultimaResposta = currentTime;
    }
  }

  falhar(motivo) {
    if (this.falhou) return;
    this.falhou = true;
    this.port.postMessage({ falhou: String(motivo) });
  }

  process(inputs, outputs) {
    const ent = inputs[0]?.[0];
    const sai = outputs[0][0];
    if (!this.porta || this.falhou) {
      // Antes da porta chegar, ou depois de o processo nativo cair: o som passa como veio.
      if (ent) sai.set(ent); else sai.fill(0);
      return true;
    }
    if (ent) this.porta.postMessage(ent.slice(0));
    if (ent && currentTime - this.ultimaResposta > 1) this.falhar('o processo da supressão parou de responder');

    const prontos = this.escritos - this.lidos;
    if (!this.tocando) {
      if (prontos >= this.folga) {
        this.tocando = true;
        // volta com uma rampa curta, sem estalo (na primeira vez não: o som vinha passando direto)
        this.entrada = this.jaTocou ? QUANTUM : 0;
        this.jaTocou = true;
      } else {
        // Enchendo a folga. Só na PRIMEIRA vez o som passa direto, para a primeira palavra não sumir;
        // depois de uma falta no meio da conversa, passar direto traria o ventilador de volta por um
        // instante — então é silêncio até a folga se refazer.
        if (ent && !this.jaTocou) sai.set(ent); else sai.fill(0);
        return true;
      }
    }
    const passo = prontos > this.folga + SOBRA ? ACELERADO : 1;
    if (prontos >= QUANTUM * passo + 1) {
      for (let i = 0; i < QUANTUM; i++) {
        const pos = this.lidos + i * passo;
        const a = Math.floor(pos), f = pos - a;
        let y = this.fila[a % TAM];
        if (f) y += (this.fila[(a + 1) % TAM] - y) * f;
        if (this.entrada > 0) { y *= 1 - this.entrada / QUANTUM; this.entrada--; }
        sai[i] = y;
      }
      this.lidos += QUANTUM * passo;
      this.ultimo.set(sai);
      // ~20 s sem faltar: a folga encolhe 10 ms, até o mínimo (folga grande para sempre é atraso para sempre).
      if (++this.semFalta >= 2500 && this.folga > FOLGA_MIN) {
        this.semFalta = 0;
        this.folga -= PASSO;
      }
    } else {
      // Faltou som do outro lado: o último bloco se repete descendo até zero (sem o degrau que estala), e a folga
      // se refaz, um pouco maior. O pouco que havia fica na fila para a volta.
      for (let i = 0; i < QUANTUM; i++) sai[i] = this.ultimo[i] * (1 - (i + 1) / QUANTUM);
      this.ultimo.fill(0); // falta seguida de falta: silêncio, não o mesmo bloco de novo
      this.faltas++;
      this.tocando = false;
      this.semFalta = 0;
      this.folga = Math.min(FOLGA_MAX, this.folga + PASSO);
    }
    return true;
  }
}

registerProcessor('syden-ponte-ruido', PonteDeRuido);
