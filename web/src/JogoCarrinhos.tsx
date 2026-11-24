import { temWebGL } from './temWebGL';
import { Trophy } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { ComandosDoJogo } from './ComandosDosJogos';
import { chave, useT } from './i18n';
import { lerControle } from './controleDosJogos';
import { DIFICULDADES, somarPontos, type Dificuldade, type PontosNaCopa } from './corrida/robos';
import { MedalhasDaCorrida } from './SelosDaCorrida';
import { FATORES_DOS_CARRINHOS, tempoDoPilotoNosCarrinhos } from './carrinhos/medalhas';
import { IconeDeHud } from './iconesDeHud';
import { comandoDaPausa, TelaDePausa, usePausaComEsc, type Pausa } from './pausaDosJogos';
import { criarMotor, tocar } from './somDosJogos';
import { coresDoAvatar, minhasCoresDoCoelho, type CoresDoCoelho } from './coelho3d';
import { tempoLegivel } from './jato/util';
import { criarRobo, HABILIDADE_DOS_ROBOS } from './carrinhos/robo';
import {
  ACELERADOR_MAXIMO,
  FAIXA_DO_RECORDE,
  FAIXAS,
  FORA_PASSOS,
  gravador,
  IDS_DAS_PISTAS,
  leitor,
  noBox,
  novoCarro,
  passo,
  PASSO,
  pilotoAutomatico,
  pilotoComTroca,
  trechoEm,
  TROCA,
  VMAX,
  VOLTAS,
  type Carro,
  type Entradas,
  type Pista,
} from './carrinhos/sim';
import { EscolhaDaPistaDosCarrinhos, pistaDoEstado } from './carrinhos/EscolhaDaPista';
import type { CenaDosCarrinhos, QuadroDoCarro } from './carrinhos/cena';
import type { Agir } from './Minijogo';
import type { Partida } from './minijogos';
import './carrinhos/carrinhos.css';

/**
 * OS CARRINHOS DA TOCA (06/11/2026, pedido dele): a pista de carrinhos de brinquedo com quatro faixas, em 3D, com as peças do
 * Toy Car Kit da Kenney. Cada carro segue a SUA faixa sozinho; quem joga só tem o ACELERADOR (segurar Espaço, ↑, o botão do
 * mouse ou o dedo na tela; o gatilho do controle, analógico). Acelerou demais na curva, o carro treme (a folga) e depois sai
 * voando, fica fora 1,75 s e volta piscando ao lugar de onde saiu, parado. A regra é carrinhos/sim.ts, a mesma do servidor.
 * - NO SOLO, contra o relógio na faixa do recorde, com os fantasmas dos amigos e de 0 a 3 robôs nas outras faixas; o
 *   acelerador de cada passo vai ao servidor, que refaz a corrida e guarda o melhor tempo (server/src/minijogo-carrinhos.ts).
 * - NA SALA, cada um na sua faixa: o servidor dá o verde, repassa as posições e classifica pelo tempo de cada um, refeito.
 * - AS PISTAS (19/11/2026): cinco prontas, as do editor pelo código e a resistência de 20 voltas, escolhidas em
 *   carrinhos/EscolhaDaPista.tsx (no Solo, aqui dentro; na sala, antes do convite, por Minijogo.tsx).
 */

export interface EstadoCarrinhos {
  fase: 'escolha' | 'correndo' | 'resultado' | 'largada' | 'fim';
  solo: boolean;
  voltasDaCorrida: number;
  partidaId: string;
  /** A pista: o id (pronta, ou "p-…" do editor) e o traçado, que o site monta com a mesma regra. */
  pista?: string;
  tracado?: string;
  /** No Solo: os meus tempos nas pistas prontas (a chave do recorde: o id, com "@20c" na resistência). */
  meusTempos?: Record<string, number>;
  // o Solo
  recordes?: { userId: number; nome: string; avatar: number | string | null; tempoMs: number }[];
  meuAvatar?: number | string | null;
  meuNome?: string;
  fantasmas?: { userId: number; nome: string; avatar: number | string | null; tempoMs: number; entradas: number[] }[];
  robos?: number;
  rodada?: number;
  resultado?: { tempoMs: number; voltas: number[]; saidas: number; recorde: boolean; anterior: number | null } | null;
  // a sala
  pilotos?: { userId: number; username: string; faixa: number; tempoMs: number | null; voltas: number[]; posicao: number | null; avatar: number | string | null }[];
  prazo?: boolean;
}

const MAX_FANTASMAS = 3;
const CONTAGEM = 3 * 60;
const MEDALHAS = ['🥇', '🥈', '🥉'];
/** Os avatares prontos dos robôs (só as cores do coelho). */
const AVATARES_DOS_ROBOS = [5, 9, 13];
/** Os nomes dos robôs, os mesmos dos outros jogos (NOMES_DOS_ROBOS em server/src/minijogo-robos.ts): próprios, sem tradução. */
const NOMES_DOS_ROBOS = ['Tico', 'Lola', 'Bento'];

declare global {
  interface Window {
    /** Só no site de desenvolvimento: o e2e liga o piloto automático e lê o carro. */
    carrinhosPilotoAutomatico?: boolean;
    carrinhosDoTeste?: Carro;
  }
}

/** O ACELERADOR: teclado, mouse e toque dão tudo ou nada; o gatilho do controle dá o meio-termo. */
function useAcelerador(ativo: boolean) {
  const apertado = useRef({ tecla: false, ponteiro: false });
  /** A TROCA DE FAIXA (24/11/2026): um toque guardado até o próximo passo da corrida. */
  const troca = useRef(false);
  const padAntes = useRef(false);
  useEffect(() => {
    if (!ativo) return;
    const tecla = (e: KeyboardEvent, desce: boolean) => {
      const alvo = e.target as HTMLElement | null;
      if (desce && alvo && (alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA' || alvo.isContentEditable || alvo.tagName === 'BUTTON')) return;
      const k = e.key.toLowerCase();
      if (k === ' ' || k === 'arrowup' || k === 'w') {
        apertado.current.tecla = desce;
        e.preventDefault();
      } else if (k === 'shift' || k === 'arrowdown' || k === 's' || k === 'x') {
        if (desce && !e.repeat) troca.current = true;
        e.preventDefault();
      }
    };
    const desce = (e: KeyboardEvent) => tecla(e, true);
    const sobe = (e: KeyboardEvent) => tecla(e, false);
    const soltar = () => Object.assign(apertado.current, { tecla: false, ponteiro: false });
    const escondeu = () => document.hidden && soltar();
    window.addEventListener('keydown', desce);
    window.addEventListener('keyup', sobe);
    window.addEventListener('blur', soltar);
    document.addEventListener('visibilitychange', escondeu);
    return () => {
      window.removeEventListener('keydown', desce);
      window.removeEventListener('keyup', sobe);
      window.removeEventListener('blur', soltar);
      document.removeEventListener('visibilitychange', escondeu);
      soltar();
    };
  }, [ativo]);
  const ler = (): number => {
    if (apertado.current.tecla || apertado.current.ponteiro) return ACELERADOR_MAXIMO;
    // o controle de videogame (controleDosJogos.ts): o A acelera tudo; o gatilho direito, o meio-termo
    const pad = lerControle();
    if (!pad) return 0;
    if (pad.a) return ACELERADOR_MAXIMO;
    return pad.acelerar > 0.05 ? Math.round(pad.acelerar * ACELERADOR_MAXIMO) : 0;
  };
  const ponteiro = {
    onPointerDown: (e: React.PointerEvent) => {
      apertado.current.ponteiro = true;
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    },
    onPointerUp: () => (apertado.current.ponteiro = false),
    onPointerCancel: () => (apertado.current.ponteiro = false),
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  };
  /** O toque da troca de faixa desde a última leitura (teclado, o botão da tela ou o X do controle). */
  const lerTroca = (): boolean => {
    const x = !!lerControle()?.x;
    if (x && !padAntes.current) troca.current = true;
    padAntes.current = x;
    const t = troca.current;
    troca.current = false;
    return t;
  };
  const tocarTroca = () => (troca.current = true);
  return { ler, lerTroca, tocarTroca, ponteiro };
}

interface Painel {
  volta: number;
  ms: number;
  acelerador: number;
  derrapa: boolean;
  fora: boolean;
  contagem: number | null;
  ordem: { id: string; nome: string; eu: boolean }[];
  /** O tanque (de 0 a 1) na resistência, e se estou parado no box enchendo; null nas corridas de 5 voltas. */
  combustivel: number | null;
  enchendo: boolean;
  /** A troca de faixa armada (só nas pistas com agulha). */
  armado: boolean;
}

/** Um rival da sala: as posições que o servidor repassou, pelo passo da corrida dele. */
interface Rival {
  nome: string;
  faixa: number;
  avatar: number | string | null;
  /** As posições: o passo, a distância NA FAIXA `x` (a de agora, que muda na agulha) e `e`, a de onde veio na agulha (−1). */
  posicoes: { n: number; s: number; f: number; d: number; x: number; e: number }[];
  /** O passo (no meu relógio) em que ele saiu da pista, para o desenho do voo. */
  saiuEm: number | null;
  chegou: boolean;
}

interface ConfigDaCorrida {
  caixa: HTMLElement;
  pista: Pista;
  /** Quantas voltas tem a corrida (5, ou 20 na resistência). */
  voltas: number;
  /** A minha faixa, ou null para quem só assiste. */
  minhaFaixa: number | null;
  meuNome: string;
  minhasCores: Promise<CoresDoCoelho>;
  robos: { faixa: number; semente: number; habilidade: number; nome: string; avatar: number }[];
  fantasmas: { nome: string; entradas: Entradas }[];
  rivais?: Map<number, Rival>;
  contagem: number;
  pausa?: Pausa;
  ler: () => number;
  /** O toque da troca de faixa (só nas pistas com agulha). */
  lerTroca?: () => boolean;
  aoPainel: (p: Painel) => void;
  aoChegar: (entradas: Entradas, ordem: Painel['ordem']) => void;
  aoPosicao?: (dados: { n: number; s: number; f: number; d: number; x: number; e: number }) => void;
  aoPronta: () => void;
  aoFalhar: () => void;
}

/** A pista tem agulha (a troca de faixa, 24/11/2026)? */
const temAgulha = (pista: Pista) => pista.trechos[0].some((t) => t.troca);

/** Até onde à frente (em unidades da pista; a reta tem 4) a marca da curva aparece. */
const ALCANCE_DA_MARCA = 6;

/** O laço da corrida (Solo e sala): a física a 60 por segundo, a cena no ritmo da tela. Devolve quem para tudo. */
function rodarCorrida(cfg: ConfigDaCorrida): () => void {
  let viva = true;
  let cena: CenaDosCarrinhos | null = null;
  let id = 0;
  const motor = cfg.minhaFaixa !== null ? criarMotor() : null;
  const eu = cfg.minhaFaixa !== null ? novoCarro(cfg.minhaFaixa, cfg.pista, cfg.voltas) : null;
  if (eu && import.meta.env.DEV) window.carrinhosDoTeste = eu;
  const gravar = gravador();
  const robos = cfg.robos.map((r) => ({ ...r, carro: novoCarro(r.faixa, cfg.pista, cfg.voltas), piloto: criarRobo(r.semente, r.habilidade) }));
  /** A pista tem agulha: a troca de faixa vale (o toque vai junto com o acelerador, `TROCA`). */
  const temAgulha = cfg.pista.trechos[0].some((t) => t.troca);
  const fantasmas = cfg.fantasmas.map((f) => ({ ...f, carro: novoCarro(FAIXA_DO_RECORDE, cfg.pista, cfg.voltas), ler: leitor(f.entradas) }));
  const rivais = cfg.rivais ? [...cfg.rivais.entries()] : [];
  let antes = new Map<Carro, number>();
  /** A faixa de cada carro no passo anterior: trocou na agulha, a distância de antes é de outra faixa. */
  let faixaAntes = new Map<Carro, number>();
  let mandou = false;
  let ordemFinal: Painel['ordem'] | null = null;
  let ultimoPainel = 0;
  let ultimaDerrapa = 0;
  let contagem = cfg.contagem;
  let semFoco = 0;
  /** O acelerador do último passo (o medidor do painel mostra o que foi usado, inclusive pelo piloto automático). */
  let ultimoG = 0;
  /** Quem pediu menos movimento: a marca da curva não pulsa e o aparelho não vibra. */
  const calmo = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  let tremiaAntes = false;

  /**
   * A CURVA CHEGANDO (20/11/2026): a próxima curva da minha faixa a até ALCANCE_DA_MARCA (a de agora não conta: já se está
   * nela), com o lugar em que ela começa; `solte` quando o piloto automático, sem margem nenhuma, já soltaria o acelerador.
   */
  const curvaAFrente = (c: Carro) => {
    const v = cfg.pista.volta[c.faixa];
    const atual = trechoEm(cfg.pista, c.faixa, c.s);
    for (let k = 0.25; k <= ALCANCE_DA_MARCA; k += 0.25) {
      const t = trechoEm(cfg.pista, c.faixa, c.s + k);
      if (t === atual || t.sentido === 0) continue;
      const d = c.s + k - Math.floor((c.s + k) / v) * v;
      return { s: c.s + k - (d - t.inicio), solte: pilotoAutomatico(c, 0) === 0 };
    }
    return null;
  };

  const todos = (): Carro[] => [...(eu ? [eu] : []), ...robos.map((r) => r.carro), ...fantasmas.map((f) => f.carro)];

  /** O passo de agora da corrida (para os rivais da sala): o meu, ou o relógio de quem assiste. */
  let nAssistindo = 0;
  const nAgora = () => (eu ? eu.passo : nAssistindo);

  const posicaoDoRival = (r: Rival, n: number): { s: number; f: number; d: number; x: number; e: number } | null => {
    const l = r.posicoes;
    if (!l.length) return null;
    if (n <= l[0].n) return l[0];
    for (let i = l.length - 1; i > 0; i--) {
      if (l[i - 1].n <= n && n <= l[i].n) {
        const a = l[i - 1], b = l[i];
        // trocou de faixa no meio: a distância é de outra faixa, sem meio-termo
        if (a.x !== b.x) return b;
        const k = (n - a.n) / Math.max(1, b.n - a.n);
        return { s: a.s + (b.s - a.s) * k, f: b.f, d: b.d, x: b.x, e: b.e };
      }
    }
    return l[l.length - 1];
  };

  const ordem = (): Painel['ordem'] => {
    const linhas: { id: string; nome: string; eu: boolean; chegou: number | null; andou: number }[] = [];
    if (eu) linhas.push({ id: 'eu', nome: cfg.meuNome, eu: true, chegou: eu.chegou ? eu.voltas[cfg.voltas - 1] : null, andou: eu.s / cfg.pista.volta[eu.faixa] });
    robos.forEach((r, i) => linhas.push({ id: `robo${i}`, nome: r.nome, eu: false, chegou: r.carro.chegou ? r.carro.voltas[cfg.voltas - 1] : null, andou: r.carro.s / cfg.pista.volta[r.faixa] }));
    for (const [uid, r] of rivais) {
      const p = r.posicoes.at(-1);
      linhas.push({ id: `r${uid}`, nome: r.nome, eu: false, chegou: null, andou: p ? p.s / cfg.pista.volta[p.x] : 0 });
    }
    linhas.sort((a, b) => (a.chegou !== null && b.chegou !== null ? a.chegou - b.chegou : a.chegou !== null ? -1 : b.chegou !== null ? 1 : b.andou - a.andou));
    return linhas.map(({ id, nome, eu }) => ({ id, nome, eu }));
  };

  void import('./carrinhos/cena')
    .then(async ({ CenaDosCarrinhos }) => {
      if (!viva) return;
      cena = new CenaDosCarrinhos(cfg.caixa, cfg.pista);
      const minhas = eu ? await cfg.minhasCores : null;
      if (!viva) return;
      await cena.montar([
        ...(eu && minhas ? [{ faixa: eu.faixa, cores: minhas, eu: true }] : []),
        ...robos.map((r) => ({ faixa: r.faixa, cores: coresDoAvatar(r.avatar) })),
        ...fantasmas.map(() => ({ faixa: FAIXA_DO_RECORDE, cores: null, fantasma: true })),
        ...rivais.map(([, r]) => ({ faixa: r.faixa, cores: coresDoAvatar(r.avatar) })),
      ]);
      if (!viva) return;
      cfg.aoPronta();
      let ultimo = performance.now();
      let acumulado = 0;
      const quadro = () => {
        if (!viva || !cena) return;
        id = requestAnimationFrame(quadro);
        const agora = performance.now();
        const dt = Math.min(0.1, (agora - ultimo) / 1000);
        ultimo = agora;
        // sem foco (o jogo de verdade, outra janela), escondida ou pausada (ESC): nem física, nem desenho, nem motor
        if (document.hidden || !document.hasFocus() || cfg.pausa?.ativa) {
          motor?.ajustar(0);
          if (!semFoco) semFoco = agora;
          return;
        }
        semFoco = 0;
        acumulado += dt;
        let n = 0;
        while (acumulado >= PASSO && n < 6) {
          acumulado -= PASSO;
          n++;
          if (contagem > 0) {
            contagem--;
            if (contagem % 60 === 0) tocar(contagem === 0 ? 'acerto' : 'clique');
            continue;
          }
          antes = new Map(todos().map((c) => [c, c.s]));
          faixaAntes = new Map(todos().map((c) => [c, c.faixa]));
          nAssistindo++;
          if (eu && !eu.chegou) {
            const toque = temAgulha && !!cfg.lerTroca?.();
            const g = import.meta.env.DEV && window.carrinhosPilotoAutomatico ? pilotoComTroca(eu, 0.3) : cfg.ler() + (toque ? TROCA : 0);
            gravar.anotar(g);
            ultimoG = g % TROCA;
            const ev = passo(eu, g);
            if (ev === 'saiu') tocar('queda');
            else if (ev === 'voltou') tocar('mola');
            else if (ev === 'volta') tocar('moeda');
            else if (ev === 'chegou') {
              tocar('chegada');
              ordemFinal = ordem();
            }
            if (eu.derrapa > 0 && agora - ultimaDerrapa > 260) {
              ultimaDerrapa = agora;
              tocar('derrapa');
            }
            // o tremor no limite: uma vibração curta, quando começa (o celular que vibra; nada com "menos movimento")
            const treme = eu.derrapa > 0;
            if (treme && !tremiaAntes && !calmo) navigator.vibrate?.(25);
            tremiaAntes = treme;
            if (eu.passo % 4 === 0 || ev === 'chegou') cfg.aoPosicao?.({ n: eu.passo, s: eu.s, f: eu.fora > 0 ? 1 : 0, d: eu.derrapa, x: eu.faixa, e: eu.de });
          } else if (eu) passo(eu, 0);
          for (const r of robos) passo(r.carro, r.piloto(r.carro));
          for (const f of fantasmas) passo(f.carro, f.ler());
        }
        if (n === 6) acumulado = 0;
        const k = contagem > 0 ? 1 : Math.min(1, acumulado / PASSO);
        const desenho = (c: Carro): QuadroDoCarro => {
          const a = antes.get(c) ?? c.s;
          // na agulha em que trocou, a distância de antes é de outra faixa: sem meio-termo
          const s = (faixaAntes.get(c) ?? c.faixa) !== c.faixa ? c.s : a + (c.s - a) * k;
          return { s, fora: c.fora, pisca: c.pisca, derrapa: c.derrapa, saiuA: c.saiuA, faixa: c.faixa, de: c.de };
        };
        const nR = nAgora() - 6;
        const quadros: QuadroDoCarro[] = [
          ...(eu ? [desenho(eu)] : []),
          ...robos.map((r) => desenho(r.carro)),
          ...fantasmas.map((f) => desenho(f.carro)),
          ...rivais.map(([, r]) => {
            const p = posicaoDoRival(r, nR);
            if (!p) return { s: 0, fora: 0, pisca: 0, derrapa: 0, saiuA: 0, escondido: contagem === 0 };
            if (p.f && r.saiuEm === null) r.saiuEm = nR;
            if (!p.f) r.saiuEm = null;
            const fora = p.f && r.saiuEm !== null ? Math.max(1, FORA_PASSOS - (nR - r.saiuEm)) : 0;
            return { s: p.s, fora, pisca: 0, derrapa: p.d, saiuA: 8, faixa: p.x, de: p.e };
          }),
        ];
        const curva = eu && !eu.chegou && eu.fora === 0 && contagem === 0 ? curvaAFrente(eu) : null;
        cena.marcarCurva(curva && eu ? { faixa: eu.faixa, s: curva.s, solte: curva.solte, calmo } : null);
        // O BOX da resistência (21/11/2026): o trecho antes da linha, marcado na minha faixa enquanto o tanque não está cheio
        cena.marcarBox(eu && eu.combustivel !== null && !eu.chegou && eu.combustivel < 0.999 ? eu.faixa : null);
        cena.desenhar(quadros, dt);
        motor?.ajustar(eu && !eu.chegou && eu.fora === 0 && contagem === 0 ? eu.v / VMAX : 0);
        if (agora - ultimoPainel > 90) {
          ultimoPainel = agora;
          cfg.aoPainel({
            volta: eu ? Math.min(cfg.voltas, eu.voltas.length + 1) : 0,
            ms: eu ? Math.round(((eu.chegou ? eu.voltas[cfg.voltas - 1] : eu.passo) * 1000) / 60) : 0,
            acelerador: eu && !eu.chegou ? (contagem > 0 ? cfg.ler() : ultimoG) : 0,
            derrapa: !!eu && eu.derrapa > 0,
            fora: !!eu && eu.fora > 0,
            contagem: contagem > 0 ? Math.ceil(contagem / 60) : null,
            ordem: ordemFinal ?? ordem(),
            combustivel: eu && !eu.chegou ? eu.combustivel : null,
            enchendo: !!eu && eu.combustivel !== null && eu.v === 0 && noBox(eu) && eu.combustivel < 1 && contagem === 0,
            armado: !!eu && temAgulha && eu.armado,
          });
        }
        if (eu?.chegou && !mandou) {
          mandou = true;
          cfg.aoChegar(gravar.entradas, ordemFinal ?? ordem());
        }
      };
      id = requestAnimationFrame(quadro);
    })
    .catch(() => {
      cena?.destruir();
      cena = null;
      if (viva) cfg.aoFalhar();
    });
  return () => {
    viva = false;
    cancelAnimationFrame(id);
    motor?.parar();
    cena?.destruir();
  };
}


function Comandos({ solo = false, agulha = false }: { solo?: boolean; agulha?: boolean }) {
  const t = useT();
  return (
    <ComandosDoJogo
      itens={[
        { teclas: ['espaco', 'setas'], toque: 'toque-segurar', rotulo: t('Acelerar') },
        ...(agulha ? [{ teclas: ['x' as const], rotulo: t('Troca de faixa') }] : []),
        ...(solo ? [comandoDaPausa(t)] : []),
      ]}
    />
  );
}

/** A tela da corrida: a cena, o painel por cima e a área de acelerar (a tela inteira). */
function Corrida({
  config,
  solo,
  ligada,
  aoChegar,
  aoPosicao,
}: {
  config: Omit<ConfigDaCorrida, 'caixa' | 'ler' | 'aoPainel' | 'aoPronta' | 'aoFalhar' | 'aoChegar' | 'aoPosicao' | 'pausa'>;
  solo: boolean;
  ligada: boolean;
  aoChegar: (entradas: Entradas, ordem: Painel['ordem']) => void;
  aoPosicao?: ConfigDaCorrida['aoPosicao'];
}) {
  const t = useT();
  const caixa = useRef<HTMLDivElement>(null);
  const [estado, setEstado] = useState<'carregando' | 'pronta' | 'falhou'>(() => (temWebGL() ? 'carregando' : 'falhou'));
  const [painel, setPainel] = useState<Painel | null>(null);
  const [chegou, setChegou] = useState(false);
  const acelerador = useAcelerador(ligada && !chegou);
  const { pausa, pausado, continuar } = usePausaComEsc(solo && ligada && !chegou && estado === 'pronta');
  const chegar = useRef(aoChegar);
  chegar.current = aoChegar;
  const posicao = useRef(aoPosicao);
  posicao.current = aoPosicao;

  useEffect(() => {
    if (estado === 'falhou' || !caixa.current) return;
    return rodarCorrida({
      ...config,
      caixa: caixa.current,
      pausa,
      ler: acelerador.ler,
      lerTroca: acelerador.lerTroca,
      aoPainel: setPainel,
      aoPronta: () => setEstado('pronta'),
      aoFalhar: () => setEstado('falhou'),
      aoChegar: (e, o) => {
        setChegou(true);
        chegar.current(e, o);
      },
      aoPosicao: (d) => posicao.current?.(d),
    });
    // a corrida é uma por montagem (a `key` de quem chama)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado === 'falhou']);

  if (estado === 'falhou') return <p className="minijogo-situacao">{t('Este jogo precisa de gráficos 3D, que não abriram neste aparelho.')}</p>;
  const piloto = config.minhaFaixa !== null;
  return (
    <div className="carrinhos-moldura" {...(piloto && ligada ? acelerador.ponteiro : {})}>
      <div ref={caixa} className={`carrinhos-caixa${estado === 'pronta' ? '' : ' escondida'}`} />
      {estado === 'pronta' && painel && (
        <div className="carrinhos-painel" aria-hidden="true">
          {piloto && (
            <>
              <span className="carrinhos-volta">🏁 {painel.volta}/{config.voltas}</span>
              <span className="carrinhos-relogio">{tempoLegivel(painel.ms)}</span>
              <span className={`carrinhos-medidor${painel.derrapa ? ' no-limite' : ''}`}>
                <span style={{ height: `${(painel.acelerador / ACELERADOR_MAXIMO) * 100}%` }} />
              </span>
              {painel.combustivel !== null && (
                <span className={`carrinhos-tanque${painel.combustivel < 0.2 ? ' baixo' : ''}${painel.enchendo ? ' enchendo' : ''}`}>
                  <span className="carrinhos-tanque-icone">⛽</span>
                  <span className="carrinhos-tanque-barra">
                    <span style={{ height: `${painel.combustivel * 100}%` }} />
                  </span>
                </span>
              )}
            </>
          )}
          {piloto && config.pista.trechos[0].some((t) => t.troca) && (
            <button
              type="button"
              className={`carrinhos-troca${painel.armado ? ' armada' : ''}`}
              aria-label={t('Troca de faixa')}
              aria-pressed={painel.armado}
              onPointerDown={(e) => {
                e.stopPropagation();
                acelerador.tocarTroca();
              }}
            >
              <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
                <path d="M8 22 V2 M8 17 L16 7 V2" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M12.5 4.5 L16 1.5 L19.5 4.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
          {piloto && painel.combustivel !== null && painel.combustivel < 0.2 && !painel.enchendo && <span className="carrinhos-aviso carrinhos-aviso-box">{t('Pare no box, antes da linha, para encher o tanque.')}</span>}
          {painel.ordem.length > 1 && !chegou && (
            <ol className="carrinhos-ordem">
              {painel.ordem.map((l, i) => (
                <li key={l.id} className={l.eu ? 'eu' : undefined}>
                  <span>{i + 1}</span> {l.nome}
                </li>
              ))}
            </ol>
          )}
          {painel.fora && <span className="carrinhos-aviso">{t('Saiu da pista!')}</span>}
          {painel.contagem !== null && <span className="carrinhos-contagem">{painel.contagem}</span>}
        </div>
      )}
      {pausado && <TelaDePausa aoContinuar={continuar} />}
    </div>
  );
}

export function JogoCarrinhos(props: { estado: EstadoCarrinhos & Partida; eu: number; jogador: boolean; restante: number; agir: Agir; socket: Socket | null; channelId: number }) {
  return props.estado.solo ? <CarrinhosSolo {...props} /> : <CarrinhosNaSala {...props} />;
}

// =====================================================================================================================
// O SOLO
// =====================================================================================================================

const NOME_DA_DIFICULDADE: Record<Dificuldade, string> = { facil: chave('Fácil'), medio: chave('Médio'), dificil: chave('Difícil') };

/** As pistas do campeonato: os cinco traçados de 20/11/2026 (a Agulha, de 24/11, fica fora: o texto diz "os cinco"). */
const PISTAS_DO_CAMPEONATO = IDS_DAS_PISTAS.slice(0, 5);
/** Os pontos do CAMPEONATO por posição entre os quatro carros. */
const PONTOS_DO_CAMPEONATO = [10, 6, 3, 1];
/** Os ids da ordem da corrida ('eu', 'robo0'…) como números, para somar os pontos (−1 a pessoa, −100 − i os robôs). */
const idDaOrdem = (id: string) => (id === 'eu' ? -1 : -100 - Number(id.slice(4)));

/**
 * O CAMPEONATO DO SOLO (20/11/2026, a segunda auditoria): os cinco traçados prontos seguidos, em 5 voltas, contra três robôs,
 * com pontos pela posição e o pódio no fim. Mora só no site, como a copa do Jato: cada corrida é uma corrida do Solo como as
 * outras (o servidor refaz e guarda o recorde, porque os robôs nunca tocam o carro de quem joga), e o campeonato só soma.
 */
interface Campeonato {
  indice: number;
  pontos: PontosNaCopa[];
  /** A corrida desta pista já entrou nos pontos. */
  somada: boolean;
}

function CarrinhosSolo({ estado, eu, agir }: { estado: EstadoCarrinhos & Partida; eu: number; agir: Agir }) {
  const t = useT();
  const [dificuldade, setDificuldade] = useState<Dificuldade>('medio');
  const [campeonatoEscolhido, setCampeonatoEscolhido] = useState(false);
  const [campeonato, setCampeonato] = useState<Campeonato | null>(null);
  const recordes = estado.recordes ?? [];
  const [escolhidos, setEscolhidos] = useState<Set<number> | null>(null);
  const [robos, setRobos] = useState(estado.robos ?? 3);
  const [erro, setErro] = useState<string | null>(null);
  const [ordemFinal, setOrdemFinal] = useState<Painel['ordem'] | null>(null);
  const meuNome = estado.meuNome ?? '';
  const pista = pistaDoEstado(estado);
  const voltas = estado.voltasDaCorrida;
  // trocou de pista ou de voltas: os fantasmas marcados voltam ao de fábrica (os recordes são outros)
  const escolhaDaPista = `${pista.id}|${voltas}`;
  const [escolhaVista, setEscolhaVista] = useState(escolhaDaPista);
  if (escolhaVista !== escolhaDaPista) {
    setEscolhaVista(escolhaDaPista);
    setEscolhidos(null);
  }

  const marcados = (() => {
    if (escolhidos) return escolhidos;
    const meu = recordes.findIndex((r) => r.userId === eu);
    const ate = meu < 0 ? recordes.length : meu;
    const acima = recordes.slice(Math.max(0, ate - (MAX_FANTASMAS - 1)), ate).map((r) => r.userId);
    return new Set([...(meu >= 0 ? [eu] : []), ...acima].slice(0, MAX_FANTASMAS));
  })();
  const tentar = (corpo: Record<string, unknown>) => {
    setErro(null);
    agir(corpo).catch((e) => setErro((e as Error).message));
  };
  const correr = () => {
    setOrdemFinal(null);
    tentar({ tipo: 'correr', fantasmas: [...marcados], robos });
  };
  /** Uma corrida do campeonato: a pista da vez, 5 voltas, os três robôs e nenhum fantasma. */
  const correrNoCampeonato = (indice: number) => {
    setOrdemFinal(null);
    tentar({ tipo: 'correr', pista: PISTAS_DO_CAMPEONATO[indice], voltas: VOLTAS, fantasmas: [], robos: FAIXAS - 1 });
  };
  const comecar = () => {
    if (campeonatoEscolhido) {
      setCampeonato({ indice: 0, pontos: [], somada: false });
      correrNoCampeonato(0);
    } else {
      setCampeonato(null);
      correr();
    }
  };
  const proximaDoCampeonato = () => {
    if (!campeonato) return;
    const indice = campeonato.indice + 1;
    setCampeonato({ ...campeonato, indice, somada: false });
    correrNoCampeonato(indice);
  };
  const ultimaDoCampeonato = campeonato ? campeonato.indice === PISTAS_DO_CAMPEONATO.length - 1 : true;
  /** O tempo do piloto (a régua das medalhas) na pista e nas voltas escolhidas; null nas do editor. */
  const baseDaMedalha = useMemo(() => tempoDoPilotoNosCarrinhos(pista.id, voltas), [pista.id, voltas]);
  const alternar = (id: number) => {
    const n = new Set(marcados);
    if (n.has(id)) n.delete(id);
    else if (n.size < MAX_FANTASMAS) n.add(id);
    setEscolhidos(n);
  };
  const meu = recordes.find((r) => r.userId === eu) ?? null;
  const outros = recordes.filter((r) => r.userId !== eu);

  if (estado.fase === 'escolha') {
    return (
      <div className="carrinhos">
        <div className="carrinhos-escolha">
          {meu && <span>{t('Seu recorde: {tempo}', { tempo: tempoLegivel(meu.tempoMs) })}</span>}
          <p className="settings-hint">{t('Segure para acelerar e solte antes da curva: quando o carro treme, ele está no limite.')}</p>
          <Comandos solo agulha={temAgulha(pista)} />
          <button
            type="button"
            className={`carrinhos-campeonato${campeonatoEscolhido ? ' escolhido' : ''}`}
            aria-pressed={campeonatoEscolhido}
            onClick={() => setCampeonatoEscolhido((c) => !c)}
          >
            <Trophy size={28} aria-hidden="true" />
            <span>
              <strong>{t('Campeonato')}</strong>
              <small>{t('Os cinco traçados seguidos contra o computador, com pontos.')}</small>
            </span>
          </button>
          {!campeonatoEscolhido && (
            <EscolhaDaPistaDosCarrinhos
              pista={pista.id}
              tracado={pista.tracado}
              voltas={voltas}
              meusTempos={estado.meusTempos}
              aoMudar={(pedido) => tentar({ tipo: 'escolher', ...pedido })}
            />
          )}
          {!campeonatoEscolhido && <MedalhasDaCorrida base={baseDaMedalha} fatores={FATORES_DOS_CARRINHOS} />}
          {(campeonatoEscolhido || robos > 0) && (
            <div className="minijogo-abas carrinhos-dificuldade" role="radiogroup" aria-label={t('Computador')}>
              {DIFICULDADES.map((d) => (
                <button key={d} type="button" role="radio" aria-checked={dificuldade === d} className={dificuldade === d ? 'ativa' : undefined} onClick={() => setDificuldade(d)}>
                  {t(NOME_DA_DIFICULDADE[d])}
                </button>
              ))}
            </div>
          )}
          {!campeonatoEscolhido && (
            <>
              <fieldset className="carrinhos-robos">
                <legend>
                  <IconeDeHud nome="robo" /> {t('Quantos adversários do computador?')}
                </legend>
                <div role="radiogroup">
                  {Array.from({ length: FAIXAS }, (_, n) => (
                    <button key={n} type="button" role="radio" aria-checked={robos === n} className={robos === n ? 'escolhido' : ''} onClick={() => setRobos(n)}>
                      {n}
                    </button>
                  ))}
                </div>
              </fieldset>
              <fieldset className="carrinhos-fantasmas">
                <legend>{t('Correr contra')}</legend>
                {recordes.length > 0 && (
                  <ul>
                    {recordes.map((r) => (
                      <li key={r.userId}>
                        <label>
                          <input type="checkbox" checked={marcados.has(r.userId)} disabled={!marcados.has(r.userId) && marcados.size >= MAX_FANTASMAS} onChange={() => alternar(r.userId)} />
                          <span className="carrinhos-quem">{r.nome}</span>
                          <span className="carrinhos-tempo">{tempoLegivel(r.tempoMs)}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
                {outros.length === 0 && <p className="settings-hint">{t('Nenhum amigo correu nesta pista ainda.')}</p>}
              </fieldset>
            </>
          )}
          <div className="minijogo-acoes">
            <button type="button" className="btn-primary" onClick={comecar}>
              {t('Começar')}
            </button>
          </div>
          {erro && <p className="form-error small">{erro}</p>}
        </div>
      </div>
    );
  }

  const r = estado.resultado;
  const nRobos = estado.robos ?? 0;
  const faixasDosRobos = Array.from({ length: FAIXAS }, (_, i) => i).filter((f) => f !== FAIXA_DO_RECORDE).slice(0, nRobos);
  const semente = (estado.rodada ?? 1) * 7919 + estado.partidaId.length;
  const minhaPosicao = ordemFinal ? ordemFinal.findIndex((l) => l.eu) : -1;
  return (
    <div className="carrinhos">
      {campeonato && (
        <div className="carrinhos-topo">
          <strong>{t('Campeonato')}</strong>
          <span>{t('Rodada {n} de {total}', { n: campeonato.indice + 1, total: PISTAS_DO_CAMPEONATO.length })}</span>
        </div>
      )}
      <Corrida
        key={`${estado.partidaId}-${estado.rodada ?? 0}`}
        solo
        ligada={estado.fase === 'correndo'}
        config={{
          pista,
          voltas,
          minhaFaixa: FAIXA_DO_RECORDE,
          meuNome,
          minhasCores: minhasCoresDoCoelho(),
          robos: faixasDosRobos.map((faixa, i) => ({
            faixa,
            semente: semente + i * 104729,
            habilidade: HABILIDADE_DOS_ROBOS[dificuldade][i] ?? 0.75,
            nome: `🤖 ${NOMES_DOS_ROBOS[i % NOMES_DOS_ROBOS.length]}`,
            avatar: AVATARES_DOS_ROBOS[i] ?? 1,
          })),
          fantasmas: (estado.fantasmas ?? []).map((f) => ({ nome: f.nome, entradas: f.entradas })),
          contagem: CONTAGEM,
        }}
        aoChegar={(entradas, ordem) => {
          setOrdemFinal(ordem);
          setCampeonato((c) =>
            c && !c.somada ? { ...c, somada: true, pontos: somarPontos(c.pontos, ordem.map((l) => ({ id: idDaOrdem(l.id), nome: l.nome, eu: l.eu })), PONTOS_DO_CAMPEONATO) } : c,
          );
          agir({ tipo: 'chegada', entradas }).catch((e) => setErro((e as Error).message));
        }}
      />
      {estado.fase === 'resultado' && r && (
        <div className="carrinhos-fim-solo">
          {nRobos > 0 && minhaPosicao >= 0 && <span className="carrinhos-posicao">{MEDALHAS[minhaPosicao] ?? `${minhaPosicao + 1}º`}</span>}
          {r.recorde && <strong className="carrinhos-recorde">{t('Novo recorde!')}</strong>}
          <span className="carrinhos-tempo grande">
            {tempoLegivel(r.tempoMs)} <MedalhasDaCorrida base={baseDaMedalha} tempoMs={r.tempoMs} fatores={FATORES_DOS_CARRINHOS} />
          </span>
          <ol className="carrinhos-voltas">
            {r.voltas.map((v, i) => (
              <li key={i}>
                🏁 {i + 1} · {tempoLegivel(v - (i ? r.voltas[i - 1] : 0))}
              </li>
            ))}
          </ol>
          {r.saidas > 0 && <span className="settings-hint">{t('Saídas da pista: {n}', { n: r.saidas })}</span>}
          {!r.recorde && r.anterior !== null && <span className="settings-hint">{t('Seu recorde: {tempo}', { tempo: tempoLegivel(r.anterior) })}</span>}
          {/* o campeonato: os pontos desta corrida e os somados; no fim, o pódio */}
          {campeonato && ordemFinal && (
            <ol className="carrinhos-classificacao carrinhos-campeonato-pontos">
              {campeonato.pontos.map((l, i) => {
                const nesta = ordemFinal.findIndex((o) => idDaOrdem(o.id) === l.id);
                return (
                  <li key={l.id} className={l.eu ? 'eu' : undefined}>
                    <span className="carrinhos-posicao">{ultimaDoCampeonato && i < 3 ? MEDALHAS[i] : i + 1}</span>
                    <span className="carrinhos-quem">{l.eu ? t('você') : l.nome}</span>
                    <small>+{PONTOS_DO_CAMPEONATO[nesta] ?? 0}</small>
                    <span className="carrinhos-tempo">{l.pontos}</span>
                  </li>
                );
              })}
            </ol>
          )}
          <div className="minijogo-acoes">
            {campeonato && !ultimaDoCampeonato ? (
              <button type="button" className="btn-primary" onClick={proximaDoCampeonato}>
                {t('Próxima pista')}
              </button>
            ) : (
              <button type="button" className="btn-primary" onClick={() => (campeonato ? comecar() : correr())}>
                {t('Jogar de novo')}
              </button>
            )}
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setCampeonato(null);
                tentar({ tipo: 'escolher' });
              }}
            >
              {campeonato ? t('Escolher a pista') : t('Correr contra')}
            </button>
          </div>
        </div>
      )}
      {estado.fase === 'correndo' && <Comandos solo />}
      {erro && <p className="form-error small">{erro}</p>}
    </div>
  );
}

// =====================================================================================================================
// NA SALA
// =====================================================================================================================

const marcaDoLugar = (posicao: number | null, chegou: boolean, ficaram: number) =>
  posicao === null ? '–' : chegou && ficaram >= 2 && posicao <= 3 ? MEDALHAS[posicao - 1] : posicao;

function CarrinhosNaSala({
  estado,
  eu,
  jogador,
  restante,
  agir,
  socket,
  channelId,
}: {
  estado: EstadoCarrinhos & Partida;
  eu: number;
  jogador: boolean;
  restante: number;
  agir: Agir;
  socket: Socket | null;
  channelId: number;
}) {
  const pilotos = estado.pilotos ?? [];
  const fim = estado.fase === 'fim' || estado.terminada;
  const meu = pilotos.find((p) => p.userId === eu);
  const piloto = jogador && !!meu;
  const [chegou, setChegou] = useState(false);
  const rivais = useRef<Map<number, Rival> | null>(null);
  if (!rivais.current) {
    rivais.current = new Map(
      pilotos.filter((p) => p.userId !== eu || !piloto).map((p) => [p.userId, { nome: p.username, faixa: p.faixa, avatar: p.avatar, posicoes: [], saiuEm: null, chegou: false }]),
    );
  }

  useEffect(() => {
    if (!socket) return;
    const chegada = (m: { channelId?: number; dados?: Record<string, unknown> }) => {
      if (m.channelId !== channelId || !m.dados || typeof m.dados.userId !== 'number') return;
      const r = rivais.current?.get(m.dados.userId);
      const { n, s, f, d, x, e } = m.dados as { n: number; s: number; f: number; d: number; x?: number; e?: number };
      if (!r || typeof n !== 'number' || typeof s !== 'number') return;
      const ultima = r.posicoes.at(-1);
      if (ultima && ultima.n >= n) return;
      const faixa = typeof x === 'number' && x >= 0 && x < FAIXAS ? x : r.faixa;
      r.posicoes.push({ n, s, f: f ? 1 : 0, d: typeof d === 'number' ? d : 0, x: faixa, e: typeof e === 'number' && e >= 0 && e < FAIXAS ? e : -1 });
      if (r.posicoes.length > 3000) r.posicoes.splice(0, 1500);
    };
    socket.on('minijogo:tempo-real', chegada);
    return () => {
      socket.off('minijogo:tempo-real', chegada);
    };
  }, [socket, channelId]);

  const contagem = useRef(estado.fase === 'largada' ? Math.max(0, Math.round((restante * 60) / 1000)) : 0);
  const comTempos = chegou || fim;
  const ficaram = pilotos.filter((p) => p.posicao !== null).length;
  return (
    <div className="carrinhos">
      {!fim && (
        <Corrida
          key={estado.partidaId}
          solo={false}
          ligada={piloto && !fim}
          config={{
            pista: pistaDoEstado(estado),
            voltas: estado.voltasDaCorrida,
            minhaFaixa: piloto ? meu!.faixa : null,
            meuNome: meu?.username ?? '',
            minhasCores: Promise.resolve(coresDoAvatar(meu?.avatar)),
            robos: [],
            fantasmas: [],
            rivais: rivais.current,
            contagem: contagem.current,
          }}
          aoChegar={(entradas) => {
            setChegou(true);
            void agir({ tipo: 'chegada', entradas });
          }}
          aoPosicao={(dados) => socket?.emit('minijogo:tempo-real', { channelId, dados })}
        />
      )}
      {comTempos && (
        <ol className="carrinhos-classificacao">
          {pilotos.map((p) => (
            <li key={p.userId} className={p.userId === eu ? 'eu' : undefined}>
              {/* a posição só no fim: antes, quem ainda corre pode fazer um tempo menor */}
              <span className="carrinhos-posicao">{fim ? marcaDoLugar(p.posicao, p.tempoMs !== null, ficaram) : ''}</span>
              <span className="carrinhos-quem">{p.username}</span>
              <span className="carrinhos-tempo">{p.tempoMs !== null ? tempoLegivel(p.tempoMs) : fim ? '—' : '…'}</span>
            </li>
          ))}
        </ol>
      )}
      {piloto && !fim && !chegou && <Comandos agulha={temAgulha(pistaDoEstado(estado))} />}
    </div>
  );
}
