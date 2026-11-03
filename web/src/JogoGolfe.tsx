import { useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { useT } from './i18n';
import { Placar, Relogio } from './Minijogo';
import type { EstadoGolfe, Partida } from './minijogos';
import { CORES_DAS_BOLAS, desenhar, pintarMesa } from './golfe/desenho';
import {
  ALTURA,
  BURACOS,
  FORCA_MAX,
  LARGURA,
  acabouOBuraco,
  avancar,
  bater,
  copiarBola,
  mapaDeDistancia,
  melhorTacada,
  novaBola,
  tacadaInvalida,
  type Bola,
  type Tacada,
} from './golfe/fisica';

/**
 * O MINIGOLFE DA TOCA (03/11/2026, server/src/minijogo-golfe.ts). Todos jogam o mesmo buraco ao mesmo tempo, cada um na
 * própria tela; as bolas dos outros aparecem como pontinhos coloridos (o tempo real do motor).
 *
 * A BOLA É SIMULADA AQUI E NO SERVIDOR, com o mesmo arquivo (golfe/fisica.ts). A tacada vai na hora, com o passo do relógio
 * do buraco em que foi dada; a tela não espera a resposta para mostrar a bola rolando. Se um dia as duas pontas
 * discordarem, a bola daqui se acerta pela do servidor quando parar.
 *
 * O RELÓGIO DO BURACO, neste computador: começa quando o "prepare-se" acaba (restanteMs) ou, para quem chega no meio, pelo
 * que o servidor diz que já passou (decorridoMs). É dele que sai o passo da tacada.
 */

/** O arraste que dá a força toda, em unidades da mesa. */
const ARRASTE_TOTAL = 40;
/** A força mínima de uma tacada (abaixo disto, soltar não bate). */
const FORCA_MINIMA = 0.05;
/** O Espaço segurado enche a força neste tempo (e volta, se continuar segurado). */
const CARGA_MS = 1400;

/** O vetor da tacada em inteiros, sem passar da força toda depois de arredondar. */
function vetorDaTacada(ux: number, uy: number, forca: number) {
  let f = Math.min(1, forca) * FORCA_MAX;
  for (;;) {
    const dx = Math.round(ux * f);
    const dy = Math.round(uy * f);
    if (dx * dx + dy * dy <= FORCA_MAX * FORCA_MAX) return { dx, dy };
    f -= 1;
  }
}

const passoDe = (inicio: number, agora: number) => Math.max(0, Math.floor(((agora - inicio) * 60) / 1000));

export function JogoGolfe({
  estado,
  eu,
  jogador,
  agir,
  socket,
  channelId,
}: {
  estado: EstadoGolfe & Partida;
  eu: number;
  jogador: boolean;
  agir: (corpo: Record<string, unknown>) => unknown;
  socket: Socket | null;
  channelId: number;
}) {
  const t = useT();
  if (estado.terminada || estado.fase === 'fim') {
    // menos tacadas na frente; empatados dividem a posição, como no troféu
    return (
      <Placar
        eu={eu}
        linhas={estado.placar.map((l) => ({ ...l, valor: String(l.pontos), posicao: 1 + estado.placar.filter((o) => o.pontos < l.pontos).length }))}
      />
    );
  }
  if (estado.fase === 'placar') {
    return (
      <div className="golfe">
        <table className="golfe-placar">
          <thead>
            <tr>
              <th aria-hidden="true" />
              <th aria-hidden="true" />
              <th>{t('Neste buraco')}</th>
              <th>{t('Total')}</th>
            </tr>
          </thead>
          <tbody>
            {estado.placar.map((l) => (
              <tr key={l.userId} className={l.userId === eu ? 'eu' : undefined}>
                <td className="golfe-placar-posicao">{1 + estado.placar.filter((o) => o.pontos < l.pontos).length}</td>
                <td className="minijogo-nome">{l.username}</td>
                <td>{l.buraco ?? '–'}</td>
                <td>
                  <strong>{l.pontos}</strong>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  // a mesa é montada de novo a cada buraco e a cada partida: nada da anterior fica para a próxima
  return <MesaDoGolfe key={`${estado.partidaId}-${estado.buraco}`} estado={estado} eu={eu} jogador={jogador} agir={agir} socket={socket} channelId={channelId} />;
}

function MesaDoGolfe({
  estado,
  eu,
  jogador,
  agir,
  socket,
  channelId,
}: {
  estado: EstadoGolfe & Partida;
  eu: number;
  jogador: boolean;
  agir: (corpo: Record<string, unknown>) => unknown;
  socket: Socket | null;
  channelId: number;
}) {
  const t = useT();
  const buraco = BURACOS[estado.buraco] ?? BURACOS[0];
  const canvas = useRef<HTMLCanvasElement>(null);
  const souJogador = jogador && estado.bolas.some((b) => b.userId === eu);
  const naSala = !estado.solo;

  // o começo do buraco, neste relógio: o primeiro que se soube
  const inicio = useRef<number | null>(null);
  if (inicio.current === null) {
    if (estado.fase === 'preparando') inicio.current = estado.recebidaEm + estado.restanteMs;
    else if (estado.decorridoMs !== null) inicio.current = estado.recebidaEm - estado.decorridoMs;
  }

  /** A minha bola, simulada aqui. */
  const bola = useRef<Bola>(estado.meu ? copiarBola(estado.meu) : novaBola(buraco));
  /** A última bola que o servidor mandou, e quantas tacadas ainda não voltaram dele. */
  const doServidor = useRef(estado.meu);
  doServidor.current = estado.meu;
  const pendentes = useRef(0);
  /** Quando a última resposta voltou: o estado novo do servidor chega à tela um instante depois dela. */
  const calmoDesde = useRef(0);
  const [tacadas, setTacadas] = useState(bola.current.tacadas);
  const [acabou, setAcabou] = useState(acabouOBuraco(bola.current));
  const [molhou, setMolhou] = useState(false);
  const [agora, setAgora] = useState(Date.now());

  const outrosDoServidor = useRef(estado.bolas);
  outrosDoServidor.current = estado.bolas;
  /** O pontinho de cada um, pelo tempo real (quando chegou). */
  const pontinhos = useRef(new Map<number, { x: number; y: number; em: number }>());
  const cores = useRef(new Map<number, string>());
  estado.bolas.forEach((b, i) => cores.current.set(b.userId, CORES_DAS_BOLAS[i % CORES_DAS_BOLAS.length]));

  const jogando = estado.fase === 'jogando' && !estado.terminada;
  const jogandoRef = useRef(jogando);
  jogandoRef.current = jogando;

  // AS BOLAS DOS OUTROS chegam pelo socket, já com quem mandou (o servidor carimba)
  useEffect(() => {
    if (!socket || !naSala) return;
    const chegou = (m: { channelId?: number; dados?: Record<string, unknown> }) => {
      if (m.channelId !== channelId || !m.dados) return;
      const { userId, x, y, buraco: n } = m.dados;
      if (typeof userId !== 'number' || typeof x !== 'number' || typeof y !== 'number' || n !== estado.buraco || userId === eu) return;
      pontinhos.current.set(userId, { x, y, em: Date.now() });
    };
    socket.on('minijogo:tempo-real', chegou);
    return () => {
      socket.off('minijogo:tempo-real', chegou);
    };
  }, [socket, naSala, channelId, estado.buraco, eu]);

  /** A mira: pelo arraste (ponteiro) ou pelas setas e o Espaço. */
  const mira = useRef<{ ux: number; uy: number; forca: number } | null>(null);
  const arraste = useRef<{ id: number } | null>(null);
  const teclas = useRef({ esquerda: false, direita: false, cima: false, baixo: false, espaco: false, cargaDesde: 0 });
  const angulo = useRef<{ ux: number; uy: number } | null>(null);

  const podeBater = () => souJogador && jogandoRef.current && !bola.current.andando && !acabouOBuraco(bola.current) && inicio.current !== null && Date.now() >= inicio.current;

  const baterAgora = (ux: number, uy: number, forca: number) => {
    if (!podeBater() || forca < FORCA_MINIMA || inicio.current === null) return;
    const { dx, dy } = vetorDaTacada(ux, uy, forca);
    const tacada: Tacada = { passo: Math.max(bola.current.passo, passoDe(inicio.current, Date.now())), dx, dy };
    if (tacadaInvalida(bola.current, tacada)) return;
    bater(bola.current, tacada);
    pendentes.current++;
    void Promise.resolve(agir({ tipo: 'tacada', ...tacada })).finally(() => {
      pendentes.current--;
      calmoDesde.current = Date.now();
    });
    setTacadas(bola.current.tacadas);
  };
  const baterRef = useRef(baterAgora);
  baterRef.current = baterAgora;

  // O LAÇO: a bola anda no passo do relógio, e a tela é desenhada a cada quadro
  useEffect(() => {
    const tela = canvas.current;
    const ctx = tela?.getContext('2d');
    if (!tela || !ctx) return;
    const mesa = pintarMesa(buraco);
    const distancia = import.meta.env.DEV ? mapaDeDistancia(buraco) : null;
    let pilotoEm = 0;
    let id = 0;
    let enviadoEm = 0;
    let estavaAndando = false;
    let ultimaTacadas = bola.current.tacadas;
    let ultimoRelogio = 0;
    let ultimoAcabou = acabouOBuraco(bola.current);
    /** As tacadas quando a bola começou a rolar: se subirem durante o rolar, foi a água. */
    let tacadasAoRolar: number | null = null;
    let avisoDaAgua: ReturnType<typeof setTimeout> | undefined;
    const quadro = () => {
      const agoraMs = Date.now();
      const passoAgora = inicio.current === null ? 0 : passoDe(inicio.current, agoraMs);
      const b = bola.current;
      if (b.andando && tacadasAoRolar === null) tacadasAoRolar = b.tacadas;
      // a simulação alcança o relógio (com um teto por quadro, para a aba que volta de muito tempo parada)
      for (let k = 0; k < 900 && b.andando && b.passo < passoAgora; k++) avancar(buraco, b);
      if (!b.andando && tacadasAoRolar !== null) {
        if (b.tacadas > tacadasAoRolar) {
          setMolhou(true);
          clearTimeout(avisoDaAgua);
          avisoDaAgua = setTimeout(() => setMolhou(false), 2200);
        }
        tacadasAoRolar = null;
      }
      if (b.tacadas !== ultimaTacadas) {
        ultimaTacadas = b.tacadas;
        setTacadas(b.tacadas);
      }
      // parada, a bola se acerta pela do servidor se as duas discordarem (e nada está a caminho dele)
      const s = doServidor.current;
      if (!b.andando && pendentes.current === 0 && agoraMs - calmoDesde.current > 800 && s && !s.andando && (s.tacadas !== b.tacadas || s.x !== b.x || s.y !== b.y || s.dentro !== b.dentro)) {
        bola.current = copiarBola(s);
        ultimaTacadas = s.tacadas;
        setTacadas(s.tacadas);
      }
      if (acabouOBuraco(bola.current) !== ultimoAcabou) {
        ultimoAcabou = !ultimoAcabou;
        setAcabou(ultimoAcabou);
      }
      // o meu pontinho para os outros, enquanto a bola anda (e uma vez quando para)
      if (naSala && socket && souJogador && (b.andando || estavaAndando) && agoraMs - enviadoEm >= 100) {
        enviadoEm = agoraMs;
        socket.emit('minijogo:tempo-real', { channelId, dados: { x: bola.current.x, y: bola.current.y } });
        estavaAndando = b.andando;
      }
      // a mira pelas teclas
      const k = teclas.current;
      if (souJogador && (k.esquerda || k.direita || k.cima || k.baixo || k.espaco)) {
        if (!angulo.current) angulo.current = direcaoAoBuraco();
        const giro = (k.esquerda ? -0.045 : 0) + (k.direita ? 0.045 : 0) + (k.cima ? -0.008 : 0) + (k.baixo ? 0.008 : 0);
        if (giro) {
          const { ux, uy } = angulo.current;
          const c = Math.cos(giro);
          const sn = Math.sin(giro);
          angulo.current = { ux: ux * c - uy * sn, uy: ux * sn + uy * c };
        }
        const carga = k.espaco ? ((agoraMs - k.cargaDesde) % (CARGA_MS * 2)) / CARGA_MS : 0;
        mira.current = { ...angulo.current, forca: k.espaco ? (carga <= 1 ? carga : 2 - carga) : 0.35 };
      } else if (!arraste.current && !k.espaco) {
        mira.current = null;
      }
      // o piloto automático do e2e (só no site de desenvolvimento)
      if (import.meta.env.DEV && distancia && (window as { golfePilotoAutomatico?: boolean }).golfePilotoAutomatico && podeBater()) {
        if (!pilotoEm) pilotoEm = agoraMs + 500;
        else if (agoraMs >= pilotoEm) {
          pilotoEm = 0;
          const tc = melhorTacada(buraco, bola.current, Math.max(bola.current.passo, passoAgora), distancia);
          const f = Math.sqrt(tc.dx * tc.dx + tc.dy * tc.dy);
          baterRef.current(tc.dx / f, tc.dy / f, f / FORCA_MAX);
        }
      }
      const outros: { x: number; y: number; cor: string; dentro: boolean }[] = [];
      for (const o of outrosDoServidor.current) {
        if (o.userId === eu) continue;
        const p = pontinhos.current.get(o.userId);
        // o pontinho do tempo real enquanto ela joga; parado há um tempo, o lugar que o servidor simulou
        const usar = p && agoraMs - p.em < 1500 ? p : o;
        outros.push({ x: usar.x, y: usar.y, cor: cores.current.get(o.userId) ?? CORES_DAS_BOLAS[0], dentro: o.dentro && usar === o });
      }
      desenhar(ctx, {
        buraco,
        mesa,
        passo: bola.current.andando ? bola.current.passo : passoAgora,
        minha: souJogador ? { x: bola.current.x, y: bola.current.y, dentro: bola.current.dentro } : null,
        outros,
        mira: souJogador && podeBater() ? mira.current : null,
      });
      if (agoraMs - ultimoRelogio > 250) {
        ultimoRelogio = agoraMs;
        setAgora(agoraMs);
      }
      id = requestAnimationFrame(quadro);
    };
    id = requestAnimationFrame(quadro);
    return () => {
      cancelAnimationFrame(id);
      clearTimeout(avisoDaAgua);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buraco, souJogador, naSala, socket, channelId, eu]);

  const direcaoAoBuraco = () => {
    const dx = buraco.buraco[0] - bola.current.x;
    const dy = buraco.buraco[1] - bola.current.y;
    const l = Math.sqrt(dx * dx + dy * dy) || 1;
    return { ux: dx / l, uy: dy / l };
  };

  // AS TECLAS: as setas miram, o Espaço segurado enche a força, e soltar bate. Fora dos campos de texto; soltar a tecla vale
  // sempre, e a janela que perde o foco solta tudo sem bater.
  useEffect(() => {
    if (!souJogador) return;
    const nome = (e: KeyboardEvent) =>
      e.key === 'ArrowLeft' ? 'esquerda' : e.key === 'ArrowRight' ? 'direita' : e.key === 'ArrowUp' ? 'cima' : e.key === 'ArrowDown' ? 'baixo' : e.key === ' ' ? 'espaco' : null;
    const desce = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement | null;
      if (alvo && (alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA' || alvo.isContentEditable)) return;
      const n = nome(e);
      if (!n || e.ctrlKey || e.metaKey || e.altKey || !podeBater()) return;
      e.preventDefault();
      if (e.repeat) return;
      if (n === 'espaco') teclas.current.cargaDesde = Date.now();
      teclas.current[n] = true;
    };
    const sobe = (e: KeyboardEvent) => {
      const n = nome(e);
      if (!n) return;
      if (n === 'espaco' && teclas.current.espaco && mira.current) baterRef.current(mira.current.ux, mira.current.uy, mira.current.forca);
      teclas.current[n] = false;
    };
    const soltarTudo = () => {
      teclas.current = { esquerda: false, direita: false, cima: false, baixo: false, espaco: false, cargaDesde: 0 };
      arraste.current = null;
      mira.current = null;
    };
    const visivel = () => document.visibilityState !== 'visible' && soltarTudo();
    window.addEventListener('keydown', desce);
    window.addEventListener('keyup', sobe);
    window.addEventListener('blur', soltarTudo);
    document.addEventListener('visibilitychange', visivel);
    return () => {
      window.removeEventListener('keydown', desce);
      window.removeEventListener('keyup', sobe);
      window.removeEventListener('blur', soltarTudo);
      document.removeEventListener('visibilitychange', visivel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [souJogador]);

  /** O ponteiro em unidades da mesa. */
  const naMesa = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * LARGURA) / r.width, y: ((e.clientY - r.top) * ALTURA) / r.height };
  };
  const mirarPeloPonteiro = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const p = naMesa(e);
    // puxar para trás: a tacada vai para o lado oposto do arraste
    const dx = bola.current.x - p.x;
    const dy = bola.current.y - p.y;
    const l = Math.sqrt(dx * dx + dy * dy);
    mira.current = l < 1 ? { ux: 1, uy: 0, forca: 0 } : { ux: dx / l, uy: dy / l, forca: Math.min(1, l / ARRASTE_TOTAL) };
  };

  const restante = inicio.current === null ? estado.duracaoMs : estado.fase === 'preparando' ? estado.duracaoMs : Math.max(0, estado.duracaoMs - (agora - inicio.current));
  const contagem = estado.fase === 'preparando' && inicio.current !== null ? Math.max(1, Math.ceil((inicio.current - agora) / 1000)) : null;

  return (
    <div className="golfe">
      <div className="golfe-topo">
        {souJogador && <span className="golfe-tacadas">{t('Tacadas: {n}', { n: tacadas })}</span>}
        {estado.fase === 'jogando' && <Relogio restante={restante} total={estado.duracaoMs} />}
      </div>
      <div className="golfe-moldura">
        <canvas
          ref={canvas}
          className="golfe-tela"
          width={LARGURA}
          height={ALTURA}
          onPointerDown={(e) => {
            if (!podeBater() || e.button > 0) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            arraste.current = { id: e.pointerId };
            mirarPeloPonteiro(e);
          }}
          onPointerMove={(e) => {
            if (arraste.current?.id === e.pointerId) mirarPeloPonteiro(e);
          }}
          onPointerUp={(e) => {
            if (arraste.current?.id !== e.pointerId) return;
            arraste.current = null;
            const m = mira.current;
            mira.current = null;
            if (m) baterRef.current(m.ux, m.uy, m.forca);
          }}
          onPointerCancel={() => {
            arraste.current = null;
            mira.current = null;
          }}
        />
        {contagem !== null && (
          <span className="golfe-contagem" aria-hidden="true">
            {contagem}
          </span>
        )}
      </div>
      {souJogador && estado.fase === 'preparando' && <p className="minijogo-situacao">{t('Puxe a bola para trás e solte. No teclado: as setas miram, e o Espaço segurado dá a força.')}</p>}
      {souJogador && jogandoComBola(estado.fase, acabou, molhou, bola.current.dentro, t)}
    </div>
  );
}

function jogandoComBola(fase: string, acabou: boolean, molhou: boolean, dentro: boolean, t: ReturnType<typeof useT>) {
  if (fase !== 'jogando') return null;
  if (molhou) return <p className="minijogo-situacao golfe-aviso">{t('Na água! Mais uma tacada.')}</p>;
  if (!acabou) return null;
  return (
    <p className="minijogo-situacao">
      {dentro ? t('No buraco!') : t('Acabaram as tacadas.')} {t('Você terminou! Agora é torcer pelos outros.')}
    </p>
  );
}
