/**
 * A COZINHA DA TOCA (05/11/2026, pedido dele, com os modelos do Restaurant Bits da KayKit, CC0): pegar os ingredientes nos
 * caixotes, picar na tábua, cozinhar no fogão e no forno (no ponto, sem queimar), montar no prato e entregar na janela. Só a
 * mecânica dos jogos de cozinha de festa; a cozinha, o coelho e tudo o que aparece são nossos (web/src/cozinha/).
 *
 * A REDE DECIDE O FORMATO, como na Caça e no golfe: CADA UM NA PRÓPRIA COZINHA. Ninguém divide panela pela internet; a
 * turma recebe OS MESMOS PEDIDOS, na mesma ordem (sorteados aqui, uma vez), e cada um anda na fila no próprio ritmo. Quem
 * entregar mais pratos certos em 3 minutos ganha (os pontos de cada receita desempatam).
 *
 * O SERVIDOR CONFERE O PRATO, não a cozinha: a entrega vem com o pedido e os itens do prato, e ele confere que o pedido está
 * na fila da pessoa e que os itens são os da receita (cozinha-receitas.ts, a mesma conta da tela). Um prato a cada 0,4 s no
 * máximo.
 *
 * O PONTO É DO SERVIDOR (06/11/2026, "a etapa de cozinhar"): a tela avisa na hora o que pôs no fogo e quando tirou
 * ({ tipo: 'fogo', estacao, item } e { tipo: 'fogo', estacao, tirou: true }), e o servidor mede o tempo de fogo pelo relógio
 * DELE (estadoNoFogo, com FOLGA_DO_FOGO_MS a favor de quem joga, pela rede). O que ele viu sair no ponto vira uma FICHA; o
 * prato entregue só vale se cada item cozido nele tiver a sua ficha (e a gasta). O "está no ponto" da tela não conta. O
 * relógio é do servidor também no Solo: por isso a Cozinha não pausa.
 * O que continua possível: mandar o prato certo pelo console sem picar, e pôr no fogo e tirar no ponto sem andar até o
 * fogão. É jogo entre amigos; o tempo de fogo, esse, ninguém encurta.
 *
 * O PÓDIO: com a turma (2 ou mais que ficaram até o fim), os três primeiros vão para a estante de troféus do quarto (pista
 * 'cozinha', os pontos sendo os pratos). No Solo, sem troféu.
 *
 * AS PLANTAS, A GORJETA, O RECORDE E O FOGO (19/11/2026, a auditoria dos mini-games):
 * - Quem começa escolhe a PLANTA na largada (FOGO_DAS_PLANTAS: o servidor só conhece as estações de fogo de cada uma). Sem
 *   escolha em 20 s, a da toca.
 * - A GORJETA: o pedido entregue logo depois de aparecer na fila (pelo relógio daqui) dá pontos a mais (gorjetaDe). Só bônus.
 * - O RECORDE DO SOLO, por planta, na tabela comum (solo_recordes): os pontos que ESTE servidor somou.
 * - O FOGO ESQUECIDO: o que fica no fogo INCENDIO_MS depois de queimar pega fogo (pelo relógio daqui, com a folga a favor de
 *   quem joga). O "tirei" do fogo em chamas é recusado; só o extintor ({ tipo: 'extintor', estacao }) o limpa, e o que estava
 *   lá se perde. Os pratos sujos e a pia são só da cozinha da tela: o servidor confere o prato, não a louça.
 *
 * A PACIÊNCIA (20/11/2026, a segunda auditoria): cada pedido vence em prazoDoPedidoMs (60 a 90 s) desde que apareceu na fila,
 * pelo relógio daqui. Vencido, sai da fila no instante do prazo, entra o próximo e custa PENA_DO_PEDIDO_PERDIDO. Quem vence é
 * `vencer`, chamado antes de cada ação, ao montar o estado, no fim e na conferência das rotas (a cada 4 s), que avisa a turma; a
 * tela conta o prazo sozinha (`restaMs`) e esconde a comanda vencida sem esperar.
 *
 * AS FASES DO SOLO (21/11/2026, o lote D): além da planta livre, o Solo tem uma sequência de restaurantes (FASES_DA_COZINHA),
 * cada um com a planta e o cardápio dele (os pedidos saem só dali) e a meta de 1 a 3 estrelas pelos pontos DAQUI. A fase abre
 * com 1 estrela na anterior (conferido aqui, pelos recordes); o recorde é por fase, na tabela comum (variante `fase-<id>`).
 */
import {
  DURACAO_MS,
  FASES_DA_COZINHA,
  estrelasDaCozinha,
  faseAberta,
  faseDaCozinha,
  type FaseDaCozinha,
  FOGO_DAS_PLANTAS,
  FOLGA_DO_FOGO_MS,
  PLANTAS_DA_COZINHA,
  PEDIDOS_NA_FILA,
  PENA_DO_PEDIDO_PERDIDO,
  PONTO,
  RECEITAS,
  chave,
  confere,
  emChamas,
  estadoNoFogo,
  gorjetaDe,
  normalizarPrato,
  prazoDoPedidoMs,
  sortearPedidos,
  tempoInicialNoFogo,
  vaiAoFogo,
  type IdDaReceita,
  type Item,
  type PlantaDaCozinha,
} from './cozinha-receitas.js';
import * as db from './db.js';
import type { Definicao } from './minijogo-motor.js';

/** O recorde do Solo RECOMEÇOU em 21/11/2026 (decisão dele): desde a paciência do pedido (lote C), os pedidos vencem e o
 * jogo ficou mais difícil. Os recordes de antes continuam guardados em 'cozinha' (e no "Levar seus dados"), sem comparar. */
export const JOGO_DO_RECORDE = 'cozinha-paciencia';
/** O "prepare-se" antes de valer. */
export const PREPARO_MS = 3000;
/** Um prato a cada isto, no máximo. */
export const INTERVALO_MIN_MS = 400;
/** Quantos pedidos a partida sorteia (mais do que alguém entrega em 3 minutos). */
export const PEDIDOS_DA_PARTIDA = 120;
/** Quem começa tem isto para escolher a planta; depois, vai a da toca. */
export const ESCOLHA_MS = 20_000;

interface Cozinheiro {
  /** Os índices da sequência que estão na fila desta pessoa. */
  fila: number[];
  proximo: number;
  pratos: number;
  pontos: number;
  /** Os pontos de gorjeta (já somados em `pontos`). */
  gorjetas: number;
  /** Os pedidos que venceram na fila (a paciência). */
  perdidos: number;
  /** Quando cada pedido apareceu na fila desta pessoa (o índice da sequência → o relógio daqui). */
  entrou: Map<number, number>;
  ultimaEntrega: number;
  /** O que está no fogo agora (pela estação): o item como entrou e quando o tempo de fogo começou, no relógio daqui. */
  fogo: Map<number, { item: Item; desde: number }>;
  /** As fichas: o que saiu do fogo no ponto (a chave do item cozido) e quantos. */
  fichas: Map<string, number>;
}

/** Gasta uma ficha (se houver). */
function gastar(fichas: Map<string, number>, k: string): boolean {
  const n = fichas.get(k) ?? 0;
  if (n <= 0) return false;
  if (n === 1) fichas.delete(k);
  else fichas.set(k, n - 1);
  return true;
}

export const cozinha: Definicao = criarCozinha();

export function criarCozinha({ agora = Date.now, aleatorio = Math.random }: { agora?: () => number; aleatorio?: () => number } = {}): Definicao {
  return {
    minimo: 2,
    comecar(ctx, { naSala, criadaPor, corpo }) {
      const inscritos = [...naSala];
      const solo = ctx.solo === true || inscritos.length === 1;
      const evento = `cozinha-${ctx.comunidade ?? 0}-${agora()}`;
      let pedidos: IdDaReceita[] = sortearPedidos(aleatorio, PEDIDOS_DA_PARTIDA);
      /** A fase do Solo (21/11/2026): só se estiver aberta para quem joga. */
      const melhoresDe = (quem: number) => {
        const m = new Map(db.recordesDoSolo(quem, JOGO_DO_RECORDE).map((r) => [r.variante, r.valor]));
        return (id: string) => m.get(`fase-${id}`);
      };
      const faseLiberada = (id: unknown): FaseDaCozinha | null => {
        const f = faseDaCozinha(id);
        if (!f || !solo) return null;
        return faseAberta(FASES_DA_COZINHA.indexOf(f), melhoresDe(inscritos[0])) ? f : null;
      };
      let faseDoSolo: FaseDaCozinha | null = faseLiberada(corpo.fase);
      if (faseDoSolo) pedidos = sortearPedidos(aleatorio, PEDIDOS_DA_PARTIDA, faseDoSolo.cardapio);
      const pedida = faseDoSolo ? faseDoSolo.planta : PLANTAS_DA_COZINHA.includes(corpo.planta as PlantaDaCozinha) ? (corpo.planta as PlantaDaCozinha) : null;
      let planta: PlantaDaCozinha = pedida ?? 'toca';
      let fase: 'escolhendo' | 'preparando' | 'jogando' | 'fim' = pedida ? 'preparando' : 'escolhendo';
      let estrelas: number | null = null;
      let recorde: { antes: number | null; novo: boolean } | null = null;
      let inicio = 0;
      const cozinheiros = new Map<number, Cozinheiro>(
        inscritos.map((id) => [
          id,
          {
            fila: Array.from({ length: PEDIDOS_NA_FILA }, (_, k) => k),
            proximo: PEDIDOS_NA_FILA,
            pratos: 0,
            pontos: 0,
            gorjetas: 0,
            perdidos: 0,
            entrou: new Map(),
            ultimaEntrega: -Infinity,
            fogo: new Map(),
            fichas: new Map(),
          },
        ]),
      );

      const presentes = () => {
        const aqui = new Set(ctx.naSala());
        return inscritos.filter((id) => aqui.has(id));
      };

      /** Mais pratos primeiro, os pontos desempatam; a posição é só de quem está na sala (empatados dividem). */
      const placar = () => {
        const contam = new Set(presentes());
        const linhas = inscritos
          .map((userId) => {
            const c = cozinheiros.get(userId)!;
            return { userId, username: ctx.nome(userId), pratos: c.pratos, pontos: c.pontos, posicao: null as number | null };
          })
          .sort(
            (a, b) =>
              Number(contam.has(b.userId)) - Number(contam.has(a.userId)) || b.pratos - a.pratos || b.pontos - a.pontos || a.username.localeCompare(b.username),
          );
        for (const l of linhas)
          if (contam.has(l.userId))
            l.posicao = 1 + linhas.filter((o) => contam.has(o.userId) && (o.pratos > l.pratos || (o.pratos === l.pratos && o.pontos > l.pontos))).length;
        return linhas;
      };

      /** Quando o pedido vence (no relógio daqui). */
      const venceEm = (c: Cozinheiro, indice: number) => (c.entrou.get(indice) ?? inicio) + prazoDoPedidoMs(pedidos[indice]);

      /**
       * A paciência: tira da fila o que venceu até `ate`, cada um no instante do prazo dele (o que entra no lugar conta dali), e
       * cobra a pena. Devolve se mudou algo.
       */
      let avisoPendente = false;
      const vencer = (ate: number): boolean => {
        if (fase !== 'jogando') return false;
        let mudou = false;
        for (const c of cozinheiros.values()) {
          for (;;) {
            let qual = -1;
            for (const i of c.fila) if (venceEm(c, i) <= ate && (qual < 0 || venceEm(c, i) < venceEm(c, qual))) qual = i;
            if (qual < 0) break;
            const quando = venceEm(c, qual);
            c.fila = c.fila.filter((i) => i !== qual);
            c.entrou.delete(qual);
            c.entrou.set(c.proximo, quando);
            c.fila.push(c.proximo++);
            c.perdidos++;
            c.pontos = Math.max(0, c.pontos - PENA_DO_PEDIDO_PERDIDO);
            mudou = true;
          }
        }
        return mudou;
      };

      const terminar = () => {
        if (fase === 'fim') return;
        // o que venceu antes do fim conta (o depois do fim, não)
        vencer(Math.min(agora(), inicio + DURACAO_MS));
        fase = 'fim';
        const turma = new Set(presentes());
        // o recorde do Solo: os pontos que este servidor somou, por planta
        if (solo) {
          const quem = inscritos[0];
          const c = cozinheiros.get(quem)!;
          // numa fase, o recorde e as estrelas são dela; na planta livre, da planta
          const variante = faseDoSolo ? `fase-${faseDoSolo.id}` : planta;
          if (faseDoSolo) estrelas = estrelasDaCozinha(faseDoSolo, c.pontos);
          if (turma.has(quem) && c.pontos > 0)
            recorde = db.guardarRecordeDoSolo(quem, JOGO_DO_RECORDE, variante, c.pontos, false, { pratos: c.pratos, ...(faseDoSolo ? { estrelas } : {}) });
          else recorde = { antes: db.recordeDoSolo(quem, JOGO_DO_RECORDE, variante)?.valor ?? null, novo: false };
        }
        if (!solo && turma.size >= 2) {
          for (const l of placar()) {
            if (l.posicao === null || l.posicao > 3 || l.pratos <= 0) continue;
            db.guardarTrofeu({
              userId: l.userId,
              evento,
              communityId: ctx.comunidade ?? 0,
              pista: 'cozinha',
              posicao: l.posicao,
              tempoMs: null,
              pontos: l.pratos,
              rivais: [...turma].filter((id) => id !== l.userId),
            });
          }
        }
        ctx.terminar();
      };

      const jogar = () => {
        fase = 'jogando';
        inicio = agora();
        // a fila de começo aparece agora: a gorjeta conta daqui
        for (const c of cozinheiros.values()) for (const i of c.fila) c.entrou.set(i, inicio);
        ctx.agendar(DURACAO_MS, () => terminar());
        ctx.avisar();
      };

      const escolher = (p: PlantaDaCozinha) => {
        if (fase !== 'escolhendo') return;
        planta = p;
        fase = 'preparando';
        ctx.agendar(PREPARO_MS, jogar);
        ctx.avisar();
      };

      if (fase === 'preparando') ctx.agendar(PREPARO_MS, jogar);
      else ctx.agendar(ESCOLHA_MS, () => escolher('toca'));

      /** "Pus no fogo" e "tirei do fogo": o tempo é medido aqui, e o que sai no ponto vira ficha. */
      const fogo = (c: Cozinheiro, corpo: Record<string, unknown>): string | null => {
        // no "prepare-se" a tela pode adiantar uns milissegundos; depois do fim, nada
        if (fase === 'fim') return 'Esta rodada já acabou.';
        const estacao = corpo.estacao;
        const tipo = typeof estacao === 'number' ? FOGO_DAS_PLANTAS[planta][estacao] : undefined;
        if (typeof estacao !== 'number' || !tipo) return 'Lance inválido.';
        const agoraMs = agora();
        if (corpo.tirou === true) {
          const la = c.fogo.get(estacao);
          if (!la) return 'Lance inválido.';
          // em chamas, só o extintor tira (a folga é a favor de quem joga: a chama começa mais tarde aqui)
          if (emChamas(la.item, agoraMs - la.desde, FOLGA_DO_FOGO_MS)) return 'Lance inválido.';
          c.fogo.delete(estacao);
          if (estadoNoFogo(la.item, agoraMs - la.desde, FOLGA_DO_FOGO_MS) === 'cozido') {
            const k = chave({ ...la.item, estado: 'cozido' });
            c.fichas.set(k, (c.fichas.get(k) ?? 0) + 1);
          }
          return null;
        }
        const lista = normalizarPrato([corpo.item]);
        const item = lista?.[0];
        if (!item || c.fogo.has(estacao) || !vaiAoFogo(tipo, item)) return 'Lance inválido.';
        // o que volta ao fogo já no ponto precisa da ficha dele (e a gasta: ela volta quando sair de novo no ponto)
        if (item.estado === 'cozido' && !gastar(c.fichas, chave(item))) return 'Lance inválido.';
        c.fogo.set(estacao, { item, desde: agoraMs - tempoInicialNoFogo(item) });
        return null;
      };

      return {
        publico(quem) {
          // a fila mostrada já sem o que venceu; a turma fica sabendo na próxima conferência
          if (vencer(agora())) avisoPendente = true;
          const meu = cozinheiros.get(quem);
          return {
            fase,
            duracaoMs: DURACAO_MS,
            decorridoMs: fase === 'jogando' ? agora() - inicio : null,
            meu: meu
              ? {
                  // restaMs: quanto falta para o pedido vencer, agora (a tela conta sozinha dali); prazoMs: o prazo inteiro
                  fila: meu.fila.map((indice) => ({
                    indice,
                    receita: pedidos[indice],
                    prazoMs: prazoDoPedidoMs(pedidos[indice]),
                    restaMs: fase === 'jogando' ? venceEm(meu, indice) - agora() : null,
                  })),
                  pratos: meu.pratos,
                  pontos: meu.pontos,
                  gorjetas: meu.gorjetas,
                  perdidos: meu.perdidos,
                }
              : null,
            placar: placar(),
            solo,
            planta,
            /** A fase do Solo escolhida (21/11/2026), e as estrelas que ela deu no fim. */
            faseDoSolo: faseDoSolo ? faseDoSolo.id : null,
            estrelas,
            /** Quem escolhe a planta (na fase 'escolhendo'). */
            escolhe: solo ? inscritos[0] : criadaPor,
            /** No Solo, na escolha: o recorde de cada planta. */
            recordes:
              solo && fase === 'escolhendo' && quem === inscritos[0]
                ? Object.fromEntries(db.recordesDoSolo(quem, JOGO_DO_RECORDE).map((r) => [r.variante, r.valor]))
                : null,
            recorde,
            partidaId: evento,
          };
        },
        acao(quem, corpo) {
          if (corpo.tipo === 'planta') {
            if (fase !== 'escolhendo') return 'Esta rodada já acabou.';
            if (quem !== criadaPor && !(solo && inscritos.includes(quem))) return 'Você está assistindo esta partida.';
            if (!PLANTAS_DA_COZINHA.includes(corpo.planta as PlantaDaCozinha)) return 'Ação desconhecida.';
            escolher(corpo.planta as PlantaDaCozinha);
            return null;
          }
          if (corpo.tipo === 'fase') {
            // a fase do Solo: o cardápio dela, e a planta dela
            if (fase !== 'escolhendo') return 'Esta rodada já acabou.';
            if (!solo || !inscritos.includes(quem)) return 'Você está assistindo esta partida.';
            const f = faseLiberada(corpo.fase);
            if (!f) return 'Ação desconhecida.';
            faseDoSolo = f;
            pedidos = sortearPedidos(aleatorio, PEDIDOS_DA_PARTIDA, f.cardapio);
            escolher(f.planta);
            return null;
          }
          if (corpo.tipo !== 'entregar' && corpo.tipo !== 'fogo' && corpo.tipo !== 'extintor') return 'Ação desconhecida.';
          const c = cozinheiros.get(quem);
          if (!c) return 'Você está assistindo esta partida.';
          if (fase === 'escolhendo') return 'Lance inválido.';
          if (vencer(agora())) ctx.avisar();
          if (corpo.tipo === 'fogo') return fogo(c, corpo);
          if (corpo.tipo === 'extintor') {
            // o extintor limpa a estação de fogo (o que estava lá se perde, sem ficha)
            const estacao = corpo.estacao;
            if (fase === 'fim' || typeof estacao !== 'number' || !FOGO_DAS_PLANTAS[planta][estacao] || !c.fogo.has(estacao)) return 'Lance inválido.';
            c.fogo.delete(estacao);
            return null;
          }
          if (fase !== 'jogando') return 'Esta rodada já acabou.';
          const indice = corpo.pedido;
          const prato = normalizarPrato(corpo.prato);
          if (typeof indice !== 'number' || !c.fila.includes(indice) || !prato || !confere(pedidos[indice], prato)) return 'Este prato não é o pedido.';
          const agoraMs = agora();
          if (agoraMs - c.ultimaEntrega < INTERVALO_MIN_MS) return 'Este prato não é o pedido.';
          // cada item cozido do prato precisa da ficha de quem o tirou do fogo no ponto (conferidas todas antes de gastar)
          const cozidos = prato.filter((i) => i.estado === 'cozido' && PONTO[i.ing]).map(chave);
          const precisa = new Map<string, number>();
          for (const k of cozidos) precisa.set(k, (precisa.get(k) ?? 0) + 1);
          for (const [k, n] of precisa) if ((c.fichas.get(k) ?? 0) < n) return 'Este prato não é o pedido.';
          for (const k of cozidos) gastar(c.fichas, k);
          c.ultimaEntrega = agoraMs;
          c.fila = c.fila.filter((i) => i !== indice);
          // a gorjeta: o quanto o pedido esperou na fila, no relógio daqui
          const gorjeta = gorjetaDe(agoraMs - (c.entrou.get(indice) ?? inicio));
          c.entrou.delete(indice);
          c.entrou.set(c.proximo, agoraMs);
          c.fila.push(c.proximo++);
          c.pratos++;
          c.pontos += RECEITAS[pedidos[indice]].pontos + gorjeta;
          c.gorjetas += gorjeta;
          ctx.avisar();
          return null;
        },
        /** A conferência das rotas (a cada 4 s): o pedido que venceu sai, e a turma fica sabendo. */
        conferir() {
          if (vencer(agora()) || avisoPendente) ctx.avisar();
          avisoPendente = false;
        },
      };
    },
  };
}
