import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * A BATALHA NAVAL EM 3D (05/11/2026, pedido dele: os navios para a Batalha naval, com os assets da pasta). Um mar por cena: a
 * água mexendo, a grade de 10 × 10 por cima, os navios piratas da Kenney (CC0, web/public/naval3d/pirata/License.txt; o crédito
 * nos termos, seção 10) boiando nas casas deles, e os tiros: na água um respingo branco que fica, no navio o fogo e a fumaça.
 * O afundado aderna e escurece. Só a TELA: o servidor decide tudo, e a grade de botões do 2D continua por baixo para o teclado
 * e o leitor de tela (JogoNaval.tsx). Sem foco na janela, não desenha.
 */

const LADO = 10;
const BASE = `${import.meta.env.BASE_URL}naval3d/`;
/**
 * AS DUAS FROTAS (05/11/2026, pedido dele: "uma opção com navios civis modernos"): só a aparência, escolhida por cada pessoa no
 * próprio aparelho (JogoNaval.tsx). O navio de cada tamanho (a frota é 5, 4, 3, 3 e 2); com mais de um modelo, os navios do
 * mesmo tamanho vão pegando um de cada vez, na ordem em que vêm. A moderna é do Watercraft Kit da Kenney (CC0,
 * web/public/naval3d/moderna/License.txt).
 */
export type FrotaDaCena = 'piratas' | 'moderna';
const FROTAS: Record<FrotaDaCena, Record<number, string[]>> = {
  piratas: {
    5: ['pirata/ship-pirate-large.glb'],
    4: ['pirata/ship-pirate-medium.glb'],
    3: ['pirata/ship-pirate-small.glb'],
    2: ['pirata/boat-row-large.glb'],
  },
  moderna: {
    5: ['moderna/ship-ocean-liner.glb'],
    4: ['moderna/ship-cargo-a.glb'],
    3: ['moderna/boat-tug-a.glb', 'moderna/boat-fishing-small.glb'],
    2: ['moderna/boat-speed-a.glb'],
  },
};
/** O modelo do `k`-ésimo navio de `tamanho` na frota. */
const modeloDe = (frota: FrotaDaCena, tamanho: number, k = 0) => {
  const lista = FROTAS[frota][tamanho] ?? FROTAS[frota][3];
  return lista[k % lista.length];
};
const todosDa = (frota: FrotaDaCena) => [...new Set(Object.values(FROTAS[frota]).flat())];

const cache = new Map<string, Promise<GLTF>>();
const carregar = (a: string) => {
  let p = cache.get(a);
  if (!p) {
    p = new GLTFLoader().loadAsync(BASE + a);
    cache.set(a, p);
    p.catch(() => cache.delete(a));
  }
  return p;
};

export interface MarDaCena {
  tiros: number[];
  navios: { casas: number[]; afundado: boolean }[];
  /** O mar da própria pessoa (os navios inteiros à mostra). */
  meu: boolean;
  podeAtirar: boolean;
  ultima: number | null;
  /** A frota que a pessoa escolheu ver (de fábrica, a pirata). */
  frota?: FrotaDaCena;
  /**
   * A MONTAGEM (05/11/2026: cada um põe os navios antes do primeiro tiro): o navio-fantasma onde o navio escolhido vai cair
   * (verde se cabe, vermelho se não) e as casas do navio escolhido. Com ela, a cena manda os toques (passar, apertar, soltar)
   * em vez de atirar.
   */
  montagem?: {
    /** `ordem`: entre os navios do mesmo tamanho, qual é (o modelo dele, na frota que tem dois). */
    fantasma: { casas: number[]; ok: boolean; ordem?: number } | null;
    escolhido: number[] | null;
  };
}

/** Os toques na cena durante a montagem: a casa sob o ponteiro (null fora do mar). */
export interface ToquesDaMontagem {
  passar(casa: number | null): void;
  apertar(casa: number): void;
  soltar(casa: number | null): void;
}

const centro = (casa: number) => new THREE.Vector3((casa % LADO) - (LADO - 1) / 2, 0, Math.floor(casa / LADO) - (LADO - 1) / 2);

/** O navio cabendo nas casas: o comprimento no tamanho dele, a largura em no máximo 0,8 de casa, e as velas achatadas. */
function navio(g: GLTF, tamanho: number): THREE.Object3D {
  const o = g.scene.clone(true);
  const caixa = new THREE.Box3().setFromObject(o);
  const t = caixa.getSize(new THREE.Vector3());
  const c = caixa.getCenter(new THREE.Vector3());
  o.position.set(-c.x, -caixa.min.y, -c.z);
  const s = (tamanho * 0.92) / t.z;
  const largura = Math.min(s, 0.95 / t.x) * 1.15;
  const raiz = new THREE.Group();
  // a geometria é a do modelo no cache: ninguém a descarta ao destruir a cena
  raiz.userData.doModelo = true;
  raiz.add(o);
  raiz.scale.set(largura, s * 0.7, s);
  o.traverse((m) => {
    if ((m as THREE.Mesh).isMesh) {
      const mm = m as THREE.Mesh;
      mm.castShadow = true;
      mm.material = (mm.material as THREE.MeshStandardMaterial).clone();
    }
  });
  return raiz;
}

export class MarNaval3D {
  private renderer: THREE.WebGLRenderer;
  private cena = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
  private agua: THREE.Mesh;
  private aguaGeo: THREE.PlaneGeometry;
  private base: Float32Array;
  private modelos = new Map<string, GLTF>();
  private navios = new Map<string, { obj: THREE.Object3D; afundado: boolean; fase: number }>();
  private marcas = new Map<number, THREE.Object3D>();
  private mira: THREE.Mesh;
  private relogio = new THREE.Timer();
  private raio = new THREE.Raycaster();
  private observador: ResizeObserver;
  private dados: MarDaCena | null = null;
  private morta = false;
  private calmo: boolean;
  private fogos: { obj: THREE.Object3D; fase: number }[] = [];
  private respingo: { obj: THREE.Mesh; inicio: number } | null = null;
  /** O fantasma da montagem e o realce do navio escolhido, refeitos quando mudam. */
  private fantasma = new THREE.Group();
  private chaveDoFantasma = '';
  private casaGeo = new THREE.PlaneGeometry(0.94, 0.94);
  private sobre: number | null = null;

  constructor(
    private caixa: HTMLElement,
    private aoAtirar: (casa: number) => void,
    private toques?: ToquesDaMontagem,
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    let sombras = false;
    try {
      sombras = !!JSON.parse(localStorage.getItem('syden:graficos') ?? '{}').sombras;
    } catch {
      /* sem */
    }
    this.renderer.shadowMap.enabled = sombras;
    this.calmo = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const tela = this.renderer.domElement;
    tela.className = 'naval-3d-tela';
    caixa.appendChild(tela);
    this.observador = new ResizeObserver(() => this.medir());
    this.observador.observe(caixa);

    const c = this.cena;
    c.background = new THREE.Color('#bfe4f2');
    c.add(new THREE.HemisphereLight('#fff8ec', '#4d8fb0', 1.6));
    const sol = new THREE.DirectionalLight('#fff1d6', 2.0);
    sol.position.set(-4, 10, 6);
    sol.castShadow = sombras;
    Object.assign(sol.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7 });
    c.add(sol);
    // a água: uma malha que ondula devagar, e a borda de areia em volta
    this.aguaGeo = new THREE.PlaneGeometry(LADO + 0.6, LADO + 0.6, 40, 40);
    this.aguaGeo.rotateX(-Math.PI / 2);
    this.base = (this.aguaGeo.attributes.position.array as Float32Array).slice();
    this.agua = new THREE.Mesh(this.aguaGeo, new THREE.MeshStandardMaterial({ color: '#4fa3c7', roughness: 0.35, metalness: 0.05, flatShading: true }));
    this.agua.receiveShadow = true;
    c.add(this.agua);
    const borda = new THREE.Mesh(new THREE.BoxGeometry(LADO + 1.4, 0.4, LADO + 1.4), new THREE.MeshStandardMaterial({ color: '#e9d3a1', roughness: 1 }));
    // a borda fica abaixo do vale das ondas: alta, ela aparecia em manchas pela água
    borda.position.y = -0.45;
    c.add(borda);
    // a grade
    const pts: number[] = [];
    const m = LADO / 2;
    for (let i = 0; i <= LADO; i++) {
      const k = i - m;
      pts.push(-m, 0.03, k, m, 0.03, k, k, 0.03, -m, k, 0.03, m);
    }
    const grade = new THREE.BufferGeometry();
    grade.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    c.add(new THREE.LineSegments(grade, new THREE.LineBasicMaterial({ color: '#e8f6fb', transparent: true, opacity: 0.45 })));
    // a mira: a casa sob o mouse
    this.mira = new THREE.Mesh(new THREE.PlaneGeometry(0.94, 0.94), new THREE.MeshBasicMaterial({ color: '#ffe08a', transparent: true, opacity: 0.45, depthWrite: false }));
    this.mira.rotation.x = -Math.PI / 2;
    this.mira.position.y = 0.05;
    this.mira.visible = false;
    c.add(this.mira);
    c.add(this.fantasma);

    tela.addEventListener('pointerdown', this.aoApertar);
    tela.addEventListener('pointerup', this.aoSoltar);
    tela.addEventListener('pointermove', this.aoPassar);
    tela.addEventListener('pointerleave', this.aoSair);
    tela.addEventListener('click', this.aoClicar);
    this.medir();
  }

  async montar() {
    await this.garantir(this.dados?.frota ?? 'piratas');
    if (this.morta) return;
    if (this.dados) this.atualizar(this.dados);
    this.renderer.setAnimationLoop(this.desenhar);
  }

  /** Os modelos de uma frota, carregados (a outra frota só é baixada quando a pessoa a escolhe). */
  private async garantir(frota: FrotaDaCena) {
    const lista = await Promise.all(todosDa(frota).map((a) => carregar(a).then((g) => [a, g] as const)));
    if (this.morta) return;
    for (const [a, g] of lista) this.modelos.set(a, g);
  }
  private frotaPronta = (frota: FrotaDaCena) => todosDa(frota).every((a) => this.modelos.has(a));

  /** Tira um navio da cena, com os materiais dele (a geometria é do cache). */
  private tirar(obj: THREE.Object3D) {
    this.cena.remove(obj);
    obj.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => x.dispose());
    });
  }

  private medir() {
    const w = Math.max(1, this.caixa.clientWidth);
    const h = Math.max(1, this.caixa.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.position.set(0, 14.4, 10.4);
    this.camera.lookAt(0, -0.4, 0.4);
    this.camera.updateProjectionMatrix();
  }

  atualizar(d: MarDaCena) {
    this.dados = d;
    if (!this.modelos.size) return;
    const frota = d.frota ?? 'piratas';
    if (!this.frotaPronta(frota)) {
      // a outra frota ainda não veio: baixa, e desenha de novo quando chegar
      void this.garantir(frota).then(() => {
        if (!this.morta && this.dados) this.atualizar(this.dados);
      }).catch(() => {});
    }
    // os navios (a chave leva o modelo: trocar de frota refaz todos)
    const vivos = new Set<string>();
    const doTamanho = new Map<number, number>();
    for (const n of d.navios) {
      const k = doTamanho.get(n.casas.length) ?? 0;
      doTamanho.set(n.casas.length, k + 1);
      const modelo = modeloDe(frota, n.casas.length, k);
      const chave = modelo + ':' + [...n.casas].sort((a, b) => a - b).join(',');
      vivos.add(chave);
      const ja = this.navios.get(chave);
      if (ja && ja.afundado === n.afundado) continue;
      if (ja) {
        this.tirar(ja.obj);
        this.navios.delete(chave);
      }
      const g = this.modelos.get(modelo);
      if (!g) {
        vivos.delete(chave);
        continue;
      }
      const obj = navio(g, n.casas.length);
      const casas = [...n.casas].sort((a, b) => a - b);
      const meio = centro(casas[0]).add(centro(casas[casas.length - 1])).multiplyScalar(0.5);
      const deitado = casas.length > 1 && casas[1] - casas[0] === 1;
      obj.position.copy(meio);
      obj.rotation.y = deitado ? Math.PI / 2 : 0;
      if (n.afundado) {
        obj.traverse((o) => {
          const mm = o as THREE.Mesh;
          if (mm.isMesh) (mm.material as THREE.MeshStandardMaterial).color.multiplyScalar(0.55);
        });
      }
      this.cena.add(obj);
      this.navios.set(chave, { obj, afundado: n.afundado, fase: Math.random() * 6 });
    }
    for (const [chave, n] of this.navios)
      if (!vivos.has(chave)) {
        this.tirar(n.obj);
        this.navios.delete(chave);
      }
    // os tiros
    d.tiros.forEach((tiro, casa) => {
      const ja = this.marcas.get(casa);
      if (tiro === 0) {
        if (ja) {
          this.cena.remove(ja);
          this.marcas.delete(casa);
        }
        return;
      }
      if (ja && ja.userData.tiro === tiro) return;
      if (ja) this.cena.remove(ja);
      const marca = tiro === 1 ? this.respingoDeAgua() : this.fogo();
      marca.userData.tiro = tiro;
      marca.position.copy(centro(casa));
      this.cena.add(marca);
      this.marcas.set(casa, marca);
      if (casa === d.ultima) this.estourar(casa, tiro === 2);
    });
    this.mira.visible = this.mira.visible && d.podeAtirar;
    this.renderer.domElement.style.cursor = d.podeAtirar ? 'crosshair' : d.montagem ? 'pointer' : '';
    this.montarFantasma(d);
  }

  /** O navio-fantasma (casas verdes ou vermelhas, e o navio meio transparente quando cabe) e o realce do escolhido. */
  private montarFantasma(d: MarDaCena) {
    const f = d.montagem?.fantasma ?? null;
    const e = d.montagem?.escolhido ?? null;
    const chave = JSON.stringify([f, e, d.frota, this.modelos.size]);
    if (chave === this.chaveDoFantasma) return;
    this.chaveDoFantasma = chave;
    for (const filho of [...this.fantasma.children]) {
      this.fantasma.remove(filho);
      filho.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        for (const mat of mats) mat.dispose();
      });
    }
    const casa = (c: number, cor: string, opacidade: number, y: number) => {
      const p = new THREE.Mesh(this.casaGeo, new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: opacidade, depthWrite: false }));
      p.rotation.x = -Math.PI / 2;
      p.position.set(centro(c).x, y, centro(c).z);
      this.fantasma.add(p);
    };
    if (e) for (const c of e) casa(c, '#ffe08a', 0.5, 0.06);
    if (!f) return;
    for (const c of f.casas) casa(c, f.ok ? '#5bd16a' : '#e5484d', 0.55, 0.08);
    const g = this.modelos.get(modeloDe(d.frota ?? 'piratas', f.casas.length, f.ordem ?? 0));
    if (!f.ok || !g) return;
    const obj = navio(g, f.casas.length);
    const casas = [...f.casas].sort((a, b) => a - b);
    obj.position.copy(centro(casas[0]).add(centro(casas[casas.length - 1])).multiplyScalar(0.5));
    obj.position.y = 0.04;
    obj.rotation.y = casas.length > 1 && casas[1] - casas[0] === 1 ? Math.PI / 2 : 0;
    obj.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const mat = m.material as THREE.MeshStandardMaterial;
      mat.transparent = true;
      mat.opacity = 0.55;
      mat.depthWrite = false;
      m.castShadow = false;
    });
    this.fantasma.add(obj);
  }

  /** Na água: uma boia de espuma branca, que fica. */
  private respingoDeAgua(): THREE.Object3D {
    const g = new THREE.Group();
    const anel = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.06, 6, 16), new THREE.MeshStandardMaterial({ color: '#f4fbff', roughness: 0.6 }));
    anel.rotation.x = -Math.PI / 2;
    anel.position.y = 0.06;
    const pingo = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), new THREE.MeshStandardMaterial({ color: '#ffffff' }));
    pingo.position.y = 0.1;
    g.add(anel, pingo);
    return g;
  }

  /** No navio: o fogo (três chamas que tremem) e um rolo de fumaça. */
  private fogo(): THREE.Object3D {
    const g = new THREE.Group();
    const cores = ['#ffcf4a', '#ff8a3a', '#e24a2a'];
    cores.forEach((cor, k) => {
      const ch = new THREE.Mesh(new THREE.ConeGeometry(0.16 - k * 0.03, 0.42 - k * 0.08, 7), new THREE.MeshStandardMaterial({ color: cor, emissive: cor, emissiveIntensity: 0.9 }));
      ch.position.set((k - 1) * 0.1, 0.55 + k * 0.03, (k % 2) * 0.08 - 0.04);
      g.add(ch);
    });
    const fumaca = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshStandardMaterial({ color: '#5b5560', transparent: true, opacity: 0.6 }));
    fumaca.position.y = 0.95;
    fumaca.userData.fumaca = true;
    g.add(fumaca);
    g.scale.setScalar(1.7);
    this.fogos.push({ obj: g, fase: Math.random() * 6 });
    return g;
  }

  /** O tiro que acabou de cair: uma coluna d'água que sobe e desce. */
  private estourar(casa: number, acertou: boolean) {
    if (this.calmo) return;
    if (this.respingo) this.cena.remove(this.respingo.obj);
    const coluna = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.3, 1, 10, 1, true), new THREE.MeshStandardMaterial({ color: acertou ? '#ffb45a' : '#e8f7ff', transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
    coluna.position.copy(centro(casa));
    this.cena.add(coluna);
    this.respingo = { obj: coluna, inicio: performance.now() };
  }

  private casaNoPonto(e: PointerEvent | MouseEvent): number | null {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.raio.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), this.camera);
    const p = new THREE.Vector3();
    if (!this.raio.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), p)) return null;
    const c = Math.floor(p.x + LADO / 2);
    const l = Math.floor(p.z + LADO / 2);
    return c >= 0 && l >= 0 && c < LADO && l < LADO ? l * LADO + c : null;
  }
  private aoApertar = (e: PointerEvent) => {
    if (!this.dados?.montagem || !this.toques || e.button > 0) return;
    const casa = this.casaNoPonto(e);
    if (casa === null) return;
    // o soltar chega aqui mesmo fora da tela (arrastar um navio para fora do mar cancela)
    this.renderer.domElement.setPointerCapture?.(e.pointerId);
    this.toques.apertar(casa);
  };
  private aoSoltar = (e: PointerEvent) => {
    if (!this.dados?.montagem || !this.toques) return;
    this.toques.soltar(this.casaNoPonto(e));
  };
  private aoPassar = (e: PointerEvent) => {
    const d = this.dados;
    if (d?.montagem && this.toques) {
      const casa = this.casaNoPonto(e);
      if (casa !== this.sobre) {
        this.sobre = casa;
        this.toques.passar(casa);
      }
      return;
    }
    const casa = d?.podeAtirar ? this.casaNoPonto(e) : null;
    if (casa === null || !d || d.tiros[casa] !== 0) {
      this.mira.visible = false;
      return;
    }
    this.mira.visible = true;
    this.mira.position.set(centro(casa).x, 0.05, centro(casa).z);
  };
  private aoSair = () => {
    this.mira.visible = false;
    if (this.dados?.montagem && this.toques && this.sobre !== null) {
      this.sobre = null;
      this.toques.passar(null);
    }
  };
  private aoClicar = (e: MouseEvent) => {
    const d = this.dados;
    if (!d?.podeAtirar || d.montagem) return;
    const casa = this.casaNoPonto(e);
    if (casa !== null && d.tiros[casa] === 0) this.aoAtirar(casa);
  };

  private desenhar = () => {
    if (this.morta || document.hidden || !document.hasFocus()) {
      this.relogio.update();
      return;
    }
    this.relogio.update();
    const t = this.relogio.getElapsed();
    if (!this.calmo) {
      // as ondas
      const pos = this.aguaGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < pos.length; i += 3) pos[i + 1] = Math.sin(this.base[i] * 1.3 + t * 1.4) * 0.03 + Math.cos(this.base[i + 2] * 1.1 + t) * 0.03;
      this.aguaGeo.attributes.position.needsUpdate = true;
      this.aguaGeo.computeVertexNormals();
    }
    for (const n of this.navios.values()) {
      const balanco = this.calmo ? 0 : Math.sin(t * 1.2 + n.fase);
      n.obj.position.y = n.afundado ? -0.18 : 0.02 + balanco * 0.03;
      n.obj.rotation.z = n.afundado ? 0.35 : balanco * 0.04;
    }
    for (const f of this.fogos) {
      const k = this.calmo ? 1 : 1 + Math.sin(t * 9 + f.fase) * 0.15;
      f.obj.children.forEach((c) => {
        if (c.userData.fumaca) {
          c.position.y = 0.95 + ((t * 0.35 + f.fase) % 1) * 0.4;
          ((c as THREE.Mesh).material as THREE.MeshStandardMaterial).opacity = 0.6 * (1 - ((t * 0.35 + f.fase) % 1));
        } else c.scale.set(1, k, 1);
      });
    }
    if (this.respingo) {
      const f = (performance.now() - this.respingo.inicio) / 700;
      if (f >= 1) {
        this.cena.remove(this.respingo.obj);
        this.respingo.obj.geometry.dispose();
        (this.respingo.obj.material as THREE.Material).dispose();
        this.respingo = null;
      } else {
        const a = Math.sin(Math.PI * f);
        this.respingo.obj.scale.set(1, Math.max(0.01, a * 1.6), 1);
        this.respingo.obj.position.y = a * 0.8;
      }
    }
    this.renderer.render(this.cena, this.camera);
  };

  destruir() {
    this.morta = true;
    this.renderer.setAnimationLoop(null);
    this.observador.disconnect();
    const tela = this.renderer.domElement;
    tela.removeEventListener('pointerdown', this.aoApertar);
    tela.removeEventListener('pointerup', this.aoSoltar);
    tela.removeEventListener('pointermove', this.aoPassar);
    tela.removeEventListener('pointerleave', this.aoSair);
    tela.removeEventListener('click', this.aoClicar);
    this.cena.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh && !(o as THREE.LineSegments).isLineSegments) return;
      // a geometria dos modelos é do cache; o resto é desta cena
      if (!this.ehDoModelo(o)) m.geometry?.dispose();
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mat of mats) mat?.dispose();
    });
    this.renderer.forceContextLoss();
    this.renderer.dispose();
    tela.remove();
  }
  private ehDoModelo(o: THREE.Object3D): boolean {
    for (let p: THREE.Object3D | null = o; p; p = p.parent) if (p.userData.doModelo) return true;
    return false;
  }
}
