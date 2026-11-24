import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { fundoAconchegante, materialDeMadeira } from './ambiente';
import { carregarModelo, copiaDe, iluminar, marcaPlana, MesaBase } from './base';

/**
 * O CINCO EM LINHA EM 3D (19/11/2026, o lote 4 da auditoria): o tabuleiro de 15 × 15 feito por código (uma tábua clara com as
 * linhas pintadas numa textura de canvas e os pontos de referência), sobre a mesa de madeira das Damas, e as pedras são as
 * `checker_*_single` do KayKit Board Game Bits (CC0). A pedra nova cai do alto; a última jogada e a linha vencedora acendem.
 * Só a TELA: quem decide é o servidor, e o clique é o mesmo dos botões do 2D, que fica por baixo para o teclado e o leitor.
 */

export interface GomokuDaCena {
  lado: number;
  /** 0 vazia, 1 escura, 2 clara. */
  casas: number[];
  ultima: number | null;
  linha: number[];
  /** As casas que o último lance capturou (a variante da captura, 20/11/2026): marcadas de vermelho. */
  capturadas?: number[];
  /** As casas que o clique aceita agora (vazio fora da vez). */
  clicaveis: number[];
  /** A cor da pedra que a pessoa põe agora (1 escura, 2 clara), para a pedra-fantasma da prévia; sem ela, só o ponto. */
  minhaCor?: number;
}

const TOPO = 0.12;
const ARQUIVO: Record<number, string> = {
  1: 'checker_black_single',
  2: 'checker_white_single',
};

export class Gomoku3D extends MesaBase<GomokuDaCena> {
  private modelos = new Map<number, GLTF>();
  private pedras = new Map<number, { obj: THREE.Object3D; cor: number }>();
  private marcas: THREE.Mesh[] = [];
  private geoCasa = new THREE.PlaneGeometry(0.9, 0.9);
  private geoPonto = new THREE.CircleGeometry(0.18, 20);
  private n = 15;
  /** A pedra-fantasma da prévia (o mouse por cima ou o primeiro toque), uma por cor, meio transparente. */
  private fantasmas = new Map<number, THREE.Object3D>();
  private matsDoFantasma: THREE.Material[] = [];
  protected previaNoToque = true;

  private fantasma(cor: number): THREE.Object3D | null {
    let f = this.fantasmas.get(cor);
    if (f) return f;
    const g = this.modelos.get(cor);
    if (!g) return null;
    f = copiaDe(g, false);
    f.scale.setScalar(0.82);
    f.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const meio = (orig: THREE.Material) => {
        const mat = orig.clone();
        mat.transparent = true;
        mat.opacity = 0.5;
        mat.depthWrite = false;
        this.matsDoFantasma.push(mat);
        return mat;
      };
      m.material = Array.isArray(m.material) ? m.material.map(meio) : meio(m.material);
    });
    f.visible = false;
    this.cena.add(f);
    this.fantasmas.set(cor, f);
    return f;
  }

  private pos(i: number) {
    const meio = (this.n - 1) / 2;
    return new THREE.Vector3((i % this.n) - meio, TOPO, Math.floor(i / this.n) - meio);
  }

  protected async carregarTudo() {
    const [escura, clara] = await Promise.all([carregarModelo(ARQUIVO[1]), carregarModelo(ARQUIVO[2])]);
    this.modelos.set(1, escura);
    this.modelos.set(2, clara);
    this.descartaveis.push(this.geoCasa, this.geoPonto);
    fundoAconchegante(this.cena, this.descartaveis);
    iluminar(this.cena, this.sombras, 10);
    // a mesa redonda de madeira, como nas Damas, maior
    const mesaGeo = new THREE.CylinderGeometry(13, 13, 0.6, 56);
    const mesaMat = materialDeMadeira(this.descartaveis, [3, 10]);
    this.descartaveis.push(mesaGeo, mesaMat);
    const mesa = new THREE.Mesh(mesaGeo, mesaMat);
    mesa.position.y = -0.3;
    mesa.receiveShadow = this.sombras;
    this.cena.add(mesa);
    // a tábua: uma caixa com as linhas desenhadas numa textura (o centro e os quatro pontos de referência marcados)
    const lado = this.n + 1;
    const tela = document.createElement('canvas');
    tela.width = tela.height = 1024;
    const g = tela.getContext('2d')!;
    g.fillStyle = '#d9b77a';
    g.fillRect(0, 0, 1024, 1024);
    const passo = 1024 / lado;
    g.strokeStyle = '#4a3420';
    g.lineWidth = 3;
    for (let k = 0; k < this.n; k++) {
      const p = passo * (k + 1);
      g.beginPath();
      g.moveTo(passo, p);
      g.lineTo(1024 - passo, p);
      g.moveTo(p, passo);
      g.lineTo(p, 1024 - passo);
      g.stroke();
    }
    g.fillStyle = '#4a3420';
    const meio = (this.n - 1) / 2;
    for (const [c, l] of [
      [meio, meio],
      [3, 3],
      [3, this.n - 4],
      [this.n - 4, 3],
      [this.n - 4, this.n - 4],
    ]) {
      g.beginPath();
      g.arc(passo * (c + 1), passo * (l + 1), 7, 0, Math.PI * 2);
      g.fill();
    }
    const textura = new THREE.CanvasTexture(tela);
    textura.colorSpace = THREE.SRGBColorSpace;
    textura.anisotropy = 4;
    const topo = new THREE.MeshStandardMaterial({
      map: textura,
      roughness: 0.8,
    });
    const borda = new THREE.MeshStandardMaterial({
      color: '#b98d52',
      roughness: 0.85,
    });
    const caixa = new THREE.BoxGeometry(lado, 0.24, lado);
    this.descartaveis.push(textura, topo, borda, caixa);
    // A TÁBUA POR SCRIPT (24/11/2026): chanfrada, com o rodapé e os pezinhos na paleta do KayKit (web/scripts/modelos/
    // ponte-mesas-naval/mesas.py), de 16 casas de lado (esticada para o `lado`); o tampo recebe a mesma textura das linhas.
    const modelo = await carregarModelo('tabuleiro-gomoku').catch(() => null);
    if (modelo) {
      const t = copiaDe(modelo, this.sombras);
      t.scale.set(lado / 16, 1, lado / 16);
      t.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh && (m.material as THREE.Material).name === 'topo') m.material = topo;
      });
      this.cena.add(t);
      return;
    }
    const tabua = new THREE.Mesh(caixa, [borda, borda, topo, borda, borda, borda]);
    tabua.receiveShadow = this.sombras;
    this.cena.add(tabua);
  }

  protected enquadrar(aspecto: number) {
    const longe = Math.max(1, 1.05 / aspecto);
    this.camera.fov = 34;
    this.camera.position.set(0, 23 * longe, 13 * longe);
    this.camera.lookAt(0, 0, 0.8);
  }

  private nova(cor: number, i: number, caindo: boolean) {
    const g = this.modelos.get(cor);
    if (!g) return;
    const obj = copiaDe(g, this.sombras);
    obj.scale.setScalar(0.82);
    const fim = this.pos(i);
    obj.position.copy(fim);
    this.cena.add(obj);
    this.pedras.set(i, { obj, cor });
    // a pedra nova cai do alto
    if (caindo) {
      obj.position.y = fim.y + 2.5;
      this.mover(obj, [obj.position.clone(), fim], obj.quaternion.clone(), 220);
    }
  }

  protected aplicar(d: GomokuDaCena) {
    this.n = d.lado;
    const primeira = this.pedras.size === 0;
    for (let i = 0; i < d.casas.length; i++) {
      const cor = d.casas[i] ?? 0;
      const ja = this.pedras.get(i);
      if (ja && ja.cor === cor) continue;
      if (ja) {
        this.cena.remove(ja.obj);
        this.pedras.delete(i);
      }
      if (cor) this.nova(cor, i, !primeira && i === d.ultima);
    }
    for (const m of this.marcas) {
      this.cena.remove(m);
      (m.material as THREE.Material).dispose();
    }
    this.marcas = [];
    const marcar = (i: number, cor: string, opacidade: number, ponto = false) => {
      const m = marcaPlana(ponto ? this.geoPonto : this.geoCasa, cor, opacidade);
      m.position.copy(this.pos(i)).setY(TOPO + 0.13);
      this.cena.add(m);
      this.marcas.push(m);
    };
    if (d.ultima !== null) marcar(d.ultima, '#e3c45a', 0.55);
    for (const i of d.linha) marcar(i, '#6fd08a', 0.7);
    for (const i of d.capturadas ?? []) marcar(i, '#e5484d', 0.55);
    for (const f of this.fantasmas.values()) f.visible = false;
    if (this.sobre !== null && d.clicaveis.includes(this.sobre)) {
      const f = d.minhaCor ? this.fantasma(d.minhaCor) : null;
      if (f) {
        f.position.copy(this.pos(this.sobre));
        f.visible = true;
      } else marcar(this.sobre, '#6fd08a', 0.6, true);
    }
  }

  protected aoMudarSobre() {
    if (this.dados) this.aplicar(this.dados);
    this.pedirDesenho();
  }

  protected alvoNoRaio(raio: THREE.Raycaster): number | null {
    const p = new THREE.Vector3();
    if (!raio.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -TOPO), p)) return null;
    const meio = (this.n - 1) / 2;
    const c = Math.round(p.x + meio);
    const l = Math.round(p.z + meio);
    if (c < 0 || l < 0 || c >= this.n || l >= this.n) return null;
    const i = l * this.n + c;
    return this.dados?.clicaveis.includes(i) ? i : null;
  }

  destruir() {
    for (const m of this.marcas) (m.material as THREE.Material).dispose();
    for (const m of this.matsDoFantasma) m.dispose();
    super.destruir();
  }
}

export const criarGomoku3D = (caixa: HTMLElement, aoClicar: (i: number) => void) => new Gomoku3D(caixa, aoClicar);
