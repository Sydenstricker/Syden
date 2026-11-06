import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { LARGURA, PROFUNDIDADE } from './pista';

/**
 * O QUE FICA EM VOLTA DA PISTA DO SKATE (06/11/2026, pedido dele: "o cenário externo vazio está ruim"). Só enfeite, fora da
 * pista e sem colisão: a física (fisica.ts) nem sabe que existe.
 *
 * Os modelos são CC0 da Kenney, copiados com a licença ao lado: o Coaster Kit (árvores, flores, tufos de grama, bancos, lixeiras
 * e as barraquinhas; web/public/skate/parque/) e o City Kit Suburban (as casinhas, as arvorezinhas e os vasos; web/public/skate/
 * bairro/). Os postes, os morros, as nuvens, o céu e a grama com manchas são feitos aqui, por código.
 *
 * LEVE DE PROPÓSITO: cada modelo repetido é UM InstancedMesh por pedaço dele (uma chamada de desenho para todas as árvores
 * iguais), nada aqui faz nem recebe sombra, e a posição de tudo sai de um sorteio com semente fixa (o mesmo parque sempre).
 */

export const MODELOS_DO_ENTORNO = [
  'parque/tree',
  'parque/tree-large',
  'parque/bench',
  'parque/flowers',
  'parque/grass',
  'parque/trash',
  'parque/stall-drinks',
  'parque/stall-food',
  'bairro/building-type-a',
  'bairro/building-type-c',
  'bairro/building-type-e',
  'bairro/building-type-g',
  'bairro/building-type-j',
  'bairro/building-type-m',
  'bairro/tree-large',
  'bairro/tree-small',
  'bairro/planter',
] as const;

type Nome = (typeof MODELOS_DO_ENTORNO)[number];

/** Um lugar: onde, o giro (em radianos, em torno do eixo vertical) e a escala. */
interface Lugar {
  x: number;
  z: number;
  giro: number;
  escala: number;
}

/** Um sorteio com semente (o mesmo parque a cada sessão). */
function sorteio(semente: number) {
  let s = semente >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** O concreto em volta da pista vai até 2 casas além dela (cena.ts); daí para fora é grama. */
const CONCRETO = 2;
const CX = LARGURA / 2;
const CZ = PROFUNDIDADE / 2;

/** A distância (em casas) de um ponto até o retângulo da pista, por fora. */
function foraDaPista(x: number, z: number): number {
  const dx = Math.max(0, -x, x - LARGURA);
  const dz = Math.max(0, -z, z - PROFUNDIDADE);
  return Math.sqrt(dx * dx + dz * dz);
}

/** Onde vai cada coisa. Separado do three.js para o teste conferir que nada cai na pista nem no concreto. */
export function lugaresDoEntorno(): Map<Nome, Lugar[]> {
  const r = sorteio(20261106);
  const l = new Map<Nome, Lugar[]>();
  const por = (n: Nome, x: number, z: number, giro: number, escala: number) => {
    let lista = l.get(n);
    if (!lista) l.set(n, (lista = []));
    lista.push({ x, z, giro, escala });
  };

  // AS CASINHAS, em quatro ruas em volta do parque, viradas para ele (o modelo olha para +z)
  const casas: Nome[] = ['bairro/building-type-a', 'bairro/building-type-c', 'bairro/building-type-e', 'bairro/building-type-g', 'bairro/building-type-j', 'bairro/building-type-m'];
  const RUA = 13;
  let k = 0;
  const casa = (x: number, z: number, giro: number) => {
    por(casas[k++ % casas.length], x, z, giro, 3.1 + r() * 0.5);
    // um vaso e uma arvorezinha na frente de algumas
    if (r() < 0.5) por('bairro/planter', x + Math.sin(giro) * 2.4 + (r() - 0.5), z + Math.cos(giro) * 2.4, giro, 3);
    if (r() < 0.6) por(r() < 0.5 ? 'bairro/tree-large' : 'bairro/tree-small', x + Math.sin(giro + 1.2) * 3, z + Math.cos(giro + 1.2) * 3, r() * 6.28, 4 + r());
  };
  for (let x = -10; x <= LARGURA + 10; x += 5.5) {
    casa(x + (r() - 0.5), -RUA, 0);
    casa(x + (r() - 0.5), PROFUNDIDADE + RUA, Math.PI);
  }
  for (let z = -4; z <= PROFUNDIDADE + 4; z += 5.5) {
    casa(-RUA, z + (r() - 0.5), Math.PI / 2);
    casa(LARGURA + RUA, z + (r() - 0.5), -Math.PI / 2);
  }

  // AS ÁRVORES, numa faixa de grama entre o concreto e as ruas: uma grade com sacudida, e uma vaga para cada
  for (let x = -11; x <= LARGURA + 11; x += 2.6) {
    for (let z = -11; z <= PROFUNDIDADE + 11; z += 2.6) {
      const px = x + (r() - 0.5) * 2;
      const pz = z + (r() - 0.5) * 2;
      const d = foraDaPista(px, pz);
      if (d < CONCRETO + 2.2 || d > 9.5 || r() < 0.45) continue;
      por(r() < 0.55 ? 'parque/tree' : 'parque/tree-large', px, pz, r() * 6.28, 1.9 + r() * 0.9);
    }
  }
  // TUFOS DE GRAMA E FLORES, mais perto do concreto
  for (let i = 0; i < 140; i++) {
    const a = r() * 6.28;
    const raio = 12 + r() * 8;
    const px = CX + Math.cos(a) * raio * 1.05;
    const pz = CZ + Math.sin(a) * raio * 1.25;
    const d = foraDaPista(px, pz);
    if (d < CONCRETO + 0.5 || d > 10) continue;
    por(r() < 0.65 ? 'parque/grass' : 'parque/flowers', px, pz, r() * 6.28, 1.2 + r() * 0.8);
  }

  // NA BEIRA DO CONCRETO: bancos olhando a pista, lixeiras ao lado, e as duas barraquinhas nas pontas
  for (const z of [2, 6, 12, 16]) {
    por('parque/bench', -CONCRETO - 0.6, z, Math.PI / 2, 1.3);
    por('parque/bench', LARGURA + CONCRETO + 0.6, z, -Math.PI / 2, 1.3);
  }
  for (const z of [4, 14]) {
    por('parque/trash', -CONCRETO - 0.6, z, 0, 1.3);
    por('parque/trash', LARGURA + CONCRETO + 0.6, z, 0, 1.3);
  }
  por('parque/stall-drinks', -CONCRETO - 1.6, -CONCRETO - 1.2, Math.PI / 4, 1.5);
  por('parque/stall-food', LARGURA + CONCRETO + 1.6, PROFUNDIDADE + CONCRETO + 1.2, (-3 * Math.PI) / 4, 1.5);
  return l;
}

/** Os postes de luz, pela beira do concreto (onde o skatista não chega). */
export function lugaresDosPostes(): [number, number][] {
  const p: [number, number][] = [];
  const b = CONCRETO - 0.35;
  for (const z of [0, 6, 12, 18]) p.push([-b, z], [LARGURA + b, z]);
  for (const x of [3, 9]) p.push([x, -b], [x, PROFUNDIDADE + b]);
  return p;
}

const aux = new THREE.Matrix4();
const q = new THREE.Quaternion();
const CIMA = new THREE.Vector3(0, 1, 0);

/** Um InstancedMesh para cada pedaço do modelo, com todos os lugares dele. */
function instanciar(g: GLTF, lugares: Lugar[], grupo: THREE.Group, descartaveis: { dispose(): void }[]) {
  const matrizes = lugares.map((p) => new THREE.Matrix4().compose(new THREE.Vector3(p.x, 0, p.z), q.clone().setFromAxisAngle(CIMA, p.giro), new THREE.Vector3(p.escala, p.escala, p.escala)));
  g.scene.updateMatrixWorld(true);
  g.scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const im = new THREE.InstancedMesh(m.geometry, m.material, matrizes.length);
    matrizes.forEach((mt, i) => im.setMatrixAt(i, aux.multiplyMatrices(mt, m.matrixWorld)));
    im.instanceMatrix.needsUpdate = true;
    im.computeBoundingSphere();
    grupo.add(im);
    // a geometria e o material são do modelo (no cache de cena.ts); só o buffer das posições é nosso
    descartaveis.push(im);
  });
}

/** Uma textura de grama com manchas (pintada aqui), repetida pelo chão todo. */
function texturaDaGrama(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#86b06a';
  g.fillRect(0, 0, 256, 256);
  const r = sorteio(7);
  const tons = ['#7aa660', '#92ba74', '#80ab64', '#9cc27c', '#74a05c'];
  for (let i = 0; i < 70; i++) {
    g.fillStyle = tons[i % tons.length];
    g.globalAlpha = 0.5 + r() * 0.4;
    const x = r() * 256;
    const y = r() * 256;
    const raio = 8 + r() * 26;
    // repetida nas bordas, para a emenda não aparecer
    for (const [dx, dy] of [[0, 0], [256, 0], [-256, 0], [0, 256], [0, -256]]) {
      g.beginPath();
      g.ellipse(x + dx, y + dy, raio, raio * (0.6 + r() * 0.5), r() * 3, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(14, 14);
  t.anisotropy = 4;
  return t;
}

/** Os materiais e as geometrias feitos aqui vão embora com a cena (`proprio`, como em cena.ts). */
function proprio<T extends THREE.Object3D>(o: T): T {
  o.userData.proprio = true;
  return o;
}

/**
 * Monta o entorno na cena: o céu, a grama, os morros, as nuvens, os postes e os modelos que carregaram (o que faltar, fica de
 * fora: o enfeite não segura o jogo). Devolve as cores do horizonte, para a neblina acompanhar.
 */
export function montarEntorno(cena: THREE.Scene, modelos: Map<string, GLTF>, descartaveis: { dispose(): void }[], sombras: boolean) {
  const grupo = new THREE.Group();
  cena.add(grupo);
  const HORIZONTE = '#d6ecf3';

  // O CÉU: uma cúpula com o degradê (o alto azul, o horizonte claro), que não recebe neblina
  const ceuGeo = new THREE.SphereGeometry(120, 24, 12);
  const cores: number[] = [];
  const alto = new THREE.Color('#79b4e3');
  const baixo = new THREE.Color(HORIZONTE);
  const pos = ceuGeo.attributes.position;
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const h = Math.max(0, pos.getY(i) / 120);
    c.copy(baixo).lerp(alto, Math.pow(h, 0.6));
    cores.push(c.r, c.g, c.b);
  }
  ceuGeo.setAttribute('color', new THREE.Float32BufferAttribute(cores, 3));
  const ceu = proprio(new THREE.Mesh(ceuGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false })));
  ceu.position.set(CX, 0, CZ);
  ceu.renderOrder = -1;
  grupo.add(ceu);

  // A GRAMA com manchas
  const tex = texturaDaGrama();
  descartaveis.push(tex);
  const grama = proprio(new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ map: tex, roughness: 1 })));
  grama.rotation.x = -Math.PI / 2;
  grama.position.set(CX, -0.01, CZ);
  grama.receiveShadow = sombras;
  grupo.add(grama);

  // OS MORROS, longe, numa volta (esfera achatada, em verdes que a neblina clareia)
  const r = sorteio(99);
  const morroGeo = new THREE.IcosahedronGeometry(1, 1);
  const verdes = ['#7da763', '#6f9a5a', '#88b06c'].map((v) => new THREE.MeshStandardMaterial({ color: v, roughness: 1, flatShading: true }));
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2 + r() * 0.2;
    const raio = 48 + r() * 14;
    const m = new THREE.Mesh(morroGeo, verdes[i % verdes.length]);
    const larg = 9 + r() * 9;
    m.scale.set(larg, 3 + r() * 5, larg * (0.7 + r() * 0.4));
    m.position.set(CX + Math.cos(a) * raio, -1, CZ + Math.sin(a) * raio);
    m.rotation.y = r() * 3;
    grupo.add(m);
  }
  descartaveis.push(morroGeo, ...verdes);

  // AS NUVENS: punhados de bolas brancas, paradas no alto
  const nuvemGeo = new THREE.IcosahedronGeometry(1, 1);
  const branco = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, flatShading: true, emissive: '#dfe9ee', emissiveIntensity: 0.35, fog: false });
  descartaveis.push(nuvemGeo, branco);
  const bolas: THREE.Matrix4[] = [];
  for (let i = 0; i < 11; i++) {
    const a = r() * Math.PI * 2;
    const raio = 30 + r() * 40;
    const nx = CX + Math.cos(a) * raio;
    const nz = CZ + Math.sin(a) * raio;
    const ny = 16 + r() * 10;
    const n = 3 + Math.floor(r() * 3);
    for (let j = 0; j < n; j++) {
      const s = 2.2 + r() * 2;
      bolas.push(new THREE.Matrix4().compose(new THREE.Vector3(nx + (j - n / 2) * 2.6, ny + r() * 1.2, nz + (r() - 0.5) * 2), new THREE.Quaternion(), new THREE.Vector3(s, s * 0.6, s)));
    }
  }
  const nuvens = new THREE.InstancedMesh(nuvemGeo, branco, bolas.length);
  bolas.forEach((m, i) => nuvens.setMatrixAt(i, m));
  nuvens.computeBoundingSphere();
  descartaveis.push(nuvens);
  grupo.add(nuvens);

  // OS POSTES: o cano e a luminária (que brilha um pouco: é dia, mas ela ainda se lê como lâmpada)
  const lugares = lugaresDosPostes();
  const canoGeo = new THREE.CylinderGeometry(0.04, 0.055, 2, 8);
  canoGeo.translate(0, 1, 0);
  const bracoGeo = new THREE.BoxGeometry(0.42, 0.05, 0.06);
  bracoGeo.translate(0.18, 1.96, 0);
  const lampGeo = new THREE.BoxGeometry(0.2, 0.08, 0.14);
  lampGeo.translate(0.36, 1.91, 0);
  const ferro = new THREE.MeshStandardMaterial({ color: '#6b7178', roughness: 0.55, metalness: 0.2 });
  const luz = new THREE.MeshStandardMaterial({ color: '#fff3cf', emissive: '#ffe7a8', emissiveIntensity: 0.8 });
  descartaveis.push(canoGeo, bracoGeo, lampGeo, ferro, luz);
  for (const [geo, mat] of [
    [canoGeo, ferro],
    [bracoGeo, ferro],
    [lampGeo, luz],
  ] as const) {
    const im = new THREE.InstancedMesh(geo, mat, lugares.length);
    lugares.forEach(([x, z], i) => {
      // o braço aponta para a pista
      const giro = x < 0 ? 0 : x > LARGURA ? Math.PI : z < 0 ? -Math.PI / 2 : Math.PI / 2;
      im.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromAxisAngle(CIMA, giro), new THREE.Vector3(1, 1, 1)));
    });
    im.computeBoundingSphere();
    descartaveis.push(im);
    grupo.add(im);
  }

  // OS MODELOS
  for (const [nome, lista] of lugaresDoEntorno()) {
    const g = modelos.get(nome);
    if (g) instanciar(g, lista, grupo, descartaveis);
  }
  return { horizonte: HORIZONTE };
}
