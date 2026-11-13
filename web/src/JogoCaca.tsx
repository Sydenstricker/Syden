import { ComandosDoJogo } from './ComandosDosJogos';
import { tocar } from './somDosJogos';
import { useEffect, useRef, useState } from 'react';
import { useT } from './i18n';
import { Placar, Relogio } from './Minijogo';
import type { EstadoCaca, Partida } from './minijogos';
import { desenhar, pintarCenario, type Queda } from './caca/desenho';
import { ALTURA, LARGURA, posicao, pontosDoAcerto, pragaAtingida } from './caca/voo';

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
    return (
      <div className="caca">
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
  return <Horta key={`${estado.partidaId}-${estado.onda}`} estado={estado} eu={eu} jogador={jogador} agir={agir} />;
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
  /** O que esta tela sabe de mim: as pragas que abati, a munição e os pontos. O servidor corrige quando acalma. */
  const abatidas = useRef(new Set<number>(estado.meu?.abatidas ?? []));
  const [municao, setMunicao] = useState(estado.meu?.municao ?? 0);
  const [pontos, setPontos] = useState(estado.meu?.pontos ?? 0);
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
    setMunicao(m.municao);
    setPontos(m.pontos);
  }, [estado.meu]);

  const jogando = estado.fase === 'jogando' && !estado.terminada;
  const msDaOnda = () => (inicio.current === null ? null : Date.now() - inicio.current);

  const atirar = (x: number, y: number) => {
    const ms = msDaOnda();
    if (!souJogador || !jogando || ms === null || ms < 0 || municaoRef.current <= 0) return;
    const agoraMs = Date.now();
    if (ultimoTiro.current && agoraMs - ultimoTiro.current.em < INTERVALO_MS) return;
    ultimoTiro.current = { x, y, em: agoraMs };
    setMunicao((n) => n - 1);
    tocar('tiro');
    const i = pragaAtingida(pragas, abatidas.current, x, y, ms);
    if (i >= 0) {
      tocar('acerto');
      abatidas.current.add(i);
      const p = pragas[i];
      const pos = posicao(p, ms)!;
      const ganhou = pontosDoAcerto(p, ms);
      quedas.current.push({ x: pos.x, y: pos.y, tipo: p.tipo, dir: p.vx >= 0 ? 1 : -1, em: agoraMs, pontos: ganhou });
      setPontos((n) => n + ganhou);
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
    const cenario = pintarCenario();
    let id = 0;
    let ultimoRelogio = 0;
    let pilotoEm = 0;
    const quadro = () => {
      const agoraMs = Date.now();
      const ms = msDaOnda();
      quedas.current = quedas.current.filter((q) => agoraMs - q.em < 1300);
      // o piloto automático do e2e (só no site de desenvolvimento): mira na primeira praga na tela
      if (import.meta.env.DEV && (window as { cacaPilotoAutomatico?: boolean }).cacaPilotoAutomatico && ms !== null && ms >= 0 && agoraMs > pilotoEm) {
        const i = pragas.findIndex((p, k) => !abatidas.current.has(k) && posicao(p, ms + 200) && posicao(p, ms));
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
        ms: ms !== null && ms >= 0 ? ms : null,
        pragas,
        abatidas: abatidas.current,
        quedas: quedas.current,
        agora: agoraMs,
        mira: souJogador ? mira.current : null,
        tiro: ultimoTiro.current,
      });
      if (agoraMs - ultimoRelogio > 250) {
        ultimoRelogio = agoraMs;
        setAgora(agoraMs);
      }
      id = requestAnimationFrame(quadro);
    };
    id = requestAnimationFrame(quadro);
    return () => cancelAnimationFrame(id);
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
            <span className="caca-municao" aria-label={t('Munição: {n}', { n: municao })}>
              {Array.from({ length: municao }, (_, k) => (
                <span key={k} className="caca-cenoura" aria-hidden="true" />
              ))}
            </span>
            <span className="golfe-tacadas">{t('Pontos: {n}', { n: pontos })}</span>
          </>
        )}
        {estado.fase === 'jogando' && <Relogio restante={restante} total={estado.duracaoMs} />}
      </div>
      <div className="golfe-moldura">
        <canvas
          ref={canvas}
          className={`golfe-tela caca-tela${souJogador ? ' caca-mirando' : ''}`}
          width={LARGURA}
          height={ALTURA}
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
        {pragas.map((p, i) => (
          <span
            key={i}
            className={`caca-marca ${p.tipo}${abatidas.current.has(i) ? ' abatida' : ms !== null && ms > p.t + p.vida ? ' fugiu' : ''}`}
          />
        ))}
      </div>
      {souJogador && estado.fase === 'preparando' && <p className="minijogo-situacao">{t('Mire e clique nas pragas antes que fujam. Cada tiro gasta uma cenoura.')}</p>}
      {souJogador && jogando && municao === 0 && <p className="minijogo-situacao">{t('Acabou a munição desta onda.')}</p>}
      {souJogador && <ComandosDoJogo itens={[{ teclas: ['mouse-clique'], toque: 'toque', rotulo: t('Atirar') }]} />}
    </div>
  );
}
