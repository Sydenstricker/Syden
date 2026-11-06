import { atingir, novoKart, PASSO, passo, type Comandos, type Kart } from '../corrida/fisica';
import { rivalEm, type Rival } from '../corrida/laco';
import { largadaDa, type ArenaPintada } from './arena';
import { comandoDoRobo, novaMemoria, type MemoriaDoRobo } from './robo';
import {
  BALOES,
  BATIDA_DE_NOVO,
  caminhoDoRepolho,
  DURACAO_PASSOS,
  INVULNERAVEL,
  itemDaCaixa,
  lamaPegou,
  naParede,
  PASSOS_POR_SEGUNDO,
  quemPerde,
  RAIO_DA_BATIDA,
  RAIO_DA_CAIXA,
  repolhoPegou,
  VIDA_DA_ALFACE,
  VOLTA_DA_CAIXA,
  type ItemDoBalao,
} from './sim';

/**
 * A PARTIDA DO ESTOURA-BALÃO, PASSO A PASSO, SEM TELA (05/11/2026): os karts que andam neste computador (o meu e, no Solo,
 * os coelhos do computador), as caixas, os itens e os estouros. O laço (laco.ts) chama `passo()` no ritmo do relógio e
 * desenha; os testes chamam `passo()` direto, sem navegador.
 *
 * Quem decide se foi atingido é quem leva: o meu kart confere os itens contra ele mesmo. NA SALA, isso é a previsão (o balão
 * some na hora, o "acertou" vai ao servidor, e a verdade dele chega pelo evento "estourou"); NO SOLO, a decisão é daqui,
 * para todo mundo, com a mesma regra do servidor (2 s sem perder outro balão, o escudo segura um item).
 */

/**
 * O RODOPIO de quem perde um balão (06/11/2026, pedido dele: "reforçar o fracasso"): a rodada da corrida (atingir: 1 s sem
 * direção nem acelerador, uma volta) e mais uma volta por cima, só aqui; a câmera fica parada enquanto isso (laco.ts), e o
 * kart gira na frente dela.
 */
const RODOPIO_A_MAIS = 2 * Math.PI;

export type EventoDoBalao =
  | { tipo: 'repolho'; id: string; dono: number; n: number; x: number; y: number; dx: number; dy: number }
  | { tipo: 'lama'; id: string; dono: number; n: number; x: number; y: number }
  | { tipo: 'cenoura' | 'alface'; id: string; dono: number; n: number }
  /** Um balão estourou (o servidor diz; no Solo, a partida daqui). `baloes` é quantos sobraram. */
  | { tipo: 'estourou'; alvo: number; id: string; dono: number; baloes: number; n: number }
  /** O escudo de alface `escudo` segurou o item `id`. */
  | { tipo: 'segurou'; alvo: number; id: string; escudo: string };

export const TIPOS_DO_BALAO = ['repolho', 'lama', 'cenoura', 'alface', 'estourou', 'segurou'] as const;

export interface Participante {
  id: number;
  nome: string;
  avatar: number | null;
  /** O lugar na largada (e a cor dos balões). */
  largada: number;
}

export interface KartLocal {
  id: number;
  kart: Kart;
  caixaVolta: number[];
  caixas: number;
  naMao: ItemDoBalao | null;
  usavaAntes: boolean;
  ultimoEstouro: number;
  escudo: { id: string; n: number } | null;
  memoria: MemoriaDoRobo | null;
  /** Os itens que já pegaram este kart, pela conta daqui (para não avisar duas vezes). */
  levados: Set<string>;
  /**
   * Na sala: os balões que eu já sei que perdi e o servidor ainda não confirmou (o item e o passo). Sem resposta em 3 s, a
   * previsão cai: o servidor não aceitou, e a tela volta à verdade dele.
   */
  previstos: Map<string, number>;
  estouros: number;
}

export interface ResultadoDoSolo {
  posicao: number;
  total: number;
  baloes: number;
  estouros: number;
  passos: number;
}

export interface OpcoesDaPartida {
  arena: ArenaPintada;
  /** O que o teclado e o toque apertam (o meu kart). */
  comandos: Comandos;
  eu: number;
  /** Eu tenho kart (quem assiste não tem). */
  piloto: boolean;
  /** O meu kart anda pelo cérebro dos robôs (o piloto automático dos testes). */
  autopiloto?: () => boolean;
  participantes: Participante[];
  /** Os ids que andam AQUI, pelo cérebro do robô (o Solo). */
  robos?: number[];
  semente: number;
  /** Quantos balões cada um tem, pela verdade (o servidor; no Solo, a partida escreve aqui). */
  baloes: Map<number, number>;
  /** As posições dos outros da sala. */
  rivais: Map<number, Rival>;
  /** Todos os eventos de item: a partida lê, quem recebe do socket acrescenta. */
  eventos: EventoDoBalao[];
  /** Na sala: mandar ao servidor (as posições, as caixas, os itens e o "acertou"). Sem ele, é o Solo. */
  enviar?: (dados: Record<string, unknown>) => void;
  aoItem?: (item: ItemDoBalao | null) => void;
  aoBaloes?: (b: Map<number, number>) => void;
  /** O meu kart bateu ou foi atingido (a tela treme). */
  aoTremor?: (quanto: number) => void;
  /** Um balão estourou (para o desenho), com o lugar. */
  aoEstouro?: (alvo: number, x: number, y: number) => void;
  /** Só no Solo: a partida acabou aqui. */
  aoFim?: (r: ResultadoDoSolo) => void;
}

export function criarPartida(o: OpcoesDaPartida) {
  const p = o.arena;
  const arena = p.arena;
  const solo = !o.enviar;
  const locais: KartLocal[] = [];
  const criar = (id: number, robo: boolean) => {
    const q = o.participantes.find((x) => x.id === id);
    const k = novoKart(p);
    const l = largadaDa(arena, q?.largada ?? 0);
    Object.assign(k, { x: l.x, y: l.y, angulo: l.angulo, rumo: l.angulo });
    locais.push({
      id,
      kart: k,
      caixaVolta: arena.caixas.map(() => 0),
      caixas: 0,
      naMao: null,
      usavaAntes: false,
      ultimoEstouro: -Infinity,
      escudo: null,
      memoria: robo ? novaMemoria(((Math.abs(id) * 37) % 10) / 10) : null,
      levados: new Set(),
      previstos: new Map(),
      estouros: 0,
    });
  };
  if (o.piloto) criar(o.eu, false);
  for (const id of o.robos ?? []) criar(id, true);
  const meu = o.piloto ? locais[0] : null;

  let n = 0;
  let acabou = false;
  let ultimoMandado = -1;
  const caminhos = new Map<string, number[]>();
  const gastos = new Set<string>();
  const escudosGastos = new Set<string>();
  let lidos = 0;

  const local = (id: number) => locais.find((k) => k.id === id);
  /** Onde alguém está no passo `m`: o kart daqui, ou o rival pelo que chegou. */
  const posicaoDe = (id: number, m: number): { x: number; y: number; a: number } | null => {
    const l = local(id);
    if (l) return { x: l.kart.x, y: l.kart.y, a: l.kart.angulo };
    const r = o.rivais.get(id);
    const pos = r ? rivalEm(r.posicoes, m) : null;
    return pos ? { x: pos.x, y: pos.y, a: pos.a } : null;
  };
  const baloesDe = (id: number) => {
    const l = local(id);
    return Math.max(0, (o.baloes.get(id) ?? BALOES) - (l ? l.previstos.size : 0));
  };
  const temBalao = (id: number) => baloesDe(id) > 0;
  const escudoAtivo = (id: number, m: number) =>
    o.eventos.some((e) => e.tipo === 'alface' && e.dono === id && m >= e.n && m - e.n < VIDA_DA_ALFACE && !escudosGastos.has(e.id));
  const avisarBaloes = () => o.aoBaloes?.(new Map(o.participantes.map((q) => [q.id, baloesDe(q.id)])));

  /** O que os eventos dizem: o caminho de cada repolho, os itens gastos, os escudos e os balões. */
  const lerEventos = () => {
    for (; lidos < o.eventos.length; lidos++) {
      const e = o.eventos[lidos];
      if (e.tipo === 'repolho') {
        const c = caminhoDoRepolho(arena, e);
        if (c) caminhos.set(e.id, c);
        continue;
      }
      if (e.tipo !== 'estourou' && e.tipo !== 'segurou') continue;
      gastos.add(e.id);
      const l = local(e.alvo);
      if (e.tipo === 'segurou') {
        escudosGastos.add(e.escudo);
        if (l && l.escudo?.id === e.escudo) l.escudo = null;
        l?.previstos.delete(e.id);
      } else {
        o.baloes.set(e.alvo, e.baloes);
        const onde = posicaoDe(e.alvo, n);
        if (onde) o.aoEstouro?.(e.alvo, onde.x, onde.y);
        // na sala, o estouro que eu não tinha visto (o servidor viu pelo meu caminho): a tela se acerta
        if (l && !solo) {
          // a batida que eu previ pode chegar com outro passo (o servidor a viu antes do meu aviso): é a mesma
          const prevista = l.previstos.has(e.id) ? e.id : e.id.startsWith('batida-') ? [...l.previstos.keys()].find((id) => id.startsWith(`batida-${e.dono}-`)) : undefined;
          if (prevista) l.previstos.delete(prevista);
          else {
            atingir(l.kart);
            l.ultimoEstouro = e.n;
            if (l === meu) o.aoTremor?.(8);
          }
        }
      }
      avisarBaloes();
    }
  };

  const mandar = (dados: Record<string, unknown>) => o.enviar?.(dados);
  /** A minha posição neste passo (antes de uma caixa, de um item ou de um "acertou": o servidor confere contra ela). */
  const mandarPosicao = (l: KartLocal) => {
    if (!o.enviar || l !== meu || ultimoMandado === n) return;
    ultimoMandado = n;
    mandar({ n, x: +l.kart.x.toFixed(1), y: +l.kart.y.toFixed(1), a: +l.kart.angulo.toFixed(3) });
  };

  /** NO SOLO, a partida decide o estouro como o servidor decide na sala (a mesma regra). */
  const acertarAqui = (l: KartLocal, id: string, dono: number, m: number) => {
    if (m < l.ultimoEstouro + INVULNERAVEL) return;
    if (l.escudo && m >= l.escudo.n && m < l.escudo.n + VIDA_DA_ALFACE) {
      o.eventos.push({ tipo: 'segurou', alvo: l.id, id, escudo: l.escudo.id });
      l.escudo = null;
      return;
    }
    const sobra = Math.max(0, (o.baloes.get(l.id) ?? BALOES) - 1);
    l.ultimoEstouro = m;
    atingir(l.kart);
    if (l === meu) o.aoTremor?.(8);
    const quem = local(dono);
    if (quem) quem.estouros++;
    o.eventos.push({ tipo: 'estourou', alvo: l.id, id, dono, baloes: sobra, n: m });
  };

  const andarKart = (l: KartLocal) => {
    const k = l.kart;
    if (!temBalao(l.id)) return;
    const auto = l === meu && (o.autopiloto?.() ?? false);
    let c: Comandos;
    if (l.memoria || auto) {
      if (!l.memoria) l.memoria = novaMemoria(0.6);
      const rivais: { x: number; y: number }[] = [];
      for (const q of o.participantes) {
        if (q.id === l.id || !temBalao(q.id)) continue;
        const pos = posicaoDe(q.id, n);
        if (pos) rivais.push(pos);
      }
      const caixas = arena.caixas.filter((_, i) => l.caixaVolta[i] <= n).map(([x, y]) => ({ x, y }));
      c = comandoDoRobo(k, { arena, item: l.naMao, rivais, caixas }, l.memoria);
    } else c = o.comandos;
    if (acabou || n > DURACAO_PASSOS) c = { acelera: false, freia: false, vira: 0, derrapa: false };
    passo(k, c, p);
    if (k.rodando > 0) k.angulo += RODOPIO_A_MAIS * PASSO;
    if (l === meu && k.bateu) o.aoTremor?.(6);

    // A CAIXA: passando perto, com a mão vazia; o item é o do sorteio que o servidor também faz
    if (l.naMao === null) {
      for (let i = 0; i < arena.caixas.length; i++) {
        const [cx, cy] = arena.caixas[i];
        if (l.caixaVolta[i] > n || Math.hypot(cx - k.x, cy - k.y) >= RAIO_DA_CAIXA) continue;
        l.caixaVolta[i] = n + VOLTA_DA_CAIXA;
        l.naMao = itemDaCaixa(o.semente, l.id, l.caixas);
        l.caixas++;
        if (l === meu) {
          mandarPosicao(l);
          mandar({ tipo: 'caixa', i, n });
          o.aoItem?.(l.naMao);
        }
        break;
      }
    }

    // USAR (na hora em que a tecla desce)
    const usa = c.usa === true;
    if (usa && !l.usavaAntes && l.naMao !== null && k.rodando === 0) {
      const id = `${l.id}-${n}`;
      const fx = Math.cos(k.angulo), fy = Math.sin(k.angulo);
      let e: EventoDoBalao;
      if (l.naMao === 'repolho') {
        // sai na frente do kart (ou do próprio kart, se a frente for parede)
        let x = k.x + fx * 14, y = k.y + fy * 14;
        if (naParede(arena, x, y, -5)) {
          x = k.x;
          y = k.y;
        }
        e = { tipo: 'repolho', id, dono: l.id, n, x: +x.toFixed(1), y: +y.toFixed(1), dx: +fx.toFixed(4), dy: +fy.toFixed(4) };
      } else if (l.naMao === 'lama') {
        let x = k.x - fx * 12, y = k.y - fy * 12;
        if (naParede(arena, x, y, -3)) {
          x = k.x;
          y = k.y;
        }
        e = { tipo: 'lama', id, dono: l.id, n, x: +x.toFixed(1), y: +y.toFixed(1) };
      } else {
        if (l.naMao === 'cenoura') k.turbo = Math.max(k.turbo, 1.1);
        else l.escudo = { id, n };
        e = { tipo: l.naMao, id, dono: l.id, n };
      }
      o.eventos.push(e);
      if (l === meu) {
        mandarPosicao(l);
        const { id: _id, dono: _dono, ...corpo } = e as EventoDoBalao & { id: string; dono: number };
        mandar(corpo);
      }
      l.naMao = null;
      if (l === meu) o.aoItem?.(null);
    }
    l.usavaAntes = usa;
    if (l.escudo && n >= l.escudo.n + VIDA_DA_ALFACE) l.escudo = null;

    if (!solo && l === meu) baterNaSala(l);

    // FUI ATINGIDO? (quem decide é quem leva; na sala, o servidor confere)
    if (n < l.ultimoEstouro + INVULNERAVEL) return;
    lerEventos();
    for (const e of o.eventos) {
      if ((e.tipo !== 'repolho' && e.tipo !== 'lama') || e.dono === l.id || gastos.has(e.id) || l.levados.has(e.id)) continue;
      const c = e.tipo === 'repolho' ? caminhos.get(e.id) : undefined;
      const pegou = e.tipo === 'repolho' ? !!c && repolhoPegou(c, e.n, n, k.x, k.y) : lamaPegou(e.x, e.y, e.n, n, k.x, k.y);
      if (!pegou) continue;
      l.levados.add(e.id);
      if (solo) {
        acertarAqui(l, e.id, e.dono, n);
        lerEventos();
      } else {
        // a previsão: o escudo segura, ou o balão estoura; o servidor confirma (ou corrige)
        mandarPosicao(l);
        mandar({ tipo: 'acertou', id: e.id, n });
        gastos.add(e.id);
        preverEstouro(l, e.id);
      }
      break;
    }
  };

  /** NA SALA, a previsão do que eu levei (o item ou a batida): o escudo segura, ou o balão estoura; o servidor confirma (ou corrige). */
  const preverEstouro = (l: KartLocal, id: string) => {
    if (l.escudo && n < l.escudo.n + VIDA_DA_ALFACE) {
      escudosGastos.add(l.escudo.id);
      l.escudo = null;
    } else {
      l.previstos.set(id, n);
      l.ultimoEstouro = n;
      atingir(l.kart);
      if (l === meu) o.aoTremor?.(8);
      const onde = posicaoDe(l.id, n);
      if (onde) o.aoEstouro?.(l.id, onde.x, onde.y);
    }
    avisarBaloes();
  };

  /** As batidas que já valeram, por par (o mesmo par só bate de novo depois de BATIDA_DE_NOVO). */
  const batidas = new Map<string, number>();
  const parDe = (a: number, b: number) => (a < b ? `${a}:${b}` : `${b}:${a}`);
  const batidaLivre = (a: number, b: number) => n >= (batidas.get(parDe(a, b)) ?? -Infinity) + BATIDA_DE_NOVO;

  /**
   * NA SALA, A BATIDA QUE EU LEVO (quem leva é quem diz): um kart dos outros, rápido, encostou no meu, que não estava. A
   * velocidade dele sai das posições que chegaram (os últimos 4 passos); o aviso vai ao servidor, que confere pelas dele.
   */
  const baterNaSala = (l: KartLocal) => {
    if (n < l.ultimoEstouro + INVULNERAVEL) return;
    const k = l.kart;
    for (const q of o.participantes) {
      if (q.id === l.id || !temBalao(q.id) || !batidaLivre(l.id, q.id)) continue;
      const r = o.rivais.get(q.id);
      const ali = r ? rivalEm(r.posicoes, n) : null;
      const antes = r ? rivalEm(r.posicoes, n - 4) : null;
      if (!ali || !antes || Math.hypot(ali.x - k.x, ali.y - k.y) >= RAIO_DA_BATIDA) continue;
      const v = (Math.hypot(ali.x - antes.x, ali.y - antes.y) * PASSOS_POR_SEGUNDO) / 4;
      if (quemPerde(Math.abs(k.v), v) !== 'a') continue;
      batidas.set(parDe(l.id, q.id), n);
      mandarPosicao(l);
      mandar({ tipo: 'batida', de: q.id, n });
      preverEstouro(l, `batida-${q.id}-${l.id}-${n}`);
      return;
    }
  };

  /** NO SOLO, as batidas entre os karts daqui (todos andam aqui), com a regra do servidor. */
  const baterNoSolo = () => {
    for (let i = 0; i < locais.length; i++) {
      for (let j = i + 1; j < locais.length; j++) {
        const A = locais[i], B = locais[j];
        if (!temBalao(A.id) || !temBalao(B.id) || !batidaLivre(A.id, B.id)) continue;
        if (Math.hypot(A.kart.x - B.kart.x, A.kart.y - B.kart.y) >= RAIO_DA_BATIDA) continue;
        const perde = quemPerde(Math.abs(A.kart.v), Math.abs(B.kart.v));
        if (!perde) continue;
        const [vitima, atacante] = perde === 'a' ? [A, B] : [B, A];
        if (n < vitima.ultimoEstouro + INVULNERAVEL) continue;
        batidas.set(parDe(A.id, B.id), n);
        acertarAqui(vitima, `batida-${atacante.id}-${vitima.id}-${n}`, atacante.id, n);
        lerEventos();
      }
    }
  };

  /** O Solo acaba quando eu fico sem balão, quando os robôs ficam, ou quando o tempo acaba. */
  const conferirFimDoSolo = () => {
    if (acabou || !meu || !o.aoFim) return;
    const vivos = o.participantes.filter((q) => temBalao(q.id));
    const euVivo = temBalao(meu.id);
    if (euVivo && vivos.length > 1 && n < DURACAO_PASSOS) return;
    acabou = true;
    const sobra = baloesDe(meu.id);
    // quem tem balão fica na frente de quem saiu; entre os que têm, mais balões, e depois mais estouros
    const naFrente = euVivo
      ? (o.robos ?? []).filter((id) => baloesDe(id) > sobra || (baloesDe(id) === sobra && (local(id)?.estouros ?? 0) > meu.estouros)).length
      : vivos.length;
    o.aoFim({ posicao: 1 + naFrente, total: o.participantes.length, baloes: sobra, estouros: meu.estouros, passos: Math.min(n, DURACAO_PASSOS) });
  };

  return {
    locais,
    meu,
    gastos,
    caminhos,
    posicaoDe,
    baloesDe,
    temBalao,
    escudoAtivo,
    lerEventos,
    get n() {
      return n;
    },
    get acabou() {
      return acabou;
    },
    /** Um passo de 1/60 s. */
    passo() {
      n++;
      lerEventos();
      for (const l of locais) andarKart(l);
      if (solo) baterNoSolo();
      if (meu && temBalao(meu.id) && n % 4 === 0) mandarPosicao(meu);
      for (const l of locais) {
        for (const [id, m] of l.previstos) {
          if (n - m <= 180) continue;
          l.previstos.delete(id);
          avisarBaloes();
        }
      }
      if (solo) conferirFimDoSolo();
    },
    avisarBaloes,
  };
}

export type Partida = ReturnType<typeof criarPartida>;
