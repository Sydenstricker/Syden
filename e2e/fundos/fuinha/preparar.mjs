// O FUNDO "FUINHA" EM PAPEL RECORTADO (13/11/2026): o cenário e as duas poses foram gerados por ele com IA, a partir do
// prompt que combinamos (cena de ponta a ponta, sem moldura e sem bicho; a fuinha à parte, esticada e arqueada). Este
// script prepara os dois para web/src/assets/fundos/, no Chrome dos testes (não há sharp nem Python nesta máquina):
//
// - o cenário vira WebP, como veio;
// - a fuinha veio com o XADREZ DESENHADO (a "transparência" do gerador é pintura: nenhum pixel transparente). Sai pelo
//   preenchimento a partir das bordas, só por pixel cinza NEUTRO e claro (a fuinha é marrom e creme, saturada; o olho
//   escuro fica protegido dentro do contorno), com a sombra de papel junto. As duas poses são separadas pela coluna vazia
//   do meio, ficam na MESMA escala e no mesmo quadro, alinhadas pela cabeça (à direita) e pelo chão: a troca de pose
//   na corrida não pula.
//
//   node e2e/fundos/fuinha/preparar.mjs
import fs from 'node:fs';
import path from 'node:path';
import { abrirNavegador } from '../../ajuda.mjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1');
const SAIDA = path.join(AQUI, '..', '..', '..', 'web', 'src', 'assets', 'fundos');
const dataUrl = (f) => 'data:image/png;base64,' + fs.readFileSync(path.join(AQUI, f)).toString('base64');

const { browser } = await abrirNavegador();
try {
  const p = await (await browser.newContext()).newPage();
  const r = await p.evaluate(async ({ cenario, fuinha }) => {
    const carregar = (src) => new Promise((ok, erro) => { const i = new Image(); i.onload = () => ok(i); i.onerror = erro; i.src = src; });
    const tela = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
    const webp = (c, q) => c.toDataURL('image/webp', q);

    // o cenário
    const ic = await carregar(cenario);
    const [cc, gc] = tela(ic.width, ic.height);
    gc.drawImage(ic, 0, 0);

    // a fuinha: tira o xadrez
    const im = await carregar(fuinha), W = im.width, H = im.height;
    const [c, g] = tela(W, H);
    g.drawImage(im, 0, 0);
    const d = g.getImageData(0, 0, W, H), px = d.data;
    const neutro = (k) => { const r = px[k], gg = px[k + 1], b = px[k + 2]; return Math.max(r, gg, b) - Math.min(r, gg, b) < 20 && (r + gg + b) / 3 > 120; };
    const fora = new Uint8Array(W * H), fila = [];
    const tentar = (x, y) => { const i = y * W + x; if (!fora[i] && neutro(i * 4)) { fora[i] = 1; fila.push(i); } };
    for (let x = 0; x < W; x++) { tentar(x, 0); tentar(x, H - 1); }
    for (let y = 0; y < H; y++) { tentar(0, y); tentar(W - 1, y); }
    while (fila.length) {
      const i = fila.pop(), x = i % W, y = (i / W) | 0;
      if (x > 0) tentar(x - 1, y); if (x < W - 1) tentar(x + 1, y); if (y > 0) tentar(x, y - 1); if (y < H - 1) tentar(x, y + 1);
    }
    // o xadrez PRESO dentro da fuinha (entre a barriga e as patas da arqueada), que o preenchimento das bordas não alcança:
    // todo bloco cinza neutro e claro de mais de 40 pixels, onde estiver (o creme da barriga é quente, não é neutro)
    {
      const visto = new Uint8Array(W * H);
      for (let i0 = 0; i0 < W * H; i0++) {
        if (visto[i0] || fora[i0] || !neutro(i0 * 4)) continue;
        const m = [i0]; visto[i0] = 1;
        for (let q = 0; q < m.length; q++) {
          const i = m[q], x = i % W, y = (i / W) | 0;
          for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1]) if (j >= 0 && !visto[j] && !fora[j] && neutro(j * 4)) { visto[j] = 1; m.push(j); }
        }
        if (m.length > 40) for (const i of m) fora[i] = 1;
      }
    }
    // o CONTORNO cinza (a sombra do papel misturada ao xadrez): descasca, por até 5 pixels, a borda pouco saturada
    const poucoSaturado = (k) => Math.max(px[k], px[k + 1], px[k + 2]) - Math.min(px[k], px[k + 1], px[k + 2]) < 45;
    for (let volta = 0; volta < 5; volta++) {
      const tirar = [];
      for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
        const i = y * W + x;
        if (!fora[i] && poucoSaturado(i * 4) && (fora[i - 1] || fora[i + 1] || fora[i - W] || fora[i + W])) tirar.push(i);
      }
      if (!tirar.length) break;
      for (const i of tirar) fora[i] = 1;
    }
    for (let i = 0; i < W * H; i++) if (fora[i]) px[i * 4 + 3] = 0;
    // a borda que sobrou do xadrez (o pixel misturado entre a fuinha e o cinza): meio transparente, para não ficar serrilhada
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const i = y * W + x; if (fora[i]) continue;
      const vizinhos = fora[i - 1] + fora[i + 1] + fora[i - W] + fora[i + W];
      if (vizinhos >= 2) px[i * 4 + 3] = 140;
    }
    // os pedacinhos soltos (resto de sombra): o que não liga a uma mancha grande sai
    const visto = new Uint8Array(W * H), manchas = [];
    for (let i0 = 0; i0 < W * H; i0++) {
      if (visto[i0] || px[i0 * 4 + 3] === 0) continue;
      const m = [i0]; visto[i0] = 1;
      for (let q = 0; q < m.length; q++) {
        const i = m[q], x = i % W, y = (i / W) | 0;
        for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1]) if (j >= 0 && !visto[j] && px[j * 4 + 3]) { visto[j] = 1; m.push(j); }
      }
      manchas.push(m);
    }
    manchas.sort((a, b) => b.length - a.length);
    const poses = manchas.slice(0, 2);
    for (const m of manchas.slice(2)) for (const i of m) px[i * 4 + 3] = 0;
    g.putImageData(d, 0, 0);
    // as caixas das duas poses (a da esquerda é a esticada)
    const caixas = poses.map((m) => { let x0 = W, y0 = H, x1 = 0, y1 = 0; for (const i of m) { const x = i % W, y = (i / W) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } return { x0, y0, x1: x1 + 1, y1: y1 + 1, n: m.length }; }).sort((a, b) => a.x0 - b.x0);
    const LARGURA = 400, mw = Math.max(...caixas.map((b) => b.x1 - b.x0)), mh = Math.max(...caixas.map((b) => b.y1 - b.y0));
    const s = LARGURA / mw, QW = LARGURA, QH = Math.round(mh * s);
    const quadros = caixas.map((b) => {
      const [q, gq] = tela(QW, QH);
      const w = (b.x1 - b.x0) * s, h = (b.y1 - b.y0) * s;
      gq.imageSmoothingQuality = 'high';
      gq.drawImage(c, b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0, QW - w, QH - h, w, h); // pela cabeça (direita) e pelo chão
      return webp(q, 0.9);
    });
    return { cenario: webp(cc, 0.86), quadros, QW, QH, caixas, tamCenario: [ic.width, ic.height] };
  }, { cenario: dataUrl('cenario-original.png'), fuinha: dataUrl('fuinha-original.png') });

  const gravar = (nome, url) => { const b = Buffer.from(url.split(',')[1], 'base64'); fs.writeFileSync(path.join(SAIDA, nome), b); console.log(nome, Math.round(b.length / 1024) + ' KB'); };
  gravar('fuinha-cenario.webp', r.cenario);
  gravar('fuinha-1.webp', r.quadros[0]);
  gravar('fuinha-2.webp', r.quadros[1]);
  console.log('cenário', r.tamCenario.join('×'), '| quadro da fuinha', r.QW + '×' + r.QH, '(aspect-ratio no CSS) | poses', JSON.stringify(r.caixas));
} finally {
  await browser.close();
}
