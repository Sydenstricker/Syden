import { lerControle } from '../controleDosJogos';
import type { ComandosDoJato } from './fisica';

/**
 * O CONTROLE DE VIDEOGAME NOS COELHOS A JATO (20/11/2026): o que o controle aperta SOMA ao que o teclado e o toque apertam
 * (o laço lê `base`, a cada passo, e escreve o resultado em `alvo`), como o kart (corrida/controle.ts).
 *
 * - o analógico esquerdo (ou o direcional) vira, proporcional (a física aceita o volante parcial);
 * - o gatilho direito ou o A aceleram; o gatilho esquerdo ou o B freiam;
 * - o X é o turbo; os ombros, o freio de ar; o Y, o golpe de lado (só no Solo). O Start pausa (pausaDosJogos.tsx).
 */
export function comandosDoJatoComControle(base: ComandosDoJato, alvo: ComandosDoJato): ComandosDoJato {
  const pad = lerControle();
  alvo.acelera = base.acelera;
  alvo.freia = base.freia;
  alvo.vira = base.vira;
  alvo.turbo = base.turbo;
  alvo.freioDeAr = base.freioDeAr;
  alvo.ataque = base.ataque;
  if (!pad) return alvo;
  alvo.acelera = base.acelera || pad.a || pad.acelerar > 0.3;
  alvo.freia = base.freia || pad.b || pad.frear > 0.3;
  // o teclado ou o dedo, quando viram, ganham do analógico
  if (base.vira === 0) alvo.vira = pad.direcao;
  alvo.turbo = base.turbo || pad.x;
  alvo.freioDeAr = base.freioDeAr || pad.ombroEsquerdo || pad.ombroDireito;
  alvo.ataque = base.ataque === true || pad.y;
  return alvo;
}
