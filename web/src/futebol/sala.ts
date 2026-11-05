/**
 * O FUTEBOL NA SALA, DO LADO DO SITE (05/11/2026): a bola e os robôs são do servidor (server/src/minijogo-futebol.ts), e o meu
 * coelho é daqui. Este arquivo junta as duas coisas numa VISTA (um Mundo da simulação, sim.ts) que a tela desenha e o piloto
 * automático lê:
 * - O MEU COELHO anda aqui, na hora, com as mesmas contas do servidor (passoDoJogador), e a posição vai ~20 vezes por segundo.
 * - OS OUTROS chegam no quadro do servidor (20 por segundo) e são desenhados uns 7 passos atrás, interpolados pelo relógio do
 *   servidor (o número do passo), para não tremerem com a rede.
 * - A BOLA: no pé de alguém, ela vai na frente dele (no meu pé, na frente do MEU coelho, sem atraso). Solta, ela é a do último
 *   quadro ANDADA PARA A FRENTE com a física da bola (passoDaBola) até "agora mais a ida da rede": é onde ela vai estar quando a
 *   minha posição chegar lá. Quando EU chuto, a bola sai na hora aqui (a previsão) e fica assim até o servidor responder; se ele
 *   recusar, ela volta. Encostar na bola solta também a põe no meu pé na hora, por 0,4 s, esperando o servidor confirmar.
 * - Toda troca de onde a bola vem (a previsão, o servidor, o pé) passa por um DESVIO que some aos poucos: a bola não pula.
 */
import {
  ALCANCE,
  aplicarChute,
  DOMINIO_MAX,
  foraDoCentro,
  forcaDaCarga,
  frenteDe,
  NADA,
  novoMundo,
  passoDaBola,
  passoDoJogador,
  podeChutar,
  SEM_DOMINIO,
  TONTO,
  vetorDoChute,
  vetorDoPasse,
  CARGA_MAX,
  type Bola,
  type Comando,
  type Jogador,
  type Mundo,
} from './sim';

/** O quadro do servidor (ver `difundir` em minijogo-futebol.ts). */
export interface Quadro {
  tipo: 'q';
  /** O passo do servidor (contando as pausas), os passos de bola rolando, a pausa e o número de voltas ao meio. */
  n: number;
  p: number;
  pa: number;
  r: number;
  ce: 0 | 1;
  sa: 0 | 1;
  g: [number, number];
  fim: 0 | 1;
  /** x, y, vx, vy, dono, versão, proteção */
  b: number[];
  /** id, x, y, vx, vy, fx, fy, carga, tonto, eco */
  j: number[][];
  /** As respostas aos chutes: id, número, 1 aceito / 0 recusado. */
  c: number[][];
  e: unknown[][];
}

export type EventoDaTela =
  | { tipo: 'chute' | 'passe' | 'dominio' | 'quique' | 'reinicio' | 'fim'; id?: number }
  | { tipo: 'roubo'; id: number; de: number }
  | { tipo: 'gol'; time: 0 | 1; autor: number; contra: boolean };

const MS_POR_PASSO = 1000 / 60;
/** Os outros são desenhados tantos passos atrás do último quadro (o quadro vem a cada 3, com folga para a rede). */
const ATRAS = 7;
const POSSE_PREVISTA_MS = 400;
const PREVISAO_MS = 700;

export class ClienteDaSala {
  readonly vista: Mundo;
  readonly eu: Jogador | null;
  ultimo: Quadro | null = null;
  ultimoEm = 0;
  /** A ida da rede, em ms (metade da volta medida pelo eco da posição). */
  latencia = 90;
  private quadros: { q: Quadro; em: number }[] = [];
  /** O relógio do servidor: a hora local do passo 0 (o menor visto, subindo devagar). */
  private base: number | null = null;
  private reinicio = -1;
  private seq = 0;
  private previsto: { bola: Bola; seq: number; em: number } | null = null;
  private posseAte = 0;
  private envio = 0;
  private mostrada: { x: number; y: number } | null = null;
  private desvio = { x: 0, y: 0 };
  /** O giro da bola no desenho (a distância rolada). */
  giro = 0;

  constructor(
    times: number[][],
    euId: number | null,
    private enviar: (dados: unknown) => void,
    private aoEvento: (e: EventoDaTela) => void,
  ) {
    this.vista = novoMundo([times[0] ?? [], times[1] ?? []]);
    this.eu = euId === null ? null : (this.vista.jogadores.find((j) => j.id === euId) ?? null);
  }

  /** Um quadro chegou do servidor. */
  receber(q: Quadro, agora: number) {
    if (this.ultimo && q.n <= this.ultimo.n) return;
    this.ultimo = q;
    this.ultimoEm = agora;
    this.quadros.push({ q, em: agora });
    while (this.quadros.length > 30) this.quadros.shift();
    const amostra = agora - q.n * MS_POR_PASSO;
    if (this.base === null || amostra < this.base) this.base = amostra;
    else this.base += (amostra - this.base) * 0.02;
    const v = this.vista;
    v.pausa = q.pa;
    v.passo = q.p;
    v.tempo = q.n;
    v.centro = q.ce === 1;
    v.saida = q.sa;
    v.placar = [q.g[0], q.g[1]];
    v.fim = q.fim === 1;
    const eu = this.eu;
    for (const linha of q.j) {
      if (eu && linha[0] === eu.id) {
        // a volta da rede pelo eco da minha posição (o relógio é o meu, módulo 1e9)
        const eco = linha[9];
        if (eco > 0) {
          const volta = (Math.round(agora) % 1e9) - eco;
          if (volta > 0 && volta < 3000) this.latencia += (Math.max(0, (volta - 25) / 2) - this.latencia) * 0.15;
        }
        // a volta ao meio: o meu coelho pula para a formação
        if (q.r !== this.reinicio) {
          this.reinicio = q.r;
          eu.x = linha[1];
          eu.y = linha[2];
          eu.vx = 0;
          eu.vy = 0;
          eu.fx = linha[5];
          eu.fy = linha[6];
          eu.carga = 0;
          eu.tonto = 0;
          eu.semDominio = 0;
          this.previsto = null;
          this.posseAte = 0;
        }
      }
    }
    if (!eu) this.reinicio = q.r;
    for (const [id, s, ok] of q.c) {
      if (eu && id === eu.id && this.previsto && s === this.previsto.seq) {
        // aceito: a bola do servidor já tem o chute; recusado: volta a do servidor (o desvio suaviza as duas)
        this.previsto = null;
        if (!ok) eu.semDominio = 0;
      }
    }
    for (const e of q.e) {
      const [tipo, a, b, c] = e as [string, number, number, number];
      if (tipo === 'c' && a !== eu?.id) this.aoEvento({ tipo: 'chute', id: a });
      else if (tipo === 'p' && a !== eu?.id) this.aoEvento({ tipo: 'passe', id: a });
      else if (tipo === 'd' && a !== eu?.id) this.aoEvento({ tipo: 'dominio', id: a });
      else if (tipo === 'r') {
        if (eu && b === eu.id) {
          eu.tonto = TONTO;
          eu.carga = 0;
          this.posseAte = 0;
        }
        this.aoEvento({ tipo: 'roubo', id: a, de: b });
      } else if (tipo === 'q') this.aoEvento({ tipo: 'quique' });
      else if (tipo === 'g') {
        this.previsto = null;
        this.posseAte = 0;
        this.aoEvento({ tipo: 'gol', time: a as 0 | 1, autor: b, contra: c === 1 });
      } else if (tipo === 'i') this.aoEvento({ tipo: 'reinicio' });
      else if (tipo === 'f') this.aoEvento({ tipo: 'fim' });
    }
  }

  /** Em que passo do servidor estou desenhando os outros. */
  private passoDosOutros(agora: number): number {
    if (this.base === null || !this.ultimo) return 0;
    return Math.min((agora - this.base) / MS_POR_PASSO, this.ultimo.n + 3) - ATRAS;
  }

  /** Atualiza a vista para a hora `agora`: os outros interpolados, e a bola. Chamar antes dos passos e do desenho. */
  atualizar(agora: number) {
    const q = this.ultimo;
    if (!q) return;
    const n = this.passoDosOutros(agora);
    let a = this.quadros[0];
    let b = this.quadros[this.quadros.length - 1];
    for (let k = 0; k < this.quadros.length - 1; k++) {
      if (this.quadros[k].q.n <= n && this.quadros[k + 1].q.n >= n) {
        a = this.quadros[k];
        b = this.quadros[k + 1];
        break;
      }
    }
    const f = b.q.n > a.q.n ? Math.max(0, Math.min(1, (n - a.q.n) / (b.q.n - a.q.n))) : 1;
    const linhaB = new Map(b.q.j.map((l) => [l[0], l]));
    for (const la of a.q.j) {
      const j = this.vista.jogadores.find((x) => x.id === la[0]);
      if (!j || j === this.eu) continue;
      const lb = linhaB.get(la[0]) ?? la;
      j.x = la[1] + (lb[1] - la[1]) * f;
      j.y = la[2] + (lb[2] - la[2]) * f;
      j.vx = lb[3];
      j.vy = lb[4];
      j.fx = la[5] + (lb[5] - la[5]) * f;
      j.fy = la[6] + (lb[6] - la[6]) * f;
      const nf = Math.sqrt(j.fx * j.fx + j.fy * j.fy) || 1;
      j.fx /= nf;
      j.fy /= nf;
      j.carga = lb[7];
      j.tonto = lb[8];
    }
    // A BOLA
    const bola = this.vista.bola;
    const [bx, by, bvx, bvy, dono, versao] = q.b;
    bola.versao = versao;
    let alvo: { x: number; y: number; vx: number; vy: number; dono: number };
    const eu = this.eu;
    if (this.previsto && agora - this.previsto.em > PREVISAO_MS) this.previsto = null;
    if (eu && this.previsto) {
      const p = this.previsto.bola;
      alvo = { x: p.x, y: p.y, vx: p.vx, vy: p.vy, dono: 0 };
    } else if (eu && (dono === eu.id || (dono === 0 && this.posseAte > agora))) {
      const [x, y] = frenteDe(eu);
      alvo = { x, y, vx: eu.vx, vy: eu.vy, dono: eu.id };
    } else if (dono !== 0) {
      const d = this.vista.jogadores.find((x) => x.id === dono);
      const [x, y] = d ? frenteDe(d) : [bx, by];
      alvo = { x, y, vx: d?.vx ?? 0, vy: d?.vy ?? 0, dono };
    } else {
      // solta: a do último quadro, andada até "agora mais a ida da rede"
      const alvoPasso = this.base === null ? q.n : (agora - this.base + this.latencia) / MS_POR_PASSO;
      const k = Math.max(0, Math.min(40, Math.round(alvoPasso - q.n)));
      const tmp = { bola: { ...bola, x: bx, y: by, vx: bvx, vy: bvy, dono: 0 }, eventos: [] } as unknown as Mundo;
      for (let i = 0; i < k; i++) passoDaBola(tmp, false);
      alvo = { x: tmp.bola.x, y: tmp.bola.y, vx: tmp.bola.vx, vy: tmp.bola.vy, dono: 0 };
    }
    if (dono !== 0 && eu && dono !== eu.id) this.posseAte = 0;
    // o desvio: a bola mostrada não pula quando muda de onde vem (só na volta ao meio, que é um pulo de verdade)
    if (this.mostrada) {
      const ex = this.mostrada.x - alvo.x;
      const ey = this.mostrada.y - alvo.y;
      const salto = Math.sqrt(ex * ex + ey * ey);
      if (salto > 120) this.desvio = { x: 0, y: 0 };
      else if (salto > 14) this.desvio = { x: ex, y: ey };
    }
    this.desvio.x *= 0.82;
    this.desvio.y *= 0.82;
    const x = alvo.x + this.desvio.x;
    const y = alvo.y + this.desvio.y;
    if (this.mostrada) this.giro += Math.sqrt((x - this.mostrada.x) ** 2 + (y - this.mostrada.y) ** 2) / 5;
    this.mostrada = { x, y };
    bola.x = alvo.x;
    bola.y = alvo.y;
    bola.vx = alvo.vx;
    bola.vy = alvo.vy;
    bola.dono = alvo.dono;
  }

  /** Onde a bola é desenhada (com o desvio). */
  bolaNaTela(): { x: number; y: number } {
    return this.mostrada ?? { x: this.vista.bola.x, y: this.vista.bola.y };
  }

  /** Um passo do MEU coelho (60 por segundo). */
  passo(c: Comando, agora: number) {
    const eu = this.eu;
    const q = this.ultimo;
    if (!eu || !q || this.vista.fim) return;
    if (this.previsto) passoDaBola({ bola: this.previsto.bola, eventos: [] } as unknown as Mundo, false);
    if (eu.semDominio > 0) eu.semDominio--;
    // a contagem e o gol: ninguém anda (o servidor também não aceita a posição)
    if (this.vista.pausa > 0) {
      eu.vx = 0;
      eu.vy = 0;
      eu.carga = 0;
      return;
    }
    if (eu.tonto > 0) {
      eu.tonto--;
      c = NADA;
    }
    const comBola = this.vista.bola.dono === eu.id;
    passoDoJogador(eu, c, comBola);
    foraDoCentro(this.vista, eu);
    if (comBola) {
      const [x, y] = frenteDe(eu);
      this.vista.bola.x = x;
      this.vista.bola.y = y;
    }
    // o chute (soltar depois de segurar) e o passe
    if (c.chute) {
      if (eu.carga < CARGA_MAX) eu.carga++;
    } else if (eu.carga > 0) {
      const forca = forcaDaCarga(eu.carga);
      eu.carga = 0;
      if (podeChutar(this.vista, eu)) this.chutar(vetorDoChute(eu, forca), false, agora);
    }
    if (c.passe && eu.carga === 0 && podeChutar(this.vista, eu)) this.chutar(vetorDoPasse(this.vista, eu), true, agora);
    // encostou na bola solta como ela está na tela: fica com ela na hora, esperando o servidor
    const b = this.vista.bola;
    if (!this.previsto && b.dono === 0 && eu.semDominio === 0 && !(this.vista.centro && eu.time !== this.vista.saida)) {
      const dx = b.x - eu.x;
      const dy = b.y - eu.y;
      if (dx * dx + dy * dy <= ALCANCE * ALCANCE && b.vx * b.vx + b.vy * b.vy <= DOMINIO_MAX * DOMINIO_MAX) {
        this.posseAte = agora + POSSE_PREVISTA_MS;
        b.dono = eu.id;
        this.aoEvento({ tipo: 'dominio', id: eu.id });
      }
    }
    // a posição, 20 vezes por segundo
    if (++this.envio >= 3) {
      this.envio = 0;
      this.enviar({ tipo: 'pos', x: eu.x, y: eu.y, vx: eu.vx, vy: eu.vy, fx: eu.fx, fy: eu.fy, c: eu.carga, r: this.reinicio, ts: Math.round(agora) % 1e9 });
    }
  }

  private chutar([vx, vy]: [number, number], passe: boolean, agora: number) {
    const eu = this.eu!;
    const s = ++this.seq;
    this.enviar({ tipo: 'chute', x: eu.x, y: eu.y, vx, vy, fx: eu.fx, fy: eu.fy, passe, s });
    // a previsão: a bola sai daqui na hora, com a mesma conta do servidor
    const tmp = { bola: { ...this.vista.bola }, eventos: [] as unknown[] } as unknown as Mundo;
    aplicarChute(tmp, eu, vx, vy, passe);
    eu.semDominio = SEM_DOMINIO;
    this.previsto = { bola: tmp.bola, seq: s, em: agora };
    this.posseAte = 0;
    this.vista.bola.dono = 0;
    this.aoEvento({ tipo: passe ? 'passe' : 'chute', id: eu.id });
  }
}
