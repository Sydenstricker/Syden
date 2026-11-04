/**
 * A BRIGA NA HORTA (03/11/2026, o piloto): briga de rua de lado, em grupo, no espírito dos fliperamas de quatro jogadores do
 * começo dos anos 90 — SÓ A MECÂNICA (andar pela faixa da frente para o fundo, combo de três socos, pulo, voadora, o especial
 * que custa vida, cair e levantar piscando). Nenhum nome, personagem, fase, inimigo, som ou arte de ninguém: os coelhos
 * defendem a horta de raposas e corvos, e o chefe é um texugo. Tudo desenhado por código no site (web/src/JogoBriga.tsx),
 * menos o coelho, que é o mascote 3D renderizado de lado (e2e/pixel-art/personagem/blender/meshy/briga.py).
 *
 * É O ÚNICO JOGO EM QUE A TURMA DIVIDE OS MESMOS INIMIGOS, e a rede (servidor na Alemanha, turma no Brasil, ~200 ms) decide
 * o formato:
 * - OS INIMIGOS SÃO DO SERVIDOR. Um passo fixo de 20 por segundo (setInterval próprio, desligado no fim e no `parar` do
 *   motor) move as raposas, os corvos e o texugo, e manda o quadro deles a todos pelo `difundir` (tempo real).
 * - CADA COELHO É DE QUEM JOGA. Ele anda no computador da pessoa sem esperar ninguém e manda a posição ~15 vezes por
 *   segundo; o servidor confere a velocidade e os limites e põe essa posição no quadro dos outros (que a desenham ~100 ms
 *   atrás, interpolada, como os inimigos).
 * - QUEM BATE TEM RAZÃO ("favor the attacker"). Quando o golpe da pessoa encosta num inimigo COMO ELE APARECE NA TELA DELA,
 *   o site manda o acerto (o golpe, o inimigo, a posição de quem bateu). O servidor confere: o golpe foi começado de verdade
 *   (cada golpe é anunciado na posição, com número; o combo e o especial têm as regras deles), não é velho demais, o inimigo
 *   está vivo, quem bateu estava perto de onde o servidor o viu por último, e a distância bate com ALGUMA posição do inimigo
 *   no último 0,7 s (a tela de quem bateu mostra o inimigo ~200 ms atrás do servidor). Só aí o dano entra.
 * - QUEM APANHA TAMBÉM TEM UMA FOLGA. O golpe de um inimigo acontece no relógio do servidor, mas só é decidido GRACA_MS
 *   depois: a pessoa leva o golpe só se TODAS as posições que ela mandou nessa janela estavam dentro da área do golpe (e ela
 *   não estava no ar, nem piscando). Quem começou a fugir quando viu a preparação na própria tela escapa. A preparação de
 *   todo golpe inimigo é longa e visível de propósito (0,5 s a 1 s): é ela que paga os 200 ms.
 *
 * O que continua possível pelo console, entre amigos: mentir a própria posição dentro do limite de velocidade (fugir dos
 * golpes indo e voltando rápido), e mandar acertos que a tela não mostrou mas que a distância permite (bater um pouco mais
 * longe que o desenho, dentro da folga de 10 px). Não dá para bater em quem está do outro lado da tela, nem mais rápido que
 * o combo, nem num inimigo caído ou morto, nem fazer o especial sem pagar a vida. A altura também é conferida (revisão de
 * 03/11/2026): o pulo tem teto e tempo de ar, o soco é de quem está no chão, e a voadora é uma por pulo de verdade, com um
 * balde por cima. Ainda possível: emendar pulos de 1 s com uma posição no chão entre eles (no ar ~95% do tempo, contra
 * ~90% de quem aperta o pulo sem parar no site), o que escapa de golpes inimigos como no site; e cada voadora custa um pulo.
 *
 * OS TROFÉUS: com a fase vencida e 2 pessoas ou mais que ficaram até o fim, o pódio (até o 3º, empatados dividem, só quem
 * fez ponto) vai para a estante do quarto (corrida_trofeus, "pista" 'briga', com os pontos). Perder a fase não dá troféu. No
 * Solo, nada.
 */
import * as db from './db.js';
import type { Contexto, Definicao } from './minijogo-motor.js';

// ---------------- AS MEDIDAS (as mesmas do site: web/src/briga/regras.ts; web/test/briga.test.ts confere) ----------------
/** A largura da tela, e de cada arena onde uma onda acontece. */
export const ARENA_L = 320;
/** A faixa do chão, do fundo (0) para a frente. */
export const PROF = 56;
/** Onde começa a arena de cada onda; a última é a do chefe. */
export const ONDAS_X = [0, 360, 720, 1080, 1440];
export const VEL_X = 72;
export const VEL_Y = 44;
export const VIDA = 100;
export const VIDAS = 3;
export const CUSTO_ESPECIAL = 8;

export type Golpe = 'soco1' | 'soco2' | 'soco3' | 'voadora' | 'especial';
/** Cada golpe: quanto dura (ms), o alcance à frente [de, até] (px; o especial pega dos dois lados), a fundura e o dano. */
export const GOLPES: Record<Golpe, { dura: number; alcance: [number, number]; fundo: number; dano: number; derruba: boolean }> = {
  soco1: { dura: 260, alcance: [6, 30], fundo: 9, dano: 4, derruba: false },
  soco2: { dura: 280, alcance: [6, 32], fundo: 9, dano: 5, derruba: false },
  soco3: { dura: 420, alcance: [4, 34], fundo: 10, dano: 9, derruba: true },
  voadora: { dura: 900, alcance: [0, 30], fundo: 11, dano: 9, derruba: true },
  especial: { dura: 520, alcance: [-38, 38], fundo: 14, dano: 10, derruba: true },
};
/** A meia largura do corpo de cada inimigo. */
export const CORPO = { raposa: 10, corvo: 9, texugo: 18 } as const;
export type TipoDeInimigo = keyof typeof CORPO;
export const TIPOS: TipoDeInimigo[] = ['raposa', 'corvo', 'texugo'];

/** Os estados dos inimigos, na ordem do código que vai no quadro (o site tem a mesma lista). */
export const ESTADOS = [
  'entrando', 'andando', 'esperando', 'preparando', 'atacando', 'recuperando', 'dor', 'caido', 'levantando', 'morto',
  'rondando', 'mirando', 'mergulhando', 'subindo', 'prep-investida', 'investida', 'cansado', 'prep-pancada', 'pancada',
] as const;
export type EstadoDoInimigo = (typeof ESTADOS)[number];
/** As ações do coelho (o que a pessoa diz que ele está fazendo, para os outros o desenharem). */
export const ACOES = ['parado', 'andando', 'soco1', 'soco2', 'soco3', 'pulo', 'voadora', 'dor', 'caido', 'levantando', 'especial'] as const;

// ---------------- O RELÓGIO E AS FOLGAS ----------------
export const PASSO_MS = 50;
/** Quanto o servidor espera para decidir um golpe inimigo (ver o topo). */
export const GRACA_MS = 200;
/** O quanto um acerto pode ficar fora da caixa do golpe, contando o desenho e o arredondamento. */
export const FOLGA_ACERTO = 10;
/** Quanto do passado do inimigo vale para um acerto (a tela de quem bate está ~200 ms atrás; folga para o dobro e mais). */
export const HISTORIA_MS = 700;
export const VOLTA_MS = 3000;
/** Quanto a fase pode durar: depois disso, acabou (a turma saiu andando, ou travou). */
export const FASE_MAX_MS = 8 * 60_000;
/** O tempo do "Vencemos!"/"Fim" antes do placar. */
export const FIM_MS = 3500;

/**
 * O PULO, conferido pelo servidor (revisão de 03/11/2026: o `z` não era conferido, e quem mandava `z: 59` para sempre não
 * apanhava nunca e ainda batia em quem estava no chão). O pulo do site sobe a 215 px/s com gravidade de 720: ~32 px de
 * altura e ~0,6 s no ar (apanhar no ar dá um pouco mais). O servidor aceita até Z_MAX, e por no máximo AR_MAX_MS contados
 * da primeira posição no ar que chegou (com folga para a rede); a altura permitida cai a zero entre AR_TETO_MS e AR_MAX_MS
 * (a gravidade). Passou disso, o coelho está no chão para o servidor até mandar uma posição no chão de verdade.
 */
export const Z_MAX = 38;
export const AR_TETO_MS = 550;
export const AR_MAX_MS = 1000;
/** O mínimo de ar de verdade para o pulo contar como pulo (e liberar a próxima voadora): o do site é ~600 ms. */
export const AR_MIN_MS = 350;
/** A altura até onde um golpe de chão (soco, especial) ainda vale. */
export const Z_DO_CHAO = 4;
/** A folga de velocidade: o coelho anda a VEL_X/VEL_Y; aceita-se FOLGA_VEL vezes isso, com um acúmulo pequeno para a rede. */
export const FOLGA_VEL = 1.3;
export const ACUMULO_X = 16;
export const ACUMULO_Y = 10;

export const PONTOS_NOCAUTE: Record<TipoDeInimigo, number> = { raposa: 50, corvo: 40, texugo: 300 };

interface Onda {
  raposas: number;
  corvos: number;
  chefe?: boolean;
}
export const ONDAS: Onda[] = [
  { raposas: 3, corvos: 0 },
  { raposas: 3, corvos: 1 },
  { raposas: 3, corvos: 2 },
  { raposas: 4, corvos: 2 },
  { raposas: 0, corvos: 0, chefe: true },
];

interface Ponto {
  t: number;
  x: number;
  y: number;
  z: number;
}

interface Inimigo {
  id: number;
  tipo: TipoDeInimigo;
  x: number;
  y: number;
  z: number;
  lado: 1 | -1;
  vx: number;
  hp: number;
  hpMax: number;
  estado: EstadoDoInimigo;
  desde: number;
  ate: number;
  alvo: number | null;
  /** A faixa do mergulho do corvo e da investida do texugo. */
  faixa: number;
  /** Cada golpe que já o acertou (userId:id do golpe): um golpe acerta cada inimigo uma vez. */
  acertos: Set<string>;
  historia: Ponto[];
  /** O número do ataque do inimigo (cada mergulho, cada investida): quem já levou não leva de novo no mesmo. */
  ataque: number;
  proximoAtaque: number;
}

interface Ataque {
  id: number;
  golpe: Golpe;
  em: number;
  acertos: number;
}

interface Jogador {
  userId: number;
  avatar: number | null;
  x: number;
  y: number;
  z: number;
  lado: 1 | -1;
  acao: number;
  tAcao: number;
  hp: number;
  vidas: number;
  pontos: number;
  golpes: number;
  nocautes: number;
  estado: 'em-pe' | 'fora' | 'sem-vidas';
  voltaEm: number;
  invulAte: number;
  /** As posições mandadas (hora do servidor): a folga dos golpes inimigos. */
  historia: Ponto[];
  /** Até quando a posição pode andar mais que o normal (o empurrão de um golpe, a volta). */
  livreAte: number;
  ultimaEm: number;
  ataques: Ataque[];
  ultimoAtaque: number;
  ultimoEspecial: number;
  /** Desde a última voadora, ele já pôs o pé no chão? */
  pisou: boolean;
  /** Desde quando ele está no ar (a primeira posição com z > 0), ou null no chão. */
  noArDesde: number | null;
  /** O pulo passou do tempo: até mandar uma posição no chão, o z é 0. */
  precisaPisar: boolean;
  /** O quanto ele ainda pode andar além do normal (px), que se acumula com o tempo até ACUMULO_X/ACUMULO_Y. */
  creditoX: number;
  creditoY: number;
  baldes: { pos: Balde; golpe: Balde; socos: Balde; voadora: Balde };
}

interface Balde {
  fichas: number;
  em: number;
  max: number;
  porSeg: number;
}

/** Um golpe inimigo que aconteceu e espera a folga para ser decidido. */
interface Pancada {
  em: number;
  /** De quem, e o número do ataque (no mergulho e na investida, cada passo cria uma; quem levou não leva de novo). */
  chave: string;
  dentro: (j: { x: number; y: number; z: number }) => boolean;
  dano: number;
  derruba: boolean;
  lado: 1 | -1;
}

export interface OpcoesDaBriga {
  agora?: () => number;
  aleatorio?: () => number;
  /** O relógio do passo (trocável no teste: o teste chama o passo à mão). */
  intervalo?: (passo: () => void, ms: number) => unknown;
  limpar?: (h: unknown) => void;
}

export const briga: Definicao = criarBriga();

export function criarBriga({
  agora = Date.now,
  aleatorio = Math.random,
  intervalo = (passo, ms) => {
    const h = setInterval(passo, ms);
    h.unref?.();
    return h;
  },
  limpar = (h) => clearInterval(h as ReturnType<typeof setInterval>),
}: OpcoesDaBriga = {}): Definicao {
  return {
    minimo: 2,
    // quatro coelhos: o quinto que aceitar assiste (e não conta como quem jogou)
    maximo: 4,
    comecar(ctx: Contexto, { naSala }) {
      const inscritos = [...naSala].slice(0, 4);
      if (inscritos.length === 0) return 'Ninguém para jogar.';
      const solo = ctx.comunidade === 0 || ctx.comunidade === undefined;
      const evento = `briga-${ctx.comunidade ?? 0}-${agora()}`;
      const n = inscritos.length;
      const inicio = agora();
      let fase: 'lutando' | 'avancando' | 'vitoria' | 'derrota' | 'fim' = 'lutando';
      let onda = 0;
      let arena: [number, number] = [ONDAS_X[0], ONDAS_X[0] + ARENA_L];
      let fila: TipoDeInimigo[] = [];
      let proximaEntrada = 0;
      let passo = 0;
      let proximoId = 1;
      let proximoEvento = 1;
      let relogio: unknown = null;
      let ficaram = new Set(inscritos);
      const inimigos = new Map<number, Inimigo>();
      const pancadas: Pancada[] = [];
      /** Quem já levou cada ataque inimigo (chave do ataque → pessoas). */
      const levaram = new Map<string, Set<number>>();
      let eventos: unknown[][] = [];
      /** Por que o último acerto não valeu (para o teste). */
      let ultimoMotivo: string | null = null;
      let venceuAFase = false;

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
            avatar: db.findUserById(userId)?.avatarPronto ?? null,
            x: 40 + k * 14,
            y: 14 + k * 11,
            z: 0,
            lado: 1,
            acao: 0,
            tAcao: 0,
            hp: VIDA,
            vidas: VIDAS,
            pontos: 0,
            golpes: 0,
            nocautes: 0,
            estado: 'em-pe',
            voltaEm: 0,
            invulAte: agora() + 1500,
            historia: [],
            livreAte: agora() + 1000,
            ultimaEm: agora(),
            ataques: [],
            ultimoAtaque: 0,
            ultimoEspecial: -Infinity,
            pisou: true,
            noArDesde: null,
            precisaPisar: false,
            creditoX: ACUMULO_X,
            creditoY: ACUMULO_Y,
            // a posição vem ~15 por segundo, e o acerto, no máximo alguns por golpe; a voadora, uma por pulo de ~0,6 s
            baldes: { pos: balde(10, 24), golpe: balde(10, 14), socos: balde(3, 4.5), voadora: balde(2, 1.7) },
          },
        ]),
      );

      const evento_ = (...e: unknown[]) => eventos.push([proximoEvento++, ...e]);
      const presentes = () => new Set(ctx.naSala());
      /** Quem está na sala, lido UMA vez por passo (o naSala percorre a voz do servidor inteiro). */
      let naSalaAgora = presentes();
      /** Quem estava na sala no passo anterior: quem volta é posto na arena de agora (ver o passo). */
      let naSalaAntes = naSalaAgora;
      const emPe = () => [...jogadores.values()].filter((j) => j.estado === 'em-pe' && naSalaAgora.has(j.userId));

      // ---------------- AS ONDAS ----------------
      /** O x do coelho dentro da arena, como o site o prende (passoDoCoelho: a arena menos 8 de cada lado). */
      const prenderNaArena = (j: Jogador) => {
        j.x = Math.max(arena[0] + 8, Math.min(arena[1] - 8, j.x));
      };
      const comecarOnda = (k: number) => {
        onda = k;
        fase = 'lutando';
        arena = [ONDAS_X[k], ONDAS_X[k] + ARENA_L];
        const o = ONDAS[k];
        const extras = n - 1;
        fila = [];
        if (o.chefe) fila.push('texugo');
        for (let i = 0; i < o.raposas + extras; i++) fila.push('raposa');
        for (let i = 0; i < o.corvos + (o.corvos && extras > 1 ? 1 : 0); i++) fila.splice(1 + i * 2, 0, 'corvo');
        if (o.chefe && extras > 0) for (let i = 0; i < extras; i++) fila.push('raposa');
        proximaEntrada = agora() + 600;
        // a turma desta onda: quem estava na sala quando ela começou
        const p = presentes();
        ficaram = new Set([...ficaram].filter((id) => p.has(id)));
        // TODO MUNDO PARA DENTRO DA ARENA NOVA (revisão independente, 03/11/2026): o site prende o coelho nela na hora, mas o
        // servidor o levava andando pelo crédito de velocidade, e por alguns segundos todo acerto dava "longe de si" e os
        // inimigos corriam atrás de um lugar onde ele já não estava. Aqui ele vai para o mesmo lugar em que a tela o põe.
        for (const j of jogadores.values()) prenderNaArena(j);
        ctx.avisar();
      };

      const naTela = () => [...inimigos.values()].filter((i) => i.estado !== 'morto').length;
      const maxNaTela = () => (ONDAS[onda].chefe ? 1 + n : 2 + n);

      const entrar = (tipo: TipoDeInimigo) => {
        const doLado: 1 | -1 = aleatorio() < 0.5 ? -1 : 1;
        const x = doLado === 1 ? arena[1] + 24 : arena[0] - 24;
        const hpMax = tipo === 'raposa' ? 30 : tipo === 'corvo' ? 18 : 220 + 90 * (n - 1);
        const t = agora();
        const ini: Inimigo = {
          id: proximoId++,
          tipo,
          x,
          y: tipo === 'corvo' ? 10 + aleatorio() * (PROF - 20) : 8 + aleatorio() * (PROF - 16),
          z: tipo === 'corvo' ? 34 : 0,
          lado: doLado === 1 ? -1 : 1,
          vx: 0,
          hp: hpMax,
          hpMax,
          estado: tipo === 'corvo' ? 'rondando' : 'entrando',
          desde: t,
          ate: t + (tipo === 'corvo' ? 1200 + aleatorio() * 800 : 900),
          alvo: null,
          faixa: 0,
          acertos: new Set(),
          historia: [],
          ataque: 0,
          proximoAtaque: t + 800 + aleatorio() * 800,
        };
        inimigos.set(ini.id, ini);
      };

      // ---------------- A IA DOS INIMIGOS (cada passo) ----------------
      const mudar = (i: Inimigo, estado: EstadoDoInimigo, ms: number) => {
        i.estado = estado;
        i.desde = agora();
        i.ate = agora() + ms;
      };
      const maisPerto = (i: Inimigo) => {
        let melhor: Jogador | null = null;
        let d = Infinity;
        for (const j of emPe()) {
          const dd = Math.abs(j.x - i.x) + 2 * Math.abs(j.y - i.y);
          if (dd < d) {
            d = dd;
            melhor = j;
          }
        }
        return melhor;
      };
      const ir = (i: Inimigo, x: number, y: number, vx: number, vy: number, dt: number) => {
        const dx = x - i.x;
        const dy = y - i.y;
        i.x += Math.sign(dx) * Math.min(Math.abs(dx), vx * dt);
        i.y += Math.sign(dy) * Math.min(Math.abs(dy), vy * dt);
      };
      const pancada = (i: Inimigo, chave: string, dano: number, derruba: boolean, dentro: Pancada['dentro']) => {
        pancadas.push({ em: agora(), chave, dano, derruba, lado: i.lado, dentro });
      };

      const passoDaRaposa = (i: Inimigo, dt: number, t: number) => {
        const alvo = maisPerto(i);
        switch (i.estado) {
          case 'entrando':
          case 'andando': {
            if (!alvo) return;
            const lado = i.x < alvo.x ? -1 : 1;
            // as raposas se dividem dos dois lados de quem atacam, e não empilham no mesmo lugar
            const outras = [...inimigos.values()].filter((o) => o !== i && o.tipo === 'raposa' && o.alvo === alvo.userId && o.estado !== 'morto');
            const mesmoLado = outras.filter((o) => Math.sign(o.x - alvo.x) === lado).length;
            const ladoFinal = mesmoLado > 0 && outras.length < 2 ? -lado : lado;
            // o lado que cai fora da arena não serve (a raposa ficaria presa na borda, sem chegar nunca)
            const fora = (x: number) => x < arena[0] + 12 || x > arena[1] - 12;
            const destinoX = fora(alvo.x + ladoFinal * 26) ? alvo.x - ladoFinal * 26 : alvo.x + ladoFinal * 26;
            const destinoY = alvo.y;
            i.alvo = alvo.userId;
            ir(i, destinoX, destinoY, i.estado === 'entrando' ? 55 : 46, 30, dt);
            i.lado = alvo.x > i.x ? 1 : -1;
            if (i.estado === 'entrando' && t >= i.ate) mudar(i, 'andando', 0);
            if (Math.abs(i.x - destinoX) < 3 && Math.abs(i.y - destinoY) < 3 && t >= i.proximoAtaque) {
              // a PREPARAÇÃO, longa e visível: é ela que paga a internet
              mudar(i, 'preparando', 520);
            }
            return;
          }
          case 'preparando':
            if (t >= i.ate) {
              mudar(i, 'atacando', 200);
              const x0 = i.x, y0 = i.y, lado = i.lado;
              pancada(i, `${i.id}-${++i.ataque}`, 8, false, (j) => {
                const dx = (j.x - x0) * lado;
                return dx >= 4 && dx <= 32 && Math.abs(j.y - y0) <= 8 && j.z < 10;
              });
            }
            return;
          case 'atacando':
            if (t >= i.ate) mudar(i, 'recuperando', 520);
            return;
          case 'recuperando':
          case 'esperando':
            if (t >= i.ate) {
              i.proximoAtaque = t + 500 + aleatorio() * 1000;
              mudar(i, 'andando', 0);
            }
            return;
        }
      };

      const passoDoCorvo = (i: Inimigo, dt: number, t: number) => {
        switch (i.estado) {
          case 'rondando': {
            // voa alto (só a voadora alcança), perto de uma borda da arena
            const borda = i.x < (arena[0] + arena[1]) / 2 ? arena[0] + 24 : arena[1] - 24;
            ir(i, borda, i.y, 60, 20, dt);
            i.z += (34 - i.z) * Math.min(1, dt * 3);
            i.lado = borda < (arena[0] + arena[1]) / 2 ? 1 : -1;
            const alvo = maisPerto(i);
            if (t >= i.ate && alvo) {
              i.alvo = alvo.userId;
              i.faixa = alvo.y;
              mudar(i, 'mirando', 750);
            }
            return;
          }
          case 'mirando':
            // o aviso: desce até a faixa de quem mira e fica batendo as asas (o site risca a linha do mergulho)
            ir(i, i.x, i.faixa, 0, 60, dt);
            i.z += (16 - i.z) * Math.min(1, dt * 5);
            if (t >= i.ate) {
              i.ataque++;
              i.vx = i.lado * 210;
              mudar(i, 'mergulhando', 2200);
            }
            return;
          case 'mergulhando': {
            const x0 = i.x;
            i.x += i.vx * dt;
            i.z += (6 - i.z) * Math.min(1, dt * 8);
            const x1 = i.x, y = i.y;
            pancada(i, `${i.id}-${i.ataque}`, 7, false, (j) => {
              const de = Math.min(x0, x1) - CORPO.corvo, ate = Math.max(x0, x1) + CORPO.corvo;
              return j.x >= de && j.x <= ate && Math.abs(j.y - y) <= 8 && j.z < 14;
            });
            if (t >= i.ate || (i.vx > 0 && i.x > arena[1] + 10) || (i.vx < 0 && i.x < arena[0] - 10)) {
              i.vx = 0;
              mudar(i, 'subindo', 700);
            }
            return;
          }
          case 'subindo':
            i.z += (34 - i.z) * Math.min(1, dt * 2.5);
            if (t >= i.ate) mudar(i, 'rondando', 1200 + aleatorio() * 1200);
            return;
        }
      };

      const passoDoTexugo = (i: Inimigo, dt: number, t: number) => {
        const alvo = maisPerto(i);
        switch (i.estado) {
          case 'entrando':
          case 'andando': {
            if (!alvo) return;
            i.alvo = alvo.userId;
            i.lado = alvo.x > i.x ? 1 : -1;
            const dx = Math.abs(alvo.x - i.x);
            if (i.estado === 'entrando') {
              ir(i, alvo.x - i.lado * 60, alvo.y, 40, 20, dt);
              if (t >= i.ate) mudar(i, 'andando', 0);
              return;
            }
            if (t >= i.proximoAtaque && dx > 80) {
              i.faixa = alvo.y;
              mudar(i, 'prep-investida', 950);
            } else if (t >= i.proximoAtaque && dx < 56 && Math.abs(alvo.y - i.y) < 14) {
              mudar(i, 'prep-pancada', 1000);
            } else {
              ir(i, alvo.x - i.lado * 40, alvo.y, 30, 22, dt);
            }
            return;
          }
          case 'prep-investida':
            // cava o chão olhando para a faixa (o site risca a linha da investida)
            ir(i, i.x, i.faixa, 0, 40, dt);
            if (t >= i.ate) {
              i.ataque++;
              i.vx = i.lado * 235;
              mudar(i, 'investida', 1300);
            }
            return;
          case 'investida': {
            const x0 = i.x;
            i.x += i.vx * dt;
            const x1 = i.x, y = i.y;
            pancada(i, `${i.id}-${i.ataque}`, 14, true, (j) => {
              const de = Math.min(x0, x1) - CORPO.texugo, ate = Math.max(x0, x1) + CORPO.texugo;
              return j.x >= de && j.x <= ate && Math.abs(j.y - y) <= 11 && j.z < 10;
            });
            if (t >= i.ate || (i.vx > 0 && i.x > arena[1] - 20) || (i.vx < 0 && i.x < arena[0] + 20)) {
              i.vx = 0;
              mudar(i, 'cansado', 1500);
            }
            return;
          }
          case 'prep-pancada':
            if (t >= i.ate) {
              mudar(i, 'pancada', 300);
              const x0 = i.x, y0 = i.y;
              // a pancada no chão: pega em volta, e quem está no ar escapa
              pancada(i, `${i.id}-${++i.ataque}`, 16, true, (j) => Math.abs(j.x - x0) <= 54 && Math.abs(j.y - y0) <= 18 && j.z < 6);
            }
            return;
          case 'pancada':
            if (t >= i.ate) mudar(i, 'recuperando', 900);
            return;
          case 'cansado':
          case 'recuperando':
            if (t >= i.ate) {
              i.proximoAtaque = t + 700 + aleatorio() * 900;
              mudar(i, 'andando', 0);
            }
            return;
        }
      };

      const passoComum = (i: Inimigo, dt: number, t: number) => {
        // o que todos têm: apanhar, cair, levantar, sumir
        switch (i.estado) {
          case 'dor':
            i.x += i.vx * dt;
            i.vx *= 0.8;
            if (t >= i.ate) {
              i.proximoAtaque = Math.max(i.proximoAtaque, t + 400);
              mudar(i, i.tipo === 'corvo' ? 'subindo' : 'andando', i.tipo === 'corvo' ? 700 : 0);
            }
            return true;
          case 'caido':
            i.x += i.vx * dt;
            i.vx *= 0.85;
            i.z = Math.max(0, i.z - 120 * dt);
            if (t >= i.ate) {
              if (i.hp <= 0) mudar(i, 'morto', 900);
              else mudar(i, 'levantando', 450);
            }
            return true;
          case 'levantando':
            if (t >= i.ate) mudar(i, i.tipo === 'corvo' ? 'subindo' : 'andando', i.tipo === 'corvo' ? 900 : 0);
            return true;
          case 'morto':
            if (t >= i.ate) inimigos.delete(i.id);
            return true;
        }
        return false;
      };

      // ---------------- OS GOLPES INIMIGOS, DECIDIDOS COM A FOLGA ----------------
      const decidirPancadas = (t: number) => {
        for (let k = pancadas.length - 1; k >= 0; k--) {
          const p = pancadas[k];
          if (t < p.em + GRACA_MS) continue;
          pancadas.splice(k, 1);
          const ja = levaram.get(p.chave) ?? new Set<number>();
          for (const j of emPe()) {
            if (ja.has(j.userId) || j.invulAte > p.em) continue;
            // as posições que chegaram na janela da folga; sem nenhuma, a última de antes
            let janela = j.historia.filter((h) => h.t > p.em - PASSO_MS && h.t <= p.em + GRACA_MS);
            if (janela.length === 0) {
              const antes = j.historia.filter((h) => h.t <= p.em);
              janela = antes.length ? [antes[antes.length - 1]] : [{ t: p.em, x: j.x, y: j.y, z: j.z }];
            }
            if (!janela.every((h) => p.dentro(h))) continue;
            ja.add(j.userId);
            apanhar(j, p, t);
          }
          levaram.set(p.chave, ja);
        }
        if (levaram.size > 200) for (const k of [...levaram.keys()].slice(0, 100)) levaram.delete(k);
      };

      const apanhar = (j: Jogador, p: Pancada, t: number) => {
        j.hp = Math.max(0, j.hp - p.dano);
        // piscando depois do golpe: dois golpes juntos não somam (a queda inteira, quando derruba)
        j.invulAte = t + (p.derruba ? 2000 : 400);
        j.livreAte = t + 1500;
        evento_('p', j.userId, p.dano, p.derruba ? 1 : 0, p.lado);
        if (j.hp <= 0) nocautear(j, t);
      };

      const nocautear = (j: Jogador, t: number) => {
        j.estado = 'fora';
        j.vidas = Math.max(0, j.vidas - 1);
        j.voltaEm = t + VOLTA_MS;
        if (j.vidas === 0) j.estado = 'sem-vidas';
        evento_('k', j.userId, j.vidas);
        ctx.avisar();
      };

      // ---------------- O PASSO ----------------
      const tick = () => {
        if (fase === 'fim') return;
        const t = agora();
        const dt = PASSO_MS / 1000;
        passo++;
        naSalaAntes = naSalaAgora;
        naSalaAgora = presentes();
        // QUEM VOLTA À SALA (revisão independente, 03/11/2026): a posição dele no servidor é a de quando saiu, talvez numa
        // arena que já ficou para trás; vai para dentro da de agora, com o tempo livre da volta (o site o põe onde o
        // servidor disser, e anda dali)
        for (const j of jogadores.values()) {
          if (naSalaAgora.has(j.userId) && !naSalaAntes.has(j.userId)) {
            prenderNaArena(j);
            j.livreAte = t + 1500;
          }
        }
        if (fase === 'lutando' || fase === 'avancando') {
          // NINGUÉM DA TURMA NA SALA (nem que fique alguém assistindo): a fase acaba, perdida e sem troféu. Sem isso o passo
          // seguia 20 vezes por segundo por até 8 minutos, e a sala ficava presa em "já tem uma partida acontecendo".
          if (![...jogadores.keys()].some((id) => naSalaAgora.has(id))) return acabar(false, true);
          for (const j of jogadores.values()) {
            // o pulo que passou do tempo acaba, mesmo calado
            if (j.noArDesde !== null && t - j.noArDesde > AR_MAX_MS) pousar(j, t, true);
          }
          // os inimigos entram aos poucos
          if (fase === 'lutando' && fila.length && t >= proximaEntrada && naTela() < maxNaTela()) {
            entrar(fila.shift()!);
            proximaEntrada = t + 700 + aleatorio() * 900;
          }
          for (const i of [...inimigos.values()]) {
            if (!passoComum(i, dt, t)) {
              if (i.tipo === 'raposa') passoDaRaposa(i, dt, t);
              else if (i.tipo === 'corvo') passoDoCorvo(i, dt, t);
              else passoDoTexugo(i, dt, t);
            }
            if (i.tipo !== 'corvo' && i.estado !== 'caido') i.z = 0;
            // quem anda pelo chão, depois de entrar, fica dentro da arena (senão o texugo esperava do lado de fora, onde
            // ninguém o alcança); o corvo passa da borda no mergulho e volta sozinho
            if (i.tipo !== 'corvo' && i.estado !== 'entrando') i.x = Math.max(arena[0] + 12, Math.min(arena[1] - 12, i.x));
            i.y = Math.max(0, Math.min(PROF, i.y));
            i.historia.push({ t, x: i.x, y: i.y, z: i.z });
            while (i.historia.length && i.historia[0].t < t - 1000) i.historia.shift();
          }
          decidirPancadas(t);
          // a volta de quem caiu
          for (const j of jogadores.values()) {
            if (j.estado === 'fora' && t >= j.voltaEm) {
              j.estado = 'em-pe';
              j.hp = VIDA;
              j.x = arena[0] + 30;
              j.y = PROF / 2;
              j.z = 0;
              j.noArDesde = null;
              j.precisaPisar = false;
              j.invulAte = t + 2000;
              j.livreAte = t + 1500;
              j.historia = [];
              evento_('r', j.userId, Math.round(j.x), Math.round(j.y));
              ctx.avisar();
            }
          }
          // a onda acabou: a seta, e a câmera anda quando alguém chega à frente
          if (fase === 'lutando' && fila.length === 0 && inimigos.size === 0) {
            if (onda === ONDAS.length - 1) return acabar(true);
            fase = 'avancando';
            arena = [arena[0], ONDAS_X[onda + 1] + ARENA_L];
            ctx.avisar();
          } else if (fase === 'avancando' && emPe().some((j) => j.x >= ONDAS_X[onda + 1] + 90)) {
            comecarOnda(onda + 1);
          }
          // todo mundo fora, sem vidas: acabou
          const daTurma = [...jogadores.values()].filter((j) => naSalaAgora.has(j.userId));
          if (daTurma.length && daTurma.every((j) => j.estado === 'sem-vidas')) return acabar(false);
          if (t - inicio > FASE_MAX_MS) return acabar(false);
        }
        difundir();
      };

      const difundir = () => {
        ctx.difundir?.({
          tipo: 'q',
          n: passo,
          f: fase,
          o: onda,
          a: arena,
          i: [...inimigos.values()].map((i) => [
            i.id,
            TIPOS.indexOf(i.tipo),
            Math.round(i.x),
            Math.round(i.y),
            Math.round(i.z),
            ESTADOS.indexOf(i.estado),
            i.lado,
            Math.max(0, Math.round((i.hp / i.hpMax) * 100)),
            Math.min(255, Math.round((agora() - i.desde) / PASSO_MS)),
            Math.round(i.faixa),
          ]),
          j: [...jogadores.values()].map((j) => [
            j.userId,
            Math.round(j.x),
            Math.round(j.y),
            Math.round(j.z),
            j.lado,
            j.acao,
            j.tAcao,
            j.hp,
            j.vidas,
            j.pontos,
            j.estado === 'em-pe' ? 0 : j.estado === 'fora' ? 1 : 2,
            j.avatar ?? 0,
            // o último golpe que o servidor aceitou: a página recarregada continua a contar dali (revisão independente,
            // 03/11/2026: ela recomeçava do 1, e nenhum golpe valia até passar da conta de antes)
            j.ultimoAtaque,
          ]),
          e: eventos,
        });
        eventos = [];
      };

      /** `vazia`: a turma inteira saiu (a partida conta como interrompida; o relógio do motor a encerra se a sala esvaziou). */
      const acabar = (venceu: boolean, vazia = false) => {
        if (fase === 'vitoria' || fase === 'derrota' || fase === 'fim') return;
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

      let resultado: { userId: number; username: string; pontos: number; golpes: number; nocautes: number; posicao: number | null }[] | null = null;
      const terminar = (venceu: boolean, completa = true) => {
        parar();
        fase = 'fim';
        const p = presentes();
        const turma = new Set([...ficaram].filter((id) => p.has(id)));
        const linhas = [...jogadores.values()]
          .map((j) => ({ userId: j.userId, username: ctx.nome(j.userId), pontos: j.pontos, golpes: j.golpes, nocautes: j.nocautes }))
          .sort((a, b) => b.pontos - a.pontos || a.username.localeCompare(b.username));
        // A POSIÇÃO vai daqui, só entre a turma (quem estava no começo de toda onda e no fim; empatados dividem), e null para
        // quem saiu, que vem depois (revisão independente, 03/11/2026: a tela dava medalha a todas as linhas, inclusive
        // depois de perder e no Solo, e o troféu não). A medalha, a tela só põe com a fase vencida, fora do Solo e com 2 ou
        // mais que ficaram: a mesma regra do pódio, logo abaixo.
        const daTurma = linhas.filter((l) => turma.has(l.userId));
        resultado = [
          ...daTurma.map((l) => ({ ...l, posicao: 1 + daTurma.filter((o) => o.pontos > l.pontos).length })),
          ...linhas.filter((l) => !turma.has(l.userId)).map((l) => ({ ...l, posicao: null })),
        ];
        // O PÓDIO: fase vencida, 2 pessoas ou mais que ficaram até o fim, até o 3º (empatados dividem), só quem fez ponto
        if (venceu && !solo && turma.size >= 2) {
          for (const l of resultado) {
            const posicao = l.posicao;
            if (posicao === null || posicao > 3 || l.pontos <= 0) continue;
            db.guardarTrofeu({
              userId: l.userId,
              evento,
              communityId: ctx.comunidade ?? 0,
              pista: 'briga',
              posicao,
              tempoMs: null,
              pontos: l.pontos,
              rivais: [...turma].filter((id) => id !== l.userId),
            });
          }
        }
        venceuAFase = venceu;
        ctx.terminar(completa);
      };

      // ---------------- O QUE A PESSOA MANDA (tempo real) ----------------
      const numero = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

      /**
       * O pé no chão. `forcado`: o pulo passou de AR_MAX_MS (o servidor o põe no chão, e ele só pula de novo depois de mandar
       * uma posição no chão). A voadora só se libera depois de um pulo com AR_MIN_MS de ar de verdade.
       */
      const pousar = (j: Jogador, t: number, forcado: boolean) => {
        if (j.noArDesde !== null && t - j.noArDesde >= AR_MIN_MS) j.pisou = true;
        j.noArDesde = null;
        j.z = 0;
        if (forcado) j.precisaPisar = true;
      };

      /** A altura que o servidor aceita: a de um pulo (até Z_MAX, caindo a zero entre AR_TETO_MS e AR_MAX_MS). */
      const alturaDoPulo = (j: Jogador, z: number, t: number): number => {
        if (z <= 0) {
          pousar(j, t, false);
          j.precisaPisar = false;
          return 0;
        }
        if (j.precisaPisar) return 0;
        if (j.noArDesde === null) j.noArDesde = t;
        const ar = t - j.noArDesde;
        if (ar > AR_MAX_MS) {
          pousar(j, t, true);
          return 0;
        }
        const teto = ar <= AR_TETO_MS ? Z_MAX : (Z_MAX * (AR_MAX_MS - ar)) / (AR_MAX_MS - AR_TETO_MS);
        return Math.min(z, teto);
      };

      const registrarAtaque = (j: Jogador, id: unknown, g: unknown, z: number): void => {
        if (!numero(id) || !Number.isInteger(id) || id <= j.ultimoAtaque || id > j.ultimoAtaque + 1000) return;
        if (typeof g !== 'string' || !(g in GOLPES)) return;
        const golpe = g as Golpe;
        const t = agora();
        const ultimos = j.ataques;
        const anterior = ultimos.find((a) => a.id === id - 1);
        const antes = ultimos.find((a) => a.id === id - 2);
        // o soco e o especial são de quem está no chão; a voadora, de quem está num pulo de verdade
        if (golpe !== 'voadora' && (z > Z_DO_CHAO || j.noArDesde !== null)) return;
        if (golpe === 'soco1' || golpe === 'soco2' || golpe === 'soco3') {
          // o combo na ordem e no ritmo: o 2º logo depois do 1º, o 3º fecha os dois
          if (golpe === 'soco2' && (!anterior || anterior.golpe !== 'soco1' || t - anterior.em > 1000)) return;
          if (golpe === 'soco3' && (!anterior || anterior.golpe !== 'soco2' || !antes || antes.golpe !== 'soco1' || t - antes.em > 1800)) return;
          if (!gastar(j.baldes.socos)) return;
        } else if (golpe === 'voadora') {
          // no ar, uma por pulo (e o pulo só conta com AR_MIN_MS de ar: ver `pousar`), e com um balde por cima: alternar
          // z=0/z=5 dava ~12 voadoras por segundo
          if (z <= 0 || j.noArDesde === null || !j.pisou) return;
          if (!gastar(j.baldes.voadora)) return;
          j.pisou = false;
        } else {
          // o especial custa vida (o servidor cobra), e não dá para repetir de seguida
          if (t - j.ultimoEspecial < 900 || j.hp <= CUSTO_ESPECIAL) return;
          j.ultimoEspecial = t;
          j.hp -= CUSTO_ESPECIAL;
          j.invulAte = Math.max(j.invulAte, t + 350);
        }
        j.ultimoAtaque = id;
        ultimos.push({ id, golpe, em: t, acertos: 0 });
        while (ultimos.length > 6) ultimos.shift();
      };

      const posicao = (j: Jogador, d: Record<string, unknown>) => {
        const { x, y, z, lado, acao, ta } = d;
        if (![x, y, z].every(numero)) return;
        const t = agora();
        let nx = Math.max(arena[0] - 8, Math.min(arena[1] + 8, x as number));
        let ny = Math.max(0, Math.min(PROF, y as number));
        const nz = alturaDoPulo(j, z as number, t);
        // não mais rápido que o coelho anda: o que se pode andar se acumula com o tempo (FOLGA_VEL × a velocidade), até um
        // teto pequeno para a rede (duas posições que chegam juntas); o empurrão e a volta dão um tempo livre
        const dt = Math.max(0, (t - j.ultimaEm) / 1000);
        j.creditoX = Math.min(ACUMULO_X, j.creditoX + VEL_X * FOLGA_VEL * dt);
        j.creditoY = Math.min(ACUMULO_Y, j.creditoY + VEL_Y * FOLGA_VEL * dt);
        if (t > j.livreAte) {
          nx = j.x + Math.max(-j.creditoX, Math.min(j.creditoX, nx - j.x));
          ny = j.y + Math.max(-j.creditoY, Math.min(j.creditoY, ny - j.y));
          j.creditoX -= Math.abs(nx - j.x);
          j.creditoY -= Math.abs(ny - j.y);
        }
        j.x = nx;
        j.y = ny;
        j.z = nz;
        j.lado = lado === -1 ? -1 : 1;
        j.acao = numero(acao) && acao >= 0 && acao < ACOES.length ? Math.floor(acao) : 0;
        j.tAcao = numero(ta) ? Math.max(0, Math.min(5000, Math.round(ta))) : 0;
        j.ultimaEm = t;
        j.historia.push({ t, x: nx, y: ny, z: nz });
        while (j.historia.length && j.historia[0].t < t - 1500) j.historia.shift();
        if (d.ataque && typeof d.ataque === 'object') {
          const a = d.ataque as Record<string, unknown>;
          registrarAtaque(j, a.id, a.g, nz);
        }
      };

      /** Um acerto: devolve por que não valeu, ou null (para o teste; o site não recebe resposta). */
      const acerto = (j: Jogador, d: Record<string, unknown>): string | null => {
        const t = agora();
        const ataque = j.ataques.find((a) => a.id === d.a);
        if (!ataque) return 'golpe que não começou';
        const g = GOLPES[ataque.golpe];
        if (t - ataque.em > g.dura + 500) return 'golpe velho';
        if (ataque.acertos >= 6) return 'acertos demais';
        const i = inimigos.get(d.inimigo as number);
        if (!i || i.hp <= 0 || i.estado === 'morto' || i.estado === 'caido' || i.estado === 'levantando') return 'inimigo fora';
        // o corvo voando alto só a voadora alcança
        if (i.tipo === 'corvo' && i.z > 18 && ataque.golpe !== 'voadora') return 'alto demais';
        const chave = `${j.userId}:${ataque.id}`;
        if (i.acertos.has(chave)) return 'já acertou';
        const { x, y, z } = d;
        if (![x, y, z].every(numero)) return 'números';
        // quem bateu estava perto de onde o servidor o viu
        if (Math.abs((x as number) - j.x) > 30 || Math.abs((y as number) - j.y) > 16 || Math.abs((z as number) - j.z) > 20) return 'longe de si';
        // A ALTURA: o golpe de chão é de quem está no chão (e o servidor o viu no chão); a voadora pega o que está na altura
        // dela (a mesma conta do site, `encosta`, com folga), e no chão só enquanto o pulo dura
        const zz = Math.max(0, Math.min(Z_MAX, z as number));
        if (ataque.golpe !== 'voadora' && (zz > Z_DO_CHAO || j.z > Z_DO_CHAO)) return 'alto demais';
        const lado = j.lado;
        const [a0, a1] = g.alcance;
        const perto = i.historia.some((h) => {
          if (h.t < t - HISTORIA_MS) return false;
          if (ataque.golpe === 'voadora' ? Math.abs(h.z - zz) >= 26 + 6 : h.z >= 24) return false;
          const dx = (h.x - (x as number)) * (ataque.golpe === 'especial' ? 1 : lado);
          const w = CORPO[i.tipo];
          return dx + w >= a0 - FOLGA_ACERTO && dx - w <= a1 + FOLGA_ACERTO && Math.abs(h.y - (y as number)) <= g.fundo + 4;
        });
        if (!perto) return 'longe do inimigo';
        // valeu
        i.acertos.add(chave);
        if (i.acertos.size > 60) i.acertos = new Set([...i.acertos].slice(-30));
        ataque.acertos++;
        const dano = i.tipo === 'texugo' && i.estado === 'cansado' ? Math.round(g.dano * 1.5) : g.dano;
        i.hp = Math.max(0, i.hp - dano);
        j.pontos += dano;
        j.golpes++;
        const empurra: 1 | -1 = ataque.golpe === 'especial' ? (i.x >= j.x ? 1 : -1) : lado;
        evento_('h', i.id, j.userId, ataque.golpe, Math.round(i.x), Math.round(i.y), Math.round(i.z));
        if (i.hp <= 0) {
          j.pontos += PONTOS_NOCAUTE[i.tipo];
          j.nocautes++;
          i.vx = empurra * 110;
          mudar(i, 'caido', 1000);
          evento_('x', i.id, j.userId);
        } else if (i.tipo === 'texugo') {
          // o chefe aguenta firme: não cai nem para de atacar (ele pisca no site)
        } else if (g.derruba || i.tipo === 'corvo') {
          i.vx = empurra * 120;
          mudar(i, 'caido', 1000);
        } else {
          i.vx = empurra * 50;
          mudar(i, 'dor', 380);
        }
        return null;
      };

      comecarOnda(0);
      relogio = intervalo(tick, PASSO_MS);

      return {
        publico() {
          return {
            fase,
            onda: onda + 1,
            ondas: ONDAS.length,
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
          };
        },
        acao(quem, corpo) {
          // tudo da briga vem pelo tempo real; a ação HTTP é só para o caso de o socket cair (nada a fazer)
          if (!jogadores.has(quem)) return 'Você está assistindo esta partida.';
          return corpo.tipo === 'nada' ? null : 'Ação desconhecida.';
        },
        tempoReal(quem, dados) {
          const j = jogadores.get(quem);
          if (!j || !dados || typeof dados !== 'object' || (fase !== 'lutando' && fase !== 'avancando')) return null;
          const d = dados as Record<string, unknown>;
          if (j.estado !== 'em-pe') return null;
          if (d.tipo === 'pos') {
            if (gastar(j.baldes.pos)) posicao(j, d);
          } else if (d.tipo === 'golpe') {
            if (gastar(j.baldes.golpe)) ultimoMotivo = acerto(j, d);
          }
          // nada se repassa direto: o quadro de 20 por segundo leva tudo a todos
          return null;
        },
        conferir() {
          if (fase === 'fim') parar();
        },
        parar,
        // para o teste
        ...({ _passo: tick, _inimigos: inimigos, _jogadores: jogadores, _motivo: () => ultimoMotivo, _arena: () => arena } as object),
      };
    },
  };
}
