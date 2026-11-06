/**
 * DE GALHO EM GALHO (05/11/2026; do levantamento em docs/mario-party-3.md, só a mecânica de soltar o cipó na hora certa para
 * pegar o próximo): o coelho balança pendurado e solta (apertar) quando o cipó está lá na frente; cedo ou tarde demais, cai na
 * água e sobe de novo no mesmo, perdendo tempo. Cada cipó balança mais depressa e pede o ponto mais exato. Quem atravessar mais
 * cipós ganha; empate, quem chegou antes. Os cipós são os mesmos para todos, cada um na própria tela.
 *
 * O SERVIDOR CONFERE CADA SOLTURA: ela vai na hora (ação 'acerto', com o instante na tela), cabe no relógio do servidor, e o
 * balanço naquele instante é a mesma conta da tela (`soltar`, em ./lote2sim.ts, só + − ×).
 */
import { microjogo, numero, type Resultado } from './comum.js';
import { CIPO_MS, CIPOS, cipozalInicial, soltar, type Cipozal, type DadosCipo } from './lote2sim.js';

interface Galhos extends Cipozal {
  /** O instante da última soltura que contou (nunca volta atrás). */
  ultimo: number;
  /** Quando pegou o último cipó alcançado (para desempatar). */
  pegouEm: number;
}
type Mem = Map<number, Galhos>;

const pelosCipos = (s: Galhos | undefined): Resultado =>
  !s || s.k === 0 ? { motivo: 'errou', valor: 0, chave: [] } : { motivo: null, valor: s.k, chave: [-s.k, s.pegouEm] };

export default microjogo<DadosCipo, Mem>({
  id: 'cipo',
  gerar(aleatorio) {
    const periodos: number[] = [];
    const limiares: number[] = [];
    for (let k = 0; k < CIPOS; k++) {
      // de 1,6 s a ~1 s por balanço, com um pouco de surpresa; o ponto certo vai de 40% a 15% do balanço
      periodos.push(Math.round(Math.max(950, 1600 - 48 * k) + aleatorio() * 160 - 80));
      limiares.push(Math.round(Math.min(0.9, 0.55 + 0.03 * k + aleatorio() * 0.04) * 1000) / 1000);
    }
    return { periodos, limiares };
  },
  duracao: () => CIPO_MS + 1500,
  memoria: () => new Map(),
  acerto({ dados, mem, quem, corpo, cabe }) {
    const t = corpo.t;
    if (!numero(t) || t < 0 || t > CIPO_MS || !cabe(t)) return;
    const s = mem.get(quem) ?? { ...cipozalInicial(), ultimo: -1, pegouEm: 0 };
    mem.set(quem, s);
    if (t <= s.ultimo) return;
    const r = soltar(s, dados, t);
    if (r === null) return;
    s.ultimo = t;
    if (r === 'pegou') s.pegouEm = s.g;
  },
  avaliar: ({ mem, quem }) => pelosCipos(mem.get(quem)),
  *noFim({ mem }) {
    for (const [quem, s] of mem) if (s.k) yield [quem, pelosCipos(s)] as [number, Resultado];
  },
  robo(dados, aleatorio, passouMs) {
    // o robô solta perto do ponto mais alto, e às vezes erra: a mesma conta, no tempo que coube
    const s: Galhos = { ...cipozalInicial(), ultimo: -1, pegouEm: 0 };
    const ate = Math.min(passouMs, CIPO_MS);
    while (s.k < CIPOS) {
      const p = dados.periodos[s.k];
      const erro = aleatorio() < 0.25 ? 0.2 : aleatorio() * 0.06;
      const t = Math.round(s.g + p * (0.25 + erro) + (aleatorio() < 0.3 ? p : 0));
      if (t > ate) break;
      if (soltar(s, dados, t) === 'pegou') s.pegouEm = s.g;
    }
    return pelosCipos(s);
  },
});
