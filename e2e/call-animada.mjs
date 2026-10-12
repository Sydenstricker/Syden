// A CALL DO SITE, ANIMADA (pedido de 10/10/2026: "mais ênfase nas imagens; animar essa imagem, mostrando o jogo
// na tela e simulando as pessoas com o verde de quem fala").
//
// A base é uma foto DE VERDADE da call de sexta do squad de demonstração (pixel-art/demonstracao/call-base.webp:
// a tela da clara, 3200 × 1800, tirada no Syden local com o LiveKit). Em cima dela, quadro a quadro:
//   - O JOGO ANDA: a área da transmissão recebe os quadros de pixel-art/demonstracao/jogo-animado/ (montados por
//     jogo-animado.py: o coelho pega as moedas, o contador sobe, e no fim chega um amigo e aparece o balão do
//     Syden), ampliados sem suavizar. Até 12/10/2026 eram os quadros do PixelLab, em que o coelho passava por
//     cima das moedas sem pegá-las. O que a interface desenha por cima do vídeo (o "i",
//     o título, o botão de tela cheia) é guardado da foto e volta por cima.
//   - QUEM FALA ACENDE como no app: o quadro ganha o contorno verde, o anel verde vai por fora da moldura e o
//     coelho pronto faz a pose de falando (as faixas de web/public/avatares/, as mesmas do Avatar.tsx).
// Por que composição e não gravar uma call: a gravação depende do microfone falso passar pela supressão de ruído
// (o bipe não é voz, e é cortado) e do vídeo chegar a tempo; aqui o laço fecha certo e o resultado é o mesmo toda vez.
//
// Escreve em web/site/capturas/pt-BR/: call.webp (animada) e call-parada.webp (a foto, para quem pediu menos
// movimento — o <picture> de index.html). Precisa só do ffmpeg no PATH.
//
//   python e2e/pixel-art/demonstracao/jogo-animado.py   (os quadros do jogo, antes)
//   node e2e/call-animada.mjs
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { abrir, fechar, ler64 } from './pixel-art/quarto/imagem.mjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const DEMO = path.join(AQUI, 'pixel-art', 'demonstracao');
const AVATARES = path.join(AQUI, '..', 'web', 'public', 'avatares');
const DESTINO = path.join(AQUI, '..', 'web', 'site', 'capturas', 'pt-BR');

/** O laço: 8 s a 12 quadros por segundo, o mesmo do jogo (um quadro do jogo por quadro); a boca, a 8 por 1,2 s. */
const [LACO, FPS] = [8, 12];
/** Os quadrinhos da faixa de baixo, na foto (pixels da foto, que é 2×): o 1º começa em x = 648 e cada um anda 416. */
const QUADRINHO = { x: 648, y: 1408, w: 400, h: 240, passo: 416, raio: 16, avatar: { cx: 200, cy: 120, r: 48, moldura: 54 } };
/** A caixa da transmissão na foto (2040 × 1148 é 16:9). */
const JOGO_NA_FOTO = { x: 648, y: 185, w: 2040, h: 1148 };
/** Quem está em cada quadrinho (o número do coelho pronto) e quando fala, em segundos do laço. */
// No fim do jogo (o amigo chegando, o balão), a sala reage: todo mundo fala um pouco.
const PESSOAS = [
  { nome: 'clara', coelho: 12, fala: [[6.3, 7.1]] },
  { nome: 'rafa', coelho: 2, fala: [[1.6, 3.3], [6.4, 7.3]] },
  { nome: 'kai', coelho: 1, fala: [[3.5, 4.9]] },
  { nome: 'helena', coelho: 5, fala: [[0, 1.8], [5.4, 6.6]] },
  { nome: 'bento', coelho: 3, fala: [[2.4, 3.1], [6.2, 6.9]] },
];

const p = await abrir();
const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'call-'));
const quadros = LACO * FPS;
const lote = await p.evaluate(
  async ({ base, jogo, anim, faixas, PESSOAS, QUADRINHO, JOGO_NA_FOTO, quadros, FPS }) => {
    const carregar = async (b, tipo = 'png') => {
      const im = new Image();
      im.src = `data:image/${tipo};base64,` + b;
      await im.decode();
      return im;
    };
    const tela = (w, h) => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      return [c, c.getContext('2d', { willReadFrequently: true })];
    };
    const foto = await carregar(base, 'webp');
    const [W, H] = [foto.width, foto.height];
    const [cFoto, gFoto] = tela(W, H);
    gFoto.drawImage(foto, 0, 0);
    const pixels = gFoto.getImageData(0, 0, W, H).data;

    // ONDE ESTÁ O JOGO, medido na foto: a transmissão em 16:9 (o canvas de 1280 × 720 da tela falsa), a 2×.
    const R = JOGO_NA_FOTO;

    // O QUE A INTERFACE PÕE POR CIMA DO VÍDEO: onde a foto difere muito do jogo parado ampliado, é interface — mas
    // só nos dois cantos de cima, onde ela mora (o "i" e o título; a tela cheia). No resto, a compressão do vídeo
    // na foto também difere do jogo, e guardá-la deixava um fantasma do coelho parado no lugar antigo.
    const cantos = [
      [R.x, R.y, 420, 70],
      [R.x + R.w - 130, R.y, 130, 70],
    ];
    const noCanto = (x, y) => cantos.some(([cx, cy, cw, ch]) => x >= cx && x < cx + cw && y >= cy && y < cy + ch);
    const im0 = await carregar(jogo);
    const [, gJ] = tela(im0.width, im0.height);
    gJ.drawImage(im0, 0, 0);
    const j = gJ.getImageData(0, 0, im0.width, im0.height).data;
    const [cCima, gCima] = tela(W, H);
    const cima = gCima.createImageData(W, H);
    for (let y = R.y; y < R.y + R.h; y++)
      for (let x = R.x; x < R.x + R.w; x++) {
        const sx = Math.min(im0.width - 1, Math.floor(((x - R.x) / R.w) * im0.width));
        const sy = Math.min(im0.height - 1, Math.floor(((y - R.y) / R.h) * im0.height));
        const k = (y * W + x) * 4;
        const kj = (sy * im0.width + sx) * 4;
        const dif = Math.abs(pixels[k] - j[kj]) + Math.abs(pixels[k + 1] - j[kj + 1]) + Math.abs(pixels[k + 2] - j[kj + 2]);
        if (dif > 120 && noCanto(x, y)) {
          // Um pixel de folga em volta: o texto da interface tem borda suave.
          for (let dy = -1; dy <= 1; dy++)
            for (let dx = -1; dx <= 1; dx++) {
              const kk = ((y + dy) * W + (x + dx)) * 4;
              cima.data[kk] = pixels[kk];
              cima.data[kk + 1] = pixels[kk + 1];
              cima.data[kk + 2] = pixels[kk + 2];
              cima.data[kk + 3] = 255;
            }
        }
      }
    gCima.putImageData(cima, 0, 0);

    const jogoAnim = await Promise.all(anim.map((b) => carregar(b)));
    const falando = await Promise.all(faixas.map((b) => carregar(b)));
    const verde = '#23a55a';
    const saida = [];
    const [c, g] = tela(W, H);
    for (let q = 0; q < quadros; q++) {
      const t = q / FPS;
      g.drawImage(cFoto, 0, 0);
      g.imageSmoothingEnabled = false;
      g.drawImage(jogoAnim[q % jogoAnim.length], R.x, R.y, R.w, R.h);
      g.drawImage(cCima, 0, 0);
      PESSOAS.forEach((pessoa, i) => {
        if (!pessoa.fala.some(([de, ate]) => t >= de && t < ate)) return;
        const x = QUADRINHO.x + i * QUADRINHO.passo;
        const { cx, cy, r, moldura } = QUADRINHO.avatar;
        // O contorno verde do quadro (outline de 2 px por dentro, a 2×).
        g.save();
        g.strokeStyle = verde;
        g.lineWidth = 4;
        g.beginPath();
        g.roundRect(x + 2, QUADRINHO.y + 2, Math.min(QUADRINHO.w, R.x + R.w - x) - 4, QUADRINHO.h - 4, QUADRINHO.raio);
        g.stroke();
        // O anel verde por fora da moldura (box-shadow de 7 px, a 2×), e o coelho na pose de falando.
        g.beginPath();
        g.arc(x + cx, QUADRINHO.y + cy, r + 14, 0, Math.PI * 2);
        g.arc(x + cx, QUADRINHO.y + cy, moldura, 0, Math.PI * 2, true);
        g.fillStyle = verde;
        g.fill();
        g.beginPath();
        g.arc(x + cx, QUADRINHO.y + cy, r, 0, Math.PI * 2);
        g.clip();
        g.fillStyle = '#1e2533';
        g.fillRect(x + cx - r, QUADRINHO.y + cy - r, r * 2, r * 2);
        const faixa = falando[i];
        const lado = faixa.height;
        g.drawImage(faixa, (Math.floor(t / 0.15) % 8) * lado, 0, lado, lado, x + cx - r, QUADRINHO.y + cy - r, r * 2, r * 2);
        g.restore();
      });
      // A imagem do site tem 1600 de largura: reduz aqui mesmo, com suavização, como a foto parada de antes.
      const [cs, gs] = tela(1600, 900);
      gs.imageSmoothingQuality = 'high';
      gs.drawImage(c, 0, 0, 1600, 900);
      saida.push(cs.toDataURL('image/png').split(',')[1]);
    }
    return { saida, R };
  },
  {
    base: ler64(path.join(DEMO, 'call-base.webp')),
    jogo: ler64(path.join(DEMO, 'jogo-1.png')),
    anim: Array.from({ length: LACO * FPS }, (_, i) => ler64(path.join(DEMO, 'jogo-animado', `q${String(i).padStart(3, '0')}.png`))),
    faixas: PESSOAS.map((pessoa) => ler64(path.join(AVATARES, `coelho-${String(pessoa.coelho).padStart(2, '0')}-falando.png`))),
    PESSOAS,
    QUADRINHO,
    JOGO_NA_FOTO,
    quadros,
    FPS,
  },
);
await fechar();
lote.saida.forEach((b, i) => fs.writeFileSync(path.join(pasta, `q${String(i).padStart(3, '0')}.png`), Buffer.from(b, 'base64')));

fs.mkdirSync(DESTINO, { recursive: true });
const ffmpeg = (...args) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args]);
ffmpeg('-framerate', String(FPS), '-i', path.join(pasta, 'q%03d.png'), '-vf', 'scale=1200:-2:flags=lanczos', '-c:v', 'libwebp_anim', '-lossless', '0', '-q:v', '74', '-loop', '0', path.join(DESTINO, 'call.webp'));
// A versão parada (para quem pediu menos movimento) é o momento mais marcante: o balão do Syden com o coração.
ffmpeg('-i', path.join(pasta, `q${String(Math.round(6.6 * FPS)).padStart(3, '0')}.png`), '-vf', 'scale=1600:-2:flags=lanczos', '-c:v', 'libwebp', '-q:v', '88', path.join(DESTINO, 'call-parada.webp'));
fs.rmSync(pasta, { recursive: true });
console.log(`jogo em ${lote.R.x},${lote.R.y} ${lote.R.w}×${lote.R.h}`);
for (const nome of ['call.webp', 'call-parada.webp']) console.log(`${nome}: ${(fs.statSync(path.join(DESTINO, nome)).size / 1024).toFixed(0)} KB`);
