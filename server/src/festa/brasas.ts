/**
 * BRASAS DA FOGUEIRA (05/11/2026; do levantamento em docs/mario-party-3.md, só a mecânica de desviar de chamas em padrões):
 * no meio da clareira, a fogueira solta brasas em anéis (com uma brecha), em fileiras que varrem o chão (com um vão) e em chuvas
 * marcadas no chão antes de cair. O coelho tem três corações; quem perde os três, sai. Os padrões são os mesmos para todos, na
 * mesma hora; cada um desvia na própria tela.
 *
 * O GOLPE É DE QUEM LEVA: só a tela de cada um sabe onde o coelho estava (o servidor não refaz o caminho), então ela diz quando
 * foi atingida (ação 'acerto', na hora), e o servidor confere o instante e a piscada depois de cada golpe. Um console que nunca
 * diga "levei" fica com os três corações; é o limite, o mesmo do kart.
 */
import { microjogo, numero, type Resultado } from './comum.js';

export const BRASAS_MS = 25000;
export const CORACOES = 3;
export const BRASAS_INVULNERAVEL_MS = 1500;
/** O aviso de cada padrão antes de ele queimar. */
export const AVISO_MS = 900;

/** 0 = anel que sai da fogueira, 1 = fileira que varre de lado, 2 = fileira que varre de cima, 3 = brasas marcadas no chão. */
export interface Padrao {
  t: number;
  tipo: number;
  /** O anel: onde está a brecha (0 a 1 da volta). A fileira: onde está o meio do vão. */
  a: number;
  /** A fileira: o sentido (1 ou −1). */
  b: number;
  /** As brasas marcadas: os pontos. */
  pontos?: [number, number][];
}
export interface DadosBrasas {
  padroes: Padrao[];
}

type Mem = Map<number, number[]>;

/** O VALOR da revelação: com corações, COM_CORACOES + quantos; sem nenhum, o tempo aguentado (ms). A tela mostra um ou outro. */
export const COM_CORACOES = 100000;

const pelosGolpes = (golpes: number[], ate: number): Resultado => {
  const coracoes = Math.max(0, CORACOES - golpes.length);
  if (coracoes > 0 && ate >= BRASAS_MS) return { motivo: null, valor: COM_CORACOES + coracoes, chave: [-coracoes, -BRASAS_MS] };
  // saiu: no terceiro golpe, ou quando mandou o fim antes da hora
  const vivo = Math.round(coracoes > 0 ? ate : golpes[CORACOES - 1]);
  return { motivo: null, valor: vivo, chave: [0, -vivo] };
};

export default microjogo<DadosBrasas, Mem>({
  id: 'brasas',
  gerar(aleatorio) {
    const padroes: Padrao[] = [];
    let t = 600;
    let anterior = -1;
    while (t < BRASAS_MS - 2500) {
      let tipo = Math.floor(aleatorio() * 4);
      if (tipo === anterior) tipo = (tipo + 1) % 4;
      anterior = tipo;
      const p: Padrao = { t, tipo, a: Math.round(aleatorio() * 1000) / 1000, b: aleatorio() < 0.5 ? 1 : -1 };
      if (tipo === 1) p.a = Math.round(50 + aleatorio() * 100);
      if (tipo === 2) p.a = Math.round(60 + aleatorio() * 180);
      if (tipo === 3) {
        const n = 6 + Math.floor((t / BRASAS_MS) * 6);
        p.pontos = Array.from({ length: n }, () => [Math.round(30 + aleatorio() * 240), Math.round(30 + aleatorio() * 140)] as [number, number]);
      }
      padroes.push(p);
      // cada vez mais juntos
      t += Math.round(2300 - (t / BRASAS_MS) * 1000 + aleatorio() * 400);
    }
    return { padroes };
  },
  duracao: () => BRASAS_MS + 1500,
  memoria: () => new Map(),
  acerto({ mem, quem, corpo, cabe }) {
    const t = corpo.t;
    if (corpo.golpe !== true || !numero(t) || t < 0 || t > BRASAS_MS || !cabe(t)) return;
    const golpes = mem.get(quem) ?? [];
    mem.set(quem, golpes);
    const ultimo = golpes[golpes.length - 1];
    if (golpes.length < CORACOES && (ultimo === undefined || t >= ultimo + BRASAS_INVULNERAVEL_MS - 100)) golpes.push(t);
  },
  avaliar: ({ mem, quem, passou }) => pelosGolpes(mem.get(quem) ?? [], Math.min(BRASAS_MS, passou)),
  *noFim({ mem }) {
    for (const [quem, golpes] of mem) yield [quem, pelosGolpes(golpes, BRASAS_MS)] as [number, Resultado];
  },
  robo(_dados, aleatorio, passouMs) {
    const ate = Math.min(passouMs, BRASAS_MS);
    const golpes: number[] = [];
    for (let k = 0; k < CORACOES; k++) if (aleatorio() < 0.45) golpes.push(Math.round(ate * (0.2 + aleatorio() * 0.8)));
    golpes.sort((a, b) => a - b);
    return pelosGolpes(golpes, ate >= BRASAS_MS - 100 ? BRASAS_MS : ate);
  },
});
