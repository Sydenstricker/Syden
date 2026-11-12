// A CABEÇA OSCILANDO, MONTADA (11/11/2026, aprovada por ele na vista sudeste depois de várias rodadas quadro a quadro). Cada vista
// diagonal do quarto oscila pelas duas vistas VIZINHAS (a sudeste vai da sul à leste, 45° para cada lado): 7 posições de cabeça, a
// vizinha, os 2 quadros do meio do PixelLab (ventilador-entre-vistas.mjs), a própria vista, mais 2 do meio e a outra vizinha, e
// volta. Cada cabeça é colada sobre a haste e a base PARADAS da vista do quarto:
//   - alinhada pelo EIXO (o meio da haste logo abaixo da cabeça) e pela linha do corte (onde a largura cai abaixo de 16 px);
//   - nas duas linhas abaixo do corte, só a haste (o resto é o fim do aro da vista parada, que ficava como um risco no pescoço);
//   - a haste à vista ACIMA do corte vem da base, sempre da mesma largura (de lado, a da cabeça tinha 5 px e a da base 6).
// As vistas e os quadros do meio vêm já limpos (ventilador-giros-limpos/ e ventilador-entre/, com os originais guardados ao lado):
// a haste atrás da grade apagada, a espessura preta do aro por dentro afinada, o motor que espiava pela grade quase de frente tirado,
// e a frente branca da grade de lado virada arame. A hélice girando é posta depois, por ventilador-quadros.mjs.
//
//   node e2e/pixel-art/quarto/novo/quarto/ventilador-oscilacao.mjs [direção...]
//   → avulsos/ventilador-oscilar/<direção>-<n>.png (12 quadros: ida e volta), lidos por ventilador-quadros.mjs
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const VISTAS = path.join(AQUI, 'avulsos', 'ventilador-giros-limpos');
const ENTRE = path.join(AQUI, 'avulsos', 'ventilador-entre');
const SAIDA = path.join(AQUI, 'avulsos', 'ventilador-oscilar');
const W = 170;

// as vizinhas de cada vista do quarto, na ordem da oscilação
export const VIZINHAS = {
  'south-east': ['south', 'east'],
  'south-west': ['south', 'west'],
  'north-east': ['north', 'east'],
  'north-west': ['north', 'west'],
};

const ler = (f) => PNG.sync.read(fs.readFileSync(f));
const larg = (im, y) => { let l = W, r = -1; for (let x = 0; x < W; x++) if (im.data[(y * W + x) * 4 + 3]) { l = Math.min(l, x); r = Math.max(r, x); } return r >= l ? [l, r] : null; };
export function corte(im) {
  let y0 = 0; while (y0 < W && !larg(im, y0)) y0++;
  let y = y0 + 20; while (y < W) { const l = larg(im, y); if (!l || l[1] - l[0] + 1 < 16) break; y++; }
  // A HASTE logo abaixo do corte: a linha mais estreita (até 8 px) das 6 primeiras; mais abaixo vem o ENCAIXE, mais largo e com
  // o botão de um lado ou do outro conforme a vista (medir nele errava o alinhamento em até 5 px, relato dele: "cabo desalinhado")
  let haste = null;
  for (let yy = y; yy < Math.min(W, y + 6); yy++) { const l = larg(im, yy); if (l && l[1] - l[0] + 1 <= 8 && (!haste || l[1] - l[0] < haste.r - haste.l)) haste = { l: l[0], r: l[1], y: yy }; }
  const ref = haste ? (haste.l + haste.r) / 2 : (() => { const l = larg(im, Math.min(W - 1, y + 6)); return (l[0] + l[1]) / 2; })();
  // A HASTE DA PRÓPRIA CABEÇA, acima do corte (de lado, ela desce do motor): as linhas em que, em volta do eixo, só há um trecho
  // estreito e solto. É ela que se tira da cabeça, e no lugar entra a haste da base.
  const op = (x, yy) => x >= 0 && x < W && im.data[(yy * W + x) * 4 + 3];
  // (pelo DESENHO da haste: um miolo claro de 1 a 6 px com um contorno escuro de cada lado; encostada no aro, os contornos se
  // tocam, e a regra de antes, "um trecho solto", não a via: no nordeste a haste da cabeça ficava ao lado da da base, relato dele)
  const deCima = [], md = (x, yy) => { const i = (yy * W + x) * 4; return im.data[i + 3] ? (im.data[i] + im.data[i + 1] + im.data[i + 2]) / 3 : -1; };
  // (com cuidado para não confundir com uma vareta ou uma pá: começa colada no corte, cada linha continua a de baixo — o centro muda no
  // máximo 1 px e a largura 2 —, e, havendo haste abaixo do corte, a de cima fica a até 2 px do centro dela; no máximo 16 linhas)
  const naLinha = (yy, cx, lMin) => {
    for (const dd of [0, -1, 1, -2, 2, -3, 3]) {
      const x0 = Math.round(cx) + dd; if (md(x0, yy) < 100) continue;
      let l = x0, r = x0; while (md(l - 1, yy) >= 100 && x0 - l < 6) l--; while (md(r + 1, yy) >= 100 && r - x0 < 6) r++;
      const w = r - l + 1; if (w < 2 || w > 6) continue;
      const el = md(l - 1, yy), er = md(r + 1, yy);
      if (el < 0 || el >= 110 || er < 0 || er >= 110) continue;
      return { y: yy, l: l - 1, r: r + 1 };
    }
    return null;
  };
  for (const inicio of [y - 1, y - 2]) {
    let h0 = naLinha(inicio, ref);
    if (!h0 || (haste && Math.abs((h0.l + h0.r) / 2 - ref) > 2)) continue;
    deCima.push(h0);
    for (let yy = inicio - 1; yy > y0 && deCima.length < 16; yy--) {
      const ant = deCima[deCima.length - 1], hx = naLinha(yy, (ant.l + ant.r) / 2);
      if (!hx || Math.abs((hx.l + hx.r) / 2 - (ant.l + ant.r) / 2) > 1 || Math.abs((hx.r - hx.l) - (ant.r - ant.l)) > 2) break;
      deCima.push(hx);
    }
    break;
  }
  if (deCima.length < 3) deCima.length = 0; // (1 ou 2 linhas no corte, de frente, são a junção do aro com a haste, não a haste)
  const eixo = deCima.length >= 2 ? deCima.reduce((s, h) => s + (h.l + h.r) / 2, 0) / deCima.length : ref;
  return { fim: y, eixo, haste, deCima };
}

/** As 7 cabeças, da vizinha A à vizinha B, passando pela vista. */
export function sequencia(vista) {
  const [a, b] = VIZINHAS[vista];
  return [
    path.join(VISTAS, a + '.png'),
    path.join(ENTRE, `${a}__${vista}-0.png`), path.join(ENTRE, `${a}__${vista}-1.png`),
    path.join(VISTAS, vista + '.png'),
    path.join(ENTRE, `${vista}__${b}-0.png`), path.join(ENTRE, `${vista}__${b}-1.png`),
    path.join(VISTAS, b + '.png'),
  ];
}

/** A cabeça de `arquivo` sobre a haste e a base da vista parada. */
export function colar(arquivo, base) {
  const cb = corte(base), h = ler(arquivo), ch = corte(h), out = new PNG({ width: W, height: W });
  const dx = Math.round(cb.eixo - ch.eixo), dy = cb.fim - ch.fim;
  // a haste da base: a linha mais estreita (a haste de verdade, não o encaixe) é o padrão de toda a haste acima dela
  const hb = cb.haste ?? { l: Math.round(cb.eixo) - 2, r: Math.round(cb.eixo) + 2, y: cb.fim + 1 };
  for (let y = cb.fim; y < W; y++) for (let x = 0; x < W; x++) {
    if (y < hb.y && (x < hb.l || x > hb.r)) continue; // (entre o corte e a haste, só a haste: o resto é o fim do aro da vista parada)
    const yy = y < hb.y ? hb.y : y; // (e com o desenho da haste de verdade)
    base.data.copy(out.data, (y * W + x) * 4, (yy * W + x) * 4, (yy * W + x) * 4 + 4);
  }
  const daHaste = new Set(ch.deCima.flatMap(({ y, l, r }) => Array.from({ length: r - l + 1 }, (_, i) => y * W + l + i)));
  for (let y = 0; y < ch.fim; y++) for (let x = 0; x < W; x++) {
    const k = (y * W + x) * 4; if (!h.data[k + 3] || daHaste.has(y * W + x)) continue;
    const X = x + dx, Y = y + dy; if (X < 0 || X >= W || Y < 0 || Y >= W) continue;
    h.data.copy(out.data, (Y * W + X) * 4, k, k + 4);
  }
  // no lugar da haste da cabeça, a haste da base, na coluna dela, até o motor (só onde a cabeça não desenhou nada)
  if (ch.deCima.length) {
    const topo = Math.min(...ch.deCima.map((d) => d.y)) + dy;
    for (let y = Math.max(0, topo); y < cb.fim; y++) for (let x = hb.l; x <= hb.r; x++) {
      const k = (y * W + x) * 4; if (out.data[k + 3]) continue;
      base.data.copy(out.data, k, (hb.y * W + x) * 4, (hb.y * W + x) * 4 + 4);
    }
  }
  // O PÉ DO ARO ABAIXO DO CORTE (relato dele na sudoeste, P5: "essa parte de baixo foi comida"): com o aro inclinado, o fundo dele
  // desce além da linha do corte. Entra o que CONTINUA o aro (ligado à cabeça logo acima do corte, fora da haste); o encaixe da
  // vista vizinha, também fora da haste, virava um filete com ruído no pescoço.
  const hh = ch.haste ? [ch.haste.l, ch.haste.r] : [Math.round(ch.eixo) - 3, Math.round(ch.eixo) + 3];
  const foraDaHaste = (x) => x < hh[0] - 1 || x > hh[1] + 1, op = (x, y) => x >= 0 && x < W && y >= 0 && y < W && h.data[(y * W + x) * 4 + 3];
  const ligado = new Uint8Array(W * W);
  for (let x = 0; x < W; x++) if (foraDaHaste(x) && op(x, ch.fim - 1) && !daHaste.has((ch.fim - 1) * W + x)) ligado[(ch.fim - 1) * W + x] = 1;
  for (let y = ch.fim; y < Math.min(W, ch.fim + 12); y++) for (let x = 0; x < W; x++) {
    if (!foraDaHaste(x) || !op(x, y)) continue;
    let viz = false; for (let a = -1; a <= 1; a++) if (ligado[(y - 1) * W + x + a] || (a < 0 && ligado[y * W + x + a])) viz = true;
    if (!viz) continue;
    ligado[y * W + x] = 1;
    const X = x + dx, Y = y + dy; if (X < 0 || X >= W || Y < 0 || Y >= W) continue;
    if (out.data[(Y * W + X) * 4 + 3]) continue;
    h.data.copy(out.data, (Y * W + X) * 4, (y * W + x) * 4, (y * W + x) * 4 + 4);
  }
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'))) {
  fs.mkdirSync(SAIDA, { recursive: true });
  const pedidas = process.argv.slice(2);
  for (const vista of pedidas.length ? pedidas : Object.keys(VIZINHAS)) {
    const seq = sequencia(vista);
    const falta = seq.filter((f) => !fs.existsSync(f));
    if (falta.length) { console.log(vista, 'pulada: faltam', falta.map((f) => path.basename(f)).join(', ')); continue; }
    const base = ler(path.join(VISTAS, vista + '.png'));
    const ida = [...seq, ...seq.slice(1, -1).reverse()];
    for (const f of fs.readdirSync(SAIDA)) if (f.startsWith(vista + '-')) fs.rmSync(path.join(SAIDA, f));
    ida.forEach((f, n) => fs.writeFileSync(path.join(SAIDA, `${vista}-${n}.png`), PNG.sync.write(colar(f, base))));
    console.log(vista, ida.length, 'quadros');
  }
}
