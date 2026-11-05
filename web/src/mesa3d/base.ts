import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * A BASE DAS MESAS EM 3D (05/11/2026): Damas, Truco e Dominó, com as peças do KayKit Board Game Bits (CC0,
 * web/public/mesa3d/License.txt; o crédito nos termos, seção 10), no mesmo molde do xadrez (xadrez3d/cena.ts). Aqui mora o
 * que as três têm igual: o renderizador, a medida da caixa, o clique (pelo raio, com uma folga para quem arrasta), o mouse
 * por cima, os movimentos (uma peça vai de um lugar a outro por um caminho, com um arco opcional) e o fim (o contexto é
 * devolvido). Só a TELA: quem decide o jogo é o servidor, e a página de botões do 2D continua por baixo para o teclado e o
 * leitor de tela.
 *
 * Sem foco na janela (o uso principal é com um jogo aberto) ou escondida, nada é desenhado; e mesmo com foco, só se desenha
 * quando algo mudou ou se mexe.
 */

export const BASE = `${import.meta.env.BASE_URL}mesa3d/`;

const modelos = new Map<string, Promise<GLTF>>();
export function carregarModelo(nome: string): Promise<GLTF> {
  let p = modelos.get(nome);
  if (!p) {
    p = new GLTFLoader().loadAsync(`${BASE}${nome}.gltf`);
    modelos.set(nome, p);
    p.catch(() => modelos.delete(nome));
  }
  return p;
}

const texturas = new Map<string, Promise<THREE.Texture>>();
/** Uma textura no jeito do glTF (sem inverter o y, em sRGB), guardada para a próxima partida como os modelos. */
export function carregarTextura(caminho: string): Promise<THREE.Texture> {
  let p = texturas.get(caminho);
  if (!p) {
    p = new THREE.TextureLoader().loadAsync(`${BASE}${caminho}`).then((t) => {
      t.flipY = false;
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
      return t;
    });
    texturas.set(caminho, p);
    p.catch(() => texturas.delete(caminho));
  }
  return p;
}

/** Uma cópia do modelo, com a sombra de cada malha ligada ou não. A geometria e o material são os do cache. */
export function copiaDe(g: GLTF, sombra: boolean): THREE.Object3D {
  const o = g.scene.clone(true);
  o.traverse((m) => {
    if ((m as THREE.Mesh).isMesh) {
      m.castShadow = sombra;
      m.receiveShadow = sombra;
    }
  });
  return o;
}

interface Movimento {
  obj: THREE.Object3D;
  pontos: THREE.Vector3[];
  qDe: THREE.Quaternion;
  qPara: THREE.Quaternion;
  inicio: number;
  /** Quanto dura cada trecho do caminho. */
  trecho: number;
  arco: number;
  aoFim?: () => void;
}

const suave = (f: number) => f * f * (3 - 2 * f);

export abstract class MesaBase<D> {
  protected renderer: THREE.WebGLRenderer;
  protected cena = new THREE.Scene();
  protected camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
  protected raio = new THREE.Raycaster();
  protected sombras: boolean;
  protected calmo: boolean;
  protected dados: D | null = null;
  /** O alvo debaixo do mouse (o mesmo número do clique), ou null. */
  protected sobre: number | null = null;
  /** O que é desta cena (materiais e geometrias próprios): vai embora no fim. Os modelos são do cache. */
  protected descartaveis: { dispose(): void }[] = [];
  private movimentos: Movimento[] = [];
  private agendados: { quando: number; fn: () => void }[] = [];
  private observador: ResizeObserver;
  private apertou: { x: number; y: number } | null = null;
  private pronta = false;
  private morta = false;
  private sujo = true;

  constructor(
    protected caixa: HTMLElement,
    private aoClicar: (alvo: number) => void,
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    let sombras = false;
    try {
      sombras = !!JSON.parse(localStorage.getItem('syden:graficos') ?? '{}').sombras;
    } catch {
      /* sem */
    }
    this.sombras = sombras;
    this.renderer.shadowMap.enabled = sombras;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.calmo = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const tela = this.renderer.domElement;
    tela.className = 'mesa3d-tela';
    caixa.appendChild(tela);
    this.observador = new ResizeObserver(() => this.medir());
    this.observador.observe(caixa);
    tela.addEventListener('pointerdown', this.aoApertar);
    tela.addEventListener('pointerup', this.aoSoltar);
    tela.addEventListener('pointermove', this.aoPassar);
    tela.addEventListener('pointerleave', this.aoSair);
    this.medir();
  }

  /** Carrega os modelos e monta o que não muda. Rejeita se algo falhar (a tela fica no 2D). */
  async montar(): Promise<void> {
    await this.carregarTudo();
    if (this.morta) return;
    this.pronta = true;
    if (this.dados) this.aplicar(this.dados);
    this.renderer.setAnimationLoop(this.desenhar);
  }

  atualizar(d: D) {
    this.dados = d;
    if (!this.pronta || this.morta) return;
    this.aplicar(d);
    this.sujo = true;
  }

  protected abstract carregarTudo(): Promise<void>;
  protected abstract aplicar(d: D): void;
  /** O alvo debaixo do raio (o número que vai para o clique), ou null. */
  protected abstract alvoNoRaio(raio: THREE.Raycaster): number | null;
  /** A câmera para a proporção da caixa. */
  protected abstract enquadrar(aspecto: number): void;
  /** O mouse passou para outro alvo. */
  protected aoMudarSobre(): void {}
  /** A cada quadro desenhado; devolve true se ainda há algo se mexendo. */
  protected passo(_agora: number): boolean {
    return false;
  }

  protected pedirDesenho() {
    this.sujo = true;
  }

  /** Leva `obj` pelos `pontos` (o primeiro é onde ele está), girando até `qPara`; cada trecho com um arco de `arco`. */
  protected mover(obj: THREE.Object3D, pontos: THREE.Vector3[], qPara: THREE.Quaternion, trecho = 320, arco = 0, atraso = 0, aoFim?: () => void) {
    this.movimentos = this.movimentos.filter((m) => m.obj !== obj);
    const fim = pontos[pontos.length - 1];
    if (this.calmo || pontos.length < 2) {
      obj.position.copy(fim);
      obj.quaternion.copy(qPara);
      aoFim?.();
      this.sujo = true;
      return;
    }
    this.movimentos.push({ obj, pontos, qDe: obj.quaternion.clone(), qPara: qPara.clone(), inicio: performance.now() + atraso, trecho, arco, aoFim });
    this.sujo = true;
  }
  protected parado(obj: THREE.Object3D) {
    return !this.movimentos.some((m) => m.obj === obj);
  }
  protected agendar(ms: number, fn: () => void) {
    if (this.calmo) return fn();
    this.agendados.push({ quando: performance.now() + ms, fn });
  }

  private medir() {
    const w = Math.max(1, this.caixa.clientWidth);
    const h = Math.max(1, this.caixa.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.enquadrar(w / h);
    this.camera.updateProjectionMatrix();
    this.sujo = true;
  }

  private alvoNoPonto(e: PointerEvent): number | null {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.raio.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), this.camera);
    return this.alvoNoRaio(this.raio);
  }
  private aoApertar = (e: PointerEvent) => {
    this.apertou = { x: e.clientX, y: e.clientY };
  };
  private aoSoltar = (e: PointerEvent) => {
    const a = this.apertou;
    this.apertou = null;
    if (!a || Math.hypot(e.clientX - a.x, e.clientY - a.y) > 8 || !this.pronta) return;
    const alvo = this.alvoNoPonto(e);
    if (alvo !== null) this.aoClicar(alvo);
  };
  private aoPassar = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse' || !this.pronta) return;
    const alvo = this.alvoNoPonto(e);
    this.renderer.domElement.style.cursor = alvo !== null ? 'pointer' : '';
    if (alvo !== this.sobre) {
      this.sobre = alvo;
      this.aoMudarSobre();
      this.sujo = true;
    }
  };
  private aoSair = () => {
    if (this.sobre === null) return;
    this.sobre = null;
    this.aoMudarSobre();
    this.sujo = true;
  };

  private desenhar = () => {
    if (this.morta || document.hidden || !document.hasFocus()) return;
    const agora = performance.now();
    if (this.agendados.length) {
      const prontos = this.agendados.filter((a) => a.quando <= agora);
      this.agendados = this.agendados.filter((a) => a.quando > agora);
      for (const a of prontos) a.fn();
      if (prontos.length) this.sujo = true;
    }
    let mexendo = this.agendados.length > 0;
    const acabaram: Movimento[] = [];
    for (const m of this.movimentos) {
      const total = m.trecho * (m.pontos.length - 1);
      const t = agora - m.inicio;
      if (t < 0) {
        mexendo = true;
        continue;
      }
      const f = Math.min(1, t / total);
      const n = m.pontos.length - 1;
      const k = Math.min(n - 1, Math.floor(f * n));
      const local = Math.min(1, f * n - k);
      m.obj.position.lerpVectors(m.pontos[k], m.pontos[k + 1], suave(local));
      m.obj.position.y += Math.sin(Math.PI * local) * m.arco;
      m.obj.quaternion.slerpQuaternions(m.qDe, m.qPara, suave(f));
      if (f >= 1) acabaram.push(m);
      mexendo = true;
    }
    if (acabaram.length) {
      this.movimentos = this.movimentos.filter((m) => !acabaram.includes(m));
      for (const m of acabaram) m.aoFim?.();
    }
    if (this.passo(agora)) mexendo = true;
    if (!mexendo && !this.sujo) return;
    this.sujo = false;
    this.renderer.render(this.cena, this.camera);
  };

  destruir() {
    this.morta = true;
    this.renderer.setAnimationLoop(null);
    this.observador.disconnect();
    const tela = this.renderer.domElement;
    tela.removeEventListener('pointerdown', this.aoApertar);
    tela.removeEventListener('pointerup', this.aoSoltar);
    tela.removeEventListener('pointermove', this.aoPassar);
    tela.removeEventListener('pointerleave', this.aoSair);
    for (const d of this.descartaveis) d.dispose();
    this.renderer.forceContextLoss();
    this.renderer.dispose();
    tela.remove();
  }
}

/** A luz de mesa de sempre: o céu claro e um sol de cima, com a sombra só com "Sombras" ligado em Gráficos. */
export function iluminar(cena: THREE.Scene, sombras: boolean, alcance = 7) {
  cena.add(new THREE.HemisphereLight('#fff6ea', '#5a4636', 1.6));
  const sol = new THREE.DirectionalLight('#fff1dc', 2.1);
  sol.position.set(-4, 12, 6);
  if (sombras) {
    sol.castShadow = true;
    sol.shadow.mapSize.set(1024, 1024);
    Object.assign(sol.shadow.camera, { left: -alcance, right: alcance, top: alcance, bottom: -alcance, near: 1, far: 30 });
    sol.shadow.bias = -0.0008;
    sol.shadow.normalBias = 0.02;
  }
  cena.add(sol);
}

/** Uma marca no chão (um quadrado ou um disco), transparente, para acender uma casa. */
export function marcaPlana(geo: THREE.BufferGeometry, cor: string, opacidade: number): THREE.Mesh {
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: opacidade, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.renderOrder = 1;
  return m;
}

/** O quatérnio de um giro em torno de um eixo. */
export const giro = (x: number, y: number, z: number, ordem: THREE.EulerOrder = 'XYZ') => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z, ordem));
