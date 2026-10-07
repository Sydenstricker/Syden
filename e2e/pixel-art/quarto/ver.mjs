// Uma folha para olhar as peças ampliadas, com os pixels nítidos.
//   node e2e/pixel-art/quarto/ver.mjs <prefixo> [saida.png]   ex.: ver.mjs cama  → todas as camas, das duas ferramentas
import fs from 'node:fs';
import path from 'node:path';
import { ler64, foto, fechar } from './imagem.mjs';
const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const [prefixo = '', arquivo = path.join(AQUI, 'ver.png')] = process.argv.slice(2);
const pastas = process.env.PASTAS ? process.env.PASTAS.split(',') : ['saida/pixellab', 'paleta/pixellab', 'saida/rd', 'paleta/rd'];
let html = '<body style="margin:0;padding:12px;background:#3a3338;font:13px sans-serif;color:#eee">';
for (const pasta of pastas) {
  const dir = path.join(AQUI, pasta);
  if (!fs.existsSync(dir)) continue;
  const fs_ = fs.readdirSync(dir).filter((f) => f.endsWith('.png') && f.startsWith(prefixo));
  if (!fs_.length) continue;
  html += `<h3 style="margin:8px 0">${pasta}</h3><div style="display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end">`;
  for (const f of fs_) html += `<figure style="margin:0;text-align:center"><img src="data:image/png;base64,${ler64(path.join(dir, f))}" style="zoom:${process.env.ZOOM ?? 3};image-rendering:pixelated;background:#cfc6c0"><figcaption>${f}</figcaption></figure>`;
  html += '</div>';
}
await foto(html + '</body>', arquivo, { largura: 1400, altura: 600 });
await fechar();
