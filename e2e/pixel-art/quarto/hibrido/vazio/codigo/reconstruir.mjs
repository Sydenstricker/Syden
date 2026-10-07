// O quarto vazio reconstruído por CÓDIGO a partir da própria pintura (a edição do PixelLab redesenhou o quarto
// e perdeu a mão; ver ../README.md). Nada é inventado por IA:
//   - fica intacto o que não é parede nem chão: o friso, a moldura de fora e a janela com as cortinas;
//   - PAREDE: onde havia móvel, a cor da parede limpa em volta, misturada de perto e de longe (o degradê da luz
//     continua por trás dos móveis);
//   - CHÃO: as tábuas são DESENHADAS, no sentido do piso, com a emenda de 1 pixel onde uma tábua encontra a
//     outra e as pontas desencontradas, e pintadas com a cor e a luz da madeira medidas no chão visível. Copiar
//     as tábuas da pintura trazia junto pedaços do tapete e das rodinhas da cadeira.
//   node e2e/pixel-art/quarto/hibrido/vazio/codigo/reconstruir.mjs   → noite.png e dia.png
import path from 'node:path';
import { abrir, fechar, ler64, gravar64 } from '../../../imagem.mjs';
import { OBJETOS } from '../../objetos.mjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const HIB = path.join(AQUI, '..', '..');

// A geometria, medida em cantos.png e regua.png (pixels do quarto). O canto de trás do chão fica escondido
// atrás da cama, e a pintura não é isometria exata (as paredes têm alturas um pouco diferentes): ele é uma
// estimativa entre o que as duas paredes sugerem.
export const GEOMETRIA = {
  topoFundo: [146, 15], // onde as duas paredes se encontram, embaixo do friso
  topoEsquerda: [17, 84],
  topoDireita: [296, 92],
  chao: { fundo: [146, 133], esquerda: [17, 223], frente: [157, 300], direita: [297, 220] },
};
// As tábuas: quantas cabem na largura de uma casa da grade 8×8, e o comprimento de cada uma, em casas.
export const TABUAS = { porCasa: 3, comprimento: [1.5, 3.2] };

// O que é móvel, quadro ou planta: caixas em volta de cada coisa (pixels do quarto, lidas em regua.png). Tudo
// dentro delas é refeito; fora delas, parede e chão são de verdade. Adivinhar pela cor não funcionou: de noite
// as plantas e sombras passavam por parede, e de dia o tapete verde passava por chão.
export const MOVEIS = {
  cama: [62, 93, 196, 211], criado: [24, 128, 84, 202], mesinha: [19, 182, 86, 244], escrivaninha: [191, 114, 298, 222],
  estantinha: [256, 209, 280, 244], tapete: [82, 186, 249, 281], quadrinhos: [109, 70, 145, 107],
  prateleiraDireita: [258, 84, 299, 132], bandeirinha: [246, 110, 263, 121],
  ...Object.fromEntries(OBJETOS.filter((o) => o.id !== 'janela').map((o) => [o.id, o.caixa])),
};
const janela = OBJETOS.find((o) => o.id === 'janela');

const p = await abrir();
for (const nome of ['noite', 'dia']) {
  const b64 = await p.evaluate(async ({ cena, mascaraJanela, caixaJanela, G, moveis, T }) => {
    const ler = async (b) => { const im = new Image(); im.src = 'data:image/png;base64,' + b; await im.decode(); const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0); return [c, g, g.getImageData(0, 0, c.width, c.height)]; };
    const [canvas, g, img] = await ler(cena);
    const [, , mj] = await ler(mascaraJanela);
    const W = img.width, H = img.height, a = img.data;
    const dentro = (px, py, q) => { let s = false; for (let i = 0, j = q.length - 1; i < q.length; j = i++) { const [xi, yi] = q[i], [xj, yj] = q[j]; if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) s = !s; } return s; };
    const C = G.chao;
    const PE = [G.topoEsquerda, G.topoFundo, C.fundo, C.esquerda];
    const PD = [G.topoFundo, G.topoDireita, C.direita, C.fundo];
    const CH = [C.fundo, C.esquerda, C.frente, C.direita];
    // 0: mantém; 1: parede esquerda; 2: parede direita; 3: chão.
    const zona = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const cx = x + 0.5, cy = y + 0.5;
      zona[y * W + x] = dentro(cx, cy, CH) ? 3 : dentro(cx, cy, PE) ? 1 : dentro(cx, cy, PD) ? 2 : 0;
    }
    // A janela fica como está (com 1 px de folga em volta da máscara).
    const [jx, jy] = caixaJanela;
    for (let y = 0; y < mj.height; y++) for (let x = 0; x < mj.width; x++) {
      let tem = false;
      for (let dy = -1; dy <= 1 && !tem; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < mj.width && yy < mj.height && mj.data[(yy * mj.width + xx) * 4 + 3] > 127) { tem = true; break; } }
      if (tem) zona[(jy + y) * W + (jx + x)] = 0;
    }
    // Limpo: parede ou chão fora de todas as caixas de móveis (com 3 px de folga: a borda deles tem sombra). No
    // chão, só o que tem cor de madeira (vermelho > verde > azul, sem o verde do tapete).
    const limpo = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) limpo[i] = zona[i] ? 1 : 0;
    for (const [x0, y0, x1, y1] of moveis) for (let y = Math.max(0, y0 - 3); y < Math.min(H, y1 + 3); y++) for (let x = Math.max(0, x0 - 3); x < Math.min(W, x1 + 3); x++) limpo[y * W + x] = 0;
    for (let i = 0; i < W * H; i++) if (zona[i] === 3 && limpo[i]) { const r = a[i * 4], gg = a[i * 4 + 1], b = a[i * 4 + 2]; if (!(r > gg && gg >= b * 0.9 && r - b > 25)) limpo[i] = 0; }

    // Média ponderada contínua (convolução normalizada, gaussiana separável): de perto (σ pequeno) e de longe
    // (σ grande), misturadas pelo peso, e uma terceira do tamanho do quarto, para cantos onde não há parede limpa
    // por perto (o pé da parede direita: mesa, armarinho, prateleira e fone cobriam tudo, e saía preto). Sem
    // limiar, para não fazer faixas de curva de nível.
    function borrar(src, s) {
      const r = Math.ceil(3 * s), k = []; for (let d = -r; d <= r; d++) k.push(Math.exp(-(d * d) / (2 * s * s)));
      const tmp = new Float32Array(W * H), out = new Float32Array(W * H);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let v = 0; for (let d = -r; d <= r; d++) { const xx = x + d; if (xx >= 0 && xx < W) v += src[y * W + xx] * k[d + r]; } tmp[y * W + x] = v; }
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let v = 0; for (let d = -r; d <= r; d++) { const yy = y + d; if (yy >= 0 && yy < H) v += tmp[yy * W + x] * k[d + r]; } out[y * W + x] = v; }
      return out;
    }
    function campo(z, perto, longe) {
      const peso = new Float32Array(W * H); for (let i = 0; i < W * H; i++) peso[i] = zona[i] === z && limpo[i] ? 1 : 0;
      const wp = borrar(peso, perto), wl = borrar(peso, longe), wg = borrar(peso, 110);
      return [0, 1, 2].map((k) => {
        const v = new Float32Array(W * H); for (let i = 0; i < W * H; i++) v[i] = peso[i] * a[i * 4 + k];
        const sp = borrar(v, perto), sl = borrar(v, longe), sg = borrar(v, 110), r = new Float32Array(W * H);
        for (let i = 0; i < W * H; i++) r[i] = (sp[i] + 0.04 * sl[i] + 0.002 * sg[i]) / (wp[i] + 0.04 * wl[i] + 0.002 * wg[i] + 1e-9);
        return r;
      });
    }
    const out = new Uint8ClampedArray(a);
    // PAREDES.
    for (const z of [1, 2]) {
      const f = campo(z, 6, 40);
      for (let i = 0; i < W * H; i++) if (zona[i] === z && !limpo[i]) for (let k = 0; k < 3; k++) out[i * 4 + k] = f[k][i];
    }
    // CHÃO. Cada pixel ganha a posição (u, v) na grade (a inversa da interpolação entre os quatro cantos).
    const fc = campo(3, 8, 45);
    function uv(px, py) {
      let u = 4, v = 4;
      for (let it = 0; it < 12; it++) {
        const s = u / 8, t = v / 8;
        const P = [0, 1].map((k) => C.fundo[k] * (1 - s) * (1 - t) + C.esquerda[k] * s * (1 - t) + C.direita[k] * (1 - s) * t + C.frente[k] * s * t);
        const du = [0, 1].map((k) => ((C.esquerda[k] - C.fundo[k]) * (1 - t) + (C.frente[k] - C.direita[k]) * t) / 8);
        const dv = [0, 1].map((k) => ((C.direita[k] - C.fundo[k]) * (1 - s) + (C.frente[k] - C.esquerda[k]) * s) / 8);
        const ex = px - P[0], ey = py - P[1], det = du[0] * dv[1] - du[1] * dv[0];
        u += (ex * dv[1] - ey * dv[0]) / det; v += (du[0] * ey - du[1] * ex) / det;
      }
      return [u, v];
    }
    // As tábuas correm no sentido de v (paralelas à borda da frente à direita). A fileira é a faixa em u; as
    // pontas caem em comprimentos sorteados por fileira (sorteio fixo, para o quarto sair sempre igual).
    const acaso = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
    const tabua = new Int32Array(W * H).fill(-1), tom = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) {
      if (zona[i] !== 3) continue;
      const [u, v] = uv((i % W) + 0.5, ((i / W) | 0) + 0.5);
      const fileira = Math.floor(u * T.porCasa);
      let inicio = -acaso(fileira) * T.comprimento[1], n = 0;
      for (;;) { const comp = T.comprimento[0] + acaso(fileira * 97 + n) * (T.comprimento[1] - T.comprimento[0]); if (v < inicio + comp || n > 50) break; inicio += comp; n++; }
      tabua[i] = fileira * 1000 + n;
      tom[i] = 0.95 + acaso(fileira * 31 + n * 7) * 0.08;
    }
    for (let i = 0; i < W * H; i++) {
      if (zona[i] !== 3) continue;
      const x = i % W, y = (i / W) | 0;
      // A emenda: o pixel cuja tábua é diferente da do vizinho à direita ou de baixo.
      const viz = [x + 1 < W ? tabua[i + 1] : -1, y + 1 < H ? tabua[i + W] : -1];
      const emenda = viz.some((t) => t !== -1 && t !== tabua[i]);
      const f = (emenda ? 0.86 : 1) * tom[i];
      for (let k = 0; k < 3; k++) out[i * 4 + k] = fc[k][i] * f;
    }
    g.putImageData(new ImageData(out, W, H), 0, 0);
    return canvas.toDataURL('image/png').split(',')[1];
  }, { cena: ler64(path.join(HIB, nome + '.png')), mascaraJanela: ler64(path.join(HIB, 'mascaras', 'janela.png')), caixaJanela: janela.caixa, G: GEOMETRIA, moveis: Object.values(MOVEIS), T: TABUAS });
  gravar64(path.join(AQUI, nome + '.png'), b64);
  console.log(nome, 'ok');
}
await fechar();
