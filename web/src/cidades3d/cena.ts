import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

/**
 * O TABULEIRO 3D DO CIDADES À VENDA (05/11/2026, pedido dele: "3D cartoon fofo, similar ao Mario Party, com os assets da
 * pasta assets; o nosso coelho 3D como personagem jogável"). Só a TELA: o servidor continua decidindo tudo, e o desenho em
 * SVG de JogoCidades.tsx fica de reserva (sem WebGL, ou enquanto isto carrega).
 *
 * - O chão é uma ilha de grama sobre a água; as 32 casas são blocos arredondados com a sigla e o preço pintados por código
 *   (nomes próprios e números: nada a traduzir).
 * - O que se constrói aparece DO LADO DE FORA da volta, para não cobrir a casa: a cidade comprada ganha uma casinha e a
 *   bandeira do dono; com prédios, os prédios da cidade (1 e 2 baixos, 3 alto, 4 arranha-céu). Os modelos são da Kenney
 *   (CC0, web/public/cidades3d/<kit>/License.txt; o crédito nos termos, seção 10).
 * - No meio, um trem dá a volta numa linha, só de enfeite (parado com "menos movimento" no sistema).
 * - Cada pessoa é o MASCOTE 3D com o NOSSO esqueleto (coelho-animado.glb, de e2e/pixel-art/personagem/blender/meshy/glb.py), com o pelo e o moletom trocados pelas cores dela — a troca
 *   de paleta do kart, aqui no shader. Ele PULA casa a casa, como peça de festa.
 * - A câmera mostra o tabuleiro inteiro e chega perto de quem anda. Sem foco na janela, nada é desenhado (o uso principal é
 *   com um jogo aberto); as sombras de verdade só com "Sombras" ligado em Gráficos, e senão uma sombra redonda por coelho.
 */

export interface CasaDaCena {
  tipo: string;
  nome?: string;
  uf?: string;
  grupo?: number;
  preco?: number;
}
export interface PosseDaCena {
  casa: number;
  dono: number;
  predios: number;
  hipotecada: boolean;
}
export interface PecaDaCena {
  userId: number;
  /** A casa onde a peça está AGORA na tela (o andar casa a casa já vem contado de fora). */
  pos: number;
  pelo: string;
  roupa: string;
  vez: boolean;
  presente: boolean;
}
export interface DadosDaCena {
  casas: CasaDaCena[];
  posses: PosseDaCena[];
  pecas: PecaDaCena[];
  escolhida: number | null;
  /** A cor de cada dono (a roupa dele). */
  corDe: (userId: number) => string;
  cores: string[];
  icones: Record<string, string>;
}

const BASE = `${import.meta.env.BASE_URL}cidades3d/`;
const COLUNAS = 10;
const LINHAS = 8;
const CASA = 1;
const ALTURA_DA_CASA = 0.16;
const ALTURA_DO_COELHO = 0.8;

const CASAS_DO_SUBURBIO = ['a', 'c', 'e', 'g', 'j', 'm', 'p', 's'].map((l) => `suburbio/building-type-${l}.glb`);
const PREDIO_BAIXO = ['comercio/building-a.glb', 'comercio/building-c.glb'];
const PREDIO_MEDIO = ['comercio/building-e.glb', 'comercio/building-g.glb'];
const PREDIO_ALTO = ['comercio/building-skyscraper-c.glb'];
const ARRANHA_CEU = ['comercio/building-skyscraper-a.glb', 'comercio/building-skyscraper-b.glb'];
const ARVORES = ['suburbio/tree-large.glb', 'suburbio/tree-small.glb'];
const TODOS = [
  'coelho-animado.glb',
  ...CASAS_DO_SUBURBIO,
  ...PREDIO_BAIXO,
  ...PREDIO_MEDIO,
  ...PREDIO_ALTO,
  ...ARRANHA_CEU,
  ...ARVORES,
  'suburbio/planter.glb',
  'comercio/detail-parasol-a.glb',
  'trem/train-locomotive-a.glb',
  'trem/train-carriage-box.glb',
  'trem/train-carriage-container-red.glb',
  'trem/train-tram-modern.glb',
];

const carregados = new Map<string, Promise<GLTF>>();
function carregar(arquivo: string): Promise<GLTF> {
  let p = carregados.get(arquivo);
  if (!p) {
    p = new GLTFLoader().loadAsync(BASE + arquivo);
    carregados.set(arquivo, p);
    p.catch(() => carregados.delete(arquivo));
  }
  return p;
}

/** A casa `i` (0 a 31) na grade: a mesma volta de lugarDaCasaDasCidades. */
function colunaLinha(i: number): [number, number] {
  if (i <= 9) return [i, 0];
  if (i <= 16) return [9, i - 9];
  if (i <= 25) return [25 - i, 7];
  return [0, 32 - i];
}
export function centroDaCasa(i: number): THREE.Vector3 {
  const [c, l] = colunaLinha(i);
  return new THREE.Vector3((c - (COLUNAS - 1) / 2) * CASA, ALTURA_DA_CASA, (l - (LINHAS - 1) / 2) * CASA);
}
/** Para fora da volta, a partir da casa: onde mora o que se constrói nela. */
function paraFora(i: number): THREE.Vector3 {
  const [c, l] = colunaLinha(i);
  const v = new THREE.Vector3(c === 0 ? -1 : c === COLUNAS - 1 ? 1 : 0, 0, l === 0 ? -1 : l === LINHAS - 1 ? 1 : 0);
  return v.normalize();
}

/** Uma cópia do modelo com a base no chão, centrada, com `largura` no maior lado do chão. */
function copia(g: GLTF, largura: number, sombra: boolean): THREE.Object3D {
  const o = g.scene.clone(true);
  const caixa = new THREE.Box3().setFromObject(o);
  const tam = caixa.getSize(new THREE.Vector3());
  const s = largura / Math.max(tam.x, tam.z, 1e-6);
  const centro = caixa.getCenter(new THREE.Vector3());
  const raiz = new THREE.Group();
  o.position.set(-centro.x, -caixa.min.y, -centro.z);
  raiz.add(o);
  raiz.scale.setScalar(s);
  o.traverse((m) => {
    if ((m as THREE.Mesh).isMesh) {
      m.castShadow = sombra;
      m.receiveShadow = sombra;
    }
  });
  return raiz;
}

const roundRect = (g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
};

/** O tampo de uma casa, pintado: a cor do grupo, a sigla e o preço, ou o ícone; a borda na cor do dono. */
function pintarTampo(casa: CasaDaCena, posse: PosseDaCena | undefined, d: DadosDaCena, escolhida: boolean): THREE.CanvasTexture {
  const L = 192;
  const c = document.createElement('canvas');
  c.width = c.height = L;
  const g = c.getContext('2d')!;
  const fundo = casa.tipo === 'cidade' ? d.cores[casa.grupo ?? 0] : casa.tipo === 'transporte' ? '#d9cdb4' : '#f1e6cf';
  g.fillStyle = fundo;
  roundRect(g, 4, 4, L - 8, L - 8, 26);
  g.fill();
  // um brilho de cima, de desenho
  const brilho = g.createLinearGradient(0, 0, 0, L);
  brilho.addColorStop(0, 'rgba(255,255,255,0.28)');
  brilho.addColorStop(0.55, 'rgba(255,255,255,0)');
  g.fillStyle = brilho;
  g.fill();
  if (posse) {
    g.lineWidth = 16;
    g.strokeStyle = d.corDe(posse.dono);
    roundRect(g, 12, 12, L - 24, L - 24, 20);
    g.stroke();
  }
  if (escolhida) {
    g.lineWidth = 8;
    g.strokeStyle = '#fff7e0';
    roundRect(g, 26, 26, L - 52, L - 52, 14);
    g.stroke();
  }
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  if (casa.tipo === 'cidade') {
    g.font = '900 72px system-ui, sans-serif';
    g.lineWidth = 10;
    g.strokeStyle = 'rgba(40,30,30,0.55)';
    g.strokeText(casa.uf ?? '', L / 2, L * 0.42);
    g.fillStyle = '#fffaf0';
    g.fillText(casa.uf ?? '', L / 2, L * 0.42);
    if (!posse) {
      g.font = '700 34px system-ui, sans-serif';
      g.fillStyle = 'rgba(40,30,30,0.75)';
      g.fillText(String(casa.preco ?? ''), L / 2, L * 0.74);
    } else if (posse.predios > 0) {
      for (let k = 0; k < posse.predios; k++) {
        g.fillStyle = '#fffaf0';
        g.strokeStyle = 'rgba(40,30,30,0.7)';
        g.lineWidth = 4;
        const x = L / 2 - (posse.predios * 26) / 2 + k * 26 + 3;
        g.fillRect(x, L * 0.68, 20, 20);
        g.strokeRect(x, L * 0.68, 20, 20);
      }
    }
  } else {
    const icone = d.icones[casa.tipo === 'transporte' ? (casa.nome ?? '') : casa.tipo] ?? '';
    // a seta da largada não é emoji: vai na letra comum, grossa
    const emoji = /\p{Extended_Pictographic}/u.test(icone);
    g.font = emoji ? '88px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif' : '900 96px system-ui, sans-serif';
    if (!emoji) g.fillStyle = '#5a4a3a';
    g.fillText(icone, L / 2, L / 2 + 4);
  }
  if (posse?.hipotecada) {
    g.fillStyle = 'rgba(120,110,105,0.55)';
    roundRect(g, 4, 4, L - 8, L - 8, 26);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** O mascote com o pelo e o moletom de quem joga: a troca de paleta no shader (o escuro do corpo é o moletom). */
function materialDoCoelho(base: THREE.MeshStandardMaterial, pelo: string, roupa: string) {
  const m = base.clone();
  const uPelo = { value: new THREE.Color(pelo) };
  const uRoupa = { value: new THREE.Color(roupa) };
  const uOpaco = { value: 1 };
  m.transparent = true;
  m.onBeforeCompile = (s) => {
    s.uniforms.uPelo = uPelo;
    s.uniforms.uRoupa = uRoupa;
    s.uniforms.uOpaco = uOpaco;
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vAltura;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvAltura = position.y;');
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vAltura;\nuniform vec3 uPelo;\nuniform vec3 uRoupa;\nuniform float uOpaco;')
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        {
          vec3 cor = diffuseColor.rgb;
          float l = dot(cor, vec3(0.3, 0.59, 0.11));
          float sat = max(cor.r, max(cor.g, cor.b)) - min(cor.r, min(cor.g, cor.b));
          if (l < 0.07 && vAltura < ${PESCOCO.toFixed(3)}) diffuseColor.rgb = uRoupa * (0.62 + 5.5 * l);
          else if (l > 0.28 && sat < 0.3) diffuseColor.rgb = uPelo * clamp(l / 0.62, 0.6, 1.15);
          diffuseColor.a *= uOpaco;
        }`,
      );
  };
  m.customProgramCacheKey = () => 'coelho-paleta';
  return { m, uPelo, uRoupa, uOpaco };
}
/**
 * Onde acaba o moletom, na altura da malha em T (de 0 a 8,4, a do mascote.py; o pescoço das MEDIDAS dela é 3,65): abaixo
 * disso, o escuro é roupa; acima, olho e focinho.
 */
const PESCOCO = 3.6;

interface Peca {
  raiz: THREE.Group;
  corpo: THREE.Object3D;
  sombra: THREE.Mesh;
  marca: THREE.Mesh;
  mat: ReturnType<typeof materialDoCoelho>;
  casa: number;
  de: THREE.Vector3;
  para: THREE.Vector3;
  inicio: number;
  duracao: number;
  rumo: number;
  pelo: string;
  roupa: string;
  mixer: THREE.AnimationMixer;
  acoes: Map<string, THREE.AnimationAction>;
  tocando: string;
}

export class CenaDasCidades {
  private renderer: THREE.WebGLRenderer;
  private cena = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(34, 1.25, 0.1, 200);
  private alvo = new THREE.Vector3(0, 0, 0.25);
  private olhando = new THREE.Vector3(0, 0, 0.25);
  private distancia = 1;
  private modelos = new Map<string, GLTF>();
  private casas: THREE.Mesh[] = [];
  private tampos: { chave: string; mat: THREE.MeshStandardMaterial }[] = [];
  private construcoes: { chave: string; obj: THREE.Object3D | null }[] = [];
  private pecas = new Map<number, Peca>();
  private trem: THREE.Object3D[] = [];
  private trilho: THREE.CatmullRomCurve3 | null = null;
  private dados: DadosDaCena | null = null;
  private quadro = 0;
  private relogio = new THREE.Timer();
  private observador: ResizeObserver;
  private sombras: boolean;
  private calmo: boolean;
  private raio = new THREE.Raycaster();
  private apertou: { x: number; y: number } | null = null;
  private descartaveis: { dispose(): void }[] = [];
  private morta = false;
  /** Para a foto de conferência: olhar de perto um ponto do tabuleiro (x, z) a uma fração da distância. */
  focoDeTeste: { x: number; z: number; perto: number } | null = null;

  constructor(
    private caixa: HTMLElement,
    private aoEscolher: (i: number) => void,
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    let graficos: { sombras?: boolean } = {};
    try {
      graficos = JSON.parse(localStorage.getItem('syden:graficos') ?? '{}');
    } catch {
      /* fica sem */
    }
    this.sombras = !!graficos.sombras;
    this.calmo = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    this.renderer.shadowMap.enabled = this.sombras;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const canvas = this.renderer.domElement;
    canvas.className = 'cid-tabuleiro-3d-tela';
    caixa.appendChild(canvas);
    this.observador = new ResizeObserver(() => this.medir());
    this.observador.observe(caixa);
    this.medir();
    canvas.addEventListener('pointerdown', this.aoApertar);
    canvas.addEventListener('pointerup', this.aoSoltar);
    canvas.addEventListener('pointermove', this.aoPassar);
  }

  /** Carrega os modelos e monta o que não muda. Rejeita se algo falhar (a tela fica no desenho de reserva). */
  async montar(): Promise<void> {
    const lista = await Promise.all(TODOS.map((a) => carregar(a).then((g) => [a, g] as const)));
    if (this.morta) return;
    for (const [a, g] of lista) this.modelos.set(a, g);
    this.montarFixo();
    this.renderer.setAnimationLoop(this.desenhar);
  }

  private medir() {
    const w = Math.max(1, this.caixa.clientWidth);
    const h = Math.max(1, this.caixa.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // de longe o bastante para caber o tabuleiro inteiro, na largura e na altura
    this.distancia = Math.max(1, 1.25 / this.camera.aspect);
    this.camera.updateProjectionMatrix();
  }

  private montarFixo() {
    const c = this.cena;
    c.background = new THREE.Color('#bfe4f2');
    c.fog = new THREE.Fog('#bfe4f2', 22, 42);
    const ceu = new THREE.HemisphereLight('#fff6e8', '#7fae6a', 1.6);
    c.add(ceu);
    const sol = new THREE.DirectionalLight('#fff1d6', 2.2);
    sol.position.set(-5, 11, 6);
    if (this.sombras) {
      sol.castShadow = true;
      sol.shadow.mapSize.set(2048, 2048);
      const s = sol.shadow.camera;
      s.left = -8;
      s.right = 8;
      s.top = 7;
      s.bottom = -7;
      s.near = 1;
      s.far = 30;
      sol.shadow.bias = -0.0008;
      sol.shadow.normalBias = 0.02;
    }
    c.add(sol);

    // a água e a ilha
    const agua = new THREE.Mesh(new THREE.CircleGeometry(40, 48), new THREE.MeshStandardMaterial({ color: '#7cc6dc', roughness: 0.35 }));
    agua.rotation.x = -Math.PI / 2;
    agua.position.y = -0.55;
    c.add(agua);
    const ilha = new THREE.Mesh(
      new RoundedBoxGeometry(COLUNAS + 3.2, 0.9, LINHAS + 3.2, 6, 0.45),
      new THREE.MeshStandardMaterial({ color: '#8fcf6f', roughness: 0.95 }),
    );
    ilha.position.y = -0.45;
    ilha.receiveShadow = this.sombras;
    c.add(ilha);
    const terra = new THREE.Mesh(
      new RoundedBoxGeometry(COLUNAS + 3.0, 0.7, LINHAS + 3.0, 6, 0.4),
      new THREE.MeshStandardMaterial({ color: '#c99a6b', roughness: 1 }),
    );
    terra.position.y = -0.75;
    c.add(terra);
    // o miolo, um tom mais escuro
    const miolo = new THREE.Mesh(
      new RoundedBoxGeometry((COLUNAS - 2) * CASA - 0.2, 0.06, (LINHAS - 2) * CASA - 0.2, 4, 0.03),
      new THREE.MeshStandardMaterial({ color: '#7fc164', roughness: 1 }),
    );
    miolo.position.y = 0.0;
    miolo.receiveShadow = this.sombras;
    c.add(miolo);

    // as 32 casas
    const geo = new RoundedBoxGeometry(CASA * 0.94, ALTURA_DA_CASA, CASA * 0.94, 3, 0.06);
    const tampoGeo = new THREE.PlaneGeometry(CASA * 0.9, CASA * 0.9);
    this.descartaveis.push(geo, tampoGeo);
    for (let i = 0; i < 32; i++) {
      const p = centroDaCasa(i);
      const bloco = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: '#efe3cb', roughness: 0.7 }));
      bloco.position.set(p.x, ALTURA_DA_CASA / 2, p.z);
      bloco.castShadow = this.sombras;
      bloco.receiveShadow = this.sombras;
      bloco.userData.casa = i;
      const mat = new THREE.MeshStandardMaterial({ roughness: 0.6, transparent: true });
      const tampo = new THREE.Mesh(tampoGeo, mat);
      tampo.rotation.x = -Math.PI / 2;
      tampo.position.y = ALTURA_DA_CASA / 2 + 0.002;
      tampo.receiveShadow = this.sombras;
      tampo.userData.casa = i;
      bloco.add(tampo);
      c.add(bloco);
      this.casas.push(bloco);
      this.tampos.push({ chave: '', mat });
      this.construcoes.push({ chave: '', obj: null });
    }

    // as árvores em volta e no miolo (sorteadas sempre do mesmo jeito)
    let semente = 7;
    const sorte = () => ((semente = (semente * 16807) % 2147483647) / 2147483647);
    const plantar = (x: number, z: number, tamanho: number) => {
      const g = this.modelos.get(ARVORES[sorte() < 0.5 ? 0 : 1]);
      if (!g) return;
      const a = copia(g, tamanho, this.sombras);
      a.position.set(x, 0, z);
      a.rotation.y = sorte() * Math.PI * 2;
      c.add(a);
    };
    for (let k = 0; k < 26; k++) {
      // na beira da ilha, entre os prédios
      const lado = k % 4;
      const u = sorte() * 2 - 1;
      const x = lado < 2 ? u * (COLUNAS / 2 + 0.6) : (lado === 2 ? -1 : 1) * (COLUNAS / 2 + 1.1 + sorte() * 0.3);
      const z = lado >= 2 ? u * (LINHAS / 2 + 0.6) : (lado === 0 ? -1 : 1) * (LINHAS / 2 + 1.1 + sorte() * 0.3);
      plantar(x, z, 0.32 + sorte() * 0.18);
    }
    // o miolo: um trilho com um trem, árvores e canteiros dentro da volta
    this.montarTrem();
    for (const [x, z] of [
      [-2.4, -0.2],
      [2.5, 0.3],
      [-0.9, -0.9],
      [1.0, 0.95],
      [-3.0, 1.6],
      [3.1, -1.7],
    ])
      plantar(x, z, 0.34);
    const vaso = this.modelos.get('suburbio/planter.glb');
    if (vaso)
      for (const [x, z] of [
        [-1.6, 0.6],
        [1.7, -0.5],
      ]) {
        const v = copia(vaso, 0.45, this.sombras);
        v.position.set(x, 0.03, z);
        c.add(v);
      }
  }

  private montarTrem() {
    const rx = 3.0;
    const rz = 1.95;
    const canto = 0.9;
    const pts: THREE.Vector3[] = [];
    // um retângulo de cantos redondos, no sentido horário visto de cima
    const cantos: [number, number, number][] = [
      [rx - canto, -(rz - canto), -Math.PI / 2],
      [rx - canto, rz - canto, 0],
      [-(rx - canto), rz - canto, Math.PI / 2],
      [-(rx - canto), -(rz - canto), Math.PI],
    ];
    for (const [cx, cz, a0] of cantos)
      for (let k = 0; k <= 6; k++) {
        const a = a0 + (k / 6) * (Math.PI / 2);
        pts.push(new THREE.Vector3(cx + Math.cos(a) * canto, 0.06, cz + Math.sin(a) * canto));
      }
    const curva = new THREE.CatmullRomCurve3(pts, true, 'centripetal');
    this.trilho = curva;
    const n = 220;
    const dormente = new THREE.BoxGeometry(0.34, 0.03, 0.07);
    const madeira = new THREE.MeshStandardMaterial({ color: '#8a5a3c', roughness: 0.9 });
    const dormentes = new THREE.InstancedMesh(dormente, madeira, n);
    const trilhoGeo = new THREE.BoxGeometry(0.035, 0.035, 1);
    const aco = new THREE.MeshStandardMaterial({ color: '#b9b4ae', metalness: 0.4, roughness: 0.4 });
    const trilhos = new THREE.InstancedMesh(trilhoGeo, aco, n * 2);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3(1, 1, 1);
    const comp = curva.getLength() / n;
    for (let k = 0; k < n; k++) {
      const u = k / n;
      const p = curva.getPointAt(u);
      const t = curva.getTangentAt(u);
      const rumo = Math.atan2(t.x, t.z);
      q.setFromEuler(new THREE.Euler(0, rumo, 0));
      m.compose(p, q, s);
      dormentes.setMatrixAt(k, m);
      const lado = new THREE.Vector3(Math.cos(rumo), 0, -Math.sin(rumo)).multiplyScalar(0.11);
      for (const [j, sinal] of [
        [0, 1],
        [1, -1],
      ]) {
        const pp = p.clone().addScaledVector(lado, sinal).setY(0.095);
        m.compose(pp, q, new THREE.Vector3(1, 1, comp * 1.05));
        trilhos.setMatrixAt(k * 2 + j, m);
      }
    }
    dormentes.receiveShadow = this.sombras;
    this.cena.add(dormentes, trilhos);
    this.descartaveis.push(dormente, madeira, trilhoGeo, aco);
    for (const arq of ['trem/train-locomotive-a.glb', 'trem/train-carriage-box.glb', 'trem/train-carriage-container-red.glb']) {
      const g = this.modelos.get(arq);
      if (!g) continue;
      const v = copia(g, 0.62, this.sombras);
      const r = new THREE.Group();
      r.add(v);
      this.cena.add(r);
      this.trem.push(r);
    }
  }

  /** O estado novo do jogo: tampos, construções e peças. */
  atualizar(d: DadosDaCena) {
    this.dados = d;
    if (!this.casas.length) return;
    const posse = new Map(d.posses.map((p) => [p.casa, p]));
    d.casas.forEach((casa, i) => {
      if (i >= 32) return;
      const p = posse.get(i);
      const chave = JSON.stringify([casa.tipo, casa.uf, casa.preco, casa.grupo, casa.nome, p && [d.corDe(p.dono), p.predios, p.hipotecada], d.escolhida === i]);
      const t = this.tampos[i];
      if (t.chave !== chave) {
        t.chave = chave;
        t.mat.map?.dispose();
        t.mat.map = pintarTampo(casa, p, d, d.escolhida === i);
        t.mat.needsUpdate = true;
      }
      this.casas[i].position.y = ALTURA_DA_CASA / 2 + (d.escolhida === i ? 0.07 : 0);
      this.construir(i, casa, p, d);
    });
    this.atualizarPecas(d);
  }

  private construir(i: number, casa: CasaDaCena, p: PosseDaCena | undefined, d: DadosDaCena) {
    let arquivo: string | null = null;
    let largura = 0.62;
    if (casa.tipo === 'cidade' && p) {
      const lista = p.predios >= 4 ? ARRANHA_CEU : p.predios === 3 ? PREDIO_ALTO : p.predios === 2 ? PREDIO_MEDIO : p.predios === 1 ? PREDIO_BAIXO : CASAS_DO_SUBURBIO;
      arquivo = lista[i % lista.length];
      largura = p.predios >= 3 ? 0.5 : 0.6;
    } else if (casa.tipo === 'transporte' && casa.nome === 'ferrovia') arquivo = 'trem/train-locomotive-a.glb';
    else if (casa.tipo === 'transporte' && casa.nome === 'rodoviaria') arquivo = 'trem/train-tram-modern.glb';
    else if (casa.tipo === 'feriado') arquivo = 'comercio/detail-parasol-a.glb';
    const dono = p ? d.corDe(p.dono) : '';
    const chave = `${arquivo}|${dono}|${p?.hipotecada ? 1 : 0}`;
    const c = this.construcoes[i];
    if (c.chave === chave) return;
    c.chave = chave;
    if (c.obj) {
      this.cena.remove(c.obj);
      c.obj.traverse((o) => (o as THREE.Mesh).isMesh && (o as THREE.Mesh).geometry !== undefined && o.userData.bandeira && (o as THREE.Mesh).geometry.dispose());
      c.obj = null;
    }
    const g = arquivo ? this.modelos.get(arquivo) : undefined;
    if (!g) return;
    const raiz = new THREE.Group();
    const centro = centroDaCasa(i);
    const fora = paraFora(i);
    raiz.position.set(centro.x + fora.x * 0.95, 0, centro.z + fora.z * 0.95);
    // de frente para o tabuleiro
    raiz.rotation.y = Math.atan2(-fora.x, -fora.z);
    const modelo = copia(g, largura, this.sombras);
    raiz.add(modelo);
    if (p) {
      // a bandeira do dono, do lado
      const mastro = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.5, 6), new THREE.MeshStandardMaterial({ color: '#f4efe6' }));
      mastro.position.set(0.38, 0.25, 0.1);
      const pano = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.012), new THREE.MeshStandardMaterial({ color: dono, roughness: 0.6 }));
      pano.position.set(0.48, 0.43, 0.1);
      mastro.userData.bandeira = pano.userData.bandeira = true;
      mastro.castShadow = pano.castShadow = this.sombras;
      raiz.add(mastro, pano);
    }
    if (p?.hipotecada)
      modelo.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          const mat = (m.material as THREE.MeshStandardMaterial).clone();
          mat.color.multiplyScalar(0.55);
          m.material = mat;
        }
      });
    this.cena.add(raiz);
    c.obj = raiz;
  }

  private atualizarPecas(d: DadosDaCena) {
    const coelho = this.modelos.get('coelho-animado.glb');
    if (!coelho) return;
    const vivos = new Set(d.pecas.map((p) => p.userId));
    for (const [id, p] of this.pecas)
      if (!vivos.has(id)) {
        this.cena.remove(p.raiz);
        this.pecas.delete(id);
      }
    // quantas peças por casa, para dividir o lugar
    const porCasa = new Map<number, number[]>();
    for (const p of d.pecas) porCasa.set(p.pos, [...(porCasa.get(p.pos) ?? []), p.userId]);
    const agora = performance.now();
    for (const info of d.pecas) {
      let p = this.pecas.get(info.userId);
      if (!p || p.pelo !== info.pelo || p.roupa !== info.roupa) {
        if (p) this.cena.remove(p.raiz);
        p = this.novaPeca(coelho, info);
        this.pecas.set(info.userId, p);
      }
      const ids = porCasa.get(info.pos) ?? [info.userId];
      const k = ids.indexOf(info.userId);
      const centro = centroDaCasa(info.pos);
      const n = ids.length;
      const a = (k / Math.max(1, n)) * Math.PI * 2 + Math.PI / 4;
      const r = n > 1 ? 0.2 : 0;
      // um pouco para dentro da volta: a sigla fica mais à vista
      const dentro = paraFora(info.pos).multiplyScalar(-0.14);
      const destino = new THREE.Vector3(centro.x + dentro.x + Math.cos(a) * r, centro.y, centro.z + dentro.z + Math.sin(a) * r * 0.8);
      if (p.casa !== info.pos || p.para.distanceTo(destino) > 1e-3) {
        const pulo = p.casa !== info.pos;
        p.de.copy(p.raiz.position);
        p.para.copy(destino);
        p.inicio = agora;
        const longe = p.de.distanceTo(destino);
        p.duracao = !pulo ? 180 : longe > 1.6 ? 650 : 210;
        if (longe > 0.05) p.rumo = Math.atan2(destino.x - p.de.x, destino.z - p.de.z);
        p.casa = info.pos;
      }
      p.mat.uOpaco.value = info.presente ? 1 : 0.45;
      p.marca.visible = info.vez;
      (p.marca.material as THREE.MeshStandardMaterial).color.set(info.roupa);
      p.raiz.userData.vez = info.vez;
    }
  }

  private novaPeca(g: GLTF, info: PecaDaCena): Peca {
    // o coelho com o NOSSO esqueleto (e2e/pixel-art/personagem/blender/meshy/glb.py): a cópia tem de levar o esqueleto junto
    const corpo = SkeletonUtils.clone(g.scene);
    const caixa = new THREE.Box3().setFromObject(corpo);
    const k = ALTURA_DO_COELHO / (caixa.max.y - caixa.min.y);
    corpo.scale.setScalar(k);
    corpo.position.y = -caixa.min.y * k;
    corpo.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = this.sombras;
        m.frustumCulled = false;
      }
    });
    const mixer = new THREE.AnimationMixer(corpo);
    const acoes = new Map(g.animations.map((a) => [a.name, mixer.clipAction(a)]));
    let base: THREE.MeshStandardMaterial | null = null;
    corpo.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && !base) base = m.material as THREE.MeshStandardMaterial;
    });
    const mat = materialDoCoelho(base ?? new THREE.MeshStandardMaterial(), info.pelo, info.roupa);
    corpo.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) m.material = mat.m;
    });
    const raiz = new THREE.Group();
    const pulo = new THREE.Group();
    pulo.add(corpo);
    raiz.add(pulo);
    const sombra = new THREE.Mesh(
      new THREE.CircleGeometry(0.2, 20),
      new THREE.MeshBasicMaterial({ color: '#2a3a2a', transparent: true, opacity: 0.28, depthWrite: false }),
    );
    sombra.rotation.x = -Math.PI / 2;
    sombra.position.y = 0.004;
    raiz.add(sombra);
    const marca = new THREE.Mesh(new THREE.OctahedronGeometry(0.075), new THREE.MeshStandardMaterial({ color: info.roupa, emissive: '#ffffff', emissiveIntensity: 0.25 }));
    marca.position.y = ALTURA_DO_COELHO + 0.22;
    marca.castShadow = false;
    raiz.add(marca);
    const c = centroDaCasa(info.pos);
    raiz.position.copy(c);
    this.cena.add(raiz);
    return { raiz, corpo: pulo, sombra, marca, mat, casa: info.pos, de: c.clone(), para: c.clone(), inicio: 0, duracao: 0, rumo: 0, pelo: info.pelo, roupa: info.roupa, mixer, acoes, tocando: '' };
  }

  /** Troca de animação com uma passagem curta. */
  private tocar(p: Peca, nome: string) {
    if (p.tocando === nome) return;
    const nova = p.acoes.get(nome);
    if (!nova) return;
    const velha = p.acoes.get(p.tocando);
    nova.reset().play();
    if (velha) velha.crossFadeTo(nova, 0.2, false);
    p.tocando = nome;
  }

  private desenhar = () => {
    if (this.morta) return;
    // sem foco na janela (o jogo de verdade aberto) ou escondida, não desenha
    if (document.hidden || !document.hasFocus()) {
      this.relogio.update();
      return;
    }
    this.relogio.update();
    const dt = Math.min(0.05, this.relogio.getDelta());
    const tempo = this.relogio.getElapsed();
    const agora = performance.now();
    this.quadro++;

    let andando: THREE.Vector3 | null = null;
    for (const p of this.pecas.values()) {
      const f = p.duracao ? Math.min(1, (agora - p.inicio) / p.duracao) : 1;
      const e = f < 1 ? f * f * (3 - 2 * f) : 1;
      p.raiz.position.lerpVectors(p.de, p.para, e);
      const longe = p.de.distanceTo(p.para);
      const altura = f < 1 && longe > 0.3 ? Math.sin(Math.PI * f) * (longe > 1.6 ? 0.9 : 0.32) : 0;
      p.corpo.position.y = altura;
      // o achatar e esticar de desenho: estica no ar, achata ao pousar
      const pouso = f >= 1 ? Math.max(0, 1 - (agora - p.inicio - p.duracao) / 140) : 0;
      const respira = this.calmo ? 0 : Math.sin(tempo * 2.4 + p.raiz.id) * 0.015;
      const vez = p.raiz.userData.vez && !this.calmo && f >= 1 ? Math.abs(Math.sin(tempo * 4)) * 0.05 : 0;
      p.corpo.position.y += vez;
      const estica = f < 1 && altura > 0 ? 0.1 * Math.sin(Math.PI * f) : -0.16 * pouso + respira;
      p.corpo.scale.set(1 - estica * 0.5, 1 + estica, 1 - estica * 0.5);
      (p.sombra.material as THREE.MeshBasicMaterial).opacity = 0.28 * (1 - Math.min(0.6, altura));
      p.sombra.scale.setScalar(1 - Math.min(0.4, altura * 0.5));
      // olha para onde vai; parado, vira devagar para a câmera
      const quer = f < 1 && longe > 0.05 ? p.rumo : 0;
      let delta = quer - p.corpo.rotation.y;
      delta = Math.atan2(Math.sin(delta), Math.cos(delta));
      p.corpo.rotation.y += delta * Math.min(1, dt * (f < 1 ? 18 : 4));
      p.marca.rotation.y = tempo * 2;
      p.marca.position.y = ALTURA_DO_COELHO + 0.22 + altura + (this.calmo ? 0 : Math.sin(tempo * 3) * 0.04);
      if (f < 1 && longe > 0.3) andando = p.raiz.position;
      // andando entre as casas; na vez, gesticulando; à toa, parado (com menos movimento, sempre parado)
      this.tocar(p, this.calmo ? 'parado' : f < 1 && longe > 0.3 ? 'andando' : p.raiz.userData.vez ? 'falando' : 'parado');
      p.mixer.update(this.calmo ? 0 : dt);
    }

    // o trem
    if (this.trilho && this.trem.length) {
      const u0 = this.calmo ? 0.1 : (tempo * 0.018) % 1;
      this.trem.forEach((v, k) => {
        const u = (u0 - k * 0.034 + 1) % 1;
        const p = this.trilho!.getPointAt(u);
        const t = this.trilho!.getTangentAt(u);
        v.position.set(p.x, 0.1, p.z);
        v.rotation.y = Math.atan2(t.x, t.z);
      });
    }

    // a câmera: o tabuleiro inteiro; chega perto de quem anda
    const longe = this.focoDeTeste ? this.focoDeTeste.perto : andando ? 0.78 : 1;
    const foco = this.focoDeTeste ? new THREE.Vector3(this.focoDeTeste.x, 0, this.focoDeTeste.z) : andando ? new THREE.Vector3().lerpVectors(new THREE.Vector3(0, 0, 0.25), andando, 0.45) : new THREE.Vector3(0, 0, 0.25);
    const k = 1 - Math.exp(-dt * 2.2);
    this.alvo.lerp(foco, k);
    this.olhando.lerp(this.alvo, k);
    const d = 16.2 * this.distancia * longe;
    const balanco = this.calmo ? 0 : Math.sin(tempo * 0.25) * 0.35;
    const pos = new THREE.Vector3(this.olhando.x + balanco, d * 0.8, this.olhando.z + d * 0.7);
    this.camera.position.lerp(pos, this.quadro < 3 ? 1 : k);
    this.camera.lookAt(this.olhando);
    this.renderer.render(this.cena, this.camera);
  };

  private casaNoPonto(e: PointerEvent): number | null {
    const r = this.renderer.domElement.getBoundingClientRect();
    const v = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.raio.setFromCamera(v, this.camera);
    const hit = this.raio.intersectObjects(this.casas, true)[0];
    return hit ? (hit.object.userData.casa as number) : null;
  }
  private aoApertar = (e: PointerEvent) => {
    this.apertou = { x: e.clientX, y: e.clientY };
  };
  private aoSoltar = (e: PointerEvent) => {
    if (!this.apertou || Math.hypot(e.clientX - this.apertou.x, e.clientY - this.apertou.y) > 6) return;
    this.apertou = null;
    const i = this.casaNoPonto(e);
    if (i !== null) this.aoEscolher(i);
  };
  private aoPassar = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse' || this.quadro % 2) return;
    this.renderer.domElement.style.cursor = this.casaNoPonto(e) !== null ? 'pointer' : '';
  };

  destruir() {
    this.morta = true;
    this.renderer.setAnimationLoop(null);
    this.observador.disconnect();
    const canvas = this.renderer.domElement;
    canvas.removeEventListener('pointerdown', this.aoApertar);
    canvas.removeEventListener('pointerup', this.aoSoltar);
    canvas.removeEventListener('pointermove', this.aoPassar);
    this.cena.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      // a geometria e as texturas dos modelos são do cache (servem à próxima partida); as nossas vão embora
      if (m.userData.casa !== undefined || m.userData.bandeira) {
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        for (const mat of mats) {
          (mat as THREE.MeshStandardMaterial).map?.dispose();
          mat.dispose();
        }
      }
    });
    for (const d of this.descartaveis) d.dispose();
    for (const p of this.pecas.values()) p.mat.m.dispose();
    this.renderer.dispose();
    canvas.remove();
  }
}
