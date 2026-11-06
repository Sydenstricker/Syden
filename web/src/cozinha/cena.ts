import * as THREE from 'three';
import { copiarCoelho, minhasCoresDoCoelho, type CoelhoCopiado } from '../coelho3d';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { alvo, assinatura, progresso, type Coisa, type Cozinha, type Estacao } from './cozinha';
import { IDS_DAS_RECEITAS, INGREDIENTES, RECEITAS, confere, itemDaChave, type IdDaReceita, type Ingrediente, type Item } from './receitas';

/**
 * A COZINHA EM 3D (05/11/2026). Só a TELA: as regras moram em cozinha.ts, e esta cena só lê a cozinha a cada quadro. Os
 * móveis, a comida e a louça são do Restaurant Bits da KayKit (CC0, web/public/cozinha/License.txt; o crédito nos termos,
 * seção 10); o cozinheiro é o NOSSO coelho 3D, com o nosso esqueleto (o mesmo das Cidades à venda). A salsicha, o ovo, o
 * arroz, o peixe, o cachorro-quente e o sushi são do Food Kit da Kenney (CC0, web/public/cozinha/License-kenney-food.txt),
 * em web/public/cozinha/kenney/, com a textura deles (um material por kit). O bacon, o bife e o ovo (cru, frito e queimado)
 * são do pacote de comida da Quaternius (CC0, web/public/cozinha/License-quaternius-food.txt), convertidos de OBJ para GLB por
 * e2e/3D/cozinha-quaternius/converter.py, em web/public/cozinha/quaternius/: cores chapadas, sem textura, um material por cor.
 *
 * - A câmera é fixa, de cima e da frente, mostrando a cozinha inteira (os jogos de cozinha de festa são assim: tudo à vista).
 * - O que está em cima de cada estação e na mão do coelho é montado com os modelos do kit pelo ESTADO do item: a carne crua,
 *   no ponto ou queimada; a alface inteira ou picada; a massa em bola, aberta com as coberturas, assada (tingida) ou
 *   queimada. O prato monta o lanche em camadas, do pão de baixo ao de cima, como o desenho do pedido.
 * - A estação que o coelho tem à frente acende; a tábua tem a barrinha do tempo, e o fogo, o MEDIDOR DO PONTO: a régua cru,
 *   ponto (verde) e queimando (vermelha), com a agulha andando nela; passando do ponto sobe fumaça clara, e queimado, escura.
 * - Os desenhos dos pedidos (os ícones da fila) saem destes mesmos modelos, desenhados uma vez ao abrir.
 * - Sem foco na janela, nada é desenhado nem anda (o uso principal é com um jogo aberto); as sombras de verdade só com
 *   "Sombras" ligado em Gráficos.
 */

const ALTURA_DO_COELHO = 2;
/** A altura do tampo onde as coisas ficam, por tipo de estação. */
const TOPO: Record<Estacao['tipo'], number> = {
  caixote: 0.95,
  balcao: 1.0,
  tabua: 1.15,
  fogao: 1.2,
  forno: 0.62,
  pratos: 1.0,
  sorvete: 1.35,
  lixeira: 1.0,
  entrega: 1.0,
};

const MODELOS = [
  'floor_kitchen',
  'floor_kitchen_small',
  'wall',
  'wall_orderwindow',
  'kitchencounter_straight_A',
  'kitchencounter_straight_A_backsplash',
  'kitchencounter_straight_B',
  'cuttingboard',
  'stove_single',
  'pan_A',
  'pizza_oven',
  'crate_buns',
  'crate_steak',
  'crate_cheese',
  'crate_lettuce',
  'crate_tomatoes',
  'crate_dough',
  'crate_pepperoni',
  'crate_mushrooms',
  'crate',
  'dishrack_plates',
  'icecream_cone_stacked',
  'icecream_container',
  'icecream_container_icecream_chocolate',
  'icecream_container_icecream_strawberry',
  'icecream_container_icecream_vanilla',
  'plate',
  'food_ingredient_bun',
  'food_ingredient_bun_bottom',
  'food_ingredient_bun_top',
  'food_ingredient_burger_uncooked',
  'food_ingredient_burger_cooked',
  'food_ingredient_burger_trash',
  'food_ingredient_cheese',
  'food_ingredient_cheese_chopped',
  'food_ingredient_cheese_slice',
  'food_ingredient_cheese_grated',
  'food_ingredient_lettuce',
  'food_ingredient_lettuce_chopped',
  'food_ingredient_lettuce_slice',
  'food_ingredient_tomato',
  'food_ingredient_tomato_slices',
  'food_ingredient_tomato_slice',
  'food_ingredient_tomato_sauce',
  'food_ingredient_pepperoni',
  'food_ingredient_pepperoni_chopped',
  'food_ingredient_pepperoni_slices',
  'food_ingredient_mushroom',
  'food_ingredient_mushroom_chopped',
  'food_ingredient_mushroom_pieces',
  'food_ingredient_dough',
  'food_ingredient_dough_base',
  'icecream_cone',
  'food_icecream_cone_chocolate',
  'food_icecream_cone_strawberry',
  'food_icecream_cone_vanilla',
] as const;
/** Os do Food Kit da Kenney (GLB, com a textura ao lado, em kenney/Textures/). */
const MODELOS_KENNEY = ['hot-dog-raw', 'meat-sausage', 'hot-dog', 'egg', 'egg-cooked', 'fish', 'meat-raw', 'rice-ball', 'bag-flat', 'sushi-salmon'] as const;
/** Os do pacote de comida da Quaternius (GLB sem textura, em quaternius/). */
const MODELOS_QUATERNIUS = ['Bacon_Uncooked', 'Bacon_Cooked', 'Bacon_Burned', 'Steak', 'Steak_burned', 'Egg_Fried', 'Egg_Burned'] as const;
type Modelo = (typeof MODELOS)[number] | (typeof MODELOS_KENNEY)[number] | (typeof MODELOS_QUATERNIUS)[number];

/** O prato pronto que tem um modelo inteiro no kit (no lugar das partes lado a lado). */
const PRONTOS: Partial<Record<IdDaReceita, Modelo>> = { 'cachorro-quente': 'hot-dog', sushi: 'sushi-salmon' };
/**
 * O ingrediente do Food Kit e da Quaternius: cru, picado (o peixe), cozido (com a cor, se for tingido) e queimado (o modelo
 * queimado do pacote; sem ele, o cozido escurecido).
 */
const KENNEY: Partial<Record<Ingrediente, { cru: [Modelo, number]; picado?: [Modelo, number, string?]; cozido: [Modelo, number, string?]; queimado?: [Modelo, number] }>> = {
  salsicha: { cru: ['hot-dog-raw', 0.62], cozido: ['meat-sausage', 0.64] },
  ovo: { cru: ['egg', 0.3], cozido: ['Egg_Fried', 0.7], queimado: ['Egg_Burned', 0.7] },
  bacon: { cru: ['Bacon_Uncooked', 0.8], cozido: ['Bacon_Cooked', 0.8], queimado: ['Bacon_Burned', 0.8] },
  bife: { cru: ['Steak', 0.7], cozido: ['Steak', 0.7], queimado: ['Steak_burned', 0.7] },
  arroz: { cru: ['bag-flat', 0.6], cozido: ['rice-ball', 0.4] },
  peixe: { cru: ['fish', 0.72], picado: ['meat-raw', 0.55, '#f6a07c'], cozido: ['fish', 0.8, '#e8a860'] },
};

const CAIXOTE: Record<Ingrediente, Modelo | null> = {
  pao: 'crate_buns',
  carne: 'crate_steak',
  queijo: 'crate_cheese',
  alface: 'crate_lettuce',
  tomate: 'crate_tomatoes',
  massa: 'crate_dough',
  calabresa: 'crate_pepperoni',
  cogumelo: 'crate_mushrooms',
  casquinha: null,
  salsicha: null,
  ovo: null,
  arroz: null,
  peixe: null,
  bacon: null,
  bife: null,
};
/** O bife cru: o mesmo modelo, com a carne vermelha e a gordura rosada (as cores do pacote pelo nome do material). */
const BIFE_CRU: Record<string, string> = { DarkRed: '#b8423a', White: '#f2d6cf' };
const SABOR_DO_KIT: Record<string, string> = { chocolate: 'chocolate', morango: 'strawberry', baunilha: 'vanilla' };
/** O ingrediente inteiro, picado sozinho, e picado no prato (a fatia do lanche) ou na pizza. */
const VISUAL: Partial<Record<Ingrediente, { cru: Modelo; picado: Modelo; noPrato: Modelo; naPizza?: Modelo }>> = {
  queijo: { cru: 'food_ingredient_cheese', picado: 'food_ingredient_cheese_chopped', noPrato: 'food_ingredient_cheese_slice', naPizza: 'food_ingredient_cheese_grated' },
  alface: { cru: 'food_ingredient_lettuce', picado: 'food_ingredient_lettuce_chopped', noPrato: 'food_ingredient_lettuce_slice' },
  tomate: { cru: 'food_ingredient_tomato', picado: 'food_ingredient_tomato_slices', noPrato: 'food_ingredient_tomato_slice', naPizza: 'food_ingredient_tomato_sauce' },
  calabresa: { cru: 'food_ingredient_pepperoni', picado: 'food_ingredient_pepperoni_chopped', noPrato: 'food_ingredient_pepperoni_chopped', naPizza: 'food_ingredient_pepperoni_slices' },
  cogumelo: { cru: 'food_ingredient_mushroom', picado: 'food_ingredient_mushroom_chopped', noPrato: 'food_ingredient_mushroom_chopped', naPizza: 'food_ingredient_mushroom_pieces' },
};
/** A ordem das camadas do lanche, de baixo para cima (o pão de cima é o último). */
const CAMADAS: Ingrediente[] = ['carne', 'bacon', 'salsicha', 'ovo', 'queijo', 'alface', 'tomate', 'calabresa', 'cogumelo'];
const ORDEM_DA_PIZZA: Ingrediente[] = ['tomate', 'queijo', 'calabresa', 'cogumelo'];

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

/** Os textos do desenho de cada pedido e de cada ingrediente (a fila na tela). */
export interface Icones {
  receitas: Record<string, string>;
  ingredientes: Record<string, string>;
}

export class CenaDaCozinha {
  private renderer: THREE.WebGLRenderer;
  private cena = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(36, 1.6, 0.1, 200);
  private modelos = new Map<Modelo, THREE.Object3D>();
  /** Um material por kit (a KayKit e a Kenney têm cada uma a sua textura). */
  private materiais = new Map<string, THREE.Material>();
  private tingidos = new Map<string, THREE.Material>();
  private coelhoGltf: GLTF | null = null;
  private copiaDoCoelho: CoelhoCopiado | null = null;
  private coelho: { raiz: THREE.Group; corpo: THREE.Object3D; mixer: THREE.AnimationMixer; acoes: Map<string, THREE.AnimationAction>; tocando: string; mao: THREE.Group; sinal: string } | null = null;
  private emCima = new Map<number, { grupo: THREE.Group; sinal: string }>();
  private barras = new Map<number, { grupo: THREE.Group; faixas: THREE.Mesh[]; agulha: THREE.Mesh }>();
  private fumacas = new Map<number, THREE.Group>();
  private matFumaca: THREE.MeshBasicMaterial[] = [];
  private geoFumaca: THREE.SphereGeometry | null = null;
  private luz: THREE.Mesh;
  private pegaveis: THREE.Object3D[] = [];
  private cozinha: Cozinha | null = null;
  private relogio = new THREE.Timer();
  private observador: ResizeObserver;
  private sombras: boolean;
  private calmo: boolean;
  private raio = new THREE.Raycaster();
  private apertou: { x: number; y: number } | null = null;
  private descartaveis: { dispose(): void }[] = [];
  private morta = false;
  private distancia = 1;
  /** A cada quadro com foco, antes de desenhar: a tela anda a cozinha (o teclado, o piloto, o relógio). */
  aoQuadro: ((dt: number) => void) | null = null;

  constructor(
    private caixa: HTMLElement,
    private aoClicar: (estacao: number) => void,
    private base = `${import.meta.env.BASE_URL}`,
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
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
    canvas.className = 'cozinha-3d-tela';
    caixa.appendChild(canvas);
    this.observador = new ResizeObserver(() => this.medir());
    this.observador.observe(caixa);
    canvas.addEventListener('pointerdown', this.aoApertar);
    canvas.addEventListener('pointerup', this.aoSoltar);
    canvas.addEventListener('pointermove', this.aoPassar);
    // a luz da estação à frente do coelho
    const luzMat = new THREE.MeshBasicMaterial({ color: '#fff4c8', transparent: true, opacity: 0.35, depthWrite: false });
    const luzGeo = new THREE.PlaneGeometry(1.86, 1.86);
    this.luz = new THREE.Mesh(luzGeo, luzMat);
    this.luz.rotation.x = -Math.PI / 2;
    this.luz.visible = false;
    this.luz.renderOrder = 2;
    this.descartaveis.push(luzMat, luzGeo);
    this.cena.add(this.luz);
  }

  /** Carrega os modelos, monta a cozinha e desenha os ícones dos pedidos. Rejeita se algo falhar. */
  async montar(): Promise<Icones> {
    const [kaykit, kenney, quaternius, coelho] = await Promise.all([
      Promise.all(MODELOS.map((m) => carregar(`${this.base}cozinha/${m}.gltf`).then((g) => [m as Modelo, g, 'kaykit'] as const))),
      Promise.all(MODELOS_KENNEY.map((m) => carregar(`${this.base}cozinha/kenney/${m}.glb`).then((g) => [m as Modelo, g, 'kenney'] as const))),
      Promise.all(MODELOS_QUATERNIUS.map((m) => carregar(`${this.base}cozinha/quaternius/${m}.glb`).then((g) => [m as Modelo, g] as const))),
      carregar(`${this.base}cidades3d/coelho-animado.glb`),
    ]);
    if (this.morta) return { receitas: {}, ingredientes: {} };
    // os da Quaternius têm um material por cor, sem textura; as cores vêm mais escuras que as da KayKit (o branco do ovo saía
    // cinza), e por isso clareiam uma vez aqui, para os três pacotes casarem na mesma luz
    const clareados = new Set<THREE.Material>();
    for (const [m, g] of quaternius) {
      g.scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        for (const mat of (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as THREE.MeshStandardMaterial[]) {
          if (clareados.has(mat)) continue;
          clareados.add(mat);
          mat.color.multiplyScalar(1.75);
          mat.roughness = 0.85;
          mat.metalness = 0;
        }
      });
      this.modelos.set(m, g.scene);
    }
    for (const [m, g, kit] of [...kaykit, ...kenney]) {
      // os modelos de cada kit usam o mesmo material e a mesma textura: um só por kit, para a placa guardar a imagem uma vez
      g.scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        if (!this.materiais.has(kit)) this.materiais.set(kit, mesh.material as THREE.Material);
        mesh.material = this.materiais.get(kit)!;
      });
      this.modelos.set(m, g.scene);
    }
    this.coelhoGltf = coelho;
    this.montarFixo();
    const icones = this.desenharIcones();
    this.medir();
    this.renderer.setAnimationLoop(this.desenhar);
    return icones;
  }

  /** A cozinha que a cena desenha (o mesmo objeto, lido a cada quadro). */
  usar(k: Cozinha) {
    this.cozinha = k;
  }

  private medir() {
    const w = Math.max(1, this.caixa.clientWidth);
    const h = Math.max(1, this.caixa.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // longe o bastante para caber a cozinha inteira, na largura e na altura
    this.distancia = Math.max(1.1, 1.9 / this.camera.aspect);
    this.camera.updateProjectionMatrix();
  }

  // ---------- os modelos ----------

  /** A cópia crua do modelo (a origem dele, sem mexer). */
  private bruto(m: Modelo): THREE.Object3D {
    const o = this.modelos.get(m)!.clone(true);
    o.traverse((x) => {
      const mesh = x as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = this.sombras;
        mesh.receiveShadow = this.sombras;
      }
    });
    return o;
  }

  /** O modelo com a base no chão e o meio no centro, com `largura` no maior lado do chão (sem largura, o tamanho dele). */
  private copia(m: Modelo, largura?: number): THREE.Group {
    const o = this.bruto(m);
    // o peixe do kit vem nadando (de pé): no prato e no fogão, deitado de lado
    if (m === 'fish') o.rotation.set(0, Math.PI / 2, Math.PI / 2);
    const caixa = new THREE.Box3().setFromObject(o);
    const tam = caixa.getSize(new THREE.Vector3());
    const centro = caixa.getCenter(new THREE.Vector3());
    o.position.set(-centro.x, -caixa.min.y, -centro.z);
    const raiz = new THREE.Group();
    raiz.add(o);
    if (largura) raiz.scale.setScalar(largura / Math.max(tam.x, tam.z, 1e-6));
    raiz.userData.altura = tam.y * raiz.scale.y;
    return raiz;
  }

  /** As cores trocadas pelo nome do material (o bife cru). */
  private recolorir(o: THREE.Object3D, cores: Record<string, string>) {
    o.traverse((x) => {
      const mesh = x as THREE.Mesh;
      if (!mesh.isMesh) return;
      const troca = (base: THREE.Material) => {
        const cor = cores[base.name];
        if (!cor) return base;
        const k = `${base.uuid}:${cor}`;
        let m = this.tingidos.get(k);
        if (!m) {
          const novo = (base as THREE.MeshStandardMaterial).clone();
          novo.color = new THREE.Color(cor);
          m = novo;
          this.tingidos.set(k, m);
        }
        return m;
      };
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(troca) : troca(mesh.material);
    });
  }

  /** O mesmo material, tingido (a massa assada e a queimada). */
  private tingir(o: THREE.Object3D, cor: string) {
    o.traverse((x) => {
      const mesh = x as THREE.Mesh;
      if (!mesh.isMesh) return;
      const base = mesh.material as THREE.MeshStandardMaterial;
      const k = `${base.uuid}:${cor}`;
      let m = this.tingidos.get(k);
      if (!m) {
        const novo = base.clone();
        novo.color = new THREE.Color(cor);
        m = novo;
        this.tingidos.set(k, m);
      }
      mesh.material = m;
    });
  }

  // ---------- a cozinha fixa ----------

  private montarFixo() {
    const c = this.cena;
    c.background = new THREE.Color('#f3e2c7');
    const ceu = new THREE.HemisphereLight('#fff6ea', '#a08060', 1.7);
    c.add(ceu);
    const sol = new THREE.DirectionalLight('#fff1d6', 2.1);
    sol.position.set(-6, 14, 9);
    if (this.sombras) {
      sol.castShadow = true;
      sol.shadow.mapSize.set(2048, 2048);
      const s = sol.shadow.camera;
      s.left = -14;
      s.right = 14;
      s.top = 10;
      s.bottom = -10;
      s.near = 1;
      s.far = 40;
      sol.shadow.bias = -0.0008;
      sol.shadow.normalBias = 0.02;
    }
    c.add(sol);

    // o chão de ladrilho
    for (const x of [-10, -6, -2, 2, 6, 10])
      for (const z of [-3, 1]) {
        const p = this.bruto('floor_kitchen');
        p.position.set(x, 0, z);
        c.add(p);
      }
    for (let x = -11; x <= 11; x += 2) {
      const p = this.bruto('floor_kitchen_small');
      p.position.set(x, 0, 4);
      c.add(p);
    }
    // a parede do fundo, com a janela de entrega bem atrás da janela (a estação)
    const k0 = this.cozinha;
    const entrega = k0?.estacoes.find((e) => e.tipo === 'entrega');
    const xJanela = entrega?.x ?? -1;
    const paredes: [Modelo, number][] = [
      ['wall', xJanela - 12],
      ['wall', xJanela - 8],
      ['wall', xJanela - 4],
      ['wall_orderwindow', xJanela],
      ['wall', xJanela + 4],
      ['wall', xJanela + 8],
      ['wall', xJanela + 12],
    ];
    for (const [m, x] of paredes) {
      const p = this.copia(m);
      p.position.set(x, 0, -5 - 0.28);
      c.add(p);
    }

    if (!this.cozinha) return;
    for (const e of this.cozinha.estacoes) c.add(this.montarEstacao(e));
    this.coelho = this.novoCoelho();
  }

  /** O rumo da estação: a frente dela olha para o chão livre. */
  private rumoDa(e: Estacao) {
    if (e.l === 0) return 0;
    if (e.l === 4) return Math.PI;
    return e.c === 0 ? Math.PI / 2 : -Math.PI / 2;
  }

  private montarEstacao(e: Estacao): THREE.Group {
    const g = new THREE.Group();
    g.position.set(e.x, 0, e.z);
    const giro = new THREE.Group();
    giro.rotation.y = this.rumoDa(e);
    g.add(giro);
    const balcao = (m: Modelo = e.l === 0 ? 'kitchencounter_straight_A_backsplash' : 'kitchencounter_straight_A') => {
      const b = this.copia(m);
      giro.add(b);
      return b;
    };
    const emCima = (m: Modelo, largura?: number, y = 1, dx = 0, dz = 0) => {
      const o = this.copia(m, largura);
      o.position.set(dx, y, dz);
      giro.add(o);
      return o;
    };
    switch (e.tipo) {
      case 'caixote': {
        if (e.ing === 'casquinha') {
          balcao();
          emCima('icecream_cone_stacked', undefined, 1, -0.4, 0.1);
          emCima('icecream_cone_stacked', undefined, 1, 0.4, 0.1);
          emCima('icecream_cone_stacked', undefined, 1, 0, -0.35);
        } else {
          const m = CAIXOTE[e.ing!];
          if (m) giro.add(this.copia(m, 1.9));
          const kn = KENNEY[e.ing!];
          if (!m && kn) {
            // o caixote vazio da KayKit com o ingrediente do Food Kit em cima
            const cx = this.copia('crate', 1.9);
            giro.add(cx);
            const y = cx.userData.altura * 0.82;
            const [modelo, largura] = kn.cru;
            for (const [dx, dz, giroY] of [
              [-0.42, 0.18, 0.5],
              [0.4, 0.2, -0.7],
              [0, -0.3, 1.6],
            ] as const) {
              const o = emCima(modelo, Math.max(0.5, largura * 1.15), y, dx, dz);
              o.rotation.y = giroY;
              if (e.ing === 'bife') this.recolorir(o, BIFE_CRU);
            }
          }
        }
        break;
      }
      case 'lixeira': {
        const cx = this.copia('crate', 1.6);
        this.tingir(cx, '#8d9894');
        giro.add(cx);
        break;
      }
      case 'balcao':
        balcao();
        break;
      case 'entrega': {
        balcao('kitchencounter_straight_B');
        // a campainha do balcão, feita aqui
        const ouro = new THREE.MeshStandardMaterial({ color: '#e8b64a', metalness: 0.6, roughness: 0.3 });
        const domo = new THREE.Mesh(new THREE.SphereGeometry(0.18, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), ouro);
        const pe = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.05, 20), new THREE.MeshStandardMaterial({ color: '#5a4636' }));
        pe.position.set(0.62, 1.02, 0.45);
        domo.position.set(0.62, 1.045, 0.45);
        giro.add(pe, domo);
        for (const m of [domo, pe]) this.descartaveis.push(m.geometry, m.material as THREE.Material);
        break;
      }
      case 'tabua':
        balcao();
        emCima('cuttingboard', 1.45, 1, 0, 0.1);
        break;
      case 'fogao': {
        const f = this.copia('stove_single');
        giro.add(f);
        emCima('pan_A', 1.05, 1.07, 0, 0.12);
        break;
      }
      case 'forno': {
        const f = this.copia('pizza_oven', 2.05);
        giro.add(f);
        break;
      }
      case 'pratos':
        balcao();
        emCima('dishrack_plates', 1.15);
        break;
      case 'sorvete': {
        balcao();
        const pote = this.bruto('icecream_container');
        pote.position.set(0, 1.2, 0.1);
        pote.rotation.y = Math.PI / 2;
        giro.add(pote);
        const sorvete = this.bruto(`icecream_container_icecream_${SABOR_DO_KIT[e.sabor!]}` as Modelo);
        sorvete.position.copy(pote.position);
        sorvete.rotation.y = Math.PI / 2;
        giro.add(sorvete);
        break;
      }
    }
    g.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.userData.estacao = e.id;
    });
    this.pegaveis.push(g);
    return g;
  }

  // ---------- o que está em cima ----------

  /** Um item sozinho (em cima de uma estação ou na mão). */
  private modeloDoItem(i: Item, largura = 0.85): THREE.Group {
    const g = this.montarItem(i, largura);
    g.userData.altura = new THREE.Box3().setFromObject(g).getSize(new THREE.Vector3()).y;
    return g;
  }

  private montarItem(i: Item, largura: number): THREE.Group {
    const g = new THREE.Group();
    if (i.ing === 'massa') {
      if (i.estado === 'cru') {
        g.add(this.copia('food_ingredient_dough', largura * 0.75));
        return g;
      }
      const base = this.copia('food_ingredient_dough_base', largura * 1.1);
      g.add(base);
      let y = base.userData.altura * 0.6;
      for (const c of ORDEM_DA_PIZZA) {
        if (!i.com?.includes(c)) continue;
        const v = VISUAL[c]?.naPizza;
        if (!v) continue;
        const camada = this.copia(v, largura * (c === 'tomate' ? 0.98 : 0.85));
        camada.position.y = y;
        y += Math.max(0.012, camada.userData.altura * 0.5);
        g.add(camada);
      }
      if (i.estado === 'cozido') this.tingir(g, '#f0c890');
      if (i.estado === 'queimado') this.tingir(g, '#4a3a32');
      return g;
    }
    if (i.ing === 'casquinha') {
      const sabor = i.com?.[0];
      g.add(sabor ? this.copia(`food_icecream_cone_${SABOR_DO_KIT[sabor]}` as Modelo, 0.42) : this.copia('icecream_cone', 0.38));
      return g;
    }
    if (i.ing === 'pao') {
      g.add(this.copia('food_ingredient_bun', 0.68));
      return g;
    }
    const kn = KENNEY[i.ing];
    if (kn) {
      // o tamanho de cada um está em KENNEY; a `largura` pedida só o aumenta ou diminui (0,85 é o normal)
      const queimadoDoPacote = i.estado === 'queimado' ? kn.queimado : undefined;
      const [modelo, tamanho, cor] = queimadoDoPacote ?? (i.estado === 'cru' ? kn.cru : i.estado === 'picado' && kn.picado ? kn.picado : kn.cozido);
      const o = this.copia(modelo, (tamanho * largura) / 0.85);
      if (i.estado === 'queimado' && !queimadoDoPacote) this.tingir(o, '#4a3a32');
      else if (cor && i.estado !== 'cru' && i.estado !== 'queimado') this.tingir(o, cor);
      if (i.ing === 'bife' && i.estado === 'cru') this.recolorir(o, BIFE_CRU);
      g.add(o);
      return g;
    }
    if (i.ing === 'carne') {
      g.add(this.copia(i.estado === 'cozido' ? 'food_ingredient_burger_cooked' : i.estado === 'queimado' ? 'food_ingredient_burger_trash' : 'food_ingredient_burger_uncooked', 0.68));
      return g;
    }
    const v = VISUAL[i.ing]!;
    g.add(this.copia(i.estado === 'cru' ? v.cru : v.picado, largura * (i.estado === 'cru' ? 0.75 : 0.95)));
    return g;
  }

  /** O prato com o que está nele: o lanche em camadas; o resto, lado a lado. */
  private modeloDoPrato(itens: Item[]): THREE.Group {
    const g = new THREE.Group();
    const prato = this.copia('plate', 0.95);
    g.add(prato);
    let y = 0.07;
    // o prato pronto que o kit tem inteiro (o cachorro-quente, o sushi)
    const pronto = (Object.keys(PRONTOS) as IdDaReceita[]).find((id) => confere(id, itens));
    if (pronto === 'sushi') {
      // duas peças, atravessadas
      for (const dz of [-0.13, 0.13]) {
        const m = this.copia('sushi-salmon', 0.44);
        m.rotation.y = Math.PI / 2;
        m.position.set(0, y, dz);
        g.add(m);
      }
      return g;
    }
    if (pronto) {
      const m = this.copia(PRONTOS[pronto]!, 0.72);
      m.position.y = y;
      g.add(m);
      return g;
    }
    const tem = (ing: Ingrediente) => itens.some((i) => i.ing === ing);
    // o lanche em camadas (com pão, ou a carne sozinha); o prato feito e o resto, lado a lado
    const lanche = tem('pao') || (tem('carne') && !tem('arroz') && !tem('ovo'));
    if (lanche) {
      const pao = itens.find((i) => i.ing === 'pao');
      const pilha = (m: THREE.Group) => {
        m.position.y = y;
        y += m.userData.altura * 0.85;
        g.add(m);
      };
      if (pao) pilha(this.copia('food_ingredient_bun_bottom', 0.66));
      for (const ing of CAMADAS) {
        const i = itens.find((x) => x.ing === ing);
        if (!i) continue;
        // o ovo, maior que o pão, para a clara aparecer
        if (ing === 'carne' || ing === 'salsicha' || ing === 'ovo' || ing === 'bacon') pilha(this.modeloDoItem(i, ing === 'ovo' && i.estado !== 'cru' ? 1.1 : 0.85));
        else {
          const v = VISUAL[ing];
          if (v) pilha(i.estado === 'cru' ? this.copia(v.cru, 0.5) : this.copia(v.noPrato, 0.66));
        }
      }
      if (pao) pilha(this.copia('food_ingredient_bun_top', 0.68));
      // o que não é do lanche (a massa, a casquinha, o arroz, o peixe) vai ao lado
      const resto = itens.filter((i) => i.ing !== 'pao' && !CAMADAS.includes(i.ing));
      resto.forEach((i, n) => {
        const m = this.modeloDoItem(i, 0.4);
        m.position.set(0.3, 0.07, 0.3 - n * 0.3);
        g.add(m);
      });
      return g;
    }
    const pequenos = itens.length > 1;
    // no prato feito, o ovo vai em cima da carne (a clara sumiria no prato branco)
    const carne = itens.find((i) => i.ing === 'carne');
    const ovo = carne ? itens.find((i) => i.ing === 'ovo') : undefined;
    const lado = itens.filter((i) => i !== ovo);
    lado.forEach((i, n) => {
      // o ovo frito e o bacon (o café da manhã) maiores: a clara some no prato branco, e o bacon é fino
      const m = this.modeloDoItem(i, pequenos ? (i.ing === 'ovo' || i.ing === 'bacon' ? 0.72 : 0.52) : 0.8);
      if (pequenos) {
        const a = (n / lado.length) * Math.PI * 2 + Math.PI / 4;
        m.position.set(Math.cos(a) * 0.2, y, Math.sin(a) * 0.2);
      } else m.position.y = y;
      g.add(m);
      if (ovo && i === carne) {
        const o = this.modeloDoItem(ovo, 0.85);
        o.position.set(m.position.x, y + m.userData.altura * 0.9, m.position.z);
        g.add(o);
      }
    });
    return g;
  }

  private modeloDaCoisa(c: Coisa): THREE.Group {
    return c.tipo === 'prato' ? this.modeloDoPrato(c.itens) : this.modeloDoItem(c.item);
  }

  // ---------- o coelho ----------

  private novoCoelho() {
    const g = this.coelhoGltf!;
    // a paleta do MEU avatar, a borda e o contorno (coelho3d.ts, o mesmo coelho de todos os jogos 3D)
    const copia = copiarCoelho(g, { altura: ALTURA_DO_COELHO, sombras: this.sombras });
    this.copiaDoCoelho = copia;
    void minhasCoresDoCoelho().then((cores) => copia.material.pintar(cores));
    const { corpo, mixer, acoes } = copia;
    const raiz = new THREE.Group();
    const giro = new THREE.Group();
    giro.add(corpo);
    raiz.add(giro);
    const sombra = new THREE.Mesh(new THREE.CircleGeometry(0.45, 24), new THREE.MeshBasicMaterial({ color: '#3a2a20', transparent: true, opacity: 0.22, depthWrite: false }));
    sombra.rotation.x = -Math.PI / 2;
    sombra.position.y = 0.01;
    this.descartaveis.push(sombra.geometry, sombra.material as THREE.Material);
    raiz.add(sombra);
    // o que ele leva vai à frente da barriga, girando com ele
    const mao = new THREE.Group();
    mao.position.set(0, 1.12, 0.68);
    giro.add(mao);
    this.cena.add(raiz);
    return { raiz, corpo: giro, mixer, acoes, tocando: '', mao, sinal: '' };
  }

  private tocar(nome: string) {
    const p = this.coelho;
    if (!p || p.tocando === nome) return;
    const nova = p.acoes.get(nome);
    if (!nova) return;
    const velha = p.acoes.get(p.tocando);
    nova.reset().play();
    if (velha) velha.crossFadeTo(nova, 0.18, false);
    p.tocando = nome;
  }

  // ---------- os ícones da fila ----------

  /** Desenha cada pedido e cada ingrediente uma vez, numa imagem pequena, com os mesmos modelos da cozinha. */
  private desenharIcones(): Icones {
    const L = 160;
    const palco = new THREE.Scene();
    palco.add(new THREE.HemisphereLight('#ffffff', '#9a8a7a', 2.2));
    const sol = new THREE.DirectionalLight('#fff3e0', 2);
    sol.position.set(-2, 5, 4);
    palco.add(sol);
    const cam = new THREE.PerspectiveCamera(28, 1, 0.01, 50);
    const tela = document.createElement('canvas');
    tela.width = tela.height = L;
    const g2 = tela.getContext('2d')!;
    const razao = this.renderer.getPixelRatio();
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(L, L, false);
    this.renderer.setClearColor(0x000000, 0);
    const foto = (o: THREE.Object3D): string => {
      palco.add(o);
      const caixa = new THREE.Box3().setFromObject(o);
      const centro = caixa.getCenter(new THREE.Vector3());
      const raio = caixa.getBoundingSphere(new THREE.Sphere()).radius;
      const d = raio / Math.sin(THREE.MathUtils.degToRad(cam.fov / 2)) * 0.98;
      cam.position.set(centro.x, centro.y + d * 0.62, centro.z + d * 0.78);
      cam.lookAt(centro);
      this.renderer.render(palco, cam);
      g2.clearRect(0, 0, L, L);
      g2.drawImage(this.renderer.domElement, 0, 0, L, L);
      palco.remove(o);
      return tela.toDataURL('image/png');
    };
    const receitas: Record<string, string> = {};
    for (const id of IDS_DAS_RECEITAS) {
      const itens = RECEITAS[id].itens.map(itemDaChave);
      receitas[id] = foto(this.modeloDoPrato(itens));
    }
    const ingredientes: Record<string, string> = {};
    for (const ing of INGREDIENTES)
      ingredientes[ing] = foto(this.modeloDoItem({ ing, estado: 'cru' }));
    this.renderer.setPixelRatio(razao);
    return { receitas, ingredientes };
  }

  // ---------- o quadro ----------

  private desenhar = () => {
    if (this.morta) return;
    // sem foco na janela (o jogo de verdade aberto) ou escondida, nada anda nem é desenhado
    if (document.hidden || !document.hasFocus()) {
      this.relogio.update();
      return;
    }
    this.relogio.update();
    const dt = Math.min(0.05, this.relogio.getDelta());
    const tempo = this.relogio.getElapsed();
    this.aoQuadro?.(dt);
    const k = this.cozinha;
    if (k && this.coelho) {
      // o que está em cima de cada estação
      for (const e of k.estacoes) {
        const sinal = assinatura(e.em);
        const atual = this.emCima.get(e.id);
        if ((atual?.sinal ?? '') !== sinal) {
          if (atual) this.cena.remove(atual.grupo);
          this.emCima.delete(e.id);
          if (e.em) {
            const grupo = this.modeloDaCoisa(e.em);
            grupo.position.set(e.x, TOPO[e.tipo], e.z);
            if (e.tipo === 'forno') {
              // a pizza aparece na boca do forno
              const r = this.rumoDa(e);
              grupo.position.x += Math.sin(r) * 0.7;
              grupo.position.z += Math.cos(r) * 0.7;
            }
            this.cena.add(grupo);
            this.emCima.set(e.id, { grupo, sinal });
          }
        }
        this.barra(e, tempo);
        this.fumaca(e, tempo);
      }
      // o coelho
      const c = k.coelho;
      const p = this.coelho;
      p.raiz.position.set(c.x, 0, c.z);
      let delta = c.rumo - p.corpo.rotation.y;
      delta = Math.atan2(Math.sin(delta), Math.cos(delta));
      p.corpo.rotation.y += delta * Math.min(1, dt * 14);
      const sinal = assinatura(c.mao);
      if (sinal !== p.sinal) {
        p.mao.clear();
        if (c.mao) {
          const m = this.modeloDaCoisa(c.mao);
          m.scale.setScalar(0.85);
          p.mao.add(m);
        }
        p.sinal = sinal;
      }
      const picando = c.picando !== null;
      this.tocar(this.calmo ? 'parado' : c.andando ? 'andando' : picando ? 'falando' : 'parado');
      p.mixer.update(this.calmo ? 0 : dt);
      // o passinho de quem anda e a faca de quem pica
      p.corpo.position.y = c.andando && !this.calmo ? Math.abs(Math.sin(tempo * 12)) * 0.06 : 0;
      p.mao.position.y = 1.12 + (picando && !this.calmo ? Math.abs(Math.sin(tempo * 16)) * 0.05 : 0);
      // a estação à frente acende
      const a = alvo(k);
      this.luz.visible = !!a;
      if (a) {
        this.luz.position.set(a.x, TOPO[a.tipo] + 0.02, a.z);
        (this.luz.material as THREE.MeshBasicMaterial).opacity = this.calmo ? 0.3 : 0.24 + Math.sin(tempo * 5) * 0.1;
      }
    }
    // a câmera, de cima e da frente
    const d = 21.5 * this.distancia;
    this.camera.position.set(0, d * 0.88, d * 0.6);
    this.camera.lookAt(0, 0, 0.25);
    this.renderer.render(this.cena, this.camera);
  };

  /**
   * A barrinha em cima da tábua (quanto falta para picar) e o MEDIDOR DO PONTO em cima do fogo: a régua com as três faixas
   * (cru, ponto, queimando) do ingrediente que está lá, e a agulha andando nela. Queimado, a barra some (a fumaça escura diz).
   */
  private barra(e: Estacao, tempo: number) {
    const pr = progresso(e);
    let b = this.barras.get(e.id);
    if (!pr || (pr.tipo === 'fogo' && pr.fase === 'queimado')) {
      if (b) b.grupo.visible = false;
      return;
    }
    const L = 1.3;
    if (!b) {
      const grupo = new THREE.Group();
      const fundoMat = new THREE.MeshBasicMaterial({ color: '#3a2e28', depthTest: false, transparent: true });
      const geo = new THREE.PlaneGeometry(L + 0.1, 0.24);
      const fundo = new THREE.Mesh(geo, fundoMat);
      fundo.renderOrder = 10;
      grupo.add(fundo);
      // as faixas: uma geometria de largura 1 que começa no zero; a escala dá a largura, a posição o começo
      const faixaGeo = new THREE.PlaneGeometry(1, 0.14);
      faixaGeo.translate(0.5, 0, 0);
      const faixas = ['#8a7566', '#7cc46a', '#e0533c'].map((cor) => {
        const mat = new THREE.MeshBasicMaterial({ color: cor, depthTest: false, transparent: true });
        const m = new THREE.Mesh(faixaGeo, mat);
        m.position.z = 0.001;
        m.renderOrder = 11;
        grupo.add(m);
        this.descartaveis.push(mat);
        return m;
      });
      const agulhaMat = new THREE.MeshBasicMaterial({ color: '#fff8e8', depthTest: false, transparent: true });
      const agulhaGeo = new THREE.PlaneGeometry(0.06, 0.3);
      const agulha = new THREE.Mesh(agulhaGeo, agulhaMat);
      agulha.position.z = 0.002;
      agulha.renderOrder = 12;
      grupo.add(agulha);
      grupo.position.set(e.x, TOPO[e.tipo] + 1.3, e.z);
      this.descartaveis.push(fundoMat, geo, faixaGeo, agulhaMat, agulhaGeo);
      this.cena.add(grupo);
      b = { grupo, faixas, agulha };
      this.barras.set(e.id, b);
    }
    b.grupo.visible = true;
    b.grupo.quaternion.copy(this.camera.quaternion);
    const faixa = (n: number, de: number, ate: number) => {
      const m = b!.faixas[n];
      m.visible = ate > de;
      m.position.x = -L / 2 + de * L;
      m.scale.x = Math.max(0.001, (ate - de) * L);
    };
    if (pr.tipo === 'tabua') {
      // a tábua: a faixa verde enchendo, sem agulha
      faixa(0, 0, 0);
      faixa(1, 0, Math.max(0.02, Math.min(1, pr.f)));
      faixa(2, 0, 0);
      b.agulha.visible = false;
      return;
    }
    faixa(0, 0, pr.pronto);
    faixa(1, pr.pronto, pr.aviso);
    faixa(2, pr.aviso, 1);
    b.agulha.visible = true;
    b.agulha.position.x = -L / 2 + Math.min(1, pr.f) * L;
    // queimando, a faixa vermelha pisca
    const vermelha = b.faixas[2].material as THREE.MeshBasicMaterial;
    vermelha.color.set(pr.fase === 'queimando' && !this.calmo && Math.sin(tempo * 14) > 0 ? '#f0a040' : '#e0533c');
  }

  /** A fumaça em cima do fogo: clara passando do ponto, escura com o queimado ainda lá. */
  private fumaca(e: Estacao, tempo: number) {
    const pr = progresso(e);
    const fase = pr?.tipo === 'fogo' && (pr.fase === 'queimando' || pr.fase === 'queimado') ? pr.fase : null;
    let g = this.fumacas.get(e.id);
    if (!fase) {
      if (g) g.visible = false;
      return;
    }
    if (!g) {
      if (!this.geoFumaca) {
        this.geoFumaca = new THREE.SphereGeometry(0.2, 10, 8);
        this.matFumaca = ['#d8d2ca', '#3d3734'].map((cor) => new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: 0.55, depthWrite: false }));
        this.descartaveis.push(this.geoFumaca, ...this.matFumaca);
      }
      g = new THREE.Group();
      for (let n = 0; n < 6; n++) g.add(new THREE.Mesh(this.geoFumaca, this.matFumaca[0]));
      g.position.set(e.x, TOPO[e.tipo] + 0.2, e.z);
      if (e.tipo === 'forno') {
        const r = this.rumoDa(e);
        g.position.x += Math.sin(r) * 0.4;
        g.position.z += Math.cos(r) * 0.4;
        g.position.y += 0.9;
      }
      this.cena.add(g);
      this.fumacas.set(e.id, g);
    }
    g.visible = true;
    const escura = fase === 'queimado';
    g.children.forEach((o, n) => {
      const m = o as THREE.Mesh;
      m.material = this.matFumaca[escura ? 1 : 0];
      // cada bolinha sobe e cresce, e some lá em cima (encolhendo); com menos movimento, paradas
      const fase01 = this.calmo ? n / 6 : (tempo * (escura ? 0.75 : 0.55) + n / 6) % 1;
      const giro = n * 2.1 + tempo * 0.8;
      m.position.set(Math.sin(giro) * 0.18 * fase01, fase01 * (escura ? 1.8 : 1.3), Math.cos(giro) * 0.18 * fase01);
      m.scale.setScalar((0.5 + fase01 * (escura ? 1.5 : 1.0)) * Math.sin(Math.PI * Math.min(0.999, fase01 + 0.08)));
    });
  }

  // ---------- o clique ----------

  private estacaoNoPonto(e: PointerEvent): number | null {
    const r = this.renderer.domElement.getBoundingClientRect();
    const v = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.raio.setFromCamera(v, this.camera);
    const hit = this.raio.intersectObjects(this.pegaveis, true)[0];
    if (hit && hit.object.userData.estacao !== undefined) return hit.object.userData.estacao as number;
    // o que está em cima da estação também vale
    const emCima = [...this.emCima.entries()];
    const hit2 = this.raio.intersectObjects(emCima.map(([, v]) => v.grupo), true)[0];
    if (!hit2) return null;
    for (const [id, v] of emCima) {
      let o: THREE.Object3D | null = hit2.object;
      while (o) {
        if (o === v.grupo) return id;
        o = o.parent;
      }
    }
    return null;
  }
  private aoApertar = (e: PointerEvent) => {
    this.apertou = { x: e.clientX, y: e.clientY };
  };
  private aoSoltar = (e: PointerEvent) => {
    if (!this.apertou || Math.hypot(e.clientX - this.apertou.x, e.clientY - this.apertou.y) > 8) return;
    this.apertou = null;
    const i = this.estacaoNoPonto(e);
    if (i !== null) this.aoClicar(i);
  };
  private aoPassar = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    this.renderer.domElement.style.cursor = this.estacaoNoPonto(e) !== null ? 'pointer' : '';
  };

  destruir() {
    this.morta = true;
    this.renderer.setAnimationLoop(null);
    this.observador.disconnect();
    const canvas = this.renderer.domElement;
    canvas.removeEventListener('pointerdown', this.aoApertar);
    canvas.removeEventListener('pointerup', this.aoSoltar);
    canvas.removeEventListener('pointermove', this.aoPassar);
    // a geometria e a textura dos modelos são do cache (servem à próxima partida); as nossas vão embora
    for (const d of this.descartaveis) d.dispose();
    for (const m of this.tingidos.values()) m.dispose();
    this.copiaDoCoelho?.descartar();
    this.renderer.forceContextLoss();
    this.renderer.dispose();
    canvas.remove();
  }
}
