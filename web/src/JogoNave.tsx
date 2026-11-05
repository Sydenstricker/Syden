import { ComandosDoJogo } from './ComandosDosJogos';
import { tocar } from './somDosJogos';
import { useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { useT } from './i18n';
import { Placar, Relogio } from './Minijogo';
import type { Partida } from './minijogos';
import { CORES_DA_ESQUADRILHA, desenhar, pintarHorta, type Outro } from './nave/desenho';
import { Mundo, type Comandos } from './nave/mundo';
import { pilotar } from './nave/piloto';
import { ALTURA, FIM, LARGURA, PASSOS_POR_S } from './nave/sim';
import './nave/nave.css';

/**
 * A ESQUADRILHA DA TOCA (05/11/2026, server/src/minijogo-nave.ts). Os coelhos em aviõezinhos de cenoura contra a praga da
 * horta; a turma enfrenta as MESMAS ondas, cada um na própria tela, e vê os outros meio transparentes.
 *
 * O JOGO RODA AQUI, passo a passo (nave/mundo.ts), com a mesma regra do servidor (nave/sim.ts, igual byte a byte). O que conta
 * (o acerto, o item, o golpe, a bomba) vai em lotes pelo tempo real, junto com o lugar da nave, e o servidor confere com a
 * mesma ficha. O relógio da partida, neste computador, como na Caça: começa quando o "prepare-se" acaba (restanteMs) ou, para
 * quem chega no meio, pelo que o servidor diz que já passou (decorridoMs).
 *
 * A JANELA SEM FOCO: a partida é de todos e não para, então a nave fica parada, sem atirar e sem levar dano, e a tela não é
 * desenhada. Quem perdeu as três vidas (ou só assiste) segue alguém da esquadrilha: os inimigos que somem são os dessa pessoa.
 */

export interface EstadoNave {
  fase: 'preparando' | 'jogando' | 'fim';
  semente: number;
  duracaoMs: number;
  decorridoMs: number | null;
  jogadores: { userId: number; username: string; pontos: number; vidas: number; chefe: boolean; acabou: boolean; posicao: number | null }[];
  /** A soma de todos: o placar da esquadrilha. */
  esquadrilha: number;
  meu: { vidas: number; bombas: number; escudo: boolean; mortos: number[]; acabou: boolean } | null;
  recorde: { antes: number | null; novo: boolean } | null;
  solo: boolean;
  partidaId: string;
}

/** Um lote a cada isto (o lugar da nave e os eventos). */
const LOTE_MS = 100;
/** Os outros aparecem este tanto de passos atrás (o tempo de chegar pela rede), interpolados. */
const ATRASO_DOS_OUTROS = 8;

export function JogoNave({
  estado,
  eu,
  jogador,
  socket,
  channelId,
}: {
  estado: EstadoNave & Partida;
  eu: number;
  jogador: boolean;
  socket: Socket | null;
  channelId: number;
}) {
  const t = useT();
  if (estado.terminada || estado.fase === 'fim') {
    const ficaram = estado.jogadores.filter((l) => l.posicao !== null);
    const venceram = estado.jogadores.some((l) => l.chefe);
    return (
      <div className="nave-fim">
        <p className="nave-desfecho">{venceram ? t('O espantalho caiu!') : t('A praga venceu desta vez.')}</p>
        {estado.recorde &&
          (estado.recorde.novo ? (
            <p className="minijogo-situacao nave-recorde">{t('Novo recorde!')}</p>
          ) : (
            estado.recorde.antes !== null && <p className="minijogo-situacao">{t('Seu recorde: {tempo}', { tempo: String(estado.recorde.antes) })}</p>
          ))}
        {!estado.solo && <p className="nave-esquadrilha-total">{t('Placar da esquadrilha: {n}', { n: estado.esquadrilha })}</p>}
        <Placar eu={eu} linhas={(ficaram.length ? ficaram : estado.jogadores).map((l) => ({ ...l, valor: String(l.pontos), posicao: l.posicao ?? undefined }))} />
      </div>
    );
  }
  return <Ceu key={estado.partidaId} estado={estado} eu={eu} jogador={jogador} socket={socket} channelId={channelId} />;
}

interface DoOutro {
  amostras: { p: number; x: number; y: number }[];
  vidas: number;
  pts: number;
  fim: boolean;
  mortos: Map<number, number>;
}

function Ceu({ estado, eu, jogador, socket, channelId }: { estado: EstadoNave & Partida; eu: number; jogador: boolean; socket: Socket | null; channelId: number }) {
  const t = useT();
  const canvas = useRef<HTMLCanvasElement>(null);
  const souJogador = jogador && estado.meu !== null && estado.jogadores.some((l) => l.userId === eu);

  // o começo da partida, neste relógio: o primeiro que se soube
  const inicio = useRef<number | null>(null);
  if (inicio.current === null) {
    if (estado.fase === 'preparando') inicio.current = estado.recebidaEm + estado.restanteMs;
    else if (estado.decorridoMs !== null) inicio.current = estado.recebidaEm - estado.decorridoMs;
  }
  const mundo = useRef<Mundo | null>(null);
  if (!mundo.current) {
    const m = new Mundo(estado.semente, souJogador);
    // quem volta no meio (recarregou a página): o que o servidor já sabe
    if (estado.meu && estado.decorridoMs !== null) {
      for (const i of estado.meu.mortos) m.ficha.mortos.set(i, 0);
      m.ficha.vidas = estado.meu.vidas;
      m.ficha.bombas = estado.meu.bombas;
      m.ficha.escudo = estado.meu.escudo;
      if (estado.meu.acabou && estado.meu.vidas <= 0) m.ficha.morteFinal = 0;
    }
    mundo.current = m;
  }
  const outros = useRef(new Map<number, DoOutro>());
  const cores = new Map(estado.jogadores.map((l, i) => [l.userId, CORES_DA_ESQUADRILHA[i % CORES_DA_ESQUADRILHA.length]]));
  const coresRef = useRef(cores);
  coresRef.current = cores;
  const nomes = useRef(new Map<number, string>());
  for (const l of estado.jogadores) nomes.current.set(l.userId, l.username);

  const [hud, setHud] = useState({ pontos: 0, vidas: 3, bombas: 1, escudo: false, arma: 0, esquadrilha: 0, passo: -1, acabou: false, seguindo: null as string | null });
  const teclas = useRef({ esquerda: false, direita: false, cima: false, baixo: false, fogo: false, bomba: false });
  const toque = useRef<{ id: number; dedoX: number; dedoY: number; naveX: number; naveY: number; alvo: { x: number; y: number } } | null>(null);
  const [eToque, setEToque] = useState(false);

  // OS OUTROS chegam pelo socket, já com quem mandou (o servidor carimba)
  useEffect(() => {
    if (!socket || estado.solo) return;
    const chegou = (msg: { channelId?: number; dados?: Record<string, unknown> }) => {
      if (msg.channelId !== channelId || !msg.dados) return;
      const { userId, p, x, y, vidas, pts, m, fim } = msg.dados;
      if (typeof userId !== 'number' || userId === eu || typeof p !== 'number' || typeof x !== 'number' || typeof y !== 'number') return;
      let o = outros.current.get(userId);
      if (!o) outros.current.set(userId, (o = { amostras: [], vidas: 3, pts: 0, fim: false, mortos: new Map() }));
      const ultima = o.amostras[o.amostras.length - 1];
      if (!ultima || p > ultima.p) o.amostras.push({ p, x, y });
      if (o.amostras.length > 30) o.amostras.splice(0, o.amostras.length - 30);
      if (typeof vidas === 'number') o.vidas = vidas;
      if (typeof pts === 'number') o.pts = pts;
      o.fim = fim === 1;
      if (Array.isArray(m)) for (const i of m) if (typeof i === 'number') o.mortos.set(i, p);
    };
    socket.on('minijogo:tempo-real', chegou);
    return () => {
      socket.off('minijogo:tempo-real', chegou);
    };
  }, [socket, channelId, eu, estado.solo]);

  // O TECLADO: setas ou WASD andam, Espaço (ou Z) atira, X solta a bomba
  useEffect(() => {
    const mapa: Record<string, keyof typeof teclas.current> = {
      ArrowLeft: 'esquerda',
      KeyA: 'esquerda',
      ArrowRight: 'direita',
      KeyD: 'direita',
      ArrowUp: 'cima',
      KeyW: 'cima',
      ArrowDown: 'baixo',
      KeyS: 'baixo',
      Space: 'fogo',
      KeyZ: 'fogo',
      KeyX: 'bomba',
    };
    const mudar = (valor: boolean) => (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement | null;
      if (alvo && (alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA' || alvo.isContentEditable)) return;
      const k = mapa[e.code];
      if (!k) return;
      e.preventDefault();
      teclas.current[k] = valor;
    };
    const desce = mudar(true);
    const sobe = mudar(false);
    const solta = () => Object.keys(teclas.current).forEach((k) => (teclas.current[k as keyof typeof teclas.current] = false));
    window.addEventListener('keydown', desce);
    window.addEventListener('keyup', sobe);
    window.addEventListener('blur', solta);
    return () => {
      window.removeEventListener('keydown', desce);
      window.removeEventListener('keyup', sobe);
      window.removeEventListener('blur', solta);
    };
  }, []);

  // O LAÇO: o mundo anda no relógio da partida, e a tela é desenhada a cada quadro
  useEffect(() => {
    const tela = canvas.current;
    const ctx = tela?.getContext('2d');
    const m = mundo.current;
    if (!tela || !ctx || !m) return;
    const horta = pintarHorta();
    const calmo = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let id = 0;
    let ultimoLote = 0;
    let ultimoHud = 0;
    let ultimoSomDeTiro = 0;
    const piloto = () => import.meta.env.DEV && !!(window as { navePilotoAutomatico?: boolean }).navePilotoAutomatico;

    const enviar = (dados: unknown) => {
      if (!socket) return;
      if (estado.solo) socket.emit('minijogo-solo:tempo-real', { dados });
      else socket.emit('minijogo:tempo-real', { channelId, dados });
    };

    const quadro = () => {
      id = requestAnimationFrame(quadro);
      const agoraMs = Date.now();
      if (inicio.current === null) return;
      const alvo = Math.min(FIM, Math.floor(((agoraMs - inicio.current) * PASSOS_POR_S) / 1000));
      const semFoco = !piloto() && (document.hidden || !document.hasFocus());
      // quem ficou para trás (a aba voltou, ou chegou no meio) anda depressa até o passo de agora, sem a nave
      const atrasado = alvo - m.passo > 12;
      let rodou = 0;
      while (m.passo < alvo && rodou < 4000) {
        rodou++;
        let cmd: Comandos;
        if (piloto() && m.pilotando) cmd = pilotar(m);
        else {
          const k = teclas.current;
          const dedo = toque.current;
          cmd = {
            dx: (k.direita ? 1 : 0) - (k.esquerda ? 1 : 0),
            dy: (k.baixo ? 1 : 0) - (k.cima ? 1 : 0),
            fogo: k.fogo || !!dedo,
            bomba: k.bomba,
            alvo: dedo ? dedo.alvo : null,
          };
        }
        const o = m.avancar(cmd, semFoco || atrasado);
        if (cmd.bomba) teclas.current.bomba = false;
        if (!atrasado) {
          if (o.disparou && agoraMs - ultimoSomDeTiro > 240) {
            ultimoSomDeTiro = agoraMs;
            tocar('tiro');
          }
          if (o.chefe) tocar('fim');
          else if (o.derrubou) tocar('acerto');
          if (o.pegou) tocar('moeda');
          if (o.perdeuVida) tocar('queda');
          if (o.escudo) tocar('soco');
          if (o.bomba) tocar('combo');
        }
      }
      // quem não pilota segue alguém: o que tem mais pontos e ainda está no ar
      let seguindo: number | null = null;
      if (!m.pilotando) {
        let melhor = -1;
        for (const [uid, o] of outros.current) if (!o.fim && o.pts > melhor) (melhor = o.pts), (seguindo = uid);
        m.seguir(seguindo === null ? null : outros.current.get(seguindo)!.mortos);
      }

      // o lote: o lugar da nave e os eventos desde o último
      if (souJogador && m.passo >= 0 && agoraMs - ultimoLote >= LOTE_MS && (m.pilotando || m.eventos.length)) {
        ultimoLote = agoraMs;
        enviar({ p: m.passo, x: m.nave.x, y: m.nave.y, ev: m.eventos.splice(0) });
      }

      if (semFoco && !piloto()) return;
      const passoNaTela = m.passo < 0 ? 0 : m.passo;
      const naTela: Outro[] = [];
      for (const [uid, o] of outros.current) {
        const p = passoNaTela - ATRASO_DOS_OUTROS;
        const a = o.amostras;
        if (!a.length) continue;
        let pos = a[a.length - 1];
        for (let k = a.length - 1; k > 0; k--) {
          if (a[k - 1].p <= p && p <= a[k].p) {
            const u = (p - a[k - 1].p) / Math.max(1, a[k].p - a[k - 1].p);
            pos = { p, x: a[k - 1].x + (a[k].x - a[k - 1].x) * u, y: a[k - 1].y + (a[k].y - a[k - 1].y) * u };
            break;
          }
        }
        naTela.push({ x: pos.x, y: pos.y, cor: coresRef.current.get(uid) ?? '#ffffff', nome: nomes.current.get(uid) ?? '', vivo: !o.fim || o.vidas > 0 });
      }
      desenhar(ctx, { horta, passo: passoNaTela, mundo: m, outros: naTela, minhaCor: coresRef.current.get(eu) ?? CORES_DA_ESQUADRILHA[0], calmo });

      if (agoraMs - ultimoHud > 200) {
        ultimoHud = agoraMs;
        const f = m.ficha;
        let soma = f.total(m.passo);
        for (const o of outros.current.values()) soma += o.pts;
        setHud({
          pontos: f.total(m.passo),
          vidas: f.vidas,
          bombas: f.bombas,
          escudo: f.escudo,
          arma: f.armaEm(m.passo),
          esquadrilha: soma,
          passo: m.passo,
          acabou: f.acabou,
          seguindo: seguindo === null ? null : (nomes.current.get(seguindo) ?? null),
        });
      }
    };
    id = requestAnimationFrame(quadro);
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, channelId, souJogador, estado.solo, eu]);

  /** O dedo (ou o mouse arrastando) em unidades do céu: a nave acompanha o arraste, e atira sozinha enquanto há toque. */
  const noCeu = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * LARGURA) / r.width, y: ((e.clientY - r.top) * ALTURA) / r.height };
  };

  const ms = hud.passo < 0 ? 0 : (hud.passo * 1000) / PASSOS_POR_S;
  const restante = Math.max(0, estado.duracaoMs - ms);
  const contagem = estado.fase === 'preparando' && inicio.current !== null ? Math.max(1, Math.ceil((inicio.current - Date.now()) / 1000)) : null;
  const pilotando = souJogador && !hud.acabou;

  return (
    <div className="nave">
      <div className="nave-topo">
        {souJogador && (
          <>
            <span className="nave-vidas" aria-label={t('Vidas: {n}', { n: hud.vidas })}>
              {Array.from({ length: Math.max(0, hud.vidas) }, (_, k) => (
                <span key={k} className="nave-vida" aria-hidden="true" />
              ))}
            </span>
            <span className="nave-bombas" aria-label={t('Bombas: {n}', { n: hud.bombas })}>
              {Array.from({ length: hud.bombas }, (_, k) => (
                <span key={k} className="nave-bomba-icone" aria-hidden="true" />
              ))}
            </span>
            <span className="golfe-tacadas">{t('Pontos: {n}', { n: hud.pontos })}</span>
          </>
        )}
        {!estado.solo && <span className="nave-esquadrilha">{t('Esquadrilha: {n}', { n: hud.esquadrilha })}</span>}
        {estado.fase === 'jogando' && <Relogio restante={restante} total={estado.duracaoMs} />}
      </div>
      <div className="nave-moldura">
        <canvas
          ref={canvas}
          className="nave-tela"
          width={LARGURA}
          height={ALTURA}
          onPointerDown={(e) => {
            if (!pilotando || (e.pointerType === 'mouse' && e.button > 0)) return;
            if (e.pointerType !== 'mouse') setEToque(true);
            e.currentTarget.setPointerCapture(e.pointerId);
            const p = noCeu(e);
            const m = mundo.current!;
            toque.current = { id: e.pointerId, dedoX: p.x, dedoY: p.y, naveX: m.nave.x, naveY: m.nave.y, alvo: { x: m.nave.x, y: m.nave.y } };
          }}
          onPointerMove={(e) => {
            const d = toque.current;
            if (!d || d.id !== e.pointerId) return;
            const p = noCeu(e);
            d.alvo = { x: d.naveX + (p.x - d.dedoX) * 1.4, y: d.naveY + (p.y - d.dedoY) * 1.4 };
          }}
          onPointerUp={(e) => {
            if (toque.current?.id === e.pointerId) toque.current = null;
          }}
          onPointerCancel={() => {
            toque.current = null;
          }}
        />
        {contagem !== null && (
          <span className="golfe-contagem" aria-hidden="true">
            {contagem}
          </span>
        )}
        {pilotando && eToque && hud.bombas > 0 && (
          <button
            type="button"
            className="nave-botao-bomba"
            aria-label={t('Bomba')}
            onPointerDown={(e) => {
              e.stopPropagation();
              teclas.current.bomba = true;
            }}
          >
            <span className="nave-bomba-icone" aria-hidden="true" />
          </button>
        )}
      </div>
      {souJogador && estado.fase === 'preparando' && (
        <p className="minijogo-situacao">{t('Desvie das sementes e derrube a praga. O espantalho vem no fim.')}</p>
      )}
      {souJogador && hud.acabou && hud.vidas <= 0 && <p className="minijogo-situacao">{t('Sem vidas: agora é torcer pela esquadrilha.')}</p>}
      {!pilotando && hud.seguindo && <p className="minijogo-situacao">{t('Assistindo: {nome}', { nome: hud.seguindo })}</p>}
      {pilotando && (
        <ComandosDoJogo
          itens={[
            { teclas: ['setas'], toque: 'toque-arrastar', rotulo: t('Voar') },
            { teclas: ['espaco'], rotulo: t('Atirar') },
            { teclas: ['x'], rotulo: t('Bomba') },
          ]}
        />
      )}
    </div>
  );
}
