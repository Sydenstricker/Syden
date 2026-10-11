// Os coelhos prontos em cada estado (pedido de 10/10/2026: "borda colorida com o coelho fazendo a ação
// correspondente"). A cor do estado vai no anel por fora da moldura (Avatar.tsx), e a POSE vai aqui: cada um
// dos 16 coelhos de web/public/avatares/ animado a partir dele mesmo, para continuar sendo o mesmo coelho.
//
//   node e2e/pixel-art/avatares/gerar.mjs animar <n> <estado>  → <estado>-<n>-<k>.png (os quadros)
//
// O primeiro quadro é o desenho original (../demonstracao/avatares-<n>.png, 64 × 64). O gasto vai para
// ../quarto/custos.jsonl (o chamar() de pintura.mjs).
import path from 'node:path';
import { gravar64, ler64 } from '../quarto/imagem.mjs';
import { chamar } from '../quarto/hibrido/pintura.mjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');

const saldo = async () =>
  (await (await fetch('https://api.pixellab.ai/v2/balance', { headers: { authorization: `Bearer ${process.env.PIXELLAB_KEY}` } })).json())
    .subscription.generations;

/** O que o coelho faz em cada estado. Os laços têm de fechar: o último quadro volta perto do primeiro. */
export const ACOES = {
  falando: 'the bunny talks happily: its mouth opens and closes as if speaking, small head bob, ears move slightly, keeps looking forward',
  ausente: 'the bunny falls asleep: eyes slowly close, head tilts gently to one side, ears droop a little, breathing calmly while sleeping',
  ocupado: 'the bunny is busy and focused: it frowns in concentration, eyes narrowed, looks down slightly as if working hard, then back',
};

const [etapa, n, estado] = process.argv.slice(2);
if (etapa !== 'animar' || !n || !ACOES[estado]) {
  console.error('use: gerar.mjs animar <1..16> ' + Object.keys(ACOES).join('|'));
  process.exit(1);
}
const antes = await saldo();
const quadros = await chamar('/animate-with-text-v3', {
  first_frame: { type: 'base64', base64: ler64(path.join(AQUI, '..', 'demonstracao', `avatares-${n}.png`)) },
  action: ACOES[estado],
  frame_count: 8,
  no_background: true,
});
quadros.forEach((b, i) => gravar64(path.join(AQUI, `${estado}-${n}-${i + 1}.png`), b));
console.log(estado, n, '→', quadros.length, 'quadros');
console.log(`gerações: ${antes} → ${await saldo()}`);
