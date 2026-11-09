// A FOLHA DE CONFERÊNCIA de uma animação: os quadros de cada direção numa linha, ampliados 3×, num fundo neutro, para
// olhar de uma vez se a animação ficou boa antes de pô-la no quarto.
//   node e2e/pixel-art/personagem/folha-de-animacao.mjs <pasta dos quadros> <saída.png> [direções separadas por vírgula]
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const [pasta, saida, dirs = 'south-east,south-west,north-east,north-west'] = process.argv.slice(2);
const linhas = dirs.split(',').map((d) =>
  fs.readdirSync(pasta).filter((f) => new RegExp(`^${d}-\\d+\\.png$`).test(f)).sort((a, b) => +a.match(/(\d+)\.png/)[1] - +b.match(/(\d+)\.png/)[1]),
).filter((l) => l.length);
const E = 3;
const Q = Math.max(...linhas.flat().map((f) => { const g = PNG.sync.read(fs.readFileSync(path.join(pasta, f))); return Math.max(g.width, g.height); }));
const colunas = Math.max(...linhas.map((l) => l.length));
const folha = new PNG({ width: colunas * Q * E, height: linhas.length * Q * E });
for (let i = 0; i < folha.data.length; i += 4) folha.data.set([70, 70, 90, 255], i);
linhas.forEach((linha, l) => linha.forEach((f, c) => {
  const g = PNG.sync.read(fs.readFileSync(path.join(pasta, f)));
  for (let y = 0; y < g.height; y++) for (let x = 0; x < g.width; x++) {
    const s = (y * g.width + x) * 4; if (g.data[s + 3] < 20) continue;
    for (let a = 0; a < E; a++) for (let b = 0; b < E; b++) folha.data.set(g.data.subarray(s, s + 3), (((l * Q + y) * E + a) * folha.width + (c * Q + x) * E + b) * 4);
  }
}));
fs.writeFileSync(saida, PNG.sync.write(folha));
console.log(`${linhas.length} linhas × ${colunas} quadros → ${saida}`);
