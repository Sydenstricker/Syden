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
 * O dicionário é o que decide se um idioma pode ter o jogo, e tradução não produz um. Ver IDIOMAS, abaixo.
 */

const PASTA = new URL('../assets/palavra-secreta/', import.meta.url);

/**
 * OS TAMANHOS (21/11/2026, o lote D da segunda auditoria): palavras de 4, 5 ou 6 letras, escolhidas na largada. A de 5 continua
 * a de fábrica, com as listas de sempre (`sorteio.txt`, `validas.txt`); as de 4 e de 6 têm as delas (`sorteio-4.txt`,
 * `validas-4.txt`…), as que saem também NOSSAS e as que se chutam do VERO, pelo mesmo script (server/scripts/palavras-do-vero.py
 * com o tamanho). O recorde do Solo de 4 e de 6 é à parte (a variante ganha "@4", "@6").
 */
export const TAMANHOS = [4, 5, 6] as const;
export type Tamanho = (typeof TAMANHOS)[number];
export const TAMANHO_PADRAO: Tamanho = 5;
const sufixo = (n: Tamanho) => (n === TAMANHO_PADRAO ? '' : `-${n}`);

/**
 * OS IDIOMAS (24/11/2026, o lote E da segunda auditoria): português, inglês, espanhol e francês, escolhidos na largada. Cada um tem as
 * listas dele numa pasta (o português na raiz de server/assets/palavra-secreta/, os outros em en/, es/, fr/ e de/, cada um com o leia-me
 * e a licença do dicionário): as que SAEM são NOSSAS, e as que se CHUTAM vêm de um corretor do LibreOffice pelo mesmo script
 * (server/scripts/palavras-do-vero.py com --lingua). O inglês é o en_US (SCOWL, licença permissiva); o espanhol, o RLA-ES
 * (GPL/LGPL/MPL à escolha: usamos a LGPL/MPL); o francês, o Grammalecte (MPL 2.0). O ALEMÃO não tem corretor que sirva (o
 * igerman98 é GPL, ou a OASIS, que não deixa modificar e só vale para programas de documentos ODF): os chutes vêm da wortliste
 * do projeto Trennmuster (MIT), por server/scripts/palavras-do-alemao.mjs, e a chave é só a-z (ä → ae, ß → ss). O italiano
 * ficou de fora (o corretor e o thesaurus são GPL 3; o Morph-it! tem a licença ambígua).
 * Quem começa escolhe; sem escolha, o português. O recorde e a sequência do Solo são à parte por idioma (a variante ganha
 * "~en", "~es"…; o português continua na de sempre).
 */
export const IDIOMAS = ['pt', 'en', 'es', 'fr', 'de'] as const;
export type IdiomaDaPalavra = (typeof IDIOMAS)[number];
export const IDIOMA_PADRAO: IdiomaDaPalavra = 'pt';
/** "en-US", "es-419", "pt-BR" → o idioma do jogo; qualquer outro, o português. */
export const idiomaDaPalavra = (x: unknown): IdiomaDaPalavra => {
  const base = String(x ?? '').toLowerCase().split(/[-_]/)[0];
  return (IDIOMAS as readonly string[]).includes(base) ? (base as IdiomaDaPalavra) : IDIOMA_PADRAO;
};
/** As letras de cada idioma, já na chave: o ç do português vira c; o ñ do espanhol é uma letra à parte. */
const LETRAS: Record<IdiomaDaPalavra, string> = { pt: 'a-z', en: 'a-z', es: 'a-zñ', fr: 'a-z', de: 'a-z' };
/**
 * A chave de um texto: em minúscula e sem acento, como no Termo. No espanhol o ñ fica (é outra letra: "niño" não é "nino"),
 * e o ü vira u; no português o ç vira c.
 */
export function chaveDe(texto: string, idioma: IdiomaDaPalavra = IDIOMA_PADRAO): string {
  let t = texto.normalize('NFC').toLowerCase();
  // no alemão, as letras com trema e o ß viram duas (BÄR é BAER), como nos jogos de palavra em alemão que usam só a-z
  if (idioma === 'de') t = t.replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');
  // (o ñ se esconde num caractere de uso privado enquanto os acentos saem)
  if (idioma === 'es') t = t.replace(/ñ/g, ESCONDIDO);
  t = t.normalize('NFD').replace(/\p{Mn}/gu, '');
  return t.split(ESCONDIDO).join('ñ').replace(/ç/g, 'c');
}
const ESCONDIDO = String.fromCharCode(0xe000);
const pastaDo = (idioma: IdiomaDaPalavra) => (idioma === 'pt' ? '' : `${idioma}/`);
const lerLinhas = (arquivo: string) =>
  readFileSync(new URL(arquivo, PASTA), 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

export const semAcento = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

interface Dicionario {
  sorteio: string[];
  /** A chave sem acento → a grafia (a do VERO, ou a nossa quando a palavra é das que saem). */
  grafia: Map<string, string>;
  /** A grafia da palavra SORTEADA (a nossa, com acento) vale para quem chuta essa mesma palavra. */
  sorteada: Map<string, string>;
  /**
   * As palavras que saem com MAIS DE UMA GRAFIA para a mesma chave ("vovó" e "vovô": o jogo ignora o acento, as duas são VOVO).
   * Sai uma vez só (antes, o dobro de chance), e a revelação mostra as duas: "vovó / vovô" (a barra, porque o " · " já separa as palavras do dueto na tela). (24/11/2026)
   */
  revelada: Map<string, string>;
}
function lerDicionario(n: Tamanho, idioma: IdiomaDaPalavra = IDIOMA_PADRAO): Dicionario {
  const linhas = lerLinhas(`${pastaDo(idioma)}sorteio${sufixo(n)}.txt`);
  const grafias = new Map<string, string[]>();
  for (const p of linhas) grafias.set(chaveDe(p, idioma), [...(grafias.get(chaveDe(p, idioma)) ?? []), p]);
  const sorteio = [...grafias.values()].map((gs) => gs[0]);
  const revelada = new Map([...grafias].filter(([, gs]) => gs.length > 1).map(([k, gs]) => [k, gs.join(' / ')]));
  const grafia = new Map<string, string>();
  for (const linha of lerLinhas(`${pastaDo(idioma)}validas${sufixo(n)}.txt`)) {
    const [chave, g] = linha.split('\t');
    grafia.set(chave, g ?? chave);
  }
  // Antes a grafia sorteada sobrescrevia a do dicionário, e outra palavra válida com as mesmas letras ("avos" contra a
  // sorteada "avós") aparecia com o acento errado: agora ela só vale para quem chuta a sorteada.
  const sorteada = new Map(sorteio.map((p) => [chaveDe(p, idioma), p]));
  for (const [chave, p] of sorteada) if (!grafia.has(chave)) grafia.set(chave, p);
  return { sorteio, grafia, sorteada, revelada };
}
/** Os de cada idioma e tamanho. */
export const DICIONARIOS_POR_IDIOMA = Object.fromEntries(
  IDIOMAS.map((idioma) => [idioma, Object.fromEntries(TAMANHOS.map((n) => [n, lerDicionario(n, idioma)]))]),
) as Record<IdiomaDaPalavra, Record<Tamanho, Dicionario>>;
/** Os do português (o nome de sempre, para os testes). */
export const DICIONARIOS = DICIONARIOS_POR_IDIOMA.pt;
/** A frase de cada tamanho escrita inteira: o site traduz o erro pela frase exata (web/src/errosDoServidor.ts). */
const ERRO_DO_TAMANHO: Record<Tamanho, string> = {
  4: 'Escreva uma palavra de 4 letras.',
  5: 'Escreva uma palavra de 5 letras.',
  6: 'Escreva uma palavra de 6 letras.',
};

/** As de 5 letras que podem sair (o nome de sempre, para os testes). */
export const SORTEIO: string[] = DICIONARIOS[5].sorteio;

export const RODADAS_PALAVRA = 3;
export const CHUTES = 6;
export const PALAVRA_MS = 3 * 60_000;
export const REVELACAO_MS = 6_000;

/** É uma palavra que se pode chutar? */
export const valida = (chave: string, n: Tamanho = TAMANHO_PADRAO, idioma: IdiomaDaPalavra = IDIOMA_PADRAO) =>
  DICIONARIOS_POR_IDIOMA[idioma][n].grafia.has(chave);

/**
 * As cores de um chute, como no Termo: 2 = letra no lugar, 1 = a letra existe noutro lugar, 0 = não existe. A letra
 * repetida só fica amarela quantas vezes ela ainda sobra na palavra (os verdes contam primeiro).
 */
export function cores(chute: string, palavra: string): number[] {
  const n = palavra.length;
  const saida = Array<number>(n).fill(0);
  const sobra = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    if (chute[i] === palavra[i]) saida[i] = 2;
    else sobra.set(palavra[i], (sobra.get(palavra[i]) ?? 0) + 1);
  }
  for (let i = 0; i < n; i++) {
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
    if (cs.length !== chute.length) continue;
    const precisa = new Map<string, number>();
    for (let i = 0; i < cs.length; i++) {
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
  /** No modo Juntos, quem deu o chute (o quadro é um só, da turma). */
  autor?: number;
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
    const letras: Tamanho = (TAMANHOS as readonly number[]).includes(Number(corpo.letras)) ? (Number(corpo.letras) as Tamanho) : TAMANHO_PADRAO;
    const idioma = idiomaDaPalavra(corpo.idioma);
    const dic = DICIONARIOS_POR_IDIOMA[idioma][letras];
    const porRodada = PALAVRAS_POR_MODO[modo];
    const maxChutes = CHUTES_POR_MODO[modo];
    const rodadas = ctx.solo ? 1 : RODADAS_PALAVRA;
    const tempo = ctx.solo ? PALAVRA_SOLO_MS : PALAVRA_MS;
    if (dic.sorteio.length < rodadas * porRodada) return 'As palavras não estão no servidor.';
    const sorteadas = _teste.palavras ?? embaralhar([...dic.sorteio]).slice(0, rodadas * porRodada);
    // O JUNTOS (27/11/2026, pedido dele: "o coletivo similar ao individual, apenas colaborativo"): a turma inteira num quadro só,
    // como o Termo individual, e cada chute (de qualquer um) vale para todos. Só na sala: sozinho, é o Solo de sempre.
    const juntos = corpo.juntos === true && !ctx.solo;
    const largada = { modo, dificil, letras, idioma, ...(juntos ? { juntos: true } : {}) };
    let rodada = 1;
    let fase: 'chutando' | 'revelando' | 'fim' = 'chutando';
    let inicio = Date.now();
    const quadros = new Map<number, Quadro>();
    const pontos = new Map(naSala.map((id) => [id, 0]));
    // A sequência do Solo (ver SESSAO_MS): mostrada desde o começo, e decidida no fim.
    // a de 5 letras continua na variante de sempre; a de 4 e a de 6 têm a delas; e cada idioma fora o português, a dele
    const doTamanho = (letras === TAMANHO_PADRAO ? '' : `@${letras}`) + (idioma === IDIOMA_PADRAO ? '' : `~${idioma}`);
    const chaveDaSequencia = `${criadaPor}:${modo}${dificil ? ':dificil' : ''}${doTamanho}`;
    const varianteDoRecorde = `${modo}${dificil ? ':dificil' : ''}${doTamanho}`;
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
      // Juntos, a rodada acaba quando a turma acerta ou gasta os chutes (quem sai da sala não muda isso).
      if (juntos) return comum.acertouEm !== null || comum.chutes.length >= maxChutes;
      const naSalaAgora = ctx.naSala();
      return [...quadros.entries()].every(([id, x]) => x.acertouEm !== null || x.chutes.length >= maxChutes || !naSalaAgora.includes(id));
    };
    const daRodada = () => sorteadas.slice((rodada - 1) * porRodada, rodada * porRodada);
    const secretas = () => daRodada().map((p) => chaveDe(p, idioma));
    /** As palavras da rodada como a revelação mostra (com as duas grafias, quando a chave tem duas). */
    const reveladas = () => daRodada().map((p) => dic.revelada.get(chaveDe(p, idioma)) ?? p);
    const quadroNovo = (): Quadro => ({ chutes: [], resolvidas: Array<number | null>(porRodada).fill(null), acertouEm: null });
    /** O quadro da turma (só no Juntos). */
    let comum: Quadro = quadroNovo();

    function novaRodada() {
      comum = quadroNovo();
      quadros.clear();
      for (const id of pontos.keys()) quadros.set(id, quadroNovo());
      fase = 'chutando';
      inicio = Date.now();
      ctx.agendar(tempo, revelar);
      ctx.avisar();
    }

    function revelar() {
      if (fase !== 'chutando') return;
      if (juntos) {
        // Os pontos são da turma: cada palavra acertada vale pelos chutes que levou, para todo mundo que está na sala.
        const ganhos = comum.resolvidas.reduce<number>((soma, n) => soma + (n !== null ? pontosDoAcerto(n, maxChutes) : 0), 0);
        for (const id of ctx.naSala()) pontos.set(id, (pontos.get(id) ?? 0) + ganhos);
      } else {
        // Cada palavra acertada vale pelos chutes que levou; quem acertou todas primeiro ganha +1.
        for (const [id, q] of quadros) {
          for (const n of q.resolvidas) if (n !== null) pontos.set(id, (pontos.get(id) ?? 0) + pontosDoAcerto(n, maxChutes));
        }
        const primeiro = [...quadros.entries()]
          .filter(([, q]) => q.acertouEm !== null)
          .sort(([, a], [, b]) => (a.acertouEm ?? 0) - (b.acertouEm ?? 0))[0];
        if (primeiro) pontos.set(primeiro[0], (pontos.get(primeiro[0]) ?? 0) + 1);
      }
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
        if (juntos) {
          // O quadro é de todos: as letras aparecem para a turma inteira, cada linha com quem a deu.
          return {
            rodada,
            rodadas,
            fase,
            chutes: maxChutes,
            palavras: porRodada,
            letras,
            dificil,
            modo,
            idioma,
            largada,
            juntos: true,
            meu: comum.chutes.map((c) => ({
              texto: c.texto,
              cores: c.cores[0] ?? [],
              coresTodas: c.cores,
              autor: c.autor ?? null,
              autorNome: c.autor !== undefined ? ctx.nome(c.autor) : '',
            })),
            resolvidas: comum.resolvidas,
            acertei: comum.acertouEm !== null,
            palavra: aberta ? reveladas()[0] : null,
            palavrasReveladas: aberta ? reveladas() : null,
            outros: [],
            sequencia,
            placar: placar(pontos, ctx.nome),
          };
        }
        return {
          rodada,
          rodadas,
          fase,
          chutes: maxChutes,
          palavras: porRodada,
          letras,
          dificil,
          modo,
          idioma,
          largada,
          // O meu quadro com as letras; dos outros, só as cores. `cores` é a da primeira palavra (a tela de antes do dueto).
          meu: (meu?.chutes ?? []).map((c) => ({ texto: c.texto, cores: c.cores[0] ?? [], coresTodas: c.cores })),
          resolvidas: meu?.resolvidas ?? Array<number | null>(porRodada).fill(null),
          acertei: meu !== undefined && meu.acertouEm !== null,
          // A palavra COM acento (a nossa grafia: "avião", "dança").
          palavra: aberta ? reveladas()[0] : null,
          palavrasReveladas: aberta ? reveladas() : null,
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
        const limpa = chaveDe(String(corpo.texto ?? '').trim(), idioma);
        if (!new RegExp(`^[${LETRAS[idioma]}]{${letras}}$`).test(limpa)) return ERRO_DO_TAMANHO[letras];
        if (!valida(limpa, letras, idioma)) return 'Essa palavra não está na lista.';
        let quadro: Quadro;
        if (juntos) {
          if (!pontos.has(quem)) pontos.set(quem, 0);
          quadro = comum;
        } else {
          let q = quadros.get(quem);
          if (!q) {
            q = quadroNovo();
            quadros.set(quem, q);
            if (!pontos.has(quem)) pontos.set(quem, 0);
          }
          quadro = q;
        }
        if (quadro.acertouEm !== null || quadro.chutes.length >= maxChutes) return null;
        // O mesmo chute duas vezes não gasta outra tentativa (Enter apertado duas vezes com a internet lenta; no Juntos, dois
        // da turma chutando a mesma palavra ao mesmo tempo: vale o primeiro).
        if (quadro.chutes.some((c) => c.chave === limpa)) return juntos ? 'A turma já chutou essa palavra.' : 'Você já chutou essa palavra.';
        const alvo = secretas();
        if (dificil) {
          const respeita = alvo.every(
            (_, b) => quadro.resolvidas[b] !== null || respeitaAsDicas(limpa, quadro.chutes.map((c) => ({ chave: c.chave, cores: c.cores[b] ?? [] }))),
          );
          if (!respeita) return 'No modo difícil, use as letras já reveladas.';
        }
        const grafia = alvo.includes(limpa) ? (dic.sorteada.get(limpa) ?? limpa) : (dic.grafia.get(limpa) ?? limpa);
        quadro.chutes.push({
          texto: grafia,
          chave: limpa,
          cores: alvo.map((p, b) => (quadro.resolvidas[b] !== null ? [] : cores(limpa, p))),
          ...(juntos ? { autor: quem } : {}),
        });
        alvo.forEach((p, b) => {
          if (quadro.resolvidas[b] === null && p === limpa) quadro.resolvidas[b] = quadro.chutes.length;
        });
        if (quadro.resolvidas.every((n) => n !== null)) quadro.acertouEm = Date.now() - inicio;
        if (todosProntos()) revelar();
        else ctx.avisar();
        return null;
      },
      conferir() {
        // Juntos, quem sai da sala não acaba nem segura a rodada: a turma que fica continua.
        if (juntos) return;
        if (fase === 'chutando' && quadros.size > 0 && todosProntos()) revelar();
      },
    };
  },
};
