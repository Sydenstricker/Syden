/**
 * RETRATO DO COELHO (05/11/2026; do levantamento em docs/mario-party-3.md, só a mecânica do "monte o rosto"): o retrato do
 * coelho está cortado em três faixas (as orelhas, os olhos e o focinho), e cada faixa corre de um lado para o outro dentro da
 * moldura, cada uma no seu ritmo. Aperta-se uma vez por faixa, de cima para baixo, para parar cada uma no lugar. Vale o quanto
 * o retrato ficou montado (a soma do quanto cada faixa ficou fora do lugar), e no empate, quem terminou antes.
 *
 * O SERVIDOR REFAZ A CONTA DE CADA PARADA: cada aperto vai na hora (ação 'acerto', com o instante na tela), e o servidor calcula
 * onde a faixa estava naquele instante, pela mesma conta da tela (só + − × ÷ e %). Mandar no fim os instantes perfeitos não
 * vale: cada instante precisa caber no relógio do servidor.
 */
import { microjogo, numero, REACAO_MINIMA, type Resultado } from './comum.js';

export const FAIXAS = 3;
/** O quanto uma faixa anda para cada lado (em unidades do desenho, de 300 de largura). */
export const AMPLITUDE = 60;
export const RETRATO_MS = 10000;
/** Entre um aperto e outro (o mesmo dedo não para duas faixas no mesmo instante). */
export const ENTRE_PARADAS_MS = 200;

export interface DadosRetrato {
  /** Cada faixa: o tempo de uma ida e volta e onde ela começa no ciclo (ms). */
  faixas: { periodo: number; fase: number }[];
}

/** Onde a faixa está no instante `t` (ms desde o começo): de −AMPLITUDE a +AMPLITUDE, 0 é o lugar certo. Igual na tela. */
export function deslocamento(f: { periodo: number; fase: number }, t: number): number {
  const u = ((t + f.fase) % f.periodo) / f.periodo;
  const x = u < 0.5 ? 4 * u - 1 : 3 - 4 * u;
  return Math.round(AMPLITUDE * x);
}

/** O erro total de quem parou nestes instantes (a faixa que não parou conta como a pior). */
export function erroDoRetrato(d: DadosRetrato, paradas: number[]): number {
  let erro = 0;
  for (let k = 0; k < FAIXAS; k++) erro += paradas[k] === undefined ? AMPLITUDE : Math.abs(deslocamento(d.faixas[k], paradas[k]));
  return erro;
}

/** A precisão em porcentagem (100 é o retrato perfeito): o que a revelação mostra. */
export const precisao = (erro: number) => Math.round(100 - (erro * 100) / (FAIXAS * AMPLITUDE));

/**
 * As paradas que valem, dos instantes recebidos (em qualquer ordem: dois apertos seguidos podem chegar trocados pela rede): da
 * primeira em diante, cada uma pelo menos ENTRE_PARADAS_MS depois da anterior, até três. A mesma regra que a tela segue.
 */
export function paradasQueValem(recebidas: number[]): number[] {
  const valem: number[] = [];
  for (const t of [...recebidas].sort((a, b) => a - b)) {
    if (valem.length === FAIXAS) break;
    if (!valem.length || t >= valem[valem.length - 1] + ENTRE_PARADAS_MS) valem.push(t);
  }
  return valem;
}

const pelasParadas = (d: DadosRetrato, recebidas: number[] | undefined): Resultado => {
  const paradas = paradasQueValem(recebidas ?? []);
  if (!paradas.length) return { motivo: 'errou', valor: 0, chave: [] };
  const erro = erroDoRetrato(d, paradas);
  // quem não parou as três fica atrás de quem parou, com o tempo do fim
  return { motivo: null, valor: precisao(erro), chave: [erro, paradas.length === FAIXAS ? paradas[FAIXAS - 1] : RETRATO_MS] };
};

export default microjogo<DadosRetrato, Map<number, number[]>>({
  id: 'retrato',
  gerar(aleatorio) {
    const faixas = [];
    for (let k = 0; k < FAIXAS; k++) {
      // de cima para baixo, cada faixa um pouco mais rápida
      const periodo = 1500 - k * 200 + Math.floor(aleatorio() * 200);
      // começa longe do lugar certo: perto de um dos lados (o ciclo passa pelo lugar a 1/4 e a 3/4)
      const lado = aleatorio() < 0.5 ? 0.42 : 0.92;
      const fase = Math.floor(periodo * ((lado + aleatorio() * 0.16) % 1));
      faixas.push({ periodo, fase });
    }
    return { faixas };
  },
  duracao: () => RETRATO_MS + 1500,
  memoria: () => new Map(),
  acerto({ mem, quem, corpo, cabe }) {
    const t = corpo.t;
    if (!numero(t) || t < REACAO_MINIMA || t > RETRATO_MS || !cabe(t)) return;
    const minhas = mem.get(quem) ?? [];
    // a ordem e o espaço entre as paradas se conferem no fim (paradasQueValem); aqui, só não guardar mais do que se precisa
    if (minhas.length >= 4 * FAIXAS) return;
    minhas.push(Math.round(t));
    mem.set(quem, minhas);
  },
  avaliar: ({ dados, mem, quem }) => pelasParadas(dados, mem.get(quem)),
  *noFim({ dados, mem }) {
    for (const [quem, paradas] of mem) yield [quem, pelasParadas(dados, paradas)] as [number, Resultado];
  },
  robo(_d, aleatorio, passouMs) {
    // para cada faixa uns 1,5 s depois da anterior, errando um pouco
    const paradas: number[] = [];
    let erro = 0;
    let t = 0;
    for (let k = 0; k < FAIXAS; k++) {
      t += 1200 + Math.floor(aleatorio() * 1200);
      if (t > Math.min(passouMs, RETRATO_MS)) break;
      paradas.push(t);
      erro += Math.floor(aleatorio() * 16);
    }
    if (!paradas.length) return { motivo: 'errou', valor: 0, chave: [] };
    erro += (FAIXAS - paradas.length) * AMPLITUDE;
    return { motivo: null, valor: precisao(erro), chave: [erro, paradas.length === FAIXAS ? paradas[FAIXAS - 1] : RETRATO_MS] };
  },
});
