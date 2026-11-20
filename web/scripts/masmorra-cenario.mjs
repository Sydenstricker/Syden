// O CENÁRIO DA MASMORRA DA TOCA (20/11/2026). Junta numa tira só (16 px por peça, na ordem de PECAS em
// web/src/masmorra/desenho.ts) as peças usadas do Tiny Dungeon da Kenney (CC0): o chão de areia, o tijolo, as tábuas da ponte,
// as portas, o baú, o barril e o bloco. Só cenário e objetos: os heróis e os monstros do pacote NÃO entram (o coelho e os bichos
// são os nossos, as folhas da Briga). Grava web/public/masmorra/cenario.png, com a licença ao lado. O pacote fica fora do git,
// em e2e/3D/Assets/kenney_tiny-dungeon/.
//
//   node web/scripts/masmorra-cenario.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ORIGEM = path.resolve(RAIZ, '..', 'e2e', '3D', 'Assets', 'kenney_tiny-dungeon', 'x');
const SAIDA = path.join(RAIZ, 'public', 'masmorra');

/** O número de cada peça no pacote (Tiles/tile_NNNN.png), na ordem de PECAS em desenho.ts. */
const QUAIS = [
  48, // chão de areia
  49, // areia com pintas
  42, // areia com pedrinhas
  40, // tijolo
  28, // tijolo com a grade
  37, // tábuas da ponte
  36, // a beira da ponte
  9, // porta aberta
  45, // porta fechada
  89, // baú fechado
  91, // baú aberto
  82, // barril (o "vaso" que se levanta)
  55, // bloco de ferro (o que se empurra)
];

const tira = new PNG({ width: 16 * QUAIS.length, height: 16 });
QUAIS.forEach((n, k) => {
  const p = PNG.sync.read(fs.readFileSync(path.join(ORIGEM, 'Tiles', `tile_${String(n).padStart(4, '0')}.png`)));
  if (p.width !== 16 || p.height !== 16) throw new Error(`tile ${n}: ${p.width}×${p.height}`);
  PNG.bitblt(p, tira, 0, 0, 16, 16, k * 16, 0);
});
fs.mkdirSync(SAIDA, { recursive: true });
fs.writeFileSync(path.join(SAIDA, 'cenario.png'), PNG.sync.write(tira, { colorType: 6 }));
fs.copyFileSync(path.join(ORIGEM, 'License.txt'), path.join(SAIDA, 'LICENCA-Kenney-Tiny-Dungeon.txt'));
console.log(`cenario.png: ${QUAIS.length} peças`);
