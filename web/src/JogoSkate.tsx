import { useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { ComandosDoJogo } from './ComandosDosJogos';
import { coresDoAvatar } from './coelho3d';
import { useT } from './i18n';
import { comandoDaPausa, TelaDePausa, usePausaComEsc } from './pausaDosJogos';
import { tocar } from './somDosJogos';
import {
  comboAberto,
  gravador,
  NADA,
  novoSkatista,
  PASSO,
  passo,
  PASSOS_DA_SESSAO,
  PASSOS_MAXIMOS,
  valorDoCombo,
  type Comandos,
  type Entradas,
  type Evento,
  type Manobra,
  type Skatista,
} from './skate/fisica';
import { criarPiloto } from './skate/piloto';
import { pecaEm } from './skate/pista';
import type { CenaDoSkate, QuadroDoOutro } from './skate/cena';
import './skate.css';

/**
 * O ROLÊ DO COELHO (05/11/2026, pedido dele: "um mini Tony Hawk"): um minuto numa pista de skate pequena, com o nosso coelho
 * 3D em cima da prancha da Kenney. SÓ A MECÂNICA dos jogos de skate de pontos: nada de nome, personagem, fase ou música de
 * ninguém (e sem música nenhuma: a regra do "nunca fazer a nossa"; os efeitos são os de somDosJogos.ts).
 *
 * A SESSÃO É DESTE COMPUTADOR, como o contra o relógio do kart: a física (skate/fisica.ts) anda em passos fixos de 1/60 s, e
 * o minuto são 3600 passos — a janela sem foco pausa tudo. No fim, os COMANDOS de cada passo vão ao servidor
 * (server/src/minijogo-skate.ts), que refaz a sessão com a mesma física (a cópia dela em server/src/skate/) e guarda o recorde.
 *
 * NA SALA (06/11/2026, pedido dele: "um modo com mais pessoas no skate, com fantasmas como fizemos no jogo de corrida"), de 2
 * a 8: o servidor dá o verde, cada um anda na própria pista, e os outros aparecem como FANTASMAS (o coelho de cada um, meio
 * transparente, com o nome em cima), pelas posições que o servidor repassa (15 por segundo), um tico atrás do meu passo e
 * interpolados. Sem batida entre skatistas, e sem pausa. Quem não joga assiste pela câmera de quem tem mais pontos.
 */

export interface EstadoSkate {
  fase: 'largada' | 'jogando' | 'fim';
  solo?: boolean;
  duracaoMs: number;
  /** O que eu já mandei (null: ainda andando). */
  meu: { pontos: number | null; melhorCombo: number | null } | null;
  /** Mais pontos primeiro; a posição só entre quem terminou (empatados dividem). */
  placar: { userId: number; username: string; avatar?: number | string | null; pontos: number | null; melhorCombo: number | null; posicao: number | null }[];
  /** O recorde de antes, e se esta sessão virou o novo (no Solo; na sala, o de cada um). */
  recorde: { antes: number | null; novo: boolean } | null;
  partidaId: string;
}

type Props = {
  estado: EstadoSkate & { terminada?: boolean };
  eu: number;
  jogador: boolean;
  agir: (corpo: Record<string, unknown>) => unknown;
  /** Na sala: quanto falta para o verde (o relógio da partida), e o socket das posições ao vivo. */
  restante?: number;
  socket?: Socket | null;
  channelId?: number;
};

const mil = (n: number) => n.toLocaleString();
const MEDALHAS = ['🥇', '🥈', '🥉'];

/** A posição que vai à turma (a cada 4 passos): o desenho do passo e os pontos de agora (só para a ordem ao vivo). */
type Posicao = QuadroDoOutro & { n: number; p: number };

/** Um skatista da turma: as posições que o servidor repassou, pelo passo da sessão dele. */
interface Rival {
  nome: string;
  avatar: number | string | null;
  posicoes: Posicao[];
}

const jeitoDe = (k: Skatista) => (k.modo === 'ar' ? 1 : k.modo === 'grind' ? 2 : k.modo === 'manual' ? 3 : k.modo === 'caido' ? 4 : 0);
const r2 = (v: number) => Math.round(v * 100) / 100;

export function JogoSkate(props: Props) {
  const solo = props.estado.solo ?? props.estado.placar.length === 1;
  return solo ? <SkateSolo {...props} /> : <SkateNaSala {...props} />;
}

function Placar({ estado, eu, fim, solo }: { estado: EstadoSkate; eu: number; fim: boolean; solo: boolean }) {
  const t = useT();
  const meu = estado.placar.find((l) => l.userId === eu);
  // na sala, a turma inteira (quem ainda anda, com "…"); a posição e as medalhas só no fim
  const linhas = solo ? [] : estado.placar;
  const valem = linhas.filter((l) => l.posicao !== null).length;
  return (
    <div className="skate-fim">
      {meu && meu.pontos !== null && <p className="skate-fim-pontos">{t('Pontos: {n}', { n: mil(meu.pontos) })}</p>}
      {estado.recorde &&
        meu &&
        meu.pontos !== null &&
        (estado.recorde.novo ? (
          <p className="minijogo-situacao skate-recorde">{t('Novo recorde!')}</p>
        ) : (
          estado.recorde.antes !== null && <p className="minijogo-situacao">{t('Seu recorde: {tempo}', { tempo: mil(estado.recorde.antes) })}</p>
        ))}
      {meu && meu.melhorCombo !== null && meu.melhorCombo > 0 && <p className="minijogo-situacao">{t('Melhor combo: {n}', { n: mil(meu.melhorCombo) })}</p>}
      {linhas.length > 1 && (
        <ol className="skate-placar">
          {linhas.map((l) => (
            <li key={l.userId} className={l.userId === eu ? 'eu' : undefined}>
              <span className="skate-placar-pos">{fim ? (l.posicao === null ? '–' : valem >= 2 && l.posicao <= 3 ? MEDALHAS[l.posicao - 1] : l.posicao) : ''}</span>
              <span className="minijogo-nome">{l.username}</span>
              <strong>{l.pontos !== null ? mil(l.pontos) : fim ? '—' : '…'}</strong>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function SkateSolo({ estado, eu, jogador, agir }: Props) {
  const fim = !!estado.terminada || estado.fase === 'fim';
  const meu = estado.placar.find((l) => l.userId === eu);
  if (fim || (meu && meu.pontos !== null)) return <Placar estado={estado} eu={eu} fim={fim} solo />;
  if (!jogador || !meu) return <p className="minijogo-situacao">…</p>;
  // ESC pausa só no Solo (o recorde é dele): na sala, o relógio é o de todos
  return <Sessao key={estado.partidaId} solo aoTerminar={(entradas) => void agir({ tipo: 'fim', entradas })} />;
}

function SkateNaSala({ estado, eu, jogador, agir, restante = 0, socket = null, channelId = 0 }: Props) {
  const fim = !!estado.terminada || estado.fase === 'fim';
  const meu = estado.placar.find((l) => l.userId === eu);
  // quem abre a página com a sessão já andando assiste (o relógio do servidor não deixaria a sessão dela valer)
  const [desdeALargada] = useState(() => estado.fase === 'largada');
  const corro = jogador && !!meu && desdeALargada;
  const rivais = useRef<Map<number, Rival> | null>(null);
  if (!rivais.current) {
    rivais.current = new Map(estado.placar.filter((l) => l.userId !== eu || !corro).map((l) => [l.userId, { nome: l.username, avatar: l.avatar ?? null, posicoes: [] }]));
  }
  useEffect(() => {
    if (!socket) return;
    const chegada = (m: { channelId?: number; dados?: Record<string, unknown> }) => {
      if (m.channelId !== channelId || !m.dados || typeof m.dados.userId !== 'number') return;
      const r = rivais.current?.get(m.dados.userId);
      const d = m.dados as unknown as Posicao;
      if (!r || [d.n, d.x, d.y, d.z, d.cx, d.cz].some((v) => typeof v !== 'number')) return;
      const ultima = r.posicoes.at(-1);
      if (ultima && ultima.n >= d.n) return;
      r.posicoes.push({ n: d.n, x: d.x, y: d.y, z: d.z, cx: d.cx, cz: d.cz, e: d.e | 0, b: d.b === -1 ? -1 : 1, f: d.f | 0, p: d.p | 0 });
      if (r.posicoes.length > 2000) r.posicoes.splice(0, 1000);
    };
    socket.on('minijogo:tempo-real', chegada);
    return () => {
      socket.off('minijogo:tempo-real', chegada);
    };
  }, [socket, channelId]);
  // a contagem é o relógio da partida até o verde do servidor (o mesmo semáforo para todos)
  const [contagem] = useState(() => (estado.fase === 'largada' ? Math.max(0, restante) : 0));
  if (fim || (meu && meu.pontos !== null)) return <Placar estado={estado} eu={eu} fim={fim} solo={false} />;
  if (!corro && estado.fase === 'largada') return <p className="minijogo-situacao">…</p>;
  return (
    <Sessao
      key={estado.partidaId}
      corro={corro}
      contagemMs={contagem}
      rivais={rivais.current}
      aoPosicao={(dados) => socket?.emit('minijogo:tempo-real', { channelId, dados })}
      aoTerminar={(entradas) => void agir({ tipo: 'fim', entradas })}
    />
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// O TECLADO: setas andam (e giram no ar), Espaço pula (segurar carrega), Z flip, X grab, C manual
// ---------------------------------------------------------------------------------------------------------------------

function useTeclado() {
  const comandos = useRef<Comandos>({ ...NADA });
  useEffect(() => {
    const tecla = (e: KeyboardEvent, apertada: boolean) => {
      const alvo = e.target as HTMLElement | null;
      if (apertada && alvo && (alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA' || alvo.isContentEditable)) return;
      const c = comandos.current;
      const k = e.key.toLowerCase();
      let usou = true;
      if (k === 'arrowup' || k === 'w') c.frente = apertada;
      else if (k === 'arrowdown' || k === 's') c.tras = apertada;
      else if (k === 'arrowleft' || k === 'a') c.esquerda = apertada;
      else if (k === 'arrowright' || k === 'd') c.direita = apertada;
      else if (k === ' ') c.pulo = apertada;
      else if (k === 'z') c.flip = apertada;
      else if (k === 'x') c.grab = apertada;
      else if (k === 'c') c.manual = apertada;
      else usou = false;
      if (usou) e.preventDefault();
    };
    const desce = (e: KeyboardEvent) => tecla(e, true);
    const sobe = (e: KeyboardEvent) => tecla(e, false);
    const soltar = () => Object.assign(comandos.current, NADA);
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
    };
  }, []);
  return comandos;
}

// ---------------------------------------------------------------------------------------------------------------------
// A SESSÃO
// ---------------------------------------------------------------------------------------------------------------------

interface Placa {
  id: number;
  tipo: 'combo' | 'queda';
  pontos: number;
  vezes: number;
}

interface Painel {
  pontos: number;
  restante: number;
  combo: Manobra[];
  modo: Skatista['modo'];
  contagem: number | null;
  /** Na sala: a ordem ao vivo, pelos pontos que cada um diz ter agora (o placar do fim é o que o servidor refez). */
  ordem: { id: string; nome: string; pontos: number; eu: boolean }[];
}

declare global {
  interface Window {
    /** Só no site de desenvolvimento: o e2e liga o piloto automático e lê a sessão. */
    skatePilotoAutomatico?: boolean;
    skateSessaoDoTeste?: Skatista;
  }
}

const CONTAGEM_MS = 3000;
/** Os fantasmas da turma andam este tanto de passos atrás do meu (100 ms): o que chega pela rede tem com que interpolar. */
const ATRASO_DOS_RIVAIS = 6;

/** A posição do rival no passo `n` (fracionário), entre as duas posições que o servidor repassou em volta dele. */
function posicaoDoRival(r: Rival, n: number): Posicao | null {
  const l = r.posicoes;
  if (!l.length) return null;
  if (n <= l[0].n) return l[0];
  const u = l[l.length - 1];
  if (n >= u.n) return u;
  for (let i = l.length - 1; i > 0; i--) {
    const a = l[i - 1];
    const b = l[i];
    if (a.n <= n && n <= b.n) {
      const k = (n - a.n) / Math.max(1, b.n - a.n);
      // a prancha gira pelo caminho mais curto: interpola o vetor e deixa a cena normalizar o ângulo
      return { ...b, n, x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k, cx: a.cx + (b.cx - a.cx) * k, cz: a.cz + (b.cz - a.cz) * k, e: k < 0.5 ? a.e : b.e };
    }
  }
  return u;
}

/** O skatista "de mentira" que a câmera segue quando eu só assisto: o desenho de um rival, com o que a cena lê. */
function skatistaDoRival(q: Posicao, k: Skatista): Skatista {
  k.x = q.x;
  k.y = q.y;
  k.z = q.z;
  k.cx = q.cx;
  k.cz = q.cz;
  k.rx = q.cx;
  k.rz = q.cz;
  k.vel = 1;
  k.base = q.b;
  k.flip = q.f;
  k.modo = q.e === 1 ? 'ar' : q.e === 2 ? 'grind' : q.e === 3 ? 'manual' : q.e === 4 ? 'caido' : 'chao';
  k.saida = 'ollie';
  k.peca = pecaEm(q.x, q.z);
  k.pontos = q.p;
  return k;
}

export function Sessao({
  aoTerminar,
  solo = false,
  corro = true,
  contagemMs = CONTAGEM_MS,
  rivais,
  aoPosicao,
}: {
  aoTerminar: (entradas: Entradas, k: Skatista) => void;
  solo?: boolean;
  /** false: só assisto (a câmera segue quem tem mais pontos). */
  corro?: boolean;
  contagemMs?: number;
  rivais?: Map<number, Rival>;
  aoPosicao?: (dados: Posicao) => void;
}) {
  const t = useT();
  const caixa = useRef<HTMLDivElement>(null);
  const medidor = useRef<HTMLDivElement>(null);
  const teclado = useTeclado();
  const [estado, setEstado] = useState<'carregando' | 'pronta' | 'falhou'>(() => (temWebGL() ? 'carregando' : 'falhou'));
  const [painel, setPainel] = useState<Painel>({ pontos: 0, restante: PASSOS_DA_SESSAO, combo: [], modo: 'chao', contagem: Math.ceil(contagemMs / 1000), ordem: [] });
  const [placas, setPlacas] = useState<Placa[]>([]);
  const terminar = useRef(aoTerminar);
  terminar.current = aoTerminar;
  const posicao = useRef(aoPosicao);
  posicao.current = aoPosicao;
  const { pausa, pausado, continuar } = usePausaComEsc(solo && estado === 'pronta');

  useEffect(() => {
    if (estado === 'falhou' || !caixa.current) return;
    let viva = true;
    let cena: CenaDoSkate | null = null;
    let id = 0;
    let placaId = 0;
    const lista = rivais ? [...rivais.entries()] : [];
    import('./skate/cena')
      .then(async ({ CenaDoSkate }) => {
        if (!viva || !caixa.current) return;
        cena = new CenaDoSkate(caixa.current);
        await cena.montar(lista.map(([, r]) => ({ cores: coresDoAvatar(r.avatar), nome: r.nome })));
        if (!viva) return;
        setEstado('pronta');
        const k = novoSkatista();
        if (import.meta.env.DEV && corro) window.skateSessaoDoTeste = k;
        const gravar = gravador();
        const piloto = criarPiloto();
        let antes = { x: k.x, y: k.y, z: k.z };
        let acumulado = 0;
        let ultimo = performance.now();
        let ultimoPainel = 0;
        let largada = performance.now() + contagemMs;
        let mandou = false;
        let comandos: Comandos = NADA;
        /** Quem só assiste: o passo do mundo desde o verde, e quem a câmera segue (pintado com as cores dele). */
        let nAssistindo = 0;
        let seguido = -1;
        const deMentira = novoSkatista();

        const ouvir = (e: Evento) => {
          switch (e.tipo) {
            case 'ollie':
              tocar('pulo');
              break;
            case 'pouso':
              tocar('tacada');
              break;
            case 'grind':
              tocar('carta');
              break;
            case 'manobra':
              if (e.nome === 'Kickflip') tocar('clique');
              break;
            case 'combo':
              tocar(e.vezes >= 3 ? 'combo' : 'moeda');
              if (e.vezes >= 2 || e.pontos >= 300) {
                const p: Placa = { id: ++placaId, tipo: 'combo', pontos: e.pontos, vezes: e.vezes };
                setPlacas((l) => [...l.slice(-2), p]);
                setTimeout(() => setPlacas((l) => l.filter((x) => x.id !== p.id)), 1800);
              }
              break;
            case 'queda': {
              tocar('queda');
              const p: Placa = { id: ++placaId, tipo: 'queda', pontos: e.perdeu, vezes: 0 };
              setPlacas((l) => [...l.slice(-2), p]);
              setTimeout(() => setPlacas((l) => l.filter((x) => x.id !== p.id)), 1600);
              break;
            }
          }
        };

        const quadro = () => {
          if (!viva || !cena) return;
          id = requestAnimationFrame(quadro);
          const agora = performance.now();
          const dt = Math.min(0.1, (agora - ultimo) / 1000);
          ultimo = agora;
          // sem foco (o jogo de verdade, outra janela), escondida ou pausada (ESC): nem física, nem desenho, e a contagem espera
          if (document.hidden || !document.hasFocus() || pausa.ativa) {
            if (largada > agora) largada += dt * 1000;
            return;
          }
          const contando = largada > agora;
          if (!contando && !k.terminou) {
            acumulado += dt;
            let n = 0;
            while (acumulado >= PASSO && n < 6 && !k.terminou) {
              acumulado -= PASSO;
              n++;
              if (!corro) {
                if (nAssistindo < PASSOS_MAXIMOS) nAssistindo++;
                continue;
              }
              antes = { x: k.x, y: k.y, z: k.z };
              comandos = import.meta.env.DEV && window.skatePilotoAutomatico ? piloto(k) : teclado.current;
              gravar.anotar(comandos);
              passo(k, comandos);
              for (const e of k.eventos) ouvir(e);
              if (k.passo % 4 === 0 || k.terminou) {
                posicao.current?.({
                  n: k.passo,
                  x: r2(k.x),
                  y: r2(k.y),
                  z: r2(k.z),
                  cx: r2(k.cx),
                  cz: r2(k.cz),
                  e: jeitoDe(k),
                  b: k.base > 0 ? 1 : -1,
                  f: k.flip,
                  p: k.pontos,
                });
              }
            }
            if (n === 6) acumulado = 0;
          }
          const f = contando ? 1 : Math.min(1, acumulado / PASSO);
          // A TURMA: cada rival no meu passo (um tico atrás), interpolado entre as posições que chegaram
          const nR = (corro ? k.passo : nAssistindo) - ATRASO_DOS_RIVAIS + f;
          const quadros = lista.map(([, r]) => posicaoDoRival(r, nR));
          if (!corro) {
            // quem só assiste segue quem tem mais pontos (e o desenha no lugar do principal, com as cores dele)
            let melhor = -1;
            quadros.forEach((q, i) => q && (melhor < 0 || q.p > quadros[melhor]!.p) && (melhor = i));
            if (melhor >= 0 && melhor !== seguido) {
              seguido = melhor;
              cena.pintar(coresDoAvatar(lista[melhor][1].avatar));
            }
          }
          const seguida = !corro && seguido >= 0 ? quadros[seguido] : null;
          cena.desenharOutros(
            quadros.map((q, i) => (i === seguido && !corro ? null : q)),
            dt,
          );
          if (seguida) {
            const kk = skatistaDoRival(seguida, deMentira);
            cena.desenhar(kk, kk, 1, dt, false);
          } else cena.desenhar(antes, k, f, dt, comandos.frente);
          // o equilíbrio vai direto na barra (todo quadro); o resto do painel, umas 12 vezes por segundo
          const m = medidor.current;
          if (m) {
            const mostra = corro && (k.modo === 'grind' || k.modo === 'manual');
            m.style.visibility = mostra ? 'visible' : 'hidden';
            m.dataset.eixo = k.modo === 'manual' ? 'vertical' : 'horizontal';
            m.style.setProperty('--equilibrio', String(Math.max(-1, Math.min(1, k.equilibrio))));
          }
          if (agora - ultimoPainel > 80) {
            ultimoPainel = agora;
            const ordem = lista.length
              ? [
                  ...(corro ? [{ id: 'eu', nome: '', pontos: k.pontos, eu: true }] : []),
                  ...lista.map(([uid, r], i) => ({ id: `r${uid}`, nome: r.nome, pontos: quadros[i]?.p ?? 0, eu: false })),
                ].sort((a, b) => b.pontos - a.pontos)
              : [];
            const passoAgora = corro ? k.passo : nAssistindo;
            setPainel({
              pontos: corro ? k.pontos : (seguida?.p ?? 0),
              restante: Math.max(0, PASSOS_DA_SESSAO - passoAgora),
              combo: corro ? comboAberto(k) : [],
              modo: k.modo,
              contagem: contando ? Math.ceil((largada - agora) / 1000) : null,
              ordem,
            });
          }
          if (corro && k.terminou && !mandou) {
            mandou = true;
            tocar('fim');
            terminar.current(gravar.entradas, k);
          }
        };
        id = requestAnimationFrame(quadro);
      })
      .catch(() => {
        cena?.destruir();
        cena = null;
        if (viva) setEstado('falhou');
      });
    return () => {
      viva = false;
      cancelAnimationFrame(id);
      cena?.destruir();
    };
    // a cena nasce uma vez por sessão
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado === 'falhou']);

  if (estado === 'falhou') return <p className="minijogo-situacao">{t('Este jogo precisa de gráficos 3D, que não abriram neste aparelho.')}</p>;

  const seg = Math.ceil(painel.restante * PASSO);
  const relogio = `${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, '0')}`;
  const combo = painel.combo;
  return (
    <div className="skate">
      <div className="skate-moldura">
        <div ref={caixa} className={`skate-caixa${estado === 'pronta' ? '' : ' escondida'}`} />
        {estado === 'pronta' && (
          <div className="skate-painel" aria-hidden="true">
            <span className="skate-pontos">{mil(painel.pontos)}</span>
            <span className={`skate-relogio${painel.restante < 600 ? ' acabando' : ''}`}>{relogio}</span>
            {painel.ordem.length > 1 && (
              <ol className="skate-ordem">
                {painel.ordem.map((l) => (
                  <li key={l.id} className={l.eu ? 'eu' : undefined}>
                    <span>{l.eu ? '★' : l.nome}</span>
                    <strong>{mil(l.pontos)}</strong>
                  </li>
                ))}
              </ol>
            )}
            {combo.length > 0 && (
              <div className="skate-combo">
                <span className="skate-manobras">{combo.map((m) => m.nome).join(' + ')}</span>
                <span className="skate-valor">
                  {mil(combo.reduce((s, m) => s + m.pontos, 0))} × {combo.length}
                  <small> = {mil(valorDoCombo(combo))}</small>
                </span>
              </div>
            )}
            <div className="skate-placas">
              {placas.map((p) =>
                p.tipo === 'combo' ? (
                  <span key={p.id} className="skate-placa">
                    +{mil(p.pontos)}
                  </span>
                ) : (
                  <span key={p.id} className="skate-placa queda">
                    {t('Caiu!')}
                    {p.pontos > 0 && <s> {mil(p.pontos)}</s>}
                  </span>
                ),
              )}
            </div>
            <div ref={medidor} className="skate-equilibrio" style={{ visibility: 'hidden' }}>
              <span />
            </div>
            {painel.contagem !== null && <span className="skate-contagem">{painel.contagem}</span>}
          </div>
        )}
        {pausado && <TelaDePausa aoContinuar={continuar} />}
      </div>
      {corro && (
        <ComandosDoJogo
          itens={[
            { teclas: ['setas'], rotulo: t('Andar') },
            { teclas: ['espaco'], rotulo: t('Pular') },
            { teclas: ['setas-lado'], rotulo: t('Girar') },
            { teclas: ['z'], rotulo: t('Kickflip') },
            { teclas: ['x'], rotulo: t('Grab') },
            { teclas: ['c'], rotulo: t('Manual') },
            ...(solo ? [comandoDaPausa(t)] : []),
          ]}
        />
      )}
    </div>
  );
}

function temWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}
