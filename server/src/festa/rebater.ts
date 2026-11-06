/**
 * REBATER O RABANETE (05/11/2026; Hey, Batter, Batter! no levantamento em docs/mario-party-3.md, só a mecânica; o Swing 'n'
 * Swipe, a martelada em quem passa, ficou JUNTO com este: os dois são "acertar a coisa no instante em que ela chega"): a raposa
 * arremessa rabanetes, e o coelho rebate com um taco de pau. Cinco arremessos, de três jeitos (reto, lento, quicando); quanto
 * mais na hora, mais longe o rabanete vai. Vale a soma.
 *
 * O SERVIDOR SORTEIA OS ARREMESSOS (quando saem e quanto voam) e eles vão prontos ao site. Cada tacada vai na hora (a ação
 * 'acerto', com o instante dela) e só vale se couber no relógio do servidor; vale a primeira de cada arremesso, dentro da
 * janela dele. A conta (`tacadaNoRabanete`) é só + − e comparação, e a tela roda a mesma.
 */
import { microjogo, numero, type Resultado } from './comum.js';

export const REBATER_ARREMESSOS = 5;
/** A janela de cada arremesso, em volta da chegada: antes, depois. */
export const REBATER_ANTES = 350;
export const REBATER_DEPOIS = 250;
/** Os degraus do erro (ms para cada lado) e quantos metros cada um vale. */
export const REBATER_DEGRAUS: [number, number][] = [
  [35, 100],
  [75, 70],
  [120, 45],
  [180, 20],
];
export type TipoDeArremesso = 0 | 1 | 2;

export interface DadosRebater {
  /** Cada arremesso: quando sai da mão da raposa, quanto voa (ms) e o jeito (0 reto, 1 lento, 2 quicando). */
  arremessos: { sai: number; voo: number; tipo: TipoDeArremesso }[];
}

export const chegadaDoRabanete = (a: { sai: number; voo: number }) => a.sai + a.voo;
export const fimDoRebater = (d: DadosRebater) => chegadaDoRabanete(d.arremessos[d.arremessos.length - 1]) + REBATER_DEPOIS;

/** A tacada no instante t: qual arremesso ela pega (ou −1) e quantos metros, pelo erro. */
export function tacadaNoRabanete(d: DadosRebater, t: number): { k: number; erro: number; metros: number } {
  for (let k = 0; k < d.arremessos.length; k++) {
    const erro = t - chegadaDoRabanete(d.arremessos[k]);
    if (erro < -REBATER_ANTES || erro > REBATER_DEPOIS) continue;
    let metros = 0;
    for (const [ate, m] of REBATER_DEGRAUS) {
      if (Math.abs(erro) <= ate) {
        metros = m;
        break;
      }
    }
    return { k, erro, metros };
  }
  return { k: -1, erro: 0, metros: 0 };
}

const pelaSoma = (metros: number): Resultado => (metros === 0 ? { motivo: 'errou', valor: 0, chave: [] } : { motivo: null, valor: metros, chave: [-metros] });
const soma = (m: Map<number, number> | undefined) => [...(m?.values() ?? [])].reduce((a, b) => a + b, 0);

/** De cada pessoa: os metros de cada arremesso já rebatido (ou perdido). */
type Mem = Map<number, Map<number, number>>;

export default microjogo<DadosRebater, Mem>({
  id: 'rebater',
  gerar(aleatorio) {
    const arremessos: DadosRebater['arremessos'] = [];
    let sai = 1200;
    for (let k = 0; k < REBATER_ARREMESSOS; k++) {
      // o primeiro é sempre reto (para aprender); depois, sorteados
      const tipo = (k === 0 ? 0 : Math.floor(aleatorio() * 3)) as TipoDeArremesso;
      const voo = tipo === 0 ? 650 + Math.floor(aleatorio() * 150) : tipo === 1 ? 1050 + Math.floor(aleatorio() * 200) : 820 + Math.floor(aleatorio() * 140);
      arremessos.push({ sai, voo, tipo });
      sai += voo + 1500 + Math.floor(aleatorio() * 700);
    }
    return { arremessos };
  },
  duracao: (d) => fimDoRebater(d) + 1500,
  memoria: () => new Map(),
  acerto({ dados, mem, quem, corpo, cabe }) {
    const t = corpo.t;
    // a tacada é a de agora (com a folga da rede): calcular as perfeitas e mandar depois não vale
    if (!numero(t) || t < 0 || t > fimDoRebater(dados) || !cabe(t)) return;
    const { k, metros } = tacadaNoRabanete(dados, Math.round(t));
    if (k < 0) return;
    const meus = mem.get(quem) ?? new Map<number, number>();
    if (meus.has(k)) return;
    meus.set(k, metros);
    mem.set(quem, meus);
  },
  avaliar: ({ mem, quem }) => pelaSoma(soma(mem.get(quem))),
  *noFim({ mem }) {
    for (const [quem, m] of mem) yield [quem, pelaSoma(soma(m))] as [number, Resultado];
  },
  robo(dados, aleatorio, passouMs) {
    // quem joga bem pega quase todos, com uns dois bem na hora; só os arremessos que já chegaram
    let metros = 0;
    for (const a of dados.arremessos) {
      if (chegadaDoRabanete(a) > passouMs) break;
      const sorte = aleatorio();
      metros += sorte < 0.25 ? 100 : sorte < 0.6 ? 70 : sorte < 0.85 ? 45 : sorte < 0.95 ? 20 : 0;
    }
    return pelaSoma(metros);
  },
});
