import { lerControle } from '../controleDosJogos';
import type { ComandosDoBarco } from './fisica';

/**
 * O CONTROLE DE VIDEOGAME NA REGATA (20/11/2026): o que o controle aperta SOMA ao que o teclado e o toque apertam (o laço lê
 * `base`, a cada passo, e escreve o resultado em `alvo`), como o kart (corrida/controle.ts): o analógico esquerdo (ou o
 * direcional) vira, proporcional; o gatilho direito ou o A aceleram; o gatilho esquerdo ou o B freiam e dão ré. O Start pausa
 * (pausaDosJogos.tsx).
 */
export function comandosDoBarcoComControle(base: ComandosDoBarco, alvo: ComandosDoBarco): ComandosDoBarco {
  const pad = lerControle();
  alvo.acelera = base.acelera;
  alvo.freia = base.freia;
  alvo.vira = base.vira;
  if (!pad) return alvo;
  alvo.acelera = base.acelera || pad.a || pad.acelerar > 0.3;
  alvo.freia = base.freia || pad.b || pad.frear > 0.3;
  if (base.vira === 0) alvo.vira = pad.direcao;
  return alvo;
}
