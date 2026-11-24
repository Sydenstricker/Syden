import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * OS MODELOS NOSSOS (24/11/2026): os GLB feitos por script no Blender (web/scripts/modelos/), sem textura, com a cor chapada no
 * material. Este módulo os carrega (uma vez por arquivo) e os transforma em UMA geometria com a cor em cada vértice, o formato
 * das peças por código dos jogos (um objeto, uma chamada de desenho, o mesmo material de cor por vértice).
 *
 * Quem usa mantém a peça por código de RESERVA: `carregarNosso` nunca rejeita, devolve null se o arquivo faltar ou falhar.
 * Modelos comuns a vários jogos moram em `comum/` (a cenoura: `comum/cenoura.glb`, nós "corpo" e "folhas").
 */
const carregados = new Map<string, Promise<GLTF | null>>();
export function carregarNosso(caminho: string): Promise<GLTF | null> {
  let p = carregados.get(caminho);
  if (!p) {
    p = new GLTFLoader()
      .loadAsync(`${import.meta.env.BASE_URL}${caminho}`)
      .then((g) => g as GLTF | null)
      .catch(() => {
        carregados.delete(caminho);
        return null;
      });
    carregados.set(caminho, p);
  }
  return p;
}

/**
 * Tudo o que está debaixo do nó `nome` (ou a cena inteira), junto numa geometria só, não indexada, com `position`, `normal` e
 * `color` (a cor do material de cada malha). As posições ficam no espaço da cena do GLB (Y para cima, as medidas do script).
 */
export function geometriaComCor(g: GLTF, nome?: string): THREE.BufferGeometry | null {
  const raiz = nome ? g.scene.getObjectByName(nome) : g.scene;
  if (!raiz) return null;
  g.scene.updateMatrixWorld(true);
  const partes: THREE.BufferGeometry[] = [];
  raiz.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const materiais = Array.isArray(m.material) ? m.material : [m.material];
    // o glTF parte a malha por material em primitivas (cada uma uma Mesh), mas aceita grupos também
    const base = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
    base.applyMatrix4(m.matrixWorld);
    const n = base.attributes.position.count;
    const cores = new Float32Array(n * 3);
    const corDe = (k: number) => ((materiais[k] ?? materiais[0]) as THREE.MeshStandardMaterial).color ?? new THREE.Color(1, 1, 1);
    const grupos = base.groups.length ? base.groups : [{ start: 0, count: n, materialIndex: 0 }];
    for (const gr of grupos) {
      const c = corDe(gr.materialIndex ?? 0);
      for (let k = gr.start; k < Math.min(n, gr.start + gr.count); k++) cores.set([c.r, c.g, c.b], k * 3);
    }
    base.setAttribute('color', new THREE.BufferAttribute(cores, 3));
    for (const a of Object.keys(base.attributes)) if (a !== 'position' && a !== 'normal' && a !== 'color') base.deleteAttribute(a);
    if (!base.attributes.normal) base.computeVertexNormals();
    base.clearGroups();
    partes.push(base);
  });
  if (!partes.length) return null;
  const junta = mergeGeometries(partes);
  for (const p of partes) p.dispose();
  return junta;
}
