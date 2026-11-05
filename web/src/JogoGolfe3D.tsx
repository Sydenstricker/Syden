import { useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { ComandosDoJogo } from './ComandosDosJogos';
import { useT } from './i18n';
import { coresDe } from './JogoTabuleiro';
import { Placar, Relogio } from './Minijogo';
import type { Partida } from './minijogos';
import { tocar } from './somDosJogos';
import type { CenaDoGolfe3D } from './golfe3d/cena';
import {
  BURACOS,
  DY_MAX,
  FORCA_MAX,
  acabouOBuraco,
  avancar,
  bater,
  copiarBola,
  mapaDeDistancia,
  melhorTacada,
  montar,
  novaBola,
  tacadaInvalida,
  type Bola,
  type Tacada,
} from './golfe3d/fisica';
import './golfe3d/golfe3d.css';

/**
 * O MINIGOLFE 3D (05/11/2026, server/src/minijogo-golfe3d.ts): o irmão em 3D do Minigolfe da toca, com as peças do Minigolf
 * Kit da Kenney e o nosso coelho 3D ao lado da bola. Os dois ficam na estante para a turma dizer qual prefere.
 *
 * Como no da toca: todos jogam o mesmo buraco ao mesmo tempo, cada um na própria tela, e as bolas dos outros chegam pelo
 * tempo real. A BOLA É SIMULADA AQUI E NO SERVIDOR, com o mesmo arquivo (golfe3d/fisica.ts): a tacada vai na hora, com o passo
 * do relógio do buraco, e a tela não espera a resposta; se as duas pontas discordarem, a bola daqui se acerta pela do servidor
 * quando parar.
 *
 * A MIRA: arrastar na tela (para o lado gira, para baixo dá a força) e soltar; no teclado, as setas giram e o Espaço segurado
 * dá a força. A câmera fica atrás da bola, olhando para onde se mira; no começo de cada buraco, a vista de cima do buraco
 * inteiro (e o botão do olho a traz de volta quando se quiser).
 */

export interface EstadoGolfe3D {
  fase: 'preparando' | 'jogando' | 'placar' | 'fim';
  rodada: number;
  rodadas: number;
  /** O índice do buraco (golfe3d/fisica.ts, BURACOS). */
  buraco: number;
  duracaoMs: number;
  decorridoMs: number | null;
  fechando: boolean;
  tacadasMax: number;
  bolas: { userId: number; username: string; avatar: number | null; x: number; z: number; tacadas: number; dentro: boolean; acabou: boolean }[];
  meu: Bola | null;
  placar: { userId: number; username: string; pontos: number; buraco: number | null; posicao: number | null }[];
  partidaId: string;
}

/** A força mínima de uma tacada (abaixo disto, soltar não bate). */
const FORCA_MINIMA = 0.05;
/** O Espaço segurado enche a força neste tempo (e volta, se continuar segurado). */
const CARGA_MS = 1400;
/** Nos últimos instantes do buraco a tela já não deixa bater (a tacada chegaria ao servidor depois do fim). */
const MARGEM_DO_FIM_MS = 300;
/** A vista de cima, no começo de cada buraco, até um pouco depois de valer. */
const VISTA_DO_COMECO_MS = 1200;
/** O arraste para baixo que dá a força toda, em fração da altura da tela. */
const ARRASTE_TOTAL = 0.4;

/** A tacada por cima sai a uns 37° do chão: 4/5 da força para a frente e 3/5 para o alto. */
const FRENTE_POR_CIMA = 0.8;
const ALTO_POR_CIMA = 0.6;

function vetorDaTacada(ux: number, uz: number, forca: number, porCima = false) {
  let f = Math.min(1, forca) * FORCA_MAX;
  for (;;) {
    const frente = porCima ? f * FRENTE_POR_CIMA : f;
    const dx = Math.round(ux * frente);
    const dz = Math.round(uz * frente);
    const dy = porCima ? Math.min(DY_MAX, Math.round(f * ALTO_POR_CIMA)) : 0;
    if (dx * dx + dz * dz + dy * dy <= FORCA_MAX * FORCA_MAX) return { dx, dz, dy };
    f -= 1;
  }
}

/** O caminho da bola no ar, simulado com a mesma física: os pontos até ela tocar o chão pela primeira vez. */
function arcoDaTacada(b: (typeof BURACOS)[number], bola: Bola, t: Tacada): [number, number, number][] {
  const teste = copiarBola(bola);
  bater(teste, t);
  const pontos: [number, number, number][] = [];
  for (let k = 0; k < 240 && teste.andando && teste.noAr; k++) {
    const vyAntes = teste.vy;
    avancar(b, teste);
    if (!teste.noAr || teste.vy > vyAntes) break;
    pontos.push([teste.x, teste.y, teste.z]);
  }
  return pontos;
}

const passoDe = (inicio: number, agora: number) => Math.max(0, Math.floor(((agora - inicio) * 60) / 1000));

type Props = {
  estado: EstadoGolfe3D & Partida;
  eu: number;
  jogador: boolean;
  agir: (corpo: Record<string, unknown>) => unknown;
  socket: Socket | null;
  channelId: number;
};

export function JogoGolfe3D({ estado, eu, jogador, agir, socket, channelId }: Props) {
  const t = useT();
  if (estado.terminada || estado.fase === 'fim') {
    const ficaram = estado.placar.filter((l) => l.posicao !== null);
    const sairam = estado.placar.filter((l) => l.posicao === null);
    return (
      <>
        <Placar eu={eu} linhas={ficaram.map((l) => ({ ...l, valor: String(l.pontos), posicao: l.posicao ?? undefined }))} />
        {sairam.length > 0 && (
          <ul className="minijogo-placar golfe3d-sairam">
            {sairam.map((l) => (
              <li key={l.userId} className={l.userId === eu ? 'eu' : ''}>
                <span className="minijogo-medalha" aria-hidden="true">
                  –
                </span>
                <span className="minijogo-nome">{l.username}</span>
                <span className="minijogo-pontos">{l.pontos}</span>
              </li>
            ))}
          </ul>
        )}
      </>
    );
  }
  if (estado.fase === 'placar') {
    return (
      <div className="golfe3d">
        <table className="golfe3d-placar">
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
                <td>{l.posicao ?? '–'}</td>
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
  // a cena é montada de novo a cada buraco e a cada partida
  return <BuracoEm3D key={`${estado.partidaId}-${estado.buraco}`} estado={estado} eu={eu} jogador={jogador} agir={agir} socket={socket} channelId={channelId} />;
}

function BuracoEm3D({ estado, eu, jogador, agir, socket, channelId }: Props) {
  const t = useT();
  const buraco = BURACOS[estado.buraco] ?? BURACOS[0];
  const caixa = useRef<HTMLDivElement>(null);
  const cena = useRef<CenaDoGolfe3D | null>(null);
  const [carga, setCarga] = useState<'carregando' | 'pronta' | 'falhou'>(() => (temWebGL() ? 'carregando' : 'falhou'));
  const souJogador = jogador && estado.bolas.some((b) => b.userId === eu);
  const naSala = !estado.solo;

  // o começo do buraco, neste relógio: o primeiro que se soube
  const inicio = useRef<number | null>(null);
  if (inicio.current === null) {
    if (estado.fase === 'preparando') inicio.current = estado.recebidaEm + estado.restanteMs;
    else if (estado.decorridoMs !== null) inicio.current = estado.recebidaEm - estado.decorridoMs;
  }

  const bola = useRef<Bola>(estado.meu ? copiarBola(estado.meu) : novaBola(buraco));
  const doServidor = useRef(estado.meu);
  doServidor.current = estado.meu;
  const pendentes = useRef(0);
  const calmoDesde = useRef(0);
  const [tacadas, setTacadas] = useState(bola.current.tacadas);
  const [acabou, setAcabou] = useState(acabouOBuraco(bola.current));
  const [caiu, setCaiu] = useState(false);
  const [agora, setAgora] = useState(Date.now());
  const [deCima, setDeCima] = useState(false);
  const deCimaRef = useRef(deCima);
  deCimaRef.current = deCima;
  const [forcaNaTela, setForcaNaTela] = useState<number | null>(null);
  /** A tacada por cima (o botão, ou a tecla Q): a bola voa por cima das bordas baixas e dos buracos do chão. */
  const [porCima, setPorCima] = useState(false);
  const porCimaRef = useRef(porCima);
  porCimaRef.current = porCima;

  const outrosDoServidor = useRef(estado.bolas);
  outrosDoServidor.current = estado.bolas;
  const pontinhos = useRef(new Map<number, { x: number; z: number; y: number | null; em: number }>());
  const cores = useRef(new Map<number, string>());
  estado.bolas.forEach((b, i) => cores.current.set(b.userId, coresDe(b.avatar, i).roupa));
  const meuIndice = Math.max(0, estado.bolas.findIndex((b) => b.userId === eu));
  const minhasCores = coresDe(estado.bolas[meuIndice]?.avatar ?? null, meuIndice);

  const jogando = estado.fase === 'jogando' && !estado.terminada && !estado.fechando;
  const jogandoRef = useRef(jogando);
  jogandoRef.current = jogando;
  const faseRef = useRef(estado.fase);
  faseRef.current = estado.fase;

  /** O mapa do caminho até o buraco: a mira começa apontando por ele (e o piloto do teste o usa). */
  const distancia = useRef<ReturnType<typeof mapaDeDistancia> | null>(null);
  if (!distancia.current) distancia.current = mapaDeDistancia(buraco);

  /** A direção da mira, em radianos no plano (0 = +x, π/2 = +z), e a força enquanto se puxa. */
  const angulo = useRef(rumoDoCaminho(buraco, bola.current, distancia.current));
  const forca = useRef<number | null>(null);
  const arraste = useRef<{ id: number; x: number; y: number; ang: number } | null>(null);
  const teclas = useRef({ esquerda: false, direita: false, cima: false, baixo: false, espaco: false, cargaDesde: 0 });

  // AS BOLAS DOS OUTROS chegam pelo socket, já com quem mandou (o servidor carimba)
  useEffect(() => {
    if (!socket || !naSala) return;
    const chegou = (m: { channelId?: number; dados?: Record<string, unknown> }) => {
      if (m.channelId !== channelId || !m.dados) return;
      const { userId, x, z, y, buraco: n } = m.dados;
      if (typeof userId !== 'number' || typeof x !== 'number' || typeof z !== 'number' || n !== estado.buraco || userId === eu) return;
      pontinhos.current.set(userId, { x, z, y: typeof y === 'number' && Number.isFinite(y) ? y : null, em: Date.now() });
    };
    socket.on('minijogo:tempo-real', chegou);
    return () => {
      socket.off('minijogo:tempo-real', chegou);
    };
  }, [socket, naSala, channelId, estado.buraco, eu]);

  // A CENA: o three.js só agora, num pedaço à parte
  useEffect(() => {
    if (carga === 'falhou' || !caixa.current) return;
    let viva = true;
    let criada: CenaDoGolfe3D | null = null;
    import('./golfe3d/cena')
      .then(async ({ CenaDoGolfe3D }) => {
        if (!viva || !caixa.current) return;
        criada = new CenaDoGolfe3D(caixa.current, buraco, souJogador ? minhasCores : null);
        await criada.montar();
        if (!viva) return;
        cena.current = criada;
        setCarga('pronta');
      })
      .catch(() => {
        criada?.destruir();
        criada = null;
        if (viva) setCarga('falhou');
      });
    return () => {
      viva = false;
      criada?.destruir();
      cena.current = null;
    };
    // uma cena por buraco
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carga === 'falhou']);

  const duracaoMs = estado.duracaoMs;
  const podeBater = () => {
    if (!souJogador || !jogandoRef.current || bola.current.andando || acabouOBuraco(bola.current) || inicio.current === null) return false;
    const agoraMs = Date.now();
    return agoraMs >= inicio.current && agoraMs < inicio.current + duracaoMs - MARGEM_DO_FIM_MS;
  };

  const baterAgora = (ux: number, uz: number, f: number) => {
    if (!podeBater() || f < FORCA_MINIMA || inicio.current === null) return;
    const { dx, dz, dy } = vetorDaTacada(ux, uz, f, porCimaRef.current);
    const tacada: Tacada = { passo: Math.max(bola.current.passo, passoDe(inicio.current, Date.now())), dx, dz, ...(dy ? { dy } : {}) };
    if (tacadaInvalida(bola.current, tacada)) return;
    bater(bola.current, tacada);
    tocar('tacada');
    pendentes.current++;
    void Promise.resolve(agir({ tipo: 'tacada', ...tacada })).finally(() => {
      pendentes.current--;
      calmoDesde.current = Date.now();
    });
    setTacadas(bola.current.tacadas);
  };
  const baterRef = useRef(baterAgora);
  baterRef.current = baterAgora;

  // O LAÇO: a bola anda no passo do relógio, e a cena recebe o quadro
  useEffect(() => {
    let id = 0;
    let pilotoEm = 0;
    let enviadoEm = 0;
    let estavaAndando = false;
    let ultimaTacadas = bola.current.tacadas;
    let ultimoRelogio = 0;
    let ultimoAcabou = acabouOBuraco(bola.current);
    let ultimaForca: number | null = null;
    let tacadasAoRolar: number | null = null;
    let avisoDeQueda: ReturnType<typeof setTimeout> | undefined;
    const quadro = () => {
      const agoraMs = Date.now();
      const passoAgora = inicio.current === null ? 0 : passoDe(inicio.current, agoraMs);
      const b = bola.current;
      if (b.andando && tacadasAoRolar === null) tacadasAoRolar = b.tacadas;
      for (let k = 0; k < 900 && b.andando && b.passo < passoAgora; k++) avancar(buraco, b);
      if (!b.andando && tacadasAoRolar !== null) {
        if (b.dentro) tocar('buraco');
        if (b.tacadas > tacadasAoRolar) {
          tocar('agua');
          setCaiu(true);
          clearTimeout(avisoDeQueda);
          avisoDeQueda = setTimeout(() => setCaiu(false), 2200);
        }
        tacadasAoRolar = null;
        // parou: a mira volta a apontar pelo caminho
        if (!b.dentro && distancia.current) angulo.current = rumoDoCaminho(buraco, b, distancia.current);
      }
      if (b.tacadas !== ultimaTacadas) {
        ultimaTacadas = b.tacadas;
        setTacadas(b.tacadas);
      }
      // parada, a bola se acerta pela do servidor se as duas discordarem (e nada está a caminho dele)
      const s = doServidor.current;
      if (!b.andando && pendentes.current === 0 && agoraMs - calmoDesde.current > 800 && s && !s.andando && (s.tacadas !== b.tacadas || s.x !== b.x || s.z !== b.z || s.dentro !== b.dentro)) {
        bola.current = copiarBola(s);
        ultimaTacadas = s.tacadas;
        setTacadas(s.tacadas);
      }
      if (acabouOBuraco(bola.current) !== ultimoAcabou) {
        ultimoAcabou = !ultimoAcabou;
        setAcabou(ultimoAcabou);
      }
      // a minha bola para os outros, enquanto anda (e uma vez quando para)
      if (naSala && socket && souJogador && (bola.current.andando || estavaAndando) && agoraMs - enviadoEm >= 100) {
        enviadoEm = agoraMs;
        socket.emit('minijogo:tempo-real', { channelId, dados: { x: bola.current.x, z: bola.current.z, ...(bola.current.noAr ? { y: bola.current.y } : {}) } });
        estavaAndando = bola.current.andando;
      }
      // a mira pelas teclas
      const k = teclas.current;
      if (souJogador && !arraste.current) {
        const giro = (k.esquerda ? -0.035 : 0) + (k.direita ? 0.035 : 0) + (k.cima ? -0.006 : 0) + (k.baixo ? 0.006 : 0);
        angulo.current += giro;
        if (k.espaco) {
          const c = ((agoraMs - k.cargaDesde) % (CARGA_MS * 2)) / CARGA_MS;
          forca.current = c <= 1 ? c : 2 - c;
        }
      }
      // o piloto automático do teste (só no site de desenvolvimento)
      if (import.meta.env.DEV && distancia.current && (window as { golfe3dPilotoAutomatico?: boolean }).golfe3dPilotoAutomatico && podeBater()) {
        if (!pilotoEm) pilotoEm = agoraMs + 600;
        else if (agoraMs >= pilotoEm) {
          pilotoEm = 0;
          porCimaRef.current = false;
          const tc = melhorTacada(buraco, bola.current, Math.max(bola.current.passo, passoAgora), distancia.current);
          const f = Math.sqrt(tc.dx * tc.dx + tc.dz * tc.dz);
          angulo.current = Math.atan2(tc.dz, tc.dx);
          baterRef.current(tc.dx / f, tc.dz / f, f / FORCA_MAX);
        }
      }
      const outras = [];
      for (const o of outrosDoServidor.current) {
        if (o.userId === eu) continue;
        const p = pontinhos.current.get(o.userId);
        const usar = p && agoraMs - p.em < 1500 ? p : o;
        outras.push({ x: usar.x, z: usar.z, y: usar === p ? p.y : null, cor: cores.current.get(o.userId) ?? '#d9774f', dentro: o.dentro && usar === o });
      }
      const pode = podeBater();
      const ux = Math.cos(angulo.current);
      const uz = Math.sin(angulo.current);
      const comeco = inicio.current === null || agoraMs < inicio.current + VISTA_DO_COMECO_MS || faseRef.current === 'preparando';
      // na tacada por cima, a mira é o arco de verdade (a mesma física), com a força de agora (ou a metade, antes de puxar)
      let arco: [number, number, number][] | undefined;
      if (pode && porCimaRef.current && !deCimaRef.current && !comeco) {
        const { dx, dz, dy } = vetorDaTacada(ux, uz, Math.max(FORCA_MINIMA, forca.current || 0.5), true);
        arco = arcoDaTacada(buraco, bola.current, { passo: bola.current.passo, dx, dz, dy });
      }
      cena.current?.quadro({
        minha: souJogador ? { x: bola.current.x, z: bola.current.z, y: bola.current.noAr ? bola.current.y : null, dentro: bola.current.dentro, andando: bola.current.andando } : null,
        outras,
        mira: pode ? { ux, uz, forca: forca.current ?? 0, arco } : null,
        rumo: { ux, uz },
        deCima: deCimaRef.current || comeco,
        tacadas: bola.current.tacadas,
      });
      const f = pode ? forca.current : null;
      if (f !== ultimaForca) {
        ultimaForca = f;
        setForcaNaTela(f);
      }
      if (agoraMs - ultimoRelogio > 250) {
        ultimoRelogio = agoraMs;
        setAgora(agoraMs);
      }
      id = requestAnimationFrame(quadro);
    };
    id = requestAnimationFrame(quadro);
    return () => {
      cancelAnimationFrame(id);
      clearTimeout(avisoDeQueda);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buraco, souJogador, naSala, socket, channelId, eu]);

  // AS TECLAS: as setas giram a mira, o Espaço segurado enche a força, e soltar bate. Fora dos campos de texto; a janela que
  // perde o foco solta tudo sem bater.
  useEffect(() => {
    if (!souJogador) return;
    const nome = (e: KeyboardEvent) =>
      e.key === 'ArrowLeft' ? 'esquerda' : e.key === 'ArrowRight' ? 'direita' : e.key === 'ArrowUp' ? 'cima' : e.key === 'ArrowDown' ? 'baixo' : e.key === ' ' ? 'espaco' : null;
    const desce = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement | null;
      if (alvo && (alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA' || alvo.isContentEditable)) return;
      if ((e.key === 'q' || e.key === 'Q') && !e.ctrlKey && !e.metaKey && !e.altKey && !e.repeat) {
        e.preventDefault();
        setPorCima((v) => !v);
        return;
      }
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
      if (n === 'espaco' && teclas.current.espaco && forca.current !== null) {
        baterRef.current(Math.cos(angulo.current), Math.sin(angulo.current), forca.current);
        forca.current = null;
      }
      teclas.current[n] = false;
    };
    const soltarTudo = () => {
      teclas.current = { esquerda: false, direita: false, cima: false, baixo: false, espaco: false, cargaDesde: 0 };
      arraste.current = null;
      forca.current = null;
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

  const restante = inicio.current === null ? estado.duracaoMs : estado.fase === 'preparando' ? estado.duracaoMs : Math.max(0, estado.duracaoMs - (agora - inicio.current));
  const contagem = estado.fase === 'preparando' && inicio.current !== null ? Math.max(1, Math.ceil((inicio.current - agora) / 1000)) : null;

  if (carga === 'falhou') return <p className="minijogo-situacao">{t('Este jogo precisa de gráficos 3D, que não abriram neste aparelho.')}</p>;

  return (
    <div className="golfe3d">
      <div className="golfe3d-topo">
        {souJogador && <span className="golfe3d-tacadas">{t('Tacadas: {n}', { n: tacadas })}</span>}
        {estado.fase === 'jogando' ? <Relogio restante={restante} total={estado.duracaoMs} /> : <span className="minijogo-tempo" />}
        {souJogador && (
          <button
            type="button"
            className="golfe3d-por-cima"
            aria-pressed={porCima}
            title={t('Tacada por cima') + ' (Q)'}
            aria-label={t('Tacada por cima')}
            onClick={() => setPorCima((v) => !v)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 19c3-11 15-11 18 0" strokeDasharray={porCima ? undefined : '2 3'} />
              <circle cx="4" cy="19" r="1.6" fill="currentColor" />
              <path d="M2 21h20" />
            </svg>
          </button>
        )}
        <button type="button" className="golfe3d-de-cima" aria-pressed={deCima} title={t('Ver o buraco de cima')} aria-label={t('Ver o buraco de cima')} onClick={() => setDeCima((v) => !v)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>
      </div>
      <div className="golfe3d-moldura">
        <div
          ref={caixa}
          className={arraste.current ? 'golfe3d-caixa mirando' : 'golfe3d-caixa'}
          onPointerDown={(e) => {
            if (!podeBater() || e.button > 0) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            arraste.current = { id: e.pointerId, x: e.clientX, y: e.clientY, ang: angulo.current };
            forca.current = 0;
          }}
          onPointerMove={(e) => {
            const a = arraste.current;
            if (a?.id !== e.pointerId) return;
            // para o lado gira a mira; para baixo, a força (para cima de onde começou, nada)
            const r = e.currentTarget.getBoundingClientRect();
            angulo.current = a.ang + ((e.clientX - a.x) / r.width) * 2.4;
            forca.current = Math.max(0, Math.min(1, (e.clientY - a.y) / (r.height * ARRASTE_TOTAL)));
          }}
          onPointerUp={(e) => {
            if (arraste.current?.id !== e.pointerId) return;
            arraste.current = null;
            const f = forca.current;
            forca.current = null;
            if (f && f > 0) baterRef.current(Math.cos(angulo.current), Math.sin(angulo.current), f);
          }}
          onPointerCancel={() => {
            arraste.current = null;
            forca.current = null;
          }}
        />
        {forcaNaTela !== null && forcaNaTela > 0 && (
          <div className="golfe3d-forca" aria-hidden="true">
            <span style={{ height: `${Math.round(forcaNaTela * 100)}%` }} />
          </div>
        )}
        {contagem !== null && (
          <span className="golfe3d-contagem" aria-hidden="true">
            {contagem}
          </span>
        )}
      </div>
      {souJogador && estado.fase === 'preparando' && <p className="minijogo-situacao">{t('Arraste para o lado para mirar e para baixo para a força, e solte. No teclado: as setas miram, e o Espaço segurado dá a força.')}</p>}
      {souJogador && situacao(estado.fase, acabou, caiu, bola.current.dentro, t)}
      {souJogador && (
        <ComandosDoJogo
          itens={[
            { teclas: ['mouse-arrastar'], toque: 'toque-arrastar', rotulo: t('Mirar') + ' · ' + t('Força') },
            { teclas: ['setas-lado'], rotulo: t('Mirar') },
            { teclas: ['espaco'], rotulo: t('Força') },
            { teclas: ['q'], rotulo: t('Tacada por cima') },
          ]}
        />
      )}
    </div>
  );
}

/** Para onde a mira começa: a direção, a partir da bola, em que o caminho até o buraco mais encurta. */
function rumoDoCaminho(b: (typeof BURACOS)[number], bola: Bola, distancia: (x: number, z: number) => number): number {
  const [hx, hz] = montar(b).buraco;
  let melhor = Math.atan2(hz - bola.z, hx - bola.x);
  let melhorNota = Infinity;
  for (let k = 0; k < 48; k++) {
    const a = (k / 48) * Math.PI * 2;
    let nota = 0;
    for (const r of [0.15, 0.3, 0.45]) {
      const d = distancia(bola.x + Math.cos(a) * r, bola.z + Math.sin(a) * r);
      nota += Number.isFinite(d) ? d : 99;
    }
    if (nota < melhorNota) {
      melhorNota = nota;
      melhor = a;
    }
  }
  return melhor;
}

function situacao(fase: string, acabou: boolean, caiu: boolean, dentro: boolean, t: ReturnType<typeof useT>) {
  if (fase !== 'jogando') return null;
  if (caiu) return <p className="minijogo-situacao golfe3d-aviso">{t('Fora da pista! Mais uma tacada.')}</p>;
  if (!acabou) return null;
  return (
    <p className="minijogo-situacao">
      {dentro ? t('No buraco!') : t('Acabaram as tacadas.')} {t('Você terminou! Agora é torcer pelos outros.')}
    </p>
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
