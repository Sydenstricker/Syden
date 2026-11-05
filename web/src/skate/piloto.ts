/**
 * O PILOTO AUTOMÁTICO DO SKATE: serve aos testes (web/test/skate.test.ts) e ao e2e (window.skatePilotoAutomatico, só no site
 * de desenvolvimento). Ele dá voltas fixas pela pista: o corrimão (indo para o fundo), um ollie com kickflip, 180 e manual no
 * caminho, e a caixa de grind (voltando). Não é esperto: segue pontos e mira as linhas, como quem conhece a pista.
 */
import { NADA, type Comandos, type Skatista } from './fisica';

interface Alvo {
  x: number;
  z: number;
  /** Ao chegar perto disto, passa ao próximo. */
  raio: number;
}

type Etapa =
  | { tipo: 'ir'; alvo: Alvo }
  | { tipo: 'linha'; x: number; z0: number; dir: 1 | -1; pulaEm: number }
  | { tipo: 'truque' };

const VOLTA: Etapa[] = [
  { tipo: 'ir', alvo: { x: 1.6, z: 12.5, raio: 0.7 } },
  { tipo: 'ir', alvo: { x: 2.0, z: 16.2, raio: 0.6 } },
  { tipo: 'ir', alvo: { x: 3.5, z: 15.6, raio: 0.5 } },
  // o corrimão, indo para o fundo (−z): a linha em x = 3,5 começa em z = 11
  { tipo: 'linha', x: 3.5, z0: 11, dir: -1, pulaEm: 0.25 },
  { tipo: 'truque' },
  { tipo: 'ir', alvo: { x: 10.4, z: 2.4, raio: 0.7 } },
  { tipo: 'ir', alvo: { x: 8.5, z: 2.0, raio: 0.6 } },
  { tipo: 'ir', alvo: { x: 8.5, z: 3.6, raio: 0.35 } },
  // a caixa, voltando (+z): começa em z = 7
  { tipo: 'linha', x: 8.5, z0: 7, dir: 1, pulaEm: 0.21 },
  { tipo: 'truque' },
  { tipo: 'ir', alvo: { x: 10, z: 15, raio: 0.9 } },
];

export function criarPiloto() {
  let i = 0;
  let passos = 0;
  /** No truque: a fase (rodar, no ar, manual) e um contador. */
  let truque = 0;
  let conta = 0;
  let esperaPulo = 0;
  let noManual = 0;

  const proxima = () => {
    i = (i + 1) % VOLTA.length;
    passos = 0;
    truque = 0;
    conta = 0;
  };

  /** Vira para (dx, dz): a mesma conta de "esquerda" da física. */
  const mirar = (k: Skatista, dx: number, dz: number, c: Comandos) => {
    const n = Math.sqrt(dx * dx + dz * dz) || 1;
    const cruz = k.rx * (dz / n) - k.rz * (dx / n);
    const frente = k.rx * (dx / n) + k.rz * (dz / n);
    if (cruz < -0.03 || (frente < 0 && cruz <= 0)) c.esquerda = true;
    else if (cruz > 0.03 || frente < 0) c.direita = true;
    return frente;
  };

  return function pilotar(k: Skatista): Comandos {
    const c: Comandos = { ...NADA };
    passos++;
    // o equilíbrio, onde houver
    if (k.modo === 'grind') {
      if (k.equilibrio + k.deriva * 10 > 0) c.esquerda = true;
      else c.direita = true;
      return c;
    }
    if (k.modo !== 'manual') noManual = 0;
    if (k.modo === 'manual') {
      noManual++;
      if (k.equilibrio + k.deriva * 10 > 0) c.frente = true;
      else c.tras = true;
      if (noManual > 50) {
        c.frente = c.tras = false;
        c.manual = true;
      }
      return c;
    }
    if (k.modo === 'caido') return c;
    if (esperaPulo > 0) {
      // segurou o Espaço um passo: solta (o ollie sai ao soltar)
      esperaPulo--;
      if (esperaPulo > 0) c.pulo = true;
      return c;
    }
    const e = VOLTA[i];
    if (passos > 900) {
      // empacou (bateu, rodou demais): segue para a próxima
      proxima();
      return c;
    }
    if (e.tipo === 'ir') {
      if (k.modo === 'ar') return c;
      const dx = e.alvo.x - k.x;
      const dz = e.alvo.z - k.z;
      if (dx * dx + dz * dz < e.alvo.raio * e.alvo.raio) {
        proxima();
        return c;
      }
      const frente = mirar(k, dx, dz, c);
      if (k.vel < (frente > 0.7 ? 2.6 : 1.4)) c.frente = true;
      if (frente < 0.3 && k.vel > 1.8) c.tras = true;
      return c;
    }
    if (e.tipo === 'linha') {
      if (k.modo === 'ar') {
        if (k.trilho >= 0) return c;
        return c;
      }
      // já passou (grindou ou não): segue
      if (truque > 0 || (e.dir < 0 ? k.z < e.z0 - 1 : k.z > e.z0 + 1)) {
        proxima();
        return c;
      }
      // mira um ponto na linha um pouco à frente
      const alvoZ = k.z + e.dir * (Math.abs(e.x - k.x) > 0.4 ? 1.4 : 2.2);
      const frente = mirar(k, e.x - k.x, alvoZ - k.z, c);
      // desalinhado, devagar (vira mais fechado); alinhado, embalado
      const alinhado = Math.abs(k.x - e.x) < 0.25 && Math.abs(k.rx) < 0.15;
      const quer = alinhado ? 3 : 1.7;
      if (k.vel < quer) c.frente = true;
      else if (k.vel > quer + 0.4) c.tras = true;
      // o pulo: cair na linha um tico depois do começo
      const ate = (k.z - e.z0) * -e.dir;
      const tempo = 0.53;
      if (Math.abs(k.rx) < 0.08 && Math.abs(k.x - e.x) < 0.13 && ate > 0 && ate < k.vel * tempo - 0.15 && k.vel > 1.5) {
        c.pulo = true;
        esperaPulo = 1;
        truque = 1;
      }
      return c;
    }
    // o truque: no chão, um ollie carregado; no ar, kickflip, 180 e o manual armado; no chão de novo, segue
    if (truque === 0) {
      if (k.modo !== 'chao') return c;
      conta++;
      if (k.vel < 2.4) c.frente = true;
      if (conta > 30) {
        c.pulo = true;
        if (conta > 30 + 24) {
          c.pulo = false;
          truque = 1;
          conta = 0;
        }
      }
      return c;
    }
    if (truque === 1) {
      if (k.modo === 'ar') {
        conta++;
        if (conta === 2) c.flip = true;
        if (conta >= 4 && conta < 4 + 24) c.esquerda = true;
        if (conta > 30) c.manual = true;
        return c;
      }
      if (conta > 0) proxima();
      return c;
    }
    return c;
  };
}
