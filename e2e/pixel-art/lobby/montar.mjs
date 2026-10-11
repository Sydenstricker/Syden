// A CENA do lobby do fim do site, montada (pedido de 10/10/2026: "os coelhos parecem colados numa camada à frente
// do cenário; em grande medida eles não se relacionam com os objetos").
//
// Eram três coisas, e as três se resolvem aqui, ao preparar a arte, e não no navegador:
//   1. A GRADE. Cada peça era ampliada pelo navegador a 0,55 do tamanho dela, então os pixels dos coelhos ficavam
//      menores que os do salão: duas resoluções na mesma imagem, que o olho lê como recorte colado. Aqui cada peça
//      é REDUZIDA à grade do salão (um pixel da peça = um pixel do salão), e o CSS só amplia tudo junto.
//   2. A LUZ. O creme era o mesmo no canto escuro e na frente da TV. Aqui cada pixel da peça é multiplicado pela
//      luz do salão naquele ponto (o salão borrado): roxo perto da TV, âmbar perto do balcão, escuro nos cantos.
//   3. O CONTATO. Ninguém tinha sombra, e nada passava na frente de ninguém. Aqui as sombras são pintadas no
//      chão do salão, quem está atrás do balcão fica atrás dele (o recorte da frente do balcão vai por cima), e a
//      ordem de desenho segue a profundidade (quem pisa mais embaixo, na tela, vai na frente).
//
// E as três animações do salão (pedido do mesmo dia): a TV e o fliperama tocam as faixas de telas/ (PixelLab,
// animadas a partir do próprio recorte do salão), e a janela tem estrelas piscando e uma estrela cadente, por
// código, só nos pixels que são céu (as cortinas e a planta ficam na frente).
//
// Lê pecas/ (as peças cruas: pecas.mjs e ../agradecendo/lobby.mjs) e telas/; escreve web/site/lobby/, o trecho
// marcado de web/site/site.css e o de web/site/index.html. Os dois trechos NÃO se editam à mão.
//
//   node e2e/pixel-art/lobby/montar.mjs
import fs from 'node:fs';
import path from 'node:path';
import { abrir, fechar, gravar64, ler64 } from '../quarto/imagem.mjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const RAIZ = path.join(AQUI, '..', '..', '..');
const SITE = path.join(RAIZ, 'web', 'site');
const DESTINO = path.join(SITE, 'lobby');
const PECAS = path.join(AQUI, 'pecas');
const TELAS = path.join(AQUI, 'telas');
const [LARGURA, ALTURA] = [384, 192];

/**
 * Quem está no salão, em pixels do salão: `x` é o meio do pé, `y` a linha do pé, `altura` a altura do desenho.
 * A altura segue a profundidade (mais no fundo, menor): de pé, uns 34 px junto da parede do fundo (y ≈ 125) e
 * uns 56 na frente (y ≈ 178). `quadros` > 1 é faixa de animação (a reverência); `tipo` 'gente' respira um pixel.
 */
const CENA = [
  // No sofá, rindo, AFUNDADOS no assento: a frente da almofada passa por cima dos pés (relato de 10/10/2026:
  // sentados por cima do sofá, "colados de forma grosseira").
  // Mexendo no celular, sentados NO assento, com as pernas à mostra (afundá-los atrás da almofada as escondia:
  // "estão sem pernas"). ESCALA 1: nasceram no tamanho do salão, e reduzir é o que desfazia o rosto.
  { id: 'sofa-1', fonte: 'sofa-1', quadros: 16, x: 106, y: 121, escala: 1, duracao: 5.6, atraso: -1.1 },
  { id: 'sofa-2', fonte: 'sofa-2', quadros: 16, x: 132, y: 121, escala: 1, duracao: 6.4, atraso: -3.3 },
  // No chão, de costas, jogando na TV.
  { id: 'tv-1', fonte: 'tv-1', x: 167, y: 135, altura: 25, tipo: 'gente', sombra: true, duracao: 2.9, atraso: -2 },
  { id: 'tv-2', fonte: 'tv-2', x: 219, y: 136, altura: 25, tipo: 'gente', sombra: true, duracao: 3.3, atraso: -0.7 },
  // No fliperama, de costas, num banquinho encostado na máquina: só assim as mãos chegam aos botões.
  { id: 'fliperama', fonte: 'fliperama', x: 277, y: 140, altura: 56, tipo: 'gente', sombra: true, duracao: 2.6, atraso: -1.5 },
  // Atrás do balcão, acenando com o copo: da cintura para baixo, e a tigela e o pote em cima dele, ficam na frente.
  { id: 'balcao', fonte: 'balcao', x: 352, y: 118, altura: 42, tipo: 'gente', atras: 'balcao', duracao: 3.5, atraso: -2.4 },
  // Dois pares conversando, virados um para o outro (o segundo de cada par, espelhado).
  { id: 'sueter', fonte: 'sueter', x: 229, y: 157, altura: 42, tipo: 'gente', sombra: true, duracao: 3.8, atraso: -2.8 },
  { id: 'regata', fonte: 'regata', x: 251, y: 158, altura: 48, tipo: 'gente', sombra: true, espelhar: true, duracao: 4, atraso: -0.9 },
  { id: 'tranca-roxa', fonte: 'tranca-roxa', x: 62, y: 150, altura: 42, tipo: 'gente', sombra: true, duracao: 3.2, atraso: -1.7 },
  { id: 'laco-vermelho', fonte: 'laco-vermelho', x: 84, y: 150, altura: 41, tipo: 'gente', sombra: true, espelhar: true, duracao: 3.6, atraso: -0.5 },
  // Na frente, a turma agradecendo, e o coelho do quarto no centro, maior.
  { id: 'turma-1', fonte: 'turma-1', quadros: 18, x: 38, y: 177, altura: 54, sombra: true, duracao: 3.9, atraso: -0.4 },
  { id: 'turma-4', fonte: 'turma-4', quadros: 18, x: 346, y: 177, altura: 54, sombra: true, duracao: 4.4, atraso: -2.6 },
  { id: 'turma-2', fonte: 'turma-2', quadros: 18, x: 120, y: 186, altura: 58, sombra: true, duracao: 3.5, atraso: -1.3 },
  { id: 'turma-3', fonte: 'turma-3', quadros: 18, x: 284, y: 186, altura: 58, sombra: true, duracao: 4.1, atraso: -3.1 },
  { id: 'coelho', fonte: 'coelho', quadros: 18, x: 192, y: 190, altura: 72, sombra: true, principal: true, duracao: 3.6, atraso: 0 },
];

/**
 * O que passa NA FRENTE de quem está atrás: pedaços do próprio salão numa camada acima da peça. Cada frente é uma
 * caixa e os retângulos dentro dela que cobrem (o resto da caixa fica transparente).
 *   balcao — o tampo e o painel, e em cima do tampo a tigela e o pote;
 */
const FRENTES = {
  balcao: { x: 336, y: 90, w: LARGURA - 336, h: 48, cobrem: [[336, 108, 48, 30], [348, 97, 19, 11], [336, 90, 12, 18]] },
};

/** As telas: onde cada recorte de telas/ estava no salão, e só que parte dele muda (o resto é o móvel). */
const TELAS_DO_SALAO = [
  { id: 'tela-tv', fonte: 'tv', x: 161, y: 53, w: 64, h: 40, quadros: 9, duracao: 2.7, partes: [[3, 3, 58, 34]] },
  {
    id: 'tela-fliperama',
    fonte: 'fliperama',
    x: 258,
    y: 58,
    w: 40,
    h: 40,
    quadros: 9,
    duracao: 1.8,
    partes: [
      [5, 2, 31, 11],
      [6, 18, 26, 18],
    ],
  },
];

/** A janela da esquerda: o retângulo do vidro, onde se procuram o céu e as estrelas. */
const JANELA = { x: 24, y: 30, w: 44, h: 66, quadros: 16, duracao: 6.4 };

const p = await abrir();
const resultado = await p.evaluate(
  async ({ sala64, pecas, telas, CENA, FRENTES, TELAS_DO_SALAO, JANELA, LARGURA, ALTURA }) => {
    const carregar = async (b) => {
      const im = new Image();
      im.src = 'data:image/png;base64,' + b;
      await im.decode();
      return im;
    };
    const tela = (w, h) => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const g = c.getContext('2d', { willReadFrequently: true });
      g.imageSmoothingEnabled = false;
      return [c, g];
    };
    const pngDe = (c) => c.toDataURL('image/png').split(',')[1];

    const sala = await carregar(sala64);
    const [cSala, gSala] = tela(LARGURA, ALTURA);
    gSala.drawImage(sala, 0, 0);

    // O MAPA DE LUZ: o salão borrado. Cada ponto diz que cor de luz banha quem está ali.
    const [cLuz, gLuz] = tela(LARGURA, ALTURA);
    gLuz.filter = 'blur(9px)';
    gLuz.drawImage(sala, 0, 0);
    const luz = gLuz.getImageData(0, 0, LARGURA, ALTURA).data;
    const lum = (r, g, b) => 0.3 * r + 0.59 * g + 0.11 * b;
    // Quanto de luz é "luz cheia": a frente da TV, o lugar mais claro em que alguém fica.
    const LUZ_CHEIA = 118;
    const banhar = (r, g, b, x, y) => {
      const k = (Math.min(ALTURA - 1, Math.max(0, y)) * LARGURA + Math.min(LARGURA - 1, Math.max(0, x))) * 4;
      const [lr, lg, lb] = [luz[k], luz[k + 1], luz[k + 2]];
      const l = Math.max(1, lum(lr, lg, lb));
      // Brilho: entre 55% (o canto escuro) e 100%; a cor da luz entra pela metade, para tingir sem pintar.
      const brilho = Math.min(1, Math.max(0.55, 0.42 + 0.58 * (l / LUZ_CHEIA)));
      const tinge = (c, lc) => Math.round(Math.min(255, c * brilho * (0.55 + 0.45 * (lc / l))));
      return [tinge(r, lr), tinge(g, lg), tinge(b, lb)];
    };

    const sombras = [];
    const pecasProntas = [];

    for (const peca of CENA) {
      const im = await carregar(pecas[peca.fonte]);
      const quadros = peca.quadros ?? 1;
      const fw = im.width / quadros;
      const fh = im.height;
      const [cOrig, gOrig] = tela(im.width, fh);
      gOrig.drawImage(im, 0, 0);
      const orig = gOrig.getImageData(0, 0, im.width, fh).data;
      const opaco = (q, x, y) => {
        const xx = peca.espelhar ? fw - 1 - x : x;
        return orig[(y * im.width + q * fw + xx) * 4 + 3] > 128;
      };
      // A caixa do desenho, no PRIMEIRO quadro: dela saem a escala, o meio e a linha do pé.
      let [x0, y0, x1, y1] = [fw, fh, -1, -1];
      for (let y = 0; y < fh; y++)
        for (let x = 0; x < fw; x++)
          if (opaco(0, x, y)) {
            x0 = Math.min(x0, x);
            x1 = Math.max(x1, x);
            y0 = Math.min(y0, y);
            y1 = Math.max(y1, y);
          }
      const s = peca.escala ?? peca.altura / (y1 - y0 + 1);
      const W = Math.round(fw * s);
      const H = Math.round(fh * s);
      const esquerda = Math.round(peca.x - ((x0 + x1 + 1) / 2) * s);
      const topo = Math.round(peca.y - (y1 + 1) * s);

      // A REDUÇÃO: cada pixel novo olha o bloco de pixels antigos que ele cobre. Fica opaco se metade do bloco
      // for, e leva a cor que mais aparece ali — a cor exata de um pixel original, nunca uma média (média é
      // borrão, e o salão não tem borrão). Se o bloco tiver muito contorno, vence o contorno: é ele que segura
      // o desenho em tamanho pequeno.
      const [c, g] = tela(W * quadros, H);
      const saida = g.createImageData(W * quadros, H);
      const d = saida.data;
      for (let q = 0; q < quadros; q++)
        for (let oy = 0; oy < H; oy++)
          for (let ox = 0; ox < W; ox++) {
            const [sx0, sx1] = [Math.floor(ox / s), Math.max(Math.floor(ox / s) + 1, Math.floor((ox + 1) / s))];
            const [sy0, sy1] = [Math.floor(oy / s), Math.max(Math.floor(oy / s) + 1, Math.floor((oy + 1) / s))];
            const contagem = new Map();
            let [total, cheios, escuros, tracos] = [0, 0, 0, 0];
            for (let y = sy0; y < Math.min(sy1, fh); y++)
              for (let x = sx0; x < Math.min(sx1, fw); x++) {
                total++;
                if (!opaco(q, x, y)) continue;
                cheios++;
                const xx = peca.espelhar ? fw - 1 - x : x;
                const k = (y * im.width + q * fw + xx) * 4;
                const cor = (orig[k] << 16) | (orig[k + 1] << 8) | orig[k + 2];
                if (lum(orig[k], orig[k + 1], orig[k + 2]) < 55) {
                  escuros++;
                  // Escuro com o desenho em volta dos quatro lados é TRAÇO de dentro (olho, boca), não contorno.
                  if (opaco(q, Math.max(0, x - 1), y) && opaco(q, Math.min(fw - 1, x + 1), y) && opaco(q, x, Math.max(0, y - 1)) && opaco(q, x, Math.min(fh - 1, y + 1))) tracos++;
                }
                contagem.set(cor, (contagem.get(cor) ?? 0) + 1);
              }
            if (!total || cheios / total < 0.5) continue;
            let [melhor, vezes] = [0, -1];
            // O olho é um ou dois pixels escuros no meio do pelo claro: com a regra do contorno (um terço do bloco),
            // ele caía numa casa e sumia na outra, e o coelho ficava com um olho só (relato de 10/10/2026: "olhos
            // com falhas"). Traço de dentro vence com um quarto do bloco.
            const preferirEscuro = escuros / cheios >= 0.34 || tracos / cheios >= 0.25;
            for (const [cor, n] of contagem) {
              const escuro = lum(cor >> 16, (cor >> 8) & 255, cor & 255) < 55;
              if (preferirEscuro && !escuro) continue;
              if (n > vezes) [melhor, vezes] = [cor, n];
            }
            const [r, gg, b] = banhar(melhor >> 16, (melhor >> 8) & 255, melhor & 255, esquerda + ox, topo + oy);
            const k = (oy * W * quadros + q * W + ox) * 4;
            [d[k], d[k + 1], d[k + 2], d[k + 3]] = [r, gg, b, 255];
          }
      g.putImageData(saida, 0, 0);
      pecasProntas.push({ ...peca, png: pngDe(c), esquerda, topo, W, H, quadros });
      if (peca.sombra) sombras.push({ x: peca.x, y: peca.y, w: Math.max(8, Math.round((x1 - x0 + 1) * s * 0.8)) });
    }

    // AS SOMBRAS, pintadas no próprio chão: uma elipse de dois tons, sem degradê (pixel art não tem degradê).
    const chao = gSala.getImageData(0, 0, LARGURA, ALTURA);
    const escurecer = (x, y, f) => {
      if (x < 0 || y < 0 || x >= LARGURA || y >= ALTURA) return;
      const k = (y * LARGURA + x) * 4;
      for (let i = 0; i < 3; i++) chao.data[k + i] = Math.round(chao.data[k + i] * f);
    };
    for (const { x, y, w } of sombras) {
      const [rx, ry] = [w / 2, Math.max(2, Math.round(w / 9))];
      for (let dy = -ry; dy <= ry; dy++)
        for (let dx = -Math.ceil(rx); dx <= Math.ceil(rx); dx++) {
          const e = (dx / rx) ** 2 + (dy / ry) ** 2;
          if (e > 1) continue;
          escurecer(Math.round(x + dx), y + dy - 1, e < 0.45 ? 0.55 : 0.75);
        }
    }
    gSala.putImageData(chao, 0, 0);

    // A FRENTE DO BALCÃO: o mesmo pedaço do salão, numa camada acima de quem está atrás dele.
    const frentes = {};
    for (const [nome, fr] of Object.entries(FRENTES)) {
      const [c, g] = tela(fr.w, fr.h);
      for (const [x, y, w, h] of fr.cobrem) g.drawImage(cSala, x, y, w, h, x - fr.x, y - fr.y, w, h);
      frentes[nome] = pngDe(c);
    }

    // AS TELAS: a faixa dos quadros do PixelLab, só nas partes que mudam (o móvel em volta continua o do salão).
    const telasProntas = [];
    for (const t of TELAS_DO_SALAO) {
      const [c, g] = tela(t.w * t.quadros, t.h);
      for (let q = 0; q < t.quadros; q++) {
        const im = await carregar(telas[`${t.fonte}-${q + 1}`]);
        for (const [px, py, pw, ph] of t.partes) g.drawImage(im, px, py, pw, ph, q * t.w + px, py, pw, ph);
      }
      telasProntas.push({ ...t, png: pngDe(c) });
    }

    // A JANELA: o céu é o azul escuro do vidro; estrela é ponto claro com céu em volta. Cada estrela pisca no
    // seu tempo (apaga um quadro, acende forte noutro), e uma estrela cadente cruza o vidro uma vez por volta.
    const vidro = gSala.getImageData(JANELA.x, JANELA.y, JANELA.w, JANELA.h);
    const v = vidro.data;
    const em = (x, y) => (y * JANELA.w + x) * 4;
    const ceu = (x, y) => {
      if (x < 0 || y < 0 || x >= JANELA.w || y >= JANELA.h) return false;
      const k = em(x, y);
      return v[k + 2] > v[k] + 8 && lum(v[k], v[k + 1], v[k + 2]) < 60;
    };
    let semente = 7;
    const sorte = () => ((semente = (semente * 16807) % 2147483647) / 2147483647);
    const estrelas = [];
    for (let y = 1; y < JANELA.h - 1; y++)
      for (let x = 1; x < JANELA.w - 1; x++) {
        const k = em(x, y);
        if (lum(v[k], v[k + 1], v[k + 2]) < 75 || ceu(x, y)) continue;
        const vizinhos = [ceu(x - 1, y), ceu(x + 1, y), ceu(x, y - 1), ceu(x, y + 1)].filter(Boolean).length;
        if (vizinhos >= 3) estrelas.push({ x, y, fase: Math.floor(sorte() * JANELA.quadros) });
      }
    const corDoCeu = (x, y) => {
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) if (ceu(x + dx, y + dy)) return em(x + dx, y + dy);
      return null;
    };
    const [cJanela, gJanela] = tela(JANELA.w * JANELA.quadros, JANELA.h);
    const jan = gJanela.createImageData(JANELA.w * JANELA.quadros, JANELA.h);
    const pintar = (q, x, y, r, g, b) => {
      const k = (y * JANELA.w * JANELA.quadros + q * JANELA.w + x) * 4;
      [jan.data[k], jan.data[k + 1], jan.data[k + 2], jan.data[k + 3]] = [r, g, b, 255];
    };
    // A cadente: do alto à direita para baixo à esquerda, nos quadros 4 a 8, com um rastro de três pixels.
    const CADENTE = { x: 38, y: 6, dx: -3, dy: 2, de: 4, ate: 8 };
    for (let q = 0; q < JANELA.quadros; q++) {
      for (const e of estrelas) {
        const t = (q + e.fase) % JANELA.quadros;
        if (t === 0 || t === 1) {
          const k = corDoCeu(e.x, e.y);
          if (k !== null) pintar(q, e.x, e.y, v[k], v[k + 1], v[k + 2]);
        } else if (t === 8) pintar(q, e.x, e.y, 255, 250, 228);
      }
      if (q >= CADENTE.de && q <= CADENTE.ate) {
        const passo = q - CADENTE.de;
        const cabeca = [CADENTE.x + CADENTE.dx * passo, CADENTE.y + CADENTE.dy * passo];
        const rastro = [
          [0, [255, 248, 220]],
          [1, [214, 206, 240]],
          [2, [140, 140, 200]],
          [3, [96, 100, 160]],
        ];
        for (const [i, [r, g, b]] of rastro) {
          const x = Math.round(cabeca[0] - (CADENTE.dx * i) / 2);
          const y = Math.round(cabeca[1] - (CADENTE.dy * i) / 2);
          if (ceu(x, y)) pintar(q, x, y, r, g, b);
        }
      }
    }
    gJanela.putImageData(jan, 0, 0);

    return {
      sala: pngDe(cSala),
      frentes,
      janela: pngDe(cJanela),
      estrelas: estrelas.length,
      pecas: pecasProntas.map(({ png, ...resto }) => ({ ...resto, png })),
      telas: telasProntas,
    };
  },
  {
    sala64: ler64(path.join(PECAS, 'sala.png')),
    pecas: Object.fromEntries(CENA.map((c) => [c.fonte, ler64(path.join(PECAS, c.fonte + '.png'))])),
    telas: Object.fromEntries(
      TELAS_DO_SALAO.flatMap((t) => Array.from({ length: t.quadros }, (_, q) => [`${t.fonte}-${q + 1}`, ler64(path.join(TELAS, `${t.fonte}-${q + 1}.png`))])),
    ),
    CENA,
    FRENTES,
    TELAS_DO_SALAO,
    JANELA,
    LARGURA,
    ALTURA,
  },
);
await fechar();

// As imagens. O que estava em web/site/lobby/ e não é mais da cena sai, para não ir ao ar à toa.
fs.mkdirSync(DESTINO, { recursive: true });
const escritos = new Set(['sala.png', 'janela.png']);
gravar64(path.join(DESTINO, 'sala.png'), resultado.sala);
for (const [nome, b64] of Object.entries(resultado.frentes)) {
  gravar64(path.join(DESTINO, `frente-${nome}.png`), b64);
  escritos.add(`frente-${nome}.png`);
}
gravar64(path.join(DESTINO, 'janela.png'), resultado.janela);
for (const x of [...resultado.pecas, ...resultado.telas]) {
  gravar64(path.join(DESTINO, x.id + '.png'), x.png);
  escritos.add(x.id + '.png');
}
for (const nome of fs.readdirSync(DESTINO)) if (!escritos.has(nome)) fs.rmSync(path.join(DESTINO, nome));

// O CSS: tudo em porcentagem do salão (384 × 192), em pixels inteiros dele, para os pixels das peças caírem
// exatamente sobre os do salão. A ordem de desenho é a do pé: quem pisa mais embaixo vai na frente.
const pc = (v, total) => `${+((v / total) * 100).toFixed(4)}%`;
const caixa = (x, y, w, h) => `left: ${pc(x, LARGURA)}; top: ${pc(y, ALTURA)}; width: ${pc(w, LARGURA)}; height: ${pc(h, ALTURA)};`;
const regras = [];
for (const x of resultado.pecas) {
  const faixa = x.quadros > 1 ? ` background-size: ${x.quadros * 100}% 100%; --quadros: ${x.quadros};` : '';
  regras.push(
    `.lobby-peca.${x.id} { background-image: url('lobby/${x.id}.png'); ${caixa(x.esquerda, x.topo, x.W, x.H)} z-index: ${x.y}; --duracao: ${x.duracao}s; --atraso: ${x.atraso}s;${faixa} }`,
  );
}
// Cada frente vai logo acima do mais à frente dos que estão atrás dela, e abaixo de todo o resto.
for (const [nome, fr] of Object.entries(FRENTES)) {
  const atras = resultado.pecas.filter((x) => x.atras === nome);
  regras.push(
    `.lobby-peca.frente-${nome} { background-image: url('lobby/frente-${nome}.png'); ${caixa(fr.x, fr.y, fr.w, fr.h)} z-index: ${Math.max(0, ...atras.map((x) => x.y)) + 1}; }`,
  );
}
for (const t of resultado.telas) {
  regras.push(
    `.lobby-peca.${t.id} { background-image: url('lobby/${t.id}.png'); ${caixa(t.x, t.y, t.w, t.h)} z-index: 0; background-size: ${t.quadros * 100}% 100%; --quadros: ${t.quadros}; --duracao: ${t.duracao}s; }`,
  );
}
regras.push(
  `.lobby-peca.janela { background-image: url('lobby/janela.png'); ${caixa(JANELA.x, JANELA.y, JANELA.w, JANELA.h)} z-index: 0; background-size: ${JANELA.quadros * 100}% 100%; --quadros: ${JANELA.quadros}; --duracao: ${JANELA.duracao}s; }`,
);

const trocarEntre = (arquivo, inicio, fim, miolo) => {
  const texto = fs.readFileSync(arquivo, 'utf8');
  const [a, b] = [texto.indexOf(inicio), texto.indexOf(fim)];
  if (a < 0 || b < a) throw new Error(`faltam as marcas ${inicio} … ${fim} em ${arquivo}`);
  fs.writeFileSync(arquivo, texto.slice(0, a + inicio.length) + miolo + texto.slice(b));
};
trocarEntre(
  path.join(SITE, 'site.css'),
  '/* lobby:cena — gerado por e2e/pixel-art/lobby/montar.mjs, não editar à mão */',
  '/* lobby:fim */',
  '\n' + regras.join('\n') + '\n',
);

const classe = (x) =>
  x.quadros > 1 ? `lobby-peca lobby-faixa${x.principal ? ' principal' : ''} ${x.id}` : `lobby-peca lobby-gente ${x.id}`;
const spans = [
  '<span class="lobby-peca lobby-faixa janela"></span>',
  ...resultado.telas.map((t) => `<span class="lobby-peca lobby-faixa ${t.id}"></span>`),
  ...[...resultado.pecas].sort((a, b) => a.y - b.y).map((x) => `<span class="${classe(x)}"></span>`),
  ...Object.keys(FRENTES).map((nome) => `<span class="lobby-peca frente-${nome}"></span>`),
];
trocarEntre(
  path.join(SITE, 'index.html'),
  '<!-- lobby:cena — gerado por e2e/pixel-art/lobby/montar.mjs, não editar à mão -->',
  '<!-- lobby:fim -->',
  '\n' + spans.map((s) => '          ' + s).join('\n') + '\n          ',
);

console.log(`cena: ${resultado.pecas.length} peças, ${resultado.telas.length} telas, ${resultado.estrelas} estrelas na janela`);
