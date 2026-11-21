import * as db from './db.js';
import {
  acordados,
  ativoDe,
  conferirEscolha,
  escolhaDoRobo,
  lutador,
  novaBatalha,
  turno,
  vistaDoLado,
  type Batalha,
  type Escolha,
  type EventoDaLuta,
  type Lutador,
} from './bichos-batalha.js';
import type { ItemDaLoja } from './bichos-regras.js';
import {
  andavelNo,
  atributos,
  CASA,
  LIGA,
  MOEDAS_DA_LIGA,
  casaNo,
  CESTA,
  chanceDeAmizade,
  CHANCE_NO_MATO,
  DESAFIANTES,
  DIRECOES,
  EQUIPE_DA_REVANCHE,
  EQUIPE_EMPRESTADA,
  ESPECIES,
  formaCrescida,
  GOLPES,
  golpesDe,
  golpesNovos,
  INICIAIS,
  INICIAL_RARO,
  LOJA_ABRE,
  mapaDe,
  MAPAS,
  MOEDAS_DA_REVANCHE,
  NIVEL_DA_SALA,
  NIVEL_DO_PRESENTE,
  NIVEL_INICIAL,
  NIVEL_MAXIMO,
  nivelDaXp,
  passoNoMapa,
  PRECOS,
  PRESENTES_DA_REVANCHE,
  quemVe,
  RARO,
  TAMANHO_DA_EQUIPE,
  xpDoNivel,
  xpGanha,
} from './bichos-regras.js';
import type { Contexto, Definicao, Jogo } from './minijogo-motor.js';

/**
 * BICHOS DA TOCA (16/11/2026, pedido dele): o gênero de juntar bichos e lutar por turnos, SÓ A MECÂNICA (ver bichos-regras.ts).
 *
 * NO SOLO, A AVENTURA: o campo de cima (e, desde 19/11/2026, o Bosque e a Serra, passando pela borda), o primeiro bicho escolhido
 * entre três, o mato onde os bichos aparecem, a luta para cansá-los e a cenoura para a amizade, a equipe de até seis (o resto vai
 * morar na toca), o nível e a evolução, o chá, as casas onde se descansa, as pessoas do caminho, a escada de quatro desafiantes
 * (a Nena é a primeira), os achados no chão, a lojinha (moedas do jogo, ganhas nas lutas: nunca dinheiro), o caderno (os bichos
 * vistos e os amigos feitos) e, depois da escada, a revanche da Nena e o bicho raro da Serra. Cada passo vai ao servidor, que
 * confere o mapa e sorteia o mato; a luta é dele inteira (bichos-batalha.ts). A aventura é da PESSOA e mora no servidor
 * (bichos_aventuras, db.ts): gravada a cada luta e escolha, a cada 10 passos e quando a partida sai da memória. A aventura
 * guardada antes de 19/11/2026 continua valendo: o que falta nela ganha o valor de começo ao ser lida (lerAventura).
 *
 * NA SALA, A LUTA ENTRE DUAS PESSOAS, na mesa (quem começa senta, o primeiro que apertar "Sentar" luta do outro lado, a sala
 * assiste): cada um com a equipe guardada, com a vida cheia e TODOS NO NÍVEL DA SALA (NIVEL_DA_SALA: o troféu não depende de
 * quanto se jogou no Solo); quem não tem bicho nenhum luta com a EQUIPE_EMPRESTADA. Os dois escolhem ao mesmo tempo, e o turno sai
 * quando os dois escolheram (ou quando o prazo acaba: quem demorou joga pelo computador). O vencedor vai à estante de troféus
 * (pista 'bichos'). A luta da sala não mexe na aventura de ninguém: nem vida, nem experiência.
 *
 * 20/11/2026 (lote C da segunda auditoria): A TOCA tem saída (na porta de casa: levar, guardar, trocar e soltar); a EXPERIÊNCIA
 * se reparte (quem entrou na luta divide, e quem ficou na equipe sem lutar leva uma parte pequena); o GOLPE NOVO com 4 sabidos
 * espera a pessoa escolher qual esquecer (`aprender`, e os golpes de cada bicho guardados nele); o chá cura uma parte da vida, a
 * lojinha tem escada (a erva-doce, o chá forte, a cenoura dourada); o mato do Bosque e da Serra é esperto; o caderno fecha (os do
 * começo raros na Serra depois da escada, e o presente da revanche). NA SALA, cada um leva até 3 bichos, escolhidos na largada
 * (MONTAGEM_MS), todos crescidos e no nível da sala, e cada escolha tem 30 s.
 */

export interface BichoGuardado {
  id: number;
  especie: string;
  nivel: number;
  xp: number;
  pv: number;
  /** Os golpes que ele sabe (até 4), escolhidos ao aprender (20/11/2026; sem eles, os últimos 4 aprendidos). */
  golpes: string[];
}

export interface Aventura {
  v: 1;
  /** A tela do mapa (19/11/2026; a de antes era só o campo). */
  mapa: string;
  x: number;
  y: number;
  equipe: BichoGuardado[];
  toca: BichoGuardado[];
  cenouras: number;
  chas: number;
  /** Quantas vezes venceu a Nena. */
  desafios: number;
  proximoId: number;
  /** As moedas do jogo, ganhas nas lutas e gastas na lojinha. */
  moedas: number;
  /** O CADERNO DA TOCA: as espécies vistas e as que já foram amigas. */
  vistos: string[];
  pegos: string[];
  /** Os degraus da escada já vencidos (os índices de DESAFIANTES). */
  escada: number[];
  /** Quantas revanches da Nena venceu. */
  revanches: number;
  /** Quantas vezes venceu a Liga da Toca inteira (21/11/2026). */
  ligas: number;
  /** As pessoas do caminho já vencidas, e os achados já pegos (os ids). */
  vencidos: string[];
  achados: string[];
  /** Para onde se volta quando todos pegam no sono: a última casa onde descansou. */
  volta: { mapa: string; x: number; y: number };
  /** Os itens da lojinha com escada (20/11/2026). */
  chasFortes: number;
  ervas: number;
  douradas: number;
  /** Os golpes que esperam a pessoa escolher qual esquecer (o bicho, pelo id, e o golpe novo), na ordem. */
  aprender: { id: number; golpe: string }[];
}

const textos = (l: unknown): string[] => (Array.isArray(l) ? [...new Set(l.filter((x): x is string => typeof x === 'string'))] : []);

/**
 * O que veio do banco, conferido: o JSON é escrito só pelo servidor, mas uma versão antiga ou um defeito não derrubam o jogo. A
 * aventura de antes de 19/11/2026 (sem mapa, moedas, caderno, escada…) recebe os valores de começo, e o caderno começa com os
 * bichos que ela já tem.
 */
export function lerAventura(dados: unknown): Aventura | null {
  const a = dados as Partial<Aventura> | null;
  if (!a || typeof a !== 'object' || a.v !== 1) return null;
  const bicho = (b: Partial<BichoGuardado>): BichoGuardado | null => {
    if (!b || typeof b.especie !== 'string' || !ESPECIES[b.especie]) return null;
    const nivel = Math.min(NIVEL_MAXIMO, Math.max(1, Math.floor(Number(b.nivel) || 1)));
    const pvMax = atributos(b.especie, nivel).pvMax;
    // os golpes escolhidos (a aventura de antes de 20/11/2026 não os tem: os últimos 4 aprendidos)
    const golpes = textos(b.golpes).filter((g) => GOLPES[g]).slice(0, 4);
    return {
      id: Math.floor(Number(b.id) || 0), especie: b.especie, nivel, xp: Math.max(xpDoNivel(nivel), Math.floor(Number(b.xp) || 0)),
      pv: Math.min(pvMax, Math.max(0, Math.floor(Number(b.pv) || 0))), golpes: golpes.length ? golpes : golpesDe(b.especie, nivel),
    };
  };
  const lista = (l: unknown) => (Array.isArray(l) ? l.map(bicho).filter((b): b is BichoGuardado => b !== null) : []);
  const equipe = lista(a.equipe).slice(0, TAMANHO_DA_EQUIPE);
  if (!equipe.length) return null;
  const toca = lista(a.toca);
  const mapa = typeof a.mapa === 'string' && MAPAS[a.mapa] ? a.mapa : 'campo';
  const x = Math.floor(Number(a.x));
  const y = Math.floor(Number(a.y));
  const noLugar = andavelNo(mapa, x, y);
  const meus = [...equipe, ...toca].map((b) => b.especie);
  const pegos = textos(a.pegos).filter((e) => ESPECIES[e]);
  const vistos = textos(a.vistos).filter((e) => ESPECIES[e]);
  const v = a.volta as Partial<Aventura['volta']> | undefined;
  const volta = v && typeof v.mapa === 'string' && MAPAS[v.mapa] && andavelNo(v.mapa, Number(v.x), Number(v.y)) ? { mapa: v.mapa, x: Number(v.x), y: Number(v.y) } : { mapa: 'campo', ...CASA };
  const desafios = Math.max(0, Math.floor(Number(a.desafios) || 0));
  const escada = (Array.isArray(a.escada) ? a.escada : []).filter((k): k is number => Number.isInteger(k) && k >= 0 && k < DESAFIANTES.length);
  // quem venceu a Nena antes da escada existir já tem o primeiro degrau
  if (desafios > 0 && !escada.includes(0)) escada.push(0);
  const conta = (n: unknown) => Math.max(0, Math.floor(Number(n) || 0));
  // o golpe que espera: de um bicho que existe, que ainda não o sabe, uma vez só
  const porId = new Map([...equipe, ...toca].map((b) => [b.id, b]));
  const aprender: Aventura['aprender'] = [];
  for (const p of Array.isArray(a.aprender) ? a.aprender : []) {
    const b = porId.get(Number(p?.id));
    if (b && typeof p.golpe === 'string' && GOLPES[p.golpe] && !b.golpes.includes(p.golpe) && !aprender.some((q) => q.id === b.id && q.golpe === p.golpe)) {
      aprender.push({ id: b.id, golpe: p.golpe });
    }
  }
  return {
    v: 1,
    mapa: noLugar ? mapa : 'campo',
    x: noLugar ? x : CASA.x,
    y: noLugar ? y : CASA.y,
    equipe,
    toca,
    cenouras: Math.max(0, Math.floor(Number(a.cenouras) || 0)),
    chas: Math.max(0, Math.floor(Number(a.chas) || 0)),
    desafios,
    proximoId: Math.max(1, Math.floor(Number(a.proximoId) || 1), ...[...equipe, ...toca].map((b) => b.id + 1)),
    moedas: Math.max(0, Math.floor(Number(a.moedas) || 0)),
    vistos: [...new Set([...vistos, ...meus])],
    pegos: [...new Set([...pegos, ...meus])],
    escada: [...new Set(escada)].sort((p, q) => p - q),
    revanches: Math.max(0, Math.floor(Number(a.revanches) || 0)),
    ligas: conta(a.ligas),
    vencidos: textos(a.vencidos),
    achados: textos(a.achados),
    volta,
    chasFortes: conta(a.chasFortes),
    ervas: conta(a.ervas),
    douradas: conta(a.douradas),
    aprender,
  };
}

/** O bicho guardado como a tela o vê: com a vida, os golpes e quanto falta para o próximo nível. */
function vistaDoBicho(b: BichoGuardado) {
  const a = atributos(b.especie, b.nivel);
  return {
    id: b.id,
    especie: b.especie,
    nivel: b.nivel,
    pv: b.pv,
    pvMax: a.pvMax,
    golpes: b.golpes,
    xpDoNivel: b.xp - xpDoNivel(b.nivel),
    xpParaSubir: b.nivel >= NIVEL_MAXIMO ? 0 : xpDoNivel(b.nivel + 1) - xpDoNivel(b.nivel),
  };
}

/** O que acontece fora da luta, para a tela contar. */
export type EventoDaAventura =
  | EventoDaLuta
  | { t: 'apareceu'; especie: string }
  | { t: 'desafio'; nome: string }
  | { t: 'amigo'; especie: string }
  | { t: 'recusou'; especie: string }
  | { t: 'toca'; especie: string }
  | { t: 'nivel'; especie: string; n: number }
  | { t: 'evoluiu'; de: string; para: string }
  | { t: 'fugiu' }
  | { t: 'naoFugiu' }
  | { t: 'vitoria' }
  | { t: 'venceuDesafio' }
  | { t: 'derrota' }
  | { t: 'descansou' }
  | { t: 'moedas'; n: number }
  | { t: 'achou'; item: string; qtd: number }
  | { t: 'espera'; nome: string; antes: string }
  | { t: 'comprou'; item: string }
  | { t: 'raro'; especie: string }
  | { t: 'aprendeu'; especie: string; golpe: string }
  | { t: 'querAprender'; especie: string; golpe: string }
  | { t: 'esqueceu'; especie: string; antigo: string; golpe: string }
  | { t: 'presente'; nome: string; especie: string }
  /** A Liga da Toca (21/11/2026): a luta `n` de `total`, e a Liga inteira vencida. */
  | { t: 'liga'; n: number; total: number }
  | { t: 'campeao'; n: number }
  | { t: 'venceu'; userId: number };

/** A lista de eventos com número: a tela conta só os que ainda não contou. */
function diario() {
  let proximo = 1;
  const lista: ({ id: number } & EventoDaAventura)[] = [];
  return {
    lista,
    pôr(eventos: EventoDaAventura[]) {
      for (const e of eventos) lista.push({ id: proximo++, ...e });
      if (lista.length > 40) lista.splice(0, lista.length - 40);
    },
  };
}

/** Quanto a partida solo espera sem ninguém mexer antes de sair da memória (a aventura já está guardada). */
export const OCIOSO_MS = 30 * 60_000;
/** A luta da sala: o prazo de cada escolha (30 s desde 20/11/2026; eram 60), o da escolha da equipe, e quanto a mesa espera alguém sentar. */
export const ESCOLHA_MS = 30_000;
export const MONTAGEM_MS = 30_000;
export const ESPERANDO_MS = 3 * 60_000;
/** Quantos bichos cada lado leva à mesa da sala (20/11/2026). */
export const BICHOS_NA_MESA = 3;
/** A experiência de quem ficou na equipe sem entrar na luta: esta parte do que o bicho deu (20/11/2026). */
export const PARTE_DE_QUEM_NAO_LUTOU = 0.2;
/** A fuga do bicho do mato. */
export const CHANCE_DE_FUGIR = 0.75;
/** As moedas de vencer um bicho do mato: vezes o nível dele. */
export const MOEDAS_POR_NIVEL = 3;

type TipoDeLuta = 'mato' | 'desafio' | 'pessoa';

// ---------------------------------------------------------------- O SOLO
function aventuraSolo(ctx: Contexto, userId: number, aleatorio: () => number): Jogo {
  let av = lerAventura(db.aventuraDosBichos(userId));
  let fase: 'inicial' | 'mapa' | 'batalha' = av ? 'mapa' : 'inicial';
  const eventos = diario();
  let passosSemGuardar = 0;
  let luta: {
    b: Batalha;
    tipo: TipoDeLuta;
    acabou: null | 'vitoria' | 'derrota' | 'fugiu' | 'amigo';
    /** O degrau da escada (ou -1: a revanche), e a pessoa do caminho. */
    desafio?: number;
    /** A luta da Liga da Toca (o índice em LIGA): a próxima começa sem descanso. */
    liga?: number;
    pessoa?: string;
    moedas: number;
    /** O bicho do mato escolhe com esperteza (o Bosque e a Serra). */
    esperto: boolean;
    /** Os da equipe (índices) que entraram na luta contra o bicho da frente de lá: dividem a experiência dele. */
    participantes: Set<number>;
  } | null = null;
  const partidaId = `bichos-${userId}-${Date.now()}`;

  const guardar = () => {
    if (av) db.guardarAventuraDosBichos(userId, av);
    passosSemGuardar = 0;
  };
  const ocioso = () =>
    ctx.agendar(OCIOSO_MS, () => {
      guardar();
      ctx.terminar(false);
    });
  ocioso();

  const ver = (...especies: string[]) => {
    for (const e of especies) if (!av!.vistos.includes(e)) av!.vistos.push(e);
  };
  const pegar = (e: string) => {
    ver(e);
    if (!av!.pegos.includes(e)) av!.pegos.push(e);
  };

  const descansar = () => {
    for (const b of av!.equipe) b.pv = atributos(b.especie, b.nivel).pvMax;
    av!.cenouras = Math.max(av!.cenouras, CESTA.cenouras);
    av!.chas = Math.max(av!.chas, CESTA.chas);
  };

  const comecarLuta = (inimigos: Lutador[], tipo: TipoDeLuta, moedas: number, extra: { desafio?: number; pessoa?: string; liga?: number } = {}) => {
    const meus = av!.equipe.map((b) => ({ ...lutador(b.especie, b.nivel, b.pv), golpes: [...b.golpes] }));
    const b = novaBatalha(meus, inimigos);
    luta = { b, tipo, acabou: null, moedas, esperto: !!mapaDe(av!.mapa).esperto, participantes: new Set([b.lados[0].ativo]), ...extra };
    ver(...inimigos.map((i) => i.especie));
    fase = 'batalha';
  };

  /** A vida de cada um volta para a equipe guardada (o índice da luta é o da equipe). */
  const devolverVida = () => {
    luta!.b.lados[0].equipe.forEach((l, i) => {
      if (av!.equipe[i]) av!.equipe[i].pv = l.pv;
    });
  };

  /** Um bicho novo (o amigo do mato, o presente da revanche): na equipe se cabe, senão na toca. */
  const receber = (especie: string, nivel: number, pv?: number): EventoDaAventura[] => {
    const novo: BichoGuardado = {
      id: av!.proximoId++, especie, nivel, xp: xpDoNivel(nivel), pv: pv ?? atributos(especie, nivel).pvMax, golpes: golpesDe(especie, nivel),
    };
    pegar(especie);
    const cabe = av!.equipe.length < TAMANHO_DA_EQUIPE;
    (cabe ? av!.equipe : av!.toca).push(novo);
    return cabe ? [] : [{ t: 'toca', especie }];
  };

  /**
   * Os golpes que um bicho passou a poder aprender (subiu de nível, cresceu): com menos de 4 sabidos, aprende na hora; com 4, o
   * golpe espera a pessoa escolher qual esquecer, ou não aprender (`aprender`, ação 'esquecer').
   */
  const aprenderGolpes = (b: BichoGuardado, deEspecie: string, deNivel: number): EventoDaAventura[] => {
    const saida: EventoDaAventura[] = [];
    for (const g of golpesNovos(deEspecie, deNivel, b.especie, b.nivel)) {
      if (b.golpes.includes(g) || av!.aprender.some((p) => p.id === b.id && p.golpe === g)) continue;
      if (b.golpes.length < 4) {
        b.golpes.push(g);
        saida.push({ t: 'aprendeu', especie: b.especie, golpe: g });
      } else {
        av!.aprender.push({ id: b.id, golpe: g });
        saida.push({ t: 'querAprender', especie: b.especie, golpe: g });
      }
    }
    return saida;
  };

  /** Um bicho da equipe (o índice da luta é o da equipe) ganhou experiência: sobe de nível (e evolui) aqui e na luta. */
  const darXp = (i: number, xp: number): EventoDaAventura[] => {
    const lado = luta!.b.lados[0];
    const b = av!.equipe[i];
    const l = lado.equipe[i];
    const saida: EventoDaAventura[] = [];
    if (!b || !l || xp <= 0) return saida;
    b.xp += xp;
    const novo = nivelDaXp(b.xp);
    if (novo <= b.nivel) return saida;
    const antes = atributos(b.especie, b.nivel).pvMax;
    const [deEspecie, deNivel] = [b.especie, b.nivel];
    b.nivel = novo;
    saida.push({ t: 'nivel', especie: b.especie, n: novo });
    const evolui = ESPECIES[b.especie].evolui;
    if (evolui && novo >= evolui.nivel) {
      saida.push({ t: 'evoluiu', de: b.especie, para: evolui.para });
      b.especie = evolui.para;
      pegar(evolui.para);
    }
    saida.push(...aprenderGolpes(b, deEspecie, deNivel));
    const a = atributos(b.especie, b.nivel);
    // quem dormiu continua dormindo; quem está de pé ganha a vida que o nível deu
    b.pv = l.pv <= 0 ? 0 : Math.min(a.pvMax, l.pv + (a.pvMax - antes));
    // os degraus e o estado da luta continuam com ele, e os golpes são os dele
    const { degraus, estado, cochilo } = l;
    Object.assign(l, lutador(b.especie, b.nivel, b.pv), { degraus, estado, cochilo, golpes: [...b.golpes] });
    return saida;
  };

  /**
   * A EXPERIÊNCIA REPARTIDA (20/11/2026): quem entrou na luta contra aquele bicho e está acordado divide o que ele dá; quem ficou
   * na equipe sem lutar (acordado) leva PARTE_DE_QUEM_NAO_LUTOU. Antes, só o da frente ganhava.
   */
  const repartirXp = (xp: number): EventoDaAventura[] => {
    const lado = luta!.b.lados[0];
    const acordado = (i: number) => (lado.equipe[i]?.pv ?? 0) > 0;
    const lutaram = [...luta!.participantes].filter(acordado);
    const parte = lutaram.length ? Math.max(1, Math.ceil(xp / lutaram.length)) : 0;
    const saida: EventoDaAventura[] = [];
    lado.equipe.forEach((_, i) => {
      if (!acordado(i)) return;
      saida.push(...darXp(i, lutaram.includes(i) ? parte : Math.floor(xp * PARTE_DE_QUEM_NAO_LUTOU)));
    });
    return saida;
  };

  /** Depois de um turno: quem dormiu, o fim da luta, a troca forçada do lado de lá. */
  const depoisDoTurno = (doTurno: EventoDaLuta[]): EventoDaAventura[] => {
    const saida: EventoDaAventura[] = [...doTurno];
    const l = luta!;
    for (const e of doTurno) {
      if (e.t === 'troca' && e.lado === 0) l.participantes.add(e.i);
      if (e.t === 'sono' && e.lado === 1) {
        const inimigo = l.b.lados[1].equipe.find((x) => x.especie === e.especie && x.pv === 0)!;
        saida.push(...repartirXp(xpGanha(inimigo.especie, inimigo.nivel, l.tipo !== 'mato')));
        // o próximo bicho de lá começa a conta de novo, com quem está na frente agora
        l.participantes = new Set([l.b.lados[0].ativo]);
      }
    }
    if (l.b.vencedor === 0) {
      l.acabou = 'vitoria';
      if (l.tipo === 'desafio') {
        if (l.desafio === 0) {
          av!.desafios += 1;
          av!.cenouras += 5;
        }
        if (l.desafio === -1) {
          av!.revanches += 1;
          // o presente da revanche: o próximo bicho da Nena que a pessoa ainda não tem
          const presente = PRESENTES_DA_REVANCHE.find((e) => !av!.pegos.includes(e));
          if (presente) saida.push({ t: 'presente', nome: DESAFIANTES[0].nome, especie: presente }, ...receber(presente, NIVEL_DO_PRESENTE));
        } else if (l.desafio !== undefined && !av!.escada.includes(l.desafio)) av!.escada = [...av!.escada, l.desafio].sort((p, q) => p - q);
        saida.push({ t: 'venceuDesafio' });
        // a última luta da Liga: a Liga inteira vencida
        if (l.liga === LIGA.length - 1) {
          av!.ligas += 1;
          l.moedas += MOEDAS_DA_LIGA;
          saida.push({ t: 'campeao', n: av!.ligas });
        }
      } else {
        if (l.pessoa && !av!.vencidos.includes(l.pessoa)) av!.vencidos.push(l.pessoa);
        saida.push({ t: 'vitoria' });
      }
      if (l.moedas > 0) {
        av!.moedas += l.moedas;
        saida.push({ t: 'moedas', n: l.moedas });
      }
    } else if (l.b.vencedor === 1) {
      l.acabou = 'derrota';
      saida.push({ t: 'derrota' });
    } else if (l.b.lados[1].precisaTrocar) {
      // quem desafia manda o próximo na hora
      saida.push(...turno(l.b, [null, escolhaDoRobo(l.b, 1, aleatorio)], aleatorio));
    }
    devolverVida();
    return saida;
  };

  // o bicho do mato escolhe qualquer golpe; do Bosque em diante (`esperto`), como quem desafia
  const vezDoInimigo = (): Escolha => escolhaDoRobo(luta!.b, 1, aleatorio, luta!.tipo !== 'mato' || luta!.esperto);

  /** A escada inteira vencida: a porta da Nena dá a revanche, e o raro aparece na Serra. */
  const posJogo = () => DESAFIANTES.every((_, k) => av!.escada.includes(k));

  /** Uma luta da LIGA DA TOCA (21/11/2026): quem desafia, e o aviso de qual é na sequência. */
  const lutaDaLiga = (k: number) => {
    const d = LIGA[k];
    comecarLuta(d.equipe.map(([e, n]) => lutador(e, n)), 'desafio', d.moedas, { liga: k });
    eventos.pôr([{ t: 'liga', n: k + 1, total: LIGA.length }, { t: 'desafio', nome: d.nome }]);
    guardar();
  };

  function andar(dir: unknown): string | null {
    const destino = passoNoMapa(av!.mapa, av!.x, av!.y, String(dir));
    if (!DIRECOES[String(dir)]) return 'Direção inválida.';
    if (!destino) return null; // bateu na árvore: fica onde está, sem erro
    const { mapa, x, y } = destino;
    const casa = casaNo(mapa, x, y);
    const degrau = casa === 'c' ? mapaDe(mapa).portas[`${x},${y}`] : undefined;
    const naLiga = casa === 'c' && mapaDe(mapa).liga === `${x},${y}`;
    if (naLiga && !posJogo()) {
      // a Liga só abre com a escada inteira vencida
      eventos.pôr([{ t: 'espera', nome: LIGA[0].nome, antes: DESAFIANTES[DESAFIANTES.length - 1].nome }]);
      return null;
    }
    if (degrau !== undefined && degrau > 0 && !av!.escada.includes(degrau - 1)) {
      // a próxima casa da escada só abre com a de antes vencida
      eventos.pôr([{ t: 'espera', nome: DESAFIANTES[degrau].nome, antes: DESAFIANTES[degrau - 1].nome }]);
      return null;
    }
    av!.mapa = mapa;
    av!.x = x;
    av!.y = y;
    const achado = mapaDe(mapa).achados.find((a) => a.x === x && a.y === y && !av!.achados.includes(a.id));
    if (achado) {
      av!.achados.push(achado.id);
      if (achado.item === 'cenoura') av!.cenouras += achado.qtd;
      else if (achado.item === 'cha') av!.chas += achado.qtd;
      else av!.moedas += achado.qtd;
      eventos.pôr([{ t: 'achou', item: achado.item, qtd: achado.qtd }]);
    }
    const pessoa = quemVe(mapa, x, y);
    if (naLiga) {
      lutaDaLiga(0);
    } else if (casa === 'h') {
      descansar();
      av!.volta = { mapa, x, y };
      eventos.pôr([{ t: 'descansou' }]);
      guardar();
    } else if (degrau !== undefined) {
      const revanche = degrau === 0 && posJogo();
      const d = DESAFIANTES[degrau];
      const equipe = revanche ? EQUIPE_DA_REVANCHE : d.equipe;
      comecarLuta(equipe.map(([e, n]) => lutador(e, n)), 'desafio', revanche ? MOEDAS_DA_REVANCHE : d.moedas, { desafio: revanche ? -1 : degrau });
      eventos.pôr([{ t: 'desafio', nome: d.nome }]);
      guardar();
    } else if (pessoa && !av!.vencidos.includes(pessoa.id)) {
      comecarLuta(pessoa.equipe.map(([e, n]) => lutador(e, n)), 'pessoa', pessoa.moedas, { pessoa: pessoa.id });
      eventos.pôr([{ t: 'desafio', nome: pessoa.nome }]);
      guardar();
    } else if (mapaDe(mapa).matos[casa] && aleatorio() < CHANCE_NO_MATO) {
      const mato = mapaDe(mapa).matos[casa];
      let especie = mato.especies[Math.floor(aleatorio() * mato.especies.length)];
      let nivel = mato.de + Math.floor(aleatorio() * (mato.ate - mato.de + 1));
      let raro = mapa === RARO.mapa && posJogo() && aleatorio() < RARO.chance;
      if (raro) [especie, nivel] = [RARO.especie, RARO.nivel];
      else if (mapa === INICIAL_RARO.mapa && posJogo()) {
        // os do começo que a pessoa ainda não tem, raros na Serra (antes de crescer: no nível de antes da evolução)
        const faltam = INICIAIS.filter((e) => !av!.pegos.includes(e));
        if (faltam.length && aleatorio() < INICIAL_RARO.chance) {
          especie = faltam[Math.floor(aleatorio() * faltam.length)];
          nivel = Math.min(nivel, (ESPECIES[especie].evolui?.nivel ?? nivel + 1) - 1);
          raro = true;
        }
      }
      comecarLuta([lutador(especie, nivel)], 'mato', nivel * MOEDAS_POR_NIVEL);
      eventos.pôr([raro ? { t: 'raro', especie } : { t: 'apareceu', especie }]);
      guardar();
    } else if (achado || ++passosSemGuardar >= 10) guardar();
    return null;
  }

  function naLuta(corpo: Record<string, unknown>): string | null {
    const l = luta!;
    const tipo = corpo.tipo;
    if (tipo === 'continuar') {
      if (!l.acabou) return 'A luta ainda não acabou.';
      if (l.acabou === 'derrota') {
        descansar();
        av!.mapa = av!.volta.mapa;
        av!.x = av!.volta.x;
        av!.y = av!.volta.y;
      }
      luta = null;
      fase = 'mapa';
      // a Liga segue: a próxima luta começa já, com a vida que sobrou (sem descanso no meio)
      if (l.acabou === 'vitoria' && l.liga !== undefined && l.liga + 1 < LIGA.length) {
        lutaDaLiga(l.liga + 1);
        return null;
      }
      guardar();
      return null;
    }
    if (l.acabou) return 'A luta acabou.';
    const lado = l.b.lados[0];
    if (tipo === 'trocar') {
      const e: Escolha = { tipo: 'trocar', i: Number(corpo.i) };
      const erro = conferirEscolha(l.b, 0, e);
      if (erro) return erro;
      // a troca forçada (o da frente dormiu) não dá a vez ao outro lado
      const forcada = lado.precisaTrocar;
      eventos.pôr(depoisDoTurno(turno(l.b, [e, forcada ? null : vezDoInimigo()], aleatorio)));
    } else if (lado.precisaTrocar) {
      return 'Escolha outro bicho.';
    } else if (tipo === 'golpe') {
      const e: Escolha = { tipo: 'golpe', i: Number(corpo.i) };
      const erro = conferirEscolha(l.b, 0, e);
      if (erro) return erro;
      eventos.pôr(depoisDoTurno(turno(l.b, [e, vezDoInimigo()], aleatorio)));
    } else if (tipo === 'cha') {
      // o chá (uma parte da vida) ou o chá forte
      const forte = corpo.forte === true;
      if (forte ? av!.chasFortes <= 0 : av!.chas <= 0) return 'Acabou o chá.';
      if (forte) av!.chasFortes -= 1;
      else av!.chas -= 1;
      eventos.pôr(depoisDoTurno(turno(l.b, [{ tipo: 'cha', forte }, vezDoInimigo()], aleatorio)));
    } else if (tipo === 'erva') {
      // a erva-doce: tira o cochilo e o veneno do bicho da frente
      if (av!.ervas <= 0 || !ativoDe(lado).estado) return 'Ação inválida.';
      av!.ervas -= 1;
      eventos.pôr(depoisDoTurno(turno(l.b, [{ tipo: 'erva' }, vezDoInimigo()], aleatorio)));
    } else if (tipo === 'cenoura') {
      if (l.tipo !== 'mato') return 'Só os bichos do mato fazem amizade.';
      const dourada = corpo.dourada === true;
      if (dourada ? av!.douradas <= 0 : av!.cenouras <= 0) return 'Acabaram as cenouras.';
      if (dourada) av!.douradas -= 1;
      else av!.cenouras -= 1;
      const alvo = ativoDe(l.b.lados[1]);
      if (aleatorio() < chanceDeAmizade(alvo.especie, alvo.pv, alvo.pvMax, dourada)) {
        l.acabou = 'amigo';
        devolverVida();
        eventos.pôr([{ t: 'amigo', especie: alvo.especie }, ...receber(alvo.especie, alvo.nivel, alvo.pv)]);
      } else {
        eventos.pôr([{ t: 'recusou', especie: alvo.especie }, ...depoisDoTurno(turno(l.b, [{ tipo: 'nada' }, vezDoInimigo()], aleatorio))]);
      }
    } else if (tipo === 'fugir') {
      if (l.tipo !== 'mato') return 'Do desafio não se foge.';
      if (aleatorio() < CHANCE_DE_FUGIR) {
        l.acabou = 'fugiu';
        devolverVida();
        eventos.pôr([{ t: 'fugiu' }]);
      } else {
        eventos.pôr([{ t: 'naoFugiu' }, ...depoisDoTurno(turno(l.b, [{ tipo: 'nada' }, vezDoInimigo()], aleatorio))]);
      }
    } else return 'Ação inválida.';
    if (l.acabou) guardar();
    return null;
  }

  const naLoja = () => !!av && casaNo(av.mapa, av.x, av.y) === 'l';
  const naCasa = () => !!av && fase === 'mapa' && casaNo(av.mapa, av.x, av.y) === 'h';
  const doId = (id: unknown) => [...(av?.equipe ?? []), ...(av?.toca ?? [])].find((b) => b.id === Number(id)) ?? null;
  const aprendendo = () => {
    const p = av?.aprender[0];
    const b = p && doId(p.id);
    return p && b ? { id: b.id, especie: b.especie, golpe: p.golpe, golpes: b.golpes, fila: av!.aprender.length } : null;
  };

  /** Escolher o golpe que espera: `i` é o golpe a esquecer (0 a 3), ou -1 para não aprender. Vale também no meio da luta. */
  function esquecer(corpo: Record<string, unknown>): string | null {
    const p = av?.aprender[0];
    const b = p && doId(p.id);
    if (!p || !b) return 'Ação inválida.';
    const i = Number(corpo.i);
    if (!Number.isInteger(i) || i < -1 || i >= b.golpes.length) return 'Ação inválida.';
    av!.aprender.shift();
    if (i >= 0) {
      const antigo = b.golpes[i];
      b.golpes[i] = p.golpe;
      eventos.pôr([{ t: 'esqueceu', especie: b.especie, antigo, golpe: p.golpe }]);
      // na luta, o bicho da equipe já usa o golpe novo
      const k = av!.equipe.indexOf(b);
      const l = luta?.b.lados[0].equipe[k];
      if (k >= 0 && l) l.golpes = [...b.golpes];
    }
    guardar();
    return null;
  }

  /**
   * A TOCA (20/11/2026; antes, o 7º amigo ia para lá e não voltava): na porta de casa, levar um guardado para a equipe, guardar um
   * da equipe (fica ao menos um), trocar um pelo outro e soltar um guardado de volta ao mato. Quem sai da toca sai descansado.
   */
  function naToca(corpo: Record<string, unknown>): string | null {
    if (!naCasa()) return 'Ação inválida.';
    const a = av!;
    const daToca = a.toca.findIndex((b) => b.id === Number(corpo.id));
    const i = Number(corpo.i);
    const daEquipe = Number.isInteger(i) && i >= 0 && i < a.equipe.length ? i : -1;
    const descansado = (b: BichoGuardado) => ((b.pv = atributos(b.especie, b.nivel).pvMax), b);
    switch (corpo.acao) {
      case 'levar':
        if (daToca < 0 || a.equipe.length >= TAMANHO_DA_EQUIPE) return 'Ação inválida.';
        a.equipe.push(descansado(a.toca.splice(daToca, 1)[0]));
        break;
      case 'guardar':
        if (daEquipe < 0 || a.equipe.length <= 1) return 'Ação inválida.';
        a.toca.push(...a.equipe.splice(daEquipe, 1));
        break;
      case 'trocar': {
        if (daToca < 0 || daEquipe < 0) return 'Ação inválida.';
        const sai = a.equipe[daEquipe];
        a.equipe[daEquipe] = descansado(a.toca[daToca]);
        a.toca[daToca] = sai;
        break;
      }
      case 'soltar': {
        // só da toca: quem está na equipe passa pela toca antes (e a equipe nunca fica vazia)
        if (daToca < 0) return 'Ação inválida.';
        const [solto] = a.toca.splice(daToca, 1);
        a.aprender = a.aprender.filter((p) => p.id !== solto.id);
        break;
      }
      default:
        return 'Ação inválida.';
    }
    guardar();
    return null;
  }

  return {
    publico() {
      const l = luta;
      return {
        modo: 'solo',
        fase,
        // as cores do coelho de quem anda pelo campo
        avatar: db.avatarDoJogo(userId),
        partidaId,
        mapa: av?.mapa ?? 'campo',
        x: av?.x ?? CASA.x,
        y: av?.y ?? CASA.y,
        equipe: av?.equipe.map(vistaDoBicho) ?? [],
        toca: av?.toca.length ?? 0,
        // a toca por dentro (20/11/2026): os guardados, e se a pessoa está na porta de casa, onde se mexe nela
        guardados: av?.toca.map(vistaDoBicho) ?? [],
        naCasa: naCasa(),
        cenouras: av?.cenouras ?? 0,
        chas: av?.chas ?? 0,
        chasFortes: av?.chasFortes ?? 0,
        ervas: av?.ervas ?? 0,
        douradas: av?.douradas ?? 0,
        // o golpe que espera a escolha: o primeiro da fila
        aprender: aprendendo(),
        desafios: av?.desafios ?? 0,
        moedas: av?.moedas ?? 0,
        caderno: { vistos: av?.vistos ?? [], pegos: av?.pegos ?? [] },
        escada: av?.escada ?? [],
        vencidos: av?.vencidos ?? [],
        achados: av?.achados ?? [],
        loja: naLoja(),
        ligas: av?.ligas ?? 0,
        luta: l && {
          tipo: l.tipo,
          // a luta da Liga: qual é (1 a 4) e quantas são
          ...(l.liga !== undefined ? { liga: { n: l.liga + 1, total: LIGA.length } } : {}),
          acabou: l.acabou,
          meu: vistaDoLado(l.b.lados[0], true),
          outro: vistaDoLado(l.b.lados[1], false),
          chance: l.tipo === 'mato' ? chanceDeAmizade(ativoDe(l.b.lados[1]).especie, ativoDe(l.b.lados[1]).pv, ativoDe(l.b.lados[1]).pvMax) : 0,
          chanceDourada: l.tipo === 'mato' ? chanceDeAmizade(ativoDe(l.b.lados[1]).especie, ativoDe(l.b.lados[1]).pv, ativoDe(l.b.lados[1]).pvMax, true) : 0,
        },
        eventos: eventos.lista,
      };
    },
    acao(_quem, corpo) {
      ocioso();
      if (fase === 'inicial') {
        if (corpo.tipo !== 'inicial' || !INICIAIS.includes(corpo.especie as (typeof INICIAIS)[number])) return 'Escolha o primeiro bicho.';
        const especie = corpo.especie as string;
        av = lerAventura({
          v: 1, mapa: 'campo', x: CASA.x, y: CASA.y, toca: [], desafios: 0, proximoId: 2, ...CESTA,
          equipe: [{ id: 1, especie, nivel: NIVEL_INICIAL, xp: xpDoNivel(NIVEL_INICIAL), pv: atributos(especie, NIVEL_INICIAL).pvMax }],
          vistos: [...INICIAIS],
        })!;
        fase = 'mapa';
        guardar();
        return null;
      }
      if (corpo.tipo === 'esquecer') return esquecer(corpo);
      if (fase === 'batalha') return naLuta(corpo);
      if (corpo.tipo === 'andar') return andar(corpo.dir);
      if (corpo.tipo === 'toca') return naToca(corpo);
      if (corpo.tipo === 'frente') {
        // pôr um bicho da equipe na frente (é ele quem entra primeiro na luta)
        const i = Number(corpo.i);
        if (!Number.isInteger(i) || i < 0 || i >= av!.equipe.length) return 'Ação inválida.';
        av!.equipe.unshift(...av!.equipe.splice(i, 1));
        guardar();
        return null;
      }
      if (corpo.tipo === 'comprar') {
        // a lojinha: só de pé na porta dela, e com as moedas do jogo
        if (!naLoja()) return 'A lojinha fica longe daqui.';
        const item = corpo.item as ItemDaLoja;
        // a escada da lojinha: cada item abre com os degraus da escada dos desafios já vencidos
        if (typeof item !== 'string' || !Object.hasOwn(PRECOS, item) || av!.escada.length < LOJA_ABRE[item]) return 'Ação inválida.';
        if (av!.moedas < PRECOS[item]) return 'Faltam moedas.';
        av!.moedas -= PRECOS[item];
        const campo = ({ cenoura: 'cenouras', cha: 'chas', erva: 'ervas', chaForte: 'chasFortes', dourada: 'douradas' } as const)[item];
        av![campo] += 1;
        eventos.pôr([{ t: 'comprou', item }]);
        guardar();
        return null;
      }
      return 'Ação inválida.';
    },
    parar() {
      guardar();
    },
  };
}

// ---------------------------------------------------------------- A SALA
/** Um bicho que se pode levar à mesa: o id na aventura (ou o índice da emprestada) e a forma crescida. */
interface OpcaoDaMesa {
  id: number;
  especie: string;
}

function lutaNaSala(ctx: Contexto, criadaPor: number, aleatorio: () => number): Jogo {
  let fase: 'esperando' | 'montando' | 'escolhendo' | 'fim' = 'esperando';
  const lugares: number[] = [criadaPor];
  let b: Batalha | null = null;
  const escolhas: [Escolha | null, Escolha | null] = [null, null];
  let vencedor: number | null = null;
  const emprestada: boolean[] = [false, false];
  const eventos = diario();
  const partidaId = `bichos-${ctx.comunidade ?? 0}-${Date.now()}`;
  /** A MESA JUSTA (20/11/2026): o que cada lado pode levar, e os que escolheu (até BICHOS_NA_MESA, na ordem). */
  const opcoes: [OpcaoDaMesa[], OpcaoDaMesa[]] = [[], []];
  const montou: [number[] | null, number[] | null] = [null, null];

  /**
   * O que quem senta pode levar: os bichos da aventura (a equipe primeiro, depois a toca), cada um na FORMA CRESCIDA; sem
   * aventura, a emprestada (que vai sem escolha).
   */
  const opcoesDe = (userId: number, lado: number): OpcaoDaMesa[] => {
    const av = lerAventura(db.aventuraDosBichos(userId));
    emprestada[lado] = !av;
    if (!av) return EQUIPE_EMPRESTADA.map(([e], i) => ({ id: i, especie: formaCrescida(e) }));
    return [...av.equipe, ...av.toca].map((x) => ({ id: x.id, especie: formaCrescida(x.especie) }));
  };

  /** A escolha que o computador faz por quem não escolheu: os primeiros (a equipe, na ordem dela). */
  const montarPorQuem = (lado: number) => {
    if (!montou[lado]) montou[lado] = opcoes[lado].slice(0, BICHOS_NA_MESA).map((o) => o.id);
  };

  /** Todos lutam crescidos, no nível da sala, com a vida cheia e os últimos 4 golpes que sabem nele. */
  const equipeDaMesa = (lado: number): Lutador[] =>
    montou[lado]!.map((id) => lutador(opcoes[lado].find((o) => o.id === id)!.especie, NIVEL_DA_SALA));

  const talvezComecar = () => {
    if (fase !== 'montando' || !montou[0] || !montou[1]) return;
    b = novaBatalha(equipeDaMesa(0), equipeDaMesa(1));
    fase = 'escolhendo';
    prazo();
  };

  /** Quem precisa escolher agora: se alguém tem de trocar, só ele; senão, os dois. */
  const quemEscolhe = () => {
    const trocam = [0, 1].filter((l) => b!.lados[l].precisaTrocar);
    return trocam.length ? trocam : [0, 1];
  };

  const acabar = (lado: number | null) => {
    fase = 'fim';
    vencedor = lado;
    if (lado !== null) {
      eventos.pôr([{ t: 'venceu', userId: lugares[lado] }]);
      db.guardarTrofeu({
        userId: lugares[lado],
        evento: partidaId,
        communityId: ctx.comunidade ?? 0,
        pista: 'bichos',
        posicao: 1,
        tempoMs: null,
        pontos: b ? acordados(b.lados[lado]) : null,
        rivais: [lugares[1 - lado]],
      });
    }
    ctx.terminar(lado !== null);
  };

  const resolver = () => {
    const vez = quemEscolhe();
    if (!vez.every((l) => escolhas[l])) return;
    const agora: [Escolha | null, Escolha | null] = [vez.includes(0) ? escolhas[0] : null, vez.includes(1) ? escolhas[1] : null];
    escolhas[0] = escolhas[1] = null;
    eventos.pôr(turno(b!, agora, aleatorio));
    if (b!.vencedor !== null) return acabar(b!.vencedor);
    prazo();
  };

  function prazo() {
    ctx.agendar(ESCOLHA_MS, () => {
      if (fase !== 'escolhendo') return;
      // quem demorou joga pelo computador
      for (const l of quemEscolhe()) if (!escolhas[l]) escolhas[l] = escolhaDoRobo(b!, l, aleatorio);
      resolver();
      ctx.avisar();
    });
  }

  ctx.agendar(ESPERANDO_MS, () => {
    if (fase === 'esperando') acabar(null);
  });

  return {
    publico(quem) {
      const lado = lugares.indexOf(quem);
      return {
        modo: 'sala',
        fase,
        partidaId,
        nivel: NIVEL_DA_SALA,
        mesa: BICHOS_NA_MESA,
        lugares: lugares.map((id, l) => ({ userId: id, username: ctx.nome(id), emprestada: emprestada[l] })),
        meuLado: lado,
        // na largada: o que eu posso levar, e quem já escolheu (o que o outro lado escolheu só aparece na luta)
        opcoes: fase === 'montando' && lado >= 0 && !montou[lado] ? opcoes[lado] : [],
        montou: [!!montou[0], !!montou[1]],
        lados: b ? b.lados.map((l, i) => ({ ...vistaDoLado(l, i === lado), escolheu: escolhas[i] !== null })) : null,
        precisaEscolher: b && fase === 'escolhendo' && lado >= 0 ? quemEscolhe().includes(lado) && !escolhas[lado] : false,
        vencedor: vencedor === null ? null : lugares[vencedor],
        eventos: eventos.lista,
      };
    },
    acao(quem, corpo) {
      if (corpo.tipo === 'sentar') {
        if (fase !== 'esperando') return 'A mesa já está cheia.';
        if (lugares.includes(quem)) return 'Você já está na mesa.';
        lugares.push(quem);
        for (const l of [0, 1]) {
          opcoes[l] = opcoesDe(lugares[l], l);
          // a emprestada vai sem escolha
          if (emprestada[l]) montarPorQuem(l);
        }
        fase = 'montando';
        ctx.agendar(MONTAGEM_MS, () => {
          if (fase !== 'montando') return;
          montarPorQuem(0);
          montarPorQuem(1);
          talvezComecar();
          ctx.avisar();
        });
        talvezComecar();
        ctx.avisar();
        return null;
      }
      const lado = lugares.indexOf(quem);
      if (lado < 0) return 'Você está assistindo esta partida.';
      if (fase === 'esperando') return 'Espere alguém sentar do outro lado.';
      if (fase === 'fim') return 'A partida acabou.';
      if (corpo.tipo === 'desistir') {
        acabar(1 - lado);
        return null;
      }
      if (fase === 'montando') {
        if (corpo.tipo !== 'equipe') return 'Escolha inválida.';
        if (montou[lado]) return 'Você já escolheu.';
        const ids = Array.isArray(corpo.ids) ? corpo.ids.map(Number) : [];
        const validos = new Set(opcoes[lado].map((o) => o.id));
        if (!ids.length || ids.length > BICHOS_NA_MESA || new Set(ids).size !== ids.length || !ids.every((id) => validos.has(id))) {
          return 'Escolha inválida.';
        }
        montou[lado] = ids;
        talvezComecar();
        ctx.avisar();
        return null;
      }
      if (!quemEscolhe().includes(lado)) return 'Espere o outro lado.';
      if (escolhas[lado]) return 'Você já escolheu.';
      const e = { tipo: corpo.tipo, i: Number(corpo.i) } as Escolha;
      if (e.tipo !== 'golpe' && e.tipo !== 'trocar') return 'Escolha inválida.';
      const erro = conferirEscolha(b!, lado, e);
      if (erro) return erro;
      escolhas[lado] = e;
      resolver();
      ctx.avisar();
      return null;
    },
    conferir() {
      // quem saiu da sala no meio da largada ou da luta perde
      if (fase !== 'escolhendo' && fase !== 'montando') return;
      const naSala = ctx.naSala();
      const saiu = lugares.findIndex((id) => !naSala.includes(id));
      if (saiu >= 0) {
        acabar(1 - saiu);
        ctx.avisar();
      }
    },
  };
}

export function criarBichos(opcoes: { aleatorio?: () => number } = {}): Definicao {
  const aleatorio = opcoes.aleatorio ?? Math.random;
  return {
    mesa: true,
    comecar(ctx, { criadaPor }) {
      return ctx.solo ? aventuraSolo(ctx, criadaPor, aleatorio) : lutaNaSala(ctx, criadaPor, aleatorio);
    },
  };
}

export const bichos = criarBichos();

