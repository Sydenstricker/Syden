/**
 * CONTEXTO DE ÁUDIO PARADO QUANDO NÃO TOCA NADA (auditoria de desempenho, 15/11/2026, relatos de FPS no LoL).
 *
 * Um AudioContext "running" mantém a thread de áudio do navegador acordada, desenhando silêncio a cada 3 ms, mesmo sem som
 * nenhum ligado nele. Os sons da interface (sounds.ts), os dos jogos (somDosJogos.ts) e o soundboard criavam o seu na
 * primeira vez que tocavam e nunca mais o paravam: depois do primeiro "plim" de alguém entrando na sala, ficavam a
 * sessão inteira trabalhando por nada, com o jogo rodando.
 *
 * `usar` é para quem toca notas curtas (menos que OCIOSO_MS): retoma, e suspende OCIOSO_MS depois do último uso.
 * `segurar` / `soltar` é para quem toca algo de duração desconhecida (o arquivo do soundboard): enquanto houver um
 * segurado, o contexto não é suspenso; o prazo só conta a partir do último solto.
 */
export const OCIOSO_MS = 10_000;

interface Estado {
  presos: number;
  relogio: ReturnType<typeof setTimeout> | null;
}
const estados = new WeakMap<BaseAudioContext, Estado>();

function estadoDe(ctx: AudioContext): Estado {
  let e = estados.get(ctx);
  if (!e) estados.set(ctx, (e = { presos: 0, relogio: null }));
  return e;
}

function agendar(ctx: AudioContext, e: Estado) {
  if (e.relogio) clearTimeout(e.relogio);
  e.relogio = null;
  if (e.presos > 0) return;
  e.relogio = setTimeout(() => {
    e.relogio = null;
    if (e.presos === 0 && ctx.state === 'running') void ctx.suspend().catch(() => {});
  }, OCIOSO_MS);
}

function retomar(ctx: AudioContext) {
  if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
}

/** Vai tocar algo curto agora: retoma o contexto e conta o prazo de novo. */
export function usar(ctx: AudioContext) {
  retomar(ctx);
  agendar(ctx, estadoDe(ctx));
}

/** Começou algo de duração desconhecida: o contexto não para até o `soltar` correspondente. */
export function segurar(ctx: AudioContext) {
  const e = estadoDe(ctx);
  e.presos++;
  retomar(ctx);
  agendar(ctx, e);
}

export function soltar(ctx: AudioContext) {
  const e = estadoDe(ctx);
  e.presos = Math.max(0, e.presos - 1);
  agendar(ctx, e);
}
