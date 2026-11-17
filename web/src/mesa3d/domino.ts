import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { fundoAconchegante, mesaDeFeltro } from './ambiente';
import { carregarModelo, copiaDe, giro, iluminar, MesaBase } from './base';

/**
 * O DOMINÓ EM 3D (05/11/2026, pedido dele): as pedras do KayKit (`domino_tile_a-b`, o 6-6 inteiro) num feltro. A minha mão
 * fica em pé na minha frente, e as que servem acendem; as dos outros, de costas, em fila no alto, na ordem da lista de nomes de
 * cima. A pedra que serve nas duas pontas, escolhida, acende as duas pontas da corrente para o clique. As regras moram no
 * servidor; a tela só mostra e pede.
 *
 * A CORRENTE É ESTÁVEL, COMO NA MESA DE VERDADE (16/11/2026, relato dele: "o tabuleiro se move; deveria ficar estável na
 * mesa"): a primeira pedra fica no meio, as novas crescem a partir das duas pontas, e NADA do que já foi jogado se mexe. Antes
 * a corrente quebrava em linhas centradas, refeitas a cada lance, e toda pedra escorregava. Quando uma ponta chega perto da
 * borda, ela VIRA A ESQUINA (uma pedra atravessada) e volta na linha de baixo (a da direita) ou na de cima (a da esquerda),
 * em cobrinha. Quem entra no meio da mão vê a corrente montada a partir da pedra do meio.
 */

export type Pedra = [number, number];
export interface DominoDaCena {
  mesa: Pedra[];
  mao: Pedra[];
  /** Os índices da mão que servem agora (vazio fora da minha vez). */
  servem: number[];
  /** A pedra da mão esperando a escolha da ponta, ou null. */
  escolhida: number | null;
  /** Quantas pedras tem cada um dos outros, na ordem da mesa. */
  outros: number[];
}

/** Os alvos do clique além dos índices da mão. */
export const PONTA_ESQUERDA = -1;
export const PONTA_DIREITA = -2;

const ESCALA = 0.42;
const CURTO = 1 * ESCALA;
const LONGO = 2 * ESCALA;
const GROSSO = 0.277 * ESCALA;
const FOLGA = 0.04;
/** Até onde a corrente vai para os lados antes de virar a esquina, e a linha do meio dela. */
const LIMITE_X = 3.55;
const Z_DO_MEIO = -0.3;
/** A distância entre uma linha da cobrinha e a seguinte: uma pedra deitada e um respiro (as duplas atravessadas não encostam). */
const ENTRE_LINHAS = LONGO + 0.12;
const chaveDa = (p: Pedra) => `${Math.min(p[0], p[1])}-${Math.max(p[0], p[1])}`;
const DE_PE = giro(1.13, 0, 0);

interface Peca {
  obj: THREE.Group;
  /** O material próprio da pedra (cópia do do modelo), para ela acender quando serve. */
  mat: THREE.MeshStandardMaterial;
  alvo: number | null;
  onde: string;
}
interface Lugar {
  pos: THREE.Vector3;
  q: THREE.Quaternion;
  alvo: number | null;
  /** A da mão é maior, para ler e clicar. */
  escala?: number;
  acesa?: boolean;
}
const NA_MAO = 1.3;

/** Uma ponta da corrente: onde ela acaba, para que lado cresce (só no x: a esquina é uma pedra só) e para que lado vira. */
interface Cabeca {
  x: number;
  z: number;
  dx: 1 | -1;
  vira: 1 | -1;
}

/** O giro que põe a metade `perto` virada para trás (−d) e a outra para a frente; no modelo, a metade menor está no −z. */
function rumoDa(p: Pedra, perto: number, dx: number, dz: number): number {
  if (p[0] === p[1]) return dx !== 0 ? 0 : Math.PI / 2; // a dupla, atravessada
  const menor = Math.min(p[0], p[1]);
  // para onde aponta a metade menor: para trás se ela é a que encosta, senão para a frente
  const ux = perto === menor ? -dx : dx;
  const uz = perto === menor ? -dz : dz;
  return Math.atan2(-ux, -uz);
}

/**
 * Deita a pedra `p` na ponta `h` (`perto` é o número que encosta na corrente) e devolve o lugar dela e a ponta nova. Não cabendo
 * antes do LIMITE_X, ela vira a esquina: deita atravessada, ligando esta linha à seguinte, e a ponta volta no sentido contrário.
 */
function encaixar(h: Cabeca, p: Pedra, perto: number): { lugar: Lugar; cabeca: Cabeca } {
  const dupla = p[0] === p[1];
  const comp = (dupla ? CURTO : LONGO) + FOLGA;
  const y = GROSSO / 2 + 0.002;
  if (Math.abs(h.x + h.dx * comp) <= LIMITE_X) {
    return {
      lugar: { pos: new THREE.Vector3(h.x + (h.dx * comp) / 2, y, h.z), q: giro(0, rumoDa(p, perto, h.dx, 0), 0), alvo: null },
      cabeca: { ...h, x: h.x + h.dx * comp },
    };
  }
  // A ESQUINA: a pedra de pé no sentido da virada, logo depois do fim da linha, entre esta linha e a próxima
  const x = h.x + h.dx * ((dupla ? LONGO : CURTO) / 2 + FOLGA);
  const z = h.z + (h.vira * ENTRE_LINHAS) / 2;
  return {
    lugar: { pos: new THREE.Vector3(x, y, z), q: giro(0, rumoDa(p, perto, 0, h.vira), 0), alvo: null },
    cabeca: { x: h.x, z: h.z + h.vira * ENTRE_LINHAS, dx: (h.dx === 1 ? -1 : 1) as 1 | -1, vira: h.vira },
  };
}

export class Domino3D extends MesaBase<DominoDaCena> {
  private modelos = new Map<string, GLTF>();
  private pecas = new Map<string, Peca>();
  private geoLuz = new THREE.PlaneGeometry(CURTO * 1.35, LONGO * 1.2);
  private matPonta = new THREE.MeshBasicMaterial({ color: '#7be39a', transparent: true, opacity: 0.6, depthWrite: false });
  private pontas: THREE.Mesh[] = [];
  private montado = false;
  /** A corrente já deitada: as chaves na ordem da mesa, o lugar de cada pedra (que nunca muda) e as duas pontas. */
  private deitada: { chaves: string[]; lugares: Map<string, Lugar>; esquerda: Cabeca; direita: Cabeca } | null = null;

  protected async carregarTudo() {
    const nomes: string[] = [];
    for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) nomes.push(`${a}-${b}`);
    const lista = await Promise.all(nomes.map((n) => carregarModelo(`domino_tile_${n}`).then((g) => [n, g] as const)));
    for (const [n, g] of lista) this.modelos.set(n, g);
    this.descartaveis.push(this.geoLuz, this.matPonta);
    // a mesma mesa do Truco (ambiente.ts): o feltro com textura, a borda de madeira, o fundo de sala e a luz do pendente
    fundoAconchegante(this.cena, this.descartaveis);
    iluminar(this.cena, this.sombras, 6);
    mesaDeFeltro(this.cena, 9.5, 7.2, this.sombras, this.descartaveis);
    for (const alvo of [PONTA_ESQUERDA, PONTA_DIREITA]) {
      const m = new THREE.Mesh(this.geoLuz, this.matPonta);
      m.rotation.x = -Math.PI / 2;
      m.userData.alvo = alvo;
      m.visible = false;
      this.cena.add(m);
      this.pontas.push(m);
    }
  }

  protected enquadrar(aspecto: number) {
    // perto o bastante para ler os pontos da corrente; numa caixa estreita, recua para a mão e as pedras de cima caberem
    const longe = Math.max(1, 1.45 / aspecto);
    this.camera.fov = 36;
    this.camera.position.set(0, 6.9 * longe, 4.6 * longe);
    this.camera.lookAt(0, 0, 0.3);
  }

  private nova(p: Pedra): Peca {
    const obj = new THREE.Group();
    const g = this.modelos.get(chaveDa(p))!;
    const corpo = copiaDe(g, this.sombras);
    corpo.scale.setScalar(ESCALA);
    corpo.position.y = -GROSSO / 2;
    let mat: THREE.MeshStandardMaterial | null = null;
    corpo.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      mat ??= (m.material as THREE.MeshStandardMaterial).clone();
      m.material = mat;
    });
    obj.add(corpo);
    this.cena.add(obj);
    return { obj, mat: mat ?? new THREE.MeshStandardMaterial(), alvo: null, onde: '' };
  }

  /**
   * Onde cada pedra da corrente deita. Se a mesa nova é a de antes com pedras nas pontas, só as novas ganham lugar (o das outras
   * não muda); senão (mão nova, ou a primeira vista no meio da mão), a corrente se deita de novo a partir da pedra do meio.
   */
  private corrente(mesa: Pedra[]): { lugares: Lugar[]; esquerda: Cabeca | null; direita: Cabeca | null } {
    const chaves = mesa.map(chaveDa);
    const antes = this.deitada;
    let ini = -1;
    if (antes && antes.chaves.length && antes.chaves.length <= chaves.length) {
      ini = chaves.indexOf(antes.chaves[0]);
      if (ini >= 0 && antes.chaves.some((c, k) => chaves[ini + k] !== c)) ini = -1;
    }
    if (ini < 0) {
      if (!mesa.length) {
        this.deitada = null;
        return { lugares: [], esquerda: null, direita: null };
      }
      // a primeira pedra (ou a do meio, para quem chega com a mão andando) no meio da mesa, deitada como veio
      const k = Math.floor((mesa.length - 1) / 2);
      const p = mesa[k];
      const w = (p[0] === p[1] ? CURTO : LONGO) + FOLGA;
      const lugar: Lugar = { pos: new THREE.Vector3(0, GROSSO / 2 + 0.002, Z_DO_MEIO), q: giro(0, rumoDa(p, p[0], 1, 0), 0), alvo: null };
      this.deitada = {
        chaves: [chaves[k]],
        lugares: new Map([[chaves[k], lugar]]),
        esquerda: { x: -w / 2, z: Z_DO_MEIO, dx: -1, vira: -1 },
        direita: { x: w / 2, z: Z_DO_MEIO, dx: 1, vira: 1 },
      };
      ini = k;
    }
    const c = this.deitada!;
    // as novas da esquerda, da mais perto da corrente para a mais longe; o número que encosta é o da direita da pedra
    for (let k = ini - 1; k >= 0; k--) {
      const { lugar, cabeca } = encaixar(c.esquerda, mesa[k], mesa[k][1]);
      c.lugares.set(chaves[k], lugar);
      c.esquerda = cabeca;
    }
    // as novas da direita; o número que encosta é o da esquerda da pedra
    for (let k = ini + c.chaves.length; k < mesa.length; k++) {
      const { lugar, cabeca } = encaixar(c.direita, mesa[k], mesa[k][0]);
      c.lugares.set(chaves[k], lugar);
      c.direita = cabeca;
    }
    c.chaves = chaves;
    for (const ch of [...c.lugares.keys()]) if (!chaves.includes(ch)) c.lugares.delete(ch);
    return { lugares: chaves.map((ch) => c.lugares.get(ch)!), esquerda: c.esquerda, direita: c.direita };
  }

  protected aplicar(d: DominoDaCena) {
    const quer = new Map<string, Lugar>();
    const { lugares: corrente, esquerda, direita } = this.corrente(d.mesa);
    d.mesa.forEach((p, k) => quer.set(chaveDa(p), corrente[k]));
    const nm = d.mao.length;
    const largura = Math.min(CURTO * NA_MAO + 0.14, 8.2 / Math.max(1, nm));
    d.mao.forEach((p, k) => {
      const meio = k - (nm - 1) / 2;
      const serve = d.servem.includes(k);
      const sobe = (serve && this.sobre === k) || d.escolhida === k ? 0.22 : serve ? 0.08 : 0;
      const q = giro(0, -meio * 0.04, 0).multiply(DE_PE);
      quer.set(chaveDa(p), { pos: new THREE.Vector3(meio * largura, 0.5 + sobe, 2.45), q, alvo: serve ? k : null, escala: NA_MAO, acesa: serve });
      // o clique onde a pedra DESCANSA (base.ts, alvoFixo): a pedra que sobe ao passar o mouse não sai de baixo dele
      if (serve) this.alvoFixo(k, new THREE.Vector3(meio * largura, 0.5 + (d.escolhida === k ? 0.22 : 0.08), 2.45), q, Math.min(largura, CURTO * NA_MAO + 0.1), LONGO * NA_MAO + 0.45);
    });
    this.soAlvosFixos(d.servem);
    // as dos outros, de costas, em fila no alto
    const total = d.outros.reduce((s, n) => s + n, 0) + Math.max(0, d.outros.length - 1) * 1.2;
    let x = (-total * (CURTO + 0.05)) / 2;
    d.outros.forEach((n, j) => {
      for (let k = 0; k < n; k++) {
        quer.set(`o:${j}:${k}`, { pos: new THREE.Vector3(x + CURTO / 2, GROSSO / 2 + 0.002, -2.85), q: giro(0, 0, Math.PI), alvo: null });
        x += CURTO + 0.05;
      }
      x += 1.2 * (CURTO + 0.05);
    });

    const primeiraVez = !this.montado;
    this.montado = true;
    for (const [chave, p] of this.pecas)
      if (!quer.has(chave)) {
        this.cena.remove(p.obj);
        p.mat.dispose();
        this.pecas.delete(chave);
      }
    for (const [chave, l] of quer) {
      let p = this.pecas.get(chave);
      let trecho = 380;
      if (!p) {
        const pedra = chave.startsWith('o:') ? null : (chave.split('-').map(Number) as Pedra);
        // a de costas dos outros é uma pedra qualquer virada: nunca aparece a face
        p = this.nova(pedra ?? [0, 0]);
        this.pecas.set(chave, p);
        if (primeiraVez) {
          p.obj.position.copy(l.pos);
          p.obj.quaternion.copy(l.q);
          p.onde = '*';
        } else {
          // a pedra jogada por outro vem do alto, de costas; a comprada, de baixo
          const naMao = d.mao.some((m) => chaveDa(m) === chave);
          p.obj.position.set(0, 0.4, naMao ? 3.6 : -2.85);
          p.obj.quaternion.copy(naMao ? DE_PE : giro(0, 0, Math.PI));
        }
      } else if (d.mao.some((m) => chaveDa(m) === chave)) trecho = 150;
      p.alvo = l.alvo;
      p.obj.scale.setScalar(l.escala ?? 1);
      p.mat.emissive.set(l.acesa ? '#3fbf6a' : '#000000');
      p.mat.emissiveIntensity = l.acesa ? 0.35 : 0;
      const onde = `${l.pos.toArray().map((v) => v.toFixed(3))}|${l.q.toArray().map((v) => v.toFixed(3))}`;
      if (p.onde === '*') p.onde = onde;
      if (p.onde !== onde) {
        p.onde = onde;
        this.mover(p.obj, [p.obj.position.clone(), l.pos], l.q, trecho, trecho > 200 ? 0.35 : 0);
      }
    }

    // as duas pontas, quando a escolhida serve nas duas: a luz fica onde uma pedra deitada cairia
    const pronta = d.escolhida !== null && corrente.length > 0 && !!esquerda && !!direita;
    this.pontas.forEach((m, k) => {
      m.visible = pronta;
      if (!pronta) return;
      const h = k === 0 ? esquerda! : direita!;
      const { lugar } = encaixar(h, [0, 1], 0);
      m.position.set(lugar.pos.x, 0.006, lugar.pos.z);
      // deitada no x, ou de pé na esquina
      m.rotation.z = Math.abs(lugar.pos.z - h.z) < 0.01 ? Math.PI / 2 : 0;
    });
  }

  protected passo(agora: number) {
    const pronta = this.pontas[0].visible;
    if (!pronta || this.calmo) return false;
    this.matPonta.opacity = 0.4 + 0.3 * Math.sin(agora / 180);
    return true;
  }

  protected aoMudarSobre() {
    if (this.dados) this.aplicar(this.dados);
  }

  destruir() {
    for (const p of this.pecas.values()) p.mat.dispose();
    super.destruir();
  }

  protected alvoNoRaio(raio: THREE.Raycaster): number | null {
    const pontas = this.pontas.filter((m) => m.visible);
    const comAlvo = [...this.pecas.values()].filter((p) => p.alvo !== null);
    const hit = raio.intersectObjects([...pontas, ...comAlvo.map((p) => p.obj)], true)[0];
    if (!hit) return null;
    if (typeof hit.object.userData.alvo === 'number') return hit.object.userData.alvo;
    for (const p of comAlvo) {
      let o: THREE.Object3D | null = hit.object;
      while (o && o !== p.obj) o = o.parent;
      if (o) return p.alvo;
    }
    return null;
  }
}

export const criarDomino3D = (caixa: HTMLElement, aoClicar: (alvo: number) => void) => new Domino3D(caixa, aoClicar);
