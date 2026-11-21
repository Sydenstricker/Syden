import { atributos, dano, ESPECIES, eficacia, GOLPES, golpesDe, curaDoCha, multDoDegrau } from './bichos-regras.js';

/**
 * A LUTA DOS BICHOS DA TOCA (16/11/2026): por turnos, dois lados, um bicho na frente de cada um. Serve à aventura do Solo (contra o
 * bicho do mato, as pessoas do caminho e as desafiantes) e à luta entre duas pessoas da sala. Quem decide é o servidor: a ordem, o
 * dano e a sorte. O site só escolhe o que fazer.
 *
 * Cada turno, cada lado faz UMA coisa: um golpe, trocar o bicho da frente, dar chá ou erva-doce a ele, ou nada (a cenoura recusada, a fuga
 * que não deu). Trocar, o chá e o nada vão primeiro; depois os golpes que vão primeiro (prioridade); os outros, pela velocidade
 * (empate, sorteio). Quem pega no sono antes da vez dele não age. O lado cujo bicho dormiu escolhe outro antes do turno seguinte
 * (`precisaTrocar`); sem nenhum acordado, perde. Ninguém se machuca: o bicho cansado "pega no sono".
 *
 * OS EFEITOS (19/11/2026, ver GOLPES em bichos-regras.ts): o golpe pode errar (precisão), o bicho pode cochilar (não golpeia uma
 * ou duas vezes), sentir o veneno (perde 1/12 da vida no fim de cada turno inteiro), ter o ataque ou a defesa um degrau acima ou
 * abaixo, ou se curar. Tudo isso vale só na luta: a aventura guarda só a vida. A sorte só é tirada quando o golpe tem algo
 * sorteado, para os golpes de antes darem a mesma sequência de sempre.
 */

export type EstadoDoBicho = 'cochilo' | 'veneno' | null;

export interface Lutador {
  especie: string;
  nivel: number;
  pv: number;
  pvMax: number;
  atq: number;
  def: number;
  vel: number;
  golpes: string[];
  /** Os degraus de ataque e defesa (−3 a +3). */
  degraus: { atq: number; def: number };
  estado: EstadoDoBicho;
  /** Quantas vezes ainda cochila. */
  cochilo: number;
}

export interface Lado {
  equipe: Lutador[];
  ativo: number;
  precisaTrocar: boolean;
}

/** O chá (`forte`: o chá forte) e a erva-doce (tira o cochilo e o veneno) são da aventura; na sala só há golpe e troca. */
export type Escolha = { tipo: 'golpe'; i: number } | { tipo: 'trocar'; i: number } | { tipo: 'cha'; forte?: boolean } | { tipo: 'erva' } | { tipo: 'nada' };

/** O que um efeito fez: o nome curto que a tela conta (com o ícone). */
export type QualEfeito = 'cochilou' | 'cochilando' | 'acordou' | 'veneno' | 'envenenou' | 'atq+' | 'atq-' | 'def+' | 'def-' | 'cura' | 'falhou';

export type EventoDaLuta =
  | { t: 'golpe'; lado: number; especie: string; golpe: string; efic: number; dano: number; pv: number; alvo: string; apoio?: boolean }
  | { t: 'errou'; lado: number; especie: string; golpe: string }
  | { t: 'efeito'; lado: number; especie: string; efeito: QualEfeito; pv?: number; dano?: number }
  | { t: 'sono'; lado: number; especie: string }
  | { t: 'troca'; lado: number; especie: string; i: number }
  | { t: 'cha'; lado: number; especie: string; pv: number; forte?: boolean }
  | { t: 'erva'; lado: number; especie: string };

export interface Batalha {
  lados: [Lado, Lado];
  /** Quem venceu (o lado), ou null enquanto dura. */
  vencedor: 0 | 1 | null;
}

export function lutador(especie: string, nivel: number, pv?: number): Lutador {
  const a = atributos(especie, nivel);
  return {
    especie,
    nivel,
    ...a,
    pv: Math.max(0, Math.min(a.pvMax, pv ?? a.pvMax)),
    golpes: golpesDe(especie, nivel),
    degraus: { atq: 0, def: 0 },
    estado: null,
    cochilo: 0,
  };
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
  } else if (e.tipo !== 'cha' && e.tipo !== 'erva' && e.tipo !== 'nada') return 'Escolha inválida.';
  return null;
}

/** O bicho do lado `l` pegou no sono: a luta acaba, ou o lado precisa trocar. */
function dormiu(b: Batalha, l: number, eventos: EventoDaLuta[]) {
  const lado = b.lados[l];
  const x = ativoDe(lado);
  eventos.push({ t: 'sono', lado: l, especie: x.especie });
  if (acordados(lado) === 0) {
    if (b.vencedor === null) b.vencedor = (1 - l) as 0 | 1;
  } else lado.precisaTrocar = true;
}

/** O efeito de um golpe em quem o recebe. */
function aplicarEfeito(golpe: string, quem: Lutador, ladoDeQuem: number, eventos: EventoDaLuta[], aleatorio: () => number) {
  const ef = GOLPES[golpe].efeito;
  if (!ef) return;
  if (ef.chance !== undefined && ef.chance < 1 && aleatorio() >= ef.chance) return;
  const conta = (efeito: QualEfeito, extra: { pv?: number } = {}) => eventos.push({ t: 'efeito', lado: ladoDeQuem, especie: quem.especie, efeito, ...extra });
  if (ef.tipo === 'cochilo' || ef.tipo === 'veneno') {
    if (quem.estado) return conta('falhou');
    quem.estado = ef.tipo;
    if (ef.tipo === 'cochilo') {
      quem.cochilo = 1 + (aleatorio() < 0.5 ? 1 : 0);
      return conta('cochilou');
    }
    return conta('envenenou');
  }
  if (ef.tipo === 'atq' || ef.tipo === 'def') {
    const valor = ef.valor ?? 1;
    const antes = quem.degraus[ef.tipo];
    const depois = Math.max(-3, Math.min(3, antes + valor));
    if (depois === antes) return conta('falhou');
    quem.degraus[ef.tipo] = depois;
    return conta(`${ef.tipo}${valor > 0 ? '+' : '-'}` as QualEfeito);
  }
  // a cura
  if (quem.pv >= quem.pvMax) return conta('falhou');
  quem.pv = Math.min(quem.pvMax, quem.pv + Math.max(1, Math.floor(quem.pvMax * (ef.valor ?? 0.5))));
  conta('cura', { pv: quem.pv });
}

/**
 * Um turno. `escolhas[l]` null: o lado não age (só quando ele precisa trocar e o outro não). Devolve o que aconteceu, na ordem.
 * Quem chama confere as escolhas antes (conferirEscolha).
 */
export function turno(b: Batalha, escolhas: [Escolha | null, Escolha | null], aleatorio: () => number): EventoDaLuta[] {
  const eventos: EventoDaLuta[] = [];
  const ordem = [0, 1].filter((l) => escolhas[l] !== null);
  const prioridade = (l: number) => {
    const e = escolhas[l]!;
    if (e.tipo !== 'golpe') return 9;
    return GOLPES[ativoDe(b.lados[l]).golpes[e.i]]?.prioridade ?? 0;
  };
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
      eu.pv = Math.min(eu.pvMax, eu.pv + curaDoCha(eu.pvMax, !!e.forte));
      eventos.push({ t: 'cha', lado: l, especie: eu.especie, pv: eu.pv, ...(e.forte ? { forte: true } : {}) });
      continue;
    }
    if (e.tipo === 'erva') {
      eu.estado = null;
      eu.cochilo = 0;
      eventos.push({ t: 'erva', lado: l, especie: eu.especie });
      continue;
    }
    if (e.tipo !== 'golpe') continue;
    if (eu.estado === 'cochilo') {
      eu.cochilo -= 1;
      eventos.push({ t: 'efeito', lado: l, especie: eu.especie, efeito: 'cochilando' });
      if (eu.cochilo <= 0) {
        eu.estado = null;
        eu.cochilo = 0;
        eventos.push({ t: 'efeito', lado: l, especie: eu.especie, efeito: 'acordou' });
      }
      continue;
    }
    const alvo = ativoDe(outro);
    if (alvo.pv <= 0) continue;
    const golpe = eu.golpes[e.i];
    const g = GOLPES[golpe];
    if (g.precisao !== undefined && g.precisao < 1 && aleatorio() >= g.precisao) {
      eventos.push({ t: 'errou', lado: l, especie: eu.especie, golpe });
      continue;
    }
    if (g.poder > 0) {
      const atacante = { ...eu, atq: eu.atq * multDoDegrau(eu.degraus.atq) };
      const defensor = { ...alvo, def: alvo.def * multDoDegrau(alvo.degraus.def) };
      const d = dano(atacante, defensor, golpe, aleatorio());
      alvo.pv = Math.max(0, alvo.pv - d);
      eventos.push({
        t: 'golpe', lado: l, especie: eu.especie, golpe, alvo: alvo.especie, dano: d, pv: alvo.pv,
        efic: eficacia(g.elemento, ESPECIES[alvo.especie].elemento),
      });
    } else {
      eventos.push({ t: 'golpe', lado: l, especie: eu.especie, golpe, alvo: alvo.especie, dano: 0, pv: alvo.pv, efic: 1, apoio: true });
    }
    if (g.efeito) {
      if (g.efeito.em === 'eu') aplicarEfeito(golpe, eu, l, eventos, aleatorio);
      else if (alvo.pv > 0) aplicarEfeito(golpe, alvo, 1 - l, eventos, aleatorio);
    }
    if (alvo.pv === 0) dormiu(b, 1 - l, eventos);
  }

  // o veneno, no fim de um turno inteiro (os dois lados escolheram)
  if (escolhas[0] && escolhas[1]) {
    for (const l of [0, 1]) {
      if (b.vencedor !== null) break;
      const lado = b.lados[l];
      const x = ativoDe(lado);
      if (x.estado !== 'veneno' || x.pv <= 0 || lado.precisaTrocar) continue;
      const d = Math.max(1, Math.floor(x.pvMax / 12));
      x.pv = Math.max(0, x.pv - d);
      eventos.push({ t: 'efeito', lado: l, especie: x.especie, efeito: 'veneno', dano: d, pv: x.pv });
      if (x.pv === 0) dormiu(b, l, eventos);
    }
  }
  return eventos;
}

/** O golpe de apoio faz algo agora? (Não cura quem está cheio, não põe estado em quem já tem, não passa do degrau.) */
function apoioServe(golpe: string, eu: Lutador, outro: Lutador): boolean {
  const ef = GOLPES[golpe].efeito;
  if (!ef) return false;
  const quem = ef.em === 'eu' ? eu : outro;
  if (ef.tipo === 'cura') return eu.pv < eu.pvMax * 0.4;
  if (ef.tipo === 'cochilo' || ef.tipo === 'veneno') return !quem.estado;
  const v = ef.valor ?? 1;
  return v > 0 ? quem.degraus[ef.tipo] < 2 : quem.degraus[ef.tipo] > -2;
}

/**
 * A escolha do COMPUTADOR (o bicho do mato, as pessoas do caminho, as desafiantes, quem demorou na sala, os robôs do teste): troca
 * se precisa (pelo melhor contra o da frente), senão o golpe que mais tira, com um pouco de sorte para não ser sempre igual, e de
 * vez em quando um golpe de apoio que sirva. `esperto` false: o bicho do mato, que escolhe qualquer golpe.
 */
export function escolhaDoRobo(b: Batalha, lado: number, aleatorio: () => number, esperto = true): Escolha {
  const meu = b.lados[lado];
  const outro = ativoDe(b.lados[1 - lado]);
  const valor = (bicho: Lutador, g: string) =>
    GOLPES[g].poder * (GOLPES[g].precisao ?? 1) * eficacia(GOLPES[g].elemento, ESPECIES[outro.especie].elemento) * (GOLPES[g].elemento === ESPECIES[bicho.especie].elemento ? 1.25 : 1);
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
  // o apoio: só quem sabe algum (a sorte só é tirada aí, para os de antes jogarem igual)
  const apoios = eu.golpes.map((g, i) => [g, i] as const).filter(([g]) => GOLPES[g].poder === 0 && apoioServe(g, eu, outro));
  if (apoios.length) {
    const cura = apoios.find(([g]) => GOLPES[g].efeito?.tipo === 'cura');
    if (cura && aleatorio() < 0.6) return { tipo: 'golpe', i: cura[1] };
    const resto = apoios.filter(([g]) => GOLPES[g].efeito?.tipo !== 'cura');
    if (resto.length && aleatorio() < 0.25) return { tipo: 'golpe', i: resto[Math.floor(aleatorio() * resto.length)][1] };
  }
  let melhor = 0;
  eu.golpes.forEach((g, i) => {
    if (valor(eu, g) > valor(eu, eu.golpes[melhor])) melhor = i;
  });
  return { tipo: 'golpe', i: melhor };
}

/** O lado como a tela o vê. `golpes`: só para quem é dono (o outro vê os bichos, a vida e os efeitos). */
export function vistaDoLado(l: Lado, comGolpes: boolean) {
  return {
    ativo: l.ativo,
    precisaTrocar: l.precisaTrocar,
    equipe: l.equipe.map((b) => ({
      especie: b.especie,
      nivel: b.nivel,
      pv: b.pv,
      pvMax: b.pvMax,
      ...(b.estado ? { estado: b.estado } : {}),
      ...(b.degraus.atq ? { atqD: b.degraus.atq } : {}),
      ...(b.degraus.def ? { defD: b.degraus.def } : {}),
      ...(comGolpes ? { golpes: b.golpes } : {}),
    })),
  };
}
