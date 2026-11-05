import { useEffect, useRef, useState, type ReactNode } from 'react';
import { estiloVisual } from './Graficos';
import { useT } from './i18n';
import { Relogio } from './Minijogo';
import type { Partida } from './minijogos';
import type { Xadrez3D, XadrezDaCena } from './xadrez3d/cena';

const JOGADA_MS = 90_000;
const DESENHO: Record<string, string> = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
const peca = (letra: string) => `${DESENHO[letra.toLowerCase()]}︎`;
const nomeDaCasa = (i: number) => `${'abcdefgh'[i % 8]}${8 - Math.floor(i / 8)}`;

/** A mesa do xadrez (server/src/minijogo-partida-de-xadrez.ts): a de duas pessoas, mais o tabuleiro e os lances da vez. */
export interface EstadoPartidaDeXadrez {
  fase: 'esperando' | 'jogando' | 'fim';
  jogadores: { userId: number; username: string }[];
  vez: 0 | 1;
  vencedor: 0 | 1 | 'empate' | null;
  motivo: 'jogo' | 'tempo' | 'desistiu' | null;
  casas: string[];
  brancas: 0 | 1;
  ultimo: { de: number; para: number } | null;
  xeque: boolean;
  fimPor: 'mate' | 'afogado' | 'repeticao' | 'cinquenta' | 'material' | null;
  /** Só para quem tem a vez; `promocao` no peão que chega à última fileira. */
  lances: { de: number; para: number; promocao?: true }[];
}

/**
 * A PARTIDA DE XADREZ NA MESA DE DUAS PESSOAS (a mesma de JogoDuelo.tsx). Cada um vê o tabuleiro do próprio lado; quem assiste,
 * do lado das brancas. Clica-se a peça e depois a casa (só as que o servidor mandou). Em 3D (xadrez3d/cena.ts) quando o estilo
 * visual é 3D; o tabuleiro de botões fica por baixo, para o teclado e o leitor de tela.
 */
export function JogoPartidaDeXadrez({
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
  const estado = partida as unknown as EstadoPartidaDeXadrez & Partida;
  const meuLado = estado.jogadores.findIndex((j) => j.userId === eu);
  const sentado = meuLado === 0 || meuLado === 1;
  const jogando = estado.fase === 'jogando';
  const minhaVez = jogando && meuLado === estado.vez;
  const nome = (lado: number) => estado.jogadores[lado]?.username ?? '?';
  const lances = minhaVez ? (estado.lances ?? []) : [];
  const girado = sentado && meuLado !== estado.brancas;
  const [escolhida, setEscolhida] = useState<number | null>(null);
  /** O peão que chega à última fileira: a pessoa escolhe a peça (pedido dele, 05/11/2026: "pode querer um cavalo"). */
  const [promovendo, setPromovendo] = useState<{ de: number; para: number } | null>(null);
  const assinatura = JSON.stringify(lances);
  useEffect(() => {
    setEscolhida(null);
    setPromovendo(null);
  }, [assinatura]);

  const origens = new Set(lances.map((l) => l.de));
  const destinos = escolhida === null ? [] : lances.filter((l) => l.de === escolhida).map((l) => l.para);
  const clicar = (i: number) => {
    if (!minhaVez) return;
    if (origens.has(i)) return setEscolhida(i === escolhida ? null : i);
    if (escolhida !== null && destinos.includes(i)) {
      if (lances.some((l) => l.de === escolhida && l.para === i && l.promocao)) return setPromovendo({ de: escolhida, para: i });
      agir({ tipo: 'jogada', de: escolhida, para: i });
      setEscolhida(null);
    }
  };
  // o rei em xeque: o da cor de quem tem a vez
  const corDaVez = estado.vez === estado.brancas ? 'K' : 'k';
  const xequeEm = jogando && estado.xeque ? estado.casas.indexOf(corDaVez) : null;

  let situacao: string;
  if (estado.fase === 'esperando') situacao = sentado ? t('Esperando alguém da sala sentar do outro lado…') : t('{nome} quer jogar. Sente do outro lado!', { nome: nome(0) });
  else if (jogando) situacao = (minhaVez ? t('Sua vez!') : t('Vez de {nome}.', { nome: nome(estado.vez) })) + (estado.xeque ? ' ' + t('Xeque!') : '');
  else if (estado.vencedor === 'empate') situacao = t('Empate!');
  else if (estado.vencedor === null) situacao = t('Ninguém sentou para jogar.');
  else {
    const perdedor = estado.vencedor === 0 ? 1 : 0;
    situacao =
      estado.motivo === 'tempo'
        ? t('{nome} demorou demais para jogar. {vencedor} venceu!', { nome: nome(perdedor), vencedor: nome(estado.vencedor) })
        : estado.motivo === 'desistiu'
          ? t('{nome} desistiu. {vencedor} venceu!', { nome: nome(perdedor), vencedor: nome(estado.vencedor) })
          : t('{nome} venceu!', { nome: nome(estado.vencedor) });
  }

  const ordem = Array.from({ length: 64 }, (_, i) => (girado ? 63 - i : i));
  const tabuleiro = (
    <div className="xadrez-tabuleiro">
      {ordem.map((i) => {
        const letra = estado.casas[i];
        const clara = (Math.floor(i / 8) + (i % 8)) % 2 === 0;
        const classes = [
          'xadrez-casa',
          clara ? 'clara' : 'escura',
          estado.ultimo && (estado.ultimo.de === i || estado.ultimo.para === i) && 'ultimo',
          escolhida === i && 'escolhida',
          origens.has(i) && 'minha',
          destinos.includes(i) && 'destino',
          xequeEm === i && 'xeque',
        ]
          .filter(Boolean)
          .join(' ');
        return (
          <button key={i} type="button" className={classes} aria-label={nomeDaCasa(i)} disabled={!minhaVez} onClick={() => clicar(i)}>
            {letra && <span className={`xadrez-peca ${letra === letra.toUpperCase() ? 'branca' : 'preta'}`}>{peca(letra)}</span>}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="duelo xadrez-partida">
      <div className="duelo-mesa">
        {[0, 1].map((lado) => (
          <span key={lado} className={`duelo-jogador${jogando && estado.vez === lado ? ' da-vez' : ''}${estado.vencedor === lado ? ' venceu' : ''}`}>
            <span className={`xadrez-peca ${lado === estado.brancas ? 'branca' : 'preta'}`} aria-hidden="true">
              {peca('k')}
            </span>
            {estado.jogadores[lado]?.username ?? '…'}
          </span>
        ))}
      </div>
      <Tabuleiro3D dados={{ casas: estado.casas, girado, escolhida, destinos, ultimo: estado.ultimo, xequeEm }} aoClicar={clicar} reserva={tabuleiro} />
      {promovendo && (
        <div className="xadrez-promocao" role="group" aria-label={t('Xadrez')}>
          {(
            [
              ['q', t('Dama')],
              ['r', t('Torre')],
              ['b', t('Bispo')],
              ['n', t('Cavalo')],
            ] as const
          ).map(([p, nomeDaPeca]) => (
            <button
              key={p}
              type="button"
              aria-label={nomeDaPeca}
              title={nomeDaPeca}
              onClick={() => {
                agir({ tipo: 'jogada', ...promovendo, promocao: p });
                setPromovendo(null);
                setEscolhida(null);
              }}
            >
              <span className={`xadrez-peca ${girado ? 'preta' : 'branca'}`}>{peca(p)}</span>
            </button>
          ))}
          <button type="button" className="xadrez-promocao-voltar" aria-label={t('Voltar')} onClick={() => setPromovendo(null)}>
            ✕
          </button>
        </div>
      )}
      <p className={`minijogo-situacao${minhaVez ? ' minha-vez' : ''}`} role="status">
        {situacao}
      </p>
      {jogando && !estado.solo && <Relogio restante={restante} total={JOGADA_MS} />}
      {estado.fase === 'esperando' && !sentado && (
        <button type="button" className="btn-primary duelo-sentar" onClick={() => agir({ tipo: 'sentar' })}>
          {t('Jogar')}
        </button>
      )}
      {jogando && sentado && (
        <button type="button" className="link-button duelo-desistir" onClick={() => agir({ tipo: 'desistir' })}>
          {t('Desistir')}
        </button>
      )}
    </div>
  );
}

/** O tabuleiro em 3D, com o de botões por baixo (à mostra até a cena ficar pronta, ou para sempre no estilo 2D). */
function Tabuleiro3D({ dados, aoClicar, reserva }: { dados: XadrezDaCena; aoClicar: (i: number) => void; reserva: ReactNode }) {
  const caixa = useRef<HTMLDivElement>(null);
  const cena = useRef<Xadrez3D | null>(null);
  const [estado, setEstado] = useState<'carregando' | 'pronta' | 'falhou'>(() => (estiloVisual() === '3d' && temWebGL() ? 'carregando' : 'falhou'));
  const clicar = useRef(aoClicar);
  clicar.current = aoClicar;
  const ultimo = useRef(dados);
  ultimo.current = dados;
  useEffect(() => {
    if (estado === 'falhou' || !caixa.current) return;
    let viva = true;
    let criada: Xadrez3D | null = null;
    import('./xadrez3d/cena')
      .then(async ({ Xadrez3D }) => {
        if (!viva || !caixa.current) return;
        criada = new Xadrez3D(caixa.current, (i) => clicar.current(i));
        criada.atualizar(ultimo.current);
        await criada.montar();
        if (!viva) return;
        cena.current = criada;
        setEstado('pronta');
      })
      .catch(() => {
        criada?.destruir();
        criada = null;
        if (viva) setEstado('falhou');
      });
    return () => {
      viva = false;
      criada?.destruir();
      cena.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado === 'falhou']);
  const chave = JSON.stringify(dados);
  useEffect(() => {
    cena.current?.atualizar(dados);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);
  if (estado === 'falhou') return <>{reserva}</>;
  return (
    <div className="xadrez-3d">
      <div ref={caixa} className={`xadrez-3d-caixa${estado === 'pronta' ? '' : ' escondida'}`} />
      <div className="naval-3d-grade-acessivel">{reserva}</div>
    </div>
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
