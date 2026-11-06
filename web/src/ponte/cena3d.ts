import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { carregarCoelho, copiarCoelho, type CoelhoCopiado } from '../coelho3d';
import { Fila, fimDaFila, naFila, pesoEscrito } from './fila';
import { ACO, CAIU, CHEGOU, cabe, ehAncora, ESPERANDO, MAX_PECAS, PISTA, VEICULOS, type Fase, type IdDoVeiculo, type Sim } from './sim';
import { ALTURA, COR_DO_FUNDO, LARGURA, MODELOS_DA_PONTE, type OpcoesDaMontagem, type VistaDaPonte } from './vista';

/**
 * A PONTE DA TOCA EM 3D (06/11/2026, pedido dele: "tem algum motivo para não ser em 3D a ponte? Já temos vários veículos nos
 * assets"). A FÍSICA NÃO MUDOU: continua 2D, de lado (sim.ts, igual à do servidor); este arquivo só a mostra como uma maquete — as
 * margens cortadas na frente, o rio (ou a ravina) correndo para o fundo, e a ponte com DUAS treliças, a da frente no plano em que
 * se monta (z = ZF) e a de trás espelhada, ligadas pelos pinos, com a pista de tábuas atravessada entre elas.
 *
 * Os veículos são do Car Kit da Kenney (o sedã e o caminhão de entrega) e a carroça é a do Halloween Bits da KayKit (Kay Lousberg),
 * puxada pelo NOSSO coelho 3D (coelho3d.ts); todos CC0, copiados para web/public/ponte/ com as licenças. O resto (as margens, a
 * água, a pedra, as árvores, as texturas de madeira, tábua e aço) é por código.
 *
 * A câmera é de lado, um pouco de cima e um pouco de viés (a 2,5D), enquadrada para a fila do tráfego, o vão e a chegada caberem
 * entre a faixa de cima (o custo e o relógio) e a de baixo (as peças e os botões), que ficam por cima da tela. O mouse é projetado
 * no plano da treliça da frente, onde estão a grade e os nós. Quem chama desenha um quadro por vez (e nenhum sem foco na janela).
 */

const BASE = `${import.meta.env.BASE_URL}ponte/`;

/** O plano da treliça da frente (onde se monta) e a frente da maquete. */
const ZF = 0.75;
const ZD = 3.4;
const FUNDO_DA_MAQUETE = -42;
/** A altura da tábua: as rodas andam em cima dela. */
const TABUA = 0.16;

const MODELO: Record<IdDoVeiculo, { arquivo: (typeof MODELOS_DA_PONTE)[number]; comprimento: number; corpo: number; raio: number }> = {
  // comprimento: o do corpo na tela; corpo: o do corpo no arquivo (a carroça sem o cabo); raio: o da roda no arquivo
  carroca: { arquivo: 'wagon.gltf', comprimento: 1.5, corpo: 3.72, raio: 0.71 },
  carro: { arquivo: 'sedan.glb', comprimento: 1.7, corpo: 2.54, raio: 0.3 },
  caminhao: { arquivo: 'delivery.glb', comprimento: 2.7, corpo: 3.24, raio: 0.3 },
};

const carregados = new Map<string, Promise<GLTF>>();
function carregar(nome: string): Promise<GLTF> {
  let p = carregados.get(nome);
  if (!p) {
    p = new GLTFLoader().loadAsync(`${BASE}${nome}`);
    carregados.set(nome, p);
    p.catch(() => carregados.delete(nome));
  }
  return p;
}

/** Um sorteio sempre igual, só para o desenho (as árvores, as pedras). */
function sorteio(semente: number) {
  let s = semente >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// =====================================================================================================================
// AS TEXTURAS, por código
// =====================================================================================================================

function textura(w: number, h: number, pintar: (g: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  pintar(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

/** A tábua da pista: tábuas atravessadas (uma casa tem três e meia), com os pregos. */
const texturaDaPista = () =>
  textura(256, 128, (g) => {
    const tabuas = 7;
    for (let i = 0; i < tabuas; i++) {
      const x0 = (i * 256) / tabuas;
      g.fillStyle = ['#c58f55', '#b98247', '#cf9b61', '#bd8a4e'][i % 4];
      g.fillRect(x0, 0, 256 / tabuas, 128);
      g.strokeStyle = 'rgba(110, 66, 30, 0.35)';
      g.lineWidth = 1;
      for (let k = 0; k < 3; k++) {
        g.beginPath();
        g.moveTo(x0 + 6 + k * 9, 0);
        g.bezierCurveTo(x0 + 3 + k * 9, 40, x0 + 12 + k * 9, 80, x0 + 6 + k * 9, 128);
        g.stroke();
      }
      g.fillStyle = '#5d3a1f';
      g.fillRect(x0, 0, 3, 128);
      g.fillStyle = '#3d2a1a';
      for (const y of [14, 114]) g.fillRect(x0 + 256 / tabuas / 2 - 2, y, 4, 4);
    }
  });

/** A viga de madeira: o veio ao comprido e um nó. */
const texturaDaMadeira = () =>
  textura(256, 64, (g) => {
    g.fillStyle = '#9a6438';
    g.fillRect(0, 0, 256, 64);
    g.fillStyle = '#b07646';
    g.fillRect(0, 0, 256, 18);
    g.strokeStyle = 'rgba(80, 46, 22, 0.55)';
    g.lineWidth = 1.5;
    for (let k = 0; k < 6; k++) {
      g.beginPath();
      g.moveTo(0, 8 + k * 9);
      g.bezierCurveTo(80, 4 + k * 9 + (k % 2) * 6, 170, 14 + k * 9, 256, 8 + k * 9);
      g.stroke();
    }
    g.fillStyle = '#6d4223';
    g.beginPath();
    g.ellipse(170, 36, 9, 5, 0, 0, Math.PI * 2);
    g.fill();
  });

/** A viga de aço: a faixa clara de cima e os rebites (dois e meio por casa). */
const texturaDoAco = () =>
  textura(256, 64, (g) => {
    g.fillStyle = '#8796a5';
    g.fillRect(0, 0, 256, 64);
    g.fillStyle = '#b9c5d0';
    g.fillRect(0, 0, 256, 16);
    g.fillStyle = '#6c7a87';
    g.fillRect(0, 58, 256, 6);
    for (const x of [51, 154]) {
      g.fillStyle = '#5f6d7a';
      g.beginPath();
      g.arc(x, 34, 7, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#c9d3dc';
      g.beginPath();
      g.arc(x - 2, 32, 2.5, 0, Math.PI * 2);
      g.fill();
    }
  });

/** O corte da terra na frente da maquete: camadas e pedrinhas. */
const texturaDaTerra = (seca: boolean) =>
  textura(256, 256, (g) => {
    const r = sorteio(seca ? 11 : 23);
    const faixas = ['#a77a4f', '#9b6f46', '#8c623d', '#7c5636', '#6f4c30'];
    for (let i = 0; i < faixas.length; i++) {
      g.fillStyle = faixas[i];
      g.fillRect(0, (i * 256) / faixas.length, 256, 256 / faixas.length + 1);
    }
    for (let i = 0; i < 90; i++) {
      g.fillStyle = r() < 0.5 ? 'rgba(70, 46, 26, 0.35)' : 'rgba(215, 186, 146, 0.3)';
      g.beginPath();
      g.ellipse(r() * 256, r() * 256, 3 + r() * 7, 2 + r() * 3, 0, 0, Math.PI * 2);
      g.fill();
    }
  });

/** A bandeira de chegada, quadriculada. */
const texturaDaBandeira = () =>
  textura(64, 48, (g) => {
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 3; j++) {
        g.fillStyle = (i + j) % 2 ? '#2f2f2f' : '#f5f1e6';
        g.fillRect(i * 16, j * 16, 16, 16);
      }
  });

/** O selo do peso: um peso de academia com o número dentro (sem texto: o número se lê em qualquer idioma). */
function seloDoPeso(tipo: IdDoVeiculo): THREE.Sprite {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 144;
  const g = c.getContext('2d')!;
  g.strokeStyle = '#2f3640';
  g.lineWidth = 16;
  g.beginPath();
  g.arc(64, 44, 30, Math.PI * 1.05, Math.PI * 1.95);
  g.stroke();
  g.fillStyle = '#2f3640';
  g.beginPath();
  g.arc(64, 88, 50, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#fff3e0';
  g.lineWidth = 5;
  g.stroke();
  g.fillStyle = '#fff3e0';
  g.font = '800 50px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(pesoEscrito(tipo), 64, 91);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
  // maior quanto mais pesado: o caminhão se vê de longe
  const k = 0.72 + 0.2 * Math.sqrt(VEICULOS[tipo].massa);
  s.scale.set(k * (128 / 144), k, 1);
  s.renderOrder = 20;
  return s;
}

// =====================================================================================================================
// AS PEÇAS: uma malha de instâncias por tipo, com o comprimento de cada uma no shader (a textura não estica)
// =====================================================================================================================

const COR_DO_TIPO = ['#c99560', '#a86d3e', '#b9c5d0'];
/** A espessura (em y) e a fundura (em z) de cada tipo. A pista vai de uma treliça à outra. */
const PERFIL = [
  { esp: TABUA, fundo: 2 * ZF + 0.14 },
  { esp: 0.2, fundo: 0.15 },
  { esp: 0.17, fundo: 0.15 },
];

class MalhaDePecas {
  readonly malha: THREE.InstancedMesh;
  private comprimentos: THREE.InstancedBufferAttribute;
  private n = 0;
  private aux = new THREE.Object3D();

  constructor(
    geo: THREE.BoxGeometry,
    material: THREE.MeshStandardMaterial,
    capacidade: number,
    private tipo: number,
  ) {
    const g = geo.clone();
    this.comprimentos = new THREE.InstancedBufferAttribute(new Float32Array(capacidade).fill(1), 1);
    this.comprimentos.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('aComprimento', this.comprimentos);
    this.malha = new THREE.InstancedMesh(g, material, capacidade);
    this.malha.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const branco = new THREE.Color('#ffffff');
    for (let i = 0; i < capacidade; i++) this.malha.setColorAt(i, branco);
    this.malha.count = 0;
    this.malha.frustumCulled = false;
  }

  comecar() {
    this.n = 0;
  }

  /** Uma peça de (ax, ay) a (bx, by) no plano z. */
  por(ax: number, ay: number, bx: number, by: number, z: number, cor: THREE.Color) {
    if (this.n >= this.malha.instanceMatrix.count) return;
    const dx = bx - ax;
    const dy = by - ay;
    const l = Math.sqrt(dx * dx + dy * dy);
    if (l < 1e-3) return;
    const p = PERFIL[this.tipo];
    const a = this.aux;
    a.position.set((ax + bx) / 2, (ay + by) / 2, z);
    a.rotation.set(0, 0, Math.atan2(dy, dx));
    a.scale.set(l + (this.tipo === PISTA ? 0.02 : 0.06), p.esp, p.fundo);
    a.updateMatrix();
    this.malha.setMatrixAt(this.n, a.matrix);
    this.malha.setColorAt(this.n, cor);
    this.comprimentos.setX(this.n, l);
    this.n++;
  }

  /** As duas treliças (a pista é uma só, atravessada). */
  porPeca(ax: number, ay: number, bx: number, by: number, cor: THREE.Color) {
    if (this.tipo === PISTA) this.por(ax, ay, bx, by, 0, cor);
    else {
      this.por(ax, ay, bx, by, ZF, cor);
      this.por(ax, ay, bx, by, -ZF, cor);
    }
  }

  fechar() {
    this.malha.count = this.n;
    this.malha.instanceMatrix.needsUpdate = true;
    if (this.malha.instanceColor) this.malha.instanceColor.needsUpdate = true;
    this.comprimentos.needsUpdate = true;
  }
}

/** O material de um tipo de peça: a textura repete pelo comprimento de cada instância (aComprimento). */
function materialDePeca(tipo: number, mapa: THREE.Texture): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({
    map: mapa,
    roughness: tipo === ACO ? 0.42 : 0.85,
    metalness: tipo === ACO ? 0.45 : 0,
  });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aComprimento;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\n#ifdef USE_MAP\nvMapUv.x *= aComprimento;\n#endif');
    // a cor de cada instância PINTA por cima da textura (como a tinta do 2D), em vez de multiplicar: a madeira esforçada fica
    // verde, amarela ou vermelha, e não um marrom sujo. Branco é sem tinta.
    sh.fragmentShader = sh.fragmentShader.replace(
      '#include <color_fragment>',
      // (o vColor é vec3 ou vec4, conforme a versão: só o .rgb)
      '#ifdef USE_COLOR\nfloat tinta = 1.0 - min(min(vColor.r, vColor.g), vColor.b);\ndiffuseColor.rgb = mix(diffuseColor.rgb, vColor.rgb, tinta * 0.62);\n#endif',
    );
  };
  m.customProgramCacheKey = () => 'ponte-peca';
  return m;
}

// =====================================================================================================================
// OS EFEITOS: lascas, gotas, pó, os pedaços que caem e as ondas na água
// =====================================================================================================================

interface Particula {
  p: THREE.Vector3;
  v: THREE.Vector3;
  vida: number;
  tam: number;
  cor: THREE.Color;
  /** Água: some ao bater nela. Pó: quase não cai. */
  tipo: 'lasca' | 'gota' | 'po';
}

interface Pedaco {
  m: THREE.Mesh;
  v: THREE.Vector3;
  giro: THREE.Vector3;
  vida: number;
  molhou: boolean;
}

interface Onda {
  m: THREE.Mesh;
  vida: number;
}

const MAX_PARTICULAS = 500;

interface VeiculoNaCena {
  tipo: IdDoVeiculo;
  raiz: THREE.Group;
  /** O que gira com a inclinação (o corpo e o coelho). */
  corpo: THREE.Group;
  rodas: THREE.Object3D[];
  raioNaCena: number;
  selo: THREE.Sprite;
  coelho: CoelhoCopiado | null;
  tocando: string;
  xAntes: number;
  yAntes: number;
  caiuNaAgua: boolean;
  bateuNoChao: boolean;
}

export class CenaDaPonte implements VistaDaPonte {
  private renderer: THREE.WebGLRenderer;
  private cena = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(30, LARGURA / ALTURA, 0.3, 160);
  private raio = new THREE.Raycaster();
  private plano = new THREE.Plane(new THREE.Vector3(0, 0, 1), -ZF);
  private sombras = false;
  private morta = false;
  private descartaveis: { dispose(): void }[] = [];
  private observador: ResizeObserver;
  private fila: Fila;
  private ultimo = 0;
  private relogio = 0;

  private pecas: MalhaDePecas[] = [];
  private pinos!: THREE.InstancedMesh;
  private travessas!: THREE.InstancedMesh;
  private grade = new THREE.Group();
  private fantasma = new THREE.Group();
  private fantasmaMat: THREE.MeshStandardMaterial[] = [];
  private origem!: THREE.Mesh;
  private cursor!: THREE.Mesh;
  private sobre!: THREE.Mesh;
  private veiculos: VeiculoNaCena[] = [];
  private agua: THREE.Mesh | null = null;
  private tempoDaAgua = { value: 0 };
  private particulas: Particula[] = [];
  private malhaDasParticulas!: THREE.InstancedMesh;
  private pedacos: Pedaco[] = [];
  private ondas: Onda[] = [];
  private geoDoPedaco = new THREE.BoxGeometry(1, 1, 1);
  private matDoPedaco: THREE.MeshStandardMaterial[] = [];
  private geoDaOnda = new THREE.RingGeometry(0.75, 1, 28).rotateX(-Math.PI / 2);
  private aux = new THREE.Object3D();
  private cor = new THREE.Color();
  private branco = new THREE.Color('#ffffff');
  /** O custo do último quadro desenhado, em ms (média móvel), para a medida. */
  ms = 0;

  constructor(
    private caixa: HTMLElement,
    private fase: Fase,
    private aoPerder: () => void,
  ) {
    this.fila = new Fila(fase);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    try {
      this.sombras = !!JSON.parse(localStorage.getItem('syden:graficos') ?? '{}').sombras;
    } catch {
      /* sem */
    }
    this.renderer.shadowMap.enabled = this.sombras;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const tela = this.renderer.domElement;
    tela.className = 'ponte-3d-tela';
    tela.addEventListener('webglcontextlost', this.perdeu);
    caixa.appendChild(tela);
    this.observador = new ResizeObserver(() => this.medir());
    this.observador.observe(caixa);
    this.medir();
  }

  private perdeu = (ev: Event) => {
    ev.preventDefault();
    if (!this.morta) this.aoPerder();
  };

  private medir() {
    const w = Math.max(1, this.caixa.clientWidth);
    const h = Math.max(1, this.caixa.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.enquadrar();
  }

  /**
   * A câmera de viés, longe o bastante para a fila do tráfego, o vão e a chegada caberem entre 10% do alto e 20% de baixo (as
   * faixas do painel). A direção é fixa; a distância sai por busca, e o alvo anda até o meio da área ficar no meio da janela livre.
   */
  private enquadrar() {
    const f = this.fase;
    const cam = this.camera;
    const x0 = fimDaFila(f) - 0.4;
    const x1 = f.largura + 3.4;
    const y0 = f.baixo - 0.5;
    const y1 = f.alto + 1.1;
    const cantos: THREE.Vector3[] = [];
    for (const x of [x0, x1]) for (const y of [y0, y1]) for (const z of [ZF, -ZF]) cantos.push(new THREE.Vector3(x, y, z));
    const dir = new THREE.Vector3(-0.17, 0.3, 1).normalize();
    const alvo = new THREE.Vector3((x0 + x1) / 2, (y0 + y1) / 2, 0);
    const livre = { x0: -0.97, x1: 0.97, y0: -0.58, y1: 0.8 };
    const v = new THREE.Vector3();
    const caixa = (d: number) => {
      cam.position.copy(alvo).addScaledVector(dir, d);
      cam.lookAt(alvo);
      cam.updateMatrixWorld();
      cam.updateProjectionMatrix();
      let a = Infinity;
      let b = -Infinity;
      let c = Infinity;
      let e = -Infinity;
      for (const k of cantos) {
        v.copy(k).project(cam);
        a = Math.min(a, v.x);
        b = Math.max(b, v.x);
        c = Math.min(c, v.y);
        e = Math.max(e, v.y);
      }
      return { x0: a, x1: b, y0: c, y1: e };
    };
    let d = 30;
    for (let volta = 0; volta < 4; volta++) {
      let lo = 3;
      let hi = 200;
      for (let k = 0; k < 28; k++) {
        const m = (lo + hi) / 2;
        const b = caixa(m);
        if (b.x1 - b.x0 <= livre.x1 - livre.x0 && b.y1 - b.y0 <= livre.y1 - livre.y0) hi = m;
        else lo = m;
      }
      d = hi;
      const b = caixa(d);
      // leva o meio da área ao meio da janela livre
      const dx = (b.x0 + b.x1) / 2 - (livre.x0 + livre.x1) / 2;
      const dy = (b.y0 + b.y1) / 2 - (livre.y0 + livre.y1) / 2;
      const meia = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * d;
      const direita = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0);
      const cima = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
      alvo.addScaledVector(direita, dx * meia * cam.aspect).addScaledVector(cima, dy * meia);
    }
    caixa(d);
  }

  // ------------------------------------------------------------------------------------------------------------------------------
  // A MONTAGEM DA CENA
  // ------------------------------------------------------------------------------------------------------------------------------

  /** Carrega os modelos e monta o que não muda. Rejeita se um veículo não vier (a tela fica no 2D); sem o coelho, a carroça vai só. */
  async montar(): Promise<void> {
    const usados = [...new Set(this.fase.trafego.map((t) => MODELO[t].arquivo))];
    const [modelos, coelho] = await Promise.all([
      Promise.all(usados.map(carregar)),
      this.fase.trafego.includes('carroca') ? carregarCoelho().catch(() => null) : Promise.resolve(null),
    ]);
    if (this.morta) return;
    const porArquivo = new Map(usados.map((u, i) => [u, modelos[i]]));
    this.montarMundo();
    this.montarPecas();
    this.fase.trafego.forEach((t) => this.montarVeiculo(t, porArquivo.get(MODELO[t].arquivo)!, coelho));
  }

  private guardar<T extends { dispose(): void }>(o: T): T {
    this.descartaveis.push(o);
    return o;
  }

  private caixaNaCena(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, mat: THREE.Material | THREE.Material[], sombra = true) {
    const m = new THREE.Mesh(this.guardar(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0)), mat);
    m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    m.receiveShadow = sombra && this.sombras;
    this.cena.add(m);
    return m;
  }

  private montarMundo() {
    const c = this.cena;
    const f = this.fase;
    const L = f.largura;
    const seca = f.agua === null;
    const r = sorteio(L * 977 + f.alto * 31 + f.ancoras.length);
    c.background = new THREE.Color(COR_DO_FUNDO);
    c.fog = new THREE.Fog(COR_DO_FUNDO, 38, 95);
    c.add(new THREE.HemisphereLight('#f4fbff', '#7d8f5c', 1.5));
    const sol = new THREE.DirectionalLight('#fff1d6', 2.1);
    sol.position.set(-8, 16, 12);
    sol.target.position.set(L / 2, 0, 0);
    c.add(sol, sol.target);
    if (this.sombras) {
      sol.castShadow = true;
      sol.shadow.mapSize.set(2048, 2048);
      const s = sol.shadow.camera;
      s.left = -22;
      s.right = 22;
      s.top = 14;
      s.bottom = -14;
      s.near = 1;
      s.far = 60;
    }

    // ---- as margens: a terra cortada na frente, a grama em cima e a estrada de terra ----
    const terra = this.guardar(new THREE.MeshStandardMaterial({ color: '#9b6f46', roughness: 1, flatShading: true }));
    const corte = this.guardar(new THREE.MeshStandardMaterial({ map: this.guardar(texturaDaTerra(seca)), roughness: 1 }));
    const grama = this.guardar(new THREE.MeshStandardMaterial({ color: seca ? '#9fb466' : '#7cb45a', roughness: 1 }));
    // a ordem das faces da caixa: +x, −x, +y, −y, +z, −z
    const margem = [terra, terra, grama, terra, corte, terra];
    const baixoDaMaquete = f.fundo - 3.2;
    this.caixaNaCena(-34, 0, baixoDaMaquete, 0, FUNDO_DA_MAQUETE, ZD, margem);
    this.caixaNaCena(L, L + 34, baixoDaMaquete, 0, FUNDO_DA_MAQUETE, ZD, margem);
    const estrada = this.guardar(new THREE.MeshStandardMaterial({ color: '#c9a877', roughness: 1 }));
    for (const [a, b] of [
      [-34, 0],
      [L, L + 34],
    ])
      this.caixaNaCena(a, b, 0, 0.06, -1.0, 1.0, estrada);

    // ---- o fundo do vão: o leito do rio ou o chão da ravina, com as pedras ----
    const leito = this.guardar(new THREE.MeshStandardMaterial({ color: seca ? '#8a6f55' : '#6f8a6b', roughness: 1 }));
    this.caixaNaCena(0, L, baixoDaMaquete, f.fundo, FUNDO_DA_MAQUETE, ZD, [terra, terra, leito, terra, corte, terra]);
    const pedra = this.guardar(new THREE.MeshStandardMaterial({ color: '#8d877f', roughness: 0.95, flatShading: true }));
    const geoPedra = this.guardar(new THREE.IcosahedronGeometry(1, 0));
    for (let i = 0; i < L * 4; i++) {
      const m = new THREE.Mesh(geoPedra, pedra);
      const s = 0.12 + r() * 0.3;
      m.scale.set(s * 1.4, s * 0.7, s);
      m.rotation.set(r() * 3, r() * 3, r() * 3);
      m.position.set(0.4 + r() * (L - 0.8), f.fundo + s * 0.2, ZD - 0.4 - r() * 14);
      c.add(m);
    }

    // ---- a água: a superfície com ondas (no shader) e a frente da maquete, mais escura ----
    if (f.agua !== null) {
      const geo = this.guardar(new THREE.PlaneGeometry(L, ZD - FUNDO_DA_MAQUETE, Math.max(8, L * 3), 40).rotateX(-Math.PI / 2));
      const mat = this.guardar(
        new THREE.MeshStandardMaterial({ color: '#4f9fc4', roughness: 0.18, metalness: 0.05, transparent: true, opacity: 0.8, flatShading: true }),
      );
      const tempo = this.tempoDaAgua;
      mat.onBeforeCompile = (sh) => {
        sh.uniforms.uTempo = tempo;
        sh.vertexShader = sh.vertexShader
          .replace('#include <common>', '#include <common>\nuniform float uTempo;')
          .replace(
            '#include <begin_vertex>',
            '#include <begin_vertex>\ntransformed.y += 0.05 * sin(position.x * 1.7 + uTempo * 1.6) + 0.04 * sin(position.z * 1.1 - uTempo * 2.2);',
          );
      };
      mat.customProgramCacheKey = () => 'ponte-agua';
      const agua = new THREE.Mesh(geo, mat);
      agua.position.set(L / 2, f.agua, (ZD + FUNDO_DA_MAQUETE) / 2);
      agua.renderOrder = 2;
      c.add(agua);
      this.agua = agua;
      const frente = new THREE.Mesh(
        this.guardar(new THREE.PlaneGeometry(L, f.agua - f.fundo)),
        this.guardar(new THREE.MeshStandardMaterial({ color: '#2f7aa6', roughness: 0.3, transparent: true, opacity: 0.7 })),
      );
      frente.position.set(L / 2, (f.agua + f.fundo) / 2, ZD - 0.01);
      frente.renderOrder = 2;
      c.add(frente);
    }

    // ---- a pedra no meio do rio (a fase 5) ----
    for (let i = 0; i < f.pedras.length; i += 2) {
      const px = f.pedras[i];
      const topo = f.pedras[i + 1];
      const alto = topo - 0.12 - (f.fundo - 0.4);
      const g = this.guardar(new THREE.CylinderGeometry(0.85, 1.45, alto, 7, 2));
      const pos = g.attributes.position;
      const rr = sorteio(px * 31 + 7);
      for (let k = 0; k < pos.count; k++) {
        if (pos.getY(k) > alto / 2 - 1e-3) continue;
        pos.setX(k, pos.getX(k) * (0.85 + rr() * 0.3));
        pos.setZ(k, pos.getZ(k) * (0.85 + rr() * 0.3));
      }
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, pedra);
      m.position.set(px, f.fundo - 0.4 + alto / 2, 0);
      m.castShadow = this.sombras;
      c.add(m);
    }

    // ---- os pilares de pedra nas margens (a fase dos apoios altos), um de cada lado da estrada ----
    const pilar = this.guardar(new THREE.MeshStandardMaterial({ color: '#a39d94', roughness: 0.95, flatShading: true }));
    const capitel = this.guardar(new THREE.MeshStandardMaterial({ color: '#bab4aa', roughness: 0.9 }));
    for (let i = 0; i < f.ancoras.length; i += 2) {
      const ax = f.ancoras[i];
      const ay = f.ancoras[i + 1];
      if (ay <= 0 || (ax !== 0 && ax !== L)) continue;
      const fora = ax === 0 ? -1 : 1;
      const xa = Math.min(ax, ax + fora * 0.8);
      for (const z of [ZF + 0.12, -ZF - 0.12]) {
        const m = this.caixaNaCena(xa, xa + 0.8, 0, ay + 0.35, z - 0.2, z + 0.2, pilar);
        m.castShadow = this.sombras;
        this.caixaNaCena(xa - 0.07, xa + 0.87, ay + 0.35, ay + 0.5, z - 0.26, z + 0.26, capitel);
      }
    }

    // ---- os apoios: o bloco de pedra e a marca vermelha, nas duas treliças ----
    const bloco = this.guardar(new THREE.MeshStandardMaterial({ color: '#6e6861', roughness: 0.9 }));
    const vermelho = this.guardar(new THREE.MeshStandardMaterial({ color: '#d0524c', roughness: 0.55, emissive: '#5a1612', emissiveIntensity: 0.4 }));
    const geoBloco = this.guardar(new THREE.BoxGeometry(0.42, 0.42, 0.3));
    const geoMarca = this.guardar(new THREE.CylinderGeometry(0.15, 0.15, 0.06, 18).rotateX(Math.PI / 2));
    for (let i = 0; i < f.ancoras.length; i += 2) {
      for (const z of [ZF, -ZF]) {
        const b = new THREE.Mesh(geoBloco, bloco);
        b.position.set(f.ancoras[i], f.ancoras[i + 1], z);
        c.add(b);
        const m = new THREE.Mesh(geoMarca, vermelho);
        m.position.set(f.ancoras[i], f.ancoras[i + 1], z + (z > 0 ? 0.17 : -0.17));
        c.add(m);
      }
    }

    // ---- as árvores (atrás da estrada, e nas pontas da frente, longe da fila) e os morros lá longe ----
    const tronco = this.guardar(new THREE.MeshStandardMaterial({ color: '#7a5233', roughness: 1, flatShading: true }));
    const copa = this.guardar(new THREE.MeshStandardMaterial({ color: seca ? '#8fa257' : '#5f9e4e', roughness: 1, flatShading: true }));
    const copa2 = this.guardar(new THREE.MeshStandardMaterial({ color: seca ? '#a8a65e' : '#78b45c', roughness: 1, flatShading: true }));
    const geoTronco = this.guardar(new THREE.CylinderGeometry(0.09, 0.13, 0.8, 6));
    const geoCopa = this.guardar(new THREE.ConeGeometry(0.55, 1.4, 7));
    const geoBola = this.guardar(new THREE.IcosahedronGeometry(0.6, 0));
    const arvore = (x: number, z: number, s: number, pinheiro: boolean) => {
      const g = new THREE.Group();
      const t = new THREE.Mesh(geoTronco, tronco);
      t.position.y = 0.4;
      g.add(t);
      const k = new THREE.Mesh(pinheiro ? geoCopa : geoBola, r() < 0.5 ? copa : copa2);
      k.position.y = pinheiro ? 1.3 : 1.15;
      g.add(k);
      g.scale.setScalar(s);
      g.position.set(x, 0, z);
      g.rotation.y = r() * 6;
      g.traverse((o) => (o.castShadow = this.sombras));
      c.add(g);
    };
    const filaFim = fimDaFila(f);
    for (let i = 0; i < 46; i++) {
      const esquerda = i % 2 === 0;
      const x = esquerda ? -1 - r() * 22 : L + 1 + r() * 22;
      arvore(x, -1.8 - r() * 16, 0.8 + r() * 0.9, r() < 0.45);
    }
    for (let i = 0; i < 6; i++) {
      const esquerda = i % 2 === 0;
      const x = esquerda ? filaFim - 2 - r() * 8 : L + 4.6 + r() * 8;
      arvore(x, 1.6 + r() * 1.4, 0.6 + r() * 0.4, r() < 0.5);
    }
    const morro = this.guardar(new THREE.MeshStandardMaterial({ color: '#8fbf7d', roughness: 1, flatShading: true }));
    for (let i = 0; i < 9; i++) {
      const m = new THREE.Mesh(geoBola, morro);
      m.scale.set(9 + r() * 8, 4 + r() * 4, 6);
      m.position.set(-30 + i * 9 + L / 2 + r() * 4, -1, FUNDO_DA_MAQUETE - 4 - r() * 6);
      c.add(m);
    }
    const nuvem = this.guardar(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, emissive: '#e8f4ff', emissiveIntensity: 0.35, flatShading: true }));
    for (let i = 0; i < 7; i++) {
      const g = new THREE.Group();
      for (let j = 0; j < 3; j++) {
        const m = new THREE.Mesh(geoBola, nuvem);
        const s = 1.2 + r() * 1.3;
        m.scale.set(s * 1.5, s * 0.75, s);
        m.position.set((j - 1) * 1.6, r() * 0.5, 0);
        g.add(m);
      }
      g.position.set(L / 2 - 26 + i * 9 + r() * 3, 9 + r() * 5, -30 - r() * 10);
      c.add(g);
    }

    // ---- a bandeira de chegada ----
    const mastro = new THREE.Mesh(this.guardar(new THREE.CylinderGeometry(0.04, 0.04, 1.8, 8)), tronco);
    mastro.position.set(L + 2.6, 0.9, -1.25);
    c.add(mastro);
    const pano = new THREE.Mesh(
      this.guardar(new THREE.PlaneGeometry(0.72, 0.54)),
      this.guardar(new THREE.MeshStandardMaterial({ map: this.guardar(texturaDaBandeira()), side: THREE.DoubleSide, roughness: 0.9 })),
    );
    pano.position.set(L + 2.6 + 0.37, 1.5, -1.25);
    c.add(pano);
  }

  private montarPecas() {
    const c = this.cena;
    const f = this.fase;
    const caixa = this.guardar(new THREE.BoxGeometry(1, 1, 1));
    const mapas = [this.guardar(texturaDaPista()), this.guardar(texturaDaMadeira()), this.guardar(texturaDoAco())];
    for (let t = 0; t < 3; t++) {
      const mat = this.guardar(materialDePeca(t, mapas[t]));
      const m = new MalhaDePecas(caixa, mat, MAX_PECAS * 4 + 8, t);
      this.guardar(m.malha.geometry);
      this.guardar(m.malha);
      m.malha.castShadow = this.sombras;
      m.malha.receiveShadow = this.sombras;
      c.add(m.malha);
      this.pecas.push(m);
      // o pedaço que cai, quando a peça quebra (sem o comprimento por instância: é um bloco só)
      this.matDoPedaco.push(this.guardar(new THREE.MeshStandardMaterial({ map: mapas[t], roughness: t === ACO ? 0.42 : 0.85, metalness: t === ACO ? 0.45 : 0 })));
      // o fantasma da peça que vai entrar
      this.fantasmaMat.push(this.guardar(new THREE.MeshStandardMaterial({ color: COR_DO_TIPO[t], transparent: true, opacity: 0.55, depthWrite: false })));
    }
    this.descartaveis.push(this.geoDoPedaco, this.geoDaOnda);
    // os pinos (a cabeça, nas duas treliças) e as travessas entre elas
    const ferro = this.guardar(new THREE.MeshStandardMaterial({ color: '#3a3530', roughness: 0.5, metalness: 0.4 }));
    this.pinos = new THREE.InstancedMesh(this.guardar(new THREE.CylinderGeometry(0.085, 0.085, 0.07, 12).rotateX(Math.PI / 2)), ferro, 800);
    this.travessas = new THREE.InstancedMesh(this.guardar(new THREE.CylinderGeometry(0.035, 0.035, 2 * ZF, 6).rotateX(Math.PI / 2)), ferro, 400);
    for (const m of [this.pinos, this.travessas]) {
      m.count = 0;
      m.frustumCulled = false;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.guardar(m);
      c.add(m);
    }
    // a grade de encaixe: a área clara, as linhas e os pontos, no plano da treliça da frente
    const area = new THREE.Mesh(
      this.guardar(new THREE.PlaneGeometry(f.largura, f.alto - f.baixo)),
      this.guardar(new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.1, depthWrite: false })),
    );
    area.position.set(f.largura / 2, (f.alto + f.baixo) / 2, ZF - 0.02);
    this.grade.add(area);
    const linhas: number[] = [];
    for (let x = 0; x <= f.largura; x++) linhas.push(x, f.baixo, ZF, x, f.alto, ZF);
    for (let y = f.baixo; y <= f.alto; y++) linhas.push(0, y, ZF, f.largura, y, ZF);
    const geoLinhas = this.guardar(new THREE.BufferGeometry());
    geoLinhas.setAttribute('position', new THREE.Float32BufferAttribute(linhas, 3));
    this.grade.add(new THREE.LineSegments(geoLinhas, this.guardar(new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.18, depthWrite: false }))));
    const pontos: [number, number][] = [];
    for (let x = 0; x <= f.largura; x++) for (let y = f.baixo; y <= f.alto; y++) if (cabe(f, x, y) && !ehAncora(f, x, y)) pontos.push([x, y]);
    const geoPonto = this.guardar(new THREE.CircleGeometry(0.065, 12));
    const matPonto = this.guardar(new THREE.MeshBasicMaterial({ color: '#28323c', transparent: true, opacity: 0.55, depthWrite: false }));
    const dots = new THREE.InstancedMesh(geoPonto, matPonto, Math.max(1, pontos.length));
    pontos.forEach(([x, y], i) => {
      this.aux.position.set(x, y, ZF + 0.02);
      this.aux.rotation.set(0, 0, 0);
      this.aux.scale.setScalar(1);
      this.aux.updateMatrix();
      dots.setMatrixAt(i, this.aux.matrix);
    });
    dots.count = pontos.length;
    this.guardar(dots);
    this.grade.add(dots);
    this.grade.renderOrder = 3;
    c.add(this.grade);
    // o fantasma: a viga da frente e a de trás (a pista é uma tábua atravessada só)
    for (let i = 0; i < 2; i++) this.fantasma.add(new THREE.Mesh(caixa, this.fantasmaMat[0]));
    this.fantasma.visible = false;
    c.add(this.fantasma);
    // o nó escolhido, o cursor do teclado e o ponto debaixo do mouse
    const amarelo = this.guardar(new THREE.MeshBasicMaterial({ color: '#ffcf5a' }));
    this.origem = new THREE.Mesh(this.guardar(new THREE.SphereGeometry(0.14, 16, 10)), amarelo);
    this.cursor = new THREE.Mesh(this.guardar(new THREE.TorusGeometry(0.25, 0.035, 8, 28)), amarelo);
    this.sobre = new THREE.Mesh(
      this.guardar(new THREE.TorusGeometry(0.2, 0.025, 8, 28)),
      this.guardar(new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9 })),
    );
    for (const m of [this.origem, this.cursor, this.sobre]) {
      m.visible = false;
      m.renderOrder = 5;
      c.add(m);
    }
    // as partículas (lascas, gotas e pó): uma malha só, com a cor de cada uma
    this.malhaDasParticulas = new THREE.InstancedMesh(
      this.guardar(new THREE.IcosahedronGeometry(0.5, 0)),
      this.guardar(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6, flatShading: true })),
      MAX_PARTICULAS,
    );
    for (let i = 0; i < MAX_PARTICULAS; i++) this.malhaDasParticulas.setColorAt(i, this.branco);
    this.malhaDasParticulas.count = 0;
    this.malhaDasParticulas.frustumCulled = false;
    this.guardar(this.malhaDasParticulas);
    c.add(this.malhaDasParticulas);
  }

  private montarVeiculo(tipo: IdDoVeiculo, g: GLTF, coelho: GLTF | null) {
    const info = MODELO[tipo];
    const k = info.comprimento / info.corpo;
    const raiz = new THREE.Group();
    const corpo = new THREE.Group();
    raiz.add(corpo);
    const modelo = g.scene.clone(true);
    modelo.rotation.y = Math.PI / 2;
    modelo.scale.setScalar(k);
    const rodas: THREE.Object3D[] = [];
    modelo.traverse((o) => {
      if (/wheel/i.test(o.name)) rodas.push(o);
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = this.sombras;
        o.receiveShadow = this.sombras;
      }
    });
    corpo.add(modelo);
    let copia: CoelhoCopiado | null = null;
    if (tipo === 'carroca' && coelho) {
      // o coelho que puxa a carroça, na ponta do cabo, de frente para a chegada
      copia = copiarCoelho(coelho, { altura: 0.78, sombras: this.sombras });
      copia.corpo.rotation.y = Math.PI / 2;
      copia.corpo.position.set(3.05 * k + 0.12, 0, 0);
      corpo.add(copia.corpo);
      copia.acoes.get('parado')?.play();
    }
    const selo = seloDoPeso(tipo);
    const alto = tipo === 'caminhao' ? 2.05 : tipo === 'carro' ? 1.6 : 1.7;
    selo.position.set(0, alto, 0);
    raiz.add(selo);
    raiz.visible = false;
    this.cena.add(raiz);
    this.descartaveis.push(selo.material.map!, selo.material);
    this.veiculos.push({
      tipo,
      raiz,
      corpo,
      rodas,
      raioNaCena: info.raio * k,
      selo,
      coelho: copia,
      tocando: 'parado',
      xAntes: NaN,
      yAntes: 0,
      caiuNaAgua: false,
      bateuNoChao: false,
    });
  }

  // ------------------------------------------------------------------------------------------------------------------------------
  // O QUE MUDA A CADA QUADRO
  // ------------------------------------------------------------------------------------------------------------------------------

  private passoDoRelogio(agora: number): number {
    const dt = this.ultimo ? Math.min(0.1, (agora - this.ultimo) / 1000) : 0;
    this.ultimo = agora;
    this.relogio += dt;
    this.tempoDaAgua.value = this.relogio;
    return dt;
  }

  private corDoEsforco(e: number): THREE.Color {
    const v = e < 0 ? 0 : e > 1 ? 1 : e;
    return this.cor.setHSL((120 * (1 - v)) / 360, 0.78, 0.46 - 0.06 * v, THREE.SRGBColorSpace);
  }

  /** Os pinos de cada nó (a cabeça nas duas treliças e a travessa entre elas). */
  private porNos(nos: readonly (readonly [number, number])[]) {
    let n = 0;
    let t = 0;
    const a = this.aux;
    a.rotation.set(0, 0, 0);
    a.scale.setScalar(1);
    for (const [x, y] of nos) {
      for (const z of [ZF + 0.09, -ZF - 0.09]) {
        if (n >= 800) break;
        a.position.set(x, y, z);
        a.updateMatrix();
        this.pinos.setMatrixAt(n++, a.matrix);
      }
      if (t < 400) {
        a.position.set(x, y, 0);
        a.updateMatrix();
        this.travessas.setMatrixAt(t++, a.matrix);
      }
    }
    this.pinos.count = n;
    this.travessas.count = t;
    this.pinos.instanceMatrix.needsUpdate = true;
    this.travessas.instanceMatrix.needsUpdate = true;
  }

  /** Os veículos: onde a fila (ou a regra) os põe, a inclinação, as rodas girando, o selo de quem espera e o coelho andando. */
  private porVeiculos(s: Sim | null, xs: readonly number[], dt: number) {
    const f = this.fase;
    this.veiculos.forEach((vc, i) => {
      const v = s?.veiculos[i];
      const estado = v?.estado ?? ESPERANDO;
      const x = xs[i];
      const y = v?.y ?? 0;
      vc.raiz.visible = estado !== CHEGOU;
      if (!vc.raiz.visible) return;
      vc.raiz.position.set(x, y + (x > 0 && x < f.largura ? TABUA / 2 : 0.06), 0);
      let ang = Math.atan(v?.inclinacao ?? 0);
      if (estado === CAIU) ang -= Math.min(0.9, -(v?.vy ?? 0) * 0.08);
      vc.corpo.rotation.z = ang;
      const parado = !s || naFila(s, i);
      vc.selo.visible = parado;
      // as rodas, pelo quanto andou
      if (!Number.isNaN(vc.xAntes)) {
        const giro = (x - vc.xAntes) / vc.raioNaCena;
        for (const r of vc.rodas) r.rotation.x += giro;
      }
      const andando = !Number.isNaN(vc.xAntes) && Math.abs(x - vc.xAntes) > 1e-4 && estado !== CAIU;
      vc.xAntes = x;
      if (vc.coelho) {
        const quer = andando ? 'andando' : 'parado';
        if (quer !== vc.tocando) {
          const nova = vc.coelho.acoes.get(quer);
          const velha = vc.coelho.acoes.get(vc.tocando);
          if (nova) {
            nova.reset().play();
            if (velha) nova.crossFadeFrom(velha, 0.2, false);
            vc.tocando = quer;
          }
        }
        vc.coelho.mixer.update(dt);
      }
      // a queda: o respingo ao chegar na água, o pó ao bater no fundo da ravina
      if (estado === CAIU) {
        if (f.agua !== null && !vc.caiuNaAgua && vc.yAntes >= f.agua && y < f.agua) {
          vc.caiuNaAgua = true;
          this.respingo(x, f.agua, 34, 1.4);
        }
        if (f.agua === null && !vc.bateuNoChao && y <= f.fundo + 0.02) {
          vc.bateuNoChao = true;
          this.poeira(x, f.fundo);
        }
      } else {
        vc.caiuNaAgua = false;
        vc.bateuNoChao = false;
      }
      vc.yAntes = y;
    });
  }

  private esconderMontagem() {
    this.grade.visible = false;
    this.fantasma.visible = false;
    this.origem.visible = false;
    this.cursor.visible = false;
    this.sobre.visible = false;
  }

  montagem(pecas: readonly number[], o: OpcoesDaMontagem) {
    if (this.morta) return;
    const t0 = performance.now();
    const dt = this.passoDoRelogio(o.agora);
    const f = this.fase;
    for (const m of this.pecas) m.comecar();
    const nos = new Map<string, [number, number]>();
    for (let i = 0; i + 4 < pecas.length; i += 5) {
      const tipo = pecas[i + 4];
      const cor = o.apagando === i / 5 ? this.cor.set('#ff6b5e') : this.branco;
      this.pecas[tipo]?.porPeca(pecas[i], pecas[i + 1], pecas[i + 2], pecas[i + 3], cor);
      for (const [x, y] of [
        [pecas[i], pecas[i + 1]],
        [pecas[i + 2], pecas[i + 3]],
      ])
        if (!ehAncora(f, x, y)) nos.set(`${x},${y}`, [x, y]);
    }
    for (const m of this.pecas) m.fechar();
    this.porNos([...nos.values()]);
    this.grade.visible = true;
    // o fantasma
    const fz = o.fantasma;
    this.fantasma.visible = !!fz;
    if (fz) {
      const dx = fz.bx - fz.ax;
      const dy = fz.by - fz.ay;
      const l = Math.sqrt(dx * dx + dy * dy);
      const p = PERFIL[fz.tipo];
      const mat = fz.valida ? this.fantasmaMat[fz.tipo] : this.fantasmaMat[0];
      if (!fz.valida) mat.color.set('#e0574e');
      else mat.color.set(COR_DO_TIPO[fz.tipo]);
      this.fantasma.children.forEach((c, i) => {
        const m = c as THREE.Mesh;
        m.material = mat;
        m.visible = fz.tipo !== PISTA || i === 0;
        m.position.set((fz.ax + fz.bx) / 2, (fz.ay + fz.by) / 2, fz.tipo === PISTA ? 0 : i === 0 ? ZF : -ZF);
        m.rotation.set(0, 0, Math.atan2(dy, dx));
        m.scale.set(Math.max(0.01, l), p.esp * 1.15, p.fundo * 1.1);
      });
    }
    const ponto = (m: THREE.Mesh, q: readonly [number, number] | null | undefined, z = ZF + 0.12) => {
      m.visible = !!q;
      if (q) m.position.set(q[0], q[1], z);
    };
    ponto(this.origem, o.origem);
    ponto(this.cursor, o.cursor);
    ponto(this.sobre, o.cursor ? null : o.sobre);
    this.porVeiculos(null, this.fila.parada(), dt);
    this.animarEfeitos(dt);
    this.desenhar(t0);
  }

  ouvir(s: Sim) {
    if (this.morta) return;
    for (const ev of s.eventos) {
      if (ev.tipo !== 'quebrou') continue;
      const b = s.barras[ev.barra];
      const a = s.nos[b.a];
      const c = s.nos[b.b];
      // o meio da peça se solta e cai, girando, e as lascas voam
      const zs = b.tipo === PISTA ? [0] : [ZF, -ZF];
      for (const z of zs) this.soltarPedaco(a.x, a.y, c.x, c.y, b.tipo, z);
      const mx = (a.x + c.x) / 2;
      const my = (a.y + c.y) / 2;
      const cor = new THREE.Color(COR_DO_TIPO[b.tipo]);
      for (let k = 0; k < 14; k++)
        this.particula('lasca', mx, my, (Math.random() - 0.5) * 1.8, (Math.random() - 0.5) * 4.5, Math.random() * 3.4, (Math.random() - 0.5) * 3, 0.05 + Math.random() * 0.07, cor);
    }
  }

  simulacao(s: Sim, agora: number) {
    if (this.morta) return;
    const t0 = performance.now();
    const dt = this.passoDoRelogio(agora);
    this.esconderMontagem();
    for (const m of this.pecas) m.comecar();
    const k = 0.36;
    const toco = new THREE.Color();
    for (const b of s.barras) {
      const a = s.nos[b.a];
      const c = s.nos[b.b];
      const malha = this.pecas[b.tipo];
      if (b.inteira) malha.porPeca(a.x, a.y, c.x, c.y, this.corDoEsforco(b.esforco));
      else {
        // os dois tocos que ficam pendurados, escurecidos
        toco.set('#7a6a5c');
        malha.porPeca(a.x, a.y, a.x + (c.x - a.x) * k, a.y + (c.y - a.y) * k, toco);
        malha.porPeca(c.x, c.y, c.x + (a.x - c.x) * k, c.y + (a.y - c.y) * k, toco);
      }
    }
    for (const m of this.pecas) m.fechar();
    const nos: [number, number][] = [];
    for (const n of s.nos) if (!n.fixo && n.m > 0.31) nos.push([n.x, n.y]);
    this.porNos(nos);
    this.porVeiculos(s, this.fila.atualizar(s, dt), dt);
    this.animarEfeitos(dt);
    this.desenhar(t0);
  }

  // ------------------------------------------------------------------------------------------------------------------------------
  // OS EFEITOS
  // ------------------------------------------------------------------------------------------------------------------------------

  private particula(tipo: Particula['tipo'], x: number, y: number, z: number, vx: number, vy: number, vz: number, tam: number, cor: THREE.Color) {
    if (this.particulas.length >= MAX_PARTICULAS) this.particulas.shift();
    this.particulas.push({ p: new THREE.Vector3(x, y, z), v: new THREE.Vector3(vx, vy, vz), vida: 1, tam, cor: cor.clone(), tipo });
  }

  private respingo(x: number, y: number, n: number, forca: number) {
    const branco = new THREE.Color('#e6f6ff');
    const azul = new THREE.Color('#9fd4ee');
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * 1.6 * forca;
      this.particula('gota', x + Math.cos(a) * 0.2, y, Math.sin(a) * 0.3, Math.cos(a) * r, (2.2 + Math.random() * 3) * forca, Math.sin(a) * r, 0.05 + Math.random() * 0.08, k % 3 ? branco : azul);
    }
    for (let i = 0; i < 2; i++) this.onda(x, y, 0.5 + i * 0.4);
  }

  private poeira(x: number, y: number) {
    const cor = new THREE.Color('#c9ab84');
    for (let k = 0; k < 26; k++)
      this.particula('po', x + (Math.random() - 0.5) * 1.4, y + 0.1, (Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 2.4, 0.4 + Math.random() * 1.2, (Math.random() - 0.5) * 1.6, 0.12 + Math.random() * 0.14, cor);
  }

  private onda(x: number, y: number, escala: number) {
    if (this.ondas.length > 8) return;
    const m = new THREE.Mesh(this.geoDaOnda, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.75, depthWrite: false }));
    m.position.set(x, y + 0.06, 0);
    m.scale.setScalar(escala);
    m.renderOrder = 4;
    this.cena.add(m);
    this.ondas.push({ m, vida: 1 });
  }

  private soltarPedaco(ax: number, ay: number, bx: number, by: number, tipo: number, z: number) {
    if (this.pedacos.length > 40) return;
    const dx = bx - ax;
    const dy = by - ay;
    const l = Math.sqrt(dx * dx + dy * dy);
    const p = PERFIL[tipo];
    const m = new THREE.Mesh(this.geoDoPedaco, this.matDoPedaco[tipo]);
    m.position.set((ax + bx) / 2, (ay + by) / 2, z);
    m.rotation.set(0, 0, Math.atan2(dy, dx));
    m.scale.set(l * 0.26, p.esp, p.fundo);
    m.castShadow = this.sombras;
    this.cena.add(m);
    this.pedacos.push({
      m,
      v: new THREE.Vector3((Math.random() - 0.5) * 1.6, 0.6 + Math.random() * 1.6, (Math.random() - 0.5) * 0.8),
      giro: new THREE.Vector3((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 7),
      vida: 5,
      molhou: false,
    });
  }

  private animarEfeitos(dt: number) {
    const f = this.fase;
    const agua = f.agua;
    // os pedaços: caem girando; na água, afundam devagar com um respingo; no fundo, ficam
    for (const p of this.pedacos) {
      p.vida -= dt;
      const m = p.m;
      if (agua !== null && m.position.y < agua) {
        if (!p.molhou) {
          p.molhou = true;
          this.respingo(m.position.x, agua, 10, 0.55);
          p.v.multiplyScalar(0.2);
        }
        p.v.y = Math.max(p.v.y - 1.2 * dt, -0.6);
        p.giro.multiplyScalar(1 - 2 * dt);
      } else p.v.y -= 9.8 * dt;
      m.position.addScaledVector(p.v, dt);
      if (m.position.y < f.fundo + 0.05) {
        m.position.y = f.fundo + 0.05;
        p.v.set(0, 0, 0);
        p.giro.set(0, 0, 0);
      }
      m.rotation.x += p.giro.x * dt;
      m.rotation.y += p.giro.y * dt;
      m.rotation.z += p.giro.z * dt;
    }
    this.pedacos = this.pedacos.filter((p) => {
      if (p.vida > 0) return true;
      this.cena.remove(p.m);
      return false;
    });
    // as ondas na água: abrem e somem
    for (const o of this.ondas) {
      o.vida -= dt * 1.1;
      o.m.scale.multiplyScalar(1 + dt * 1.8);
      (o.m.material as THREE.MeshBasicMaterial).opacity = Math.max(0, o.vida * 0.75);
    }
    this.ondas = this.ondas.filter((o) => {
      if (o.vida > 0) return true;
      this.cena.remove(o.m);
      (o.m.material as THREE.Material).dispose();
      return false;
    });
    // as partículas
    const a = this.aux;
    a.rotation.set(0, 0, 0);
    let n = 0;
    for (const p of this.particulas) {
      p.vida -= dt * (p.tipo === 'po' ? 0.7 : 0.85);
      p.v.y -= (p.tipo === 'po' ? 0.6 : 9.8) * dt;
      if (p.tipo === 'po') p.v.multiplyScalar(1 - 1.5 * dt);
      p.p.addScaledVector(p.v, dt);
      if (p.tipo === 'gota' && agua !== null && p.p.y < agua && p.v.y < 0) p.vida = 0;
      if (p.p.y < f.fundo) {
        p.p.y = f.fundo;
        p.v.set(0, 0, 0);
      }
    }
    this.particulas = this.particulas.filter((p) => p.vida > 0);
    for (const p of this.particulas) {
      const s = p.tam * (p.tipo === 'po' ? 1 + (1 - p.vida) * 2 : Math.min(1, p.vida * 2));
      a.position.copy(p.p);
      a.scale.setScalar(s);
      a.updateMatrix();
      this.malhaDasParticulas.setMatrixAt(n, a.matrix);
      this.malhaDasParticulas.setColorAt(n, p.cor);
      n++;
    }
    this.malhaDasParticulas.count = n;
    this.malhaDasParticulas.instanceMatrix.needsUpdate = true;
    if (this.malhaDasParticulas.instanceColor) this.malhaDasParticulas.instanceColor.needsUpdate = true;
  }

  /** Desenha, e guarda o custo do quadro inteiro (o que mudou mais o desenho) desde t0. */
  private desenhar(t0: number) {
    this.renderer.render(this.cena, this.camera);
    const ms = performance.now() - t0;
    this.ms = this.ms ? this.ms * 0.9 + ms * 0.1 : ms;
  }

  // ------------------------------------------------------------------------------------------------------------------------------
  // A TELA E O MUNDO
  // ------------------------------------------------------------------------------------------------------------------------------

  paraMundo(px: number, py: number): [number, number] | null {
    this.raio.setFromCamera(new THREE.Vector2((px / LARGURA) * 2 - 1, 1 - (py / ALTURA) * 2), this.camera);
    const p = new THREE.Vector3();
    return this.raio.ray.intersectPlane(this.plano, p) ? [p.x, p.y] : null;
  }

  paraTela(x: number, y: number): [number, number] {
    const v = new THREE.Vector3(x, y, ZF).project(this.camera);
    return [((v.x + 1) / 2) * LARGURA, ((1 - v.y) / 2) * ALTURA];
  }

  destruir() {
    if (this.morta) return;
    this.morta = true;
    this.observador.disconnect();
    this.renderer.domElement.removeEventListener('webglcontextlost', this.perdeu);
    for (const v of this.veiculos) v.coelho?.descartar();
    for (const o of this.ondas) (o.m.material as THREE.Material).dispose();
    for (const d of this.descartaveis) d.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }
}
