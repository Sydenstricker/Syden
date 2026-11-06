import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { carregarCoelho, copiarCoelho, minhasCoresDoCoelho, type CoelhoCopiado } from '../coelho3d';
import { PASSO, type Skatista } from './fisica';
import { MODELOS_DO_ENTORNO, montarEntorno } from './entorno';
import { altura, alturaDaPeca, LARGURA, pecaEm, PECAS, perfilDaPeca, PROFUNDIDADE, subidaDaPeca } from './pista';

/**
 * A CENA DO SKATE (05/11/2026): a pista de pista.ts com as peças do Mini Skate da Kenney (CC0, web/public/skate/License.txt),
 * e o skatista é o NOSSO coelho 3D (coelho-animado.glb, o esqueleto nosso de glb.py) em cima do skateboard.glb da Kenney.
 * Só a TELA: a física (fisica.ts) decide onde ele está; aqui se desenha, com a câmera atrás dele.
 *
 * Como as outras cenas 3D (cidades3d, naval3d): o three.js vem num pedaço à parte, só quando o jogo abre; sem foco na janela,
 * não desenha (quem chama para o laço); ao sair, o contexto é devolvido (forceContextLoss).
 */

const BASE = `${import.meta.env.BASE_URL}skate/`;
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

const CIMA = new THREE.Vector3(0, 1, 0);
/** O disco da sombra nasce de pé (no plano xy): este giro o deita. */
const SOMBRA_DEITADA = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);

/**
 * A normal do chão da peça `i` no ponto (pela diferença de alturas, nos dois eixos). No quarter ela deita até quase a
 * horizontal; o mínimo de y segura a parede de pé (o patamar do quarter é um degrau, e a diferença ali seria infinita).
 */
function normalDoChao(i: number, x: number, z: number, saida: THREE.Vector3): THREE.Vector3 {
  const e = 0.04;
  const dx = (alturaDaPeca(i, x + e, z) - alturaDaPeca(i, x - e, z)) / (2 * e);
  const dz = (alturaDaPeca(i, x, z + e) - alturaDaPeca(i, x, z - e)) / (2 * e);
  saida.set(-dx, 1, -dz).normalize();
  if (saida.y < 0.12) {
    saida.y = 0.12;
    const h = Math.hypot(saida.x, saida.z) || 1;
    const k = Math.sqrt(1 - 0.12 * 0.12) / h;
    saida.x *= k;
    saida.z *= k;
  }
  return saida;
}

function aproximarAngulo(atual: number, alvo: number, k: number): number {
  let d = alvo - atual;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  return atual + d * k;
}

export class CenaDoSkate {
  private renderer: THREE.WebGLRenderer;
  private cena = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(62, 1, 0.05, 260);
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
  private copia: CoelhoCopiado | null = null;
  private mixer: THREE.AnimationMixer | null = null;
  private acoes = new Map<string, THREE.AnimationAction>();
  private tocando = '';
  private sombra: THREE.Mesh;

  private anguloDaPrancha = 0;
  /** O giro que deita o skatista no chão (de cima para a normal dele), amortecido: no quarter, ele fica de pé NA PAREDE. */
  private noChao = new THREE.Quaternion();
  private aux = { n: new THREE.Vector3(), q: new THREE.Quaternion(), giro: new THREE.Quaternion(), foco: new THREE.Vector3(), pos: new THREE.Vector3() };
  /** A altura que a câmera segue (amortecida à parte: na rampa ela sobe junto, sem tranco). */
  private camY = 0;
  private anguloDaCamera = Math.PI;
  private camAlvo = new THREE.Vector3();
  private quadro = 0;
  /** O voo do vert: a altura de onde saiu (para virar o coelho no ar). */
  private saidaY = 0;
  /** A câmera do VERT (0 a 1) e para que lado sobe a parede em que ele está. */
  private vert = 0;
  private subida: [number, number] = [0, -1];
  private readonly focoVert = new THREE.Vector3();
  private readonly posVert = new THREE.Vector3();
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
    this.sombra.quaternion.copy(SOMBRA_DEITADA);
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
    // o entorno (entorno.ts) é enfeite: o modelo que não carregar fica de fora, sem segurar o jogo
    const entorno = Promise.allSettled(MODELOS_DO_ENTORNO.map((n) => carregar(`${BASE}${n}.glb`)));
    const [coelho, ...lista] = await Promise.all([carregarCoelho(), ...nomes.map((n) => carregar(`${BASE}${n}.glb`))]);
    const extras = await entorno;
    if (this.morta) return;
    const modelos = new Map(nomes.map((n, i) => [n, lista[i]]));
    extras.forEach((r, i) => r.status === 'fulfilled' && modelos.set(MODELOS_DO_ENTORNO[i], r.value));
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
    // o céu, a grama, o parque e o bairro em volta (entorno.ts); a neblina é a cor do horizonte
    const { horizonte } = montarEntorno(c, modelos, this.descartaveis, this.sombras);
    c.background = new THREE.Color(horizonte);
    c.fog = new THREE.Fog(horizonte, 26, 95);
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

    // o piso de concreto da pista (um ladrilho só, esticado: a cor é uma só)
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
    // o coelho com o NOSSO esqueleto, pintado com as cores do MEU avatar (coelho3d.ts: a paleta, a borda e o contorno)
    const c = copiarCoelho(g, { altura: ALTURA_DO_COELHO, sombras: this.sombras });
    this.copia = c;
    void minhasCoresDoCoelho().then((cores) => !this.morta && c.material.pintar(cores));
    const corpo = c.corpo;
    this.mixer = c.mixer;
    this.acoes = c.acoes;
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
    // A INCLINAÇÃO DO CHÃO sob a prancha (relato dele, 05/11/2026: "ele sobe como um elevador"): antes só o pitch na direção
    // da prancha; subindo o quarter na diagonal, a parede deitava para o lado e o coelho seguia de pé. Agora o skatista inteiro
    // (a prancha e o corpo) se alinha à NORMAL do chão: a raiz é o giro de cima para a normal vezes o rumo. No ar, volta a ficar
    // de pé devagar; no grind, o trilho é reto.
    const a_ = this.aux;
    if (k.modo === 'chao' || k.modo === 'manual') normalDoChao(k.peca, x, z, a_.n);
    else a_.n.copy(CIMA);
    a_.q.setFromUnitVectors(CIMA, a_.n);
    if (this.quadro < 3) this.noChao.copy(a_.q);
    else this.noChao.slerp(a_.q, Math.min(1, dt * (k.modo === 'ar' ? 3.5 : 16)));
    a_.giro.setFromAxisAngle(CIMA, this.anguloDaPrancha);
    this.raiz.quaternion.copy(this.noChao).multiply(a_.giro);

    // por cima da inclinação do chão: o manual levanta o bico, o grind balança
    let pitch = 0;
    let roll = 0;
    if (k.modo === 'grind') roll = k.equilibrio * 0.35;
    if (k.modo === 'manual') pitch = -0.32 + k.equilibrio * 0.25;
    this.inclina.rotation.x = this.inclina.rotation.x + (pitch - this.inclina.rotation.x) * Math.min(1, dt * 14);
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
    const ondeCai = pecaEm(x, z);
    normalDoChao(ondeCai, x, z, a_.n);
    this.sombra.position.set(x + a_.n.x * 0.012, chao + a_.n.y * 0.012, z + a_.n.z * 0.012);
    this.sombra.quaternion.setFromUnitVectors(CIMA, a_.n).multiply(SOMBRA_DEITADA);
    this.sombra.scale.setScalar(1 - Math.min(0.5, alto * 0.4));
    (this.sombra.material as THREE.MeshBasicMaterial).opacity = 0.3 * (1 - Math.min(0.7, alto * 0.5));

    // A CÂMERA: atrás, para onde ele anda; no ar, ela espera (não gira com os giros)
    if (k.modo !== 'ar' && k.modo !== 'caido' && k.vel > 0.2) {
      const quer = anguloDe(k.rx, k.rz);
      this.anguloDaCamera = this.quadro < 3 ? quer : aproximarAngulo(this.anguloDaCamera, quer, Math.min(1, dt * 3));
    }
    // A ALTURA DA CÂMERA segue o skatista inteira (antes, 60–70%: na rampa ele subia pela tela como num elevador, com a câmera
    // parada embaixo), amortecida à parte; no ar, ela sobe só metade do voo, para o pouso continuar à vista.
    const alvoY = k.modo === 'ar' ? Math.max(chao, this.saidaY + (y - this.saidaY) * 0.5) : y;
    this.camY = this.quadro < 3 ? alvoY : this.camY + (alvoY - this.camY) * Math.min(1, dt * (k.modo === 'ar' ? 2.5 : 6));
    const ca = this.anguloDaCamera;
    const fx = Math.sin(ca);
    const fz = Math.cos(ca);
    // olha um pouco à frente e um pouco acima do coelho (na parede do quarter, o alto dela fica à vista)
    const foco = a_.foco.set(x + fx * 1.1, (y + this.camY) * 0.5 + 0.4, z + fz * 1.1);
    const pos = a_.pos.set(x - fx * 2.5, this.camY + 1.3, z - fz * 2.5);
    // A CÂMERA DO VERT (pedido dele, 06/11/2026, com a foto de referência): subindo a parede do quarter e no voo que sai dela,
    // a câmera sai de trás e vai para o lado da pista, alta, olhando de cima para o coelho com a rampa embaixo dele — o voo e
    // o pouso à vista. Atrás e embaixo, como antes, ela olhava por cima da beirada para fora da pista, e o coelho flutuava
    // na frente da cerca.
    const naParede = k.peca >= 0 && perfilDaPeca(k.peca) === 'quarter' && k.modo !== 'ar' && k.modo !== 'caido';
    if (naParede) {
      const [sx, sz] = subidaDaPeca(k.peca);
      this.subida[0] = sx;
      this.subida[1] = sz;
    }
    const querVert = k.modo === 'ar' && k.saida === 'vert' ? 1 : naParede ? Math.min(1, Math.max(0, (y - 0.25) / 0.35)) : 0;
    this.vert = this.quadro < 3 ? querVert : this.vert + (querVert - this.vert) * Math.min(1, dt * (querVert > this.vert ? 3.5 : 2));
    if (this.vert > 0.001) {
      const [sx, sz] = this.subida;
      const baseY = Math.max(y, this.saidaY);
      this.posVert.set(x - sx * 1.9, baseY + 1.8, z - sz * 1.9);
      this.focoVert.set(x + sx * 0.25, y - 0.15, z + sz * 0.25);
      const v = this.vert * this.vert * (3 - 2 * this.vert);
      pos.lerp(this.posVert, v);
      foco.lerp(this.focoVert, v);
    }
    // sem atravessar o chão: acima do que houver embaixo dela, e no meio do caminho até o coelho
    const debaixo = (px: number, pz: number) => altura(Math.min(LARGURA, Math.max(0, px)), Math.min(PROFUNDIDADE, Math.max(0, pz)));
    pos.y = Math.max(pos.y, debaixo(pos.x, pos.z) + 0.6, debaixo(x - fx * 1.25, z - fz * 1.25) + 0.5);
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
    this.copia?.descartar();
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
