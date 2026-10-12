import { embaralhar, placar, type Definicao } from './minijogo-motor.js';

/**
 * O STOP (ou Adedanha), o melhor dos jogos de palavra para jogar conversando. Sai uma letra, cada um escreve
 * na própria tela uma palavra com ela para cada categoria, e quem preencher tudo primeiro aperta STOP. Aí
 * todo mundo vê as respostas de todo mundo e a turma decide o que vale — que é a parte em que a conversa
 * acontece ("girafa é cor?").
 *
 * AS LETRAS VÊM DE QUEM COMEÇA, na escrita da língua dele (o site manda; ver web/src/minijogos.ts). Os 71
 * idiomas não têm o mesmo alfabeto, e sortear "W" para quem escreve em cirílico não teria jogo. Quando a
 * escrita tem letras de verdade (latina, cirílica, grega…), o servidor confere a primeira letra; nas outras
 * (japonês, chinês), quem confere é a turma.
 *
 * PONTOS, como no papel: 10 pela resposta que só você deu, 5 pela repetida, 0 pela vazia ou contestada. A
 * resposta cai quando MAIS DA METADE dos outros jogadores a contesta.
 */

/** As categorias: o nome de cada uma mora no site, traduzido. Seis são sorteadas por partida. */
export const CATEGORIAS = ['nome', 'animal', 'fruta', 'cor', 'objeto', 'lugar', 'profissao', 'comida', 'marca', 'filme', 'corpo', 'esporte'];
export const CATEGORIAS_POR_PARTIDA = 6;
export const RODADAS_STOP = 3;
export const ESCREVENDO_MS = 90_000;
/** Depois do STOP, um instante para a última palavra digitada chegar ao servidor. */
export const PARANDO_MS = 2_000;
export const CONFERINDO_MS = 60_000;
export const RESULTADO_MS = 6_000;
export const TAMANHO_DA_RESPOSTA = 40;
/** As letras de quem não mandou nenhuma: o alfabeto latino sem as que quase não começam palavra. */
export const LETRAS_PADRAO = 'ABCDEFGHIJLMNOPRSTUV';

type Fase = 'escrevendo' | 'parando' | 'conferindo' | 'resultado' | 'fim';

/** Para comparar respostas e letras: sem acento, sem maiúscula, sem espaço sobrando. */
export const normalizar = (texto: string) =>
  texto.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase().replace(/\s+/g, ' ').trim();

/**
 * Os pontos de cada resposta de uma categoria: 10 se só uma pessoa deu aquela resposta, 5 se mais de uma
 * deu, 0 se não vale. `validas` diz, para cada pessoa, se a resposta dela vale.
 */
export function pontuarCategoria(respostas: Map<number, string>, valida: (userId: number) => boolean): Map<number, number> {
  const contagem = new Map<string, number>();
  for (const [userId, texto] of respostas) {
    if (!valida(userId)) continue;
    const chave = normalizar(texto);
    contagem.set(chave, (contagem.get(chave) ?? 0) + 1);
  }
  const pontos = new Map<number, number>();
  for (const [userId, texto] of respostas) {
    pontos.set(userId, valida(userId) ? ((contagem.get(normalizar(texto)) ?? 0) > 1 ? 5 : 10) : 0);
  }
  return pontos;
}

export const stop: Definicao = {
  comecar(ctx, { naSala, corpo }) {
    const letras = [...new Set(Array.from(typeof corpo.letras === 'string' ? corpo.letras : LETRAS_PADRAO).filter((l) => l.trim()))].slice(0, 60);
    if (letras.length < RODADAS_STOP) return 'Faltam letras para sortear.';
    const confere = corpo.confere !== false;
    const categorias = embaralhar([...CATEGORIAS]).slice(0, CATEGORIAS_POR_PARTIDA);
    const sorteio = embaralhar([...letras]);

    let rodada = 1;
    let fase: Fase = 'escrevendo';
    let letra = sorteio[0];
    let quemParou: number | null = null;
    const respostas = new Map<number, string[]>();
    /** `${categoria}:${alvo}` → quem contestou. */
    const contestacoes = new Map<string, Set<number>>();
    const prontos = new Set<number>();
    const pontos = new Map(naSala.map((id) => [id, 0]));
    let pontosDaRodada = new Map<number, number[]>();

    const minhas = (userId: number) => respostas.get(userId) ?? categorias.map(() => '');
    const completas = (userId: number) => minhas(userId).every((r) => r.trim() !== '');
    const jogadores = () => [...pontos.keys()];

    function valida(categoria: number, alvo: number): boolean {
      const texto = minhas(alvo)[categoria]?.trim() ?? '';
      if (!texto) return false;
      if (confere && !normalizar(texto).startsWith(normalizar(letra))) return false;
      const outros = jogadores().filter((id) => id !== alvo).length;
      const contra = contestacoes.get(`${categoria}:${alvo}`)?.size ?? 0;
      return contra * 2 <= outros;
    }

    function novaRodada() {
      letra = sorteio[(rodada - 1) % sorteio.length];
      respostas.clear();
      contestacoes.clear();
      prontos.clear();
      quemParou = null;
      fase = 'escrevendo';
      ctx.agendar(ESCREVENDO_MS, parar);
      ctx.avisar();
    }

    function parar() {
      if (fase !== 'escrevendo') return;
      fase = 'parando';
      ctx.agendar(PARANDO_MS, conferir);
      ctx.avisar();
    }

    function conferir() {
      fase = 'conferindo';
      ctx.agendar(CONFERINDO_MS, pontuar);
      ctx.avisar();
    }

    function pontuar() {
      if (fase !== 'conferindo') return;
      pontosDaRodada = new Map(jogadores().map((id) => [id, categorias.map(() => 0)]));
      categorias.forEach((_, c) => {
        const daCategoria = new Map(jogadores().map((id) => [id, minhas(id)[c] ?? '']));
        for (const [userId, p] of pontuarCategoria(daCategoria, (id) => valida(c, id))) pontosDaRodada.get(userId)![c] = p;
      });
      for (const [userId, lista] of pontosDaRodada) pontos.set(userId, (pontos.get(userId) ?? 0) + lista.reduce((a, b) => a + b, 0));
      fase = 'resultado';
      ctx.agendar(RESULTADO_MS, () => {
        if (rodada >= RODADAS_STOP) {
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
        const aberto = fase === 'conferindo' || fase === 'resultado' || fase === 'fim';
        return {
          rodada,
          rodadas: RODADAS_STOP,
          fase,
          letra,
          categorias,
          quemParou,
          // Enquanto se escreve, cada um vê só as próprias respostas; dos outros, só quem já preencheu tudo.
          minhas: minhas(quem),
          completos: jogadores().filter(completas),
          respostas: aberto
            ? jogadores().map((userId) => ({
                userId,
                username: ctx.nome(userId),
                respostas: minhas(userId).map((texto, c) => ({
                  texto,
                  valida: valida(c, userId),
                  contra: contestacoes.get(`${c}:${userId}`)?.size ?? 0,
                  contestei: contestacoes.get(`${c}:${userId}`)?.has(quem) ?? false,
                  pontos: fase === 'conferindo' ? null : (pontosDaRodada.get(userId)?.[c] ?? 0),
                })),
              }))
            : null,
          prontos: [...prontos],
          placar: placar(pontos, ctx.nome),
        };
      },
      acao(quem, corpo) {
        if (corpo.tipo === 'respostas') {
          if (fase !== 'escrevendo' && fase !== 'parando') return 'A rodada já parou.';
          const lista: unknown[] = Array.isArray(corpo.respostas) ? corpo.respostas : [];
          if (!lista.length) return 'Respostas inválidas.';
          const antes = completas(quem);
          respostas.set(
            quem,
            categorias.map((_, c) => String(lista[c] ?? '').slice(0, TAMANHO_DA_RESPOSTA)),
          );
          if (!pontos.has(quem)) pontos.set(quem, 0);
          // Só avisa quando muda a lista de quem completou: digitar não precisa acordar a sala inteira.
          if (completas(quem) !== antes) ctx.avisar();
          return null;
        }
        if (corpo.tipo === 'stop') {
          if (fase !== 'escrevendo') return 'A rodada já parou.';
          if (!completas(quem)) return 'Preencha todas as categorias antes de parar.';
          quemParou = quem;
          parar();
          return null;
        }
        if (corpo.tipo === 'contestar') {
          if (fase !== 'conferindo') return 'Agora não é hora de conferir.';
          const categoria = Number(corpo.categoria);
          const alvo = Number(corpo.alvo);
          if (!(categoria >= 0 && categoria < categorias.length) || !pontos.has(alvo)) return 'Resposta não encontrada.';
          if (alvo === quem) return 'Não dá para contestar a própria resposta.';
          const chave = `${categoria}:${alvo}`;
          const quemContesta = contestacoes.get(chave) ?? new Set<number>();
          if (quemContesta.has(quem)) quemContesta.delete(quem);
          else quemContesta.add(quem);
          contestacoes.set(chave, quemContesta);
          ctx.avisar();
          return null;
        }
        if (corpo.tipo === 'pronto') {
          if (fase !== 'conferindo') return 'Agora não é hora de conferir.';
          prontos.add(quem);
          if (ctx.naSala().every((id) => prontos.has(id) || !pontos.has(id))) pontuar();
          else ctx.avisar();
          return null;
        }
        return 'Ação desconhecida.';
      },
    };
  },
};
