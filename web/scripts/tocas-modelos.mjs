// OS MODELOS DE "TOCAS E TORRES" (05/11/2026; o conjunto trocado em 06/11/2026). Tira de e2e/3D/Assets SÓ o que o jogo usa e
// grava em web/public/tocas/, com a licença de cada pacote ao lado (todos CC0):
//  - medieval/: os prédios por time (azul e vermelho), a muralha e o portão, as obras, as ruínas, a catapulta, as armas, as
//    flechas, a pedra da catapulta, as bandeiras, as árvores e as pedras do Medieval Hexagon Pack (KayKit). Os .gltf + .bin
//    viram .glb, e a textura comum (hexagons_medieval.png, uma paleta só para o pacote inteiro) fica ao lado, apontada por eles.
//    Os ladrilhos hexagonais do pacote NÃO entram: a grade do jogo é quadrada.
//  - recursos/: as pilhas de comida, madeira e ouro, o que o trabalhador carrega e as pepitas da mina, do Resource Bits
//    (KayKit), do mesmo jeito.
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

/** Do Medieval Hexagon (caminho dentro de Assets/gltf, sem extensão); "{cor}" vira um arquivo por time. */
const MEDIEVAL = [
  ...['townhall', 'castle', 'home_A', 'home_B', 'barracks', 'archeryrange', 'tower_A', 'tower_B', 'tower_base', 'windmill'].map((n) => `buildings/{cor}/building_${n}_{cor}`),
  ...['catapult', 'projectile_arrow', 'spear', 'bow', 'sword', 'shield'].map((n) => `units/{cor}/${n}_{cor}_accent`),
  'decoration/props/flag_{cor}',
  ...['building_grain', 'wall_straight', 'wall_straight_gate', 'building_stage_A', 'building_stage_B', 'building_stage_C', 'building_destroyed'].map((n) => `buildings/neutral/${n}`),
  'units/neutral/catapult',
  'units/neutral/projectile_catapult',
  'units/neutral/hammer',
  ...['tree_single_A', 'tree_single_B', 'trees_A_small', 'tree_single_A_cut', 'mountain_A', 'rock_single_D', 'rock_single_E'].map((n) => `decoration/nature/${n}`),
];
const CORES = ['blue', 'red'];
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
  'Gold_Nuggets',
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
const mh = path.join(ASSETS, 'KayKit_Medieval_Hexagon_Pack_1.0_EXTRA', 'KayKit_Medieval_Hexagon_Pack_1.0_EXTRA');
for (const n of MEDIEVAL)
  for (const cor of n.includes('{cor}') ? CORES : [''])
    soma += gravar(path.join(SAIDA, 'medieval', `${path.basename(n).replaceAll('{cor}', cor)}.glb`), paraGlb(path.join(mh, 'Assets', 'gltf', `${n.replaceAll('{cor}', cor)}.gltf`)));
soma += gravar(path.join(SAIDA, 'medieval', 'hexagons_medieval.png'), fs.readFileSync(path.join(mh, 'Textures', 'hexagons_medieval.png')));
soma += gravar(path.join(SAIDA, 'License-kaykit-medieval.txt'), fs.readFileSync(path.join(mh, 'License.txt')));

const kk = path.join(ASSETS, 'KayKit_ResourceBits_1.0_EXTRA', 'KayKit_ResourceBits_1.0_EXTRA');
for (const n of KAYKIT) soma += gravar(path.join(SAIDA, 'recursos', `${n}.glb`), paraGlb(path.join(kk, 'Assets', 'gltf', `${n}.gltf`)));
soma += gravar(path.join(SAIDA, 'recursos', 'resource_bits_texture.png'), fs.readFileSync(path.join(kk, 'Assets', 'gltf', 'resource_bits_texture.png')));
soma += gravar(path.join(SAIDA, 'License-kaykit-resource.txt'), fs.readFileSync(path.join(kk, 'License.txt')));

console.log(`web/public/tocas: ${(soma / 1024 / 1024).toFixed(2)} MB`);
