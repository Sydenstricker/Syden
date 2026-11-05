// OS MODELOS DE "TOCAS E TORRES" (05/11/2026). Tira de e2e/3D/Assets SÓ o que o jogo usa e grava em web/public/tocas/, com a
// licença de cada pacote ao lado (todos CC0):
//  - quaternius/: os prédios por era, as árvores, o ouro e as montanhas do Ultimate Fantasy RTS (Quaternius). Os .gltf de lá
//    trazem o buffer em base64 dentro do texto; aqui viram .glb (o mesmo conteúdo, ~25% menor, um arquivo só).
//  - castelo/: a muralha, o portão, a torre do canto e a catapulta (inteira e destruída) do Castle Kit (Kenney), copiados como
//    estão, com a textura de cores (Textures/colormap.png) que eles apontam.
//  - recursos/: as pilhas de comida, madeira e ouro e o que o trabalhador carrega, do Resource Bits (KayKit). Os .gltf + .bin
//    viram .glb, e a textura comum (resource_bits_texture.png) fica ao lado, apontada por eles.
//
//   node web/scripts/tocas-modelos.mjs
//
// Modelo novo: uma linha numa das listas, e rodar de novo. Os PNG pedem `git add -f` (o .gitignore pega *.png).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const ASSETS = path.join(RAIZ, 'e2e', '3D', 'Assets');
const SAIDA = path.join(RAIZ, 'web', 'public', 'tocas');

const QUATERNIUS = [
  'TowerHouse_FirstAge',
  'TowerHouse_SecondAge',
  'Houses_FirstAge_1_Level3',
  'Houses_SecondAge_1_Level3',
  'Farm_FirstAge_Level3',
  'Farm_FirstAge_Level3_Wheat',
  'Farm_SecondAge_Level3_Wheat',
  'Barracks_FirstAge_Level3',
  'Barracks_SecondAge_Level3',
  'Archery_FirstAge_Level3',
  'Archery_SecondAge_Level3',
  'WatchTower_FirstAge_Level3',
  'WatchTower_SecondAge_Level1',
  'Wonder_SecondAge_Level3',
  'Resource_Tree1',
  'Resource_Tree2',
  'Resource_PineTree',
  'Resource_Gold_1',
  'Mountain_Single',
];
const KENNEY = ['wall', 'wall-doorway', 'tower-base', 'siege-catapult', 'siege-catapult-demolished'];
const KAYKIT = [
  'Wood_Log_A',
  'Wood_Log_Stack',
  'Wood_Planks_Stack_Medium',
  'Wood_Planks_Stack_Large',
  'Gold_Nugget_Medium',
  'Gold_Bars_Stack_Small',
  'Gold_Bars_Stack_Medium',
  'Gold_Bars_Stack_Large',
  'Food_Basket_A_Berries',
  'Food_Crate_Small_Berries',
  'Food_Crate_Large_Apples',
  'Food_Pile_Large',
];

/** Um .gltf (buffers em base64 ou em .bin ao lado) vira .glb: um JSON e um BIN, alinhados em 4. As imagens continuam por uri. */
function paraGlb(arquivo) {
  const pasta = path.dirname(arquivo);
  const g = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
  const pedacos = [];
  const inicio = [];
  let total = 0;
  for (const b of g.buffers ?? []) {
    let dados;
    if (b.uri?.startsWith('data:')) dados = Buffer.from(b.uri.slice(b.uri.indexOf(',') + 1), 'base64');
    else dados = fs.readFileSync(path.join(pasta, decodeURIComponent(b.uri)));
    inicio.push(total);
    pedacos.push(dados);
    total += dados.length;
    const sobra = (4 - (total % 4)) % 4;
    if (sobra) {
      pedacos.push(Buffer.alloc(sobra));
      total += sobra;
    }
  }
  for (const v of g.bufferViews ?? []) {
    v.byteOffset = (v.byteOffset ?? 0) + inicio[v.buffer ?? 0];
    v.buffer = 0;
  }
  const bin = Buffer.concat(pedacos);
  g.buffers = [{ byteLength: bin.length }];
  let json = Buffer.from(JSON.stringify(g), 'utf8');
  const sobraJson = (4 - (json.length % 4)) % 4;
  if (sobraJson) json = Buffer.concat([json, Buffer.alloc(sobraJson, 0x20)]);
  const cab = Buffer.alloc(12);
  cab.writeUInt32LE(0x46546c67, 0);
  cab.writeUInt32LE(2, 4);
  cab.writeUInt32LE(12 + 8 + json.length + 8 + bin.length, 8);
  const cj = Buffer.alloc(8);
  cj.writeUInt32LE(json.length, 0);
  cj.writeUInt32LE(0x4e4f534a, 4);
  const cb = Buffer.alloc(8);
  cb.writeUInt32LE(bin.length, 0);
  cb.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([cab, cj, json, cb, bin]);
}

function gravar(destino, dados) {
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.writeFileSync(destino, dados);
  return dados.length;
}

let soma = 0;
const quat = path.join(ASSETS, 'Age of Empires', 'glTF');
for (const n of QUATERNIUS) soma += gravar(path.join(SAIDA, 'quaternius', `${n}.glb`), paraGlb(path.join(quat, `${n}.gltf`)));
soma += gravar(path.join(SAIDA, 'License-quaternius.txt'), fs.readFileSync(path.join(ASSETS, 'Age of Empires', 'License.txt')));

const ken = path.join(ASSETS, 'kenney_castle-kit', 'Models', 'GLB format');
for (const n of KENNEY) soma += gravar(path.join(SAIDA, 'castelo', `${n}.glb`), fs.readFileSync(path.join(ken, `${n}.glb`)));
soma += gravar(path.join(SAIDA, 'castelo', 'Textures', 'colormap.png'), fs.readFileSync(path.join(ken, 'Textures', 'colormap.png')));
soma += gravar(path.join(SAIDA, 'License-kenney-castle.txt'), fs.readFileSync(path.join(ASSETS, 'kenney_castle-kit', 'License.txt')));

const kk = path.join(ASSETS, 'KayKit_ResourceBits_1.0_EXTRA', 'KayKit_ResourceBits_1.0_EXTRA');
for (const n of KAYKIT) soma += gravar(path.join(SAIDA, 'recursos', `${n}.glb`), paraGlb(path.join(kk, 'Assets', 'gltf', `${n}.gltf`)));
soma += gravar(path.join(SAIDA, 'recursos', 'resource_bits_texture.png'), fs.readFileSync(path.join(kk, 'Assets', 'gltf', 'resource_bits_texture.png')));
soma += gravar(path.join(SAIDA, 'License-kaykit-resource.txt'), fs.readFileSync(path.join(kk, 'License.txt')));

console.log(`web/public/tocas: ${(soma / 1024 / 1024).toFixed(2)} MB`);
