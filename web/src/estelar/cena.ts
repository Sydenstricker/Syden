import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CEUS, carregarCeu, cupulaDoCeu, giroPara, type CupulaDoCeu } from '../ceus';
import { carregarCoelho, copiarCoelho, type CoelhoCopiado, type CoresDoCoelho } from '../coelho3d';
import { BIFURCA, BOMBA_RAIO, CHAO, CHEFE_T, LIM_X, LIM_Y, RAIO_ANEL, SUBCHEFE_T, Z_FIM_DO_CHAO, ROTA_DO_GELO, ehChefe, passoDoAnel, posicaoBala, posicaoInimigo, posicaoItem, zNave, type Ramo, type Tipo } from './sim';
import { posicaoTiro, type Mundo } from './mundo';

/**
 * A CENA DA ROTA ESTELAR (16/11/2026): o mundo de sim.ts em 3D low poly. O planeta e as construções são do Space Base Bits da
 * KayKit (Kay Lousberg, CC0, web/public/estelar/License.txt): as cúpulas, os módulos, as turbinas e as torres no chão, as
 * rochas do campo de asteroides, o cargueiro e a sonda inimigos e o jipe gigante. A NAVE é feita aqui, por código (nenhuma
 * nave de jogo nenhum: um corpo branco de bico laranja, asas curtas e a cabine de vidro), com o NOSSO coelho 3D (coelho3d.ts)
 * sentado nela, com as cores do avatar. O caçador, a torre, as vigas da estação e o polvo de lata também são por código.
 *
 * Só a TELA: a regra decide onde está cada coisa pelo número do passo; quem chama passa o quadro. O three.js vem num pedaço
 * à parte, só quando o jogo abre; sem foco na janela, quem chama não desenha; ao sair, o contexto é devolvido; se a placa
 * perde o contexto, `aoPerder` avisa (o jogo mostra o aviso de que precisa de 3D).
 */

const BASE = `${import.meta.env.BASE_URL}estelar/`;
/** O céu do planeta (é também a cor da caixa enquanto carrega). */
export const COR_DO_CEU = '#c9a7d8';
const COR_DO_ESPACO = '#0b1030';
const COR_DO_CHAO = '#d9824c';
/** A rota do gelo (24/11/2026): o chão de neve e gelo, e o céu azulado do planeta gelado. */
const COR_DO_GELO = '#dfeef7';
const COR_DO_CEU_DO_GELO = '#a9c8e6';

const MODELOS = ['dropship', 'lander_A', 'spacetruck_large', 'rock_A', 'rock_B', 'rocks_A', 'dome', 'basemodule_A', 'windturbine_tall', 'solarpanel', 'structure_tall', 'landingpad_large'] as const;
type Modelo = (typeof MODELOS)[number];

const carregados = new Map<string, Promise<GLTF>>();
function carregar(nome: string): Promise<GLTF> {
  let p = carregados.get(nome);
  if (!p) {
    p = new GLTFLoader().loadAsync(`${BASE}${nome}.gltf`);
    carregados.set(nome, p);
    p.catch(() => carregados.delete(nome));
  }
  return p;
}

/** Um sorteio sempre igual, só para o desenho. */
function sorteio(semente: number) {
  let s = semente >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** O nome em cima de uma nave da turma, num quadro de canvas. */
function etiqueta(texto: string): THREE.Sprite {
  const c = document.createElement('canvas');
  const g = c.getContext('2d')!;
  const fonte = 'bold 40px system-ui, sans-serif';
  g.font = fonte;
  const w = Math.min(512, Math.ceil(g.measureText(texto).width) + 36);
  c.width = w;
  c.height = 64;
  g.font = fonte;
  g.fillStyle = 'rgba(20, 30, 45, 0.62)';
  g.beginPath();
  g.roundRect(0, 6, w, 52, 26);
  g.fill();
  g.fillStyle = '#ffffff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(texto, w / 2, 33);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  s.scale.set((w / 64) * 0.7, 0.7, 1);
  s.renderOrder = 10;
  return s;
}

/** O chão do planeta: areia laranja com crateras e pedrinhas, num quadro que se repete (no gelo, neve com as rachaduras azuis). */
function texturaDoChao(gelo = false): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = gelo ? COR_DO_GELO : COR_DO_CHAO;
  g.fillRect(0, 0, 256, 256);
  const r = sorteio(99);
  for (let k = 0; k < 140; k++) {
    g.fillStyle = r() < 0.5 ? (gelo ? 'rgba(120, 170, 210, 0.3)' : 'rgba(160, 82, 44, 0.35)') : gelo ? 'rgba(255, 255, 255, 0.5)' : 'rgba(246, 184, 120, 0.35)';
    g.beginPath();
    g.arc(r() * 256, r() * 256, 2 + r() * 7, 0, Math.PI * 2);
    g.fill();
  }
  for (let k = 0; k < 6; k++) {
    const x = r() * 256, y = r() * 256, raio = 10 + r() * 16;
    g.strokeStyle = gelo ? 'rgba(90, 150, 200, 0.5)' : 'rgba(130, 64, 34, 0.5)';
    g.lineWidth = 3;
    g.beginPath();
    g.arc(x, y, raio, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = gelo ? 'rgba(150, 200, 235, 0.45)' : 'rgba(170, 88, 48, 0.4)';
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export interface NaveNaCena {
  cores: CoresDoCoelho;
  /** As da turma vão meio transparentes, com o nome em cima. */
  fantasma?: boolean;
  nome?: string;
  /** A cor do corpo da nave (as alas do computador têm a delas). */
  pintura?: string;
}

interface NaveMontada {
  raiz: THREE.Group;
  corpo: THREE.Group;
  fogo: THREE.Mesh;
  coelho: CoelhoCopiado;
  materiais: THREE.Material[];
  rolar: number;
  inclinar: number;
}

/** O que se desenha de uma nave num quadro. */
export interface QuadroDaNave {
  x: number;
  y: number;
  /** A velocidade na tela (inclina a nave). */
  vx: number;
  vy: number;
  /** De 0 a 1 enquanto gira; null parada. */
  giro: number | null;
  pisca: boolean;
  escondida?: boolean;
}

export interface Quadro {
  /** O passo do mundo, com a fração (o desenho anda liso entre os passos). */
  passo: number;
  mundo: Mundo;
  /** A minha nave (null: só assisto). */
  eu: QuadroDaNave | null;
  /** As naves da turma, no meu plano. */
  outros: QuadroDaNave[];
  /** De 0 a 1, a carga do tiro; o alvo travado. */
  carga: number;
  alvo: number | null;
  ramo: Ramo;
  dt: number;
}

export class CenaEstelar {
  private renderer: THREE.WebGLRenderer;
  private cena = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(62, 1, 0.1, 900);
  private observador: ResizeObserver;
  private morta = false;
  private calmo = false;
  private relogio = 0;
  private descartaveis: { dispose(): void }[] = [];
  private modelos = new Map<Modelo, GLTF>();
  private naves: NaveMontada[] = [];
  /** As duas alas do computador (no Solo). */
  private alas: { nave: NaveMontada; x: number; y: number }[] = [];
  private inimigos = new Map<number, THREE.Object3D>();
  private aneis: THREE.Mesh[] = [];
  private itens = new Map<number, THREE.Object3D>();
  private balas!: THREE.InstancedMesh;
  private travas!: THREE.InstancedMesh;
  private tiros!: THREE.InstancedMesh;
  private explosoes: { m: THREE.Mesh; tipo: string; em: number; grande: boolean }[] = [];
  private poolDeExplosoes: THREE.Mesh[] = [];
  private mira!: THREE.Group;
  private marca!: THREE.Mesh;
  private chao!: THREE.Mesh;
  private enfeitesDoChao: { o: THREE.Object3D; k: number }[] = [];
  private enfeitesDasRotas: { o: THREE.Object3D; ramo: 1 | 2; lado: number; giro: number }[] = [];
  private obstaculos: { o: THREE.Object3D; ramo: Ramo; z: number }[] = [];
  private estrelas!: THREE.Points;
  private sol!: THREE.DirectionalLight;
  private hemi!: THREE.HemisphereLight;
  private ceu = new THREE.Color(COR_DO_CEU);
  private espaco = new THREE.Color(COR_DO_ESPACO);
  /** O céu da Kenney (o planeta e a galáxia), quando as duas imagens chegam; até lá, a cor lisa de sempre. */
  private cupula: CupulaDoCeu | null = null;
  private gTiro = new THREE.Object3D();

  constructor(
    private caixa: HTMLElement,
    private mundo: Mundo,
    private aoPerder: () => void,
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.calmo = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const tela = this.renderer.domElement;
    tela.className = 'estelar-tela';
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
    this.camera.fov = this.camera.aspect < 1 ? 78 : 62;
    this.camera.updateProjectionMatrix();
  }

  private clonar(nome: Modelo, escala = 1): THREE.Object3D {
    const o = this.modelos.get(nome)!.scene.clone(true);
    o.scale.setScalar(escala);
    return o;
  }

  private material<T extends THREE.Material>(m: T): T {
    this.descartaveis.push(m);
    return m;
  }
  private geometria<T extends THREE.BufferGeometry>(g: T): T {
    this.descartaveis.push(g);
    return g;
  }

  /** Carrega os modelos e monta o mundo e as naves (a primeira é a minha, se eu jogo). */
  async montar(naves: NaveNaCena[], alas: CoresDoCoelho[]): Promise<void> {
    const [g, ...lista] = await Promise.all([carregarCoelho(), ...MODELOS.map(carregar)]);
    if (this.morta) return;
    MODELOS.forEach((n, i) => this.modelos.set(n, lista[i]));
    this.montarMundo();
    void this.ceuDaKenney();
    for (const n of naves) this.naves.push(this.montarNave(g, n));
    for (const [k, cores] of alas.entries()) {
      const nave = this.montarNave(g, { cores, pintura: k === 0 ? '#9fd3ff' : '#c9f29b' });
      this.alas.push({ nave, x: k === 0 ? -8 : 8, y: 2 });
    }
  }

  // ---------------------------------------------------------------------------------------------------------------
  // O MUNDO
  // ---------------------------------------------------------------------------------------------------------------

  /**
   * O CÉU DA KENNEY (Skyboxes e Skyboxes Space, CC0; 20/11/2026): o céu lilás do planeta com o sol grande, que passa na subida
   * ao espaço com a galáxia bem na frente de quem voa. A névoa e o fundo passam às cores do horizonte das duas imagens, e
   * abaixo do horizonte a cúpula é a cor da névoa (o chão ao longe some nela). Sem as imagens, a cor lisa de sempre.
   */
  private async ceuDaKenney() {
    // (a rota do gelo, 24/11/2026: o céu azul do dia no lugar do lilás)
    const qual = this.mundo.r.rota === ROTA_DO_GELO ? 'dia' : 'alienigena';
    const [a, b] = await Promise.all([carregarCeu(qual), carregarCeu('galaxia')]).catch(() => [null, null]);
    if (!a || !b || this.morta) return;
    const s = this.sol.position;
    const c = cupulaDoCeu(a, b, giroPara(CEUS[qual].sol, s.x, s.z), giroPara(CEUS.galaxia.sol, 0, 1), CEUS[qual].horizonte);
    this.descartaveis.push(c.mesh.geometry, c.material);
    this.ceu.set(CEUS[qual].horizonte);
    this.espaco.set(CEUS.galaxia.horizonte);
    this.cena.add(c.mesh);
    this.cupula = c;
  }

  private montarMundo() {
    const c = this.cena;
    const r = this.mundo.r;
    c.background = this.ceu.clone();
    c.fog = new THREE.Fog(COR_DO_CEU, 70, 230);
    this.hemi = new THREE.HemisphereLight('#fff1e0', '#8a4a2a', 1.5);
    c.add(this.hemi);
    this.sol = new THREE.DirectionalLight('#fff3dc', 2.3);
    this.sol.position.set(30, 60, -20);
    c.add(this.sol, this.sol.target);

    // o chão do planeta, que acaba em Z_FIM_DO_CHAO
    const gelo = r.rota === ROTA_DO_GELO;
    if (gelo) {
      this.ceu.set(COR_DO_CEU_DO_GELO);
      c.background = this.ceu.clone();
      (c.fog as THREE.Fog).color.set(COR_DO_CEU_DO_GELO);
    }
    const tex = texturaDoChao(gelo);
    this.descartaveis.push(tex);
    const comp = Z_FIM_DO_CHAO + 260;
    tex.repeat.set(10, comp / 40);
    this.chao = new THREE.Mesh(this.geometria(new THREE.PlaneGeometry(500, comp)), this.material(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 })));
    this.chao.rotation.x = -Math.PI / 2;
    this.chao.position.set(0, CHAO, Z_FIM_DO_CHAO - comp / 2);
    c.add(this.chao);

    // os enfeites do chão: uns poucos que se repetem pela frente da nave (a nave os passa, eles voltam lá adiante)
    const doChao: Modelo[] = ['dome', 'basemodule_A', 'solarpanel', 'rocks_A', 'windturbine_tall', 'landingpad_large', 'rock_B', 'dome'];
    for (let k = 0; k < 44; k++) {
      const nome = doChao[k % doChao.length];
      const escala = nome === 'solarpanel' ? 4 : nome === 'rocks_A' || nome === 'rock_B' ? 6 : nome === 'windturbine_tall' ? 4 : 5;
      const o = this.clonar(nome, escala);
      c.add(o);
      this.enfeitesDoChao.push({ o, k });
    }

    // os obstáculos do caminho
    const viga = this.material(new THREE.MeshStandardMaterial({ color: '#f2c14e', metalness: 0.4, roughness: 0.45 }));
    const vigaEscura = this.material(new THREE.MeshStandardMaterial({ color: '#3a3f4f', metalness: 0.5, roughness: 0.5 }));
    const caixaG = this.geometria(new THREE.BoxGeometry(1, 1, 1));
    const gelo1 = this.material(new THREE.MeshStandardMaterial({ color: '#9fd8f0', emissive: '#2a6a8a', emissiveIntensity: 0.35, metalness: 0.1, roughness: 0.15, transparent: true, opacity: 0.88 }));
    const gelo2 = this.material(new THREE.MeshStandardMaterial({ color: '#f4fbff', emissive: '#7fb8d8', emissiveIntensity: 0.4, roughness: 0.3 }));
    for (const ob of r.obstaculos) {
      let o: THREE.Object3D;
      const alto = ob.y1 - ob.y0;
      if (ob.modelo === 'torre') {
        o = this.clonar('structure_tall');
        o.scale.set((ob.raio * 2) / 1.76, alto / 2, (ob.raio * 2) / 1.76);
        o.position.set(ob.x, ob.y0, ob.z);
      } else if (ob.modelo === 'turbina') {
        o = this.clonar('windturbine_tall');
        o.scale.setScalar(alto / 2.2);
        o.position.set(ob.x, ob.y0 + (0.49 * alto) / 2.2, ob.z);
      } else if (ob.modelo === 'cristal') {
        // o cristal de gelo (por código): um prisma de seis faces de ponta, inclinado um pouco
        const cr = new THREE.Mesh(this.geometria(new THREE.ConeGeometry(1, 1, 6)), gelo1);
        cr.scale.set(ob.raio * 1.1, alto, ob.raio * 1.1);
        cr.position.y = alto / 2;
        const gr = new THREE.Group();
        gr.add(cr);
        gr.position.set(ob.x, ob.y0, ob.z);
        gr.rotation.z = (ob.x % 1) * 0.3;
        o = gr;
      } else if (ob.modelo === 'arco') {
        // a laje de gelo (o arco e as portas do anel de gelo), com a borda mais clara
        const gr = new THREE.Group();
        const corpo = new THREE.Mesh(caixaG, gelo1);
        corpo.scale.set(ob.raio * 2, alto, ob.fundo * 2);
        const borda = new THREE.Mesh(caixaG, gelo2);
        borda.scale.set(ob.raio * 2 + 0.1, 0.25, ob.fundo * 2 + 0.1);
        borda.position.y = (ob.y1 > 0 ? -1 : 1) * (alto / 2);
        gr.add(corpo, borda);
        gr.position.set(ob.x, (ob.y0 + ob.y1) / 2, ob.z);
        o = gr;
      } else if (ob.modelo === 'bloco') {
        o = this.clonar('landingpad_large');
        o.scale.set((ob.raio * 2) / 2.5, 0.8, (ob.fundo * 2) / 2.5);
        o.position.set(ob.x, ob.y0, ob.z);
      } else {
        const gr = new THREE.Group();
        const corpo = new THREE.Mesh(caixaG, viga);
        corpo.scale.set(ob.raio * 2, alto, ob.fundo * 2);
        gr.add(corpo);
        for (let k = -2; k <= 2; k++) {
          const faixa = new THREE.Mesh(caixaG, vigaEscura);
          faixa.scale.set(0.5, alto + 0.05, ob.fundo * 2 + 0.05);
          faixa.position.x = k * ob.raio * 0.4;
          gr.add(faixa);
        }
        // a viga presa à parede da estação, do lado de fora da tela
        const presa = new THREE.Mesh(caixaG, vigaEscura);
        presa.scale.set(0.8, 14, 0.8);
        presa.position.set(Math.sign(ob.x) * (ob.raio + 0.4), 0, 0);
        gr.add(presa);
        gr.position.set(ob.x, (ob.y0 + ob.y1) / 2, ob.z);
        o = gr;
      }
      c.add(o);
      this.obstaculos.push({ o, ramo: ob.ramo, z: ob.z });
    }

    // as estrelas (seguem a câmera) e os planetas lá longe
    const pos: number[] = [];
    const sr = sorteio(5);
    for (let k = 0; k < 1400; k++) {
      const u = sr() * 2 - 1, a = sr() * Math.PI * 2, raio = 380;
      const s = Math.sqrt(1 - u * u);
      pos.push(raio * s * Math.cos(a), raio * u, raio * s * Math.sin(a));
    }
    const ge = this.geometria(new THREE.BufferGeometry());
    ge.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    this.estrelas = new THREE.Points(ge, this.material(new THREE.PointsMaterial({ color: '#ffffff', size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false })));
    c.add(this.estrelas);
    const gasoso = new THREE.Mesh(this.geometria(new THREE.SphereGeometry(70, 32, 20)), this.material(new THREE.MeshStandardMaterial({ color: '#7d6ae0', roughness: 0.8, emissive: '#2a1f66', emissiveIntensity: 0.4, fog: false })));
    gasoso.position.set(-160, 70, zNave(CHEFE_T) + 420);
    const anelDoGasoso = new THREE.Mesh(this.geometria(new THREE.RingGeometry(95, 130, 48)), this.material(new THREE.MeshBasicMaterial({ color: '#c8b8ff', side: THREE.DoubleSide, transparent: true, opacity: 0.55, fog: false })));
    anelDoGasoso.rotation.x = -Math.PI / 2.4;
    gasoso.add(anelDoGasoso);
    const lua = new THREE.Mesh(this.geometria(new THREE.SphereGeometry(22, 24, 16)), this.material(new THREE.MeshStandardMaterial({ color: '#9fd8e8', roughness: 0.9, fog: false })));
    lua.position.set(140, -30, zNave(BIFURCA) + 500);
    c.add(gasoso, lua);

    // os portões da bifurcação: à esquerda o das rochas, à direita o da estação (só desenho; quem decide é o lado da nave)
    const zb = zNave(BIFURCA);
    const portao = (x: number, cor: string) => {
      const m = new THREE.Mesh(this.geometria(new THREE.TorusGeometry(6, 0.7, 10, 32)), this.material(new THREE.MeshStandardMaterial({ color: cor, emissive: cor, emissiveIntensity: 0.6, metalness: 0.3, roughness: 0.4 })));
      m.position.set(x, 0, zb);
      c.add(m);
    };
    portao(-7, '#5ec8ff');
    portao(7, '#ffb347');

    // os enfeites das rotas: rochas grandes de um lado, a estação (módulos e vigas) do outro
    const er = sorteio(31);
    for (let k = 0; k < 40; k++) {
      const ramo: 1 | 2 = k % 2 === 0 ? 1 : 2;
      const lado = er() < 0.5 ? -1 : 1;
      // (na rota do gelo, as duas rotas passam entre rochas: a nebulosa e o anel de gelo)
      const o = ramo === 1 || gelo ? this.clonar(er() < 0.5 ? 'rock_B' : 'rocks_A', 14 + er() * 16) : this.clonar(er() < 0.5 ? 'basemodule_A' : 'dome', 6 + er() * 4);
      const giro = er() * Math.PI * 2;
      o.rotation.set(er() * 3, giro, er() * 3);
      if (ramo === 2 && !gelo) o.rotation.set(0, giro, 0);
      o.position.set(lado * (24 + er() * 30), -14 + er() * 28, zb + 40 + er() * (zNave(CHEFE_T) - zb + 200));
      c.add(o);
      this.enfeitesDasRotas.push({ o, ramo, lado, giro });
    }

    // os anéis
    const prata = this.material(new THREE.MeshStandardMaterial({ color: '#dfe7f2', metalness: 0.9, roughness: 0.2, emissive: '#7f97b8', emissiveIntensity: 0.5 }));
    const ouro = this.material(new THREE.MeshStandardMaterial({ color: '#ffd24a', metalness: 0.9, roughness: 0.25, emissive: '#b8860b', emissiveIntensity: 0.7 }));
    const ga = this.geometria(new THREE.TorusGeometry(RAIO_ANEL, 0.28, 10, 28));
    for (const a of r.aneis) {
      const m = new THREE.Mesh(ga, a.ouro ? ouro : prata);
      m.position.set(a.x, a.y, a.z);
      c.add(m);
      this.aneis.push(m);
    }

    // as balas, os tiros travados e os tiros inimigos
    const gb = this.geometria(new THREE.BoxGeometry(0.16, 0.16, 2.2));
    this.balas = new THREE.InstancedMesh(gb, this.material(new THREE.MeshBasicMaterial({ color: '#7dff9a', fog: false })), 80);
    this.balas.frustumCulled = false;
    const gt = this.geometria(new THREE.SphereGeometry(0.55, 12, 8));
    this.travas = new THREE.InstancedMesh(gt, this.material(new THREE.MeshBasicMaterial({ color: '#ff7ae0', fog: false })), 8);
    this.travas.frustumCulled = false;
    const gi = this.geometria(new THREE.IcosahedronGeometry(0.5, 1));
    this.tiros = new THREE.InstancedMesh(gi, this.material(new THREE.MeshBasicMaterial({ color: '#ff5a3c', fog: false })), 200);
    this.tiros.frustumCulled = false;
    c.add(this.balas, this.travas, this.tiros);

    // a mira: dois quadros à frente da nave; e a marca do alvo travado
    this.mira = new THREE.Group();
    const quadro = (lado: number) => {
      const g = new THREE.Group();
      const mat = this.material(new THREE.MeshBasicMaterial({ color: '#8dffb0', transparent: true, opacity: 0.8, depthTest: false, fog: false }));
      for (const [x, y, w, h] of [
        [0, lado / 2, lado, 0.1],
        [0, -lado / 2, lado, 0.1],
        [lado / 2, 0, 0.1, lado],
        [-lado / 2, 0, 0.1, lado],
      ]) {
        const m = new THREE.Mesh(caixaG, mat);
        m.scale.set(w, h, 0.05);
        m.position.set(x, y, 0);
        m.renderOrder = 5;
        g.add(m);
      }
      return g;
    };
    const perto = quadro(1.4);
    perto.position.z = 14;
    const longe = quadro(2.2);
    longe.position.z = 30;
    this.mira.add(perto, longe);
    c.add(this.mira);
    this.marca = new THREE.Mesh(this.geometria(new THREE.RingGeometry(1, 1.25, 4)), this.material(new THREE.MeshBasicMaterial({ color: '#ff4f7b', side: THREE.DoubleSide, depthTest: false, transparent: true, fog: false })));
    this.marca.renderOrder = 6;
    this.marca.visible = false;
    c.add(this.marca);
  }

  // ---------------------------------------------------------------------------------------------------------------
  // AS NAVES
  // ---------------------------------------------------------------------------------------------------------------

  private montarNave(g: GLTF, n: NaveNaCena): NaveMontada {
    const raiz = new THREE.Group();
    const corpo = new THREE.Group();
    raiz.add(corpo);
    const materiais: THREE.Material[] = [];
    const mat = (cor: string, extra: THREE.MeshStandardMaterialParameters = {}) => {
      const m = new THREE.MeshStandardMaterial({ color: cor, roughness: 0.45, metalness: 0.25, ...extra });
      if (n.fantasma) {
        m.transparent = true;
        m.opacity = 0.45;
        m.depthWrite = false;
      }
      materiais.push(m);
      return m;
    };
    const branco = mat(n.pintura ?? '#f3f1ea');
    const laranja = mat('#f28a2e');
    const escuro = mat('#2f3646');
    // o corpo: o bico para a frente (+z), a traseira larga
    const bico = new THREE.Mesh(new THREE.ConeGeometry(0.55, 2.4, 6), branco);
    bico.rotation.x = Math.PI / 2;
    bico.position.z = 1.1;
    const ponta = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.6, 6), laranja);
    ponta.rotation.x = Math.PI / 2;
    ponta.position.z = 2.45;
    const traseira = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.62, 1.4, 6), branco);
    traseira.rotation.x = Math.PI / 2;
    traseira.position.z = -0.8;
    const bocal = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.3, 8), escuro);
    bocal.rotation.x = Math.PI / 2;
    bocal.position.z = -1.6;
    corpo.add(bico, ponta, traseira, bocal);
    // as asas curtas, com a ponta laranja levantada
    for (const lado of [-1, 1]) {
      const asa = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.12, 1.2), branco);
      asa.position.set(lado * 1.3, -0.15, -0.6);
      asa.rotation.y = lado * -0.25;
      const pontaDaAsa = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.9, 1.0), laranja);
      pontaDaAsa.position.set(lado * 2.35, 0.2, -0.85);
      pontaDaAsa.rotation.z = lado * -0.35;
      corpo.add(asa, pontaDaAsa);
    }
    const leme = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.8, 0.9), laranja);
    leme.position.set(0, 0.55, -1.15);
    corpo.add(leme);
    // a cabine de vidro e o coelho dentro dela
    const vidro = new THREE.MeshStandardMaterial({ color: '#8fe3ff', transparent: true, opacity: n.fantasma ? 0.2 : 0.35, roughness: 0.05, metalness: 0.1, depthWrite: false });
    materiais.push(vidro);
    const cabine = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 10), vidro);
    cabine.scale.set(1, 0.85, 1.7);
    cabine.position.set(0, 0.42, 0.15);
    cabine.renderOrder = 2;
    corpo.add(cabine);
    const coelho = copiarCoelho(g, { altura: 1.1, cores: n.cores, contorno: !n.fantasma });
    if (n.fantasma) {
      coelho.material.m.transparent = true;
      coelho.material.m.depthWrite = false;
      coelho.material.uOpaco.value = 0.45;
    }
    // o coelho olha para a frente da nave (o +z), de costas para a câmera
    coelho.corpo.rotation.y = Math.PI;
    coelho.corpo.position.set(0, -0.14, -0.05);
    corpo.add(coelho.corpo);
    (coelho.acoes.get('sentado') ?? coelho.acoes.get('parado'))?.play();
    // o fogo do motor
    const fogoM = new THREE.MeshBasicMaterial({ color: '#ff9a3c', transparent: true, opacity: n.fantasma ? 0.35 : 0.8, fog: false, blending: THREE.AdditiveBlending, depthWrite: false });
    materiais.push(fogoM);
    const fogo = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.9, 8), fogoM);
    fogo.rotation.x = -Math.PI / 2;
    fogo.position.z = -2.05;
    corpo.add(fogo);
    corpo.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && !o.userData.contornoDoCoelho && m.geometry && !(m as THREE.SkinnedMesh).isSkinnedMesh) this.descartaveis.push(m.geometry);
    });
    if (n.nome) {
      const e = etiqueta(n.nome);
      e.position.y = 1.8;
      raiz.add(e);
      this.descartaveis.push(e.material.map!, e.material);
    }
    this.cena.add(raiz);
    return { raiz, corpo, fogo, coelho, materiais, rolar: 0, inclinar: 0 };
  }

  private posicionarNave(n: NaveMontada, q: QuadroDaNave, z: number, dt: number) {
    n.raiz.visible = !q.escondida && !(q.pisca && Math.floor(this.relogio * 12) % 2 === 0);
    n.raiz.position.set(q.x, q.y, z);
    const k = Math.min(1, dt * 10);
    n.rolar += (-q.vx * 2.2 - n.rolar) * k;
    n.inclinar += (-q.vy * 1.6 - n.inclinar) * k;
    n.corpo.rotation.set(n.inclinar, -q.vx * 0.6, n.rolar + (q.giro !== null ? q.giro * Math.PI * 2 * (this.calmo ? 0.25 : 1) : 0));
    const pulso = this.calmo ? 1 : 0.85 + 0.15 * Math.sin(this.relogio * 40);
    n.fogo.scale.set(pulso, pulso, pulso);
    n.coelho.mixer.update(dt);
  }

  // ---------------------------------------------------------------------------------------------------------------
  // OS INIMIGOS
  // ---------------------------------------------------------------------------------------------------------------

  private criarInimigo(tipo: Tipo, i: number): THREE.Object3D {
    const g = new THREE.Group();
    const olho = this.material(new THREE.MeshBasicMaterial({ color: '#ff3b3b' }));
    const metal = this.material(new THREE.MeshStandardMaterial({ color: '#8d96a8', metalness: 0.7, roughness: 0.35 }));
    const roxo = this.material(new THREE.MeshStandardMaterial({ color: '#5b3f8a', metalness: 0.5, roughness: 0.4 }));
    if (tipo === 'drone') {
      const o = this.clonar('lander_A', 1.6);
      o.position.y = -0.95;
      g.add(o);
      const e = new THREE.Mesh(this.geometria(new THREE.SphereGeometry(0.28, 10, 8)), olho);
      e.position.set(0, 0.1, -0.95);
      g.add(e);
    } else if (tipo === 'cacador') {
      const corpo = new THREE.Mesh(this.geometria(new THREE.OctahedronGeometry(1.1)), roxo);
      corpo.scale.set(1, 0.6, 1.3);
      g.add(corpo);
      for (const lado of [-1, 1]) {
        const asa = new THREE.Mesh(this.geometria(new THREE.BoxGeometry(1.6, 0.1, 0.7)), metal);
        asa.position.set(lado * 1.2, 0, 0.2);
        asa.rotation.z = lado * 0.4;
        g.add(asa);
      }
      const e = new THREE.Mesh(this.geometria(new THREE.SphereGeometry(0.3, 10, 8)), olho);
      e.position.set(0, 0.1, -1.2);
      g.add(e);
    } else if (tipo === 'cargueiro') {
      const o = this.clonar('dropship', 2.1);
      o.rotation.y = Math.PI;
      o.position.y = -0.6;
      g.add(o);
    } else if (tipo === 'torre') {
      const base = new THREE.Mesh(this.geometria(new THREE.CylinderGeometry(1.1, 1.3, 0.8, 8)), metal);
      const cabeca = new THREE.Mesh(this.geometria(new THREE.SphereGeometry(0.85, 12, 8)), roxo);
      cabeca.position.y = 0.6;
      const cano = new THREE.Mesh(this.geometria(new THREE.CylinderGeometry(0.18, 0.22, 1.6, 8)), metal);
      cano.rotation.x = Math.PI / 2;
      cano.position.set(0, 0.7, -1);
      const e = new THREE.Mesh(this.geometria(new THREE.SphereGeometry(0.2, 8, 6)), olho);
      e.position.set(0, 0.85, -0.7);
      g.add(base, cabeca, cano, e);
      g.userData.cabeca = cabeca;
    } else if (tipo === 'rocha') {
      const o = this.clonar(i % 2 ? 'rock_B' : 'rock_A', 6);
      o.position.set(-0.2, -1.2, 0);
      const p = new THREE.Group();
      p.add(o);
      g.add(p);
      g.userData.gira = p;
    } else if (tipo === 'subchefe') {
      const o = this.clonar('spacetruck_large', 10);
      o.rotation.y = Math.PI;
      o.position.y = -1.6;
      g.add(o);
      const canhao = new THREE.Mesh(this.geometria(new THREE.CylinderGeometry(0.5, 0.6, 3.4, 8)), roxo);
      canhao.rotation.x = Math.PI / 2.4;
      canhao.position.set(0, 4.2, -1.5);
      const e = new THREE.Mesh(this.geometria(new THREE.SphereGeometry(0.7, 12, 8)), olho);
      e.position.set(0, 3.8, -3.1);
      g.add(canhao, e);
    } else if (tipo === 'mina') {
      // a mina da rota do gelo (por código): a bola de metal com os espetos e a luz vermelha em cima
      const bola = new THREE.Mesh(this.geometria(new THREE.IcosahedronGeometry(0.85, 1)), metal);
      g.add(bola);
      const espeto = this.geometria(new THREE.ConeGeometry(0.18, 0.6, 6));
      for (const [x, y, z] of [
        [1, 0, 0],
        [-1, 0, 0],
        [0, 1, 0],
        [0, -1, 0],
        [0, 0, 1],
        [0, 0, -1],
      ]) {
        const m = new THREE.Mesh(espeto, roxo);
        m.position.set(x * 0.95, y * 0.95, z * 0.95);
        m.lookAt(x * 2, y * 2, z * 2);
        m.rotateX(Math.PI / 2);
        g.add(m);
      }
      const e = new THREE.Mesh(this.geometria(new THREE.SphereGeometry(0.25, 8, 6)), olho);
      e.position.set(0, 0.55, -0.6);
      g.add(e);
      g.userData.gira = bola;
    } else if (tipo === 'sentinela') {
      // a sentinela (por código): o anel grande que gira em volta do miolo com o olho
      metal.emissive.set('#3a4a66');
      roxo.emissive.set('#2a3f6a');
      const anel = new THREE.Mesh(this.geometria(new THREE.TorusGeometry(3, 0.55, 10, 32)), metal);
      const miolo = new THREE.Mesh(this.geometria(new THREE.SphereGeometry(1.5, 16, 12)), roxo);
      const e = new THREE.Mesh(this.geometria(new THREE.SphereGeometry(0.7, 12, 8)), olho);
      e.position.set(0, 0, -1.3);
      const giro = new THREE.Group();
      giro.add(anel);
      for (let k = 0; k < 4; k++) {
        const luz = new THREE.Mesh(this.geometria(new THREE.SphereGeometry(0.35, 8, 6)), olho);
        const a = (k / 4) * Math.PI * 2;
        luz.position.set(Math.cos(a) * 3, Math.sin(a) * 3, 0);
        giro.add(luz);
      }
      g.add(giro, miolo, e);
      g.userData.anel = giro;
    } else if (tipo === 'mae') {
      // a nave-mãe: o cargueiro do pacote em tamanho de chefe, com a ponte de comando, o hangar aceso e os canhões
      metal.emissive.set('#3a3550');
      roxo.emissive.set('#3b2466');
      const o = this.clonar('dropship', 7);
      o.rotation.y = Math.PI;
      o.position.y = -2;
      const ponte = new THREE.Mesh(this.geometria(new THREE.BoxGeometry(3, 1.6, 2.4)), roxo);
      ponte.position.set(0, 2.6, 1.5);
      const hangar = new THREE.Mesh(this.geometria(new THREE.BoxGeometry(3.2, 1.2, 0.3)), this.material(new THREE.MeshBasicMaterial({ color: '#ffd24a' })));
      hangar.position.set(0, -0.6, -4.2);
      const e = new THREE.Mesh(this.geometria(new THREE.SphereGeometry(0.8, 12, 8)), olho);
      e.position.set(0, 2.6, 0.2);
      g.add(o, ponte, hangar, e);
      for (const lado of [-1, 1]) {
        const canhao = new THREE.Mesh(this.geometria(new THREE.CylinderGeometry(0.4, 0.5, 3, 8)), metal);
        canhao.rotation.x = Math.PI / 2;
        canhao.position.set(lado * 4.5, 0.4, -2.5);
        g.add(canhao);
      }
    } else {
      // o polvo de lata: a cabeça redonda, o olho grande e oito braços em gomos (com um brilho próprio: no espaço a luz é pouca)
      metal.emissive.set('#3a3550');
      roxo.emissive.set('#3b2466');
      const cabeca = new THREE.Mesh(this.geometria(new THREE.SphereGeometry(4, 20, 14)), metal);
      cabeca.scale.set(1, 0.9, 1);
      const capacete = new THREE.Mesh(this.geometria(new THREE.SphereGeometry(4.1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2.6)), roxo);
      const branco = this.material(new THREE.MeshStandardMaterial({ color: '#f4f4f4', roughness: 0.3 }));
      const olhoG = new THREE.Mesh(this.geometria(new THREE.SphereGeometry(1.5, 16, 12)), branco);
      olhoG.position.set(0, 0.4, -3.3);
      const pupila = new THREE.Mesh(this.geometria(new THREE.SphereGeometry(0.75, 12, 8)), olho);
      pupila.position.set(0, 0.4, -4.55);
      g.add(cabeca, capacete, olhoG, pupila);
      const gomo = this.geometria(new THREE.SphereGeometry(0.75, 10, 8));
      const bracos: THREE.Group[] = [];
      for (let k = 0; k < 8; k++) {
        const braco = new THREE.Group();
        const a = (k / 8) * Math.PI * 2;
        braco.position.set(Math.cos(a) * 3, -2.4, Math.sin(a) * 3);
        braco.rotation.y = -a;
        for (let j = 0; j < 5; j++) {
          const m = new THREE.Mesh(gomo, j % 2 ? metal : roxo);
          m.scale.setScalar(1 - j * 0.14);
          m.position.set(j * 1.15, -j * 0.5, 0);
          braco.add(m);
        }
        g.add(braco);
        bracos.push(braco);
      }
      g.userData.bracos = bracos;
      // o raio dele na regra é 6: o desenho de raio 4 vai 1,5 vez maior
      g.userData.escala = 1.5;
    }
    this.cena.add(g);
    return g;
  }

  private explodir(tipo: string, x: number, y: number, z: number, grande: boolean, em: number) {
    let m = this.poolDeExplosoes.pop();
    if (!m) {
      m = new THREE.Mesh(this.geometria(new THREE.IcosahedronGeometry(1, 1)), new THREE.MeshBasicMaterial({ color: '#ffb347', transparent: true, fog: false, depthWrite: false }));
      this.descartaveis.push(m.material as THREE.Material);
      this.cena.add(m);
    }
    const cor = tipo === 'explosao' || tipo === 'perdeu' ? '#ffb347' : tipo === 'bomba' ? '#bfe8ff' : tipo === 'anel' ? '#fff3b0' : tipo === 'desvio' ? '#7fd8ff' : tipo === 'pegou' ? '#7dff9a' : '#fff07a';
    (m.material as THREE.MeshBasicMaterial).color.set(cor);
    m.position.set(x, y, z);
    m.visible = true;
    this.explosoes.push({ m, tipo, em, grande });
  }

  // ---------------------------------------------------------------------------------------------------------------
  // O QUADRO
  // ---------------------------------------------------------------------------------------------------------------

  private vistos = new Set<string>();

  desenhar(q: Quadro) {
    if (this.morta) return;
    this.relogio += q.dt;
    const m = q.mundo;
    const r = m.r;
    const n = q.passo;
    const zn = zNave(n);
    const nInteiro = Math.floor(n);

    // o céu: o planeta até a subida, e o espaço depois
    const subida = Math.max(0, Math.min(1, (zn - (Z_FIM_DO_CHAO - 120)) / 220));
    const bg = this.cena.background as THREE.Color;
    bg.copy(this.ceu).lerp(this.espaco, subida);
    const fog = this.cena.fog as THREE.Fog;
    fog.color.copy(bg);
    fog.near = 70 + subida * 200;
    fog.far = 230 + subida * 500;
    (this.estrelas.material as THREE.PointsMaterial).opacity = subida;
    if (this.cupula) {
      this.cupula.misturar(subida);
      this.cupula.chao.copy(bg);
    }
    this.hemi.intensity = 1.5 - subida * 0.5;
    this.hemi.groundColor.set(subida > 0.5 ? '#2a2f5a' : '#8a4a2a');
    // o chão desce na subida (a nave sobe para o espaço)
    const queda = subida * subida * 140;
    this.chao.position.y = CHAO - queda;
    this.chao.visible = subida < 1;
    // os enfeites do chão: cada um no seu lugar da fila, à frente da nave
    const passo = 22;
    for (const e of this.enfeitesDoChao) {
      // o primeiro lugar da fila deste enfeite (k, k + total, k + 2·total…) que ainda está à frente da nave
      const total = this.enfeitesDoChao.length;
      const idx = e.k + total * Math.max(0, Math.ceil(((zn - 30) / (passo / 2) - e.k) / total));
      const z = (idx * passo) / 2 + 10;
      const sr = sorteio(idx * 7 + 3);
      const lado = idx % 2 ? 1 : -1;
      const x = lado * (19 + sr() * 70);
      e.o.position.set(x, CHAO - queda, z);
      e.o.rotation.y = sr() * Math.PI * 2;
      e.o.visible = z < Z_FIM_DO_CHAO && z > zn - 30 && subida < 1;
    }
    for (const ob of this.obstaculos) {
      ob.o.visible = ob.z > zn - 15 && ob.z < zn + 260 && (ob.ramo === 0 || ob.ramo === q.ramo || (q.ramo === 0 && nInteiro < BIFURCA));
    }
    for (const e of this.enfeitesDasRotas) {
      const naRota = q.ramo === 0 ? (e.ramo === 1 ? e.lado < 0 : e.lado > 0) : e.ramo === q.ramo;
      e.o.visible = naRota && e.o.position.z > zn - 40 && e.o.position.z < zn + 600;
      if (e.ramo === 1 && !this.calmo) e.o.rotation.y = e.giro + this.relogio * 0.05;
    }
    this.estrelas.position.set(0, 0, zn);

    // os anéis
    r.aneis.forEach((a, k) => {
      const mesh = this.aneis[k];
      const pego = m.ficha.aneis.has(k) && m.pilotando;
      mesh.visible = !pego && a.z > zn - 3 && a.z < zn + 260 && (a.ramo === 0 || a.ramo === q.ramo || (q.ramo === 0 && passoDoAnel(a) < BIFURCA));
      if (!this.calmo) mesh.rotation.z = this.relogio * 1.5;
    });

    // os inimigos
    const vivos = new Set<number>();
    for (const i of m.ativos) {
      const e = r.inimigos[i];
      if (!m.dePe(i, nInteiro)) continue;
      const p = posicaoInimigo(e, n);
      if (!p || p.z < zn - 8 || p.z > zn + 300) continue;
      vivos.add(i);
      let o = this.inimigos.get(i);
      if (!o) {
        o = this.criarInimigo(e.tipo, i);
        this.inimigos.set(i, o);
      }
      o.position.set(p.x, p.y, p.z);
      const vira = q.eu ? Math.atan2(q.eu.x - p.x, -(p.z - zn)) * 0.5 : 0;
      if (e.tipo !== 'rocha' && e.tipo !== 'mina' && !ehChefe(e.tipo)) o.rotation.y = vira;
      if (e.tipo === 'drone' && !this.calmo) o.rotation.z = Math.sin(this.relogio * 3 + i) * 0.2;
      if (o.userData.gira && !this.calmo) (o.userData.gira as THREE.Object3D).rotation.set(this.relogio * 0.7 + i, this.relogio * 0.4, 0);
      if (o.userData.bracos) {
        (o.userData.bracos as THREE.Group[]).forEach((b, k) => {
          b.rotation.z = this.calmo ? -0.3 : -0.3 + Math.sin(this.relogio * 2 + k) * 0.35;
        });
        if (!this.calmo) o.rotation.y = Math.sin(this.relogio * 0.5) * 0.25;
      }
      if (o.userData.anel && !this.calmo) (o.userData.anel as THREE.Object3D).rotation.z = this.relogio * 1.2;
      // o golpe faz o inimigo piscar de branco por um instante
      const ferido = m.efeitos.some((f) => f.tipo === 'faisca' && nInteiro - f.em < 4 && Math.abs(f.z - p.z) < 6 && Math.abs(f.x - p.x) < 5);
      o.scale.setScalar(((o.userData.escala as number | undefined) ?? 1) * (ferido ? 1.08 : 1));
    }
    for (const [i, o] of this.inimigos) {
      if (vivos.has(i)) continue;
      this.cena.remove(o);
      this.inimigos.delete(i);
    }

    // os itens soltos
    const soltos = new Set<number>();
    for (const [i, caiu] of m.soltos) {
      const p = posicaoItem(r.inimigos[i], caiu, n);
      if (!p) continue;
      soltos.add(i);
      let o = this.itens.get(i);
      if (!o) {
        const item = r.inimigos[i].item;
        const mat = this.material(new THREE.MeshStandardMaterial({ color: item === 'bomba' ? '#ff5a6e' : '#5dff8a', emissive: item === 'bomba' ? '#a3203a' : '#1f9a45', emissiveIntensity: 0.9, metalness: 0.3, roughness: 0.3 }));
        o = new THREE.Mesh(item === 'bomba' ? this.geometria(new THREE.SphereGeometry(0.9, 14, 10)) : this.geometria(new THREE.OctahedronGeometry(1.1)), mat);
        this.cena.add(o);
        this.itens.set(i, o);
      }
      o.position.set(p.x, p.y, p.z);
      if (!this.calmo) o.rotation.y = this.relogio * 3;
    }
    for (const [i, o] of this.itens) {
      if (soltos.has(i)) continue;
      this.cena.remove(o);
      this.itens.delete(i);
    }

    // as balas, os tiros travados e os tiros inimigos
    let k = 0;
    for (const b of m.balas) {
      const p = posicaoBala(b.p, b.x, b.y, b.arma, b.b, n);
      if (!p || k >= 80) continue;
      this.gTiro.position.set(p.x, p.y, p.z);
      this.gTiro.rotation.set(0, 0, 0);
      this.gTiro.scale.setScalar(1);
      this.gTiro.updateMatrix();
      this.balas.setMatrixAt(k++, this.gTiro.matrix);
    }
    this.balas.count = k;
    this.balas.instanceMatrix.needsUpdate = true;
    k = 0;
    for (const tv of m.travas) {
      const alvo = posicaoInimigo(r.inimigos[tv.i], Math.min(n, tv.q));
      if (!alvo || k >= 8) continue;
      const u = Math.max(0, Math.min(1, (n - tv.p) / Math.max(1, tv.q - tv.p)));
      const de = { x: tv.x, y: tv.y, z: zNave(tv.p) + 2 };
      // a curva do tiro: sobe um pouco no meio do caminho
      this.gTiro.position.set(de.x + (alvo.x - de.x) * u, de.y + (alvo.y - de.y) * u + Math.sin(u * Math.PI) * 2, de.z + (alvo.z - de.z) * u);
      this.gTiro.scale.setScalar(1 + 0.2 * Math.sin(this.relogio * 30));
      this.gTiro.updateMatrix();
      this.travas.setMatrixAt(k++, this.gTiro.matrix);
    }
    this.travas.count = k;
    this.travas.instanceMatrix.needsUpdate = true;
    k = 0;
    for (const t of m.tiros) {
      if (k >= 200) break;
      const p = posicaoTiro(t, n);
      this.gTiro.position.set(p.x, p.y, p.z);
      this.gTiro.scale.setScalar(1);
      this.gTiro.rotation.set(this.relogio * 5, this.relogio * 4, 0);
      this.gTiro.updateMatrix();
      this.tiros.setMatrixAt(k++, this.gTiro.matrix);
    }
    this.tiros.count = k;
    this.tiros.instanceMatrix.needsUpdate = true;

    // os efeitos novos viram explosões, e as explosões crescem e somem
    for (const ef of m.efeitos) {
      const chave = `${ef.tipo}:${ef.em}:${Math.round(ef.x * 10)}:${Math.round(ef.z)}`;
      if (this.vistos.has(chave)) continue;
      this.vistos.add(chave);
      this.explodir(ef.tipo, ef.x, ef.y, ef.z, !!ef.grande, ef.em);
    }
    if (this.vistos.size > 400) this.vistos = new Set([...this.vistos].slice(-200));
    this.explosoes = this.explosoes.filter((ex) => {
      const idade = n - ex.em;
      const dura = ex.tipo === 'bomba' ? 40 : ex.grande ? 34 : 18;
      if (idade > dura || idade < -2) {
        ex.m.visible = false;
        this.poolDeExplosoes.push(ex.m);
        return false;
      }
      const u = Math.max(0, idade) / dura;
      const max = ex.tipo === 'bomba' ? BOMBA_RAIO : ex.tipo === 'faisca' || ex.tipo === 'desvio' ? (ex.grande ? 2 : 0.9) : ex.tipo === 'anel' ? RAIO_ANEL * 1.6 : ex.grande ? 7 : 3;
      ex.m.scale.setScalar(0.3 + max * Math.sqrt(u));
      (ex.m.material as THREE.MeshBasicMaterial).opacity = 1 - u;
      return true;
    });

    // as naves: a minha, a da turma (no meu plano) e as alas do computador
    let idx = 0;
    if (q.eu) {
      this.posicionarNave(this.naves[0], q.eu, zn, q.dt);
      idx = 1;
    }
    q.outros.forEach((o, j) => {
      const nave = this.naves[idx + j];
      if (nave) this.posicionarNave(nave, o, zn - 1.5, q.dt);
    });
    const ref = q.eu ?? { x: 0, y: 0 };
    for (const a of this.alas) {
      const alvoX = Math.max(-LIM_X - 4, Math.min(LIM_X + 4, ref.x * 0.4 + (a.nave === this.alas[0].nave ? -8 : 8)));
      const alvoY = Math.max(-LIM_Y, Math.min(LIM_Y + 2, ref.y * 0.4 + 2.5 + (this.calmo ? 0 : Math.sin(this.relogio * 0.8 + a.x) * 0.6)));
      const kk = Math.min(1, q.dt * 2.2);
      const vx = (alvoX - a.x) * kk;
      const vy = (alvoY - a.y) * kk;
      a.x += vx;
      a.y += vy;
      this.posicionarNave(a.nave, { x: a.x, y: a.y, vx: vx * 3, vy: vy * 3, giro: null, pisca: false }, zn + 7, q.dt);
    }

    // a mira e a marca do alvo travado
    if (q.eu && !q.eu.escondida) {
      this.mira.visible = true;
      this.mira.position.set(q.eu.x, q.eu.y, zn);
      const cor = q.carga >= 1 ? '#ff7ae0' : '#8dffb0';
      this.mira.traverse((o) => {
        const mm = (o as THREE.Mesh).material as THREE.MeshBasicMaterial | undefined;
        if (mm?.color) mm.color.set(cor);
      });
    } else this.mira.visible = false;
    const alvo = q.alvo !== null ? posicaoInimigo(r.inimigos[q.alvo], n) : null;
    this.marca.visible = !!alvo;
    if (alvo) {
      const raio = q.alvo !== null && ehChefe(r.inimigos[q.alvo].tipo) ? 5 : 2;
      this.marca.position.set(alvo.x, alvo.y, alvo.z);
      this.marca.scale.setScalar(raio);
      this.marca.lookAt(this.camera.position);
      if (!this.calmo) this.marca.rotateZ(this.relogio * 3);
    }

    // a câmera atrás da nave, um pouco acima, olhando à frente; no chefe, um pouco mais longe
    const cx = ref.x * 0.75;
    const cy = ref.y * 0.75 + 2.3;
    const longe = n > CHEFE_T || (n > SUBCHEFE_T && n < SUBCHEFE_T + 960) ? 1.5 : 0;
    this.camera.position.set(cx, cy + longe * 0.4, zn - 11 - longe);
    this.camera.lookAt(ref.x * 0.55, ref.y * 0.6 + 0.6, zn + 28);
    this.sol.position.set(30 + cx, 60, zn - 20);
    this.sol.target.position.set(cx, 0, zn + 20);
    this.renderer.render(this.cena, this.camera);
  }

  destruir() {
    this.morta = true;
    this.observador.disconnect();
    this.renderer.domElement.removeEventListener('webglcontextlost', this.perdeu);
    for (const n of [...this.naves, ...this.alas.map((a) => a.nave)]) {
      n.coelho.descartar();
      for (const m of n.materiais) m.dispose();
    }
    for (const d of this.descartaveis) d.dispose();
    this.renderer.forceContextLoss();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
