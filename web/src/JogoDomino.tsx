import { useState } from 'react';
import { useT } from './i18n';
import { Relogio } from './Minijogo';
import type { Partida } from './minijogos';

/**
 * O DOMINÓ (04/11/2026, server/src/minijogo-domino.ts): o duplo-seis de sempre, de 2 a 4 (com 4, em duplas). As pedras são
 * desenhadas aqui por código (brancas, os pontos numa grade de 3 × 3, as duplas atravessadas como na mesa de verdade), e a
 * corrente QUEBRA EM LINHAS para caber no painel. O servidor decide tudo — inclusive quais pedras servem e onde — e a tela
 * só mostra e pede. Quem não pode jogar nem comprar passa sozinho, pelo servidor: não há botão de passar.
 */

// Os mesmos números do servidor.
const TEMPO_DA_VEZ = 30_000;
const TEMPO_DO_RESULTADO = 6_000;

export type PedraDoDomino = [number, number];
export type PontaDoDomino = 'esquerda' | 'direita';

export type LanceDoDomino =
  | { id: number; tipo: 'jogou'; userId: number; pedra: PedraDoDomino; ponta: PontaDoDomino | null; sozinho: boolean }
  | { id: number; tipo: 'comprou'; userId: number; sozinho: boolean }
  | { id: number; tipo: 'passou'; userId: number }
  | { id: number; tipo: 'bateu'; userId: number }
  | { id: number; tipo: 'trancado' };

export interface EstadoDomino {
  fase: 'jogando' | 'resultado' | 'fim';
  partidaId: string;
  duplas: boolean;
  alvo: number;
  mao: number;
  lugares: { userId: number; username: string; lado: number; pedras: number; presente: boolean }[];
  minhaMao: PedraDoDomino[];
  mesa: PedraDoDomino[];
  pontas: { esquerda: number; direita: number } | null;
  dorme: number;
  vez: number | null;
  obrigatoria: PedraDoDomino | null;
  jogaveis: { pedra: PedraDoDomino; pontas: (PontaDoDomino | null)[] }[];
  devoComprar: boolean;
  possoPassar: boolean;
  placar: { lado: number; membros: number[]; pontos: number }[];
  ultimo: LanceDoDomino | null;
  historico: LanceDoDomino[];
  resultado: {
    tipo: 'batida' | 'trancado';
    userId: number | null;
    lado: number | null;
    pontos: number;
    maos: { userId: number; pedras: PedraDoDomino[]; soma: number }[];
  } | null;
  vencedor: { lado: number; membros: number[] } | null;
  interrompida: boolean;
}

/** Onde ficam os pontos de cada número, na grade de 3 × 3 (coluna, linha), com a metade em pé. */
const PONTOS: Record<number, [number, number][]> = {
  0: [],
  1: [[1, 1]],
  2: [
    [0, 0],
    [2, 2],
  ],
  3: [
    [0, 0],
    [1, 1],
    [2, 2],
  ],
  4: [
    [0, 0],
    [2, 0],
    [0, 2],
    [2, 2],
  ],
  5: [
    [0, 0],
    [2, 0],
    [1, 1],
    [0, 2],
    [2, 2],
  ],
  6: [
    [0, 0],
    [0, 1],
    [0, 2],
    [2, 0],
    [2, 1],
    [2, 2],
  ],
};

/** Uma metade da pedra (um quadrado de lado 1), em (x, y); deitada, a grade gira (o 6 vira duas fileiras de três). */
function Metade({ n, x, y, deitada }: { n: number; x: number; y: number; deitada: boolean }) {
  return (
    <>
      {(PONTOS[n] ?? []).map(([c, l], i) => {
        const [cx, cy] = deitada ? [l, c] : [c, l];
        return <circle key={i} cx={x + 0.22 + cx * 0.28} cy={y + 0.22 + cy * 0.28} r={0.085} className="dom-ponto" />;
      })}
    </>
  );
}

/** Uma pedra: deitada, `a` à esquerda e `b` à direita; em pé, `a` em cima. `u` é o lado de cada metade, em px. */
export function PedraDesenhada({ a, b, deitada, u }: { a: number; b: number; deitada: boolean; u: number }) {
  const [w, h] = deitada ? [2, 1] : [1, 2];
  return (
    <svg className="dom-pedra-svg" width={w * u} height={h * u} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <rect x={0.03} y={0.03} width={w - 0.06} height={h - 0.06} rx={0.12} className="dom-pedra-fundo" />
      {deitada ? (
        <line x1={1} y1={0.14} x2={1} y2={0.86} className="dom-pedra-risco" />
      ) : (
        <line x1={0.14} y1={1} x2={0.86} y2={1} className="dom-pedra-risco" />
      )}
      <Metade n={a} x={0} y={0} deitada={deitada} />
      <Metade n={b} x={deitada ? 1 : 0} y={deitada ? 0 : 1} deitada={deitada} />
    </svg>
  );
}

const mesma = (p: PedraDoDomino, q: PedraDoDomino) => (p[0] === q[0] && p[1] === q[1]) || (p[0] === q[1] && p[1] === q[0]);
const rotulo = (p: PedraDoDomino) => `${p[0]}-${p[1]}`;

export function JogoDomino({ estado: bruto, eu, jogador, restante, agir }: { estado: Partida; eu: number; jogador: boolean; restante: number; agir: (corpo: Record<string, unknown>) => void }) {
  const t = useT();
  const estado = bruto as unknown as EstadoDomino;
  /** A pedra que serve nas duas pontas, esperando a escolha do lado. */
  const [escolhida, setEscolhida] = useState<PedraDoDomino | null>(null);

  const nomeDe = (id: number) => estado.lugares.find((l) => l.userId === id)?.username ?? '';
  const meu = estado.lugares.find((l) => l.userId === eu);
  const nomeDoLado = (lado: number) => {
    const membros = estado.placar.find((p) => p.lado === lado)?.membros ?? [];
    return membros.length === 2 ? t('{nome} e {outro}', { nome: nomeDe(membros[0]), outro: nomeDe(membros[1]) }) : nomeDe(membros[0] ?? 0);
  };
  const minhaVez = estado.fase === 'jogando' && estado.vez === eu && jogador;

  // os outros, a partir de quem joga depois de mim (a ordem da mesa)
  const meuLugar = estado.lugares.findIndex((l) => l.userId === eu);
  const outros =
    meuLugar >= 0 ? [...estado.lugares.slice(meuLugar + 1), ...estado.lugares.slice(0, meuLugar)] : estado.lugares;

  const jogar = (pedra: PedraDoDomino, ponta?: PontaDoDomino) => {
    setEscolhida(null);
    agir({ tipo: 'jogar', pedra, ...(ponta ? { ponta } : {}) });
  };
  const tocar = (pedra: PedraDoDomino) => {
    const j = estado.jogaveis.find((x) => mesma(x.pedra, pedra));
    if (!minhaVez || !j) return;
    if (j.pontas.length === 2) return setEscolhida(escolhida && mesma(escolhida, pedra) ? null : pedra);
    jogar(pedra, j.pontas[0] ?? undefined);
  };

  const textoDoLance = (l: LanceDoDomino) => {
    switch (l.tipo) {
      case 'jogou':
        return t('{nome} jogou {pedra}.', { nome: nomeDe(l.userId), pedra: rotulo(l.pedra) });
      case 'comprou':
        return t('{nome} comprou uma pedra.', { nome: nomeDe(l.userId) });
      case 'passou':
        return t('{nome} passou.', { nome: nomeDe(l.userId) });
      case 'bateu':
        return t('{nome} bateu!', { nome: nomeDe(l.userId) });
      default:
        return t('Jogo trancado!');
    }
  };

  const r = estado.resultado;
  const aberto = estado.fase !== 'jogando' && r;

  return (
    <div className="domino-jogo">
      <div className="dom-topo">
        <ol className="dom-placar" aria-label={t('Placar')}>
          {estado.placar.map((p) => (
            <li key={p.lado} className={p.membros.includes(eu) ? 'eu' : ''}>
              <span className="minijogo-nome">{nomeDoLado(p.lado)}</span>
              <strong>{p.pontos}</strong>
            </li>
          ))}
        </ol>
        <span className="dom-alvo">
          {t('Até {n} pontos', { n: estado.alvo })}
          {!estado.duplas && ` · ${t('Dorme: {n}', { n: estado.dorme })}`}
        </span>
      </div>

      <ul className="dom-outros">
        {outros.map((l) => (
          <li key={l.userId} className={`dom-outro${estado.vez === l.userId ? ' na-vez' : ''}${l.presente ? '' : ' ausente'}`}>
            <span className="minijogo-nome">{l.username}</span>
            {estado.duplas && meu && l.lado === meu.lado && <span className="dom-dupla">{t('Sua dupla')}</span>}
            <span className="dom-costas" aria-label={String(l.pedras)}>
              {Array.from({ length: l.pedras }, (_, i) => (
                <span key={i} className="dom-costa" />
              ))}
            </span>
          </li>
        ))}
      </ul>

      <div className="dom-mesa" dir="ltr" role="img" aria-label={estado.mesa.map(rotulo).join(' · ') || t('Dominó')}>
        {estado.mesa.map((p, i) => {
          const dupla = p[0] === p[1];
          const ponta = i === 0 ? ' ponta-esquerda' : '';
          const ponta2 = i === estado.mesa.length - 1 ? ' ponta-direita' : '';
          return (
            <span key={i} className={`dom-na-mesa${ponta}${ponta2}`}>
              <PedraDesenhada a={p[0]} b={p[1]} deitada={!dupla} u={18} />
            </span>
          );
        })}
      </div>

      {estado.fase === 'jogando' && (
        <div className="dom-vez" aria-live="polite">
          <p className="minijogo-situacao">{minhaVez ? t('Sua vez!') : t('Vez de {nome}.', { nome: nomeDe(estado.vez ?? 0) })}</p>
          {minhaVez && estado.devoComprar && (
            <div className="minijogo-acoes">
              <span>{t('Nenhuma pedra serve: compre.')}</span>
              <button type="button" className="btn-primary" onClick={() => agir({ tipo: 'comprar' })}>
                {t('Comprar')}
              </button>
            </div>
          )}
          <Relogio restante={restante} total={TEMPO_DA_VEZ} />
          <ol className="dom-lances">
            {[...estado.historico]
              .reverse()
              .slice(0, 3)
              .map((l) => (
                <li key={l.id}>{textoDoLance(l)}</li>
              ))}
          </ol>
        </div>
      )}

      {aberto && (
        <div className="dom-resultado" aria-live="polite">
          <p className="minijogo-situacao">{r.tipo === 'batida' && r.userId !== null ? t('{nome} bateu!', { nome: nomeDe(r.userId) }) : t('Jogo trancado!')}</p>
          <p className="dom-marcou">
            {r.lado === null ? t('Empate!') : `${nomeDoLado(r.lado)}: ${t('+{n} pontos', { n: r.pontos })}`}
          </p>
          <ul className="dom-maos">
            {r.maos.map((m) => (
              <li key={m.userId}>
                <span className="minijogo-nome">{nomeDe(m.userId)}</span>
                <span className="dom-mao-aberta" dir="ltr">
                  {m.pedras.map((p, i) => (
                    <PedraDesenhada key={i} a={p[0]} b={p[1]} deitada={false} u={11} />
                  ))}
                </span>
                <strong>{m.soma}</strong>
              </li>
            ))}
          </ul>
          {estado.fase === 'resultado' && <Relogio restante={restante} total={TEMPO_DO_RESULTADO} />}
        </div>
      )}

      {estado.fase === 'fim' && estado.vencedor && (
        <p className="dom-vencedor">
          {estado.vencedor.membros.length === 2
            ? t('{nome} e {outro} venceram!', { nome: nomeDe(estado.vencedor.membros[0]), outro: nomeDe(estado.vencedor.membros[1]) })
            : t('{nome} venceu!', { nome: nomeDe(estado.vencedor.membros[0]) })}
        </p>
      )}

      {jogador && estado.minhaMao.length > 0 && (
        <div className="dom-minha-mao" dir="ltr">
          {estado.minhaMao.map((p) => {
            const j = minhaVez ? estado.jogaveis.find((x) => mesma(x.pedra, p)) : undefined;
            const aberta = escolhida && mesma(escolhida, p);
            return (
              <span key={rotulo(p)} className="dom-na-mao">
                <button
                  type="button"
                  className={`dom-pedra-botao${j ? ' serve' : ''}${aberta ? ' escolhida' : ''}`}
                  disabled={!j}
                  aria-label={rotulo(p)}
                  onClick={() => tocar(p)}
                >
                  <PedraDesenhada a={p[0]} b={p[1]} deitada={false} u={22} />
                </button>
                {aberta && (
                  <span className="dom-lados">
                    <button type="button" className="btn-secondary" aria-label={t('Jogar na ponta esquerda')} onClick={() => jogar(p, 'esquerda')}>
                      ←
                    </button>
                    <button type="button" className="btn-secondary" aria-label={t('Jogar na ponta direita')} onClick={() => jogar(p, 'direita')}>
                      →
                    </button>
                  </span>
                )}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
