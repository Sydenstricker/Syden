// AS FIGURAS DO "QUAL É O TAMANHO?" (13/10/2026). Baixa os desenhos 3D do Fluent Emoji da Microsoft (licença
// MIT, github.com/microsoft/fluentui-emoji), corta a sobra transparente em volta e grava em web/public/tamanho/,
// com a licença ao lado. Escreve também web/src/figurasDoTamanho.ts, com a largura e a altura de cada figura
// JÁ CORTADA: é por ela que o jogo põe cada objeto no tamanho certo (a altura do desenho é a altura do objeto,
// a largura é o comprimento).
//
// Por que embutir em vez de usar o emoji do sistema: o emoji muda de sistema para sistema (a girafa da Apple é
// só a cabeça), e com folga em volta que ninguém mede. Com a figura nossa, todo mundo vê o mesmo desenho.
//
//   node web/scripts/figuras-do-tamanho.mjs
//
// Para pôr um objeto novo: uma linha aqui, rodar de novo, e o objeto nos dois minijogos.ts (ver lá).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PASTA = path.join(RAIZ, 'public', 'tamanho');
const BASE = 'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/';

/** id do objeto → pasta do Fluent Emoji (a figura é <pasta>/3D/<pasta em minúsculas>_3d.png). */
const FIGURAS = {
  bacteria: 'Microbe',
  joaninha: 'Lady beetle',
  formiga: 'Ant',
  abelha: 'Honeybee',
  caracol: 'Snail',
  morango: 'Strawberry',
  ovo: 'Egg',
  camundongo: 'Mouse',
  lampada: 'Light bulb',
  celular: 'Mobile phone',
  lapis: 'Pencil',
  banana: 'Banana',
  'bola-de-futebol': 'Soccer ball',
  'bola-de-basquete': 'Basketball',
  abacaxi: 'Pineapple',
  notebook: 'Laptop',
  tulipa: 'Tulip',
  coelho: 'Rabbit',
  gato: 'Cat',
  cachorro: 'Dog',
  cadeira: 'Chair',
  'guarda-chuva': 'Umbrella',
  violao: 'Guitar',
  pinguim: 'Penguin',
  flamingo: 'Flamingo',
  zebra: 'Zebra',
  vaca: 'Cow',
  cavalo: 'Horse',
  pessoa: 'Person standing/Default',
  bicicleta: 'Bicycle',
  rinoceronte: 'Rhinoceros',
  hipopotamo: 'Hippopotamus',
  lhama: 'Llama',
  bisao: 'Bison',
  cama: 'Bed',
  camelo: 'Camel',
  porta: 'Door',
  trator: 'Tractor',
  mamute: 'Mammoth',
  elefante: 'Elephant',
  moai: 'Moai',
  carro: 'Automobile',
  casa: 'House',
  girafa: 'Giraffe',
  onibus: 'Bus',
  cacto: 'Cactus',
  braquiossauro: 'Sauropod',
  'tiranossauro-rex': 'T-rex',
  coqueiro: 'Palm tree',
  'baleia-azul': 'Whale',
  aviao: 'Airplane',
  'estatua-da-liberdade': 'Statue of liberty',
  'campo-de-futebol': 'Stadium',
  foguete: 'Rocket',
  'roda-gigante': 'Ferris wheel',
  titanic: 'Ship',
  'torre-eiffel': 'Tokyo tower',
  'monte-fuji': 'Mount fuji',
  everest: 'Snow-capped mountain',
  lua: 'Full moon',
  terra: 'Globe showing americas',
  jupiter: 'Ringed planet',
  sol: 'Sun',
};

function arquivoDe(pasta) {
  const [nome, tom] = pasta.split('/');
  const base = nome.toLowerCase().replace(/ /g, '_');
  return tom ? `${nome}/${tom}/3D/${base}_3d_${tom.toLowerCase()}.png` : `${nome}/3D/${base}_3d.png`;
}

/** Corta as bordas em que nada passa de 8 de opacidade (a sombra quase invisível do 3D não conta). */
function cortar(png) {
  let x0 = png.width, y0 = png.height, x1 = -1, y1 = -1;
  for (let y = 0; y < png.height; y++)
    for (let x = 0; x < png.width; x++)
      if (png.data[(y * png.width + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  const largura = x1 - x0 + 1;
  const altura = y1 - y0 + 1;
  const saida = new PNG({ width: largura, height: altura });
  PNG.bitblt(png, saida, x0, y0, largura, altura, 0, 0);
  return saida;
}

fs.mkdirSync(PASTA, { recursive: true });
const medidas = {};
for (const [id, pasta] of Object.entries(FIGURAS)) {
  const resposta = await fetch(BASE + arquivoDe(pasta).split('/').map(encodeURIComponent).join('/'));
  if (!resposta.ok) throw new Error(`${id}: ${resposta.status} em ${pasta}`);
  const figura = cortar(PNG.sync.read(Buffer.from(await resposta.arrayBuffer())));
  fs.writeFileSync(path.join(PASTA, `${id}.png`), PNG.sync.write(figura, { deflateLevel: 9 }));
  medidas[id] = [figura.width, figura.height];
  console.log(id, figura.width, '×', figura.height);
}

const licenca = await (await fetch('https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/LICENSE')).text();
fs.writeFileSync(
  path.join(PASTA, 'LICENCA.txt'),
  `As figuras desta pasta são do Fluent Emoji, da Microsoft (https://github.com/microsoft/fluentui-emoji),\n` +
    `cortadas nas bordas transparentes por web/scripts/figuras-do-tamanho.mjs. A licença delas segue abaixo.\n\n` +
    licenca,
);

fs.writeFileSync(
  path.join(RAIZ, 'src', 'figurasDoTamanho.ts'),
  `// GERADO por web/scripts/figuras-do-tamanho.mjs — não edite à mão.\n` +
    `// A largura e a altura, em pixels, de cada figura de web/public/tamanho/ (já sem a borda transparente).\n` +
    `export const FIGURAS_DO_TAMANHO: Record<string, readonly [number, number]> = {\n` +
    Object.entries(medidas)
      .map(([id, [l, a]]) => `  ${/^[a-z]+$/.test(id) ? id : `'${id}'`}: [${l}, ${a}],`)
      .join('\n') +
    `\n};\n`,
);
