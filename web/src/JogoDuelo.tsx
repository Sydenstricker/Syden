import { useT } from './i18n';
import { Relogio } from './Minijogo';
import type { EstadoDuelo, Partida } from './minijogos';

const JOGADA_MS = 90_000;

/**
 * A MESA DE DUAS PESSOAS, COM A SALA ASSISTINDO (ver server/src/minijogo-tabuleiro.ts). Quem começou espera
 * do lado de cá; o primeiro da sala que apertar "Jogar" senta do outro lado. Quem não sentou vê o mesmo
 * tabuleiro, ao vivo — e palpita pela voz.
 */
export function JogoDuelo({
  jogo,
  estado,
  eu,
  restante,
  agir,
}: {
  jogo: 'gomoku' | 'mancala';
  estado: EstadoDuelo & Partida;
  eu: number;
  restante: number;
  agir: (corpo: Record<string, unknown>) => void;
}) {
  const t = useT();
  const meuLado = estado.jogadores.findIndex((j) => j.userId === eu);
  const jogando = estado.fase === 'jogando';
  const minhaVez = jogando && meuLado === estado.vez;
  const nome = (lado: number) => estado.jogadores[lado]?.username ?? '?';

  let situacao: string;
  if (estado.fase === 'esperando') {
    situacao = meuLado >= 0 ? t('Esperando alguém da sala sentar do outro lado…') : t('{nome} quer jogar. Sente do outro lado!', { nome: nome(0) });
  } else if (jogando) {
    situacao = minhaVez ? t('Sua vez!') : t('Vez de {nome}.', { nome: nome(estado.vez) });
  } else if (estado.vencedor === 'empate') {
    situacao = t('Empate!');
  } else if (estado.vencedor === null) {
    situacao = t('Ninguém sentou para jogar.');
  } else {
    const perdedor = estado.vencedor === 0 ? 1 : 0;
    situacao =
      estado.motivo === 'tempo'
        ? t('{nome} demorou demais para jogar. {vencedor} venceu!', { nome: nome(perdedor), vencedor: nome(estado.vencedor) })
        : estado.motivo === 'desistiu'
          ? t('{nome} desistiu. {vencedor} venceu!', { nome: nome(perdedor), vencedor: nome(estado.vencedor) })
          : t('{nome} venceu!', { nome: nome(estado.vencedor) });
  }

  return (
    <div className={`duelo duelo-${jogo}`}>
      <div className="duelo-mesa">
        {[0, 1].map((lado) => (
          <span key={lado} className={`duelo-jogador${jogando && estado.vez === lado ? ' da-vez' : ''}${estado.vencedor === lado ? ' venceu' : ''}`}>
            <span className={`duelo-peca lado-${lado}`} aria-hidden="true" />
            {estado.jogadores[lado]?.username ?? '…'}
          </span>
        ))}
      </div>

      {jogo === 'gomoku' ? (
        <TabuleiroGomoku estado={estado} podeJogar={minhaVez} jogar={(casa) => agir({ tipo: 'jogada', casa })} />
      ) : (
        <TabuleiroMancala estado={estado} meuLado={meuLado === 1 ? 1 : 0} podeJogar={minhaVez} jogar={(casa) => agir({ tipo: 'jogada', casa })} />
      )}

      <p className={`minijogo-situacao${minhaVez ? ' minha-vez' : ''}`} role="status">
        {situacao}
      </p>
      {jogando && <Relogio restante={restante} total={JOGADA_MS} />}
      {estado.fase === 'esperando' && meuLado < 0 && (
        <button type="button" className="btn-primary duelo-sentar" onClick={() => agir({ tipo: 'sentar' })}>
          {t('Jogar')}
        </button>
      )}
      {jogando && meuLado >= 0 && (
        <button type="button" className="link-button duelo-desistir" onClick={() => agir({ tipo: 'desistir' })}>
          {t('Desistir')}
        </button>
      )}
    </div>
  );
}

function TabuleiroGomoku({ estado, podeJogar, jogar }: { estado: EstadoDuelo; podeJogar: boolean; jogar: (casa: number) => void }) {
  const lado = estado.lado ?? 15;
  const linha = new Set(estado.linha ?? []);
  return (
    <div className="gomoku" style={{ gridTemplateColumns: `repeat(${lado}, 1fr)` }}>
      {estado.casas.map((cor, i) => (
        <button
          key={i}
          type="button"
          className={`gomoku-casa${cor ? ` pedra lado-${cor - 1}` : ''}${estado.ultima === i ? ' ultima' : ''}${linha.has(i) ? ' na-linha' : ''}`}
          disabled={!podeJogar || cor !== 0}
          aria-label={`${Math.floor(i / lado) + 1}, ${(i % lado) + 1}`}
          onClick={() => jogar(i)}
        />
      ))}
    </div>
  );
}

/**
 * A Mancala vista do seu lado: as suas casas embaixo, da esquerda para a direita, e o seu depósito à
 * direita (é para lá que as sementes andam). Quem assiste vê do lado de quem começou.
 */
function TabuleiroMancala({
  estado,
  meuLado,
  podeJogar,
  jogar,
}: {
  estado: EstadoDuelo;
  meuLado: 0 | 1;
  podeJogar: boolean;
  jogar: (casa: number) => void;
}) {
  const minhas = meuLado === 0 ? [0, 1, 2, 3, 4, 5] : [7, 8, 9, 10, 11, 12];
  const dele = (meuLado === 0 ? [7, 8, 9, 10, 11, 12] : [0, 1, 2, 3, 4, 5]).reverse();
  const meuDeposito = meuLado === 0 ? 6 : 13;
  const depositoDele = meuLado === 0 ? 13 : 6;
  const casa = (i: number, clicavel: boolean) => (
    <button
      key={i}
      type="button"
      className={`mancala-casa${estado.ultima === i ? ' ultima' : ''}`}
      disabled={!clicavel || estado.casas[i] === 0}
      onClick={() => jogar(i)}
    >
      <Sementes n={estado.casas[i]} />
      <span className="mancala-numero">{estado.casas[i]}</span>
    </button>
  );
  return (
    <div className="mancala">
      <div className="mancala-deposito">
        <Sementes n={estado.casas[depositoDele]} />
        <span className="mancala-numero">{estado.casas[depositoDele]}</span>
      </div>
      <div className="mancala-fileiras">
        <div className="mancala-fileira">{dele.map((i) => casa(i, false))}</div>
        <div className="mancala-fileira">{minhas.map((i) => casa(i, podeJogar))}</div>
      </div>
      <div className="mancala-deposito meu">
        <Sementes n={estado.casas[meuDeposito]} />
        <span className="mancala-numero">{estado.casas[meuDeposito]}</span>
      </div>
    </div>
  );
}

const CORES_DAS_SEMENTES = ['#e5484d', '#f2b84b', '#4f7df5', '#3fb27f', '#c86bd9'];

/** As sementes desenhadas (até 12; daí para cima, o número diz o resto). */
function Sementes({ n }: { n: number }) {
  return (
    <span className="mancala-sementes" aria-hidden="true">
      {Array.from({ length: Math.min(n, 12) }, (_, k) => (
        <span key={k} style={{ background: CORES_DAS_SEMENTES[k % CORES_DAS_SEMENTES.length] }} />
      ))}
    </span>
  );
}
