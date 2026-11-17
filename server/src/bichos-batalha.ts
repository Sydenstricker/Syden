import { atributos, dano, ESPECIES, eficacia, GOLPES, golpesDe, CURA_DO_CHA } from './bichos-regras.js';

/**
 * A LUTA DOS BICHOS DA TOCA (16/11/2026): por turnos, dois lados, um bicho na frente de cada um. Serve à aventura do Solo (contra o
 * bicho do mato ou a equipe da Nena) e à luta entre duas pessoas da sala. Quem decide é o servidor: a ordem, o dano e a sorte. O
 * site só escolhe o que fazer.
 *
 * Cada turno, cada lado faz UMA coisa: um golpe, trocar o bicho da frente, dar chá a ele, ou nada (a cenoura recusada, a fuga
 * que não deu). Trocar, o chá e o nada vão primeiro; os golpes, pela velocidade (empate, sorteio). Quem pega no sono antes da
 * vez dele não age. O lado cujo bicho dormiu escolhe outro antes do turno seguinte (`precisaTrocar`); sem nenhum acordado, perde.
 * Ninguém se machuca: o bicho cansado "pega no sono".
 */

export interface Lutador {
  especie: string;
  nivel: number;
  pv: number;
  pvMax: number;
  atq: number;
  def: number;
  vel: number;
  golpes: string[];
}

export interface Lado {
  equipe: Lutador[];
  ativo: number;
  precisaTrocar: boolean;
}

export type Escolha = { tipo: 'golpe'; i: number } | { tipo: 'trocar'; i: number } | { tipo: 'cha' } | { tipo: 'nada' };

export type EventoDaLuta =
  | { t: 'golpe'; lado: number; especie: string; golpe: string; efic: number; dano: number; pv: number; alvo: string }
  | { t: 'sono'; lado: number; especie: string }
  | { t: 'troca'; lado: number; especie: string; i: number }
  | { t: 'cha'; lado: number; especie: string; pv: number };

export interface Batalha {
  lados: [Lado, Lado];
  /** Quem venceu (o lado), ou null enquanto dura. */
  vencedor: 0 | 1 | null;
}

export function lutador(especie: string, nivel: number, pv?: number): Lutador {
  const a = atributos(especie, nivel);
  return { especie, nivel, ...a, pv: Math.max(0, Math.min(a.pvMax, pv ?? a.pvMax)), golpes: golpesDe(especie, nivel) };
}

export const ativoDe = (l: Lado) => l.equipe[l.ativo];
export const acordados = (l: Lado) => l.equipe.filter((b) => b.pv > 0).length;

export function novaBatalha(a: Lutador[], b: Lutador[]): Batalha {
  const lado = (equipe: Lutador[]): Lado => ({ equipe, ativo: Math.max(0, equipe.findIndex((x) => x.pv > 0)), precisaTrocar: false });
  return { lados: [lado(a), lado(b)], vencedor: null };
}

/** A escolha vale agora? Devolve o erro (em português), ou null. */
export function conferirEscolha(b: Batalha, lado: number, e: Escolha | null | undefined): string | null {
  if (!e || typeof e !== 'object') return 'Escolha inválida.';
  const l = b.lados[lado];
  if (l.precisaTrocar && e.tipo !== 'trocar') return 'Escolha outro bicho.';
  if (e.tipo === 'golpe') {
    if (!Number.isInteger(e.i) || e.i < 0 || e.i >= ativoDe(l).golpes.length) return 'Escolha inválida.';
  } else if (e.tipo === 'trocar') {
    if (!Number.isInteger(e.i) || e.i < 0 || e.i >= l.equipe.length || e.i === l.ativo || l.equipe[e.i].pv <= 0) return 'Escolha inválida.';
  } else if (e.tipo !== 'cha' && e.tipo !== 'nada') return 'Escolha inválida.';
  return null;
}

/**
 * Um turno. `escolhas[l]` null: o lado não age (só quando ele precisa trocar e o outro não). Devolve o que aconteceu, na ordem.
 * Quem chama confere as escolhas antes (conferirEscolha).
 */
export function turno(b: Batalha, escolhas: [Escolha | null, Escolha | null], aleatorio: () => number): EventoDaLuta[] {
  const eventos: EventoDaLuta[] = [];
  const ordem = [0, 1].filter((l) => escolhas[l] !== null);
  const prioridade = (l: number) => (escolhas[l]!.tipo === 'golpe' ? 0 : 1);
  const desempate = aleatorio() < 0.5 ? 0 : 1;
  ordem.sort((x, y) => prioridade(y) - prioridade(x) || ativoDe(b.lados[y]).vel - ativoDe(b.lados[x]).vel || (x === desempate ? -1 : 1));

  for (const l of ordem) {
    if (b.vencedor !== null) break;
    const meu = b.lados[l];
    const outro = b.lados[1 - l];
    const e = escolhas[l]!;
    if (e.tipo === 'trocar') {
      meu.ativo = e.i;
      meu.precisaTrocar = false;
      eventos.push({ t: 'troca', lado: l, especie: ativoDe(meu).especie, i: e.i });
      continue;
    }
    const eu = ativoDe(meu);
    if (eu.pv <= 0 || meu.precisaTrocar) continue; // dormiu antes da vez dele
    if (e.tipo === 'cha') {
      eu.pv = Math.min(eu.pvMax, eu.pv + CURA_DO_CHA);
      eventos.push({ t: 'cha', lado: l, especie: eu.especie, pv: eu.pv });
      continue;
    }
    if (e.tipo !== 'golpe') continue;
    const alvo = ativoDe(outro);
    if (alvo.pv <= 0) continue;
    const golpe = eu.golpes[e.i];
    const d = dano(eu, alvo, golpe, aleatorio());
    alvo.pv = Math.max(0, alvo.pv - d);
    eventos.push({
      t: 'golpe', lado: l, especie: eu.especie, golpe, alvo: alvo.especie, dano: d, pv: alvo.pv,
      efic: eficacia(GOLPES[golpe].elemento, ESPECIES[alvo.especie].elemento),
    });
    if (alvo.pv === 0) {
      eventos.push({ t: 'sono', lado: 1 - l, especie: alvo.especie });
      if (acordados(outro) === 0) b.vencedor = l as 0 | 1;
      else outro.precisaTrocar = true;
    }
  }
  return eventos;
}

/**
 * A escolha do COMPUTADOR (o bicho do mato, a Nena, quem demorou na sala, os robôs do teste): troca se precisa (pelo melhor
 * contra o da frente), senão o golpe que mais tira, com um pouco de sorte para não ser sempre igual. `esperto` false: o bicho do
 * mato, que escolhe qualquer golpe.
 */
export function escolhaDoRobo(b: Batalha, lado: number, aleatorio: () => number, esperto = true): Escolha {
  const meu = b.lados[lado];
  const outro = ativoDe(b.lados[1 - lado]);
  const valor = (bicho: Lutador, g: string) => GOLPES[g].poder * eficacia(GOLPES[g].elemento, ESPECIES[outro.especie].elemento) * (GOLPES[g].elemento === ESPECIES[bicho.especie].elemento ? 1.25 : 1);
  if (meu.precisaTrocar) {
    let melhor = -1;
    let nota = -1;
    meu.equipe.forEach((bicho, i) => {
      if (bicho.pv <= 0 || i === meu.ativo) return;
      const n = Math.max(...bicho.golpes.map((g) => valor(bicho, g))) + aleatorio();
      if (n > nota) [melhor, nota] = [i, n];
    });
    return { tipo: 'trocar', i: melhor };
  }
  const eu = ativoDe(meu);
  if (!esperto || aleatorio() < 0.15) return { tipo: 'golpe', i: Math.floor(aleatorio() * eu.golpes.length) };
  let melhor = 0;
  eu.golpes.forEach((g, i) => {
    if (valor(eu, g) > valor(eu, eu.golpes[melhor])) melhor = i;
  });
  return { tipo: 'golpe', i: melhor };
}

/** O lado como a tela o vê. `golpes`: só para quem é dono (o outro vê os bichos e a vida). */
export function vistaDoLado(l: Lado, comGolpes: boolean) {
  return {
    ativo: l.ativo,
    precisaTrocar: l.precisaTrocar,
    equipe: l.equipe.map((b) => ({ especie: b.especie, nivel: b.nivel, pv: b.pv, pvMax: b.pvMax, ...(comGolpes ? { golpes: b.golpes } : {}) })),
  };
}
