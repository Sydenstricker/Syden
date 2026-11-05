import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { carregarModelo, carregarTextura, giro, iluminar, MesaBase } from './base';

/**
 * O TRUCO EM 3D (05/11/2026, pedido dele): a mesa de feltro com as cartas do KayKit (o baralho francês de 52, do qual o
 * truco usa as 40 sem 8, 9 e 10). As jogadas deitam no feltro na frente de quem jogou (a coberta, de costas), a vira fica
 * ao lado do monte, a minha mão em pé na minha frente (clicar joga) e a dos outros de costas no lugar deles. Ao dar as
 * cartas, elas saem do monte; ao jogar, a carta vai da mão à mesa e se vira. A manilha leva um brilho dourado por baixo.
 * Os nomes, o grito e os botões continuam em HTML (JogoTruco.tsx).
 */

export interface TrucoDaCena {
  /** 2 ou 4. */
  n: number;
  /** O meu lugar (ou 0, para quem assiste): ele fica embaixo. */
  base: number;
  lugares: { lugar: number; cartas: number }[];
  /** A minha mão (vazia para quem assiste). */
  mao: string[];
  maoClicavel: boolean;
  manilha: string;
  vira: string;
  mesa: { lugar: number; carta: string | null; coberta: boolean }[];
}

const VALOR: Record<string, string> = { '4': 'four', '5': 'five', '6': 'six', '7': 'seven', Q: 'queen', J: 'jack', K: 'king', A: 'ace', '2': 'two', '3': 'three' };
const NAIPE: Record<string, string> = { o: 'diamonds', e: 'spades', c: 'hearts', p: 'clubs' };
const arquivoDa = (carta: string) => `cartas/${NAIPE[carta.slice(-1)]}_${VALOR[carta.slice(0, -1)]}.png`;

const ESCALA = 0.22;
/** O tamanho da carta na mesa (o modelo tem 4,31 × 6). */
const LARGURA = 4.31 * ESCALA;
const ALTURA = 6 * ESCALA;
const MAO_Z = 2.2;

/** Para onde fica cada lugar, a partir do centro: embaixo, à direita, em cima, à esquerda. */
const DIRECAO = [new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, -1), new THREE.Vector3(-1, 0, 0)];
/** O giro de uma carta virada para quem está no lugar (a de cima está de cabeça para baixo para mim). */
const RUMO = [0, -Math.PI / 2, Math.PI, Math.PI / 2];

/** Um número de 0 a 1 que não muda para a mesma chave: o tortinho de cada carta na mesa. */
function sorte(chave: string) {
  let h = 2166136261;
  for (let i = 0; i < chave.length; i++) h = Math.imul(h ^ chave.charCodeAt(i), 16777619);
  return ((h >>> 0) % 1000) / 1000;
}

interface Carta {
  obj: THREE.Group;
  frente: THREE.MeshStandardMaterial;
  brilho: THREE.Mesh;
  face: string | null;
  alvo: number | null;
  /** Onde ela mora agora, para não mexer à toa. */
  onde: string;
}

interface Lugar {
  pos: THREE.Vector3;
  q: THREE.Quaternion;
  face: string | null;
  alvo: number | null;
  manilha: boolean;
}

export class Truco3D extends MesaBase<TrucoDaCena> {
  private modelo: GLTF | null = null;
  private cartas = new Map<string, Carta>();
  private geoBrilho = new THREE.PlaneGeometry(LARGURA * 1.12, ALTURA * 1.08);
  /** O meio da carta no modelo (ele não é centrado na origem), medido uma vez. */
  private meioDaCarta: THREE.Vector3 | null = null;
  private matBrilho = new THREE.MeshBasicMaterial({ color: '#ffc531', depthWrite: false });
  private monte = new THREE.Group();

  protected async carregarTudo() {
    this.modelo = await carregarModelo('card_base');
    this.descartaveis.push(this.geoBrilho, this.matBrilho);
    this.cena.background = new THREE.Color('#3a2616');
    iluminar(this.cena, this.sombras, 5);
    // o feltro e a borda de madeira
    const borda = new THREE.Mesh(new THREE.BoxGeometry(9.4, 0.4, 8.6), new THREE.MeshStandardMaterial({ color: '#5a3b22', roughness: 0.7 }));
    borda.position.y = -0.21;
    const feltro = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.4, 7.8), new THREE.MeshStandardMaterial({ color: '#2a6e46', roughness: 1 }));
    feltro.position.y = -0.199;
    feltro.receiveShadow = this.sombras;
    for (const m of [borda, feltro]) this.descartaveis.push(m.geometry, m.material as THREE.Material);
    this.cena.add(borda, feltro);
    // o monte: umas cartas de costas, empilhadas
    for (let k = 0; k < 4; k++) {
      const c = this.novaCarta();
      c.obj.position.set(0, 0.012 + k * 0.012, 0);
      c.obj.quaternion.copy(this.deitada(0.05 * k, false));
      this.monte.add(c.obj);
    }
    this.cena.add(this.monte);
  }

  protected enquadrar(aspecto: number) {
    const longe = Math.max(1, 1.02 / aspecto);
    this.camera.fov = 38;
    this.camera.position.set(0, 8.0 * longe, 4.7 * longe);
    this.camera.lookAt(0, 0, 0.42);
  }

  /** O giro de uma carta deitada no feltro, de frente para cima ou de costas. */
  private deitada(rumo: number, deFrente: boolean) {
    const q = giro(0, rumo, 0);
    if (!deFrente) q.multiply(giro(0, 0, Math.PI));
    return q;
  }

  private novaCarta(): Carta {
    const obj = new THREE.Group();
    const corpo = this.modelo!.scene.clone(true);
    corpo.scale.setScalar(ESCALA);
    corpo.rotation.x = -Math.PI / 2;
    let frente: THREE.MeshStandardMaterial | null = null;
    corpo.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = this.sombras;
      const mat = m.material as THREE.MeshStandardMaterial;
      if (mat.name === 'card_front') {
        frente = mat.clone();
        frente.color.set('#ffffff');
        m.material = frente;
        this.descartaveis.push(frente);
      }
    });
    const brilho = new THREE.Mesh(this.geoBrilho, this.matBrilho);
    brilho.rotation.x = -Math.PI / 2;
    // NO MEIO DA CARTA, e não na origem do modelo (05/11/2026, relato dele: "uma barra verde tampando a parte de baixo das
    // cartas"): o modelo não é centrado, e o brilho da manilha sobrava para um lado e para baixo, como uma barra.
    if (!this.meioDaCarta) this.meioDaCarta = new THREE.Box3().setFromObject(corpo).getCenter(new THREE.Vector3());
    brilho.position.set(this.meioDaCarta.x, -0.006, this.meioDaCarta.z);
    brilho.visible = false;
    obj.add(corpo, brilho);
    return { obj, frente: frente ?? new THREE.MeshStandardMaterial(), brilho, face: null, alvo: null, onde: '' };
  }

  private mostrarFace(c: Carta, face: string | null) {
    if (c.face === face) return;
    c.face = face;
    if (!face) return;
    void carregarTextura(arquivoDa(face))
      .then((t) => {
        if (c.face !== face) return;
        c.frente.map = t;
        c.frente.needsUpdate = true;
        this.pedirDesenho();
      })
      .catch(() => {});
  }

  private posDoMonte(n: number) {
    return n === 4 ? new THREE.Vector3(-2.55, 0, -2.2) : new THREE.Vector3(-2.65, 0, -0.3);
  }

  protected aplicar(d: TrucoDaCena) {
    const relDe = (lugar: number) => (lugar - d.base + d.n) % d.n;
    const indice = (lugar: number) => (d.n === 2 ? (relDe(lugar) === 0 ? 0 : 2) : relDe(lugar));
    const monte = this.posDoMonte(d.n);
    this.monte.position.copy(monte);
    const quer = new Map<string, Lugar>();

    // a vira, ao lado do monte
    if (d.vira) quer.set(`v:${d.vira}`, { pos: monte.clone().add(new THREE.Vector3(0.78, 0.02, 0.14)), q: this.deitada(-0.32, true), face: d.vira, alvo: null, manilha: false });

    // as jogadas, na frente de quem jogou
    d.mesa.forEach((m, k) => {
      const i = indice(m.lugar);
      const chave = m.carta ? `c:${m.carta}` : `x:${m.lugar}:${k}`;
      const longe = i % 2 === 0 ? 0.72 : 1.3;
      const pos = DIRECAO[i].clone().multiplyScalar(longe);
      const torto = (sorte(chave) - 0.5) * 0.5;
      pos.x += (sorte(chave + 'x') - 0.5) * 0.12;
      pos.y = 0.012 + k * 0.006;
      const deFrente = !!m.carta && !m.coberta;
      // de pé para quem olha, para ler (só o tortinho de quem jogou)
      quer.set(chave, { pos, q: this.deitada(torto, deFrente), face: m.carta, alvo: null, manilha: deFrente && m.carta!.slice(0, -1) === d.manilha });
    });

    // a minha mão, em pé na minha frente
    const nm = d.mao.length;
    d.mao.forEach((carta, k) => {
      const meio = k - (nm - 1) / 2;
      const clicavel = d.maoClicavel;
      const sobe = clicavel && this.sobre === k ? 0.2 : 0;
      const pos = new THREE.Vector3(meio * (LARGURA + 0.12), 0.42 + sobe + Math.abs(meio) * -0.03, MAO_Z + Math.abs(meio) * 0.06);
      const q = giro(0, -meio * 0.1, 0).multiply(giro(0.95, 0, 0));
      quer.set(`c:${carta}`, { pos, q, face: carta, alvo: clicavel ? k : null, manilha: carta.slice(0, -1) === d.manilha });
    });

    // as mãos dos outros, de costas (e a de baixo também, para quem só assiste)
    for (const l of d.lugares) {
      const i = indice(l.lugar);
      if (i === 0 && nm > 0) continue;
      for (let k = 0; k < l.cartas; k++) {
        const meio = k - (l.cartas - 1) / 2;
        const ao = DIRECAO[i].clone().multiplyScalar(i % 2 === 0 ? 2.55 : 2.8);
        const lado = new THREE.Vector3(-DIRECAO[i].z, 0, DIRECAO[i].x).multiplyScalar(meio * LARGURA * 0.55);
        const pos = ao.add(lado).setY(0.012 + k * 0.008);
        quer.set(`h:${l.lugar}:${k}`, { pos, q: this.deitada(RUMO[i] + meio * 0.12, false), face: null, alvo: null, manilha: false });
      }
    }

    // o que saiu da mesa vai embora; o que ficou vai para o lugar novo; o que chegou sai do monte (ou da mão de quem jogou)
    for (const [chave, c] of this.cartas)
      if (!quer.has(chave)) {
        this.cena.remove(c.obj);
        this.cartas.delete(chave);
      }
    const primeiraVez = !this.montado;
    this.montado = true;
    let dadas = 0;
    for (const [chave, l] of quer) {
      let c = this.cartas.get(chave);
      const onde = `${l.pos.toArray().map((v) => v.toFixed(3))}|${l.q.toArray().map((v) => v.toFixed(3))}`;
      let atraso = 0;
      let trecho = 380;
      if (!c) {
        c = this.novaCarta();
        this.cartas.set(chave, c);
        this.cena.add(c.obj);
        if (primeiraVez) {
          c.obj.position.copy(l.pos);
          c.obj.quaternion.copy(l.q);
          c.onde = onde;
        } else {
          // de onde ela vem: a jogada de outro sai do lugar dele; as dadas saem do monte, uma depois da outra
          const jogada = d.mesa.find((m, k) => (m.carta ? `c:${m.carta}` : `x:${m.lugar}:${k}`) === chave);
          if (jogada) {
            const i = indice(jogada.lugar);
            c.obj.position.copy(DIRECAO[i].clone().multiplyScalar(i % 2 === 0 ? 2.55 : 2.8)).setY(0.3);
            c.obj.quaternion.copy(this.deitada(RUMO[i], false));
          } else {
            c.obj.position.copy(monte).setY(0.08);
            c.obj.quaternion.copy(this.deitada(0, false));
            atraso = 70 * dadas++;
          }
        }
      } else if (l.alvo !== null || (chave.startsWith("c:") && d.mao.includes(chave.slice(2)))) trecho = 140;
      this.mostrarFace(c, l.face);
      c.alvo = l.alvo;
      c.brilho.visible = l.manilha;
      if (c.onde !== onde) {
        c.onde = onde;
        this.mover(c.obj, [c.obj.position.clone(), l.pos], l.q, trecho, trecho > 200 ? 0.3 : 0, atraso);
      }
    }
  }

  private montado = false;

  protected aoMudarSobre() {
    if (this.dados) this.aplicar(this.dados);
  }

  protected alvoNoRaio(raio: THREE.Raycaster): number | null {
    const objs = [...this.cartas.values()].filter((c) => c.alvo !== null).map((c) => c.obj);
    if (!objs.length) return null;
    const hit = raio.intersectObjects(objs, true)[0];
    if (!hit) return null;
    for (const c of this.cartas.values()) {
      let o: THREE.Object3D | null = hit.object;
      while (o && o !== c.obj) o = o.parent;
      if (o) return c.alvo;
    }
    return null;
  }
}

export const criarTruco3D = (caixa: HTMLElement, aoClicar: (k: number) => void) => new Truco3D(caixa, aoClicar);
