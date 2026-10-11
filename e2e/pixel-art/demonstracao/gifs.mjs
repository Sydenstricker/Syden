// Os GIFs NOSSOS da conversa de demonstração (pedido de 10/10/2026: "gifs também nessa imagem, simulando uma
// conversa real com emojis e os gifs nossos"). Saem das animações em pixel art que o site já usa, ampliadas pelo
// vizinho mais próximo (pixel art só cresce em inteiros), sobre o azul-noite dos avatares:
//   clipe.gif     — a jogada da clara: o jogo da call (jogo-1-anim-*.png);
//   valeu.gif     — o coelho do quarto agradecendo (a reverência do lobby);
//   celular.gif   — o coelho do sofá no celular;
//   respeito.gif  — a turma toda fazendo a reverência.
// e2e/conversa-animada.mjs os manda como anexo, como qualquer pessoa mandaria.
//
//   node e2e/pixel-art/demonstracao/gifs.mjs
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PNG } from 'pngjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const PIXEL = path.join(AQUI, '..');
const DESTINO = path.join(AQUI, 'gifs');
fs.mkdirSync(DESTINO, { recursive: true });
const FUNDO = [30, 37, 51];

const ler = (arquivo) => PNG.sync.read(fs.readFileSync(arquivo));
/** Os quadros de uma faixa horizontal de `n` quadros iguais. */
const daFaixa = (arquivo, n) => {
  const f = ler(arquivo);
  const w = f.width / n;
  return Array.from({ length: n }, (_, i) => {
    const q = new PNG({ width: w, height: f.height });
    PNG.bitblt(f, q, i * w, 0, w, f.height, 0, 0);
    return q;
  });
};
/** Amplia pelo vizinho mais próximo, sobre o fundo (o GIF não tem transparência boa para pixel art de borda suave). */
const ampliar = (q, k) => {
  const s = new PNG({ width: q.width * k, height: q.height * k });
  for (let y = 0; y < s.height; y++)
    for (let x = 0; x < s.width; x++) {
      const de = (Math.floor(y / k) * q.width + Math.floor(x / k)) * 4;
      const para = (y * s.width + x) * 4;
      const a = q.data[de + 3] / 255;
      for (let c = 0; c < 3; c++) s.data[para + c] = Math.round(q.data[de + c] * a + FUNDO[c] * (1 - a));
      s.data[para + 3] = 255;
    }
  return s;
};
function gif(nome, quadros, fps, k) {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'gif-'));
  quadros.forEach((q, i) => fs.writeFileSync(path.join(pasta, `q${String(i).padStart(3, '0')}.png`), PNG.sync.write(ampliar(q, k))));
  execFileSync('ffmpeg', [
    '-y', '-loglevel', 'error', '-framerate', String(fps), '-i', path.join(pasta, 'q%03d.png'),
    '-vf', 'split[a][b];[a]palettegen=stats_mode=full[p];[b][p]paletteuse=dither=none', '-loop', '0', path.join(DESTINO, nome),
  ]);
  fs.rmSync(pasta, { recursive: true });
  console.log(`${nome}: ${quadros[0].width * k}×${quadros[0].height * k}, ${(fs.statSync(path.join(DESTINO, nome)).size / 1024).toFixed(0)} KB`);
}

gif('clipe.gif', Array.from({ length: 9 }, (_, i) => ler(path.join(AQUI, `jogo-1-anim-${i + 1}.png`))), 6, 2);
gif('valeu.gif', daFaixa(path.join(PIXEL, 'lobby', 'pecas', 'coelho.png'), 18), 6, 3);
gif('celular.gif', daFaixa(path.join(PIXEL, 'lobby', 'pecas', 'sofa-1.png'), 16), 4, 6);
gif('respeito.gif', Array.from({ length: 9 }, (_, i) => ler(path.join(PIXEL, 'agradecendo', `reverencia-turma-1-${i + 1}.png`))), 5, 2);
