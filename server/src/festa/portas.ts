/**
 * QUEM ESTÁ EM QUAL TOCA? (05/11/2026; do levantamento em docs/mario-party-3.md, só a mecânica do "lembre quem entrou em qual
 * porta"): no barranco há três tocas. Quatro bichos da horta entram, saem de uma, correm e entram noutra, uma vez depois da
 * outra, cada vez mais rápido. No fim aparece um deles, e escolhe-se em qual toca ele está. Acertar mais rápido vale mais.
 * Parece o Jogo dos copos, mas é outra coisa: lá se segue um copo só; aqui, quatro bichos ao mesmo tempo.
 *
 * Como o "Quem dançou em terceiro?", O BICHO PERGUNTADO SÓ VAI NO FIM: sabendo antes, bastaria seguir um. Os passeios vão
 * prontos, iguais para todos.
 */
import { invalido, inteiro, microjogo, numero, type Resultado } from './comum.js';

export const TOCAS = 3;
/** Os bichos que podem passear (a tela desenha cada um; os mesmos do "Quem dançou em terceiro?"). */
export const TIPOS_DE_BICHO = 6;
export const BICHOS = 4;
export const PASSEIOS = 9;
/** Fora do barranco (entra pela esquerda, sai pela direita). */
export const FORA = -1;
export const MOSTRA_MS = 700;
export const RESPOSTA_MS = 6000;

export interface DadosPortas {
  /** Os bichos (o tipo de cada um). */
  bichos: number[];
  /** Cada passeio: qual bicho (índice em `bichos`), de onde sai e para onde vai (uma toca, ou FORA). */
  passeios: { b: number; de: number; para: number }[];
  /** Quanto dura cada passeio. */
  passos: number[];
  /** O bicho perguntado (índice em `bichos`), ou −1 enquanto os passeios não acabaram. */
  pergunta: number;
}

export const fimDosPasseios = (d: Pick<DadosPortas, 'passos'>) => MOSTRA_MS + d.passos.reduce((a, b) => a + b, 0) + 300;

/** Onde cada bicho termina (uma toca, ou FORA). */
export function ondeFica(d: Pick<DadosPortas, 'bichos' | 'passeios'>): number[] {
  const lugar = d.bichos.map(() => FORA);
  for (const p of d.passeios) lugar[p.b] = p.para;
  return lugar;
}

interface Mem {
  perguntou: boolean;
}

export default microjogo<DadosPortas, Mem>({
  id: 'portas',
  gerar(aleatorio) {
    const n = (k: number) => Math.floor(aleatorio() * k);
    const tipos = Array.from({ length: TIPOS_DE_BICHO }, (_, i) => i);
    for (let i = tipos.length - 1; i > 0; i--) {
      const j = n(i + 1);
      [tipos[i], tipos[j]] = [tipos[j], tipos[i]];
    }
    const bichos = tipos.slice(0, BICHOS);
    const lugar = bichos.map(() => FORA);
    const passeios: { b: number; de: number; para: number }[] = [];
    for (let k = 0; k < PASSEIOS; k++) {
      const fora = lugar.map((l, b) => (l === FORA ? b : -1)).filter((b) => b >= 0);
      const dentro = lugar.map((l, b) => (l !== FORA ? b : -1)).filter((b) => b >= 0);
      let b: number;
      let para: number;
      // os três primeiros entram; depois, quase sempre alguém muda de toca, às vezes alguém sai ou chega
      if (fora.length && (k < 3 || aleatorio() < 0.2)) {
        b = fora[n(fora.length)];
        para = n(TOCAS);
      } else {
        // nunca o mesmo bicho duas vezes seguidas (o passeio seguinte seria fácil demais de seguir)
        const ultimo = passeios[passeios.length - 1]?.b;
        const podem = dentro.length > 1 ? dentro.filter((x) => x !== ultimo) : dentro;
        b = podem[n(podem.length)];
        para = dentro.length >= 2 && aleatorio() < 0.15 ? FORA : (lugar[b] + 1 + n(TOCAS - 1)) % TOCAS;
      }
      passeios.push({ b, de: lugar[b], para });
      lugar[b] = para;
    }
    // perguntado: um dos que estão numa toca no fim
    const dentro = lugar.map((l, b) => (l !== FORA ? b : -1)).filter((b) => b >= 0);
    const pergunta = dentro[n(dentro.length)];
    const passos = passeios.map((_, k) => Math.round(950 - (k * 400) / (PASSEIOS - 1)));
    return { bichos, passeios, passos, pergunta };
  },
  duracao: (d) => fimDosPasseios(d) + RESPOSTA_MS + 1000,
  memoria: () => ({ perguntou: false }),
  iniciar({ dados, mem, agendar, avisar, revelar }) {
    agendar(fimDosPasseios(dados), () => {
      mem.perguntou = true;
      avisar();
      agendar(RESPOSTA_MS + 1000, revelar);
    });
  },
  vista({ dados, mem, fase }) {
    if (fase === 'revelando') return { dados, resposta: ondeFica(dados)[dados.pergunta] };
    return { dados: mem.perguntou ? dados : { ...dados, pergunta: -1 }, resposta: null };
  },
  avaliar({ dados, mem, corpo, cabe }) {
    const { toca, t } = corpo;
    if (!mem.perguntou || !inteiro(toca) || toca < 0 || toca >= TOCAS || !numero(t) || t < fimDosPasseios(dados) || !cabe(t)) return invalido();
    if (toca !== ondeFica(dados)[dados.pergunta]) return { motivo: 'errou', valor: null, chave: [] };
    const ms = Math.round(t - fimDosPasseios(dados));
    return { motivo: null, valor: ms, chave: [ms] };
  },
  robo(_d, aleatorio): Resultado {
    if (aleatorio() < 0.3) return { motivo: 'errou', valor: null, chave: [] };
    const ms = Math.round(700 + aleatorio() * 1500);
    return { motivo: null, valor: ms, chave: [ms] };
  },
});
