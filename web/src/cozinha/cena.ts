import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { alvo, assinatura, progresso, type Coisa, type Cozinha, type Estacao } from './cozinha';
import { IDS_DAS_RECEITAS, RECEITAS, itemDaChave, type Ingrediente, type Item } from './receitas';

/**
 * A COZINHA EM 3D (05/11/2026). Só a TELA: as regras moram em cozinha.ts, e esta cena só lê a cozinha a cada quadro. Os
 * móveis, a comida e a louça são do Restaurant Bits da KayKit (CC0, web/public/cozinha/License.txt; o crédito nos termos,
 * seção 10); o cozinheiro é o NOSSO coelho 3D, com o nosso esqueleto (o mesmo das Cidades à venda).
 *
 * - A câmera é fixa, de cima e da frente, mostrando a cozinha inteira (os jogos de cozinha de festa são assim: tudo à vista).
 * - O que está em cima de cada estação e na mão do coelho é montado com os modelos do kit pelo ESTADO do item: a carne crua,
 *   no ponto ou queimada; a alface inteira ou picada; a massa em bola, aberta com as coberturas, assada (tingida) ou
 *   queimada. O prato monta o lanche em camadas, do pão de baixo ao de cima, como o desenho do pedido.
 * - A estação que o coelho tem à frente acende; a tábua e o fogo têm a barrinha do tempo (vermelha passando do ponto).
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
type Modelo = (typeof MODELOS)[number];

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
};
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
const CAMADAS: Ingrediente[] = ['carne', 'queijo', 'alface', 'tomate', 'calabresa', 'cogumelo'];
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
  private material: THREE.Material | null = null;
  private tingidos = new Map<string, THREE.Material>();
  private coelhoGltf: GLTF | null = null;
  private coelho: { raiz: THREE.Group; corpo: THREE.Object3D; mixer: THREE.AnimationMixer; acoes: Map<string, THREE.AnimationAction>; tocando: string; mao: THREE.Group; sinal: string } | null = null;
  private emCima = new Map<number, { grupo: THREE.Group; sinal: string }>();
  private barras = new Map<number, { grupo: THREE.Group; cheio: THREE.Mesh; mat: THREE.MeshBasicMaterial }>();
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
    const [lista, coelho] = await Promise.all([
      Promise.all(MODELOS.map((m) => carregar(`${this.base}cozinha/${m}.gltf`).then((g) => [m, g] as const))),
      carregar(`${this.base}cidades3d/coelho-animado.glb`),
    ]);
    if (this.morta) return { receitas: {}, ingredientes: {} };
    for (const [m, g] of lista) {
      // todos os modelos do kit usam o mesmo material e a mesma textura: um só, para a placa guardar a imagem uma vez
      g.scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        this.material ??= mesh.material as THREE.Material;
        mesh.material = this.material;
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
    this.distancia = Math.max(1, 1.55 / this.camera.aspect);
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
      s.left = -12;
      s.right = 12;
      s.top = 10;
      s.bottom = -10;
      s.near = 1;
      s.far = 40;
      sol.shadow.bias = -0.0008;
      sol.shadow.normalBias = 0.02;
    }
    c.add(sol);

    // o chão de ladrilho
    for (const x of [-6, -2, 2, 6])
      for (const z of [-3, 1]) {
        const p = this.bruto('floor_kitchen');
        p.position.set(x, 0, z);
        c.add(p);
      }
    for (let x = -7; x <= 7; x += 2) {
      const p = this.bruto('floor_kitchen_small');
      p.position.set(x, 0, 4);
      c.add(p);
    }
    // a parede do fundo, com a janela de entrega bem atrás da janela (a estação)
    const k0 = this.cozinha;
    const entrega = k0?.estacoes.find((e) => e.tipo === 'entrega');
    const xJanela = entrega?.x ?? -1;
    const paredes: [Modelo, number][] = [
      ['wall', xJanela - 8],
      ['wall', xJanela - 4],
      ['wall_orderwindow', xJanela],
      ['wall', xJanela + 4],
      ['wall', xJanela + 8],
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
    const lanche = itens.some((i) => i.ing === 'pao' || i.ing === 'carne');
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
        if (ing === 'carne') pilha(this.modeloDoItem(i));
        else {
          const v = VISUAL[ing];
          if (v) pilha(i.estado === 'cru' ? this.copia(v.cru, 0.5) : this.copia(v.noPrato, 0.66));
        }
      }
      if (pao) pilha(this.copia('food_ingredient_bun_top', 0.68));
      // o que não é do lanche (a massa, a casquinha) vai ao lado
      const resto = itens.filter((i) => i.ing === 'massa' || i.ing === 'casquinha');
      resto.forEach((i, n) => {
        const m = this.modeloDoItem(i, 0.4);
        m.position.set(0.3, 0.07, 0.3 - n * 0.3);
        g.add(m);
      });
      return g;
    }
    const pequenos = itens.length > 1;
    itens.forEach((i, n) => {
      const m = this.modeloDoItem(i, pequenos ? 0.52 : 0.8);
      if (pequenos) {
        const a = (n / itens.length) * Math.PI * 2 + Math.PI / 4;
        m.position.set(Math.cos(a) * 0.2, y, Math.sin(a) * 0.2);
      } else m.position.y = y;
      g.add(m);
    });
    return g;
  }

  private modeloDaCoisa(c: Coisa): THREE.Group {
    return c.tipo === 'prato' ? this.modeloDoPrato(c.itens) : this.modeloDoItem(c.item);
  }

  // ---------- o coelho ----------

  private novoCoelho() {
    const g = this.coelhoGltf!;
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
    for (const ing of ['pao', 'carne', 'queijo', 'alface', 'tomate', 'massa', 'calabresa', 'cogumelo', 'casquinha'] as Ingrediente[])
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
    const d = 19.5 * this.distancia;
    this.camera.position.set(0, d * 0.88, d * 0.6);
    this.camera.lookAt(0, 0, 0.25);
    this.renderer.render(this.cena, this.camera);
  };

  /** A barrinha de tempo em cima da tábua e do fogo. */
  private barra(e: Estacao, tempo: number) {
    const pr = progresso(e);
    let b = this.barras.get(e.id);
    if (!pr) {
      if (b) b.grupo.visible = false;
      return;
    }
    if (!b) {
      const grupo = new THREE.Group();
      const fundoMat = new THREE.MeshBasicMaterial({ color: '#3a2e28', depthTest: false, transparent: true });
      const geo = new THREE.PlaneGeometry(1.2, 0.2);
      const fundo = new THREE.Mesh(geo, fundoMat);
      const mat = new THREE.MeshBasicMaterial({ color: '#7cc46a', depthTest: false, transparent: true });
      const cheioGeo = new THREE.PlaneGeometry(1.1, 0.12);
      cheioGeo.translate(0.55, 0, 0);
      const cheio = new THREE.Mesh(cheioGeo, mat);
      cheio.position.set(-0.55, 0, 0.001);
      fundo.renderOrder = 10;
      cheio.renderOrder = 11;
      grupo.add(fundo, cheio);
      grupo.position.set(e.x, TOPO[e.tipo] + 1.3, e.z);
      this.descartaveis.push(fundoMat, geo, mat, cheioGeo);
      this.cena.add(grupo);
      b = { grupo, cheio, mat };
      this.barras.set(e.id, b);
    }
    b.grupo.visible = true;
    b.grupo.quaternion.copy(this.camera.quaternion);
    b.cheio.scale.x = Math.max(0.02, Math.min(1, pr.f));
    b.mat.color.set(pr.perigo ? (this.calmo || Math.sin(tempo * 14) > 0 ? '#e0533c' : '#f0a040') : '#7cc46a');
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
    this.coelho?.mixer.stopAllAction();
    this.renderer.forceContextLoss();
    this.renderer.dispose();
    canvas.remove();
  }
}
