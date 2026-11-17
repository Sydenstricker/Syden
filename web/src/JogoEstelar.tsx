import { useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { ComandosDoJogo } from './ComandosDosJogos';
import { coresDoAvatar, minhasCoresDoCoelho, type CoresDoCoelho } from './coelho3d';
import { useT } from './i18n';
import { Placar, Relogio } from './Minijogo';
import type { Partida } from './minijogos';
import { tocar } from './somDosJogos';
import { temWebGL } from './temWebGL';
import { Mundo, type Comandos } from './estelar/mundo';
import { pilotar } from './estelar/piloto';
import { CARGA, ESCUDO_MAX, FIM, PASSOS_POR_S, PIRUETA_PASSOS, type Ramo } from './estelar/sim';
import type { CenaEstelar, QuadroDaNave } from './estelar/cena';
import './estelar/estelar.css';

/**
 * A ROTA ESTELAR (16/11/2026, server/src/minijogo-estelar.ts): o tiro em trilhos em 3D. A nave anda sozinha para a frente, pela
 * superfície do planeta e depois pelo espaço, e quem joga a guia dentro da tela, atira (tocar o tiro), segura o tiro para
 * travar a mira num inimigo, gira para desviar os tiros, solta as bombas e escolhe o lado na bifurcação. Os anéis devolvem o
 * escudo; o jipe gigante vem no meio e o polvo de lata no fim.
 *
 * A REDE É A DA ESQUADRILHA DA TOCA: o jogo roda aqui, passo a passo (estelar/mundo.ts), com a mesma regra do servidor
 * (estelar/sim.ts, igual byte a byte); o que conta vai em lotes pelo tempo real, junto com o lugar da nave, e o servidor
 * confere. A turma voa a mesma rota, cada um na própria tela, e os outros aparecem como alas meio transparentes; no Solo, duas
 * alas do computador voam junto (só desenho).
 *
 * A JANELA SEM FOCO: a partida é de todos e não para, então a nave fica parada, sem atirar e sem levar dano, e nada é desenhado.
 */

export interface EstadoEstelar {
  fase: 'preparando' | 'jogando' | 'fim';
  semente: number;
  duracaoMs: number;
  decorridoMs: number | null;
  jogadores: { userId: number; username: string; avatar: number | string | null; pontos: number; vidas: number; chefe: boolean; acabou: boolean; precisao: number; posicao: number | null }[];
  esquadrilha: number;
  meu: { vidas: number; escudo: number; bombas: number; ramo: Ramo; mortos: number[]; acabou: boolean } | null;
  recorde: { antes: number | null; novo: boolean } | null;
  solo: boolean;
  partidaId: string;
}

declare global {
  interface Window {
    /** Só no site de desenvolvimento: o e2e liga o piloto automático e lê o mundo. */
    estelarPilotoAutomatico?: boolean;
    estelarDoTeste?: Mundo;
  }
}

const LOTE_MS = 100;
const ATRASO_DOS_OUTROS = 8;
/** As alas do computador, no Solo: as cores de dois coelhos prontos. */
const ALAS = [4, 11];

export function JogoEstelar({ estado, eu, jogador, socket, channelId }: { estado: EstadoEstelar & Partida; eu: number; jogador: boolean; socket: Socket | null; channelId: number }) {
  const t = useT();
  if (estado.terminada || estado.fase === 'fim') {
    const ficaram = estado.jogadores.filter((l) => l.posicao !== null);
    const venceram = estado.jogadores.some((l) => l.chefe);
    const meu = estado.jogadores.find((l) => l.userId === eu);
    return (
      <div className="estelar-fim">
        <p className="estelar-desfecho">{venceram ? t('Vitória!') : t('Derrota')}</p>
        {meu && <p className="minijogo-situacao">{t('Acertos: {n}', { n: `${meu.precisao}%` })}</p>}
        {estado.recorde &&
          (estado.recorde.novo ? (
            <p className="minijogo-situacao estelar-recorde">{t('Novo recorde!')}</p>
          ) : (
            estado.recorde.antes !== null && <p className="minijogo-situacao">{t('Seu recorde: {tempo}', { tempo: String(estado.recorde.antes) })}</p>
          ))}
        {!estado.solo && <p className="estelar-total">{t('Placar da esquadrilha: {n}', { n: estado.esquadrilha })}</p>}
        <Placar eu={eu} linhas={(ficaram.length ? ficaram : estado.jogadores).map((l) => ({ ...l, valor: String(l.pontos), posicao: l.posicao ?? undefined }))} />
      </div>
    );
  }
  return <Rota key={estado.partidaId} estado={estado} eu={eu} jogador={jogador} socket={socket} channelId={channelId} />;
}

interface DoOutro {
  amostras: { p: number; x: number; y: number }[];
  vidas: number;
  pts: number;
  ramo: Ramo;
  fim: boolean;
  mortos: Map<number, number>;
}

interface Teclas {
  esquerda: boolean;
  direita: boolean;
  cima: boolean;
  baixo: boolean;
  fogo: boolean;
  bomba: boolean;
  pirueta: boolean;
  /** O tiro tocado e solto entre dois passos (o toque curto não se perde). */
  tocou: boolean;
}

interface Hud {
  pontos: number;
  vidas: number;
  escudo: number;
  bombas: number;
  carga: number;
  esquadrilha: number;
  passo: number;
  acabou: boolean;
  seguindo: string | null;
  golpe: number;
}

function Rota({ estado, eu, jogador, socket, channelId }: { estado: EstadoEstelar & Partida; eu: number; jogador: boolean; socket: Socket | null; channelId: number }) {
  const t = useT();
  const caixa = useRef<HTMLDivElement>(null);
  const souJogador = jogador && estado.meu !== null && estado.jogadores.some((l) => l.userId === eu);
  const [cenaEstado, setCenaEstado] = useState<'carregando' | 'pronta' | 'falhou'>(() => (temWebGL() ? 'carregando' : 'falhou'));

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
      m.ficha.escudo = estado.meu.escudo;
      m.ficha.bombas = estado.meu.bombas;
      m.ficha.ramo = estado.meu.ramo;
      if (estado.meu.acabou && estado.meu.vidas <= 0) m.ficha.morteFinal = 0;
    }
    mundo.current = m;
    if (import.meta.env.DEV) window.estelarDoTeste = m;
  }
  const outros = useRef(new Map<number, DoOutro>());
  const nomes = useRef(new Map<number, string>());
  for (const l of estado.jogadores) nomes.current.set(l.userId, l.username);
  /** As naves da turma na cena, na ordem dos jogadores (sem mim). */
  const daTurma = useRef(estado.jogadores.filter((l) => l.userId !== eu || !souJogador));

  const [hud, setHud] = useState<Hud>({ pontos: 0, vidas: 2, escudo: ESCUDO_MAX, bombas: 3, carga: 0, esquadrilha: 0, passo: -1, acabou: false, seguindo: null, golpe: -1000 });
  const teclas = useRef<Teclas>({ esquerda: false, direita: false, cima: false, baixo: false, fogo: false, bomba: false, pirueta: false, tocou: false });
  const toque = useRef<{ id: number; x: number; y: number; dx: number; dy: number } | null>(null);
  const [eToque] = useState(() => !!window.matchMedia?.('(pointer: coarse)').matches);

  // OS OUTROS chegam pelo socket, já com quem mandou (o servidor carimba)
  useEffect(() => {
    if (!socket || estado.solo) return;
    const chegou = (msg: { channelId?: number; dados?: Record<string, unknown> }) => {
      if (msg.channelId !== channelId || !msg.dados) return;
      const { userId, p, x, y, vidas, pts, ramo, m, fim } = msg.dados;
      if (typeof userId !== 'number' || userId === eu || typeof p !== 'number' || typeof x !== 'number' || typeof y !== 'number') return;
      let o = outros.current.get(userId);
      if (!o) outros.current.set(userId, (o = { amostras: [], vidas: 2, pts: 0, ramo: 0, fim: false, mortos: new Map() }));
      const ultima = o.amostras[o.amostras.length - 1];
      if (!ultima || p > ultima.p) o.amostras.push({ p, x, y });
      if (o.amostras.length > 30) o.amostras.splice(0, o.amostras.length - 30);
      if (typeof vidas === 'number') o.vidas = vidas;
      if (typeof pts === 'number') o.pts = pts;
      if (ramo === 1 || ramo === 2) o.ramo = ramo;
      o.fim = fim === 1;
      if (Array.isArray(m)) for (const i of m) if (typeof i === 'number') o.mortos.set(i, p);
    };
    socket.on('minijogo:tempo-real', chegou);
    return () => {
      socket.off('minijogo:tempo-real', chegou);
    };
  }, [socket, channelId, eu, estado.solo]);

  // O TECLADO: setas ou WASD voam, Z, Espaço ou J atiram (segurar carrega), X solta a bomba, C (ou Q/E) gira.
  useEffect(() => {
    const mapa: Record<string, keyof Teclas> = {
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
      KeyJ: 'fogo',
      KeyX: 'bomba',
      KeyC: 'pirueta',
      KeyQ: 'pirueta',
      KeyE: 'pirueta',
    };
    const mudar = (valor: boolean) => (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement | null;
      if (alvo && (alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA' || alvo.isContentEditable)) return;
      const k = mapa[e.code];
      if (!k) return;
      e.preventDefault();
      // a bomba e a pirueta são gastas pelo passo que as usa: soltar a tecla antes dele não as perde
      if (!valor && (k === 'bomba' || k === 'pirueta')) return;
      teclas.current[k] = valor;
      if (valor && k === 'fogo') teclas.current.tocou = true;
    };
    const desce = mudar(true);
    const sobe = mudar(false);
    const solta = () => Object.keys(teclas.current).forEach((k) => (teclas.current[k as keyof Teclas] = false));
    window.addEventListener('keydown', desce);
    window.addEventListener('keyup', sobe);
    window.addEventListener('blur', solta);
    return () => {
      window.removeEventListener('keydown', desce);
      window.removeEventListener('keyup', sobe);
      window.removeEventListener('blur', solta);
    };
  }, []);

  // O LAÇO: o mundo anda no relógio da partida, e a cena é desenhada a cada quadro (quando carregou)
  useEffect(() => {
    const m = mundo.current!;
    let viva = true;
    let cena: CenaEstelar | null = null;
    let pronta = false;
    let id = 0;
    let ultimoLote = 0;
    let ultimoHud = 0;
    let ultimoSomDeTiro = 0;
    let ultimoQuadro = performance.now();
    let golpe = -1000;
    let antes = { ...m.nave };
    const piloto = () => import.meta.env.DEV && !!window.estelarPilotoAutomatico;
    const enviar = (dados: unknown) => {
      if (!socket) return;
      if (estado.solo) socket.emit('minijogo-solo:tempo-real', { dados });
      else socket.emit('minijogo:tempo-real', { channelId, dados });
    };
    const ler = (): Comandos => {
      const k = teclas.current;
      let dx = (k.direita ? 1 : 0) - (k.esquerda ? 1 : 0);
      let dy = (k.cima ? 1 : 0) - (k.baixo ? 1 : 0);
      let fogo = k.fogo || k.tocou;
      let bomba = k.bomba;
      let pirueta = k.pirueta;
      const d = toque.current;
      if (d) {
        dx ||= d.dx;
        dy ||= d.dy;
      }
      // o controle: a alavanca ou o direcional, A atira, B é a bomba, X gira
      for (const p of navigator.getGamepads?.() ?? []) {
        if (!p) continue;
        const [ax = 0, ay = 0] = p.axes;
        if (p.buttons[14]?.pressed || ax < -0.4) dx = -1;
        if (p.buttons[15]?.pressed || ax > 0.4) dx = 1;
        if (p.buttons[12]?.pressed || ay < -0.4) dy = 1;
        if (p.buttons[13]?.pressed || ay > 0.4) dy = -1;
        fogo ||= !!p.buttons[0]?.pressed;
        bomba ||= !!p.buttons[1]?.pressed;
        pirueta ||= !!p.buttons[2]?.pressed || !!p.buttons[4]?.pressed || !!p.buttons[5]?.pressed;
      }
      return { dx, dy, fogo, bomba, pirueta };
    };

    void import('./estelar/cena')
      .then(async ({ CenaEstelar }) => {
        if (!viva || !caixa.current) return;
        cena = new CenaEstelar(caixa.current, m, () => viva && setCenaEstado('falhou'));
        const minhas: CoresDoCoelho | null = souJogador ? await minhasCoresDoCoelho() : null;
        if (!viva) return;
        await cena.montar(
          [...(minhas ? [{ cores: minhas }] : []), ...daTurma.current.map((l) => ({ cores: coresDoAvatar(l.avatar), fantasma: true, nome: l.username }))],
          estado.solo ? ALAS.map((a) => coresDoAvatar(a)) : [],
        );
        pronta = true;
        if (viva) setCenaEstado('pronta');
      })
      .catch(() => {
        cena?.destruir();
        cena = null;
        if (viva) setCenaEstado('falhou');
      });

    const quadro = () => {
      if (!viva) return;
      id = requestAnimationFrame(quadro);
      const agoraMs = Date.now();
      const agora = performance.now();
      const dt = Math.min(0.1, (agora - ultimoQuadro) / 1000);
      ultimoQuadro = agora;
      if (inicio.current === null) return;
      const decorrido = ((agoraMs - inicio.current) * PASSOS_POR_S) / 1000;
      const alvo = Math.min(FIM, Math.floor(decorrido));
      const semFoco = !piloto() && (document.hidden || !document.hasFocus());
      const atrasado = alvo - m.passo > 12;
      let rodou = 0;
      while (m.passo < alvo && rodou < 12000) {
        rodou++;
        antes = { ...m.nave };
        const cmd = piloto() && m.pilotando ? pilotar(m) : ler();
        const o = m.avancar(cmd, semFoco || atrasado);
        // a bomba e a pirueta valem uma vez por toque, e o toque curto do tiro também
        if (cmd.bomba) teclas.current.bomba = false;
        if (cmd.pirueta) teclas.current.pirueta = false;
        teclas.current.tocou = false;
        if (!atrasado) {
          if (o.disparou && agoraMs - ultimoSomDeTiro > 120) {
            ultimoSomDeTiro = agoraMs;
            tocar('tiro');
          }
          if (o.chefe) tocar('fim');
          else if (o.derrubou) tocar('acerto');
          if (o.travou) tocar('clique');
          if (o.soltouTrava) tocar('mola');
          if (o.pegou || o.anel) tocar('moeda');
          if (o.perdeuVida) tocar('queda');
          if (o.golpe) tocar('soco');
          if (o.desviou) tocar('pulo');
          if (o.bomba) tocar('combo');
          if (o.golpe || o.perdeuVida) golpe = m.passo;
        }
      }
      // quem não pilota segue alguém: o que tem mais pontos e ainda está no ar
      let seguindo: number | null = null;
      if (!m.pilotando) {
        let melhor = -1;
        for (const [uid, o] of outros.current) if (!o.fim && o.pts > melhor) (melhor = o.pts), (seguindo = uid);
        const s = seguindo === null ? null : outros.current.get(seguindo)!;
        m.seguir(s ? s.mortos : null, s ? s.ramo : 0);
      }
      if (souJogador && m.passo >= 0 && agoraMs - ultimoLote >= LOTE_MS && (m.pilotando || m.eventos.length)) {
        ultimoLote = agoraMs;
        enviar({ p: m.passo, x: m.nave.x, y: m.nave.y, ds: m.disparos, ev: m.eventos.splice(0) });
      }

      if (agora - ultimoHud > 150) {
        ultimoHud = agora;
        const f = m.ficha;
        let soma = f.total(m.passo);
        for (const o of outros.current.values()) soma += o.pts;
        setHud({
          pontos: f.total(m.passo),
          vidas: f.vidas,
          escudo: f.escudo,
          bombas: f.bombas,
          carga: Math.min(1, m.carga / CARGA),
          esquadrilha: soma,
          passo: m.passo,
          acabou: f.acabou,
          seguindo: seguindo === null ? null : (nomes.current.get(seguindo) ?? null),
          golpe,
        });
      }
      if (semFoco || !cena || !pronta) return;
      // o desenho anda liso entre os passos: a fração do passo de agora
      const frac = m.passo < alvo || m.passo >= FIM ? 0 : Math.max(0, Math.min(1, decorrido - m.passo));
      const passoNaTela = Math.max(0, m.passo + frac - 1);
      const k = frac;
      const meu: QuadroDaNave | null = souJogador
        ? {
            x: antes.x + (m.nave.x - antes.x) * k,
            y: antes.y + (m.nave.y - antes.y) * k,
            vx: m.vel.x,
            vy: m.vel.y,
            giro: m.passo < m.piruetaAte ? 1 - (m.piruetaAte - m.passo - k) / PIRUETA_PASSOS : null,
            pisca: m.piscando(),
            escondida: !m.pilotando,
          }
        : null;
      const naTela: QuadroDaNave[] = daTurma.current.map((l) => {
        const o = outros.current.get(l.userId);
        const a = o?.amostras ?? [];
        if (!o || !a.length || (o.fim && o.vidas <= 0)) return { x: 0, y: 0, vx: 0, vy: 0, giro: null, pisca: false, escondida: true };
        const p = passoNaTela - ATRASO_DOS_OUTROS;
        let pos = a[a.length - 1];
        let vx = 0;
        let vy = 0;
        for (let j = a.length - 1; j > 0; j--) {
          if (a[j - 1].p <= p && p <= a[j].p) {
            const u = (p - a[j - 1].p) / Math.max(1, a[j].p - a[j - 1].p);
            const passos = Math.max(1, a[j].p - a[j - 1].p);
            vx = (a[j].x - a[j - 1].x) / passos;
            vy = (a[j].y - a[j - 1].y) / passos;
            pos = { p, x: a[j - 1].x + (a[j].x - a[j - 1].x) * u, y: a[j - 1].y + (a[j].y - a[j - 1].y) * u };
            break;
          }
        }
        return { x: pos.x, y: pos.y, vx, vy, giro: null, pisca: false, escondida: o.ramo !== m.ramo && m.passo > 3700 };
      });
      cena.desenhar({ passo: passoNaTela, mundo: m, eu: meu, outros: naTela, carga: Math.min(1, m.carga / CARGA), alvo: m.alvo, ramo: m.ramo, dt });
    };
    id = requestAnimationFrame(quadro);
    return () => {
      viva = false;
      cancelAnimationFrame(id);
      cena?.destruir();
    };
    // a partida é uma por montagem (a `key` de quem chama)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ms = hud.passo < 0 ? 0 : (hud.passo * 1000) / PASSOS_POR_S;
  const restante = Math.max(0, estado.duracaoMs - ms);
  const contagem = estado.fase === 'preparando' && inicio.current !== null ? Math.max(1, Math.ceil((inicio.current - Date.now()) / 1000)) : null;
  const pilotando = souJogador && !hud.acabou;
  const recemAtingido = hud.passo - hud.golpe < 12;

  /** O dedo arrastando na tela: a nave vai para o lado do arraste (como uma alavanca), a partir de onde o dedo pousou. */
  const botao = (k: keyof Teclas) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      teclas.current[k] = true;
    },
    onPointerUp: () => (teclas.current[k] = false),
    onPointerCancel: () => (teclas.current[k] = false),
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });

  if (cenaEstado === 'falhou') return <p className="minijogo-situacao">{t('Este jogo precisa de gráficos 3D, que não abriram neste aparelho.')}</p>;
  return (
    <div className="estelar">
      <div
        className={`estelar-moldura${recemAtingido ? ' atingida' : ''}`}
        onPointerDown={(e) => {
          if (!pilotando || e.pointerType === 'mouse') return;
          e.currentTarget.setPointerCapture(e.pointerId);
          toque.current = { id: e.pointerId, x: e.clientX, y: e.clientY, dx: 0, dy: 0 };
        }}
        onPointerMove={(e) => {
          const d = toque.current;
          if (!d || d.id !== e.pointerId) return;
          const ox = e.clientX - d.x;
          const oy = e.clientY - d.y;
          d.dx = Math.abs(ox) > 14 ? Math.sign(ox) : 0;
          d.dy = Math.abs(oy) > 14 ? -Math.sign(oy) : 0;
        }}
        onPointerUp={(e) => {
          if (toque.current?.id === e.pointerId) toque.current = null;
        }}
        onPointerCancel={() => (toque.current = null)}
      >
        <div ref={caixa} className={`estelar-caixa${cenaEstado === 'pronta' ? '' : ' escondida'}`} />
        {cenaEstado === 'pronta' && (
          <div className="estelar-painel">
            {souJogador && (
              <>
                <div className="estelar-escudo" role="meter" aria-label={t('Escudo')} aria-valuemin={0} aria-valuemax={ESCUDO_MAX} aria-valuenow={hud.escudo}>
                  <span style={{ width: `${(100 * hud.escudo) / ESCUDO_MAX}%` }} className={hud.escudo <= 30 ? 'baixo' : undefined} />
                </div>
                <span className="estelar-vidas" aria-hidden="true">
                  {Array.from({ length: Math.max(0, hud.vidas) }, (_, k) => (
                    <span key={k} className="estelar-vida" />
                  ))}
                </span>
                <span className="estelar-bombas" aria-label={t('Bomba') + `: ${hud.bombas}`}>
                  {Array.from({ length: hud.bombas }, (_, k) => (
                    <span key={k} className="estelar-bomba" aria-hidden="true" />
                  ))}
                </span>
                <span className="estelar-pontos">{t('Pontos: {n}', { n: hud.pontos })}</span>
                {hud.carga > 0.15 && (
                  <span className="estelar-carga" aria-hidden="true">
                    <span style={{ width: `${hud.carga * 100}%` }} className={hud.carga >= 1 ? 'cheia' : undefined} />
                  </span>
                )}
              </>
            )}
            {!estado.solo && <span className="estelar-esquadrilha">{t('Esquadrilha: {n}', { n: hud.esquadrilha })}</span>}
            {contagem !== null && <span className="estelar-contagem">{contagem}</span>}
          </div>
        )}
        {cenaEstado === 'pronta' && pilotando && eToque && (
          <div className="estelar-toque">
            <button type="button" className="estelar-botao fogo" aria-label={t('Atirar')} {...botao('fogo')}>
              ●
            </button>
            <button type="button" className="estelar-botao" aria-label={t('Pirueta')} {...botao('pirueta')}>
              ↻
            </button>
            <button type="button" className="estelar-botao" aria-label={t('Bomba')} {...botao('bomba')}>
              ✹
            </button>
          </div>
        )}
      </div>
      {estado.fase === 'jogando' && <Relogio restante={restante} total={estado.duracaoMs} />}
      {souJogador && hud.acabou && hud.vidas <= 0 && <p className="minijogo-situacao">{t('Sem vidas: agora é torcer pela esquadrilha.')}</p>}
      {!pilotando && hud.seguindo && <p className="minijogo-situacao">{t('Assistindo: {nome}', { nome: hud.seguindo })}</p>}
      {pilotando && (
        <ComandosDoJogo
          itens={[
            { teclas: ['setas'], toque: 'toque-arrastar', rotulo: t('Voar') },
            { teclas: ['z', 'espaco'], rotulo: t('Atirar') },
            { teclas: ['z'], toque: 'toque-segurar', rotulo: t('Segure para travar a mira') },
            { teclas: ['c'], rotulo: t('Pirueta') },
            { teclas: ['x'], rotulo: t('Bomba') },
          ]}
        />
      )}
    </div>
  );
}
