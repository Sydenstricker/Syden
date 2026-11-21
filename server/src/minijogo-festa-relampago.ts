/**
 * O MODO RELÂMPAGO DA FESTA DOS COELHOS (19/11/2026, pedido dele na auditoria dos mini-games): microjogos de 4 a 5 segundos em
 * sequência, cada vez mais rápidos, com 3 vidas. SÓ A MECÂNICA dos jogos de microjogos relâmpago: nada de nome, personagem,
 * arte ou som de ninguém. Escolhido na largada da Festa (`corpo.modo === 'relampago'`).
 *
 * A REDE DECIDE A FORMA, como na Festa: cada um joga NA PRÓPRIA TELA, ao mesmo tempo, os MESMOS microjogos (a sequência e os
 * dados saem do servidor); nada depende de interação entre as pessoas. O servidor é dono do relógio: abre cada microjogo, marca
 * o fim, e confere cada resposta pelo relógio dele (o tempo dito cabe no que ele viu passar, com a folga da rede) e pelos dados
 * que só ele sorteou (a casa certa, a seta certa, a contagem certa, a zona da barra). Quem não acertou a tempo perde uma vida;
 * sem vidas, assiste. Na sala, acaba quando sobra um (ou ninguém); sozinho, quando as vidas acabam.
 *
 * Os cinco microjogos relâmpago, todos sem texto:
 * - 'toque': a cenoura aparece numa das 9 casas: toque nela.
 * - 'lado': uma seta aparece: aperte a seta igual (ou toque nela).
 * - 'espere': o sinal acende num instante sorteado: aperte depois dele (antes, perde).
 * - 'pare': a barra corre: pare dentro da faixa verde.
 * - 'conte': cenouras piscam na tela: escolha quantas eram, entre três.
 *
 * E os oito de 21/11/2026 (o lote D), também sem texto, cada um conferido pelos dados daqui:
 * - 'maior': dois montes de cenoura: toque no maior.
 * - 'cor': uma cor no alto: toque no círculo da mesma cor (os quatro em ordem sorteada).
 * - 'intruso': seis cenouras e um nabo no meio: toque no nabo.
 * - 'toques': o tambor mostra quantas batidas (de 3 a 6): bata essas vezes (o tempo mínimo de cada batida é conferido).
 * - 'esquiva': a pedra cai numa das três faixas: vá para outra.
 * - 'soma': dois dados: escolha a soma, entre três.
 * - 'sombra': um legume no alto: escolha a sombra dele, entre três.
 * - 'memoria': a cenoura aparece numa das quatro tocas e se esconde: toque onde ela estava.
 *
 * É jogo entre amigos: conferência razoável, não perfeita (a mesma da Festa: um programa que espere a hora certa passa, como
 * passaria um dedo perfeito). Não usa o eco da rodada da Festa: a folga é a de quem não mediu (ATRASO_MAXIMO + FOLGA_DA_REDE).
 *
 * O RECORDE DO SOLO (20/11/2026, a segunda auditoria): sozinho, os ACERTOS da partida, contados aqui, vão à tabela comum
 * (jogo 'festa-relampago', sem variante). Na sala, não.
 *
 * OS TROFÉUS: com 2 ou mais que ficaram até o fim, o pódio (pela ordem de queda, e no empate pelos acertos) vai para a estante,
 * com a "pista" 'festa-relampago' e os pontos sendo os acertos.
 */
import * as db from './db.js';
import { ATRASO_MAXIMO, FOLGA_ACIMA, FOLGA_DA_REDE, PREPARO_MS, REACAO_MINIMA } from './festa/comum.js';
import type { Contexto, Jogo } from './minijogo-motor.js';

/** Os tipos, na ordem do sorteio: os novos vão no FIM (a semente de antes dá os mesmos cinco primeiros só pelo tamanho). */
export const TIPOS_RELAMPAGO = ['toque', 'lado', 'espere', 'pare', 'conte', 'maior', 'cor', 'intruso', 'toques', 'esquiva', 'soma', 'sombra', 'memoria'] as const;
/** O intervalo mínimo entre duas batidas do 'toques' (um dedo não bate mais rápido que isto). */
export const BATIDA_MINIMA_MS = 70;
/** Quantos legumes há para a 'sombra' (o desenho de cada um mora no site). */
export const FORMAS_DA_SOMBRA = 5;
export type TipoRelampago = (typeof TIPOS_RELAMPAGO)[number];
export const VIDAS_RELAMPAGO = 3;
/** Quanto dura o primeiro microjogo, o mais rápido possível, e quanto cada um encurta. */
export const RELAMPAGO_INICIAL_MS = 4800;
export const RELAMPAGO_MINIMO_MS = 2200;
export const RELAMPAGO_ACELERA_MS = 160;
/** Depois do fim visível, quanto o servidor ainda espera a resposta honesta chegar. */
export const RELAMPAGO_FOLGA_MS = 450;
/** O respiro entre um e outro (o ✓ ou o ✗ na tela). */
export const RELAMPAGO_INTERVALO_MS = 1000;
/** O teto de microjogos de uma partida (ninguém fica para sempre). */
export const RELAMPAGO_MAXIMO = 40;
/** A barra do 'pare': quanto ela leva para ir e voltar. */
const PARE_PERIODO_MIN = 900;

export const duracaoRelampago = (i: number) => Math.max(RELAMPAGO_MINIMO_MS, RELAMPAGO_INICIAL_MS - i * RELAMPAGO_ACELERA_MS);

export type DadosRelampago =
  | { tipo: 'toque'; casa: number; aparece: number }
  | { tipo: 'lado'; direcao: number; aparece: number }
  | { tipo: 'espere'; aparece: number }
  | { tipo: 'pare'; periodo: number; de: number; ate: number }
  | { tipo: 'conte'; quantas: number; opcoes: number[]; mostra: number; posicoes: number[] }
  | { tipo: 'maior'; esquerda: number; direita: number; aparece: number }
  | { tipo: 'cor'; cor: number; ordem: number[]; aparece: number }
  | { tipo: 'intruso'; casa: number; aparece: number }
  | { tipo: 'toques'; quantas: number; aparece: number }
  | { tipo: 'esquiva'; pista: number; aparece: number }
  | { tipo: 'soma'; a: number; b: number; opcoes: number[]; aparece: number }
  | { tipo: 'sombra'; forma: number; opcoes: number[]; aparece: number }
  | { tipo: 'memoria'; casa: number; mostra: number };

/** O valor da barra do 'pare' no tempo t (ms desde o começo): uma onda triangular de 0 a 100 (só + − × ÷). */
export function barraDoPare(periodo: number, t: number): number {
  const fase = (((t % periodo) + periodo) % periodo) / periodo;
  return 100 * (1 - Math.abs(fase * 2 - 1));
}

/** Sorteia o microjogo `i` (o tipo e os dados); quanto mais adiante, mais apertado. */
export function sortearRelampago(i: number, aleatorio: () => number, anterior: TipoRelampago | null = null): DadosRelampago {
  const dur = duracaoRelampago(i);
  const n = (k: number) => Math.floor(aleatorio() * k);
  let tipo = TIPOS_RELAMPAGO[n(TIPOS_RELAMPAGO.length)];
  // nunca o mesmo duas vezes seguidas
  if (tipo === anterior) tipo = TIPOS_RELAMPAGO[(TIPOS_RELAMPAGO.indexOf(tipo) + 1) % TIPOS_RELAMPAGO.length];
  // o que aparece, aparece na primeira metade (sobra tempo de reagir)
  const aparece = 300 + n(Math.max(1, Math.floor(dur * 0.45)));
  // os de ler e escolher aparecem cedo (sobra tempo de pensar)
  const cedo = () => 250 + n(Math.max(1, Math.floor(dur * 0.15)));
  const embaralhar = (xs: number[]) => {
    for (let k = xs.length - 1; k > 0; k--) {
      const j = n(k + 1);
      [xs[k], xs[j]] = [xs[j], xs[k]];
    }
    return xs;
  };
  switch (tipo) {
    case 'maior': {
      const esquerda = 2 + n(6);
      let direita = 2 + n(6);
      if (direita === esquerda) direita = esquerda === 7 ? 6 : esquerda + 1;
      return { tipo, esquerda, direita, aparece: cedo() };
    }
    case 'cor':
      return { tipo, cor: n(4), ordem: embaralhar([0, 1, 2, 3]), aparece: cedo() };
    case 'intruso':
      return { tipo, casa: n(6), aparece };
    case 'toques':
      return { tipo, quantas: 3 + n(Math.min(4, Math.max(1, Math.floor((dur - 800) / 450)))), aparece: cedo() };
    case 'esquiva':
      return { tipo, pista: n(3), aparece };
    case 'soma': {
      const a = 1 + n(6);
      const b = 1 + n(6);
      const s = a + b;
      const outras = embaralhar([s - 2, s - 1, s + 1, s + 2].filter((x) => x >= 2 && x <= 12)).slice(0, 2);
      return { tipo, a, b, opcoes: [s, ...outras].sort((x, y) => x - y), aparece: cedo() };
    }
    case 'sombra': {
      const forma = n(FORMAS_DA_SOMBRA);
      const outras = embaralhar(Array.from({ length: FORMAS_DA_SOMBRA }, (_, k) => k).filter((k) => k !== forma)).slice(0, 2);
      return { tipo, forma, opcoes: embaralhar([forma, ...outras]), aparece: cedo() };
    }
    case 'memoria':
      return { tipo, casa: n(4), mostra: Math.max(600, Math.floor(dur * 0.3)) };
    case 'toque':
      return { tipo, casa: n(9), aparece };
    case 'lado':
      return { tipo, direcao: n(4), aparece };
    case 'espere':
      return { tipo, aparece: 600 + n(Math.max(1, Math.floor(dur * 0.5))) };
    case 'pare': {
      const periodo = Math.max(PARE_PERIODO_MIN, 1900 - i * 40);
      const largura = Math.max(12, 26 - i);
      const de = 10 + n(80 - largura);
      return { tipo, periodo, de, ate: de + largura };
    }
    default: {
      const quantas = 3 + n(5);
      const outras = [quantas - 1, quantas + 1, quantas + 2].sort(() => aleatorio() - 0.5).slice(0, 2);
      const opcoes = [quantas, ...outras].sort((a, b) => a - b);
      // onde cada cenoura aparece (das 12 casas), sem repetir
      const casas = Array.from({ length: 12 }, (_, k) => k);
      for (let k = casas.length - 1; k > 0; k--) {
        const j = n(k + 1);
        [casas[k], casas[j]] = [casas[j], casas[k]];
      }
      return { tipo: 'conte', quantas, opcoes, mostra: Math.max(700, Math.floor(dur * 0.35)), posicoes: casas.slice(0, quantas) };
    }
  }
}

/** A resposta `r` no tempo `t` vale para os dados `d` (o tempo já conferido pelo relógio)? */
export function respostaCerta(d: DadosRelampago, t: number, r: unknown): boolean {
  switch (d.tipo) {
    case 'toque':
      return r === d.casa && t >= d.aparece;
    case 'lado':
      return r === d.direcao && t >= d.aparece + REACAO_MINIMA;
    case 'espere':
      return t >= d.aparece + REACAO_MINIMA;
    case 'pare': {
      const v = barraDoPare(d.periodo, t);
      return v >= d.de && v <= d.ate;
    }
    case 'conte':
      return t >= d.mostra && r === d.quantas;
    case 'maior':
      return t >= d.aparece + REACAO_MINIMA && r === (d.esquerda > d.direita ? 0 : 1);
    case 'cor':
      return t >= d.aparece + REACAO_MINIMA && Number.isInteger(r) && d.ordem[r as number] === d.cor;
    case 'intruso':
      return t >= d.aparece + REACAO_MINIMA && r === d.casa;
    case 'toques':
      // a última batida não chega antes de todas as outras, cada uma no mínimo BATIDA_MINIMA_MS depois da anterior
      return r === d.quantas && t >= d.aparece + REACAO_MINIMA + (d.quantas - 1) * BATIDA_MINIMA_MS;
    case 'esquiva':
      return t >= d.aparece + REACAO_MINIMA && (r === 0 || r === 1 || r === 2) && r !== d.pista;
    case 'soma':
      return t >= d.aparece + REACAO_MINIMA && r === d.a + d.b;
    case 'sombra':
      return t >= d.aparece + REACAO_MINIMA && r === d.forma;
    case 'memoria':
      return t >= d.mostra && r === d.casa;
  }
}

/** A resposta honesta e certa (para o robô e o teste): o instante e o que se manda. */
export function respostaHonesta(d: DadosRelampago): { t: number; r?: number } {
  switch (d.tipo) {
    case 'toque':
      return { t: d.aparece + 250, r: d.casa };
    case 'lado':
      return { t: d.aparece + 250, r: d.direcao };
    case 'espere':
      return { t: d.aparece + 250 };
    case 'pare': {
      const alvo = (d.de + d.ate) / 2;
      for (let t = 0; t < 5000; t += 5) if (Math.abs(barraDoPare(d.periodo, t) - alvo) < 2) return { t };
      return { t: 0 };
    }
    case 'conte':
      return { t: d.mostra + 200, r: d.quantas };
    case 'maior':
      return { t: d.aparece + 300, r: d.esquerda > d.direita ? 0 : 1 };
    case 'cor':
      return { t: d.aparece + 300, r: d.ordem.indexOf(d.cor) };
    case 'intruso':
      return { t: d.aparece + 300, r: d.casa };
    case 'toques':
      return { t: d.aparece + 250 + d.quantas * 120, r: d.quantas };
    case 'esquiva':
      return { t: d.aparece + 250, r: (d.pista + 1) % 3 };
    case 'soma':
      return { t: d.aparece + 400, r: d.a + d.b };
    case 'sombra':
      return { t: d.aparece + 350, r: d.forma };
    case 'memoria':
      return { t: d.mostra + 250, r: d.casa };
  }
}

/** Uma resposta errada, no instante da certa (para o teste). */
export function respostaErrada(d: DadosRelampago): { t: number; r?: number } {
  const c = respostaHonesta(d);
  if (d.tipo === 'espere') return { t: Math.max(0, d.aparece - 200) };
  if (d.tipo === 'pare') {
    for (let t = 0; t < 5000; t += 5) {
      const v = barraDoPare(d.periodo, t);
      if (v < d.de - 3 || v > d.ate + 3) return { t };
    }
  }
  if (d.tipo === 'esquiva') return { t: c.t, r: d.pista };
  if (d.tipo === 'cor') return { t: c.t, r: (d.ordem.indexOf(d.cor) + 1) % 4 };
  return { t: c.t, r: (c.r ?? 0) + 1 };
}

interface Pessoa {
  vidas: number;
  acertos: number;
  /** Em qual microjogo caiu (o índice), ou null. */
  caiu: number | null;
}

export interface OpcoesDoRelampago {
  agora: () => number;
  aleatorio: () => number;
}

export function comecarRelampago(ctx: Contexto, naSala: number[], { agora, aleatorio }: OpcoesDoRelampago): Jogo {
  const inscritos = [...naSala];
  const evento = `festa-relampago-${ctx.comunidade ?? 0}-${agora()}`;
  const pessoas = new Map<number, Pessoa>(inscritos.map((id) => [id, { vidas: VIDAS_RELAMPAGO, acertos: 0, caiu: null }]));
  const avatares = new Map(inscritos.map((id) => [id, id < 0 ? null : db.avatarDoJogo(id)]));
  let fase: 'preparando' | 'jogando' | 'intervalo' | 'fim' = 'preparando';
  let indice = -1;
  let dados: DadosRelampago | null = null;
  let inicio = 0;
  /** O que cada um fez no microjogo de agora: true acertou, false errou (e já não pode mais). */
  const respostas = new Map<number, boolean>();
  /** Quem esteve na sala em todos os microjogos: só eles levam troféu. */
  const ficaram = new Set(inscritos);
  const folga = ATRASO_MAXIMO + FOLGA_DA_REDE;
  /** O recorde do Solo (20/11/2026): de quem joga sozinho. */
  const soloDe = inscritos.length === 1 && inscritos[0] > 0 && (ctx.solo === true || !ctx.comunidade) ? inscritos[0] : null;
  let recordeAntes: number | null = null;
  if (soloDe !== null) {
    try {
      recordeAntes = db.recordeDoSolo(soloDe, 'festa-relampago')?.valor ?? null;
    } catch {
      // sem a conta (o teste sem banco): sem recorde
    }
  }
  let recorde: { acertos: number; antes: number | null; novo: boolean } | null = null;

  const vivos = () => inscritos.filter((id) => pessoas.get(id)!.caiu === null);

  const proximo = () => {
    const aqui = new Set(ctx.naSala());
    for (const id of [...ficaram]) if (!aqui.has(id)) ficaram.delete(id);
    // quem saiu da sala cai (não segura ninguém)
    for (const id of vivos()) if (!aqui.has(id)) pessoas.get(id)!.caiu = Math.max(0, indice);
    const restam = vivos();
    if (!restam.length || (inscritos.length > 1 && restam.length <= 1) || indice + 1 >= RELAMPAGO_MAXIMO) return terminar();
    indice++;
    dados = sortearRelampago(indice, aleatorio, dados?.tipo ?? null);
    respostas.clear();
    inicio = agora();
    fase = 'jogando';
    ctx.agendar(duracaoRelampago(indice) + RELAMPAGO_FOLGA_MS, fechar);
    ctx.avisar();
  };

  const fechar = () => {
    if (fase !== 'jogando') return;
    for (const id of vivos()) {
      const p = pessoas.get(id)!;
      if (respostas.get(id) === true) continue;
      p.vidas--;
      if (p.vidas <= 0) p.caiu = indice;
    }
    fase = 'intervalo';
    ctx.agendar(RELAMPAGO_INTERVALO_MS, proximo);
    ctx.avisar();
  };

  /** A ordem final: quem caiu depois vai na frente; no empate, mais acertos; empatados dividem. */
  const classificacao = (ids: number[]) => {
    const chave = (id: number) => {
      const p = pessoas.get(id)!;
      return [p.caiu === null ? Infinity : p.caiu, p.acertos];
    };
    const melhor = (a: number, b: number) => {
      const [ca, aa] = chave(a);
      const [cb, ab] = chave(b);
      return cb - ca || ab - aa;
    };
    return ids
      .map((id) => ({ userId: id, username: ctx.nome(id), pontos: pessoas.get(id)!.acertos, posicao: 1 + ids.filter((o) => melhor(o, id) < 0).length }))
      .sort((a, b) => a.posicao - b.posicao || a.username.localeCompare(b.username));
  };

  const terminar = () => {
    fase = 'fim';
    dados = null;
    if (soloDe !== null) {
      const acertos = pessoas.get(soloDe)!.acertos;
      try {
        recorde = { acertos, ...(acertos > 0 ? db.guardarRecordeDoSolo(soloDe, 'festa-relampago', '', acertos, false) : { antes: recordeAntes, novo: false }) };
      } catch {
        recorde = { acertos, antes: recordeAntes, novo: false };
      }
    }
    const turma = inscritos.filter((id) => ficaram.has(id));
    if (turma.length >= 2) {
      for (const l of classificacao(turma)) {
        if (l.posicao > 3 || l.pontos <= 0) continue;
        db.guardarTrofeu({
          userId: l.userId,
          evento,
          communityId: ctx.comunidade ?? 0,
          pista: 'festa-relampago',
          posicao: l.posicao,
          tempoMs: null,
          pontos: l.pontos,
          rivais: turma.filter((id) => id !== l.userId),
        });
      }
    }
    ctx.terminar();
  };

  // o "prepare-se": o nome do modo e as vidas
  ctx.agendar(PREPARO_MS, proximo);

  return {
    publico(quem) {
      const turma = inscritos.filter((id) => ficaram.has(id));
      return {
        modo: 'relampago',
        fase,
        rodada: indice + 1,
        microjogo: 'relampago',
        dados: fase === 'jogando' || fase === 'intervalo' ? dados : null,
        indice,
        duracaoMs: indice >= 0 ? duracaoRelampago(indice) : 0,
        jogandoHaMs: fase === 'jogando' ? agora() - inicio : null,
        vidas: VIDAS_RELAMPAGO,
        jogadores: inscritos.map((userId) => {
          const p = pessoas.get(userId)!;
          return {
            userId,
            username: ctx.nome(userId),
            avatar: avatares.get(userId) ?? null,
            vidas: p.vidas,
            acertos: p.acertos,
            caiu: p.caiu !== null,
            // o que cada um fez neste microjogo (o ✓ e o ✗ da tela)
            agora: respostas.has(userId) ? respostas.get(userId) : null,
          };
        }),
        meu: respostas.has(quem) ? respostas.get(quem) : null,
        classificacao: fase === 'fim' ? classificacao(turma.length >= 2 ? turma : inscritos).map((l) => ({ ...l, posicao: turma.length >= 2 ? l.posicao : null, saiu: !ficaram.has(l.userId) })) : null,
        placar: classificacao(inscritos).map(({ userId, username, pontos }) => ({ userId, username, pontos })),
        partidaId: evento,
        // o recorde do Solo (20/11/2026): o de antes, e no fim os acertos e se virou recorde
        ...(soloDe !== null ? { recordeAntes, recorde: fase === 'fim' ? recorde : null } : {}),
      };
    },
    acao(quem, corpo) {
      if (corpo.tipo === 'eco') return null;
      if (corpo.tipo !== 'acerto' && corpo.tipo !== 'resultado') return 'Ação desconhecida.';
      if (!inscritos.includes(quem)) return 'Você está assistindo esta partida.';
      if (fase !== 'jogando' || !dados) return 'Esta rodada já acabou.';
      const p = pessoas.get(quem)!;
      // fora do jogo, ou já respondeu: só não conta
      if (p.caiu !== null || respostas.has(quem) || corpo.k !== indice) return null;
      const t = corpo.t;
      if (typeof t !== 'number' || !Number.isFinite(t) || t < 0 || t > duracaoRelampago(indice)) return null;
      const passou = agora() - inicio;
      // o tempo dito cabe no que o servidor viu: nunca depois, antes no máximo a folga da rede
      if (t > passou + FOLGA_ACIMA || t < passou - folga) return null;
      const certa = respostaCerta(dados, t, corpo.r);
      respostas.set(quem, certa);
      if (certa) p.acertos++;
      ctx.avisar();
      return null;
    },
    conferir() {
      // quem saiu cai na troca de microjogo (proximo); aqui não há o que esperar
    },
  };
}
