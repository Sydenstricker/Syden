import { useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { ComandosDoJogo } from './ComandosDosJogos';
import { useT } from './i18n';
import { IconeDeHud } from './iconesDeHud';
import { comandoDaPausa, TelaDePausa, usePausaComEsc, type Pausa } from './pausaDosJogos';
import { criarMotor, tocar } from './somDosJogos';
import { coresDoAvatar, minhasCoresDoCoelho, type CoresDoCoelho } from './coelho3d';
import { tempoLegivel } from './jato/util';
import { criarRobo } from './carrinhos/robo';
import {
  ACELERADOR_MAXIMO,
  FAIXA_DO_RECORDE,
  FAIXAS,
  FORA_PASSOS,
  gravador,
  leitor,
  novoCarro,
  passo,
  PASSO,
  pilotoAutomatico,
  VMAX,
  VOLTA,
  VOLTAS,
  type Carro,
  type Entradas,
} from './carrinhos/sim';
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
 */

export interface EstadoCarrinhos {
  fase: 'escolha' | 'correndo' | 'resultado' | 'largada' | 'fim';
  solo: boolean;
  voltasDaCorrida: number;
  partidaId: string;
  // o Solo
  recordes?: { userId: number; nome: string; avatar: number | null; tempoMs: number }[];
  meuAvatar?: number | null;
  meuNome?: string;
  fantasmas?: { userId: number; nome: string; avatar: number | null; tempoMs: number; entradas: number[] }[];
  robos?: number;
  rodada?: number;
  resultado?: { tempoMs: number; voltas: number[]; saidas: number; recorde: boolean; anterior: number | null } | null;
  // a sala
  pilotos?: { userId: number; username: string; faixa: number; tempoMs: number | null; voltas: number[]; posicao: number | null; avatar: number | null }[];
  prazo?: boolean;
}

const MAX_FANTASMAS = 3;
const CONTAGEM = 3 * 60;
const MEDALHAS = ['🥇', '🥈', '🥉'];
/** Os avatares prontos dos robôs (só as cores do coelho). */
const AVATARES_DOS_ROBOS = [5, 9, 13];

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
  useEffect(() => {
    if (!ativo) return;
    const tecla = (e: KeyboardEvent, desce: boolean) => {
      const alvo = e.target as HTMLElement | null;
      if (desce && alvo && (alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA' || alvo.isContentEditable || alvo.tagName === 'BUTTON')) return;
      const k = e.key.toLowerCase();
      if (k === ' ' || k === 'arrowup' || k === 'w') {
        apertado.current.tecla = desce;
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
    // o gatilho direito do controle (ou o botão A, tudo)
    const pads = navigator.getGamepads?.() ?? [];
    for (const p of pads) {
      if (!p) continue;
      const gatilho = p.buttons[7]?.value ?? 0;
      if (p.buttons[0]?.pressed) return ACELERADOR_MAXIMO;
      if (gatilho > 0.05) return Math.round(gatilho * ACELERADOR_MAXIMO);
    }
    return 0;
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
  return { ler, ponteiro };
}

interface Painel {
  volta: number;
  ms: number;
  acelerador: number;
  derrapa: boolean;
  fora: boolean;
  contagem: number | null;
  ordem: { id: string; nome: string; eu: boolean }[];
}

/** Um rival da sala: as posições que o servidor repassou, pelo passo da corrida dele. */
interface Rival {
  nome: string;
  faixa: number;
  avatar: number | null;
  posicoes: { n: number; s: number; f: number; d: number }[];
  /** O passo (no meu relógio) em que ele saiu da pista, para o desenho do voo. */
  saiuEm: number | null;
  chegou: boolean;
}

interface ConfigDaCorrida {
  caixa: HTMLElement;
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
  aoPainel: (p: Painel) => void;
  aoChegar: (entradas: Entradas, ordem: Painel['ordem']) => void;
  aoPosicao?: (dados: { n: number; s: number; f: number; d: number }) => void;
  aoPronta: () => void;
  aoFalhar: () => void;
}

/** O laço da corrida (Solo e sala): a física a 60 por segundo, a cena no ritmo da tela. Devolve quem para tudo. */
function rodarCorrida(cfg: ConfigDaCorrida): () => void {
  let viva = true;
  let cena: CenaDosCarrinhos | null = null;
  let id = 0;
  const motor = cfg.minhaFaixa !== null ? criarMotor() : null;
  const eu = cfg.minhaFaixa !== null ? novoCarro(cfg.minhaFaixa) : null;
  if (eu && import.meta.env.DEV) window.carrinhosDoTeste = eu;
  const gravar = gravador();
  const robos = cfg.robos.map((r) => ({ ...r, carro: novoCarro(r.faixa), piloto: criarRobo(r.semente, r.habilidade) }));
  const fantasmas = cfg.fantasmas.map((f) => ({ ...f, carro: novoCarro(FAIXA_DO_RECORDE), ler: leitor(f.entradas) }));
  const rivais = cfg.rivais ? [...cfg.rivais.entries()] : [];
  let antes = new Map<Carro, number>();
  let mandou = false;
  let ordemFinal: Painel['ordem'] | null = null;
  let ultimoPainel = 0;
  let ultimaDerrapa = 0;
  let contagem = cfg.contagem;
  let semFoco = 0;
  /** O acelerador do último passo (o medidor do painel mostra o que foi usado, inclusive pelo piloto automático). */
  let ultimoG = 0;

  const todos = (): Carro[] => [...(eu ? [eu] : []), ...robos.map((r) => r.carro), ...fantasmas.map((f) => f.carro)];

  /** O passo de agora da corrida (para os rivais da sala): o meu, ou o relógio de quem assiste. */
  let nAssistindo = 0;
  const nAgora = () => (eu ? eu.passo : nAssistindo);

  const posicaoDoRival = (r: Rival, n: number): { s: number; f: number; d: number } | null => {
    const l = r.posicoes;
    if (!l.length) return null;
    if (n <= l[0].n) return l[0];
    for (let i = l.length - 1; i > 0; i--) {
      if (l[i - 1].n <= n && n <= l[i].n) {
        const a = l[i - 1], b = l[i];
        const k = (n - a.n) / Math.max(1, b.n - a.n);
        return { s: a.s + (b.s - a.s) * k, f: b.f, d: b.d };
      }
    }
    return l[l.length - 1];
  };

  const ordem = (): Painel['ordem'] => {
    const linhas: { id: string; nome: string; eu: boolean; chegou: number | null; andou: number }[] = [];
    if (eu) linhas.push({ id: 'eu', nome: cfg.meuNome, eu: true, chegou: eu.chegou ? eu.voltas[VOLTAS - 1] : null, andou: eu.s / VOLTA[eu.faixa] });
    robos.forEach((r, i) => linhas.push({ id: `robo${i}`, nome: r.nome, eu: false, chegou: r.carro.chegou ? r.carro.voltas[VOLTAS - 1] : null, andou: r.carro.s / VOLTA[r.faixa] }));
    for (const [uid, r] of rivais) {
      const p = r.posicoes.at(-1);
      linhas.push({ id: `r${uid}`, nome: r.nome, eu: false, chegou: null, andou: p ? p.s / VOLTA[r.faixa] : 0 });
    }
    linhas.sort((a, b) => (a.chegou !== null && b.chegou !== null ? a.chegou - b.chegou : a.chegou !== null ? -1 : b.chegou !== null ? 1 : b.andou - a.andou));
    return linhas.map(({ id, nome, eu }) => ({ id, nome, eu }));
  };

  void import('./carrinhos/cena')
    .then(async ({ CenaDosCarrinhos }) => {
      if (!viva) return;
      cena = new CenaDosCarrinhos(cfg.caixa);
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
          nAssistindo++;
          if (eu && !eu.chegou) {
            const g = import.meta.env.DEV && window.carrinhosPilotoAutomatico ? pilotoAutomatico(eu, 0.3) : cfg.ler();
            gravar.anotar(g);
            ultimoG = g;
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
            if (eu.passo % 4 === 0 || ev === 'chegou') cfg.aoPosicao?.({ n: eu.passo, s: eu.s, f: eu.fora > 0 ? 1 : 0, d: eu.derrapa });
          } else if (eu) passo(eu, 0);
          for (const r of robos) passo(r.carro, r.piloto(r.carro));
          for (const f of fantasmas) passo(f.carro, f.ler());
        }
        if (n === 6) acumulado = 0;
        const k = contagem > 0 ? 1 : Math.min(1, acumulado / PASSO);
        const desenho = (c: Carro): QuadroDoCarro => {
          const a = antes.get(c) ?? c.s;
          return { s: a + (c.s - a) * k, fora: c.fora, pisca: c.pisca, derrapa: c.derrapa, saiuA: c.saiuA };
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
            return { s: p.s, fora, pisca: 0, derrapa: p.d, saiuA: 8 };
          }),
        ];
        cena.desenhar(quadros, dt);
        motor?.ajustar(eu && !eu.chegou && eu.fora === 0 && contagem === 0 ? eu.v / VMAX : 0);
        if (agora - ultimoPainel > 90) {
          ultimoPainel = agora;
          cfg.aoPainel({
            volta: eu ? Math.min(VOLTAS, eu.voltas.length + 1) : 0,
            ms: eu ? Math.round(((eu.chegou ? eu.voltas[VOLTAS - 1] : eu.passo) * 1000) / 60) : 0,
            acelerador: eu && !eu.chegou ? (contagem > 0 ? cfg.ler() : ultimoG) : 0,
            derrapa: !!eu && eu.derrapa > 0,
            fora: !!eu && eu.fora > 0,
            contagem: contagem > 0 ? Math.ceil(contagem / 60) : null,
            ordem: ordemFinal ?? ordem(),
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

function temWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

function Comandos({ solo = false }: { solo?: boolean }) {
  const t = useT();
  return (
    <ComandosDoJogo
      itens={[{ teclas: ['espaco', 'setas'], toque: 'toque-segurar', rotulo: t('Acelerar') }, ...(solo ? [comandoDaPausa(t)] : [])]}
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
              <span className="carrinhos-volta">🏁 {painel.volta}/{VOLTAS}</span>
              <span className="carrinhos-relogio">{tempoLegivel(painel.ms)}</span>
              <span className={`carrinhos-medidor${painel.derrapa ? ' no-limite' : ''}`}>
                <span style={{ height: `${(painel.acelerador / ACELERADOR_MAXIMO) * 100}%` }} />
              </span>
            </>
          )}
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

function CarrinhosSolo({ estado, eu, agir }: { estado: EstadoCarrinhos & Partida; eu: number; agir: Agir }) {
  const t = useT();
  const recordes = estado.recordes ?? [];
  const [escolhidos, setEscolhidos] = useState<Set<number> | null>(null);
  const [robos, setRobos] = useState(estado.robos ?? 3);
  const [erro, setErro] = useState<string | null>(null);
  const [ordemFinal, setOrdemFinal] = useState<Painel['ordem'] | null>(null);
  const meuNome = estado.meuNome ?? '';

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
          <Comandos solo />
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
          <div className="minijogo-acoes">
            <button type="button" className="btn-primary" onClick={correr}>
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
      <Corrida
        key={`${estado.partidaId}-${estado.rodada ?? 0}`}
        solo
        ligada={estado.fase === 'correndo'}
        config={{
          minhaFaixa: FAIXA_DO_RECORDE,
          meuNome,
          minhasCores: minhasCoresDoCoelho(),
          robos: faixasDosRobos.map((faixa, i) => ({
            faixa,
            semente: semente + i * 104729,
            habilidade: [0.92, 0.8, 0.68][i] ?? 0.75,
            nome: `🤖 ${i + 1}`,
            avatar: AVATARES_DOS_ROBOS[i] ?? 1,
          })),
          fantasmas: (estado.fantasmas ?? []).map((f) => ({ nome: f.nome, entradas: f.entradas })),
          contagem: CONTAGEM,
        }}
        aoChegar={(entradas, ordem) => {
          setOrdemFinal(ordem);
          agir({ tipo: 'chegada', entradas }).catch((e) => setErro((e as Error).message));
        }}
      />
      {estado.fase === 'resultado' && r && (
        <div className="carrinhos-fim-solo">
          {nRobos > 0 && minhaPosicao >= 0 && <span className="carrinhos-posicao">{MEDALHAS[minhaPosicao] ?? `${minhaPosicao + 1}º`}</span>}
          {r.recorde && <strong className="carrinhos-recorde">{t('Novo recorde!')}</strong>}
          <span className="carrinhos-tempo grande">{tempoLegivel(r.tempoMs)}</span>
          <ol className="carrinhos-voltas">
            {r.voltas.map((v, i) => (
              <li key={i}>
                🏁 {i + 1} · {tempoLegivel(v - (i ? r.voltas[i - 1] : 0))}
              </li>
            ))}
          </ol>
          {r.saidas > 0 && <span className="settings-hint">{t('Saídas da pista: {n}', { n: r.saidas })}</span>}
          {!r.recorde && r.anterior !== null && <span className="settings-hint">{t('Seu recorde: {tempo}', { tempo: tempoLegivel(r.anterior) })}</span>}
          <div className="minijogo-acoes">
            <button type="button" className="btn-primary" onClick={correr}>
              {t('Jogar de novo')}
            </button>
            <button type="button" className="btn-secondary" onClick={() => tentar({ tipo: 'escolher' })}>
              {t('Correr contra')}
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
      const { n, s, f, d } = m.dados as { n: number; s: number; f: number; d: number };
      if (!r || typeof n !== 'number' || typeof s !== 'number') return;
      const ultima = r.posicoes.at(-1);
      if (ultima && ultima.n >= n) return;
      r.posicoes.push({ n, s, f: f ? 1 : 0, d: typeof d === 'number' ? d : 0 });
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
      {piloto && !fim && !chegou && <Comandos />}
    </div>
  );
}
