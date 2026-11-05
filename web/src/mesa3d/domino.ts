import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { carregarModelo, copiaDe, giro, iluminar, MesaBase } from './base';

/**
 * O DOMINÓ EM 3D (05/11/2026, pedido dele): as pedras do KayKit (`domino_tile_a-b`, o 6-6 inteiro) num feltro. A corrente
 * deita no meio e QUEBRA EM LINHAS como no 2D, com as duplas atravessadas; a minha mão fica em pé na minha frente, e as que
 * servem acendem; as dos outros, de costas, em fila no alto, na ordem da lista de nomes de cima. A pedra jogada vai da mão (ou
 * do alto, se foi de outro) para o lugar dela na corrente, e as outras escorregam para abrir espaço. A pedra que serve nas duas
 * pontas, escolhida, acende as duas pontas da corrente para o clique. As regras moram no servidor; a tela só mostra e pede.
 */

export type Pedra = [number, number];
export interface DominoDaCena {
  mesa: Pedra[];
  mao: Pedra[];
  /** Os índices da mão que servem agora (vazio fora da minha vez). */
  servem: number[];
  /** A pedra da mão esperando a escolha da ponta, ou null. */
  escolhida: number | null;
  /** Quantas pedras tem cada um dos outros, na ordem da mesa. */
  outros: number[];
}

/** Os alvos do clique além dos índices da mão. */
export const PONTA_ESQUERDA = -1;
export const PONTA_DIREITA = -2;

const ESCALA = 0.42;
const CURTO = 1 * ESCALA;
const LONGO = 2 * ESCALA;
const GROSSO = 0.277 * ESCALA;
const FOLGA = 0.04;
const LINHA = 6.6;
const chaveDa = (p: Pedra) => `${Math.min(p[0], p[1])}-${Math.max(p[0], p[1])}`;
const DE_PE = giro(1.13, 0, 0);

interface Peca {
  obj: THREE.Group;
  /** O material próprio da pedra (cópia do do modelo), para ela acender quando serve. */
  mat: THREE.MeshStandardMaterial;
  alvo: number | null;
  onde: string;
}
interface Lugar {
  pos: THREE.Vector3;
  q: THREE.Quaternion;
  alvo: number | null;
  /** A da mão é maior, para ler e clicar. */
  escala?: number;
  acesa?: boolean;
}
const NA_MAO = 1.3;

export class Domino3D extends MesaBase<DominoDaCena> {
  private modelos = new Map<string, GLTF>();
  private pecas = new Map<string, Peca>();
  private geoLuz = new THREE.PlaneGeometry(CURTO * 1.35, LONGO * 1.2);
  private matPonta = new THREE.MeshBasicMaterial({ color: '#7be39a', transparent: true, opacity: 0.6, depthWrite: false });
  private pontas: THREE.Mesh[] = [];
  private montado = false;

  protected async carregarTudo() {
    const nomes: string[] = [];
    for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) nomes.push(`${a}-${b}`);
    const lista = await Promise.all(nomes.map((n) => carregarModelo(`domino_tile_${n}`).then((g) => [n, g] as const)));
    for (const [n, g] of lista) this.modelos.set(n, g);
    this.descartaveis.push(this.geoLuz, this.matPonta);
    this.cena.background = new THREE.Color('#3a2616');
    iluminar(this.cena, this.sombras, 6);
    const borda = new THREE.Mesh(new THREE.BoxGeometry(10.2, 0.4, 7.9), new THREE.MeshStandardMaterial({ color: '#5a3b22', roughness: 0.7 }));
    borda.position.y = -0.21;
    const feltro = new THREE.Mesh(new THREE.BoxGeometry(9.5, 0.4, 7.2), new THREE.MeshStandardMaterial({ color: '#2a6e46', roughness: 1 }));
    feltro.position.y = -0.199;
    feltro.receiveShadow = this.sombras;
    for (const m of [borda, feltro]) this.descartaveis.push(m.geometry, m.material as THREE.Material);
    this.cena.add(borda, feltro);
    for (const alvo of [PONTA_ESQUERDA, PONTA_DIREITA]) {
      const m = new THREE.Mesh(this.geoLuz, this.matPonta);
      m.rotation.x = -Math.PI / 2;
      m.userData.alvo = alvo;
      m.visible = false;
      this.cena.add(m);
      this.pontas.push(m);
    }
  }

  protected enquadrar(aspecto: number) {
    const longe = Math.max(1, 1.38 / aspecto);
    this.camera.fov = 38;
    this.camera.position.set(0, 7.8 * longe, 4.9 * longe);
    this.camera.lookAt(0, 0, 0.45);
  }

  private nova(p: Pedra): Peca {
    const obj = new THREE.Group();
    const g = this.modelos.get(chaveDa(p))!;
    const corpo = copiaDe(g, this.sombras);
    corpo.scale.setScalar(ESCALA);
    corpo.position.y = -GROSSO / 2;
    let mat: THREE.MeshStandardMaterial | null = null;
    corpo.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      mat ??= (m.material as THREE.MeshStandardMaterial).clone();
      m.material = mat;
    });
    obj.add(corpo);
    this.cena.add(obj);
    return { obj, mat: mat ?? new THREE.MeshStandardMaterial(), alvo: null, onde: '' };
  }

  /** Onde cada pedra da corrente deita: as linhas enchem da esquerda para a direita e ficam centradas. */
  private corrente(mesa: Pedra[]): Lugar[] {
    const linhas: { pedras: { p: Pedra; dupla: boolean }[]; largura: number }[] = [];
    let atual: { pedras: { p: Pedra; dupla: boolean }[]; largura: number } = { pedras: [], largura: 0 };
    for (const p of mesa) {
      const dupla = p[0] === p[1];
      const w = (dupla ? CURTO : LONGO) + FOLGA;
      if (atual.pedras.length && atual.largura + w > LINHA) {
        linhas.push(atual);
        atual = { pedras: [], largura: 0 };
      }
      atual.pedras.push({ p, dupla });
      atual.largura += w;
    }
    if (atual.pedras.length) linhas.push(atual);
    const passo = LONGO + 0.22;
    const z0 = -0.55 - ((linhas.length - 1) * passo) / 2;
    const lugares: Lugar[] = [];
    linhas.forEach((l, k) => {
      let x = -l.largura / 2;
      for (const { p, dupla } of l.pedras) {
        const w = (dupla ? CURTO : LONGO) + FOLGA;
        // o número da esquerda (p[0]) fica à esquerda; no modelo, o menor está no -z
        const rumo = dupla ? 0 : p[0] <= p[1] ? Math.PI / 2 : -Math.PI / 2;
        lugares.push({ pos: new THREE.Vector3(x + w / 2, GROSSO / 2 + 0.002, z0 + k * passo), q: giro(0, rumo, 0), alvo: null });
        x += w;
      }
    });
    return lugares;
  }

  protected aplicar(d: DominoDaCena) {
    const quer = new Map<string, Lugar>();
    const corrente = this.corrente(d.mesa);
    d.mesa.forEach((p, k) => quer.set(chaveDa(p), corrente[k]));
    const nm = d.mao.length;
    const largura = Math.min(CURTO * NA_MAO + 0.14, 8.2 / Math.max(1, nm));
    d.mao.forEach((p, k) => {
      const meio = k - (nm - 1) / 2;
      const serve = d.servem.includes(k);
      const sobe = (serve && this.sobre === k) || d.escolhida === k ? 0.22 : serve ? 0.08 : 0;
      quer.set(chaveDa(p), { pos: new THREE.Vector3(meio * largura, 0.5 + sobe, 2.45), q: giro(0, -meio * 0.04, 0).multiply(DE_PE), alvo: serve ? k : null, escala: NA_MAO, acesa: serve });
    });
    // as dos outros, de costas, em fila no alto
    const total = d.outros.reduce((s, n) => s + n, 0) + Math.max(0, d.outros.length - 1) * 1.2;
    let x = (-total * (CURTO + 0.05)) / 2;
    d.outros.forEach((n, j) => {
      for (let k = 0; k < n; k++) {
        quer.set(`o:${j}:${k}`, { pos: new THREE.Vector3(x + CURTO / 2, GROSSO / 2 + 0.002, -2.85), q: giro(0, 0, Math.PI), alvo: null });
        x += CURTO + 0.05;
      }
      x += 1.2 * (CURTO + 0.05);
    });

    const primeiraVez = !this.montado;
    this.montado = true;
    for (const [chave, p] of this.pecas)
      if (!quer.has(chave)) {
        this.cena.remove(p.obj);
        p.mat.dispose();
        this.pecas.delete(chave);
      }
    for (const [chave, l] of quer) {
      let p = this.pecas.get(chave);
      let trecho = 380;
      if (!p) {
        const pedra = chave.startsWith('o:') ? null : (chave.split('-').map(Number) as Pedra);
        // a de costas dos outros é uma pedra qualquer virada: nunca aparece a face
        p = this.nova(pedra ?? [0, 0]);
        this.pecas.set(chave, p);
        if (primeiraVez) {
          p.obj.position.copy(l.pos);
          p.obj.quaternion.copy(l.q);
          p.onde = '*';
        } else {
          // a pedra jogada por outro vem do alto, de costas; a comprada, de baixo
          const naMao = d.mao.some((m) => chaveDa(m) === chave);
          p.obj.position.set(0, 0.4, naMao ? 3.6 : -2.85);
          p.obj.quaternion.copy(naMao ? DE_PE : giro(0, 0, Math.PI));
        }
      } else if (d.mao.some((m) => chaveDa(m) === chave)) trecho = 150;
      p.alvo = l.alvo;
      p.obj.scale.setScalar(l.escala ?? 1);
      p.mat.emissive.set(l.acesa ? '#3fbf6a' : '#000000');
      p.mat.emissiveIntensity = l.acesa ? 0.35 : 0;
      const onde = `${l.pos.toArray().map((v) => v.toFixed(3))}|${l.q.toArray().map((v) => v.toFixed(3))}`;
      if (p.onde === '*') p.onde = onde;
      if (p.onde !== onde) {
        p.onde = onde;
        this.mover(p.obj, [p.obj.position.clone(), l.pos], l.q, trecho, trecho > 200 ? 0.35 : 0);
      }
    }

    // as duas pontas, quando a escolhida serve nas duas
    const pronta = d.escolhida !== null && corrente.length > 0;
    this.pontas.forEach((m, k) => {
      m.visible = pronta;
      if (!pronta) return;
      const ponta = k === 0 ? corrente[0] : corrente[corrente.length - 1];
      const pedra = k === 0 ? d.mesa[0] : d.mesa[d.mesa.length - 1];
      const meio = (pedra[0] === pedra[1] ? CURTO : LONGO) / 2;
      m.position.set(ponta.pos.x + (k === 0 ? -1 : 1) * (meio + LONGO * 0.6 + 0.05), 0.006, ponta.pos.z);
      m.rotation.z = Math.PI / 2;
    });
  }

  protected passo(agora: number) {
    const pronta = this.pontas[0].visible;
    if (!pronta || this.calmo) return false;
    this.matPonta.opacity = 0.4 + 0.3 * Math.sin(agora / 180);
    return true;
  }

  protected aoMudarSobre() {
    if (this.dados) this.aplicar(this.dados);
  }

  destruir() {
    for (const p of this.pecas.values()) p.mat.dispose();
    super.destruir();
  }

  protected alvoNoRaio(raio: THREE.Raycaster): number | null {
    const pontas = this.pontas.filter((m) => m.visible);
    const comAlvo = [...this.pecas.values()].filter((p) => p.alvo !== null);
    const hit = raio.intersectObjects([...pontas, ...comAlvo.map((p) => p.obj)], true)[0];
    if (!hit) return null;
    if (typeof hit.object.userData.alvo === 'number') return hit.object.userData.alvo;
    for (const p of comAlvo) {
      let o: THREE.Object3D | null = hit.object;
      while (o && o !== p.obj) o = o.parent;
      if (o) return p.alvo;
    }
    return null;
  }
}

export const criarDomino3D = (caixa: HTMLElement, aoClicar: (alvo: number) => void) => new Domino3D(caixa, aoClicar);
