import * as THREE from 'three';
import { carregarModelo, copiaDe, iluminar, marcaPlana, MesaBase } from './base';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * AS DAMAS EM 3D (05/11/2026, pedido dele): o tabuleiro do KayKit (o mesmo do xadrez) numa mesa de madeira, as pedras
 * (`checker_*_single`) e as damas (`_double`, a pedra empilhada). A peça do último lance anda casa a casa pelo caminho dele,
 * pulando quando come, e as comidas saem quando ela pousa (a regra brasileira: a comida sai só no fim do lance); a pedra que
 * chega à última fileira vira dama ao pousar. As casas que valem acendem como no 2D. O clique é na casa (o raio no plano do
 * tabuleiro), e quem decide o que ele faz é o JogoDamas.tsx, o mesmo clique dos botões.
 */

export interface DamasDaCena {
  /** 64 casas, linha 0 no alto: 0 vazia, 1 pedra clara, 2 dama clara, 3 pedra escura, 4 dama escura. */
  casas: number[];
  girado: boolean;
  escolhida: number | null;
  obrigatorias: number[];
  prefixo: number[];
  destinos: number[];
  aComer: number[];
  /** As casas que o clique leva a algum lugar (vazio fora da vez). */
  clicaveis: number[];
  ultimo: { de: number; caminho: number[]; comidas: number[] } | null;
}

const ARQUIVO: Record<number, string> = { 1: 'checker_white_single', 2: 'checker_white_double', 3: 'checker_black_single', 4: 'checker_black_double' };
const TOPO = 0.3;
const TRECHO = 260;
const posDa = (i: number) => new THREE.Vector3((i % 8) - 3.5, TOPO, Math.floor(i / 8) - 3.5);
const clara = (v: number) => v === 1 || v === 2;
const PARADA = new THREE.Quaternion();

interface Peca {
  obj: THREE.Object3D;
  valor: number;
  /** O valor que ela terá ao pousar (a pedra que vira dama no fim do caminho). */
  pousa: number;
}

export class Damas3D extends MesaBase<DamasDaCena> {
  private modelos = new Map<number, GLTF>();
  private pecas = new Map<number, Peca>();
  private marcas: THREE.Mesh[] = [];
  private geoCasa = new THREE.PlaneGeometry(0.96, 0.96);
  private geoPonto = new THREE.CircleGeometry(0.2, 24);
  private ultimoVisto = '';
  private girado: boolean | null = null;

  protected async carregarTudo() {
    const [tab, ...pecas] = await Promise.all([carregarModelo('board_A'), ...[1, 2, 3, 4].map((v) => carregarModelo(ARQUIVO[v]))]);
    pecas.forEach((g, k) => this.modelos.set(k + 1, g));
    this.descartaveis.push(this.geoCasa, this.geoPonto);
    this.cena.background = new THREE.Color('#2b2430');
    iluminar(this.cena, this.sombras);
    const mesaGeo = new THREE.CylinderGeometry(9, 9, 0.6, 48);
    const mesaMat = new THREE.MeshStandardMaterial({ color: '#8a5a3c', roughness: 0.8 });
    this.descartaveis.push(mesaGeo, mesaMat);
    const mesa = new THREE.Mesh(mesaGeo, mesaMat);
    mesa.position.y = -0.3;
    mesa.receiveShadow = this.sombras;
    this.cena.add(mesa);
    const t = copiaDe(tab, false);
    t.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.receiveShadow = this.sombras;
    });
    this.cena.add(t);
  }

  protected enquadrar(aspecto: number) {
    const lado = this.dados?.girado ? -1 : 1;
    const longe = Math.max(1, 1.1 / aspecto);
    this.camera.fov = 34;
    this.camera.position.set(0, 12.5 * longe, 9.5 * lado * longe);
    this.camera.lookAt(0, 0, 0.6 * lado);
  }

  private nova(valor: number, i: number): Peca | null {
    const g = this.modelos.get(valor);
    if (!g) return null;
    const obj = copiaDe(g, this.sombras);
    obj.scale.setScalar(0.92);
    obj.position.copy(posDa(i));
    this.cena.add(obj);
    return { obj, valor, pousa: valor };
  }
  private tirar(p: Peca) {
    this.cena.remove(p.obj);
  }

  protected aplicar(d: DamasDaCena) {
    if (this.girado !== d.girado) {
      this.girado = d.girado;
      this.enquadrar(this.camera.aspect);
      this.camera.updateProjectionMatrix();
    }
    const assinatura = JSON.stringify(d.ultimo);
    const novoLance = !!d.ultimo && assinatura !== this.ultimoVisto && this.pecas.size > 0;
    this.ultimoVisto = assinatura;
    let andou: Peca | null = null;
    if (novoLance && d.ultimo) {
      const u = d.ultimo;
      const fim = u.caminho[u.caminho.length - 1];
      const p = this.pecas.get(u.de);
      const chegou = d.casas[fim] ?? 0;
      if (p && fim !== undefined && chegou && clara(chegou) === clara(p.valor)) {
        this.pecas.delete(u.de);
        // a comida sai quando a peça pousa no fim
        const comidas = u.comidas.map((c) => this.pecas.get(c)).filter((q): q is Peca => !!q && q !== p);
        for (const c of u.comidas) if (this.pecas.get(c) !== p) this.pecas.delete(c);
        const ja = this.pecas.get(fim);
        if (ja && ja !== p) this.tirar(ja);
        this.pecas.set(fim, p);
        p.pousa = chegou;
        andou = p;
        const pontos = [p.obj.position.clone(), ...u.caminho.map(posDa)];
        const come = u.comidas.length > 0;
        this.mover(p.obj, pontos, PARADA, TRECHO, come ? 0.55 : 0.18, 0, () => {
          for (const c of comidas) this.tirar(c);
          // virou dama ao pousar
          if (p.pousa !== p.valor && this.pecas.get(fim) === p) {
            this.tirar(p);
            const n = this.nova(p.pousa, fim);
            if (n) this.pecas.set(fim, n);
            else this.pecas.delete(fim);
          }
          this.pedirDesenho();
        });
      }
    }
    for (let i = 0; i < 64; i++) {
      const v = d.casas[i] ?? 0;
      const ja = this.pecas.get(i);
      if (ja === andou && andou) continue;
      if (ja && ja.valor === v) {
        if (this.parado(ja.obj)) ja.obj.position.copy(posDa(i));
        continue;
      }
      if (ja) {
        this.tirar(ja);
        this.pecas.delete(i);
      }
      if (!v) continue;
      const n = this.nova(v, i);
      if (n) this.pecas.set(i, n);
    }
    // as marcas: o caminho do último lance, as comidas, a obrigatória, a escolhida, o caminho em escolha e os pousos
    for (const m of this.marcas) {
      this.cena.remove(m);
      (m.material as THREE.Material).dispose();
    }
    this.marcas = [];
    const marcar = (i: number, cor: string, opacidade: number, ponto = false) => {
      const m = marcaPlana(ponto ? this.geoPonto : this.geoCasa, cor, opacidade);
      m.position.copy(posDa(i)).setY(TOPO + 0.006);
      this.cena.add(m);
      this.marcas.push(m);
    };
    if (d.ultimo) {
      for (const i of [d.ultimo.de, ...d.ultimo.caminho]) marcar(i, '#e3c45a', 0.38);
      for (const i of d.ultimo.comidas) if (!d.casas[i]) marcar(i, '#e2453a', 0.25);
    }
    for (const i of d.obrigatorias) if (i !== d.escolhida) marcar(i, '#f0a04a', 0.45);
    if (d.escolhida !== null) marcar(d.escolhida, '#6fd08a', 0.6);
    for (const i of d.prefixo) marcar(i, '#6fd08a', 0.35);
    for (const i of d.aComer) marcar(i, '#e2453a', 0.5);
    for (const i of d.destinos) marcar(i, '#6fd08a', 0.75, true);
  }

  protected alvoNoRaio(raio: THREE.Raycaster): number | null {
    const p = new THREE.Vector3();
    if (!raio.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -TOPO), p)) return null;
    const c = Math.floor(p.x + 4);
    const l = Math.floor(p.z + 4);
    if (c < 0 || l < 0 || c > 7 || l > 7) return null;
    const i = l * 8 + c;
    return this.dados?.clicaveis.includes(i) ? i : null;
  }

  destruir() {
    for (const m of this.marcas) (m.material as THREE.Material).dispose();
    super.destruir();
  }
}

export const criarDamas3D = (caixa: HTMLElement, aoClicar: (i: number) => void) => new Damas3D(caixa, aoClicar);
