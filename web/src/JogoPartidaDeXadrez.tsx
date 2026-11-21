import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { temWebGL } from './temWebGL';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useT } from './i18n';
import { ControlesDaMesa, ComHistorico, type EstadoDaMesa } from './MesaComum';
import { Relogio } from './Minijogo';
import type { Partida } from './minijogos';
import type { Xadrez3D, XadrezDaCena } from './xadrez3d/cena';

const JOGADA_MS = 90_000;
const DESENHO: Record<string, string> = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
const peca = (letra: string) => `${DESENHO[letra.toLowerCase()]}︎`;
const nomeDaCasa = (i: number) => `${'abcdefgh'[i % 8]}${8 - Math.floor(i / 8)}`;

/** As 64 casas de um FEN (só o tabuleiro), como as do servidor: '' vazia, maiúscula branca, minúscula preta, linha 0 no alto. */
export function casasDoFen(fen: string): string[] {
  const casas: string[] = [];
  for (const fileira of fen.split(' ')[0].split('/')) {
    for (const c of fileira) {
      if (/\d/.test(c)) for (let k = 0; k < Number(c); k++) casas.push('');
      else casas.push(c);
    }
  }
  return casas;
}

/** A mesa do xadrez (server/src/minijogo-partida-de-xadrez.ts): a de duas pessoas, mais o tabuleiro e os lances da vez. */
export interface EstadoPartidaDeXadrez {
  fase: 'esperando' | 'jogando' | 'fim';
  jogadores: { userId: number; username: string }[];
  vez: 0 | 1;
  vencedor: 0 | 1 | 'empate' | null;
  motivo: 'jogo' | 'tempo' | 'desistiu' | 'acordo' | null;
  casas: string[];
  /** As peças que saíram, pela cor de quem as perdeu (19/11/2026). */
  capturadas?: { brancas: string[]; pretas: string[] };
  brancas: 0 | 1;
  ultimo: { de: number; para: number } | null;
  xeque: boolean;
  fimPor: 'mate' | 'afogado' | 'repeticao' | 'cinquenta' | 'material' | null;
  /** Só para quem tem a vez; `promocao` no peão que chega à última fileira. */
  lances: { de: number; para: number; promocao?: true }[];
  /** O final de treino desta partida (21/11/2026, só no Solo), o recorde dele e o resultado no fim. */
  final?: 'dama' | 'torre' | 'bispos' | 'peao' | null;
  recordeDoFinal?: number | null;
  resultadoDoFinal?: { lances: number; antes: number | null; novo: boolean | null; voltou?: boolean } | null;
  /** A revisão (21/11/2026), só no fim: a posição depois de cada lance (o primeiro é a inicial) e o de-para de cada um. */
  revisao?: { fens: string[]; lances: { de: number; para: number }[] };
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

  // A REVISÃO (21/11/2026): no fim, as setas andam pela partida, lance a lance. null: a posição final.
  const revisao = estado.fase === 'fim' ? estado.revisao : undefined;
  const totalDaRevisao = revisao ? revisao.fens.length - 1 : 0;
  const [passo, setPasso] = useState<number | null>(null);
  useEffect(() => setPasso(null), [totalDaRevisao]);
  const noPasso = passo ?? totalDaRevisao;
  const revendo = !!revisao && noPasso < totalDaRevisao;
  const casas = revendo ? casasDoFen(revisao!.fens[noPasso]) : estado.casas;
  const ultimoVisto = revendo ? (noPasso > 0 ? revisao!.lances[noPasso - 1] : null) : estado.ultimo;
  const irPara = (n: number) => setPasso(Math.max(0, Math.min(totalDaRevisao, n)));
  const irParaAgora = useRef(irPara);
  irParaAgora.current = irPara;
  const passoAgora = useRef(noPasso);
  passoAgora.current = noPasso;
  useEffect(() => {
    if (!revisao) return;
    // as setas do teclado andam pela revisão (fora de um campo de texto)
    const tecla = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement | null;
      if (alvo && (alvo.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(alvo.tagName))) return;
      const salto = { ArrowLeft: -1, ArrowRight: 1, Home: -Infinity, End: Infinity }[e.key];
      if (salto === undefined) return;
      e.preventDefault();
      irParaAgora.current(Number.isFinite(salto) ? passoAgora.current + salto : salto < 0 ? 0 : Infinity);
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [revisao]);

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
  const final = estado.final ?? null;
  const resultado = estado.resultadoDoFinal ?? null;

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
        const letra = casas[i];
        const clara = (Math.floor(i / 8) + (i % 8)) % 2 === 0;
        const classes = [
          'xadrez-casa',
          clara ? 'clara' : 'escura',
          ultimoVisto && (ultimoVisto.de === i || ultimoVisto.para === i) && 'ultimo',
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
            {/* as peças que este lado já tomou */}
            <span className="mesa-capturadas" aria-hidden="true">
              {(lado === estado.brancas ? estado.capturadas?.pretas : estado.capturadas?.brancas)?.map((p, k) => (
                <span key={k} className={`xadrez-peca ${lado === estado.brancas ? 'preta' : 'branca'}`}>
                  {peca(p)}
                </span>
              ))}
            </span>
          </span>
        ))}
      </div>
      <ComHistorico estado={estado as unknown as EstadoDaMesa}>
      <Tabuleiro3D dados={{ casas, girado, escolhida, destinos, ultimo: ultimoVisto, xequeEm: revendo ? null : xequeEm }} aoClicar={clicar} reserva={tabuleiro} />
      </ComHistorico>
      {revisao && totalDaRevisao > 0 && (
        <div className="xadrez-revisao" role="group" aria-label={t('Lances')}>
          <button type="button" className="btn-secondary" aria-label={t('Primeiro lance')} title={t('Primeiro lance')} disabled={noPasso === 0} onClick={() => irPara(0)}>
            <ChevronsLeft size={16} aria-hidden="true" />
          </button>
          <button type="button" className="btn-secondary" aria-label={t('Lance anterior')} title={t('Lance anterior')} disabled={noPasso === 0} onClick={() => irPara(noPasso - 1)}>
            <ChevronLeft size={16} aria-hidden="true" />
          </button>
          <span className="xadrez-revisao-passo" aria-live="polite">
            {noPasso}/{totalDaRevisao}
          </span>
          <button type="button" className="btn-secondary" aria-label={t('Próximo lance')} title={t('Próximo lance')} disabled={noPasso === totalDaRevisao} onClick={() => irPara(noPasso + 1)}>
            <ChevronRight size={16} aria-hidden="true" />
          </button>
          <button type="button" className="btn-secondary" aria-label={t('Último lance')} title={t('Último lance')} disabled={noPasso === totalDaRevisao} onClick={() => irPara(totalDaRevisao)}>
            <ChevronsRight size={16} aria-hidden="true" />
          </button>
        </div>
      )}
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
      {/* o final de treino (21/11/2026): o recorde enquanto se joga, e no fim em quantos lances saiu o mate */}
      {final && (
        <p className="xadrez-final" role="status">
          {resultado
            ? `${t('Mate em {n} lances!', { n: resultado.lances })}${resultado.voltou ? ` ${t('Com lance voltado, não vale recorde.')}` : resultado.novo ? ` ${t('Novo recorde!')}` : resultado.antes !== null ? ` · ${t('Recorde: {n} lances', { n: resultado.antes })}` : ''}`
            : estado.recordeDoFinal != null
              ? t('Recorde: {n} lances', { n: estado.recordeDoFinal })
              : null}
        </p>
      )}
      {jogando && !estado.solo && !(estado as unknown as EstadoDaMesa).relogio && <Relogio restante={restante} total={JOGADA_MS} />}
      {estado.fase === 'esperando' && !sentado && (
        <button type="button" className="btn-primary duelo-sentar" onClick={() => agir({ tipo: 'sentar' })}>
          {t('Jogar')}
        </button>
      )}
      <ControlesDaMesa jogo="partida-de-xadrez" estado={estado as unknown as EstadoDaMesa} eu={eu} agir={agir} />
      {jogando && sentado && (
        <button type="button" className="link-button duelo-desistir" onClick={() => agir({ tipo: 'desistir' })}>
          {t('Desistir')}
        </button>
      )}
    </div>
  );
}

/** O tabuleiro em 3D, com o de botões por baixo (à mostra até a cena ficar pronta, ou para sempre no estilo 2D). */
export function Tabuleiro3D({ dados, aoClicar, reserva }: { dados: XadrezDaCena; aoClicar: (i: number) => void; reserva: ReactNode }) {
  const caixa = useRef<HTMLDivElement>(null);
  const cena = useRef<Xadrez3D | null>(null);
  const [estado, setEstado] = useState<'carregando' | 'pronta' | 'falhou'>(() => (temWebGL() ? 'carregando' : 'falhou'));
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
