import { useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { ComandosDoJogo } from './ComandosDosJogos';
import { useT } from './i18n';
import { comandoDaPausa, TelaDePausa, usePausaComEsc } from './pausaDosJogos';
import { carregarFolhas, DesenhoDoRingue, LARGURA, ALTURA } from './ringue/desenho';
import { comandoDoPiloto } from './ringue/piloto';
import { ADVERSARIOS, anotar, BAIXO, CIMA, DIR, ESQ, FORTE, novaLuta, passo, PASSO, SOCO_D, SOCO_E, type Evento, type Luta, type Resultado } from './ringue/sim';
import { tocar } from './somDosJogos';
import type { AvatarDoJogo } from './coelho/cores';
import './ringue/ringue.css';

/**
 * O RINGUE DA TOCA (16/11/2026): boxe de reflexo visto de trás de quem joga, contra um circuito de três adversários do
 * computador. SÓ A MECÂNICA do gênero; o adversário é um bicho da Briga (Quaternius, CC0) com as luvas desenhadas por código.
 *
 * A LUTA É DESTE COMPUTADOR, como o Rolê do coelho: a regra (ringue/sim.ts) anda em passos fixos de 1/60 s com a semente que o
 * servidor sorteou, e os comandos de cada passo ficam guardados em trechos. No fim do circuito (perdeu uma luta, ou venceu as
 * três), a lista vai ao servidor (server/src/minijogo-ringue.ts), que REFAZ tudo, e o resultado é o dele. A janela sem foco
 * pausa a luta; no Solo, o ESC também. Na sala, a turma luta o mesmo circuito ao mesmo tempo, e a lista ao lado diz em que luta
 * cada um está.
 */

export interface EstadoRingue {
  fase: 'largada' | 'jogando' | 'fim';
  solo: boolean;
  semente: number;
  adversarios: number;
  meu: Resultado | null;
  avatar: AvatarDoJogo;
  placar: { userId: number; username: string; avatar: AvatarDoJogo; resultado: Resultado | null; posicao: number | null }[];
  recorde: { antes: Resultado | null; novo: boolean } | null;
  partidaId: string;
}

type Props = {
  estado: EstadoRingue & { terminada?: boolean };
  eu: number;
  jogador: boolean;
  agir: (corpo: Record<string, unknown>) => unknown;
  restante?: number;
  socket?: Socket | null;
  channelId?: number;
};

declare global {
  interface Window {
    /** Só no site de desenvolvimento: o e2e liga o piloto automático e lê a luta. */
    ringuePilotoAutomatico?: boolean;
    ringueDoTeste?: Luta;
  }
}

const MEDALHAS = ['🥇', '🥈', '🥉'];

/** O tempo de um circuito, em minutos e segundos. */
const tempo = (passos: number) => {
  const s = Math.round(passos / 60);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
/** "2/3", ou "3/3 · 2:14" quando venceu o circuito inteiro. */
const resumo = (r: Resultado, total: number) => (r.vencidas >= total ? `${r.vencidas}/${total} · ${tempo(r.passos)}` : `${r.vencidas}/${total}`);

export function JogoRingue(props: Props) {
  const { estado, eu, jogador, agir, restante = 0, socket = null, channelId = 0 } = props;
  const t = useT();
  const fim = !!estado.terminada || estado.fase === 'fim';
  const meu = estado.placar.find((l) => l.userId === eu);
  // na sala, quem abre a página com a luta já andando assiste (o relógio do servidor não deixaria o circuito dela valer)
  const [desdeALargada] = useState(() => estado.solo || estado.fase === 'largada');
  const [contagem] = useState(() => (estado.fase === 'largada' ? Math.max(0, restante) : 0));
  const [rivais, setRivais] = useState<Map<number, { adv: number; quedas: number; caido: boolean }>>(() => new Map());

  useEffect(() => {
    if (!socket || estado.solo) return;
    const chegada = (m: { channelId?: number; dados?: Record<string, unknown> }) => {
      const d = m.dados;
      if (m.channelId !== channelId || !d || typeof d.userId !== 'number' || d.userId === eu) return;
      setRivais((antes) => new Map(antes).set(d.userId as number, { adv: Number(d.adv) | 0, quedas: Number(d.quedas) | 0, caido: d.caido === true }));
    };
    socket.on('minijogo:tempo-real', chegada);
    return () => {
      socket.off('minijogo:tempo-real', chegada);
    };
  }, [socket, channelId, eu, estado.solo]);

  if (fim || (meu && meu.resultado !== null)) {
    const linhas = estado.solo ? [] : estado.placar;
    const valem = linhas.filter((l) => l.posicao !== null).length;
    return (
      <div className="ringue-fim">
        {meu?.resultado && <p className="ringue-fim-lutas">{t('Lutas vencidas: {n}', { n: resumo(meu.resultado, estado.adversarios) })}</p>}
        {estado.recorde &&
          meu?.resultado &&
          (estado.recorde.novo ? (
            <p className="minijogo-situacao ringue-recorde">{t('Novo recorde!')}</p>
          ) : (
            estado.recorde.antes && <p className="minijogo-situacao">{t('Seu recorde: {tempo}', { tempo: resumo(estado.recorde.antes, estado.adversarios) })}</p>
          ))}
        {linhas.length > 1 && (
          <ol className="ringue-placar">
            {linhas.map((l) => (
              <li key={l.userId} className={l.userId === eu ? 'eu' : undefined}>
                <span className="ringue-placar-pos">{fim ? (l.posicao === null ? '–' : valem >= 2 && l.posicao <= 3 ? MEDALHAS[l.posicao - 1] : l.posicao) : ''}</span>
                <span className="minijogo-nome">{l.username}</span>
                <strong>{l.resultado ? resumo(l.resultado, estado.adversarios) : fim ? '—' : '…'}</strong>
              </li>
            ))}
          </ol>
        )}
      </div>
    );
  }
  if (!jogador || !meu || !desdeALargada) return <p className="minijogo-situacao">…</p>;
  if (!estado.solo && estado.fase === 'largada' && contagem <= 0) return <p className="minijogo-situacao">…</p>;
  const outros = estado.solo
    ? []
    : estado.placar.filter((l) => l.userId !== eu).map((l) => ({ nome: l.username, ...(rivais.get(l.userId) ?? { adv: 0, quedas: 0, caido: false }) }));
  return (
    <Ringue
      key={estado.partidaId}
      semente={estado.semente}
      solo={estado.solo}
      avatar={estado.avatar}
      esperaMs={estado.solo ? 0 : contagem}
      outros={outros}
      aoProgresso={estado.solo ? undefined : (dados) => socket?.emit('minijogo:tempo-real', { channelId, dados })}
      aoTerminar={(entradas) => void agir({ tipo: 'fim', entradas })}
    />
  );
}

interface Painel {
  fase: Luta['fase'];
  venceu: boolean | null;
  nocaute: boolean;
  caido: boolean;
  espera: number | null;
}

/** As teclas: as setas (ou WASD) para esquivar, abaixar e defender; Z e X os socos; Espaço o soco forte. */
const TECLAS: Record<string, number> = {
  arrowleft: ESQ,
  a: ESQ,
  arrowright: DIR,
  d: DIR,
  arrowdown: BAIXO,
  s: BAIXO,
  arrowup: CIMA,
  w: CIMA,
  z: SOCO_E,
  j: SOCO_E,
  x: SOCO_D,
  k: SOCO_D,
  ' ': FORTE,
  c: FORTE,
};

function somDe(e: Evento) {
  switch (e.tipo) {
    case 'soco':
      tocar(e.forte ? 'combo' : 'soco');
      break;
    case 'bloqueado':
      tocar('clique');
      break;
    case 'esquivou':
      tocar('pulo');
      break;
    case 'atingido':
      tocar('empurrao');
      break;
    case 'estrela':
      tocar('moeda');
      break;
    case 'interrompeu':
      tocar('acerto');
      break;
    case 'queda':
      tocar('queda');
      break;
    case 'contagem':
      tocar('vez');
      break;
    case 'gongo':
      tocar('chegada');
      break;
    case 'cansou':
      tocar('erro');
      break;
    case 'fim-da-luta':
      tocar(e.venceu ? 'fim' : 'erro');
      break;
  }
}

function Ringue({
  semente,
  solo,
  avatar,
  esperaMs,
  outros,
  aoProgresso,
  aoTerminar,
}: {
  semente: number;
  solo: boolean;
  avatar: AvatarDoJogo;
  esperaMs: number;
  outros: { nome: string; adv: number; quedas: number; caido: boolean }[];
  aoProgresso?: (dados: { adv: number; quedas: number; caido: boolean }) => void;
  aoTerminar: (entradas: number[]) => void;
}) {
  const t = useT();
  const tela = useRef<HTMLCanvasElement>(null);
  const [pronta, setPronta] = useState(false);
  const [falhou, setFalhou] = useState(false);
  const [painel, setPainel] = useState<Painel>({ fase: 'apresentacao', venceu: null, nocaute: false, caido: false, espera: null });
  const terminar = useRef(aoTerminar);
  terminar.current = aoTerminar;
  const progresso = useRef(aoProgresso);
  progresso.current = aoProgresso;
  const { pausa, pausado, continuar } = usePausaComEsc(solo && pronta);
  /** O que está apertado agora, e o que foi apertado desde o último passo (um toque rápido entre dois passos não se perde). */
  const apertado = useRef(0);
  const pendente = useRef(0);
  const [toque] = useState(() => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches);

  useEffect(() => {
    const canvas = tela.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) {
      setFalhou(true);
      return;
    }
    let viva = true;
    let id = 0;
    carregarFolhas().then(() => {
      if (!viva) return;
      const d = new DesenhoDoRingue(ctx, avatar);
      const l = novaLuta(semente);
      if (import.meta.env.DEV) window.ringueDoTeste = l;
      const entradas: number[] = [];
      let acumulado = 0;
      let ultimo = performance.now();
      let ultimoPainel = 0;
      let ultimoProgresso = 0;
      let largada = performance.now() + esperaMs;
      let mandou = false;
      setPronta(true);

      const quadro = () => {
        if (!viva) return;
        id = requestAnimationFrame(quadro);
        const agora = performance.now();
        const dt = Math.min(0.1, (agora - ultimo) / 1000);
        ultimo = agora;
        // sem foco (o jogo de verdade, outra janela), escondida ou pausada (ESC): nem regra, nem desenho
        if (document.hidden || !document.hasFocus() || pausa.ativa) {
          if (largada > agora) largada += dt * 1000;
          apertado.current = 0;
          pendente.current = 0;
          return;
        }
        const esperando = largada > agora;
        if (!esperando && !l.terminou) {
          acumulado += dt;
          let n = 0;
          while (acumulado >= PASSO && n < 6 && !l.terminou) {
            let bits = (apertado.current | pendente.current) & 127;
            if (import.meta.env.DEV && window.ringuePilotoAutomatico) bits = comandoDoPiloto(l);
            pendente.current = 0;
            anotar(entradas, bits);
            passo(l, bits);
            for (const e of l.eventos) somDe(e);
            d.ouvir(l.eventos, agora);
            acumulado -= PASSO;
            n++;
          }
          if (n === 6) acumulado = 0;
        }
        d.desenhar(l, agora, true);
        if (agora - ultimoPainel > 100) {
          ultimoPainel = agora;
          setPainel((p) => {
            const novo: Painel = {
              fase: l.fase,
              venceu: l.venceuUltima,
              nocaute: l.nocaute,
              caido: l.queda === 'jogador',
              espera: esperando ? Math.ceil((largada - agora) / 1000) : null,
            };
            return p.fase === novo.fase && p.venceu === novo.venceu && p.nocaute === novo.nocaute && p.caido === novo.caido && p.espera === novo.espera ? p : novo;
          });
        }
        if (progresso.current && agora - ultimoProgresso > 500 && !l.terminou) {
          ultimoProgresso = agora;
          progresso.current({ adv: l.adv, quedas: l.a.quedas, caido: l.queda === 'jogador' });
        }
        if (l.terminou && !mandou) {
          mandou = true;
          terminar.current(entradas);
        }
      };
      id = requestAnimationFrame(quadro);
    }, () => viva && setFalhou(true));
    return () => {
      viva = false;
      cancelAnimationFrame(id);
    };
    // a luta nasce uma vez por semente
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [semente]);

  useEffect(() => {
    const ignorar = (ev: KeyboardEvent) => {
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return true;
      const alvo = ev.target as HTMLElement | null;
      return !!alvo && (alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA' || alvo.isContentEditable);
    };
    const desce = (ev: KeyboardEvent) => {
      if (ignorar(ev)) return;
      const b = TECLAS[ev.key.toLowerCase()];
      if (!b) return;
      ev.preventDefault();
      if (ev.repeat) return;
      apertado.current |= b;
      pendente.current |= b;
    };
    const sobe = (ev: KeyboardEvent) => {
      const b = TECLAS[ev.key.toLowerCase()];
      if (b) apertado.current &= ~b;
    };
    const solta = () => (apertado.current = 0);
    window.addEventListener('keydown', desce);
    window.addEventListener('keyup', sobe);
    window.addEventListener('blur', solta);
    return () => {
      window.removeEventListener('keydown', desce);
      window.removeEventListener('keyup', sobe);
      window.removeEventListener('blur', solta);
    };
  }, []);

  /** Os botões da tela de toque: apertar segura o bit, soltar solta. */
  const botao = (bit: number, rotulo: string, figura: string, classe: string) => (
    <button
      type="button"
      className={`ringue-botao ${classe}`}
      aria-label={rotulo}
      onPointerDown={(e) => {
        e.preventDefault();
        apertado.current |= bit;
        pendente.current |= bit;
      }}
      onPointerUp={() => (apertado.current &= ~bit)}
      onPointerCancel={() => (apertado.current &= ~bit)}
      onPointerLeave={() => (apertado.current &= ~bit)}
    >
      {figura}
    </button>
  );

  if (falhou) return <p className="minijogo-situacao">…</p>;
  const faixa =
    painel.fase === 'resultado'
      ? painel.venceu
        ? painel.nocaute
          ? t('Nocaute!')
          : t('Vitória!')
        : t('Derrota')
      : painel.caido
        ? t('Aperte os socos para levantar!')
        : null;
  return (
    <div className="ringue">
      <div className="ringue-moldura">
        <canvas ref={tela} className="ringue-tela" width={LARGURA} height={ALTURA} />
        {pronta && faixa && <div className={`ringue-faixa${painel.fase === 'resultado' ? (painel.venceu ? ' venceu' : ' perdeu') : ''}`}>{faixa}</div>}
        {pronta && painel.espera !== null && <div className="ringue-espera">{painel.espera}</div>}
        {outros.length > 0 && (
          <ol className="ringue-turma" aria-hidden="true">
            {outros.map((o) => (
              <li key={o.nome} className={o.caido ? 'caido' : undefined}>
                <span className="minijogo-nome">{o.nome}</span>
                <span className="ringue-turma-luta">
                  {ADVERSARIOS.map((A, i) => (
                    <i key={A.bicho} style={{ background: i < o.adv ? '#ffd84a' : i === o.adv ? A.luva : undefined }} />
                  ))}
                </span>
              </li>
            ))}
          </ol>
        )}
        {pausado && <TelaDePausa aoContinuar={continuar} />}
      </div>
      {toque && (
        <div className="ringue-botoes">
          <div>
            {botao(ESQ, t('Esquivar'), '◀', 'esquiva')}
            {botao(BAIXO, t('Abaixar e defender'), '▼', 'abaixa')}
            {botao(CIMA, t('Abaixar e defender'), '▲', 'defende')}
            {botao(DIR, t('Esquivar'), '▶', 'esquiva')}
          </div>
          <div>
            {botao(SOCO_E, t('Socar'), '👊', 'soco')}
            {botao(FORTE, t('Soco forte'), '★', 'forte')}
            {botao(SOCO_D, t('Socar'), '👊', 'soco')}
          </div>
        </div>
      )}
      <ComandosDoJogo
        itens={[
          { teclas: ['setas-lado'], rotulo: t('Esquivar') },
          { teclas: ['setas'], rotulo: t('Abaixar e defender') },
          { teclas: ['z', 'x'], rotulo: t('Socar') },
          { teclas: ['espaco'], rotulo: t('Soco forte') },
          ...(solo ? [comandoDaPausa(t)] : []),
        ]}
      />
    </div>
  );
}
