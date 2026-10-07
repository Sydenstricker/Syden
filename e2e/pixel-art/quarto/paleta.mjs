// A paleta do quarto: aconchegante e de pouco estímulo. Poucas cores, quentes e pouco saturadas, sem preto
// nem branco puros. É imposta nas duas ferramentas (o Retro Diffusion recebe a imagem dela; a saída do
// PixelLab é posta nela aqui), e é o que mais segura a consistência entre peças geradas separadas.
//   node e2e/pixel-art/quarto/paleta.mjs   → paleta.json e paleta.png
import fs from 'node:fs';
import path from 'node:path';
import { abrir, fechar, gravar64 } from './imagem.mjs';

export const PALETA = {
  sombra: ['#2a2228', '#3a2d33', '#4a3442'],
  madeira: ['#5a3d2e', '#7a5236', '#9b6a43', '#bb8a5a', '#d6aa7a'],
  parede: ['#5c5266', '#7a6f82', '#9a8fa0', '#b9afbb', '#d5cdd2'],
  salvia: ['#3e4a3a', '#56664d', '#728563', '#93a57e'],
  ardosia: ['#2f3646', '#434d61', '#5d6a80', '#7d8aa0'],
  ambar: ['#c98a4b', '#e2ad68', '#f2cf93', '#f7e6c4'],
  coelho: ['#efe3d3', '#d79a9a', '#b9757e'],
};
export const CORES = Object.values(PALETA).flat();

if (process.argv[1]?.endsWith('paleta.mjs')) {
  const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
  fs.writeFileSync(path.join(AQUI, 'paleta.json'), JSON.stringify(PALETA, null, 2) + '\n');
  const p = await abrir();
  // Uma faixa de 1 px por cor: é o formato que o input_palette do Retro Diffusion lê.
  const b64 = await p.evaluate((cores) => {
    const c = document.createElement('canvas'); c.width = cores.length; c.height = 1;
    const g = c.getContext('2d'); cores.forEach((h, i) => { g.fillStyle = h; g.fillRect(i, 0, 1, 1); });
    return c.toDataURL('image/png').split(',')[1];
  }, CORES);
  gravar64(path.join(AQUI, 'paleta.png'), b64);
  console.log(CORES.length, 'cores');
  await fechar();
}
