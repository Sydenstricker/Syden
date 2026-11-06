import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { fundoAconchegante, materialDeMadeira } from '../mesa3d/ambiente';
import { iluminar } from '../mesa3d/base';

/**
 * O XADREZ EM 3D (05/11/2026, pedido dele: "adicione xadrez também, com os assets que estão na pasta"): o tabuleiro e as peças
 * do KayKit Board Game Bits (CC0, web/public/mesa3d/License.txt; o crédito nos termos, seção 10), numa mesa de madeira. A peça
 * que andou desliza (o cavalo pula), as casas que valem acendem, o rei em xeque fica vermelho. Só a TELA: os lances são do
 * servidor, e o tabuleiro de botões do 2D continua por baixo para o teclado e o leitor de tela.
 *
 * A MESA (06/11/2026, pedido dele: "o xadrez também poderia ter mesa com mais textura; tem espaço fora da mesa sobrando: deixe
 * a câmera vendo apenas a mesa"): o ambiente das mesas do Truco e das Damas (mesa3d/ambiente.ts: a madeira com veio, o fundo de
 * sala e a luz quente do pendente), com o tabuleiro num pé de madeira mais escura em cima de uma mesa de tábuas que passa das
 * bordas da tela; e a câmera ENQUADRA o tabuleiro (`posicionarCamera`): a distância e o ponto de mira saem da conta, para o
 * tabuleiro e as peças mais altas caberem com uma folga pequena, em qualquer proporção da caixa e dos dois lados.
 */

const BASE = `${import.meta.env.BASE_URL}mesa3d/`;
const NOME: Record<string, string> = { k: 'king', q: 'queen', r: 'rook', b: 'bishop', n: 'knight', p: 'pawn' };
const ARQUIVOS = ['board_A', ...['white', 'black'].flatMap((c) => Object.values(NOME).map((p) => `chess_${c}_${p}`))];

const cache = new Map<string, Promise<GLTF>>();
const carregar = (a: string) => {
  let p = cache.get(a);
  if (!p) {
    p = new GLTFLoader().loadAsync(`${BASE}${a}.gltf`);
    cache.set(a, p);
    p.catch(() => cache.delete(a));
  }
  return p;
};

export interface XadrezDaCena {
  /** 64 letras, linha 0 no alto (a fileira 8); maiúscula branca. */
  casas: string[];
  /** As pretas embaixo (quem joga de pretas). */
  girado: boolean;
  escolhida: number | null;
  destinos: number[];
  ultimo: { de: number; para: number } | null;
  xequeEm: number | null;
}

const TOPO = 0.3;
const posDa = (i: number) => new THREE.Vector3((i % 8) - 3.5, TOPO, Math.floor(i / 8) - 3.5);
/** O pé do tabuleiro: um pouco maior que ele (o tabuleiro do KayKit vai de −5 a 5), e mais baixo, para aparecer como um degrau. */
const PE = 5.45;
const PE_TOPO = 0.14;
/** O rei, a peça mais alta, com a escala de `peca`. */
const ALTURA_DA_PECA = TOPO + 1.8 * 0.82;
/** O que tem de caber na tela: os cantos do pé e do tabuleiro, e o alto das peças nas fileiras de trás e da frente. */
const PONTOS_DO_QUADRO = [
  ...[-1, 1].flatMap((x) => [-1, 1].flatMap((z) => [new THREE.Vector3(x * PE, PE_TOPO, z * PE), new THREE.Vector3(x * 5, TOPO, z * 5)])),
  ...[-3.5, 0, 3.5].flatMap((x) => [-3.5, 3.5].map((z) => new THREE.Vector3(x, ALTURA_DA_PECA, z))),
];
/** De onde a câmera olha (a mesma inclinação de antes, ~53°), e quanto da tela o quadro ocupa. */
const DIRECAO = new THREE.Vector3(0, 12.5, 9.5).normalize();
const FOLGA = 0.96;

export class Xadrez3D {
  private renderer: THREE.WebGLRenderer;
  private cena = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  private modelos = new Map<string, GLTF>();
  private pecas = new Map<number, { obj: THREE.Object3D; letra: string }>();
  private marcas: THREE.Mesh[] = [];
  private geoMarca = new THREE.PlaneGeometry(0.96, 0.96);
  private raio = new THREE.Raycaster();
  private observador: ResizeObserver;
  private dados: XadrezDaCena | null = null;
  private andando: { obj: THREE.Object3D; de: THREE.Vector3; para: THREE.Vector3; inicio: number; pula: boolean } | null = null;
  private morta = false;
  private calmo: boolean;
  private sombras = false;
  /** Materiais, geometrias e texturas desta cena (os modelos são do cache e ficam). */
  private descartaveis: { dispose(): void }[] = [];

  constructor(
    private caixa: HTMLElement,
    private aoClicar: (casa: number) => void,
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    let sombras = false;
    try {
      sombras = !!JSON.parse(localStorage.getItem('syden:graficos') ?? '{}').sombras;
    } catch {
      /* sem */
    }
    this.renderer.shadowMap.enabled = sombras;
    this.calmo = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const tela = this.renderer.domElement;
    tela.className = 'xadrez-3d-tela';
    caixa.appendChild(tela);
    this.observador = new ResizeObserver(() => this.medir());
    this.observador.observe(caixa);
    this.sombras = sombras;
    const c = this.cena;
    fundoAconchegante(c, this.descartaveis);
    iluminar(c, sombras);
    // a mesa de tábuas, larga o bastante para a tela nunca ver a borda dela, e o pé do tabuleiro, de madeira mais escura
    const mesaGeo = new THREE.BoxGeometry(44, 0.6, 44);
    const mesaMat = materialDeMadeira(this.descartaveis, [3, 16]);
    const mesa = new THREE.Mesh(mesaGeo, mesaMat);
    mesa.position.y = -0.3;
    mesa.receiveShadow = sombras;
    const peGeo = new THREE.BoxGeometry(PE * 2, PE_TOPO + 0.02, PE * 2);
    const peMat = materialDeMadeira(this.descartaveis, [1, 6]);
    peMat.color.set('#c39c80');
    peMat.roughness = 0.45;
    const pe = new THREE.Mesh(peGeo, peMat);
    pe.position.y = PE_TOPO / 2 - 0.01;
    pe.castShadow = sombras;
    pe.receiveShadow = sombras;
    this.descartaveis.push(mesaGeo, peGeo);
    c.add(mesa, pe);
    tela.addEventListener('click', this.aoClique);
    this.medir();
  }

  async montar() {
    const lista = await Promise.all(ARQUIVOS.map((a) => carregar(a).then((g) => [a, g] as const)));
    if (this.morta) return;
    for (const [a, g] of lista) this.modelos.set(a, g);
    const tab = this.modelos.get('board_A')!.scene.clone(true);
    tab.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.receiveShadow = this.sombras;
        o.castShadow = this.sombras;
      }
    });
    this.cena.add(tab);
    if (this.dados) this.atualizar(this.dados);
    this.renderer.setAnimationLoop(this.desenhar);
  }

  private medir() {
    const w = Math.max(1, this.caixa.clientWidth);
    const h = Math.max(1, this.caixa.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.posicionarCamera();
  }
  /**
   * O enquadramento: só a mesa. A câmera fica na mesma inclinação, e a conta acha a distância e o ponto de mira em que o
   * quadro (PONTOS_DO_QUADRO) ocupa a tela com a folga, centrado: passos de aproximação, que convergem em poucas voltas.
   */
  private posicionarCamera() {
    const cam = this.camera;
    const lado = this.dados?.girado ? -1 : 1;
    const dir = DIRECAO.clone().setZ(DIRECAO.z * lado);
    const alvo = new THREE.Vector3(0, 0, 0.6 * lado);
    const cima = new THREE.Vector3();
    const v = new THREE.Vector3();
    const meia = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    let dist = 16;
    cam.updateProjectionMatrix();
    for (let k = 0; k < 30; k++) {
      cam.position.copy(alvo).addScaledVector(dir, dist);
      cam.lookAt(alvo);
      cam.updateMatrixWorld();
      let x0 = Infinity;
      let x1 = -Infinity;
      let y0 = Infinity;
      let y1 = -Infinity;
      for (const p of PONTOS_DO_QUADRO) {
        v.copy(p).project(cam);
        x0 = Math.min(x0, v.x);
        x1 = Math.max(x1, v.x);
        y0 = Math.min(y0, v.y);
        y1 = Math.max(y1, v.y);
      }
      // centra na vertical (o quadro é simétrico na horizontal) e aproxima ou afasta até a folga
      const precisa = Math.max((x1 - x0) / 2, (y1 - y0) / 2) / FOLGA;
      if (Math.abs(precisa - 1) < 0.002 && Math.abs(y0 + y1) < 0.004) break;
      cima.setFromMatrixColumn(cam.matrixWorld, 1);
      alvo.addScaledVector(cima, ((y0 + y1) / 2) * meia * dist);
      dist *= precisa;
    }
    cam.position.copy(alvo).addScaledVector(dir, dist);
    cam.lookAt(alvo);
    cam.updateMatrixWorld();
  }

  private peca(letra: string): THREE.Object3D | null {
    const g = this.modelos.get(`chess_${letra === letra.toUpperCase() ? 'white' : 'black'}_${NOME[letra.toLowerCase()]}`);
    if (!g) return null;
    const o = g.scene.clone(true);
    o.scale.setScalar(0.82);
    o.traverse((m) => {
      if ((m as THREE.Mesh).isMesh) m.castShadow = true;
    });
    // as pretas olham para as brancas
    if (letra !== letra.toUpperCase()) o.rotation.y = Math.PI;
    return o;
  }

  atualizar(d: XadrezDaCena) {
    const antes = this.dados;
    this.dados = d;
    if (!antes || antes.girado !== d.girado) this.posicionarCamera();
    if (!this.modelos.size) return;
    // as peças: o que mudou de casa se refaz; a que andou (o último lance) desliza da casa de antes
    const novoLance = d.ultimo && (!antes?.ultimo || antes.ultimo.de !== d.ultimo.de || antes.ultimo.para !== d.ultimo.para);
    let andou: THREE.Object3D | null = null;
    if (novoLance && d.ultimo) {
      const p = this.pecas.get(d.ultimo.de);
      if (p && p.letra === d.casas[d.ultimo.para]) {
        this.pecas.delete(d.ultimo.de);
        const comida = this.pecas.get(d.ultimo.para);
        if (comida) this.cena.remove(comida.obj);
        this.pecas.set(d.ultimo.para, p);
        andou = p.obj;
        this.andando = { obj: p.obj, de: posDa(d.ultimo.de), para: posDa(d.ultimo.para), inicio: performance.now(), pula: p.letra.toLowerCase() === 'n' };
      }
    }
    for (let i = 0; i < 64; i++) {
      const letra = d.casas[i];
      const ja = this.pecas.get(i);
      if (ja && ja.letra === letra) {
        if (ja.obj !== andou) ja.obj.position.copy(posDa(i));
        continue;
      }
      if (ja) {
        this.cena.remove(ja.obj);
        this.pecas.delete(i);
      }
      if (!letra) continue;
      const o = this.peca(letra);
      if (!o) continue;
      o.position.copy(posDa(i));
      this.cena.add(o);
      this.pecas.set(i, { obj: o, letra });
    }
    // as marcas: o último lance, a peça escolhida, para onde ela vai, e o rei em xeque
    for (const m of this.marcas) {
      this.cena.remove(m);
      (m.material as THREE.Material).dispose();
    }
    this.marcas = [];
    const marcar = (i: number, cor: string, opacidade: number, tamanho = 1) => {
      const m = new THREE.Mesh(this.geoMarca, new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: opacidade, depthWrite: false }));
      m.rotation.x = -Math.PI / 2;
      m.position.copy(posDa(i)).setY(TOPO + 0.005);
      m.scale.setScalar(tamanho);
      this.cena.add(m);
      this.marcas.push(m);
    };
    if (d.ultimo) {
      marcar(d.ultimo.de, '#e3c45a', 0.35);
      marcar(d.ultimo.para, '#e3c45a', 0.45);
    }
    if (d.xequeEm !== null) marcar(d.xequeEm, '#e2453a', 0.6);
    if (d.escolhida !== null) marcar(d.escolhida, '#6fd08a', 0.55);
    for (const i of d.destinos) marcar(i, '#6fd08a', 0.45, d.casas[i] ? 0.9 : 0.42);
    this.renderer.domElement.style.cursor = '';
  }

  private aoClique = (e: MouseEvent) => {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.raio.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), this.camera);
    const p = new THREE.Vector3();
    if (!this.raio.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -TOPO), p)) return;
    const c = Math.floor(p.x + 4);
    const l = Math.floor(p.z + 4);
    if (c >= 0 && l >= 0 && c < 8 && l < 8) this.aoClicar(l * 8 + c);
  };

  private desenhar = () => {
    if (this.morta || document.hidden || !document.hasFocus()) return;
    const a = this.andando;
    if (a) {
      const f = this.calmo ? 1 : Math.min(1, (performance.now() - a.inicio) / 380);
      const e = f * f * (3 - 2 * f);
      a.obj.position.lerpVectors(a.de, a.para, e);
      a.obj.position.y = TOPO + (a.pula ? Math.sin(Math.PI * f) * 0.9 : Math.sin(Math.PI * f) * 0.15);
      if (f >= 1) this.andando = null;
    }
    this.renderer.render(this.cena, this.camera);
  };

  destruir() {
    this.morta = true;
    this.renderer.setAnimationLoop(null);
    this.observador.disconnect();
    this.renderer.domElement.removeEventListener('click', this.aoClique);
    for (const m of this.marcas) (m.material as THREE.Material).dispose();
    for (const d of this.descartaveis) d.dispose();
    this.geoMarca.dispose();
    this.renderer.forceContextLoss();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
