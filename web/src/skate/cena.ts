import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { PASSO, type Skatista } from './fisica';
import { altura, alturaDaPeca, LARGURA, PECAS, PROFUNDIDADE } from './pista';

/**
 * A CENA DO SKATE (05/11/2026): a pista de pista.ts com as peças do Mini Skate da Kenney (CC0, web/public/skate/License.txt),
 * e o skatista é o NOSSO coelho 3D (coelho-animado.glb, o esqueleto nosso de glb.py) em cima do skateboard.glb da Kenney.
 * Só a TELA: a física (fisica.ts) decide onde ele está; aqui se desenha, com a câmera atrás dele.
 *
 * Como as outras cenas 3D (cidades3d, naval3d): o three.js vem num pedaço à parte, só quando o jogo abre; sem foco na janela,
 * não desenha (quem chama para o laço); ao sair, o contexto é devolvido (forceContextLoss).
 */

const BASE = `${import.meta.env.BASE_URL}skate/`;
const COELHO = `${import.meta.env.BASE_URL}cidades3d/coelho-animado.glb`;
const ALTURA_DO_COELHO = 0.62;
/** O tampo da prancha, medido no skateboard.glb. */
const TAMPO = 0.15;

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

/** O ângulo (em torno do eixo vertical) de um vetor no chão, como o `rotation.y` do three.js o entende (o modelo olha para +z). */
const anguloDe = (x: number, z: number) => Math.atan2(x, z);

function aproximarAngulo(atual: number, alvo: number, k: number): number {
  let d = alvo - atual;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  return atual + d * k;
}

export class CenaDoSkate {
  private renderer: THREE.WebGLRenderer;
  private cena = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(62, 1, 0.05, 80);
  private observador: ResizeObserver;
  private morta = false;
  private sombras = false;
  private calmo = false;
  private descartaveis: { dispose(): void }[] = [];

  /** O skatista: a raiz anda e vira com o caminho; o corpo inclina; a prancha gira no flip. */
  private raiz = new THREE.Group();
  private inclina = new THREE.Group();
  private prancha = new THREE.Group();
  private coelho = new THREE.Group();
  private mixer: THREE.AnimationMixer | null = null;
  private acoes = new Map<string, THREE.AnimationAction>();
  private tocando = '';
  private sombra: THREE.Mesh;

  private anguloDaPrancha = 0;
  private anguloDaCamera = Math.PI;
  private camAlvo = new THREE.Vector3();
  private quadro = 0;
  /** O voo do vert: a altura de onde saiu (para virar o coelho no ar). */
  private saidaY = 0;
  private modoAntes = '';

  constructor(private caixa: HTMLElement) {
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
    canvas.className = 'skate-tela';
    caixa.appendChild(canvas);
    this.observador = new ResizeObserver(() => this.medir());
    this.observador.observe(caixa);
    this.medir();
    this.sombra = new THREE.Mesh(
      new THREE.CircleGeometry(0.3, 20),
      new THREE.MeshBasicMaterial({ color: '#1d2420', transparent: true, opacity: 0.3, depthWrite: false }),
    );
    this.sombra.rotation.x = -Math.PI / 2;
    this.sombra.userData.proprio = true;
  }

  private medir() {
    const w = Math.max(1, this.caixa.clientWidth);
    const h = Math.max(1, this.caixa.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** Carrega os modelos e monta a pista. Rejeita se algo falhar (quem chama mostra o aviso). */
  async montar(): Promise<void> {
    const nomes = [...new Set(PECAS.map((p) => p.modelo)), 'floor-concrete', 'fence', 'skateboard'];
    const [coelho, ...lista] = await Promise.all([carregar(COELHO), ...nomes.map((n) => carregar(`${BASE}${n}.glb`))]);
    if (this.morta) return;
    const modelos = new Map(nomes.map((n, i) => [n, lista[i]]));
    this.montarPista(modelos);
    this.montarSkatista(coelho, modelos.get('skateboard')!);
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

  private montarPista(modelos: Map<string, GLTF>) {
    const c = this.cena;
    c.background = new THREE.Color('#bfe0ee');
    c.fog = new THREE.Fog('#bfe0ee', 14, 34);
    c.add(new THREE.HemisphereLight('#fff6e8', '#8aa27a', 1.5));
    const sol = new THREE.DirectionalLight('#fff1d6', 2.1);
    sol.position.set(LARGURA / 2 - 6, 12, PROFUNDIDADE / 2 + 5);
    sol.target.position.set(LARGURA / 2, 0, PROFUNDIDADE / 2);
    c.add(sol.target);
    if (this.sombras) {
      sol.castShadow = true;
      sol.shadow.mapSize.set(2048, 2048);
      const s = sol.shadow.camera;
      s.left = -12;
      s.right = 12;
      s.top = 12;
      s.bottom = -12;
      s.near = 1;
      s.far = 40;
    }
    c.add(sol);

    // o gramado em volta e o piso de concreto da pista (um ladrilho só, esticado: a cor é uma só)
    const grama = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ color: '#86b06a', roughness: 1 }));
    grama.rotation.x = -Math.PI / 2;
    grama.position.set(LARGURA / 2, -0.01, PROFUNDIDADE / 2);
    grama.receiveShadow = this.sombras;
    grama.userData.proprio = true;
    c.add(grama);
    const piso = this.clonar(modelos.get('floor-concrete')!);
    piso.scale.set(LARGURA + 4, 1, PROFUNDIDADE + 4);
    piso.position.set(LARGURA / 2, 0, PROFUNDIDADE / 2);
    c.add(piso);

    for (const p of PECAS) {
      const o = this.clonar(modelos.get(p.modelo)!);
      o.position.set(p.x, p.perfil ? 0 : 0, p.z);
      o.rotation.y = (p.rot * Math.PI) / 2;
      c.add(o);
    }
    // a cerca: dos lados compridos, e atrás dos patamares dos quarters
    const cerca = modelos.get('fence')!;
    for (let j = 0; j < PROFUNDIDADE; j++) {
      for (const x of [-0.06, LARGURA + 0.06]) {
        const o = this.clonar(cerca);
        o.position.set(x, 0, j + 0.5);
        o.rotation.y = Math.PI / 2;
        c.add(o);
      }
    }
    for (let i = 0; i < LARGURA; i++) {
      for (const z of [-0.06, PROFUNDIDADE + 0.06]) {
        const o = this.clonar(cerca);
        o.position.set(i + 0.5, 0.8, z);
        c.add(o);
      }
    }
  }

  private montarSkatista(g: GLTF, prancha: GLTF) {
    // o coelho com o NOSSO esqueleto: a cópia leva o esqueleto junto (como em cidades3d/cena.ts)
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
    this.mixer = new THREE.AnimationMixer(corpo);
    for (const a of g.animations) this.acoes.set(a.name, this.mixer.clipAction(a));
    this.coelho.add(corpo);
    this.coelho.position.y = TAMPO;
    const tabua = this.clonar(prancha);
    this.prancha.add(tabua);
    this.inclina.add(this.prancha, this.coelho);
    this.raiz.add(this.inclina);
    this.cena.add(this.raiz, this.sombra);
    this.tocar('parado');
  }

  private tocar(nome: string) {
    if (this.tocando === nome) return;
    const nova = this.acoes.get(nome);
    if (!nova) return;
    const velha = this.acoes.get(this.tocando);
    nova.reset().play();
    if (velha) velha.crossFadeTo(nova, 0.15, false);
    this.tocando = nome;
  }

  /**
   * Desenha o skatista entre o passo anterior (`a`) e o de agora (`k`), a uma fração `f` do caminho (a física anda a 60 por
   * segundo, a tela no ritmo dela). `dt` é o tempo de tela desde o último quadro.
   */
  desenhar(a: { x: number; y: number; z: number }, k: Skatista, f: number, dt: number, empurrando: boolean) {
    if (this.morta) return;
    this.quadro++;
    const x = a.x + (k.x - a.x) * f;
    const y = a.y + (k.y - a.y) * f;
    const z = a.z + (k.z - a.z) * f;
    this.raiz.position.set(x, y, z);

    if (k.modo === 'ar' && this.modoAntes !== 'ar') this.saidaY = y;
    this.modoAntes = k.modo;

    // para onde a prancha aponta; no vert, o coelho vira no ar até a descida
    let alvo = anguloDe(k.cx, k.cz);
    if (k.modo === 'ar' && k.saida === 'vert') {
      const resta = (k.vy + Math.sqrt(Math.max(0, k.vy * k.vy + 2 * 6 * Math.max(0, y - this.saidaY + 0.25)))) / 6;
      const total = k.noAr * PASSO + resta;
      const p = total > 0 ? Math.min(1, (k.noAr * PASSO) / total) : 1;
      alvo += Math.PI * p * p * (3 - 2 * p);
    }
    this.anguloDaPrancha = this.quadro < 3 ? alvo : aproximarAngulo(this.anguloDaPrancha, alvo, Math.min(1, dt * 18));
    this.raiz.rotation.y = this.anguloDaPrancha;

    // a inclinação do chão sob a prancha (no quarter, ele fica quase de pé na parede)
    let pitch = 0;
    let roll = 0;
    if (k.modo === 'chao' || k.modo === 'manual') {
      const e = 0.05;
      const fx = Math.sin(this.anguloDaPrancha);
      const fz = Math.cos(this.anguloDaPrancha);
      const i = k.peca;
      const s = (alturaDaPeca(i, x + fx * e, z + fz * e) - alturaDaPeca(i, x - fx * e, z - fz * e)) / (2 * e);
      pitch = -Math.atan(s);
    }
    if (k.modo === 'grind') roll = k.equilibrio * 0.35;
    if (k.modo === 'manual') pitch += -0.32 + k.equilibrio * 0.25;
    this.inclina.rotation.x = this.inclina.rotation.x + (pitch - this.inclina.rotation.x) * Math.min(1, dt * (k.modo === 'ar' ? 4 : 14));
    this.inclina.rotation.z = roll;

    // o kickflip: a prancha dá uma volta em torno do comprimento, subindo um tico
    const flip = k.flip > 0 ? 1 - k.flip / 20 : 0;
    this.prancha.rotation.z = flip * Math.PI * 2;
    this.prancha.position.y = k.flip > 0 ? Math.sin(flip * Math.PI) * 0.12 : 0;

    // o coelho de lado na prancha (a base troca quando ele pousa de costas); agachado ao carregar o ollie e no grab
    const caido = k.modo === 'caido';
    this.coelho.rotation.y = (k.base > 0 ? -1 : 1) * (Math.PI / 2);
    const agacha = k.carga > 0 ? 0.78 : k.modo === 'ar' && k.grab > 0 ? 0.7 : k.modo === 'ar' ? 0.9 : 1;
    const empurra = empurrando && k.modo === 'chao' && !this.calmo ? Math.abs(Math.sin(performance.now() / 140)) * 0.04 : 0;
    this.coelho.scale.y += (agacha - this.coelho.scale.y) * Math.min(1, dt * 16);
    this.coelho.position.y = TAMPO + this.prancha.position.y * 0.5 - empurra;
    this.coelho.rotation.z = caido ? 0 : k.modo === 'ar' && k.grab > 0 ? 0.25 : 0;
    if (caido) {
      // a queda: o coelho estatelado ao lado, a prancha de ponta-cabeça
      this.coelho.rotation.x = -Math.PI / 2;
      this.coelho.position.set(0.25, 0.08, 0);
      this.prancha.rotation.z = Math.PI;
      this.prancha.position.y = 0.16;
    } else {
      this.coelho.rotation.x = 0;
      this.coelho.position.x = 0;
      this.coelho.position.z = 0;
    }
    this.tocar(caido ? (this.acoes.has('largado') ? 'largado' : 'parado') : 'parado');
    this.mixer?.update(this.calmo ? 0 : dt);

    // a sombra no chão, menor e mais clara com a altura
    const chao = altura(x, z);
    const alto = Math.max(0, y - chao);
    this.sombra.position.set(x, chao + 0.012, z);
    this.sombra.scale.setScalar(1 - Math.min(0.5, alto * 0.4));
    (this.sombra.material as THREE.MeshBasicMaterial).opacity = 0.3 * (1 - Math.min(0.7, alto * 0.5));

    // A CÂMERA: atrás, para onde ele anda; no ar, ela espera (não gira com os giros)
    if (k.modo !== 'ar' && k.modo !== 'caido' && k.vel > 0.2) {
      const quer = anguloDe(k.rx, k.rz);
      this.anguloDaCamera = this.quadro < 3 ? quer : aproximarAngulo(this.anguloDaCamera, quer, Math.min(1, dt * 3));
    }
    const ca = this.anguloDaCamera;
    const fx = Math.sin(ca);
    const fz = Math.cos(ca);
    const foco = new THREE.Vector3(x + fx * 1.1, Math.max(y, chao) * 0.6 + 0.35, z + fz * 1.1);
    const pos = new THREE.Vector3(x - fx * 2.5, Math.max(y * 0.7, 0) + 1.35, z - fz * 2.5);
    const debaixo = altura(Math.min(LARGURA, Math.max(0, pos.x)), Math.min(PROFUNDIDADE, Math.max(0, pos.z)));
    pos.y = Math.max(pos.y, debaixo + 0.6);
    // para a foto de conferência (só no site de desenvolvimento): a câmera em volta do skatista, de perto
    const teste = import.meta.env.DEV ? (window as { skateCameraDeTeste?: { giro: number; dist: number; alt: number } }).skateCameraDeTeste : undefined;
    if (teste) {
      foco.set(x, y + 0.35, z);
      pos.set(x + Math.sin(ca + teste.giro) * teste.dist, y + teste.alt, z + Math.cos(ca + teste.giro) * teste.dist);
    }
    const kk = this.quadro < 3 || teste ? 1 : Math.min(1, dt * 7);
    this.camera.position.lerp(pos, kk);
    this.camAlvo.lerp(foco, this.quadro < 3 ? 1 : Math.min(1, dt * 9));
    this.camera.lookAt(this.camAlvo);
    this.renderer.render(this.cena, this.camera);
  }

  destruir() {
    this.morta = true;
    this.observador.disconnect();
    this.mixer?.stopAllAction();
    this.cena.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      // a geometria e as texturas dos modelos ficam no cache (servem à próxima sessão); as nossas vão embora
      if (m.userData.proprio) {
        m.geometry.dispose();
        (m.material as THREE.Material).dispose();
      }
    });
    for (const d of this.descartaveis) d.dispose();
    this.renderer.forceContextLoss();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
