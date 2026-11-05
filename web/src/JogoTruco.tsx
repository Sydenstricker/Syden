import { useState } from 'react';
import { useT } from './i18n';
import { Relogio } from './Minijogo';
import type { Partida } from './minijogos';
import type { TrucoDaCena } from './mesa3d/truco';
import { useCena3D } from './mesa3d/useCena3D';

const importarTruco = () => import('./mesa3d/truco').then((m) => m.criarTruco3D);

/**
 * O TRUCO PAULISTA (04/11/2026): a mesa de feltro, os lugares em volta (eu embaixo; em quatro, o parceiro em cima e os
 * adversários dos lados), as cartas desenhadas por código, a vira ao lado do monte, e os gritos (Truco! Seis! Nove! Doze!)
 * grandes no meio da mesa, que é o momento da graça. As regras e as cartas moram no servidor (server/src/minijogo-truco.ts):
 * cada um recebe só a própria mão.
 */

export type ResultadoDaRodada = 0 | 1 | 'empate';

export interface EstadoTruco {
  fase: 'mao-de-onze' | 'jogando' | 'truco' | 'rodada' | 'resultado' | 'fim';
  partidaId: string;
  lugares: { userId: number; username: string; lugar: number; time: 0 | 1; cartas: number; presente: boolean }[];
  meuLugar: number | null;
  meuTime: 0 | 1 | null;
  mao: string[];
  maoDoParceiro: string[] | null;
  vira: string;
  manilha: string;
  mesa: { lugar: number; carta: string | null; coberta: boolean }[];
  rodadas: ResultadoDaRodada[];
  valor: number;
  pedido: { lugar: number; userId: number; time: 0 | 1; valor: number } | null;
  vez: number | null;
  vezLugar: number | null;
  possoPedir: boolean;
  proximoValor: number | null;
  possoResponder: boolean;
  possoAumentar: number | null;
  possoCobrir: boolean;
  semTruco: boolean;
  onze: 0 | 1 | null;
  decidoOnze: boolean;
  pontos: [number, number];
  vencedor: 0 | 1 | null;
  interrompida: boolean;
  ultimo:
    | ({ id: number } & (
        | { tipo: 'rodada'; resultado: ResultadoDaRodada; lugar: number | null }
        | { tipo: 'mao'; time: 0 | 1 | null; pontos: number }
        | { tipo: 'correu' | 'onze-correu'; lugar: number | null; time: 0 | 1; pontos: number }
        | { tipo: 'onze-jogar'; lugar: number | null }
      ))
    | null;
}

const TEMPO_DA_DECISAO = 30_000;
const NAIPE: Record<string, string> = { o: '♦', e: '♠', c: '♥', p: '♣' };
const VERMELHO = new Set(['o', 'c']);
type Posicao = 'baixo' | 'direita' | 'cima' | 'esquerda';

function Carta({ carta, manilha, coberta, pequena, onClick, desligada }: { carta: string | null; manilha?: string; coberta?: boolean; pequena?: boolean; onClick?: () => void; desligada?: boolean }) {
  const classe = `truco-carta${pequena ? ' pequena' : ''}`;
  if (!carta) return <span className={`${classe} verso`} aria-hidden="true" />;
  const valor = carta.slice(0, -1);
  const naipe = carta.slice(-1);
  const face = (
    <>
      <span className="truco-carta-valor">{valor}</span>
      <span className="truco-carta-naipe">{NAIPE[naipe]}</span>
      {manilha === valor && <span className="truco-carta-manilha" aria-hidden="true" />}
    </>
  );
  const cor = VERMELHO.has(naipe) ? ' vermelha' : '';
  const virada = coberta ? ' coberta' : '';
  if (onClick)
    return (
      <button type="button" className={`${classe}${cor}${virada}`} onClick={onClick} disabled={desligada} aria-label={`${valor}${NAIPE[naipe]}`}>
        {face}
      </button>
    );
  return (
    <span className={`${classe}${cor}${virada}`} aria-label={`${valor}${NAIPE[naipe]}`}>
      {face}
    </span>
  );
}

export function JogoTruco({ estado: partida, eu, jogador, restante, agir }: { estado: Partida; eu: number; jogador: boolean; restante: number; agir: (corpo: Record<string, unknown>) => void }) {
  const t = useT();
  const estado = partida as unknown as EstadoTruco;
  const [coberta, setCoberta] = useState(false);
  const minhaVez3d = jogador && estado.fase === 'jogando' && estado.vez === eu;
  const mao3d = jogador && Array.isArray(estado.mao) ? estado.mao : [];
  // a mesa em 3D (mesa3d/truco.ts): as cartas na cena, e as de HTML só para o teclado e o leitor de tela
  const { caixa, estado: cena } = useCena3D<TrucoDaCena>(
    importarTruco,
    {
      n: Array.isArray(estado.lugares) ? estado.lugares.length : 2,
      base: estado.meuLugar ?? 0,
      lugares: Array.isArray(estado.lugares) ? estado.lugares.map((l) => ({ lugar: l.lugar, cartas: l.cartas })) : [],
      mao: mao3d,
      maoClicavel: minhaVez3d,
      manilha: estado.manilha,
      vira: estado.vira,
      mesa: Array.isArray(estado.mesa) ? estado.mesa : [],
    },
    (k) => {
      const carta = mao3d[k];
      if (carta && minhaVez3d) jogarCarta(carta);
    },
  );
  if (!Array.isArray(estado.lugares)) return null;
  const n = estado.lugares.length;
  const base = estado.meuLugar ?? 0;
  const nosso = estado.meuTime ?? 0;
  const posicaoDe = (lugar: number): Posicao => {
    const rel = (lugar - base + n) % n;
    if (n === 2) return rel === 0 ? 'baixo' : 'cima';
    return (['baixo', 'direita', 'cima', 'esquerda'] as const)[rel];
  };
  const nomeDe = (lugar: number | null) => (lugar === null ? '' : estado.lugares[lugar]?.username ?? '');
  const membros = (time: 0 | 1) => estado.lugares.filter((l) => l.time === time).map((l) => l.username);
  /** O nome do time: em quatro, "Nós" e "Eles" para quem joga; em dois, o nome da pessoa. */
  const nomeDoTime = (time: 0 | 1) => {
    if (n === 2 || estado.meuTime === null) return membros(time).join(' & ');
    return time === estado.meuTime ? t('Nós') : t('Eles');
  };
  const gritos: Record<number, string> = { 3: t('Truco!'), 6: t('Seis!'), 9: t('Nove!'), 12: t('Doze!') };
  const minhaVez = jogador && estado.fase === 'jogando' && estado.vez === eu;
  const outro = (1 - nosso) as 0 | 1;
  const fim = estado.fase === 'fim';

  const jogarCarta = (carta: string) => {
    agir({ tipo: 'jogar', carta, coberta: coberta && estado.possoCobrir });
    setCoberta(false);
  };

  const ultimo = estado.ultimo;
  const textoDoUltimo = (() => {
    if (!ultimo || (estado.fase !== 'resultado' && estado.fase !== 'rodada')) return null;
    if (ultimo.tipo === 'mao') return ultimo.time === null ? t('Ninguém marca.') : `${nomeDoTime(ultimo.time)} +${ultimo.pontos}`;
    if (ultimo.tipo === 'correu' || ultimo.tipo === 'onze-correu')
      return `${t('{nome} correu.', { nome: nomeDe(ultimo.lugar) })} ${nomeDoTime((1 - ultimo.time) as 0 | 1)} +${ultimo.pontos}`;
    return null;
  })();

  return (
    <div className="truco">
      <div className="truco-topo">
        <span className={`truco-placar time-${nosso}`}>
          <span className="truco-placar-nome">{nomeDoTime(nosso)}</span>
          <strong>
            {estado.pontos[nosso]} × {estado.pontos[outro]}
          </strong>
          <span className="truco-placar-nome">{nomeDoTime(outro)}</span>
        </span>
        <span className="truco-valor">{t('Valendo {n}', { n: estado.valor })}</span>
        <span className="truco-rodadas" aria-hidden="true">
          {[0, 1, 2].map((i) => {
            const r = estado.rodadas[i];
            const classe = r === undefined ? '' : r === 'empate' ? 'empate' : r === nosso ? 'nos' : 'eles';
            return <span key={i} className={`truco-rodada ${classe}`} />;
          })}
        </span>
      </div>

      <div className={`truco-mesa jogadores-${n}${cena === 'pronta' ? ' mesa3d-truco' : ''}`}>
        {cena !== 'falhou' && <div ref={caixa} className={`mesa3d-caixa${cena === 'pronta' ? '' : ' escondida'}`} />}
        {estado.lugares.map((l) => {
          const pos = posicaoDe(l.lugar);
          return (
            <div
              key={l.userId}
              className={`truco-lugar ${pos} time-${l.time === nosso ? 'nos' : 'eles'}${estado.vezLugar === l.lugar ? ' na-vez' : ''}${l.presente ? '' : ' ausente'}`}
            >
              <span className="truco-lugar-nome minijogo-nome">{l.username}</span>
              {pos !== 'baixo' && (
                <span className="truco-lugar-cartas">
                  {Array.from({ length: l.cartas }, (_, i) => (
                    <Carta key={i} carta={null} pequena />
                  ))}
                </span>
              )}
            </div>
          );
        })}

        <div className="truco-monte" aria-label={t('Vira')}>
          <span className="truco-carta pequena verso" aria-hidden="true" />
          <Carta carta={estado.vira} pequena />
        </div>

        <div className="truco-centro">
          {estado.mesa.map((m) => (
            <div key={m.lugar} className={`truco-jogada ${posicaoDe(m.lugar)}`}>
              <Carta carta={m.carta} manilha={estado.manilha} coberta={m.coberta} />
            </div>
          ))}
        </div>

        {estado.fase === 'truco' && estado.pedido && (
          <div className="truco-grito" aria-live="assertive">
            <span className="minijogo-nome">{nomeDe(estado.pedido.lugar)}</span>
            <strong>{gritos[estado.pedido.valor]}</strong>
          </div>
        )}
      </div>

      <div className="truco-acoes" aria-live="polite">
        {fim ? (
          <p className="minijogo-situacao">
            {estado.interrompida || estado.vencedor === null
              ? t('Faltou gente: a partida acabou antes do fim, sem troféus.')
              : t('{nome} venceu!', { nome: membros(estado.vencedor).join(' & ') })}
          </p>
        ) : (
          <>
            {textoDoUltimo && <p className="minijogo-situacao truco-ocorrido">{textoDoUltimo}</p>}

            {estado.fase === 'mao-de-onze' && (
              <>
                <p className="minijogo-situacao">{estado.decidoOnze ? t('Mão de onze: jogar valendo 3, ou correr e dar 1 ponto?') : t('Mão de onze: esperando a decisão.')}</p>
                {estado.maoDoParceiro && (
                  <div className="truco-parceiro">
                    <span>{t('Cartas do parceiro')}</span>
                    <span className="truco-parceiro-cartas">
                      {estado.maoDoParceiro.map((c) => (
                        <Carta key={c} carta={c} manilha={estado.manilha} pequena />
                      ))}
                    </span>
                  </div>
                )}
                {estado.decidoOnze && jogador && (
                  <div className="minijogo-acoes">
                    <button type="button" className="btn-primary" onClick={() => agir({ tipo: 'onze', jogar: true })}>
                      {t('Jogar')}
                    </button>
                    <button type="button" className="btn-secondary" onClick={() => agir({ tipo: 'onze', jogar: false })}>
                      {t('Correr')}
                    </button>
                  </div>
                )}
                <Relogio restante={restante} total={TEMPO_DA_DECISAO} />
              </>
            )}

            {estado.fase === 'jogando' && (
              <>
                <p className="minijogo-situacao">
                  {minhaVez ? t('Sua vez!') : t('Vez de {nome}.', { nome: nomeDe(estado.vezLugar) })}
                  {estado.semTruco && estado.onze === null && estado.valor === 1 && ` · ${t('Mão de ferro: sem truco.')}`}
                </p>
                {minhaVez && (estado.possoPedir || estado.possoCobrir) && (
                  <div className="minijogo-acoes">
                    {estado.possoPedir && estado.proximoValor !== null && (
                      <button type="button" className="btn-primary truco-gritar" onClick={() => agir({ tipo: 'truco' })}>
                        {gritos[estado.proximoValor]}
                      </button>
                    )}
                    {estado.possoCobrir && (
                      <label className="truco-cobrir">
                        <input type="checkbox" checked={coberta} onChange={(e) => setCoberta(e.target.checked)} />
                        {t('Jogar coberta')}
                      </label>
                    )}
                  </div>
                )}
                <Relogio restante={restante} total={TEMPO_DA_DECISAO} />
              </>
            )}

            {estado.fase === 'truco' && estado.pedido && (
              <>
                {estado.possoResponder && jogador ? (
                  <div className="minijogo-acoes">
                    <button type="button" className="btn-primary" onClick={() => agir({ tipo: 'aceitar' })}>
                      {t('Aceitar')}
                    </button>
                    <button type="button" className="btn-secondary" onClick={() => agir({ tipo: 'correr' })}>
                      {t('Correr')}
                    </button>
                    {estado.possoAumentar !== null && (
                      <button type="button" className="btn-primary truco-gritar" onClick={() => agir({ tipo: 'aumentar' })}>
                        {gritos[estado.possoAumentar]}
                      </button>
                    )}
                  </div>
                ) : (
                  <p className="minijogo-situacao">{t('Esperando a resposta.')}</p>
                )}
                <Relogio restante={restante} total={TEMPO_DA_DECISAO} />
              </>
            )}
          </>
        )}
      </div>

      {jogador && estado.mao.length > 0 && (
        <div className={`truco-mao${coberta && estado.possoCobrir ? ' cobrindo' : ''}${cena === 'pronta' ? ' mesa3d-truco-mao' : ''}`}>
          {estado.mao.map((c) => (
            <Carta key={c} carta={c} manilha={estado.manilha} onClick={() => jogarCarta(c)} desligada={!minhaVez} />
          ))}
        </div>
      )}
    </div>
  );
}
