// Monta a folha de comparação lado a lado (folha.html e folha.png), ampliada com os pixels nítidos.
//   node e2e/pixel-art/folha.mjs
import fs from 'node:fs';
import path from 'node:path';
import { abrirNavegador } from '../ajuda.mjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const img = (f) => 'data:image/png;base64,' + fs.readFileSync(path.join(AQUI, f)).toString('base64');
const linha = (titulo, arquivos) =>
  `<div class="l"><h3>${titulo}</h3>` +
  arquivos.map((f) => `<figure><img src="${img(f)}"><figcaption>${f.replace('saida/', '').replace('.png', '')}</figcaption></figure>`).join('') +
  '</div>';
const da = (prefixo) =>
  fs.readdirSync(path.join(AQUI, 'saida'))
    .filter((f) => f.startsWith(prefixo))
    .sort((a, b) => parseInt(a.split('-').pop()) - parseInt(b.split('-').pop()))
    .map((f) => 'saida/' + f);

const html =
  '<meta charset="utf-8"><style>body{margin:0;padding:16px;background:#1e2128;color:#ddd;font:13px sans-serif}.l{display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end;margin-bottom:14px}h3{width:100%;margin:4px 0}figure{margin:0;text-align:center}img{width:144px;height:144px;image-rendering:pixelated;background:#2f3440;display:block}figcaption{font-size:10px;color:#999}</style>' +
  linha('Referência (o coelho de hoje)', ['ref-coelho.png']) +
  linha('PixelLab, modo normal (estilo pela imagem)', da('pixellab-bitforge')) +
  linha('Retro Diffusion Plus (parte do desenho)', da('rd-plus')) +
  linha('Retro Diffusion Pro (coelho como referência)', da('rd-pro')) +
  linha('PixelLab Pro, "parado": as 16 variações de uma chamada', da('pixellab-pro'));

fs.writeFileSync(path.join(AQUI, 'folha.html'), html);
const { browser } = await abrirNavegador();
const page = await browser.newPage({ viewport: { width: 1300, height: 900 } });
await page.setContent(html);
await page.waitForTimeout(300);
await page.screenshot({ path: path.join(AQUI, 'folha.png'), fullPage: true });
await browser.close();
