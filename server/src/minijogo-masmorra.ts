/**
 * A MASMORRA DA TOCA (16/11/2026, o piloto): aventura de masmorra vista de cima, em grupo — SÓ A MECÂNICA do gênero (salas que
 * trancam até os bichos caírem, a chave que abre a porta grande, o baú com o item, o bloco que se empurra, os botões no chão e o
 * chefe no fim). Nenhum nome, personagem, item, música ou mapa de ninguém: os coelhos atravessam a toca de um rei-cogumelo
 * com uma pá de jardim, e o item do baú é uma cenoura que vai e volta. O mapa e o andar moram em masmorra-regras.ts (a mesma
 * cópia do site, web/src/masmorra/regras.ts).
 *
 * A REDE É A DA BRIGA NA HORTA (minijogo-briga.ts, o topo explica o porquê):
 * - O MUNDO É DO SERVIDOR: os bichos (um passo de 20 por segundo), as portas, os botões, o bloco, o baú, a chave, a ponte e os
 *   corações no chão. O quadro vai a todos pelo `difundir`.
 * - CADA COELHO É DE QUEM JOGA: anda no computador da pessoa e manda a posição ~15 vezes por segundo; o servidor confere a
 *   velocidade e as paredes (a mesma conta de casas do site) e a põe no quadro dos outros.
 * - QUEM BATE TEM RAZÃO: o golpe da pá (e a cenoura) que encosta num bicho COMO ELE APARECE NA TELA de quem bateu vale, se o
 *   golpe foi anunciado, não é velho, quem bateu estava perto de onde o servidor o viu, e o bicho esteve perto daquele ponto em
 *   ALGUM momento do último 0,7 s.
 * - QUEM APANHA TEM FOLGA: o golpe do bicho só é decidido GRACA_MS depois, e só pega quem ficou dentro dele a janela inteira.
 *   As preparações são longas e visíveis de propósito.
 *
 * A turma está sempre na MESMA sala: quem passa por uma porta aberta leva todos (e quem estava fora volta do outro lado). Quem
 * fica sem corações sai por VOLTA_MS e volta na porta por onde a turma entrou, com os corações cheios; não há fim de jogo por
 * isso (cada queda tira pontos). Os botões do chão pedem DOIS ao mesmo tempo: com a turma, duas pessoas; sozinho, o bloco segura
 * um. Bloco empurrado para um canto volta ao lugar quando a turma sai e volta à sala.
 *
 * O que continua possível pelo console, entre amigos: mentir a posição dentro da velocidade e das paredes, e acertar um pouco
 * mais longe que o desenho (a folha de FOLGA_ACERTO). Não dá para atravessar parede, bater do outro lado da sala, abrir porta
 * de longe nem acertar o cristal sem a cenoura.
 *
 * OS TROFÉUS: com o rei-cogumelo vencido e 2 pessoas ou mais que ficaram até o fim, o pódio (até o 3º, empatados dividem, só quem
 * fez ponto) vai para a estante do quarto (corrida_trofeus, "pista" 'masmorra', com os pontos). Fora das conquistas da turma até
 * ele decidir. No Solo, nada.
 */
import * as db from './db.js';
import type { Contexto, Definicao } from './minijogo-motor.js';
import {
  ACOES,
  BICHOS,
  CENOURA,
  centro,
  CHEGADA,
  AO_LADO,
  CORACOES,
  casasDe,
  DIRS,
  ESTADOS,
  LADOS,
  livre,
  mover,
  OPOSTO,
  PA,
  PORTA,
  RAIO,
  SALA_DO_CHEFE,
  SALAS,
  solida,
  TILE,
  TIPOS,
  VEL,
  ARRANCADA_MS,
  ARRANCADA_VEL,
  ARRANCADA_RECARGA_MS,
  type EstadoDoBicho,
  type Fase,
  type Lado,
  type Mundo,
  type Sala,
  type TipoDoBicho,
} from './masmorra-regras.js';

export const PASSO_MS = 50;
export const GRACA_MS = 200;
export const HISTORIA_MS = 700;
export const FOLGA_ACERTO = 12;
export const VOLTA_MS = 3000;
export const MAX_MS = 20 * 60_000;
export const FIM_MS = 3500;
/** A folga de velocidade (FOLGA_VEL × VEL), com um acúmulo pequeno para a rede. */
export const FOLGA_VEL = 1.3;
export const ACUMULO = 18;
export const ARRANCADA_EXTRA = Math.ceil(((ARRANCADA_VEL - VEL) * ARRANCADA_MS) / 1000) + 8;
/** Os pontos: cada acerto, o baú, o cristal, os botões; cair tira. */
export const PONTOS = { acerto: 5, bau: 30, cristal: 30, placas: 20, queda: -10 };
/** A chance de um bicho deixar um coração ao sumir. */
export const CHANCE_DE_CORACAO = 0.3;

interface Ponto {
  t: number;
  x: number;
  y: number;
}

interface Bicho {
  id: number;
  tipo: TipoDoBicho;
  x: number;
  y: number;
  z: number;
  lado: 1 | -1;
  hp: number;
  hpMax: number;
  estado: EstadoDoBicho;
  desde: number;
  ate: number;
  /** A direção do golpe (a mordida, a investida, o tiro), presa na preparação. */
  dx: number;
  dy: number;
  /** O pulo do sapo: de onde, e onde cai. */
  x0: number;
  y0: number;
  alvoX: number;
  alvoY: number;
  vx: number;
  vy: number;
  proximo: number;
  ataque: number;
  acertos: Set<string>;
  historia: Ponto[];
  invocou: boolean;
}

interface Tiro {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  ate: number;
}

interface Ataque {
  id: number;
  g: 'pa' | 'cenoura';
  em: number;
  dir: number;
  acertos: number;
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
  dir: number;
  acao: number;
  tAcao: number;
  hp: number;
  pontos: number;
  acertos: number;
  nocautes: number;
  quedas: number;
  estado: 'em-pe' | 'fora';
  voltaEm: number;
  invulAte: number;
  historia: Ponto[];
  livreAte: number;
  ultimaEm: number;
  credito: number;
  extra: number;
  extraAte: number;
  ultimaArrancada: number;
  ataques: Ataque[];
  ultimoAtaque: number;
  ultimaCenoura: number;
  ultimoEmpurrao: number;
  tp: number;
  baldes: { pos: Balde; acao: Balde; pa: Balde };
}

interface Pancada {
  em: number;
  chave: string;
  dentro: (x: number, y: number) => boolean;
  dano: number;
  deX: number;
  deY: number;
  /** Ao acertar alguém, o tiro some. */
  tiro?: number;
}

export interface OpcoesDaMasmorra {
  agora?: () => number;
  aleatorio?: () => number;
  intervalo?: (passo: () => void, ms: number) => unknown;
  limpar?: (h: unknown) => void;
}

export const masmorra: Definicao = criarMasmorra();

export function criarMasmorra({
  agora = Date.now,
  aleatorio = Math.random,
  intervalo = (passo, ms) => {
    const h = setInterval(passo, ms);
    h.unref?.();
    return h;
  },
  limpar = (h) => clearInterval(h as ReturnType<typeof setInterval>),
}: OpcoesDaMasmorra = {}): Definicao {
  return {
    minimo: 2,
    maximo: 4,
    comecar(ctx: Contexto, { naSala }) {
      const inscritos = [...naSala].slice(0, 4);
      if (inscritos.length === 0) return 'Ninguém para jogar.';
      const solo = ctx.comunidade === 0 || ctx.comunidade === undefined;
      const evento = `masmorra-${ctx.comunidade ?? 0}-${agora()}`;
      const inicio = agora();
      const n = inscritos.length;
      let fase: Fase = 'jogando';
      let sala: Sala = SALAS[0];
      /** Por onde a turma entrou na sala de agora (null na entrada: o começo). */
      let entrada: Lado | null = null;
      let passo = 0;
      let proximoId = 1;
      let proximoEvento = 1;
      let relogio: unknown = null;
      let eventos: unknown[][] = [];
      let ultimoMotivo: string | null = null;
      let venceu = false;
      const ficaram = new Set(inscritos);
      const bichos = new Map<number, Bicho>();
      const tiros: Tiro[] = [];
      const pancadas: Pancada[] = [];
      const levaram = new Map<string, Set<number>>();
      const coracoes: { id: number; x: number; y: number }[] = [];
      // o mundo que fica: o que cada sala já resolveu
      const limpas = new Set<number>();
      const bausAbertos = new Set<number>();
      const resolvidas = new Set<number>();
      const destrancadas = new Set<string>();
      const visitadas = new Set<number>([0]);
      let ponte = false;
      let temCenoura = false;
      let chaves = 0;
      let blocos: { id: number; c: number; l: number }[] = [];
      let placasApertadas: number[] = [];
      /** Os blocos de cada sala resolvida ficam onde pararam. */
      const blocosGuardados = new Map<number, { id: number; c: number; l: number }[]>();

      const balde = (max: number, porSeg: number): Balde => ({ fichas: max, em: agora(), max, porSeg });
      const gastar = (b: Balde) => {
        const t = agora();
        b.fichas = Math.min(b.max, b.fichas + ((t - b.em) / 1000) * b.porSeg);
        b.em = t;
        if (b.fichas < 1) return false;
        b.fichas -= 1;
        return true;
      };
      const evento_ = (...e: unknown[]) => eventos.push([proximoEvento++, ...e]);

      const jogadores = new Map<number, Jogador>(
        inscritos.map((userId, k) => {
          const [x, y] = CHEGADA.s;
          return [
            userId,
            {
              userId,
              avatar: db.avatarDoJogo(userId),
              x: x + AO_LADO[k],
              y,
              dir: 1,
              acao: 0,
              tAcao: 0,
              hp: CORACOES,
              pontos: 0,
              acertos: 0,
              nocautes: 0,
              quedas: 0,
              estado: 'em-pe',
              voltaEm: 0,
              invulAte: agora() + 1500,
              historia: [],
              livreAte: 0,
              ultimaEm: agora(),
              credito: ACUMULO,
              extra: 0,
              extraAte: 0,
              ultimaArrancada: -1e9,
              ataques: [],
              ultimoAtaque: 0,
              ultimaCenoura: -1e9,
              ultimoEmpurrao: -1e9,
              tp: 1,
              baldes: { pos: balde(30, 24), acao: balde(20, 10), pa: balde(3, 4) },
            },
          ];
        }),
      );

      // ---------------- O MUNDO DA SALA ----------------
      const bauNaSala = () => !!sala.bau && (sala.bau.aparece !== 'limpa' || limpas.has(sala.id));
      const portaAberta = (lado: Lado): boolean => {
        const p = sala.portas[lado];
        if (!p) return false;
        if (sala.bichos.length && !limpas.has(sala.id)) return false;
        if (p.trava === 'placas') return resolvidas.has(sala.id);
        if (p.trava === 'chave') return destrancadas.has(`${sala.id}:${lado}`);
        return true;
      };
      const mundo = (): Mundo => ({
        blocos: blocos.map((b) => [b.c, b.l] as [number, number]),
        bau: bauNaSala(),
        ponte,
        abertas: LADOS.filter(portaAberta),
      });
      const emPe = () => [...jogadores.values()].filter((j) => j.estado === 'em-pe');

      const novoBicho = (tipo: TipoDoBicho, x: number, y: number): Bicho => {
        const def = BICHOS[tipo];
        const hpMax = tipo === 'rei-cogumelo' ? Math.round(def.hp * (1 + 0.5 * (n - 1))) : def.hp;
        const t = agora();
        const b: Bicho = {
          id: proximoId++,
          tipo,
          x,
          y,
          z: 0,
          lado: -1,
          hp: hpMax,
          hpMax,
          estado: 'entrando',
          desde: t,
          ate: t + (tipo === 'rei-cogumelo' ? 1200 : 700),
          dx: 0,
          dy: 1,
          x0: x,
          y0: y,
          alvoX: x,
          alvoY: y,
          vx: 0,
          vy: 0,
          proximo: t + 900 + aleatorio() * 900,
          ataque: 0,
          acertos: new Set(),
          historia: [],
          invocou: false,
        };
        bichos.set(b.id, b);
        return b;
      };

      const entrarNa = (destino: number, chegada: Lado | null) => {
        const t = agora();
        blocosGuardados.set(sala.id, blocos);
        sala = SALAS[destino];
        entrada = chegada;
        visitadas.add(destino);
        bichos.clear();
        tiros.length = 0;
        pancadas.length = 0;
        coracoes.length = 0;
        if (!limpas.has(destino)) for (const b of sala.bichos) novoBicho(b.tipo, ...centro(b.c, b.l));
        // o bloco volta ao lugar se o enigma não foi resolvido (o empurrado para o canto não prende ninguém)
        blocos = resolvidas.has(destino) ? (blocosGuardados.get(destino) ?? []) : casasDe(sala, 'B').map(([c, l]) => ({ id: proximoId++, c, l }));
        placasApertadas = casasDe(sala, 'P').map(() => 0);
        let k = 0;
        for (const j of jogadores.values()) colocar(j, k++, t);
        evento_('s', destino);
      };

      /** Põe o coelho na porta de entrada da sala (ou no começo), com o teleporte contado para o site. */
      const colocar = (j: Jogador, k: number, t: number) => {
        const [x, y] = CHEGADA[entrada ?? 's'];
        const vertical = entrada === null || entrada === 'n' || entrada === 's';
        j.x = x + (vertical ? AO_LADO[k % 4] : 0);
        j.y = y + (vertical ? 0 : AO_LADO[k % 4]);
        j.historia = [];
        j.livreAte = t + 600;
        j.invulAte = Math.max(j.invulAte, t + 1200);
        j.tp++;
      };

      // ---------------- OS BICHOS ----------------
      const mudar = (b: Bicho, estado: EstadoDoBicho, ms: number) => {
        b.estado = estado;
        b.desde = agora();
        b.ate = agora() + ms;
      };
      const maisPerto = (b: Bicho): Jogador | null => {
        let melhor: Jogador | null = null;
        let d = Infinity;
        for (const j of emPe()) {
          const dd = Math.hypot(j.x - b.x, j.y - b.y);
          if (dd < d) {
            d = dd;
            melhor = j;
          }
        }
        return melhor;
      };
      const mira = (b: Bicho, j: Jogador) => {
        const d = Math.hypot(j.x - b.x, j.y - b.y) || 1;
        b.dx = (j.x - b.x) / d;
        b.dy = (j.y - b.y) / d;
        if (Math.abs(b.dx) > 0.2) b.lado = b.dx < 0 ? -1 : 1;
      };
      const andar = (b: Bicho, dx: number, dy: number) => {
        const r = BICHOS[b.tipo].raio;
        const [nx, ny] = mover(sala, mundo(), b.x, b.y, dx, dy, Math.min(r, 16), 'bicho');
        const bateu = Math.abs(nx - b.x - dx) > 0.01 || Math.abs(ny - b.y - dy) > 0.01;
        b.x = nx;
        b.y = ny;
        return bateu;
      };
      const pancada = (b: Bicho, px: number, py: number, raio: number, dano: number, chave = `${b.id}:${b.ataque}`) =>
        pancadas.push({ em: agora(), chave, dentro: (x, y) => Math.hypot(x - px, y - py) <= raio + RAIO, dano, deX: b.x, deY: b.y });
      const atirar = (x: number, y: number, dx: number, dy: number, vel: number) =>
        tiros.push({ id: proximoId++, x, y, vx: dx * vel, vy: dy * vel, ate: agora() + 4000 });

      const passoDoBicho = (b: Bicho, t: number, dt: number) => {
        const vel = BICHOS[b.tipo].vel;
        if (b.estado === 'morto') {
          if (t >= b.ate) {
            bichos.delete(b.id);
            if (b.tipo !== 'rei-cogumelo' && aleatorio() < CHANCE_DE_CORACAO) coracoes.push({ id: proximoId++, x: b.x, y: b.y });
          }
          return;
        }
        if (b.estado === 'dor') {
          andar(b, b.vx * dt, b.vy * dt);
          b.vx *= 0.8;
          b.vy *= 0.8;
          if (t >= b.ate) mudar(b, 'parado', 0);
          return;
        }
        if (b.estado === 'entrando' || b.estado === 'atordoado' || b.estado === 'recuperando' || b.estado === 'cansado') {
          if (t >= b.ate) mudar(b, b.tipo === 'rei-cogumelo' ? 'andando' : 'parado', b.tipo === 'rei-cogumelo' ? 1800 : 0);
          return;
        }
        const alvo = maisPerto(b);
        switch (b.tipo) {
          case 'cogumelo': {
            if (b.estado === 'preparando') {
              if (t >= b.ate) {
                b.ataque++;
                pancada(b, b.x + b.dx * 26, b.y + b.dy * 26, 22, 1);
                mudar(b, 'atacando', 220);
              }
              return;
            }
            if (b.estado === 'atacando') {
              if (t >= b.ate) mudar(b, 'recuperando', 650);
              return;
            }
            if (!alvo) return void (b.estado !== 'parado' && mudar(b, 'parado', 0));
            const d = Math.hypot(alvo.x - b.x, alvo.y - b.y);
            mira(b, alvo);
            if (d < 46 && t >= b.proximo) {
              mudar(b, 'preparando', 550);
              b.proximo = t + 1200;
              return;
            }
            if (d > 30) {
              if (b.estado !== 'andando') mudar(b, 'andando', 0);
              andar(b, b.dx * vel * dt, b.dy * vel * dt);
            }
            return;
          }
          case 'cacto': {
            if (b.estado === 'mirando') {
              if (t >= b.ate) {
                atirar(b.x + b.dx * 18, b.y + b.dy * 18, b.dx, b.dy, 170);
                mudar(b, 'atacando', 250);
              }
              return;
            }
            if (b.estado === 'atacando') {
              if (t >= b.ate) mudar(b, 'recuperando', 400);
              return;
            }
            if (alvo && t >= b.proximo && Math.hypot(alvo.x - b.x, alvo.y - b.y) < 460) {
              mira(b, alvo);
              mudar(b, 'mirando', 700);
              b.proximo = t + 2200 + aleatorio() * 900;
            }
            return;
          }
          case 'sapo': {
            if (b.estado === 'mirando') {
              if (t >= b.ate) {
                b.x0 = b.x;
                b.y0 = b.y;
                mudar(b, 'saltando', 600);
              }
              return;
            }
            if (b.estado === 'saltando') {
              const k = Math.min(1, (t - b.desde) / 600);
              b.x = b.x0 + (b.alvoX - b.x0) * k;
              b.y = b.y0 + (b.alvoY - b.y0) * k;
              b.z = Math.sin(k * Math.PI) * 30;
              if (k >= 1) {
                b.z = 0;
                b.ataque++;
                pancada(b, b.x, b.y, 24, 1);
                mudar(b, 'recuperando', 500);
                b.proximo = t + 900 + aleatorio() * 800;
              }
              return;
            }
            if (alvo && t >= b.proximo && Math.hypot(alvo.x - b.x, alvo.y - b.y) < 320) {
              // cai onde a pessoa está (ou o mais perto disso que for chão)
              mira(b, alvo);
              const m = mundo();
              let ax = alvo.x;
              let ay = alvo.y;
              for (let k = 0; k < 10 && !livre(sala, m, ax, ay, 14, 'bicho'); k++) {
                ax = b.x + (ax - b.x) * 0.8;
                ay = b.y + (ay - b.y) * 0.8;
              }
              b.alvoX = ax;
              b.alvoY = ay;
              mudar(b, 'mirando', 550);
            }
            return;
          }
          case 'rei-cogumelo': {
            if (b.estado === 'prep-investida') {
              if (t >= b.ate) {
                b.ataque++;
                mudar(b, 'investida', 1600);
              }
              return;
            }
            if (b.estado === 'investida') {
              const bateu = andar(b, b.dx * 250 * dt, b.dy * 250 * dt);
              pancada(b, b.x, b.y, 30, 2);
              if (bateu) mudar(b, 'cansado', 1700);
              else if (t >= b.ate) mudar(b, 'recuperando', 600);
              return;
            }
            if (b.estado === 'prep-sopro') {
              if (t >= b.ate) {
                for (let k = 0; k < 8; k++) atirar(b.x, b.y, Math.cos((k * Math.PI) / 4), Math.sin((k * Math.PI) / 4), 140);
                mudar(b, 'sopro', 300);
              }
              return;
            }
            if (b.estado === 'sopro') {
              if (t >= b.ate) mudar(b, 'recuperando', 700);
              return;
            }
            if (!alvo) return;
            mira(b, alvo);
            if (b.estado !== 'andando') mudar(b, 'andando', 1800);
            if (t < b.ate) {
              andar(b, b.dx * vel * dt, b.dy * vel * dt);
              return;
            }
            // na metade da vida, chama dois cogumelos uma vez; depois, investida e sopro em vez
            if (b.hp <= b.hpMax / 2 && !b.invocou) {
              b.invocou = true;
              const m = mundo();
              for (const [ox, oy] of [[-70, 30], [70, 30]]) if (livre(sala, m, b.x + ox, b.y + oy, 14, 'bicho')) novoBicho('cogumelo', b.x + ox, b.y + oy);
              mudar(b, 'prep-sopro', 700);
            } else if (b.ataque % 2 === 0) mudar(b, 'prep-investida', 800);
            else {
              b.ataque++;
              mudar(b, 'prep-sopro', 700);
            }
            return;
          }
        }
      };

      // ---------------- AS PANCADAS (decididas com a folga) ----------------
      const decidir = (t: number) => {
        for (let k = pancadas.length - 1; k >= 0; k--) {
          const p = pancadas[k];
          if (t < p.em + GRACA_MS) continue;
          pancadas.splice(k, 1);
          for (const j of emPe()) {
            if (p.em < j.invulAte) continue;
            const ja = levaram.get(p.chave);
            if (ja?.has(j.userId)) continue;
            const janela = j.historia.filter((h) => h.t >= p.em && h.t <= p.em + GRACA_MS);
            const pontos = janela.length ? janela : [{ x: j.x, y: j.y }];
            if (!pontos.every((h) => p.dentro(h.x, h.y))) continue;
            if (ja) ja.add(j.userId);
            else levaram.set(p.chave, new Set([j.userId]));
            if (levaram.size > 200) levaram.delete(levaram.keys().next().value as string);
            if (p.tiro !== undefined) {
              const i = tiros.findIndex((tr) => tr.id === p.tiro);
              if (i >= 0) tiros.splice(i, 1);
            }
            j.hp = Math.max(0, j.hp - p.dano);
            j.invulAte = t + 1000;
            j.livreAte = t + 500;
            evento_('p', j.userId, p.dano, Math.round(p.deX), Math.round(p.deY));
            if (j.hp <= 0) {
              j.estado = 'fora';
              j.voltaEm = t + VOLTA_MS;
              j.quedas++;
              j.pontos = Math.max(0, j.pontos + PONTOS.queda);
              evento_('k', j.userId);
            }
          }
        }
      };

      // ---------------- O PASSO ----------------
      const tick = () => {
        const t = agora();
        const dt = PASSO_MS / 1000;
        passo++;
        if (fase === 'jogando') {
          const naSalaAgora = new Set(ctx.naSala());
          for (const id of ficaram) if (!naSalaAgora.has(id)) ficaram.delete(id);
          if (![...jogadores.keys()].some((id) => naSalaAgora.has(id))) {
            acabar(false, true);
            difundir();
            return;
          }
          // quem estava fora volta na porta de entrada
          for (const j of jogadores.values()) {
            if (j.estado === 'fora' && t >= j.voltaEm) {
              j.estado = 'em-pe';
              j.hp = CORACOES;
              j.invulAte = t + 2000;
              colocar(j, 0, t);
              evento_('r', j.userId);
            }
          }
          for (const b of [...bichos.values()]) {
            passoDoBicho(b, t, dt);
            b.historia.push({ t, x: b.x, y: b.y });
            while (b.historia.length && b.historia[0].t < t - HISTORIA_MS - 200) b.historia.shift();
          }
          const m = mundo();
          for (let k = tiros.length - 1; k >= 0; k--) {
            const tr = tiros[k];
            tr.x += tr.vx * dt;
            tr.y += tr.vy * dt;
            if (t > tr.ate || solida(sala, m, Math.floor(tr.x / TILE), Math.floor(tr.y / TILE), 'tiro')) {
              tiros.splice(k, 1);
              continue;
            }
            const { x, y } = tr;
            pancadas.push({ em: t, chave: `tiro:${tr.id}`, dentro: (px, py) => Math.hypot(px - x, py - y) <= 8 + RAIO, dano: 1, deX: x - tr.vx * 0.1, deY: y - tr.vy * 0.1, tiro: tr.id });
          }
          decidir(t);
          // os corações no chão: quem passa por cima e não está cheio pega
          for (let k = coracoes.length - 1; k >= 0; k--) {
            const c = coracoes[k];
            const j = emPe().find((p) => p.hp < CORACOES && Math.hypot(p.x - c.x, p.y - c.y) < 26);
            if (!j) continue;
            j.hp++;
            coracoes.splice(k, 1);
            evento_('c', j.userId);
          }
          // o baú: quem encosta abre, e o item é da turma
          if (bauNaSala() && !bausAbertos.has(sala.id)) {
            const [bx, by] = centro(...casasDe(sala, 'C')[0]);
            const j = emPe().find((p) => Math.hypot(p.x - bx, p.y - by) <= 42);
            if (j) {
              bausAbertos.add(sala.id);
              if (sala.bau!.guarda === 'cenoura') temCenoura = true;
              else chaves++;
              j.pontos += PONTOS.bau;
              evento_('b', sala.bau!.guarda, j.userId);
            }
          }
          // os botões do chão: os DOIS apertados ao mesmo tempo (um coelho ou o bloco em cada) abrem a porta para sempre
          const placas = casasDe(sala, 'P');
          if (placas.length && !resolvidas.has(sala.id)) {
            placasApertadas = placas.map(([c, l]) => {
              const [px, py] = centro(c, l);
              return emPe().some((j) => Math.abs(j.x - px) <= 18 && Math.abs(j.y - py) <= 18) || blocos.some((b) => b.c === c && b.l === l) ? 1 : 0;
            });
            if (placasApertadas.every((p) => p === 1)) {
              resolvidas.add(sala.id);
              for (const j of emPe()) {
                if (placas.some(([c, l]) => Math.abs(j.x - centro(c, l)[0]) <= 18 && Math.abs(j.y - centro(c, l)[1]) <= 18)) j.pontos += PONTOS.placas;
              }
              evento_('a', 'placas');
            }
          } else if (placas.length) placasApertadas = placas.map(() => 1);
          // a sala limpa
          if (sala.bichos.length && !limpas.has(sala.id) && bichos.size === 0) {
            limpas.add(sala.id);
            evento_('l', sala.id);
            if (sala.id === SALA_DO_CHEFE) return void (acabar(true), difundir());
          }
          if (t - inicio > MAX_MS) acabar(false);
        }
        difundir();
      };

      const difundir = () => {
        const m = mundo();
        ctx.difundir?.({
          tipo: 'q',
          n: passo,
          f: fase,
          s: sala.id,
          p: LADOS.map((lado) => {
            const p = sala.portas[lado];
            if (!p) return 0;
            if (m.abertas.includes(lado)) return 1;
            return p.trava === 'chave' && !(sala.bichos.length && !limpas.has(sala.id)) ? 3 : 2;
          }),
          b: blocos.map((b) => [b.id, b.c, b.l]),
          bau: bauNaSala() ? (bausAbertos.has(sala.id) ? 2 : 1) : 0,
          ponte: ponte ? 1 : 0,
          pl: placasApertadas,
          pr: resolvidas.has(sala.id) ? 1 : 0,
          it: [temCenoura ? 1 : 0, chaves],
          i: [...bichos.values()].map((b) => [
            b.id,
            TIPOS.indexOf(b.tipo),
            Math.round(b.x),
            Math.round(b.y),
            Math.round(b.z),
            ESTADOS.indexOf(b.estado),
            b.lado,
            Math.max(0, Math.round((b.hp / b.hpMax) * 100)),
            Math.min(9999, agora() - b.desde),
            Math.round(b.estado === 'saltando' || b.estado === 'mirando' ? b.alvoX : b.x + b.dx * 40),
            Math.round(b.estado === 'saltando' || b.estado === 'mirando' ? b.alvoY : b.y + b.dy * 40),
          ]),
          t: tiros.map((tr) => [tr.id, Math.round(tr.x), Math.round(tr.y)]),
          c: coracoes.map((c) => [c.id, Math.round(c.x), Math.round(c.y)]),
          v: [...visitadas],
          j: [...jogadores.values()].map((j) => [
            j.userId,
            Math.round(j.x),
            Math.round(j.y),
            j.dir,
            j.acao,
            j.tAcao,
            j.hp,
            j.estado === 'em-pe' ? 0 : 1,
            j.pontos,
            j.avatar ?? 0,
            j.ultimoAtaque,
            j.tp,
          ]),
          e: eventos,
        });
        eventos = [];
      };

      const acabar = (ganhou: boolean, vazia = false) => {
        if (fase !== 'jogando') return;
        fase = ganhou ? 'vitoria' : 'derrota';
        ctx.avisar();
        if (vazia) parar();
        ctx.agendar(FIM_MS, () => terminar(ganhou, !vazia));
      };

      const parar = () => {
        if (relogio !== null) limpar(relogio);
        relogio = null;
      };

      let resultado: { userId: number; username: string; pontos: number; acertos: number; nocautes: number; quedas: number; posicao: number | null }[] | null = null;
      const terminar = (ganhou: boolean, completa = true) => {
        parar();
        fase = 'fim';
        venceu = ganhou;
        const presentes = new Set(ctx.naSala());
        const turma = new Set([...ficaram].filter((id) => presentes.has(id)));
        const linhas = [...jogadores.values()]
          .map((j) => ({ userId: j.userId, username: ctx.nome(j.userId), pontos: j.pontos, acertos: j.acertos, nocautes: j.nocautes, quedas: j.quedas }))
          .sort((a, b) => b.pontos - a.pontos || a.username.localeCompare(b.username));
        const daTurma = linhas.filter((l) => turma.has(l.userId));
        resultado = [
          ...daTurma.map((l) => ({ ...l, posicao: 1 + daTurma.filter((o) => o.pontos > l.pontos).length })),
          ...linhas.filter((l) => !turma.has(l.userId)).map((l) => ({ ...l, posicao: null })),
        ];
        // O PÓDIO: o chefe vencido, 2 pessoas ou mais que ficaram até o fim, até o 3º (empatados dividem), só quem fez ponto
        if (ganhou && !solo && turma.size >= 2) {
          for (const l of resultado) {
            if (l.posicao === null || l.posicao > 3 || l.pontos <= 0) continue;
            db.guardarTrofeu({
              userId: l.userId,
              evento,
              communityId: ctx.comunidade ?? 0,
              pista: 'masmorra',
              posicao: l.posicao,
              tempoMs: agora() - inicio,
              pontos: l.pontos,
              rivais: [...turma].filter((id) => id !== l.userId),
            });
          }
        }
        ctx.terminar(completa);
      };

      // ---------------- O QUE A PESSOA MANDA (tempo real) ----------------
      const numero = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

      const registrarAtaque = (j: Jogador, id: unknown, g: unknown) => {
        if (!numero(id) || !Number.isInteger(id) || id <= j.ultimoAtaque || id > j.ultimoAtaque + 1000) return;
        if (g !== 'pa' && g !== 'cenoura') return;
        const t = agora();
        if (g === 'pa' && !gastar(j.baldes.pa)) return;
        if (g === 'cenoura') {
          if (!temCenoura || t - j.ultimaCenoura < CENOURA.recarga - 150) return;
          j.ultimaCenoura = t;
        }
        j.ultimoAtaque = id;
        j.ataques.push({ id, g, em: t, dir: j.dir, acertos: 0 });
        while (j.ataques.length > 6) j.ataques.shift();
      };

      const posicao = (j: Jogador, d: Record<string, unknown>) => {
        const { x, y, dir, acao, ta } = d;
        if (!numero(x) || !numero(y)) return;
        // a posição de antes de o servidor pôr o coelho noutro lugar (a troca de sala, a volta) chega atrasada: é da sala
        // de antes, e aceita ela viraria um atalho por cima da água
        if (d.tp !== j.tp) return;
        const t = agora();
        const dtS = Math.max(0, (t - j.ultimaEm) / 1000);
        j.ultimaEm = t;
        if (acao === ACOES.indexOf('arrancada') && t - j.ultimaArrancada >= ARRANCADA_RECARGA_MS - 150) {
          j.ultimaArrancada = t;
          j.extra = ARRANCADA_EXTRA;
          j.extraAte = t + ARRANCADA_MS + 300;
        }
        if (t > j.extraAte) j.extra = 0;
        j.credito = Math.min(ACUMULO, j.credito + VEL * FOLGA_VEL * dtS);
        let nx = x;
        let ny = y;
        if (t > j.livreAte) {
          const d0 = Math.hypot(x - j.x, y - j.y);
          const pode = j.credito + j.extra;
          if (d0 > pode) {
            const k = pode / d0;
            nx = j.x + (x - j.x) * k;
            ny = j.y + (y - j.y) * k;
          }
          const andou = Math.hypot(nx - j.x, ny - j.y);
          const doExtra = Math.min(j.extra, andou);
          j.extra -= doExtra;
          j.credito -= andou - doExtra;
        }
        // as paredes: o centro do coelho tem de estar num lugar livre (com um pouco de folga no desenho)
        if (livre(sala, mundo(), nx, ny, RAIO - 3, 'coelho')) {
          j.x = nx;
          j.y = ny;
        }
        if (numero(dir) && dir >= 0 && dir <= 3) j.dir = Math.floor(dir);
        j.acao = numero(acao) && acao >= 0 && acao < ACOES.length ? Math.floor(acao) : 0;
        j.tAcao = numero(ta) ? Math.max(0, Math.min(5000, Math.round(ta))) : 0;
        j.historia.push({ t, x: j.x, y: j.y });
        while (j.historia.length && j.historia[0].t < t - 1500) j.historia.shift();
        if (d.ataque && typeof d.ataque === 'object') {
          const a = d.ataque as Record<string, unknown>;
          registrarAtaque(j, a.id, a.g);
        }
      };

      /** Um acerto num bicho: devolve por que não valeu, ou null. */
      const acerto = (j: Jogador, d: Record<string, unknown>): string | null => {
        const t = agora();
        const a = j.ataques.find((x) => x.id === d.a);
        if (!a) return 'golpe que não começou';
        if (t - a.em > (a.g === 'pa' ? PA.dura + 500 : CENOURA.dura + 300)) return 'golpe velho';
        if (a.acertos >= 6) return 'acertos demais';
        const b = bichos.get(d.inimigo as number);
        if (!b || b.hp <= 0 || b.estado === 'morto') return 'bicho fora';
        if (a.g === 'pa' && b.z > 12) return 'alto demais';
        const chave = `${j.userId}:${a.id}`;
        if (b.acertos.has(chave)) return 'já acertou';
        const { x, y } = d;
        if (!numero(x) || !numero(y)) return 'números';
        const raio = BICHOS[b.tipo].raio;
        let px = x;
        let py = y;
        if (a.g === 'pa') {
          if (Math.hypot(x - j.x, y - j.y) > 40) return 'longe de si';
          px = x + DIRS[a.dir][0] * PA.frente;
          py = y + DIRS[a.dir][1] * PA.frente;
        } else if (Math.hypot(x - j.x, y - j.y) > CENOURA.alcance + 60) return 'longe de si';
        const alcance = (a.g === 'pa' ? PA.raio : CENOURA.raio + 6) + raio + FOLGA_ACERTO;
        if (!b.historia.some((h) => h.t >= t - HISTORIA_MS && Math.hypot(h.x - px, h.y - py) <= alcance)) return 'longe do bicho';
        // valeu
        b.acertos.add(chave);
        a.acertos++;
        const chefe = b.tipo === 'rei-cogumelo';
        const dano = chefe && b.estado === 'cansado' && a.g === 'pa' ? 2 : 1;
        b.hp = Math.max(0, b.hp - dano);
        j.pontos += PONTOS.acerto;
        j.acertos++;
        evento_('h', b.id, j.userId, Math.round(b.x), Math.round(b.y));
        if (b.hp <= 0) {
          j.pontos += BICHOS[b.tipo].pontos;
          j.nocautes++;
          b.z = 0;
          mudar(b, 'morto', 500);
          evento_('x', b.id, Math.round(b.x), Math.round(b.y));
        } else if (chefe) {
          // o rei aguenta firme: só pisca
        } else if (a.g === 'cenoura') mudar(b, 'atordoado', 1500);
        else {
          const dd = Math.hypot(b.x - j.x, b.y - j.y) || 1;
          b.vx = ((b.x - j.x) / dd) * 200;
          b.vy = ((b.y - j.y) / dd) * 200;
          b.z = 0;
          mudar(b, 'dor', 300);
        }
        return null;
      };

      /** A cenoura no cristal: levanta a ponte. */
      const cristal = (j: Jogador, d: Record<string, unknown>): string | null => {
        const t = agora();
        const a = j.ataques.find((x) => x.id === d.a);
        if (!a || a.g !== 'cenoura' || t - a.em > CENOURA.dura + 300) return 'sem cenoura';
        const k = casasDe(sala, 'K')[0];
        if (!k || ponte) return 'sem cristal';
        const [kx, ky] = centro(k[0], k[1]);
        if (Math.hypot(kx - j.x, ky - j.y) > CENOURA.alcance + TILE) return 'longe de si';
        if (!numero(d.x) || !numero(d.y) || Math.hypot(d.x - kx, d.y - ky) > TILE) return 'longe do cristal';
        ponte = true;
        j.pontos += PONTOS.cristal;
        evento_('a', 'ponte');
        return null;
      };

      /** Empurrar o bloco uma casa: quem empurra está do outro lado, alinhado, e a casa de destino é chão. */
      const empurrar = (j: Jogador, d: Record<string, unknown>): string | null => {
        const t = agora();
        if (!numero(d.dir) || d.dir < 0 || d.dir > 3) return 'direção';
        if (t - j.ultimoEmpurrao < 300) return 'cedo';
        const [dx, dy] = DIRS[Math.floor(d.dir)];
        const b = blocos.find((bl) => {
          const [cx, cy] = centro(bl.c, bl.l);
          const atras = dx !== 0 ? (j.x - cx) * dx : (j.y - cy) * dy;
          const lado = dx !== 0 ? Math.abs(j.y - cy) : Math.abs(j.x - cx);
          return atras <= -(TILE / 2) && atras >= -(TILE / 2 + RAIO + 12) && lado < 18;
        });
        if (!b) return 'sem bloco';
        const nc = b.c + dx;
        const nl = b.l + dy;
        const m = mundo();
        if (solida(sala, m, nc, nl, 'bicho') || casasDe(sala, 'C').some(([c, l]) => c === nc && l === nl)) return 'parede';
        if (LADOS.some((lado) => PORTA[lado][0] === nc && PORTA[lado][1] === nl)) return 'porta';
        j.ultimoEmpurrao = t;
        b.c = nc;
        b.l = nl;
        return null;
      };

      /** A porta: aberta, a turma passa; trancada, a chave abre (e a turma passa). */
      const porta = (j: Jogador, d: Record<string, unknown>): string | null => {
        const lado = d.lado as Lado;
        if (!LADOS.includes(lado)) return 'lado';
        const p = sala.portas[lado];
        if (!p) return 'sem porta';
        const [px, py] = centro(...PORTA[lado]);
        if (Math.hypot(j.x - px, j.y - py) > TILE + 4) return 'longe';
        if (!portaAberta(lado)) {
          if (p.trava !== 'chave' || chaves <= 0 || (sala.bichos.length && !limpas.has(sala.id))) return 'fechada';
          chaves--;
          destrancadas.add(`${sala.id}:${lado}`);
          evento_('a', 'chave');
        }
        entrarNa(p.para, OPOSTO[lado]);
        return null;
      };

      entrarNa(0, null);
      // o começo: na entrada, ninguém vem de porta nenhuma (a chegada é a do sul)
      relogio = intervalo(tick, PASSO_MS);

      return {
        publico() {
          return {
            fase,
            sala: sala.id,
            venceu: fase === 'vitoria' || (fase === 'fim' && venceu),
            jogadores: [...jogadores.values()].map((j) => ({ userId: j.userId, username: ctx.nome(j.userId), avatar: j.avatar, pontos: j.pontos })),
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
          if (!j || !dados || typeof dados !== 'object' || fase !== 'jogando' || j.estado !== 'em-pe') return null;
          const d = dados as Record<string, unknown>;
          if (d.tipo === 'pos') {
            if (gastar(j.baldes.pos)) posicao(j, d);
            return null;
          }
          if (!gastar(j.baldes.acao)) return null;
          if (d.tipo === 'golpe') ultimoMotivo = acerto(j, d);
          else if (d.tipo === 'cristal') ultimoMotivo = cristal(j, d);
          else if (d.tipo === 'empurrar') ultimoMotivo = empurrar(j, d);
          else if (d.tipo === 'porta') ultimoMotivo = porta(j, d);
          return null;
        },
        conferir() {
          if (fase === 'fim') parar();
        },
        parar,
        // para o teste
        ...({ _passo: tick, _bichos: bichos, _jogadores: jogadores, _motivo: () => ultimoMotivo, _sala: () => sala.id } as object),
      };
    },
  };
}
