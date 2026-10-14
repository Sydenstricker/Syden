import { readFileSync } from 'node:fs';
import { embaralhar, placar, type Definicao } from './minijogo-motor.js';

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

for (const p of SORTEIO) GRAFIA.set(semAcento(p), p); // a grafia da palavra sorteada vale também para quem a chuta

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

interface Quadro {
  chutes: { texto: string; cores: number[] }[];
  acertouEm: number | null;
}

/** Os pontos de quem acerta: menos chutes, mais pontos (6 no primeiro chute, 1 no sexto), e +1 para o primeiro a acertar. */
export const pontosDoAcerto = (chutes: number) => CHUTES + 1 - chutes;

/** Para os testes: as palavras da próxima partida, em vez do sorteio. */
export const _teste: { palavras: string[] | null } = { palavras: null };

export const palavra: Definicao = {
  comecar(ctx, { naSala }) {
    if (SORTEIO.length < RODADAS_PALAVRA) return 'As palavras não estão no servidor.';
    const sorteadas = _teste.palavras ?? embaralhar([...SORTEIO]).slice(0, RODADAS_PALAVRA);
    let rodada = 1;
    let fase: 'chutando' | 'revelando' | 'fim' = 'chutando';
    let inicio = Date.now();
    const quadros = new Map<number, Quadro>();
    const pontos = new Map(naSala.map((id) => [id, 0]));
    const secreta = () => semAcento(sorteadas[rodada - 1]);

    function novaRodada() {
      quadros.clear();
      for (const id of pontos.keys()) quadros.set(id, { chutes: [], acertouEm: null });
      fase = 'chutando';
      inicio = Date.now();
      ctx.agendar(PALAVRA_MS, revelar);
      ctx.avisar();
    }

    function revelar() {
      if (fase !== 'chutando') return;
      const acertaram = [...quadros.entries()].filter(([, q]) => q.acertouEm !== null);
      for (const [id, q] of acertaram) pontos.set(id, (pontos.get(id) ?? 0) + pontosDoAcerto(q.chutes.length));
      const primeiro = acertaram.sort(([, a], [, b]) => (a.acertouEm ?? 0) - (b.acertouEm ?? 0))[0];
      if (primeiro) pontos.set(primeiro[0], (pontos.get(primeiro[0]) ?? 0) + 1);
      fase = 'revelando';
      ctx.agendar(REVELACAO_MS, () => {
        if (rodada >= RODADAS_PALAVRA) {
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
        return {
          rodada,
          rodadas: RODADAS_PALAVRA,
          fase,
          chutes: CHUTES,
          // O meu quadro com as letras; dos outros, só as cores.
          meu: meu?.chutes ?? [],
          acertei: meu?.acertouEm !== null && meu !== undefined,
          palavra: fase === 'chutando' ? null : sorteadas[rodada - 1],
          outros: [...quadros.entries()].map(([userId, q]) => ({
            userId,
            username: ctx.nome(userId),
            cores: q.chutes.map((c) => c.cores),
            acertou: q.acertouEm !== null,
            // Na revelação a sala vê também as letras de todo mundo.
            letras: fase === 'chutando' ? null : q.chutes.map((c) => c.texto),
          })),
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
          q = { chutes: [], acertouEm: null };
          quadros.set(quem, q);
          if (!pontos.has(quem)) pontos.set(quem, 0);
        }
        if (q.acertouEm !== null || q.chutes.length >= CHUTES) return null;
        q.chutes.push({ texto: GRAFIA.get(limpa) ?? limpa, cores: cores(limpa, secreta()) });
        if (limpa === secreta()) q.acertouEm = Date.now() - inicio;
        // Todo mundo da sala acertou ou gastou os 6 chutes: a palavra aparece na hora.
        const naSalaAgora = ctx.naSala();
        if ([...quadros.entries()].every(([id, x]) => x.acertouEm !== null || x.chutes.length >= CHUTES || !naSalaAgora.includes(id))) revelar();
        else ctx.avisar();
        return null;
      },
    };
  },
};
