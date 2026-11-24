import { embaralhar, type Contexto, type Jogo } from './minijogo-motor.js';
import { prepararModeracao, textoBarrado } from './texto-do-jogo.js';

/**
 * O TELEFONE SEM FIO DO DESENHA E ADIVINHA (24/11/2026, o lote E da segunda auditoria): um modo da largada do desenho, SÓ A
 * MECÂNICA do gênero (a brincadeira de passar a frase adiante, com desenho no meio), nada de nome nem arte de app de ninguém.
 *
 * Cada pessoa começa uma CORRENTE escrevendo uma frase. Depois, a cada passo, todo mundo trabalha AO MESMO TEMPO na corrente de
 * outra pessoa: quem recebe uma frase a desenha, e quem recebe um desenho escreve o que acha que é. São tantos passos quanto
 * pessoas, e cada corrente passa uma vez por cada uma. No fim, a turma vê cada corrente inteira, um passo de cada vez.
 *
 * - O TRAÇO VAI PELO MESMO CANAL do desenho (o `tempoReal`, pedaços numerados), mas NÃO É REPASSADO: o desenho é segredo até a
 *   revelação. O servidor guarda os traços de cada um (quem recarrega a página recebe o dele de volta).
 * - A FRASE É CONTEÚDO DE QUEM ESCREVE: aparece como foi escrita, sem tradução, com o tamanho cortado, e passa pelas regras de
 *   conteúdo da moderação da comunidade (texto-do-jogo.ts); barrada, volta como erro e a pessoa reescreve.
 * - Sem pontos: a graça é ver no que a frase virou. Quem não entrega a tempo deixa o passo vazio (a tela diz), e a corrente segue.
 */

export const TELEFONE_MINIMO = 3;
export const TELEFONE_MAXIMO = 8;
export const ESCREVENDO_MS = 45_000;
export const ADIVINHANDO_MS = 40_000;
export const DESENHANDO_NO_TELEFONE_MS = 80_000;
/** A revelação: cada passo de uma corrente fica este tempo na tela, e entre uma corrente e outra um respiro. */
export const MOSTRAR_PASSO_MS = 4_000;
export const ENTRE_CORRENTES_MS = 3_000;
export const TAMANHO_DA_FRASE = 80;
/** Teto de pontos por desenho, como no desenho de sempre. */
export const PONTOS_POR_DESENHO_NO_TELEFONE = 30_000;

type Fase = 'escrevendo' | 'desenhando' | 'adivinhando' | 'mostrando' | 'fim';

interface Traco {
  c: number;
  e: number;
  partes: Map<number, number[]>;
}
type Rascunho = { texto: string; tracos: Map<number, Traco>; pontos: number };
type Passo = { tipo: 'frase'; autor: number; texto: string } | { tipo: 'desenho'; autor: number; tracos: Map<number, Traco> };

/** O tipo do passo `s`: o primeiro é escrever, os ímpares desenhar, os outros adivinhar. */
export const tipoDoPasso = (s: number): 'escrever' | 'desenhar' | 'adivinhar' => (s === 0 ? 'escrever' : s % 2 ? 'desenhar' : 'adivinhar');
/** A corrente em que a pessoa `j` (na ordem) trabalha no passo `s`, com `n` pessoas. */
export const correnteDe = (j: number, s: number, n: number) => (((j - s) % n) + n) % n;

const tracosPublicos = (tracos: Map<number, Traco>) => [...tracos.entries()].map(([t, tr]) => ({ t, c: tr.c, e: tr.e, partes: [...tr.partes.entries()] }));

export interface OpcoesDoTelefone {
  cores: number;
  espessuras: number;
  balde: number;
  baldesPorDesenho: number;
  tempos: number[];
}

export function comecarTelefone(ctx: Contexto, naSala: number[], corpo: Record<string, unknown>, o: OpcoesDoTelefone): Jogo | string {
  if (naSala.length < TELEFONE_MINIMO) return 'O telefone sem fio precisa de pelo menos 3 pessoas.';
  prepararModeracao();
  const desenhandoMs = o.tempos.includes(Number(corpo.tempoMs)) ? Number(corpo.tempoMs) : DESENHANDO_NO_TELEFONE_MS;
  const largada = { modo: 'telefone', tempoMs: desenhandoMs };
  const ordem = embaralhar([...naSala]).slice(0, TELEFONE_MAXIMO);
  const n = ordem.length;
  /** A corrente k começa com ordem[k]. */
  const correntes: Passo[][] = ordem.map(() => []);
  let passo = 0;
  let fase: Fase = 'escrevendo';
  let rascunhos = new Map<number, Rascunho>();
  const entregues = new Set<number>();
  /** Na revelação: a corrente e até qual passo dela já apareceu. */
  let mostrando = { corrente: 0, ate: 0 };

  const novoRascunho = (): Rascunho => ({ texto: '', tracos: new Map(), pontos: 0 });
  const rascunhoDe = (id: number) => {
    let r = rascunhos.get(id);
    if (!r) rascunhos.set(id, (r = novoRascunho()));
    return r;
  };
  const tempoDoPasso = (s: number) => (tipoDoPasso(s) === 'escrever' ? ESCREVENDO_MS : tipoDoPasso(s) === 'desenhar' ? desenhandoMs : ADIVINHANDO_MS);
  const faseDoPasso = (s: number): Fase => (tipoDoPasso(s) === 'escrever' ? 'escrevendo' : tipoDoPasso(s) === 'desenhar' ? 'desenhando' : 'adivinhando');

  function comecarPasso() {
    rascunhos = new Map();
    entregues.clear();
    fase = faseDoPasso(passo);
    ctx.agendar(tempoDoPasso(passo), fecharPasso);
    ctx.avisar();
  }

  /** O passo acabou (todos entregaram, ou o relógio): o que cada um fez vai para a corrente em que trabalhava. */
  function fecharPasso() {
    if (fase !== 'escrevendo' && fase !== 'desenhando' && fase !== 'adivinhando') return;
    ordem.forEach((id, j) => {
      const r = rascunhos.get(id) ?? novoRascunho();
      const k = correnteDe(j, passo, n);
      correntes[k].push(tipoDoPasso(passo) === 'desenhar' ? { tipo: 'desenho', autor: id, tracos: r.tracos } : { tipo: 'frase', autor: id, texto: r.texto });
    });
    passo++;
    // com menos de 2 na sala, não há a quem passar: vai direto à revelação do que já existe
    if (passo >= n || ctx.naSala().length < 2) return comecarRevelacao();
    comecarPasso();
  }

  function comecarRevelacao() {
    fase = 'mostrando';
    mostrando = { corrente: 0, ate: 0 };
    ctx.agendar(MOSTRAR_PASSO_MS, avancar);
    ctx.avisar();
  }

  /** Mais um passo da corrente aparece; acabada a corrente, a próxima; acabadas todas, o fim. */
  function avancar() {
    if (fase !== 'mostrando') return;
    const tamanho = correntes[mostrando.corrente].length;
    if (mostrando.ate < tamanho - 1) {
      mostrando = { ...mostrando, ate: mostrando.ate + 1 };
      ctx.agendar(mostrando.ate === tamanho - 1 ? MOSTRAR_PASSO_MS + ENTRE_CORRENTES_MS : MOSTRAR_PASSO_MS, avancar);
    } else if (mostrando.corrente < n - 1) {
      mostrando = { corrente: mostrando.corrente + 1, ate: 0 };
      ctx.agendar(MOSTRAR_PASSO_MS, avancar);
    } else {
      fase = 'fim';
      ctx.terminar();
      return;
    }
    ctx.avisar();
  }

  /** O passo anterior da corrente em que `j` trabalha agora (o que ele vê). */
  const anteriorDe = (j: number) => (passo > 0 ? correntes[correnteDe(j, passo, n)][passo - 1] : null);

  const passoPublico = (p: Passo) =>
    p.tipo === 'frase'
      ? { tipo: 'frase' as const, autor: p.autor, texto: p.texto }
      : { tipo: 'desenho' as const, autor: p.autor, tracos: tracosPublicos(p.tracos) };

  /** Quem está na sala e ainda não entregou: sem ninguém, o passo fecha na hora. */
  const conferirEntregas = () => {
    const sala = ctx.naSala();
    if (ordem.filter((id) => sala.includes(id)).every((id) => entregues.has(id))) fecharPasso();
    else ctx.avisar();
  };

  comecarPasso();

  return {
    publico(quem) {
      const j = ordem.indexOf(quem);
      const trabalhando = fase === 'escrevendo' || fase === 'desenhando' || fase === 'adivinhando';
      const meu = trabalhando && j >= 0 ? rascunhos.get(quem) : undefined;
      const anterior = trabalhando && j >= 0 ? anteriorDe(j) : null;
      // na revelação, as correntes até onde já apareceram; no fim, todas
      const reveladas =
        fase === 'mostrando'
          ? correntes.slice(0, mostrando.corrente + 1).map((c, k) => (k < mostrando.corrente ? c : c.slice(0, mostrando.ate + 1)))
          : fase === 'fim'
            ? correntes
            : [];
      return {
        modo: 'telefone',
        fase,
        passo: passo + 1,
        passos: n,
        tarefa: trabalhando ? tipoDoPasso(passo) : null,
        tempoMs: trabalhando ? tempoDoPasso(passo) : MOSTRAR_PASSO_MS,
        largada,
        jogadores: ordem.map((userId) => ({ userId, username: ctx.nome(userId), pronto: entregues.has(userId) })),
        // o que eu recebi: a frase para desenhar, ou o desenho para adivinhar
        anterior: anterior ? passoPublico(anterior) : null,
        meu: meu ? { texto: meu.texto, tracos: tracosPublicos(meu.tracos) } : null,
        entregue: entregues.has(quem),
        mostrando: fase === 'mostrando' ? mostrando : null,
        correntes: reveladas.map((c, k) => ({ dono: ordem[k], passos: c.map(passoPublico) })),
        // o desenho de sempre mostra o placar; aqui não há pontos (a lista de quem joga, para a tela de fim)
        placar: ordem.map((userId) => ({ userId, username: ctx.nome(userId), pontos: 0 })),
      };
    },
    acao(quem, corpo) {
      const j = ordem.indexOf(quem);
      if (j < 0) return 'Você está assistindo esta partida.';
      const trabalhando = fase === 'escrevendo' || fase === 'desenhando' || fase === 'adivinhando';
      if (corpo.tipo === 'frase') {
        if (!trabalhando || tipoDoPasso(passo) === 'desenhar') return 'Agora não é hora de escrever.';
        if (entregues.has(quem)) return null;
        const texto = String(corpo.texto ?? '').replace(/\s+/g, ' ').trim().slice(0, TAMANHO_DA_FRASE);
        if (!texto) return 'Escreva alguma coisa.';
        const barrado = textoBarrado(ctx.comunidade, quem, texto);
        if (barrado) return barrado;
        rascunhoDe(quem).texto = texto;
        entregues.add(quem);
        conferirEntregas();
        return null;
      }
      if (corpo.tipo === 'pronto') {
        if (!trabalhando || tipoDoPasso(passo) !== 'desenhar') return 'Agora não é hora de entregar o desenho.';
        entregues.add(quem);
        conferirEntregas();
        return null;
      }
      if (corpo.tipo === 'limpar' || corpo.tipo === 'desfazer') {
        if (fase !== 'desenhando' || entregues.has(quem)) return 'Agora não é hora de mexer no desenho.';
        const r = rascunhoDe(quem);
        if (corpo.tipo === 'limpar') {
          r.tracos = new Map();
          r.pontos = 0;
        } else {
          const ultimo = Math.max(-1, ...r.tracos.keys());
          for (const parte of r.tracos.get(ultimo)?.partes.values() ?? []) r.pontos -= parte.length / 2;
          r.tracos.delete(ultimo);
        }
        ctx.avisar();
        return null;
      }
      if (corpo.tipo === 'proximo') {
        // na revelação, qualquer pessoa da partida passa adiante (o relógio já anda sozinho)
        if (fase !== 'mostrando') return 'Agora não é hora de passar adiante.';
        avancar();
        return null;
      }
      return 'Ação desconhecida.';
    },
    tempoReal(quem, dados) {
      if (fase !== 'desenhando' || !ordem.includes(quem) || entregues.has(quem) || typeof dados !== 'object' || dados === null) return null;
      const { t, i, c, e, p } = dados as Record<string, unknown>;
      const inteiro = (x: unknown, max: number) => Number.isInteger(x) && (x as number) >= 0 && (x as number) <= max;
      const balde = e === o.balde;
      if (!inteiro(t, 100_000) || !inteiro(i, 5_000) || !inteiro(c, o.cores - 1) || (!balde && !inteiro(e, o.espessuras - 1))) return null;
      if (!Array.isArray(p) || p.length === 0 || p.length > 400 || p.length % 2 !== 0 || !p.every((x) => inteiro(x, 1000))) return null;
      if (balde && (p.length !== 2 || i !== 0)) return null;
      const r = rascunhoDe(quem);
      if (balde && !r.tracos.has(t as number) && [...r.tracos.values()].filter((tr) => tr.e === o.balde).length >= o.baldesPorDesenho) return null;
      const traco = r.tracos.get(t as number) ?? { c: c as number, e: e as number, partes: new Map() };
      const antes = (traco.partes.get(i as number)?.length ?? 0) / 2;
      if (r.pontos - antes + p.length / 2 > PONTOS_POR_DESENHO_NO_TELEFONE) return null;
      r.pontos += p.length / 2 - antes;
      traco.partes.set(i as number, p as number[]);
      r.tracos.set(t as number, traco);
      // guardado, e NÃO repassado: o desenho é segredo até a revelação
      return null;
    },
    conferir() {
      if (fase === 'escrevendo' || fase === 'desenhando' || fase === 'adivinhando') {
        // quem saiu da sala não segura o passo dos outros
        const sala = ctx.naSala();
        if (sala.length < 2) return fecharPasso();
        if (ordem.filter((id) => sala.includes(id)).every((id) => entregues.has(id))) fecharPasso();
      }
    },
  };
}
