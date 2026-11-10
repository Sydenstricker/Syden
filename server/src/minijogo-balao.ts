/**
 * O ESTOURA-BALÃO (05/11/2026): o modo arena dos jogos de kart, SÓ A MECÂNICA, sobre o motor da Corrida dos coelhos. Cada um
 * dirige o próprio coelho-kart numa arena fechada, com 3 balões presos atrás; os itens das caixas (o repolho que quica, a
 * lama, a cenoura turbo e o escudo de alface) estouram o balão de quem é atingido. Sem balão, sai e assiste. Ganha quem
 * sobrar, ou quem tiver mais balões quando o tempo acabar (2 min 30 s).
 *
 * A REDE, como os itens da corrida (minijogo-corrida.ts): cada um dirige no próprio computador e manda a posição pelo tempo
 * real (uma a cada 4 passos); o servidor confere que o kart podia ter ido de uma à outra, e repassa. O relógio é UM SÓ: os
 * passos contam desde o sinal verde do servidor, e não param com a janela sem foco (a turma não espera ninguém).
 *
 * QUEM DECIDE SE FOI ATINGIDO (e o problema de quem nunca se declara atingido): as arenas, o caminho do repolho e a lama são
 * contas que os dois lados fazem iguais (balao-sim.ts). Por isso o servidor NÃO PRECISA de ninguém para saber de um acerto:
 * - quem LEVA avisa na hora ("acertou"), e o servidor confere contra a última posição dela (o caminho rápido, o honesto);
 * - e o servidor REFAZ, a cada posição que chega, o caminho que a própria pessoa disse ter feito contra os itens vivos: se
 *   ela passou por um repolho ou uma lama e não avisou, o balão estoura do mesmo jeito;
 * - quem fica CALADO (parou de mandar posição) fica parado, para o servidor, onde estava: os itens que passam por ali pegam.
 * O que sobra possível: mandar posições inventadas que desviam do repolho. Elas são as que a turma vê (é o kart dela na tela
 * dos outros), e não andam mais que o turbo por passo; na prática, é desviar de verdade. O limite está escrito.
 *
 * O SERVIDOR CARIMBA O DONO DE CADA ITEM e LIMITA OS ITENS PELAS CAIXAS: cada caixa pega (perto dela, pela posição conferida)
 * dá um item, um na mão de cada vez, e o item é o do sorteio que os dois lados fazem (itemDaCaixa): usar outro não vale. Um
 * balão nunca volta.
 *
 * A BATIDA ENTRE KARTS (06/11/2026, pedido dele): quem vem rápido (só o turbo passa de VELOCIDADE_DA_BATIDA) e encosta em quem
 * não vem estoura um balão dele. Sem empurrão (com 200 ms, cada um veria o empurrão num lugar): só o balão e a rodada. A
 * mesma regra dos itens: quem LEVA avisa ('batida', com quem bateu), conferido pelas posições recentes do outro (perto, e
 * rápido); e o servidor confere sozinho cada trecho que chega contra as posições que os outros já mandaram, para quem nunca
 * avisa. O que sobra possível: andar sempre no limite do turbo pelo console (é o mesmo limite das posições), e o mesmo de
 * antes, desviar com posições inventadas.
 *
 * O SOLO: contra coelhos do computador, a partida inteira roda no navegador (web/src/balao/), e aqui só se guarda o fim, sem
 * troféu (o troféu é um registro entre amigos).
 */
import * as db from './db.js';
import {
  ARENAS,
  arenaPorId,
  BALOES,
  BATIDA_DE_NOVO,
  caminhoDoRepolho,
  DURACAO_PASSOS,
  INVULNERAVEL,
  itemDaCaixa,
  ITENS_DO_BALAO,
  lamaPegou,
  naParede,
  PASSOS_POR_SEGUNDO,
  quemPerde,
  RAIO_DA_BATIDA,
  RAIO_DA_CAIXA,
  RAIO_DA_LAMA,
  RAIO_DO_REPOLHO,
  repolhoNoPasso,
  repolhoPegou,
  VIDA_DA_ALFACE,
  VELOCIDADE_DA_BATIDA,
  VIDA_DA_LAMA,
  VOLTA_DA_CAIXA,
  type Arena,
  type ItemDoBalao,
} from './balao-sim.js';
import type { Contexto, Definicao, Jogo } from './minijogo-motor.js';
import { idsDosRobos, MAXIMO_DE_ROBOS, nomeDoRobo } from './minijogo-robos.js';

/** A contagem da largada: 3 s de semáforo, mais 1 s para todo mundo abrir a tela. */
export const LARGADA_MS = 4000;
/** Passado o tempo, a partida espera isto pelas últimas posições antes de fechar. */
export const FOLGA_DO_FIM_MS = 1500;
/** A posição pode estar até 1 s à frente do relógio do servidor (a largada de cada um chega com o atraso da rede). */
export const PASSOS_DE_FOLGA = 60;
/** O quanto o kart anda por passo, no máximo: o turbo (185 por segundo), com folga. */
const ANDA_POR_PASSO = (185 / 60) * 1.1;
const FOLGA_DA_POSICAO = 8;
/** Calado há mais que isto, o kart fica parado (para o servidor) onde estava, e os itens que passam por ali pegam. */
export const SILENCIO_MS = 1500;
/** De quanto em quanto tempo o servidor confere os calados, o fim do tempo e quem sobrou. */
const TIQUE_MS = 250;
/** Um item a cada isto, no máximo. */
const INTERVALO_DO_ITEM_MS = 300;
/** O "acertou" de quem levou: a posição dela estava no máximo a isto do item (o raio, mais o kart andando uns passos). */
const PERTO_DO_ACERTO = 18;
/** A conferência do próprio servidor usa um raio um pouco MENOR que o do site: entre duas amostras, o caminho é uma reta. */
const RAIO_DO_SERVIDOR = 1;
/**
 * A BATIDA AVISADA por quem levou: o outro estava, pelas posições dele, a no máximo isto dela (o raio, mais o atraso de quem a
 * viu chegar), e a pelo menos esta fração da velocidade da batida (a reta entre duas amostras encurta a curva). Quem avisa
 * perde o próprio balão: a conferência só impede de dar o estouro a quem não estava ali.
 */
const PERTO_DA_BATIDA = RAIO_DA_BATIDA + 18;
const RAPIDO_NO_AVISO = 0.8;
/** Quantas posições de cada um o servidor guarda para conferir as batidas (uma a cada 4 passos: uns 2,7 s). */
const RASTRO = 40;

/** A velocidade (por segundo) entre duas posições. */
const velocidade = (a: { n: number; x: number; y: number }, b: { n: number; x: number; y: number }) =>
  b.n > a.n ? (Math.hypot(b.x - a.x, b.y - a.y) * PASSOS_POR_SEGUNDO) / (b.n - a.n) : 0;

interface Jogador {
  largada: number;
  baloes: number;
  /** Quantos balões dos outros estourou, e quantos perdeu. */
  estouros: number;
  levou: number;
  vivo: boolean;
  /** A ordem em que saiu (1 = o primeiro a ficar sem balão); null enquanto tem balão. */
  saiuNa: number | null;
  /** O passo do último balão perdido. */
  ultimoEstouro: number;
  /** Um item na mão (pego numa caixa e ainda não usado), quantas caixas já pegou, e quando cada caixa volta para ela. */
  naMao: boolean;
  caixas: number;
  caixaVolta: number[];
  ultimoItem: number;
  /** O escudo de alface: o id e o passo em que foi usado. */
  escudo: { id: string; n: number } | null;
  /** A última posição aceita (em = relógio do servidor quando chegou), e o passo até onde os itens já foram conferidos. */
  ultima: { n: number; x: number; y: number; em: number };
  conferidoAte: number;
  /** As últimas posições aceitas (para as batidas). */
  rastro: { n: number; x: number; y: number }[];
}

type ItemVivo =
  | { tipo: 'repolho'; id: string; dono: number; n: number; caminho: number[]; fim: number }
  | { tipo: 'lama'; id: string; dono: number; n: number; x: number; y: number; fim: number };

export interface LinhaDoBalao {
  userId: number;
  username: string;
  avatar: number | string | null;
  largada: number;
  baloes: number;
  estouros: number;
  vivo: boolean;
  posicao: number | null;
}

export const balao: Definicao = criarBalao();

export function criarBalao({ agora = Date.now, aleatorio = Math.random }: { agora?: () => number; aleatorio?: () => number } = {}): Definicao {
  return {
    minimo: 2,
    maximo: 8,
    comecar(ctx, { naSala, corpo }) {
      if (ctx.solo) return comecarSolo(ctx, naSala, agora);
      const pedida = typeof corpo.arena === 'string' ? corpo.arena : typeof corpo.categoria === 'string' ? corpo.categoria : '';
      const arena: Arena = ARENAS.find((a) => a.id === pedida) ?? ARENAS[Math.floor(aleatorio() * ARENAS.length)];
      const semente = Math.floor(aleatorio() * 2 ** 31);
      const inscritos = [...naSala];
      const evento = `balao-${ctx.comunidade ?? 0}-${agora()}`;
      const avatares = new Map(inscritos.map((id) => [id, db.avatarDoJogo(id)]));
      const jogadores = new Map<number, Jogador>(
        inscritos.map((id, i) => {
          const [x, y] = arena.largadas[i % arena.largadas.length];
          return [
            id,
            {
              largada: i,
              baloes: BALOES,
              estouros: 0,
              levou: 0,
              vivo: true,
              saiuNa: null,
              ultimoEstouro: -Infinity,
              naMao: false,
              caixas: 0,
              caixaVolta: arena.caixas.map(() => 0),
              ultimoItem: 0,
              escudo: null,
              ultima: { n: 0, x, y, em: 0 },
              conferidoAte: 0,
              rastro: [{ n: 0, x, y }],
            },
          ];
        }),
      );
      let fase: 'largada' | 'jogando' | 'fim' = 'largada';
      let verdeEm = 0;
      let saidas = 0;
      const itens = new Map<string, ItemVivo>();
      /** Os itens que já pegaram alguém (ou bateram num escudo): somem para todos, e não pegam mais ninguém. */
      const gastos = new Set<string>();
      /** Quem estava na sala no fim: só eles têm posição e troféu. */
      let ficaram: Set<number> | null = null;
      let tique: ReturnType<typeof setInterval> | null = null;

      const passoAgora = () => Math.floor(((agora() - verdeEm) * PASSOS_POR_SEGUNDO) / 1000);
      const presentes = () => new Set(ctx.naSala());
      const difundir = (dados: unknown) => ctx.difundir?.(dados);

      /** `o` ficou na frente de `l`: quem tem balão na frente; entre eles, mais balões, depois mais estouros; quem saiu depois, na frente. */
      const naFrente = (o: Jogador, l: Jogador) =>
        o.vivo !== l.vivo
          ? o.vivo
          : o.vivo
            ? o.baloes > l.baloes || (o.baloes === l.baloes && (o.estouros > l.estouros || (o.estouros === l.estouros && o.levou < l.levou)))
            : (o.saiuNa ?? 0) > (l.saiuNa ?? 0);

      const classificacao = (): LinhaDoBalao[] => {
        const contam = ficaram ?? presentes();
        const linhas = inscritos.map((userId) => {
          const j = jogadores.get(userId)!;
          return { userId, j };
        });
        const ficou = linhas.filter((l) => contam.has(l.userId));
        const ordenar = (a: { j: Jogador; userId: number }, b: { j: Jogador; userId: number }) =>
          naFrente(a.j, b.j) ? -1 : naFrente(b.j, a.j) ? 1 : ctx.nome(a.userId).localeCompare(ctx.nome(b.userId));
        const linha = (l: { userId: number; j: Jogador }, posicao: number | null): LinhaDoBalao => ({
          userId: l.userId,
          username: ctx.nome(l.userId),
          avatar: avatares.get(l.userId) ?? null,
          largada: l.j.largada,
          baloes: l.j.baloes,
          estouros: l.j.estouros,
          vivo: l.j.vivo,
          posicao,
        });
        return [
          ...ficou.sort(ordenar).map((l) => linha(l, 1 + ficou.filter((o) => naFrente(o.j, l.j)).length)),
          ...linhas.filter((l) => !contam.has(l.userId)).sort(ordenar).map((l) => linha(l, null)),
        ];
      };

      const pararTique = () => {
        if (tique) clearInterval(tique);
        tique = null;
      };

      const fechar = () => {
        if (fase === 'fim') return;
        pararTique();
        fase = 'fim';
        ficaram = new Set(inscritos.filter((id) => presentes().has(id)));
        const ordem = classificacao();
        const turma = ordem.filter((l) => l.posicao !== null);
        if (turma.length >= 2) {
          for (const l of turma) {
            if (l.posicao === null || l.posicao > 3) continue;
            db.guardarTrofeu({
              userId: l.userId,
              evento,
              communityId: ctx.comunidade ?? 0,
              pista: 'balao',
              posicao: l.posicao,
              tempoMs: null,
              pontos: l.baloes,
              rivais: turma.map((o) => o.userId).filter((id) => id !== l.userId),
            });
          }
        }
        ctx.terminar(true);
      };

      /** Sobrou um (ou ninguém) com balão, entre quem está na sala: acabou. */
      const conferirFim = () => {
        if (fase !== 'jogando') return;
        const aqui = presentes();
        const vivos = inscritos.filter((id) => aqui.has(id) && jogadores.get(id)!.vivo);
        if (vivos.length <= 1) fechar();
      };

      /**
       * O ITEM PEGOU `quem` NO PASSO `s`. Dentro dos 2 s depois do último balão perdido, nada pega (e o item segue); o escudo
       * segura o item e acaba; senão, um balão estoura, para sempre. Todo mundo fica sabendo pelo `difundir` (inclusive quem
       * levou, que pode não ter visto: é assim que a tela dele se acerta).
       */
      const acertar = (quem: number, item: ItemVivo, s: number): boolean => {
        const j = jogadores.get(quem);
        if (!j || !j.vivo || gastos.has(item.id) || item.dono === quem) return false;
        if (s < j.ultimoEstouro + INVULNERAVEL) return false;
        gastos.add(item.id);
        itens.delete(item.id);
        estourar(quem, item.dono, item.id, s);
        return true;
      };

      /** O balão de `quem` estoura no passo `s`, por obra de `doDono` (o item, ou o kart que bateu); o escudo segura antes. */
      const estourar = (quem: number, doDono: number, id: string, s: number) => {
        const j = jogadores.get(quem)!;
        if (j.escudo && s >= j.escudo.n && s < j.escudo.n + VIDA_DA_ALFACE) {
          const escudo = j.escudo.id;
          j.escudo = null;
          difundir({ tipo: 'segurou', alvo: quem, id, escudo });
          return;
        }
        j.baloes--;
        j.levou++;
        j.ultimoEstouro = s;
        const dono = jogadores.get(doDono);
        if (dono) dono.estouros++;
        if (j.baloes <= 0) {
          j.baloes = 0;
          j.vivo = false;
          j.saiuNa = ++saidas;
        }
        difundir({ tipo: 'estourou', alvo: quem, id, dono: doDono, baloes: j.baloes, n: s });
        ctx.avisar();
        conferirFim();
      };

      /**
       * A BATIDA: `atacante` veio rápido e encostou em `vitima` no passo `s`. Vale uma por par a cada BATIDA_DE_NOVO, e nada
       * dentro dos 2 s de quem acabou de perder um balão (o contato que continua não leva outro).
       */
      const ultimaBatida = new Map<string, number>();
      const bater = (vitima: number, atacante: number, s: number): boolean => {
        const j = jogadores.get(vitima), a = jogadores.get(atacante);
        if (!j || !a || !j.vivo || !a.vivo || vitima === atacante) return false;
        if (s < j.ultimoEstouro + INVULNERAVEL) return false;
        const par = vitima < atacante ? `${vitima}:${atacante}` : `${atacante}:${vitima}`;
        if (s < (ultimaBatida.get(par) ?? -Infinity) + BATIDA_DE_NOVO) return false;
        ultimaBatida.set(par, s);
        estourar(vitima, atacante, `batida-${atacante}-${vitima}-${s}`, s);
        return true;
      };

      /**
       * Onde `quem` estava no passo `s`, e a que velocidade (por segundo), pelas posições que ela mandou: entre duas, a reta;
       * depois da última, só se ela está calada (parada ali, a 0); antes da mais velha guardada, não se sabe (null).
       */
      const ondeEstava = (quem: number, s: number): { x: number; y: number; v: number } | null => {
        const j = jogadores.get(quem)!;
        const r = j.rastro;
        const ult = r[r.length - 1];
        if (s >= ult.n) return s === ult.n || agora() - j.ultima.em >= SILENCIO_MS ? { x: ult.x, y: ult.y, v: s === ult.n && r.length > 1 ? velocidade(r[r.length - 2], ult) : 0 } : null;
        for (let i = r.length - 2; i >= 0; i--) {
          const a = r[i], b = r[i + 1];
          if (s < a.n) continue;
          const t = (s - a.n) / (b.n - a.n);
          return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, v: velocidade(a, b) };
        }
        return null;
      };

      /**
       * O SERVIDOR CONFERE AS BATIDAS SOZINHO, como os itens: o trecho que `quem` acabou de mandar, passo a passo, contra o que
       * os outros já mandaram (ou contra o lugar onde estão parados, os calados). O trecho que chega depois confere contra este:
       * cada passo de cada par é visto quando chega a segunda das duas posições. O raio aqui é um pouco menor que o do site.
       */
      const conferirBatidas = (quem: number, de: { n: number; x: number; y: number }, ate: { n: number; x: number; y: number }) => {
        if (ate.n <= de.n) return;
        const v = velocidade(de, ate);
        for (const [outro, o] of jogadores) {
          if (outro === quem || !o.vivo) continue;
          for (let s = de.n + 1; s <= ate.n; s++) {
            const p = ondeEstava(outro, s);
            if (!p) continue;
            const t = (s - de.n) / (ate.n - de.n);
            const x = de.x + (ate.x - de.x) * t, y = de.y + (ate.y - de.y) * t;
            if (Math.hypot(p.x - x, p.y - y) >= RAIO_DA_BATIDA - RAIO_DO_SERVIDOR) continue;
            const perde = quemPerde(v, p.v);
            if (perde && bater(perde === 'a' ? quem : outro, perde === 'a' ? outro : quem, s)) break;
          }
          if (!jogadores.get(quem)!.vivo) return;
        }
      };

      /** Confere o caminho de `quem` entre duas posições (uma reta, passo a passo) contra os itens vivos. */
      const conferirCaminho = (quem: number, de: { n: number; x: number; y: number }, ate: { n: number; x: number; y: number }) => {
        const j = jogadores.get(quem)!;
        const inicio = Math.max(de.n, j.conferidoAte) + 1;
        if (ate.n < inicio) return;
        j.conferidoAte = ate.n;
        for (const item of [...itens.values()]) {
          if (item.dono === quem || gastos.has(item.id)) continue;
          const s0 = Math.max(inicio, item.n), s1 = Math.min(ate.n, item.fim);
          for (let s = s0; s <= s1; s++) {
            const t = ate.n > de.n ? (s - de.n) / (ate.n - de.n) : 1;
            const x = de.x + (ate.x - de.x) * t, y = de.y + (ate.y - de.y) * t;
            const pegou =
              item.tipo === 'repolho'
                ? repolhoPegou(item.caminho, item.n, s, x, y, RAIO_DO_REPOLHO - RAIO_DO_SERVIDOR)
                : lamaPegou(item.x, item.y, item.n, s, x, y, RAIO_DA_LAMA - RAIO_DO_SERVIDOR);
            if (pegou && acertar(quem, item, s)) break;
            if (!j.vivo) return;
          }
        }
      };

      /** O tique: quem ficou calado fica parado onde estava (e os itens o pegam lá); os itens velhos saem; o tempo acaba. */
      const tiquetaquear = () => {
        if (fase !== 'jogando') return;
        const n = passoAgora();
        for (const [id, item] of itens) if (item.fim < n - PASSOS_DE_FOLGA) itens.delete(id);
        for (const [id, j] of jogadores) {
          if (!j.vivo || agora() - j.ultima.em < SILENCIO_MS) continue;
          const parado = { n, x: j.ultima.x, y: j.ultima.y };
          conferirCaminho(id, { ...parado, n: j.conferidoAte }, parado);
        }
        conferirFim();
      };

      const jogar = () => {
        fase = 'jogando';
        verdeEm = agora();
        for (const j of jogadores.values()) j.ultima.em = verdeEm;
        ctx.agendar((DURACAO_PASSOS * 1000) / PASSOS_POR_SEGUNDO + FOLGA_DO_FIM_MS, fechar);
        tique = setInterval(tiquetaquear, TIQUE_MS);
        tique.unref?.();
        ctx.avisar();
      };
      ctx.agendar(LARGADA_MS, jogar);

      const numero = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

      /**
       * A POSIÇÃO TEM DE SER UMA QUE O KART ALCANÇA: o passo só cresce e não passa do relógio do servidor (mais a folga), a
       * distância desde a anterior cabe no turbo, e o ponto não está dentro de uma parede.
       */
      const aceitarPosicao = (quem: number, j: Jogador, x: number, y: number, n: number): boolean => {
        if (!Number.isInteger(n) || n <= j.ultima.n) return false;
        if (n > passoAgora() + PASSOS_DE_FOLGA) return false;
        if (naParede(arena, x, y, 3)) return false;
        const passos = Math.min(n - j.ultima.n, ((agora() - j.ultima.em) * PASSOS_POR_SEGUNDO) / 1000 + 60);
        if (Math.hypot(x - j.ultima.x, y - j.ultima.y) > passos * ANDA_POR_PASSO + FOLGA_DA_POSICAO) return false;
        const antes = j.ultima;
        j.ultima = { n, x, y, em: agora() };
        j.rastro.push({ n, x, y });
        if (j.rastro.length > RASTRO) j.rastro.shift();
        conferirCaminho(quem, antes, j.ultima);
        if (j.vivo) conferirBatidas(quem, antes, j.ultima);
        return true;
      };

      return {
        publico: () => ({
          fase,
          arena: arena.id,
          semente,
          partidaId: evento,
          decorridoMs: fase === 'jogando' ? agora() - verdeEm : null,
          duracaoMs: (DURACAO_PASSOS * 1000) / PASSOS_POR_SEGUNDO,
          jogadores: classificacao(),
        }),
        acao: () => 'Ação desconhecida.',
        tempoReal(quem, dados) {
          const j = jogadores.get(quem);
          if (!j || !j.vivo || fase !== 'jogando' || !dados || typeof dados !== 'object') return null;
          const d = dados as Record<string, unknown>;
          // A POSIÇÃO
          if (d.tipo === undefined) {
            const { x, y, a, n } = d;
            if (!numero(x) || !numero(y) || !numero(a) || !numero(n)) return null;
            if (!aceitarPosicao(quem, j, x, y, n)) return null;
            // o caminho dela pode ter acabado com o último balão
            if (!j.vivo) return null;
            return { userId: quem, x, y, a, n };
          }
          const u = j.ultima;
          // A CAIXA: perto dela (pela última posição aceita), uma de cada vez, e a que ela já pegou só volta depois de 6 s
          if (d.tipo === 'caixa') {
            const { i, n } = d;
            if (!numero(i) || !Number.isInteger(i) || i < 0 || i >= arena.caixas.length || !numero(n)) return null;
            if (j.naMao || j.caixaVolta[i] > n || Math.abs(u.n - n) > 8) return null;
            const [cx, cy] = arena.caixas[i];
            if (Math.hypot(cx - u.x, cy - u.y) > RAIO_DA_CAIXA + 8 * ANDA_POR_PASSO) return null;
            j.naMao = true;
            j.caixas++;
            j.caixaVolta[i] = n + VOLTA_DA_CAIXA;
            return null;
          }
          // O "ACERTOU" DE QUEM LEVOU: o item existe, não é dela, e a última posição dela estava perto dele
          if (d.tipo === 'acertou') {
            if (typeof d.id !== 'string' || !numero(d.n)) return null;
            const item = itens.get(d.id);
            if (!item || gastos.has(d.id) || item.dono === quem || Math.abs(u.n - d.n) > 8) return null;
            const p = item.tipo === 'repolho' ? repolhoNoPasso(item.caminho, item.n, u.n) : u.n >= item.n && u.n < item.fim ? [item.x, item.y] : null;
            if (!p || Math.hypot(p[0] - u.x, p[1] - u.y) > PERTO_DO_ACERTO) return null;
            acertar(quem, item, Math.max(item.n, Math.round(d.n)));
            return null;
          }
          // A BATIDA DE QUEM LEVOU (quem leva é quem diz): o outro estava ali, pelas posições dele, e rápido
          if (d.tipo === 'batida') {
            if (!numero(d.de) || !numero(d.n) || Math.abs(u.n - d.n) > 8) return null;
            const de = d.de;
            const o = jogadores.get(de);
            if (!o || de === quem || !o.vivo) return null;
            const s = Math.round(d.n);
            const r = o.rastro, ult = r[r.length - 1];
            // depois da última posição dele (a que ainda vem pela rede), vale a última, com o quanto ele pode ter andado
            const p = s > ult.n ? (s - ult.n <= 30 ? { x: ult.x, y: ult.y, v: r.length > 1 ? velocidade(r[r.length - 2], ult) : 0 } : null) : ondeEstava(de, s);
            const folga = s > ult.n ? (s - ult.n) * ANDA_POR_PASSO : 0;
            if (!p || Math.hypot(p.x - u.x, p.y - u.y) > PERTO_DA_BATIDA + folga || p.v < VELOCIDADE_DA_BATIDA * RAPIDO_NO_AVISO) return null;
            bater(quem, de, s);
            return null;
          }
          // UM ITEM USADO: o da mão, e o do sorteio (quem usa outro, não usa)
          if (!(ITENS_DO_BALAO as readonly unknown[]).includes(d.tipo) || !numero(d.n)) return null;
          const tipo = d.tipo as ItemDoBalao;
          if (!j.naMao || tipo !== itemDaCaixa(semente, quem, j.caixas - 1)) return null;
          if (agora() - j.ultimoItem < INTERVALO_DO_ITEM_MS || Math.abs(d.n - u.n) > 60) return null;
          const n = Math.round(d.n);
          const id = `${quem}-${n}`;
          if (tipo === 'repolho' || tipo === 'lama') {
            if (!numero(d.x) || !numero(d.y) || Math.hypot(d.x - u.x, d.y - u.y) > 30) return null;
          }
          if (tipo === 'repolho') {
            if (!numero(d.dx) || !numero(d.dy)) return null;
            const caminho = caminhoDoRepolho(arena, { n, x: d.x as number, y: d.y as number, dx: d.dx, dy: d.dy });
            if (!caminho) return null;
            itens.set(id, { tipo, id, dono: quem, n, caminho, fim: n + caminho.length / 2 - 1 });
          } else if (tipo === 'lama') {
            itens.set(id, { tipo, id, dono: quem, n, x: d.x as number, y: d.y as number, fim: n + VIDA_DA_LAMA });
          } else if (tipo === 'alface') {
            j.escudo = { id, n };
          }
          j.naMao = false;
          j.ultimoItem = agora();
          if (tipo === 'repolho') return { tipo, id, dono: quem, n, x: d.x, y: d.y, dx: d.dx, dy: d.dy };
          if (tipo === 'lama') return { tipo, id, dono: quem, n, x: d.x, y: d.y };
          return { tipo, id, dono: quem, n };
        },
        // as rotas chamam de tempos em tempos; o tique faz o mesmo e mais (os calados, os itens velhos)
        conferir: tiquetaquear,
        parar: pararTique,
      };
    },
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// O SOLO: a partida roda no navegador, contra coelhos do computador; aqui só se confere e se guarda o fim.
// ---------------------------------------------------------------------------------------------------------------------

/** O Solo não passa disto (a partida e a escolha da arena). */
const PRAZO_DO_SOLO_MS = 10 * 60_000;

function comecarSolo(ctx: Contexto, naSala: number[], agora: () => number): Jogo {
  const quem = naSala[0];
  const inicio = agora();
  const evento = `balao-solo-${quem}-${inicio}`;
  let fase: 'jogando' | 'fim' = 'jogando';
  let resultado: { posicao: number; total: number; baloes: number; estouros: number } | null = null;
  const terminar = (completa: boolean) => {
    if (fase === 'fim') return;
    fase = 'fim';
    ctx.avisar();
    ctx.terminar(completa);
  };
  ctx.agendar(PRAZO_DO_SOLO_MS, () => terminar(false));
  const robos = idsDosRobos(MAXIMO_DE_ROBOS).map((id) => ({ userId: id, username: nomeDoRobo(id) }));
  const avatar = db.avatarDoJogo(quem);
  const inteiro = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
  return {
    publico: () => ({ fase, solo: true, partidaId: evento, username: ctx.nome(quem), avatar, robos, resultadoDoSolo: resultado }),
    acao(autor, c) {
      if (autor !== quem) return 'Você está assistindo esta partida.';
      if (c.tipo !== 'fim') return 'Ação desconhecida.';
      if (fase !== 'jogando') return 'Esta rodada já acabou.';
      const { posicao, total, baloes, estouros, passos } = c;
      if (![posicao, total, baloes, estouros, passos].every(inteiro)) return 'Partida inválida.';
      const t = total as number, p = posicao as number;
      if (t < 2 || t > MAXIMO_DE_ROBOS + 1 || p < 1 || p > t) return 'Partida inválida.';
      if ((baloes as number) < 0 || (baloes as number) > BALOES || (estouros as number) < 0 || (estouros as number) > (t - 1) * BALOES) return 'Partida inválida.';
      if ((passos as number) < 0 || (passos as number) > DURACAO_PASSOS) return 'Partida inválida.';
      // ninguém joga mais passos do que o relógio deixou
      if (((passos as number) * 1000) / PASSOS_POR_SEGUNDO > agora() - inicio + 2000) return 'Partida inválida.';
      resultado = { posicao: p, total: t, baloes: baloes as number, estouros: estouros as number };
      terminar(true);
      return null;
    },
  };
}
