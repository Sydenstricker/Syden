/**
 * O CONTROLE DE VIDEOGAME NOS JOGOS (20/11/2026, a segunda auditoria dos mini-games): o módulo comum da Gamepad API.
 *
 * COMO USAR, a cada quadro (ou a cada passo) do laço do jogo:
 *
 *   const c = lerControle();          // null: nenhum controle ligado (ou navegador sem a API) — o jogo segue como estava
 *   if (c) {
 *     vira = c.direcao;               // -1 (esquerda) … 1 (direita), analógico, já sem a zona morta; o direcional dá ±1
 *     sobe = c.vertical;              // -1 (para cima) … 1 (para baixo), idem
 *     acelera = c.acelerar > 0.3;     // o gatilho direito (RT), 0 … 1
 *     freia = c.frear > 0.3;          // o gatilho esquerdo (LT), 0 … 1
 *     if (c.a) …                      // os botões, no layout do controle de Xbox (no de PlayStation: A = ✕, B = ○, X = □, Y = △)
 *   }
 *
 * Para "apertou agora" (a borda), guarde o anterior e use `desceu(antes, agora, 'a')`. O controle é o PRIMEIRO conectado
 * (o navegador só entrega o controle depois do primeiro botão apertado na página: é a regra da API, não um defeito).
 *
 * O mapeamento é o "standard" da W3C (botões 0–3 A/B/X/Y, 4–5 ombros, 6–7 gatilhos, 8 select, 9 start, 12–15 direcional;
 * eixos 0–1 o analógico esquerdo, 2–3 o direito). Controle que não declara "standard" é lido do mesmo jeito: quase todos os
 * comuns seguem a mesma ordem. Nada aqui guarda estado nem vai ao servidor: é só a leitura do aparelho de quem joga.
 */

export interface Controle {
  /** O analógico esquerdo na horizontal (ou o direcional): −1 esquerda … 1 direita. */
  direcao: number;
  /** O analógico esquerdo na vertical (ou o direcional): −1 cima … 1 baixo. */
  vertical: number;
  /** O analógico direito (para câmera ou mira): −1 … 1 em cada eixo. */
  direitoX: number;
  direitoY: number;
  /** Os gatilhos, analógicos: o direito (RT/R2) acelera, o esquerdo (LT/L2) freia. 0 … 1. */
  acelerar: number;
  frear: number;
  a: boolean;
  b: boolean;
  x: boolean;
  y: boolean;
  /** Os ombros (LB/L1 e RB/R1). */
  ombroEsquerdo: boolean;
  ombroDireito: boolean;
  start: boolean;
  select: boolean;
  /** O direcional, à parte (ele também entra em `direcao` e `vertical`). */
  cima: boolean;
  baixo: boolean;
  esquerda: boolean;
  direita: boolean;
}

export type BotaoDoControle = 'a' | 'b' | 'x' | 'y' | 'ombroEsquerdo' | 'ombroDireito' | 'start' | 'select' | 'cima' | 'baixo' | 'esquerda' | 'direita';

/** A zona morta padrão dos analógicos (o analógico solto raramente para no zero exato). */
export const ZONA_MORTA = 0.15;

/** Tira a zona morta e reescala o resto para −1 … 1 (sem salto na beira da zona). */
export function semZonaMorta(v: number, zona = ZONA_MORTA): number {
  if (!Number.isFinite(v)) return 0;
  const a = Math.abs(v);
  if (a <= zona) return 0;
  return Math.sign(v) * Math.min(1, (a - zona) / (1 - zona));
}

const botao = (p: Gamepad, i: number) => p.buttons[i]?.pressed === true;
const valor = (p: Gamepad, i: number) => {
  const b = p.buttons[i];
  // o valor analógico quando há; o controle que só diz "apertado" (gatilho digital) vale 1
  return !b ? 0 : b.value > 0 ? Math.min(1, b.value) : b.pressed ? 1 : 0;
};

/** O primeiro controle conectado, já lido; null sem controle (ou sem a API, ou fora do navegador). */
export function lerControle(zona = ZONA_MORTA): Controle | null {
  if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') return null;
  let pads: (Gamepad | null)[];
  try {
    pads = Array.from(navigator.getGamepads());
  } catch {
    // a política de permissões da página pode recusar a API
    return null;
  }
  const p = pads.find((g): g is Gamepad => !!g && g.connected !== false);
  if (!p) return null;
  const cima = botao(p, 12), baixo = botao(p, 13), esquerda = botao(p, 14), direita = botao(p, 15);
  const eixoX = semZonaMorta(p.axes[0] ?? 0, zona);
  const eixoY = semZonaMorta(p.axes[1] ?? 0, zona);
  return {
    // o direcional ganha do analógico quando está apertado (é ±1, inteiro)
    direcao: esquerda !== direita ? (direita ? 1 : -1) : eixoX,
    vertical: cima !== baixo ? (baixo ? 1 : -1) : eixoY,
    direitoX: semZonaMorta(p.axes[2] ?? 0, zona),
    direitoY: semZonaMorta(p.axes[3] ?? 0, zona),
    acelerar: valor(p, 7),
    frear: valor(p, 6),
    a: botao(p, 0),
    b: botao(p, 1),
    x: botao(p, 2),
    y: botao(p, 3),
    ombroEsquerdo: botao(p, 4),
    ombroDireito: botao(p, 5),
    select: botao(p, 8),
    start: botao(p, 9),
    cima,
    baixo,
    esquerda,
    direita,
  };
}

/** O botão desceu agora (estava solto na leitura anterior e está apertado nesta). */
export const desceu = (antes: Controle | null, agora: Controle | null, qual: BotaoDoControle) => !!agora?.[qual] && !antes?.[qual];
