/** SAQUE RÁPIDO: o sinal sai entre 2 e 5 s depois do começo; antes dele, está fora. A reação conta de quando o sinal apareceu
 * em cada tela, e por isso o sinal só vai ao site quando sai. */
import { FOLGA_ACIMA, invalido, microjogo, numero, REACAO_MINIMA, type Resultado } from './comum.js';

export const SAQUE_ESPERA_MIN = 2000;
export const SAQUE_ESPERA_MAX = 5000;
export const SAQUE_DEPOIS_MS = 3000;

interface Mem {
  /** Quando o sinal saiu (relógio do servidor), ou null. */
  sinalEm: number | null;
  /** Quando o estado com o sinal foi servido a cada um: a reação honesta começa depois disso. */
  servidoEm: Map<number, number>;
}

const cedo = (): Resultado => ({ motivo: 'cedo', valor: null, chave: [] });

export default microjogo<Record<string, never>, Mem>({
  id: 'saque',
  gerar: () => ({}),
  duracao: () => SAQUE_ESPERA_MAX + SAQUE_DEPOIS_MS,
  memoria: () => ({ sinalEm: null, servidoEm: new Map() }),
  iniciar({ mem, agora, aleatorio, agendar, avisar, revelar }) {
    const espera = SAQUE_ESPERA_MIN + Math.floor(aleatorio() * (SAQUE_ESPERA_MAX - SAQUE_ESPERA_MIN));
    agendar(espera, () => {
      mem.sinalEm = agora();
      agendar(SAQUE_DEPOIS_MS, revelar);
      avisar();
    });
  },
  vista({ mem, quem, fase, agora }) {
    // o estado com o sinal servido a esta pessoa pela primeira vez: a reação dela começa daqui
    if (fase === 'jogando' && mem.sinalEm !== null && !mem.servidoEm.has(quem)) mem.servidoEm.set(quem, agora);
    return { sinal: mem.sinalEm !== null };
  },
  avaliar({ mem, quem, corpo, agora, abaixo }) {
    if (corpo.cedo === true || mem.sinalEm === null) return cedo();
    if (!numero(corpo.reacaoMs)) return invalido();
    if (corpo.reacaoMs < REACAO_MINIMA) return cedo();
    // a reação conta de quando o sinal apareceu na tela, e ele só aparece depois de o estado com ele ser servido: ela não
    // passa do que o servidor viu desde então, e não fica abaixo disso mais do que a rede da pessoa (aí, o servidor a sobe)
    const desde = agora - (mem.servidoEm.get(quem) ?? mem.sinalEm);
    if (corpo.reacaoMs > desde + FOLGA_ACIMA) return invalido();
    const reacao = Math.round(Math.max(corpo.reacaoMs, desde - abaixo));
    return { motivo: null, valor: reacao, chave: [reacao] };
  },
  robo(_d, aleatorio) {
    if (aleatorio() < 0.08) return cedo();
    const reacao = Math.round(230 + aleatorio() * 220);
    return { motivo: null, valor: reacao, chave: [reacao] };
  },
});
