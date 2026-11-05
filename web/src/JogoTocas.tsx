import { useEffect, useRef, useState, type MouseEvent as ME, type PointerEvent as PE, type WheelEvent as WE } from 'react';
import { ComandosDoJogo } from './ComandosDosJogos';
import { estiloVisual } from './Graficos';
import { chave, useT } from './i18n';
import { tocar } from './somDosJogos';
import { criarIA, PERFIS, type IA } from './tocas/ia';
import {
  casasDaMuralha,
  centroDe,
  comandar,
  eFonte,
  ePredio,
  ERA2,
  eUnidade,
  novaPartida,
  passo,
  PASSO,
  PASSOS_DA_MARAVILHA,
  PASSOS_POR_SEGUNDO,
  podeConstruir,
  podePagar,
  populacao,
  PREDIOS,
  RECURSOS,
  TAMANHO,
  UNIDADES,
  type Custo,
  type Recurso,
  type Sim,
  type TipoPredio,
  type TipoUnidade,
} from './tocas/sim';
import { CORES, type Vista } from './tocas/vista';
import { Vista2D } from './tocas/vista2d';
import './tocas/tocas.css';

/**
 * TOCAS E TORRES (05/11/2026): estratégia em tempo real, SÓ A MECÂNICA do gênero (coletar, construir, treinar, avançar de era,
 * atacar), numa partida de 10 a 15 minutos contra o computador. Nada de nome, arte, texto ou som de jogo nenhum; os modelos são
 * CC0 (Quaternius, Kenney, KayKit) e os coelhos são o nosso coelho 3D. Sem música (a regra do "nunca fazer a nossa"); os
 * efeitos são os de somDosJogos.ts.
 *
 * A PARTIDA É DESTE COMPUTADOR: a simulação (tocas/sim.ts) anda em passos fixos de 1/10 s, separada da tela, e o computador
 * adversário (tocas/ia.ts) joga pelo mesmo caminho dos comandos da pessoa. A janela sem foco PAUSA tudo. No fim, o resultado
 * vai ao servidor (server/src/minijogo-tocas.ts), que só confere o bom senso: é o Solo, sem troféu nem conquista. A sala de duas
 * pessoas é o próximo degrau (lockstep: só os comandos andariam pela rede).
 *
 * O mouse faz quase tudo: arrastar escolhe, o botão direito manda (andar, coletar, construir junto, atacar), a roda aproxima, e o
 * botão do meio, o direito arrastado ou as setas movem o mapa. No toque: tocar escolhe, tocar no destino manda, arrastar move.
 */

export interface EstadoTocas {
  fase: 'jogando' | 'fim';
  semente: number;
  partidaId: string;
  resultado: { venceu: boolean; motivo: 'centro' | 'maravilha' | 'tempo' | 'desistiu'; passos: number } | null;
  passosMax: number;
}

type Props = {
  estado: EstadoTocas & { terminada?: boolean };
  eu: number;
  jogador: boolean;
  agir: (corpo: Record<string, unknown>) => unknown;
};

const NOME: Record<TipoUnidade | TipoPredio, string> = {
  trabalhador: chave('Trabalhador'),
  lanceiro: chave('Lanceiro'),
  arqueiro: chave('Arqueiro'),
  cavaleiro: chave('Cavaleiro'),
  catapulta: chave('Catapulta'),
  centro: chave('Centro da vila'),
  casa: chave('Casa'),
  fazenda: chave('Fazenda'),
  quartel: chave('Quartel'),
  arquearia: chave('Arquearia'),
  torre: chave('Torre de vigia'),
  muralha: chave('Muralha'),
  portao: chave('Portão'),
  maravilha: chave('Maravilha'),
};
const NOME_DO_RECURSO: Record<Recurso, string> = { comida: chave('Comida'), madeira: chave('Madeira'), ouro: chave('Ouro') };
const CONSTRUIVEIS: TipoPredio[] = ['casa', 'fazenda', 'quartel', 'arquearia', 'torre', 'muralha', 'portao', 'maravilha'];

const relogio = (passos: number) => {
  const s = Math.floor(passos / PASSOS_POR_SEGUNDO);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export function JogoTocas({ estado, jogador, agir }: Props) {
  const t = useT();
  const r = estado.resultado;
  if (r) {
    const texto =
      r.motivo === 'desistiu'
        ? t('Você desistiu.')
        : r.motivo === 'tempo'
          ? t('O tempo acabou: ganhou quem tinha mais.')
          : r.motivo === 'maravilha'
            ? r.venceu
              ? t('A sua Maravilha ficou de pé por 2 minutos.')
              : t('A Maravilha do computador ficou de pé por 2 minutos.')
            : r.venceu
              ? t('Você derrubou o centro da vila do computador.')
              : t('O computador derrubou o seu centro da vila.');
    return (
      <div className="tocas-fim">
        <p className={`tocas-fim-titulo${r.venceu ? ' venceu' : ''}`}>{r.venceu ? t('Vitória!') : t('Derrota')}</p>
        <p className="minijogo-situacao">{texto}</p>
        <p className="minijogo-situacao">{relogio(r.passos)}</p>
      </div>
    );
  }
  if (estado.terminada || estado.fase === 'fim' || !jogador) return <p className="minijogo-situacao">…</p>;
  return <Partida key={estado.partidaId} semente={estado.semente} agir={agir} />;
}

// ---------------------------------------------------------------------------------------------------------------------

declare global {
  interface Window {
    /** Só no site de desenvolvimento: o e2e liga o piloto automático (o computador jogando por mim) e lê a partida. */
    tocasPilotoAutomatico?: boolean;
    /** Só no site de desenvolvimento: quantos passos por quadro, no máximo (para o e2e andar a partida depressa). */
    tocasVelocidade?: number;
    tocasPartidaDoTeste?: Sim;
  }
}

interface Painel {
  recursos: Record<Recurso, number>;
  pop: { usada: number; max: number };
  era: 1 | 2;
  passo: number;
  maravilha: [number, number];
  /** Uma marca que muda quando a seleção ou o que está nela muda (para os botões se refazerem). */
  versao: number;
}

type Colocando = { tipo: TipoPredio; inicio: { x: number; y: number } | null };

function Partida({ semente, agir }: { semente: number; agir: Props['agir'] }) {
  const t = useT();
  const caixa = useRef<HTMLDivElement>(null);
  const mapa = useRef<HTMLCanvasElement>(null);
  const caixaSel = useRef<HTMLDivElement>(null);
  const simRef = useRef<Sim | null>(null);
  if (!simRef.current) simRef.current = novaPartida(semente);
  const sim = simRef.current;
  const vistaRef = useRef<Vista | null>(null);
  const [pronta, setPronta] = useState(false);
  const [sel, setSel] = useState<number[]>([]);
  const selRef = useRef<number[]>([]);
  const [colocando, setColocando] = useState<Colocando | null>(null);
  const colocandoRef = useRef<Colocando | null>(null);
  const [painel, setPainel] = useState<Painel>(() => lerPainel(sim, 0));
  const [aviso, setAviso] = useState<string | null>(null);
  const [acabou, setAcabou] = useState(false);
  const teclas = useRef(new Set<string>());
  const agirRef = useRef(agir);
  agirRef.current = agir;

  const escolher = (ids: number[]) => {
    selRef.current = ids;
    setSel(ids);
    if (vistaRef.current) vistaRef.current.selecao = new Set(ids);
  };
  const colocar = (c: Colocando | null) => {
    colocandoRef.current = c;
    setColocando(c);
    if (!c && vistaRef.current) vistaRef.current.fantasma = null;
  };
  const avisar = (texto: string) => {
    setAviso(texto);
    window.setTimeout(() => setAviso((a) => (a === texto ? null : a)), 3000);
  };

  // ---- a vista e o laço ----
  useEffect(() => {
    if (!caixa.current) return;
    let viva = true;
    let id = 0;
    let vista: Vista | null = null;
    const ia: IA = criarIA(1, PERFIS.computador);
    const piloto: IA = criarIA(0, PERFIS.piloto);
    if (import.meta.env.DEV) window.tocasPartidaDoTeste = sim;
    const usar = async (v: Vista) => {
      vista = v;
      await v.montar();
      if (!viva) return v.destruir();
      vistaRef.current = v;
      v.selecao = new Set(selRef.current);
      setPronta(true);
      comecar();
    };
    const de2D = () => usar(new Vista2D(caixa.current!, sim, 0));
    if (estiloVisual() === '3d' && temWebGL())
      import('./tocas/cena')
        .then(({ CenaDasTocas }) => {
          if (!viva || !caixa.current) return;
          return usar(new CenaDasTocas(caixa.current, sim, 0));
        })
        .catch(() => {
          vista?.destruir();
          vista = null;
          if (viva && caixa.current) void de2D();
        });
    else void de2D();

    let ultimoSom = new Map<string, number>();
    const som = (e: Parameters<typeof tocar>[0], cada = 0) => {
      const agora = performance.now();
      if (cada && agora - (ultimoSom.get(e) ?? 0) < cada) return;
      ultimoSom.set(e, agora);
      tocar(e);
    };
    let mandou = false;
    const ouvir = () => {
      const vis = sim.jogadores[0].visivel;
      for (const e of sim.eventos) {
        switch (e.t) {
          case 'treinou':
            if (e.dono === 0) som('chegada', 300);
            break;
          case 'pronto':
            if (e.dono === 0) som('acerto', 300);
            break;
          case 'entregou':
            if (e.dono === 0) som('moeda', 1500);
            break;
          case 'golpe':
            if (vis[Math.floor(e.y1) * TAMANHO + Math.floor(e.x1)]) som(e.arma === 'corpo' ? 'soco' : 'tiro', 220);
            break;
          case 'morte':
            if (e.predio && vis[Math.floor(e.y) * TAMANHO + Math.floor(e.x)]) som('queda', 400);
            break;
          case 'era':
            som('vez');
            if (e.dono === 0) avisar(t('Você avançou para a era 2!'));
            else avisar(t('O computador avançou para a era 2.'));
            break;
          case 'maravilha':
            som('vez');
            avisar(e.dono === 0 ? t('A sua Maravilha está pronta: defenda-a por 2 minutos!') : t('O computador terminou uma Maravilha: derrube-a em 2 minutos!'));
            break;
          case 'atacado':
            // só o ataque em casa (quem está atacando lá longe já sabe que está brigando)
            if (e.dono === 0 && pertoDeCasa(sim, e.x, e.y)) {
              som('erro', 4000);
              avisar(t('A sua vila está sob ataque!'));
            }
            break;
        }
      }
    };

    const comecar = () => {
      let ultimo = performance.now();
      let acumulado = 0;
      let ultimoPainel = 0;
      let ultimoMapa = 0;
      const quadro = () => {
        if (!viva || !vista) return;
        id = requestAnimationFrame(quadro);
        const agora = performance.now();
        const dt = Math.min(0.1, (agora - ultimo) / 1000);
        ultimo = agora;
        // sem foco (o jogo de verdade, outra janela) ou escondida: nem a partida anda, nem se desenha
        if (document.hidden || !document.hasFocus()) return;
        if (sim.vencedor === null) {
          const vel = import.meta.env.DEV ? Math.max(1, window.tocasVelocidade ?? 1) : 1;
          acumulado += dt * vel;
          let n = 0;
          while (acumulado >= PASSO && n < 4 * vel) {
            ia(sim);
            if (import.meta.env.DEV && window.tocasPilotoAutomatico) piloto(sim);
            passo(sim);
            vista.eventos?.(sim);
            ouvir();
            acumulado -= PASSO;
            n++;
            if (sim.vencedor !== null) break;
          }
          if (n >= 4 * vel) acumulado = 0;
        }
        // as setas e o WASD movem o mapa
        const k = teclas.current;
        if (k.size) {
          const v = 600 * dt;
          const dx = (k.has('arrowleft') || k.has('a') ? 1 : 0) - (k.has('arrowright') || k.has('d') ? 1 : 0);
          const dy = (k.has('arrowup') || k.has('w') ? 1 : 0) - (k.has('arrowdown') || k.has('s') ? 1 : 0);
          const c = caixa.current;
          if ((dx || dy) && c) vista.arrastar(dx * v, dy * v, c.clientWidth / 2, c.clientHeight / 2);
        }
        vista.quadro(Math.min(1, acumulado / PASSO), dt);
        if (agora - ultimoPainel > 200) {
          ultimoPainel = agora;
          // quem morreu sai da seleção
          const vivos = selRef.current.filter((x) => sim.porId.has(x));
          if (vivos.length !== selRef.current.length) escolher(vivos);
          setPainel(lerPainel(sim, Math.floor(agora / 200)));
        }
        if (agora - ultimoMapa > 250) {
          ultimoMapa = agora;
          desenharMapa(mapa.current, sim, vista);
        }
        if (sim.vencedor !== null && !mandou) {
          mandou = true;
          som('fim');
          setAcabou(true);
          void agirRef.current({ tipo: 'fim', venceu: sim.vencedor === 0, motivo: sim.motivo, passos: sim.passo });
        }
      };
      id = requestAnimationFrame(quadro);
    };

    return () => {
      viva = false;
      cancelAnimationFrame(id);
      vista?.destruir();
      vistaRef.current = null;
      ultimoSom = new Map();
    };
    // a partida nasce uma vez
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- o teclado ----
  useEffect(() => {
    const desce = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement | null;
      if (alvo && (alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA' || alvo.isContentEditable)) return;
      const k = e.key.toLowerCase();
      if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'a', 'd', 'w', 's'].includes(k)) {
        teclas.current.add(k);
        e.preventDefault();
      } else if (k === 'escape') {
        if (colocandoRef.current) colocar(null);
        else escolher([]);
      } else if (k === 'h') irAoCentro();
    };
    const sobe = (e: KeyboardEvent) => teclas.current.delete(e.key.toLowerCase());
    const soltar = () => teclas.current.clear();
    window.addEventListener('keydown', desce);
    window.addEventListener('keyup', sobe);
    window.addEventListener('blur', soltar);
    return () => {
      window.removeEventListener('keydown', desce);
      window.removeEventListener('keyup', sobe);
      window.removeEventListener('blur', soltar);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- o que a pessoa faz ----
  const minhasUnidades = () => selRef.current.map((x) => sim.porId.get(x)).filter(eUnidade).filter((u) => u.dono === 0);
  const trabalhadoresEscolhidos = () => minhasUnidades().filter((u) => u.tipo === 'trabalhador').map((u) => u.id);

  const mandar = (px: number, py: number) => {
    const v = vistaRef.current;
    const us = minhasUnidades();
    if (!v || !us.length) return;
    const ids = us.map((u) => u.id);
    const alvo = v.pegar(px, py);
    const e = alvo !== null ? sim.porId.get(alvo) : undefined;
    if (e && !(eUnidade(e) && e.dono === 0)) {
      comandar(sim, 0, { t: 'alvo', ids, alvo: e.id });
      const c = centroDe(e);
      v.sinal(c.x, c.y, !eFonte(e) && e.dono !== 0);
      tocar('clique');
      return;
    }
    const p = v.chao(px, py);
    if (!p) return;
    comandar(sim, 0, { t: 'mover', ids, x: p.x, y: p.y });
    v.sinal(p.x, p.y, false);
    tocar('clique');
  };

  const casaDoFantasma = (p: { x: number; y: number }, tipo: TipoPredio) => {
    const tam = PREDIOS[tipo].tam;
    return { x: Math.floor(p.x - tam / 2 + 0.5), y: Math.floor(p.y - tam / 2 + 0.5) };
  };
  const atualizarFantasma = (px: number, py: number) => {
    const c = colocandoRef.current;
    const v = vistaRef.current;
    if (!c || !v) return;
    const p = v.chao(px, py);
    if (!p) return;
    const casa = casaDoFantasma(p, c.tipo);
    if (c.tipo === 'muralha') {
      const casas = c.inicio ? casasDaMuralha(c.inicio.x, c.inicio.y, casa.x, casa.y) : [casa];
      const ok = casas.every((k) => podeConstruir(sim, 0, 'muralha', k.x, k.y)) && podePagar(sim, 0, vezes(PREDIOS.muralha.custo, casas.length));
      v.fantasma = { tipo: 'muralha', casas, ok };
    } else v.fantasma = { tipo: c.tipo, casas: [casa], ok: podeConstruir(sim, 0, c.tipo, casa.x, casa.y) && podePagar(sim, 0, PREDIOS[c.tipo].custo) };
  };
  const porPredio = (px: number, py: number, manter: boolean) => {
    const c = colocandoRef.current;
    const v = vistaRef.current;
    if (!c || !v) return;
    const p = v.chao(px, py);
    if (!p) return;
    const casa = casaDoFantasma(p, c.tipo);
    const ids = trabalhadoresEscolhidos();
    if (!ids.length) return colocar(null);
    if (c.tipo === 'muralha') {
      if (!c.inicio) {
        colocar({ tipo: 'muralha', inicio: casa });
        atualizarFantasma(px, py);
        tocar('clique');
        return;
      }
      comandar(sim, 0, { t: 'muralha', ids, gx0: c.inicio.x, gy0: c.inicio.y, gx1: casa.x, gy1: casa.y });
      tocar('clique');
      colocar(manter ? { tipo: 'muralha', inicio: null } : null);
      return;
    }
    if (!podeConstruir(sim, 0, c.tipo, casa.x, casa.y) || !podePagar(sim, 0, PREDIOS[c.tipo].custo)) {
      tocar('erro');
      return;
    }
    comandar(sim, 0, { t: 'construir', ids, tipo: c.tipo, gx: casa.x, gy: casa.y });
    tocar('clique');
    if (!manter) colocar(null);
  };

  const clicar = (px: number, py: number, somar: boolean) => {
    const v = vistaRef.current;
    if (!v) return;
    const id = v.pegar(px, py);
    if (id === null) {
      if (!somar) escolher([]);
      return;
    }
    const e = sim.porId.get(id);
    if (somar && eUnidade(e) && e.dono === 0) {
      const ja = selRef.current.filter((x) => eUnidade(sim.porId.get(x)));
      escolher(ja.includes(id) ? ja.filter((x) => x !== id) : [...ja, id]);
    } else escolher([id]);
  };

  const irAoCentro = () => {
    const c = sim.predios.find((p) => p.dono === 0 && p.tipo === 'centro');
    if (!c) return;
    vistaRef.current?.centrar(c.gx + 1.5, c.gy + 1.5);
    escolher([c.id]);
  };

  // ---- o ponteiro ----
  const ptrs = useRef(new Map<number, { x: number; y: number }>());
  const gesto = useRef<{ modo: 'caixa' | 'mapa' | 'toque' | 'pinca'; x0: number; y0: number; x: number; y: number; botao: number; moveu: boolean; dist: number } | null>(null);
  const local = (e: { clientX: number; clientY: number }) => {
    const r = caixa.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const aoApertar = (e: PE<HTMLDivElement>) => {
    if (!vistaRef.current) return;
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    const p = local(e);
    if (e.pointerType === 'touch') {
      ptrs.current.set(e.pointerId, p);
      if (ptrs.current.size === 2) {
        const [a, b] = [...ptrs.current.values()];
        gesto.current = { modo: 'pinca', x0: p.x, y0: p.y, x: p.x, y: p.y, botao: 0, moveu: true, dist: Math.hypot(a.x - b.x, a.y - b.y) };
      } else gesto.current = { modo: 'toque', x0: p.x, y0: p.y, x: p.x, y: p.y, botao: 0, moveu: false, dist: 0 };
      return;
    }
    gesto.current = { modo: e.button === 0 && !colocandoRef.current ? 'caixa' : 'mapa', x0: p.x, y0: p.y, x: p.x, y: p.y, botao: e.button, moveu: false, dist: 0 };
  };
  const aoMover = (e: PE<HTMLDivElement>) => {
    const v = vistaRef.current;
    if (!v) return;
    const p = local(e);
    if (colocandoRef.current) atualizarFantasma(p.x, p.y);
    const g = gesto.current;
    if (!g) return;
    if (e.pointerType === 'touch') ptrs.current.set(e.pointerId, p);
    const dx = p.x - g.x;
    const dy = p.y - g.y;
    if (Math.hypot(p.x - g.x0, p.y - g.y0) > (e.pointerType === 'touch' ? 10 : 6)) g.moveu = true;
    if (g.modo === 'pinca' && ptrs.current.size >= 2) {
      const [a, b] = [...ptrs.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (g.dist > 0 && d > 0) v.zoom(g.dist / d, (a.x + b.x) / 2, (a.y + b.y) / 2);
      g.dist = d;
    } else if ((g.modo === 'mapa' || g.modo === 'toque') && g.moveu) {
      if (g.modo === 'mapa' && g.botao === 0) return;
      v.arrastar(dx, dy, p.x, p.y);
    } else if (g.modo === 'caixa' && g.moveu && caixaSel.current) {
      const s = caixaSel.current.style;
      s.display = 'block';
      s.left = `${Math.min(g.x0, p.x)}px`;
      s.top = `${Math.min(g.y0, p.y)}px`;
      s.width = `${Math.abs(p.x - g.x0)}px`;
      s.height = `${Math.abs(p.y - g.y0)}px`;
    }
    g.x = p.x;
    g.y = p.y;
  };
  const aoSoltar = (e: PE<HTMLDivElement>) => {
    const v = vistaRef.current;
    const g = gesto.current;
    const p = local(e);
    if (e.pointerType === 'touch') {
      ptrs.current.delete(e.pointerId);
      if (ptrs.current.size > 0) return;
    }
    gesto.current = null;
    if (caixaSel.current) caixaSel.current.style.display = 'none';
    if (!v || !g) return;
    if (g.modo === 'toque') {
      if (g.moveu) return;
      if (colocandoRef.current) return porPredio(p.x, p.y, false);
      const id = v.pegar(p.x, p.y);
      const e2 = id !== null ? sim.porId.get(id) : undefined;
      const minha = e2 && (eUnidade(e2) || ePredio(e2)) && e2.dono === 0;
      if (minha) return escolher([id!]);
      if (minhasUnidades().length) return mandar(p.x, p.y);
      return escolher(id !== null ? [id] : []);
    }
    if (g.modo === 'caixa') {
      if (g.moveu) {
        const ids = v.noRetangulo(g.x0, g.y0, p.x, p.y);
        // de arrasto, quem luta vem antes de quem trabalha (como se espera): só os trabalhadores, se não houver outro
        const soldados = ids.filter((x) => {
          const u = sim.porId.get(x);
          return eUnidade(u) && u.tipo !== 'trabalhador';
        });
        escolher(soldados.length ? soldados : ids);
      } else clicar(p.x, p.y, e.shiftKey);
      return;
    }
    if (g.modo === 'mapa' && !g.moveu) {
      if (g.botao === 2) {
        if (colocandoRef.current) colocar(null);
        else mandar(p.x, p.y);
      } else if (g.botao === 0 && colocandoRef.current) porPredio(p.x, p.y, e.shiftKey);
    }
  };
  const aoRolar = (e: WE<HTMLDivElement>) => {
    const p = local(e);
    vistaRef.current?.zoom(e.deltaY > 0 ? 1.12 : 1 / 1.12, p.x, p.y);
  };
  const aoDuploClique = (e: ME<HTMLDivElement>) => {
    const v = vistaRef.current;
    if (!v || colocandoRef.current) return;
    const p = local(e);
    const id = v.pegar(p.x, p.y);
    const u = id !== null ? sim.porId.get(id) : undefined;
    if (!eUnidade(u) || u.dono !== 0) return;
    const c = caixa.current!;
    escolher(v.noRetangulo(0, 0, c.clientWidth, c.clientHeight).filter((x) => (sim.porId.get(x) as { tipo?: string })?.tipo === u.tipo));
  };

  // ---- o minimapa ----
  const aoTocarNoMapa = (e: PE<HTMLCanvasElement>) => {
    const c = e.currentTarget;
    const r = c.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * TAMANHO;
    const y = ((e.clientY - r.top) / r.height) * TAMANHO;
    if (e.button === 2) {
      const ids = minhasUnidades().map((u) => u.id);
      if (ids.length) {
        comandar(sim, 0, { t: 'mover', ids, x, y });
        tocar('clique');
      }
      return;
    }
    if (e.buttons || e.type === 'pointerdown') vistaRef.current?.centrar(x, y);
  };

  // ---- os botões ----
  const escolhidos = sel.map((x) => sim.porId.get(x)).filter(Boolean) as NonNullable<ReturnType<typeof sim.porId.get>>[];
  const unidades = escolhidos.filter(eUnidade).filter((u) => u.dono === 0);
  const trabalhadores = unidades.filter((u) => u.tipo === 'trabalhador');
  const predio = escolhidos.length === 1 && ePredio(escolhidos[0]) ? escolhidos[0] : null;
  const unico = escolhidos.length === 1 ? escolhidos[0] : null;
  void painel.versao;

  const custo = (c: Custo) => (
    <span className="tocas-custo">
      {RECURSOS.filter((k) => c[k]).map((k) => (
        <span key={k} className={`tocas-rec-${k}`}>
          {c[k]}
        </span>
      ))}
    </span>
  );

  const botaoConstruir = (tipo: TipoPredio) => {
    const d = PREDIOS[tipo];
    const travado = painel.era < d.era;
    const pode = !travado && podePagar(sim, 0, d.custo);
    return (
      <button
        key={tipo}
        type="button"
        className={`tocas-botao${colocando?.tipo === tipo ? ' ativo' : ''}`}
        disabled={travado}
        aria-disabled={!pode}
        title={travado ? t('Pede a era 2') : undefined}
        onClick={() => {
          if (!pode) return void tocar('erro');
          colocar(colocando?.tipo === tipo ? null : { tipo, inicio: null });
        }}
      >
        <span className="tocas-botao-nome">{t(NOME[tipo])}</span>
        {custo(d.custo)}
      </button>
    );
  };

  const botaoTreinar = (tipo: TipoUnidade) => {
    const d = UNIDADES[tipo];
    const travado = painel.era < d.era;
    const pode = !travado && podePagar(sim, 0, d.custo) && !!predio && predio.fila.length < 5 && predio.pronto;
    return (
      <button
        key={tipo}
        type="button"
        className="tocas-botao"
        disabled={travado}
        aria-disabled={!pode}
        title={travado ? t('Pede a era 2') : undefined}
        onClick={() => {
          if (!pode || !predio) return void tocar('erro');
          comandar(sim, 0, { t: 'treinar', predio: predio.id, unidade: tipo });
          tocar('clique');
        }}
      >
        <span className="tocas-botao-nome">{t(NOME[tipo])}</span>
        {custo(d.custo)}
      </button>
    );
  };

  const maravilha = painel.maravilha;
  return (
    <div className="tocas">
      <div className="tocas-topo">
        {RECURSOS.map((k) => (
          <span key={k} className={`tocas-recurso tocas-rec-${k}`} title={t(NOME_DO_RECURSO[k])}>
            <span className="tocas-recurso-nome">{t(NOME_DO_RECURSO[k])}</span> {Math.floor(painel.recursos[k])}
          </span>
        ))}
        <span className="tocas-recurso" title={t('População')}>
          <span className="tocas-recurso-nome">{t('População')}</span> {painel.pop.usada}/{painel.pop.max}
        </span>
        <span className="tocas-era">{t('Era {n}', { n: painel.era })}</span>
        <span className="tocas-relogio">{relogio(painel.passo)}</span>
        {maravilha[0] > 0 && <span className="tocas-maravilha">{t('Maravilha: {tempo}', { tempo: relogio(PASSOS_DA_MARAVILHA - maravilha[0]) })}</span>}
        {maravilha[1] > 0 && <span className="tocas-maravilha inimiga">{t('Maravilha do computador: {tempo}', { tempo: relogio(PASSOS_DA_MARAVILHA - maravilha[1]) })}</span>}
        <button type="button" className="tocas-desistir" disabled={acabou} onClick={() => void agir({ tipo: 'desistir', passos: sim.passo })}>
          {t('Desistir')}
        </button>
      </div>
      <div className="tocas-moldura">
        <div
          ref={caixa}
          className={`tocas-caixa${pronta ? '' : ' carregando'}${colocando ? ' colocando' : ''}`}
          onPointerDown={aoApertar}
          onPointerMove={aoMover}
          onPointerUp={aoSoltar}
          onPointerCancel={aoSoltar}
          onWheel={aoRolar}
          onDoubleClick={aoDuploClique}
          onContextMenu={(e) => e.preventDefault()}
        >
          <div ref={caixaSel} className="tocas-selecao" />
        </div>
        {aviso && <div className="tocas-aviso">{aviso}</div>}
        {acabou && (
          <div className="tocas-acabou">{sim.vencedor === 0 ? t('Vitória!') : t('Derrota')}</div>
        )}
      </div>
      <div className="tocas-baixo">
        <canvas ref={mapa} className="tocas-mapa" width={TAMANHO * 3} height={TAMANHO * 3} onPointerDown={aoTocarNoMapa} onPointerMove={(e) => e.buttons === 1 && aoTocarNoMapa(e)} onContextMenu={(e) => e.preventDefault()} />
        <div className="tocas-info">
          {unico ? (
            <>
              <p className="tocas-info-nome">
                {eFonte(unico) ? t(unico.tipo === 'arvore' ? 'Madeira' : 'Ouro') : t(NOME[unico.tipo])}
                {!eFonte(unico) && unico.dono !== 0 && <span className="tocas-inimigo"> · {t('Computador')}</span>}
              </p>
              {eFonte(unico) ? (
                <p className="tocas-info-linha">{Math.floor(unico.qtd)}</p>
              ) : (
                <div className="tocas-vida" style={{ ['--vida' as string]: String(Math.max(0, unico.vida / unico.vidaMax)) }}>
                  <span />
                  <small>
                    {Math.ceil(unico.vida)}/{unico.vidaMax}
                  </small>
                </div>
              )}
              {eUnidade(unico) && unico.carga && (
                <p className="tocas-info-linha">
                  {t(NOME_DO_RECURSO[unico.carga.rec])}: {unico.carga.qtd}
                </p>
              )}
              {predio && !predio.pronto && <p className="tocas-info-linha">{Math.floor((predio.progresso / PREDIOS[predio.tipo].tempo) * 100)}%</p>}
              {predio && predio.dono === 0 && (predio.fila.length > 0 || predio.pesquisa > 0) && (
                <div className="tocas-fila">
                  {predio.pesquisa > 0 ? (
                    <span className="tocas-fila-item">
                      {t('Avançando de era…')} {Math.floor((predio.pesquisa / ERA2.tempo) * 100)}%
                    </span>
                  ) : (
                    predio.fila.map((u, i) => (
                      <span key={i} className="tocas-fila-item">
                        {t(NOME[u])}
                        {i === 0 && ` ${Math.floor((predio.treino / UNIDADES[u].tempo) * 100)}%`}
                      </span>
                    ))
                  )}
                  <button type="button" className="tocas-cancelar" onClick={() => comandar(sim, 0, { t: 'cancelar', predio: predio.id })} aria-label={t('Cancelar')}>
                    ✕
                  </button>
                </div>
              )}
            </>
          ) : unidades.length > 1 ? (
            <div className="tocas-grupo">
              {(Object.keys(UNIDADES) as TipoUnidade[])
                .filter((k) => unidades.some((u) => u.tipo === k))
                .map((k) => (
                  <span key={k} className="tocas-grupo-item">
                    {t(NOME[k])} × {unidades.filter((u) => u.tipo === k).length}
                  </span>
                ))}
            </div>
          ) : null}
          <div className="tocas-atalhos">
            <button type="button" className="tocas-atalho" onClick={irAoCentro}>
              {t('Centro da vila')}
            </button>
            <button
              type="button"
              className="tocas-atalho"
              onClick={() => {
                const ociosos = sim.unidades.filter((u) => u.dono === 0 && u.tipo === 'trabalhador' && u.ordem.tipo === 'parado');
                if (!ociosos.length) return void tocar('erro');
                const atual = selRef.current.length === 1 ? ociosos.findIndex((u) => u.id === selRef.current[0]) : -1;
                const u = ociosos[(atual + 1) % ociosos.length];
                escolher([u.id]);
                vistaRef.current?.centrar(u.x, u.y);
              }}
            >
              {t('Trabalhador parado')}
            </button>
            <button
              type="button"
              className="tocas-atalho"
              onClick={() => escolher(sim.unidades.filter((u) => u.dono === 0 && UNIDADES[u.tipo].combate).map((u) => u.id))}
            >
              {t('Exército')}
            </button>
          </div>
        </div>
        <div className="tocas-acoes">
          {trabalhadores.length > 0 && CONSTRUIVEIS.map(botaoConstruir)}
          {predio && predio.dono === 0 && predio.pronto && (
            <>
              {(Object.keys(UNIDADES) as TipoUnidade[]).filter((k) => UNIDADES[k].de === predio.tipo).map(botaoTreinar)}
              {predio.tipo === 'centro' && painel.era === 1 && predio.pesquisa === 0 && (
                <button
                  type="button"
                  className="tocas-botao era"
                  aria-disabled={!podePagar(sim, 0, ERA2.custo)}
                  onClick={() => {
                    if (!podePagar(sim, 0, ERA2.custo)) return void tocar('erro');
                    comandar(sim, 0, { t: 'era', predio: predio.id });
                    tocar('clique');
                  }}
                >
                  <span className="tocas-botao-nome">{t('Avançar de era')}</span>
                  {custo(ERA2.custo)}
                </button>
              )}
            </>
          )}
          {colocando?.tipo === 'muralha' && <p className="tocas-dica">{colocando.inicio ? t('Agora a outra ponta da muralha.') : t('Escolha onde a muralha começa.')}</p>}
        </div>
      </div>
      <ComandosDoJogo
        itens={[
          { teclas: ['mouse-arrastar'], toque: 'toque', rotulo: t('Escolher') },
          { teclas: ['mouse-direito'], rotulo: t('Botão direito: mandar') },
          { teclas: ['setas'], toque: 'toque-arrastar', rotulo: t('Mover o mapa') },
        ]}
      />
    </div>
  );
}

function pertoDeCasa(sim: Sim, x: number, y: number): boolean {
  const c = sim.predios.find((p) => p.dono === 0 && p.tipo === 'centro');
  if (!c) return false;
  const dx = x - (c.gx + 1.5);
  const dy = y - (c.gy + 1.5);
  return dx * dx + dy * dy < 15 * 15;
}

function vezes(c: Custo, n: number): Custo {
  const r: Custo = {};
  for (const k of RECURSOS) if (c[k]) r[k] = c[k]! * n;
  return r;
}

function lerPainel(sim: Sim, versao: number): Painel {
  const j = sim.jogadores[0];
  return {
    recursos: { ...j.recursos },
    pop: populacao(sim, 0),
    era: j.era,
    passo: sim.passo,
    maravilha: [sim.jogadores[0].maravilha, sim.jogadores[1].maravilha],
    versao,
  };
}

/** O minimapa: o mapa inteiro, a névoa, os prédios e as unidades, e o retângulo do que a tela mostra. */
function desenharMapa(tela: HTMLCanvasElement | null, sim: Sim, vista: Vista) {
  if (!tela) return;
  const g = tela.getContext('2d');
  if (!g) return;
  const k = tela.width / TAMANHO;
  const j = sim.jogadores[0];
  g.fillStyle = '#6f9a52';
  g.fillRect(0, 0, tela.width, tela.height);
  for (const f of sim.fontes) {
    if (!j.explorado[f.gy * TAMANHO + f.gx]) continue;
    g.fillStyle = f.tipo === 'arvore' ? '#2f5a2c' : '#f0cf3c';
    g.fillRect(f.gx * k, f.gy * k, k, k);
  }
  g.fillStyle = '#8b8577';
  for (const p of sim.pedras) if (j.explorado[p.gy * TAMANHO + p.gx]) g.fillRect(p.gx * k, p.gy * k, k, k);
  for (const p of sim.predios) {
    if (p.dono !== 0 && !j.explorado[p.gy * TAMANHO + p.gx]) continue;
    g.fillStyle = CORES[p.dono];
    g.fillRect(p.gx * k, p.gy * k, p.tam * k, p.tam * k);
  }
  for (const u of sim.unidades) {
    if (u.dono !== 0 && !j.visivel[Math.floor(u.y) * TAMANHO + Math.floor(u.x)]) continue;
    g.fillStyle = u.dono === 0 ? '#bcd3ff' : '#ffb3a8';
    g.fillRect(u.x * k - 1.5, u.y * k - 1.5, 3, 3);
  }
  for (let y = 0; y < TAMANHO; y++)
    for (let x = 0; x < TAMANHO; x++) {
      const i = y * TAMANHO + x;
      if (j.visivel[i]) continue;
      g.fillStyle = j.explorado[i] ? 'rgba(10,14,20,0.4)' : 'rgba(10,14,20,0.9)';
      g.fillRect(x * k, y * k, k, k);
    }
  const c = vista.cantos();
  g.strokeStyle = '#ffffff';
  g.lineWidth = 1.5;
  g.beginPath();
  c.forEach((p, i) => (i ? g.lineTo(p.x * k, p.y * k) : g.moveTo(p.x * k, p.y * k)));
  g.closePath();
  g.stroke();
}

function temWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}
