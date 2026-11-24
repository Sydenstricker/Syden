import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { carregarCoelho, copiarCoelho, type CoelhoCopiado, type CoresDoCoelho } from '../coelho3d';
import { BOX_COMPRIMENTO, COMPRIMENTO_DA_RETA, FAIXAS, FORA_PASSOS, parceiraDa, poseDoCarro, poseNaFaixa, trechoEm, type Peca, type Pista } from './sim';

/**
 * A CENA DOS CARRINHOS DA TOCA (06/11/2026): a pista de sim.ts montada com as peças largas do Toy Car Kit da Kenney (CC0,
 * web/public/carrinhos/License.txt), em duas fileiras lado a lado (4 faixas), num tapete no chão de madeira, vista de cima e
 * de lado, inteira, como quem olha a pista de brinquedo do sofá. Os carros são os da Kenney, um modelo por faixa, e quem
 * pilota é o NOSSO coelho 3D (coelho3d.ts), sentado, com as cores do avatar.
 *
 * Só a TELA: a regra (sim.ts) decide onde cada carro está; quem chama passa o quadro. Como as outras cenas 3D: o three.js vem
 * num pedaço à parte, só quando o jogo abre; sem foco na janela, quem chama não desenha; ao sair, o contexto é devolvido.
 */

const BASE = `${import.meta.env.BASE_URL}carrinhos/`;
/** O fundo da cena (o chão do quarto), que é também a cor da caixa enquanto carrega. */
export const COR_DO_FUNDO = '#c79b6e';
const MODELO_DA_PECA: Record<Peca['tipo'], string> = { reta: 'track-road-wide-straight', pequena: 'track-road-wide-corner-small', grande: 'track-road-wide-corner-large', cruzamento: 'track-road-wide-straight', agulha: 'track-road-wide-straight' };
const RAIO_DA_PECA: Record<Peca['tipo'], number> = { reta: 0, pequena: 2, grande: 4, cruzamento: 0, agulha: 0 };
/** Um carro por faixa. */
const CARROS = ['vehicle-racer', 'vehicle-speedster', 'vehicle-racer-low', 'vehicle-vintage-racer'];
const ENFEITES = ['tree', 'tree-pine', 'item-cone', 'gate-finish'];
/** As nossas (24/11/2026): o cruzamento sem a zebra do lado de dentro e com as faixas pintadas, e a agulha com os desvios. */
const PECAS_NOSSAS = ['cruzamento', 'agulha'] as const;
/** O nó das peças da Kenney fica 1 abaixo do chão; o tampo da pista, medido no modelo, fica a esta altura depois de subir. */
const ALTURA_DA_PISTA = 0.1;
const ALTURA_DO_COELHO = 0.5;
/** Os carros da Kenney, um pouco maiores que a escala da pista (a faixa tem 1 de largura), para se verem de longe. */
const ESCALA_DO_CARRO = 1.3;
/** O coelho no banco: um pouco atrás do meio do carro, afundado no assento. */
const BANCO = { y: 0.2, z: 0.1 };

const carregados = new Map<string, Promise<GLTF>>();
function carregar(nome: string): Promise<GLTF> {
  let p = carregados.get(nome);
  if (!p) {
    p = new GLTFLoader().loadAsync(`${BASE}${nome}.glb`);
    carregados.set(nome, p);
    p.catch(() => carregados.delete(nome));
  }
  return p;
}

/** Um sorteio sempre igual, só para o desenho (o lugar dos enfeites, o giro do voo). */
function sorteio(semente: number) {
  let s = semente >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Do rumo no plano (x, z) da regra para o giro do three.js: os modelos da Kenney olham para −z (carros) e +z (peças). */
const giroDoCarro = (rumo: number) => -(rumo + Math.PI / 2);

export interface CarroNaCena {
  faixa: number;
  /** As cores do coelho que pilota; null: o carro vai vazio (o fantasma). */
  cores: CoresDoCoelho | null;
  fantasma?: boolean;
  /** O meu carro leva a seta em cima. */
  eu?: boolean;
}

/** O que se desenha de um carro num quadro. */
export interface QuadroDoCarro {
  s: number;
  fora: number;
  pisca: number;
  derrapa: number;
  saiuA: number;
  /** Escondido (o rival que ainda não mandou posição). */
  escondido?: boolean;
  /** A faixa de agora (a troca de faixa, 24/11/2026: muda na agulha); sem ela, a da montagem. */
  faixa?: number;
  /** Na agulha em que trocou, a faixa de onde veio (o carro desliza de uma à outra); -1 ou nada fora disso. */
  de?: number;
}

interface Montado {
  faixa: number;
  raiz: THREE.Group;
  corpo: THREE.Group;
  coelho: CoelhoCopiado | null;
  giro: THREE.Vector3;
  seta: THREE.Mesh | null;
}

export class CenaDosCarrinhos {
  private renderer: THREE.WebGLRenderer;
  private cena = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(36, 1, 0.5, 200);
  private observador: ResizeObserver;
  private morta = false;
  private sombras = false;
  private carros: Montado[] = [];
  private relogio = 0;
  private deperto = false;
  /** O meio da pista: tudo é montado em volta da origem. */
  private meio = { x: 0, z: 0, largura: 1, fundo: 1 };

  constructor(
    private caixa: HTMLElement,
    private tracado: Pista,
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    try {
      this.sombras = !!JSON.parse(localStorage.getItem('syden:graficos') ?? '{}').sombras;
    } catch {
      /* fica sem */
    }
    this.renderer.shadowMap.enabled = this.sombras;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const canvas = this.renderer.domElement;
    canvas.className = 'carrinhos-tela';
    caixa.appendChild(canvas);
    this.observador = new ResizeObserver(() => this.medir());
    this.observador.observe(caixa);
  }

  private medir() {
    const w = Math.max(1, this.caixa.clientWidth);
    const h = Math.max(1, this.caixa.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // a pista inteira cabe: na tela estreita, a câmera se afasta
    const { largura, fundo } = this.meio;
    const vertical = (36 * Math.PI) / 180;
    const horizontal = 2 * Math.atan(Math.tan(vertical / 2) * this.camera.aspect);
    const dist = Math.max((fundo * 0.56) / Math.tan(vertical / 2), (largura * 0.53) / Math.tan(horizontal / 2));
    this.camera.position.set(0, dist * 0.8, dist * 0.6);
    this.camera.lookAt(0, 0, 0.4);
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

  /** Carrega os modelos e monta a pista e os carros. Rejeita se algo falhar (quem chama mostra o aviso). */
  async montar(carros: CarroNaCena[]): Promise<void> {
    const nomes = [...Object.values(MODELO_DA_PECA), ...CARROS, ...ENFEITES];
    const [coelho, nossas, ...lista] = await Promise.all([
      carregarCoelho(),
      // as peças que o kit não tem, feitas no Blender (web/scripts/modelos/tocas-cozinha-carrinhos/carrinhos.py); sem elas, a reta
      // com os riscos por código
      Promise.all(PECAS_NOSSAS.map((n) => carregar(n).catch(() => null))),
      ...nomes.map(carregar),
    ]);
    if (this.morta) return;
    const modelos = new Map(nomes.map((n, i) => [n, lista[i]]));
    PECAS_NOSSAS.forEach((n, i) => {
      const g = nossas[i];
      if (g) modelos.set(n, g);
    });
    this.montarPista(modelos);
    for (const c of carros) this.montarCarro(c, modelos.get(CARROS[c.faixa % CARROS.length])!, coelho);
    this.medir();
  }

  private montarPista(modelos: Map<string, GLTF>) {
    const c = this.cena;
    // o meio e o tamanho da pista, pelas entradas das peças (com a largura de uma fileira de folga)
    // o tamanho da pista: as faixas de fora, mais a largura da zebra e um pouco de tapete
    const xs: number[] = [], zs: number[] = [];
    for (const f of [0, FAIXAS - 1]) {
      for (let s = 0; s < this.tracado.volta[f]; s += 0.25) {
        const p = poseNaFaixa(this.tracado, f, s);
        xs.push(p.x);
        zs.push(p.z);
      }
    }
    const borda = 1.6;
    const [x0, x1, z0, z1] = [Math.min(...xs) - borda, Math.max(...xs) + borda, Math.min(...zs) - borda, Math.max(...zs) + borda];
    this.meio = { x: (x0 + x1) / 2, z: (z0 + z1) / 2, largura: x1 - x0, fundo: z1 - z0 };
    const pista = new THREE.Group();
    pista.position.set(-this.meio.x, 0, -this.meio.z);
    c.add(pista);
    this.pista = pista;

    c.background = new THREE.Color(COR_DO_FUNDO);
    c.add(new THREE.HemisphereLight('#fff6e8', '#9a7a5a', 1.6));
    const sol = new THREE.DirectionalLight('#fff1d6', 2.0);
    sol.position.set(-8, 18, 10);
    c.add(sol, sol.target);
    if (this.sombras) {
      sol.castShadow = true;
      sol.shadow.mapSize.set(2048, 2048);
      Object.assign(sol.shadow.camera, { left: -20, right: 20, top: 20, bottom: -20, near: 1, far: 60 });
    }

    // o chão de tábuas e o tapete embaixo da pista (por código: duas cores e as linhas das tábuas)
    const chao = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: COR_DO_FUNDO, roughness: 0.85 }));
    chao.rotation.x = -Math.PI / 2;
    chao.position.y = -0.02;
    chao.receiveShadow = this.sombras;
    c.add(chao);
    const linhas = new THREE.MeshBasicMaterial({ color: '#b48a5f' });
    for (let i = -40; i <= 40; i++) {
      const l = new THREE.Mesh(new THREE.PlaneGeometry(200, 0.06), linhas);
      l.rotation.x = -Math.PI / 2;
      l.position.set(0, -0.015, i * 1.6);
      c.add(l);
    }
    const tapete = new THREE.Mesh(
      new THREE.PlaneGeometry(this.meio.largura + 2, this.meio.fundo + 2),
      new THREE.MeshStandardMaterial({ color: '#5f8c6a', roughness: 1 }),
    );
    tapete.rotation.x = -Math.PI / 2;
    tapete.position.y = -0.005;
    tapete.receiveShadow = this.sombras;
    c.add(tapete);
    const barra = new THREE.Mesh(
      new THREE.PlaneGeometry(this.meio.largura + 2.6, this.meio.fundo + 2.6),
      new THREE.MeshStandardMaterial({ color: '#e8d7b4', roughness: 1 }),
    );
    barra.rotation.x = -Math.PI / 2;
    barra.position.y = -0.01;
    c.add(barra);

    const nossa = (p: Peca) => (p.tipo === 'cruzamento' || p.tipo === 'agulha') && modelos.has(p.tipo);
    for (const p of this.tracado.pecas) {
      const o = this.clonar(modelos.get(nossa(p) ? p.tipo : MODELO_DA_PECA[p.tipo])!);
      const g = new THREE.Group();
      g.add(o);
      o.position.y += 1;
      // o cruzamento nosso abre o lado +x da peça, que é o de dentro na fileira +1; na outra, ele dá meia volta no meio da peça
      if (p.tipo === 'cruzamento' && nossa(p) && p.fileira < 0) {
        o.rotation.y = Math.PI;
        o.position.z += COMPRIMENTO_DA_RETA;
      }
      // a peça entra em (0, 0) olhando +z; a curva "−" é a mesma peça percorrida ao contrário, entrando por (−R, R) olhando +x
      const R = RAIO_DA_PECA[p.tipo];
      const [lx, lz, rumoLocal] = p.sentido < 0 ? [-R, R, 0] : [0, 0, Math.PI / 2];
      const a = p.rumo - rumoLocal;
      const ca = Math.cos(a), sa = Math.sin(a);
      g.position.set(p.x - (lx * ca - lz * sa), 0, p.z - (lx * sa + lz * ca));
      g.rotation.y = -a;
      pista.add(g);
    }

    // O CRUZAMENTO (19/11/2026): a peça é a reta da Kenney, e as faixas trocando de lado são riscos claros por cima, por
    // código (o kit não tem peça de cruzamento). Um risco por faixa, do começo dela ao fim do outro lado.
    const risco = new THREE.MeshBasicMaterial({ color: '#f3ead2', transparent: true, opacity: 0.85 });
    // com as peças nossas (24/11/2026) os riscos já vêm pintados nelas: os por código são a reserva
    for (let f = 0; f < (modelos.has('cruzamento') ? 0 : FAIXAS); f++) {
      for (const t of this.tracado.trechos[f]) {
        if (!t.ladoX && !t.ladoZ) continue;
        const ax = t.x, az = t.z;
        const bx = t.x + Math.cos(t.rumo) * COMPRIMENTO_DA_RETA + t.ladoX, bz = t.z + Math.sin(t.rumo) * COMPRIMENTO_DA_RETA + t.ladoZ;
        const tamanho = Math.hypot(bx - ax, bz - az);
        const m = new THREE.Mesh(new THREE.PlaneGeometry(tamanho, 0.09), risco);
        m.rotation.x = -Math.PI / 2;
        m.rotation.z = -Math.atan2(bz - az, bx - ax);
        m.position.set((ax + bx) / 2, ALTURA_DA_PISTA + 0.012 + f * 0.001, (az + bz) / 2);
        pista.add(m);
      }
    }

    // A AGULHA (24/11/2026): a reta da Kenney, com o desvio de cada faixa para a outra da fileira riscado por cima, tracejado
    // (o trilho que muda; o kit não tem a peça)
    const desvio = new THREE.MeshBasicMaterial({ color: '#ffd36b', transparent: true, opacity: 0.8 });
    for (let f = 0; f < (modelos.has('agulha') ? 0 : FAIXAS); f++) {
      const outra = this.tracado.trechos[parceiraDa(f)];
      this.tracado.trechos[f].forEach((t, i) => {
        if (!t.troca) return;
        const ax = t.x, az = t.z;
        const bx = outra[i].x + Math.cos(t.rumo) * COMPRIMENTO_DA_RETA, bz = outra[i].z + Math.sin(t.rumo) * COMPRIMENTO_DA_RETA;
        for (let k = 0; k < 5; k++) {
          const k0 = (k + 0.15) / 5, k1 = (k + 0.65) / 5;
          const x0 = ax + (bx - ax) * k0, z0 = az + (bz - az) * k0, x1 = ax + (bx - ax) * k1, z1 = az + (bz - az) * k1;
          const m = new THREE.Mesh(new THREE.PlaneGeometry(Math.hypot(x1 - x0, z1 - z0), 0.07), desvio);
          m.rotation.x = -Math.PI / 2;
          m.rotation.z = -Math.atan2(z1 - z0, x1 - x0);
          m.position.set((x0 + x1) / 2, ALTURA_DA_PISTA + 0.013 + f * 0.001, (z0 + z1) / 2);
          pista.add(m);
        }
      });
    }

    // a largada: um pórtico em cada fileira, no começo da primeira reta
    const largada = this.tracado.pecas.slice(0, 2);
    for (const p of largada) {
      const o = this.clonar(modelos.get('gate-finish')!);
      o.position.set(p.x, 0, p.z);
      o.rotation.y = -(p.rumo - Math.PI / 2);
      pista.add(o);
    }
    // árvores e cones em volta, longe do traçado (um sorteio sempre igual)
    const r = sorteio(7);
    const perto = (x: number, z: number) => this.tracado.pecas.some((p) => Math.hypot(p.x + 2 * Math.cos(p.rumo) - x, p.z + 2 * Math.sin(p.rumo) - z) < 4.2);
    let postos = 0;
    for (let k = 0; k < 400 && postos < 26; k++) {
      const x = this.meio.x + (r() - 0.5) * (this.meio.largura + 1);
      const z = this.meio.z + (r() - 0.5) * (this.meio.fundo + 1);
      if (perto(x, z)) continue;
      const nome = r() < 0.25 ? 'item-cone' : r() < 0.5 ? 'tree-pine' : 'tree';
      const o = this.clonar(modelos.get(nome)!);
      const k2 = nome === 'item-cone' ? 1.6 : 1.4 + r() * 0.8;
      o.scale.setScalar(k2);
      o.position.set(x, 0, z);
      o.rotation.y = r() * Math.PI * 2;
      pista.add(o);
      postos++;
    }
  }

  private pista: THREE.Group | null = null;
  /** A MARCA DA CURVA CHEGANDO (20/11/2026): a seta pintada na minha faixa, na entrada da próxima curva. */
  private marca: THREE.Mesh | null = null;
  /** O BOX da resistência (21/11/2026): faixinhas no chão da faixa, no trecho antes da linha. */
  private box: THREE.Group | null = null;
  private faixaDoBox = -1;

  /** Marca (ou tira, com null) o box na faixa: o trecho de BOX_COMPRIMENTO antes da linha de chegada. */
  marcarBox(faixa: number | null) {
    if (this.morta || !this.pista) return;
    if (faixa === null) {
      if (this.box) this.box.visible = false;
      return;
    }
    if (!this.box || this.faixaDoBox !== faixa) {
      if (this.box) {
        this.pista.remove(this.box);
        this.box.traverse((o) => {
          const m = o as THREE.Mesh;
          if (m.isMesh) m.geometry.dispose();
        });
      }
      this.box = new THREE.Group();
      this.faixaDoBox = faixa;
      const mat = new THREE.MeshBasicMaterial({ color: '#4fc3f7', transparent: true, opacity: 0.7, depthWrite: false });
      const volta = this.tracado.volta[faixa];
      for (let s = volta - BOX_COMPRIMENTO + 0.25; s < volta; s += 0.5) {
        const g = new THREE.PlaneGeometry(0.5, 0.18);
        g.rotateX(-Math.PI / 2);
        const m = new THREE.Mesh(g, mat);
        const pose = poseNaFaixa(this.tracado, faixa, s);
        m.position.set(pose.x, ALTURA_DA_PISTA + 0.025, pose.z);
        m.rotation.set(0, -pose.rumo, 0);
        this.box.add(m);
      }
      this.pista.add(this.box);
    }
    this.box.visible = true;
  }

  /**
   * Põe (ou tira, com null) a marca da curva que vem na faixa: âmbar; vermelha quando já é hora de soltar o acelerador. Com
   * "menos movimento", ela não pulsa. Só desenho.
   */
  marcarCurva(m: { faixa: number; s: number; solte: boolean; calmo: boolean } | null) {
    if (this.morta || !this.pista) return;
    if (!m) {
      if (this.marca) this.marca.visible = false;
      return;
    }
    if (!this.marca) {
      const g = new THREE.CircleGeometry(0.42, 3);
      g.rotateX(-Math.PI / 2);
      this.marca = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: '#ffb02a', transparent: true, opacity: 0.85, depthWrite: false }));
      this.pista.add(this.marca);
    }
    const pose = poseNaFaixa(this.tracado, m.faixa, m.s);
    this.marca.position.set(pose.x, ALTURA_DA_PISTA + 0.03, pose.z);
    this.marca.rotation.set(0, -pose.rumo, 0);
    const mat = this.marca.material as THREE.MeshBasicMaterial;
    mat.color.set(m.solte ? '#ff4a3a' : '#ffb02a');
    mat.opacity = m.calmo ? 0.85 : 0.55 + 0.35 * Math.abs(Math.sin(this.relogio * (m.solte ? 9 : 4)));
    this.marca.visible = true;
  }

  private montarCarro(c: CarroNaCena, modelo: GLTF, coelho: GLTF) {
    const raiz = new THREE.Group();
    const corpo = new THREE.Group();
    const carro = this.clonar(modelo);
    carro.position.y = 0.125;
    corpo.add(carro);
    let copia: CoelhoCopiado | null = null;
    if (c.cores) {
      copia = copiarCoelho(coelho, { altura: ALTURA_DO_COELHO, sombras: this.sombras, cores: c.cores });
      copia.corpo.position.set(0, BANCO.y + 0.125, BANCO.z);
      // o coelho olha para +z; o carro, para −z
      copia.corpo.rotation.y = Math.PI;
      corpo.add(copia.corpo);
      const sentado = copia.acoes.get('sentado') ?? copia.acoes.get('parado');
      sentado?.play();
      copia.mixer.update(0.01);
    }
    if (c.fantasma) {
      carro.traverse((m) => {
        const mesh = m as THREE.Mesh;
        if (!mesh.isMesh) return;
        const mat = (mesh.material as THREE.MeshStandardMaterial).clone();
        mat.transparent = true;
        mat.opacity = 0.35;
        mat.depthWrite = false;
        mesh.material = mat;
        mesh.castShadow = false;
      });
    }
    corpo.scale.setScalar(ESCALA_DO_CARRO);
    raiz.add(corpo);
    let seta: THREE.Mesh | null = null;
    if (c.eu) {
      // a seta em cima do meu carro, na cor de destaque da pista (o amarelo do painel)
      seta = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.6, 4), new THREE.MeshBasicMaterial({ color: '#ffe08a' }));
      seta.rotation.x = Math.PI;
      raiz.add(seta);
    }
    this.pista!.add(raiz);
    const r = sorteio(31 + this.carros.length * 17);
    this.carros.push({ faixa: c.faixa, raiz, corpo, coelho: copia, giro: new THREE.Vector3(r() - 0.5, 1, r() - 0.5).normalize(), seta });
  }

  /** Desenha um quadro: um estado por carro, na ordem de `montar`. `dt` é o tempo de tela desde o último quadro. */
  desenhar(quadros: QuadroDoCarro[], dt: number) {
    if (this.morta) return;
    this.relogio += dt;
    this.carros.forEach((m, i) => {
      const q = quadros[i];
      if (!q || q.escondido) {
        m.raiz.visible = false;
        return;
      }
      const faixa = q.faixa ?? m.faixa;
      const pose = poseDoCarro(this.tracado, faixa, q.s, q.de ?? -1);
      m.raiz.position.set(pose.x, ALTURA_DA_PISTA, pose.z);
      m.raiz.rotation.set(0, giroDoCarro(pose.rumo), 0);
      m.corpo.position.set(0, 0, 0);
      m.corpo.rotation.set(0, 0, 0);
      m.raiz.visible = true;
      if (m.seta) m.seta.position.set(0, 1.25 + Math.sin(this.relogio * 4) * 0.08, 0);
      if (q.fora > 0) {
        // O VOO: o carro segue reto (a tangente) e sobe, girando, e cai deitado no tapete ao lado da pista
        const t = Math.min(1, (FORA_PASSOS - q.fora) / 45);
        const longe = Math.min(3, 0.35 * q.saiuA) * (1 - (1 - t) * (1 - t));
        const tr = trechoEm(this.tracado, faixa, q.s);
        // para fora da curva: o lado contrário ao centro
        const fora = -tr.sentido;
        // (o carro gira em volta do meio dele, então sobe metade da altura para não afundar no tapete)
        m.corpo.position.set(fora * longe * 0.7, 0.3 + Math.sin(t * Math.PI) * 0.9, -longe * 0.8);
        m.corpo.translateY(0.2);
        m.corpo.rotateOnAxis(m.giro, t * Math.PI * 3);
        m.corpo.translateY(-0.2);
        if (t >= 1) {
          // deitado de rodas para cima, ao lado da pista
          m.corpo.rotation.set(0, 0.6 * fora, Math.PI * 0.95);
          m.corpo.position.y = 0.62;
        }
        if (m.seta) m.seta.position.set(m.corpo.position.x, m.corpo.position.y + 1.1, m.corpo.position.z);
      } else {
        if (q.derrapa > 0) {
          // a traseira escorrega para fora da curva e o carro treme
          const tr = trechoEm(this.tracado, faixa, q.s);
          const k = Math.min(1, q.derrapa);
          m.corpo.rotation.y = tr.sentido * 0.45 * k + Math.sin(this.relogio * 47) * 0.06 * k;
          m.corpo.position.x = Math.sin(this.relogio * 61) * 0.03 * k;
        }
        if (q.pisca > 0) m.raiz.visible = Math.floor(q.pisca / 5) % 2 === 0;
      }
    });
    for (const m of this.carros) m.coelho?.mixer.update(0);
    // só no site de desenvolvimento: a câmera de perto do meu carro (para conferir o coelho no banco)
    const perto = import.meta.env.DEV && (window as { carrinhosPerto?: boolean }).carrinhosPerto ? this.carros.find((m) => m.seta) : null;
    if (perto) {
      const p = new THREE.Vector3();
      perto.raiz.getWorldPosition(p);
      this.camera.position.set(p.x + 2.6, p.y + 2.2, p.z + 2.6);
      this.camera.lookAt(p.x, p.y + 0.3, p.z);
      this.deperto = true;
    } else if (this.deperto) {
      this.deperto = false;
      this.medir();
    }
    this.renderer.render(this.cena, this.camera);
  }

  destruir() {
    this.morta = true;
    this.observador.disconnect();
    for (const m of this.carros) m.coelho?.descartar();
    this.cena.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && !m.userData.contornoDoCoelho) {
        m.geometry.dispose();
        const mat = m.material as THREE.Material | THREE.Material[];
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else mat.dispose();
      }
    });
    this.renderer.forceContextLoss();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
