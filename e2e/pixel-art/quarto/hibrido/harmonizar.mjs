// A pintura de dia saiu de uma edição do quarto inteiro, e a edição "acendeu" a cor de alguns quadros: o rosa
// da cortiça e o laranja do quadro de paisagem estouravam ao trocar de noite para dia (medido: 13 e 18% dos
// pixels deles saltavam de saturação). Dentro da máscara desses objetos, SÓ os pixels que estouram (saturação
// de dia acima de 0,55 e 0,25 acima da noite) perdem saturação, até 0,12 acima da noite; matiz e brilho ficam
// os do dia. A primeira versão trazia também o matiz da noite, e o quadro inteiro ficou arroxeado.
// Grava dia.png corrigido (o original fica em dia-bruto.png) e corrige também grade/dia-sem-pufe.png.
//   node e2e/pixel-art/quarto/hibrido/harmonizar.mjs
import fs from 'node:fs';
import path from 'node:path';
import { abrir, fechar, ler64, gravar64 } from '../imagem.mjs';
import { OBJETOS } from './objetos.mjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
// A janela também salta, mas é o céu: azul de dia é o certo.
const ESTOURAM = ['quadro', 'cortica'];

const bruto = path.join(AQUI, 'dia-bruto.png');
if (!fs.existsSync(bruto)) fs.copyFileSync(path.join(AQUI, 'dia.png'), bruto);
const p = await abrir();
const corrigir = (diaB64) =>
  p.evaluate(async ({ dia, noite, objs }) => {
    const ler = async (b) => { const im = new Image(); im.src = 'data:image/png;base64,' + b; await im.decode(); const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0); return [c, g, g.getImageData(0, 0, c.width, c.height)]; };
    const paraHsl = (r, g, b) => {
      r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
      if (mx === mn) return [0, 0, l];
      const d = mx - mn, s = d / (1 - Math.abs(2 * l - 1));
      const h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
      return [h * 60, s, l];
    };
    const deHsl = (h, s, l) => {
      const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
      const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
      return [r, g, b].map((v) => Math.round((v + m) * 255));
    };
    const [cd, gd, D] = await ler(dia); const [, , N] = await ler(noite);
    for (const o of objs) {
      const [, , M] = await ler(o.mask); const [x0, y0] = o.caixa;
      for (let y = 0; y < M.height; y++) for (let x = 0; x < M.width; x++) {
        if (M.data[(y * M.width + x) * 4 + 3] < 128) continue;
        const i = ((y0 + y) * D.width + (x0 + x)) * 4;
        const [, sn] = paraHsl(N.data[i], N.data[i + 1], N.data[i + 2]);
        const [hd, sd, ld] = paraHsl(D.data[i], D.data[i + 1], D.data[i + 2]);
        if (sd > 0.55 && sd - sn > 0.25) [D.data[i], D.data[i + 1], D.data[i + 2]] = deHsl(hd, sn + 0.12, ld);
      }
    }
    gd.putImageData(D, 0, 0);
    return cd.toDataURL('image/png').split(',')[1];
  }, { dia: diaB64, noite: ler64(path.join(AQUI, 'noite.png')), objs: OBJETOS.filter((o) => ESTOURAM.includes(o.id)).map((o) => ({ caixa: o.caixa, mask: ler64(path.join(AQUI, 'mascaras', o.id + '.png')) })) });

gravar64(path.join(AQUI, 'dia.png'), await corrigir(ler64(bruto)));
const grade = path.join(AQUI, 'grade', 'dia-sem-pufe.png');
const gradeBruto = path.join(AQUI, 'grade', 'dia-sem-pufe-bruto.png');
if (!fs.existsSync(gradeBruto)) fs.copyFileSync(grade, gradeBruto);
gravar64(grade, await corrigir(ler64(gradeBruto)));
console.log('dia.png e grade/dia-sem-pufe.png harmonizados:', ESTOURAM.join(', '));
await fechar();
