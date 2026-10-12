import { Eraser, Trash2, Undo2 } from 'lucide-react';
import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import type { Socket } from 'socket.io-client';
import { useT } from './i18n';
import { Placar, Relogio } from './Minijogo';
import { CORES_DO_DESENHO, ESPESSURAS_DO_DESENHO, PALAVRAS_DO_DESENHO, primeiraForma, type EstadoDesenho, type Partida } from './minijogos';

const ESCOLHENDO_MS = 15_000;
const DESENHANDO_MS = 80_000;
const REVELANDO_MS = 5_000;
/** O quadro tem 1000 de largura por 750 de altura, em qualquer tela: o traço viaja nessa medida. */
const LARGURA = 1000;
const ALTURA = 750;
/** De quanto em quanto tempo o pedaço do traço que está sendo feito sai para os outros. */
const ENVIO_MS = 40;

type Tracos = Map<number, { c: number; e: number; partes: Map<number, number[]> }>;

/**
 * O DESENHA E ADIVINHA (ver server/src/minijogo-desenho.ts). O quadro, à esquerda, é o mesmo para todos: quem
 * desenha risca, e o traço aparece nos outros enquanto a mão se mexe (pelo socket, em pedaços de 40 ms). À
 * direita, os chutes de todo mundo e a caixa para chutar.
 *
 * OS TRAÇOS SE JUNTAM, NÃO SE TROCAM: o pedaço que chega pelo socket e o estado que chega pela rota podem vir
 * em qualquer ordem, e cada pedaço tem número. Só quando o desenho é apagado ou desfeito (a `versao` muda) os
 * traços do servidor substituem os daqui.
 */
export function JogoDesenho({
  estado,
  eu,
  restante,
  agir,
  socket,
  channelId,
}: {
  estado: EstadoDesenho & Partida;
  eu: number;
  restante: number;
  agir: (corpo: Record<string, unknown>) => void;
  socket: Socket | null;
  channelId: number;
}) {
  const t = useT();
  const desenho = estado.quemDesenha === eu;
  const desenhando = estado.fase === 'desenhando';
  const acertei = estado.acertaram.includes(eu);
  const nome = (userId: number) => estado.placar.find((l) => l.userId === userId)?.username ?? '?';

  const quadro = useRef<HTMLCanvasElement>(null);
  const tracos = useRef<Tracos>(new Map());
  const versao = useRef(-1);
  const [cor, setCor] = useState(0);
  const [espessura, setEspessura] = useState(1);
  const [chute, setChute] = useState('');
  const feed = useRef<HTMLOListElement>(null);

  const redesenhar = () => {
    const tela = quadro.current;
    const ctx = tela?.getContext('2d');
    if (!tela || !ctx) return;
    const largura = tela.clientWidth * devicePixelRatio;
    if (tela.width !== Math.round(largura)) {
      tela.width = Math.round(largura);
      tela.height = Math.round(largura * (ALTURA / LARGURA));
    }
    const escala = tela.width / LARGURA;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, tela.width, tela.height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const [, traco] of [...tracos.current.entries()].sort(([a], [b]) => a - b)) {
      const pontos = [...traco.partes.entries()].sort(([a], [b]) => a - b).flatMap(([, p]) => p);
      if (pontos.length < 2) continue;
      ctx.strokeStyle = CORES_DO_DESENHO[traco.c] ?? '#000';
      ctx.fillStyle = ctx.strokeStyle;
      ctx.lineWidth = (ESPESSURAS_DO_DESENHO[traco.e] ?? 8) * escala;
      if (pontos.length === 2) {
        ctx.beginPath();
        ctx.arc(pontos[0] * escala, pontos[1] * escala, ctx.lineWidth / 2, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }
      ctx.beginPath();
      ctx.moveTo(pontos[0] * escala, pontos[1] * escala);
      for (let k = 2; k < pontos.length; k += 2) ctx.lineTo(pontos[k] * escala, pontos[k + 1] * escala);
      ctx.stroke();
    }
  };

  const juntar = (traco: { t: number; c: number; e: number }, i: number, p: number[]) => {
    const atual = tracos.current.get(traco.t) ?? { c: traco.c, e: traco.e, partes: new Map() };
    atual.partes.set(i, p);
    tracos.current.set(traco.t, atual);
  };

  // O estado da rota: troca tudo se o desenho foi apagado/desfeito, senão junta.
  useEffect(() => {
    if (estado.versao !== versao.current) {
      tracos.current = new Map();
      versao.current = estado.versao;
    }
    for (const traco of estado.tracos) for (const [i, p] of traco.partes) juntar(traco, i, p);
    redesenhar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado.tracos, estado.versao]);

  // Os pedaços ao vivo, pelo socket.
  useEffect(() => {
    if (!socket) return;
    const chegou = (msg: { channelId: number; dados: { t: number; i: number; c: number; e: number; p: number[] } }) => {
      if (msg.channelId !== channelId) return;
      juntar(msg.dados, msg.dados.i, msg.dados.p);
      redesenhar();
    };
    socket.on('minijogo:tempo-real', chegou);
    return () => {
      socket.off('minijogo:tempo-real', chegou);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, channelId]);

  // A janela mudou de tamanho: o quadro acompanha.
  useEffect(() => {
    const aoMudar = () => redesenhar();
    window.addEventListener('resize', aoMudar);
    return () => window.removeEventListener('resize', aoMudar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    feed.current?.scrollTo({ top: feed.current.scrollHeight });
  }, [estado.chutes.length]);

  // ----- Desenhar (só quem desenha) -----
  const atual = useRef<{ t: number; i: number; pendentes: number[]; ultimo: number[] | null; relogio: ReturnType<typeof setInterval> | null } | null>(null);

  const enviar = () => {
    const a = atual.current;
    if (!a || a.pendentes.length === 0) return;
    // Cada pedaço começa no último ponto do anterior: assim os pedaços se emendam sem falha no meio.
    const p = a.ultimo && a.i > 0 ? [...a.ultimo, ...a.pendentes] : a.pendentes;
    const dados = { t: a.t, i: a.i, c: cor, e: espessura, p };
    juntar(dados, a.i, p);
    socket?.emit('minijogo:tempo-real', { channelId, dados });
    a.ultimo = a.pendentes.slice(-2);
    a.pendentes = [];
    a.i++;
  };

  const ponto = (e: PointerEvent<HTMLCanvasElement>) => {
    const caixa = e.currentTarget.getBoundingClientRect();
    const x = Math.round(((e.clientX - caixa.left) / caixa.width) * LARGURA);
    const y = Math.round(((e.clientY - caixa.top) / caixa.height) * ALTURA);
    return [Math.min(LARGURA, Math.max(0, x)), Math.min(ALTURA, Math.max(0, y))];
  };

  const podeDesenhar = desenho && desenhando;
  const comecarTraco = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!podeDesenhar) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const t = Math.max(0, ...tracos.current.keys()) + 1;
    atual.current = { t, i: 0, pendentes: ponto(e), ultimo: null, relogio: setInterval(enviar, ENVIO_MS) };
    enviar();
    redesenhar();
  };
  const moverTraco = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!atual.current) return;
    atual.current.pendentes.push(...ponto(e));
    // O próprio traço aparece na hora, sem esperar o pedaço sair.
    const a = atual.current;
    juntar({ t: a.t, c: cor, e: espessura }, a.i, a.ultimo ? [...a.ultimo, ...a.pendentes] : a.pendentes);
    redesenhar();
  };
  const terminarTraco = () => {
    if (!atual.current) return;
    enviar();
    if (atual.current.relogio) clearInterval(atual.current.relogio);
    atual.current = null;
  };
  useEffect(() => terminarTraco, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (estado.terminada) {
    return <Placar eu={eu} linhas={estado.placar.map((l) => ({ ...l, valor: String(l.pontos) }))} />;
  }

  // Todas as formas da tradução vão ao servidor (todas valem no chute); o botão mostra só a primeira.
  const formasDaPalavra = (id: string) => t(PALAVRAS_DO_DESENHO[id] ?? id);
  let topo: ReactNode;
  if (estado.fase === 'escolhendo') {
    topo = desenho ? (
      <div className="desenho-opcoes">
        <span>{t('Escolha o que desenhar:')}</span>
        {(estado.opcoes ?? []).map((id) => (
          <button key={id} type="button" className="btn-secondary" onClick={() => agir({ tipo: 'escolher', id, texto: formasDaPalavra(id) })}>
            {primeiraForma(formasDaPalavra(id))}
          </button>
        ))}
      </div>
    ) : (
      t('{nome} está escolhendo o que desenhar…', { nome: nome(estado.quemDesenha) })
    );
  } else if (estado.fase === 'revelando') {
    topo = t('Era: {palavra}', { palavra: [estado.palavra?.texto ?? '', ...(estado.palavra?.outras ?? [])].join(' / ') });
  } else if (estado.palavra) {
    topo = desenho ? t('Desenhe: {palavra}', { palavra: estado.palavra.texto }) : t('Você acertou: {palavra}', { palavra: estado.palavra.texto });
  } else {
    topo = (
      <span className="desenho-mascara" aria-label={t('{n} letras', { n: (estado.mascara ?? []).filter((c) => c !== ' ').length })}>
        {(estado.mascara ?? []).map((c, i) => (
          <span key={i} className={c === ' ' ? 'espaco' : c === '_' ? 'oculta' : 'dica'}>
            {c === '_' ? '' : c}
          </span>
        ))}
      </span>
    );
  }

  const total = { escolhendo: ESCOLHENDO_MS, desenhando: DESENHANDO_MS, revelando: REVELANDO_MS, fim: 1 }[estado.fase];

  return (
    <div className="desenho">
      <div className="desenho-topo" role="status">
        <span className="minijogo-rodada">{t('Vez {n} de {total}', { n: estado.vez, total: estado.vezes })}</span>
        <div className="desenho-palavra">{topo}</div>
      </div>
      <div className="desenho-corpo">
        <div className="desenho-quadro-e-ferramentas">
          <canvas
            ref={quadro}
            className={`desenho-quadro${podeDesenhar ? ' meu' : ''}`}
            onPointerDown={comecarTraco}
            onPointerMove={moverTraco}
            onPointerUp={terminarTraco}
            onPointerCancel={terminarTraco}
          />
          {podeDesenhar && (
            <div className="desenho-ferramentas">
              {CORES_DO_DESENHO.map((hex, i) => (
                <button
                  key={hex}
                  type="button"
                  className={`desenho-cor${cor === i ? ' escolhida' : ''}`}
                  style={{ background: hex }}
                  aria-label={i === 1 ? t('Borracha') : hex}
                  aria-pressed={cor === i}
                  onClick={() => setCor(i)}
                >
                  {i === 1 && <Eraser size={14} aria-hidden="true" />}
                </button>
              ))}
              <span className="desenho-separador" />
              {ESPESSURAS_DO_DESENHO.map((largura, i) => (
                <button
                  key={largura}
                  type="button"
                  className={`desenho-espessura${espessura === i ? ' escolhida' : ''}`}
                  aria-label={t('Espessura {n}', { n: i + 1 })}
                  aria-pressed={espessura === i}
                  onClick={() => setEspessura(i)}
                >
                  <span style={{ width: 4 + i * 6, height: 4 + i * 6 }} />
                </button>
              ))}
              <span className="desenho-separador" />
              <button type="button" className="icon-plain" aria-label={t('Desfazer')} onClick={() => agir({ tipo: 'desfazer' })}>
                <Undo2 size={16} />
              </button>
              <button type="button" className="icon-plain" aria-label={t('Apagar tudo')} onClick={() => agir({ tipo: 'limpar' })}>
                <Trash2 size={16} />
              </button>
            </div>
          )}
        </div>
        <div className="desenho-lateral">
          <ol className="desenho-placar">
            {estado.placar.map((l) => (
              <li key={l.userId} className={`${estado.acertaram.includes(l.userId) ? 'acertou' : ''}${l.userId === estado.quemDesenha ? ' desenha' : ''}`}>
                <span className="minijogo-nome">
                  {l.userId === estado.quemDesenha && <span aria-hidden="true">✏️ </span>}
                  {l.username}
                </span>
                <span className="minijogo-pontos">{l.pontos}</span>
              </li>
            ))}
          </ol>
          <ol className="desenho-chutes" ref={feed}>
            {estado.chutes.map((c, i) => (
              <li key={i} className={c.texto ? (c.perto ? 'perto' : '') : 'acertou'}>
                <strong>{nome(c.userId)}</strong>{' '}
                {c.texto ? (c.perto ? t('{texto} — quase!', { texto: c.texto }) : c.texto) : t('acertou!')}
              </li>
            ))}
          </ol>
          {!desenho && desenhando && (
            <form
              className="desenho-chute"
              onSubmit={(e) => {
                e.preventDefault();
                if (!chute.trim()) return;
                agir({ tipo: 'chute', texto: chute });
                setChute('');
              }}
            >
              <input
                value={chute}
                maxLength={40}
                disabled={acertei}
                placeholder={acertei ? t('Você acertou!') : t('Seu chute…')}
                onChange={(e) => setChute(e.target.value)}
              />
            </form>
          )}
        </div>
      </div>
      <Relogio restante={restante} total={total} />
    </div>
  );
}
