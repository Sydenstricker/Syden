// AS FOLHAS DO TRÂNSITO DA TOCA (06/11/2026). Junta numa imagem só as peças usadas da Kenney (CC0): os prédios do Isometric
// Buildings e os carros do Isometric Vehicles, só nas quatro diagonais (as ruas do jogo andam pela grade, e na tela a grade é
// diagonal). Grava web/public/transito/predios.png e veiculos.png, com a licença ao lado, e web/src/transito/atlas.gerado.ts com o
// lugar de cada peça. Os pacotes ficam fora do git, em e2e/3D/Assets/mini game transito/.
//
//   node web/scripts/transito-atlas.mjs
//
// OS NOMES DOS CARROS CIVIS NÃO DIZEM A DIREÇÃO (carRed2_000 a _015, e a ordem muda de cor para cor). Os quadros abaixo foram
// achados comparando as janelas de cada um com as do táxi, que tem nome (taxi_NE...), e conferidos a olho.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ORIGEM = path.resolve(RAIZ, '..', 'e2e', '3D', 'Assets', 'mini game transito');
const PREDIOS = path.join(ORIGEM, 'kenney_isometric-buildings', 'PNG');
const CARROS = path.join(ORIGEM, 'kenney_isometric-vehicles', 'PNG');
const SAIDA = path.join(RAIZ, 'public', 'transito');

/** Os prédios de um andar sobre a calçada (132 × 127), com fachada nas duas faces da frente. */
const QUAIS_PREDIOS = [1, 2, 3, 4, 9, 10, 14, 17, 18, 25, 26, 28, 29, 30, 33, 34, 36, 37, 41];

const DIRECOES = ['NE', 'SE', 'SW', 'NW'];
const civil = (cor, quadros) => quadros.map((q) => path.join(CARROS, 'Civilian', cor, 'Sedan 1', `car${cor}2_${String(q).padStart(3, '0')}.png`));
const nomeado = (pasta, nome) => DIRECOES.map((d) => path.join(CARROS, pasta, `${nome}_${d}.png`));
/** A ordem é a das PELES da regra (sim.ts sorteia o número), e a ambulância por último. Cada linha: NE, SE, SW, NW. */
const PELES = [
  civil('Black', [4, 9, 8, 2]),
  civil('Blue', [5, 10, 9, 3]),
  civil('Green', [3, 8, 7, 1]),
  civil('Red', [3, 8, 7, 1]),
  civil('Silver', [4, 9, 8, 2]),
  nomeado('Taxi', 'taxi'),
  nomeado('Police', 'police'),
  nomeado('Garbage', 'garbage'),
  nomeado('Ambulance', 'ambulance'),
];

const ler = (f) => PNG.sync.read(fs.readFileSync(f));

function colar(destino, img, x0, y0) {
  for (let y = 0; y < img.height; y++)
    for (let x = 0; x < img.width; x++) {
      const s = (y * img.width + x) * 4;
      const d = ((y0 + y) * destino.width + x0 + x) * 4;
      for (let c = 0; c < 4; c++) destino.data[d + c] = img.data[s + c];
    }
}

/** Uma folha em grade: cada peça no canto de cima da sua casa, e o retângulo dela guardado. */
function folha(arquivos, colunas, celW, celH) {
  const linhas = Math.ceil(arquivos.length / colunas);
  const out = new PNG({ width: colunas * celW, height: linhas * celH });
  const rects = arquivos.map((f, i) => {
    const img = ler(f);
    const x = (i % colunas) * celW;
    const y = Math.floor(i / colunas) * celH;
    colar(out, img, x, y);
    return [x, y, img.width, img.height];
  });
  return { out, rects };
}

fs.mkdirSync(SAIDA, { recursive: true });
const predios = folha(QUAIS_PREDIOS.map((n) => path.join(PREDIOS, `buildingTiles_${String(n).padStart(3, '0')}.png`)), 5, 133, 128);
fs.writeFileSync(path.join(SAIDA, 'predios.png'), PNG.sync.write(predios.out));
const veiculos = folha(PELES.flat(), 4, 40, 42);
fs.writeFileSync(path.join(SAIDA, 'veiculos.png'), PNG.sync.write(veiculos.out));
fs.writeFileSync(
  path.join(SAIDA, 'License.txt'),
  fs.readFileSync(path.join(ORIGEM, 'kenney_isometric-buildings', 'License.txt'), 'utf8') +
    '\n' +
    fs.readFileSync(path.join(ORIGEM, 'kenney_isometric-vehicles', 'License.txt'), 'utf8'),
);

const ts = `// GERADO por web/scripts/transito-atlas.mjs: não edite à mão.
// Os retângulos [x, y, largura, altura] de cada peça nas folhas de web/public/transito/.

/** Os prédios (predios.png), 132 × 127 cada, a calçada embaixo. */
export const PREDIOS: [number, number, number, number][] = ${JSON.stringify(predios.rects)};

/** Os carros (veiculos.png): [pele][direção], a direção na ordem NE, SE, SW, NW da tela. A última pele é a ambulância. */
export const VEICULOS: [number, number, number, number][][] = ${JSON.stringify(PELES.map((_, i) => veiculos.rects.slice(i * 4, i * 4 + 4)))};
`;
fs.writeFileSync(path.join(RAIZ, 'src', 'transito', 'atlas.gerado.ts'), ts);
console.log('prédios', predios.rects.length, 'carros', veiculos.rects.length);
