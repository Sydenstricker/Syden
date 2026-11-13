import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { carregarCoelho, CORES_DO_MASCOTE, copiarCoelho, type CoelhoCopiado, type CoresDoCoelho } from '../coelho3d';
import { FUNCAO_DA_PAREDE, FUNCAO_DO_MOVEL, N, noMundo, type ArrumacaoDoPixel, type NaParedeNoMundo, type QuartoNoMundo } from './arrumacao';
import { TEMAS, type Parte, type PecaDaParede, type PecaDoTema, type Tema } from './temas';
import { elementoAVista } from '../CenaGuardada';

/**
 * O QUARTO EM 3D LOW POLY NO APP (06/11/2026, pedido dele: "quero esse quarto 3D low poly como PILOTO da nossa
 * funcionalidade de variação estética para o usuário").
 *
 * - A ARRUMAÇÃO É A DO PIXEL ART (decisão dele, 06/11/2026: "a POSIÇÃO do item no quarto 2D terá o OBJETO EQUIVALENTE 3D na
 *   MESMA POSIÇÃO"): a planta (o de sempre, em L, o cubículo), os móveis na casa e no giro deles, a cadeira onde parou, a
 *   janela, os objetos da parede, os de cima, as cores do Cômodo e do tapete — tudo lido da arrumação que o servidor guarda e
 *   traduzido por arrumacao.ts. Arrumar é no pixel art (o Editar); o 3D desenha.
 * - O TEMA (temas.ts) diz qual modelo desenha cada peça: o "clássico" (KayKit e Kenney) ou o "colorido" (Tiny Treats).
 * - AS FUNÇÕES NOS OBJETOS, as mesmas do pixel (o id é o de `AcoesDoQuarto`, em Home.tsx): o guarda-roupa → Guarda-roupa
 *   ('gavetas'), a mesa → Mini-games ('computador'), o fone da parede → Salas ('fone'), o quadro de fotos → Amigos ('quadro'),
 *   a cortiça → ideias ('cortica'), a janela → Explorar ('janela'), o criado-mudo com o abajur → Dia e noite ('abajur') e a
 *   prateleira dos troféus → Troféus ('trofeu'). A cópia de um móvel ("cama~2") não tem função, como no pixel. A ANIMAÇÃO VEM
 *   ANTES DA FUNÇÃO: o coelho anda até o objeto (na mesa, senta na cadeira), e só então ela abre. Passar o mouse realça.
 * - O COELHO é o de coelho3d.ts, com as cores do avatar, e segue o ESTADO DE VERDADE: ausente dorme na cama, em chamada senta
 *   na cadeira, senão fica à toa. Depois de usar uma função, ele volta ao lugar do estado.
 * - DIA E NOITE são os do app; as SOMBRAS, a opção de Gráficos. SEM FOCO OU ESCONDIDA, NÃO DESENHA (a regra de
 *   janelaComFoco.ts). Com a janela à vista, no máximo 30 quadros por segundo.
 */

const MODELOS = `${import.meta.env.BASE_URL}quarto3d/`;
/** O tamanho das peças do Kenney (o Furniture Kit e o Food Kit): com 2, a mesa, a cadeira e a cama dele ficam da altura das do KayKit. */
const K = 2;
/** As cores do Kenney trocadas pelas do KayKit, pelo nome do material (o vermelho-vivo e o verde-menta dele brigavam). */
const PALETA_KENNEY: Record<string, string> = {
  wood: '#c47c4a',
  woodDark: '#8a5233',
  carpet: '#e8b452',
  carpetDarker: '#c98c3c',
  carpetWhite: '#efe5d2',
  carpetBlue: '#93c1d0',
  plant: '#78b04a',
  metal: '#cfd2c8',
  metalLight: '#eceee6',
  metalMedium: '#7d8984',
  metalDark: '#4b5451',
  fur: '#c99566',
  lamp: '#ffe2a0',
  _defaultMat: '#ecdcc4',
};
const ehKenney = (nome: string) => nome.startsWith('kenney/');
const ehGlb = (nome: string) => nome.startsWith('kenney/') || nome.startsWith('comida/');
const ALTURA_DO_COELHO = 1.1;
const ALTURA_DA_PAREDE = 3;
/** Depois de usar uma função, o coelho volta ao lugar do estado (a cama, o computador) em tanto tempo. */
const VOLTA_AO_ESTADO_MS = 8000;
/** O realce de quem está sob o mouse: uma luz própria, morna, por cima da cor. */
const REALCE = new THREE.Color('#4a3418');
/** No máximo 30 quadros por segundo: o quarto é calmo, e o resto do tempo é de quem joga. */
const INTERVALO_MS = 1000 / 31;

// Os modelos, uma vez por página: abrir o quarto de novo (ou trocar de tema) não baixa nada outra vez.
const carregador = new GLTFLoader();
const cache = new Map<string, Promise<GLTF>>();
const modelo = (nome: string) => {
  let p = cache.get(nome);
  if (!p) {
    p = carregador.loadAsync(`${MODELOS}${nome}${ehGlb(nome) ? '.glb' : '.gltf'}`);
    p.catch(() => cache.delete(nome));
    cache.set(nome, p);
  }
  return p;
};

interface Pronto {
  id: string;
  tipo: string;
  raiz: THREE.Group;
  /** O modelo da peça, sem as partes (o que se mede para sentar, deitar e pôr coisas em cima). */
  base: THREE.Object3D;
  /** Para onde a frente olha (o giro em y) e o centro do desenho, no mundo. */
  rumo: number;
  centro: THREE.Vector3;
  /** O alto da peça e o do tampo, no mundo. */
  altura: number;
  tampo: number;
  /** O pé na grade (o do pixel); a cadeira, que gira solta, ocupa a casa dela. */
  pe: { x0: number; x1: number; z0: number; z1: number };
  spec: PecaDoTema;
  funcao?: string;
  uso?: 'deitar' | 'sentar';
  chao?: boolean;
  luz?: THREE.PointLight;
  /** A luz foi apagada à mão: vale até o dia e a noite do app mudarem. */
  luzAMao?: boolean;
}

export type EstadoDoCoelho = 'atoa' | 'call' | 'ausente';

export interface OpcoesDoQuarto3D {
  /** A função de um objeto (o id de AcoesDoQuarto), DEPOIS de o coelho chegar a ele. */
  aoFuncao(id: string): void;
  /** O que está sob o mouse (para a etiqueta com o nome), em pixels da caixa; null, nada. */
  aoPassar(alvo: { id: string; x: number; y: number } | null): void;
  /** Esta função existe aqui? (Na visita, só a dos troféus.) */
  temFuncao(id: string): boolean;
}

interface Coelho {
  copia: CoelhoCopiado;
  raiz: THREE.Group;
  corpo: THREE.Group;
  casa: [number, number];
  caminho: [number, number][];
  de: THREE.Vector3;
  para: THREE.Vector3;
  inicio: number;
  duracao: number;
  arco: number;
  rumo: number;
  pose: 'pe' | 'deitado' | 'sentado';
  /** O móvel em que está (deitado ou sentado). */
  em: Pronto | null;
  depois: (() => void) | null;
  tocando: string;
}

/** Um alvo sob o ponteiro: o objeto com função, ou o móvel de usar, ou o chão. */
interface Alvo {
  funcao?: string;
  movel?: Pronto;
  /** O que se realça (o objeto da função, ou o móvel). */
  realce?: THREE.Object3D;
  ponto: THREE.Vector3;
}

export class CenaDoQuarto3D {
  private renderer: THREE.WebGLRenderer;
  private cena = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  private ceu = new THREE.HemisphereLight('#fffaf0', '#c9a88a', 1.7);
  private sol = new THREE.DirectionalLight('#fff0d8', 2.3);
  private preenche = new THREE.DirectionalLight('#dfe8ff', 0.7);
  private fora: THREE.Mesh[] = [];
  private morro: THREE.Mesh[] = [];
  private moveis: Pronto[] = [];
  private daParede: THREE.Object3D[] = [];
  private arandelas: THREE.PointLight[] = [];
  private lampadinhas: THREE.MeshStandardMaterial[] = [];
  private lampadas: THREE.MeshStandardMaterial[] = [];
  private brilham: THREE.MeshStandardMaterial[] = [];
  private coelho: Coelho | null = null;
  private noite = false;
  private estado: EstadoDoCoelho = 'atoa';
  private sombras: boolean;
  private calmo: boolean;
  private raio = new THREE.Raycaster();
  /** A caixa do coelho DEITADO (a pose 'dormindo'), em relação à raiz dele e sem giro: medida uma vez, ao montá-lo. */
  private deitado: THREE.Box3 | null = null;
  private ponteiro = new THREE.Vector2();
  private planoDoChao = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private observador: ResizeObserver;
  private relogio = new THREE.Timer();
  private ultimoQuadro = 0;
  private morta = false;
  private descartaveis: { dispose(): void }[] = [];
  private realcado: THREE.Object3D | null = null;
  private emissivos = new Map<THREE.MeshStandardMaterial, { cor: THREE.Color; intensidade: number }>();
  private apertou: { x: number; y: number } | null = null;
  private passou: PointerEvent | null = null;
  /** Quando o coelho volta ao lugar do estado (depois de usar uma função); 0, não volta. */
  private voltarEm = 0;
  /** O medidor: o tempo de cada quadro desenhado (os últimos 60) e quantos foram desenhados. */
  private tempos: number[] = [];
  desenhados = 0;
  private tema: Tema;
  private mundo: QuartoNoMundo = noMundo(null);
  /** O que vai virar uma malha só (o tema que junta): as peças paradas, as paredes e o chão. */
  private paraJuntar: THREE.Object3D[] = [];
  private juntas = 0;

  constructor(
    private caixa: HTMLElement,
    private opcoes: OpcoesDoQuarto3D,
    private cores: CoresDoCoelho = CORES_DO_MASCOTE,
    tema = 'classico',
  ) {
    this.tema = TEMAS[tema] ?? TEMAS.classico;
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'low-power',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.sombras = lerSombras();
    this.calmo = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    this.renderer.shadowMap.enabled = this.sombras;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const canvas = this.renderer.domElement;
    canvas.className = 'quarto3d-tela';
    caixa.appendChild(canvas);
    this.observador = new ResizeObserver(() => this.medir());
    this.observador.observe(caixa);
    canvas.addEventListener('pointerdown', this.aoApertar);
    canvas.addEventListener('pointerup', this.aoSoltar);
    canvas.addEventListener('pointermove', this.aoMover);
    canvas.addEventListener('pointerleave', this.aoSair);
    window.addEventListener('syden:graficos', this.aoMudarGraficos);
    window.addEventListener('storage', this.aoMudarGraficos);

    const centro = new THREE.Vector3(N / 2 - 0.3, 0.9, N / 2 - 0.3);
    this.camera.position.copy(centro).add(new THREE.Vector3(12, 10.5, 12));
    this.camera.lookAt(centro);
    this.medir();

    // o sol do alto, do lado aberto do quarto: as sombras caem para as paredes
    this.sol.position.set(6, 12, 9);
    this.sol.target.position.set(3.5, 0, 3.5);
    this.sol.castShadow = true;
    this.sol.shadow.mapSize.set(1024, 1024);
    Object.assign(this.sol.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 30 });
    this.sol.shadow.bias = -0.0006;
    this.sol.shadow.normalBias = 0.03;
    this.preenche.position.set(10, 8, 10);
    this.cena.add(this.ceu, this.sol, this.sol.target, this.preenche);
    if (import.meta.env.DEV) (window as unknown as { quarto3dDoTeste?: CenaDoQuarto3D }).quarto3dDoTeste = this;
  }

  /** Carrega os modelos e monta o quarto com a arrumação do pixel (null: a de fábrica). Rejeita se algo falhar. */
  async montar(arrumacao: ArrumacaoDoPixel | null = null): Promise<void> {
    const mundo = noMundo(arrumacao);
    this.mundo = mundo;
    const tema = this.tema;
    // tudo em paralelo (o cache junta os repetidos)
    const nomes = new Set<string>([tema.parede.reta, tema.parede.janela, ...(tema.parede.janelaTres ?? [])]);
    if (tema.chao.arquivo) nomes.add(tema.chao.arquivo);
    if (tema.parede.cortina) nomes.add(tema.parede.cortina.arquivo);
    const daPeca = (p: { arquivo: string; partes?: Parte[] }) => {
      nomes.add(p.arquivo);
      for (const c of p.partes ?? []) nomes.add(c.arquivo);
    };
    for (const m of mundo.moveis) daPeca(tema.moveis[m.tipo]);
    daPeca(tema.cadeira);
    for (const q of mundo.naParede) daPeca(tema.naParede[q.tipo]);
    for (const o of mundo.deCima) if (tema.deCima[o.tipo]) nomes.add(tema.deCima[o.tipo].arquivo);
    for (const n of [...nomes]) if (n.startsWith('codigo:')) nomes.delete(n);
    const [g] = await Promise.all([carregarCoelho(), ...[...nomes].map(modelo)]);
    if (this.morta) return;
    await this.montarChao();
    for (const m of mundo.moveis) this.moveis.push(await this.montarMovel(m));
    this.moveis.push(await this.montarCadeira());
    for (const o of mundo.deCima) await this.montarDeCima(o);
    await this.montarParedes();
    for (const q of mundo.naParede) await this.montarNaParede(q);
    if (tema.luzinhas) this.luzinhas();
    if (tema.juntar) this.juntar();
    if (this.morta) return;
    this.montarCoelho(g);
    this.aplicarHora();
    this.aplicarEstado(true);
    this.renderer.setAnimationLoop(this.desenhar);
  }

  // ---- o que vem de fora ----

  definirNoite(noite: boolean) {
    if (noite === this.noite) return;
    this.noite = noite;
    for (const p of this.moveis) p.luzAMao = false;
    // antes de montar, só guarda (montar aplica a hora)
    if (this.coelho) this.aplicarHora();
  }

  definirEstado(estado: EstadoDoCoelho) {
    if (estado === this.estado) return;
    this.estado = estado;
    if (this.coelho) this.aplicarEstado(false);
  }

  definirCores(cores: CoresDoCoelho) {
    this.cores = cores;
    this.coelho?.copia.material.pintar(cores);
  }

  /** A função pelo teclado ou pelo leitor de tela: o mesmo caminho do clique (o coelho vai, e então ela abre). */
  usarFuncao(id: string) {
    const alvo = this.alvoDaFuncao(id);
    if (alvo) this.agir(alvo);
    else this.opcoes.aoFuncao(id);
  }

  /** Onde o objeto de uma função aparece na caixa, em pixels (o teste de tela clica ali). */
  pontoDaFuncao(id: string): { x: number; y: number } | null {
    const alvo = this.alvoDaFuncao(id);
    if (!alvo?.realce) return null;
    const c = new THREE.Box3().setFromObject(alvo.realce).getCenter(new THREE.Vector3()).project(this.camera);
    return { x: ((c.x + 1) / 2) * this.caixa.clientWidth, y: ((1 - c.y) / 2) * this.caixa.clientHeight };
  }

  /** O medidor (o teste de tela): a média dos últimos quadros, e o que o último desenhou. */
  medida() {
    const i = this.renderer.info.render;
    const ms = this.tempos.length ? this.tempos.reduce((a, b) => a + b, 0) / this.tempos.length : 0;
    const c = this.coelho;
    return {
      ms,
      chamadas: i.calls,
      triangulos: i.triangles,
      desenhados: this.desenhados,
      pose: c?.pose,
      animacao: c?.tocando,
      em: c?.em?.id ?? null,
      tema: this.tema.id,
      planta: this.mundo.planta,
      moveis: this.moveis.map((p) => ({ id: p.id, x: +p.centro.x.toFixed(2), z: +p.centro.z.toFixed(2), rumo: +p.rumo.toFixed(2) })),
      juntas: this.juntas,
      coelho: c ? { x: +c.raiz.position.x.toFixed(2), y: +c.raiz.position.y.toFixed(2), z: +c.raiz.position.z.toFixed(2) } : null,
      naCama: c?.pose === 'deitado' && c.em ? this.conferirDeitado(c.em) : null,
    };
  }

  /** O teste de tela: o corpo deitado cabe na caixa da cama (de cima), fica acima do chão, e a cabeça está do lado da cabeceira. */
  private conferirDeitado(p: Pronto) {
    const c = this.coelho!;
    const corpo = new THREE.Box3().setFromObject(c.copia.corpo, true);
    const cama = new THREE.Box3().setFromObject(p.base);
    const folga = 0.05;
    const dentro =
      corpo.min.x >= cama.min.x - folga && corpo.max.x <= cama.max.x + folga && corpo.min.z >= cama.min.z - folga && corpo.max.z <= cama.max.z + folga;
    const f = new THREE.Vector3(Math.sin(p.rumo), 0, Math.cos(p.rumo));
    const meio = cama.getCenter(new THREE.Vector3());
    const cabeca = c.copia.corpo.getObjectByName('cabeca')?.getWorldPosition(new THREE.Vector3());
    // a cabeça na metade de trás da cama (a frente é o lado dos pés)
    const naCabeceira = cabeca ? cabeca.clone().sub(meio).dot(f) < 0 : null;
    return { dentro, acimaDoChao: corpo.min.y > cama.max.y * 0.25, naCabeceira };
  }

  destruir() {
    this.morta = true;
    this.renderer.setAnimationLoop(null);
    this.observador.disconnect();
    const canvas = this.renderer.domElement;
    canvas.removeEventListener('pointerdown', this.aoApertar);
    canvas.removeEventListener('pointerup', this.aoSoltar);
    canvas.removeEventListener('pointermove', this.aoMover);
    canvas.removeEventListener('pointerleave', this.aoSair);
    window.removeEventListener('syden:graficos', this.aoMudarGraficos);
    window.removeEventListener('storage', this.aoMudarGraficos);
    this.coelho?.copia.descartar();
    // os materiais são cópias (os de cada peça); a geometria e as texturas dos modelos ficam no cache
    this.cena.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      for (const mat of Array.isArray(m.material) ? m.material : [m.material]) mat.dispose();
    });
    for (const d of this.descartaveis) d.dispose();
    if (import.meta.env.DEV) {
      const w = window as unknown as { quarto3dDoTeste?: CenaDoQuarto3D };
      if (w.quarto3dDoTeste === this) delete w.quarto3dDoTeste;
    }
    this.renderer.forceContextLoss();
    this.renderer.dispose();
    canvas.remove();
  }

  // ---- a montagem ----

  private medir() {
    const w = Math.max(1, this.caixa.clientWidth);
    const h = Math.max(1, this.caixa.clientHeight);
    this.renderer.setSize(w, h, false);
    const a = w / h;
    // o quarto inteiro (o chão e as duas paredes) cabendo na caixa quadrada da home
    const meia = a >= 1 ? 6.1 : 6.1 / a;
    Object.assign(this.camera, { left: -meia * a, right: meia * a, top: meia + 0.35, bottom: -meia + 0.35 });
    this.camera.updateProjectionMatrix();
    this.ultimoQuadro = 0;
  }

  private textura(desenhar: (g: CanvasRenderingContext2D, L: number) => void, L = 512, repetir = 1) {
    const c = document.createElement('canvas');
    c.width = c.height = L;
    desenhar(c.getContext('2d')!, L);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repetir, repetir);
    t.anisotropy = 8;
    this.descartaveis.push(t);
    return t;
  }

  private geo<G extends THREE.BufferGeometry>(g: G): G {
    this.descartaveis.push(g);
    return g;
  }

  /** A cor do Cômodo (parede ou piso) num material: a razão entre a escolhida e a de fábrica, como a página faz na casca. */
  private tingir(mat: THREE.MeshStandardMaterial, cor: [number, number, number] | undefined, base: [number, number, number]) {
    if (!cor) return;
    mat.color.setRGB(Math.min(1.4, cor[0] / base[0]), Math.min(1.4, cor[1] / base[1]), Math.min(1.4, cor[2] / base[2]), THREE.SRGBColorSpace);
  }

  /** As casas de chão em retângulos (o L são dois, o cubículo um menor). */
  private retangulosDoChao(): [number, number, number, number][] {
    const r: [number, number, number, number][] = [];
    const feito = new Set<string>();
    for (let z = 0; z < N; z++)
      for (let x = 0; x < N; x++) {
        if (feito.has(`${x},${z}`) || !this.mundo.chao(x + 0.5, z + 0.5)) continue;
        let x1 = x;
        while (x1 + 1 < N && this.mundo.chao(x1 + 1.5, z + 0.5) && !feito.has(`${x1 + 1},${z}`)) x1++;
        let z1 = z;
        const linha = (zz: number) => {
          for (let i = x; i <= x1; i++) if (!this.mundo.chao(i + 0.5, zz + 0.5) || feito.has(`${i},${zz}`)) return false;
          return true;
        };
        while (z1 + 1 < N && linha(z1 + 1)) z1++;
        for (let i = x; i <= x1; i++) for (let k = z; k <= z1; k++) feito.add(`${i},${k}`);
        r.push([x, x1 + 1, z, z1 + 1]);
      }
    return r;
  }

  private async montarChao() {
    const tema = this.tema;
    const rets = this.retangulosDoChao();
    if (tema.chao.arquivo) {
      // as placas do pacote, uma a cada "casas" casas
      const c = tema.chao.casas ?? 2;
      const g = await modelo(tema.chao.arquivo);
      for (const [x0, x1, z0, z1] of rets)
        for (let x = x0; x < x1; x += c)
          for (let z = z0; z < z1; z += c) {
            const o = this.copia(g, tema.chao.arquivo);
            o.scale.set(c / 2, tema.escala, c / 2);
            o.position.set(x + c / 2, 0, z + c / 2);
            o.traverse((m) => (m as THREE.Mesh).isMesh && this.tingir((m as THREE.Mesh).material as THREE.MeshStandardMaterial, this.mundo.cores.piso, [176, 120, 80]));
            this.cena.add(o);
            this.paraJuntar.push(o);
          }
    } else {
      for (const [x0, x1, z0, z1] of rets) {
        const L = x1 - x0;
        const P = z1 - z0;
        const tabuas = this.textura((g, T) => {
          const cores = ['#b9845a', '#b07c53', '#c08d62', '#a9764f'];
          const n = 8;
          for (let i = 0; i < n; i++) {
            g.fillStyle = cores[i % cores.length];
            g.fillRect(0, (i * T) / n, T, T / n);
            g.fillStyle = 'rgba(70,40,25,0.35)';
            g.fillRect(0, ((i + 1) * T) / n - 3, T, 3);
            const corte = ((i * 197) % 5) * (T / 5);
            g.fillRect(corte, (i * T) / n, 3, T / n);
          }
        }, 512);
        tabuas.repeat.set(L / 4, P / 4);
        const mat = new THREE.MeshStandardMaterial({ map: tabuas, roughness: 0.85 });
        this.tingir(mat, this.mundo.cores.piso, [176, 120, 80]);
        const chao = new THREE.Mesh(this.geo(new THREE.BoxGeometry(L, 0.2, P)), mat);
        chao.position.set(x0 + L / 2, -0.1, z0 + P / 2);
        chao.receiveShadow = true;
        this.cena.add(chao);
      }
    }
    // o alto do pilar do L (o que a planta tira do chão e fica entre as paredes)
    if (this.mundo.planta === 'l')
      for (const s of this.mundo.solidos) {
        const tampa = new THREE.Mesh(this.geo(new THREE.BoxGeometry(s.x1 - s.x0, 0.08, s.z1 - s.z0)), new THREE.MeshStandardMaterial({ color: tema.parede.topo, roughness: 0.9 }));
        tampa.position.set((s.x0 + s.x1) / 2, ALTURA_DA_PAREDE - 0.02, (s.z0 + s.z1) / 2);
        this.cena.add(tampa);
      }
  }

  /** Uma cópia com materiais próprios (para realçar só esta). No Kenney de móveis, as cores viram as do KayKit. */
  private copia(g: GLTF, nome = '', cores: Record<string, string> = {}) {
    const o = g.scene.clone(true);
    const kenney = ehKenney(nome);
    o.traverse((x) => {
      const m = x as THREE.Mesh;
      if (!m.isMesh) return;
      const mat = (m.material as THREE.MeshStandardMaterial).clone();
      if (kenney) {
        const cor = cores[mat.name] ?? PALETA_KENNEY[mat.name];
        if (cor) mat.color.set(cor);
        mat.metalness = 0;
        mat.roughness = 0.9;
        if (mat.name === 'lamp') this.lampadas.push(mat);
      } else if (cores[mat.name]) mat.color.set(cores[mat.name]);
      // a moldura do Tiny Treats traz uma imagem de exemplo: no lugar dela, uma foto desenhada
      if (mat.name.includes('CUSTOMIMAGE')) mat.map = this.foto();
      m.material = mat;
      m.castShadow = true;
      m.receiveShadow = true;
    });
    return o;
  }

  /** O tamanho de base de um arquivo: o do Kenney é outro. */
  private escalaDe(nome: string) {
    return ehGlb(nome) ? K : this.tema.escala;
  }

  /** A peça no tamanho do pacote, centrada na própria pegada e com a base em y = 0 (ou um objeto feito por código). */
  private async peca(nome: string, cores?: Record<string, string>, escala = 1): Promise<{ g: THREE.Group; tam: THREE.Vector3 }> {
    let o: THREE.Object3D;
    if (nome.startsWith('codigo:')) o = this.feitoPorCodigo(nome.slice(7));
    else {
      o = this.copia(await modelo(nome), nome, cores);
      o.scale.setScalar(this.escalaDe(nome));
    }
    o.scale.multiplyScalar(escala);
    const caixa = new THREE.Box3().setFromObject(o);
    const tam = caixa.getSize(new THREE.Vector3());
    const c = caixa.getCenter(new THREE.Vector3());
    o.position.set(o.position.x - c.x, o.position.y - caixa.min.y, o.position.z - c.z);
    return { g: new THREE.Group().add(o), tam };
  }

  /** As partes de uma peça (o abajur no criado-mudo, os monitores na mesa), em cima dela; a parte com luz, a lâmpada. */
  private async partes(corpo: THREE.Group, partes: Parte[] | undefined, alto: number): Promise<THREE.PointLight | undefined> {
    let luz: THREE.PointLight | undefined;
    for (const c of partes ?? []) {
      const { g, tam } = await this.peca(c.arquivo, c.cores, c.escala);
      g.position.set(c.dx ?? 0, c.dy ?? alto, c.dz ?? 0);
      g.rotation.y = c.giro ?? 0;
      corpo.add(g);
      if (c.luz) {
        // sem sombra: a de luz pontual são seis desenhos a mais por quadro (medido no piloto: 20 ms de noite)
        luz = new THREE.PointLight('#ffc477', 0, 5, 1.6);
        luz.position.set(c.dx ?? 0, (c.dy ?? alto) + tam.y * 0.6, c.dz ?? 0);
        corpo.add(luz);
      }
    }
    return luz;
  }

  private async montarMovel(m: QuartoNoMundo['moveis'][number]): Promise<Pronto> {
    const spec = this.tema.moveis[m.tipo];
    const { g: base, tam } = await this.peca(spec.arquivo, m.tipo === 'tapete' ? undefined : spec.cores, spec.escala);
    if (spec.giro) base.rotation.y = spec.giro;
    // o tapete com a cor escolhida: lisa, no lugar da textura do pacote (a cor por cima dela misturava as duas: o rosa no tapete
    // azul do KayKit saía cinza)
    if (m.tipo === 'tapete' && this.mundo.cores.tapete)
      base.traverse((x) => {
        const mat = (x as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
        if (!(x as THREE.Mesh).isMesh || !mat) return;
        mat.map = null;
        mat.color.set(this.mundo.cores.tapete!);
        mat.needsUpdate = true;
      });
    // cabe no pé do pixel (no referencial da peça: a largura em x e o fundo em z)
    const cabe = spec.cabe ?? 'encolher';
    const ajuste = cabe === 'livre' ? 1 : Math.min(m.largura / tam.x, m.fundo / tam.z);
    const s = cabe === 'encher' ? ajuste : Math.min(1, ajuste);
    const corpo = new THREE.Group().add(base);
    corpo.scale.setScalar(s);
    const luz = await this.partes(corpo, spec.partes, tam.y);
    // encostada: as costas no fundo do pé
    if (spec.encostar) corpo.position.z = -m.fundo / 2 + (tam.z * s) / 2;
    const giro = new THREE.Group().add(corpo);
    const rumo = -m.lado * (Math.PI / 2);
    giro.rotation.y = rumo;
    const raiz = new THREE.Group().add(giro);
    raiz.position.set(m.x, 0, m.z);
    raiz.userData.movel = m.id;
    // a função é do original; a cópia ("cama~2") é só o móvel
    const funcao = m.id === m.tipo ? FUNCAO_DO_MOVEL[m.tipo] : undefined;
    if (funcao) raiz.userData.funcao = funcao;
    if (luz) luz.intensity = 0;
    this.cena.add(raiz);
    raiz.updateMatrixWorld(true);
    const caixa = new THREE.Box3().setFromObject(base);
    const uso = m.tipo === 'cama' ? 'deitar' : spec.pose ? 'sentar' : undefined;
    const p: Pronto = {
      id: m.id,
      tipo: m.tipo,
      raiz,
      base,
      rumo,
      centro: caixa.getCenter(new THREE.Vector3()),
      altura: caixa.max.y,
      tampo: spec.tampo !== undefined ? caixa.max.y * spec.tampo : caixa.max.y,
      pe: m.pe,
      spec,
      funcao,
      uso,
      chao: m.tipo === 'tapete',
      luz,
    };
    // o que não tem função nem uso fica parado: vai para a malha só (no tema que junta), o tapete com cor fica à parte
    if (!funcao && !uso && !luz && !(m.tipo === 'tapete' && this.mundo.cores.tapete)) this.paraJuntar.push(raiz);
    return p;
  }

  /** A cadeira do computador, solta: onde parou no pixel, virada para onde ela gira. */
  private async montarCadeira(): Promise<Pronto> {
    const spec = this.tema.cadeira;
    const { g: base } = await this.peca(spec.arquivo, spec.cores, spec.escala);
    const { x, z, giro: th } = this.mundo.cadeira;
    const giro = new THREE.Group().add(base);
    giro.rotation.y = th;
    const raiz = new THREE.Group().add(giro);
    raiz.position.set(Math.max(0.5, Math.min(N - 0.5, x)), 0, Math.max(0.5, Math.min(N - 0.5, z)));
    raiz.userData.movel = 'cadeira';
    this.cena.add(raiz);
    raiz.updateMatrixWorld(true);
    const caixa = new THREE.Box3().setFromObject(base);
    const cx = Math.floor(raiz.position.x);
    const cz = Math.floor(raiz.position.z);
    return {
      id: 'cadeira',
      tipo: 'cadeira',
      raiz,
      base,
      rumo: th,
      centro: caixa.getCenter(new THREE.Vector3()),
      altura: caixa.max.y,
      tampo: caixa.max.y,
      pe: { x0: cx, x1: cx + 1, z0: cz, z1: cz + 1 },
      spec,
      uso: 'sentar',
    };
  }

  /** Um objeto de cima (a caneca, os livros…) no tampo do móvel, na posição que ele tem no pixel. */
  private async montarDeCima(o: QuartoNoMundo['deCima'][number]) {
    const spec = this.tema.deCima[o.tipo];
    const p = this.moveis.find((m) => m.id === o.em);
    if (!spec || !p) return;
    const { g, tam } = await this.peca(spec.arquivo);
    g.scale.setScalar(spec.alto / Math.max(0.01, tam.y));
    const r = 0.18;
    let fx = Math.min(1, Math.max(0, o.fx));
    let fz = Math.min(1, Math.max(0, o.fz));
    // no criado-mudo, o abajur está no meio: o que cair ali vai para a borda (foraDoQueEstaEmPe, na página)
    if (p.tipo === 'abajur') {
      const dx = fx - 0.5;
      const dz = fz - 0.5;
      const d = Math.hypot(dx, dz);
      if (d < 0.36) [fx, fz] = d < 1e-3 ? [0.86, 0.86] : [0.5 + (dx / d) * 0.36, 0.5 + (dz / d) * 0.36];
    }
    const caixa = new THREE.Box3().setFromObject(p.base);
    const x = THREE.MathUtils.clamp(p.pe.x0 + fx * (p.pe.x1 - p.pe.x0), caixa.min.x + r, caixa.max.x - r);
    const z = THREE.MathUtils.clamp(p.pe.z0 + fz * (p.pe.z1 - p.pe.z0), caixa.min.z + r, caixa.max.z - r);
    g.position.set(x, p.tampo, z);
    g.rotation.y = p.rumo - o.lado * (Math.PI / 2);
    this.cena.add(g);
    // vai com o móvel (para o realce e para o clique)
    p.raiz.attach(g);
  }

  /** As paredes de cada trecho da planta, com a janela no trecho dela (a peça de janela do pacote no vão do pixel). */
  private async montarParedes() {
    const tema = this.tema;
    const j = this.mundo.janela;
    for (const t of this.mundo.trechos) {
      const temJanela = j.parede === t.parede && Math.abs(j.recuo - t.recuo) < 0.01 && j.a > t.de && j.a < t.ate;
      const pedacos: [number, number][] = temJanela
        ? [
            [t.de, j.a - j.largura / 2],
            [j.a + j.largura / 2, t.ate],
          ]
        : [[t.de, t.ate]];
      for (const [de, ate] of pedacos) {
        const L = ate - de;
        if (L < 0.02) continue;
        const n = Math.max(1, Math.round(L / (tema.parede.largura * tema.escala)));
        for (let i = 0; i < n; i++) {
          const o = await this.pecaDeParede(tema.parede.reta, L / n);
          this.porNaParede(o, t.parede, de + (i + 0.5) * (L / n), t.recuo);
          this.paraJuntar.push(o);
        }
      }
      if (!temJanela) continue;
      // a janela: uma peça, ou a de três (as pontas e o meio repetido), na largura do vão do pixel
      const jan = new THREE.Group();
      const n = tema.parede.janelaTres ? Math.max(1, Math.round(j.largura / (tema.parede.largura * tema.escala))) : 1;
      for (let i = 0; i < n; i++) {
        const tres = tema.parede.janelaTres;
        const arq = n === 1 || !tres ? tema.parede.janela : i === 0 ? tres[0] : i === n - 1 ? tres[2] : tres[1];
        const o = await this.pecaDeParede(arq, j.largura / n);
        o.position.x = -j.largura / 2 + (i + 0.5) * (j.largura / n);
        jan.add(o);
      }
      this.porNaParede(jan, t.parede, j.a, t.recuo);
      jan.userData.funcao = 'janela';
      this.daParede.push(jan);
      this.foraDaJanela(j);
    }
  }

  /** Uma peça de parede do pacote na largura pedida (um tico mais larga: as pontas se sobrepõem e a emenda some). */
  private async pecaDeParede(arquivo: string, largura: number) {
    const o = this.copia(await modelo(arquivo), arquivo);
    const e = this.tema.escala;
    o.scale.set((largura / this.tema.parede.largura) * 1.04, e, e);
    o.traverse((m) => (m as THREE.Mesh).isMesh && this.tingir((m as THREE.Mesh).material as THREE.MeshStandardMaterial, this.mundo.cores.parede, this.tema.parede.base));
    return new THREE.Group().add(o);
  }

  /** Põe na parede: a do fundo (z = recuo, ao longo de x) ou a da esquerda (x = recuo, ao longo de z, virada para +x). */
  private porNaParede(o: THREE.Object3D, parede: 'fundo' | 'esquerda', a: number, recuo: number, y = 0) {
    if (parede === 'fundo') o.position.set(a, y, recuo - 0.19);
    else {
      o.rotation.y = Math.PI / 2;
      o.position.set(recuo - 0.19, y, a);
    }
    this.cena.add(o);
  }

  /** Lá fora: um céu e um morro atrás da janela. */
  private foraDaJanela(j: NaParedeNoMundo) {
    const ceu = new THREE.Mesh(this.geo(new THREE.PlaneGeometry(j.largura + 0.3, 1.7)), new THREE.MeshBasicMaterial({ color: '#a8dcf5' }));
    const morro = new THREE.Mesh(this.geo(new THREE.SphereGeometry(1, 24, 12)), new THREE.MeshBasicMaterial({ color: '#86c06a' }));
    morro.scale.set(j.largura * 0.42, 0.6, 0.05);
    if (j.parede === 'fundo') {
      ceu.position.set(j.a, 1.55, j.recuo - 0.45);
      morro.position.set(j.a + 0.1, 0.85, j.recuo - 0.42);
    } else {
      ceu.rotation.y = Math.PI / 2;
      ceu.position.set(j.recuo - 0.45, 1.55, j.a);
      morro.rotation.y = Math.PI / 2;
      morro.position.set(j.recuo - 0.42, 0.85, j.a + 0.1);
    }
    this.cena.add(ceu, morro);
    this.fora.push(ceu);
    this.morro.push(morro);
  }

  /** Um objeto da parede: centrado onde o pixel o pintou (ao longo da parede e na altura), com as costas na parede. */
  private async montarNaParede(q: NaParedeNoMundo) {
    const spec: PecaDaParede = this.tema.naParede[q.tipo];
    const g = new THREE.Group();
    const vezes = spec.repetir ?? [[0, 0]];
    for (const [dx, dy] of vezes) {
      const { g: base, tam } = await this.peca(spec.arquivo, undefined, spec.escala);
      if (spec.fotos === 'kaykit') base.add(this.fotos(tam));
      base.position.x += dx;
      base.position.y += dy;
      g.add(base);
      await this.partes(base, spec.partes, tam.y);
    }
    // centrada no meio da caixa, as costas em z = 0
    const caixa = new THREE.Box3().setFromObject(g);
    const c = caixa.getCenter(new THREE.Vector3());
    for (const filho of g.children) filho.position.sub(new THREE.Vector3(c.x, c.y, caixa.min.z));
    // mais larga que o lugar do pixel: encolhe
    const largura = caixa.max.x - caixa.min.x;
    const altura = caixa.max.y - caixa.min.y;
    const s = Math.min(1, (q.largura * 1.05) / largura, (q.altura * 1.15) / altura);
    g.scale.setScalar(s);
    const quadro = new THREE.Group().add(g);
    const y = q.chao ? (altura * s) / 2 : q.y;
    this.porNaParede(quadro, q.parede, q.a, q.recuo + 0.24, y);
    const funcao = q.id === q.tipo ? FUNCAO_DA_PAREDE[q.tipo] : undefined;
    if (funcao) {
      quadro.userData.funcao = funcao;
      this.daParede.push(quadro);
      // a caixa inteira pega o clique (o fone é um arco com o vão no meio, e o clique no vão passava pela parede)
      const alvo = new THREE.Mesh(this.geo(new THREE.BoxGeometry(largura, altura, Math.max(0.1, caixa.max.z - caixa.min.z))), new THREE.MeshBasicMaterial());
      alvo.visible = false;
      alvo.position.z = (caixa.max.z - caixa.min.z) / 2;
      g.add(alvo);
    } else if (!spec.arquivo.startsWith('codigo:') && !spec.fotos && !spec.partes?.some((p) => p.arquivo.startsWith('codigo:'))) this.paraJuntar.push(quadro);
  }

  // ---- o que nenhum pacote tem, feito por código ----

  private feitoPorCodigo(nome: string): THREE.Object3D {
    if (nome === 'cortica') return this.cortica();
    if (nome === 'trofeu') return this.trofeu();
    if (nome === 'fone') return this.fone();
    if (nome === 'neon') return this.neon();
    if (nome === 'violao') return this.violao();
    if (nome === 'relogio') return this.relogioDeParede();
    if (nome === 'ventilador') return this.ventilador();
    if (nome === 'caminha-gato') return this.caminhaDoGato();
    return new THREE.Group();
  }

  private material(cor: string, extra: THREE.MeshStandardMaterialParameters = {}) {
    return new THREE.MeshStandardMaterial({ color: cor, roughness: 0.75, ...extra });
  }

  /** A cortiça (Caixa de ideias): moldura, a cortiça pontilhada, quatro bilhetes e as tachinhas. */
  private cortica() {
    const L = 1.15;
    const A = 0.8;
    const g = new THREE.Group();
    const madeira = this.material('#9a5d36', { roughness: 0.85 });
    const pontos = this.textura((c, t) => {
      c.fillStyle = '#c99a63';
      c.fillRect(0, 0, t, t);
      for (let i = 0; i < 900; i++) {
        c.fillStyle = i % 3 ? 'rgba(120,80,40,0.25)' : 'rgba(240,210,160,0.3)';
        c.fillRect((i * 97) % t, (i * 61 + (i >> 3) * 13) % t, 3, 3);
      }
    }, 128);
    const caixa = (w: number, h: number, d: number) => this.geo(new THREE.BoxGeometry(w, h, d));
    const fundo = new THREE.Mesh(caixa(L, A, 0.04), new THREE.MeshStandardMaterial({ map: pontos, roughness: 1 }));
    fundo.position.set(0, A / 2, 0.02);
    g.add(fundo);
    const ripa = (w: number, h: number, x: number, y: number) => {
      const r = new THREE.Mesh(caixa(w, h, 0.07), madeira);
      r.position.set(x, y, 0.035);
      g.add(r);
    };
    ripa(L + 0.08, 0.06, 0, 0);
    ripa(L + 0.08, 0.06, 0, A);
    ripa(0.06, A, -L / 2, A / 2);
    ripa(0.06, A, L / 2, A / 2);
    const bolinha = this.geo(new THREE.SphereGeometry(0.022, 8, 6));
    const vermelho = this.material('#c9473d', { roughness: 0.5 });
    const bilhetes: [string, number, number, number, number][] = [
      ['#f4e1a1', -0.3, 0.52, 0.28, -0.08],
      ['#9cc8d6', 0.12, 0.55, 0.24, 0.1],
      ['#efe5d2', 0.36, 0.3, 0.22, -0.05],
      ['#e9a38a', -0.12, 0.24, 0.3, 0.06],
    ];
    for (const [cor, x, y, t, giro] of bilhetes) {
      const b = new THREE.Mesh(caixa(t, t * 0.85, 0.008), this.material(cor, { roughness: 0.95 }));
      b.position.set(x, y, 0.045);
      b.rotation.z = giro;
      b.castShadow = true;
      g.add(b);
      const tacha = new THREE.Mesh(bolinha, vermelho);
      tacha.position.set(x, y + t * 0.33, 0.055);
      g.add(tacha);
    }
    g.traverse((o) => ((o as THREE.Mesh).receiveShadow = true));
    return g;
  }

  /** As cenas das fotos (um morro, o mar, o pôr do sol, a areia), sem foto de ninguém: o céu e o chão de cada uma. */
  private static CENAS: [string, string][] = [
    ['#a8dcf5', '#86c06a'],
    ['#f2b27a', '#d0705a'],
    ['#9cc8d6', '#3f8fb0'],
    ['#f3ead8', '#c99566'],
  ];
  private fotosFeitas = 0;

  /** As fotos do quadro de Amigos do KayKit: quatro fotos de papel desenhadas, num plano na frente da moldura. */
  private fotos(tam: THREE.Vector3): THREE.Object3D {
    const t = this.textura((c, L) => {
      c.clearRect(0, 0, L, L);
      const lugares: [number, number, number][] = [
        [0.2, 0.3, -0.08],
        [0.47, 0.62, 0.06],
        [0.74, 0.32, 0.1],
        [0.83, 0.7, -0.05],
      ];
      lugares.forEach(([x, y, giro], i) => {
        const [ceu, chao] = CenaDoQuarto3D.CENAS[i];
        c.save();
        c.translate(x * L, y * L);
        c.rotate(giro);
        c.fillStyle = 'rgba(60,40,30,0.25)';
        c.fillRect(-L * 0.12 + 4, -L * 0.15 + 5, L * 0.24, L * 0.3);
        c.fillStyle = '#fbf6ea';
        c.fillRect(-L * 0.12, -L * 0.15, L * 0.24, L * 0.3);
        c.fillStyle = ceu;
        c.fillRect(-L * 0.1, -L * 0.13, L * 0.2, L * 0.2);
        c.fillStyle = chao;
        c.beginPath();
        c.ellipse(0, L * 0.07, L * 0.12, L * 0.07, 0, Math.PI, 0);
        c.fill();
        c.restore();
      });
    }, 256);
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    const m = new THREE.Mesh(this.geo(new THREE.PlaneGeometry(1.25, 0.68)), new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.9 }));
    m.position.set(0, tam.y / 2, tam.z / 2 - 0.032);
    return m;
  }

  /** Uma foto inteira (as molduras do Tiny Treats: a imagem de exemplo do pacote vira uma destas). */
  private foto(): THREE.Texture {
    const [ceu, chao] = CenaDoQuarto3D.CENAS[this.fotosFeitas++ % CenaDoQuarto3D.CENAS.length];
    const t = this.textura((c, L) => {
      c.fillStyle = ceu;
      c.fillRect(0, 0, L, L);
      c.fillStyle = 'rgba(255,255,255,0.55)';
      c.beginPath();
      c.arc(L * 0.72, L * 0.28, L * 0.11, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = chao;
      c.beginPath();
      c.ellipse(L * 0.45, L * 0.95, L * 0.7, L * 0.42, 0, Math.PI, 0);
      c.fill();
    }, 128);
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    t.flipY = false;
    return t;
  }

  /** Um troféu: uma taça dourada (nenhum pacote tem uma). */
  private trofeu() {
    const ouro = this.material('#e2b53e', { roughness: 0.35, metalness: 0.3 });
    const base = this.material('#6b4430', { roughness: 0.8 });
    const g = new THREE.Group();
    const partes: [THREE.BufferGeometry, THREE.Material, number][] = [
      [new THREE.BoxGeometry(0.2, 0.07, 0.2), base, 0.035],
      [new THREE.CylinderGeometry(0.025, 0.04, 0.12, 10), ouro, 0.13],
      [new THREE.CylinderGeometry(0.11, 0.04, 0.16, 14), ouro, 0.27],
    ];
    for (const [geo, mat, y] of partes) {
      const m = new THREE.Mesh(this.geo(geo), mat);
      m.position.y = y;
      m.castShadow = true;
      g.add(m);
    }
    const alca = this.geo(new THREE.TorusGeometry(0.05, 0.012, 6, 12, Math.PI));
    for (const lado of [-1, 1]) {
      const a = new THREE.Mesh(alca, ouro);
      a.position.set(lado * 0.11, 0.28, 0);
      a.rotation.z = lado > 0 ? -Math.PI / 2 : Math.PI / 2;
      g.add(a);
    }
    return g;
  }

  /** O fone de Salas: pendurado num gancho de madeira na parede (o arco, as duas conchas e as almofadas). */
  private fone() {
    const g = new THREE.Group();
    const tons = this.tema.id === 'colorido' ? ['#5aa0d8', '#f0d36a', '#3c4a63'] : ['#3c3a40', '#c98c3c', '#26252a'];
    const corpo = this.material(tons[0], { roughness: 0.5 });
    const almofada = this.material(tons[2], { roughness: 0.9 });
    const madeira = this.material('#9a5d36', { roughness: 0.85 });
    const gancho = new THREE.Mesh(this.geo(new THREE.BoxGeometry(0.16, 0.06, 0.18)), madeira);
    gancho.position.set(0, 0.62, 0.09);
    const pino = new THREE.Mesh(this.geo(new THREE.CylinderGeometry(0.025, 0.025, 0.2, 8)), madeira);
    pino.rotation.x = Math.PI / 2;
    pino.position.set(0, 0.6, 0.16);
    const arco = new THREE.Mesh(this.geo(new THREE.TorusGeometry(0.22, 0.03, 8, 20, Math.PI)), corpo);
    arco.position.set(0, 0.4, 0.2);
    g.add(gancho, pino, arco);
    for (const lado of [-1, 1]) {
      const concha = new THREE.Mesh(this.geo(new THREE.CylinderGeometry(0.1, 0.1, 0.08, 16)), corpo);
      concha.rotation.z = Math.PI / 2;
      concha.position.set(lado * 0.22, 0.36, 0.2);
      const mola = new THREE.Mesh(this.geo(new THREE.CylinderGeometry(0.075, 0.075, 0.03, 14)), almofada);
      mola.rotation.z = Math.PI / 2;
      mola.position.set(lado * 0.17, 0.36, 0.2);
      const detalhe = new THREE.Mesh(this.geo(new THREE.CylinderGeometry(0.05, 0.05, 0.02, 12)), this.material(tons[1], { roughness: 0.4 }));
      detalhe.rotation.z = Math.PI / 2;
      detalhe.position.set(lado * 0.265, 0.36, 0.2);
      g.add(concha, mola, detalhe);
    }
    g.traverse((o) => ((o as THREE.Mesh).castShadow = true));
    return g;
  }

  /** O neon: um coração em tubo de luz (aceso de noite), numa placa escura. */
  private neon() {
    const g = new THREE.Group();
    const placa = new THREE.Mesh(this.geo(new THREE.BoxGeometry(1.0, 0.8, 0.04)), this.material('#2b2433', { roughness: 0.6 }));
    placa.position.set(0, 0.4, 0.02);
    const luz = this.material('#ff7fb8', { emissive: '#ff5aa0', emissiveIntensity: 0.6, roughness: 0.3 });
    this.brilham.push(luz);
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 48; i++) {
      const t = (i / 48) * Math.PI * 2;
      pts.push(new THREE.Vector3(0.016 * 16 * Math.sin(t) ** 3, 0.42 + 0.016 * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)), 0.07));
    }
    const tubo = new THREE.Mesh(this.geo(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 64, 0.022, 6, true)), luz);
    g.add(placa, tubo);
    return g;
  }

  /** O violão: o corpo em dois círculos, o braço e a boca, pendurado. */
  private violao() {
    const g = new THREE.Group();
    const madeira = this.material('#c98a4b', { roughness: 0.6 });
    const escura = this.material('#5b3a22', { roughness: 0.7 });
    for (const [r, y] of [
      [0.22, 0.25],
      [0.17, 0.52],
    ] as const) {
      const c = new THREE.Mesh(this.geo(new THREE.CylinderGeometry(r, r, 0.1, 20)), madeira);
      c.rotation.x = Math.PI / 2;
      c.position.set(0, y, 0.06);
      g.add(c);
    }
    const boca = new THREE.Mesh(this.geo(new THREE.CylinderGeometry(0.07, 0.07, 0.11, 16)), escura);
    boca.rotation.x = Math.PI / 2;
    boca.position.set(0, 0.4, 0.07);
    const braco = new THREE.Mesh(this.geo(new THREE.BoxGeometry(0.07, 0.55, 0.04)), escura);
    braco.position.set(0, 0.95, 0.07);
    const cabeca = new THREE.Mesh(this.geo(new THREE.BoxGeometry(0.1, 0.14, 0.04)), escura);
    cabeca.position.set(0, 1.28, 0.07);
    g.add(boca, braco, cabeca);
    g.traverse((o) => ((o as THREE.Mesh).castShadow = true));
    return g;
  }

  /**
   * A caminha do gato (09/11/2026, a peça nova do pixel): a borda redonda de tecido terracota, mais baixa na frente (+z, a
   * entrada, como no desenho), e a almofada creme dentro. O gato do quarto ainda não existe no 3D: ela fica vazia.
   */
  private caminhaDoGato() {
    const g = new THREE.Group();
    const tecido = this.material('#b8654a', { roughness: 0.9 });
    const almofada = this.material('#efe1c6', { roughness: 0.95 });
    // a borda: um toro achatado, com a entrada aberta na frente (o arco que falta) e um rolinho baixo no lugar dela
    const borda = new THREE.Mesh(this.geo(new THREE.TorusGeometry(0.3, 0.08, 10, 36, Math.PI * 1.6)), tecido);
    borda.rotation.x = -Math.PI / 2;
    borda.rotation.z = -Math.PI * 0.3; // (o vão do arco, de 1,6π a 2π, cai no +z)
    borda.scale.set(1, 1, 1.15);
    borda.position.y = 0.09;
    const entrada = new THREE.Mesh(this.geo(new THREE.TorusGeometry(0.3, 0.05, 8, 14, Math.PI * 0.4)), tecido);
    entrada.rotation.x = -Math.PI / 2;
    entrada.rotation.z = -Math.PI * 0.7;
    entrada.position.y = 0.05;
    const fundo = new THREE.Mesh(this.geo(new THREE.CylinderGeometry(0.34, 0.36, 0.05, 32)), tecido);
    fundo.position.y = 0.025;
    const meio = new THREE.Mesh(this.geo(new THREE.CylinderGeometry(0.25, 0.27, 0.05, 28)), almofada);
    meio.position.y = 0.07;
    g.add(fundo, borda, entrada, meio);
    g.traverse((o) => ((o as THREE.Mesh).castShadow = true));
    return g;
  }

  /**
   * O ventilador de pé (09/11/2026, a peça nova do pixel): nenhum pacote tem um (o Kenney só tem o de teto). A base redonda,
   * a haste, o motor e a grade com as três pás, virada para a frente (+z), como o do pixel.
   */
  private ventilador() {
    const g = new THREE.Group();
    const creme = this.material('#efe3c8', { roughness: 0.55 });
    const escuro = this.material('#6f6257', { roughness: 0.6 });
    const pa = this.material('#cfe3dc', { roughness: 0.5, side: THREE.DoubleSide });
    const base = new THREE.Mesh(this.geo(new THREE.CylinderGeometry(0.2, 0.23, 0.06, 20)), creme);
    base.position.y = 0.03;
    const haste = new THREE.Mesh(this.geo(new THREE.CylinderGeometry(0.025, 0.025, 0.72, 10)), creme);
    haste.position.y = 0.42;
    const motor = new THREE.Mesh(this.geo(new THREE.CylinderGeometry(0.08, 0.09, 0.16, 14)), creme);
    motor.rotation.x = Math.PI / 2;
    motor.position.set(0, 0.86, -0.04);
    const cabeca = new THREE.Group();
    cabeca.position.set(0, 0.86, 0.08);
    const aro = new THREE.Mesh(this.geo(new THREE.TorusGeometry(0.26, 0.015, 6, 32)), creme);
    const raio = this.geo(new THREE.BoxGeometry(0.008, 0.52, 0.008));
    for (let i = 0; i < 6; i++) {
      const r = new THREE.Mesh(raio, creme);
      r.rotation.z = (i * Math.PI) / 6;
      r.position.z = 0.03;
      cabeca.add(r);
    }
    const miolo = new THREE.Mesh(this.geo(new THREE.CylinderGeometry(0.045, 0.045, 0.05, 12)), escuro);
    miolo.rotation.x = Math.PI / 2;
    const forma = new THREE.Shape();
    forma.moveTo(0, 0);
    forma.bezierCurveTo(0.08, 0.06, 0.2, 0.08, 0.22, 0);
    forma.bezierCurveTo(0.2, -0.06, 0.08, -0.05, 0, 0);
    const desenhoDaPa = this.geo(new THREE.ShapeGeometry(forma));
    for (let i = 0; i < 3; i++) {
      const p = new THREE.Mesh(desenhoDaPa, pa);
      p.rotation.z = (i * 2 * Math.PI) / 3;
      cabeca.add(p);
    }
    cabeca.add(aro, miolo);
    g.add(base, haste, motor, cabeca);
    g.traverse((o) => ((o as THREE.Mesh).castShadow = true));
    return g;
  }

  /** O relógio de parede do clássico: o aro, o mostrador e os ponteiros. */
  private relogioDeParede() {
    const g = new THREE.Group();
    const aro = new THREE.Mesh(this.geo(new THREE.CylinderGeometry(0.32, 0.32, 0.08, 24)), this.material('#9a5d36', { roughness: 0.8 }));
    aro.rotation.x = Math.PI / 2;
    aro.position.set(0, 0.32, 0.04);
    const mostrador = new THREE.Mesh(this.geo(new THREE.CylinderGeometry(0.27, 0.27, 0.085, 24)), this.material('#f3ead8', { roughness: 0.9 }));
    mostrador.rotation.x = Math.PI / 2;
    mostrador.position.set(0, 0.32, 0.045);
    const preto = this.material('#3a2d26');
    const h = new THREE.Mesh(this.geo(new THREE.BoxGeometry(0.03, 0.15, 0.01)), preto);
    h.position.set(0, 0.39, 0.095);
    const m = new THREE.Mesh(this.geo(new THREE.BoxGeometry(0.2, 0.025, 0.01)), preto);
    m.position.set(0.09, 0.32, 0.095);
    g.add(aro, mostrador, h, m);
    return g;
  }

  /** As luzinhas do alto de cada trecho de parede: o fio em arcos e as lâmpadas, acesas à noite (uma luz por parede inteira). */
  private luzinhas() {
    const fio = new THREE.LineBasicMaterial({ color: '#4a3a30' });
    this.descartaveis.push(fio);
    const tons = ['#ffcf7a', '#ffb070', '#ffe3a8'].map((c) => {
      const m = new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.35, roughness: 0.4 });
      this.lampadinhas.push(m);
      return m;
    });
    const bolinha = this.geo(new THREE.SphereGeometry(0.045, 8, 6));
    const Y = ALTURA_DA_PAREDE - 0.32;
    const porTom: THREE.Vector3[][] = tons.map(() => []);
    let k = 0;
    for (const t of this.mundo.trechos) {
      const L = t.ate - t.de;
      const arcos = Math.max(1, Math.round(L / 2.7));
      const ponto = (u: number) => {
        const f = ((u - t.de) / L) * arcos;
        const y = Y - Math.sin(Math.PI * (f - Math.floor(f))) * 0.18;
        return t.parede === 'fundo' ? new THREE.Vector3(u, y, t.recuo + 0.06) : new THREE.Vector3(t.recuo + 0.06, y, u);
      };
      const pontos: THREE.Vector3[] = [];
      for (let u = t.de + 0.15; u <= t.ate - 0.05; u += 0.05) pontos.push(ponto(u));
      this.cena.add(new THREE.Line(this.geo(new THREE.BufferGeometry().setFromPoints(pontos)), fio));
      for (let u = t.de + 0.35; u < t.ate - 0.1; u += 0.4) porTom[k++ % tons.length].push(ponto(u).add(new THREE.Vector3(0, -0.05, 0)));
      // uma luz por trecho grande (o L tem quatro trechos pequenos: só os de fora, de 4 casas, ganham)
      if (L >= 4) {
        const l = new THREE.PointLight('#ffc37a', 0, 5, 1.6);
        l.position.copy(ponto((t.de + t.ate) / 2)).add(t.parede === 'fundo' ? new THREE.Vector3(0, -0.2, 0.5) : new THREE.Vector3(0.5, -0.2, 0));
        this.cena.add(l);
        this.arandelas.push(l);
      }
    }
    porTom.forEach((lugares, i) => {
      if (!lugares.length) return;
      const inst = new THREE.InstancedMesh(bolinha, tons[i], lugares.length);
      lugares.forEach((p, j) => inst.setMatrixAt(j, new THREE.Matrix4().makeTranslation(p.x, p.y, p.z)));
      this.cena.add(inst);
    });
  }

  /**
   * AS PEÇAS PARADAS NUMA MALHA SÓ (o tema que junta: o Tiny Treats usa uma textura de paleta para quase tudo). O chão, as
   * paredes, as plantas, o tapete e os objetos da parede sem função viram uma malha por material; os originais ficam
   * invisíveis no lugar (o clique continua parando neles, como antes) e o desenho cai de dezenas de chamadas para poucas.
   */
  private juntar() {
    const grupos = new Map<string, { mat: THREE.Material; geos: THREE.BufferGeometry[]; donos: THREE.Mesh[] }>();
    for (const o of this.paraJuntar) {
      o.updateMatrixWorld(true);
      o.traverse((x) => {
        const m = x as THREE.Mesh;
        if (!m.isMesh || Array.isArray(m.material)) return;
        const mat = m.material as THREE.MeshStandardMaterial;
        const chave = `${mat.name}|${mat.color.getHexString()}|${mat.map ? (mat.map.name || mat.map.uuid) + (mat.map.image as { width?: number } | null)?.width : ''}|${mat.transparent}`;
        let gr = grupos.get(chave);
        if (!gr) grupos.set(chave, (gr = { mat, geos: [], donos: [] }));
        const geo = m.geometry.clone().applyMatrix4(m.matrixWorld);
        // a malha só precisa das mesmas listas em todas: posição, normal e textura
        for (const nome of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(nome)) geo.deleteAttribute(nome);
        gr.geos.push(geo);
        gr.donos.push(m);
      });
    }
    for (const gr of grupos.values()) {
      if (gr.geos.length < 2) {
        for (const g of gr.geos) g.dispose();
        continue;
      }
      const indexadas = gr.geos.every((g) => g.index);
      const geos = indexadas ? gr.geos : gr.geos.map((g) => (g.index ? g.toNonIndexed() : g));
      const junta = geos.every((g) => g.attributes.uv) || geos.every((g) => !g.attributes.uv) ? mergeGeometries(geos) : null;
      for (const g of gr.geos) g.dispose();
      if (!junta) continue;
      this.descartaveis.push(junta);
      const malha = new THREE.Mesh(junta, gr.mat.clone());
      malha.castShadow = malha.receiveShadow = true;
      this.cena.add(malha);
      for (const d of gr.donos) d.visible = false;
      this.juntas++;
    }
  }

  private montarCoelho(g: GLTF) {
    const copia = copiarCoelho(g, { altura: ALTURA_DO_COELHO, sombras: true, cores: this.cores });
    const corpo = new THREE.Group().add(copia.corpo);
    const raiz = new THREE.Group().add(corpo);
    const casa = this.livreMaisPerto(N / 2 + 0.5, N / 2 + 1.5, this.ocupadas()) ?? [4, 5];
    raiz.position.set(casa[0] + 0.5, 0, casa[1] + 0.5);
    this.cena.add(raiz);
    this.coelho = {
      copia,
      raiz,
      corpo,
      casa,
      caminho: [],
      de: raiz.position.clone(),
      para: raiz.position.clone(),
      inicio: 0,
      duracao: 0,
      arco: 0,
      rumo: 0,
      pose: 'pe',
      em: null,
      depois: null,
      tocando: '',
    };
    // a pose deitada não deixa o corpo onde fica a raiz (a raiz é o pé de pé; deitado, o corpo sobe e se estende para os dois
    // lados): mede-se a caixa dela uma vez, para a cama pôr o corpo em cima do colchão e as orelhas no travesseiro
    const dormindo = copia.acoes.get('dormindo');
    if (dormindo) {
      dormindo.reset().play();
      copia.mixer.update(0);
      raiz.updateMatrixWorld(true);
      this.deitado = new THREE.Box3().setFromObject(copia.corpo, true).translate(raiz.position.clone().negate());
      dormindo.stop();
    }
    this.tocar('parado');
  }

  /** A altura da superfície de uma peça no ponto (x, z), pelo raio de cima para baixo; null, se o raio não pega nela. */
  private superficie(o: THREE.Object3D, x: number, z: number): number | null {
    this.raio.set(new THREE.Vector3(x, 50, z), new THREE.Vector3(0, -1, 0));
    const r = this.raio.intersectObject(o, true)[0];
    return r ? r.point.y : null;
  }

  /**
   * Onde a raiz do coelho fica para ele deitar NA CAMA: medido no MODELO 3D (o pé do pixel é maior que a cama do pacote, e a
   * cama encostada fica no fundo dele). O corpo em cima do colchão (a altura pelo raio, no meio da cama), no meio da largura,
   * e as orelhas junto da cabeceira, que é o lado oposto à frente da cama (encostar põe as costas da peça no fundo do pé).
   */
  private pontoDeDeitar(p: Pronto): THREE.Vector3 {
    const d = this.deitado!;
    const caixa = new THREE.Box3().setFromObject(p.base);
    const tam = caixa.getSize(new THREE.Vector3());
    const meio = caixa.getCenter(new THREE.Vector3());
    // a frente (para os pés) e o lado, no giro da cama; o coelho deitado olha para a frente dela, as orelhas para trás
    const f = new THREE.Vector3(Math.sin(p.rumo), 0, Math.cos(p.rumo));
    const l = new THREE.Vector3(Math.cos(p.rumo), 0, -Math.sin(p.rumo));
    const comprido = Math.abs(f.x) * tam.x + Math.abs(f.z) * tam.z;
    // a cabeceira tem espessura: as orelhas começam um tanto para dentro dela
    const cabeceira = -comprido / 2 + comprido * 0.07;
    const aoLongo = cabeceira - d.min.z;
    const aoLado = -(d.min.x + d.max.x) / 2;
    const colchao = this.superficie(p.base, meio.x + f.x * comprido * 0.15, meio.z + f.z * comprido * 0.15) ?? caixa.max.y * 0.5;
    // afunda um pouco no colchão (o cobertor é macio, e a caixa do corpo pega a ponta das costas)
    const y = colchao - d.min.y - 0.04;
    return new THREE.Vector3(meio.x, y, meio.z).addScaledVector(f, aoLongo).addScaledVector(l, aoLado);
  }

  // ---- dia e noite, sombras ----

  private aplicarHora() {
    this.realcar(null);
    const noite = this.noite;
    this.ceu.intensity = noite ? 0.28 : 1.1;
    this.ceu.color.set(noite ? '#7d86c8' : '#fff3e0');
    this.sol.color.set(noite ? '#9fb4ff' : '#ffe2b8');
    this.sol.intensity = noite ? 0.7 : 3.2;
    this.preenche.intensity = noite ? 0.12 : 0.5;
    for (const f of this.fora) (f.material as THREE.MeshBasicMaterial).color.set(noite ? '#1f2850' : '#a8dcf5');
    for (const m of this.morro) (m.material as THREE.MeshBasicMaterial).color.set(noite ? '#243a32' : '#86c06a');
    // o abajur apagado no pixel (o botão direito nele) fica apagado à noite também
    for (const p of this.moveis) if (p.luz && !p.luzAMao) p.luz.intensity = noite && !(p.tipo === 'abajur' && this.mundo.abajurApagado) ? 6 : 0;
    for (const l of this.arandelas) l.intensity = noite ? 1.6 : 0;
    for (const m of this.lampadinhas) m.emissiveIntensity = noite ? 2.2 : 0.35;
    for (const m of this.brilham) m.emissiveIntensity = noite ? 2.4 : 0.6;
    for (const m of this.lampadas) {
      m.emissive.set('#ffcf7a');
      m.emissiveIntensity = noite ? 1.6 : 0;
    }
    this.renderer.toneMappingExposure = noite ? 1.25 : 1.0;
    this.ultimoQuadro = 0;
  }

  private aoMudarGraficos = () => {
    const sombras = lerSombras();
    if (sombras === this.sombras) return;
    this.sombras = sombras;
    this.renderer.shadowMap.enabled = sombras;
    this.cena.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) for (const mat of Array.isArray(m.material) ? m.material : [m.material]) mat.needsUpdate = true;
    });
  };

  // ---- o coelho ----

  private tocar(nome: string) {
    const c = this.coelho!;
    if (c.tocando === nome) return;
    const nova = c.copia.acoes.get(nome);
    if (!nova) return;
    const velha = c.copia.acoes.get(c.tocando);
    nova.reset().play();
    if (velha) velha.crossFadeTo(nova, 0.25, false);
    c.tocando = nome;
  }

  /** As casas em que não se anda: os móveis (menos o tapete), a cadeira, e o que não é chão na planta. */
  private ocupadas(): Set<string> {
    const s = new Set<string>();
    for (let x = 0; x < N; x++) for (let z = 0; z < N; z++) if (!this.mundo.chao(x + 0.5, z + 0.5)) s.add(`${x},${z}`);
    for (const p of this.moveis) {
      if (p.chao) continue;
      const { x0, x1, z0, z1 } = p.pe;
      for (let x = Math.floor(x0 + 0.01); x < Math.ceil(x1 - 0.01); x++) for (let z = Math.floor(z0 + 0.01); z < Math.ceil(z1 - 0.01); z++) s.add(`${x},${z}`);
    }
    return s;
  }

  /** O caminho pela grade, desviando dos móveis (busca em largura). */
  private caminho(de: [number, number], ate: [number, number], cheias: Set<string>): [number, number][] | null {
    const chave = (c: [number, number]) => `${c[0]},${c[1]}`;
    const veio = new Map<string, string | null>([[chave(de), null]]);
    const fila: [number, number][] = [de];
    while (fila.length) {
      const c = fila.shift()!;
      if (c[0] === ate[0] && c[1] === ate[1]) {
        const r: [number, number][] = [];
        let k: string | null = chave(c);
        while (k) {
          const [x, z] = k.split(',').map(Number);
          r.unshift([x, z]);
          k = veio.get(k) ?? null;
        }
        return r.slice(1);
      }
      for (const [dx, dz] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const n: [number, number] = [c[0] + dx, c[1] + dz];
        if (n[0] < 0 || n[1] < 0 || n[0] >= N || n[1] >= N || veio.has(chave(n)) || cheias.has(chave(n))) continue;
        veio.set(chave(n), chave(c));
        fila.push(n);
      }
    }
    return null;
  }

  private livreMaisPerto(x: number, z: number, cheias: Set<string>): [number, number] | null {
    let melhor: [number, number] | null = null;
    let dist = Infinity;
    for (let i = 0; i < N; i++)
      for (let j = 0; j < N; j++) {
        if (cheias.has(`${i},${j}`)) continue;
        const d = Math.hypot(i + 0.5 - x, j + 0.5 - z);
        if (d < dist) [dist, melhor] = [d, [i, j]];
      }
    return melhor;
  }

  private pular(para: THREE.Vector3, duracao: number, arco: number) {
    const c = this.coelho!;
    c.de.copy(c.raiz.position);
    c.para.copy(para);
    c.inicio = performance.now();
    // quem prefere menos movimento vê o coelho já no lugar
    c.duracao = this.calmo ? 0 : duracao;
    c.arco = arco;
    if (c.de.distanceTo(para) > 0.05) c.rumo = Math.atan2(para.x - c.de.x, para.z - c.de.z);
    if (!c.duracao) c.raiz.position.copy(para);
  }

  /** Anda até a casa e, chegando, faz `depois`. Se estava deitado ou sentado, desce primeiro. `imediato`: já está lá. */
  private irPara(alvo: [number, number], depois: (() => void) | null, imediato = false) {
    const c = this.coelho!;
    const cheias = this.ocupadas();
    if (c.pose !== 'pe') {
      c.pose = 'pe';
      c.em = null;
      const sai = this.livreMaisPerto(c.raiz.position.x, c.raiz.position.z, cheias)!;
      c.casa = sai;
      this.pular(new THREE.Vector3(sai[0] + 0.5, 0, sai[1] + 0.5), 420, 0.35);
      this.tocar('parado');
    }
    if (imediato || this.calmo) {
      c.casa = alvo;
      c.caminho = [];
      c.duracao = 0;
      c.raiz.position.set(alvo[0] + 0.5, 0, alvo[1] + 0.5);
      c.depois = null;
      depois?.();
      return;
    }
    const r = this.caminho(c.casa, alvo, cheias);
    c.caminho = r ?? [];
    c.depois = depois;
    // sem caminho (a casa fechada por móveis), a função abre assim mesmo: o desenho não pode segurar a função
    if (!r && depois) {
      c.depois = null;
      depois();
    }
  }

  /** A frente de um móvel (para onde ele olha) e quanto ele se estende nessa direção a partir do centro do desenho. */
  private frenteDe(p: Pronto) {
    const fx = Math.sin(p.rumo);
    const fz = Math.cos(p.rumo);
    const meio = Math.abs(fx) > Math.abs(fz) ? (p.pe.x1 - p.pe.x0) / 2 : (p.pe.z1 - p.pe.z0) / 2;
    return { fx, fz, meio: p.id === 'cadeira' ? 0.3 : meio };
  }

  /** Vai até a frente do móvel; chegando, olha para ele e faz `depois`. */
  private irAoMovel(p: Pronto, depois: () => void, imediato = false) {
    const c = this.coelho!;
    const { fx, fz, meio } = this.frenteDe(p);
    const { x: cx, z: cz } = p.centro;
    const chegada = this.livreMaisPerto(cx + fx * (meio + 0.5), cz + fz * (meio + 0.5), this.ocupadas());
    if (!chegada) return depois();
    this.irPara(
      chegada,
      () => {
        c.rumo = Math.atan2(cx - c.raiz.position.x, cz - c.raiz.position.z);
        depois();
      },
      imediato,
    );
  }

  /** Deita na cama ou senta (a cadeira, a poltrona, o pufe); `depois`, já sentado. */
  private usar(p: Pronto, depois: (() => void) | null = null, imediato = false) {
    const c = this.coelho!;
    if (c.em === p) return depois?.();
    this.irAoMovel(
      p,
      () => {
        const { fx, fz } = this.frenteDe(p);
        const instantaneo = imediato || this.calmo;
        const frente = new THREE.Vector3(fx, 0, fz);
        if (p.uso === 'deitar') {
          const ponto = this.deitado
            ? this.pontoDeDeitar(p)
            : new THREE.Vector3(p.centro.x, p.altura * 0.45, p.centro.z).add(frente.multiplyScalar(0.55));
          this.pular(ponto, instantaneo ? 0 : 520, 0.45);
          this.tocar('dormindo');
          c.pose = 'deitado';
        } else {
          const ponto = new THREE.Vector3(p.centro.x, p.altura * (p.spec.assento ?? 0.37), p.centro.z).add(frente.multiplyScalar(p.spec.avanco ?? 0.02));
          this.pular(ponto, instantaneo ? 0 : 420, 0.3);
          this.tocar(p.spec.pose ?? 'sentado');
          c.pose = 'sentado';
        }
        c.em = p;
        c.rumo = p.rumo;
        if (instantaneo) c.corpo.rotation.y = p.rumo;
        if (depois) {
          // a função abre quando ele já sentou (o pulo para o assento leva ~0,4 s)
          if (instantaneo) depois();
          else c.depois = depois;
        }
      },
      imediato,
    );
  }

  /** O coelho no lugar do estado de verdade: ausente, dorme na cama; em chamada, na cadeira; à toa, de pé no quarto. */
  private aplicarEstado(imediato: boolean) {
    const c = this.coelho;
    if (!c) return;
    this.voltarEm = 0;
    const movel = (id: string) => this.moveis.find((p) => p.id === id);
    if (this.estado === 'ausente') {
      const cama = movel('cama');
      if (cama) this.usar(cama, null, imediato);
    } else if (this.estado === 'call') {
      const cadeira = movel('cadeira');
      if (cadeira) this.usar(cadeira, null, imediato);
    } else if (c.pose !== 'pe' && (c.em?.id === 'cama' || c.em?.id === 'cadeira')) {
      // acordou ou saiu da chamada: levanta e fica de pé ali perto
      const sai = this.livreMaisPerto(c.raiz.position.x, c.raiz.position.z, this.ocupadas());
      if (sai) this.irPara(sai, null, imediato);
    }
  }

  // ---- os cliques ----

  private alvoDaFuncao(id: string): Alvo | null {
    const p = this.moveis.find((m) => m.funcao === id);
    if (p) return { funcao: id, movel: p, realce: p.raiz, ponto: p.centro.clone() };
    const naParede = this.daParede.find((o) => o.userData.funcao === id);
    if (naParede) return { funcao: id, realce: naParede, ponto: new THREE.Box3().setFromObject(naParede).getCenter(new THREE.Vector3()) };
    return null;
  }

  private mirar(e: PointerEvent) {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.ponteiro.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.raio.setFromCamera(this.ponteiro, this.camera);
  }

  /** O que está sob o ponteiro: o primeiro objeto com função (que exista aqui) ou móvel de usar. */
  private alvoNoPonto(): Alvo | null {
    const hits = this.raio.intersectObjects([...this.moveis.map((p) => p.raiz), ...this.daParede], true);
    for (const h of hits) {
      let o: THREE.Object3D | null = h.object;
      let funcao: THREE.Object3D | null = null;
      let raiz: THREE.Object3D | null = null;
      while (o) {
        if (!funcao && o.userData.funcao && this.opcoes.temFuncao(o.userData.funcao)) funcao = o;
        if (o.userData.movel) raiz = o;
        o = o.parent;
      }
      const movel = raiz ? this.moveis.find((p) => p.raiz === raiz) : undefined;
      if (funcao) return { funcao: funcao.userData.funcao, movel, realce: funcao, ponto: h.point };
      if (movel?.uso) return { movel, realce: movel.raiz, ponto: h.point };
      // o tapete fica no chão: o clique passa por ele
      if (movel?.chao) continue;
      // um móvel sem nada fica na frente do que está atrás: o clique para nele
      if (movel) return null;
    }
    return null;
  }

  private casaNoChao(): [number, number] | null {
    const p = new THREE.Vector3();
    if (!this.raio.ray.intersectPlane(this.planoDoChao, p)) return null;
    const x = Math.floor(p.x);
    const z = Math.floor(p.z);
    return x >= 0 && z >= 0 && x < N && z < N && this.mundo.chao(x + 0.5, z + 0.5) ? [x, z] : null;
  }

  /** O que o clique (ou o teclado) faz com um alvo: a animação primeiro, a função depois. */
  private agir(alvo: Alvo) {
    const c = this.coelho;
    if (!c) return;
    const id = alvo.funcao;
    const abrir = () => {
      if (!id) return;
      this.opcoes.aoFuncao(id);
      if (this.estado !== 'atoa') this.voltarEm = performance.now() + VOLTA_AO_ESTADO_MS;
    };
    this.voltarEm = 0;
    if (id === 'computador') {
      // senta na cadeira, e então os Mini-games
      const cadeira = this.moveis.find((p) => p.id === 'cadeira');
      if (cadeira) return this.usar(cadeira, abrir);
    }
    if (alvo.movel && id) return this.irAoMovel(alvo.movel, abrir);
    if (alvo.movel?.uso) return this.usar(alvo.movel);
    if (id) {
      // o que está na parede (o quadro, a cortiça, a janela): ele vai até a parede, olha para ela, e a função abre
      const ponto = alvo.ponto;
      const casa = this.livreMaisPerto(ponto.x + (ponto.x < ponto.z ? 0.8 : 0), ponto.z + (ponto.z <= ponto.x ? 0.8 : 0), this.ocupadas());
      if (!casa) return abrir();
      this.irPara(casa, () => {
        c.rumo = Math.atan2(ponto.x - c.raiz.position.x, ponto.z - c.raiz.position.z);
        abrir();
      });
    }
  }

  private aoApertar = (e: PointerEvent) => {
    this.apertou = { x: e.clientX, y: e.clientY };
  };

  private aoSoltar = (e: PointerEvent) => {
    const a = this.apertou;
    this.apertou = null;
    if (!a || Math.hypot(e.clientX - a.x, e.clientY - a.y) > 8 || e.button !== 0 || !this.coelho) return;
    this.mirar(e);
    const alvo = this.alvoNoPonto();
    if (alvo) return this.agir(alvo);
    const casa = this.casaNoChao();
    if (!casa) return;
    this.voltarEm = 0;
    const cheias = this.ocupadas();
    const ate = cheias.has(`${casa[0]},${casa[1]}`) ? this.livreMaisPerto(casa[0] + 0.5, casa[1] + 0.5, cheias) : casa;
    if (ate) {
      this.irPara(ate, null);
      if (this.estado !== 'atoa') this.voltarEm = performance.now() + VOLTA_AO_ESTADO_MS;
    }
  };

  private aoMover = (e: PointerEvent) => {
    if (e.pointerType === 'mouse') this.passou = e;
  };

  private aoSair = () => {
    this.passou = null;
    this.realcar(null);
    this.opcoes.aoPassar(null);
  };

  /** O realce: uma luz morna nos materiais do objeto sob o mouse (a cor própria de cada um volta ao sair). */
  private realcar(o: THREE.Object3D | null) {
    if (o === this.realcado) return;
    for (const [m, antes] of this.emissivos) {
      m.emissive.copy(antes.cor);
      m.emissiveIntensity = antes.intensidade;
    }
    this.emissivos.clear();
    this.realcado = o;
    o?.traverse((x) => {
      const m = (x as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if (!(x as THREE.Mesh).isMesh || !m?.emissive || this.emissivos.has(m)) return;
      // o que já brilha (as lâmpadas à noite) continua brilhando; o resto ganha o realce
      if (m.emissive.getHex() !== 0 && m.emissiveIntensity > 0) return;
      this.emissivos.set(m, { cor: m.emissive.clone(), intensidade: m.emissiveIntensity });
      m.emissive.copy(REALCE);
      m.emissiveIntensity = 1;
    });
    this.renderer.domElement.style.cursor = o ? 'pointer' : '';
    this.ultimoQuadro = 0;
  }

  private passarAgora() {
    const e = this.passou;
    if (!e) return;
    this.passou = null;
    this.mirar(e);
    const alvo = this.alvoNoPonto();
    this.realcar(alvo?.realce ?? null);
    const r = this.renderer.domElement.getBoundingClientRect();
    this.opcoes.aoPassar(alvo?.funcao ? { id: alvo.funcao, x: e.clientX - r.left, y: e.clientY - r.top } : null);
  }

  // ---- o laço ----

  private desenhar = () => {
    if (this.morta) return;
    // sem foco na janela (o jogo de verdade aberto) ou escondida, não desenha nada
    if (document.hidden || !document.hasFocus() || !elementoAVista(this.caixa)) {
      this.relogio.update();
      return;
    }
    const agora = performance.now();
    if (agora - this.ultimoQuadro < INTERVALO_MS) return;
    this.ultimoQuadro = agora;
    this.relogio.update();
    const dt = Math.min(0.1, this.relogio.getDelta());
    this.passarAgora();
    const c = this.coelho;
    if (c) {
      if (this.voltarEm && agora >= this.voltarEm && !c.caminho.length && !c.depois) this.aplicarEstado(false);
      const f = c.duracao ? Math.min(1, (agora - c.inicio) / c.duracao) : 1;
      if (f >= 1 && c.caminho.length) {
        const [x, z] = c.caminho.shift()!;
        c.casa = [x, z];
        this.pular(new THREE.Vector3(x + 0.5, 0, z + 0.5), 360, 0);
        this.tocar('andando');
      } else if (f >= 1 && c.depois) {
        const d = c.depois;
        c.depois = null;
        d();
      } else if (f >= 1 && c.pose === 'pe' && c.tocando === 'andando') this.tocar('parado');
      const g = c.duracao ? Math.min(1, (agora - c.inicio) / c.duracao) : 1;
      const e = c.arco > 0 ? g * g * (3 - 2 * g) : g;
      c.raiz.position.lerpVectors(c.de, c.para, e);
      c.raiz.position.y += g < 1 ? Math.sin(Math.PI * g) * c.arco : 0;
      let delta = c.rumo - c.corpo.rotation.y;
      delta = Math.atan2(Math.sin(delta), Math.cos(delta));
      c.corpo.rotation.y += delta * 0.4;
      if (!this.calmo) c.copia.mixer.update(dt);
      else if (c.copia.mixer.time === 0) c.copia.mixer.update(0.01);
    }
    this.renderer.render(this.cena, this.camera);
    this.desenhados++;
    this.tempos.push(performance.now() - agora);
    if (this.tempos.length > 60) this.tempos.shift();
  };
}

function lerSombras(): boolean {
  try {
    return !!JSON.parse(localStorage.getItem('syden:graficos') ?? '{}').sombras;
  } catch {
    return false;
  }
}

// O que a caixa React (Quarto3D.tsx) pede desta parte: as cores vêm junto do three.js, no mesmo pedaço.
export { coresDoAvatar, minhasCoresDoCoelho } from '../coelho3d';
