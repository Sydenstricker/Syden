import { useEffect, useRef, useState } from 'react';
import { CORES_DOS_AVATARES } from './corrida/coresDosAvatares';
import { BotoesDosRobos, cadaUmPorSi } from './EscolhaDosRobos';
import { useT } from './i18n';
import { RodadaDaFesta } from './JogoFesta';
import { Placar, Relogio } from './Minijogo';
import type { EfeitoDaCasa, EstadoTabuleiro, Partida } from './minijogos';

/**
 * O TABULEIRO DA TURMA (03/11/2026, server/src/minijogo-tabuleiro-da-turma.ts): o tabuleiro de festa, só a mecânica, desenhado
 * aqui por código — uma volta de 30 casas em volta de uma horta, vista de cima, com cara de 16 bits. Cada um, na sua vez, pede
 * o dado (quem sorteia é o servidor) e a peça anda casa a casa na tela; depois que todo mundo andou, a turma joga um microjogo
 * da Festa (a mesma tela: RodadaDaFesta).
 */

// Os mesmos números do servidor.
const PASSO_MS = 280;
const TEMPO_DA_VEZ = 20_000;
const TEMPO_DA_LOJA = 12_000;

const CASA = 28;
const COLUNAS = 11;
const LINHAS = 6;
const BORDA = 4;

/** Onde fica cada casa (0 a 29): a fileira de cima da esquerda para a direita, desce pela direita, volta por baixo e sobe. */
export function lugarDaCasa(i: number): { x: number; y: number } {
  let c: number;
  let l: number;
  if (i <= 10) [c, l] = [i, 0];
  else if (i <= 14) [c, l] = [10, i - 10];
  else if (i <= 25) [c, l] = [25 - i, 5];
  else [c, l] = [0, 30 - i];
  return { x: BORDA + c * CASA, y: BORDA + l * CASA };
}

const COR_DA_CASA: Record<string, [string, string]> = {
  i: ['#e8d9c0', '#a89276'],
  '+': ['#8fb86a', '#5e8a44'],
  '-': ['#c46a52', '#8e4434'],
  '?': ['#8e7cc3', '#5f5290'],
};

/** As cores de quem não tem avatar pronto: uma por lugar na ordem. */
const CORES_SEM_AVATAR = ['#d9774f', '#7d93c4', '#7fae8a', '#c98aa8', '#e3b45a', '#5fa8a0', '#b8743f', '#9c86c0'];
const hex = ([r, g, b]: [number, number, number]) => 'rgb(' + [r, g, b].join(',') + ')';
export function coresDe(avatar: number | null, i: number) {
  const a = avatar !== null ? CORES_DOS_AVATARES[avatar] : undefined;
  return a ? { pelo: hex(a.pelo), roupa: hex(a.roupa) } : { pelo: '#e8dccb', roupa: CORES_SEM_AVATAR[i % CORES_SEM_AVATAR.length] };
}

/** A peça: um coelho de frente, de pixels grandes, com a roupa embaixo. */
export function Peca({ pelo, roupa, x, y, vez }: { pelo: string; roupa: string; x: number; y: number; vez: boolean }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <g className={vez ? 'tab-peca vez' : 'tab-peca'}>
      <rect x="-6" y="7" width="12" height="3" fill="#2e2620" opacity="0.35" />
      <rect x="-5" y="1" width="10" height="7" fill={roupa} />
      <rect x="-5" y="-6" width="10" height="8" fill={pelo} />
      <rect x="-4" y="-13" width="3" height="8" fill={pelo} />
      <rect x="1" y="-13" width="3" height="8" fill={pelo} />
      <rect x="-3" y="-12" width="1" height="5" fill="#d98a8a" />
      <rect x="2" y="-12" width="1" height="5" fill="#d98a8a" />
      <rect x="-3" y="-3" width="2" height="2" fill="#3a2e2a" />
      <rect x="1" y="-3" width="2" height="2" fill="#3a2e2a" />
      <rect x="-1" y="0" width="2" height="1" fill="#d98a8a" />
      </g>
    </g>
  );
}

/** A cenoura dourada (no tabuleiro e no placar). */
export function CenouraDourada({ tamanho = 16, x, y }: { tamanho?: number; x?: number; y?: number }) {
  return (
    <svg className="tab-dourada-icone" x={x} y={y} width={tamanho} height={tamanho} viewBox="0 0 16 16" aria-hidden="true" shapeRendering="crispEdges">
      <rect x="6" y="1" width="2" height="4" fill="#7fae5a" />
      <rect x="9" y="2" width="2" height="3" fill="#7fae5a" />
      <rect x="4" y="5" width="8" height="3" fill="#f2c46a" />
      <rect x="5" y="8" width="6" height="3" fill="#e3a640" />
      <rect x="6" y="11" width="4" height="2" fill="#d08e2c" />
      <rect x="7" y="13" width="2" height="2" fill="#b8741e" />
      <rect x="5" y="6" width="2" height="1" fill="#fff1c8" />
    </svg>
  );
}

/** A face do dado, com os pontos. */
export function Dado({ n, tamanho = 40 }: { n: number; tamanho?: number }) {
  const pontos: Record<number, [number, number][]> = {
    1: [[2, 2]],
    2: [[1, 1], [3, 3]],
    3: [[1, 1], [2, 2], [3, 3]],
    4: [[1, 1], [3, 1], [1, 3], [3, 3]],
    5: [[1, 1], [3, 1], [2, 2], [1, 3], [3, 3]],
    6: [[1, 1], [3, 1], [1, 2], [3, 2], [1, 3], [3, 3]],
  };
  return (
    <svg className="tab-dado" width={tamanho} height={tamanho} viewBox="0 0 20 20" aria-hidden="true" shapeRendering="crispEdges">
      <rect x="1" y="2" width="18" height="17" fill="#a89276" />
      <rect x="1" y="1" width="18" height="16" fill="#f3ead8" />
      {(pontos[n] ?? []).map(([c, l], i) => (
        <rect key={i} x={c * 5 - 1} y={l * 4 - 1} width="3" height="3" fill="#5a3a2a" />
      ))}
    </svg>
  );
}

/** O relógio da tela, a cada quadro, enquanto ligado. */
export function useAgora(ligado: boolean) {
  const [agora, setAgora] = useState(Date.now);
  useEffect(() => {
    if (!ligado) return;
    let id = 0;
    const passo = () => {
      setAgora(Date.now());
      id = requestAnimationFrame(passo);
    };
    id = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(id);
  }, [ligado]);
  return agora;
}

/** O desenho do tabuleiro: a horta no meio, a volta de casas, a dourada e as peças. */
function Tabuleiro({ estado, posDe }: { estado: EstadoTabuleiro; posDe: (userId: number) => number }) {
  const largura = BORDA * 2 + COLUNAS * CASA;
  const altura = BORDA * 2 + LINHAS * CASA;
  // quantas peças em cada casa, para não ficarem uma em cima da outra
  const porCasa = new Map<number, number[]>();
  estado.participantes.forEach((p) => porCasa.set(posDe(p.userId), [...(porCasa.get(posDe(p.userId)) ?? []), p.userId]));
  const deslocamento = (userId: number) => {
    const ids = porCasa.get(posDe(userId)) ?? [userId];
    const i = ids.indexOf(userId);
    if (ids.length === 1) return { dx: 0, dy: 0 };
    const col = i % 4;
    const lin = Math.floor(i / 4);
    return { dx: (col - (Math.min(ids.length, 4) - 1) / 2) * 6, dy: lin * 5 - 2 };
  };
  const dourada = lugarDaCasa(estado.dourada);
  return (
    <svg className="tab-tabuleiro" viewBox={`0 0 ${largura} ${altura}`} aria-hidden="true" shapeRendering="crispEdges">
      {/* a grama e a horta do meio */}
      <rect width={largura} height={altura} fill="#62804a" />
      <rect x={BORDA + CASA} y={BORDA + CASA} width={CASA * 9} height={CASA * 4} fill="#7a9a5a" />
      {Array.from({ length: 24 }, (_, i) => (
        <rect key={`g${i}`} x={BORDA + CASA + 6 + ((i * 37) % 244)} y={BORDA + CASA + 6 + ((i * 53) % 98)} width="2" height="2" fill="#8eae6a" />
      ))}
      {/* os canteiros de cenoura, à esquerda */}
      {[0, 1, 2].map((f) => (
        <g key={`c${f}`}>
          <rect x={BORDA + CASA + 10} y={BORDA + CASA + 12 + f * 28} width="84" height="12" fill="#8e6a52" />
          {Array.from({ length: 7 }, (_, k) => (
            <g key={k}>
              <rect x={BORDA + CASA + 14 + k * 12} y={BORDA + CASA + 8 + f * 28} width="2" height="5" fill="#7fae5a" />
              <rect x={BORDA + CASA + 17 + k * 12} y={BORDA + CASA + 9 + f * 28} width="2" height="4" fill="#6a9a4a" />
              <rect x={BORDA + CASA + 15 + k * 12} y={BORDA + CASA + 13 + f * 28} width="3" height="3" fill="#e07a2e" />
            </g>
          ))}
        </g>
      ))}
      {/* a toca, no meio */}
      <rect x={BORDA + CASA * 4.6} y={BORDA + CASA * 1.9} width="48" height="22" fill="#8e7a5a" />
      <rect x={BORDA + CASA * 4.6 + 4} y={BORDA + CASA * 1.9 - 4} width="40" height="6" fill="#a08a66" />
      <rect x={BORDA + CASA * 4.6 + 12} y={BORDA + CASA * 1.9 + 6} width="24" height="16" fill="#3a2c22" />
      <rect x={BORDA + CASA * 4.6 + 16} y={BORDA + CASA * 1.9 + 2} width="16" height="4" fill="#3a2c22" />
      {/* o lago, à direita */}
      <rect x={BORDA + CASA * 7} y={BORDA + CASA * 1.5} width="60" height="40" fill="#5f8fa8" />
      <rect x={BORDA + CASA * 7 - 4} y={BORDA + CASA * 1.5 + 6} width="68" height="28" fill="#5f8fa8" />
      <rect x={BORDA + CASA * 7 + 8} y={BORDA + CASA * 1.5 + 8} width="14" height="2" fill="#9cc2d2" />
      <rect x={BORDA + CASA * 7 + 30} y={BORDA + CASA * 1.5 + 22} width="18" height="2" fill="#9cc2d2" />
      {/* as casas */}
      {estado.casas.map((tipo, i) => {
        const { x, y } = lugarDaCasa(i);
        const [cor, sombra] = COR_DA_CASA[tipo] ?? COR_DA_CASA.i;
        const cx = x + CASA / 2;
        const cy = y + CASA / 2;
        return (
          <g key={i}>
            <rect x={x + 1} y={y + 1} width={CASA - 2} height={CASA - 2} fill={sombra} />
            <rect x={x + 2} y={y + 2} width={CASA - 4} height={CASA - 6} fill={cor} />
            {tipo === '+' && (
              <>
                <rect x={cx - 5} y={cy - 3} width="10" height="2" fill="#f3ead8" />
                <rect x={cx - 1} y={cy - 7} width="2" height="10" fill="#f3ead8" />
              </>
            )}
            {tipo === '-' && <rect x={cx - 5} y={cy - 3} width="10" height="2" fill="#f3ead8" />}
            {tipo === '?' && (
              <>
                <rect x={cx - 1} y={cy - 8} width="2" height="12" fill="#f3ead8" />
                <rect x={cx - 6} y={cy - 3} width="12" height="2" fill="#f3ead8" />
                <rect x={cx - 3} y={cy - 5} width="6" height="6" fill="#f2c46a" />
              </>
            )}
            {tipo === 'i' && (
              <>
                <rect x={cx - 6} y={cy - 9} width="2" height="14" fill="#5a3a2a" />
                <rect x={cx - 4} y={cy - 9} width="9" height="6" fill="#d9774f" />
              </>
            )}
          </g>
        );
      })}
      {/* a cenoura dourada, em cima da casa dela */}
      <g className="tab-dourada" transform={`translate(${dourada.x + 4} ${dourada.y + 1})`}>
        <rect x="0" y="0" width="20" height="22" fill="#f2c46a" opacity="0.35" />
        <CenouraDourada tamanho={20} x={0} y={0} />
      </g>
      {/* as peças: quem está na vez por cima */}
      {[...estado.participantes]
        .map((p, i) => ({ p, i }))
        .sort((a, b) => Number(a.p.userId === estado.vez) - Number(b.p.userId === estado.vez))
        .map(({ p, i }) => {
          const { x, y } = lugarDaCasa(posDe(p.userId));
          const { dx, dy } = deslocamento(p.userId);
          const cores = coresDe(p.avatar, i);
          return (
            <g key={p.userId} opacity={p.presente ? 1 : 0.45}>
              <Peca pelo={cores.pelo} roupa={cores.roupa} x={x + CASA / 2 + dx} y={y + CASA / 2 + 2 + dy} vez={p.userId === estado.vez} />
            </g>
          );
        })}
    </svg>
  );
}

/** O que a casa fez, numa frase (ou só o número). */
function textoDoEfeito(efeito: EfeitoDaCasa | null, nome: string, nomeDe: (id: number) => string, t: ReturnType<typeof useT>): string | null {
  if (!efeito) return null;
  switch (efeito.tipo) {
    case 'mais':
      return `+${efeito.valor} 🥕`;
    case 'menos':
      return efeito.valor ? `−${efeito.valor} 🥕` : null;
    case 'chuva':
      return t('Chuva na horta: todo mundo ganha {n} cenouras.', { n: efeito.valor });
    case 'achado':
      return t('{nome} achou {n} cenouras escondidas.', { nome, n: efeito.valor });
    case 'troca':
      return t('{nome} trocou de lugar com {outro}.', { nome, outro: nomeDe(efeito.com) });
    default:
      return null;
  }
}

export function JogoTabuleiro({
  estado,
  eu,
  jogador,
  restante,
  agir,
}: {
  estado: EstadoTabuleiro & Partida;
  eu: number;
  jogador: boolean;
  restante: number;
  agir: (corpo: Record<string, unknown>) => unknown;
}) {
  const t = useT();
  const nomeDe = (id: number) => estado.participantes.find((p) => p.userId === id)?.username ?? '';
  // O ANDAR NA TELA: a peça de quem jogou passa casa a casa pelo caminho, a partir de quando o estado chegou aqui.
  const andando = useRef<{ id: number; em: number } | null>(null);
  const [pedido, setPedido] = useState('');
  const ultimo = estado.ultimo;
  if (ultimo && (estado.fase === 'andando' || estado.fase === 'loja') && andando.current?.id !== ultimo.id) {
    andando.current = { id: ultimo.id, em: estado.recebidaEm };
  }
  const duracao = ultimo ? (ultimo.caminho.length - 1) * PASSO_MS : 0;
  const inicio = andando.current && ultimo && andando.current.id === ultimo.id ? andando.current.em : null;
  const animando = inicio !== null && Date.now() - inicio < duracao;
  const agora = useAgora(animando);
  // fora da animação, a peça já chegou (inclusive o andar de zero casas, o resto depois da loja)
  const passo = animando ? Math.floor((Math.max(agora, inicio) - inicio) / PASSO_MS) : Infinity;
  const chegou = !ultimo || passo >= ultimo.caminho.length - 1;
  // ENQUANTO A PEÇA ANDA, o tabuleiro é o de quando ela saiu: as contas, as outras peças e a dourada só mudam quando ela chega
  const antes = ultimo && !chegou ? new Map(ultimo.antes.pecas.map((p) => [p.userId, p])) : null;
  const vista: EstadoTabuleiro & Partida = antes
    ? {
        ...estado,
        dourada: ultimo!.antes.dourada,
        participantes: estado.participantes.map((p) => {
          const a = antes.get(p.userId);
          return a ? { ...p, pos: a.pos, cenouras: a.cenouras, douradas: a.douradas } : p;
        }),
      }
    : estado;
  const posDe = (userId: number) => {
    const p = vista.participantes.find((x) => x.userId === userId)!;
    if (ultimo && ultimo.userId === userId && !chegou) return ultimo.caminho[Math.max(0, passo)];
    return p.pos;
  };

  if (estado.terminada || estado.fase === 'fim') {
    // Só quem ficou até o fim tem posição e medalha (as mesmas dos troféus); quem saiu vem depois, sem posição. Na partida
    // interrompida, ninguém: nem medalha, nem "Fim de jogo!".
    // `saiu` vem por linha do servidor (revisão independente, 03/11/2026: sem pódio, a tela dizia "Saiu antes do fim" de todo
    // mundo, inclusive de quem nunca saiu). O tipo de minijogos.ts ainda não tem o campo: vai aqui até ele ganhar.
    const classificacao = estado.classificacao as (EstadoTabuleiro['classificacao'][number] & { saiu?: boolean })[];
    const valor = (l: { douradas: number; cenouras: number }) => `★ ${l.douradas} · 🥕 ${l.cenouras}`;
    const comPosicao = estado.interrompida ? [] : classificacao.filter((l) => l.posicao !== null);
    const semPosicao = classificacao.filter((l) => !comPosicao.includes(l));
    return (
      <div className="tabuleiro-jogo">
        {estado.interrompida && <p className="minijogo-situacao">{t('Faltou gente: a partida acabou antes do fim, sem troféus.')}</p>}
        {!estado.interrompida && comPosicao.length === 0 && (
          <p className="minijogo-situacao">{t('Menos de duas pessoas ficaram até o fim: desta vez, sem pódio.')}</p>
        )}
        {comPosicao.length > 0 && <Placar eu={eu} linhas={comPosicao.map((l) => ({ ...l, posicao: l.posicao ?? undefined, valor: valor(l) }))} />}
        {semPosicao.length > 0 && (
          <ol className="minijogo-placar tabuleiro-sem-posicao">
            {semPosicao.map((l) => (
              <li key={l.userId} className={l.userId === eu ? 'eu' : ''}>
                <span className="minijogo-medalha" aria-hidden="true" />
                <span className="minijogo-nome">{l.username}</span>
                {!estado.interrompida && l.saiu && <span className="tabuleiro-saiu">{t('Saiu antes do fim')}</span>}
                <span className="minijogo-pontos">{valor(l)}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    );
  }

  const minhaVez = jogador && estado.vez === eu;
  // o pedido já foi (o segundo clique não manda de novo, e a tela não pisca um erro)
  const chaveDaVez = `${estado.rodada}-${estado.vez}-${estado.fase}-${ultimo?.id ?? 0}`;
  const pedir = (corpo: Record<string, unknown>) => {
    if (pedido === chaveDaVez) return;
    setPedido(chaveDaVez);
    void agir(corpo);
  };
  const quemJoga = estado.vez !== null ? nomeDe(estado.vez) : '';
  const placar = (
    <ol className="tab-placar">
      {vista.participantes.map((p, i) => {
        const cores = coresDe(p.avatar, i);
        return (
          <li key={p.userId} className={`${p.userId === eu ? 'eu' : ''}${p.userId === estado.vez ? ' vez' : ''}${p.presente ? '' : ' fora'}`}>
            <span className="tab-placar-cor" style={{ background: cores.roupa, borderColor: cores.pelo }} aria-hidden="true" />
            <span className="minijogo-nome">{p.username}</span>
            <span className="tab-placar-conta">
              <CenouraDourada tamanho={14} /> {p.douradas}
            </span>
            <span className="tab-placar-conta">🥕 {p.cenouras}</span>
          </li>
        );
      })}
    </ol>
  );

  if (estado.fase === 'minijogo' && estado.mini) {
    return (
      <div className="tabuleiro-jogo">
        {placar}
        <div className={`festa festa-jogo-${estado.mini.microjogo}`}>
          <RodadaDaFesta
            key={`${estado.partidaId}-${estado.rodada}`}
            estado={{
              ...estado.mini,
              jogadores: estado.participantes.map((p) => ({ userId: p.userId, username: p.username })),
              recebidaEm: estado.recebidaEm,
              restanteMs: estado.restanteMs,
            }}
            eu={eu}
            jogador={jogador}
            restante={restante}
            agir={agir}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="tabuleiro-jogo">
      {placar}
      <Tabuleiro estado={vista} posDe={posDe} />
      <div className="tab-vez" aria-live="polite">
        {estado.fase === 'vez' && (
          <>
            <p className="minijogo-situacao">{minhaVez ? t('Sua vez!') : t('Vez de {nome}.', { nome: quemJoga })}</p>
            {minhaVez && (
              <button type="button" className="btn-primary tab-jogar" disabled={pedido === chaveDaVez} onClick={() => pedir({ tipo: 'dado' })}>
                <Dado n={5} tamanho={24} /> {t('Jogar o dado')}
              </button>
            )}
            <Relogio restante={restante} total={TEMPO_DA_VEZ} />
          </>
        )}
        {(estado.fase === 'andando' || estado.fase === 'loja') && ultimo && (
          <div className="tab-jogada">
            <Dado n={ultimo.dado} />
            <span className="minijogo-nome">{nomeDe(ultimo.userId)}</span>
            {estado.fase === 'andando' && chegou && (
              <>
                {/* comprou E parou numa casa que age: as duas coisas aconteceram, e a tela diz as duas */}
                {ultimo.comprou && <strong className="tab-efeito">{t('{nome} comprou a cenoura dourada!', { nome: nomeDe(ultimo.userId) })}</strong>}
                {textoDoEfeito(ultimo.efeito, nomeDe(ultimo.userId), nomeDe, t) && (
                  <strong className="tab-efeito">{textoDoEfeito(ultimo.efeito, nomeDe(ultimo.userId), nomeDe, t)}</strong>
                )}
              </>
            )}
          </div>
        )}
        {estado.fase === 'loja' && chegou && (
          <>
            {minhaVez ? (
              <>
                <p className="minijogo-situacao">
                  <CenouraDourada /> {t('Comprar a cenoura dourada por {preco} cenouras?', { preco: estado.preco })}
                </p>
                <div className="minijogo-acoes">
                  <button type="button" className="btn-primary" disabled={pedido === chaveDaVez} onClick={() => pedir({ tipo: 'comprar', sim: true })}>
                    {t('Comprar')}
                  </button>
                  <button type="button" className="btn-secondary" disabled={pedido === chaveDaVez} onClick={() => pedir({ tipo: 'comprar', sim: false })}>
                    {t('Agora não')}
                  </button>
                </div>
              </>
            ) : (
              <p className="minijogo-situacao">{t('{nome} chegou à cenoura dourada.', { nome: quemJoga })}</p>
            )}
            <Relogio restante={restante} total={TEMPO_DA_LOJA + duracao + PASSO_MS} />
          </>
        )}
      </div>
    </div>
  );
}

/** Antes do convite: quantas rodadas (5, 10 ou 15). */
export function EscolhaDasRodadas({
  solo = false,
  aoEscolher,
  aoVoltar,
}: {
  /** No Solo, antes das rodadas, quantos adversários do computador (pedido dele, 05/11/2026). */
  solo?: boolean;
  aoEscolher: (rodadas: number, robos?: number) => void;
  aoVoltar: () => void;
}) {
  const t = useT();
  const [robos, setRobos] = useState(3);
  return (
    <div className="tab-escolha">
      {solo && <BotoesDosRobos opcoes={[1, 2, 3, 4, 5].map(cadaUmPorSi)} escolhida={robos} aoEscolher={setRobos} />}
      <p className="minijogo-situacao">{t('Quantas rodadas?')}</p>
      <ul className="tab-rodadas">
        {[5, 10, 15].map((n) => (
          <li key={n}>
            <button type="button" className="tab-rodadas-botao" onClick={() => aoEscolher(n, solo ? robos : undefined)}>
              <span className="tab-rodadas-dados" aria-hidden="true">
                {Array.from({ length: n / 5 }, (_, i) => (
                  <Dado key={i} n={6 - i * 2} tamanho={26} />
                ))}
              </span>
              <strong>{n}</strong>
            </button>
          </li>
        ))}
      </ul>
      <div className="minijogo-acoes">
        <button type="button" className="btn-secondary" onClick={aoVoltar}>
          {t('Outros jogos')}
        </button>
      </div>
    </div>
  );
}
