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
import {
  andavel,
  atributos,
  CASA,
  casaDoMapa,
  CESTA,
  chanceDeAmizade,
  CHANCE_NO_MATO,
  DESAFIANTE,
  DIRECOES,
  EQUIPE_DO_DESAFIO,
  EQUIPE_EMPRESTADA,
  ESPECIES,
  golpesDe,
  INICIAIS,
  MATOS,
  NIVEL_INICIAL,
  NIVEL_MAXIMO,
  nivelDaXp,
  TAMANHO_DA_EQUIPE,
  xpDoNivel,
  xpGanha,
} from './bichos-regras.js';
import type { Contexto, Definicao, Jogo } from './minijogo-motor.js';

/**
 * BICHOS DA TOCA (16/11/2026, pedido dele): o gênero de juntar bichos e lutar por turnos, SÓ A MECÂNICA (ver bichos-regras.ts).
 *
 * NO SOLO, A AVENTURA: o campo de cima (bichos-regras.ts, MAPA), o primeiro bicho escolhido entre três, o mato onde os bichos
 * aparecem, a luta para cansá-los e a cenoura para a amizade, a equipe de até seis (o resto vai morar na toca), o nível e a
 * evolução, o chá, a casa onde se descansa e a casa do desafio da Nena. Cada passo vai ao servidor, que confere o mapa e sorteia
 * o mato; a luta é dele inteira (bichos-batalha.ts). A aventura é da PESSOA e mora no servidor (bichos_aventuras, db.ts):
 * gravada a cada luta e escolha, a cada 10 passos e quando a partida sai da memória.
 *
 * NA SALA, A LUTA ENTRE DUAS PESSOAS, na mesa (quem começa senta, o primeiro que apertar "Sentar" luta do outro lado, a sala
 * assiste): cada um com a equipe guardada, com a vida cheia; quem não tem bicho nenhum luta com a EQUIPE_EMPRESTADA. Os dois
 * escolhem ao mesmo tempo, e o turno sai quando os dois escolheram (ou quando o prazo acaba: quem demorou joga pelo computador).
 * O vencedor vai à estante de troféus (pista 'bichos'). A luta da sala não mexe na aventura de ninguém: nem vida, nem experiência.
 */

export interface BichoGuardado {
  id: number;
  especie: string;
  nivel: number;
  xp: number;
  pv: number;
}

export interface Aventura {
  v: 1;
  x: number;
  y: number;
  equipe: BichoGuardado[];
  toca: BichoGuardado[];
  cenouras: number;
  chas: number;
  /** Quantas vezes venceu a Nena. */
  desafios: number;
  proximoId: number;
}

/** O que veio do banco, conferido: o JSON é escrito só pelo servidor, mas uma versão antiga ou um defeito não derrubam o jogo. */
export function lerAventura(dados: unknown): Aventura | null {
  const a = dados as Partial<Aventura> | null;
  if (!a || typeof a !== 'object' || a.v !== 1) return null;
  const bicho = (b: Partial<BichoGuardado>): BichoGuardado | null => {
    if (!b || typeof b.especie !== 'string' || !ESPECIES[b.especie]) return null;
    const nivel = Math.min(NIVEL_MAXIMO, Math.max(1, Math.floor(Number(b.nivel) || 1)));
    const pvMax = atributos(b.especie, nivel).pvMax;
    return { id: Math.floor(Number(b.id) || 0), especie: b.especie, nivel, xp: Math.max(xpDoNivel(nivel), Math.floor(Number(b.xp) || 0)), pv: Math.min(pvMax, Math.max(0, Math.floor(Number(b.pv) || 0))) };
  };
  const lista = (l: unknown) => (Array.isArray(l) ? l.map(bicho).filter((b): b is BichoGuardado => b !== null) : []);
  const equipe = lista(a.equipe).slice(0, TAMANHO_DA_EQUIPE);
  if (!equipe.length) return null;
  const x = Math.floor(Number(a.x));
  const y = Math.floor(Number(a.y));
  const noLugar = andavel(x, y);
  return {
    v: 1,
    x: noLugar ? x : CASA.x,
    y: noLugar ? y : CASA.y,
    equipe,
    toca: lista(a.toca),
    cenouras: Math.max(0, Math.floor(Number(a.cenouras) || 0)),
    chas: Math.max(0, Math.floor(Number(a.chas) || 0)),
    desafios: Math.max(0, Math.floor(Number(a.desafios) || 0)),
    proximoId: Math.max(1, Math.floor(Number(a.proximoId) || 1), ...[...equipe, ...lista(a.toca)].map((b) => b.id + 1)),
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
    golpes: golpesDe(b.especie, b.nivel),
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
/** A luta da sala: o prazo de cada escolha, e quanto a mesa espera alguém sentar. */
export const ESCOLHA_MS = 60_000;
export const ESPERANDO_MS = 3 * 60_000;
/** A fuga do bicho do mato. */
export const CHANCE_DE_FUGIR = 0.75;

// ---------------------------------------------------------------- O SOLO
function aventuraSolo(ctx: Contexto, userId: number, aleatorio: () => number): Jogo {
  let av = lerAventura(db.aventuraDosBichos(userId));
  let fase: 'inicial' | 'mapa' | 'batalha' = av ? 'mapa' : 'inicial';
  const eventos = diario();
  let passosSemGuardar = 0;
  let luta: { b: Batalha; tipo: 'mato' | 'desafio'; acabou: null | 'vitoria' | 'derrota' | 'fugiu' | 'amigo' } | null = null;
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

  const descansar = () => {
    for (const b of av!.equipe) b.pv = atributos(b.especie, b.nivel).pvMax;
    av!.cenouras = Math.max(av!.cenouras, CESTA.cenouras);
    av!.chas = Math.max(av!.chas, CESTA.chas);
  };

  const comecarLuta = (inimigos: Lutador[], tipo: 'mato' | 'desafio') => {
    const meus = av!.equipe.map((b) => lutador(b.especie, b.nivel, b.pv));
    luta = { b: novaBatalha(meus, inimigos), tipo, acabou: null };
    fase = 'batalha';
  };

  /** A vida de cada um volta para a equipe guardada (o índice da luta é o da equipe). */
  const devolverVida = () => {
    luta!.b.lados[0].equipe.forEach((l, i) => {
      if (av!.equipe[i]) av!.equipe[i].pv = l.pv;
    });
  };

  /** O bicho da frente ganhou experiência: sobe de nível (e evolui) aqui e na luta. */
  const darXp = (xp: number): EventoDaAventura[] => {
    const lado = luta!.b.lados[0];
    const i = lado.ativo;
    const b = av!.equipe[i];
    const l = lado.equipe[i];
    const saida: EventoDaAventura[] = [];
    b.xp += xp;
    const novo = nivelDaXp(b.xp);
    if (novo <= b.nivel) return saida;
    const antes = atributos(b.especie, b.nivel).pvMax;
    b.nivel = novo;
    saida.push({ t: 'nivel', especie: b.especie, n: novo });
    const evolui = ESPECIES[b.especie].evolui;
    if (evolui && novo >= evolui.nivel) {
      saida.push({ t: 'evoluiu', de: b.especie, para: evolui.para });
      b.especie = evolui.para;
    }
    const a = atributos(b.especie, b.nivel);
    b.pv = Math.min(a.pvMax, l.pv + (a.pvMax - antes));
    Object.assign(l, lutador(b.especie, b.nivel, b.pv));
    return saida;
  };

  /** Depois de um turno: quem dormiu, o fim da luta, a troca forçada do lado de lá. */
  const depoisDoTurno = (doTurno: EventoDaLuta[]): EventoDaAventura[] => {
    const saida: EventoDaAventura[] = [...doTurno];
    const l = luta!;
    for (const e of doTurno) {
      if (e.t === 'sono' && e.lado === 1) {
        const inimigo = l.b.lados[1].equipe.find((x) => x.especie === e.especie && x.pv === 0)!;
        saida.push(...darXp(xpGanha(inimigo.especie, inimigo.nivel, l.tipo === 'desafio')));
      }
    }
    if (l.b.vencedor === 0) {
      l.acabou = 'vitoria';
      if (l.tipo === 'desafio') {
        av!.desafios += 1;
        av!.cenouras += 5;
        saida.push({ t: 'venceuDesafio' });
      } else saida.push({ t: 'vitoria' });
    } else if (l.b.vencedor === 1) {
      l.acabou = 'derrota';
      saida.push({ t: 'derrota' });
    } else if (l.b.lados[1].precisaTrocar) {
      // a Nena manda o próximo na hora
      saida.push(...turno(l.b, [null, escolhaDoRobo(l.b, 1, aleatorio)], aleatorio));
    }
    devolverVida();
    return saida;
  };

  const vezDoInimigo = (): Escolha => escolhaDoRobo(luta!.b, 1, aleatorio, luta!.tipo === 'desafio');

  function andar(dir: unknown): string | null {
    const d = DIRECOES[String(dir)];
    if (!d) return 'Direção inválida.';
    const x = av!.x + d[0];
    const y = av!.y + d[1];
    if (!andavel(x, y)) return null; // bateu na árvore: fica onde está, sem erro
    av!.x = x;
    av!.y = y;
    const casa = casaDoMapa(x, y);
    if (casa === 'h') {
      descansar();
      eventos.pôr([{ t: 'descansou' }]);
      guardar();
    } else if (casa === 'c') {
      comecarLuta(EQUIPE_DO_DESAFIO.map(([e, n]) => lutador(e, n)), 'desafio');
      eventos.pôr([{ t: 'desafio', nome: DESAFIANTE }]);
      guardar();
    } else if (MATOS[casa] && aleatorio() < CHANCE_NO_MATO) {
      const mato = MATOS[casa];
      const especie = mato.especies[Math.floor(aleatorio() * mato.especies.length)];
      const nivel = mato.de + Math.floor(aleatorio() * (mato.ate - mato.de + 1));
      comecarLuta([lutador(especie, nivel)], 'mato');
      eventos.pôr([{ t: 'apareceu', especie }]);
      guardar();
    } else if (++passosSemGuardar >= 10) guardar();
    return null;
  }

  function naLuta(corpo: Record<string, unknown>): string | null {
    const l = luta!;
    const tipo = corpo.tipo;
    if (tipo === 'continuar') {
      if (!l.acabou) return 'A luta ainda não acabou.';
      if (l.acabou === 'derrota') {
        descansar();
        av!.x = CASA.x;
        av!.y = CASA.y;
      }
      luta = null;
      fase = 'mapa';
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
      if (av!.chas <= 0) return 'Acabou o chá.';
      av!.chas -= 1;
      eventos.pôr(depoisDoTurno(turno(l.b, [{ tipo: 'cha' }, vezDoInimigo()], aleatorio)));
    } else if (tipo === 'cenoura') {
      if (l.tipo !== 'mato') return 'Só os bichos do mato fazem amizade.';
      if (av!.cenouras <= 0) return 'Acabaram as cenouras.';
      av!.cenouras -= 1;
      const alvo = ativoDe(l.b.lados[1]);
      if (aleatorio() < chanceDeAmizade(alvo.especie, alvo.pv, alvo.pvMax)) {
        const novo: BichoGuardado = { id: av!.proximoId++, especie: alvo.especie, nivel: alvo.nivel, xp: xpDoNivel(alvo.nivel), pv: alvo.pv };
        l.acabou = 'amigo';
        devolverVida();
        const cabe = av!.equipe.length < TAMANHO_DA_EQUIPE;
        (cabe ? av!.equipe : av!.toca).push(novo);
        eventos.pôr([{ t: 'amigo', especie: alvo.especie }, ...(cabe ? [] : [{ t: 'toca' as const, especie: alvo.especie }])]);
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

  return {
    publico() {
      const l = luta;
      return {
        modo: 'solo',
        fase,
        // as cores do coelho de quem anda pelo campo
        avatar: db.avatarDoJogo(userId),
        partidaId,
        x: av?.x ?? CASA.x,
        y: av?.y ?? CASA.y,
        equipe: av?.equipe.map(vistaDoBicho) ?? [],
        toca: av?.toca.length ?? 0,
        cenouras: av?.cenouras ?? 0,
        chas: av?.chas ?? 0,
        desafios: av?.desafios ?? 0,
        luta: l && {
          tipo: l.tipo,
          acabou: l.acabou,
          meu: vistaDoLado(l.b.lados[0], true),
          outro: vistaDoLado(l.b.lados[1], false),
          chance: l.tipo === 'mato' ? chanceDeAmizade(ativoDe(l.b.lados[1]).especie, ativoDe(l.b.lados[1]).pv, ativoDe(l.b.lados[1]).pvMax) : 0,
        },
        eventos: eventos.lista,
      };
    },
    acao(_quem, corpo) {
      ocioso();
      if (fase === 'inicial') {
        if (corpo.tipo !== 'inicial' || !INICIAIS.includes(corpo.especie as (typeof INICIAIS)[number])) return 'Escolha o primeiro bicho.';
        const especie = corpo.especie as string;
        av = {
          v: 1, x: CASA.x, y: CASA.y, toca: [], desafios: 0, proximoId: 2, ...CESTA,
          equipe: [{ id: 1, especie, nivel: NIVEL_INICIAL, xp: xpDoNivel(NIVEL_INICIAL), pv: atributos(especie, NIVEL_INICIAL).pvMax }],
        };
        fase = 'mapa';
        guardar();
        return null;
      }
      if (fase === 'batalha') return naLuta(corpo);
      if (corpo.tipo === 'andar') return andar(corpo.dir);
      if (corpo.tipo === 'frente') {
        // pôr um bicho da equipe na frente (é ele quem entra primeiro na luta)
        const i = Number(corpo.i);
        if (!Number.isInteger(i) || i < 0 || i >= av!.equipe.length) return 'Ação inválida.';
        av!.equipe.unshift(...av!.equipe.splice(i, 1));
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
function lutaNaSala(ctx: Contexto, criadaPor: number, aleatorio: () => number): Jogo {
  let fase: 'esperando' | 'escolhendo' | 'fim' = 'esperando';
  const lugares: number[] = [criadaPor];
  let b: Batalha | null = null;
  const escolhas: [Escolha | null, Escolha | null] = [null, null];
  let vencedor: number | null = null;
  const emprestada: boolean[] = [false, false];
  const eventos = diario();
  const partidaId = `bichos-${ctx.comunidade ?? 0}-${Date.now()}`;

  /** A equipe guardada de quem senta, com a vida cheia; sem nenhuma, a emprestada. */
  const equipeDe = (userId: number, lado: number): Lutador[] => {
    const av = lerAventura(db.aventuraDosBichos(userId));
    emprestada[lado] = !av;
    return av ? av.equipe.map((x) => lutador(x.especie, x.nivel)) : EQUIPE_EMPRESTADA.map(([e, n]) => lutador(e, n));
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
        lugares: lugares.map((id, l) => ({ userId: id, username: ctx.nome(id), emprestada: emprestada[l] })),
        meuLado: lado,
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
        b = novaBatalha(equipeDe(lugares[0], 0), equipeDe(lugares[1], 1));
        fase = 'escolhendo';
        prazo();
        ctx.avisar();
        return null;
      }
      const lado = lugares.indexOf(quem);
      if (lado < 0) return 'Você está assistindo esta partida.';
      if (fase !== 'escolhendo') return fase === 'fim' ? 'A partida acabou.' : 'Espere alguém sentar do outro lado.';
      if (corpo.tipo === 'desistir') {
        acabar(1 - lado);
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
      // quem saiu da sala no meio da luta perde
      if (fase !== 'escolhendo') return;
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
