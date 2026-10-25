import { readFileSync } from 'node:fs';
import { embaralhar, placar, type Definicao } from './minijogo-motor.js';

/**
 * O QUIZ DE ADIVINHAR (24/10/2026): o formato dos "-dle" (Loldle e companhia), em corrida na sala. Sai um item secreto
 * de uma lista (um monstro, um país, uma divindade), e cada um chuta itens da mesma lista. Cada chute volta como uma
 * LINHA de colunas — tipo, tamanho, nível… — com a cor de quanto ela bate com o secreto: verde bate, amarelo bate em
 * parte, vermelho não bate, e a seta diz se o secreto tem mais ou menos. A sala vê as cores dos outros, nunca os nomes,
 * até a revelação (como na Palavra secreta). São 3 itens, um por rodada.
 *
 * UM MOTOR, VÁRIOS TEMAS. O tema é só dados: a lista de itens e as colunas que se comparam. Tema novo é um arquivo em
 * server/assets/quiz/ e uma linha em TEMAS — e é aqui que entra a franquia de terceiro, no dia em que houver licença
 * por escrito (ver a seção dos mini-games no CLAUDE.md: as políticas de fãs proíbem jogo, até gratuito).
 *
 * O chute é o ID do item (o site escolhe da lista), nunca o nome escrito: o nome muda com o idioma, e o servidor não
 * precisa saber como cada língua escreve "Dragão Vermelho Adulto".
 */

/** Como uma coluna se compara. */
export type TipoDeColuna =
  /** Bate ou não bate (o tipo do monstro, o continente). */
  | 'igual'
  /** Número: bate, ou a seta diz para que lado está o secreto (o tamanho, o nível de desafio). */
  | 'ordem'
  /** Lista: bate inteira, bate em parte (amarelo) ou nada em comum (como se desloca: anda, voa, nada). */
  | 'conjunto'
  /** Texto de palavras: igual, ou com alguma palavra em comum ("leal e mau" contra "caótico e mau"). */
  | 'partes'
  /** Um ponto [latitude, longitude]: a distância e o rumo até o secreto (o Worldle). Amarelo até PERTO_KM. */
  | 'distancia';

export interface Coluna {
  id: string;
  tipo: TipoDeColuna;
}

export interface ItemDoQuiz {
  id: string;
  /** O nome: um só (o do SRD, que é próprio), ou por idioma, com o inglês de reserva. */
  nome: string | Record<string, string>;
  [coluna: string]: unknown;
}

export interface Tema {
  itens: ItemDoQuiz[];
  colunas: Coluna[];
  /** Os que podem SAIR (todos podem ser chutados): tira da sorte o que quase ninguém conhece. */
  sorteavel?: (item: ItemDoQuiz) => boolean;
  /** O nome por idioma quando ele não está nos dados (os países: o Intl já sabe todos). */
  nomePor?: (item: ItemDoQuiz, idioma: string) => string;
  /**
   * As CATEGORIAS que quem começa escolhe (como no "Qual é o tamanho?"): o filtro vale para o sorteio E para a lista de
   * chutes. "tudo" é a de reserva, quando o pedido não diz qual (ou diz uma que não existe).
   */
  categorias?: Record<string, (item: ItemDoQuiz) => boolean>;
}

/** Os itens de uma categoria do tema (todos, se o tema não tem categorias ou se ela não existe). */
export function itensDaCategoria(tema: Tema, categoria: unknown): ItemDoQuiz[] {
  const filtro = tema.categorias?.[String(categoria)];
  return filtro ? tema.itens.filter(filtro) : tema.itens;
}

/** 2 = bate, 1 = bate em parte, 0 = não bate. A seta: o secreto tem MAIS (1) ou MENOS (-1). */
export interface Veredito {
  cor: 0 | 1 | 2;
  seta?: 1 | -1;
  /** Na coluna de distância: quantos km e para onde (graus, 0 = norte, 90 = leste) fica o secreto. */
  km?: number;
  rumo?: number;
}

/** Até quantos km a distância fica amarela: o vizinho, ou o país do outro lado da fronteira grande. */
export const PERTO_KM = 1500;

const rad = (graus: number) => (graus * Math.PI) / 180;

/** A distância (km, pelo círculo máximo) e o rumo inicial de `de` até `para`. */
export function distanciaERumo(de: [number, number], para: [number, number]): { km: number; rumo: number } {
  const [la1, lo1, la2, lo2] = [rad(de[0]), rad(de[1]), rad(para[0]), rad(para[1])];
  const a = Math.sin((la2 - la1) / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin((lo2 - lo1) / 2) ** 2;
  const km = Math.round(2 * 6371 * Math.asin(Math.min(1, Math.sqrt(a))));
  const y = Math.sin(lo2 - lo1) * Math.cos(la2);
  const x = Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(lo2 - lo1);
  return { km, rumo: Math.round(((Math.atan2(y, x) * 180) / Math.PI + 360) % 360) };
}

export function comparar(coluna: Coluna, chute: unknown, secreto: unknown): Veredito {
  switch (coluna.tipo) {
    case 'igual':
      return { cor: chute === secreto ? 2 : 0 };
    case 'ordem': {
      const a = Number(chute);
      const b = Number(secreto);
      return a === b ? { cor: 2 } : { cor: 0, seta: b > a ? 1 : -1 };
    }
    case 'conjunto': {
      const a = new Set(chute as string[]);
      const b = new Set(secreto as string[]);
      if (a.size === b.size && [...a].every((x) => b.has(x))) return { cor: 2 };
      return { cor: [...a].some((x) => b.has(x)) ? 1 : 0 };
    }
    case 'distancia': {
      const { km, rumo } = distanciaERumo(chute as [number, number], secreto as [number, number]);
      return km === 0 ? { cor: 2, km: 0 } : { cor: km <= PERTO_KM ? 1 : 0, km, rumo };
    }
    case 'partes': {
      if (chute === secreto) return { cor: 2 };
      const b = new Set(String(secreto).split(' '));
      return { cor: String(chute).split(' ').some((x) => b.has(x)) ? 1 : 0 };
    }
  }
}

const lerItens = (arquivo: string): ItemDoQuiz[] =>
  JSON.parse(readFileSync(new URL(`../assets/quiz/${arquivo}`, import.meta.url), 'utf8')) as ItemDoQuiz[];

/** Os temas. O id é o do jogo na estante (minijogos-routes.ts, JOGOS). */
export const TEMAS: Record<string, Tema> = {
  /**
   * MONSTROS DE FANTASIA: os do SRD 5.1 (CC BY 4.0; o crédito está em server/assets/quiz/monstros-LEIAME.txt e na tela).
   * Os nomes ficam em inglês em todo idioma: são nomes próprios do SRD, e é assim que boa parte das mesas os chama.
   * Sorteiam-se os monstros e os bichos de nível 2 ou mais: "Texugo" e "Rato" são chute, não resposta.
   */
  monstros: {
    itens: lerItens('monstros.json'),
    colunas: [
      { id: 'tipo', tipo: 'igual' },
      { id: 'tamanho', tipo: 'ordem' },
      { id: 'nd', tipo: 'ordem' },
      { id: 'alinhamento', tipo: 'partes' },
      { id: 'deslocamento', tipo: 'conjunto' },
    ],
    sorteavel: (m) => m.tipo !== 'beast' || Number(m.nd) >= 2,
  },
  /**
   * MITOLOGIA: 124 figuras de 11 mitologias, numa lista nossa (server/scripts/quiz-mitologia.mjs), com os nomes de cada
   * idioma tirados do Wikidata (CC0). A coluna da mitologia é de PARTES ("grega europa"): outra mitologia do mesmo
   * continente fica amarela.
   */
  mitologia: {
    itens: lerItens('mitologia.json'),
    // Por continente (pedido dele, 24/10/2026: "é muito difícil como está"): 124 figuras de uma vez deixavam o primeiro
    // chute às cegas. As Américas têm 14, a Ásia 38, a África 24 e a Europa 48.
    categorias: {
      tudo: () => true,
      americas: (f) => String(f.mitologia).endsWith(' americas'),
      asia: (f) => String(f.mitologia).endsWith(' asia'),
      africa: (f) => String(f.mitologia).endsWith(' africa'),
      europa: (f) => String(f.mitologia).endsWith(' europa'),
    },
    colunas: [
      { id: 'mitologia', tipo: 'partes' },
      { id: 'tipo', tipo: 'igual' },
      { id: 'forma', tipo: 'igual' },
      { id: 'dominios', tipo: 'conjunto' },
    ],
  },
  /**
   * PAÍSES (o Worldle, sem anúncio): os 193 da ONU, com os dados da Natural Earth (domínio público). O nome sai do
   * Intl.DisplayNames, que já fala todas as línguas. Saem só os de 500 mil habitantes ou mais (Tuvalu é chute, não
   * resposta); todos podem ser chutados.
   */
  paises: {
    itens: lerItens('paises.json').map((p) => ({ ...p, nome: p.id })),
    colunas: [
      { id: 'local', tipo: 'distancia' },
      { id: 'regiao', tipo: 'igual' },
      { id: 'subregiao', tipo: 'igual' },
      { id: 'populacao', tipo: 'ordem' },
    ],
    sorteavel: (p) => Number(p.populacao) >= 500_000,
    nomePor: (p, idioma) => {
      try {
        return new Intl.DisplayNames([idioma, 'en'], { type: 'region' }).of(p.id) ?? p.id;
      } catch {
        return new Intl.DisplayNames(['en'], { type: 'region' }).of(p.id) ?? p.id;
      }
    },
  },
};

/** O nome de um item na língua de quem lê: a exata, a base ("pt" de "pt-BR"), o inglês, ou o primeiro que houver. */
export function nomeDoItem(item: ItemDoQuiz, idioma: string): string {
  if (typeof item.nome === 'string') return item.nome;
  return item.nome[idioma] ?? item.nome[idioma.split('-')[0]] ?? item.nome.en ?? Object.values(item.nome)[0] ?? item.id;
}

/** A lista que o site usa para chutar: só id e nome, nunca as colunas (a resposta não sai daqui, sai do chute). */
export function catalogo(tema: Tema, idioma: string, categoria?: unknown) {
  return itensDaCategoria(tema, categoria).map((item) => ({ id: item.id, nome: tema.nomePor ? tema.nomePor(item, idioma) : nomeDoItem(item, idioma) }));
}

export const RODADAS_QUIZ = 3;
export const QUIZ_MS = 3 * 60_000;
export const REVELACAO_QUIZ_MS = 8_000;

/** Os pontos de quem acerta: 10 no primeiro chute, um a menos por chute, nunca menos de 1; +1 para o primeiro. */
export const pontosDoQuiz = (chutes: number) => Math.max(1, 11 - chutes);

/** Para os testes: os itens da próxima partida, em vez do sorteio. */
export const _testeQuiz: { itens: string[] | null } = { itens: null };

interface Linha {
  id: string;
  vereditos: Veredito[];
}

export function criarQuiz(tema: Tema): Definicao {
  const porId = new Map(tema.itens.map((item) => [item.id, item]));
  const linha = (chute: ItemDoQuiz, secreto: ItemDoQuiz): Linha => ({
    id: chute.id,
    vereditos: tema.colunas.map((c) => comparar(c, chute[c.id], secreto[c.id])),
  });
  const valores = (item: ItemDoQuiz) => Object.fromEntries(tema.colunas.map((c) => [c.id, item[c.id]]));

  return {
    comecar(ctx, { naSala, corpo }) {
      const categoria = tema.categorias?.[String(corpo.categoria)] ? String(corpo.categoria) : tema.categorias ? 'tudo' : null;
      const daPartida = new Set(itensDaCategoria(tema, categoria).map((i) => i.id));
      const sorteio = tema.itens.filter((i) => daPartida.has(i.id)).filter(tema.sorteavel ?? (() => true));
      if (sorteio.length < RODADAS_QUIZ) return 'A lista do quiz não está no servidor.';
      const secretos = (_testeQuiz.itens ?? embaralhar([...sorteio]).slice(0, RODADAS_QUIZ).map((i) => i.id)).map((id) => porId.get(id)!);
      let rodada = 1;
      let fase: 'chutando' | 'revelando' | 'fim' = 'chutando';
      let inicio = Date.now();
      const quadros = new Map<number, { linhas: Linha[]; acertouEm: number | null }>();
      const pontos = new Map(naSala.map((id) => [id, 0]));
      const secreto = () => secretos[rodada - 1];
      // Sem limite de chutes, quem termina é quem acerta: todo mundo da sala acertou, e a resposta aparece na hora.
      const todosAcertaram = () => {
        const naSalaAgora = ctx.naSala();
        return [...quadros.entries()].every(([id, q]) => q.acertouEm !== null || !naSalaAgora.includes(id));
      };

      function novaRodada() {
        quadros.clear();
        for (const id of pontos.keys()) quadros.set(id, { linhas: [], acertouEm: null });
        fase = 'chutando';
        inicio = Date.now();
        ctx.agendar(QUIZ_MS, revelar);
        ctx.avisar();
      }

      function revelar() {
        if (fase !== 'chutando') return;
        const acertaram = [...quadros.entries()].filter(([, q]) => q.acertouEm !== null);
        for (const [id, q] of acertaram) pontos.set(id, (pontos.get(id) ?? 0) + pontosDoQuiz(q.linhas.length));
        const primeiro = acertaram.sort(([, a], [, b]) => (a.acertouEm ?? 0) - (b.acertouEm ?? 0))[0];
        if (primeiro) pontos.set(primeiro[0], (pontos.get(primeiro[0]) ?? 0) + 1);
        fase = 'revelando';
        ctx.agendar(REVELACAO_QUIZ_MS, () => {
          if (rodada >= RODADAS_QUIZ) {
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
          const aberto = fase !== 'chutando';
          return {
            rodada,
            rodadas: RODADAS_QUIZ,
            fase,
            categoria,
            colunas: tema.colunas,
            // As minhas linhas com os valores do que chutei (o site traduz e mostra); dos outros, só as cores.
            meu: (meu?.linhas ?? []).map((l) => ({ ...l, valores: valores(porId.get(l.id)!) })),
            acertei: meu !== undefined && meu.acertouEm !== null,
            resposta: aberto ? { id: secreto().id, valores: valores(secreto()) } : null,
            outros: [...quadros.entries()].map(([userId, q]) => ({
              userId,
              username: ctx.nome(userId),
              cores: q.linhas.map((l) => l.vereditos.map((v) => v.cor)),
              acertou: q.acertouEm !== null,
              // Na revelação a sala vê também o que cada um chutou.
              chutes: aberto ? q.linhas.map((l) => l.id) : null,
            })),
            placar: placar(pontos, ctx.nome),
          };
        },
        acao(quem, corpo) {
          if (corpo.tipo !== 'chute') return 'Ação desconhecida.';
          if (fase !== 'chutando') return 'Esta rodada já acabou.';
          const item = porId.get(String(corpo.id ?? ''));
          if (!item || !daPartida.has(item.id)) return 'Escolha um da lista.';
          let q = quadros.get(quem);
          if (!q) {
            q = { linhas: [], acertouEm: null };
            quadros.set(quem, q);
            if (!pontos.has(quem)) pontos.set(quem, 0);
          }
          if (q.acertouEm !== null) return null;
          // O mesmo chute duas vezes não conta outra vez (Enter apertado duas vezes com a internet lenta).
          if (q.linhas.some((l) => l.id === item.id)) return 'Você já chutou esse.';
          q.linhas.push(linha(item, secreto()));
          if (item.id === secreto().id) q.acertouEm = Date.now() - inicio;
          if (todosAcertaram()) revelar();
          else ctx.avisar();
          return null;
        },
        conferir() {
          if (fase === 'chutando' && quadros.size > 0 && todosAcertaram()) revelar();
        },
      };
    },
  };
}
