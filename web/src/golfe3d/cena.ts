import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { carregarCoelho, copiarCoelho, CORES_DO_MASCOTE } from '../coelho3d';
import { RAIO_BOLA, RAIO_BURACO, montar, relevo, type Buraco, type Peca } from './fisica';

/**
 * A CENA DO MINIGOLFE 3D (05/11/2026): o buraco montado peça a peça com o Minigolf Kit da Kenney (CC0,
 * web/public/golfe3d/License.txt), e quem joga é o NOSSO coelho 3D (cidades3d/coelho-animado.glb, o esqueleto de glb.py), de
 * pé ao lado da bola, com o pelo e o moletom trocados pelas cores do avatar (a troca de paleta do Cidades, no shader).
 *
 * Só a TELA: a física (fisica.ts) decide onde a bola está, e quem chama (JogoGolfe3D.tsx) passa o quadro a cada vez. Como as
 * outras cenas 3D: o three.js vem num pedaço à parte, só quando o jogo abre; sem foco na janela ou escondida, não desenha;
 * sombras de verdade só com "Sombras" ligado em Gráficos (senão, uma sombra redonda); ao sair, o contexto é devolvido.
 */

const BASE = `${import.meta.env.BASE_URL}golfe3d/`;
const ARVORES = ['suburbio/tree-large.glb', 'suburbio/tree-small.glb'].map((a) => `${import.meta.env.BASE_URL}cidades3d/${a}`);
/** O parque em volta da pista (Coaster Kit da Kenney, CC0, golfe3d/parque/License.txt). */
const PARQUE = ['flowers', 'grass', 'bench', 'tree', 'tree-large', 'stall-drinks', 'stall-food', 'trash'] as const;
type PecaDoParque = (typeof PARQUE)[number];
/** As cores do céu: o alto, o horizonte (que é também a névoa) e o chão ao longe. */
const CEU_ALTO = '#3f8edb';
const CEU_HORIZONTE = '#d9eef6';
/** Um sorteio sempre igual (o cenário é o mesmo em toda tela e toda vez), só para o desenho: não entra na física. */
function sorteio(semente: number) {
  let s = semente >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
const ALTURA_DO_COELHO = 0.5;
/** O coelho fica ao lado da bola, a esta distância, virado para ela. */
const AO_LADO = 0.2;

/** A peça da física → o modelo da Kenney. */
export const MODELO: Record<Peca, string> = {
  reta: 'straight',
  fim: 'end',
  canto: 'corner',
  curva: 'round-corner-a',
  buraco: 'hole-round',
  'buraco-aberto': 'hole-open',
  'rampa-baixa': 'ramp-low',
  'rampa-media': 'ramp-medium',
  rampa: 'ramp',
  monte: 'bump-walls',
  cova: 'bump-down-walls',
  lombada: 'hill-round',
  bloco: 'obstacle-block',
  losango: 'obstacle-diamond',
  triangulos: 'obstacle-triangle',
  estreito: 'narrow-block',
  castelo: 'castle',
  moinho: 'windmill',
  lacuna: 'gap',
  tunel: 'tunnel-wide',
  lado: 'side',
  aberto: 'open',
  'canto-interno': 'inner-corner',
};

/** O alto das peças que têm prédio em cima (medido nos modelos). */
const TETO: Partial<Record<Peca, number>> = { castelo: 0.68, moinho: 1.2 };

const carregados = new Map<string, Promise<GLTF>>();
function carregar(url: string): Promise<GLTF> {
  let p = carregados.get(url);
  if (!p) {
    p = new GLTFLoader().loadAsync(url);
    carregados.set(url, p);
    p.catch(() => carregados.delete(url));
  }
  return p;
}

export interface BolaNaCena {
  x: number;
  z: number;
  /** No ar, a altura do fundo da bola; no chão, null (ela segue o chão). */
  y: number | null;
  cor: string;
  dentro: boolean;
}

/** O que a página passa a cada quadro. */
export interface QuadroDoGolfe {
  /** A minha bola (null para quem só assiste). */
  minha: { x: number; z: number; y: number | null; dentro: boolean; andando: boolean } | null;
  outras: BolaNaCena[];
  /** A mira: a direção (unitária, no plano) e a força de 0 a 1; null sem mira à vista. */
  mira: { ux: number; uz: number; forca: number; arco?: [number, number, number][] } | null;
  /** Para onde a câmera olha (a mira, ou o rumo do buraco). */
  rumo: { ux: number; uz: number };
  /** A vista de cima do buraco inteiro (o começo, ou o botão). */
  deCima: boolean;
  /** Conta as tacadas dadas aqui: mudou, o taco balança. */
  tacadas: number;
}

export class CenaDoGolfe3D {
  private renderer: THREE.WebGLRenderer;
  private cena = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(50, 1, 0.03, 120);
  private observador: ResizeObserver;
  private morta = false;
  private sombras = false;
  private calmo = false;
  private proprios: { dispose(): void }[] = [];
  private relogio = new THREE.Timer();

  private bolaMinha: THREE.Mesh;
  private sombraMinha: THREE.Mesh;
  private outras: { bola: THREE.Mesh; sombra: THREE.Mesh }[] = [];
  private mira: THREE.Mesh[] = [];
  private pas: THREE.Object3D[] = [];
  private bandeira = new THREE.Group();
  private matsDaBandeira: THREE.MeshStandardMaterial[] = [];

  private ceu: THREE.Mesh | null = null;
  private queda: THREE.Mesh | null = null;
  private nuvens = new THREE.Group();
  private coelho = new THREE.Group();
  private corpo: THREE.Object3D | null = null;
  private mixer: THREE.AnimationMixer | null = null;
  private acoes = new Map<string, THREE.AnimationAction>();
  private tocando = '';
  private sombraDoCoelho: THREE.Mesh;
  private taco = new THREE.Group();
  /** Onde o coelho quer estar (ao lado da bola parada) e para onde ele olha. */
  private coelhoAlvo = new THREE.Vector3();
  private coelhoRumo = 0;
  private coelhoPronto = false;
  private balanco = { inicio: -1, ultimas: 0 };

  private camAlvo = new THREE.Vector3();
  private camPos = new THREE.Vector3();
  private primeiro = true;
  private centro = new THREE.Vector3();
  private tamanho = 1;

  constructor(
    private caixa: HTMLElement,
    private buraco: Buraco,
    private cores: { pelo: string; roupa: string } | null,
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    try {
      this.sombras = !!JSON.parse(localStorage.getItem('syden:graficos') ?? '{}').sombras;
    } catch {
      /* fica sem */
    }
    this.calmo = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    this.renderer.shadowMap.enabled = this.sombras;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const canvas = this.renderer.domElement;
    canvas.className = 'golfe3d-tela';
    caixa.appendChild(canvas);
    this.observador = new ResizeObserver(() => this.medir());
    this.observador.observe(caixa);
    this.medir();

    const geoBola = this.proprio(new THREE.SphereGeometry(RAIO_BOLA, 20, 14));
    const geoSombra = this.proprio(new THREE.CircleGeometry(RAIO_BOLA * 1.15, 16));
    this.bolaMinha = new THREE.Mesh(geoBola, this.proprio(new THREE.MeshStandardMaterial({ color: '#fbf7ee', roughness: 0.45 })));
    this.bolaMinha.castShadow = this.sombras;
    this.sombraMinha = this.sombraRedonda(geoSombra);
    this.sombraDoCoelho = this.sombraRedonda(this.proprio(new THREE.CircleGeometry(0.11, 20)));
    this.cena.add(this.bolaMinha, this.sombraMinha, this.sombraDoCoelho);
  }

  private proprio<T extends { dispose(): void }>(x: T): T {
    this.proprios.push(x);
    return x;
  }

  private sombraRedonda(geo: THREE.BufferGeometry) {
    const s = new THREE.Mesh(geo, this.proprio(new THREE.MeshBasicMaterial({ color: '#1d2a20', transparent: true, opacity: 0.3, depthWrite: false })));
    s.rotation.x = -Math.PI / 2;
    s.renderOrder = 1;
    s.visible = !this.sombras;
    return s;
  }

  private medir() {
    const w = Math.max(1, this.caixa.clientWidth);
    const h = Math.max(1, this.caixa.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private clonar(g: GLTF): THREE.Object3D {
    const o = g.scene.clone(true);
    o.traverse((m) => {
      const mesh = m as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = this.sombras;
        mesh.receiveShadow = this.sombras;
      }
    });
    return o;
  }

  /** Carrega os modelos e monta o buraco. Rejeita se algo falhar (quem chama mostra o aviso). */
  async montar(): Promise<void> {
    const nomes = [...new Set(this.buraco.casas.map(([p]) => MODELO[p])), 'flag-red', 'club-green', 'supports-low'];
    const [coelho, arvores, lista, parque] = await Promise.all([
      carregarCoelho(),
      Promise.all(ARVORES.map((a) => carregar(a).catch(() => null))),
      Promise.all(nomes.map((n) => carregar(`${BASE}${n}.glb`))),
      // o enfeite do parque: sem ele, a pista abre do mesmo jeito
      Promise.all(PARQUE.map((n) => carregar(`${BASE}parque/${n}.glb`).catch(() => null))),
    ]);
    if (this.morta) return;
    const modelos = new Map(nomes.map((n, i) => [n, lista[i]]));
    this.montarCenario(modelos, arvores.filter((a): a is GLTF => a !== null));
    this.montarParque(new Map(PARQUE.map((n, i) => [n, parque[i]] as const).filter((p): p is [PecaDoParque, GLTF] => p[1] !== null)));
    this.montarCoelho(coelho, modelos.get('club-green')!);
  }

  private montarCenario(modelos: Map<string, GLTF>, arvores: GLTF[]) {
    this.cena.background = new THREE.Color(CEU_HORIZONTE);
    const m = montar(this.buraco);
    const [x0, z0, x1, z1] = m.limites;
    this.centro.set((x0 + x1) / 2, 0, (z0 + z1) / 2);
    this.tamanho = Math.max(x1 - x0, z1 - z0);
    this.cena.fog = new THREE.Fog(CEU_HORIZONTE, 12 + this.tamanho, 48 + this.tamanho * 2);

    this.cena.add(new THREE.HemisphereLight('#fff6ea', '#5e7a52', 1.5));
    const sol = new THREE.DirectionalLight('#fff1dc', 2.2);
    sol.position.set(this.centro.x - 4, 9, this.centro.z + 5);
    sol.target.position.copy(this.centro);
    if (this.sombras) {
      const a = this.tamanho / 2 + 1.5;
      sol.castShadow = true;
      sol.shadow.mapSize.set(2048, 2048);
      Object.assign(sol.shadow.camera, { left: -a, right: a, top: a, bottom: -a, near: 1, far: 30 });
      sol.shadow.bias = -0.0005;
      sol.shadow.normalBias = 0.02;
    }
    this.cena.add(sol, sol.target);

    // o gramado em volta: a grama cortada em faixas, com o pontilhado das folhas (uma textura pequena, repetida)
    const grama = this.proprio(new THREE.CanvasTexture(texturaDaGrama()));
    grama.wrapS = grama.wrapT = THREE.RepeatWrapping;
    grama.repeat.set(30, 30);
    grama.colorSpace = THREE.SRGBColorSpace;
    grama.anisotropy = 4;
    const chao = new THREE.Mesh(this.proprio(new THREE.CircleGeometry(60, 64)), this.proprio(new THREE.MeshStandardMaterial({ map: grama, roughness: 1 })));
    chao.rotation.x = -Math.PI / 2;
    chao.position.set(this.centro.x, -0.002, this.centro.z);
    chao.receiveShadow = this.sombras;
    this.cena.add(chao);
    this.montarCeu();

    // as peças, cada uma na casa dela, com o giro e a altura da base (e os pilares embaixo de quem está no alto)
    for (const [peca, cx, cz, giro, base] of this.buraco.casas) {
      const o = this.clonar(modelos.get(MODELO[peca])!);
      o.position.set(cx, base, cz);
      o.rotation.y = (giro * Math.PI) / 2;
      this.cena.add(o);
      if (peca === 'moinho')
        o.traverse((n) => {
          if (n.name === 'blades') this.pas.push(n);
        });
      if (base > 0) {
        const p = this.clonar(modelos.get('supports-low')!);
        p.scale.set(1, base / 0.5, 1);
        p.position.set(cx, 0, cz);
        this.cena.add(p);
      }
    }
    // a bandeira no buraco
    const [hx, hz] = m.buraco;
    const h = relevo(this.buraco, hx, hz)[0];
    const flag = this.clonar(modelos.get('flag-red')!);
    flag.scale.setScalar(0.55);
    // a bandeira fica transparente quando a câmera chega perto (senão ela tapa a bola e o buraco)
    flag.traverse((n) => {
      const mesh = n as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mat = this.proprio((mesh.material as THREE.MeshStandardMaterial).clone());
      mat.transparent = true;
      mesh.material = mat;
      this.matsDaBandeira.push(mat);
    });
    this.bandeira.add(flag);
    this.bandeira.position.set(hx, h - 0.02, hz);
    this.cena.add(this.bandeira);
    // o fundo escuro do buraco, para ele se ler de longe
    const fundo = new THREE.Mesh(this.proprio(new THREE.CircleGeometry(RAIO_BURACO * 0.95, 20)), this.proprio(new THREE.MeshBasicMaterial({ color: '#1f3326' })));
    fundo.rotation.x = -Math.PI / 2;
    fundo.position.set(hx, h + 0.001, hz);
    this.cena.add(fundo);

    // umas árvores em volta, fora da pista, sempre nos mesmos lugares (uma conta, sem sorteio)
    if (arvores.length) {
      const raio = this.tamanho / 2 + 2.6;
      for (let k = 0; k < 14; k++) {
        const a = (k / 14) * Math.PI * 2 + 0.3;
        const r = raio + ((k * 7) % 5) * 0.45;
        const arv = this.clonar(arvores[k % arvores.length]);
        arv.scale.setScalar(1.4 + ((k * 3) % 4) * 0.25);
        arv.position.set(this.centro.x + Math.cos(a) * r, 0, this.centro.z + Math.sin(a) * r);
        arv.rotation.y = k * 1.7;
        this.cena.add(arv);
      }
    }

    // as paredes da física por cima do desenho, para conferir que batem (só no site de desenvolvimento, a pedido do teste)
    if (import.meta.env.DEV && (window as { golfe3dParedesDeTeste?: boolean }).golfe3dParedesDeTeste) {
      const mat = this.proprio(new THREE.LineBasicMaterial({ color: '#ff2050', depthTest: false }));
      for (const p of m.paredes) {
        const pts: THREE.Vector3[] = [];
        for (let i = 0; i <= p.length; i += 2) pts.push(new THREE.Vector3(p[i % p.length], 0.2, p[(i + 1) % p.length]));
        const l = new THREE.Line(this.proprio(new THREE.BufferGeometry().setFromPoints(pts)), mat);
        l.renderOrder = 5;
        this.cena.add(l);
      }
    }

    // a mira: pontinhos no chão
    const geoPonto = this.proprio(new THREE.CircleGeometry(0.012, 10));
    const matPonto = this.proprio(new THREE.MeshBasicMaterial({ color: '#fffbe8', transparent: true, opacity: 0.9, depthWrite: false }));
    // onde a tacada por cima cai: um anel no chão
    this.queda = new THREE.Mesh(this.proprio(new THREE.RingGeometry(0.035, 0.05, 24)), matPonto);
    this.queda.rotation.x = -Math.PI / 2;
    this.queda.renderOrder = 2;
    this.queda.visible = false;
    this.cena.add(this.queda);
    for (let i = 0; i < 16; i++) {
      const p = new THREE.Mesh(geoPonto, matPonto);
      p.rotation.x = -Math.PI / 2;
      p.renderOrder = 2;
      p.visible = false;
      this.mira.push(p);
      this.cena.add(p);
    }
  }

  /**
   * O CÉU (05/11/2026, relato dele: "o céu azul está simples demais"): a cúpula em degradê (azul em cima, o horizonte claro que é
   * a mesma cor da névoa, um brilho quente do lado do sol), o sol, nuvens fofas de bolas achatadas que andam devagar, e uma
   * roda de morros ao longe, que a névoa apaga no horizonte.
   */
  private montarCeu() {
    const sol = new THREE.Vector3(-0.45, 0.55, 0.7).normalize();
    const cupula = new THREE.Mesh(
      this.proprio(new THREE.SphereGeometry(70, 32, 16)),
      this.proprio(
        new THREE.ShaderMaterial({
          side: THREE.BackSide,
          depthWrite: false,
          fog: false,
          uniforms: { uAlto: { value: new THREE.Color(CEU_ALTO) }, uHorizonte: { value: new THREE.Color(CEU_HORIZONTE) }, uSol: { value: sol } },
          vertexShader: 'varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
          fragmentShader: `uniform vec3 uAlto; uniform vec3 uHorizonte; uniform vec3 uSol; varying vec3 vDir;
            void main() {
              float h = max(vDir.y, 0.0);
              vec3 c = mix(uHorizonte, uAlto, pow(h, 0.4));
              float s = max(dot(vDir, uSol), 0.0);
              c += vec3(1.0, 0.86, 0.6) * pow(s, 6.0) * 0.22;
              c = mix(c, vec3(1.0, 0.98, 0.9), smoothstep(0.9975, 0.999, s));
              gl_FragColor = vec4(c, 1.0);
              #include <colorspace_fragment>
            }`,
        }),
      ),
    );
    cupula.renderOrder = -10;
    cupula.position.copy(this.centro);
    cupula.frustumCulled = false;
    this.ceu = cupula;
    this.cena.add(cupula);

    // as nuvens: bolas achatadas, cada nuvem de 4 a 7, num anel alto que gira devagar
    const geoNuvem = this.proprio(new THREE.IcosahedronGeometry(1, 2));
    const matNuvem = this.proprio(new THREE.MeshLambertMaterial({ color: '#ffffff', emissive: '#c9d9ea', emissiveIntensity: 0.35, fog: false }));
    const r = sorteio(7);
    this.nuvens.position.copy(this.centro);
    for (let k = 0; k < 11; k++) {
      const nuvem = new THREE.Group();
      const n = 4 + Math.floor(r() * 4);
      for (let i = 0; i < n; i++) {
        const bola = new THREE.Mesh(geoNuvem, matNuvem);
        const t = 0.7 + r() * 0.8;
        bola.scale.set(t * 1.3, t * 0.75, t);
        bola.position.set((i - n / 2) * 1.1 + r() * 0.5, r() * 0.5, r() * 0.8);
        nuvem.add(bola);
      }
      const a = (k / 11) * Math.PI * 2 + r() * 0.4;
      const d = 34 + r() * 14;
      nuvem.position.set(Math.cos(a) * d, 4.5 + r() * 5, Math.sin(a) * d);
      nuvem.lookAt(0, nuvem.position.y, 0);
      nuvem.scale.setScalar(0.9 + r() * 0.9);
      this.nuvens.add(nuvem);
    }
    this.cena.add(this.nuvens);

    // os morros ao longe: meias bolas baixas, de verdes diferentes, sem sombra
    const geoMorro = this.proprio(new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2));
    const verdes = ['#7fae5e', '#6f9f52', '#8dba6a', '#5f8f4a'].map((c) => this.proprio(new THREE.MeshLambertMaterial({ color: c, flatShading: true })));
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2 + r() * 0.3;
      const d = 30 + r() * 10;
      const morro = new THREE.Mesh(geoMorro, verdes[k % verdes.length]);
      const largo = 8 + r() * 9;
      morro.scale.set(largo, 1.6 + r() * 2.6, largo * (0.6 + r() * 0.5));
      morro.position.set(this.centro.x + Math.cos(a) * d, -0.05, this.centro.z + Math.sin(a) * d);
      morro.rotation.y = r() * Math.PI;
      this.cena.add(morro);
    }
  }

  /**
   * O PARQUE em volta da pista: flores e tufos de grama rente às bordas, um laguinho, e mais longe os bancos, as lixeiras e as
   * barraquinhas de suco e de lanche, virados para a pista. Sempre nos mesmos lugares (o sorteio tem semente fixa por buraco), e
   * nunca em cima de uma casa da pista.
   */
  private montarParque(pecas: Map<PecaDoParque, GLTF>) {
    const casas = this.buraco.casas.map(([, x, z]) => [x, z] as const);
    const longeDaPista = (x: number, z: number, folga: number) => casas.every(([cx, cz]) => Math.max(Math.abs(x - cx), Math.abs(z - cz)) > 0.5 + folga);
    const r = sorteio(this.buraco.casas.length * 131 + this.buraco.par * 17 + casas[0][0] * 7 + casas[casas.length - 1][1] * 3);
    const [x0, z0, x1, z1] = montar(this.buraco).limites;
    const por = (nome: PecaDoParque, x: number, z: number, escala: number, giro: number) => {
      const g = pecas.get(nome);
      if (!g) return;
      const o = this.clonar(g);
      o.position.set(x, 0, z);
      o.scale.setScalar(escala);
      o.rotation.y = giro;
      this.cena.add(o);
    };
    // as flores e a grama, coladas na pista (até ~1,2 casa das bordas)
    for (let k = 0, postos = 0; k < 400 && postos < 46; k++) {
      const x = x0 - 1.2 + r() * (x1 - x0 + 2.4);
      const z = z0 - 1.2 + r() * (z1 - z0 + 2.4);
      if (!longeDaPista(x, z, 0.12) || longeDaPista(x, z, 1.3)) continue;
      por(postos % 3 === 0 ? 'flowers' : 'grass', x, z, 0.2 + r() * 0.16, r() * Math.PI * 2);
      postos++;
    }
    // o laguinho, num lado livre
    const agua = this.proprio(new THREE.MeshStandardMaterial({ color: '#6fb9d8', roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.92 }));
    const margem = this.proprio(new THREE.MeshStandardMaterial({ color: '#c9b48a', roughness: 1 }));
    for (let k = 0; k < 40; k++) {
      const lado = k % 2 ? 1 : -1;
      const x = (lado > 0 ? x1 + 2.2 : x0 - 2.2) + (r() - 0.5);
      const z = z0 + r() * (z1 - z0);
      if (!longeDaPista(x, z, 1.6)) continue;
      const borda = new THREE.Mesh(this.proprio(new THREE.CircleGeometry(1.25, 28)), margem);
      borda.rotation.x = -Math.PI / 2;
      borda.scale.set(1, 0.7, 1);
      borda.position.set(x, 0.004, z);
      const lago = new THREE.Mesh(this.proprio(new THREE.CircleGeometry(1.05, 28)), agua);
      lago.rotation.x = -Math.PI / 2;
      lago.scale.set(1, 0.7, 1);
      lago.position.set(x, 0.008, z);
      this.cena.add(borda, lago);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + r();
        por('grass', x + Math.cos(a) * 1.25, z + Math.sin(a) * 0.9, 0.25 + r() * 0.12, r() * 6);
      }
      break;
    }
    // os bancos, as lixeiras e as barraquinhas, um pouco mais longe, olhando para a pista
    const centro = this.centro;
    const olhar = (x: number, z: number) => Math.atan2(centro.x - x, centro.z - z);
    const itens: [PecaDoParque, number][] = [
      ['bench', 0.6],
      ['bench', 0.6],
      ['trash', 0.55],
      ['stall-drinks', 0.75],
      ['stall-food', 0.75],
      ['bench', 0.6],
      ['tree', 0.9],
      ['tree-large', 0.8],
      ['tree', 0.75],
      ['tree-large', 0.9],
    ];
    const postos: [number, number][] = [];
    for (const [nome, escala] of itens) {
      for (let k = 0; k < 60; k++) {
        const a = r() * Math.PI * 2;
        const d = this.tamanho / 2 + 1.4 + r() * 1.6;
        const x = centro.x + Math.cos(a) * d;
        const z = centro.z + Math.sin(a) * d;
        if (!longeDaPista(x, z, 0.7) || postos.some(([px, pz]) => Math.hypot(px - x, pz - z) < 1.3)) continue;
        postos.push([x, z]);
        por(nome, x, z, escala, nome.startsWith('tree') ? r() * 6 : olhar(x, z));
        break;
      }
    }
  }

  private montarCoelho(g: GLTF, clube: GLTF) {
    // o coelho com o NOSSO esqueleto: a cópia leva o esqueleto junto (como em cidades3d/cena.ts)
    const copia = copiarCoelho(g, { altura: ALTURA_DO_COELHO, sombras: this.sombras, cores: this.cores ?? CORES_DO_MASCOTE });
    this.proprio({ dispose: () => copia.descartar() });
    const corpo = copia.corpo;
    this.mixer = copia.mixer;
    this.acoes = copia.acoes;
    this.corpo = corpo;
    this.coelho.add(corpo);
    this.coelho.visible = false;
    // o taco: o grip na origem do grupo, a cabeça para baixo (−y)
    const c = this.clonar(clube);
    const cc = new THREE.Box3().setFromObject(c);
    const s = 0.26 / (cc.max.y - cc.min.y);
    c.scale.setScalar(s);
    c.position.y = -cc.max.y * s;
    this.taco.add(c);
    this.taco.visible = false;
    this.cena.add(this.coelho, this.taco);
    this.tocar('parado');
  }

  private tocar(nome: string) {
    if (this.tocando === nome) return;
    const nova = this.acoes.get(nome);
    if (!nova) return;
    const velha = this.acoes.get(this.tocando);
    nova.reset().play();
    if (velha) velha.crossFadeTo(nova, 0.2, false);
    this.tocando = nome;
  }

  /** A altura do que é alto na casa (o castelo, o moinho), para a câmera passar por cima; 0 nas outras. */
  private tetoEm(x: number, z: number): number {
    const cx = Math.floor(x + 0.5);
    const cz = Math.floor(z + 0.5);
    const casa = this.buraco.casas.find(([, a, b]) => a === cx && b === cz);
    if (!casa) return 0;
    const alto = TETO[casa[0]] ?? 0;
    return alto ? casa[4] + alto : 0;
  }

  private altura(x: number, z: number) {
    return relevo(this.buraco, x, z)[0];
  }

  private porBola(bola: THREE.Mesh, sombra: THREE.Mesh, x: number, z: number, dentro: boolean, y: number | null = null) {
    const h = this.altura(x, z);
    bola.visible = !dentro;
    sombra.visible = !dentro && !this.sombras;
    // no ar, a bola sobe; a sombra fica no chão, menor quanto mais alto
    const alto = y === null ? 0 : Math.max(0, y - h);
    bola.position.set(x, h + alto + RAIO_BOLA, z);
    sombra.position.set(x + 0.006, h + 0.002, z + 0.006);
    sombra.scale.setScalar(1 / (1 + alto * 2.5));
  }

  /** Um quadro: a página chama a cada requestAnimationFrame. Sem foco ou escondida, não desenha. */
  quadro(q: QuadroDoGolfe) {
    if (this.morta) return;
    this.relogio.update();
    if (document.hidden || !document.hasFocus()) return;
    const dt = Math.min(0.05, this.relogio.getDelta());
    const agora = performance.now();

    // as bolas
    if (q.minha) this.porBola(this.bolaMinha, this.sombraMinha, q.minha.x, q.minha.z, q.minha.dentro, q.minha.y);
    else {
      this.bolaMinha.visible = false;
      this.sombraMinha.visible = false;
    }
    while (this.outras.length < q.outras.length) {
      const bola = new THREE.Mesh(this.bolaMinha.geometry, this.proprio(new THREE.MeshStandardMaterial({ roughness: 0.5 })));
      bola.castShadow = this.sombras;
      const sombra = this.sombraRedonda(this.sombraMinha.geometry);
      this.cena.add(bola, sombra);
      this.outras.push({ bola, sombra });
    }
    this.outras.forEach((o, i) => {
      const b = q.outras[i];
      if (!b) {
        o.bola.visible = false;
        o.sombra.visible = false;
        return;
      }
      (o.bola.material as THREE.MeshStandardMaterial).color.set(b.cor);
      this.porBola(o.bola, o.sombra, b.x, b.z, b.dentro, b.y);
    });

    // a mira: os pontinhos na direção da tacada, mais longe com mais força, seguindo o chão
    const parada = q.minha && !q.minha.andando && !q.minha.dentro;
    const mostrarMira = parada && q.mira && !q.deCima;
    for (let i = 0; i < this.mira.length; i++) {
      const p = this.mira[i];
      if (!mostrarMira || !q.mira || !q.minha) {
        p.visible = false;
        continue;
      }
      const arco = q.mira.arco;
      if (arco) {
        // por cima: os pontinhos no arco de verdade, até onde a bola toca o chão
        const k = arco.length ? Math.round((i / (this.mira.length - 1)) * (arco.length - 1)) : -1;
        if (k < 0) {
          p.visible = false;
          continue;
        }
        p.visible = true;
        p.position.set(arco[k][0], arco[k][1] + RAIO_BOLA, arco[k][2]);
        // no ar, o pontinho olha para a câmera (deitado, de trás, ele some)
        p.quaternion.copy(this.camera.quaternion);
        p.scale.setScalar(1.1 - (i / this.mira.length) * 0.3);
        continue;
      }
      p.rotation.set(-Math.PI / 2, 0, 0);
      const alcance = 0.3 + q.mira.forca * 1.3;
      const d = 0.06 + (i / (this.mira.length - 1)) * alcance;
      const x = q.minha.x + q.mira.ux * d;
      const z = q.minha.z + q.mira.uz * d;
      p.visible = true;
      p.position.set(x, this.altura(x, z) + 0.004, z);
      p.scale.setScalar(1 - (i / this.mira.length) * 0.5);
    }

    const fim = mostrarMira && q.mira?.arco?.length ? q.mira.arco[q.mira.arco.length - 1] : null;
    if (this.queda) {
      this.queda.visible = !!fim;
      if (fim) this.queda.position.set(fim[0], this.altura(fim[0], fim[2]) + 0.005, fim[2]);
    }

    this.atualizarCoelho(q, dt, agora);

    // as pás do moinho giram (só o desenho: elas não chegam ao chão)
    if (!this.calmo) for (const p of this.pas) p.rotation.z += dt * 1.2;
    // as nuvens andam devagar
    if (!this.calmo) this.nuvens.rotation.y += dt * 0.006;

    this.atualizarCamera(q, dt);
    this.mixer?.update(this.calmo ? 0 : dt);
    this.renderer.render(this.cena, this.camera);
  }

  private atualizarCoelho(q: QuadroDoGolfe, dt: number, agora: number) {
    if (!this.corpo || !q.minha) {
      this.coelho.visible = false;
      this.taco.visible = false;
      this.sombraDoCoelho.visible = false;
      return;
    }
    const b = q.minha;
    // ao lado da bola parada, à esquerda de quem olha para o alvo, virado para a bola (como quem dá a tacada com a destra)
    const ux = q.rumo.ux;
    const uz = q.rumo.uz;
    const fx = -uz;
    const fz = ux;
    if (!b.andando) {
      const hx = b.dentro ? montar(this.buraco).buraco[0] : b.x;
      const hz = b.dentro ? montar(this.buraco).buraco[1] : b.z;
      this.coelhoAlvo.set(hx - fx * AO_LADO, 0, hz - fz * AO_LADO);
    }
    const primeiraVez = !this.coelhoPronto;
    if (primeiraVez) {
      this.coelho.position.copy(this.coelhoAlvo);
      this.coelhoPronto = true;
    }
    const falta = new THREE.Vector3().subVectors(this.coelhoAlvo, this.coelho.position).setY(0);
    const longe = falta.length();
    const andando = longe > 0.03;
    if (andando) {
      // anda; de longe, mais depressa (para chegar à bola logo)
      const passo = Math.min(longe, dt * Math.max(1.6, longe * 2));
      this.coelho.position.addScaledVector(falta.normalize(), passo);
      this.coelhoRumo = Math.atan2(falta.x, falta.z);
    } else if (!b.andando) {
      this.coelhoRumo = b.dentro ? Math.atan2(this.camera.position.x - this.coelho.position.x, this.camera.position.z - this.coelho.position.z) : Math.atan2(fx, fz);
    }
    const h = this.altura(b.x, b.z);
    this.coelho.position.y = h;
    let d = this.coelhoRumo - this.corpo.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.corpo.rotation.y += primeiraVez ? d : d * Math.min(1, dt * 10);
    this.coelho.visible = true;
    this.sombraDoCoelho.visible = !this.sombras;
    this.sombraDoCoelho.position.set(this.coelho.position.x, h + 0.002, this.coelho.position.z);
    this.tocar(this.calmo ? 'parado' : andando ? 'andando' : b.dentro ? 'falando' : 'parado');

    // o taco: das mãos até atrás da bola; balança para trás com a força e vai para a frente na tacada
    if (q.tacadas !== this.balanco.ultimas) {
      this.balanco.ultimas = q.tacadas;
      this.balanco.inicio = agora;
    }
    const comTaco = !andando && !b.dentro;
    this.taco.visible = comTaco;
    if (!comTaco) return;
    const maos = new THREE.Vector3(this.coelho.position.x + fx * 0.075, h + 0.22, this.coelho.position.z + fz * 0.075);
    const cabeca = new THREE.Vector3(b.x - ux * 0.035, h + 0.012, b.z - uz * 0.035);
    if (b.andando) cabeca.set(this.coelho.position.x + fx * AO_LADO - ux * 0.035, h + 0.012, this.coelho.position.z + fz * AO_LADO - uz * 0.035);
    const dir = new THREE.Vector3().subVectors(cabeca, maos);
    const comprimento = dir.length();
    dir.normalize();
    this.taco.position.copy(maos);
    this.taco.scale.setScalar(comprimento / 0.26);
    const qBase = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
    // o giro do balanço é em volta do eixo para onde o coelho olha: para trás é −, para a frente é +
    let angulo = 0;
    const t = agora - this.balanco.inicio;
    if (this.balanco.inicio >= 0 && t < 650 && !this.calmo) angulo = t < 110 ? -0.9 + (t / 110) * 1.5 : 0.6 * (1 - (t - 110) / 540);
    else if (q.mira && !b.andando) angulo = -q.mira.forca * 1.1;
    const qBalanco = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(fx, 0, fz), angulo);
    this.taco.quaternion.copy(qBalanco.multiply(qBase));
  }

  private atualizarCamera(q: QuadroDoGolfe, dt: number) {
    const pos = new THREE.Vector3();
    const alvo = new THREE.Vector3();
    // quem joga segue a própria bola; quem já acertou vê o buraco inteiro (as bolas de todos); quem só assiste segue a
    // primeira bola que ainda joga
    const seguida = q.minha ? (q.minha.dentro ? null : q.minha) : (q.outras.find((o) => !o.dentro) ?? null);
    if (q.deCima || !seguida) {
      // o buraco inteiro, de cima e um pouco de lado
      // o buraco inteiro, de cima e de lado (a 58° do chão), olhando da saída para o buraco, na distância em que ele cabe
      const m = montar(this.buraco);
      let vx = this.buraco.inicio[0] - m.buraco[0];
      let vz = this.buraco.inicio[1] - m.buraco[1];
      const l = Math.hypot(vx, vz) || 1;
      vx /= l;
      vz /= l;
      // as medidas do buraco ao longo da vista (fundura) e de lado (largura)
      const [x0, z0, x1, z1] = m.limites;
      let meiaLargura = 0;
      let meiaFundura = 0;
      for (const [x, z] of [
        [x0, z0],
        [x1, z0],
        [x0, z1],
        [x1, z1],
      ]) {
        const dx = x - this.centro.x;
        const dz = z - this.centro.z;
        meiaFundura = Math.max(meiaFundura, Math.abs(dx * vx + dz * vz));
        meiaLargura = Math.max(meiaLargura, Math.abs(dx * vz - dz * vx));
      }
      const tanV = Math.tan((this.camera.fov * Math.PI) / 360);
      const tanH = tanV * this.camera.aspect;
      const inclinacao = (58 * Math.PI) / 180;
      const d = Math.max((meiaLargura + 0.2) / tanH, (meiaFundura * Math.sin(inclinacao) + 0.5) / tanV) * 1.05;
      alvo.copy(this.centro);
      pos.set(this.centro.x + vx * d * Math.cos(inclinacao), d * Math.sin(inclinacao), this.centro.z + vz * d * Math.cos(inclinacao));
    } else {
      const h = this.altura(seguida.x, seguida.z);
      alvo.set(seguida.x + q.rumo.ux * 0.55, h + 0.05, seguida.z + q.rumo.uz * 0.55);
      // a câmera não entra no castelo nem no moinho: chega mais perto da bola, e só sem lugar passa por cima deles
      for (const dist of [1.05, 0.85, 0.65, 0.45]) {
        pos.set(seguida.x - q.rumo.ux * dist, h + 0.2 + dist / 3, seguida.z - q.rumo.uz * dist);
        if (this.tetoEm(pos.x, pos.z) === 0) break;
      }
      const teto = this.tetoEm(pos.x, pos.z);
      if (teto > pos.y - 0.15) pos.y = teto + 0.15;
    }
    // para a foto de conferência (só no site de desenvolvimento): a câmera onde o teste mandar
    const teste = import.meta.env.DEV ? (window as { golfe3dCameraDeTeste?: { pos: [number, number, number]; alvo: [number, number, number] } }).golfe3dCameraDeTeste : undefined;
    if (teste) {
      pos.set(...teste.pos);
      alvo.set(...teste.alvo);
    }
    const k = this.primeiro || teste || this.calmo ? 1 : Math.min(1, dt * (q.deCima ? 2.2 : 4));
    this.primeiro = false;
    this.camPos.lerp(pos, k);
    this.camAlvo.lerp(alvo, Math.min(1, k * 1.6));
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camAlvo);
    const perto = Math.hypot(this.camera.position.x - this.bandeira.position.x, this.camera.position.z - this.bandeira.position.z);
    const opaca = Math.max(0.15, Math.min(1, (perto - 0.5) / 0.9));
    for (const m of this.matsDaBandeira) {
      m.opacity = opaca;
      m.depthWrite = opaca > 0.99;
    }
  }

  destruir() {
    this.morta = true;
    this.observador.disconnect();
    this.mixer?.stopAllAction();
    // a geometria e as texturas dos modelos ficam no cache (servem ao próximo buraco); as nossas vão embora
    for (const d of this.proprios) d.dispose();
    this.renderer.forceContextLoss();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

/** A grama cortada: faixas claras e escuras (a marca do cortador) com o pontilhado das folhas, numa textura de 128 que se repete. */
function texturaDaGrama(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#8cc06c';
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#82b764';
  g.fillRect(0, 0, 128, 64);
  const r = sorteio(3);
  for (let i = 0; i < 900; i++) {
    const claro = r() < 0.5;
    g.fillStyle = claro ? 'rgba(186,222,140,0.55)' : 'rgba(84,136,66,0.45)';
    g.fillRect(Math.floor(r() * 128), Math.floor(r() * 128), 1, 1 + Math.floor(r() * 2));
  }
  return c;
}
