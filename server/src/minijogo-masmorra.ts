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
 * OS VASOS, AS MOITAS, A BOMBA E A SALA SECRETA (19/11/2026): o vaso se levanta (a pá, de frente para ele) e se joga; a pá
 * corta a moita; a bomba de semente estoura sozinha. Tudo isso é do SERVIDOR: o vaso voa aqui (e acerta o bicho que ele vê),
 * o que sai da moita e do vaso quebrado (coração, semente ou nada) é sorteado aqui, e a bomba estoura aqui. Quem pede só diz
 * "levantei", "joguei", "cortei" ou "soltei a bomba", e o servidor confere a distância e a direção como confere o empurrão.
 * A bomba ao lado da PAREDE RACHADA do salão dos cogumelos abre a sala secreta, e o CORAÇÃO GRANDE de lá dá um coração a mais
 * a cada um da turma. A bomba também machuca quem está perto (a mesma folga de quem apanha).
 *
 * A SEGUNDA MASMORRA (19/11/2026): a MINA DOS POSTES, escolhida na largada (corpo.masmorra = 'mina'), ramificada e com o
 * GANCHO no lugar da cenoura. O gancho é do servidor como a porta: quem o usa diz só a direção, e o servidor procura o poste
 * na linha (alvoDoGancho, a mesma conta do site), põe o coelho na casa antes dele e conta o teleporte (tp), como na troca de
 * sala; a posição velha, do outro lado da água, chega depois e é recusada.
 *
 * O RECORDE DO SOLO (19/11/2026): o tempo da masmorra vencida sozinho vai à tabela comum dos recordes do Solo ('masmorra').
 *
 * O LOTE D (21/11/2026): o chefe da mina é o GOLEM-REI, de couraça (nada o fere até o GANCHO pegá-lo: o servidor confere a
 * linha da corda contra o passado dele, como o golpe, e o deixa atordoado por GOLEM.atordoado ms); dois bichos novos, a ABELHA
 * (voa e mergulha na linha marcada) e o FANTASMA (some e aparece); a sala secreta da mina; os ACHADOS (baús e segredos, contados
 * aqui e mostrados no fim); e o HEROICO (mais vida e dano dos bichos, menos corações; o recorde do Solo à parte).
 *
 * A TERCEIRA MASMORRA (24/11/2026): a FORNALHA DO DRAGÃO, com o REGADOR no lugar do gancho. O regador é do servidor como o
 * gancho: quem rega diz só a direção, e o servidor acha na linha (alvoDoRegador/jatoPega, a mesma conta do site) o dragão ou o
 * primeiro fogo aceso. O fogo do chão apaga para sempre; os BRASEIROS acendem de novo em BRASEIRO.volta ms, e todos apagados
 * juntos abrem a porta (o enigma da turma, como os botões). O dragão é protegido como o golem-rei: só molhado ele apanha.
 *
 * OS TROFÉUS: com o rei-cogumelo vencido e 2 pessoas ou mais que ficaram até o fim, o pódio (até o 3º, empatados dividem, só quem
 * fez ponto) vai para a estante do quarto (corrida_trofeus, "pista" 'masmorra', com os pontos). Fora das conquistas da turma até
 * ele decidir. No Solo, nada.
 */
import * as db from './db.js';
import type { Contexto, Definicao } from './minijogo-motor.js';
import {
  ACOES,
  alvoDoGancho,
  achadosDa,
  ehChefe,
  ehMasmorra,
  FANTASMA,
  ganchoPega,
  GANCHO,
  GOLEM,
  HEROICO,
  MASMORRAS,
  ALCANCE_DA_MAO,
  alvoDoRegador,
  BRASEIRO,
  DRAGAO,
  ehProtegido,
  fimDoJato,
  jatoPega,
  REGADOR,
  ARREMESSO,
  BICHOS,
  BOMBA,
  CORACAO_GRANDE,
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
export const PONTOS = {
  acerto: 5,
  bau: 30,
  cristal: 30,
  placas: 20,
  queda: -10,
};
/** A chance de um bicho deixar um coração ao sumir. */
export const CHANCE_DE_CORACAO = 0.3;
/** O que sai do vaso quebrado e da moita cortada: coração, semente, ou nada (sorteado pelo servidor). */
export const CHANCE_NA_MOITA = { coracao: 0.3, semente: 0.25 };

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
  /** O golem-rei: até quando o gancho não o pega de novo. O fantasma: quando ele some ou aparece. */
  ganchoAte: number;
  trocaEm: number;
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
  /** Carregando um vaso por cima da cabeça (19/11/2026). */
  carrega: boolean;
  hpMax: number;
  /** O último jato do regador (a fornalha, 24/11/2026). */
  ultimoJato: number;
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
    comecar(ctx: Contexto, { naSala, corpo }) {
      const inscritos = [...naSala].slice(0, 4);
      if (inscritos.length === 0) return 'Ninguém para jogar.';
      const solo = ctx.comunidade === 0 || ctx.comunidade === undefined;
      const evento = `masmorra-${ctx.comunidade ?? 0}-${agora()}`;
      const inicio = agora();
      const n = inscritos.length;
      let fase: Fase = 'jogando';
      // qual masmorra (19/11/2026): a toca de sempre, ou a mina dos postes
      // e o HEROICO (21/11/2026): "toca-heroico"/"mina-heroico" (o que o "Jogar de novo" manda de volta) ou heroico: true
      const pedido = typeof corpo?.masmorra === 'string' ? corpo.masmorra : typeof corpo?.categoria === 'string' ? corpo.categoria : 'toca';
      const heroico = corpo?.heroico === true || pedido.endsWith('-heroico');
      const base = pedido.replace(/-heroico$/, '');
      const qual = ehMasmorra(base) ? base : 'toca';
      const daMasmorra = MASMORRAS[qual];
      /** A variante do recorde do Solo: a toca guarda a de antes (''); o heroico, à parte. */
      const variante = heroico ? (qual === 'toca' ? 'heroico' : `${qual}-heroico`) : qual === 'toca' ? '' : qual;
      const categoria = heroico ? `${qual}-heroico` : qual;
      const coracoesDaTurma = heroico ? HEROICO.coracoes : CORACOES;
      /** O dano a mais dos bichos no heroico. */
      const danoExtra = heroico ? HEROICO.dano : 0;
      const totalDeAchados = achadosDa(qual);
      let sala: Sala = SALAS[daMasmorra.inicio];
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
      // os vasos e as moitas que saíram de cada sala, os vasos voando, as bombas e as sementes no chão (19/11/2026)
      const foraDaSala = new Map<number, Set<string>>();
      const foraAqui = () => {
        let f = foraDaSala.get(sala.id);
        if (!f) foraDaSala.set(sala.id, (f = new Set()));
        return f;
      };
      const arremessos: {
        id: number;
        x: number;
        y: number;
        dx: number;
        dy: number;
        andou: number;
        dono: number;
      }[] = [];
      const bombas: { id: number; x: number; y: number; em: number }[] = [];
      const sementesNoChao: { id: number; x: number; y: number }[] = [];
      let sementes = BOMBA.inicio;
      let coracaoGrande = false;
      const rachadas = new Set<string>();
      let tempoDaVitoria: number | null = null;
      const recordeAntes = solo ? (db.recordeDoSolo(inscritos[0], 'masmorra', variante)?.valor ?? null) : null;
      let recordeNovo = false;
      // o mundo que fica: o que cada sala já resolveu
      const limpas = new Set<number>();
      const bausAbertos = new Set<number>();
      const resolvidas = new Set<number>();
      const destrancadas = new Set<string>();
      const visitadas = new Set<number>([daMasmorra.inicio]);
      let temGancho = false;
      // A FORNALHA (24/11/2026): o regador, o fogo do chão apagado em cada sala (para sempre) e os braseiros apagados agora
      // (a casa → quando; só da sala de agora: saiu, eles acendem de novo)
      let temRegador = false;
      const apagadosDaSala = new Map<number, Set<string>>();
      const apagadosAqui = () => {
        let f = apagadosDaSala.get(sala.id);
        if (!f) apagadosDaSala.set(sala.id, (f = new Set()));
        return f;
      };
      const braseiros = new Map<string, number>();
      let ponte = false;
      let temCenoura = false;
      let chaves = 0;
      let blocos: { id: number; c: number; l: number }[] = [];
      let placasApertadas: number[] = [];
      /** Os blocos de cada sala resolvida ficam onde pararam. */
      const blocosGuardados = new Map<number, { id: number; c: number; l: number }[]>();

      const balde = (max: number, porSeg: number): Balde => ({
        fichas: max,
        em: agora(),
        max,
        porSeg,
      });
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
              hp: coracoesDaTurma,
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
              ultimoJato: -1e9,
              ultimoEmpurrao: -1e9,
              tp: 1,
              baldes: {
                pos: balde(30, 24),
                acao: balde(20, 10),
                pa: balde(3, 4),
              },
              carrega: false,
              hpMax: coracoesDaTurma,
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
        if (p.trava === 'rachada') return rachadas.has(`${sala.id}:${lado}`);
        if (p.trava === 'braseiros') return resolvidas.has(sala.id);
        return true;
      };
      const mundo = (): Mundo => ({
        blocos: blocos.map((b) => [b.c, b.l] as [number, number]),
        bau: bauNaSala(),
        ponte,
        abertas: LADOS.filter(portaAberta),
        fora: [...foraAqui()].map((k) => k.split(',').map(Number) as [number, number]),
        apagados: apagadosNaSala().map(([c, l]) => [c, l] as [number, number]),
      });
      /** O fogo apagado na sala de agora: [c, l, ms até acender (0: para sempre)]; os braseiros do enigma resolvido, para sempre. */
      const apagadosNaSala = (): number[][] => {
        const r = [...apagadosAqui()].map((k) => [...k.split(',').map(Number), 0]);
        if (resolvidas.has(sala.id)) for (const [c, l] of casasDe(sala, 'A')) r.push([c, l, 0]);
        else for (const [k, em] of braseiros) r.push([...k.split(',').map(Number), Math.max(1, BRASEIRO.volta - (agora() - em))]);
        return r;
      };
      const emPe = () => [...jogadores.values()].filter((j) => j.estado === 'em-pe');

      const novoBicho = (tipo: TipoDoBicho, x: number, y: number): Bicho => {
        const def = BICHOS[tipo];
        const daTurma = ehChefe(tipo) ? Math.round(def.hp * (1 + 0.5 * (n - 1))) : def.hp;
        const hpMax = heroico ? Math.ceil(daTurma * HEROICO.vida) : daTurma;
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
          ate: t + (ehChefe(tipo) ? 1200 : 700),
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
          ganchoAte: 0,
          trocaEm: t + FANTASMA.visivel,
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
        arremessos.length = 0;
        bombas.length = 0;
        sementesNoChao.length = 0;
        braseiros.clear();
        for (const j of jogadores.values()) j.carrega = false;
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
      /** A couraça do golem-rei está fechada (só o gancho a abre: atordoado, ele apanha). */
      // e o fogo do dragão (24/11/2026): só o regador o apaga
      const couracaFechada = (b: Bicho) => ehProtegido(b.tipo) && b.estado !== 'atordoado';
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
        pancadas.push({
          em: agora(),
          chave,
          dentro: (x, y) => Math.hypot(x - px, y - py) <= raio + RAIO,
          dano: dano + danoExtra,
          deX: b.x,
          deY: b.y,
        });
      const atirar = (x: number, y: number, dx: number, dy: number, vel: number) =>
        tiros.push({
          id: proximoId++,
          x,
          y,
          vx: dx * vel,
          vy: dy * vel,
          ate: agora() + 4000,
        });

      const passoDoBicho = (b: Bicho, t: number, dt: number) => {
        const vel = BICHOS[b.tipo].vel;
        if (b.estado === 'morto') {
          if (t >= b.ate) {
            bichos.delete(b.id);
            if (!ehChefe(b.tipo) && aleatorio() < CHANCE_DE_CORACAO) coracoes.push({ id: proximoId++, x: b.x, y: b.y });
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
          if (t >= b.ate) mudar(b, ehChefe(b.tipo) ? 'andando' : 'parado', ehChefe(b.tipo) ? 1800 : 0);
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
          case 'abelha': {
            // voa (passa por cima da água): chega perto, mira a linha e MERGULHA reto nela
            const voar = (dx: number, dy: number) => {
              const [nx, ny] = mover(sala, mundo(), b.x, b.y, dx, dy, BICHOS.abelha.raio, 'tiro');
              const bateu = Math.abs(nx - b.x - dx) > 0.01 || Math.abs(ny - b.y - dy) > 0.01;
              b.x = nx;
              b.y = ny;
              return bateu;
            };
            b.z = 8;
            if (b.estado === 'mirando') {
              if (t >= b.ate) {
                b.ataque++;
                mudar(b, 'investida', 450);
              }
              return;
            }
            if (b.estado === 'investida') {
              const bateu = voar(b.dx * 330 * dt, b.dy * 330 * dt);
              pancada(b, b.x, b.y, 16, 1);
              if (bateu || t >= b.ate) mudar(b, 'recuperando', 700);
              return;
            }
            if (!alvo) return void (b.estado !== 'parado' && mudar(b, 'parado', 0));
            const d = Math.hypot(alvo.x - b.x, alvo.y - b.y);
            mira(b, alvo);
            if (d < 130 && t >= b.proximo) {
              mudar(b, 'mirando', 650);
              b.proximo = t + 1800 + aleatorio() * 900;
              return;
            }
            if (d > 90) {
              if (b.estado !== 'andando') mudar(b, 'andando', 0);
              voar(b.dx * vel * dt, b.dy * vel * dt);
            } else if (b.estado !== 'parado') mudar(b, 'parado', 0);
            return;
          }
          case 'fantasma': {
            // some e aparece: sumido, ninguém o acerta e ele não acerta ninguém (mas continua vindo)
            if (b.estado === 'sumido') {
              if (alvo) {
                mira(b, alvo);
                andar(b, b.dx * vel * dt, b.dy * vel * dt);
              }
              if (t >= b.trocaEm) {
                b.trocaEm = t + FANTASMA.visivel;
                mudar(b, 'parado', 0);
              }
              return;
            }
            if (b.estado === 'preparando') {
              if (t >= b.ate) {
                b.ataque++;
                // o susto: em volta dele
                pancada(b, b.x, b.y, 34, 1);
                mudar(b, 'atacando', 250);
              }
              return;
            }
            if (b.estado === 'atacando') {
              if (t >= b.ate) mudar(b, 'recuperando', 500);
              return;
            }
            if (t >= b.trocaEm) {
              b.trocaEm = t + FANTASMA.sumido;
              mudar(b, 'sumido', FANTASMA.sumido);
              return;
            }
            if (!alvo) return void (b.estado !== 'parado' && mudar(b, 'parado', 0));
            const d = Math.hypot(alvo.x - b.x, alvo.y - b.y);
            mira(b, alvo);
            if (d < 48 && t >= b.proximo) {
              mudar(b, 'preparando', 650);
              b.proximo = t + 1500;
              // não some no meio do susto
              b.trocaEm = Math.max(b.trocaEm, t + 1500);
              return;
            }
            if (d > 28) {
              if (b.estado !== 'andando') mudar(b, 'andando', 0);
              andar(b, b.dx * vel * dt, b.dy * vel * dt);
            }
            return;
          }
          case 'diabinho': {
            // o diabinho da fornalha (24/11/2026): fica de longe (foge de quem chega perto), mira e cospe uma bola de fogo
            if (b.estado === 'mirando') {
              if (t >= b.ate) {
                atirar(b.x + b.dx * 16, b.y + b.dy * 16, b.dx, b.dy, 190);
                mudar(b, 'atacando', 250);
              }
              return;
            }
            if (b.estado === 'atacando') {
              if (t >= b.ate) mudar(b, 'recuperando', 450);
              return;
            }
            if (!alvo) return void (b.estado !== 'parado' && mudar(b, 'parado', 0));
            const d = Math.hypot(alvo.x - b.x, alvo.y - b.y);
            mira(b, alvo);
            if (t >= b.proximo && d < 360) {
              mudar(b, 'mirando', 650);
              b.proximo = t + 2000 + aleatorio() * 900;
              return;
            }
            const sentido = d < 110 ? -1 : d > 220 ? 1 : 0;
            if (sentido === 0) {
              if (b.estado !== 'parado') mudar(b, 'parado', 0);
              return;
            }
            if (b.estado !== 'andando') mudar(b, 'andando', 0);
            andar(b, sentido * b.dx * vel * dt, sentido * b.dy * vel * dt);
            return;
          }
          case 'dragao':
          case 'golem-rei':
          case 'rei-cogumelo': {
            if (b.estado === 'prep-investida') {
              if (t >= b.ate) {
                b.ataque++;
                mudar(b, 'investida', 1600);
              }
              return;
            }
            if (b.estado === 'investida') {
              const rapidez = b.tipo === 'golem-rei' ? 220 : b.tipo === 'dragao' ? 230 : 250;
              const bateu = andar(b, b.dx * rapidez * dt, b.dy * rapidez * dt);
              pancada(b, b.x, b.y, 30, 2);
              if (bateu) mudar(b, 'cansado', 1700);
              else if (t >= b.ate) mudar(b, 'recuperando', 600);
              return;
            }
            if (b.estado === 'prep-sopro') {
              if (t >= b.ate) {
                if (b.tipo === 'dragao') {
                  // o sopro do dragão: um leque de cinco bolas de fogo para onde ele mirou
                  const base = Math.atan2(b.dy, b.dx);
                  for (let k = -2; k <= 2; k++) atirar(b.x + b.dx * 24, b.y + b.dy * 24, Math.cos(base + k * 0.32), Math.sin(base + k * 0.32), 150);
                } else for (let k = 0; k < 8; k++) atirar(b.x, b.y, Math.cos((k * Math.PI) / 4), Math.sin((k * Math.PI) / 4), 140);
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
            // na metade da vida, chama dois cogumelos (o golem, duas abelhas) uma vez; depois, investida e sopro em vez
            if (b.hp <= b.hpMax / 2 && !b.invocou) {
              b.invocou = true;
              const m = mundo();
              for (const [ox, oy] of [
                [-70, 30],
                [70, 30],
              ])
                if (livre(sala, m, b.x + ox, b.y + oy, 14, 'bicho')) novoBicho(b.tipo === 'golem-rei' ? 'abelha' : b.tipo === 'dragao' ? 'diabinho' : 'cogumelo', b.x + ox, b.y + oy);
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
              j.hp = j.hpMax;
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
            pancadas.push({
              em: t,
              chave: `tiro:${tr.id}`,
              dentro: (px, py) => Math.hypot(px - x, py - y) <= 8 + RAIO,
              dano: 1 + danoExtra,
              deX: x - tr.vx * 0.1,
              deY: y - tr.vy * 0.1,
              tiro: tr.id,
            });
          }
          decidir(t);
          andarArremessos(dt);
          estourarBombas(t);
          // as sementes no chão: quem passa por cima pega (são da turma)
          for (let k = sementesNoChao.length - 1; k >= 0; k--) {
            const sm = sementesNoChao[k];
            const j = emPe().find((p) => Math.hypot(p.x - sm.x, p.y - sm.y) < 26);
            if (!j || sementes >= BOMBA.maximo) continue;
            sementes++;
            sementesNoChao.splice(k, 1);
            evento_('sm', j.userId);
          }
          // o coração grande: quem chega nele dá um coração a mais a cada um da turma
          const grande = casasDe(sala, 'H')[0];
          if (grande && !coracaoGrande) {
            const [hx, hy] = centro(grande[0], grande[1]);
            const j = emPe().find((p) => Math.hypot(p.x - hx, p.y - hy) < 28);
            if (j) {
              coracaoGrande = true;
              for (const o of jogadores.values()) {
                o.hpMax += CORACAO_GRANDE;
                if (o.estado === 'em-pe') o.hp = o.hpMax;
              }
              j.pontos += PONTOS.bau;
              evento_('g', j.userId);
            }
          }
          // os corações no chão: quem passa por cima e não está cheio pega
          for (let k = coracoes.length - 1; k >= 0; k--) {
            const c = coracoes[k];
            const j = emPe().find((p) => p.hp < p.hpMax && Math.hypot(p.x - c.x, p.y - c.y) < 26);
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
              else if (sala.bau!.guarda === 'gancho') temGancho = true;
              else if (sala.bau!.guarda === 'regador') temRegador = true;
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
          // os braseiros (a fornalha): o apagado há BRASEIRO.volta ms acende de novo, se o enigma não foi resolvido
          if (!resolvidas.has(sala.id)) for (const [k, em] of braseiros) if (t - em >= BRASEIRO.volta) braseiros.delete(k);
          // a sala limpa
          if (sala.bichos.length && !limpas.has(sala.id) && bichos.size === 0) {
            limpas.add(sala.id);
            evento_('l', sala.id);
            if (sala.chefe || sala.id === SALA_DO_CHEFE) return void (acabar(true), difundir());
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
            if (p.trava === 'rachada') return 4;
            return p.trava === 'chave' && !(sala.bichos.length && !limpas.has(sala.id)) ? 3 : 2;
          }),
          b: blocos.map((b) => [b.id, b.c, b.l]),
          bau: bauNaSala() ? (bausAbertos.has(sala.id) ? 2 : 1) : 0,
          ponte: ponte ? 1 : 0,
          pl: placasApertadas,
          pr: resolvidas.has(sala.id) ? 1 : 0,
          it: [temCenoura ? 1 : 0, chaves, sementes, temGancho ? 1 : 0, temRegador ? 1 : 0],
          ap: apagadosNaSala(),
          o: [...foraAqui()].map((k) => k.split(',').map(Number)),
          r: arremessos.map((a) => [a.id, Math.round(a.x), Math.round(a.y)]),
          bs: bombas.map((b) => [b.id, Math.round(b.x), Math.round(b.y), Math.max(0, BOMBA.pavio - (agora() - b.em))]),
          sm: sementesNoChao.map((sm) => [sm.id, Math.round(sm.x), Math.round(sm.y)]),
          cg: coracaoGrande ? 1 : 0,
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
            j.carrega ? 1 : 0,
            j.hpMax,
          ]),
          e: eventos,
        });
        eventos = [];
      };

      const acabar = (ganhou: boolean, vazia = false) => {
        if (fase !== 'jogando') return;
        if (ganhou) tempoDaVitoria = agora() - inicio;
        fase = ganhou ? 'vitoria' : 'derrota';
        ctx.avisar();
        if (vazia) parar();
        ctx.agendar(FIM_MS, () => terminar(ganhou, !vazia));
      };

      const parar = () => {
        if (relogio !== null) limpar(relogio);
        relogio = null;
      };

      let resultado:
        | {
            userId: number;
            username: string;
            pontos: number;
            acertos: number;
            nocautes: number;
            quedas: number;
            posicao: number | null;
          }[]
        | null = null;
      const terminar = (ganhou: boolean, completa = true) => {
        parar();
        fase = 'fim';
        venceu = ganhou;
        const presentes = new Set(ctx.naSala());
        const turma = new Set([...ficaram].filter((id) => presentes.has(id)));
        const linhas = [...jogadores.values()]
          .map((j) => ({
            userId: j.userId,
            username: ctx.nome(j.userId),
            pontos: j.pontos,
            acertos: j.acertos,
            nocautes: j.nocautes,
            quedas: j.quedas,
          }))
          .sort((a, b) => b.pontos - a.pontos || a.username.localeCompare(b.username));
        const daTurma = linhas.filter((l) => turma.has(l.userId));
        resultado = [
          ...daTurma.map((l) => ({
            ...l,
            posicao: 1 + daTurma.filter((o) => o.pontos > l.pontos).length,
          })),
          ...linhas.filter((l) => !turma.has(l.userId)).map((l) => ({ ...l, posicao: null })),
        ];
        // O RECORDE DO SOLO: o tempo da masmorra vencida sozinho (o relógio é o do servidor)
        if (ganhou && solo && tempoDaVitoria !== null && ficaram.has(inscritos[0])) {
          recordeNovo = db.guardarRecordeDoSolo(inscritos[0], 'masmorra', variante, tempoDaVitoria, true).novo;
        }
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
        if (b.estado === 'sumido') return 'sumido';
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
        // a couraça do golem-rei: sem o gancho, o golpe só tine
        if (couracaFechada(b)) {
          b.acertos.add(chave);
          evento_('tk', b.id, j.userId, Math.round(b.x), Math.round(b.y));
          return 'couraça';
        }
        // valeu
        b.acertos.add(chave);
        a.acertos++;
        const chefe = ehChefe(b.tipo);
        const dano = chefe && (b.estado === 'cansado' || b.estado === 'atordoado') && a.g === 'pa' ? 2 : 1;
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

      // ---------------- OS VASOS, AS MOITAS E A BOMBA (19/11/2026) ----------------
      /** O que sai do vaso e da moita: o servidor sorteia. */
      const soltarAlgo = (x: number, y: number) => {
        const r = aleatorio();
        if (r < CHANCE_NA_MOITA.coracao) coracoes.push({ id: proximoId++, x, y });
        else if (r < CHANCE_NA_MOITA.coracao + CHANCE_NA_MOITA.semente) sementesNoChao.push({ id: proximoId++, x, y });
      };
      /** A casa (c, l) é um vaso (ou moita) que ainda está na sala? */
      const aindaNaSala = (c: number, l: number, letra: 'V' | 'M') => sala.grade[l]?.[c] === letra && !foraAqui().has(`${c},${l}`);
      const pertoDaCasa = (j: Jogador, c: number, l: number) => {
        const [cx, cy] = centro(c, l);
        return Math.hypot(j.x - cx, j.y - cy) <= ALCANCE_DA_MAO;
      };
      const quebrar = (c: number, l: number) => {
        foraAqui().add(`${c},${l}`);
        const [cx, cy] = centro(c, l);
        soltarAlgo(cx, cy);
        evento_('q', Math.round(cx), Math.round(cy));
      };

      /** Levantar o vaso da frente. */
      const levantar = (j: Jogador, d: Record<string, unknown>): string | null => {
        if (j.carrega) return 'já carrega';
        if (!numero(d.c) || !numero(d.l)) return 'casa';
        const c = Math.floor(d.c);
        const l = Math.floor(d.l);
        if (!aindaNaSala(c, l, 'V')) return 'sem vaso';
        if (!pertoDaCasa(j, c, l)) return 'longe';
        foraAqui().add(`${c},${l}`);
        j.carrega = true;
        evento_('v', j.userId);
        return null;
      };

      /** Jogar o vaso: ele voa para onde o coelho olha, e o servidor o anda. */
      const jogar = (j: Jogador): string | null => {
        if (!j.carrega) return 'sem vaso';
        j.carrega = false;
        const [dx, dy] = DIRS[j.dir];
        arremessos.push({
          id: proximoId++,
          x: j.x,
          y: j.y - 10,
          dx,
          dy,
          andou: 0,
          dono: j.userId,
        });
        return null;
      };

      /** A pá na moita: o golpe tem de ser recente, e a moita perto. */
      const cortar = (j: Jogador, d: Record<string, unknown>): string | null => {
        const a = j.ataques.find((x) => x.id === d.a);
        if (!a || a.g !== 'pa' || agora() - a.em > PA.dura + 500) return 'sem golpe';
        if (!numero(d.c) || !numero(d.l)) return 'casa';
        const c = Math.floor(d.c);
        const l = Math.floor(d.l);
        if (!aindaNaSala(c, l, 'M')) return 'sem moita';
        if (!pertoDaCasa(j, c, l)) return 'longe';
        j.pontos += 1;
        quebrar(c, l);
        return null;
      };

      /** Soltar a bomba de semente aos pés. */
      const soltarBomba = (j: Jogador): string | null => {
        if (sementes <= 0) return 'sem semente';
        if (bombas.some((b) => agora() - b.em < 400)) return 'cedo';
        sementes--;
        bombas.push({ id: proximoId++, x: j.x, y: j.y, em: agora() });
        return null;
      };

      const andarArremessos = (dt: number) => {
        const m = mundo();
        for (let k = arremessos.length - 1; k >= 0; k--) {
          const a = arremessos[k];
          const passo_ = ARREMESSO.vel * dt;
          a.x += a.dx * passo_;
          a.y += a.dy * passo_;
          a.andou += passo_;
          const alvo = [...bichos.values()].find(
            (b) => b.estado !== 'morto' && b.estado !== 'sumido' && b.hp > 0 && b.z < 14 && Math.hypot(b.x - a.x, b.y - a.y) <= ARREMESSO.raio + BICHOS[b.tipo].raio,
          );
          const bateu = solida(sala, m, Math.floor(a.x / TILE), Math.floor(a.y / TILE), 'tiro');
          if (!alvo && !bateu && a.andou < ARREMESSO.alcance) continue;
          arremessos.splice(k, 1);
          if (alvo && couracaFechada(alvo)) evento_('tk', alvo.id, a.dono, Math.round(alvo.x), Math.round(alvo.y));
          else if (alvo) {
            const dono = jogadores.get(a.dono);
            alvo.hp = Math.max(0, alvo.hp - ARREMESSO.dano);
            if (dono) dono.pontos += PONTOS.acerto;
            evento_('h', alvo.id, a.dono, Math.round(alvo.x), Math.round(alvo.y));
            if (alvo.hp <= 0) {
              if (dono) {
                dono.pontos += BICHOS[alvo.tipo].pontos;
                dono.nocautes++;
              }
              alvo.z = 0;
              mudar(alvo, 'morto', 500);
              evento_('x', alvo.id, Math.round(alvo.x), Math.round(alvo.y));
            } else if (!ehChefe(alvo.tipo)) mudar(alvo, 'atordoado', 1000);
          }
          // o vaso quebra onde parou (um pouco antes da parede)
          const qx = bateu ? a.x - a.dx * 12 : a.x;
          const qy = bateu ? a.y - a.dy * 12 : a.y;
          soltarAlgo(qx, qy);
          evento_('q', Math.round(qx), Math.round(qy));
        }
      };

      const estourarBombas = (t: number) => {
        for (let k = bombas.length - 1; k >= 0; k--) {
          const b = bombas[k];
          if (t - b.em < BOMBA.pavio) continue;
          bombas.splice(k, 1);
          evento_('e', Math.round(b.x), Math.round(b.y));
          // os bichos em volta
          for (const bi of bichos.values()) {
            if (bi.estado === 'morto' || bi.estado === 'sumido' || bi.hp <= 0 || Math.hypot(bi.x - b.x, bi.y - b.y) > BOMBA.raio + BICHOS[bi.tipo].raio) continue;
            if (couracaFechada(bi)) {
              evento_('tk', bi.id, 0, Math.round(bi.x), Math.round(bi.y));
              continue;
            }
            bi.hp = Math.max(0, bi.hp - BOMBA.dano);
            evento_('h', bi.id, 0, Math.round(bi.x), Math.round(bi.y));
            if (bi.hp <= 0) {
              bi.z = 0;
              mudar(bi, 'morto', 500);
              evento_('x', bi.id, Math.round(bi.x), Math.round(bi.y));
            } else if (!ehChefe(bi.tipo)) mudar(bi, 'atordoado', 1200);
          }
          // quem está perto também leva (com a folga de sempre)
          const { x, y } = b;
          pancadas.push({
            em: t,
            chave: `bomba:${b.id}`,
            dentro: (px, py) => Math.hypot(px - x, py - y) <= BOMBA.raio - 8,
            dano: 1,
            deX: x,
            deY: y,
          });
          // os vasos e as moitas em volta quebram
          for (const letra of ['V', 'M'] as const) {
            for (const [c, l] of casasDe(sala, letra)) {
              if (!aindaNaSala(c, l, letra)) continue;
              const [cx, cy] = centro(c, l);
              if (Math.hypot(cx - x, cy - y) <= BOMBA.raio + 16) quebrar(c, l);
            }
          }
          // a parede rachada
          for (const lado of LADOS) {
            const porta_ = sala.portas[lado];
            if (porta_?.trava !== 'rachada' || rachadas.has(`${sala.id}:${lado}`)) continue;
            const [px, py] = centro(...PORTA[lado]);
            if (Math.hypot(px - x, py - y) > BOMBA.raio + 24) continue;
            rachadas.add(`${sala.id}:${lado}`);
            evento_('a', 'rachada');
          }
        }
      };

      /** O gancho: o servidor acha o poste na linha e puxa o coelho até a casa antes dele. */
      const gancho = (j: Jogador, d: Record<string, unknown>): string | null => {
        if (!temGancho) return 'sem gancho';
        if (!numero(d.dir) || d.dir < 0 || d.dir > 3) return 'direção';
        const t = agora();
        const dir = Math.floor(d.dir);
        // O GOLEM-REI (21/11/2026): o gancho que pega nele (pelo passado dele, como o golpe) o deixa atordoado, sem a couraça
        const m = mundo();
        for (const b of bichos.values()) {
          if (b.tipo !== 'golem-rei' || b.estado === 'morto' || b.estado === 'atordoado' || b.hp <= 0 || t < b.ganchoAte || b.estado === 'entrando') continue;
          const r = BICHOS[b.tipo].raio;
          const h = b.historia.find((h) => h.t >= t - HISTORIA_MS && ganchoPega(sala, m, j.x, j.y, dir, h.x, h.y, r, FOLGA_ACERTO));
          if (!h) continue;
          j.dir = dir;
          mudar(b, 'atordoado', GOLEM.atordoado);
          b.ganchoAte = t + GOLEM.atordoado + GOLEM.imune;
          j.pontos += PONTOS.acerto;
          evento_('gb', j.userId, Math.round(b.x), Math.round(b.y));
          return null;
        }
        const alvo = alvoDoGancho(sala, m, j.x, j.y, dir);
        if (!alvo) return 'sem poste';
        j.dir = dir;
        [j.x, j.y] = alvo.para;
        j.historia = [];
        j.livreAte = t + 600;
        j.carrega = false;
        j.tp++;
        const [px, py] = centro(alvo.poste[0], alvo.poste[1]);
        evento_('gh', j.userId, Math.round(px), Math.round(py));
        return null;
      };

      /**
       * O REGADOR (a fornalha, 24/11/2026): quem rega diz só a direção, e o servidor faz a conta da linha (a mesma do site): o
       * dragão na linha (pelo passado dele, como o gancho no golem) fica molhado, sem o fogo; senão, o primeiro fogo aceso da linha
       * se apaga (o do chão para sempre; o braseiro por BRASEIRO.volta ms, e todos apagados juntos resolvem o enigma).
       */
      const regar = (j: Jogador, d: Record<string, unknown>): string | null => {
        if (!temRegador) return 'sem regador';
        if (!numero(d.dir) || d.dir < 0 || d.dir > 3) return 'direção';
        const t = agora();
        if (t - j.ultimoJato < REGADOR.recarga - 150) return 'cedo';
        const dir = Math.floor(d.dir);
        j.ultimoJato = t;
        j.dir = dir;
        const m = mundo();
        const [fx, fy] = fimDoJato(sala, m, j.x, j.y, dir);
        evento_('ag', j.userId, Math.round(fx), Math.round(fy));
        for (const b of bichos.values()) {
          if (b.tipo !== 'dragao' || b.estado === 'morto' || b.estado === 'atordoado' || b.estado === 'entrando' || b.hp <= 0 || t < b.ganchoAte) continue;
          const r = BICHOS[b.tipo].raio;
          if (!b.historia.some((h) => h.t >= t - HISTORIA_MS && jatoPega(sala, m, j.x, j.y, dir, h.x, h.y, r, FOLGA_ACERTO))) continue;
          mudar(b, 'atordoado', DRAGAO.molhado);
          b.ganchoAte = t + DRAGAO.molhado + DRAGAO.imune;
          j.pontos += PONTOS.acerto;
          evento_('gd', j.userId, Math.round(b.x), Math.round(b.y));
          return null;
        }
        const alvo = alvoDoRegador(sala, m, j.x, j.y, dir);
        if (!alvo) return 'sem fogo';
        const [c, l] = alvo;
        const [cx, cy] = centro(c, l);
        evento_('ap', Math.round(cx), Math.round(cy));
        if (sala.grade[l][c] === 'F') {
          apagadosAqui().add(`${c},${l}`);
          j.pontos += 2;
          return null;
        }
        // o braseiro: todos apagados ao mesmo tempo resolvem o enigma (e os que regaram ganham os pontos)
        braseiros.set(`${c},${l}`, t);
        const todos = casasDe(sala, 'A');
        if (todos.every(([bc, bl]) => braseiros.has(`${bc},${bl}`))) {
          resolvidas.add(sala.id);
          for (const o of emPe()) o.pontos += PONTOS.placas;
          evento_('a', 'braseiros');
        }
        return null;
      };

      entrarNa(daMasmorra.inicio, null);
      // o começo: na entrada, ninguém vem de porta nenhuma (a chegada é a do sul)
      relogio = intervalo(tick, PASSO_MS);

      return {
        publico() {
          return {
            fase,
            sala: sala.id,
            venceu: fase === 'vitoria' || (fase === 'fim' && venceu),
            jogadores: [...jogadores.values()].map((j) => ({
              userId: j.userId,
              username: ctx.nome(j.userId),
              avatar: j.avatar,
              pontos: j.pontos,
            })),
            resultado: fase === 'fim' ? resultado : null,
            masmorra: qual,
            heroico,
            // o "Jogar de novo" do painel manda a categoria de volta: a mesma masmorra (e o heroico)
            categoria,
            // OS ACHADOS (21/11/2026): [quantos a turma achou, quantos há] dos baús e dos segredos desta masmorra
            achados: {
              baus: [bausAbertos.size, totalDeAchados.baus],
              segredos: [rachadas.size + (coracaoGrande ? 1 : 0), totalDeAchados.segredos],
            },
            recorde: solo
              ? {
                  tempoMs: tempoDaVitoria,
                  antes: recordeAntes,
                  novo: recordeNovo,
                }
              : null,
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
          else if (d.tipo === 'levantar') ultimoMotivo = levantar(j, d);
          else if (d.tipo === 'jogar') ultimoMotivo = jogar(j);
          else if (d.tipo === 'cortar') ultimoMotivo = cortar(j, d);
          else if (d.tipo === 'bomba') ultimoMotivo = soltarBomba(j);
          else if (d.tipo === 'gancho') ultimoMotivo = gancho(j, d);
          else if (d.tipo === 'regar') ultimoMotivo = regar(j, d);
          return null;
        },
        conferir() {
          if (fase === 'fim') parar();
        },
        parar,
        // para o teste
        ...({
          _passo: tick,
          _bichos: bichos,
          _jogadores: jogadores,
          _motivo: () => ultimoMotivo,
          _sala: () => sala.id,
          _entrar: (destino: number, lado: Lado | null) => entrarNa(destino, lado),
          _sementes: () => sementes,
          _coracoes: coracoes,
          _sementesNoChao: sementesNoChao,
          _darRegador: () => {
            temRegador = true;
          },
          _darGancho: () => {
            temGancho = true;
          },
        } as object),
      };
    },
  };
}
