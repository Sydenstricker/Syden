import { useEffect, useState, type ReactNode } from 'react';
import { useT } from './i18n';
import { Relogio } from './Minijogo';
import type { Partida } from './minijogos';
import type { DamasDaCena } from './mesa3d/damas';
import { useCena3D } from './mesa3d/useCena3D';

const JOGADA_MS = 90_000;
const COLUNAS = 'abcdefgh';

/** Um lance que o servidor gerou (server/src/minijogo-damas.ts): o site nunca refaz a regra, só escolhe da lista. */
export interface LanceDasDamas {
  de: number;
  caminho: number[];
  comidas: number[];
}

/** A mesa das Damas: o da mesa de duas pessoas, mais o tabuleiro e os lances de quem tem a vez. */
export interface EstadoDamas {
  fase: 'esperando' | 'jogando' | 'fim';
  jogadores: { userId: number; username: string }[];
  vez: 0 | 1;
  vencedor: 0 | 1 | 'empate' | null;
  motivo: 'jogo' | 'tempo' | 'desistiu' | null;
  /** 64 casas, linha 0 no alto (o lado das escuras): 0 vazia, 1 pedra clara, 2 dama clara, 3 pedra escura, 4 dama escura. */
  casas: number[];
  /** O lado da mesa que joga com as claras. */
  claras: 0 | 1;
  ultimo: LanceDasDamas | null;
  /** Quantas peças restam: [claras, escuras]. */
  restam: [number, number];
  /** Só para quem tem a vez; vazio para os outros e para quem assiste. */
  lances: LanceDasDamas[];
}

const mesmo = (a: number[], b: number[]) => a.length === b.length && a.every((x, k) => x === b[k]);

/**
 * AS DAMAS NA MESA DE DUAS PESSOAS (a mesma de JogoDuelo.tsx). Cada um vê o tabuleiro do próprio lado, com as suas peças
 * embaixo; quem assiste vê do lado das claras.
 *
 * O LANCE SE ESCOLHE CASA A CASA: clica-se a peça e depois a casa onde ela pousa; numa cadeia de capturas, cada pouso, até
 * só sobrar um lance possível — aí ele vai sozinho (a cadeia que só tem um caminho vai no primeiro clique). Assim, dois
 * lances que terminam na mesma casa comendo peças diferentes (raro, com a dama) se distinguem pelo caminho, sem texto novo.
 */
export function JogoDamas({
  estado: partida,
  eu,
  restante,
  agir,
}: {
  estado: Partida;
  eu: number;
  jogador: boolean;
  restante: number;
  agir: (corpo: Record<string, unknown>) => void;
}) {
  const t = useT();
  const estado = partida as unknown as EstadoDamas;
  const meuLado = estado.jogadores.findIndex((j) => j.userId === eu);
  const jogando = estado.fase === 'jogando';
  const minhaVez = jogando && meuLado === estado.vez;
  const nome = (lado: number) => estado.jogadores[lado]?.username ?? '?';
  const lances = minhaVez ? (estado.lances ?? []) : [];
  // Quem joga de escuras vê o tabuleiro girado: as peças dele embaixo.
  const girado = meuLado >= 0 && meuLado !== estado.claras;

  const [escolhida, setEscolhida] = useState<number | null>(null);
  const [prefixo, setPrefixo] = useState<number[]>([]);
  // A lista mudou (outro lance, outra vez): o que estava escolhido não vale mais.
  const assinatura = JSON.stringify(lances);
  useEffect(() => {
    setEscolhida(null);
    setPrefixo([]);
  }, [assinatura]);

  // Só uma peça pode andar (uma captura obrigatória, quase sempre): ela já vem escolhida.
  const origens = [...new Set(lances.map((l) => l.de))];
  const sel = escolhida ?? (origens.length === 1 ? origens[0] : null);
  const candidatos = sel === null ? [] : lances.filter((l) => l.de === sel && mesmo(l.caminho.slice(0, prefixo.length), prefixo));
  const proximos = new Set(candidatos.map((l) => l.caminho[prefixo.length]).filter((x) => x !== undefined));
  const aComer = new Set(candidatos.length ? candidatos[0].comidas.slice(0, prefixo.length) : []);
  const obrigatorias = new Set(lances.filter((l) => l.comidas.length > 0).map((l) => l.de));

  const enviar = (lance: LanceDasDamas) => {
    agir({ tipo: 'jogada', lance: lances.indexOf(lance), de: lance.de, caminho: lance.caminho });
    setEscolhida(null);
    setPrefixo([]);
  };

  const clicar = (i: number) => {
    if (sel !== null && proximos.has(i)) {
      const novo = [...prefixo, i];
      const restam = candidatos.filter((l) => l.caminho[prefixo.length] === i);
      if (restam.length === 1 || restam.every((l) => mesmo(l.caminho, restam[0].caminho)) || restam[0].caminho.length === novo.length) {
        enviar(restam[0]);
      } else {
        setPrefixo(novo);
      }
      return;
    }
    if (origens.includes(i)) {
      setEscolhida(i);
      setPrefixo([]);
      return;
    }
    setEscolhida(null);
    setPrefixo([]);
  };

  const ultimoCaminho = new Set(estado.ultimo ? [estado.ultimo.de, ...estado.ultimo.caminho] : []);
  const ultimasComidas = new Set(estado.ultimo?.comidas ?? []);

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

  const corDoLado = (lado: number) => (lado === estado.claras ? 'clara' : 'escura');

  return (
    <div className="duelo duelo-damas">
      <div className="duelo-mesa">
        {[0, 1].map((lado) => (
          <span key={lado} className={`duelo-jogador${jogando && estado.vez === lado ? ' da-vez' : ''}${estado.vencedor === lado ? ' venceu' : ''}`}>
            <span className={`duelo-peca ${corDoLado(lado)}`} aria-hidden="true" />
            {estado.jogadores[lado]?.username ?? '…'}
            {estado.fase !== 'esperando' && estado.restam && (
              <span className="damas-restam">{estado.restam[lado === estado.claras ? 0 : 1]}</span>
            )}
          </span>
        ))}
      </div>

      <TabuleiroDasDamas
        dados={{
          casas: estado.casas,
          girado,
          escolhida: sel,
          obrigatorias: minhaVez ? [...obrigatorias] : [],
          prefixo,
          destinos: [...proximos],
          aComer: [...aComer],
          clicaveis: minhaVez ? Array.from({ length: 64 }, (_, i) => i).filter((i) => (Math.floor(i / 8) + (i % 8)) % 2 === 1 && (origens.includes(i) || proximos.has(i) || sel !== null)) : [],
          ultimo: estado.ultimo,
        }}
        aoClicar={clicar}
        reserva={
          <div className="damas">
            {Array.from({ length: 64 }, (_, d) => {
              const i = girado ? 63 - d : d;
              const linha = Math.floor(i / 8);
              const coluna = i % 8;
              const escura = (linha + coluna) % 2 === 1;
              const peca = estado.casas[i] ?? 0;
              const classes = ['damas-casa', escura ? 'escura' : 'clara'];
              if (ultimoCaminho.has(i)) classes.push('ultimo');
              if (ultimasComidas.has(i) && !peca) classes.push('comida');
              if (sel === i) classes.push('escolhida');
              else if (minhaVez && obrigatorias.has(i)) classes.push('obrigatoria');
              if (prefixo.includes(i)) classes.push('no-caminho');
              if (proximos.has(i)) classes.push('destino');
              if (aComer.has(i)) classes.push('a-comer');
              const clicavel = minhaVez && (origens.includes(i) || proximos.has(i) || sel !== null);
              return (
                <button
                  key={i}
                  type="button"
                  className={classes.join(' ')}
                  disabled={!escura || !clicavel}
                  aria-label={`${COLUNAS[coluna]}${8 - linha}`}
                  aria-pressed={sel === i || undefined}
                  onClick={() => clicar(i)}
                >
                  {peca > 0 && <Peca peca={peca} />}
                </button>
              );
            })}
          </div>
        }
      />

      <p className={`minijogo-situacao${minhaVez ? ' minha-vez' : ''}`} role="status">
        {situacao}
      </p>
      {/* no Solo, contra o computador, pensar não tem prazo */}
      {jogando && !partida.solo && <Relogio restante={restante} total={JOGADA_MS} />}
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

const importarDamas = () => import('./mesa3d/damas').then((m) => m.criarDamas3D);

/** O tabuleiro em 3D (mesa3d/damas.ts), com o de botões por baixo: à mostra até a cena ficar pronta (ou para sempre, no estilo 2D). */
function TabuleiroDasDamas({ dados, aoClicar, reserva }: { dados: DamasDaCena; aoClicar: (i: number) => void; reserva: ReactNode }) {
  const { caixa, estado } = useCena3D(importarDamas, dados, aoClicar);
  if (estado === 'falhou') return <>{reserva}</>;
  return (
    <div className="mesa3d-tabuleiro">
      <div ref={caixa} className={`mesa3d-caixa${estado === 'pronta' ? '' : ' escondida'}`} />
      <div className={estado === 'pronta' ? 'mesa3d-so-leitor' : 'mesa3d-reserva'}>{reserva}</div>
    </div>
  );
}

/** A peça desenhada: um disco com os anéis do relevo; a dama leva a coroa. */
function Peca({ peca }: { peca: number }) {
  const clara = peca <= 2;
  const dama = peca === 2 || peca === 4;
  return (
    <span className={`damas-peca ${clara ? 'clara' : 'escura'}`} aria-hidden="true">
      {dama && (
        <svg viewBox="0 0 24 24" className="damas-coroa">
          <path d="M4 17 L3 7 L8.5 11 L12 5 L15.5 11 L21 7 L20 17 Z" />
          <rect x="4" y="18" width="16" height="2.4" rx="1" />
        </svg>
      )}
    </span>
  );
}
