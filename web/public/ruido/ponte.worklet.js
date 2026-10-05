// Ponte entre a thread de áudio da página e a supressão de ruído NATIVA do app de desktop.
//
// Só existe dentro do app (ver desktop/src/ruido). A página entrega aqui uma MessagePort ligada direto
// ao processo da supressão: cada bloco do microfone (16 kHz) vai por ela, e o som limpo volta por ela.
// Nada passa pela thread principal da página, que pode estar ocupada desenhando.
//
// O som limpo chega em pedaços de 160 amostras (10 ms), num ritmo que não é o desta thread. Uma folga
// de 20 ms absorve a diferença; sem ela, cada atraso pequeno do outro lado viraria um estalo aqui.
//
// O VIGIA: se o processo nativo cair, a porta fica muda — o Electron não avisa a página. Sem resposta
// por 1 s com o microfone mandando som, esta ponte declara falha, e a página troca para o GTCRN em
// JavaScript (ver web/src/microfone.ts). Até a troca, o som passa direto, sem supressão nenhuma: pior
// que limpo, melhor que mudo.

const QUANTUM = 128;
const FOLGA = 320; // 20 ms a 16 kHz
const TETO = 1600; // acima de 100 ms acumulados, descarta o mais antigo: atraso que só cresce não serve
const TAM = 1 << 15;

class PonteDeRuido extends AudioWorkletProcessor {
  constructor() {
    super();
    this.porta = null;
    this.fila = new Float32Array(TAM);
    this.lidos = 0;
    this.escritos = 0;
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
      if (this.escritos - this.lidos > TETO) this.lidos = this.escritos - FOLGA;
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
      if (prontos >= FOLGA) this.tocando = this.jaTocou = true;
      else {
        // Enchendo a folga. Só na PRIMEIRA vez o som passa direto, para a primeira palavra não sumir;
        // depois de uma falta no meio da conversa, passar direto traria o ventilador de volta por um
        // instante — então é silêncio até a folga se refazer (20 ms).
        if (ent && !this.jaTocou) sai.set(ent); else sai.fill(0);
        return true;
      }
    }
    if (prontos >= QUANTUM) {
      for (let i = 0; i < QUANTUM; i++) sai[i] = this.fila[(this.lidos + i) % TAM];
      this.lidos += QUANTUM;
    } else {
      // Faltou som do outro lado: um bloco de silêncio, e a folga se refaz.
      sai.fill(0);
      this.faltas++;
      this.tocando = false;
    }
    return true;
  }
}

registerProcessor('syden-ponte-ruido', PonteDeRuido);
