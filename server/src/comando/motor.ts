/**
 * O COMANDO CENOURA (16/11/2026): correr e atirar de lado, em turma, no gênero dos fliperamas de tiro de lado — SÓ A
 * MECÂNICA (correr, pular nas tábuas, atirar em oito direções, a granada com recarga, soltar quem está preso para ganhar
 * reforço, o chefe no fim). Nenhum nome, personagem, arma, veículo, som, arte ou fase de ninguém: os coelhos atiram cenouras
 * de um lança-cenouras, os bichos (as folhas da Briga na horta, os Ultimate Monsters da Quaternius, CC0) viram FUMAÇA quando
 * caem, e não há sangue nem gente. O desenho é do site (web/src/JogoComando.tsx, web/src/comando/).
 *
 * A FASE: quatro arenas de uma tela (como a Briga), cada uma com a sua onda, e a do chefe, o dragão. Entre elas, três
 * GAIOLAS com coelhinhos presos: quem encosta abre, e ganha um reforço por ARMA_MS (o leque de três ou a rápida).
 *
 * A REDE É A DA BRIGA NA HORTA (minijogo-briga.ts) E DO CHEFE DA TURMA (chefe/motor.ts):
 * - OS BICHOS SÃO DO SERVIDOR, e as balas e sementes deles também: um passo próprio de 20 por segundo os move e manda o
 *   quadro a todos pelo `difundir`.
 * - CADA COELHO É DE QUEM JOGA: anda no computador da pessoa, sem esperar, e manda a posição ~15 vezes por segundo; o
 *   servidor confere a velocidade e a altura.
 * - QUEM ATIRA TEM RAZÃO: cada tiro é anunciado (com número, a origem e a direção) e o servidor confere o ritmo da arma que a
 *   pessoa tem e que a origem está perto de onde ele a viu. A bala voa na tela de quem atirou; quando ela encosta num bicho
 *   COMO ELE APARECE NESSA TELA, o acerto vem ao servidor, que confere o caminho dela contra o PASSADO do bicho (0,8 s).
 * - QUEM LEVA TEM FOLGA: o golpe, a bala ou a semente de um bicho acontecem no relógio do servidor, mas só são decididos
 *   GRACA_MS depois, e a pessoa só leva se TODAS as posições que mandou nessa janela estavam dentro. A preparação de todo
 *   golpe é longa e visível (a mira pisca, a marca no chão pisca): é ela que paga os ~200 ms.
 *
 * O que continua possível pelo console, entre amigos: mentir a posição dentro do limite de velocidade (e ficar no alto sem
 * plataforma, abaixo de H_MAX: o servidor não conhece o tempo de pulo), e mandar o acerto de uma bala que a tela errou por
 * pouco (a folga é de FOLGA_BALA px). Não dá para atirar mais rápido que a arma, nem com o leque sem ter aberto a gaiola, nem
 * acertar um bicho do outro lado da tela, nem soltar a granada antes da recarga.
 *
 * OS PONTOS: 10 por bala que acerta, os de cada bicho derrubado, e 200 por gaiola aberta. O TROFÉU: com a fase vencida e 2
 * pessoas ou mais que ficaram até o fim, o pódio (até o 3º, empatados dividem, só quem fez ponto) vai à estante do quarto
 * ('comando'). Perder não dá troféu; no Solo, nada.
 *
 * Este arquivo não fala com o banco (o avatar e o troféu chegam por `servicos`): o teste roda a regra de verdade. O que o
 * Syden registra é server/src/minijogo-comando.ts.
 */
import type { Contexto, Definicao } from '../minijogo-motor.js';
import {
  ACOES,
  andouABala,
  ARENA_L,
  ARMA_MS,
  ARMAS,
  ALCANCE_DA_ARMA,
  BALA,
  CAMPANHA_DO_COMANDO,
  CAPSULA,
  CENARIO_DA_FASE,
  coladoNaFaca,
  FACA,
  FASES_DO_COMANDO,
  BICHOS,
  TELEGUIADA,
  VEL_DA_ARMA,
  balaNaCaixa,
  balasDoTiro,
  COELHO_A,
  COELHO_L,
  ESTADOS,
  GRANADA,
  H_MAX,
  INTERVALO,
  ONDAS_X,
  PASSO_MS,
  PERTO_DA_GAIOLA,
  PULO_VEL,
  REFENS,
  TIPOS,
  VEL,
  VIDA,
  VIDAS,
  VOO_H,
  type Arma,
  type Comportamento,
  type MapaDoComando,
  type EstadoDoBicho,
  type TipoDoBicho,
} from './conta.js';

// ---------------- O RELÓGIO E AS FOLGAS ----------------
/** Quanto o servidor espera para decidir um golpe inimigo (ver o topo). */
export const GRACA_MS = 200;
/** Quanto do passado do bicho vale para um acerto. */
export const HISTORIA_MS = 800;
/** A folga de um acerto (px), além da caixa do bicho e do raio da bala. */
export const FOLGA_BALA = 8;
/** Quanto a origem de um tiro pode estar longe de onde o servidor viu quem atirou. */
export const FOLGA_ORIGEM = 30;
/** Depois de levar um golpe, piscando; depois de cair, quanto até voltar, e piscando ao voltar. */
export const INVUL_MS = 1200;
export const VOLTA_MS = 2000;
export const INVUL_VOLTA_MS = 2200;
/** Quanto a fase pode durar: depois disso, a turma perdeu. */
export const FASE_MAX_MS = 8 * 60_000;
/** O tempo do "Vitória!"/"Derrota" antes do placar. */
export const FIM_MS = 3500;
export const FOLGA_VEL = 1.3;
export const ACUMULO_X = 18;
export const ACUMULO_H = 26;
/** As balas inimigas: a do atirador, rente ao chão, e o fogo do chefe. */
export const TIRO_INIMIGO = { vel: 120, h: 12, raio: 4 };
export const FOGO = { vel: 150, h: 10, raio: 5 };
/** A semente do voador: cai a esta velocidade. */
export const SEMENTE = { vel: 170, raio: 5 };
/** A vida do chefe: no Solo, mais fraco; com mais gente, mais forte. */
export const vidaDoChefe = (n: number, solo: boolean) => (solo ? 140 : BICHOS.dragao.hp + 60 * (n - 1));
/** A vida do SUBCHEFE (o yeti, no meio do deserto): metade do caminho. */
export const vidaDoSubchefe = (n: number, solo: boolean) => (solo ? 70 : BICHOS.yeti.hp + 40 * (n - 1));

type Onda = Partial<Record<TipoDoBicho, number>>;
/** As ondas de cada fase: quantos de cada bicho (com mais gente, mais andarilhos). A última é a do chefe. */
export const ONDAS_DA_FASE: Record<MapaDoComando, Onda[]> = {
  floresta: [{ cogumelo: 4 }, { cogumelo: 3, dino: 2 }, { cogumelo: 3, abelha: 3 }, { cogumelo: 4, dino: 2, abelha: 2 }, { dragao: 1 }],
  // o deserto (19/11/2026): bichos novos das folhas da Briga, e o yeti de subchefe no meio
  deserto: [{ cacto: 4 }, { cacto: 3, golem: 2 }, { yeti: 1 }, { cacto: 4, golem: 2, redemoinho: 3 }, { dragao: 1 }],
};
/** As ondas da floresta (o nome de antes, para quem já importava). */
export const ONDAS = ONDAS_DA_FASE.floresta;
/** A CÁPSULA (19/11/2026): em que ondas ela passa, e que arma solta (onda → arma). */
export const CAPSULAS: Record<number, Arma> = { 1: 'chama', 3: 'teleguiada' };
/** O tempo entre uma fase e a próxima, na campanha. */
export const TROCA_DE_FASE_MS = 2500;

interface Ponto {
  t: number;
  x: number;
  h: number;
}

interface Bicho {
  id: number;
  tipo: TipoDoBicho;
  x: number;
  h: number;
  lado: 1 | -1;
  hp: number;
  hpMax: number;
  estado: EstadoDoBicho;
  desde: number;
  ate: number;
  /** O x da marca no chão (a semente do voador, o pisão do chefe), e de onde o chefe saltou. */
  alvoX: number;
  x0: number;
  proximoAtaque: number;
  /** O chefe: quantos golpes já fez (a ordem deles). */
  golpes: number;
  /** O fogo do chefe: quantas bolas faltam e quando sai a próxima. */
  fogoFalta: number;
  fogoEm: number;
  historia: Ponto[];
}

interface BalaInimiga {
  id: number;
  tipo: 0 | 1 | 2 | 3; // 0 o tiro do atirador, 1 o fogo do chefe, 2 a semente, 3 o sopro do yeti
  x: number;
  h: number;
  vx: number;
  vh: number;
  raio: number;
  ate: number;
}

interface Tiro {
  n: number;
  /** A arma com que saiu (a chama e a teleguiada têm alcance e conferência próprios). */
  arma: Arma;
  x0: number;
  h0: number;
  balas: [number, number][];
  dir: number;
  em: number;
  /** As balas (pelo índice) que já acertaram: cada uma acerta uma vez. */
  usadas: Set<number>;
}

interface Granada {
  id: number;
  userId: number;
  x0: number;
  h0: number;
  x: number;
  explode: number;
}

interface Pancada {
  em: number;
  chave: string;
  dentro: (p: Ponto) => boolean;
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
  h: number;
  lado: 1 | -1;
  acao: number;
  tAcao: number;
  mira: number;
  vidas: number;
  hp: number;
  pontos: number;
  acertos: number;
  derrubados: number;
  estado: 'em-pe' | 'fora' | 'sem-vidas';
  voltaEm: number;
  invulAte: number;
  livreAte: number;
  ultimaEm: number;
  credX: number;
  credH: number;
  historia: Ponto[];
  arma: Arma;
  armaAte: number;
  /** A última facada aceita (19/11/2026). */
  ultimaFaca: number;
  ultimoTiro: number;
  ultimaGranada: number;
  tiros: Map<number, Tiro>;
  baldes: { pos: Balde; tiro: Balde; acao: Balde };
}

export interface ServicosDoComando {
  /** O avatar da pessoa nos jogos (a receita do coelho, o número do pronto, ou null: o mascote). */
  avatarDe(userId: number): number | string | null;
  guardarTrofeu(t: { userId: number; evento: string; communityId: number; pista: string; posicao: number; tempoMs: number | null; pontos: number | null; rivais: number[] }): void;
  /** O recorde do Solo (o tempo da fase vencida, na tabela comum): o melhor de antes, e guardar o novo. Sem banco, nada. */
  recordeDe?(userId: number, variante: string): number | null;
  guardarRecorde?(userId: number, variante: string, ms: number, extra: unknown): { antes: number | null; novo: boolean };
}

export interface OpcoesDoComando {
  agora?: () => number;
  aleatorio?: () => number;
  /** O relógio do passo (trocável no teste: o teste chama o passo à mão). */
  intervalo?: (passo: () => void, ms: number) => unknown;
  limpar?: (h: unknown) => void;
  servicos?: ServicosDoComando;
}

const SEM_BANCO: ServicosDoComando = { avatarDe: () => null, guardarTrofeu: () => {} };

export function criarComando({
  agora = Date.now,
  aleatorio = Math.random,
  intervalo = (passo, ms) => {
    const h = setInterval(passo, ms);
    (h as { unref?: () => void }).unref?.();
    return h;
  },
  limpar = (h) => clearInterval(h as ReturnType<typeof setInterval>),
  servicos = SEM_BANCO,
}: OpcoesDoComando = {}): Definicao {
  return {
    minimo: 2,
    // quatro coelhos: o quinto que aceitar assiste
    maximo: 4,
    comecar(ctx: Contexto, { naSala, corpo }) {
      const inscritos = [...naSala].slice(0, 4);
      if (inscritos.length === 0) return 'Ninguém para jogar.';
      const solo = ctx.solo ?? (ctx.comunidade === 0 || ctx.comunidade === undefined);
      const n = inscritos.length;
      const evento = `comando-${ctx.comunidade ?? 0}-${agora()}`;
      const inicio = agora();
      let fase: 'lutando' | 'avancando' | 'vitoria' | 'derrota' | 'fim' = 'lutando';
      let onda = 0;
      let arena: [number, number] = [ONDAS_X[0], ONDAS_X[0] + ARENA_L];
      let fila: TipoDoBicho[] = [];
      let proximaEntrada = 0;
      let passo = 0;
      let proximoId = 1;
      let proximoEvento = 1;
      let relogio: unknown = null;
      let eventos: unknown[][] = [];
      let ultimoMotivo: string | null = null;
      let venceuAFase = false;
      let venceuEm: number | null = null;
      let recorde: { ms: number; antes: number | null; novo: boolean } | null = null;
      // A FASE (19/11/2026): a floresta, o deserto, ou a campanha (as duas seguidas); "categoria" é o que o "Jogar de novo" manda
      const pedida = typeof corpo?.fase === 'string' ? corpo.fase : typeof corpo?.categoria === 'string' ? corpo.categoria : 'floresta';
      const escolha: string = pedida === CAMPANHA_DO_COMANDO || (FASES_DO_COMANDO as readonly string[]).includes(pedida) ? pedida : 'floresta';
      const etapas: MapaDoComando[] = escolha === CAMPANHA_DO_COMANDO ? [...FASES_DO_COMANDO] : [escolha as MapaDoComando];
      let etapa = 0;
      let ondas = ONDAS_DA_FASE[etapas[0]];
      let trocaEm: number | null = null;
      /** As armas no chão, soltas pelas cápsulas: [id, arma, x, até quando]. */
      const itens: { id: number; arma: Arma; x: number; ate: number }[] = [];
      const melhorAntes = solo && servicos.recordeDe ? servicos.recordeDe(inscritos[0], escolha) : null;
      let ficaram = new Set(inscritos);
      const bichos = new Map<number, Bicho>();
      const balas: BalaInimiga[] = [];
      const granadas = new Map<number, Granada>();
      const pancadas: Pancada[] = [];
      const levaram = new Map<string, Set<number>>();
      /** As gaiolas: aberta por quem (0: ainda presa). */
      const gaiolas = REFENS.map(() => 0);

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
            x: 30 + k * 16,
            h: 0,
            lado: 1,
            acao: 0,
            tAcao: 0,
            mira: 0,
            vidas: VIDAS,
            hp: VIDA,
            pontos: 0,
            acertos: 0,
            derrubados: 0,
            estado: 'em-pe',
            voltaEm: 0,
            invulAte: agora() + 1500,
            livreAte: agora() + 1000,
            ultimaEm: agora(),
            credX: ACUMULO_X,
            credH: ACUMULO_H,
            historia: [],
            arma: 'normal',
            armaAte: 0,
            ultimoTiro: 0,
            ultimaGranada: -Infinity,
            ultimaFaca: -Infinity,
            tiros: new Map(),
            // a posição vem ~15 por segundo; os tiros, no ritmo da arma (o balde da arma é conferido à parte)
            baldes: { pos: balde(10, 24), tiro: balde(4, 12), acao: balde(6, 8) },
          },
        ]),
      );

      const evento_ = (...e: unknown[]) => eventos.push([proximoEvento++, ...e]);
      const presentes = () => new Set(ctx.naSala());
      let naSalaAgora = presentes();
      let naSalaAntes = naSalaAgora;
      const emPe = () => [...jogadores.values()].filter((j) => j.estado === 'em-pe' && naSalaAgora.has(j.userId));
      const prenderNaArena = (j: Jogador) => {
        j.x = Math.max(arena[0] + 8, Math.min(arena[1] - 8, j.x));
      };
      const sorteio = (de: number, ate: number) => de + aleatorio() * (ate - de);

      // ---------------- AS ONDAS ----------------
      const comecarOnda = (k: number) => {
        onda = k;
        fase = 'lutando';
        arena = [ONDAS_X[k], ONDAS_X[k] + ARENA_L];
        fila = [];
        const o = ondas[k];
        const doTipo = (c: Comportamento) => (Object.keys(o) as TipoDoBicho[]).filter((t) => BICHOS[t].comp === c);
        for (const t of doTipo('chefe')) fila.push(t);
        // os andarilhos primeiro (um a mais por pessoa além da primeira, só onde a onda tem andarilho), os outros intercalados
        for (const a of doTipo('andarilho')) for (let i = 0; i < (o[a] ?? 0) + (n - 1); i++) fila.push(a);
        const outros: TipoDoBicho[] = [];
        for (const t of [...doTipo('atirador'), ...doTipo('voador')]) for (let i = 0; i < (o[t] ?? 0) + (o[t] && n > 2 ? 1 : 0); i++) outros.push(t);
        outros.forEach((t, i) => fila.splice(1 + i * 2, 0, t));
        // a cápsula passa no alto, de um lado ao outro, com a arma dela
        const armaDaCapsula = CAPSULAS[k];
        if (armaDaCapsula) soltarCapsula(armaDaCapsula);
        proximaEntrada = agora() + 700;
        const p = presentes();
        ficaram = new Set([...ficaram].filter((id) => p.has(id)));
        for (const j of jogadores.values()) prenderNaArena(j);
        ctx.avisar();
      };

      /** Os bichos que contam (a cápsula não segura a onda nem a vaga na tela). */
      const vivos = () => [...bichos.values()].filter((b) => b.estado !== 'morto' && BICHOS[b.tipo].comp !== 'capsula');
      const comp = (b: Bicho) => BICHOS[b.tipo].comp;
      const temChefe = (o: Onda) => (Object.keys(o) as TipoDoBicho[]).some((t) => BICHOS[t].comp === 'chefe');
      const maxNaTela = () => (temChefe(ondas[onda]) ? 3 : 2 + n);
      /** O andarilho da fase de agora (o chefe chama esse). */
      const andarilhoDaFase = (): TipoDoBicho => (etapas[etapa] === 'deserto' ? 'cacto' : 'cogumelo');
      /** A cápsula entra pela esquerda, no alto, e vai até a direita; derrubada, solta a arma. */
      const armaDe = new Map<number, Arma>();
      const soltarCapsula = (arma: Arma) => {
        const t = agora();
        const b: Bicho = {
          id: proximoId++,
          tipo: 'capsula',
          x: arena[0] - 16,
          h: CAPSULA.h,
          lado: 1,
          hp: BICHOS.capsula.hp,
          hpMax: BICHOS.capsula.hp,
          estado: 'entrando',
          desde: t,
          ate: t,
          alvoX: 0,
          x0: arena[0] - 16,
          proximoAtaque: Infinity,
          golpes: 0,
          fogoFalta: 0,
          fogoEm: 0,
          historia: [],
        };
        bichos.set(b.id, b);
        armaDe.set(b.id, arma);
      };
      const passoDaCapsula = (b: Bicho, dt: number, t: number) => {
        b.x += CAPSULA.vel * dt;
        // o sobe e desce, pelo tempo de voo (só o servidor anda com ela; a tela interpola o quadro)
        const s = (t - b.desde) / 1000;
        b.h = CAPSULA.h + CAPSULA.onda * Math.sin(s * 2.4);
        if (b.x > arena[1] + 20) {
          bichos.delete(b.id);
          armaDe.delete(b.id);
        }
      };

      const entrar = (tipo: TipoDoBicho) => {
        const t = agora();
        const c = BICHOS[tipo].comp;
        const doLado: 1 | -1 = c === 'chefe' ? 1 : aleatorio() < 0.6 ? 1 : -1;
        const x = c === 'chefe' ? arena[1] - 50 : doLado === 1 ? arena[1] + 20 : arena[0] - 20;
        const hpMax = tipo === 'dragao' ? vidaDoChefe(n, solo) : tipo === 'yeti' ? vidaDoSubchefe(n, solo) : BICHOS[tipo].hp;
        const b: Bicho = {
          id: proximoId++,
          tipo,
          x,
          h: c === 'voador' ? VOO_H : 0,
          lado: doLado === 1 ? -1 : 1,
          hp: hpMax,
          hpMax,
          estado: c === 'voador' ? 'rondando' : c === 'chefe' ? 'chamando' : 'entrando',
          desde: t,
          ate: t + (c === 'chefe' ? 1500 : 900),
          alvoX: 0,
          x0: x,
          proximoAtaque: t + 900 + aleatorio() * 900,
          golpes: 0,
          fogoFalta: 0,
          fogoEm: 0,
          historia: [],
        };
        bichos.set(b.id, b);
        if (c === 'chefe') {
          evento_('c');
          ctx.avisar();
        }
      };

      // ---------------- OS BICHOS, A CADA PASSO ----------------
      const mudar = (b: Bicho, estado: EstadoDoBicho, ms: number) => {
        b.estado = estado;
        b.desde = agora();
        b.ate = agora() + ms;
      };
      const maisPerto = (x: number) => {
        let melhor: Jogador | null = null;
        let d = Infinity;
        for (const j of emPe()) {
          const dd = Math.abs(j.x - x);
          if (dd < d) {
            d = dd;
            melhor = j;
          }
        }
        return melhor;
      };
      const andarAte = (b: Bicho, x: number, vel: number, dt: number) => {
        const dx = x - b.x;
        b.x += Math.sign(dx) * Math.min(Math.abs(dx), vel * dt);
      };
      const pancada = (chave: string, dentro: Pancada['dentro']) => pancadas.push({ em: agora(), chave, dentro });
      const atirar = (tipo: 0 | 1 | 2 | 3, x: number, h: number, vx: number, vh: number, raio: number) => {
        balas.push({ id: proximoId++, tipo, x, h, vx, vh, raio, ate: agora() + 4000 });
      };
      const dentroDaArena = (x: number, margem: number) => Math.max(arena[0] + margem, Math.min(arena[1] - margem, x));

      /** O andarilho: chega perto de quem está mais perto, prepara (o braço para trás) e bate na frente. */
      const passoDoAndarilho = (b: Bicho, dt: number, t: number) => {
        const alvo = maisPerto(b.x);
        switch (b.estado) {
          case 'entrando':
          case 'andando': {
            if (!alvo) return;
            const lado = b.x < alvo.x ? -1 : 1;
            // os andarilhos não empilham: o segundo vai pelo outro lado, se couber
            const outros = vivos().filter((o) => o !== b && comp(o) === 'andarilho' && Math.sign(o.x - alvo.x) === lado && Math.abs(o.x - alvo.x) < 40);
            const ladoFinal = outros.length ? -lado : lado;
            let destino = alvo.x + ladoFinal * 20;
            if (destino < arena[0] + 10 || destino > arena[1] - 10) destino = alvo.x - ladoFinal * 20;
            andarAte(b, destino, b.estado === 'entrando' ? 50 : 40, dt);
            b.lado = alvo.x > b.x ? 1 : -1;
            if (b.estado === 'entrando' && t >= b.ate) mudar(b, 'andando', 0);
            if (Math.abs(b.x - destino) < 3 && t >= b.proximoAtaque && alvo.h < 30) mudar(b, 'preparando', 560);
            return;
          }
          case 'preparando':
            if (t >= b.ate) {
              mudar(b, 'atacando', 220);
              const x0 = b.x, lado = b.lado;
              pancada(`b${b.id}-${t}`, (p) => {
                const dx = (p.x - x0) * lado;
                return dx >= 0 && dx <= 30 && p.h < 22;
              });
            }
            return;
          case 'atacando':
            if (t >= b.ate) mudar(b, 'recuperando', 600);
            return;
          case 'recuperando':
            if (t >= b.ate) {
              b.proximoAtaque = t + 500 + aleatorio() * 900;
              mudar(b, 'andando', 0);
            }
            return;
        }
      };

      /** O atirador: para a ~120 px, mira (a linha pisca rente ao chão) e atira; quem pula ou está na tábua escapa. */
      const passoDoAtirador = (b: Bicho, dt: number, t: number) => {
        const alvo = maisPerto(b.x);
        switch (b.estado) {
          case 'entrando':
          case 'andando': {
            if (!alvo) return;
            const lado = b.x < alvo.x ? -1 : 1;
            let destino = alvo.x + lado * 120;
            if (destino < arena[0] + 14 || destino > arena[1] - 14) destino = alvo.x - lado * 120;
            andarAte(b, dentroDaArena(destino, 14), b.estado === 'entrando' ? 50 : 36, dt);
            b.lado = alvo.x > b.x ? 1 : -1;
            if (b.estado === 'entrando' && t >= b.ate) mudar(b, 'andando', 0);
            if (b.estado === 'andando' && t >= b.proximoAtaque && Math.abs(b.x - alvo.x) > 50) mudar(b, 'mirando', 850);
            return;
          }
          case 'mirando':
            if (t >= b.ate) {
              atirar(0, b.x + b.lado * (BICHOS[b.tipo].larg + 4), TIRO_INIMIGO.h, b.lado * TIRO_INIMIGO.vel, 0, TIRO_INIMIGO.raio);
              mudar(b, 'atacando', 300);
            }
            return;
          case 'atacando':
            if (t >= b.ate) mudar(b, 'recuperando', 900);
            return;
          case 'recuperando':
            if (t >= b.ate) {
              b.proximoAtaque = t + 1400 + aleatorio() * 1200;
              mudar(b, 'andando', 0);
            }
            return;
        }
      };

      /** O voador: paira no alto, vai para cima de alguém, marca o chão (a marca pisca) e solta a semente. */
      const passoDoVoador = (b: Bicho, dt: number, t: number) => {
        const alvo = maisPerto(b.x);
        switch (b.estado) {
          case 'rondando': {
            b.h += (VOO_H - b.h) * Math.min(1, dt * 3);
            if (!alvo) return;
            const destino = dentroDaArena(alvo.x, 16);
            andarAte(b, destino, 46, dt);
            b.lado = alvo.x > b.x ? 1 : -1;
            if (t >= b.proximoAtaque && Math.abs(b.x - destino) < 4 && b.x > arena[0] + 10 && b.x < arena[1] - 10) {
              b.alvoX = b.x;
              mudar(b, 'marcando', 950);
            }
            return;
          }
          case 'marcando':
            if (t >= b.ate) {
              atirar(2, b.alvoX, b.h - 4, 0, -SEMENTE.vel, SEMENTE.raio);
              mudar(b, 'recuperando', 700);
            }
            return;
          case 'recuperando':
            if (t >= b.ate) {
              b.proximoAtaque = t + 1500 + aleatorio() * 1200;
              mudar(b, 'rondando', 0);
            }
            return;
        }
      };

      /**
       * O chefe, o dragão, no lado direito da arena: o FOGO (a linha pisca rente ao chão, e saem três bolas: pular ou subir na
       * tábua), o PISÃO (a marca pisca embaixo de alguém, e ele salta e cai ali) e o CHAMADO (dois andarilhos), em roda.
       */
      const passoDoChefe = (b: Bicho, dt: number, t: number) => {
        const alvo = maisPerto(b.x);
        if (alvo) b.lado = alvo.x > b.x ? 1 : -1;
        switch (b.estado) {
          case 'chamando':
          case 'recuperando':
          case 'andando':
            // volta devagar ao canto dele, entre um golpe e outro
            andarAte(b, arena[1] - 50, 30, dt);
            if (t >= b.ate && t >= b.proximoAtaque) {
              const g = b.golpes++ % 4;
              if (g === 0 || g === 2) mudar(b, 'prep-fogo', 1000);
              else if (g === 1 && alvo) {
                b.alvoX = dentroDaArena(alvo.x, 30);
                mudar(b, 'prep-pisao', 1000);
              } else if (vivos().length < 3) {
                for (let k = 0; k < Math.min(2, n + 1); k++) fila.push(andarilhoDaFase());
                mudar(b, 'chamando', 1200);
                b.proximoAtaque = t + 1200;
              } else mudar(b, 'recuperando', 400);
            }
            return;
          case 'prep-fogo':
            if (t >= b.ate) {
              b.fogoFalta = 3;
              b.fogoEm = t;
              mudar(b, 'fogo', 900);
            }
            return;
          case 'fogo':
            if (b.fogoFalta > 0 && t >= b.fogoEm) {
              atirar(b.tipo === 'yeti' ? 3 : 1, b.x - BICHOS[b.tipo].larg - 2, FOGO.h, -FOGO.vel, 0, FOGO.raio);
              b.fogoFalta--;
              b.fogoEm = t + 300;
            }
            if (t >= b.ate) {
              b.proximoAtaque = t + 700 + aleatorio() * 500;
              mudar(b, 'recuperando', 0);
            }
            return;
          case 'prep-pisao':
            if (t >= b.ate) {
              b.x0 = b.x;
              mudar(b, 'saltando', 750);
            }
            return;
          case 'saltando': {
            const p = Math.min(1, (t - b.desde) / 750);
            b.x = b.x0 + (b.alvoX - b.x0) * p;
            b.h = 4 * 70 * p * (1 - p);
            if (p >= 1) {
              b.h = 0;
              const x0 = b.x;
              pancada(`b${b.id}-pisao-${t}`, (q) => Math.abs(q.x - x0) <= 40 && q.h < 14);
              evento_('t', Math.round(x0));
              b.proximoAtaque = t + 900 + aleatorio() * 500;
              mudar(b, 'recuperando', 0);
            }
            return;
          }
        }
      };

      /** As balas e sementes andam; cada passo é uma pancada do trecho (decidida com a folga, como as outras). */
      const passoDasBalas = (dt: number, t: number) => {
        for (let k = balas.length - 1; k >= 0; k--) {
          const b = balas[k];
          const x0 = b.x, h0 = b.h;
          b.x += b.vx * dt;
          b.h += b.vh * dt;
          const x1 = b.x, h1 = Math.max(0, b.h);
          const r = b.raio;
          pancadas.push({
            em: t,
            chave: `bala-${b.id}`,
            dentro: (p) =>
              Math.max(x0, x1) + r >= p.x - COELHO_L && Math.min(x0, x1) - r <= p.x + COELHO_L && Math.max(h0, h1) + r >= p.h && Math.min(h0, h1) - r <= p.h + COELHO_A,
          });
          if (t >= b.ate || b.h <= 0 || b.x < arena[0] - 30 || b.x > arena[1] + 30) {
            if (b.tipo === 2 && b.h <= 0) evento_('s', Math.round(b.x));
            balas.splice(k, 1);
          }
        }
      };

      const passoComum = (b: Bicho, t: number) => {
        if (b.estado === 'dor') {
          if (t >= b.ate) mudar(b, comp(b) === 'voador' ? 'rondando' : 'andando', 0);
          return true;
        }
        if (b.estado === 'morto') {
          if (t >= b.ate) bichos.delete(b.id);
          return true;
        }
        return false;
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
              janela = antes.length ? [antes[antes.length - 1]] : [{ t: p.em, x: j.x, h: j.h }];
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
        j.hp = Math.max(0, j.hp - 1);
        j.invulAte = t + INVUL_MS;
        j.livreAte = t + 600;
        evento_('p', j.userId, j.hp);
        if (j.hp > 0) return;
        j.vidas = Math.max(0, j.vidas - 1);
        j.estado = j.vidas === 0 ? 'sem-vidas' : 'fora';
        j.voltaEm = t + VOLTA_MS;
        // a arma de reforço vai junto com a vida
        j.arma = 'normal';
        j.armaAte = 0;
        evento_('k', j.userId, j.vidas);
        ctx.avisar();
      };

      // ---------------- O DANO NOS BICHOS ----------------
      const danificar = (j: Jogador, b: Bicho, dano: number) => {
        if (b.estado === 'morto' || b.hp <= 0) return;
        const d = Math.min(b.hp, dano);
        b.hp -= d;
        j.pontos += d * 10;
        j.acertos++;
        evento_('h', b.id, j.userId, Math.round(b.x), Math.round(b.h + BICHOS[b.tipo].alto / 2));
        if (b.hp > 0) {
          // o pequeno sente o golpe (e perde a preparação); o chefe só pisca
          if (comp(b) !== 'chefe' && comp(b) !== 'capsula' && (b.estado === 'andando' || b.estado === 'rondando' || b.estado === 'entrando')) mudar(b, 'dor', 160);
          return;
        }
        j.pontos += BICHOS[b.tipo].pontos;
        j.derrubados++;
        // vira fumaça: o site desenha a nuvem, e o bicho some
        mudar(b, 'morto', 500);
        evento_('x', b.id, Math.round(b.x), Math.round(b.h + BICHOS[b.tipo].alto / 2), TIPOS.indexOf(b.tipo));
        if (comp(b) === 'capsula') {
          // a arma cai no chão, dentro da arena, e fica um tempo para quem chegar primeiro
          const arma = armaDe.get(b.id) ?? 'chama';
          armaDe.delete(b.id);
          itens.push({ id: proximoId++, arma, x: dentroDaArena(b.x, 16), ate: agora() + CAPSULA.itemMs });
          return;
        }
        if (comp(b) === 'chefe') {
          // o chefe caiu: os que ele chamou viram fumaça junto
          for (const o of vivos()) if (o !== b) mudar(o, 'morto', 500);
          fila = [];
          balas.length = 0;
          pancadas.length = 0;
          // o subchefe só acaba a onda; o chefe da última onda acaba a fase (na campanha, vem a próxima)
          if (onda === ondas.length - 1) {
            if (etapa < etapas.length - 1) trocaEm = agora() + TROCA_DE_FASE_MS;
            else acabar(true);
          }
        }
      };

      const explodirGranadas = (t: number) => {
        for (const g of [...granadas.values()]) {
          if (t < g.explode) continue;
          granadas.delete(g.id);
          evento_('g', Math.round(g.x));
          const j = jogadores.get(g.userId);
          if (!j) continue;
          for (const b of vivos()) {
            const c = BICHOS[b.tipo];
            if (Math.abs(b.x - g.x) <= GRANADA.raio + c.larg && b.h <= GRANADA.raio) danificar(j, b, GRANADA.dano);
          }
        }
      };

      // ---------------- O PASSO ----------------
      const tick = () => {
        if (fase === 'fim') return;
        const t = agora();
        const dt = PASSO_MS / 1000;
        passo++;
        naSalaAntes = naSalaAgora;
        naSalaAgora = presentes();
        for (const j of jogadores.values()) {
          if (naSalaAgora.has(j.userId) && !naSalaAntes.has(j.userId)) {
            prenderNaArena(j);
            j.livreAte = t + 1500;
          }
        }
        if (fase === 'lutando' || fase === 'avancando') {
          if (![...jogadores.keys()].some((id) => naSalaAgora.has(id))) return acabar(false, true);
          if (fase === 'lutando' && fila.length && t >= proximaEntrada && vivos().length < maxNaTela()) {
            entrar(fila.shift()!);
            proximaEntrada = t + 800 + aleatorio() * 900;
          }
          for (const b of [...bichos.values()]) {
            if (!passoComum(b, t)) {
              const c = comp(b);
              if (c === 'andarilho') passoDoAndarilho(b, dt, t);
              else if (c === 'atirador') passoDoAtirador(b, dt, t);
              else if (c === 'voador') passoDoVoador(b, dt, t);
              else if (c === 'capsula') passoDaCapsula(b, dt, t);
              else passoDoChefe(b, dt, t);
            }
            if (fase !== 'lutando' && fase !== 'avancando') return;
            if (b.estado !== 'entrando' && b.estado !== 'saltando') b.x = dentroDaArena(b.x, 10);
            b.historia.push({ t, x: b.x, h: b.h });
            while (b.historia.length && b.historia[0].t < t - 1200) b.historia.shift();
          }
          passoDasBalas(dt, t);
          explodirGranadas(t);
          if (fase !== 'lutando' && fase !== 'avancando') return;
          decidirPancadas(t);
          for (const j of jogadores.values()) {
            if (j.armaAte && t >= j.armaAte) {
              j.arma = 'normal';
              j.armaAte = 0;
            }
            for (const [k, tiro] of j.tiros) if (t - tiro.em > 2500) j.tiros.delete(k);
            if (j.estado === 'fora' && t >= j.voltaEm) {
              j.estado = 'em-pe';
              j.hp = VIDA;
              j.x = arena[0] + 30;
              j.h = 0;
              j.invulAte = t + INVUL_VOLTA_MS;
              j.livreAte = t + 1500;
              j.historia = [];
              evento_('r', j.userId, Math.round(j.x));
              ctx.avisar();
            }
          }
          // as armas no chão somem com o tempo
          for (let k = itens.length - 1; k >= 0; k--) if (t >= itens[k].ate) itens.splice(k, 1);
          // a campanha: vencido o chefe de uma fase, a próxima começa do começo
          if (trocaEm !== null) {
            if (t >= trocaEm) proximaEtapa(t);
          } else if (fase === 'lutando' && fila.length === 0 && vivos().length === 0 && onda < ondas.length - 1) {
            // a onda acabou: a câmera anda quando alguém chega à frente
            fase = 'avancando';
            arena = [arena[0], ONDAS_X[onda + 1] + ARENA_L];
            ctx.avisar();
          } else if (fase === 'avancando' && emPe().some((j) => j.x >= ONDAS_X[onda + 1] + 90)) {
            comecarOnda(onda + 1);
          }
          const daTurma = [...jogadores.values()].filter((j) => naSalaAgora.has(j.userId));
          if (daTurma.length && daTurma.every((j) => j.estado === 'sem-vidas')) return acabar(false);
          if (t - inicio > FASE_MAX_MS * etapas.length) return acabar(false);
        }
        difundir();
      };

      /** A próxima fase da campanha: a arena volta ao começo, a turma em pé lado a lado, as gaiolas fechadas de novo. */
      const proximaEtapa = (t: number) => {
        trocaEm = null;
        etapa++;
        ondas = ONDAS_DA_FASE[etapas[etapa]];
        balas.length = 0;
        pancadas.length = 0;
        granadas.clear();
        bichos.clear();
        armaDe.clear();
        itens.length = 0;
        for (let k = 0; k < gaiolas.length; k++) gaiolas[k] = 0;
        arena = [ONDAS_X[0], ONDAS_X[0] + ARENA_L];
        let k = 0;
        for (const j of jogadores.values()) {
          if (j.estado === 'sem-vidas') continue;
          j.x = 30 + k++ * 16;
          j.h = 0;
          j.invulAte = t + INVUL_VOLTA_MS;
          j.livreAte = t + 1500;
          j.historia = [];
          if (j.estado === 'em-pe') evento_('r', j.userId, Math.round(j.x));
        }
        evento_('f', etapa);
        comecarOnda(0);
      };

      const difundir = () => {
        const t = agora();
        ctx.difundir?.({
          tipo: 'q',
          n: passo,
          f: fase,
          o: onda,
          a: arena,
          // os bichos: [id, tipo, x, h, estado, lado, vida %, passos no estado, x da marca]
          i: [...bichos.values()].map((b) => [
            b.id,
            TIPOS.indexOf(b.tipo),
            Math.round(b.x),
            Math.round(b.h),
            ESTADOS.indexOf(b.estado),
            b.lado,
            Math.max(0, Math.round((b.hp / b.hpMax) * 100)),
            Math.min(255, Math.round((t - b.desde) / PASSO_MS)),
            Math.round(b.alvoX),
          ]),
          // as balas dos bichos: [id, tipo, x, h, vx, vh]
          b: balas.map((b) => [b.id, b.tipo, Math.round(b.x), Math.round(b.h), Math.round(b.vx), Math.round(b.vh)]),
          // as granadas: [id, userId, x0, h0, x, ms até explodir]
          g: [...granadas.values()].map((g) => [g.id, g.userId, Math.round(g.x0), Math.round(g.h0), Math.round(g.x), Math.round(g.explode - t)]),
          // as gaiolas: quem abriu cada uma (0: presa)
          r: gaiolas,
          // o cenário da fase (o índice das fases da Briga) e as armas no chão: [id, arma, x]
          fs: CENARIO_DA_FASE[etapas[etapa]],
          it: itens.map((it) => [it.id, ARMAS.indexOf(it.arma), Math.round(it.x)]),
          // os coelhos: [userId, x, h, lado, ação, ms da ação, mira, vidas, golpes que aguenta, pontos, estado (0 em pé, 1
          // fora, 2 sem vidas), avatar, arma, ms de arma, ms piscando, último tiro aceito]
          j: [...jogadores.values()].map((j) => [
            j.userId,
            Math.round(j.x),
            Math.round(j.h),
            j.lado,
            j.acao,
            j.tAcao,
            j.mira,
            j.vidas,
            j.hp,
            j.pontos,
            j.estado === 'em-pe' ? 0 : j.estado === 'fora' ? 1 : 2,
            j.avatar ?? 0,
            ARMAS.indexOf(j.arma),
            j.armaAte ? Math.max(0, Math.round(j.armaAte - t)) : 0,
            Math.max(0, Math.round(j.invulAte - t)),
            j.ultimoTiro,
          ]),
          // os tiros (para cada um desenhar as balas dos outros): [userId, n, x0, h0, direção, leque (1/0), ms desde]
          p: [...jogadores.values()].flatMap((j) =>
            [...j.tiros.values()].filter((s) => t - s.em < 900).map((s) => [j.userId, s.n, Math.round(s.x0), Math.round(s.h0), s.dir, s.balas.length === 3 ? 1 : 0, Math.round(t - s.em), ARMAS.indexOf(s.arma)]),
          ),
          e: eventos,
        });
        eventos = [];
      };

      /** `vazia`: a turma inteira saiu (a partida conta como interrompida). */
      const acabar = (venceu: boolean, vazia = false) => {
        if (fase !== 'lutando' && fase !== 'avancando') return;
        fase = venceu ? 'vitoria' : 'derrota';
        if (venceu) venceuEm = agora();
        difundir();
        ctx.avisar();
        if (vazia) parar();
        ctx.agendar(FIM_MS, () => terminar(venceu, !vazia));
      };

      const parar = () => {
        if (relogio !== null) limpar(relogio);
        relogio = null;
      };

      let resultado: { userId: number; username: string; pontos: number; acertos: number; derrubados: number; posicao: number | null }[] | null = null;
      const terminar = (venceu: boolean, completa = true) => {
        parar();
        fase = 'fim';
        const p = presentes();
        const turma = new Set([...ficaram].filter((id) => p.has(id)));
        const linhas = [...jogadores.values()]
          .map((j) => ({ userId: j.userId, username: ctx.nome(j.userId), pontos: j.pontos, acertos: j.acertos, derrubados: j.derrubados }))
          .sort((a, b) => b.pontos - a.pontos || a.username.localeCompare(b.username));
        const daTurma = linhas.filter((l) => turma.has(l.userId));
        resultado = [
          ...daTurma.map((l) => ({ ...l, posicao: 1 + daTurma.filter((o) => o.pontos > l.pontos).length })),
          ...linhas.filter((l) => !turma.has(l.userId)).map((l) => ({ ...l, posicao: null })),
        ];
        // O PÓDIO: fase vencida, 2 pessoas ou mais que ficaram até o fim, até o 3º (empatados dividem), só quem fez ponto
        if (venceu && !solo && turma.size >= 2) {
          for (const l of resultado) {
            if (l.posicao === null || l.posicao > 3 || l.pontos <= 0) continue;
            servicos.guardarTrofeu({
              userId: l.userId,
              evento,
              communityId: ctx.comunidade ?? 0,
              pista: 'comando',
              posicao: l.posicao,
              tempoMs: null,
              pontos: l.pontos,
              rivais: [...turma].filter((id) => id !== l.userId),
            });
          }
        }
        venceuAFase = venceu;
        // O RECORDE DO SOLO (19/11/2026): o tempo da fase vencida, pelo relógio daqui, na tabela comum
        if (venceu && solo && venceuEm !== null && servicos.guardarRecorde) {
          const ms = venceuEm - inicio;
          try {
            recorde = { ms, ...servicos.guardarRecorde(inscritos[0], escolha, ms, { pontos: jogadores.get(inscritos[0])?.pontos ?? 0 }) };
          } catch {
            // sem a conta (o teste): a fase acaba igual
          }
        }
        ctx.terminar(completa);
      };

      // ---------------- O QUE A PESSOA MANDA (tempo real) ----------------
      const numero = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

      const posicao = (j: Jogador, d: Record<string, unknown>) => {
        const { x, h, lado, acao, ta, mira } = d;
        if (!numero(x) || !numero(h)) return;
        const t = agora();
        let nx = Math.max(arena[0] - 8, Math.min(arena[1] + 8, x));
        let nh = Math.max(0, Math.min(H_MAX, h));
        // não mais rápido que o coelho corre e pula (com um acúmulo pequeno para a rede)
        const dt = Math.max(0, (t - j.ultimaEm) / 1000);
        j.credX = Math.min(ACUMULO_X, j.credX + VEL * FOLGA_VEL * dt);
        j.credH = Math.min(ACUMULO_H, j.credH + PULO_VEL * FOLGA_VEL * dt);
        if (t > j.livreAte) {
          nx = j.x + Math.max(-j.credX, Math.min(j.credX, nx - j.x));
          // subir é limitado; cair, não (a gravidade não tem teto)
          if (nh > j.h) nh = j.h + Math.min(j.credH, nh - j.h);
          j.credX -= Math.abs(nx - j.x);
          if (nh > j.h) j.credH -= nh - j.h;
        }
        j.x = nx;
        j.h = nh;
        j.lado = lado === -1 ? -1 : 1;
        j.acao = numero(acao) && acao >= 0 && acao < ACOES.length ? Math.floor(acao) : 0;
        j.tAcao = numero(ta) ? Math.max(0, Math.min(5000, Math.round(ta))) : 0;
        j.mira = numero(mira) && mira >= 0 && mira < 8 ? Math.floor(mira) : 0;
        j.ultimaEm = t;
        j.historia.push({ t, x: nx, h: nh });
        while (j.historia.length && j.historia[0].t < t - 1500) j.historia.shift();
      };

      /** Um tiro: com número, no ritmo da arma, saindo de perto de onde o servidor viu a pessoa. */
      const tiro = (j: Jogador, d: Record<string, unknown>): string | null => {
        const { n: num, x, h, dir } = d;
        if (!numero(num) || !Number.isInteger(num) || num <= j.ultimoTiro || num > j.ultimoTiro + 1000) return 'número';
        if (!numero(dir) || !Number.isInteger(dir) || dir < 0 || dir > 7) return 'direção';
        if (!numero(x) || !numero(h)) return 'números';
        if (Math.abs(x - j.x) > FOLGA_ORIGEM || Math.abs(h - (j.h + 20)) > FOLGA_ORIGEM) return 'longe de si';
        // o ritmo da arma: um balde que enche no ritmo dela, com 3 de folga para a rede (pacotes que chegam juntos)
        const b = j.baldes.tiro;
        b.porSeg = (1000 / INTERVALO[j.arma]) * 1.1;
        if (!gastar(b)) return 'depressa demais';
        const t = agora();
        j.tiros.set(num, { n: num, arma: j.arma, x0: x, h0: h, balas: balasDoTiro(dir, j.arma), dir, em: t, usadas: new Set() });
        j.ultimoTiro = num;
        return null;
      };

      const acerto = (j: Jogador, d: Record<string, unknown>): string | null => {
        const s = j.tiros.get(d.n as number);
        if (!s) return 'tiro que não saiu';
        const k = d.k;
        if (!numero(k) || !Number.isInteger(k) || k < 0 || k >= s.balas.length) return 'bala';
        if (s.usadas.has(k)) return 'bala usada';
        const b = bichos.get(d.inimigo as number);
        if (!b || b.estado === 'morto' || b.hp <= 0) return 'bicho fora';
        const t = agora();
        const el = t - s.em;
        if (el > (ALCANCE_DA_ARMA[s.arma] / VEL_DA_ARMA[s.arma]) * 1000 + 700) return 'tiro velho';
        const [dx, dh] = s.balas[k];
        const c = BICHOS[b.tipo];
        if (s.arma === 'teleguiada') {
          // A TELEGUIADA (19/11/2026) faz curva na tela de quem atirou: o servidor confere que o bicho esteve ao alcance do
          // caminho que ela pode ter feito até agora (a distância, não a linha), e que a mira apontava para o lado dele
          const alcance = andouABala(el + 300, 'teleguiada') + c.larg + FOLGA_BALA + 12;
          const ok = b.historia.some((p) => {
            if (p.t < t - HISTORIA_MS || p.t < s.em - 400) return false;
            const ddx = p.x - s.x0, ddh = p.h + c.alto / 2 - s.h0;
            return Math.hypot(ddx, ddh) <= alcance && ddx * dx + ddh * dh > -20;
          });
          if (!ok) return 'longe do bicho';
          s.usadas.add(k);
          danificar(j, b, TELEGUIADA.dano);
          return null;
        }
        // o caminho da bala (contando ~300 ms de quando ela saiu na tela de quem atirou) passa por alguma posição dele
        const perto = b.historia.some((p) => p.t >= t - HISTORIA_MS && p.t >= s.em - 400 && balaNaCaixa(s.x0, s.h0, dx, dh, 0, andouABala(el + 300, s.arma), p.x, p.h, c.larg, c.alto, FOLGA_BALA));
        if (!perto) return 'longe do bicho';
        s.usadas.add(k);
        danificar(j, b, 1);
        return null;
      };

      /** A FACADA (19/11/2026): o bicho colado, conferido pelo passado dele (como a bala), no ritmo da faca. */
      const faca = (j: Jogador, d: Record<string, unknown>): string | null => {
        const t = agora();
        if (t - j.ultimaFaca < FACA.intervalo - 80) return 'depressa demais';
        const b = bichos.get(d.inimigo as number);
        if (!b || b.estado === 'morto' || b.hp <= 0) return 'bicho fora';
        const c = BICHOS[b.tipo];
        const perto = b.historia.some((p) => p.t >= t - HISTORIA_MS && coladoNaFaca(j.x, j.h, j.lado, p.x, p.h, c.larg, c.alto, FOLGA_BALA));
        if (!perto) return 'longe do bicho';
        j.ultimaFaca = t;
        danificar(j, b, FACA.dano);
        return null;
      };

      const granada = (j: Jogador, d: Record<string, unknown>): string | null => {
        const t = agora();
        if (t - j.ultimaGranada < GRANADA.recarga - 300) return 'recarga';
        const { x, h, lado } = d;
        if (!numero(x) || !numero(h)) return 'números';
        if (Math.abs(x - j.x) > FOLGA_ORIGEM || Math.abs(h - j.h) > FOLGA_ORIGEM) return 'longe de si';
        const l = lado === -1 ? -1 : 1;
        j.ultimaGranada = t;
        const g: Granada = { id: proximoId++, userId: j.userId, x0: x, h0: h, x: x + l * GRANADA.alcance, explode: t + GRANADA.voo };
        granadas.set(g.id, g);
        return null;
      };

      /** PEGAR A ARMA que a cápsula soltou: de perto, no chão, a primeira pessoa que chega leva. */
      const pegarArma = (j: Jogador, d: Record<string, unknown>): string | null => {
        const k = itens.findIndex((it) => it.id === d.item);
        if (k < 0) return 'arma fora';
        const it = itens[k];
        if (Math.abs(j.x - it.x) > PERTO_DA_GAIOLA + 10 || j.h > 30) return 'longe da arma';
        itens.splice(k, 1);
        j.arma = it.arma;
        j.armaAte = agora() + ARMA_MS;
        j.pontos += 100;
        evento_('w', it.id, j.userId, ARMAS.indexOf(it.arma));
        ctx.avisar();
        return null;
      };

      const soltar = (j: Jogador, d: Record<string, unknown>): string | null => {
        const k = d.gaiola;
        if (!numero(k) || !Number.isInteger(k) || k < 0 || k >= REFENS.length) return 'gaiola';
        if (gaiolas[k]) return 'já aberta';
        if (Math.abs(j.x - REFENS[k][0]) > PERTO_DA_GAIOLA + 10 || j.h > 30) return 'longe da gaiola';
        gaiolas[k] = j.userId;
        j.arma = REFENS[k][1];
        j.armaAte = agora() + ARMA_MS;
        j.pontos += 200;
        evento_('l', k, j.userId, ARMAS.indexOf(j.arma));
        ctx.avisar();
        return null;
      };

      comecarOnda(0);
      relogio = intervalo(tick, PASSO_MS);

      return {
        publico() {
          return {
            fase,
            onda: onda + 1,
            ondas: ondas.length,
            // a fase escolhida (ou a campanha) e a que está na tela; "categoria" volta no "Jogar de novo"
            categoria: escolha,
            mapa: etapas[etapa],
            etapa: etapa + 1,
            etapas: etapas.length,
            venceu: fase === 'vitoria' || (fase === 'fim' && venceuAFase),
            jogadores: [...jogadores.values()].map((j) => ({
              userId: j.userId,
              username: ctx.nome(j.userId),
              avatar: j.avatar,
              pontos: j.pontos,
              vidas: j.vidas,
            })),
            resultado: fase === 'fim' ? resultado : null,
            partidaId: evento,
            ...(solo ? { melhorAntes, recorde } : {}),
          };
        },
        acao(quem, corpo) {
          // tudo vem pelo tempo real; a ação HTTP é só para o caso de o socket cair
          if (!jogadores.has(quem)) return 'Você está assistindo esta partida.';
          return corpo.tipo === 'nada' ? null : 'Ação desconhecida.';
        },
        tempoReal(quem, dados) {
          const j = jogadores.get(quem);
          if (!j || !dados || typeof dados !== 'object' || (fase !== 'lutando' && fase !== 'avancando') || j.estado !== 'em-pe') return null;
          const d = dados as Record<string, unknown>;
          if (d.tipo === 'pos') {
            if (gastar(j.baldes.pos)) posicao(j, d);
          } else if (d.tipo === 'tiro') ultimoMotivo = tiro(j, d);
          else if (d.tipo === 'faca') ultimoMotivo = gastar(j.baldes.acao) ? faca(j, d) : 'depressa demais';
          else if (d.tipo === 'arma') ultimoMotivo = gastar(j.baldes.acao) ? pegarArma(j, d) : 'depressa demais';
          else if (d.tipo === 'acerto' || d.tipo === 'granada' || d.tipo === 'soltar') {
            // o acerto tem o balde dele: cada bala é um (o leque, três)
            if (d.tipo === 'acerto') ultimoMotivo = acerto(j, d);
            else if (!gastar(j.baldes.acao)) ultimoMotivo = 'depressa demais';
            else ultimoMotivo = d.tipo === 'granada' ? granada(j, d) : soltar(j, d);
          }
          // nada se repassa direto: o quadro de 20 por segundo leva tudo a todos
          return null;
        },
        conferir() {
          if (fase === 'fim') parar();
        },
        parar,
        // para o teste
        ...({ _passo: tick, _bichos: bichos, _jogadores: jogadores, _balas: balas, _gaiolas: gaiolas, _itens: itens, _motivo: () => ultimoMotivo, _arena: () => arena, _fila: () => fila } as object),
      };
    },
  };
}

