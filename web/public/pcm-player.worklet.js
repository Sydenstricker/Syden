// Recebe pedaços de som crus do app de desktop (Float32 intercalado, dois canais) e os entrega ao Web
// Audio sem buracos. Fica no meio do caminho entre o Windows e a chamada.
//
// A fila é curta de propósito: se o som chegar mais rápido do que a placa consome, o atraso cresceria sem
// parar, e quem assiste veria a imagem adiantada em relação ao som. Passando do teto, os pedaços mais
// antigos são descartados — melhor um tranco curto do que meio segundo de atraso acumulado.

const MAX_QUEUED_FRAMES = 48000 * 0.25; // um quarto de segundo

class PcmPlayer extends AudioWorkletProcessor {
  constructor() {
    super();
    /** @type {Float32Array[]} */
    this.queue = [];
    this.queued = 0; // quadros esperando na fila
    this.offset = 0; // por onde parou o primeiro pedaço da fila
    this.port.onmessage = (event) => {
      const chunk = event.data;
      if (!(chunk instanceof Float32Array)) return;
      this.queue.push(chunk);
      this.queued += chunk.length / 2;
      while (this.queued > MAX_QUEUED_FRAMES && this.queue.length > 1) {
        const dropped = this.queue.shift();
        this.queued -= dropped.length / 2 - this.offset;
        this.offset = 0;
      }
    };
  }

  process(_inputs, outputs) {
    const [left, right] = outputs[0];
    for (let i = 0; i < left.length; i++) {
      const chunk = this.queue[0];
      if (!chunk) {
        left[i] = 0; // sem som ainda: silêncio, nunca ruído
        right[i] = 0;
        continue;
      }
      left[i] = chunk[this.offset];
      right[i] = chunk[this.offset + 1];
      this.offset += 2;
      this.queued--;
      if (this.offset >= chunk.length) {
        this.queue.shift();
        this.offset = 0;
      }
    }
    return true;
  }
}

registerProcessor('syden-pcm', PcmPlayer);
