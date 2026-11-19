import * as THREE from 'three';
import { fundoAconchegante, materialDeMadeira } from './ambiente';
import { iluminar, marcaPlana, MesaBase } from './base';

/**
 * A MANCALA EM 3D (19/11/2026, o lote 4 da auditoria): o tabuleiro de madeira feito por código (duas fileiras de seis covas e
 * um depósito comprido em cada ponta), e as sementes são esferas pequenas em cinco cores, as mesmas do 2D. A SEMEADURA anda no
 * 3D pela mesma conta da tela (useSemeadura, em JogoDuelo.tsx): a cada passo chegam as casas de agora e a cova que recebeu a
 * semente, que acende. Só a TELA: quem decide é o servidor, e o clique na cova é o mesmo dos botões do 2D.
 */

export interface MancalaDaCena {
  /** As 14 casas como a tela mostra agora (no meio da semeadura, o quadro dela). */
  casas: number[];
  /** De que lado a pessoa vê: as covas dela embaixo, o depósito dela à direita. */
  meuLado: 0 | 1;
  /** A cova que acabou de receber semente (a semeadura andando), ou null. */
  destaque: number | null;
  ultima: number | null;
  clicaveis: number[];
}

const CORES = ['#e5484d', '#f2b84b', '#4f7df5', '#3fb27f', '#c86bd9'];
const MAXIMO = 120;
const RAIO_DA_SEMENTE = 0.11;
const TOPO = 0.42;

export class Mancala3D extends MesaBase<MancalaDaCena> {
  private sementes: THREE.InstancedMesh[] = [];
  private marcas: THREE.Mesh[] = [];
  private geoCova = new THREE.CircleGeometry(0.78, 28);
  /** O número de cada casa, numa placa que olha para a câmera (o 2D também mostra): redesenhado só quando muda. */
  private numeros: {
    sprite: THREE.Sprite;
    tela: HTMLCanvasElement;
    textura: THREE.CanvasTexture;
    valor: number;
  }[] = [];

  /** Onde fica cada casa na mesa, vista pelo `meuLado`: as minhas na fileira de perto, da esquerda para a direita. */
  private lugar(i: number, meuLado: 0 | 1): { x: number; z: number; deposito: boolean } {
    const meuDeposito = meuLado === 0 ? 6 : 13;
    if (i === 6 || i === 13) return { x: i === meuDeposito ? 7.2 : -7.2, z: 0, deposito: true };
    const minhas = meuLado === 0 ? [0, 1, 2, 3, 4, 5] : [7, 8, 9, 10, 11, 12];
    const k = minhas.indexOf(i);
    if (k >= 0) return { x: -5 + k * 2, z: 1.15, deposito: false };
    // as do outro, de trás para a frente (o sentido anti-horário continua do lado de lá)
    const dele = meuLado === 0 ? [7, 8, 9, 10, 11, 12] : [0, 1, 2, 3, 4, 5];
    return { x: 5 - dele.indexOf(i) * 2, z: -1.15, deposito: false };
  }

  protected async carregarTudo() {
    fundoAconchegante(this.cena, this.descartaveis);
    iluminar(this.cena, this.sombras, 9);
    const mesaGeo = new THREE.CylinderGeometry(12, 12, 0.6, 56);
    const mesaMat = materialDeMadeira(this.descartaveis, [3, 10]);
    this.descartaveis.push(mesaGeo, mesaMat, this.geoCova);
    const mesa = new THREE.Mesh(mesaGeo, mesaMat);
    mesa.position.y = -0.3;
    mesa.receiveShadow = this.sombras;
    this.cena.add(mesa);
    // o tabuleiro: uma tábua comprida mais clara, com as covas e os depósitos escuros por cima
    const tabuaGeo = new THREE.BoxGeometry(17.4, 0.4, 5.2);
    const tabuaMat = new THREE.MeshStandardMaterial({
      color: '#b07a45',
      roughness: 0.7,
    });
    const covaMat = new THREE.MeshStandardMaterial({
      color: '#5a3a1e',
      roughness: 0.95,
    });
    const depositoGeo = new THREE.CircleGeometry(1, 36);
    this.descartaveis.push(tabuaGeo, tabuaMat, covaMat, depositoGeo);
    const tabua = new THREE.Mesh(tabuaGeo, tabuaMat);
    tabua.position.y = 0.2;
    tabua.castShadow = this.sombras;
    tabua.receiveShadow = this.sombras;
    this.cena.add(tabua);
    for (let i = 0; i < 14; i++) {
      const { x, z, deposito } = this.lugar(i, 0);
      const m = new THREE.Mesh(deposito ? depositoGeo : this.geoCova, covaMat);
      m.rotation.x = -Math.PI / 2;
      if (deposito) m.scale.set(0.95, 2.1, 1);
      m.position.set(x, TOPO + 0.002, z);
      m.receiveShadow = this.sombras;
      this.cena.add(m);
    }
    const geoSemente = new THREE.SphereGeometry(RAIO_DA_SEMENTE, 12, 8);
    this.descartaveis.push(geoSemente);
    for (let i = 0; i < 14; i++) {
      const tela = document.createElement('canvas');
      tela.width = tela.height = 64;
      const textura = new THREE.CanvasTexture(tela);
      textura.colorSpace = THREE.SRGBColorSpace;
      const mat = new THREE.SpriteMaterial({ map: textura, depthTest: false });
      this.descartaveis.push(textura, mat);
      const sprite = new THREE.Sprite(mat);
      sprite.scale.setScalar(0.62);
      sprite.renderOrder = 2;
      this.cena.add(sprite);
      this.numeros.push({ sprite, tela, textura, valor: -1 });
    }
    for (const cor of CORES) {
      const mat = new THREE.MeshStandardMaterial({
        color: cor,
        roughness: 0.35,
        metalness: 0.05,
      });
      this.descartaveis.push(mat);
      const im = new THREE.InstancedMesh(geoSemente, mat, MAXIMO);
      im.count = 0;
      im.castShadow = this.sombras;
      this.sementes.push(im);
      this.cena.add(im);
    }
  }

  private numero(i: number, valor: number) {
    const n = this.numeros[i];
    if (!n || n.valor === valor) return;
    n.valor = valor;
    const g = n.tela.getContext('2d')!;
    g.clearRect(0, 0, 64, 64);
    g.fillStyle = 'rgba(30, 20, 10, 0.7)';
    g.beginPath();
    g.arc(32, 32, 26, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#fff4dd';
    g.font = 'bold 30px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(String(valor), 32, 34);
    n.textura.needsUpdate = true;
  }

  protected enquadrar(aspecto: number) {
    const longe = Math.max(1, 1.9 / aspecto);
    this.camera.fov = 34;
    this.camera.position.set(0, 13 * longe, 9 * longe);
    this.camera.lookAt(0, 0, 0.4);
  }

  protected aplicar(d: MancalaDaCena) {
    // as sementes: em espiral dentro da cova (no depósito, esticada no comprido), subindo em camadas quando enchem
    const contas = CORES.map(() => 0);
    const m = new THREE.Matrix4();
    for (let i = 0; i < 14; i++) {
      const { x, z, deposito } = this.lugar(i, d.meuLado);
      const n = d.casas[i] ?? 0;
      // o número na beira de fora da cova (no depósito, na ponta de cá)
      const placa = this.numeros[i];
      if (placa) {
        placa.sprite.position.set(x, TOPO + 0.9, deposito ? 2.6 : z + (z > 0 ? 1.05 : -1.05));
        this.numero(i, n);
      }
      for (let k = 0; k < n; k++) {
        const cor = k % CORES.length;
        if (contas[cor] >= MAXIMO) continue;
        const camada = Math.floor(k / (deposito ? 24 : 12));
        const j = k % (deposito ? 24 : 12);
        const angulo = j * 2.4 + i;
        const raio = 0.16 * Math.sqrt(j);
        const px = x + Math.cos(angulo) * raio * (deposito ? 0.9 : 1);
        const pz = z + Math.sin(angulo) * raio * (deposito ? 2.1 : 1);
        m.makeTranslation(px, TOPO + RAIO_DA_SEMENTE + camada * RAIO_DA_SEMENTE * 1.6, pz);
        this.sementes[cor].setMatrixAt(contas[cor]++, m);
      }
    }
    this.sementes.forEach((im, k) => {
      im.count = contas[k];
      im.instanceMatrix.needsUpdate = true;
    });
    for (const marca of this.marcas) {
      this.cena.remove(marca);
      (marca.material as THREE.Material).dispose();
    }
    this.marcas = [];
    const marcar = (i: number, cor: string, opacidade: number) => {
      const { x, z, deposito } = this.lugar(i, d.meuLado);
      const marca = marcaPlana(this.geoCova, cor, opacidade);
      if (deposito) marca.scale.set(1.2, 2.6, 1);
      marca.position.set(x, TOPO + 0.004, z);
      this.cena.add(marca);
      this.marcas.push(marca);
    };
    if (d.destaque !== null) marcar(d.destaque, '#f5b83d', 0.55);
    else if (d.ultima !== null) marcar(d.ultima, '#e3c45a', 0.35);
    if (this.sobre !== null && d.clicaveis.includes(this.sobre)) marcar(this.sobre, '#6fd08a', 0.5);
    // o clique: um lugar parado sobre cada cova que vale
    const deitado = new THREE.Quaternion();
    for (const i of d.clicaveis) {
      const { x, z } = this.lugar(i, d.meuLado);
      this.alvoFixo(i, new THREE.Vector3(x, TOPO + 0.01, z), deitado, 1.7, 1.7);
    }
    this.soAlvosFixos(d.clicaveis);
  }

  protected aoMudarSobre() {
    if (this.dados) this.aplicar(this.dados);
    this.pedirDesenho();
  }

  protected alvoNoRaio(): number | null {
    return null;
  }

  destruir() {
    for (const marca of this.marcas) (marca.material as THREE.Material).dispose();
    super.destruir();
  }
}

export const criarMancala3D = (caixa: HTMLElement, aoClicar: (i: number) => void) => new Mancala3D(caixa, aoClicar);
