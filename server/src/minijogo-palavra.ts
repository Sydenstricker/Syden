import { readFileSync } from 'node:fs';
import { embaralhar, placar, type Definicao } from './minijogo-motor.js';
import { guardarRecordeDoSolo, lerRecordeDoSolo } from './recorde-solo-tardio.js';

/**
 * A PALAVRA SECRETA (14/10/2026): o Termo da turma, em corrida. Todo mundo recebe a MESMA palavra de 5 letras e tem 6
 * chutes, cada um no seu quadro. A sala vê as cores dos quadros dos outros subindo, nunca as letras — como quem
 * compartilha o resultado do Termo, só que ao vivo. São 3 palavras, uma por rodada.
 *
 * AS PALAVRAS, e por que são duas listas (ver server/assets/palavra-secreta/):
 * - `sorteio.txt`: as que podem SAIR. Escritas para o Syden (palavras comuns, nada de verbo conjugado nem de
 *   palavrão), como a lista do desenha e adivinha. Cada uma foi conferida contra o dicionário abaixo.
 * - `validas.txt`: as que se pode CHUTAR, ~18 mil, tiradas do VERO (o corretor ortográfico do LibreOffice, LGPLv3 e
 *   MPL; o leia-me dele está ao lado). Ela fica SÓ no servidor: o site manda o chute e recebe as cores. Cada linha
 *   é a palavra sem acento e, quando a grafia é uma só e tem acento, a grafia certa depois do tab.
 * Como no Termo, os acentos não contam: escreve-se "aviao", e a tela mostra "avião".
 *
 * Por enquanto só em português: o dicionário é o que decide se um idioma pode ter o jogo, e tradução não produz um.
 */

const PASTA = new URL('../assets/palavra-secreta/', import.meta.url);
export const SORTEIO: string[] = readFileSync(new URL('sorteio.txt', PASTA), 'utf8').split('\n').filter(Boolean);
const GRAFIA = new Map<string, string>();
for (const linha of readFileSync(new URL('validas.txt', PASTA), 'utf8').split('\n')) {
  if (!linha) continue;
  const [chave, grafia] = linha.split('\t');
  GRAFIA.set(chave, grafia ?? chave);
}

export const RODADAS_PALAVRA = 3;
export const CHUTES = 6;
export const PALAVRA_MS = 3 * 60_000;
export const REVELACAO_MS = 6_000;

export const semAcento = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

// A grafia da palavra SORTEADA (a nossa, com acento) vale para quem chuta essa mesma palavra. Antes ela sobrescrevia a do
// dicionário, e outra palavra válida com as mesmas letras ("avos" contra a sorteada "avós") aparecia com o acento errado.
const GRAFIA_SORTEADA = new Map(SORTEIO.map((p) => [semAcento(p).replace(/ç/g, 'c'), p]));
for (const [chave, p] of GRAFIA_SORTEADA) if (!GRAFIA.has(chave)) GRAFIA.set(chave, p);

/** É uma palavra que se pode chutar? */
export const valida = (chave: string) => GRAFIA.has(chave);

/**
 * As cores de um chute, como no Termo: 2 = letra no lugar, 1 = a letra existe noutro lugar, 0 = não existe. A letra
 * repetida só fica amarela quantas vezes ela ainda sobra na palavra (os verdes contam primeiro).
 */
export function cores(chute: string, palavra: string): number[] {
  const saida = [0, 0, 0, 0, 0];
  const sobra = new Map<string, number>();
  for (let i = 0; i < 5; i++) {
    if (chute[i] === palavra[i]) saida[i] = 2;
    else sobra.set(palavra[i], (sobra.get(palavra[i]) ?? 0) + 1);
  }
  for (let i = 0; i < 5; i++) {
    if (saida[i] === 2) continue;
    const n = sobra.get(chute[i]) ?? 0;
    if (n > 0) {
      saida[i] = 1;
      sobra.set(chute[i], n - 1);
    }
  }
  return saida;
}

/**
 * OS MODOS (19/11/2026, a auditoria dos mini-games):
 * - DUETO e QUARTETO: 2 ou 4 palavras ao mesmo tempo, e cada chute vale para todas as que ainda faltam (7 e 9 chutes).
 * - DIFÍCIL: a letra já revelada tem de ser usada — o verde no mesmo lugar, o amarelo em algum lugar.
 * - SOLO: uma palavra (ou um dueto, um quarteto) de cada vez; "Jogar de novo" traz a próxima.
 */
export const PALAVRAS_POR_MODO = { normal: 1, dueto: 2, quarteto: 4 } as const;
export type ModoDaPalavra = keyof typeof PALAVRAS_POR_MODO;
export const CHUTES_POR_MODO: Record<ModoDaPalavra, number> = { normal: CHUTES, dueto: 7, quarteto: 9 };
export const PALAVRA_SOLO_MS = 10 * 60_000;

/**
 * A SEQUÊNCIA DO SOLO, e por que é ela o recorde (decisão de 19/11/2026). O pedido era um recorde sem "volte todo dia". A média
 * de chutes pede muitas partidas para dizer alguma coisa, e a primeira partida virava recorde fácil de não bater nunca. As
 * VITÓRIAS SEGUIDAS NA MESMA SESSÃO dizem quanto a pessoa está jogando bem agora: acertar soma 1, errar zera, e a sequência mora
 * só na memória do servidor e SE PERDE com 30 minutos parada (é da sessão, não do calendário: ninguém é chamado de volta amanhã).
 * O recorde guardado (a tabela comum, maior é melhor) é a maior sequência, por modo e com ou sem o difícil.
 */
export const SESSAO_MS = 30 * 60_000;
const sequencias = new Map<string, { seguidas: number; em: number }>();
/** Para os testes. */
export const _sequencias = sequencias;

/**
 * O chute do modo difícil respeita as dicas? O verde de antes no mesmo lugar, e cada letra revelada (verde ou amarela) tantas
 * vezes quantas ela foi revelada. `anteriores`: os chutes de antes, sem acento, com as cores de UMA palavra.
 */
export function respeitaAsDicas(chute: string, anteriores: { chave: string; cores: number[] }[]): boolean {
  for (const { chave, cores: cs } of anteriores) {
    if (cs.length !== 5) continue;
    const precisa = new Map<string, number>();
    for (let i = 0; i < 5; i++) {
      if (cs[i] === 2 && chute[i] !== chave[i]) return false;
      if (cs[i] >= 1) precisa.set(chave[i], (precisa.get(chave[i]) ?? 0) + 1);
    }
    for (const [letra, n] of precisa) if ([...chute].filter((l) => l === letra).length < n) return false;
  }
  return true;
}

interface Chute {
  texto: string;
  /** Sem acento: é o que se compara no modo difícil. */
  chave: string;
  /** As cores para cada palavra da rodada ([] na palavra que já tinha sido acertada antes deste chute). */
  cores: number[][];
}

interface Quadro {
  chutes: Chute[];
  /** Para cada palavra: em que chute (1, 2…) ela foi acertada, ou null. */
  resolvidas: (number | null)[];
  acertouEm: number | null;
}

/** Os pontos de quem acerta: menos chutes, mais pontos (6 no primeiro chute, 1 no sexto), e +1 para o primeiro a acertar. */
export const pontosDoAcerto = (chutes: number, maximo = CHUTES) => Math.max(1, maximo + 1 - chutes);

/** Para os testes: as palavras da próxima partida, em vez do sorteio (rodada a rodada; no dueto, duas por rodada). */
export const _teste: { palavras: string[] | null } = { palavras: null };

export const palavra: Definicao = {
  comecar(ctx, { naSala, criadaPor, corpo }) {
    const modo: ModoDaPalavra = String(corpo.modo) in PALAVRAS_POR_MODO ? (String(corpo.modo) as ModoDaPalavra) : 'normal';
    const dificil = corpo.dificil === true;
    const porRodada = PALAVRAS_POR_MODO[modo];
    const maxChutes = CHUTES_POR_MODO[modo];
    const rodadas = ctx.solo ? 1 : RODADAS_PALAVRA;
    const tempo = ctx.solo ? PALAVRA_SOLO_MS : PALAVRA_MS;
    if (SORTEIO.length < rodadas * porRodada) return 'As palavras não estão no servidor.';
    const sorteadas = _teste.palavras ?? embaralhar([...SORTEIO]).slice(0, rodadas * porRodada);
    const largada = { modo, dificil };
    let rodada = 1;
    let fase: 'chutando' | 'revelando' | 'fim' = 'chutando';
    let inicio = Date.now();
    const quadros = new Map<number, Quadro>();
    const pontos = new Map(naSala.map((id) => [id, 0]));
    // A sequência do Solo (ver SESSAO_MS): mostrada desde o começo, e decidida no fim.
    const chaveDaSequencia = `${criadaPor}:${modo}${dificil ? ':dificil' : ''}`;
    const varianteDoRecorde = `${modo}${dificil ? ':dificil' : ''}`;
    let sequencia: { atual: number; recorde: number | null; novo: boolean } | null = null;
    if (ctx.solo) {
      const s = sequencias.get(chaveDaSequencia);
      const atual = s && Date.now() - s.em <= SESSAO_MS ? s.seguidas : 0;
      const seq = { atual, recorde: null as number | null, novo: false };
      sequencia = seq;
      lerRecordeDoSolo(criadaPor, 'palavra', varianteDoRecorde, (r) => {
        if (!seq.novo) seq.recorde = r?.valor ?? null;
        ctx.avisar();
      });
    }
    // Todo mundo da sala acertou ou gastou os chutes (quem saiu da sala não segura os outros): a palavra aparece na hora.
    const todosProntos = () => {
      const naSalaAgora = ctx.naSala();
      return [...quadros.entries()].every(([id, x]) => x.acertouEm !== null || x.chutes.length >= maxChutes || !naSalaAgora.includes(id));
    };
    const daRodada = () => sorteadas.slice((rodada - 1) * porRodada, rodada * porRodada);
    const secretas = () => daRodada().map((p) => semAcento(p).replace(/ç/g, 'c'));
    const quadroNovo = (): Quadro => ({ chutes: [], resolvidas: Array<number | null>(porRodada).fill(null), acertouEm: null });

    function novaRodada() {
      quadros.clear();
      for (const id of pontos.keys()) quadros.set(id, quadroNovo());
      fase = 'chutando';
      inicio = Date.now();
      ctx.agendar(tempo, revelar);
      ctx.avisar();
    }

    function revelar() {
      if (fase !== 'chutando') return;
      // Cada palavra acertada vale pelos chutes que levou; quem acertou todas primeiro ganha +1.
      for (const [id, q] of quadros) {
        for (const n of q.resolvidas) if (n !== null) pontos.set(id, (pontos.get(id) ?? 0) + pontosDoAcerto(n, maxChutes));
      }
      const primeiro = [...quadros.entries()]
        .filter(([, q]) => q.acertouEm !== null)
        .sort(([, a], [, b]) => (a.acertouEm ?? 0) - (b.acertouEm ?? 0))[0];
      if (primeiro) pontos.set(primeiro[0], (pontos.get(primeiro[0]) ?? 0) + 1);
      if (ctx.solo && sequencia) {
        const s = sequencia;
        const venceu = (quadros.get(criadaPor)?.acertouEm ?? null) !== null;
        const seguidas = venceu ? s.atual + 1 : 0;
        sequencias.set(chaveDaSequencia, { seguidas, em: Date.now() });
        s.atual = seguidas;
        if (seguidas > 0) {
          guardarRecordeDoSolo(criadaPor, 'palavra', varianteDoRecorde, seguidas, false, { chutes: quadros.get(criadaPor)?.chutes.length ?? 0 }, (r) => {
            s.novo = r.novo;
            s.recorde = r.novo ? seguidas : r.antes;
            ctx.avisar();
          });
        }
      }
      fase = 'revelando';
      ctx.agendar(REVELACAO_MS, () => {
        if (rodada >= rodadas) {
          fase = 'fim';
          return ctx.terminar();
        }
        rodada++;
        novaRodada();
      });
      ctx.avisar();
    }

    novaRodada();
    return {
      publico(quem) {
        const meu = quadros.get(quem);
        const aberta = fase !== 'chutando';
        return {
          rodada,
          rodadas,
          fase,
          chutes: maxChutes,
          palavras: porRodada,
          dificil,
          modo,
          largada,
          // O meu quadro com as letras; dos outros, só as cores. `cores` é a da primeira palavra (a tela de antes do dueto).
          meu: (meu?.chutes ?? []).map((c) => ({ texto: c.texto, cores: c.cores[0] ?? [], coresTodas: c.cores })),
          resolvidas: meu?.resolvidas ?? Array<number | null>(porRodada).fill(null),
          acertei: meu !== undefined && meu.acertouEm !== null,
          // A palavra COM acento (a nossa grafia: "avião", "dança").
          palavra: aberta ? daRodada()[0] : null,
          palavrasReveladas: aberta ? daRodada() : null,
          outros: [...quadros.entries()].map(([userId, q]) => ({
            userId,
            username: ctx.nome(userId),
            cores: q.chutes.map((c) => c.cores[0] ?? []),
            coresTodas: q.chutes.map((c) => c.cores),
            acertou: q.acertouEm !== null,
            // Na revelação a sala vê também as letras de todo mundo.
            letras: aberta ? q.chutes.map((c) => c.texto) : null,
          })),
          sequencia,
          placar: placar(pontos, ctx.nome),
        };
      },
      acao(quem, corpo) {
        if (corpo.tipo !== 'chute') return 'Ação desconhecida.';
        if (fase !== 'chutando') return 'Esta rodada já acabou.';
        const chave = semAcento(String(corpo.texto ?? '').trim());
        if (!/^[a-zç]{5}$/.test(chave)) return 'Escreva uma palavra de 5 letras.';
        const limpa = chave.replace(/ç/g, 'c');
        if (!valida(limpa)) return 'Essa palavra não está na lista.';
        let q = quadros.get(quem);
        if (!q) {
          q = quadroNovo();
          quadros.set(quem, q);
          if (!pontos.has(quem)) pontos.set(quem, 0);
        }
        const quadro = q;
        if (quadro.acertouEm !== null || quadro.chutes.length >= maxChutes) return null;
        // O mesmo chute duas vezes não gasta outra tentativa (Enter apertado duas vezes com a internet lenta).
        if (quadro.chutes.some((c) => c.chave === limpa)) return 'Você já chutou essa palavra.';
        const alvo = secretas();
        if (dificil) {
          const respeita = alvo.every(
            (_, b) => quadro.resolvidas[b] !== null || respeitaAsDicas(limpa, quadro.chutes.map((c) => ({ chave: c.chave, cores: c.cores[b] ?? [] }))),
          );
          if (!respeita) return 'No modo difícil, use as letras já reveladas.';
        }
        const grafia = alvo.includes(limpa) ? (GRAFIA_SORTEADA.get(limpa) ?? limpa) : (GRAFIA.get(limpa) ?? limpa);
        quadro.chutes.push({ texto: grafia, chave: limpa, cores: alvo.map((p, b) => (quadro.resolvidas[b] !== null ? [] : cores(limpa, p))) });
        alvo.forEach((p, b) => {
          if (quadro.resolvidas[b] === null && p === limpa) quadro.resolvidas[b] = quadro.chutes.length;
        });
        if (quadro.resolvidas.every((n) => n !== null)) quadro.acertouEm = Date.now() - inicio;
        if (todosProntos()) revelar();
        else ctx.avisar();
        return null;
      },
      conferir() {
        if (fase === 'chutando' && quadros.size > 0 && todosProntos()) revelar();
      },
    };
  },
};
