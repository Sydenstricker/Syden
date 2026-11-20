import { lerControle } from '../controleDosJogos';
import type { Comandos } from './fisica';

/**
 * O CONTROLE DE VIDEOGAME NO KART (20/11/2026), na Corrida e no Estoura-balão: o que o controle aperta SOMA ao que o
 * teclado e o toque apertam (quem chama escreve em `base`, e o laço lê o resultado a cada quadro).
 *
 * - o analógico esquerdo (ou o direcional) vira, PROPORCIONAL: a física aceita o volante parcial (fisica.ts, `vira`);
 * - o gatilho direito ou o A aceleram; o gatilho esquerdo ou o B freiam e dão ré;
 * - os ombros derrapam (e pulam, em linha reta); o X usa o item; o Y olha para trás. O Start pausa (pausaDosJogos.tsx).
 *
 * O acelerador da física é ligado ou desligado: o gatilho conta como apertado a partir de 30%.
 */
export function comandosComControle(base: Comandos, alvo: Comandos): Comandos {
  const pad = lerControle();
  alvo.acelera = base.acelera;
  alvo.freia = base.freia;
  alvo.vira = base.vira;
  alvo.derrapa = base.derrapa;
  alvo.usa = base.usa;
  alvo.olha = base.olha;
  if (!pad) return alvo;
  alvo.acelera = base.acelera || pad.a || pad.acelerar > 0.3;
  alvo.freia = base.freia || pad.b || pad.frear > 0.3;
  // o teclado ou o dedo, quando viram, ganham do analógico
  if (base.vira === 0) alvo.vira = pad.direcao;
  alvo.derrapa = base.derrapa || pad.ombroDireito || pad.ombroEsquerdo;
  alvo.usa = base.usa === true || pad.x;
  alvo.olha = base.olha === true || pad.y;
  return alvo;
}
