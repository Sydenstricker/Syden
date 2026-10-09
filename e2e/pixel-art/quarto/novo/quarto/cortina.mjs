// A cortina FECHADA, para a janela interativa (pedido dele em 08/10/2026: clicar abre e fecha). Só a região da janela
// é repintada, de dia (na base) e de noite (na noite montada); a página troca uma pela outra no clique.
//   node e2e/pixel-art/quarto/novo/quarto/cortina.mjs   → cortina-dia.png, cortina-noite.png
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
const DE = { dia: path.join(AQUI, '..', 'bases', 'pl-512-janela-1.png'), noite: path.join(AQUI, 'noite.png') };
for (const quando of ['dia', 'noite']) {
  const destino = path.join(AQUI, `cortina-${quando}.png`);
  if (fs.existsSync(destino)) { console.log('já existe:', quando); continue; }
  gravar64(destino, await pintar(ler64(DE[quando]), { caixa, poligonos: [REGIAO], texto: PEDIDO[quando] }, null));
  console.log('cortina fechada:', quando);
}
await fechar();
