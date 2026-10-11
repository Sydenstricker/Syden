// Anima uma peça do lobby a partir dela mesma (o primeiro quadro é o desenho escolhido).
//
//   node e2e/pixel-art/lobby/animar.mjs celular-1   → celular-1-anim-<k>.png
//
// O gasto vai para ../quarto/custos.jsonl (o chamar() de pintura.mjs).
import path from 'node:path';
import { gravar64, ler64 } from '../quarto/imagem.mjs';
import { chamar } from '../quarto/hibrido/pintura.mjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const ACOES = {
  celular:
    'the bunny scrolls on the smartphone with its thumb, looks at the screen, smiles a little and its ears twitch, the screen glow flickers softly; the body stays seated in place',
};
const base = process.argv[2];
const acao = ACOES[base?.split('-')[0]];
if (!acao) {
  console.error('use: animar.mjs ' + Object.keys(ACOES).map((a) => a + '-<n>').join(' | '));
  process.exit(1);
}
const quadros = await chamar('/animate-with-text-v3', {
  first_frame: { type: 'base64', base64: ler64(path.join(AQUI, base + '.png')) },
  action: acao,
  frame_count: 8,
  no_background: true,
});
quadros.forEach((b, i) => gravar64(path.join(AQUI, `${base}-anim-${i + 1}.png`), b));
console.log(base, '→', quadros.length, 'quadros');
