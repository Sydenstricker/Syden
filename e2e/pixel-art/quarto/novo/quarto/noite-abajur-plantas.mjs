// A LUZ DO ABAJUR PINTADA NAS PLANTAS EM L E NO CUBÍCULO (09/11/2026, a dívida de arte de 06/11: "a noite com a luz do
// abajur PINTADA nas plantas em L e no cubículo; lá a luz é a por código, com as faixas"). O mesmo método de
// noite-abajur.mjs, na casca noturna da planta (janelas/sem-janela-noite-<planta>.png), com o criado-mudo posto onde a
// arrumação de fábrica da planta o põe (INICIAIS em montar.mjs) e FORA da máscara. Depois, o criado-mudo sai da pintura
// (preenchido com a luz em volta, de fora para dentro, como noiteAbajurSemMovel faz com o do quarto de sempre), e a
// página o desenha por cima como sempre.
//   node e2e/pixel-art/quarto/novo/quarto/noite-abajur-plantas.mjs [l] [cubiculo]
//     → janelas/sem-janela-noite-abajur-<planta>.png e janelas/noite-abajur-plantas.json (a caixa repintada e o lugar do abajur)
//   depois: py janelas/noite-abajur-plantas.py   (tira o criado-mudo da pintura sem apagar o rodapé; ver lá)
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { abrir, fechar, ler64, gravar64 } from '../../imagem.mjs';
import { pintar } from './pintar.mjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const J = path.join(AQUI, 'janelas');
const PLANTAS = process.argv.slice(2).length ? process.argv.slice(2) : ['l', 'cubiculo'];
const META = path.join(J, 'noite-abajur-plantas.json');
const meta = fs.existsSync(META) ? JSON.parse(fs.readFileSync(META, 'utf8')) : {};
// A página montada numa pasta temporária, para achar o criado-mudo na planta (onde e com que forma ele é desenhado).
const pagina = path.join(os.tmpdir(), 'syden-noite-abajur-plantas.html');
execFileSync(process.execPath, [path.join(AQUI, 'montar.mjs')], { env: { ...process.env, SAIDA_DA_PAGINA: pagina }, stdio: 'ignore' });
const p = await abrir();
await p.addInitScript(() => { try { localStorage.clear(); } catch { /* */ } });
await p.goto('file:///' + pagina.replaceAll('\\', '/'));
await p.waitForFunction(() => window.coelhoDoTeste && document.getElementById('tela')?.width > 0, null, { timeout: 90000 });
await p.waitForTimeout(1500);
await p.evaluate(() => { window.congelarDoTeste = true; });
for (const planta of PLANTAS) {
  const destino = path.join(J, `sem-janela-noite-abajur-${planta}.png`);
  if (fs.existsSync(destino)) { console.log('já existe:', destino); continue; }
  await p.evaluate((pl) => window.plantaDoTeste(pl), planta); await p.waitForTimeout(1000);
  await p.click('#dia'); await p.waitForTimeout(1200);
  // o criado-mudo: o que muda na tela quando ele sai do lugar, dentro da caixa dele
  const { caixa, abajur, forma, cor } = await p.evaluate(async () => {
    const tela = () => { const c = document.getElementById('tela'); return c.getContext('2d').getImageData(0, 0, c.width, c.height).data; };
    const caixa = window.caixaDoMovelDoTeste('abajur'), A = tela(), ARR = window.arrumacaoDoTeste(), abajur = JSON.parse(JSON.stringify(ARR.abajur));
    ARR.abajur.c = [-20, -20]; document.getElementById('dia').click(); await new Promise((r) => setTimeout(r, 1200));
    const B = tela(); ARR.abajur.c = abajur.c; document.getElementById('dia').click(); await new Promise((r) => setTimeout(r, 800));
    const f = document.createElement('canvas'); f.width = f.height = 512; const gf = f.getContext('2d'); const df = gf.createImageData(512, 512);
    const c = document.createElement('canvas'); c.width = c.height = 512; const gc = c.getContext('2d'); const dc = gc.createImageData(512, 512);
    for (let y = caixa[1]; y < caixa[3]; y++) for (let x = caixa[0]; x < caixa[2]; x++) {
      const k = (y * 512 + x) * 4;
      if (Math.abs(A[k] - B[k]) + Math.abs(A[k + 1] - B[k + 1]) + Math.abs(A[k + 2] - B[k + 2]) < 6) continue;
      df.data[k + 3] = 255; for (let q = 0; q < 3; q++) dc.data[k + q] = A[k + q]; dc.data[k + 3] = 255;
    }
    gf.putImageData(df, 0, 0); gc.putImageData(dc, 0, 0);
    return { caixa, abajur, forma: f.toDataURL('image/png').split(',')[1], cor: c.toDataURL('image/png').split(',')[1] };
  });
  // a partida: a noite da planta com o criado-mudo de dia escurecido (como noite-abajur.mjs)
  const partida = await p.evaluate(async ({ noite, movel }) => {
    const carregar = async (b) => { const im = new Image(); im.src = 'data:image/png;base64,' + b; await im.decode(); return im; };
    const c = document.createElement('canvas'); c.width = 512; c.height = 512; const g = c.getContext('2d');
    g.drawImage(await carregar(noite), 0, 0); g.filter = 'brightness(0.5)'; g.drawImage(await carregar(movel), 0, 0);
    return c.toDataURL('image/png').split(',')[1];
  }, { noite: ler64(path.join(J, `sem-janela-noite-${planta}.png`)), movel: cor });
  // a caixa: a do quarto de sempre (132 × 192 em volta de um criado-mudo de 48 × 85), centrada no criado-mudo daqui
  const cx = Math.round((caixa[0] + caixa[2]) / 2), cy = Math.round((caixa[1] + caixa[3]) / 2);
  const C = [Math.max(0, cx - 66), Math.max(0, cy - 107), Math.min(512, cx + 66), Math.min(512, cy + 85)];
  fs.mkdirSync(path.join(J, 'noite-abajur-plantas'), { recursive: true });
  gravar64(path.join(J, 'noite-abajur-plantas', `${planta}-partida.png`), partida);
  const pintada = await pintar(partida, {
    caixa: C, poligonos: [[[C[0], C[1]], [C[2], C[1]], [C[2], C[3]], [C[0], C[3]]]],
    texto: 'the same small wooden nightstand with its table lamp TURNED ON at night: the lampshade glows warm orange, soft warm lamplight falls on the nearby walls and on the floor around the nightstand, fading smoothly into the dark night room, isometric pixel art matching the room exactly, same outline and palette',
  }, forma);
  // o criado-mudo sai: a forma dele (e 4 px em volta, o contorno e o brilho da cúpula) vira a luz em volta
  const limpa = await p.evaluate(async ({ img, forma }) => {
    const carregar = async (b) => { const im = new Image(); im.src = 'data:image/png;base64,' + b; await im.decode(); return im; };
    const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d');
    g.drawImage(await carregar(forma), 0, 0); const F = g.getImageData(0, 0, 512, 512).data;
    g.clearRect(0, 0, 512, 512); g.drawImage(await carregar(img), 0, 0); const d = g.getImageData(0, 0, 512, 512); const I = d.data, W = 512;
    const falta = new Uint8Array(W * W); for (let k = 0; k < W * W; k++) if (F[k * 4 + 3]) falta[k] = 1;
    for (let volta = 0; volta < 4; volta++) { const b = []; for (let k = W; k < W * W - W; k++) if (!falta[k] && (falta[k - 1] || falta[k + 1] || falta[k - W] || falta[k + W])) b.push(k); for (const k of b) falta[k] = 1; }
    for (let passada = 0; passada < 120; passada++) {
      const agora = [];
      for (let k = W; k < W * W - W; k++) { if (!falta[k]) continue; let n = 0; const s = [0, 0, 0]; for (const v of [k - 1, k + 1, k - W, k + W]) if (!falta[v]) { n++; for (let q = 0; q < 3; q++) s[q] += I[v * 4 + q]; } if (n) agora.push([k, s.map((x) => x / n)]); }
      if (!agora.length) break;
      for (const [k, s] of agora) { for (let q = 0; q < 3; q++) I[k * 4 + q] = s[q]; falta[k] = 0; }
    }
    g.putImageData(d, 0, 0); return c.toDataURL('image/png').split(',')[1];
  }, { img: pintada, forma });
  gravar64(destino, limpa);
  gravar64(path.join(J, 'noite-abajur-plantas', `${planta}-pintada.png`), pintada);
  meta[planta] = { caixa: C, abajur };
  fs.writeFileSync(META, JSON.stringify(meta));
  console.log(planta, 'caixa', C, 'abajur', JSON.stringify(abajur));
}
await fechar();
