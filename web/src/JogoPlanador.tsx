import { useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { ComandosDoJogo, type Comando } from './ComandosDosJogos';
import { chave, useT } from './i18n';
import { comandoDaPausa, TelaDePausa, usePausaComEsc, type Pausa } from './pausaDosJogos';
import { tocar } from './somDosJogos';
import { lerControle } from './controleDosJogos';
import { tempoLegivel } from './jato/util';
import {
  BAIXO,
  BOTAO,
  CIMA,
  DESAFIOS,
  DIREITA,
  desafioPorId,
  ESQUERDA,
  gravador,
  leitor,
  limitesDasMedalhas,
  medalha,
  novoVoo,
  passo,
  PASSO,
  pilotoAutomatico,
  pontosMaximos,
  proximoAlvo,
  subidaEm,
  type Desafio,
  type Entradas,
  type Resultado,
  type Tipo,
  type Voo,
} from './planador/sim';
import {
  chaoDe,
  desenharChao,
  figuraDaPlataforma,
  figuraDoVoador,
  figurasDoChao,
  figurasDosAneis,
  figurasDasTermicas,
  montarCamera,
  prepararTela,
  setaDoRumo,
  type Figura,
  type Voador,
} from './planador/render';
import type { Agir } from './Minijogo';
import type { Partida } from './minijogos';
import './planador/planador.css';

/**
 * O PLANADOR DA TOCA (16/11/2026): desafios de voo com pouso no alvo, no gênero dos jogos de voo de 16 bits (só a mecânica).
 * A asa-delta pelos anéis até o alvo no chão, a mochila a jato até a plataforma do alto com o combustível contado, e o salto
 * de paraquedas na mosca. O chão em "Mode 7" (planador/render.ts) e a regra em planador/sim.ts, a mesma do servidor.
 * - NO SOLO, escolhe-se o desafio e até 3 fantasmas (o meu recorde e os dos amigos); os comandos de cada passo vão ao
 *   servidor, que refaz o voo e guarda o melhor (server/src/minijogo-planador.ts).
 * - NA SALA, o mesmo desafio para a turma, cada um na própria tela, os outros voando junto; ganha quem fizer mais pontos.
 */

export interface EstadoPlanador {
  fase: 'escolha' | 'voando' | 'resultado' | 'largada' | 'fim';
  solo: boolean;
  desafio: string;
  partidaId: string;
  // o Solo
  recordes?: { userId: number; nome: string; avatar: number | string | null; desafio: string; pontos: number }[];
  meuAvatar?: number | string | null;
  meuNome?: string;
  fantasmas?: { userId: number; nome: string; avatar: number | string | null; pontos: number; entradas: number[] }[];
  rodada?: number;
  resultado?: (Resultado & { recorde: boolean; anterior: number | null }) | null;
  // a sala
  criadaPor?: number;
  pilotos?: { userId: number; username: string; avatar: number | string | null; resultado: Resultado | null; posicao: number | null }[];
}

/** Os nomes dos desafios, marcados para traduzir. */
export const NOMES_DOS_DESAFIOS: Record<Tipo, string> = {
  asa: chave('Asa-delta'),
  mochila: chave('Mochila a jato'),
  queda: chave('Paraquedas'),
};
const ICONES: Record<Tipo, string> = { asa: '🪁', mochila: '🚀', queda: '🪂' };

const MAX_FANTASMAS = 3;
const CONTAGEM = 3 * 60;
const MEDALHAS = ['🥇', '🥈', '🥉'];

declare global {
  interface Window {
    /** Só no site de desenvolvimento: o e2e liga o piloto automático e lê o voo. */
    planadorPilotoAutomatico?: boolean;
    planadorDoTeste?: Voo;
  }
}

/** Os comandos: as setas (ou WASD) e Espaço; no toque, os botões da tela. */
function useComandos(ativo: boolean) {
  const teclas = useRef(0);
  const toque = useRef(0);
  useEffect(() => {
    if (!ativo) return;
    const bit = (k: string) =>
      k === 'arrowleft' || k === 'a' ? ESQUERDA : k === 'arrowright' || k === 'd' ? DIREITA : k === 'arrowup' || k === 'w' ? CIMA : k === 'arrowdown' || k === 's' ? BAIXO : k === ' ' ? BOTAO : 0;
    const tecla = (e: KeyboardEvent, desce: boolean) => {
      const alvo = e.target as HTMLElement | null;
      if (desce && alvo && (alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA' || alvo.isContentEditable)) return;
      const b = bit(e.key.toLowerCase());
      if (!b) return;
      teclas.current = desce ? teclas.current | b : teclas.current & ~b;
      e.preventDefault();
    };
    const desce = (e: KeyboardEvent) => tecla(e, true);
    const sobe = (e: KeyboardEvent) => tecla(e, false);
    const soltar = () => {
      teclas.current = 0;
      toque.current = 0;
    };
    window.addEventListener('keydown', desce);
    window.addEventListener('keyup', sobe);
    window.addEventListener('blur', soltar);
    return () => {
      window.removeEventListener('keydown', desce);
      window.removeEventListener('keyup', sobe);
      window.removeEventListener('blur', soltar);
      soltar();
    };
  }, [ativo]);
  const ler = () => {
    let c = teclas.current | toque.current;
    // o controle de videogame (controleDosJogos.ts): o analógico passando de ~0,4 (ou o direcional) e o A
    const pad = lerControle();
    if (pad) {
      if (pad.direcao < -0.3) c |= ESQUERDA;
      if (pad.direcao > 0.3) c |= DIREITA;
      if (pad.vertical < -0.3) c |= CIMA;
      if (pad.vertical > 0.3) c |= BAIXO;
      if (pad.a) c |= BOTAO;
    }
    return c;
  };
  const botao = (b: number) => ({
    onPointerDown: (e: React.PointerEvent) => {
      toque.current |= b;
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      e.preventDefault();
    },
    onPointerUp: () => (toque.current &= ~b),
    onPointerCancel: () => (toque.current &= ~b),
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });
  return { ler, botao };
}

interface Painel {
  h: number;
  v: number;
  aneis: number;
  total: number;
  combustivel: number | null;
  contagem: number | null;
  batida: boolean;
  /** O vento visto da câmera (o ângulo da seta) e a força; e se a asa está numa térmica agora. */
  vento: { graus: number; forca: number } | null;
  subindo: boolean;
}

/** Um rival da sala: as posições que o servidor repassou, pelo passo do voo dele. */
interface Rival {
  nome: string;
  avatar: number | string | null;
  posicoes: { n: number; x: number; y: number; h: number; hx: number; hy: number; a: number; j: number }[];
}

interface ConfigDoVoo {
  canvas: HTMLCanvasElement;
  desafio: Desafio;
  /** Eu voo (o avatar), ou só assisto (null). */
  meuAvatar: number | string | null | undefined;
  piloto: boolean;
  fantasmas: { nome: string; avatar: number | string | null; entradas: Entradas }[];
  rivais?: Map<number, Rival>;
  contagem: number;
  pausa?: Pausa;
  ler: () => number;
  aoPainel: (p: Painel) => void;
  aoPousar: (entradas: Entradas, r: Resultado) => void;
  aoPosicao?: (dados: Record<string, number>) => void;
}

const voador = (v: Voo, avatar: number | string | null | undefined, extra: Partial<Voador> = {}): Voador => ({
  x: v.x,
  y: v.y,
  h: v.h,
  hx: v.hx,
  hy: v.hy,
  inclina: v.inclina,
  aberto: v.aberto,
  jato: v.jato,
  tipo: v.d.tipo,
  avatar: avatar ?? null,
  ...extra,
});

/** O laço do voo (Solo e sala): a regra a 60 por segundo, o desenho no ritmo da tela. Devolve quem para tudo. */
function rodarVoo(cfg: ConfigDoVoo): () => void {
  let viva = true;
  let id = 0;
  const d = cfg.desafio;
  const tela = prepararTela(cfg.canvas, d.tema);
  const calmo = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const chao = chaoDe(d);
  const eu = cfg.piloto ? novoVoo(d) : null;
  if (eu && import.meta.env.DEV) window.planadorDoTeste = eu;
  const gravar = gravador();
  const fantasmas = cfg.fantasmas.map((f) => ({ ...f, voo: novoVoo(d), ler: leitor(f.entradas) }));
  const rivais = cfg.rivais ? [...cfg.rivais.values()] : [];
  let contagem = cfg.contagem;
  let mandou = false;
  let ultimoPainel = 0;
  let relogio = 0;
  let nAssistindo = 0;
  // a câmera anda atrás do coelho com um atraso (é o que mostra a curva)
  let camAng = Math.atan2(d.hy, d.hx);
  let camIncl = d.tipo === 'queda' ? 1.05 : 0.2;

  const rivalEm = (r: Rival, n: number) => {
    const l = r.posicoes;
    if (!l.length) return null;
    if (n <= l[0].n) return l[0];
    for (let i = l.length - 1; i > 0; i--) {
      if (l[i - 1].n <= n && n <= l[i].n) {
        const a = l[i - 1], b = l[i];
        const k = (n - a.n) / Math.max(1, b.n - a.n);
        return { ...b, x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, h: a.h + (b.h - a.h) * k };
      }
    }
    return l[l.length - 1];
  };

  let ultimo = performance.now();
  let acumulado = 0;
  const quadro = () => {
    if (!viva) return;
    id = requestAnimationFrame(quadro);
    const agora = performance.now();
    const dt = Math.min(0.1, (agora - ultimo) / 1000);
    ultimo = agora;
    // sem foco (o jogo de verdade, outra janela), escondida ou pausada (ESC): nem regra, nem desenho
    if (document.hidden || !document.hasFocus() || cfg.pausa?.ativa) return;
    acumulado += dt;
    relogio += dt;
    let n = 0;
    while (acumulado >= PASSO && n < 6) {
      acumulado -= PASSO;
      n++;
      if (contagem > 0) {
        contagem--;
        if (contagem % 60 === 0) tocar(contagem === 0 ? 'acerto' : 'clique');
        continue;
      }
      nAssistindo++;
      if (eu && !eu.fim) {
        const c = import.meta.env.DEV && window.planadorPilotoAutomatico ? pilotoAutomatico(eu) : cfg.ler();
        gravar.anotar(c);
        const ev = passo(eu, c);
        if (ev === 'anel') tocar('moeda');
        else if (ev === 'abriu') tocar('mola');
        else if (ev === 'pousou') tocar('chegada');
        else if (ev === 'batida' || ev === 'tempo') tocar('queda');
        if (eu.passo % 4 === 0 || eu.fim)
          cfg.aoPosicao?.({ n: eu.passo, x: eu.x, y: eu.y, h: eu.h, hx: eu.hx, hy: eu.hy, a: eu.aberto ? 1 : 0, j: eu.jato });
      }
      for (const f of fantasmas) if (!f.voo.fim) passo(f.voo, f.ler());
    }
    if (n === 6) acumulado = 0;

    // quem a câmera segue: eu; quem só assiste, o primeiro rival que já voa
    const nR = (eu ? eu.passo : nAssistindo) - 6;
    const rivaisAgora = rivais.map((r) => ({ r, p: rivalEm(r, nR) }));
    const seguido: { x: number; y: number; h: number; hx: number; hy: number; aberto: boolean } | null = eu
      ? eu
      : (() => {
          const q = rivaisAgora.find((x) => x.p)?.p;
          return q ? { x: q.x, y: q.y, h: q.h, hx: q.hx, hy: q.hy, aberto: q.a === 1 } : { x: d.x, y: d.y, h: d.h, hx: d.hx, hy: d.hy, aberto: false };
        })();
    const querAng = Math.atan2(seguido.hy, seguido.hx);
    let dAng = querAng - camAng;
    while (dAng > Math.PI) dAng -= Math.PI * 2;
    while (dAng < -Math.PI) dAng += Math.PI * 2;
    camAng += dAng * Math.min(1, dt * 3);
    const querIncl = d.tipo === 'queda' ? (seguido.aberto ? 0.42 : 1.05) : d.tipo === 'mochila' ? 0.3 : 0.2;
    camIncl += (querIncl - camIncl) * Math.min(1, dt * 2);
    const cam = montarCamera(seguido.x, seguido.y, seguido.h, camAng, camIncl, d.tipo === 'queda' && !seguido.aberto ? 16 : 13);

    desenharChao(tela, chao, cam);
    const figuras: Figura[] = [...figurasDoChao(tela, chao, cam)];
    const pegos = eu ? eu.aneis : d.aneis.map(() => -1);
    const prox = eu ? d.aneis.findIndex((_, i) => eu.aneis[i] < 0) : -1;
    figuras.push(...figurasDosAneis(cam, d, pegos, prox, relogio));
    if (d.termicas.length) figuras.push(...figurasDasTermicas(cam, d, relogio, calmo));
    const plataforma = figuraDaPlataforma(cam, d);
    if (plataforma) figuras.push(plataforma);
    for (const f of fantasmas) figuras.push(...figuraDoVoador(cam, voador(f.voo, f.avatar, { fantasma: true, nome: f.nome }), relogio));
    for (const { r, p } of rivaisAgora) {
      if (!p) continue;
      figuras.push(
        ...figuraDoVoador(cam, { x: p.x, y: p.y, h: p.h, hx: p.hx, hy: p.hy, inclina: 0, aberto: p.a === 1, jato: p.j, tipo: d.tipo, avatar: r.avatar, nome: r.nome }, relogio),
      );
    }
    if (eu) figuras.push(...figuraDoVoador(cam, voador(eu, cfg.meuAvatar), relogio));
    figuras.sort((a, b) => b.z - a.z);
    for (const f of figuras) f.desenhar(tela.ctx);
    if (eu && !eu.fim && contagem === 0) setaDoRumo(tela.ctx, cam, eu, proximoAlvo(eu));

    if (agora - ultimoPainel > 90) {
      ultimoPainel = agora;
      cfg.aoPainel({
        h: eu ? Math.max(0, eu.h) : 0,
        v: eu ? (d.tipo === 'mochila' ? Math.sqrt(eu.vx * eu.vx + eu.vy * eu.vy) : eu.v) : 0,
        aneis: eu ? eu.pegos : 0,
        total: d.aneis.length,
        combustivel: eu && d.tipo === 'mochila' ? eu.combustivel / d.combustivel : null,
        contagem: contagem > 0 ? Math.ceil(contagem / 60) : null,
        batida: eu?.fim?.como === 'batida',
        // o vento visto da câmera: 0 é "de frente para quem voa", em graus no sentido do relógio
        vento: d.vento[0] || d.vento[1] ? { graus: ((Math.atan2(d.vento[1], d.vento[0]) - camAng) * 180) / Math.PI + 90, forca: Math.hypot(d.vento[0], d.vento[1]) } : null,
        subindo: eu && d.termicas.length ? subidaEm(d, eu.x, eu.y) > 0.5 : false,
      });
    }
    if (eu?.fim && !mandou) {
      mandou = true;
      cfg.aoPousar(gravar.entradas, eu.fim);
    }
  };
  id = requestAnimationFrame(quadro);
  return () => {
    viva = false;
    cancelAnimationFrame(id);
  };
}

function comandosDe(t: (k: string) => string, tipo: Tipo, solo: boolean): Comando[] {
  return [
    { teclas: ['setas', 'wasd'], rotulo: t('Pilotar') },
    ...(tipo === 'mochila' ? [{ teclas: ['espaco'] as Comando['teclas'], rotulo: t('Jato') }] : []),
    ...(tipo === 'queda' ? [{ teclas: ['espaco'] as Comando['teclas'], rotulo: t('Abrir o paraquedas') }] : []),
    ...(solo ? [comandoDaPausa(t)] : []),
  ];
}

/** A tela do voo: a imagem de 320 × 180, o painel por cima e, no toque, os botões. */
function Voo3({
  config,
  solo,
  ligada,
  aoPousar,
  aoPosicao,
}: {
  config: Omit<ConfigDoVoo, 'canvas' | 'ler' | 'aoPainel' | 'aoPousar' | 'aoPosicao' | 'pausa'>;
  solo: boolean;
  ligada: boolean;
  aoPousar: (entradas: Entradas, r: Resultado) => void;
  aoPosicao?: ConfigDoVoo['aoPosicao'];
}) {
  const t = useT();
  const canvas = useRef<HTMLCanvasElement>(null);
  const [painel, setPainel] = useState<Painel | null>(null);
  const [pousou, setPousou] = useState(false);
  const comandos = useComandos(ligada && config.piloto && !pousou);
  const { pausa, pausado, continuar } = usePausaComEsc(solo && ligada && !pousou);
  const pousar = useRef(aoPousar);
  pousar.current = aoPousar;
  const posicao = useRef(aoPosicao);
  posicao.current = aoPosicao;

  useEffect(() => {
    if (!canvas.current) return;
    return rodarVoo({
      ...config,
      canvas: canvas.current,
      pausa,
      ler: comandos.ler,
      aoPainel: setPainel,
      aoPousar: (e, r) => {
        setPousou(true);
        pousar.current(e, r);
      },
      aoPosicao: (dd) => posicao.current?.(dd),
    });
    // o voo é um por montagem (a `key` de quem chama)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tipo = config.desafio.tipo;
  const toque = (b: number, rotulo: string, texto: string) => (
    <button type="button" aria-label={rotulo} {...comandos.botao(b)}>
      {texto}
    </button>
  );
  return (
    <div className="planador-moldura">
      <canvas ref={canvas} className="planador-tela" />
      {painel && config.piloto && (
        <div className="planador-painel" aria-hidden="true">
          <span className="planador-altura">{Math.round(painel.h)} m</span>
          <span className="planador-velocidade">{Math.round(painel.v * 3.6)} km/h</span>
          {painel.total > 0 && (
            <span className="planador-aneis">
              ◯ {painel.aneis}/{painel.total}
            </span>
          )}
          {painel.combustivel !== null && (
            <span className={`planador-combustivel${painel.combustivel < 0.2 ? ' pouco' : ''}`}>
              <span style={{ width: `${painel.combustivel * 100}%` }} />
            </span>
          )}
          {painel.vento && (
            <span className="planador-vento" title={t('Vento')}>
              <span style={{ transform: `rotate(${Math.round(painel.vento.graus)}deg)` }}>➤</span> {painel.vento.forca.toLocaleString(undefined, { maximumFractionDigits: 1 })} m/s
            </span>
          )}
          {painel.subindo && <span className="planador-termica">⇧</span>}
          {painel.batida && <span className="planador-aviso">{t('Pouso forte demais!')}</span>}
          {painel.contagem !== null && <span className="planador-contagem">{painel.contagem}</span>}
        </div>
      )}
      {config.piloto && ligada && !pousou && (
        <div className="planador-toque">
          <div>
            {toque(ESQUERDA, t('Pilotar'), '◀')}
            {toque(CIMA, t('Pilotar'), '▲')}
            {toque(BAIXO, t('Pilotar'), '▼')}
            {toque(DIREITA, t('Pilotar'), '▶')}
          </div>
          {tipo !== 'asa' && toque(BOTAO, tipo === 'mochila' ? t('Jato') : t('Abrir o paraquedas'), tipo === 'mochila' ? '🔥' : '🪂')}
        </div>
      )}
      {pausado && <TelaDePausa aoContinuar={continuar} />}
    </div>
  );
}

/** A MEDALHA (19/11/2026): bronze, prata ou ouro, como figura (sem texto). */
const FIGURA_DA_MEDALHA = ['', '🥉', '🥈', '🥇'];

/** A nota de uma categoria, em estrelas de 0 a 3 (a fração do máximo dela): só a marca, sem pressão. */
const estrelas = (valor: number, maximo: number) => {
  const n = maximo > 0 ? Math.round((valor / maximo) * 3) : 0;
  return '★'.repeat(n) + '☆'.repeat(3 - n);
};

/** Os pontos de um voo, linha a linha, cada categoria com a nota; e a medalha. */
function Pontos({ r, d }: { r: Resultado; d: Desafio }) {
  const t = useT();
  const tipo = d.tipo;
  const m = medalha(d, r.total);
  return (
    <>
      {m > 0 && (
        <span className="planador-medalha" aria-hidden="true">
          {FIGURA_DA_MEDALHA[m]}
        </span>
      )}
      <dl className="planador-pontos">
        <dt>{t('Anéis')}</dt>
        <dd>
          <span className="planador-nota">{estrelas(r.aneis, d.aneis.length)}</span> {r.aneis} · {r.pontosAneis}
        </dd>
        <dt>{t('Precisão')}</dt>
        <dd>
          <span className="planador-nota">{estrelas(r.precisao, 50)}</span> {r.como === 'pousou' ? `${r.distancia.toLocaleString()} m · ` : ''}
          {r.precisao}
        </dd>
        <dt>{t('Suavidade')}</dt>
        <dd>
          <span className="planador-nota">{estrelas(r.suavidade, 30)}</span> {r.suavidade}
        </dd>
        <dt>{tipo === 'mochila' ? t('Combustível') : t('Tempo')}</dt>
        <dd>
          <span className="planador-nota">{estrelas(r.bonus, 20)}</span> {tipo !== 'mochila' ? `${tempoLegivel(Math.round((r.passos * 1000) / 60))} · ` : ''}
          {r.bonus}
        </dd>
        <dt className="total">{t('Total')}</dt>
        <dd className="total">
          {r.total} / {pontosMaximos(d)}
        </dd>
      </dl>
      <p className="planador-limites" aria-hidden="true">
        {limitesDasMedalhas(d).map((l, i) => (
          <span key={i} className={r.total >= l ? 'tem' : undefined}>
            {FIGURA_DA_MEDALHA[i + 1]} {l}
          </span>
        ))}
      </p>
    </>
  );
}

function EscolhaDoDesafio({ aoEscolher, recordes, eu, escolhido }: { aoEscolher: (id: string) => void; recordes?: EstadoPlanador['recordes']; eu: number; escolhido?: string | null }) {
  const t = useT();
  return (
    <div className="planador-desafios" role="list">
      {DESAFIOS.map((d) => {
        const meu = recordes?.find((r) => r.desafio === d.id && r.userId === eu);
        const m = meu ? medalha(d, meu.pontos) : 0;
        return (
          <button
            key={d.id}
            type="button"
            role="listitem"
            className={`planador-desafio ${d.tipo} tema-${d.tema}${escolhido === d.id ? ' escolhido' : ''}`}
            aria-current={escolhido === d.id || undefined}
            aria-label={`${t(NOMES_DOS_DESAFIOS[d.tipo])} · ${t('Nível {n}', { n: d.nivel })}`}
            onClick={() => aoEscolher(d.id)}
          >
            <span className="planador-icone" aria-hidden="true">
              {ICONES[d.tipo]}
              {m > 0 && <span className="planador-medalha-pequena">{FIGURA_DA_MEDALHA[m]}</span>}
            </span>
            <span>{t(NOMES_DOS_DESAFIOS[d.tipo])}</span>
            <span className="planador-nivel" aria-hidden="true">
              {'●'.repeat(d.nivel)}
              {'○'.repeat(Math.max(0, 4 - d.nivel))}
              {(d.vento[0] || d.vento[1]) ? ' 🌬' : ''}
              {d.termicas.length ? ' ⇧' : ''}
            </span>
            {meu && <small>{t('Seu recorde: {n} pontos', { n: meu.pontos })}</small>}
          </button>
        );
      })}
    </div>
  );
}

export function JogoPlanador(props: { estado: EstadoPlanador & Partida; eu: number; jogador: boolean; restante: number; agir: Agir; socket: Socket | null; channelId: number }) {
  return props.estado.solo ? <PlanadorSolo {...props} /> : <PlanadorNaSala {...props} />;
}

// =====================================================================================================================
// O SOLO
// =====================================================================================================================

function PlanadorSolo({ estado, eu, agir }: { estado: EstadoPlanador & Partida; eu: number; agir: Agir }) {
  const t = useT();
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const [marcados, setMarcados] = useState<Set<number> | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const tentar = (corpo: Record<string, unknown>) => {
    setErro(null);
    agir(corpo).catch((e) => setErro((e as Error).message));
  };
  const desafio = desafioPorId(escolhido ?? estado.desafio) ?? DESAFIOS[0];
  const recordes = (estado.recordes ?? []).filter((r) => r.desafio === desafio.id);
  const fantasmasMarcados = marcados ?? new Set(recordes.filter((r) => r.userId === eu).map((r) => r.userId));
  const voar = (id: string) => tentar({ tipo: 'voar', desafio: id, fantasmas: [...fantasmasMarcados] });

  if (estado.fase === 'escolha') {
    return (
      <div className="planador">
        <div className="planador-escolha">
          <EscolhaDoDesafio
            recordes={estado.recordes}
            eu={eu}
            escolhido={escolhido}
            aoEscolher={(id) => {
              if (id === desafio.id && escolhido) voar(id);
              else {
                setEscolhido(id);
                setMarcados(null);
              }
            }}
          />
          {escolhido && (
            <>
              <fieldset className="planador-fantasmas">
                <legend>{t('Correr contra')}</legend>
                {recordes.length > 0 ? (
                  <ul>
                    {recordes.map((r) => (
                      <li key={r.userId}>
                        <label>
                          <input
                            type="checkbox"
                            checked={fantasmasMarcados.has(r.userId)}
                            disabled={!fantasmasMarcados.has(r.userId) && fantasmasMarcados.size >= MAX_FANTASMAS}
                            onChange={() => {
                              const n = new Set(fantasmasMarcados);
                              if (n.has(r.userId)) n.delete(r.userId);
                              else n.add(r.userId);
                              setMarcados(n);
                            }}
                          />
                          <span>{r.nome}</span>
                          <span className="planador-numero">{r.pontos}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="settings-hint">{t('Nenhum amigo jogou esta fase ainda.')}</p>
                )}
              </fieldset>
              <ComandosDoJogo itens={comandosDe(t, desafio.tipo, true)} />
              <div className="minijogo-acoes">
                <button type="button" className="btn-primary" onClick={() => voar(desafio.id)}>
                  {ICONES[desafio.tipo]} {t('Começar')}
                </button>
              </div>
            </>
          )}
          {erro && <p className="form-error small">{erro}</p>}
        </div>
      </div>
    );
  }

  const r = estado.resultado;
  return (
    <div className="planador">
      <Voo3
        key={`${estado.partidaId}-${estado.rodada ?? 0}`}
        solo
        ligada={estado.fase === 'voando'}
        config={{
          desafio,
          meuAvatar: estado.meuAvatar,
          piloto: true,
          fantasmas: (estado.fantasmas ?? []).map((f) => ({ nome: f.nome, avatar: f.avatar, entradas: f.entradas })),
          contagem: CONTAGEM,
        }}
        aoPousar={(entradas) => agir({ tipo: 'pouso', entradas }).catch((e) => setErro((e as Error).message))}
      />
      {estado.fase === 'resultado' && r && (
        <div className="planador-fim">
          {r.recorde && <strong className="planador-recorde">{t('Novo recorde!')}</strong>}
          {r.como === 'batida' && <span className="planador-aviso-fim">{t('Pouso forte demais!')}</span>}
          <Pontos r={r} d={desafio} />

          {!r.recorde && r.anterior !== null && <span className="settings-hint">{t('Seu recorde: {n} pontos', { n: r.anterior })}</span>}
          <div className="minijogo-acoes">
            <button type="button" className="btn-primary" onClick={() => voar(desafio.id)}>
              {t('Jogar de novo')}
            </button>
            <button type="button" className="btn-secondary" onClick={() => tentar({ tipo: 'escolher' })}>
              {t('Correr contra')}
            </button>
          </div>
        </div>
      )}
      {estado.fase === 'voando' && <ComandosDoJogo itens={comandosDe(t, desafio.tipo, true)} />}
      {erro && <p className="form-error small">{erro}</p>}
    </div>
  );
}

// =====================================================================================================================
// NA SALA
// =====================================================================================================================

function PlanadorNaSala({
  estado,
  eu,
  jogador,
  restante,
  agir,
  socket,
  channelId,
}: {
  estado: EstadoPlanador & Partida;
  eu: number;
  jogador: boolean;
  restante: number;
  agir: Agir;
  socket: Socket | null;
  channelId: number;
}) {
  const t = useT();
  const pilotos = estado.pilotos ?? [];
  const fim = estado.fase === 'fim' || estado.terminada;
  const meu = pilotos.find((p) => p.userId === eu);
  const piloto = jogador && !!meu;
  const desafio = desafioPorId(estado.desafio) ?? DESAFIOS[0];
  const [pousou, setPousou] = useState(false);
  const rivais = useRef<Map<number, Rival> | null>(null);
  if (!rivais.current) {
    rivais.current = new Map(pilotos.filter((p) => p.userId !== eu || !piloto).map((p) => [p.userId, { nome: p.username, avatar: p.avatar, posicoes: [] }]));
  }

  useEffect(() => {
    if (!socket) return;
    const chegada = (m: { channelId?: number; dados?: Record<string, unknown> }) => {
      if (m.channelId !== channelId || !m.dados || typeof m.dados.userId !== 'number') return;
      const r = rivais.current?.get(m.dados.userId);
      const p = m.dados as Rival['posicoes'][number];
      if (!r || typeof p.n !== 'number' || typeof p.x !== 'number') return;
      const ultima = r.posicoes.at(-1);
      if (ultima && ultima.n >= p.n) return;
      r.posicoes.push({ n: p.n, x: p.x, y: p.y, h: p.h, hx: p.hx, hy: p.hy, a: p.a, j: p.j });
      if (r.posicoes.length > 3000) r.posicoes.splice(0, 1500);
    };
    socket.on('minijogo:tempo-real', chegada);
    return () => {
      socket.off('minijogo:tempo-real', chegada);
    };
  }, [socket, channelId]);

  if (estado.fase === 'escolha' && !fim) {
    const quem = pilotos.find((p) => p.userId === estado.criadaPor)?.username ?? '';
    return (
      <div className="planador">
        {estado.criadaPor === eu ? (
          <EscolhaDoDesafio eu={eu} aoEscolher={(id) => void agir({ tipo: 'escolher', desafio: id })} />
        ) : (
          <p className="minijogo-situacao">{t('Esperando {nome} começar.', { nome: quem })}</p>
        )}
      </div>
    );
  }

  const contagem = estado.fase === 'largada' ? Math.max(0, Math.round((restante * 60) / 1000)) : 0;
  const comPontos = pousou || fim;
  return (
    <div className="planador">
      <h4 className="planador-titulo">
        {ICONES[desafio.tipo]} {t(NOMES_DOS_DESAFIOS[desafio.tipo])}
      </h4>
      {!fim && (estado.fase === 'largada' || estado.fase === 'voando') && (
        <Voo3
          key={estado.partidaId}
          solo={false}
          ligada={piloto}
          config={{ desafio, meuAvatar: meu?.avatar, piloto, fantasmas: [], rivais: rivais.current, contagem }}
          aoPousar={(entradas) => {
            setPousou(true);
            void agir({ tipo: 'pouso', entradas });
          }}
          aoPosicao={(dados) => socket?.emit('minijogo:tempo-real', { channelId, dados })}
        />
      )}
      {comPontos && (
        <ol className="planador-classificacao">
          {pilotos.map((p) => (
            <li key={p.userId} className={p.userId === eu ? 'eu' : undefined}>
              {/* a posição só no fim: antes, quem ainda voa pode fazer mais pontos */}
              <span className="planador-posicao">{fim && p.posicao !== null ? (p.resultado && p.posicao <= 3 ? MEDALHAS[p.posicao - 1] : p.posicao) : ''}</span>
              <span className="planador-quem">{p.username}</span>
              <span className="planador-numero">{p.resultado ? p.resultado.total : fim ? '—' : '…'}</span>
            </li>
          ))}
        </ol>
      )}
      {piloto && !fim && !pousou && <ComandosDoJogo itens={comandosDe(t, desafio.tipo, false)} />}
    </div>
  );
}
