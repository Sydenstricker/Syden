import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { carregarCoelho, copiarCoelho, type CoelhoCopiado, type CoresDoCoelho } from '../coelho3d';
import { balasEm, bracoEm, deslocamento, espinhosFora, TREME_PASSOS, VOLTA_DO_BLOCO, VOLTA_INTEIRA, type Coelho, type Percurso } from './sim';

/**
 * A CENA DA GINCANA DA TOCA (06/11/2026): o percurso de sim.ts montado com as peças do Platformer Pack da KayKit (Kay Lousberg,
 * CC0, web/public/gincana/License.txt), plataformas azuis sobre pilares num céu aberto, com o mar lá embaixo, e quem corre é o
 * NOSSO coelho 3D (coelho3d.ts), com as cores do avatar. A câmera fica atrás dele, olhando o percurso (o +z).
 *
 * Só a TELA: a regra (sim.ts) decide onde cada coelho está e onde está cada coisa que se mexe, pelo número do passo; quem chama
 * passa o quadro. Como as outras cenas 3D: o three.js vem num pedaço à parte, só quando o jogo abre; sem foco na janela, quem
 * chama não desenha; ao sair, o contexto é devolvido.
 */

const BASE = `${import.meta.env.BASE_URL}gincana/`;
/** O céu (é também a cor da caixa enquanto carrega). */
export const COR_DO_FUNDO = '#a8dcf5';
const COR_DO_MAR = '#4fa9d9';
const ALTURA_DO_COELHO = 1.05;
const MAR = -11;
/** A ponta dos espinhos, escondida dentro da base. */
const ESPINHOS_DENTRO = -0.55;

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

/** Os modelos que um percurso usa (para carregar e para o teste conferir que estão em web/public/gincana/). */
export function modelosDoPercurso(p: Percurso): string[] {
  const nomes = new Set<string>(['pillar_2x2x8', 'sawblade', 'cannon_bullet']);
  for (const c of p.caixas) if (c.modelo) nomes.add(c.modelo);
  for (const r of p.rampas) nomes.add(r.modelo);
  for (const v of p.varredores) nomes.add(v.modelo);
  for (const e of p.enfeites) nomes.add(e.modelo);
  return [...nomes];
}

/** Um sorteio sempre igual, só para o desenho (as nuvens). */
function sorteio(semente: number) {
  let s = semente >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** O nome em cima de um coelho (os rivais da sala e os fantasmas), num quadro de canvas. */
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
  s.scale.set((w / 64) * 0.42, 0.42, 1);
  s.renderOrder = 10;
  return s;
}

export interface CoelhoNaCena {
  cores: CoresDoCoelho;
  /** O fantasma (de um recorde) vai meio transparente. */
  fantasma?: boolean;
  /** O nome em cima (os rivais e os fantasmas; o meu, não). */
  nome?: string;
}

/** O que se desenha de um coelho num quadro. */
export interface QuadroDoCoelho {
  x: number;
  y: number;
  z: number;
  noChao: boolean;
  pisca: number;
  escondido?: boolean;
}

interface Montado {
  raiz: THREE.Group;
  copia: CoelhoCopiado;
  sombra: THREE.Mesh;
  rumo: number;
  antes: { x: number; z: number } | null;
  tocando: string;
  estica: number;
}

export class CenaDaGincana {
  private renderer: THREE.WebGLRenderer;
  private cena = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(58, 1, 0.1, 260);
  private observador: ResizeObserver;
  private morta = false;
  private sombras = false;
  private calmo = false;
  private relogio = 0;
  private quadro = 0;
  private coelhos: Montado[] = [];
  /** As peças que se mexem: as caixas com movimento, os blocos que caem e os espinhos. */
  private moveis: { i: number; o: THREE.Object3D; espinhos: THREE.Object3D | null }[] = [];
  private serras: THREE.Object3D[] = [];
  private varredores: THREE.Object3D[] = [];
  private balas: THREE.Object3D[][] = [];
  private camAlvo = new THREE.Vector3();
  private camY = 0;
  private descartaveis: { dispose(): void }[] = [];
  private sol: THREE.DirectionalLight | null = null;

  constructor(
    private caixa: HTMLElement,
    private p: Percurso,
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
    canvas.className = 'gincana-tela';
    caixa.appendChild(canvas);
    this.observador = new ResizeObserver(() => this.medir());
    this.observador.observe(caixa);
    this.medir();
  }

  private medir() {
    const w = Math.max(1, this.caixa.clientWidth);
    const h = Math.max(1, this.caixa.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // na tela estreita (em pé), a câmera abre mais, para os lados do percurso caberem
    this.camera.fov = this.camera.aspect < 1 ? 72 : 58;
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

  /** Carrega os modelos e monta o percurso e os coelhos (o primeiro é o meu). Rejeita se algo falhar. */
  async montar(coelhos: CoelhoNaCena[]): Promise<void> {
    const nomes = modelosDoPercurso(this.p);
    const [g, ...lista] = await Promise.all([carregarCoelho(), ...nomes.map(carregar)]);
    if (this.morta) return;
    const modelos = new Map(nomes.map((n, i) => [n, lista[i]]));
    this.montarMundo(modelos);
    for (const c of coelhos) this.montarCoelho(g, c);
  }

  private montarMundo(modelos: Map<string, GLTF>) {
    const c = this.cena;
    const p = this.p;
    c.background = new THREE.Color(COR_DO_FUNDO);
    c.fog = new THREE.Fog(COR_DO_FUNDO, 45, 120);
    c.add(new THREE.HemisphereLight('#ffffff', '#7fb7d6', 1.6));
    const sol = new THREE.DirectionalLight('#fff3dc', 2.2);
    sol.position.set(14, 30, -10);
    c.add(sol, sol.target);
    if (this.sombras) {
      sol.castShadow = true;
      sol.shadow.mapSize.set(2048, 2048);
      const s = sol.shadow.camera;
      s.left = -18;
      s.right = 18;
      s.top = 18;
      s.bottom = -18;
      s.near = 1;
      s.far = 80;
    }
    this.sol = sol;

    // o mar lá embaixo, e as nuvens em volta
    const mar = new THREE.Mesh(new THREE.PlaneGeometry(600, 900), new THREE.MeshStandardMaterial({ color: COR_DO_MAR, roughness: 0.6 }));
    mar.rotation.x = -Math.PI / 2;
    mar.position.set(0, MAR, p.comprimento / 2);
    c.add(mar);
    this.descartaveis.push(mar.geometry, mar.material as THREE.Material);
    const nuvem = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, emissive: '#dfefff', emissiveIntensity: 0.25 });
    const bola = new THREE.SphereGeometry(1, 14, 10);
    this.descartaveis.push(nuvem, bola);
    const r = sorteio(7 + p.caixas.length);
    for (let k = 0; k < 26; k++) {
      const g = new THREE.Group();
      const lado = r() < 0.5 ? -1 : 1;
      g.position.set(lado * (16 + r() * 30), -4 + r() * 16, -20 + r() * (p.comprimento + 60));
      for (let j = 0; j < 4; j++) {
        const m = new THREE.Mesh(bola, nuvem);
        const s = 1.4 + r() * 1.8;
        m.scale.set(s * 1.4, s * 0.8, s);
        m.position.set((j - 1.5) * 1.6 + r(), r() * 0.8, r() * 1.2);
        g.add(m);
      }
      c.add(g);
    }

    const pilar = modelos.get('pillar_2x2x8')!;
    const pilares = (x: number, y0: number, z: number) => {
      if (y0 <= MAR) return;
      const o = this.clonar(pilar);
      o.scale.set(1, (y0 - MAR) / 8, 1);
      o.position.set(x, MAR, z);
      c.add(o);
    };

    for (const b of p.caixas) {
      if (!b.modelo) continue;
      const o = this.clonar(modelos.get(b.modelo)!);
      const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
      o.position.set(cx, b.y0, cz);
      o.rotation.y = (b.giro * Math.PI) / 2;
      c.add(o);
      if (b.mov || b.tipo === 'cai' || b.tipo === 'espinhos') {
        let espinhos: THREE.Object3D | null = null;
        if (b.tipo === 'espinhos') o.traverse((m) => m.name.includes('spikes') && m.name.includes('trap_spikes') && (espinhos = m));
        this.moveis.push({ i: b.i, o, espinhos });
      }
      // os pilares embaixo das peças paradas grandes (a de 2 de comprimento fica pendurada nas vizinhas)
      if (!b.mov && b.tipo !== 'cai' && b.tipo !== 'mola' && b.z1 - b.z0 >= 4 && b.x1 - b.x0 >= 4) pilares(cx, b.y0, cz);
    }
    for (const rp of p.rampas) {
      const o = this.clonar(modelos.get(rp.modelo)!);
      o.position.set((rp.x0 + rp.x1) / 2, rp.yBaixo, (rp.z0 + rp.z1) / 2);
      // a rampa da KayKit sobe para o −z; a nossa, para o +z
      o.rotation.y = Math.PI;
      c.add(o);
      pilares((rp.x0 + rp.x1) / 2, rp.yBaixo, (rp.z0 + rp.z1) / 2);
    }
    for (const e of p.enfeites) {
      const o = this.clonar(modelos.get(e.modelo)!);
      o.position.set(e.x, e.y, e.z);
      o.rotation.y = (e.giro * Math.PI) / 2;
      if (e.escala) o.scale.setScalar(e.escala);
      c.add(o);
    }
    for (const s of p.serras) {
      const o = this.clonar(modelos.get('sawblade')!);
      const k = s.raio / 3.4;
      o.scale.set(k, 0.6, k);
      o.position.set(s.cx, s.y, s.cz);
      c.add(o);
      this.serras.push(o);
    }
    for (const v of p.varredores) {
      const o = this.clonar(modelos.get(v.modelo)!);
      o.position.set(v.cx, v.y, v.cz);
      c.add(o);
      this.varredores.push(o);
    }
    const bala = modelos.get('cannon_bullet')!;
    for (const k of p.canhoes) {
      const voo = Math.floor((k.alcance * 60) / Math.abs(k.vx));
      const lista: THREE.Object3D[] = [];
      for (let j = 0; j <= Math.ceil(voo / k.periodo) + 1; j++) {
        const o = this.clonar(bala);
        o.scale.setScalar(1.35);
        o.rotation.y = k.vx > 0 ? Math.PI / 2 : -Math.PI / 2;
        o.visible = false;
        c.add(o);
        lista.push(o);
      }
      this.balas.push(lista);
    }
  }

  private montarCoelho(g: GLTF, c: CoelhoNaCena) {
    const copia = copiarCoelho(g, { altura: ALTURA_DO_COELHO, sombras: this.sombras, cores: c.cores, contorno: !c.fantasma });
    if (c.fantasma) {
      copia.material.m.transparent = true;
      copia.material.m.depthWrite = false;
      copia.material.uOpaco.value = 0.42;
    }
    const raiz = new THREE.Group();
    raiz.add(copia.corpo);
    if (c.nome) {
      const e = etiqueta(c.nome);
      e.position.y = ALTURA_DO_COELHO + 0.45;
      raiz.add(e);
      this.descartaveis.push(e.material.map!, e.material);
    }
    const sombra = new THREE.Mesh(new THREE.CircleGeometry(0.34, 20), new THREE.MeshBasicMaterial({ color: '#1d2a33', transparent: true, opacity: 0.28, depthWrite: false }));
    sombra.rotation.x = -Math.PI / 2;
    this.descartaveis.push(sombra.geometry, sombra.material as THREE.Material);
    this.cena.add(raiz, sombra);
    copia.acoes.get('parado')?.play();
    this.coelhos.push({ raiz, copia, sombra, rumo: 0, antes: null, tocando: 'parado', estica: 1 });
  }

  /** A altura do chão debaixo de (x, z) no passo `n`, até a altura `y` (para a sombra), ou null se não há chão. */
  private chaoDebaixo(x: number, z: number, y: number, n: number, eu: Coelho | null): number | null {
    let melhor: number | null = null;
    for (const b of this.p.caixas) {
      if (z < b.z0 - 8 || z > b.z1 + 8) continue;
      if (b.tipo === 'cai' && eu && eu.cai[b.k] >= 0 && n - eu.cai[b.k] >= TREME_PASSOS) continue;
      const d = deslocamento(b.mov, n);
      if (x < b.x0 + d.dx || x > b.x1 + d.dx || z < b.z0 + d.dz || z > b.z1 + d.dz) continue;
      const topo = b.y1 + d.dy;
      if (topo <= y + 0.05 && (melhor === null || topo > melhor)) melhor = topo;
    }
    for (const r of this.p.rampas) {
      if (x < r.x0 || x > r.x1 || z < r.z0 || z > r.z1) continue;
      const topo = r.yBaixo + ((r.yAlto - r.yBaixo) * (z - r.z0)) / (r.z1 - r.z0);
      if (topo <= y + 0.05 && (melhor === null || topo > melhor)) melhor = topo;
    }
    return melhor;
  }

  /**
   * Desenha um quadro. `n` é o passo do mundo (com a fração entre um passo e outro), `eu` o meu coelho (os blocos que caem são
   * os dele), `quadros` um por coelho na ordem de `montar` (o primeiro é quem a câmera segue). `dt`: o tempo de tela.
   */
  desenhar(n: number, eu: Coelho | null, quadros: QuadroDoCoelho[], dt: number) {
    if (this.morta) return;
    this.quadro++;
    this.relogio += dt;
    const p = this.p;
    const passoInteiro = Math.floor(n);

    // o que se mexe
    for (const m of this.moveis) {
      const b = p.caixas[m.i];
      const d = deslocamento(b.mov, n);
      const cx = (b.x0 + b.x1) / 2 + d.dx, cz = (b.z0 + b.z1) / 2 + d.dz;
      let y = b.y0 + d.dy;
      let tx = 0;
      m.o.visible = true;
      if (b.tipo === 'cai' && eu) {
        const t = eu.cai[b.k];
        if (t >= 0) {
          const idade = n - t;
          if (idade < TREME_PASSOS) tx = this.calmo ? 0 : Math.sin(idade * 2.1) * 0.06 * (idade / TREME_PASSOS);
          else if (idade < TREME_PASSOS + VOLTA_DO_BLOCO) {
            const q = (idade - TREME_PASSOS) / 60;
            y -= 16 * q * q;
            m.o.visible = y > MAR - 2;
          }
        }
      }
      m.o.position.set(cx + tx, y, cz);
      if (m.espinhos) {
        // fora, ou dentro; e um tremido antes de sair (o aviso)
        const fora = espinhosFora(b, passoInteiro);
        const falta = (b.ciclo - ((passoInteiro + b.faseDoCiclo) % b.ciclo)) % b.ciclo;
        const avisa = !fora && falta < 24 && !this.calmo;
        m.espinhos.position.y = fora ? 0 : ESPINHOS_DENTRO + (avisa ? 0.12 + Math.sin(this.relogio * 40) * 0.05 : 0);
      }
    }
    p.serras.forEach((s, i) => {
      const d = deslocamento(s.mov, n);
      const o = this.serras[i];
      o.position.set(s.cx + d.dx, s.y, s.cz + d.dz);
      if (!this.calmo) o.rotation.y = this.relogio * 14;
    });
    p.varredores.forEach((v, i) => {
      // o giro entre um passo e outro, pela tabela da regra (o desenho pode usar o arco-tangente)
      const a = bracoEm(v, passoInteiro);
      const ang = Math.atan2(-a.dz, a.dx) - ((n - passoInteiro) * v.giro * Math.PI * 2) / VOLTA_INTEIRA;
      this.varredores[i].rotation.y = ang;
    });
    p.canhoes.forEach((k, i) => {
      const xs = balasEm(k, passoInteiro);
      this.balas[i].forEach((o, j) => {
        if (j >= xs.length) {
          o.visible = false;
          return;
        }
        o.visible = true;
        o.position.set(xs[j] + ((n - passoInteiro) * k.vx) / 60, k.y, k.z);
      });
    });

    // os coelhos
    this.coelhos.forEach((m, i) => {
      const q = quadros[i];
      if (!q || q.escondido) {
        m.raiz.visible = false;
        m.sombra.visible = false;
        return;
      }
      m.raiz.visible = q.pisca > 0 ? Math.floor(q.pisca / 5) % 2 === 0 : true;
      m.raiz.position.set(q.x, q.y, q.z);
      // para onde ele anda (o modelo olha o +z)
      let andando = 0;
      if (m.antes) {
        const vx = q.x - m.antes.x, vz = q.z - m.antes.z;
        const v = Math.sqrt(vx * vx + vz * vz) / Math.max(dt, 1 / 240);
        andando = v;
        if (v > 0.6 && v < 40) {
          let d = Math.atan2(vx, vz) - m.rumo;
          d = Math.atan2(Math.sin(d), Math.cos(d));
          m.rumo += d * Math.min(1, dt * 14);
        }
      }
      m.antes = { x: q.x, z: q.z };
      m.raiz.rotation.y = m.rumo;
      const quer = q.noChao && andando > 0.8 && andando < 20 ? 'andando' : 'parado';
      if (quer !== m.tocando) {
        const nova = m.copia.acoes.get(quer);
        const velha = m.copia.acoes.get(m.tocando);
        if (nova) {
          nova.reset().play();
          if (velha) velha.crossFadeTo(nova, 0.12, false);
          m.tocando = quer;
        }
      }
      const andar = m.copia.acoes.get('andando');
      if (andar) andar.timeScale = Math.min(2.4, Math.max(0.8, andando / 2.6));
      // no ar, o coelho estica um tico (e encolhe ao pousar)
      const alvo = q.noChao ? 1 : 1.12;
      m.estica += (alvo - m.estica) * Math.min(1, dt * 12);
      m.copia.corpo.scale.y = m.copia.corpo.scale.x * m.estica;
      m.copia.mixer.update(this.calmo ? 0 : dt);
      // a sombra no chão de baixo
      const chao = this.chaoDebaixo(q.x, q.z, q.y, n, i === 0 ? eu : null);
      if (chao === null) m.sombra.visible = false;
      else {
        m.sombra.visible = m.raiz.visible;
        m.sombra.position.set(q.x, chao + 0.02, q.z);
        const alto = Math.max(0, q.y - chao);
        m.sombra.scale.setScalar(Math.max(0.4, 1 - alto * 0.12));
      }
    });

    // A CÂMERA: atrás do primeiro coelho (o meu, ou quem se assiste), olhando o percurso; a altura amortecida
    const alvo = quadros[0] && !quadros[0].escondido ? quadros[0] : null;
    if (alvo) {
      const ky = this.quadro < 3 ? 1 : Math.min(1, dt * 3.5);
      this.camY += (alvo.y - this.camY) * ky;
      const pos = new THREE.Vector3(alvo.x * 0.55, this.camY + 3.6, alvo.z - 7);
      const foco = new THREE.Vector3(alvo.x * 0.8, this.camY + 0.6, alvo.z + 5);
      const kk = this.quadro < 3 ? 1 : Math.min(1, dt * 6);
      this.camera.position.lerp(pos, kk);
      this.camAlvo.lerp(foco, this.quadro < 3 ? 1 : Math.min(1, dt * 8));
      this.camera.lookAt(this.camAlvo);
      const sol = this.sol;
      if (this.sombras && sol) {
        sol.position.set(alvo.x + 14, this.camY + 30, alvo.z - 10);
        sol.target.position.set(alvo.x, this.camY, alvo.z + 4);
      }
    }
    this.renderer.render(this.cena, this.camera);
  }

  destruir() {
    this.morta = true;
    this.observador.disconnect();
    for (const m of this.coelhos) m.copia.descartar();
    for (const d of this.descartaveis) d.dispose();
    this.renderer.forceContextLoss();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
