import { comandoDoRobo, novaMemoria, type ComandosDoDuelo, type MemoriaDoRobo, type VistaDoRobo } from './robo';
import {
  caminhoDoMissil,
  CARGA,
  DURACAO_PASSOS,
  ervilhaNoPasso,
  INVULNERAVEL,
  largada,
  noCaminho,
  PASSOS_POR_AMOSTRA,
  PASSOS_POR_SEGUNDO,
  protegido,
  RAIO_DA_ERVILHA,
  RAIO_DO_MISSIL,
  RECARGA_DA_ERVILHA,
  SEM_TIRO,
  tresCasas,
  umaCasa,
  VIDA_DO_MISSIL,
  VIDAS,
  voar,
  type Aviao,
  type Missil,
  type Tiro,
} from './sim';

/**
 * A PARTIDA DO DUELO DE AVIÕEZINHOS, PASSO A PASSO, SEM TELA (05/11/2026): os aviões que voam neste computador (o meu e, no
 * Solo, os do computador), os tiros e os acertos. A tela (JogoAvioes.tsx) chama `passo()` no ritmo do relógio e desenha; os
 * testes chamam `passo()` direto, sem navegador.
 *
 * Quem decide se foi atingido é quem leva: o meu avião confere os tiros contra ele mesmo. NA SALA, isso é a previsão (a vida
 * some na hora, o "acertou" vai ao servidor, e a verdade dele chega pelo evento "acerto"); NO SOLO, a decisão é daqui, para
 * todo mundo, com a mesma regra do servidor (1,5 s sem levar outro, a curva fechada na cerca protege).
 *
 * AS AMOSTRAS: a cada 4 passos, cada avião daqui guarda a posição arredondada (e o meu a manda). A cenoura teleguiada se guia
 * só por elas, por isso o caminho dela aqui é o mesmo do servidor; as dos outros chegam pelo socket e moram no mesmo mapa.
 */

export type EventoDoDuelo =
  | { tipo: 'ervilha'; id: string; dono: number; n: number; x: number; y: number; dx: number; dy: number }
  | { tipo: 'missil'; id: string; dono: number; n: number; x: number; y: number; dx: number; dy: number; alvo: number }
  /** Um acerto (o servidor diz; no Solo, a partida daqui). `vidas` é quantas sobraram. */
  | { tipo: 'acerto'; alvo: number; id: string; dono: number; vidas: number; n: number };

export const TIPOS_DO_DUELO = ['ervilha', 'missil', 'acerto'] as const;

export interface Participante {
  id: number;
  nome: string;
  avatar: number | null;
  /** O lugar na largada (e a cor das asas). */
  largada: number;
}

export interface AviaoLocal {
  id: number;
  aviao: Aviao;
  fogoAntes: boolean;
  /** Há quantos passos o tiro está apertado (a carga da cenoura). */
  segurando: number;
  ultimaErvilha: number;
  missil: string | null;
  ultimoAcerto: number;
  memoria: MemoriaDoRobo | null;
  /** Os tiros que já pegaram este avião, pela conta daqui (para não avisar duas vezes). */
  levados: Set<string>;
  /** Na sala: os acertos que eu já sei que levei e o servidor ainda não confirmou (o tiro e o passo). */
  previstos: Map<string, number>;
  acertos: number;
  bateu: boolean;
}

export interface ResultadoDoSolo {
  posicao: number;
  total: number;
  vidas: number;
  acertos: number;
  passos: number;
}

export interface OpcoesDaPartida {
  /** O que o teclado e o toque apertam (o meu avião). */
  comandos: ComandosDoDuelo;
  eu: number;
  /** Eu tenho avião (quem assiste não tem). */
  piloto: boolean;
  /** O meu avião voa pelo cérebro do computador (o piloto automático dos testes). */
  autopiloto?: () => boolean;
  participantes: Participante[];
  /** Os ids que voam AQUI, pelo cérebro do computador (o Solo). */
  robos?: number[];
  /** Quantas vidas cada um tem, pela verdade (o servidor; no Solo, a partida escreve aqui). */
  vidas: Map<number, number>;
  /** As amostras de todos (n, x, y, hx, hy, ...): as dos daqui a partida escreve, as dos outros chegam pelo socket. */
  amostras: Map<number, number[]>;
  /** Todos os eventos: a partida lê, quem recebe do socket acrescenta. */
  eventos: EventoDoDuelo[];
  /** Na sala: mandar ao servidor (as posições, os tiros e o "acertou"). Sem ele, é o Solo. */
  enviar?: (dados: Record<string, unknown>) => void;
  aoVidas?: (v: Map<number, number>) => void;
  /** Um acerto (para o desenho e o som), com o lugar. */
  aoAcerto?: (alvo: number, x: number, y: number, caiu: boolean) => void;
  /** Saiu um tiro meu (para o som). */
  aoTiro?: (tipo: 'ervilha' | 'missil') => void;
  /** Só no Solo: a partida acabou aqui. */
  aoFim?: (r: ResultadoDoSolo) => void;
}

export interface TiroNoAr {
  id: string;
  tipo: 'ervilha' | 'missil';
  dono: number;
  tiro: Tiro | Missil;
}

const PARADO: ComandosDoDuelo = { acelera: false, freia: false, vira: 0, fogo: false };

export function criarPartida(o: OpcoesDaPartida) {
  const solo = !o.enviar;
  const locais: AviaoLocal[] = [];
  const criar = (id: number, robo: boolean) => {
    const q = o.participantes.find((x) => x.id === id);
    locais.push({
      id,
      aviao: largada(q?.largada ?? 0),
      fogoAntes: false,
      segurando: 0,
      ultimaErvilha: -Infinity,
      missil: null,
      ultimoAcerto: -Infinity,
      memoria: robo ? novaMemoria(0.3 + ((Math.abs(id) * 37) % 10) / 28, Math.abs(id) * 101) : null,
      levados: new Set(),
      previstos: new Map(),
      acertos: 0,
      bateu: false,
    });
    if (!o.amostras.has(id)) o.amostras.set(id, []);
  };
  if (o.piloto) criar(o.eu, false);
  for (const id of o.robos ?? []) criar(id, true);
  const meu = o.piloto ? locais[0] : null;

  let n = 0;
  let acabou = false;
  let saidas = 0;
  const saiuNa = new Map<number, number>();
  const tiros = new Map<string, TiroNoAr>();
  const gastos = new Set<string>();
  let lidos = 0;
  /** O caminho de cada cenoura até o passo de agora (refeito a cada passo: as amostras do alvo podem ter chegado). */
  let caminhos = new Map<string, number[]>();

  const local = (id: number) => locais.find((k) => k.id === id);
  const amostrasDe = (id: number) => {
    let a = o.amostras.get(id);
    if (!a) o.amostras.set(id, (a = []));
    return a;
  };

  /** Onde alguém está no passo `m`: o avião daqui, ou o dos outros pelas amostras (entre duas, a reta; depois da última, adiante). */
  const posicaoDe = (id: number, m: number): Aviao | null => {
    const l = local(id);
    if (l) return l.aviao;
    const a = o.amostras.get(id);
    if (!a || !a.length) {
      const q = o.participantes.find((x) => x.id === id);
      return q ? largada(q.largada) : null;
    }
    const k = a.length - 5;
    if (m >= a[k]) {
      // adiante da última, na direção dela, pela velocidade entre as duas últimas (até 20 passos)
      let v = 85;
      if (k >= 5) v = (Math.hypot(a[k + 1] - a[k - 4], a[k + 2] - a[k - 3]) / Math.max(1, a[k] - a[k - 5])) * PASSOS_POR_SEGUNDO;
      const t = Math.min(20, m - a[k]) / PASSOS_POR_SEGUNDO;
      return { x: a[k + 1] + a[k + 3] * v * t, y: a[k + 2] + a[k + 4] * v * t, hx: a[k + 3], hy: a[k + 4], v };
    }
    for (let b = k; b >= 5; b -= 5) {
      if (a[b - 5] <= m) {
        const u = (m - a[b - 5]) / Math.max(1, a[b] - a[b - 5]);
        const hx = a[b - 2] + (a[b + 3] - a[b - 2]) * u, hy = a[b - 1] + (a[b + 4] - a[b - 1]) * u, h = Math.hypot(hx, hy) || 1;
        return { x: a[b - 4] + (a[b + 1] - a[b - 4]) * u, y: a[b - 3] + (a[b + 2] - a[b - 3]) * u, hx: hx / h, hy: hy / h, v: 85 };
      }
    }
    return { x: a[1], y: a[2], hx: a[3], hy: a[4], v: 85 };
  };
  const vidasDe = (id: number) => {
    const l = local(id);
    return Math.max(0, (o.vidas.get(id) ?? VIDAS) - (l ? l.previstos.size : 0));
  };
  const voando = (id: number) => vidasDe(id) > 0;
  const avisarVidas = () => o.aoVidas?.(new Map(o.participantes.map((q) => [q.id, vidasDe(q.id)])));

  /** O que os eventos dizem: os tiros no ar, os gastos e as vidas. */
  const lerEventos = () => {
    for (; lidos < o.eventos.length; lidos++) {
      const e = o.eventos[lidos];
      if (e.tipo === 'ervilha') {
        tiros.set(e.id, { id: e.id, tipo: 'ervilha', dono: e.dono, tiro: { n: e.n, x: e.x, y: e.y, dx: e.dx, dy: e.dy } });
        continue;
      }
      if (e.tipo === 'missil') {
        tiros.set(e.id, { id: e.id, tipo: 'missil', dono: e.dono, tiro: { n: e.n, x: e.x, y: e.y, dx: e.dx, dy: e.dy, alvo: e.alvo } });
        continue;
      }
      gastos.add(e.id);
      const antes = o.vidas.get(e.alvo) ?? VIDAS;
      o.vidas.set(e.alvo, Math.min(antes, e.vidas));
      if (e.vidas <= 0 && !saiuNa.has(e.alvo)) saiuNa.set(e.alvo, ++saidas);
      const dono = local(e.dono);
      if (dono && dono.missil === e.id) dono.missil = null;
      const l = local(e.alvo);
      let mostrar = true;
      if (l && !solo) {
        if (l.previstos.has(e.id)) {
          // já mostrado na previsão
          l.previstos.delete(e.id);
          mostrar = false;
        } else {
          // o acerto que eu não tinha visto (o servidor viu pelo meu caminho): a tela se acerta
          l.ultimoAcerto = e.n;
          l.levados.add(e.id);
        }
      }
      const onde = mostrar ? posicaoDe(e.alvo, n) : null;
      if (onde) o.aoAcerto?.(e.alvo, onde.x, onde.y, e.vidas <= 0);
      avisarVidas();
    }
  };

  /** Onde está o tiro no passo de agora (null se já não está no ar). */
  const ondeEsta = (t: TiroNoAr): [number, number] | null => {
    if (gastos.has(t.id)) return null;
    if (t.tipo === 'ervilha') return ervilhaNoPasso(t.tiro, n);
    const c = caminhos.get(t.id);
    return c ? noCaminho(c, t.tiro.n, n) : null;
  };

  /** A minha cenoura (ou a de um avião daqui) ainda está no ar? A mesma regra do servidor, com as amostras que chegaram. */
  const missilNoAr = (l: AviaoLocal) => {
    const id = l.missil;
    if (!id || gastos.has(id)) return false;
    const t = tiros.get(id);
    if (!t || t.tipo !== 'missil') return false;
    const m = t.tiro as Missil;
    if (n > m.n + VIDA_DO_MISSIL || !voando(m.alvo)) return false;
    const c = caminhoDoMissil(m, amostrasDe(m.alvo), n) ?? [];
    const quebrou = m.n + c.length / 2 - 1;
    const a = amostrasDe(m.alvo);
    const firme = (a.length ? a[a.length - 5] : 0) + 1;
    return !(quebrou < Math.min(n, m.n + VIDA_DO_MISSIL) && quebrou + 1 <= firme);
  };

  const mandar = (dados: Record<string, unknown>) => o.enviar?.(dados);

  /** NO SOLO, a partida decide o acerto como o servidor decide na sala (a mesma regra). */
  const acertarAqui = (l: AviaoLocal, t: TiroNoAr) => {
    const sobra = Math.max(0, (o.vidas.get(l.id) ?? VIDAS) - 1);
    l.ultimoAcerto = n;
    const quem = local(t.dono);
    if (quem) quem.acertos++;
    o.eventos.push({ tipo: 'acerto', alvo: l.id, id: t.id, dono: t.dono, vidas: sobra, n });
  };

  /** O inimigo mais perto, para a cenoura (o alvo dela). */
  const maisPerto = (l: AviaoLocal) => {
    let melhor: number | null = null, dist = Infinity;
    for (const q of o.participantes) {
      if (q.id === l.id || !voando(q.id)) continue;
      const p = posicaoDe(q.id, n);
      if (!p) continue;
      const d = Math.hypot(p.x - l.aviao.x, p.y - l.aviao.y);
      if (d < dist) (dist = d), (melhor = q.id);
    }
    return melhor;
  };

  const vistaDe = (l: AviaoLocal): VistaDoRobo => {
    const inimigos: VistaDoRobo['inimigos'] = [];
    for (const q of o.participantes) {
      if (q.id === l.id || !voando(q.id)) continue;
      const p = posicaoDe(q.id, n);
      if (p) inimigos.push({ id: q.id, x: p.x, y: p.y, hx: p.hx, hy: p.hy, v: p.v });
    }
    const perigos: VistaDoRobo['perigos'] = [];
    for (const t of tiros.values()) {
      const p = ondeEsta(t);
      if (!p) continue;
      perigos.push({ x: p[0], y: p[1], dx: t.tiro.dx, dy: t.tiro.dy, missil: t.tipo === 'missil', meu: t.dono === l.id });
    }
    return { n, inimigos, perigos, missilLivre: !missilNoAr(l) };
  };

  const voarAviao = (l: AviaoLocal) => {
    if (!voando(l.id)) return;
    const a = l.aviao;
    const auto = l === meu && (o.autopiloto?.() ?? false);
    let c: ComandosDoDuelo;
    if (l.memoria || auto) {
      if (!l.memoria) l.memoria = novaMemoria(0.85, 7);
      c = comandoDoRobo(a, vistaDe(l), l.memoria);
    } else c = o.comandos;
    if (acabou || n > DURACAO_PASSOS) c = PARADO;
    l.bateu = voar(a, c);

    // O TIRO: apertou, sai a ervilha (no ritmo da recarga); segurou meio segundo e soltou, sai a cenoura (uma por vez)
    const fogo = c.fogo === true;
    if (fogo && !l.fogoAntes && n >= SEM_TIRO && n - l.ultimaErvilha >= RECARGA_DA_ERVILHA) {
      l.ultimaErvilha = n;
      atirar(l, 'ervilha', null);
    }
    if (fogo) l.segurando++;
    else {
      if (l.fogoAntes && l.segurando >= CARGA && n >= SEM_TIRO && !missilNoAr(l)) {
        const alvo = maisPerto(l);
        if (alvo !== null) atirar(l, 'missil', alvo);
      }
      l.segurando = 0;
    }
    l.fogoAntes = fogo;
  };

  const atirar = (l: AviaoLocal, tipo: 'ervilha' | 'missil', alvo: number | null) => {
    const a = l.aviao;
    const id = `${l.id}-${n}`;
    const x = umaCasa(a.x + a.hx * 9), y = umaCasa(a.y + a.hy * 9), dx = tresCasas(a.hx), dy = tresCasas(a.hy);
    const e: EventoDoDuelo =
      tipo === 'ervilha' ? { tipo, id, dono: l.id, n, x, y, dx, dy } : { tipo, id, dono: l.id, n, x, y, dx, dy, alvo: alvo as number };
    o.eventos.push(e);
    if (tipo === 'missil') l.missil = id;
    if (l === meu) {
      const { id: _id, dono: _dono, ...corpo } = e;
      mandar(corpo);
      o.aoTiro?.(tipo);
    }
  };

  /** A amostra: guardada (e a minha, mandada) a cada 4 passos, arredondada como vai pela rede. */
  const amostrar = (l: AviaoLocal) => {
    if (!voando(l.id) || n % PASSOS_POR_AMOSTRA !== 0) return;
    const a = l.aviao;
    const s = [n, umaCasa(a.x), umaCasa(a.y), tresCasas(a.hx), tresCasas(a.hy)];
    amostrasDe(l.id).push(...s);
    if (l === meu) mandar({ n, x: s[1], y: s[2], hx: s[3], hy: s[4] });
  };

  /** FUI ATINGIDO? (quem decide é quem leva; na sala, o servidor confere) */
  const conferirAcertos = (l: AviaoLocal) => {
    if (!voando(l.id) || n < l.ultimoAcerto + INVULNERAVEL || protegido(amostrasDe(l.id), n)) return;
    const a = l.aviao;
    for (const t of tiros.values()) {
      if (t.dono === l.id || gastos.has(t.id) || l.levados.has(t.id)) continue;
      const p = ondeEsta(t);
      if (!p) continue;
      const r = t.tipo === 'ervilha' ? RAIO_DA_ERVILHA : RAIO_DO_MISSIL;
      const dx = p[0] - a.x, dy = p[1] - a.y;
      if (dx * dx + dy * dy >= r * r) continue;
      l.levados.add(t.id);
      if (solo) {
        acertarAqui(l, t);
        lerEventos();
      } else {
        // a previsão: a vida some na hora; o servidor confirma (ou corrige)
        mandar({ tipo: 'acertou', id: t.id, n });
        gastos.add(t.id);
        l.previstos.set(t.id, n);
        l.ultimoAcerto = n;
        o.aoAcerto?.(l.id, a.x, a.y, vidasDe(l.id) <= 0);
        avisarVidas();
      }
      break;
    }
  };

  /** O Solo acaba quando eu caio, quando os do computador caem, ou quando o tempo acaba. */
  const conferirFimDoSolo = () => {
    if (acabou || !meu || !o.aoFim) return;
    const vivos = o.participantes.filter((q) => voando(q.id));
    const euVivo = voando(meu.id);
    if (euVivo && vivos.length > 1 && n < DURACAO_PASSOS) return;
    acabou = true;
    const minhas = vidasDe(meu.id);
    const naFrente = o.participantes.filter((q) => {
      if (q.id === meu.id) return false;
      if (voando(q.id) !== euVivo) return voando(q.id);
      if (!euVivo) return (saiuNa.get(q.id) ?? 0) > (saiuNa.get(meu.id) ?? 0);
      const l = local(q.id);
      return vidasDe(q.id) > minhas || (vidasDe(q.id) === minhas && (l?.acertos ?? 0) > meu.acertos);
    }).length;
    o.aoFim({ posicao: 1 + naFrente, total: o.participantes.length, vidas: minhas, acertos: meu.acertos, passos: Math.min(n, DURACAO_PASSOS) });
  };

  return {
    locais,
    meu,
    tiros,
    gastos,
    posicaoDe,
    vidasDe,
    voando,
    /** Onde cada tiro no ar está agora, e o rastro da cenoura (para o desenho). */
    tirosNaTela() {
      const lista: { id: string; tipo: 'ervilha' | 'missil'; dono: number; x: number; y: number; dx: number; dy: number; rastro: number[] }[] = [];
      for (const t of tiros.values()) {
        const p = ondeEsta(t);
        if (!p) continue;
        let dx = t.tiro.dx, dy = t.tiro.dy;
        let rastro: number[] = [];
        if (t.tipo === 'missil') {
          const c = caminhos.get(t.id)!;
          const k = n - t.tiro.n;
          if (k >= 1) {
            dx = c[2 * k] - c[2 * k - 2];
            dy = c[2 * k + 1] - c[2 * k - 1];
          }
          rastro = c.slice(Math.max(0, 2 * (k - 24)), 2 * k);
        }
        lista.push({ id: t.id, tipo: t.tipo, dono: t.dono, x: p[0], y: p[1], dx, dy, rastro });
      }
      return lista;
    },
    /** Protegido pela curva fechada agora? E piscando depois de um acerto? */
    protegidoAgora: (id: number) => protegido(o.amostras.get(id) ?? [], n),
    piscando: (id: number) => {
      const l = local(id);
      if (l) return n < l.ultimoAcerto + INVULNERAVEL;
      const ultimo = o.eventos.findLast?.((e) => e.tipo === 'acerto' && e.alvo === id) as { n: number } | undefined;
      return !!ultimo && n < ultimo.n + INVULNERAVEL;
    },
    /** A cenoura carregada (segurando o tiro meio segundo) e a cenoura livre: o que a tela mostra. */
    carga: () => (meu ? { pronta: meu.segurando >= CARGA, livre: !missilNoAr(meu) } : { pronta: false, livre: false }),
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
      for (const l of locais) voarAviao(l);
      for (const l of locais) amostrar(l);
      // as cenouras, pelas amostras que já se tem
      caminhos = new Map();
      for (const t of tiros.values()) {
        if (t.tipo !== 'missil' || gastos.has(t.id) || n > t.tiro.n + VIDA_DO_MISSIL + 60) continue;
        caminhos.set(t.id, caminhoDoMissil(t.tiro as Missil, amostrasDe((t.tiro as Missil).alvo), n) ?? []);
      }
      for (const l of locais) conferirAcertos(l);
      for (const l of locais) {
        for (const [id, m] of l.previstos) {
          if (n - m <= 180) continue;
          l.previstos.delete(id);
          avisarVidas();
        }
      }
      // os tiros que acabaram saem da lista
      for (const [id, t] of tiros) if (n > (t.tipo === 'ervilha' ? t.tiro.n + 90 : t.tiro.n + VIDA_DO_MISSIL + 60)) tiros.delete(id);
      if (solo) conferirFimDoSolo();
    },
    avisarVidas,
  };
}

export type Partida = ReturnType<typeof criarPartida>;
