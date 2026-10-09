// A cortina FECHADA, para a janela interativa (pedido dele em 08/10/2026: clicar abre e fecha). Só a região da janela
// é repintada, de dia (na base) e de noite (na noite montada); a página troca uma pela outra no clique.
//   node e2e/pixel-art/quarto/novo/quarto/cortina.mjs   → cortina-<dia|noite>-1.png (a cortina) e cortina-<dia|noite>.png (com a barra)
import fs from 'node:fs';
import path from 'node:path';
import { fechar, ler64, gravar64 } from '../../imagem.mjs';
import { pintar } from './pintar.mjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
// A janela com as cortinas e o varão, seguindo a inclinação da parede (no máximo 256 px de altura: a janela de
// repintura não passa disso).
export const REGIAO = [[276, 64], [466, 158], [466, 318], [276, 268]];
const caixa = [276, 64, 466, 318];
const PEDIDO = {
  dia: 'the same wooden window with both soft cream linen curtains fully CLOSED, drawn together and meeting in the middle, covering the whole window glass, soft afternoon daylight glowing through the fabric, the curtain rod above, clean isometric pixel art',
  noite: 'the same wooden window at night with both soft linen curtains fully CLOSED, drawn together and meeting in the middle, covering the whole window glass, a faint cool moonlight glow through the fabric, dim and calm, clean isometric pixel art',
};
// A BARRA: a cortina aberta original desce além da região (até y ≈ 335, no canto da direita), e o pé dela aparecia
// embaixo da fechada, como duas cortinas. Um segundo passo repinta só esse canto, por cima da cortina fechada.
export const BARRA = [[416, 298], [470, 312], [470, 344], [416, 340]];
const PEDIDO_BARRA = {
  dia: 'the bottom hem of the same closed cream linen curtain, falling straight and just touching the wooden floor, a single curtain, the wooden floor planks and baseboard around it, clean isometric pixel art',
  noite: 'the bottom hem of the same closed linen curtain at night, falling straight and just touching the dark wooden floor, a single curtain, dim and calm, clean isometric pixel art',
};
const DE = { dia: path.join(AQUI, '..', 'bases', 'pl-512-janela-1.png'), noite: path.join(AQUI, 'noite.png') };
for (const quando of ['dia', 'noite']) {
  const primeira = path.join(AQUI, `cortina-${quando}-1.png`), destino = path.join(AQUI, `cortina-${quando}.png`);
  if (!fs.existsSync(primeira)) { gravar64(primeira, await pintar(ler64(DE[quando]), { caixa, poligonos: [REGIAO], texto: PEDIDO[quando] }, null)); console.log('cortina fechada:', quando); }
  if (!fs.existsSync(destino)) { gravar64(destino, await pintar(ler64(primeira), { caixa: [416, 298, 470, 344], poligonos: [BARRA], texto: PEDIDO_BARRA[quando] }, null)); console.log('barra:', quando); }
}
await fechar();
