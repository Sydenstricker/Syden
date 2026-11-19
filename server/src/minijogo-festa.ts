/**
 * A FESTA DOS COELHOS (03/11/2026): um pacote de microjogos rápidos, no espírito dos jogos de festa de console — SÓ A
 * MECÂNICA, nada de nome, personagem, arte ou som de ninguém. Tudo é desenhado por código no site (JogoFesta.tsx).
 *
 * CADA MICROJOGO MORA NOS PRÓPRIOS ARQUIVOS (05/11/2026): server/src/festa/<id>.ts (a regra) e web/src/festa/<id>.tsx (a
 * tela), juntos pelos dois registros. O GUIA de como fazer um novo está no topo de server/src/festa/registro.ts. A rodada
 * comum (o "prepare-se", o eco da rede, a revelação, os robôs) está em festa/rodada.ts; este arquivo é a partida da Festa.
 *
 * Uma partida tem 5 rodadas, e cada rodada sorteia um microjogo (sem repetir na partida): ~3 s de "prepare-se" com o nome e
 * a instrução, o jogo, e ~5 s de revelação com o resultado de cada um e os pontos (10, 8, 6, 5, 4, 3, 2, 1 pela posição;
 * quem foi desclassificado ou não respondeu, zero). No fim, o placar somado, e as medalhas só aí.
 *
 * A REDE DECIDE O FORMATO, como na corrida: o servidor está na Alemanha e a turma no Brasil (~200 ms). Por isso cada um
 * joga NA PRÓPRIA TELA, ao mesmo tempo, e nada depende de interação em tempo real entre as pessoas. O servidor é dono da
 * semente de cada rodada, do relógio e das respostas certas (onde está a cenoura, a sequência das setas, quando cada alvo
 * aparece, quando sai o sinal); o site manda o resultado, e o servidor confere se ele é possível pelo relógio DELE
 * (a reação não tem menos de 100 ms nem menos do que passou desde o sinal, menos uma folga; o copo é o certo; as setas
 * batem com a sequência; os alvos já tinham aparecido). É jogo entre amigos: conferência razoável, não perfeita.
 *
 * A FOLGA É A REDE DE CADA UM (revisão independente, 03/11/2026: a folga fixa, de 0,5 s para cima e 0,9 s para baixo, deixava
 * o console mandar os 10 s exatos do relógio em qualquer instante de 9,5 a 10,9 s, e a janela da força era mais larga que o
 * período da barra, então o pico estava sempre ao alcance). O que o site mede começa no instante marcado mais o tempo de o
 * estado chegar, e chega ao servidor depois de mais uma ida: o tempo HONESTO nunca passa do que o servidor viu (só um fio,
 * FOLGA_ACIMA), e fica abaixo dele no máximo uma ida e volta. A ida e volta de cada um é medida no "prepare-se" pelo eco
 * (`eco` no estado, devolvido pela ação 'eco'): vale a MENOR medida, porque segurar o eco só a aumenta, com um teto
 * (ATRASO_MAXIMO), que é também o de quem não mediu; e mais FOLGA_DA_REDE, para a internet que engasga num aperto.
 * O que sobra, e não tem conserto pelo relógio: um programa que espere a hora certa e mande o perfeito ainda passa, como
 * passaria um dedo perfeito. A conferência estreita a janela; não adivinha quem apertou.
 *
 * Os dados de cada microjogo vão PRONTOS ao site (as trocas dos copos, as setas, os alvos), e não uma semente: assim o site
 * não precisa do mesmo sorteador, e todo mundo vê a mesma coisa. O sinal do saque é a exceção: ele só vai quando sai, e a
 * reação é medida na tela de cada um, a partir do momento em que o sinal apareceu ali — quem tem internet pior não perde.
 *
 * OS TROFÉUS: o pódio de uma partida com 2 pessoas ou mais vai para o quarto de quem ficou nele, como o da corrida
 * (corrida_trofeus, com a "pista" 'festa' e os pontos; o site dá o nome).
 */
import * as db from './db.js';
import { embaralhar, placar, type Definicao } from './minijogo-motor.js';
import { comecarRelampago } from './minijogo-festa-relampago.js';
import { microjogosPara, PONTOS_FESTA, RODADAS_FESTA, rodadaDeFesta, type Microjogo, type RodadaDeFesta } from './festa/rodada.js';

export * from './festa/rodada.js';
// O que os outros arquivos e os testes usam continua saindo daqui.
export * from './festa/comum.js';
export { animacaoDosCopos, copoFinal, COPOS_MOSTRA_MS, COPOS_RESPOSTA_MS, type DadosCopos } from './festa/copos.js';
export { FORCA_MS, valorDaForca, type DadosForca } from './festa/forca.js';
export { RELOGIO_ALVO, RELOGIO_MS } from './festa/relogio.js';
export { SAQUE_DEPOIS_MS, SAQUE_ESPERA_MAX, SAQUE_ESPERA_MIN } from './festa/saque.js';
export { minimoDaSiga, SIGA_MS, SIGA_PASSO_MS, SIGA_PAUSA_MS, SIGA_SETAS, type DadosSiga } from './festa/siga.js';
export { ALVO_MS, ALVO_VIDA_MS, type DadosAlvo } from './festa/alvo.js';

/**
 * A ÚLTIMA RODADA VALE O DOBRO, e no fim vem o PRÊMIO BÔNUS (19/11/2026, pedido dele, a auditoria dos mini-games): quem venceu
 * mais rodadas (o 1º lugar) ganha PREMIO_DA_FESTA pontos, empatados todos, com zero vitórias ninguém. O prêmio entra no placar
 * antes do pódio e dos troféus.
 */
export const PREMIO_DA_FESTA = 5;

export const festa: Definicao = criarFesta();

export interface OpcoesDaFesta {
  agora?: () => number;
  aleatorio?: () => number;
  /** Para o teste: a ordem dos microjogos. */
  ordem?: Microjogo[];
}

export function criarFesta({ agora = Date.now, aleatorio = Math.random, ordem: ordemDoTeste }: OpcoesDaFesta = {}): Definicao {
  return {
    minimo: 2,
    comecar(ctx, { naSala, corpo }) {
      // o modo Relâmpago (19/11/2026), escolhido na largada: outra partida, em minijogo-festa-relampago.ts
      if (corpo?.modo === 'relampago') return comecarRelampago(ctx, naSala, { agora, aleatorio });
      const inscritos = [...naSala];
      // o empurra-empurra (lote 5) pede 2 ou mais: no Solo, fica de fora do sorteio
      const ordem = ordemDoTeste ?? embaralhar([...microjogosPara(inscritos.length)], aleatorio).slice(0, RODADAS_FESTA);
      const evento = `festa-${ctx.comunidade ?? 0}-${agora()}`;
      const avatares = new Map(inscritos.map((id) => [id, id < 0 ? null : db.avatarDoJogo(id)]));
      const pontos = new Map<number, number>(inscritos.map((id) => [id, 0]));
      let rodada = 1;
      let terminada = false;
      /** Quantas rodadas cada um venceu (o prêmio bônus). */
      const vitorias = new Map<number, number>(inscritos.map((id) => [id, 0]));
      let premio: { ganhadores: number[]; valor: number; pontos: number } | null = null;
      const ultima = () => rodada === ordem.length && ordem.length > 1;
      /** Quem estava na sala em TODAS as revelações: só eles são "a turma" do pódio (revisão de 03/11/2026: quem ficava
       * sozinho ganhava o troféu, e quem tinha saído também). */
      let ficaram: Set<number> | null = null;

      const nova = (): RodadaDeFesta =>
        rodadaDeFesta({
          ctx,
          microjogo: ordem[rodada - 1],
          inscritos,
          agora,
          aleatorio,
          pontos: ultima() ? PONTOS_FESTA.map((p) => p * 2) : PONTOS_FESTA,
          aoRevelar: (linhas, presentes) => {
            for (const l of linhas) if (l.posicao === 1) vitorias.set(l.userId, (vitorias.get(l.userId) ?? 0) + 1);
            const agoraNaSala = inscritos.filter((id) => presentes.has(id));
            ficaram = new Set((ficaram ? [...ficaram] : inscritos).filter((id) => agoraNaSala.includes(id)));
            for (const l of linhas) if (l.pontos) pontos.set(l.userId, (pontos.get(l.userId) ?? 0) + l.pontos);
          },
          aoAcabar: () => {
            if (rodada >= ordem.length) return terminar();
            rodada++;
            atual = nova();
          },
        });
      let atual = nova();

      const terminar = () => {
        terminada = true;
        // o prêmio bônus: quem venceu mais rodadas (entre quem ainda está na partida)
        const candidatos = inscritos.filter((id) => (ficaram ?? new Set(inscritos)).has(id));
        const maior = Math.max(0, ...candidatos.map((id) => vitorias.get(id) ?? 0));
        if (maior > 0 && inscritos.length > 1) {
          const ganhadores = candidatos.filter((id) => vitorias.get(id) === maior);
          for (const id of ganhadores) pontos.set(id, (pontos.get(id) ?? 0) + PREMIO_DA_FESTA);
          premio = { ganhadores, valor: maior, pontos: PREMIO_DA_FESTA };
        }
        // O PÓDIO, com 2 pessoas ou mais que ficaram até o fim: até o 3º lugar (empatados dividem), e só quem fez algum ponto.
        const turma = ficaram ?? new Set<number>();
        if (turma.size >= 2) {
          const ordemFinal = placar(new Map([...pontos].filter(([id]) => turma.has(id))), ctx.nome);
          for (const l of ordemFinal) {
            const posicao = 1 + ordemFinal.filter((o) => o.pontos > l.pontos).length;
            if (posicao > 3 || l.pontos <= 0) continue;
            db.guardarTrofeu({
              userId: l.userId,
              evento,
              communityId: ctx.comunidade ?? 0,
              pista: 'festa',
              posicao,
              tempoMs: null,
              pontos: l.pontos,
              rivais: [...turma].filter((id) => id !== l.userId),
            });
          }
        }
        ctx.terminar();
      };

      /**
       * A classificação do fim, a mesma dos troféus (revisão independente, 03/11/2026: a tela dava medalha pelo placar de
       * todos, inclusive de quem tinha saído, e ao único que ficou): posição só para quem ficou até o fim, e só com 2 ou mais;
       * quem saiu vem depois, sem posição, marcado.
       */
      const classificacaoFinal = () => {
        const turma = ficaram ?? new Set<number>();
        const comPodio = turma.size >= 2;
        const ordemFinal = placar(pontos, ctx.nome);
        const ranking = comPodio ? ordemFinal.filter((l) => turma.has(l.userId)) : [];
        const resto = ordemFinal.filter((l) => !ranking.includes(l));
        return [
          ...ranking.map((l) => ({ ...l, posicao: 1 + ranking.filter((o) => o.pontos > l.pontos).length, saiu: false })),
          ...resto.map((l) => ({ ...l, posicao: null, saiu: !turma.has(l.userId) })),
        ];
      };

      return {
        publico(quem) {
          const r = atual.publico(quem);
          return {
            ...r,
            eco: terminada ? null : r.eco,
            classificacao: terminada ? classificacaoFinal() : null,
            fase: terminada ? 'fim' : r.fase,
            rodada,
            rodadas: ordem.length,
            dados: terminada ? null : r.dados,
            jogadores: inscritos.map((userId) => ({ userId, username: ctx.nome(userId), avatar: avatares.get(userId) ?? null })),
            // a última rodada vale o dobro; o prêmio bônus, no fim
            dobro: !terminada && ultima(),
            premio: terminada ? premio : null,
            resposta: terminada ? null : r.resposta,
            placar: placar(pontos, ctx.nome),
            // a partida (o site monta a tela de novo a cada uma: o "Jogar de novo" do Solo não herda a rodada 5 da anterior)
            partidaId: evento,
          };
        },
        acao(quem, corpo) {
          if (corpo.tipo === 'eco') return terminada ? null : atual.acao(quem, corpo);
          if (corpo.tipo !== 'resultado' && corpo.tipo !== 'acerto') return 'Ação desconhecida.';
          if (!inscritos.includes(quem)) return 'Você está assistindo esta partida.';
          if (terminada) return 'Esta rodada já acabou.';
          return atual.acao(quem, corpo);
        },
        conferir() {
          if (!terminada) atual.conferir();
        },
        // o canal ao vivo dos microjogos de contato (lote 5): só encaminha para a rodada da vez
        tempoReal(quem, dados) {
          if (terminada || !inscritos.includes(quem)) return null;
          return atual.tempoReal(quem, dados);
        },
        parar() {
          atual.parar();
        },
      };
    },
  };
}
