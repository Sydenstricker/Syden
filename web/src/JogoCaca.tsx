import { ComandosDoJogo } from './ComandosDosJogos';
import { tocar } from './somDosJogos';
import { useEffect, useRef, useState } from 'react';
import { useT } from './i18n';
import { Placar, Relogio } from './Minijogo';
import type { EstadoCaca, Partida } from './minijogos';
import { type Arte, carregarArte, desenhar, desenharCoelhoDaMoita, ESCALA, pintarCenario, pintarFrente, type Queda } from './caca/desenho';
import { AMIGO_PENA, ALTURA, LARGURA, ehAmigo, multiplicador, posicao, pontosDoAcerto, pragaAtingida, todasAsPragasDaOnda } from './caca/voo';
import { Heart, HeartCrack } from 'lucide-react';

/**
 * A CAÇA ÀS PRAGAS DA HORTA (04/11/2026, server/src/minijogo-caca.ts). Corvos e gafanhotos atravessam a horta, e cada um mira
 * e atira com o mouse ou o dedo; a turma caça as MESMAS pragas, cada um a sua cópia.
 *
 * O TIRO É CONFERIDO AQUI, para a praga cair na hora, e DE NOVO NO SERVIDOR, que é quem conta: os dois fazem a mesma conta do
 * voo (caca/voo.ts, igual byte a byte ao do servidor). O tiro vai com o lugar e o instante da onda em que foi dado. Se um dia
 * as duas pontas discordarem, a tela se acerta pelo servidor quando os tiros pararem de ir e vir.
 *
 * O RELÓGIO DA ONDA, neste computador, como no golfe: começa quando o "prepare-se" acaba (restanteMs) ou, para quem chega no
 * meio, pelo que o servidor diz que já passou (decorridoMs).
 */

/** Um tiro a cada isto, no máximo (o servidor recusa mais rápido que 120 ms). */
const INTERVALO_MS = 150;
/** A munição da rodada bônus (20/11/2026): sem limite (o servidor manda -1). */
const SEM_LIMITE = -1;
/** O que o servidor manda a mais desde 20/11/2026 (a rodada bônus, as pragas abatidas sem a joaninha). */
type Extra = { bonus?: boolean; categoria?: string; errosRestantes?: number };
/** O modo "até errar três" (21/11/2026): a categoria que o servidor conhece, e os erros que acabam a partida. */
const MODO_TRES_ERROS = 'tres-erros';
const ERROS_DO_MODO = 3;

/**
 * A ESCOLHA DO MODO (21/11/2026, só no Solo): as cinco ondas de sempre, ou "até errar três" (as ondas não acabam, sem limite de
 * munição; o terceiro tiro errado acaba). Cada modo tem o seu recorde.
 */
export function EscolhaDaCaca({ aoEscolher, aoVoltar }: { aoEscolher: (modo: string | null) => void; aoVoltar: () => void }) {
  const t = useT();
  return (
    <div className="corrida-escolha">
      <ul className="corrida-pistas">
        <li>
          <button type="button" className="corrida-pista-botao" onClick={() => aoEscolher(null)}>
            <span className="caca-placa" aria-hidden="true">
              {[0, 1, 2, 3, 4].map((k) => (
                <span key={k} className="caca-marca abatida" />
              ))}
            </span>
            <strong>{t('Cinco ondas')}</strong>
          </button>
        </li>
        <li>
          <button type="button" className="corrida-pista-botao" onClick={() => aoEscolher(MODO_TRES_ERROS)}>
            <span className="caca-erros" aria-hidden="true">
              {[0, 1, 2].map((k) => (
                <Heart key={k} size={18} />
              ))}
            </span>
            <strong>{t('Até errar três')}</strong>
          </button>
        </li>
      </ul>
      <div className="minijogo-acoes">
        <button type="button" className="btn-secondary" onClick={aoVoltar}>
          {t('Outros jogos')}
        </button>
      </div>
    </div>
  );
}
type MeuExtra = { pragasAbatidas?: number; perfeita?: boolean; combo?: number };

// a arte da barraca começa a vir junto com o jogo, para chegar antes do fim do "prepare-se"
void carregarArte();

export function JogoCaca({ estado, eu, jogador, agir }: { estado: EstadoCaca & Partida; eu: number; jogador: boolean; agir: (corpo: Record<string, unknown>) => unknown }) {
  const t = useT();
  if (estado.terminada || estado.fase === 'fim') {
    const ficaram = estado.placar.filter((l) => l.posicao !== null);
    return (
      <>
        {estado.recorde &&
          (estado.recorde.novo ? (
            <p className="minijogo-situacao caca-recorde">{t('Novo recorde!')}</p>
          ) : (
            estado.recorde.antes !== null && <p className="minijogo-situacao">{t('Seu recorde: {tempo}', { tempo: String(estado.recorde.antes) })}</p>
          ))}
        <Placar eu={eu} linhas={(ficaram.length ? ficaram : estado.placar).map((l) => ({ ...l, valor: String(l.pontos), posicao: l.posicao ?? undefined }))} />
      </>
    );
  }
  if (estado.fase === 'placar') {
    // o fim da onda: o coelho da moita (alegre com a onda boa, rindo com a ruim) e a onda perfeita; depois da rodada bônus,
    // só o placar
    const meu = estado.meu as (EstadoCaca['meu'] & MeuExtra) | null;
    const bonus = (estado as Extra).bonus === true;
    const alegre = meu && !bonus ? (meu.pragasAbatidas ?? meu.abatidas.length) >= Math.ceil(todasAsPragasDaOnda(estado.onda) * 0.6) : null;
    return (
      <div className="caca">
        {meu && alegre !== null && <CoelhoDaMoita key={estado.onda} alegre={alegre} />}
        {meu?.perfeita && <p className="minijogo-situacao caca-recorde">{t('Onda perfeita!')}</p>}
        <table className="golfe-placar">
          <thead>
            <tr>
              <th aria-hidden="true" />
              <th aria-hidden="true" />
              <th>{t('Nesta onda')}</th>
              <th>{t('Total')}</th>
            </tr>
          </thead>
          <tbody>
            {estado.placar.map((l) => (
              <tr key={l.userId} className={l.userId === eu ? 'eu' : undefined}>
                <td className="golfe-placar-posicao">{l.posicao ?? '–'}</td>
                <td className="minijogo-nome">{l.username}</td>
                <td>{l.daOnda}</td>
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
  // a horta é montada de novo a cada onda e a cada partida: nada da anterior fica para a próxima
  return <Horta key={`${estado.partidaId}-${estado.onda}${(estado as Extra).bonus ? "-bonus" : ""}`} estado={estado} eu={eu} jogador={jogador} agir={agir} />;
}

function Horta({ estado, eu, jogador, agir }: { estado: EstadoCaca & Partida; eu: number; jogador: boolean; agir: (corpo: Record<string, unknown>) => unknown }) {
  const t = useT();
  const canvas = useRef<HTMLCanvasElement>(null);
  const souJogador = jogador && estado.meu !== null && estado.placar.some((l) => l.userId === eu);

  // o começo da onda, neste relógio: o primeiro que se soube
  const inicio = useRef<number | null>(null);
  if (inicio.current === null) {
    if (estado.fase === 'preparando') inicio.current = estado.recebidaEm + estado.restanteMs;
    else if (estado.decorridoMs !== null) inicio.current = estado.recebidaEm - estado.decorridoMs;
  }

  const pragas = estado.pragas;
  const bonus = (estado as Extra).bonus === true;
  /** O "até errar três" (21/11/2026): os erros que sobram, antecipados aqui; o servidor corrige quando acalma. */
  const tresErros = (estado as Extra).categoria === MODO_TRES_ERROS;
  const [errosRestantes, setErrosRestantes] = useState((estado as Extra).errosRestantes ?? ERROS_DO_MODO);
  /** O que esta tela sabe de mim: as pragas que abati, a munição e os pontos. O servidor corrige quando acalma. */
  const abatidas = useRef(new Set<number>(estado.meu?.abatidas ?? []));
  const [municao, setMunicao] = useState(estado.meu?.municao ?? 0);
  const [pontos, setPontos] = useState(estado.meu?.pontos ?? 0);
  /** O COMBO (19/11/2026): acertos seguidos sem errar; o servidor conta, e a tela antecipa. */
  const combo = useRef((estado.meu as { combo?: number } | null)?.combo ?? 0);
  const municaoRef = useRef(municao);
  municaoRef.current = municao;
  const pendentes = useRef(0);
  const calmoDesde = useRef(0);
  const quedas = useRef<Queda[]>([]);
  const ultimoTiro = useRef<{ x: number; y: number; em: number } | null>(null);
  const mira = useRef<{ x: number; y: number } | null>(null);
  const [agora, setAgora] = useState(Date.now());

  // o servidor é quem conta: parado o vai e vem dos tiros, a tela fica com o que ele diz
  useEffect(() => {
    const m = estado.meu;
    if (!m || pendentes.current > 0 || Date.now() - calmoDesde.current < 300) return;
    abatidas.current = new Set(m.abatidas);
    combo.current = (m as { combo?: number }).combo ?? combo.current;
    setMunicao(m.municao);
    setPontos(m.pontos);
    const r = (estado as Extra).errosRestantes;
    if (typeof r === 'number') setErrosRestantes(r);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado.meu]);

  const jogando = estado.fase === 'jogando' && !estado.terminada;
  const msDaOnda = () => (inicio.current === null ? null : Date.now() - inicio.current);

  const atirar = (x: number, y: number) => {
    const ms = msDaOnda();
    if (!souJogador || !jogando || ms === null || ms < 0 || municaoRef.current === 0 || (tresErros && errosRestantes <= 0)) return;
    const agoraMs = Date.now();
    if (ultimoTiro.current && agoraMs - ultimoTiro.current.em < INTERVALO_MS) return;
    ultimoTiro.current = { x, y, em: agoraMs };
    if (!bonus) setMunicao((n) => n - 1);
    tocar('tiro');
    const i = pragaAtingida(pragas, abatidas.current, x, y, ms);
    if (i >= 0 && ehAmigo(pragas[i])) {
      // a joaninha (20/11/2026): ela foge, e custa pontos e o combo
      abatidas.current.add(i);
      combo.current = 0;
      tocar('dano');
      const p = pragas[i];
      const pos = posicao(p, ms)!;
      quedas.current.push({ x: pos.x, y: pos.y, tipo: p.tipo, dir: p.vx >= 0 ? 1 : -1, em: agoraMs, pontos: -AMIGO_PENA });
      setPontos((n) => Math.max(0, n - AMIGO_PENA));
      if (tresErros) setErrosRestantes((n) => n - 1);
    } else if (i >= 0 && bonus) {
      // a cenoura da rodada bônus: os pontos dela, sem combo
      abatidas.current.add(i);
      tocar('moeda');
      const p = pragas[i];
      const pos = posicao(p, ms)!;
      const ganhou = pontosDoAcerto(p, ms);
      quedas.current.push({ x: pos.x, y: pos.y, tipo: p.tipo, dir: 1, em: agoraMs, pontos: ganhou });
      setPontos((n) => n + ganhou);
    } else if (bonus) {
      // errar no bônus não custa nada
    } else if (i >= 0) {
      abatidas.current.add(i);
      const p = pragas[i];
      combo.current++;
      tocar(p.dourada ? 'moeda' : multiplicador(combo.current) > 1 ? 'combo' : 'acerto');
      const pos = posicao(p, ms)!;
      const ganhou = pontosDoAcerto(p, ms) * multiplicador(combo.current);
      quedas.current.push({ x: pos.x, y: pos.y, tipo: p.tipo, dir: p.vx >= 0 ? 1 : -1, em: agoraMs, pontos: ganhou, dourada: p.dourada });
      setPontos((n) => n + ganhou);
    } else {
      combo.current = 0;
      tocar('erro');
      if (tresErros) setErrosRestantes((n) => n - 1);
    }
    pendentes.current++;
    void Promise.resolve(agir({ tipo: 'tiro', x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, ms: Math.round(ms) })).finally(() => {
      pendentes.current--;
      calmoDesde.current = Date.now();
    });
  };
  const atirarRef = useRef(atirar);
  atirarRef.current = atirar;

  // O LAÇO: as pragas andam no relógio da onda, e a tela é desenhada a cada quadro
  useEffect(() => {
    const tela = canvas.current;
    const ctx = tela?.getContext('2d');
    if (!tela || !ctx) return;
    // o cenário de código fica até a arte da barraca chegar (caca/desenho.ts)
    let cenario = pintarCenario();
    let frente: HTMLCanvasElement | null = null;
    let arte: Arte | null = null;
    let vivo = true;
    void carregarArte().then((a) => {
      if (!vivo || !a) return;
      arte = a;
      cenario = pintarCenario(a);
      frente = pintarFrente(a);
    });
    let id = 0;
    let ultimoRelogio = 0;
    let pilotoEm = 0;
    const quadro = () => {
      const agoraMs = Date.now();
      const ms = msDaOnda();
      quedas.current = quedas.current.filter((q) => agoraMs - q.em < 1300);
      // o piloto automático do e2e (só no site de desenvolvimento): mira na primeira praga na tela
      if (import.meta.env.DEV && (window as { cacaPilotoAutomatico?: boolean }).cacaPilotoAutomatico && ms !== null && ms >= 0 && agoraMs > pilotoEm) {
        const i = pragas.findIndex((p, k) => !ehAmigo(p) && !abatidas.current.has(k) && posicao(p, ms + 200) && posicao(p, ms));
        if (i >= 0) {
          const pos = posicao(pragas[i], ms)!;
          pilotoEm = agoraMs + 400;
          atirarRef.current(pos.x, pos.y);
        }
      }
      // SEM FOCO, NADA SE DESENHA (auditoria de 12/11/2026): as pragas voam pelo relógio da onda, e a tela que volta as
      // mostra onde estão. O piloto automático do e2e desenha sempre, para o teste não depender do foco da janela.
      if ((document.hidden || !document.hasFocus()) && !(import.meta.env.DEV && (window as { cacaPilotoAutomatico?: boolean }).cacaPilotoAutomatico)) {
        id = requestAnimationFrame(quadro);
        return;
      }
      desenhar(ctx, {
        cenario,
        frente,
        arte,
        ms: ms !== null && ms >= 0 ? ms : null,
        pragas,
        abatidas: abatidas.current,
        quedas: quedas.current,
        agora: agoraMs,
        mira: souJogador ? mira.current : null,
        tiro: ultimoTiro.current,
        multiplicador: bonus ? 1 : multiplicador(combo.current),
      });
      if (agoraMs - ultimoRelogio > 250) {
        ultimoRelogio = agoraMs;
        setAgora(agoraMs);
      }
      id = requestAnimationFrame(quadro);
    };
    id = requestAnimationFrame(quadro);
    return () => {
      vivo = false;
      cancelAnimationFrame(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pragas, souJogador]);

  /** O ponteiro em unidades da horta. */
  const naHorta = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * LARGURA) / r.width, y: ((e.clientY - r.top) * ALTURA) / r.height };
  };

  const restante = inicio.current === null || estado.fase === 'preparando' ? estado.duracaoMs : Math.max(0, estado.duracaoMs - (agora - inicio.current));
  const contagem = estado.fase === 'preparando' && inicio.current !== null ? Math.max(1, Math.ceil((inicio.current - agora) / 1000)) : null;
  const ms = inicio.current === null ? null : agora - inicio.current;

  return (
    <div className="caca">
      <div className="golfe-topo">
        {souJogador && (
          <>
            {municao === SEM_LIMITE ? (
              <span className="caca-municao" aria-label={t('Sem limite de tiros')}>
                <span className="caca-cenoura" aria-hidden="true" />
                <strong aria-hidden="true">∞</strong>
              </span>
            ) : (
              <span className="caca-municao" aria-label={t('Munição: {n}', { n: municao })}>
                {Array.from({ length: Math.max(0, municao) }, (_, k) => (
                  <span key={k} className="caca-cenoura" aria-hidden="true" />
                ))}
              </span>
            )}
            {/* o modo de três erros (21/11/2026): um coração por erro que sobra, os perdidos rachados */}
            {tresErros && (
              <span className="caca-erros" aria-label={t('Erros que sobram: {n}', { n: Math.max(0, errosRestantes) })}>
                {Array.from({ length: ERROS_DO_MODO }, (_, k) =>
                  k < errosRestantes ? <Heart key={k} size={16} aria-hidden="true" /> : <HeartCrack key={k} size={16} className="perdido" aria-hidden="true" />,
                )}
              </span>
            )}
            {tresErros && <span className="golfe-tacadas">{t('Onda {n}', { n: estado.onda })}</span>}
            <span className="golfe-tacadas">{t('Pontos: {n}', { n: pontos })}</span>
          </>
        )}
        {estado.fase === 'jogando' && <Relogio restante={restante} total={estado.duracaoMs} />}
      </div>
      <div className="golfe-moldura">
        <canvas
          ref={canvas}
          className={`golfe-tela caca-tela${souJogador ? ' caca-mirando' : ''}`}
          width={LARGURA * ESCALA}
          height={ALTURA * ESCALA}
          // a arte da barraca é vetorial: sem o "pixelated" dos outros jogos, e na proporção da horta (16:9)
          style={{ imageRendering: 'auto', aspectRatio: `${LARGURA} / ${ALTURA}` }}
          onPointerMove={(e) => {
            mira.current = naHorta(e);
          }}
          onPointerLeave={() => {
            mira.current = null;
          }}
          onPointerDown={(e) => {
            if (e.button > 0) return;
            const p = naHorta(e);
            mira.current = p;
            atirarRef.current(p.x, p.y);
          }}
        />
        {contagem !== null && (
          <span className="golfe-contagem" aria-hidden="true">
            {contagem}
          </span>
        )}
      </div>
      {/* a contagem da onda, como nos fliperamas: cada praga, abatida, fugida ou ainda por vir */}
      <div className="caca-placa" aria-hidden="true">
        {pragas.map((p, i) => ehAmigo(p) ? null : (
          <span
            key={i}
            className={`caca-marca ${p.tipo}${abatidas.current.has(i) ? ' abatida' : ms !== null && ms > p.t + p.vida ? ' fugiu' : ''}`}
          />
        ))}
      </div>
      {souJogador && estado.fase === 'preparando' && !bonus && !tresErros && <p className="minijogo-situacao">{t('Mire e clique nas pragas antes que fujam. Cada tiro gasta uma cenoura.')}</p>}
      {souJogador && estado.fase === 'preparando' && tresErros && estado.onda === 1 && <p className="minijogo-situacao">{t('Tiros sem limite, mas o terceiro erro acaba a caçada.')}</p>}
      {/* a rodada bônus e a joaninha (20/11/2026): a dica no "prepare-se" */}
      {souJogador && estado.fase === 'preparando' && bonus && <p className="minijogo-situacao caca-recorde">{t('Rodada bônus: acerte as cenouras que sobem, sem limite de tiros.')}</p>}
      {souJogador && estado.fase === 'preparando' && !bonus && pragas.some(ehAmigo) && <p className="minijogo-situacao">{t('Não atire na joaninha: ela é amiga da horta.')}</p>}
      {souJogador && jogando && municao === 0 && <p className="minijogo-situacao">{t('Acabou a munição desta onda.')}</p>}
      {souJogador && <ComandosDoJogo itens={[{ teclas: ['mouse-clique'], toque: 'toque', rotulo: t('Atirar') }]} />}
    </div>
  );
}

/** O coelho que sobe da moita no fim da onda (caca/desenho.ts); com "menos movimento", parado já em cima. */
function CoelhoDaMoita({ alegre }: { alegre: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    const parado = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const inicio = performance.now();
    let id = 0;
    const quadro = () => {
      const s = parado ? 2000 : performance.now() - inicio;
      if (!document.hidden && document.hasFocus()) desenharCoelhoDaMoita(ctx, 96, 64, alegre, s);
      if (!parado && s < 4000) id = requestAnimationFrame(quadro);
    };
    tocar(alegre ? 'medalha' : 'erro');
    id = requestAnimationFrame(quadro);
    if (parado) desenharCoelhoDaMoita(ctx, 96, 64, alegre, 2000);
    return () => cancelAnimationFrame(id);
  }, [alegre]);
  return <canvas ref={ref} width={96} height={64} className="caca-moita" aria-hidden="true" style={{ display: 'block', margin: '0 auto', width: 192, height: 128, imageRendering: 'pixelated' }} />;
}
