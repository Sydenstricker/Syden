// Baixa os modelos e as fotos de teste da medida do fundo da câmera (ver README.md), fora do git.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FOTOS, MODELOS, VIDEOS } from './lista.mjs';

const AQUI = dirname(fileURLToPath(import.meta.url));
const AGENTE = { 'user-agent': 'syden-medida/1.0' };
mkdirSync(join(AQUI, 'modelos'), { recursive: true });
mkdirSync(join(AQUI, 'fotos'), { recursive: true });
mkdirSync(join(AQUI, 'videos'), { recursive: true });

async function baixar(url, destino) {
  if (existsSync(destino)) return;
  let r;
  // o Commons limita a taxa (429): espera e tenta de novo
  for (let tentativa = 0; tentativa < 8; tentativa++) {
    r = await fetch(url, { headers: AGENTE, redirect: 'follow' });
    if (r.status !== 429) break;
    await new Promise((ok) => setTimeout(ok, 15000));
  }
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  writeFileSync(destino, Buffer.from(await r.arrayBuffer()));
  console.log('baixado', destino.replace(AQUI, '.'));
}

for (const m of MODELOS.filter((m) => m.url)) await baixar(m.url, join(AQUI, 'modelos', m.arquivo));
for (const f of FOTOS) {
  if (!f.commons) continue;
  await baixar(`https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(f.commons)}?width=1280`, join(AQUI, 'fotos', f.arquivo));
}
// os vídeos da webcam simulada (medir-video.mjs), inteiros (3 a 30 MB); o corte e a redução são do ffmpeg, na medida
for (const v of VIDEOS) await baixar(v.url, join(AQUI, 'videos', v.arquivo));
