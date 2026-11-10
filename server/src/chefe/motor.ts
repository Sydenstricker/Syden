/**
 * O CHEFE DA TURMA (05/11/2026): a turma inteira contra a TOUPEIRA-REI, de capacete de minerador, numa arena da horta vista de
 * cima. Só a mecânica dos chefes de fim de festa (desviar do que cai e devolver o que ela joga); o bicho, a arena e os golpes
 * são nossos, desenhados por código no site (web/src/JogoChefe.tsx, web/src/chefe/).
 *
 * O JOGO: ela sai de uma das tocas, faz dois a quatro golpes, entra na terra e sai em outra. Os golpes, sempre com o AVISO
 * no chão antes (é ele que paga os ~200 ms de internet):
 * - o TERREMOTO em anel: bate as mãos no chão, e quem está dentro do círculo marcado leva;
 * - as PEDRAS: caem do teto da toca nos lugares marcados (parte em cima de quem joga, parte espalhada);
 * - a INVESTIDA: a linha marcada até a borda, e ela passa correndo por ela; no fim fica TONTA, e leva o dobro;
 * - os TORRÕES: ela os joga em arco; a sombra marca onde caem. Metade é "fria" (azulada): depois de cair, fica no chão uns
 *   segundos, e o coelho que passa por cima a pega e a ATIRA DE VOLTA (a mira é a toupeira). É assim que se tira a vida dela.
 * Cada um tem também UMA BOMBA DE SEMENTE POR FASE da toupeira (a explosão é do servidor, onde a toupeira está de verdade).
 * Ela tem três fases, cada uma mais rápida e com mais coisa caindo. Ganha a turma se ela cai; perde se todos caem. Cada
 * coelho tem 3 vidas (um golpe tira uma), e quem fica sem nenhuma assiste.
 *
 * A REDE É A DA BRIGA NA HORTA (minijogo-briga.ts, que resolveu isso primeiro):
 * - A TOUPEIRA É DO SERVIDOR: um passo próprio de 20 por segundo move ela, os torrões, as pedras e as bombas, e manda o
 *   quadro a todos pelo `difundir`.
 * - CADA COELHO É DE QUEM JOGA: anda no computador da pessoa, sem esperar, e manda a posição ~15 vezes por segundo; o
 *   servidor confere a velocidade e os limites.
 * - QUEM ACERTA TEM RAZÃO: o torrão atirado voa na tela de quem atirou, e quando ele encosta na toupeira COMO ELA APARECE
 *   NESSA TELA, o acerto vem ao servidor, que confere pelo PASSADO dela: o tiro saiu de verdade (com número, depois de pegar
 *   um torrão frio), não é velho, e o caminho dele passa perto de alguma posição dela no último 0,8 s.
 * - QUEM LEVA TEM FOLGA: o golpe dela acontece no relógio do servidor, mas só é decidido GRACA_MS depois, e a pessoa só leva
 *   se TODAS as posições que mandou nessa janela estavam dentro da área. Quem saiu do círculo quando viu o aviso escapa.
 *
 * O que continua possível pelo console, entre amigos: mentir a posição dentro do limite de velocidade, e mandar acerto de um
 * tiro que a tela errou por pouco (a folga é de FOLGA_TIRO px). Não dá para acertar sem ter pegado um torrão, nem com a
 * toupeira embaixo da terra ou do outro lado, nem soltar duas bombas na mesma fase.
 *
 * OS PONTOS são o dano que cada um deu; na tela vale o DANO DA TURMA, junto (o objetivo é cooperativo). O TROFÉU: com a
 * toupeira vencida e 2 pessoas ou mais que ficaram até o fim, o pódio pelos pontos vai à estante do quarto ('chefe'). No
 * Solo, a toupeira é mais fraca, e não há troféu.
 *
 * Este arquivo não fala com o banco (o avatar e o troféu chegam por `servicos`): assim o teste do site e a página de teste
 * rodam a regra de verdade. O que o Syden registra é server/src/minijogo-chefe.ts.
 */
import type { Contexto, Definicao } from '../minijogo-motor.js';
import {
  ACOES,
  alvoDaBomba,
  ARENA,
  BOMBA,
  CORPO_CHEFE,
  CORPO_COELHO,
  distancia,
  distSegmento,
  ESTADOS,
  fimDaInvestida,
  MARCAS,
  naArena,
  normalizar,
  PASSO_MS,
  tiroPega,
  TOCAS,
  TONTA_VEZES,
  TORRAO,
  VEL,
  VIDAS,
  vulneravel,
  type EstadoDoChefe,
  type TipoDeMarca,
} from './conta.js';

// ---------------- O RELÓGIO E AS FOLGAS ----------------
/** Quanto o servidor espera para decidir um golpe da toupeira (ver o topo). */
export const GRACA_MS = 220;
/** Quanto do passado da toupeira vale para um acerto. */
export const HISTORIA_MS = 800;
/** A folga de um acerto (px), além do corpo dela e do torrão. */
export const FOLGA_TIRO = 12;
/** Depois de levar um golpe, piscando. */
export const INVUL_MS = 2200;
/** Quanto a luta pode durar: depois disso, a turma perdeu. */
export const LUTA_MAX_MS = 10 * 60_000;
/** O tempo do "Vencemos!"/"Fim" antes do placar. */
export const FIM_MS = 3500;
export const FOLGA_VEL = 1.3;
export const ACUMULO = 18;

/** As três fases: os avisos encurtam (`k` multiplica todos), e cai mais coisa. Nem o aviso mais curto fica abaixo de ~0,9 s. */
export const FASES = [
  { k: 1, anel: 72, pedras: 4, torroes: 3, vel: 230, tonta: 1800, parada: 900, golpes: 2 },
  { k: 0.86, anel: 82, pedras: 6, torroes: 4, vel: 260, tonta: 1500, parada: 650, golpes: 3 },
  { k: 0.74, anel: 92, pedras: 8, torroes: 5, vel: 290, tonta: 1250, parada: 450, golpes: 4 },
];
/** Os avisos (ms, antes do `k` da fase). */
export const AVISO = { terremoto: 1400, pedras: 1350, investida: 1200, torrao: 1300, prepTorroes: 550 };
/** A vida da toupeira em CADA fase: no Solo, mais fraca. */
export const vidaPorFase = (n: number, solo: boolean) => (solo ? 50 : 70 + 35 * (n - 1));

type Golpe = 'terremoto' | 'pedras' | 'investida' | 'torroes';

interface Ponto {
  t: number;
  x: number;
  y: number;
}

interface Marca {
  id: number;
  tipo: TipoDeMarca;
  x: number;
  y: number;
  r: number;
  x2: number;
  y2: number;
  inicio: number;
  impacto: number;
  frio: boolean;
  resolvida: boolean;
}

interface Pancada {
  em: number;
  chave: string;
  dentro: (h: Ponto) => boolean;
}

interface Tiro {
  id: number;
  userId: number;
  n: number;
  x0: number;
  y0: number;
  dx: number;
  dy: number;
  em: number;
}

interface Bomba {
  id: number;
  userId: number;
  x0: number;
  y0: number;
  x: number;
  y: number;
  explode: number;
}

interface Balde {
  fichas: number;
  em: number;
  max: number;
  porSeg: number;
}

interface Jogador {
  userId: number;
  avatar: number | string | null;
  x: number;
  y: number;
  lado: 1 | -1;
  acao: number;
  tAcao: number;
  vidas: number;
  pontos: number;
  acertos: number;
  estado: 'em-pe' | 'sem-vidas';
  invulAte: number;
  livreAte: number;
  ultimaEm: number;
  credX: number;
  credY: number;
  historia: Ponto[];
  segura: boolean;
  bomba: boolean;
  ultimoTiro: number;
  baldes: { pos: Balde; acao: Balde };
}

export interface ServicosDoChefe {
  /** O coelho pronto do avatar da pessoa (ou null: o mascote). */
  avatarDe(userId: number): number | string | null;
  guardarTrofeu(t: { userId: number; evento: string; communityId: number; pista: string; posicao: number; tempoMs: number | null; pontos: number | null; rivais: number[] }): void;
}

export interface OpcoesDoChefe {
  agora?: () => number;
  aleatorio?: () => number;
  /** O relógio do passo (trocável no teste: o teste chama o passo à mão). */
  intervalo?: (passo: () => void, ms: number) => unknown;
  limpar?: (h: unknown) => void;
  servicos?: ServicosDoChefe;
}

const SEM_BANCO: ServicosDoChefe = { avatarDe: () => null, guardarTrofeu: () => {} };

export function criarChefe({
  agora = Date.now,
  aleatorio = Math.random,
  intervalo = (passo, ms) => {
    const h = setInterval(passo, ms);
    (h as { unref?: () => void }).unref?.();
    return h;
  },
  limpar = (h) => clearInterval(h as ReturnType<typeof setInterval>),
  servicos = SEM_BANCO,
}: OpcoesDoChefe = {}): Definicao {
  return {
    minimo: 2,
    maximo: 8,
    comecar(ctx: Contexto, { naSala }) {
      const inscritos = [...naSala].slice(0, 8);
      if (inscritos.length === 0) return 'Ninguém para jogar.';
      const solo = ctx.solo ?? (ctx.comunidade === 0 || ctx.comunidade === undefined);
      const n = inscritos.length;
      const evento = `chefe-${ctx.comunidade ?? 0}-${agora()}`;
      const inicio = agora();
      const hpFase = vidaPorFase(n, solo);
      let fase: 'lutando' | 'vitoria' | 'derrota' | 'fim' = 'lutando';
      let passo = 0;
      let proximoId = 1;
      let proximoEvento = 1;
      let relogio: unknown = null;
      let eventos: unknown[][] = [];
      let danoDaTurma = 0;
      let venceuALuta = false;
      let ultimoMotivo: string | null = null;

      // ---------------- A TOUPEIRA ----------------
      const chefe = {
        x: TOCAS[0][0],
        y: TOCAS[0][1],
        estado: 'embaixo' as EstadoDoChefe,
        desde: agora(),
        ate: agora() + 1500,
        lado: 1 as 1 | -1,
        fase: 0,
        hp: hpFase,
        /** O destino embaixo da terra. */
        destino: [TOCAS[0][0], TOCAS[0][1]] as [number, number],
        /** Os golpes que faltam nesta saída. */
        fila: [] as Golpe[],
        ultimoGolpe: null as Golpe | null,
        /** A investida: a direção, onde acaba, e o número dela (cada uma é um golpe só). */
        dx: 0,
        dy: 0,
        fim: [0, 0] as [number, number],
        marcaDaInvestida: 0,
        investidas: 0,
        /** Os torrões que ainda faltam jogar nesta vez, e de quem é a vez de ser o alvo. */
        aJogar: [] as boolean[],
        proximoTorrao: 0,
        vezDoAlvo: 0,
        historia: [] as (Ponto & { estado: EstadoDoChefe })[],
      };
      const marcas = new Map<number, Marca>();
      const noChao = new Map<number, { id: number; x: number; y: number; ate: number }>();
      const pancadas: Pancada[] = [];
      const levaram = new Map<string, Set<number>>();
      const tiros = new Map<string, Tiro>();
      const bombas = new Map<number, Bomba>();

      const balde = (max: number, porSeg: number): Balde => ({ fichas: max, em: agora(), max, porSeg });
      const gastar = (b: Balde) => {
        const t = agora();
        b.fichas = Math.min(b.max, b.fichas + ((t - b.em) / 1000) * b.porSeg);
        b.em = t;
        if (b.fichas < 1) return false;
        b.fichas -= 1;
        return true;
      };
      const jogadores = new Map<number, Jogador>(
        inscritos.map((userId, k) => [
          userId,
          {
            userId,
            avatar: servicos.avatarDe(userId),
            x: 240 + (k - (n - 1) / 2) * 40,
            y: 238,
            lado: 1,
            acao: 0,
            tAcao: 0,
            vidas: VIDAS,
            pontos: 0,
            acertos: 0,
            estado: 'em-pe',
            invulAte: agora() + 1500,
            livreAte: agora() + 1000,
            ultimaEm: agora(),
            credX: ACUMULO,
            credY: ACUMULO,
            historia: [],
            segura: false,
            bomba: true,
            ultimoTiro: 0,
            baldes: { pos: balde(10, 24), acao: balde(8, 10) },
          },
        ]),
      );
      for (const j of jogadores.values()) [j.x, j.y] = naArena(j.x, j.y);

      const evento_ = (...e: unknown[]) => eventos.push([proximoEvento++, ...e]);
      const presentes = () => new Set(ctx.naSala());
      let naSalaAgora = presentes();
      const emPe = () => [...jogadores.values()].filter((j) => j.estado === 'em-pe' && naSalaAgora.has(j.userId));
      const F = () => FASES[chefe.fase];

      const mudar = (estado: EstadoDoChefe, ms: number) => {
        chefe.estado = estado;
        chefe.desde = agora();
        chefe.ate = agora() + ms;
      };
      const novaMarca = (tipo: TipoDeMarca, x: number, y: number, r: number, x2: number, y2: number, impacto: number, frio = false) => {
        const m: Marca = { id: proximoId++, tipo, x, y, r, x2, y2, inicio: agora(), impacto, frio, resolvida: false };
        marcas.set(m.id, m);
        return m;
      };
      const pancada = (chave: string, dentro: Pancada['dentro']) => pancadas.push({ em: agora(), chave, dentro });
      const sorteio = (de: number, ate: number) => de + aleatorio() * (ate - de);
      const lugarLivre = (longeDe: [number, number], min: number): [number, number] => {
        for (let k = 0; k < 12; k++) {
          const p: [number, number] = [sorteio(ARENA.x0 + 14, ARENA.x1 - 14), sorteio(ARENA.y0 + 10, ARENA.y1 - 8)];
          if (distancia(p[0], p[1], longeDe[0], longeDe[1]) >= min) return p;
        }
        return [sorteio(ARENA.x0 + 14, ARENA.x1 - 14), ARENA.y1 - 10];
      };

      // ---------------- OS GOLPES ----------------
      const sortearGolpe = (): Golpe => {
        const opcoes = (['terremoto', 'pedras', 'investida'] as Golpe[]).filter((g) => g !== chefe.ultimoGolpe);
        return opcoes[Math.min(opcoes.length - 1, Math.floor(aleatorio() * opcoes.length))];
      };
      const montarFila = () => {
        const g = F().golpes;
        const fila: Golpe[] = [];
        for (let k = 0; k < g; k++) {
          if (k % 2 === 1) fila.push('torroes');
          else {
            const s = sortearGolpe();
            chefe.ultimoGolpe = s;
            fila.push(s);
          }
        }
        chefe.fila = fila;
      };

      const comecarGolpe = (g: Golpe) => {
        const t = agora();
        const f = F();
        if (g === 'terremoto') {
          const m = novaMarca('anel', chefe.x, chefe.y, f.anel, 0, 0, t + AVISO.terremoto * f.k);
          mudar('prep-terremoto', m.impacto - t);
        } else if (g === 'pedras') {
          const quantas = Math.min(14, f.pedras + Math.floor(n / 2));
          const alvos = emPe();
          let ultimo = t;
          for (let k = 0; k < quantas; k++) {
            const quem = alvos[k];
            const [x, y] = quem
              ? naArena(quem.x + sorteio(-8, 8), quem.y + sorteio(-6, 6))
              : lugarLivre([chefe.x, chefe.y], 40);
            ultimo = t + AVISO.pedras * f.k + k * 90;
            novaMarca('pedra', x, y, 16, 0, 0, ultimo);
          }
          mudar('prep-pedras', ultimo - t);
        } else if (g === 'investida') {
          const alvos = emPe();
          const alvo = alvos.length ? alvos[Math.min(alvos.length - 1, Math.floor(aleatorio() * alvos.length))] : null;
          let [dx, dy] = alvo ? normalizar(alvo.x - chefe.x, alvo.y - chefe.y) : [0, 0];
          if (dx === 0 && dy === 0) [dx, dy] = normalizar(sorteio(-1, 1) || 1, sorteio(-1, 1));
          chefe.dx = dx;
          chefe.dy = dy;
          chefe.lado = dx >= 0 ? 1 : -1;
          chefe.fim = fimDaInvestida(chefe.x, chefe.y, dx, dy, 26);
          chefe.investidas++;
          const m = novaMarca('investida', chefe.x, chefe.y, 20, chefe.fim[0], chefe.fim[1], t + AVISO.investida * f.k);
          chefe.marcaDaInvestida = m.id;
          mudar('prep-investida', m.impacto - t);
        } else {
          const quantos = Math.min(10, f.torroes + Math.ceil((n - 1) * 0.6));
          // metade fria (a primeira é sempre fria: sempre há o que devolver)
          chefe.aJogar = Array.from({ length: quantos }, (_, k) => k % 2 === 0);
          chefe.proximoTorrao = 0;
          mudar('prep-torroes', AVISO.prepTorroes * f.k);
        }
      };

      const proximoGolpe = () => {
        const g = chefe.fila.shift();
        if (g) comecarGolpe(g);
        else mudar('entrando', 500);
      };

      const jogarTorrao = (frio: boolean) => {
        const t = agora();
        const alvos = emPe();
        let alvo: [number, number];
        if (frio || !alvos.length) alvo = lugarLivre([chefe.x, chefe.y], 80);
        else {
          const quem = alvos[chefe.vezDoAlvo++ % alvos.length];
          alvo = naArena(quem.x + sorteio(-8, 8), quem.y + sorteio(-6, 6));
        }
        chefe.lado = alvo[0] >= chefe.x ? 1 : -1;
        novaMarca('torrao', chefe.x, chefe.y, TORRAO.raio, alvo[0], alvo[1], t + AVISO.torrao * F().k, frio);
      };

      // ---------------- A TOUPEIRA A CADA PASSO ----------------
      const passoDoChefe = (t: number, dt: number) => {
        switch (chefe.estado) {
          case 'embaixo': {
            // anda por baixo da terra até a toca escolhida (um montinho de terra na tela)
            const [dx, dy] = normalizar(chefe.destino[0] - chefe.x, chefe.destino[1] - chefe.y);
            const d = distancia(chefe.x, chefe.y, chefe.destino[0], chefe.destino[1]);
            const anda = Math.min(d, 150 * dt);
            chefe.x += dx * anda;
            chefe.y += dy * anda;
            if (dx) chefe.lado = dx > 0 ? 1 : -1;
            if (d < 1 && t >= chefe.ate) mudar('saindo', 650);
            return;
          }
          case 'saindo':
            if (t >= chefe.ate) {
              montarFila();
              mudar('parada', F().parada);
            }
            return;
          case 'parada': {
            const alvo = emPe()[0];
            if (alvo) chefe.lado = alvo.x >= chefe.x ? 1 : -1;
            if (t >= chefe.ate) proximoGolpe();
            return;
          }
          case 'prep-terremoto':
            if (t >= chefe.ate) mudar('terremoto', 450);
            return;
          case 'prep-pedras':
            if (t >= chefe.ate) mudar('pedras', 300);
            return;
          case 'terremoto':
          case 'pedras':
          case 'tonta':
            if (t >= chefe.ate) proximoGolpe();
            return;
          case 'prep-investida':
            if (t >= chefe.ate) mudar('investida', 5000);
            return;
          case 'investida': {
            const x0 = chefe.x, y0 = chefe.y;
            const falta = distancia(chefe.x, chefe.y, chefe.fim[0], chefe.fim[1]);
            const anda = Math.min(falta, F().vel * dt);
            chefe.x += chefe.dx * anda;
            chefe.y += chefe.dy * anda;
            const x1 = chefe.x, y1 = chefe.y;
            pancada(`inv-${chefe.investidas}`, (h) => distSegmento(h.x, h.y, x0, y0, x1, y1) <= 20 + CORPO_COELHO);
            if (falta - anda < 0.5 || t >= chefe.ate) {
              marcas.delete(chefe.marcaDaInvestida);
              mudar('tonta', F().tonta);
              evento_('t', Math.round(chefe.x), Math.round(chefe.y));
            }
            return;
          }
          case 'prep-torroes':
            if (t >= chefe.ate) mudar('jogando', 160 * chefe.aJogar.length + 250);
            return;
          case 'jogando': {
            const k = Math.floor((t - chefe.desde) / 160);
            while (chefe.proximoTorrao < chefe.aJogar.length && chefe.proximoTorrao <= k) jogarTorrao(chefe.aJogar[chefe.proximoTorrao++]);
            if (t >= chefe.ate) proximoGolpe();
            return;
          }
          case 'entrando':
            if (t >= chefe.ate) {
              // a próxima toca: uma que não é a mais perto de onde ela está
              const opcoes = TOCAS.filter(([x, y]) => distancia(x, y, chefe.x, chefe.y) > 40);
              const [x, y] = opcoes[Math.min(opcoes.length - 1, Math.floor(aleatorio() * opcoes.length))];
              chefe.destino = [x, y];
              mudar('embaixo', 700);
            }
            return;
          case 'fase':
            if (t >= chefe.ate) mudar('entrando', 500);
            return;
          case 'caida':
            return;
        }
      };

      // ---------------- AS MARCAS QUE CHEGAM AO CHÃO ----------------
      const resolverMarcas = (t: number) => {
        for (const m of [...marcas.values()]) {
          if (m.tipo === 'investida') continue;
          if (!m.resolvida && t >= m.impacto) {
            m.resolvida = true;
            const cx = m.tipo === 'torrao' ? m.x2 : m.x;
            const cy = m.tipo === 'torrao' ? m.y2 : m.y;
            pancada(`m-${m.id}`, (h) => distancia(h.x, h.y, cx, cy) <= m.r + CORPO_COELHO);
            if (m.tipo === 'torrao' && m.frio) noChao.set(m.id, { id: m.id, x: m.x2, y: m.y2, ate: t + TORRAO.noChaoMs });
          }
          // fica um pouco depois do impacto (a onda do anel, a poeira da pedra)
          if (m.resolvida && t >= m.impacto + 400) marcas.delete(m.id);
        }
        for (const c of [...noChao.values()]) if (t >= c.ate) noChao.delete(c.id);
      };

      // ---------------- OS GOLPES DECIDIDOS COM A FOLGA ----------------
      const decidirPancadas = (t: number) => {
        for (let k = pancadas.length - 1; k >= 0; k--) {
          const p = pancadas[k];
          if (t < p.em + GRACA_MS) continue;
          pancadas.splice(k, 1);
          const ja = levaram.get(p.chave) ?? new Set<number>();
          for (const j of emPe()) {
            if (ja.has(j.userId) || j.invulAte > p.em) continue;
            let janela = j.historia.filter((h) => h.t > p.em - PASSO_MS && h.t <= p.em + GRACA_MS);
            if (janela.length === 0) {
              const antes = j.historia.filter((h) => h.t <= p.em);
              janela = antes.length ? [antes[antes.length - 1]] : [{ t: p.em, x: j.x, y: j.y }];
            }
            if (!janela.every((h) => p.dentro(h))) continue;
            ja.add(j.userId);
            apanhar(j, t);
          }
          levaram.set(p.chave, ja);
        }
        if (levaram.size > 300) for (const k of [...levaram.keys()].slice(0, 150)) levaram.delete(k);
      };

      const apanhar = (j: Jogador, t: number) => {
        j.vidas = Math.max(0, j.vidas - 1);
        j.invulAte = t + INVUL_MS;
        j.livreAte = t + 600;
        evento_('p', j.userId, j.vidas);
        if (j.vidas === 0) {
          j.estado = 'sem-vidas';
          j.segura = false;
          evento_('k', j.userId);
          ctx.avisar();
        }
      };

      // ---------------- O DANO NA TOUPEIRA ----------------
      const danificar = (j: Jogador, base: number, tonta: boolean, x: number, y: number) => {
        if (chefe.estado === 'caida' || chefe.estado === 'fase') return;
        const dano = Math.min(chefe.hp, tonta ? base * TONTA_VEZES : base);
        chefe.hp -= dano;
        j.pontos += dano;
        j.acertos++;
        danoDaTurma += dano;
        evento_('h', j.userId, dano, Math.round(x), Math.round(y));
        if (chefe.hp > 0) return;
        // a fase caiu
        marcas.clear();
        pancadas.length = 0;
        chefe.fila = [];
        if (chefe.fase < FASES.length - 1) {
          chefe.fase++;
          chefe.hp = hpFase;
          for (const o of jogadores.values()) if (o.estado === 'em-pe') o.bomba = true;
          mudar('fase', 1800);
          evento_('f', chefe.fase);
          ctx.avisar();
        } else {
          mudar('caida', 60_000);
          acabar(true);
        }
      };

      const explodirBombas = (t: number) => {
        for (const b of [...bombas.values()]) {
          if (t < b.explode) continue;
          bombas.delete(b.id);
          evento_('x', Math.round(b.x), Math.round(b.y));
          const j = jogadores.get(b.userId);
          if (j && vulneravel(chefe.estado) && distancia(chefe.x, chefe.y, b.x, b.y) <= BOMBA.raio + CORPO_CHEFE) {
            danificar(j, BOMBA.dano, chefe.estado === 'tonta', chefe.x, chefe.y);
          }
        }
      };

      // ---------------- O PASSO ----------------
      const tick = () => {
        if (fase === 'fim') return;
        const t = agora();
        const dt = PASSO_MS / 1000;
        passo++;
        naSalaAgora = presentes();
        if (fase === 'lutando') {
          // ninguém da turma na sala: acabou, perdida e sem troféu (senão o passo seguiria por 10 minutos)
          if (![...jogadores.keys()].some((id) => naSalaAgora.has(id))) return acabar(false, true);
          passoDoChefe(t, dt);
          if (fase !== 'lutando') return;
          resolverMarcas(t);
          explodirBombas(t);
          if (fase !== 'lutando') return;
          decidirPancadas(t);
          chefe.historia.push({ t, x: chefe.x, y: chefe.y, estado: chefe.estado });
          while (chefe.historia.length && chefe.historia[0].t < t - 1500) chefe.historia.shift();
          for (const [k, tiro] of tiros) if (t - tiro.em > 3000) tiros.delete(k);
          const daTurma = [...jogadores.values()].filter((j) => naSalaAgora.has(j.userId));
          if (daTurma.length && daTurma.every((j) => j.estado === 'sem-vidas')) return acabar(false);
          if (t - inicio > LUTA_MAX_MS) return acabar(false);
        }
        difundir();
      };

      const difundir = () => {
        const t = agora();
        const ms = (x: number) => Math.round(x - t);
        ctx.difundir?.({
          tipo: 'q',
          n: passo,
          f: fase,
          // a toupeira: x, y, estado, lado, vida da fase (%), passos no estado, a fase (0 a 2), destino embaixo da terra
          c: [
            Math.round(chefe.x),
            Math.round(chefe.y),
            ESTADOS.indexOf(chefe.estado),
            chefe.lado,
            Math.max(0, Math.round((chefe.hp / hpFase) * 100)),
            Math.min(255, Math.round((t - chefe.desde) / PASSO_MS)),
            chefe.fase,
            Math.round(chefe.destino[0]),
            Math.round(chefe.destino[1]),
          ],
          // as marcas: [id, tipo, x, y, r, x2, y2, ms até o impacto, fria, ms do aviso inteiro]
          m: [...marcas.values()].map((m) => [m.id, MARCAS.indexOf(m.tipo), Math.round(m.x), Math.round(m.y), m.r, Math.round(m.x2), Math.round(m.y2), ms(m.impacto), m.frio ? 1 : 0, Math.round(m.impacto - m.inicio)]),
          // os torrões frios no chão: [id, x, y, ms que faltam]
          t: [...noChao.values()].map((c) => [c.id, Math.round(c.x), Math.round(c.y), ms(c.ate)]),
          // os coelhos: [userId, x, y, lado, ação, ms da ação, vidas, pontos, estado (0 em pé, 2 sem vidas), avatar, segura,
          // tem bomba, ms piscando, último tiro aceito]
          j: [...jogadores.values()].map((j) => [
            j.userId,
            Math.round(j.x),
            Math.round(j.y),
            j.lado,
            j.acao,
            j.tAcao,
            j.vidas,
            j.pontos,
            j.estado === 'em-pe' ? 0 : 2,
            j.avatar ?? 0,
            j.segura ? 1 : 0,
            j.bomba ? 1 : 0,
            Math.max(0, ms(j.invulAte)),
            j.ultimoTiro,
          ]),
          // os torrões atirados: [id, userId, x0, y0, dx×1000, dy×1000, ms desde o tiro]
          p: [...tiros.values()].map((s) => [s.id, s.userId, Math.round(s.x0), Math.round(s.y0), Math.round(s.dx * 1000), Math.round(s.dy * 1000), Math.round(t - s.em)]),
          // as bombas: [id, userId, x0, y0, x, y, ms até explodir]
          b: [...bombas.values()].map((b) => [b.id, b.userId, Math.round(b.x0), Math.round(b.y0), Math.round(b.x), Math.round(b.y), ms(b.explode)]),
          d: danoDaTurma,
          e: eventos,
        });
        eventos = [];
      };

      /** `vazia`: a turma inteira saiu (a partida conta como interrompida). */
      const acabar = (venceu: boolean, vazia = false) => {
        if (fase !== 'lutando') return;
        fase = venceu ? 'vitoria' : 'derrota';
        difundir();
        ctx.avisar();
        if (vazia) parar();
        ctx.agendar(FIM_MS, () => terminar(venceu, !vazia));
      };

      const parar = () => {
        if (relogio !== null) limpar(relogio);
        relogio = null;
      };

      let resultado: { userId: number; username: string; pontos: number; acertos: number; posicao: number | null }[] | null = null;
      const terminar = (venceu: boolean, completa = true) => {
        parar();
        fase = 'fim';
        const p = presentes();
        const linhas = [...jogadores.values()]
          .map((j) => ({ userId: j.userId, username: ctx.nome(j.userId), pontos: j.pontos, acertos: j.acertos }))
          .sort((a, b) => b.pontos - a.pontos || a.username.localeCompare(b.username));
        // a posição só entre quem ficou até o fim (empatados dividem); quem saiu fica sem
        const ficaram = linhas.filter((l) => p.has(l.userId));
        resultado = [
          ...ficaram.map((l) => ({ ...l, posicao: 1 + ficaram.filter((o) => o.pontos > l.pontos).length })),
          ...linhas.filter((l) => !p.has(l.userId)).map((l) => ({ ...l, posicao: null })),
        ];
        // O PÓDIO: a toupeira vencida, 2 pessoas ou mais que ficaram, até o 3º (empatados dividem), só quem deu dano
        if (venceu && !solo && ficaram.length >= 2) {
          for (const l of resultado) {
            if (l.posicao === null || l.posicao > 3 || l.pontos <= 0) continue;
            servicos.guardarTrofeu({
              userId: l.userId,
              evento,
              communityId: ctx.comunidade ?? 0,
              pista: 'chefe',
              posicao: l.posicao,
              tempoMs: null,
              pontos: l.pontos,
              rivais: ficaram.map((o) => o.userId).filter((id) => id !== l.userId),
            });
          }
        }
        venceuALuta = venceu;
        ctx.terminar(completa);
      };

      // ---------------- O QUE A PESSOA MANDA (tempo real) ----------------
      const numero = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

      const posicao = (j: Jogador, d: Record<string, unknown>) => {
        const { x, y, lado, acao, ta } = d;
        if (!numero(x) || !numero(y)) return;
        const t = agora();
        let [nx, ny] = naArena(x, y);
        // não mais rápido que o coelho anda (com um acúmulo pequeno para a rede)
        const dt = Math.max(0, (t - j.ultimaEm) / 1000);
        j.credX = Math.min(ACUMULO, j.credX + VEL * FOLGA_VEL * dt);
        j.credY = Math.min(ACUMULO, j.credY + VEL * FOLGA_VEL * dt);
        if (t > j.livreAte) {
          nx = j.x + Math.max(-j.credX, Math.min(j.credX, nx - j.x));
          ny = j.y + Math.max(-j.credY, Math.min(j.credY, ny - j.y));
          j.credX -= Math.abs(nx - j.x);
          j.credY -= Math.abs(ny - j.y);
        }
        j.x = nx;
        j.y = ny;
        j.lado = lado === -1 ? -1 : 1;
        j.acao = numero(acao) && acao >= 0 && acao < ACOES.length ? Math.floor(acao) : 0;
        j.tAcao = numero(ta) ? Math.max(0, Math.min(5000, Math.round(ta))) : 0;
        j.ultimaEm = t;
        j.historia.push({ t, x: nx, y: ny });
        while (j.historia.length && j.historia[0].t < t - 1500) j.historia.shift();
      };

      const pegar = (j: Jogador, d: Record<string, unknown>): string | null => {
        if (j.segura) return 'já segura';
        const c = noChao.get(d.torrao as number);
        if (!c) return 'torrão fora';
        if (distancia(j.x, j.y, c.x, c.y) > TORRAO.pegar + 12) return 'longe do torrão';
        noChao.delete(c.id);
        j.segura = true;
        evento_('c', c.id, j.userId);
        return null;
      };

      const atirar = (j: Jogador, d: Record<string, unknown>): string | null => {
        if (!j.segura) return 'sem torrão';
        const { n: num, x, y, dx, dy } = d;
        if (!numero(num) || !Number.isInteger(num) || num <= j.ultimoTiro || num > j.ultimoTiro + 1000) return 'número';
        if (!numero(dx) || !numero(dy)) return 'números';
        const [ux, uy] = normalizar(dx, dy);
        if (ux === 0 && uy === 0) return 'direção';
        // a origem: a que a pessoa diz, se estiver perto da que o servidor viu
        const deDiz = numero(x) && numero(y) && distancia(x, y, j.x, j.y) <= 24;
        const t = agora();
        const tiro: Tiro = { id: proximoId++, userId: j.userId, n: num, x0: deDiz ? (x as number) : j.x, y0: deDiz ? (y as number) : j.y, dx: ux, dy: uy, em: t };
        tiros.set(`${j.userId}:${num}`, tiro);
        j.ultimoTiro = num;
        j.segura = false;
        return null;
      };

      const acerto = (j: Jogador, d: Record<string, unknown>): string | null => {
        const tiro = tiros.get(`${j.userId}:${d.n}`);
        if (!tiro) return 'tiro que não saiu';
        const t = agora();
        const el = t - tiro.em;
        if (el > (TORRAO.alcance / TORRAO.vel) * 1000 + 700) return 'tiro velho';
        // o caminho do torrão (contando ~300 ms de quando ele saiu na tela de quem atirou) passa perto de alguma posição dela
        const h = chefe.historia.find(
          (h) => h.t >= t - HISTORIA_MS && h.t >= tiro.em - 400 && vulneravel(h.estado) && tiroPega(tiro.x0, tiro.y0, tiro.dx, tiro.dy, el + 300, h.x, h.y, FOLGA_TIRO),
        );
        if (!h) return 'longe da toupeira';
        tiros.delete(`${j.userId}:${d.n}`);
        danificar(j, TORRAO.dano, h.estado === 'tonta' || chefe.estado === 'tonta', h.x, h.y);
        return null;
      };

      const bomba = (j: Jogador, d: Record<string, unknown>): string | null => {
        if (!j.bomba) return 'sem bomba';
        if (!numero(d.x) || !numero(d.y)) return 'números';
        const [ax, ay] = naArena(d.x, d.y);
        const [x, y] = alvoDaBomba(j.x, j.y, ax, ay);
        j.bomba = false;
        const b: Bomba = { id: proximoId++, userId: j.userId, x0: j.x, y0: j.y, x, y, explode: agora() + BOMBA.voo };
        bombas.set(b.id, b);
        return null;
      };

      mudar('embaixo', 1500);
      relogio = intervalo(tick, PASSO_MS);

      return {
        publico() {
          return {
            fase,
            venceu: fase === 'vitoria' || (fase === 'fim' && venceuALuta),
            faseDoChefe: chefe.fase + 1,
            fases: FASES.length,
            danoDaTurma,
            jogadores: [...jogadores.values()].map((j) => ({
              userId: j.userId,
              username: ctx.nome(j.userId),
              avatar: j.avatar,
              pontos: j.pontos,
              vidas: j.vidas,
            })),
            resultado: fase === 'fim' ? resultado : null,
            partidaId: evento,
          };
        },
        acao(quem, corpo) {
          // tudo vem pelo tempo real; a ação HTTP é só para o caso de o socket cair
          if (!jogadores.has(quem)) return 'Você está assistindo esta partida.';
          return corpo.tipo === 'nada' ? null : 'Ação desconhecida.';
        },
        tempoReal(quem, dados) {
          const j = jogadores.get(quem);
          if (!j || !dados || typeof dados !== 'object' || fase !== 'lutando' || j.estado !== 'em-pe') return null;
          const d = dados as Record<string, unknown>;
          if (d.tipo === 'pos') {
            if (gastar(j.baldes.pos)) posicao(j, d);
          } else if (d.tipo === 'pegar' || d.tipo === 'atirar' || d.tipo === 'acerto' || d.tipo === 'bomba') {
            if (!gastar(j.baldes.acao)) ultimoMotivo = 'depressa demais';
            else if (d.tipo === 'pegar') ultimoMotivo = pegar(j, d);
            else if (d.tipo === 'atirar') ultimoMotivo = atirar(j, d);
            else if (d.tipo === 'acerto') ultimoMotivo = acerto(j, d);
            else ultimoMotivo = bomba(j, d);
          }
          // nada se repassa direto: o quadro de 20 por segundo leva tudo a todos
          return null;
        },
        conferir() {
          if (fase === 'fim') parar();
        },
        parar,
        // para o teste
        ...({ _passo: tick, _chefe: chefe, _jogadores: jogadores, _marcas: marcas, _noChao: noChao, _motivo: () => ultimoMotivo } as object),
      };
    },
  };
}
