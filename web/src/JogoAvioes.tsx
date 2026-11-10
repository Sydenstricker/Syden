import { useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { ComandosDoJogo } from './ComandosDosJogos';
import { BotoesDosRobos, cadaUmPorSi } from './EscolhaDosRobos';
import { useT } from './i18n';
import { Placar, Relogio } from './Minijogo';
import { tocar } from './somDosJogos';
import {
  alvoDaCamera,
  corDaAsa,
  desenharCena,
  desenharVista,
  paletaDe,
  pintarHorta,
  VISTA_A,
  VISTA_L,
  type AviaoNaTela,
  type Camera,
  type Efeito,
  type MarcaNaBorda,
  type PaletaDoAviao,
} from './duelo/desenho';
import { criarPartida, TIPOS_DO_DUELO, type EventoDoDuelo, type Participante, type ResultadoDoSolo } from './duelo/partida';
import type { ComandosDoDuelo } from './duelo/robo';
import { ALTURA, CARGA, DURACAO_PASSOS, LARGURA, PASSOS_POR_SEGUNDO, VIDAS } from './duelo/sim';
import './duelo/duelo.css';

/**
 * O DUELO DE AVIÕEZINHOS (05/11/2026): coelhos em teco-tecos sobre a horta, numa arena fechada vista de cima. Acelera, freia
 * e vira; Espaço dá a ervilha, e segurar meio segundo e soltar lança a cenoura teleguiada (uma por vez). A curva fechada na
 * cerca protege por um instante. Cada um aguenta dois acertos e cai no terceiro; o último no ar ganha, e, acabando o tempo,
 * quem tem mais vida.
 *
 * NA SALA (server/src/minijogo-duelo.ts): cada um voa aqui e manda a posição; o servidor dá a largada, carimba os tiros,
 * confere os acertos e fecha a partida. NO SOLO, contra 1 a 3 aviões do computador, a partida inteira roda aqui (duelo/partida.ts
 * com duelo/robo.ts), e só o fim vai ao servidor.
 *
 * A CÂMERA É DE CADA UM (06/11/2026, pedido dele, como na corrida): a tela mostra um pedaço da horta em volta do próprio avião,
 * e quem está fora da vista vira uma seta na borda. Quem caiu ou assiste segue um avião que ainda voa. O placar, a cenoura e o
 * tempo ficam POR CIMA da tela, dentro dela ("nada fora").
 *
 * A JANELA SEM FOCO: no Solo, pausa; na sala, que é de todos, o avião segue reto (as teclas se soltam) e a tela não é
 * desenhada.
 */

export interface JogadorDoDuelo {
  userId: number;
  username: string;
  avatar: number | string | null;
  largada: number;
  vidas: number;
  acertos: number;
  vivo: boolean;
  posicao: number | null;
}

export interface EstadoDosAvioes {
  fase: 'largada' | 'jogando' | 'fim';
  solo?: boolean;
  partidaId: string;
  // na sala
  decorridoMs?: number | null;
  duracaoMs?: number;
  jogadores?: JogadorDoDuelo[];
  // no Solo
  username?: string;
  avatar?: number | string | null;
  robos?: { userId: number; username: string }[];
  resultadoDoSolo?: { posicao: number; total: number; vidas: number; acertos: number } | null;
}

type Props = {
  estado: EstadoDosAvioes & { terminada?: boolean; restanteMs?: number };
  eu: number;
  jogador: boolean;
  agir: (corpo: Record<string, unknown>) => unknown;
  socket?: Socket | null;
  channelId?: number;
};

const ROBOS_GUARDADOS = 'syden:dueloRobos';

export function JogoAvioes({ estado, eu, jogador, agir, socket = null, channelId = 0 }: Props) {
  const fim = estado.terminada || estado.fase === 'fim';
  const [robos, setRobos] = useState<number | null>(null);
  if (fim) return <TelaDoFim estado={estado} eu={eu} />;
  if (estado.solo) {
    if (robos === null) return <EscolhaDoSolo aoEscolher={setRobos} />;
    const lista = (estado.robos ?? []).slice(0, robos);
    const participantes: Participante[] = [
      { id: eu, nome: estado.username ?? '', avatar: estado.avatar ?? null, largada: 0 },
      ...lista.map((r, i) => ({ id: r.userId, nome: r.username, avatar: ((i * 5 + 3) % 16) + 1, largada: i + 1 })),
    ];
    return (
      <Ceu
        key={estado.partidaId}
        eu={eu}
        piloto
        participantes={participantes}
        robos={lista.map((r) => r.userId)}
        atrasoDaLargadaMs={3000}
        aoFim={(r) => void agir({ tipo: 'fim', ...r })}
      />
    );
  }
  const jogadores = estado.jogadores ?? [];
  const souDoJogo = jogador && jogadores.some((j) => j.userId === eu);
  return (
    <Ceu
      key={estado.partidaId}
      eu={eu}
      piloto={souDoJogo}
      participantes={jogadores.map((j) => ({ id: j.userId, nome: j.username, avatar: j.avatar, largada: j.largada }))}
      jogadores={jogadores}
      atrasoDaLargadaMs={estado.fase === 'largada' ? Math.max(0, estado.restanteMs ?? 0) : -Math.max(0, estado.decorridoMs ?? 0)}
      socket={socket}
      channelId={channelId}
    />
  );
}

function EscolhaDoSolo({ aoEscolher }: { aoEscolher: (n: number) => void }) {
  const t = useT();
  const [n, setN] = useState(() => {
    try {
      return Math.min(3, Math.max(1, Number(localStorage.getItem(ROBOS_GUARDADOS)) || 2));
    } catch {
      return 2;
    }
  });
  const comecar = () => {
    try {
      localStorage.setItem(ROBOS_GUARDADOS, String(n));
    } catch {
      // sem o armazenamento, só não se lembra da escolha
    }
    tocar('clique');
    aoEscolher(n);
  };
  return (
    <div className="aviao-fim-solo">
      <BotoesDosRobos opcoes={[1, 2, 3].map(cadaUmPorSi)} escolhida={n} aoEscolher={setN} pergunta={t('Quantos adversários do computador?')} />
      <div className="minijogo-acoes">
        <button type="button" className="btn-primary" onClick={comecar}>
          {t('Começar')}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// O CÉU: a partida na tela, a mesma para o Solo e para a sala
// ---------------------------------------------------------------------------------------------------------------------

const relogio = (ms: number) => Math.max(0, ms);

function Ceu({
  eu,
  piloto,
  participantes,
  robos,
  jogadores,
  atrasoDaLargadaMs,
  socket = null,
  channelId = 0,
  aoFim,
}: {
  eu: number;
  piloto: boolean;
  participantes: Participante[];
  robos?: number[];
  jogadores?: JogadorDoDuelo[];
  /** Quanto falta para o sinal verde (negativo: quanto já passou). */
  atrasoDaLargadaMs: number;
  socket?: Socket | null;
  channelId?: number;
  aoFim?: (r: ResultadoDoSolo) => void;
}) {
  const t = useT();
  const solo = !!aoFim;
  const canvas = useRef<HTMLCanvasElement>(null);
  const painel = useRef<HTMLDivElement>(null);
  const comandos = useRef<ComandosDoDuelo>({ acelera: false, freia: false, vira: 0, fogo: false });
  const lados = useRef({ esquerda: false, direita: false, toqueEsquerda: false, toqueDireita: false });
  const lista = useRef(participantes);
  const vidasVerdade = useRef(new Map(participantes.map((q) => [q.id, jogadores?.find((j) => j.userId === q.id)?.vidas ?? VIDAS])));
  const amostras = useRef(new Map<number, number[]>());
  const eventos = useRef<EventoDoDuelo[]>([]);
  const [vidas, setVidas] = useState(new Map(vidasVerdade.current));
  const [hud, setHud] = useState({ restanteMs: DURACAO_PASSOS * (1000 / PASSOS_POR_SEGUNDO), contagem: 0 as number, livre: true, acabou: false, comeco: true });
  const euNoAr = piloto && (vidas.get(eu) ?? 0) > 0 && !hud.acabou;

  // as vidas pela verdade do servidor (a cada "mudou"): uma vida nunca volta
  useEffect(() => {
    if (!jogadores) return;
    let mudou = false;
    for (const j of jogadores) {
      const antes = vidasVerdade.current.get(j.userId) ?? j.vidas;
      if (j.vidas < antes) mudou = true;
      vidasVerdade.current.set(j.userId, Math.min(j.vidas, antes));
    }
    if (mudou) setVidas(new Map(vidasVerdade.current));
  }, [jogadores]);

  // AS POSIÇÕES E OS TIROS DOS OUTROS chegam pelo socket, carimbados pelo servidor; os acertos também (pelo difundir)
  useEffect(() => {
    if (!socket || solo) return;
    const chegada = (m: { channelId?: number; dados?: Record<string, unknown> }) => {
      if (m.channelId !== channelId || !m.dados) return;
      const d = m.dados;
      if ((TIPOS_DO_DUELO as readonly unknown[]).includes(d.tipo)) {
        if (typeof d.id !== 'string') return;
        if (!eventos.current.some((e) => e.id === d.id && e.tipo === d.tipo)) eventos.current.push(d as unknown as EventoDoDuelo);
        return;
      }
      const { userId, n, x, y, hx, hy } = d;
      if (typeof userId !== 'number' || userId === eu || ![n, x, y, hx, hy].every((v) => typeof v === 'number')) return;
      let a = amostras.current.get(userId);
      if (!a) amostras.current.set(userId, (a = []));
      if (a.length && a[a.length - 5] >= (n as number)) return;
      a.push(n as number, x as number, y as number, hx as number, hy as number);
    };
    socket.on('minijogo:tempo-real', chegada);
    return () => {
      socket.off('minijogo:tempo-real', chegada);
    };
  }, [socket, channelId, eu, solo]);

  // O TECLADO: setas (ou WASD) aceleram, freiam e viram; Espaço (ou Z) atira, e segurado carrega a cenoura
  useEffect(() => {
    if (!piloto) return;
    const c = comandos.current;
    const virar = () => {
      const l = lados.current;
      c.vira = (l.direita || l.toqueDireita ? 1 : 0) - (l.esquerda || l.toqueEsquerda ? 1 : 0);
    };
    const tecla = (e: KeyboardEvent, apertada: boolean) => {
      const alvo = e.target as HTMLElement | null;
      if (alvo && (alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA' || alvo.isContentEditable)) return;
      let usou = true;
      switch (e.code) {
        case 'ArrowUp':
        case 'KeyW':
          c.acelera = apertada;
          break;
        case 'ArrowDown':
        case 'KeyS':
          c.freia = apertada;
          break;
        case 'ArrowLeft':
        case 'KeyA':
          lados.current.esquerda = apertada;
          break;
        case 'ArrowRight':
        case 'KeyD':
          lados.current.direita = apertada;
          break;
        case 'Space':
        case 'KeyZ':
          c.fogo = apertada;
          break;
        default:
          usou = false;
      }
      virar();
      if (usou) e.preventDefault();
    };
    const desce = (e: KeyboardEvent) => tecla(e, true);
    const sobe = (e: KeyboardEvent) => tecla(e, false);
    // trocou de janela com a tecla apertada: o "soltar" vai para a outra janela, e o avião seguiria virando sozinho
    const soltarTudo = () => {
      Object.assign(c, { acelera: false, freia: false, vira: 0, fogo: false });
      Object.assign(lados.current, { esquerda: false, direita: false, toqueEsquerda: false, toqueDireita: false });
    };
    const escondeu = () => document.hidden && soltarTudo();
    window.addEventListener('keydown', desce);
    window.addEventListener('keyup', sobe);
    window.addEventListener('blur', soltarTudo);
    document.addEventListener('visibilitychange', escondeu);
    return () => {
      window.removeEventListener('keydown', desce);
      window.removeEventListener('keyup', sobe);
      window.removeEventListener('blur', soltarTudo);
      document.removeEventListener('visibilitychange', escondeu);
      soltarTudo();
    };
  }, [piloto]);

  // O LAÇO: a partida anda no relógio (60 passos por segundo desde o verde), e a tela é desenhada a cada quadro
  useEffect(() => {
    const tela = canvas.current;
    const ctx = tela?.getContext('2d');
    if (!tela || !ctx) return;
    tela.focus();
    const horta = pintarHorta();
    // a cena inteira é desenhada no mundo, e a tela mostra o pedaço que a câmera vê
    const mundo = document.createElement('canvas');
    mundo.width = LARGURA;
    mundo.height = ALTURA;
    const ctxDoMundo = mundo.getContext('2d');
    if (!ctxDoMundo) return;
    const calmo = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const autopiloto = () => import.meta.env.DEV && (window as { dueloPilotoAutomatico?: boolean }).dueloPilotoAutomatico === true;
    const paletas = new Map<number, PaletaDoAviao>(lista.current.map((q) => [q.id, paletaDe(q.largada, q.avatar)]));
    const nomes = new Map(lista.current.map((q) => [q.id, q.nome]));
    const efeitos: Efeito[] = [];
    const enviar = solo ? undefined : (dados: Record<string, unknown>) => socket?.emit('minijogo:tempo-real', { channelId, dados });
    const partida = criarPartida({
      comandos: comandos.current,
      eu,
      piloto,
      autopiloto,
      participantes: lista.current,
      robos,
      vidas: vidasVerdade.current,
      amostras: amostras.current,
      eventos: eventos.current,
      enviar,
      aoVidas: (v) =>
        setVidas((antes) => {
          let igual = antes.size === v.size;
          for (const [k, n] of v) if (antes.get(k) !== n) igual = false;
          return igual ? antes : v;
        }),
      aoAcerto: (alvo, x, y, caiu) => {
        efeitos.push({ tipo: 'acerto', x, y, idade: 0 });
        if (caiu) {
          const p = partida.posicaoDe(alvo, partida.n);
          efeitos.push({ tipo: 'queda', x, y, idade: 0, paleta: paletas.get(alvo), hx: p?.hx, hy: p?.hy });
        }
        tocar(alvo === eu ? (caiu ? 'queda' : 'soco') : caiu ? 'combo' : 'acerto');
      },
      aoTiro: (tipo) => tocar(tipo === 'ervilha' ? 'tiro' : 'mola'),
      aoFim: aoFim
        ? (r) => {
            tocar('fim');
            setHud((h) => ({ ...h, acabou: true }));
            aoFim(r);
          }
        : undefined,
    });
    let verdeEm = performance.now() + atrasoDaLargadaMs;
    let id = 0;
    let antes = performance.now();
    let ultimoHud = 0;
    let quadro = 0;
    let ultimaContagem = -1;
    let estavaPronta = false;
    // A CÂMERA: segue o meu avião; quem caiu (depois de ver a própria queda) ou só assiste segue um avião que ainda voa
    let camera: Camera | null = null;
    let seguido: number | null = piloto ? eu : null;
    let semSeguido = 0;
    // quanto do alto da vista o painel cobre (medido de vez em quando: muda com os nomes e a largura)
    let emCima = 0;
    const voa = (id: number | null) => id !== null && partida.voando(id) && !!partida.posicaoDe(id, partida.n);
    const moverCamera = () => {
      if (!voa(seguido)) {
        // o meu avião caiu: a câmera fica na queda um instante antes de ir para outro
        if (++semSeguido > 90 || seguido === null) {
          const outro = lista.current.find((q) => voa(q.id));
          if (outro) (seguido = outro.id), (semSeguido = 0);
        }
      } else semSeguido = 0;
      const p = voa(seguido) ? partida.posicaoDe(seguido!, partida.n) : null;
      if (!p) return;
      const alvo = alvoDaCamera(p.x, p.y, p.hx, p.hy);
      if (!camera || calmo) camera = alvo;
      else {
        camera.x += (alvo.x - camera.x) * 0.12;
        camera.y += (alvo.y - camera.y) * 0.12;
      }
    };
    const desenhar = () => {
      const avioes: AviaoNaTela[] = [];
      const tiros = partida.tirosNaTela();
      const cacados = new Set(tiros.filter((x) => x.tipo === 'missil').map((x) => (partida.tiros.get(x.id)?.tiro as { alvo?: number })?.alvo));
      const carga = partida.meu ? Math.min(1, partida.meu.segurando / CARGA) : 0;
      for (const q of lista.current) {
        if (!partida.voando(q.id)) continue;
        const p = partida.posicaoDe(q.id, partida.n);
        if (!p) continue;
        avioes.push({
          id: q.id,
          x: p.x,
          y: p.y,
          hx: p.hx,
          hy: p.hy,
          paleta: paletas.get(q.id)!,
          nome: q.id === eu ? null : (nomes.get(q.id) ?? '').replace(/^🤖\s*/u, ''),
          robo: q.id < 0,
          vidas: partida.vidasDe(q.id),
          piscando: partida.piscando(q.id),
          protegido: partida.protegidoAgora(q.id),
          cacado: cacados.has(q.id),
          carga: q.id === eu && partida.meu && partida.meu.segurando > 4 ? carga : 0,
        });
      }
      desenharCena(ctxDoMundo, { horta, avioes, tiros, efeitos, quadro, calmo });
      // as setas na borda: os outros aviões fora da vista, e a cenoura que persegue quem a câmera segue
      const marcas: MarcaNaBorda[] = [];
      for (const a of avioes) if (a.id !== seguido) marcas.push({ x: a.x, y: a.y, cor: corDaAsa(lista.current.find((q) => q.id === a.id)?.largada ?? 0), cenoura: false });
      for (const x of tiros) {
        if (x.tipo !== 'missil' || (partida.tiros.get(x.id)?.tiro as { alvo?: number })?.alvo !== seguido) continue;
        marcas.push({ x: x.x, y: x.y, cor: '#f08a24', cenoura: true });
      }
      if (quadro % 30 === 1 && painel.current && tela.clientHeight > 0) emCima = (painel.current.offsetHeight * VISTA_A) / tela.clientHeight;
      desenharVista(ctx, mundo, camera ?? alvoDaCamera(LARGURA / 2, ALTURA / 2, 0, 0), marcas, quadro, calmo, emCima);
    };
    const passo = () => {
      id = requestAnimationFrame(passo);
      const agora = performance.now();
      const dt = agora - antes;
      antes = agora;
      quadro++;
      const semFoco = !autopiloto() && (document.hidden || !document.hasFocus());
      // no Solo, a janela sem foco pausa: o sinal verde vai para a frente junto
      const pausado = solo && semFoco && partida.n > 0 && !partida.acabou;
      if (pausado) verdeEm += dt;
      const alvo = Math.min(DURACAO_PASSOS + 60, Math.floor(((agora - verdeEm) * PASSOS_POR_SEGUNDO) / 1000));
      for (let k = 0; partida.n < alvo && k < 600; k++) partida.passo();
      for (let i = efeitos.length - 1; i >= 0; i--) if (++efeitos[i].idade > (efeitos[i].tipo === 'queda' ? 240 : 24)) efeitos.splice(i, 1);
      const contagem = partida.n <= 0 ? Math.max(1, Math.ceil((verdeEm - agora) / 1000)) : 0;
      if (contagem !== ultimaContagem) {
        if (contagem > 0) tocar('vez');
        else if (ultimaContagem > 0) tocar('chegada');
        ultimaContagem = contagem;
      }
      const pronta = !!partida.meu && partida.meu.segurando >= CARGA;
      if (pronta && !estavaPronta) tocar('moeda');
      estavaPronta = pronta;
      if (agora - ultimoHud > 150) {
        ultimoHud = agora;
        const restanteMs = ((DURACAO_PASSOS - Math.max(0, partida.n)) * 1000) / PASSOS_POR_SEGUNDO;
        const livre = partida.carga().livre;
        const comeco = partida.n < 4 * PASSOS_POR_SEGUNDO;
        setHud((h) =>
          h.contagem === contagem && h.livre === livre && h.comeco === comeco && Math.ceil(h.restanteMs / 1000) === Math.ceil(restanteMs / 1000)
            ? h
            : { ...h, restanteMs, contagem, livre, comeco },
        );
      }
      if (semFoco) return;
      moverCamera();
      desenhar();
    };
    id = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const segurar = (campo: 'fogo' | 'freia') => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      comandos.current[campo] = true;
    },
    onPointerUp: () => (comandos.current[campo] = false),
    onPointerCancel: () => (comandos.current[campo] = false),
    onPointerLeave: () => (comandos.current[campo] = false),
  });
  const lado = (qual: 'toqueEsquerda' | 'toqueDireita') => {
    const mudar = (v: boolean) => {
      lados.current[qual] = v;
      const l = lados.current;
      comandos.current.vira = (l.direita || l.toqueDireita ? 1 : 0) - (l.esquerda || l.toqueEsquerda ? 1 : 0);
    };
    return {
      onPointerDown: (e: React.PointerEvent) => {
        e.preventDefault();
        mudar(true);
      },
      onPointerUp: () => mudar(false),
      onPointerCancel: () => mudar(false),
      onPointerLeave: () => mudar(false),
    };
  };

  const ordem = [...lista.current].sort((a, b) => (vidas.get(b.id) ?? VIDAS) - (vidas.get(a.id) ?? VIDAS));
  return (
    <div className="aviao">
      <div className="aviao-moldura">
        <canvas ref={canvas} className="aviao-tela" width={VISTA_L} height={VISTA_A} tabIndex={-1} />
        {/* O PAINEL DO JOGO, por cima da tela (pedido dele, 06/11/2026: nada fora dela): as vidas de todos, a cenoura e o tempo */}
        <div className="aviao-hud" ref={painel}>
          <Relogio restante={relogio(hud.restanteMs)} total={(DURACAO_PASSOS * 1000) / PASSOS_POR_SEGUNDO} />
          <div className="aviao-topo">
            <ol className="aviao-todos" aria-label={t('Vidas')}>
              {ordem.map((q) => {
                const n = vidas.get(q.id) ?? VIDAS;
                return (
                  <li key={q.id} className={`${q.id === eu ? 'eu' : ''}${n === 0 ? ' caiu' : ''}`}>
                    <span className="aviao-asa" style={{ background: corDaAsa(q.largada) }} aria-hidden="true" />
                    <span className="aviao-nome">{q.nome}</span>
                    <span className="aviao-vidas" aria-label={t('Vidas: {n}', { n })}>
                      {Array.from({ length: VIDAS }, (_, i) => (
                        <i key={i} className={i < n ? 'cheia' : ''} />
                      ))}
                    </span>
                  </li>
                );
              })}
            </ol>
            {euNoAr && (
              <span className={`aviao-cenoura${hud.livre ? '' : ' no-ar'}`} title={t('Cenoura teleguiada')}>
                <span className="aviao-cenoura-icone" aria-hidden="true" />
                {hud.livre ? t('Pronta') : t('No ar')}
              </span>
            )}
          </div>
        </div>
        {hud.contagem > 0 && (
          <span className="golfe-contagem" aria-hidden="true">
            {hud.contagem}
          </span>
        )}
        {/* os comandos, dentro da tela, só na largada e nos primeiros segundos */}
        {euNoAr && (hud.contagem > 0 || hud.comeco) && (
          <div className="aviao-ajuda">
            <ComandosDoJogo
              itens={[
                { teclas: ['setas'], rotulo: t('Voar') },
                { teclas: ['espaco'], toque: 'toque', rotulo: t('Atirar') },
                { teclas: ['espaco'], toque: 'toque-segurar', rotulo: t('Segure e solte: cenoura teleguiada') },
              ]}
            />
            <p className="settings-hint">{t('Dois acertos você aguenta; o terceiro derruba. Curva fechada perto da cerca protege por um instante.')}</p>
          </div>
        )}
        {piloto && !euNoAr && !solo && !hud.acabou && <p className="aviao-aviso">{t('Caiu! Agora é torcer de longe.')}</p>}
        {euNoAr && (
          <div className="aviao-toque">
            <div>
              <button type="button" aria-label={t('Virar para a esquerda')} {...lado('toqueEsquerda')}>
                ◀
              </button>
              <button type="button" aria-label={t('Virar para a direita')} {...lado('toqueDireita')}>
                ▶
              </button>
            </div>
            <div>
              <button type="button" aria-label={t('Frear')} {...segurar('freia')}>
                ▼
              </button>
              <button type="button" className="aviao-fogo" aria-label={t('Atirar')} {...segurar('fogo')}>
                ●
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// O FIM
// ---------------------------------------------------------------------------------------------------------------------

function TelaDoFim({ estado, eu }: { estado: EstadoDosAvioes; eu: number }) {
  const t = useT();
  if (estado.solo) {
    const r = estado.resultadoDoSolo;
    if (!r) return <p className="minijogo-situacao">{t('Fim de jogo!')}</p>;
    return (
      <div className="aviao-fim-solo">
        <p className="minijogo-situacao">{r.posicao === 1 ? t('Você venceu!') : t('{posicao}º lugar, entre {total}', { posicao: r.posicao, total: r.total })}</p>
        <p className="settings-hint">
          {t('Vidas: {n}', { n: r.vidas })} · {t('Acertos: {n}', { n: r.acertos })}
        </p>
      </div>
    );
  }
  const linhas = (estado.jogadores ?? []).filter((j) => j.posicao !== null);
  return (
    <Placar
      eu={eu}
      linhas={(linhas.length ? linhas : (estado.jogadores ?? [])).map((j) => ({
        userId: j.userId,
        username: j.username,
        valor: `${'♥'.repeat(j.vidas) || '—'} · 🎯 ${j.acertos}`,
        posicao: j.posicao ?? undefined,
      }))}
    />
  );
}
