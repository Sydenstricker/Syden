/** PARAR O RELÓGIO: pare em 10 s exatos; os números somem depois de 3. */
import { invalido, microjogo, numero } from './comum.js';

export const RELOGIO_MS = 15000;
export const RELOGIO_ALVO = 10000;

export default microjogo<Record<string, never>>({
  id: 'relogio',
  gerar: () => ({}),
  duracao: () => RELOGIO_MS,
  avaliar({ corpo, cabe }) {
    const t = corpo.t;
    if (!numero(t) || t < 0 || t > RELOGIO_MS || !cabe(t)) return invalido();
    const ms = Math.round(t);
    return { motivo: null, valor: ms, chave: [Math.abs(ms - RELOGIO_ALVO)] };
  },
  robo(_d, aleatorio) {
    const ms = Math.round(RELOGIO_ALVO + (aleatorio() * 2 - 1) * (120 + aleatorio() * 700));
    return { motivo: null, valor: ms, chave: [Math.abs(ms - RELOGIO_ALVO)] };
  },
});
