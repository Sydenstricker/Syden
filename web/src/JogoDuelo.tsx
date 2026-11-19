import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useT } from './i18n';
import { ComHistorico, ControlesDaMesa, type EstadoDaMesa } from './MesaComum';
import type { GomokuDaCena } from './mesa3d/gomoku';
import type { MancalaDaCena } from './mesa3d/mancala';
import { useCena3D } from './mesa3d/useCena3D';
import { Relogio } from './Minijogo';
import type { EstadoDuelo, Partida } from './minijogos';
import { tocar } from './somDosJogos';

const JOGADA_MS = 90_000;
/** Quanto cada semente leva para cair na casa seguinte, na animação da semeadura. */
const SEMENTE_MS = 160;

/** O que a mesa manda além do básico (19/11/2026): as variantes, as cores da troca e o estado de antes da semeadura. */
type Estado = EstadoDuelo &
  EstadoDaMesa & {
    cores?: [number, number];
    troca?: boolean;
    exato?: boolean;
    decidindo?: boolean;
    abertura?: number;
    antes?: number[] | null;
    quem?: 0 | 1 | null;
    variante?: 'kalah' | 'oware';
  };

/**
 * A MESA DE DUAS PESSOAS, COM A SALA ASSISTINDO (ver server/src/minijogo-tabuleiro.ts). Quem começou espera
 * do lado de cá; o primeiro da sala que apertar "Jogar" senta do outro lado. Quem não sentou vê o mesmo
 * tabuleiro, ao vivo — e palpita pela voz.
 */
export function JogoDuelo({
  jogo,
  estado: bruto,
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
  const estado = bruto as unknown as Estado & Partida;
  const meuLado = estado.jogadores.findIndex((j) => j.userId === eu);
  const jogando = estado.fase === 'jogando';
  const minhaVez = jogando && meuLado === estado.vez;
  const nome = (lado: number) => estado.jogadores[lado]?.username ?? '?';
  // a cor de cada lado no Cinco em linha (com a troca, ela pode mudar); na Mancala, o lado
  const corDoLado = (lado: number) => (estado.cores ? estado.cores[lado] - 1 : lado);
  const naAbertura = jogo === 'gomoku' && estado.troca === true && (estado.abertura ?? 3) < 3;
  const decidindo = jogo === 'gomoku' && estado.decidindo === true;

  let situacao: string;
  if (estado.fase === 'esperando') {
    situacao = meuLado >= 0 ? t('Esperando alguém da sala sentar do outro lado…') : t('{nome} quer jogar. Sente do outro lado!', { nome: nome(0) });
  } else if (jogando && decidindo) {
    situacao = minhaVez ? t('Escolha a sua cor.') : t('{nome} está escolhendo a cor.', { nome: nome(estado.vez) });
  } else if (jogando && naAbertura) {
    situacao = minhaVez ? t('Ponha as três pedras da abertura.') : t('Vez de {nome}.', { nome: nome(estado.vez) });
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
        ? t('{nome} demorou demais para jogar. {vencedor} venceu!', {
            nome: nome(perdedor),
            vencedor: nome(estado.vencedor),
          })
        : estado.motivo === 'desistiu'
          ? t('{nome} desistiu. {vencedor} venceu!', {
              nome: nome(perdedor),
              vencedor: nome(estado.vencedor),
            })
          : t('{nome} venceu!', { nome: nome(estado.vencedor) });
  }

  return (
    <div className={`duelo duelo-${jogo}`}>
      <div className="duelo-mesa">
        {[0, 1].map((lado) => (
          <span key={lado} className={`duelo-jogador${jogando && estado.vez === lado ? ' da-vez' : ''}${estado.vencedor === lado ? ' venceu' : ''}`}>
            <span className={`duelo-peca lado-${corDoLado(lado)}`} aria-hidden="true" />
            {estado.jogadores[lado]?.username ?? '…'}
          </span>
        ))}
      </div>

      <ComHistorico estado={estado}>
        {jogo === 'gomoku' ? (
          <TabuleiroGomoku estado={estado} podeJogar={minhaVez && !decidindo} jogar={(casa) => agir({ tipo: 'jogada', casa })} />
        ) : (
          <TabuleiroMancala estado={estado} meuLado={meuLado === 1 ? 1 : 0} podeJogar={minhaVez} jogar={(casa) => agir({ tipo: 'jogada', casa })} />
        )}
      </ComHistorico>

      {decidindo && minhaVez && (
        <div className="minijogo-acoes" role="group" aria-label={t('Escolha a sua cor.')}>
          <button type="button" className="btn-secondary" onClick={() => agir({ tipo: 'jogada', trocar: false })}>
            <span className="duelo-peca lado-1" aria-hidden="true" /> {t('Ficar com as claras')}
          </button>
          <button type="button" className="btn-secondary" onClick={() => agir({ tipo: 'jogada', trocar: true })}>
            <span className="duelo-peca lado-0" aria-hidden="true" /> {t('Trocar para as escuras')}
          </button>
        </div>
      )}

      <p className={`minijogo-situacao${minhaVez ? ' minha-vez' : ''}`} role="status">
        {situacao}
      </p>
      {/* no Solo, contra o computador, pensar não tem prazo; com o relógio de partida, ele é o prazo */}
      {jogando && !estado.solo && !estado.relogio && <Relogio restante={restante} total={JOGADA_MS} />}
      {estado.fase === 'esperando' && meuLado < 0 && (
        <button type="button" className="btn-primary duelo-sentar" onClick={() => agir({ tipo: 'sentar' })}>
          {t('Jogar')}
        </button>
      )}
      <ControlesDaMesa jogo={jogo} estado={estado} eu={eu} agir={agir} />
      {jogando && meuLado >= 0 && (
        <button type="button" className="link-button duelo-desistir" onClick={() => agir({ tipo: 'desistir' })}>
          {t('Desistir')}
        </button>
      )}
    </div>
  );
}

function TabuleiroGomoku({ estado, podeJogar, jogar }: { estado: Estado; podeJogar: boolean; jogar: (casa: number) => void }) {
  const lado = estado.lado ?? 15;
  const linha = new Set(estado.linha ?? []);
  const dados: GomokuDaCena = {
    lado,
    casas: estado.casas,
    ultima: estado.ultima,
    linha: estado.linha ?? [],
    clicaveis: podeJogar ? estado.casas.flatMap((c, i) => (c ? [] : [i])) : [],
  };
  return (
    <Em3D importar={importarGomoku} dados={dados} aoClicar={jogar}>
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
    </Em3D>
  );
}

const importarGomoku = () => import('./mesa3d/gomoku').then((m) => m.criarGomoku3D);
const importarMancala = () => import('./mesa3d/mancala').then((m) => m.criarMancala3D);

/**
 * O 3D por cima do 2D (19/11/2026), como nas Damas: o 2D aparece enquanto a cena carrega e fica para sempre sem WebGL; com a
 * cena pronta, ele continua por baixo só para o teclado e o leitor de tela.
 */
function Em3D<D>({
  importar,
  dados,
  aoClicar,
  children,
}: {
  importar: Parameters<typeof useCena3D<D>>[0];
  dados: D;
  aoClicar: (i: number) => void;
  children: ReactNode;
}) {
  const { caixa, estado } = useCena3D(importar, dados, aoClicar);
  if (estado === 'falhou') return <>{children}</>;
  return (
    <div className="mesa3d-tabuleiro">
      <div ref={caixa} className={`mesa3d-caixa${estado === 'pronta' ? '' : ' escondida'}`} />
      <div className="mesa3d-so-leitor">{children}</div>
    </div>
  );
}

/** As casas por onde as sementes passam, na ordem (a mesma regra do servidor: semear e semearOware). */
function caminhoDaSemeadura(antes: number[], casa: number, quem: 0 | 1, variante: 'kalah' | 'oware'): number[] {
  const depositoDoOutro = quem === 0 ? 13 : 6;
  const caminho: number[] = [];
  let i = casa;
  for (let mao = antes[casa]; mao > 0;) {
    i = (i + 1) % 14;
    if (variante === 'oware' ? i === 6 || i === 13 || i === casa : i === depositoDoOutro) continue;
    caminho.push(i);
    mao--;
  }
  return caminho;
}

/**
 * A SEMEADURA SEMENTE A SEMENTE (19/11/2026): com o estado de antes e a casa escolhida, a tela tira as sementes da casa e as põe
 * uma a uma no caminho; no fim, mostra o que o servidor decidiu (as capturas incluídas). Com "menos movimento", vai direto.
 */
function useSemeadura(estado: Estado): {
  casas: number[];
  destaque: number | null;
} {
  const [quadro, setQuadro] = useState<{
    casas: number[];
    destaque: number | null;
  } | null>(null);
  const visto = useRef<string | null>(null);
  const chave =
    estado.antes && estado.ultima !== null && estado.quem !== null && estado.quem !== undefined
      ? `${estado.ultima}:${estado.antes.join(',')}:${estado.casas.join(',')}`
      : null;
  useEffect(() => {
    if (!chave || chave === visto.current || !estado.antes) return;
    const primeira = visto.current === null;
    visto.current = chave;
    // a primeira vista (quem chega no meio) e quem prefere menos movimento: sem animação
    if (primeira || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const casas = estado.antes.slice();
    const origem = estado.ultima!;
    const caminho = caminhoDaSemeadura(casas, origem, estado.quem!, estado.variante ?? 'kalah');
    casas[origem] = 0;
    setQuadro({ casas: casas.slice(), destaque: origem });
    let k = 0;
    const id = setInterval(() => {
      if (k >= caminho.length) {
        clearInterval(id);
        setQuadro(null);
        return;
      }
      casas[caminho[k]]++;
      setQuadro({ casas: casas.slice(), destaque: caminho[k] });
      tocar('clique');
      k++;
    }, SEMENTE_MS);
    return () => {
      clearInterval(id);
      setQuadro(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);
  return quadro ?? { casas: estado.casas, destaque: null };
}

/**
 * A Mancala vista do seu lado: as suas casas embaixo, da esquerda para a direita, e o seu depósito à
 * direita (é para lá que as sementes andam). Quem assiste vê do lado de quem começou.
 */
function TabuleiroMancala({ estado, meuLado, podeJogar, jogar }: { estado: Estado; meuLado: 0 | 1; podeJogar: boolean; jogar: (casa: number) => void }) {
  const { casas, destaque } = useSemeadura(estado);
  const animando = destaque !== null;
  const minhas = meuLado === 0 ? [0, 1, 2, 3, 4, 5] : [7, 8, 9, 10, 11, 12];
  const dele = (meuLado === 0 ? [7, 8, 9, 10, 11, 12] : [0, 1, 2, 3, 4, 5]).reverse();
  const meuDeposito = meuLado === 0 ? 6 : 13;
  const depositoDele = meuLado === 0 ? 13 : 6;
  const casa = (i: number, clicavel: boolean) => (
    <button
      key={i}
      type="button"
      className={`mancala-casa${estado.ultima === i && !animando ? ' ultima' : ''}${destaque === i ? ' semeando' : ''}`}
      disabled={!clicavel || animando || casas[i] === 0}
      onClick={() => jogar(i)}
    >
      <Sementes n={casas[i]} />
      <span className="mancala-numero">{casas[i]}</span>
    </button>
  );
  const dados: MancalaDaCena = {
    casas,
    meuLado,
    destaque,
    ultima: estado.ultima,
    clicaveis: podeJogar && !animando ? minhas.filter((i) => casas[i] > 0) : [],
  };
  return (
    <Em3D importar={importarMancala} dados={dados} aoClicar={jogar}>
      <div className="mancala">
        <div className={`mancala-deposito${destaque === depositoDele ? ' semeando' : ''}`}>
          <Sementes n={casas[depositoDele]} />
          <span className="mancala-numero">{casas[depositoDele]}</span>
        </div>
        <div className="mancala-fileiras">
          <div className="mancala-fileira">{dele.map((i) => casa(i, false))}</div>
          <div className="mancala-fileira">{minhas.map((i) => casa(i, podeJogar))}</div>
        </div>
        <div className={`mancala-deposito meu${destaque === meuDeposito ? ' semeando' : ''}`}>
          <Sementes n={casas[meuDeposito]} />
          <span className="mancala-numero">{casas[meuDeposito]}</span>
        </div>
      </div>
    </Em3D>
  );
}

const CORES_DAS_SEMENTES = ['#e5484d', '#f2b84b', '#4f7df5', '#3fb27f', '#c86bd9'];

/** As sementes desenhadas (até 12; daí para cima, o número diz o resto). */
function Sementes({ n }: { n: number }) {
  return (
    <span className="mancala-sementes" aria-hidden="true">
      {Array.from({ length: Math.min(n, 12) }, (_, k) => (
        <span
          key={k}
          style={{
            background: CORES_DAS_SEMENTES[k % CORES_DAS_SEMENTES.length],
          }}
        />
      ))}
    </span>
  );
}
