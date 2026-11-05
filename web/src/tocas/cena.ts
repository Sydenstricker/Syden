import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { PREDIOS, TAMANHO, eFonte, ePredio, eUnidade, type Fonte, type Predio, type Recurso, type Sim, type TipoPredio, type Unidade } from './sim';
import { CORES, type Vista } from './vista';

/**
 * TOCAS E TORRES EM 3D (05/11/2026). Só a TELA: a partida mora em sim.ts, e esta cena só a lê a cada quadro.
 *
 * - Os prédios por era, as árvores, o ouro e as pedras são do Ultimate Fantasy RTS do Quaternius; a muralha, o portão e a
 *   catapulta, do Castle Kit da Kenney; as pilhas de recurso no centro e o que o trabalhador leva, do Resource Bits da KayKit
 *   (todos CC0; licenças em web/public/tocas/). As unidades são o NOSSO coelho 3D com esqueleto (o das Cidades à venda), com o
 *   moletom na cor do time, e as armas são feitas aqui, por código.
 * - Árvores, ouro e pedras são INSTANCIADOS (uma malha para todas as árvores de um tipo); prédios e coelhos são cópias leves
 *   (a geometria e o material são os do modelo).
 * - A NÉVOA DE GUERRA é uma textura do tamanho do mapa que escurece tudo pelo lugar no mundo (no shader de cada material): o
 *   que a pessoa nunca viu fica quase preto, o que já viu e não vê agora, na penumbra; o inimigo fora da vista não aparece.
 * - Sem foco na janela (o jogo de verdade aberto), a tela de cima não chama `quadro`; as sombras de verdade só com "Sombras"
 *   ligado em Gráficos.
 */

const BASE = `${import.meta.env.BASE_URL}`;
const T = TAMANHO;

/** Os modelos de cada prédio, na era 1 e na 2 (com '+', mais de um modelo junto: a terra e o trigo da fazenda). */
const MODELOS_DOS_PREDIOS: Record<TipoPredio, [string, string]> = {
  centro: ['quaternius/TowerHouse_FirstAge', 'quaternius/TowerHouse_SecondAge'],
  casa: ['quaternius/Houses_FirstAge_1_Level3', 'quaternius/Houses_SecondAge_1_Level3'],
  fazenda: ['quaternius/Farm_FirstAge_Level3+quaternius/Farm_FirstAge_Level3_Wheat', 'quaternius/Farm_FirstAge_Level3+quaternius/Farm_SecondAge_Level3_Wheat'],
  quartel: ['quaternius/Barracks_FirstAge_Level3', 'quaternius/Barracks_SecondAge_Level3'],
  arquearia: ['quaternius/Archery_FirstAge_Level3', 'quaternius/Archery_SecondAge_Level3'],
  torre: ['quaternius/WatchTower_FirstAge_Level3', 'quaternius/WatchTower_SecondAge_Level1'],
  muralha: ['castelo/wall', 'castelo/wall'],
  portao: ['castelo/wall-doorway', 'castelo/wall-doorway'],
  maravilha: ['quaternius/Wonder_SecondAge_Level3', 'quaternius/Wonder_SecondAge_Level3'],
};
const ARVORES = ['quaternius/Resource_Tree1', 'quaternius/Resource_Tree2', 'quaternius/Resource_PineTree'];
const PILHAS: Record<Recurso, string[]> = {
  comida: ['recursos/Food_Crate_Small_Berries', 'recursos/Food_Crate_Large_Apples', 'recursos/Food_Pile_Large'],
  madeira: ['recursos/Wood_Log_Stack', 'recursos/Wood_Planks_Stack_Medium', 'recursos/Wood_Planks_Stack_Large'],
  ouro: ['recursos/Gold_Bars_Stack_Small', 'recursos/Gold_Bars_Stack_Medium', 'recursos/Gold_Bars_Stack_Large'],
};
const CARGAS: Record<Recurso, string> = { comida: 'recursos/Food_Basket_A_Berries', madeira: 'recursos/Wood_Log_A', ouro: 'recursos/Gold_Nugget_Medium' };
const TODOS = [
  ...new Set([
    ...Object.values(MODELOS_DOS_PREDIOS).flat().flatMap((n) => n.split('+')),
    ...ARVORES,
    'quaternius/Resource_Gold_1',
    'quaternius/Mountain_Single',
    'castelo/tower-base',
    'castelo/siege-catapult',
    'castelo/siege-catapult-demolished',
    ...Object.values(PILHAS).flat(),
    ...Object.values(CARGAS),
  ]),
];

/** A altura do coelho por tipo (o cavaleiro é o veterano: maior). */
const ALTURA: Record<string, number> = { trabalhador: 0.82, lanceiro: 0.92, arqueiro: 0.9, cavaleiro: 1.2 };
const PELO = '#f1ebe1';

const carregados = new Map<string, Promise<GLTF>>();
function carregar(nome: string): Promise<GLTF> {
  let p = carregados.get(nome);
  if (!p) {
    const caminho = nome === 'coelho' ? `${BASE}cidades3d/coelho-animado.glb` : `${BASE}tocas/${nome}.glb`;
    p = new GLTFLoader().loadAsync(caminho);
    carregados.set(nome, p);
    p.catch(() => carregados.delete(nome));
  }
  return p;
}

// ---------------------------------------------------------------------------------------------------------------------
// A névoa e as cores do coelho, no shader
// ---------------------------------------------------------------------------------------------------------------------

const uNevoa: { value: THREE.Texture | null } = { value: null };
const comNevoaJa = new WeakSet<THREE.Material>();

/** Acrescenta a névoa ao material (uma vez). `extra` é outra troca de shader no mesmo material (a paleta do coelho). */
function comNevoa(m: THREE.Material, extra?: (s: THREE.WebGLProgramParametersWithUniforms) => void, chave = '') {
  if (comNevoaJa.has(m)) return;
  comNevoaJa.add(m);
  m.onBeforeCompile = (s) => {
    extra?.(s);
    s.uniforms.uNevoa = uNevoa;
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vNevoaUv;').replace(
      '#include <project_vertex>',
      `#include <project_vertex>
      vec4 nevoaMundo = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        nevoaMundo = instanceMatrix * nevoaMundo;
      #endif
      nevoaMundo = modelMatrix * nevoaMundo;
      vNevoaUv = nevoaMundo.xz / ${T.toFixed(1)};`,
    );
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vNevoaUv;\nuniform sampler2D uNevoa;')
      .replace('#include <fog_fragment>', 'gl_FragColor.rgb *= texture2D(uNevoa, clamp(vNevoaUv, 0.0, 1.0)).r;\n#include <fog_fragment>');
  };
  m.customProgramCacheKey = () => 'tocas-nevoa' + chave;
}

/** O mascote com o moletom na cor do time (a troca de paleta das Cidades à venda: o escuro abaixo do pescoço é o moletom). */
function materialDoCoelho(base: THREE.MeshStandardMaterial, roupa: string): THREE.MeshStandardMaterial {
  const m = base.clone();
  const uPelo = { value: new THREE.Color(PELO) };
  const uRoupa = { value: new THREE.Color(roupa) };
  comNevoa(
    m,
    (s) => {
      s.uniforms.uPelo = uPelo;
      s.uniforms.uRoupa = uRoupa;
      s.vertexShader = s.vertexShader
        .replace('#include <common>', '#include <common>\nvarying float vAltura;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvAltura = position.y;');
      s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vAltura;\nuniform vec3 uPelo;\nuniform vec3 uRoupa;').replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        {
          vec3 cor = diffuseColor.rgb;
          float l = dot(cor, vec3(0.3, 0.59, 0.11));
          float sat = max(cor.r, max(cor.g, cor.b)) - min(cor.r, min(cor.g, cor.b));
          if (l < 0.07 && vAltura < 3.6) diffuseColor.rgb = uRoupa * (0.62 + 5.5 * l);
          else if (l > 0.28 && sat < 0.3) diffuseColor.rgb = uPelo * clamp(l / 0.62, 0.6, 1.15);
        }`,
      );
    },
    '-coelho-' + roupa,
  );
  return m;
}

// ---------------------------------------------------------------------------------------------------------------------
// Medir e normalizar um modelo
// ---------------------------------------------------------------------------------------------------------------------

/** A matriz que põe o modelo de pé no chão, centrado, com `largura` no lado maior (ou `altura`, se dada). */
function encaixe(obj: THREE.Object3D, largura: number, altura?: number): THREE.Matrix4 {
  obj.updateMatrixWorld(true);
  const caixa = new THREE.Box3().setFromObject(obj);
  const tam = caixa.getSize(new THREE.Vector3());
  const k = altura ? altura / tam.y : largura / Math.max(tam.x, tam.z);
  const centro = caixa.getCenter(new THREE.Vector3());
  return new THREE.Matrix4().makeScale(k, k, k).multiply(new THREE.Matrix4().makeTranslation(-centro.x, -caixa.min.y, -centro.z));
}

/** Uma malha instanciada por parte do modelo. */
class Instancias {
  partes: { mesh: THREE.InstancedMesh; local: THREE.Matrix4 }[] = [];
  constructor(modelo: THREE.Object3D, n: number, sombra: boolean, grupo: THREE.Object3D) {
    modelo.updateMatrixWorld(true);
    modelo.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mat of mats) comNevoa(mat);
      const im = new THREE.InstancedMesh(m.geometry, m.material, Math.max(1, n));
      im.count = n;
      im.castShadow = sombra;
      im.receiveShadow = sombra;
      im.frustumCulled = false;
      grupo.add(im);
      this.partes.push({ mesh: im, local: m.matrixWorld.clone() });
    });
  }
  pos(i: number, m: THREE.Matrix4) {
    const t = new THREE.Matrix4();
    for (const p of this.partes) {
      t.multiplyMatrices(m, p.local);
      p.mesh.setMatrixAt(i, t);
    }
  }
  esconder(i: number) {
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (const p of this.partes) p.mesh.setMatrixAt(i, zero);
  }
  atualizar() {
    for (const p of this.partes) p.mesh.instanceMatrix.needsUpdate = true;
  }
}

/** Um sorteio fixo por número (a rotação de cada árvore não muda de um quadro para outro). */
const sorte = (n: number) => {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

// ---------------------------------------------------------------------------------------------------------------------

interface Boneco {
  raiz: THREE.Group;
  corpo: THREE.Object3D;
  mixer: THREE.AnimationMixer | null;
  acoes: Map<string, THREE.AnimationAction>;
  tocando: string;
  mao: THREE.Group;
  carga: string;
  golpe: number;
}

interface Construcao {
  raiz: THREE.Group;
  modelo: THREE.Object3D;
  chave: string;
}

interface Barra {
  fundo: THREE.Mesh;
  cheio: THREE.Mesh;
}

interface Tiro {
  obj: THREE.Mesh;
  de: THREE.Vector3;
  para: THREE.Vector3;
  inicio: number;
  dura: number;
  arco: number;
}

export class CenaDasTocas implements Vista {
  selecao = new Set<number>();
  /** A bandeira do ponto de reunião do prédio escolhido (feita na primeira vez). */
  private bandeiraDaReuniao: THREE.Group | null = null;
  fantasma: Vista['fantasma'] = null;
  private renderer: THREE.WebGLRenderer;
  private cena = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(38, 1, 0.5, 200);
  private alvo = new THREE.Vector3(8, 0, 34);
  private distancia = 16;
  private raio = new THREE.Raycaster();
  private sombras: boolean;
  private modelos = new Map<string, GLTF>();
  private normal = new Map<string, THREE.Matrix4>();
  private observador: ResizeObserver;
  private morta = false;
  private descartaveis: { dispose(): void }[] = [];
  private nevoaDados = new Uint8Array(T * T * 4);
  private nevoaTex: THREE.DataTexture;
  private arvores: Instancias[] = [];
  private ouro: Instancias | null = null;
  private idsDasFontes = new Map<number, { inst: Instancias; i: number; tipo: Fonte['tipo'] }>();
  private fontesVistas = new Set<number>();
  private bonecos = new Map<number, Boneco>();
  private predios = new Map<number, Construcao>();
  private aneis = new Map<number, THREE.Object3D>();
  private barras = new Map<number, Barra>();
  private pilhas: { rec: Recurso; nivel: number; obj: THREE.Object3D | null; pos: THREE.Vector3 }[] = [];
  private tiros: Tiro[] = [];
  private escombros: { obj: THREE.Object3D; ate: number }[] = [];
  private sinais: { obj: THREE.Mesh; inicio: number }[] = [];
  private fantasmaObj = new THREE.Group();
  private fantasmaChave = '';
  private matCoelho: THREE.MeshStandardMaterial[] = [];
  private geoAnel = new THREE.RingGeometry(0.3, 0.38, 24);
  private matAnel = [new THREE.MeshBasicMaterial({ color: CORES[0], depthWrite: false }), new THREE.MeshBasicMaterial({ color: '#f0d24a', depthWrite: false })];
  private geoBarra = new THREE.PlaneGeometry(1, 0.09);
  private matBarra = [
    new THREE.MeshBasicMaterial({ color: '#1c1c1c', depthTest: false, transparent: true, opacity: 0.7 }),
    new THREE.MeshBasicMaterial({ color: '#5cd65c', depthTest: false, transparent: true }),
    new THREE.MeshBasicMaterial({ color: '#e05252', depthTest: false, transparent: true }),
  ];
  private geoFlecha = new THREE.CylinderGeometry(0.015, 0.015, 0.4, 4).rotateX(Math.PI / 2);
  private geoPedra = new THREE.IcosahedronGeometry(0.12, 0);
  private matFlecha = new THREE.MeshBasicMaterial({ color: '#4a3524' });
  private matPedra = new THREE.MeshStandardMaterial({ color: '#7d7a72', roughness: 1 });
  private armas = new Map<string, THREE.Object3D>();
  private tempo = 0;

  constructor(
    private caixa: HTMLElement,
    private sim: Sim,
    private eu: 0 | 1 = 0,
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
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
    const tela = this.renderer.domElement;
    tela.className = 'tocas-tela';
    caixa.appendChild(tela);
    this.observador = new ResizeObserver(() => this.medir());
    this.observador.observe(caixa);
    this.nevoaTex = new THREE.DataTexture(this.nevoaDados, T, T, THREE.RGBAFormat);
    this.nevoaTex.magFilter = THREE.LinearFilter;
    this.nevoaTex.minFilter = THREE.LinearFilter;
    this.nevoaTex.flipY = false;
    uNevoa.value = this.nevoaTex;
    const c = sim.predios.find((p) => p.dono === eu && p.tipo === 'centro');
    if (c) this.alvo.set(c.gx + 1.5, 0, c.gy + 1.5 - 1);
    this.medir();
  }

  async montar(): Promise<void> {
    const lista = await Promise.all(TODOS.map((n) => carregar(n).then((g) => [n, g] as const)));
    const coelho = await carregar('coelho');
    if (this.morta) return;
    for (const [n, g] of lista) this.modelos.set(n, g);
    this.modelos.set('coelho', coelho);
    for (const [n, g] of lista)
      g.scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        for (const mat of Array.isArray(m.material) ? m.material : [m.material]) comNevoa(mat);
      });
    // o coelho de cada time: um material só por time
    let base: THREE.MeshStandardMaterial | null = null;
    coelho.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && !base) base = m.material as THREE.MeshStandardMaterial;
    });
    this.matCoelho = CORES.map((cor) => materialDoCoelho(base ?? new THREE.MeshStandardMaterial(), cor));
    this.descartaveis.push(...this.matCoelho);
    this.montarMundo();
    this.montarArmas();
    this.cena.add(this.fantasmaObj);
  }

  // ---------- o mundo ----------

  private montarMundo() {
    const cena = this.cena;
    // fora do mapa é preto (pedido dele, 05/11/2026: "a área impossível de ser jogada deveria ser preta")
    cena.background = new THREE.Color('#000000');
    cena.add(new THREE.HemisphereLight('#fff4e2', '#4a5a3a', 1.5));
    const sol = new THREE.DirectionalLight('#fff0d8', 2.2);
    sol.position.set(T / 2 - 14, 30, T / 2 + 10);
    sol.target.position.set(T / 2, 0, T / 2);
    if (this.sombras) {
      sol.castShadow = true;
      sol.shadow.mapSize.set(2048, 2048);
      Object.assign(sol.shadow.camera, { left: -T * 0.75, right: T * 0.75, top: T * 0.75, bottom: -T * 0.75, near: 1, far: 90 });
      sol.shadow.bias = -0.0006;
      sol.shadow.normalBias = 0.03;
    }
    cena.add(sol, sol.target);

    // o chão: grama pintada casa a casa, com terra sob as pedras e em volta dos centros
    const tela = document.createElement('canvas');
    const px = 8;
    tela.width = tela.height = T * px;
    const g = tela.getContext('2d')!;
    for (let y = 0; y < T; y++)
      for (let x = 0; x < T; x++) {
        const s = sorte(x * 131 + y * 17);
        const l = 44 + s * 7;
        g.fillStyle = `hsl(${92 + s * 14}, 38%, ${l}%)`;
        g.fillRect(x * px, y * px, px, px);
      }
    for (const p of this.sim.pedras) {
      g.fillStyle = '#8c7b62';
      g.fillRect(p.gx * px - 2, p.gy * px - 2, px + 4, px + 4);
    }
    for (const c of this.sim.predios.filter((p) => p.tipo === 'centro')) {
      g.fillStyle = 'rgba(150, 120, 80, 0.55)';
      g.beginPath();
      g.ellipse((c.gx + 1.5) * px, (c.gy + 1.5) * px, 4 * px, 4 * px, 0, 0, Math.PI * 2);
      g.fill();
    }
    const tex = new THREE.CanvasTexture(tela);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = 4;
    const matChao = new THREE.MeshStandardMaterial({ map: tex, roughness: 1 });
    comNevoa(matChao);
    const chao = new THREE.Mesh(new THREE.PlaneGeometry(T, T), matChao);
    chao.rotation.x = -Math.PI / 2;
    chao.position.set(T / 2, 0, T / 2);
    chao.receiveShadow = this.sombras;
    chao.name = 'chao';
    cena.add(chao);
    // a borda do mundo: terra escura em volta, sem névoa (fica igual em todo canto)
    const borda = new THREE.Mesh(new THREE.PlaneGeometry(T * 4, T * 4), new THREE.MeshBasicMaterial({ color: '#000000' }));
    borda.rotation.x = -Math.PI / 2;
    borda.position.set(T / 2, -0.02, T / 2);
    cena.add(borda);
    this.descartaveis.push(tex, matChao, chao.geometry, borda.geometry, borda.material as THREE.Material);

    // as árvores e o ouro, instanciados; as pedras também (não somem)
    const porVariante: Fonte[][] = [[], [], []];
    const ouros: Fonte[] = [];
    for (const f of this.sim.fontes) (f.tipo === 'arvore' ? porVariante[f.variante % 3] : ouros).push(f);
    porVariante.forEach((lista, v) => {
      const g = this.modelos.get(ARVORES[v])!;
      const inst = new Instancias(g.scene, lista.length, this.sombras, cena);
      const base = encaixe(g.scene, 1, v === 2 ? 1.9 : 1.6);
      lista.forEach((f, i) => {
        const giro = new THREE.Matrix4().makeRotationY(sorte(f.id) * Math.PI * 2);
        const k = 0.85 + sorte(f.id + 7) * 0.3;
        const m = new THREE.Matrix4().makeTranslation(f.gx + 0.5, 0, f.gy + 0.5).multiply(giro).multiply(new THREE.Matrix4().makeScale(k, k, k)).multiply(base);
        inst.pos(i, m);
        this.idsDasFontes.set(f.id, { inst, i, tipo: 'arvore' });
      });
      inst.atualizar();
      this.arvores.push(inst);
    });
    {
      const g = this.modelos.get('quaternius/Resource_Gold_1')!;
      const inst = new Instancias(g.scene, ouros.length, this.sombras, cena);
      const base = encaixe(g.scene, 0.95);
      ouros.forEach((f, i) => {
        const m = new THREE.Matrix4().makeTranslation(f.gx + 0.5, 0, f.gy + 0.5).multiply(new THREE.Matrix4().makeRotationY(sorte(f.id) * Math.PI * 2)).multiply(base);
        inst.pos(i, m);
        this.idsDasFontes.set(f.id, { inst, i, tipo: 'ouro' });
      });
      inst.atualizar();
      this.ouro = inst;
    }
    {
      const g = this.modelos.get('quaternius/Mountain_Single')!;
      const inst = new Instancias(g.scene, this.sim.pedras.length, this.sombras, cena);
      const base = encaixe(g.scene, 1.35);
      this.sim.pedras.forEach((p, i) => {
        const k = 0.8 + sorte(p.gx * 7 + p.gy) * 0.5;
        inst.pos(i, new THREE.Matrix4().makeTranslation(p.gx + 0.5, 0, p.gy + 0.5).multiply(new THREE.Matrix4().makeRotationY(sorte(p.gx + p.gy * 3) * 6.28)).multiply(new THREE.Matrix4().makeScale(k, k, k)).multiply(base));
      });
      inst.atualizar();
    }
    for (const f of this.sim.fontes) this.fontesVistas.add(f.id);

    // as pilhas do estoque, em volta do MEU centro
    const c = this.sim.predios.find((p) => p.dono === this.eu && p.tipo === 'centro');
    if (c) {
      const lados: [Recurso, number, number][] = [
        ['comida', c.gx - 0.45, c.gy + 3.3],
        ['madeira', c.gx + 3.35, c.gy + 3.3],
        ['ouro', c.gx + 3.4, c.gy - 0.3],
      ];
      for (const [rec, x, z] of lados) this.pilhas.push({ rec, nivel: -1, obj: null, pos: new THREE.Vector3(x, 0, z) });
    }
  }

  /** As armas, feitas aqui: a lança, o arco, a espada com o escudo. */
  private montarArmas() {
    const madeira = new THREE.MeshStandardMaterial({ color: '#8a5a32', roughness: 0.9 });
    const ferro = new THREE.MeshStandardMaterial({ color: '#c9cdd2', metalness: 0.6, roughness: 0.35 });
    for (const m of [madeira, ferro]) comNevoa(m);
    this.descartaveis.push(madeira, ferro);
    const lanca = new THREE.Group();
    const cabo = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.95, 6), madeira);
    const ponta = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.14, 6), ferro);
    ponta.position.y = 0.53;
    lanca.add(cabo, ponta);
    lanca.rotation.x = 0.25;
    this.armas.set('lanceiro', lanca);
    const arco = new THREE.Group();
    const curva = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.018, 5, 14, Math.PI * 0.9), madeira);
    curva.rotation.z = Math.PI / 2 - Math.PI * 0.45;
    const corda = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.42, 3), new THREE.MeshBasicMaterial({ color: '#ece6d6' }));
    corda.position.x = -0.035;
    arco.add(curva, corda);
    arco.rotation.y = Math.PI / 2;
    this.armas.set('arqueiro', arco);
    const espada = new THREE.Group();
    const lamina = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.42, 0.012), ferro);
    lamina.position.y = 0.2;
    const guarda = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.025, 0.03), madeira);
    espada.add(lamina, guarda);
    this.armas.set('cavaleiro', espada);
    const escudo = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.035, 14), new THREE.MeshStandardMaterial({ color: '#b98a4a', roughness: 0.8 }));
    comNevoa(escudo.material as THREE.Material);
    escudo.rotation.x = Math.PI / 2;
    this.armas.set('escudo', escudo);
    for (const a of this.armas.values())
      a.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          this.descartaveis.push(m.geometry);
          m.castShadow = this.sombras;
        }
      });
  }

  private copiaNormalizada(nome: string, largura: number, altura?: number): THREE.Object3D {
    const juntar = () => {
      const partes = nome.split('+').map((n) => this.modelos.get(n)!.scene.clone(true));
      if (partes.length === 1) return partes[0];
      const g = new THREE.Group();
      g.add(...partes);
      return g;
    };
    const chave = `${nome}|${largura}|${altura ?? ''}`;
    let m = this.normal.get(chave);
    if (!m) {
      m = encaixe(juntar(), largura, altura);
      this.normal.set(chave, m);
    }
    const dentro = juntar();
    dentro.traverse((o) => {
      const q = o as THREE.Mesh;
      if (q.isMesh) {
        q.castShadow = this.sombras;
        q.receiveShadow = this.sombras;
      }
    });
    const fora = new THREE.Group();
    dentro.applyMatrix4(m);
    fora.add(dentro);
    return fora;
  }

  // ---------- os prédios ----------

  private modeloDoPredio(p: Predio): { obj: THREE.Object3D; chave: string } {
    const era = p.pronto ? p.era : this.sim.jogadores[p.dono].era;
    let nome = MODELOS_DOS_PREDIOS[p.tipo][era - 1];
    let giro = 0;
    if (p.tipo === 'muralha' || p.tipo === 'portao') {
      const viz = (dx: number, dy: number) => {
        const x = p.gx + dx;
        const y = p.gy + dy;
        if (x < 0 || y < 0 || x >= T || y >= T) return false;
        const e = this.sim.porId.get(this.sim.grade[y * T + x]);
        return ePredio(e) && (e.tipo === 'muralha' || e.tipo === 'portao') && e.dono === p.dono;
      };
      const h = viz(-1, 0) || viz(1, 0);
      const v = viz(0, -1) || viz(0, 1);
      if (p.tipo === 'muralha' && h === v) nome = 'castelo/tower-base';
      // a muralha é um bloco quadrado; o portão corre no eixo z do modelo
      giro = p.tipo === 'portao' ? (h && !v ? Math.PI / 2 : 0) : 0;
    }
    const chave = `${nome}|${giro}`;
    let obj: THREE.Object3D;
    if (nome === 'castelo/tower-base') obj = this.copiaNormalizada(nome, 0.8);
    else if (p.tipo === 'muralha' || p.tipo === 'portao') obj = this.copiaNormalizada(nome, 1.02);
    else obj = this.copiaNormalizada(nome, PREDIOS[p.tipo].tam * (p.tipo === 'torre' ? 1.25 : 0.94));
    obj.rotation.y = giro;
    // a do computador olha para o outro lado (o mapa é espelhado)
    if (p.dono === 1 && p.tipo !== 'muralha' && p.tipo !== 'portao') obj.rotation.y = Math.PI;
    return { obj, chave };
  }

  private bandeira(dono: number, alto: number): THREE.Object3D {
    const g = new THREE.Group();
    const mastro = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, alto, 5), new THREE.MeshStandardMaterial({ color: '#5a4030' }));
    mastro.position.y = alto / 2;
    const pano = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.22), new THREE.MeshStandardMaterial({ color: CORES[dono], side: THREE.DoubleSide }));
    pano.position.set(0.18, alto - 0.12, 0);
    g.add(mastro, pano);
    for (const m of [mastro, pano]) {
      comNevoa(m.material as THREE.Material);
      this.descartaveis.push(m.geometry, m.material as THREE.Material);
    }
    return g;
  }

  private atualizarPredios() {
    const vivos = new Set<number>();
    const visivel = this.sim.jogadores[this.eu].explorado;
    for (const p of this.sim.predios) {
      vivos.add(p.id);
      let c = this.predios.get(p.id);
      const { chave } = c ? { chave: c.chave } : { chave: '' };
      const quer = this.chaveDoPredio(p);
      if (!c || chave !== quer) {
        if (c) this.cena.remove(c.raiz);
        const { obj } = this.modeloDoPredio(p);
        const raiz = new THREE.Group();
        raiz.position.set(p.gx + p.tam / 2, 0, p.gy + p.tam / 2);
        raiz.add(obj);
        raiz.userData.id = p.id;
        if (p.tipo !== 'muralha' && p.tipo !== 'portao') {
          const b = this.bandeira(p.dono, p.tipo === 'torre' ? 1.9 : 1.3);
          b.position.set(-p.tam / 2 + 0.15, 0, p.tam / 2 - 0.15);
          raiz.add(b);
        }
        this.cena.add(raiz);
        c = { raiz, modelo: obj, chave: quer };
        this.predios.set(p.id, c);
      }
      const prog = p.pronto ? 1 : Math.max(0.08, p.progresso / PREDIOS[p.tipo].tempo);
      c.modelo.scale.y = prog;
      c.raiz.visible = p.dono === this.eu || visivel[Math.floor(p.gy) * T + Math.floor(p.gx)] === 1;
    }
    for (const [id, c] of this.predios)
      if (!vivos.has(id)) {
        this.cena.remove(c.raiz);
        this.predios.delete(id);
      }
  }

  private chaveDoPredio(p: Predio): string {
    if (p.tipo === 'muralha' || p.tipo === 'portao') {
      // a muralha muda de peça quando a vizinha aparece ou cai
      const viz = [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ].map(([dx, dy]) => {
        const x = p.gx + dx;
        const y = p.gy + dy;
        if (x < 0 || y < 0 || x >= T || y >= T) return 0;
        const e = this.sim.porId.get(this.sim.grade[y * T + x]);
        return ePredio(e) && (e.tipo === 'muralha' || e.tipo === 'portao') && e.dono === p.dono ? 1 : 0;
      });
      return `${p.tipo}|${viz.join('')}`;
    }
    return `${p.tipo}|${p.pronto ? p.era : this.sim.jogadores[p.dono].era}`;
  }

  // ---------- as unidades ----------

  private novoBoneco(u: Unidade): Boneco {
    const raiz = new THREE.Group();
    const giro = new THREE.Group();
    raiz.add(giro);
    const mao = new THREE.Group();
    let corpo: THREE.Object3D;
    let mixer: THREE.AnimationMixer | null = null;
    const acoes = new Map<string, THREE.AnimationAction>();
    if (u.tipo === 'catapulta') {
      corpo = this.copiaNormalizada('castelo/siege-catapult', 1.25);
    } else {
      const g = this.modelos.get('coelho')!;
      const c = SkeletonUtils.clone(g.scene);
      const caixa = new THREE.Box3().setFromObject(c);
      const k = ALTURA[u.tipo] / (caixa.max.y - caixa.min.y);
      c.scale.setScalar(k);
      c.position.y = -caixa.min.y * k;
      const mat = this.matCoelho[u.dono];
      c.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          m.material = mat;
          m.castShadow = this.sombras;
          m.frustumCulled = false;
        }
      });
      mixer = new THREE.AnimationMixer(c);
      for (const a of g.animations) acoes.set(a.name, mixer.clipAction(a));
      corpo = c;
      const h = ALTURA[u.tipo];
      mao.position.set(-0.17 * h / 0.7, 0.36 * h / 0.7, 0.12 * h / 0.7);
      const arma = this.armas.get(u.tipo);
      if (arma) {
        const a = arma.clone();
        if (u.tipo === 'cavaleiro') {
          a.position.set(0, 0.05, 0.05);
          const e = this.armas.get('escudo')!.clone();
          e.position.set(0.32 * h / 0.7, -0.05, 0.08);
          mao.add(e);
        }
        mao.add(a);
      }
    }
    giro.add(corpo);
    giro.add(mao);
    this.cena.add(raiz);
    const b: Boneco = { raiz, corpo: giro, mixer, acoes, tocando: '', mao, carga: '', golpe: 0 };
    return b;
  }

  private tocar(b: Boneco, nome: string) {
    if (b.tocando === nome || !b.mixer) return;
    const nova = b.acoes.get(nome);
    if (!nova) return;
    const velha = b.acoes.get(b.tocando);
    nova.reset().play();
    if (velha) velha.crossFadeTo(nova, 0.18, false);
    b.tocando = nome;
  }

  private atualizarUnidades(alfa: number, dt: number) {
    const vivos = new Set<number>();
    const vis = this.sim.jogadores[this.eu].visivel;
    for (const u of this.sim.unidades) {
      vivos.add(u.id);
      let b = this.bonecos.get(u.id);
      if (!b) {
        b = this.novoBoneco(u);
        this.bonecos.set(u.id, b);
      }
      const x = u.ax + (u.x - u.ax) * alfa;
      const z = u.ay + (u.y - u.ay) * alfa;
      const visto = u.dono === this.eu || vis[Math.floor(z) * T + Math.floor(x)] === 1;
      b.raiz.visible = visto;
      if (!visto) continue;
      b.raiz.position.set(x, 0, z);
      const quer = Math.atan2(u.rx, u.ry);
      let delta = quer - b.corpo.rotation.y;
      delta = Math.atan2(Math.sin(delta), Math.cos(delta));
      b.corpo.rotation.y += delta * Math.min(1, dt * 12);
      if (u.tipo === 'catapulta') {
        const atira = u.acao === 'atacando' && u.recarga > 40;
        b.corpo.position.y = atira ? 0.03 : 0;
        continue;
      }
      const anim = u.acao === 'andando' ? 'andando' : u.acao === 'parado' ? 'parado' : 'falando';
      this.tocar(b, anim);
      b.mixer!.update(dt * (u.tipo === 'cavaleiro' && anim === 'andando' ? 1.5 : 1));
      // o golpe: um avanço curto, no momento em que o golpe sai
      const bateu = u.acao === 'atacando' && u.recarga >= 12 && u.tipo !== 'arqueiro';
      const trabalha = u.acao === 'trabalhando';
      const f = this.tempo * 9 + u.id;
      b.corpo.position.z = 0;
      b.mao.rotation.x = bateu ? -0.9 : trabalha ? Math.sin(f) * 0.6 : 0;
      // o que o trabalhador leva
      const carga = u.carga && u.carga.qtd > 0 ? u.carga.rec : '';
      if (carga !== b.carga) {
        for (const filho of [...b.mao.children]) if (filho.userData.carga) b.mao.remove(filho);
        if (carga) {
          const o = this.copiaNormalizada(CARGAS[carga as Recurso], 0.26);
          o.userData.carga = true;
          o.position.set(0.17, -0.12, 0.12);
          b.mao.add(o);
        }
        b.carga = carga;
      }
    }
    for (const [id, b] of this.bonecos)
      if (!vivos.has(id)) {
        this.cena.remove(b.raiz);
        b.mixer?.stopAllAction();
        this.bonecos.delete(id);
      }
  }

  // ---------- seleção, vida, pilhas, tiros ----------

  private atualizarMarcas() {
    const vis = this.sim.jogadores[this.eu].visivel;
    // os anéis de quem está escolhido
    for (const [id, a] of this.aneis)
      if (!this.selecao.has(id) || !this.sim.porId.has(id)) {
        this.cena.remove(a);
        this.aneis.delete(id);
      }
    for (const id of this.selecao) {
      const e = this.sim.porId.get(id);
      if (!e) continue;
      let a = this.aneis.get(id);
      if (!a) {
        const mat = this.matAnel[eUnidade(e) || ePredio(e) ? (e.dono === this.eu ? 0 : 1) : 1];
        a = new THREE.Mesh(this.geoAnel, mat);
        a.rotation.x = -Math.PI / 2;
        a.renderOrder = 2;
        this.cena.add(a);
        this.aneis.set(id, a);
      }
      if (eUnidade(e)) {
        const b = this.bonecos.get(id);
        if (b) a.position.set(b.raiz.position.x, 0.03, b.raiz.position.z);
        a.scale.setScalar(e.tipo === 'catapulta' ? 1.8 : e.tipo === 'cavaleiro' ? 1.3 : 1);
      } else {
        const tam = ePredio(e) ? e.tam : 1;
        a.position.set(e.gx + tam / 2, 0.03, e.gy + tam / 2);
        a.scale.setScalar(tam * 1.75);
      }
    }
    // o ponto de reunião do MEU prédio escolhido: uma bandeirinha na cor do time
    let reuniao: { x: number; y: number } | null = null;
    if (this.selecao.size === 1) {
      const e = this.sim.porId.get([...this.selecao][0]);
      if (ePredio(e) && e.dono === this.eu && e.reuniao) reuniao = e.reuniao;
    }
    if (reuniao && !this.bandeiraDaReuniao) {
      const b = new THREE.Group();
      const mastro = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.9, 6), new THREE.MeshStandardMaterial({ color: '#6b4a2e' }));
      mastro.position.y = 0.45;
      const forma = new THREE.Shape();
      forma.moveTo(0, 0);
      forma.lineTo(0.42, -0.13);
      forma.lineTo(0, -0.26);
      const pano = new THREE.Mesh(new THREE.ShapeGeometry(forma), new THREE.MeshStandardMaterial({ color: CORES[this.eu], side: THREE.DoubleSide }));
      pano.position.set(0.02, 0.88, 0);
      b.add(mastro, pano);
      this.descartaveis.push(mastro.geometry, mastro.material as THREE.Material, pano.geometry, pano.material as THREE.Material);
      this.cena.add(b);
      this.bandeiraDaReuniao = b;
    }
    if (this.bandeiraDaReuniao) {
      this.bandeiraDaReuniao.visible = !!reuniao;
      if (reuniao) {
        this.bandeiraDaReuniao.position.set(reuniao.x, 0, reuniao.y);
        this.bandeiraDaReuniao.rotation.y = Math.sin(this.tempo * 2) * 0.15;
      }
    }
    // as barras de vida: de quem está ferido ou escolhido, e visível
    const querBarra = new Set<number>();
    const cam = this.camera.quaternion;
    const barra = (id: number, x: number, y: number, z: number, largura: number, f: number, inimigo: boolean) => {
      querBarra.add(id);
      let b = this.barras.get(id);
      if (!b) {
        b = { fundo: new THREE.Mesh(this.geoBarra, this.matBarra[0]), cheio: new THREE.Mesh(this.geoBarra, this.matBarra[inimigo ? 2 : 1]) };
        b.fundo.renderOrder = 5;
        b.cheio.renderOrder = 6;
        this.cena.add(b.fundo, b.cheio);
        this.barras.set(id, b);
      }
      b.fundo.position.set(x, y, z);
      b.fundo.quaternion.copy(cam);
      b.fundo.scale.set(largura, 1, 1);
      b.cheio.quaternion.copy(cam);
      b.cheio.scale.set(largura * Math.max(0, Math.min(1, f)), 1, 1);
      // da esquerda para a direita, na tela
      const lado = new THREE.Vector3(1, 0, 0).applyQuaternion(cam).multiplyScalar((-largura * (1 - f)) / 2);
      b.cheio.position.set(x + lado.x, y + lado.y + 0.001, z + lado.z);
    };
    for (const u of this.sim.unidades) {
      if (u.vida >= u.vidaMax && !this.selecao.has(u.id)) continue;
      const b = this.bonecos.get(u.id);
      if (!b || !b.raiz.visible) continue;
      const h = u.tipo === 'catapulta' ? 0.9 : ALTURA[u.tipo];
      barra(u.id, b.raiz.position.x, h + 0.18, b.raiz.position.z, 0.5, u.vida / u.vidaMax, u.dono !== this.eu);
    }
    for (const p of this.sim.predios) {
      if (p.vida >= p.vidaMax * 0.999 && !this.selecao.has(p.id)) continue;
      if (p.dono !== this.eu && !vis[p.gy * T + p.gx]) continue;
      barra(p.id, p.gx + p.tam / 2, p.tam === 1 ? 1.5 : p.tam * 0.75 + 0.6, p.gy + p.tam / 2, Math.min(2.2, 0.5 + p.tam * 0.45), p.vida / p.vidaMax, p.dono !== this.eu);
    }
    for (const [id, b] of this.barras)
      if (!querBarra.has(id)) {
        this.cena.remove(b.fundo, b.cheio);
        this.barras.delete(id);
      }
    // as pilhas do estoque crescem
    const r = this.sim.jogadores[this.eu].recursos;
    for (const p of this.pilhas) {
      const v = r[p.rec];
      const nivel = v < 30 ? -1 : v < 200 ? 0 : v < 600 ? 1 : 2;
      if (nivel === p.nivel) continue;
      if (p.obj) this.cena.remove(p.obj);
      p.obj = null;
      if (nivel >= 0) {
        p.obj = this.copiaNormalizada(PILHAS[p.rec][nivel], 0.55 + nivel * 0.18);
        p.obj.position.copy(p.pos);
        this.cena.add(p.obj);
      }
      p.nivel = nivel;
    }
    // as fontes que acabaram somem
    for (const id of [...this.fontesVistas])
      if (!this.sim.porId.has(id)) {
        const f = this.idsDasFontes.get(id);
        if (f) {
          f.inst.esconder(f.i);
          f.inst.atualizar();
        }
        this.fontesVistas.delete(id);
      }
  }

  /** O que a simulação contou neste passo (os tiros, a catapulta que caiu). A tela chama a cada passo andado. */
  eventos(sim: Sim) {
    const vis = sim.jogadores[this.eu].visivel;
    const agora = performance.now();
    for (const e of sim.eventos) {
      if (e.t === 'golpe' && e.arma !== 'corpo') {
        if (!vis[Math.floor(e.y1) * T + Math.floor(e.x1)] && !vis[Math.floor(e.y0) * T + Math.floor(e.x0)]) continue;
        const pedra = e.arma === 'pedra';
        const obj = new THREE.Mesh(pedra ? this.geoPedra : this.geoFlecha, pedra ? this.matPedra : this.matFlecha);
        const de = new THREE.Vector3(e.x0, pedra ? 0.6 : 0.5, e.y0);
        const para = new THREE.Vector3(e.x1, 0.35, e.y1);
        const dist = de.distanceTo(para);
        obj.position.copy(de);
        this.cena.add(obj);
        this.tiros.push({ obj, de, para, inicio: agora, dura: pedra ? 700 : 120 + dist * 45, arco: pedra ? 1.5 + dist * 0.15 : 0.15 + dist * 0.06 });
      } else if (e.t === 'morte' && e.tipo === 'catapulta') {
        const o = this.copiaNormalizada('castelo/siege-catapult-demolished', 1.25);
        o.position.set(e.x, 0, e.y);
        this.cena.add(o);
        this.escombros.push({ obj: o, ate: agora + 10_000 });
      }
    }
  }

  private atualizarTiros(agora: number) {
    this.tiros = this.tiros.filter((t) => {
      const f = (agora - t.inicio) / t.dura;
      if (f >= 1) {
        this.cena.remove(t.obj);
        return false;
      }
      const ant = t.obj.position.clone();
      t.obj.position.lerpVectors(t.de, t.para, f);
      t.obj.position.y += Math.sin(Math.PI * f) * t.arco;
      if (t.obj.geometry === this.geoFlecha) t.obj.lookAt(t.obj.position.clone().add(t.obj.position.clone().sub(ant)));
      else t.obj.rotation.x += 0.2;
      return true;
    });
    this.escombros = this.escombros.filter((e) => {
      if (agora < e.ate) return true;
      this.cena.remove(e.obj);
      return false;
    });
    this.sinais = this.sinais.filter((s) => {
      const f = (agora - s.inicio) / 450;
      if (f >= 1) {
        this.cena.remove(s.obj);
        return false;
      }
      s.obj.scale.setScalar(0.6 + f * 1.2);
      (s.obj.material as THREE.MeshBasicMaterial).opacity = 1 - f;
      return true;
    });
  }

  sinal(x: number, y: number, ataque: boolean) {
    const m = new THREE.Mesh(this.geoAnel, new THREE.MeshBasicMaterial({ color: ataque ? '#e05252' : '#7fe07f', transparent: true, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.04, y);
    this.cena.add(m);
    this.sinais.push({ obj: m, inicio: performance.now() });
  }

  private atualizarFantasma() {
    const f = this.fantasma;
    const chave = f ? `${f.tipo}|${f.ok}|${f.casas.map((c) => c.x + ',' + c.y).join(';')}` : '';
    if (chave === this.fantasmaChave) return;
    this.fantasmaChave = chave;
    for (const filho of [...this.fantasmaObj.children]) {
      this.fantasmaObj.remove(filho);
      filho.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh && m.userData.meu) (m.material as THREE.Material).dispose();
      });
    }
    if (!f) return;
    const cor = f.ok ? '#7fe07f' : '#e05252';
    const tam = PREDIOS[f.tipo].tam;
    const plano = new THREE.PlaneGeometry(0.96, 0.96);
    this.descartaveis.push(plano);
    for (const c of f.casas) {
      const casaMat = new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: 0.45, depthWrite: false });
      const m = new THREE.Mesh(plano, casaMat);
      m.userData.meu = true;
      m.rotation.x = -Math.PI / 2;
      if (f.tipo === 'muralha' || f.tipo === 'portao') m.position.set(c.x + 0.5, 0.05, c.y + 0.5);
      else {
        m.scale.set(tam, tam, 1);
        m.position.set(c.x + tam / 2, 0.05, c.y + tam / 2);
      }
      this.fantasmaObj.add(m);
    }
    if (f.tipo !== 'muralha' && f.casas.length === 1) {
      const nome = MODELOS_DOS_PREDIOS[f.tipo][this.sim.jogadores[this.eu].era - 1];
      const o = this.copiaNormalizada(nome, tam * (f.tipo === 'torre' ? 1.25 : 0.94));
      o.traverse((q) => {
        const m = q as THREE.Mesh;
        if (!m.isMesh) return;
        const mat = (m.material as THREE.MeshStandardMaterial).clone();
        mat.transparent = true;
        mat.opacity = 0.55;
        mat.depthWrite = false;
        m.material = mat;
        m.userData.meu = true;
        m.castShadow = false;
      });
      o.position.set(f.casas[0].x + tam / 2, 0, f.casas[0].y + tam / 2);
      this.fantasmaObj.add(o);
    }
  }

  private atualizarNevoa() {
    const j = this.sim.jogadores[this.eu];
    const d = this.nevoaDados;
    for (let i = 0; i < T * T; i++) {
      const v = j.visivel[i] ? 255 : j.explorado[i] ? 120 : 22;
      d[i * 4] = v;
      d[i * 4 + 3] = 255;
    }
    this.nevoaTex.needsUpdate = true;
  }

  // ---------- o quadro ----------

  quadro(alfa: number, dt: number) {
    if (this.morta) return;
    this.tempo += dt;
    const agora = performance.now();
    this.atualizarNevoa();
    this.atualizarPredios();
    this.atualizarUnidades(alfa, dt);
    this.atualizarMarcas();
    this.atualizarTiros(agora);
    this.atualizarFantasma();
    this.posicionarCamera();
    this.renderer.render(this.cena, this.camera);
  }

  private posicionarCamera() {
    // de cima e um pouco de frente (o sul embaixo da tela)
    const alto = this.distancia * 0.82;
    const longe = this.distancia * 0.57;
    this.camera.position.set(this.alvo.x, alto, this.alvo.z + longe);
    this.camera.lookAt(this.alvo);
    this.camera.updateMatrixWorld();
  }

  private medir() {
    const w = Math.max(1, this.caixa.clientWidth);
    const h = Math.max(1, this.caixa.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private raioEm(px: number, py: number) {
    const w = Math.max(1, this.caixa.clientWidth);
    const h = Math.max(1, this.caixa.clientHeight);
    this.posicionarCamera();
    this.raio.setFromCamera(new THREE.Vector2((px / w) * 2 - 1, -(py / h) * 2 + 1), this.camera);
    return this.raio;
  }

  chao(px: number, py: number) {
    const r = this.raioEm(px, py).ray;
    if (Math.abs(r.direction.y) < 1e-6) return null;
    const t = -r.origin.y / r.direction.y;
    if (t < 0) return null;
    return { x: r.origin.x + r.direction.x * t, y: r.origin.z + r.direction.z * t };
  }

  private naTela(x: number, y: number, z: number) {
    const v = new THREE.Vector3(x, y, z).project(this.camera);
    return { x: ((v.x + 1) / 2) * this.caixa.clientWidth, y: ((1 - v.y) / 2) * this.caixa.clientHeight, atras: v.z > 1 };
  }

  pegar(px: number, py: number): number | null {
    this.posicionarCamera();
    // as unidades primeiro (pequenas: pela distância na tela ao meio do corpo)
    let melhor: number | null = null;
    let dist = 22 * 22;
    for (const u of this.sim.unidades) {
      const b = this.bonecos.get(u.id);
      if (!b || !b.raiz.visible) continue;
      const h = u.tipo === 'catapulta' ? 0.45 : ALTURA[u.tipo] / 2;
      const s = this.naTela(b.raiz.position.x, h, b.raiz.position.z);
      const q = (s.x - px) * (s.x - px) + (s.y - py) * (s.y - py);
      if (q < dist) {
        dist = q;
        melhor = u.id;
      }
    }
    if (melhor !== null) return melhor;
    // os prédios e as fontes pelo raio
    const raio = this.raioEm(px, py);
    const alvos: THREE.Object3D[] = [];
    for (const c of this.predios.values()) if (c.raiz.visible) alvos.push(c.raiz);
    for (const a of this.arvores) for (const p of a.partes) alvos.push(p.mesh);
    if (this.ouro) for (const p of this.ouro.partes) alvos.push(p.mesh);
    const hit = raio.intersectObjects(alvos, true)[0];
    if (hit) {
      let o: THREE.Object3D | null = hit.object;
      while (o) {
        if (o.userData.id) return o.userData.id as number;
        o = o.parent;
      }
      if ((hit.object as THREE.InstancedMesh).isInstancedMesh && hit.instanceId !== undefined) {
        for (const [id, f] of this.idsDasFontes) if (f.i === hit.instanceId && f.inst.partes.some((p) => p.mesh === hit.object) && this.sim.porId.has(id)) return id;
      }
    }
    // o chão: a casa ocupada debaixo
    const p = this.chao(px, py);
    if (!p) return null;
    const gx = Math.floor(p.x);
    const gy = Math.floor(p.y);
    if (gx < 0 || gy < 0 || gx >= T || gy >= T) return null;
    const g = this.sim.grade[gy * T + gx];
    const e = g > 0 ? this.sim.porId.get(g) : undefined;
    if (e && (eFonte(e) || ePredio(e)) && this.sim.jogadores[this.eu].explorado[gy * T + gx]) return e.id;
    return null;
  }

  noRetangulo(x0: number, y0: number, x1: number, y1: number): number[] {
    this.posicionarCamera();
    const [a, b] = [Math.min(x0, x1), Math.max(x0, x1)];
    const [c, d] = [Math.min(y0, y1), Math.max(y0, y1)];
    const lista: number[] = [];
    for (const u of this.sim.unidades) {
      if (u.dono !== this.eu) continue;
      const bo = this.bonecos.get(u.id);
      if (!bo) continue;
      const s = this.naTela(bo.raiz.position.x, 0.3, bo.raiz.position.z);
      if (s.x >= a && s.x <= b && s.y >= c && s.y <= d) lista.push(u.id);
    }
    return lista;
  }

  arrastar(dx: number, dy: number, px: number, py: number) {
    const de = this.chao(px - dx, py - dy);
    const para = this.chao(px, py);
    if (!de || !para) return;
    this.alvo.x = Math.min(T, Math.max(0, this.alvo.x + de.x - para.x));
    this.alvo.z = Math.min(T + 4, Math.max(0, this.alvo.z + de.y - para.y));
  }

  zoom(fator: number, px: number, py: number) {
    const antes = this.chao(px, py);
    this.distancia = Math.min(42, Math.max(9, this.distancia * fator));
    const depois = this.chao(px, py);
    if (antes && depois) {
      this.alvo.x = Math.min(T, Math.max(0, this.alvo.x + antes.x - depois.x));
      this.alvo.z = Math.min(T + 4, Math.max(0, this.alvo.z + antes.y - depois.y));
    }
  }

  centrar(x: number, y: number) {
    this.alvo.set(x, 0, y);
  }

  cantos() {
    const w = this.caixa.clientWidth;
    const h = this.caixa.clientHeight;
    return [this.chao(0, 0), this.chao(w, 0), this.chao(w, h), this.chao(0, h)].map((p) => p ?? { x: this.alvo.x, y: this.alvo.z });
  }

  destruir() {
    this.morta = true;
    this.observador.disconnect();
    for (const b of this.bonecos.values()) b.mixer?.stopAllAction();
    for (const d of this.descartaveis) d.dispose();
    for (const m of [...this.matAnel, ...this.matBarra, this.matFlecha, this.matPedra]) m.dispose();
    for (const g of [this.geoAnel, this.geoBarra, this.geoFlecha, this.geoPedra]) g.dispose();
    this.nevoaTex.dispose();
    for (const a of [...this.arvores, ...(this.ouro ? [this.ouro] : [])]) for (const p of a.partes) p.mesh.dispose();
    if (uNevoa.value === this.nevoaTex) uNevoa.value = null;
    this.renderer.forceContextLoss();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
