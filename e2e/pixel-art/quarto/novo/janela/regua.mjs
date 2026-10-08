// Régua da base sem porta: a imagem ampliada 2× com marcas a cada 20 px, para medir os cantos do chão à mão.
//   node e2e/pixel-art/quarto/novo/janela/regua.mjs
import path from 'node:path';
import { foto, fechar, ler64 } from '../../imagem.mjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const BASE = ler64(path.join(AQUI, '..', 'bases', 'pl-512-janela-1.png'));
let linhas = '';
for (let k = 0; k <= 512; k += 20) {
  const forte = k % 100 === 0 ? 'rgba(255,0,0,.7)' : 'rgba(0,0,255,.35)';
  linhas += `<div style="position:absolute;left:${k * 2}px;top:0;width:1px;height:1024px;background:${forte}"></div><div style="position:absolute;top:${k * 2}px;left:0;height:1px;width:1024px;background:${forte}"></div>`;
  if (k % 100 === 0) linhas += `<b style="position:absolute;left:${k * 2 + 2}px;top:2px;color:red;font:12px sans-serif">${k}</b><b style="position:absolute;top:${k * 2 + 2}px;left:2px;color:red;font:12px sans-serif">${k}</b>`;
}
await foto(`<body style="margin:0"><div style="position:relative;width:1024px;height:1024px"><img src="data:image/png;base64,${BASE}" style="width:1024px;image-rendering:pixelated">${linhas}</div>`, path.join(AQUI, 'regua.png'), { largura: 1024, altura: 1024 });
await fechar();
