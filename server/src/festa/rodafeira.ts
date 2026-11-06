/**
 * A RODA DA FEIRA (05/11/2026; Winner's Wheel no levantamento em docs/mario-party-3.md, só a mecânica, SEM APOSTA: o prêmio é
 * ponto da rodada, e nada se paga para girar): a roda gira, e o aperto a faz frear; ela desliza sempre o mesmo tanto até parar
 * (o freio é igual em todo giro), e o que fica embaixo da seta é o prêmio. A fatia do 10 é fininha. Três giros, cada um com a
 * sua velocidade; vale a soma. Quem não aperta a tempo deixa a roda passar, e aquele giro fica sem prêmio.
 *
 * O freio é uniforme: depois do aperto, a roda anda mais ω·RODA_FREIO_MS/2 voltas. A conta (`paradaDaRoda`) é só + − × ÷ e
 * Math.floor, e a tela roda a mesma.
 */
import { microjogo, numero, type Resultado } from './comum.js';

export const RODA_VEZES = 3;
export const RODA_VEZ_MS = 5500;
/** Até quando dá para apertar em cada giro. */
export const RODA_GIRO_MS = 3500;
/** Quanto a roda leva freando, depois do aperto. */
export const RODA_FREIO_MS = 1600;
/** Os prêmios e a largura de cada fatia (as larguras somam 1). */
export const PREMIOS = [10, 5, 3, 3, 2, 2, 1, 1];
export const LARGURAS = [0.05, 0.09, 0.13, 0.13, 0.15, 0.15, 0.15, 0.15];

export interface Fatia {
  /** Onde a fatia começa e termina na roda (fração da volta), e o prêmio. */
  de: number;
  ate: number;
  premio: number;
}

export interface DadosRoda {
  /** Cada giro: a velocidade (voltas por segundo) e as fatias, numa ordem sorteada. */
  giros: { v: number; fatias: Fatia[] }[];
}

/** Onde a roda para (em voltas), apertando `ms` depois do começo do giro. */
export const paradaDaRoda = (v: number, ms: number) => v * (ms / 1000 + RODA_FREIO_MS / 2000);

/** O prêmio embaixo da seta, com a roda em `voltas`. */
export function premioEm(fatias: Fatia[], voltas: number): number {
  const p = voltas - Math.floor(voltas);
  for (const f of fatias) if (p >= f.de && p < f.ate) return f.premio;
  return fatias[fatias.length - 1].premio;
}

export const vezDaRoda = (t: number) => ({ vez: Math.floor(t / RODA_VEZ_MS), ms: t - Math.floor(t / RODA_VEZ_MS) * RODA_VEZ_MS });

const pelaSoma = (p: number): Resultado => (p === 0 ? { motivo: 'errou', valor: 0, chave: [] } : { motivo: null, valor: p, chave: [-p] });
const soma = (m: Map<number, number> | undefined) => [...(m?.values() ?? [])].reduce((a, b) => a + b, 0);

export default microjogo<DadosRoda, Map<number, Map<number, number>>>({
  id: 'rodafeira',
  gerar(aleatorio) {
    const giros: DadosRoda['giros'] = [];
    for (let k = 0; k < RODA_VEZES; k++) {
      // a ordem das fatias embaralhada (Fisher-Yates com o sorteio dado)
      const ordem = PREMIOS.map((_, i) => i);
      for (let i = ordem.length - 1; i > 0; i--) {
        const j = Math.floor(aleatorio() * (i + 1));
        [ordem[i], ordem[j]] = [ordem[j], ordem[i]];
      }
      let de = 0;
      const fatias = ordem.map((i) => {
        const f = { de: Math.round(de * 1000) / 1000, ate: Math.round((de + LARGURAS[i]) * 1000) / 1000, premio: PREMIOS[i] };
        de += LARGURAS[i];
        return f;
      });
      fatias[fatias.length - 1].ate = 1;
      giros.push({ v: Math.round((0.7 + aleatorio() * 0.4) * 100) / 100, fatias });
    }
    return { giros };
  },
  duracao: () => RODA_VEZES * RODA_VEZ_MS + 1000,
  memoria: () => new Map(),
  acerto({ dados, mem, quem, corpo, cabe }) {
    const t = corpo.t;
    // o aperto é o de agora (com a folga da rede): calcular o perfeito e mandar depois não vale
    if (!numero(t) || t < 0 || !cabe(t)) return;
    const { vez, ms } = vezDaRoda(Math.round(t));
    if (vez >= RODA_VEZES || ms > RODA_GIRO_MS) return;
    const meus = mem.get(quem) ?? new Map<number, number>();
    if (meus.has(vez)) return;
    const g = dados.giros[vez];
    meus.set(vez, premioEm(g.fatias, paradaDaRoda(g.v, ms)));
    mem.set(quem, meus);
  },
  avaliar: ({ mem, quem }) => pelaSoma(soma(mem.get(quem))),
  *noFim({ mem }) {
    for (const [quem, m] of mem) yield [quem, pelaSoma(soma(m))] as [number, Resultado];
  },
  robo(dados, aleatorio, passouMs) {
    // quem joga bem mira o 10 e às vezes acerta; senão, cai numa fatia qualquer perto dele
    let p = 0;
    for (let k = 0; k < RODA_VEZES; k++) {
      if (passouMs - k * RODA_VEZ_MS < RODA_FREIO_MS + 500) break;
      const s = aleatorio();
      p += s < 0.2 ? 10 : premioEm(dados.giros[k].fatias, aleatorio());
    }
    return pelaSoma(p);
  },
});
