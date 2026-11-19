import { temWebGL } from './temWebGL';
import { Bell, Trophy } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type MouseEvent as ME, type PointerEvent as PE, type WheelEvent as WE } from 'react';
import type { Socket } from 'socket.io-client';
import { ComandosDoJogo } from './ComandosDosJogos';
import { chave, useT } from './i18n';
import { cursorDeHud, IconeDeHud, type NomeDoIconeDeHud } from './iconesDeHud';
import { tocar } from './somDosJogos';
import { criarIA, NIVEIS, PERFIS, type IA, type Nivel } from './tocas/ia';
import {
  assinatura,
  casasDaMuralha,
  centroDe,
  comandar,
  eFonte,
  ePredio,
  ERA2,
  eUnidade,
  limparComando,
  lugarDeColeta,
  MAPAS,
  MELHORIAS,
  MERCADO,
  novaPartida,
  ocupantes,
  ORDEM_DAS_MELHORIAS,
  passo,
  PASSO,
  PASSOS_DA_MARAVILHA,
  PASSOS_POR_SEGUNDO,
  podeConstruir,
  podePagar,
  populacao,
  precoDaTroca,
  PREDIOS,
  RECURSOS,
  TAMANHO,
  temMelhoria,
  UNIDADES,
  type Amostra,
  type Comando,
  type Custo,
  type Dono,
  type Melhoria,
  type Recurso,
  type Sim,
  type TipoDoMapa,
  type TipoPredio,
  type TipoUnidade,
} from './tocas/sim';
import { CORES, type Vista } from './tocas/vista';
import { Vista2D } from './tocas/vista2d';
import './tocas/tocas.css';

/**
 * TOCAS E TORRES (05/11/2026): estratégia em tempo real, SÓ A MECÂNICA do gênero (coletar, construir, treinar, avançar de era,
 * atacar), numa partida de 10 a 15 minutos. Nada de nome, arte, texto ou som de jogo nenhum; os modelos são CC0 (KayKit: Medieval
 * Hexagon e Resource Bits) e os coelhos são o nosso coelho 3D. Sem música (a regra do "nunca fazer a nossa"); os efeitos são os de
 * somDosJogos.ts.
 *
 * A SIMULAÇÃO (tocas/sim.ts) anda em passos fixos de 1/10 s, separada da tela, e é a MESMA do servidor (server/src/tocas/, iguais
 * byte a byte). O que a pessoa faz vira COMANDO (`ordenar`):
 *  - no SOLO (19/11/2026), contra o computador (tocas/ia.ts, três níveis), a partida anda aqui, e os comandos vão ao servidor em
 *    trechos, com o passo em que entraram; ele refaz a partida, e o fim e o recorde são dele. A janela sem foco PAUSA tudo. Há
 *    também o TUTORIAL, em cinco passos que a própria partida confere, contra um computador que não ataca.
 *  - na SALA (19/11/2026), de duas pessoas, em LOCKSTEP: o comando vale 3 turnos (600 ms) depois, e cada turno só anda quando o
 *    servidor manda as partes dos dois (server/src/minijogo-tocas.ts). Sem foco a partida segue (só não se desenha): ela é de duas
 *    pessoas.
 *
 * O mouse faz quase tudo: arrastar escolhe, o botão direito manda (andar, coletar, construir junto, atacar), a roda aproxima, e o
 * botão do meio, o direito arrastado ou as setas movem o mapa. No toque: tocar escolhe, tocar no destino manda, arrastar move.
 */

type MotivoDoFim = 'centro' | 'maravilha' | 'tempo' | 'desistiu' | 'saiu' | 'desencontro' | 'parou';
export interface ResultadoTocas {
  venceu: boolean;
  vencedor?: Dono | null;
  motivo: MotivoDoFim;
  passos: number;
  conferido?: boolean;
  historico?: Amostra[];
  recorde?: { antes: number | null; novo: boolean } | null;
}

export interface EstadoTocas {
  fase: 'escolha' | 'jogando' | 'fim';
  sala?: boolean;
  semente: number;
  mapa: TipoDoMapa;
  nivel?: Nivel;
  tutorial?: boolean;
  partidaId: string;
  resultado: ResultadoTocas | null;
  passosMax: number;
  /** O Solo: até que passo o servidor já refez a partida, e os recordes por nível (em ms). */
  confirmado?: number;
  recordes?: Record<string, number>;
  /** A sala: quem sou eu (o dono), quem joga, o turno e os turnos já resolvidos (para quem recarrega). */
  eu?: Dono | null;
  jogadores?: { userId: number; username: string }[];
  passosPorTurno?: number;
  atraso?: number;
  hashCada?: number;
  resolvido?: number;
  meuProximo?: number | null;
  turnos?: [number, Comando[], Comando[]][];
  espera?: Dono[];
}

type Props = {
  estado: EstadoTocas & { terminada?: boolean };
  eu: number;
  jogador: boolean;
  agir: (corpo: Record<string, unknown>) => unknown;
  socket?: Socket | null;
  channelId?: number;
};

const NOME: Record<TipoUnidade | TipoPredio, string> = {
  trabalhador: chave('Trabalhador'),
  lanceiro: chave('Lanceiro'),
  arqueiro: chave('Arqueiro'),
  cavaleiro: chave('Cavaleiro'),
  catapulta: chave('Catapulta'),
  centro: chave('Centro da vila'),
  casa: chave('Casa'),
  fazenda: chave('Fazenda'),
  quartel: chave('Quartel'),
  arquearia: chave('Arquearia'),
  torre: chave('Torre de vigia'),
  muralha: chave('Muralha'),
  portao: chave('Portão'),
  maravilha: chave('Maravilha'),
  ferreiro: chave('Ferreiro'),
  mercado: chave('Mercado'),
};
const NOME_DO_RECURSO: Record<Recurso, string> = { comida: chave('Comida'), madeira: chave('Madeira'), ouro: chave('Ouro') };
const NOME_DO_NIVEL: Record<Nivel, string> = { facil: chave('Fácil'), normal: chave('Normal'), dificil: chave('Difícil') };
const NOME_DO_MAPA: Record<TipoDoMapa, string> = { campo: chave('Campo'), floresta: chave('Floresta'), ouro: chave('Ouro no meio'), lagos: chave('Lagos') };
const NOME_DA_MELHORIA: Record<Melhoria, string> = {
  ataqueLanceiro: chave('Ataque dos lanceiros'),
  armaduraLanceiro: chave('Armadura dos lanceiros'),
  ataqueCavaleiro: chave('Ataque dos cavaleiros'),
  armaduraCavaleiro: chave('Armadura dos cavaleiros'),
  ataqueArqueiro: chave('Ataque dos arqueiros'),
  armaduraArqueiro: chave('Armadura dos arqueiros'),
  machado: chave('Machado afiado'),
  picareta: chave('Picareta'),
  arado: chave('Arado'),
};
/**
 * Os ÍCONES do painel (05/11/2026, pedido dele: "temos os recursos com assets, não podemos usá-los como UI?"): os próprios
 * modelos da KayKit (Resource Bits, e a casa do Medieval Hexagon), fotografados uma vez em PNG transparente (web/public/tocas/icones/),
 * para valerem também no 2D.
 */
const ICONE = (nome: Recurso | 'populacao') => `${import.meta.env.BASE_URL}tocas/icones/${nome}.png`;
/** A taxa "+x" de cada recurso: o que chegou ao estoque no último minuto da partida (o tempo da simulação, que pausa junto). */
const JANELA_DA_TAXA = 60 * PASSOS_POR_SEGUNDO;
const CONSTRUIVEIS: TipoPredio[] = ['casa', 'fazenda', 'quartel', 'arquearia', 'ferreiro', 'torre', 'muralha', 'portao', 'mercado', 'maravilha'];
/** O Solo manda os comandos ao servidor a cada tanto, em trechos de no máximo tanto (o servidor recusa mais de 1200). */
const TRECHO_MS = 2000;
const MAIOR_TRECHO = 1000;

const relogio = (passos: number) => {
  const s = Math.floor(passos / PASSOS_POR_SEGUNDO);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export function JogoTocas({ estado, jogador, agir, socket = null, channelId = 0 }: Props) {
  const t = useT();
  const estadoRef = useRef(estado);
  estadoRef.current = estado;
  const r = estado.resultado;
  const meuDono: Dono | null = estado.sala ? (estado.eu ?? null) : 0;
  const outro = estado.sala ? estado.jogadores?.[1 - (meuDono ?? 0)]?.username ?? '' : null;
  if (r) return <FimDaPartida estado={estado} r={r} eu={meuDono ?? 0} outro={outro} />;
  if (estado.fase === 'escolha') return jogador ? <Escolha estado={estado} agir={agir} /> : <p className="minijogo-situacao">…</p>;
  if (estado.terminada || estado.fase === 'fim' || !jogador || meuDono === null) return <p className="minijogo-situacao">…</p>;
  return (
    <Partida
      key={estado.partidaId}
      semente={estado.semente}
      mapa={estado.mapa}
      eu={meuDono}
      sala={!!estado.sala}
      nivel={estado.nivel ?? 'normal'}
      tutorial={!!estado.tutorial}
      outro={outro}
      agir={agir}
      estadoRef={estadoRef}
      socket={socket}
      channelId={channelId}
    />
  );
}

/** A LARGADA DO SOLO: o nível do computador (com o recorde de cada um), o mapa e o tutorial. */
function Escolha({ estado, agir }: { estado: EstadoTocas; agir: Props['agir'] }) {
  const t = useT();
  const [mapa, setMapa] = useState<TipoDoMapa | null>(null);
  return (
    <div className="tocas-escolha">
      <p className="tocas-escolha-titulo">{t('Mapa')}</p>
      <div className="tocas-mapas">
        <button type="button" className={`tocas-mapa-opcao${mapa === null ? ' ativo' : ''}`} aria-pressed={mapa === null} onClick={() => setMapa(null)}>
          <span className="tocas-mapa-sorteio" aria-hidden="true">?</span>
          <span>{t('Sorteado')}</span>
        </button>
        {MAPAS.map((m) => (
          <button key={m} type="button" className={`tocas-mapa-opcao${mapa === m ? ' ativo' : ''}`} aria-pressed={mapa === m} onClick={() => setMapa(m)}>
            <MiniaturaDoMapa semente={estado.semente} mapa={m} />
            <span>{t(NOME_DO_MAPA[m])}</span>
          </button>
        ))}
      </div>
      <p className="tocas-escolha-titulo">{t('Nível do computador')}</p>
      <div className="tocas-niveis">
        {NIVEIS.map((n) => {
          const rec = estado.recordes?.[n];
          return (
            <button key={n} type="button" className={`tocas-nivel tocas-nivel-${n}`} onClick={() => void agir({ tipo: 'comecar', nivel: n, ...(mapa ? { mapa } : {}) })}>
              <strong>{t(NOME_DO_NIVEL[n])}</strong>
              {rec !== undefined && (
                <small title={t('Recorde')}>
                  <Trophy size={12} aria-hidden="true" /> {relogio(rec / 100)}
                </small>
              )}
            </button>
          );
        })}
      </div>
      <div className="minijogo-acoes">
        <button type="button" className="btn-secondary" onClick={() => void agir({ tipo: 'comecar', tutorial: true })}>
          {t('Tutorial')}
        </button>
      </div>
    </div>
  );
}

/** O mapa de cima, pequeno, com a semente desta partida: o tipo se vê antes de escolher. */
function MiniaturaDoMapa({ semente, mapa }: { semente: number; mapa: TipoDoMapa }) {
  const tela = useRef<HTMLCanvasElement>(null);
  const sim = useMemo(() => novaPartida(semente, { mapa }), [semente, mapa]);
  useEffect(() => {
    const g = tela.current?.getContext('2d');
    if (!g) return;
    const k = 2;
    g.fillStyle = '#6f9a52';
    g.fillRect(0, 0, TAMANHO * k, TAMANHO * k);
    g.fillStyle = '#4f86b8';
    for (const a of sim.agua) g.fillRect(a.gx * k, a.gy * k, k, k);
    for (const f of sim.fontes) {
      g.fillStyle = f.tipo === 'arvore' ? '#2f5a2c' : '#f0cf3c';
      g.fillRect(f.gx * k, f.gy * k, k, k);
    }
    g.fillStyle = '#8b8577';
    for (const p of sim.pedras) g.fillRect(p.gx * k, p.gy * k, k, k);
    for (const p of sim.predios) {
      g.fillStyle = CORES[p.dono];
      g.fillRect(p.gx * k, p.gy * k, p.tam * k, p.tam * k);
    }
  }, [sim]);
  return <canvas ref={tela} className="tocas-miniatura" width={TAMANHO * 2} height={TAMANHO * 2} aria-hidden="true" />;
}

/** O FIM: quem ganhou, o porquê, o tempo, o recorde e os gráficos da partida (o que cada um colheu e o tamanho do exército). */
function FimDaPartida({ estado, r, eu, outro }: { estado: EstadoTocas; r: ResultadoTocas; eu: Dono; outro: string | null }) {
  const t = useT();
  const deles = outro ?? t('Computador');
  const texto =
    r.motivo === 'desistiu'
      ? r.venceu
        ? t('{nome} desistiu.', { nome: deles })
        : t('Você desistiu.')
      : r.motivo === 'saiu'
        ? r.venceu
          ? t('{nome} saiu da sala.', { nome: deles })
          : t('Você ficou fora da sala por muito tempo.')
        : r.motivo === 'desencontro' || r.motivo === 'parou'
          ? t('A partida se desencontrou entre os computadores e foi encerrada.')
          : r.motivo === 'tempo'
            ? t('O tempo acabou: ganhou quem tinha mais.')
            : r.motivo === 'maravilha'
              ? r.venceu
                ? t('A sua Maravilha ficou de pé por 2 minutos.')
                : outro
                  ? t('A Maravilha de {nome} ficou de pé por 2 minutos.', { nome: outro })
                  : t('A Maravilha do computador ficou de pé por 2 minutos.')
              : r.venceu
                ? outro
                  ? t('Você derrubou o centro da vila de {nome}.', { nome: outro })
                  : t('Você derrubou o centro da vila do computador.')
                : outro
                  ? t('{nome} derrubou o seu centro da vila.', { nome: outro })
                  : t('O computador derrubou o seu centro da vila.');
  const empate = r.vencedor === null && estado.sala;
  return (
    <div className="tocas-fim">
      <p className={`tocas-fim-titulo${r.venceu ? ' venceu' : ''}`}>{empate ? t('Fim da partida') : r.venceu ? t('Vitória!') : t('Derrota')}</p>
      <p className="minijogo-situacao">{texto}</p>
      <p className="minijogo-situacao">
        {relogio(r.passos)}
        {estado.tutorial ? '' : estado.nivel && !estado.sala ? ` · ${t(NOME_DO_NIVEL[estado.nivel])}` : ''} · {t(NOME_DO_MAPA[estado.mapa] ?? NOME_DO_MAPA.campo)}
      </p>
      {r.recorde?.novo && (
        <p className="tocas-recorde">
          <Trophy size={16} aria-hidden="true" /> {r.recorde.antes === null ? t('Primeira vitória neste nível!') : t('Novo recorde! Antes: {tempo}', { tempo: relogio(r.recorde.antes / 100) })}
        </p>
      )}
      {r.historico && r.historico.length > 1 && (
        <div className="tocas-graficos">
          <Grafico titulo={t('Recursos colhidos')} amostras={r.historico} valor={(a, d) => a.colhido[d]} eu={eu} nomes={[t('Você'), deles]} />
          <Grafico titulo={t('Exército')} amostras={r.historico} valor={(a, d) => a.exercito[d]} eu={eu} nomes={[t('Você'), deles]} />
        </div>
      )}
    </div>
  );
}

/**
 * Um gráfico de linhas pequeno: o tempo da partida embaixo, um eixo só, as duas linhas nas cores dos times (a minha e a do outro),
 * com a legenda e o valor final ao lado de cada uma. Passar o mouse mostra o momento e os dois valores.
 */
function Grafico({ titulo, amostras, valor, eu, nomes }: { titulo: string; amostras: Amostra[]; valor: (a: Amostra, d: Dono) => number; eu: Dono; nomes: [string, string] }) {
  const L = 280;
  const A = 110;
  const M = { e: 30, d: 8, c: 8, b: 18 };
  const fim = amostras[amostras.length - 1].passo || 1;
  const maior = Math.max(1, ...amostras.flatMap((a) => [valor(a, 0), valor(a, 1)]));
  const x = (p: number) => M.e + (p / fim) * (L - M.e - M.d);
  const y = (v: number) => A - M.b - (v / maior) * (A - M.b - M.c);
  const [foco, setFoco] = useState<number | null>(null);
  const ordem: Dono[] = [eu, (1 - eu) as Dono];
  const linha = (d: Dono) => amostras.map((a, i) => `${i ? 'L' : 'M'}${x(a.passo).toFixed(1)},${y(valor(a, d)).toFixed(1)}`).join('');
  const aoMover = (e: PE<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * L;
    let melhor = 0;
    for (let i = 1; i < amostras.length; i++) if (Math.abs(x(amostras[i].passo) - px) < Math.abs(x(amostras[melhor].passo) - px)) melhor = i;
    setFoco(melhor);
  };
  const f = foco !== null ? amostras[foco] : null;
  return (
    <figure className="tocas-grafico">
      <figcaption>{titulo}</figcaption>
      <svg viewBox={`0 0 ${L} ${A}`} role="img" aria-label={`${titulo}: ${nomes[0]} ${valor(amostras[amostras.length - 1], eu)}, ${nomes[1]} ${valor(amostras[amostras.length - 1], (1 - eu) as Dono)}`} onPointerMove={aoMover} onPointerLeave={() => setFoco(null)}>
        <line x1={M.e} x2={L - M.d} y1={y(0)} y2={y(0)} className="tocas-grafico-eixo" />
        <line x1={M.e} x2={L - M.d} y1={y(maior)} y2={y(maior)} className="tocas-grafico-grade" />
        <text x={M.e - 4} y={y(maior) + 4} textAnchor="end" className="tocas-grafico-texto">
          {maior}
        </text>
        <text x={M.e - 4} y={y(0) + 4} textAnchor="end" className="tocas-grafico-texto">
          0
        </text>
        <text x={L - M.d} y={A - 4} textAnchor="end" className="tocas-grafico-texto">
          {relogio(fim)}
        </text>
        {ordem.map((d) => (
          <path key={d} d={linha(d)} fill="none" stroke={CORES[d]} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        ))}
        {f && (
          <>
            <line x1={x(f.passo)} x2={x(f.passo)} y1={M.c} y2={y(0)} className="tocas-grafico-grade" />
            {ordem.map((d) => (
              <circle key={d} cx={x(f.passo)} cy={y(valor(f, d))} r={4} fill={CORES[d]} className="tocas-grafico-ponto" />
            ))}
          </>
        )}
      </svg>
      <div className="tocas-grafico-legenda">
        {f && <span className="tocas-grafico-momento">{relogio(f.passo)}</span>}
        {ordem.map((d, i) => (
          <span key={d}>
            <i style={{ background: CORES[d] }} aria-hidden="true" /> {nomes[i]} {valor(f ?? amostras[amostras.length - 1], d)}
          </span>
        ))}
      </div>
    </figure>
  );
}

/**
 * O TUTORIAL (19/11/2026): cinco passos que a própria partida confere (nada de botão "próximo": o passo vira quando a coisa
 * aconteceu de verdade na simulação), contra um computador que não ataca.
 */
const PASSOS_DO_TUTORIAL: { texto: string; feito: (sim: Sim, eu: Dono, inicio: TutorialInicio) => boolean }[] = [
  {
    texto: chave('Escolha um trabalhador e clique com o botão direito numa árvore para colher madeira.'),
    feito: (sim, eu) => sim.unidades.some((u) => u.dono === eu && u.tipo === 'trabalhador' && (u.carga?.rec === 'madeira' || sim.colhido[eu] > 0)),
  },
  {
    texto: chave('Com um trabalhador escolhido, construa uma Casa: ela aumenta a população.'),
    feito: (sim, eu) => sim.predios.some((p) => p.dono === eu && p.tipo === 'casa' && p.pronto),
  },
  {
    texto: chave('Construa uma Fazenda e deixe um trabalhador colhendo comida nela.'),
    feito: (sim, eu) => sim.predios.some((p) => p.dono === eu && p.tipo === 'fazenda' && p.pronto && ocupantes(sim, eu, p.id) > 0),
  },
  {
    texto: chave('Escolha o centro da vila e treine mais um trabalhador.'),
    feito: (sim, eu, i) => sim.unidades.filter((u) => u.dono === eu && u.tipo === 'trabalhador').length > i.trabalhadores,
  },
  {
    texto: chave('Construa um Quartel e treine um Lanceiro.'),
    feito: (sim, eu) => sim.unidades.some((u) => u.dono === eu && u.tipo === 'lanceiro'),
  },
];
type TutorialInicio = { trabalhadores: number };

// ---------------------------------------------------------------------------------------------------------------------

declare global {
  interface Window {
    /** Só no site de desenvolvimento: o e2e liga o piloto automático (o computador jogando por mim) e lê a partida. */
    tocasPilotoAutomatico?: boolean;
    /** Só no site de desenvolvimento: quantos passos por quadro, no máximo (para o e2e andar a partida depressa). */
    tocasVelocidade?: number;
    tocasPartidaDoTeste?: Sim;
  }
}

interface Painel {
  recursos: Record<Recurso, number>;
  /** Quanto entrou de cada um por minuto (a média do último minuto). */
  taxa: Record<Recurso, number>;
  pop: { usada: number; max: number };
  era: 1 | 2;
  passo: number;
  maravilha: [number, number];
  /** Os trabalhadores parados (o número no atalho). */
  ociosos: number;
  /** O sino do meu centro: tocado, e quantos já estão dentro. */
  sino: boolean;
  abrigados: number;
  /** Uma marca que muda quando a seleção ou o que está nela muda (para os botões se refazerem). */
  versao: number;
}

type Colocando = { tipo: TipoPredio; inicio: { x: number; y: number } | null };

function Partida({
  semente,
  mapa: tipoDoMapa,
  eu,
  sala,
  nivel,
  tutorial,
  outro,
  agir,
  estadoRef,
  socket,
  channelId,
}: {
  semente: number;
  mapa: TipoDoMapa;
  eu: Dono;
  sala: boolean;
  nivel: Nivel;
  tutorial: boolean;
  outro: string | null;
  agir: Props['agir'];
  estadoRef: { current: EstadoTocas };
  socket: Socket | null;
  channelId: number;
}) {
  const t = useT();
  const caixa = useRef<HTMLDivElement>(null);
  const mapa = useRef<HTMLCanvasElement>(null);
  const caixaSel = useRef<HTMLDivElement>(null);
  const simRef = useRef<Sim | null>(null);
  if (!simRef.current) simRef.current = novaPartida(semente, { mapa: tipoDoMapa });
  const sim = simRef.current;
  /** O nome de quem está do outro lado: a pessoa da sala, ou o computador. */
  const deles = outro ?? t('Computador');
  /**
   * O COMANDO DA PESSOA. No Solo entra na partida já (no próximo passo) e o laço o anota para o servidor; na sala espera o turno
   * dele (3 turnos adiante), e só entra quando volta do servidor junto com o do outro.
   */
  const pendentes = useRef<Comando[]>([]);
  const ordenar = (c: Comando) => {
    if (sala) pendentes.current.push(c);
    else comandar(sim, eu, c);
  };
  const [espera, setEspera] = useState<string | null>(null);
  const [passoDoTutorial, setPassoDoTutorial] = useState(0);
  const vistaRef = useRef<Vista | null>(null);
  const [pronta, setPronta] = useState(false);
  const [sel, setSel] = useState<number[]>([]);
  const selRef = useRef<number[]>([]);
  const [colocando, setColocando] = useState<Colocando | null>(null);
  const colocandoRef = useRef<Colocando | null>(null);
  /** O que chegou ao estoque, com o passo: a conta da taxa. */
  const entregas = useRef<{ passo: number; rec: Recurso; qtd: number }[]>([]);
  const [painel, setPainel] = useState<Painel>(() => lerPainel(sim, eu, 0, []));
  const [aviso, setAviso] = useState<string | null>(null);
  const [acabou, setAcabou] = useState(false);
  const teclas = useRef(new Set<string>());
  const agirRef = useRef(agir);
  agirRef.current = agir;

  const escolher = (ids: number[]) => {
    selRef.current = ids;
    setSel(ids);
    if (vistaRef.current) vistaRef.current.selecao = new Set(ids);
  };
  const colocar = (c: Colocando | null) => {
    colocandoRef.current = c;
    setColocando(c);
    if (!c && vistaRef.current) vistaRef.current.fantasma = null;
  };
  const avisar = (texto: string) => {
    setAviso(texto);
    window.setTimeout(() => setAviso((a) => (a === texto ? null : a)), 3000);
  };

  // ---- os selos de capacidade (06/11/2026, pedido dele: "Fazenda 0/1, mina 0/5") ----
  // Sobre cada fazenda pronta minha e cada mina já vista, quantos trabalhadores meus estão nela e quantos cabem (a regra é a da
  // simulação, CAPACIDADE em sim.ts). A conta é refeita junto com o painel; o lugar na tela, a cada quadro desenhado.
  const camadaDosSelos = useRef<HTMLDivElement>(null);
  const selos = useRef(new Map<string, { el: HTMLDivElement; texto: HTMLSpanElement; x: number; y: number; alto: number; visto: boolean }>());
  const lerSelos = () => {
    const camada = camadaDosSelos.current;
    if (!camada) return;
    const j = sim.jogadores[eu];
    const querem = new Map<string, { x: number; y: number; alto: number; rec: Recurso; n: number; cap: number }>();
    for (const p of sim.predios) {
      if (p.dono !== eu || p.tipo !== 'fazenda' || !p.pronto) continue;
      const l = lugarDeColeta(sim, p.id)!;
      querem.set(`f${p.id}`, { x: p.gx + p.tam / 2, y: p.gy + p.tam / 2, alto: 1.15, rec: 'comida', n: ocupantes(sim, eu, l.chave), cap: l.cap });
    }
    const minas = new Map<number, { sx: number; sy: number; k: number; visto: boolean; cap: number }>();
    for (const f of sim.fontes) {
      if (f.tipo !== 'ouro') continue;
      const l = lugarDeColeta(sim, f.id);
      if (!l) continue;
      const m = minas.get(l.chave) ?? { sx: 0, sy: 0, k: 0, visto: false, cap: l.cap };
      m.sx += f.gx + 0.5;
      m.sy += f.gy + 0.5;
      m.k++;
      if (j.explorado[f.gy * TAMANHO + f.gx]) m.visto = true;
      minas.set(l.chave, m);
    }
    for (const [chave, m] of minas) if (m.visto) querem.set(`m${chave}`, { x: m.sx / m.k, y: m.sy / m.k, alto: 0.7, rec: 'ouro', n: ocupantes(sim, eu, chave), cap: m.cap });
    for (const [k, s] of selos.current)
      if (!querem.has(k)) {
        s.el.remove();
        selos.current.delete(k);
      }
    for (const [k, q] of querem) {
      let s = selos.current.get(k);
      if (!s) {
        const el = document.createElement('div');
        el.className = 'tocas-selo';
        const img = document.createElement('img');
        img.src = ICONE(q.rec);
        img.alt = '';
        const texto = document.createElement('span');
        el.append(img, texto);
        camada.append(el);
        s = { el, texto, x: q.x, y: q.y, alto: q.alto, visto: true };
        selos.current.set(k, s);
      }
      s.x = q.x;
      s.y = q.y;
      const txt = `${q.n}/${q.cap}`;
      if (s.texto.textContent !== txt) s.texto.textContent = txt;
      s.el.classList.toggle('cheio', q.n >= q.cap);
    }
  };
  const moverSelos = (v: Vista) => {
    for (const s of selos.current.values()) {
      const p = v.projetar(s.x, s.y, s.alto);
      if (!p) {
        if (s.visto) s.el.style.display = 'none';
        s.visto = false;
        continue;
      }
      if (!s.visto) s.el.style.display = '';
      s.visto = true;
      s.el.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px) translate(-50%, -100%)`;
    }
  };

  // ---- o cursor do mouse diz o que o botão direito vai fazer (pedido dele: "mudar o ícone do mouse para reforçar a ação") ----
  const cursores = useRef<Partial<Record<Acao, string>>>({});
  const cursorAtual = useRef<Acao | ''>('');
  useEffect(() => {
    let vivo = true;
    for (const [acao, icone] of Object.entries(ICONE_DA_ACAO) as [Acao, NomeDoIconeDeHud][])
      void cursorDeHud(icone).then((c) => {
        if (vivo && c) cursores.current[acao] = c;
      });
    return () => {
      vivo = false;
    };
  }, []);
  const ultimoCursor = useRef(0);
  const porCursor = (px: number, py: number) => {
    const agora = performance.now();
    if (agora - ultimoCursor.current < 70) return;
    ultimoCursor.current = agora;
    const v = vistaRef.current;
    const c = caixa.current;
    if (!v || !c) return;
    const acao = colocandoRef.current ? '' : acaoDoMouse(sim, eu, v, selRef.current, px, py);
    if (acao === cursorAtual.current) return;
    cursorAtual.current = acao;
    c.style.cursor = acao ? cursores.current[acao] ?? '' : '';
    c.dataset.acao = acao;
  };

  // ---- a vista e o laço ----
  useEffect(() => {
    if (!caixa.current) return;
    let viva = true;
    let id = 0;
    let vista: Vista | null = null;
    // no Solo, o computador do nível escolhido (o mesmo que o servidor usa para refazer a partida); na sala, ninguém
    const ia: IA | null = sala ? null : criarIA((1 - eu) as Dono, tutorial ? PERFIS.tutorial : PERFIS[nivel]);
    const piloto: IA = criarIA(eu, PERFIS.piloto);
    if (import.meta.env.DEV) window.tocasPartidaDoTeste = sim;
    const usar = async (v: Vista) => {
      vista = v;
      await v.montar();
      if (!viva) return v.destruir();
      vistaRef.current = v;
      v.selecao = new Set(selRef.current);
      setPronta(true);
      comecar();
    };
    const de2D = () => usar(new Vista2D(caixa.current!, sim, eu));
    // o jogo tem a estética dele (decisão dele, 06/11/2026: "para os mini jogos, é uma estética única"): abre sempre em 3D, e o
    // 2D fica para quando não há WebGL ou a cena falha
    if (temWebGL())
      import('./tocas/cena')
        .then(({ CenaDasTocas }) => {
          if (!viva || !caixa.current) return;
          return usar(new CenaDasTocas(caixa.current, sim, eu));
        })
        .catch(() => {
          vista?.destruir();
          vista = null;
          if (viva && caixa.current) void de2D();
        });
    else void de2D();

    let ultimoSom = new Map<string, number>();
    const som = (e: Parameters<typeof tocar>[0], cada = 0) => {
      const agora = performance.now();
      if (cada && agora - (ultimoSom.get(e) ?? 0) < cada) return;
      ultimoSom.set(e, agora);
      tocar(e);
    };
    let mandou = false;
    const ouvir = () => {
      const vis = sim.jogadores[eu].visivel;
      for (const e of sim.eventos) {
        switch (e.t) {
          case 'treinou':
            if (e.dono === eu) som('chegada', 300);
            break;
          case 'pronto':
            if (e.dono === eu) som('acerto', 300);
            break;
          case 'entregou':
            if (e.dono === eu) {
              som('moeda', 1500);
              entregas.current.push({ passo: sim.passo, rec: e.rec, qtd: e.qtd });
            }
            break;
          case 'golpe':
            if (vis[Math.floor(e.y1) * TAMANHO + Math.floor(e.x1)]) som(e.arma === 'corpo' ? 'soco' : 'tiro', 220);
            break;
          case 'morte':
            if (e.predio && vis[Math.floor(e.y) * TAMANHO + Math.floor(e.x)]) som('queda', 400);
            break;
          case 'era':
            som('vez');
            if (e.dono === eu) avisar(t('Você avançou para a era 2!'));
            else if (outro) avisar(t('{nome} avançou para a era 2.', { nome: outro }));
            else avisar(t('O computador avançou para a era 2.'));
            break;
          case 'maravilha':
            som('vez');
            avisar(
              e.dono === eu
                ? t('A sua Maravilha está pronta: defenda-a por 2 minutos!')
                : outro
                  ? t('{nome} terminou uma Maravilha: derrube-a em 2 minutos!', { nome: outro })
                  : t('O computador terminou uma Maravilha: derrube-a em 2 minutos!'),
            );
            break;
          case 'atacado':
            // só o ataque em casa (quem está atacando lá longe já sabe que está brigando)
            if (e.dono === eu && pertoDeCasa(sim, eu, e.x, e.y)) {
              som('alarme', 4000);
              avisar(t('A sua vila está sob ataque!'));
            }
            break;
          case 'cheio':
            if (e.dono === eu) {
              som('erro', 600);
              avisar(t('Este lugar já está cheio.'));
            }
            break;
          case 'sino':
            if (e.dono === eu) som('vez');
            break;
          case 'melhoria':
            if (e.dono === eu) {
              som('medalha');
              avisar(t('Melhoria pronta: {nome}', { nome: t(NOME_DA_MELHORIA[e.m]) }));
            }
            break;
          case 'troca':
            if (e.dono === eu) som('moeda');
            break;
        }
      }
    };

    // ---- O SOLO: os comandos anotados com o passo, e os trechos ao servidor (que refaz a partida) ----
    const anotados: [number, Comando][] = [];
    let enviando = false;
    const enviarTrecho = () => {
      if (sala || enviando || !viva) return;
      const de = estadoRef.current.confirmado ?? 0;
      if (de >= sim.passo) return;
      const ate = Math.min(sim.passo, de + MAIOR_TRECHO);
      const ultimo = ate === sim.passo;
      const corpo: Record<string, unknown> = { tipo: 'trecho', de, ate, lote: anotados.filter(([p]) => p >= de && p < ate) };
      if (ultimo) corpo.h = assinatura(sim);
      if (ultimo && sim.vencedor !== null) corpo.fim = { venceu: sim.vencedor === eu, motivo: sim.motivo };
      enviando = true;
      Promise.resolve(agirRef.current(corpo))
        .catch(() => {})
        .finally(() => {
          enviando = false;
        });
    };
    const trechos = sala ? 0 : window.setInterval(enviarTrecho, TRECHO_MS);
    /** No Solo, os comandos meus que estão na fila (a tela e o piloto) vão limpos para a partida e para a anotação. */
    const anotar = () => {
      const fila = sim.fila;
      sim.fila = [];
      for (const f of fila) {
        if (f.dono !== eu) {
          sim.fila.push(f);
          continue;
        }
        const c = limparComando(f.c);
        if (!c) continue;
        sim.fila.push({ dono: eu, c });
        anotados.push([sim.passo, c]);
      }
    };

    // ---- A SALA: o lockstep (os turnos que voltam do servidor; a minha parte de cada um vai antes) ----
    const e0 = estadoRef.current;
    const B = e0.passosPorTurno ?? 2;
    const D = e0.atraso ?? 3;
    const HC = e0.hashCada ?? 25;
    const meuProximo = e0.meuProximo ?? D;
    const recebidos = new Map<number, [Comando[], Comando[]]>();
    /** Os turnos com algum comando, guardados: quem se perdeu (a dessincronia) refaz a partida por eles. */
    const historia = new Map<number, [Comando[], Comando[]]>();
    let turno = 0;
    let passoNoTurno = 0;
    let refazer = false;
    let esperandoDesde = 0;
    const andarTurno = (s: Sim, c: [Comando[], Comando[]] | undefined) => {
      if (c) {
        for (const x of c[0]) comandar(s, 0, x);
        for (const x of c[1]) comandar(s, 1, x);
      }
    };
    if (sala) {
      // quem chega (ou recarregou a página) refaz a partida até onde o servidor já resolveu
      for (const [k, c0, c1] of e0.turnos ?? []) historia.set(k, [c0, c1]);
      const ate = e0.resolvido ?? D;
      for (; turno < ate && sim.vencedor === null; turno++) {
        andarTurno(sim, historia.get(turno));
        for (let i = 0; i < B && sim.vencedor === null; i++) passo(sim);
      }
    }
    const refazerPartida = () => {
      const nova = novaPartida(semente, { mapa: tipoDoMapa });
      for (let k = 0; k < turno && nova.vencedor === null; k++) {
        andarTurno(nova, historia.get(k));
        for (let i = 0; i < B && nova.vencedor === null; i++) passo(nova);
      }
      Object.assign(sim, nova);
    };
    const chegada = (msg: { channelId?: number; dados?: Record<string, unknown> }) => {
      const d = msg?.dados;
      if (!d || msg.channelId !== channelId) return;
      if (d.tocas === 'turno' && Number.isInteger(d.k) && (d.k as number) >= turno) recebidos.set(d.k as number, d.c as [Comando[], Comando[]]);
      else if (d.tocas === 'ressincronizar' && d.dono === eu) refazer = true;
      else if (d.tocas === 'espera') {
        const donos = (d.donos as Dono[]) ?? [];
        setEspera(!donos.length ? null : donos.includes(eu) ? t('Esperando a sua conexão…') : t('Esperando {nome}…', { nome: deles }));
      }
    };
    if (sala) socket?.on('minijogo:tempo-real', chegada);
    /** Um passo da sala; false quando o turno ainda não chegou. */
    const passoDaSala = (): boolean => {
      if (passoNoTurno === 0) {
        if (turno >= D && !recebidos.has(turno)) return false;
        if (refazer) {
          refazer = false;
          refazerPartida();
        }
        if (turno + D >= meuProximo) {
          const dados: Record<string, unknown> = { k: turno + D, c: pendentes.current.splice(0, 30) };
          if (turno % HC === 0) Object.assign(dados, { h: assinatura(sim), hk: turno });
          socket?.emit('minijogo:tempo-real', { channelId, dados });
        }
        const c = recebidos.get(turno);
        recebidos.delete(turno);
        if (c && (c[0].length || c[1].length)) historia.set(turno, c);
        // o piloto automático do e2e: o que ele manda vai pelo mesmo caminho do clique (o turno daqui a 3)
        if (import.meta.env.DEV && window.tocasPilotoAutomatico) {
          piloto(sim);
          pendentes.current.push(...sim.fila.map((f) => f.c));
          sim.fila = [];
        }
        andarTurno(sim, c);
      }
      passo(sim);
      passoNoTurno++;
      if (passoNoTurno >= B) {
        passoNoTurno = 0;
        turno++;
      }
      return true;
    };

    const comecar = () => {
      let ultimo = performance.now();
      let acumulado = 0;
      let ultimoPainel = 0;
      let ultimoMapa = 0;
      let avisouCasa = false;
      let tutorialInicio: TutorialInicio = { trabalhadores: 0 };
      let passoTut = 0;
      const quadro = () => {
        if (!viva || !vista) return;
        id = requestAnimationFrame(quadro);
        const agora = performance.now();
        const dt = Math.min(0.1, (agora - ultimo) / 1000);
        ultimo = agora;
        const semFoco = document.hidden || !document.hasFocus();
        // no Solo, sem foco (o jogo de verdade, outra janela) ou escondida: nem a partida anda, nem se desenha. Na sala a partida
        // é de duas pessoas: ela segue (só não se desenha)
        if (semFoco && !sala) return;
        if (sim.vencedor === null) {
          const vel = import.meta.env.DEV && !sala ? Math.max(1, window.tocasVelocidade ?? 1) : 1;
          acumulado += sala ? Math.min(dt, 0.25) : dt * vel;
          let n = 0;
          let parado = false;
          while (acumulado >= PASSO && n < 4 * vel) {
            if (sala) {
              if (!passoDaSala()) {
                parado = true;
                break;
              }
            } else {
              if (import.meta.env.DEV && window.tocasPilotoAutomatico) piloto(sim);
              anotar();
              ia?.(sim);
              passo(sim);
            }
            if (!semFoco) vista.eventos?.(sim);
            ouvir();
            acumulado -= PASSO;
            n++;
            if (sim.vencedor !== null) break;
          }
          if (sala) {
            // esperando o turno: guarda até meio segundo de folga para alcançar, e diz de quem é a espera
            if (parado) {
              acumulado = Math.min(acumulado, 0.5);
              if (!esperandoDesde) esperandoDesde = agora;
              else if (agora - esperandoDesde > 1500) setEspera((e) => e ?? t('Esperando {nome}…', { nome: deles }));
            } else if (esperandoDesde) {
              esperandoDesde = 0;
              setEspera(null);
            }
          } else if (n >= 4 * vel) acumulado = 0;
        }
        if (semFoco) return;
        // as setas e o WASD movem o mapa
        const k = teclas.current;
        if (k.size) {
          const v = 600 * dt;
          const dx = (k.has('arrowleft') || k.has('a') ? 1 : 0) - (k.has('arrowright') || k.has('d') ? 1 : 0);
          const dy = (k.has('arrowup') || k.has('w') ? 1 : 0) - (k.has('arrowdown') || k.has('s') ? 1 : 0);
          const c = caixa.current;
          if ((dx || dy) && c) vista.arrastar(dx * v, dy * v, c.clientWidth / 2, c.clientHeight / 2);
        }
        vista.quadro(Math.min(1, acumulado / PASSO), dt);
        if (agora - ultimoPainel > 200) lerSelos();
        moverSelos(vista);
        if (agora - ultimoPainel > 200) {
          ultimoPainel = agora;
          // quem morreu (ou entrou no centro pelo sino) sai da seleção
          const vivos = selRef.current.filter((x) => {
            const e = sim.porId.get(x);
            return !!e && !(eUnidade(e) && e.abrigado);
          });
          if (vivos.length !== selRef.current.length) escolher(vivos);
          entregas.current = entregas.current.filter((x) => x.passo > sim.passo - JANELA_DA_TAXA);
          setPainel(lerPainel(sim, eu, Math.floor(agora / 200), entregas.current));
          // quem terminou o treino e não sai por falta de casa: avisa uma vez por vez que trava
          const travado = sim.predios.some((p) => p.dono === eu && p.fila.length > 0 && p.pesquisa === 0 && p.treino >= UNIDADES[p.fila[0]].tempo);
          if (travado && !avisouCasa) avisar(t('A população está no máximo: construa uma Casa.'));
          avisouCasa = travado;
          // o tutorial: o passo vira quando a coisa aconteceu na partida
          if (tutorial && passoTut < PASSOS_DO_TUTORIAL.length && PASSOS_DO_TUTORIAL[passoTut].feito(sim, eu, tutorialInicio)) {
            passoTut++;
            tutorialInicio = { trabalhadores: sim.unidades.filter((u) => u.dono === eu && u.tipo === 'trabalhador').length };
            som(passoTut === PASSOS_DO_TUTORIAL.length ? 'medalha' : 'acerto');
            setPassoDoTutorial(passoTut);
          }
        }
        if (agora - ultimoMapa > 250) {
          ultimoMapa = agora;
          desenharMapa(mapa.current, sim, eu, vista);
        }
        if (sim.vencedor !== null && !mandou) {
          mandou = true;
          som(sim.vencedor === eu ? 'fim' : 'derrota');
          setAcabou(true);
          // no Solo, o último trecho já vai (com o fim, para o servidor conferir); na sala, quem decide é a cópia do servidor
          enviarTrecho();
        }
      };
      id = requestAnimationFrame(quadro);
    };

    return () => {
      viva = false;
      cancelAnimationFrame(id);
      if (trechos) clearInterval(trechos);
      if (sala) socket?.off('minijogo:tempo-real', chegada);
      vista?.destruir();
      vistaRef.current = null;
      ultimoSom = new Map();
    };
    // a partida nasce uma vez
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  // ---- o teclado ----
  useEffect(() => {
    const desce = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement | null;
      if (alvo && (alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA' || alvo.isContentEditable)) return;
      const k = e.key.toLowerCase();
      if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'a', 'd', 'w', 's'].includes(k)) {
        teclas.current.add(k);
        e.preventDefault();
      } else if (k === 'escape') {
        if (colocandoRef.current) colocar(null);
        else escolher([]);
      } else if (k === 'h') irAoCentro();
    };
    const sobe = (e: KeyboardEvent) => teclas.current.delete(e.key.toLowerCase());
    const soltar = () => teclas.current.clear();
    window.addEventListener('keydown', desce);
    window.addEventListener('keyup', sobe);
    window.addEventListener('blur', soltar);
    return () => {
      window.removeEventListener('keydown', desce);
      window.removeEventListener('keyup', sobe);
      window.removeEventListener('blur', soltar);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- o que a pessoa faz ----
  const minhasUnidades = () => selRef.current.map((x) => sim.porId.get(x)).filter(eUnidade).filter((u) => u.dono === eu);
  const trabalhadoresEscolhidos = () => minhasUnidades().filter((u) => u.tipo === 'trabalhador').map((u) => u.id);

  /** O meu prédio escolhido que treina alguém (o centro, o quartel, a arquearia), pronto. */
  const predioQueTreina = () => {
    if (selRef.current.length !== 1) return null;
    const p = sim.porId.get(selRef.current[0]);
    if (!ePredio(p) || p.dono !== eu || !p.pronto) return null;
    return (Object.keys(UNIDADES) as TipoUnidade[]).some((k) => UNIDADES[k].de === p.tipo) ? p : null;
  };
  const mandar = (px: number, py: number) => {
    const v = vistaRef.current;
    const us = minhasUnidades();
    if (!v) return;
    const quemTreina = !us.length ? predioQueTreina() : null;
    if (quemTreina) {
      // o ponto de reunião: em cima de algo (a fonte, a fazenda, o inimigo) ou no chão
      const alvo = v.pegar(px, py);
      const e = alvo !== null ? sim.porId.get(alvo) : undefined;
      const p = e && e.id !== quemTreina.id ? centroDe(e) : v.chao(px, py);
      if (!p) return;
      ordenar({ t: 'reuniao', predio: quemTreina.id, x: p.x, y: p.y, ...(e && e.id !== quemTreina.id ? { alvo: e.id } : {}) });
      v.sinal(p.x, p.y, false);
      tocar('clique');
      return;
    }
    if (!us.length) return;
    const ids = us.map((u) => u.id);
    const alvo = v.pegar(px, py);
    const e = alvo !== null ? sim.porId.get(alvo) : undefined;
    if (e && !(eUnidade(e) && e.dono === eu)) {
      ordenar({ t: 'alvo', ids, alvo: e.id });
      const c = centroDe(e);
      v.sinal(c.x, c.y, !eFonte(e) && e.dono !== eu);
      tocar('clique');
      return;
    }
    const p = v.chao(px, py);
    if (!p) return;
    ordenar({ t: 'mover', ids, x: p.x, y: p.y });
    v.sinal(p.x, p.y, false);
    tocar('clique');
  };

  const casaDoFantasma = (p: { x: number; y: number }, tipo: TipoPredio) => {
    const tam = PREDIOS[tipo].tam;
    return { x: Math.floor(p.x - tam / 2 + 0.5), y: Math.floor(p.y - tam / 2 + 0.5) };
  };
  const atualizarFantasma = (px: number, py: number) => {
    const c = colocandoRef.current;
    const v = vistaRef.current;
    if (!c || !v) return;
    const p = v.chao(px, py);
    if (!p) return;
    const casa = casaDoFantasma(p, c.tipo);
    if (c.tipo === 'muralha') {
      const casas = c.inicio ? casasDaMuralha(c.inicio.x, c.inicio.y, casa.x, casa.y) : [casa];
      const ok = casas.every((k) => podeConstruir(sim, eu, 'muralha', k.x, k.y)) && podePagar(sim, eu, vezes(PREDIOS.muralha.custo, casas.length));
      v.fantasma = { tipo: 'muralha', casas, ok };
    } else v.fantasma = { tipo: c.tipo, casas: [casa], ok: podeConstruir(sim, eu, c.tipo, casa.x, casa.y) && podePagar(sim, eu, PREDIOS[c.tipo].custo) };
  };
  const porPredio = (px: number, py: number, manter: boolean) => {
    const c = colocandoRef.current;
    const v = vistaRef.current;
    if (!c || !v) return;
    const p = v.chao(px, py);
    if (!p) return;
    const casa = casaDoFantasma(p, c.tipo);
    const ids = trabalhadoresEscolhidos();
    if (!ids.length) return colocar(null);
    if (c.tipo === 'muralha') {
      if (!c.inicio) {
        colocar({ tipo: 'muralha', inicio: casa });
        atualizarFantasma(px, py);
        tocar('clique');
        return;
      }
      ordenar({ t: 'muralha', ids, gx0: c.inicio.x, gy0: c.inicio.y, gx1: casa.x, gy1: casa.y });
      tocar('clique');
      colocar(manter ? { tipo: 'muralha', inicio: null } : null);
      return;
    }
    if (!podeConstruir(sim, eu, c.tipo, casa.x, casa.y) || !podePagar(sim, eu, PREDIOS[c.tipo].custo)) {
      tocar('erro');
      return;
    }
    ordenar({ t: 'construir', ids, tipo: c.tipo, gx: casa.x, gy: casa.y });
    tocar('clique');
    if (!manter) colocar(null);
  };

  const clicar = (px: number, py: number, somar: boolean) => {
    const v = vistaRef.current;
    if (!v) return;
    const id = v.pegar(px, py);
    if (id === null) {
      if (!somar) escolher([]);
      return;
    }
    const e = sim.porId.get(id);
    if (somar && eUnidade(e) && e.dono === eu) {
      const ja = selRef.current.filter((x) => eUnidade(sim.porId.get(x)));
      escolher(ja.includes(id) ? ja.filter((x) => x !== id) : [...ja, id]);
    } else escolher([id]);
  };

  const irAoCentro = () => {
    const c = sim.predios.find((p) => p.dono === eu && p.tipo === 'centro');
    if (!c) return;
    vistaRef.current?.centrar(c.gx + 1.5, c.gy + 1.5);
    escolher([c.id]);
  };

  // ---- o ponteiro ----
  const ptrs = useRef(new Map<number, { x: number; y: number }>());
  const gesto = useRef<{ modo: 'caixa' | 'mapa' | 'toque' | 'pinca'; x0: number; y0: number; x: number; y: number; botao: number; moveu: boolean; dist: number } | null>(null);
  const local = (e: { clientX: number; clientY: number }) => {
    const r = caixa.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const aoApertar = (e: PE<HTMLDivElement>) => {
    if (!vistaRef.current) return;
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    const p = local(e);
    if (e.pointerType === 'touch') {
      ptrs.current.set(e.pointerId, p);
      if (ptrs.current.size === 2) {
        const [a, b] = [...ptrs.current.values()];
        gesto.current = { modo: 'pinca', x0: p.x, y0: p.y, x: p.x, y: p.y, botao: 0, moveu: true, dist: Math.hypot(a.x - b.x, a.y - b.y) };
      } else gesto.current = { modo: 'toque', x0: p.x, y0: p.y, x: p.x, y: p.y, botao: 0, moveu: false, dist: 0 };
      return;
    }
    gesto.current = { modo: e.button === 0 && !colocandoRef.current ? 'caixa' : 'mapa', x0: p.x, y0: p.y, x: p.x, y: p.y, botao: e.button, moveu: false, dist: 0 };
  };
  const aoMover = (e: PE<HTMLDivElement>) => {
    const v = vistaRef.current;
    if (!v) return;
    const p = local(e);
    if (colocandoRef.current) atualizarFantasma(p.x, p.y);
    if (e.pointerType === 'mouse') porCursor(p.x, p.y);
    const g = gesto.current;
    if (!g) return;
    if (e.pointerType === 'touch') ptrs.current.set(e.pointerId, p);
    const dx = p.x - g.x;
    const dy = p.y - g.y;
    if (Math.hypot(p.x - g.x0, p.y - g.y0) > (e.pointerType === 'touch' ? 10 : 6)) g.moveu = true;
    if (g.modo === 'pinca' && ptrs.current.size >= 2) {
      const [a, b] = [...ptrs.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (g.dist > 0 && d > 0) v.zoom(g.dist / d, (a.x + b.x) / 2, (a.y + b.y) / 2);
      g.dist = d;
    } else if ((g.modo === 'mapa' || g.modo === 'toque') && g.moveu) {
      if (g.modo === 'mapa' && g.botao === 0) return;
      v.arrastar(dx, dy, p.x, p.y);
    } else if (g.modo === 'caixa' && g.moveu && caixaSel.current) {
      const s = caixaSel.current.style;
      s.display = 'block';
      s.left = `${Math.min(g.x0, p.x)}px`;
      s.top = `${Math.min(g.y0, p.y)}px`;
      s.width = `${Math.abs(p.x - g.x0)}px`;
      s.height = `${Math.abs(p.y - g.y0)}px`;
    }
    g.x = p.x;
    g.y = p.y;
  };
  const aoSoltar = (e: PE<HTMLDivElement>) => {
    const v = vistaRef.current;
    const g = gesto.current;
    const p = local(e);
    if (e.pointerType === 'touch') {
      ptrs.current.delete(e.pointerId);
      if (ptrs.current.size > 0) return;
    }
    gesto.current = null;
    if (caixaSel.current) caixaSel.current.style.display = 'none';
    if (!v || !g) return;
    if (g.modo === 'toque') {
      if (g.moveu) return;
      if (colocandoRef.current) return porPredio(p.x, p.y, false);
      const id = v.pegar(p.x, p.y);
      const e2 = id !== null ? sim.porId.get(id) : undefined;
      const minha = e2 && (eUnidade(e2) || ePredio(e2)) && e2.dono === eu;
      if (minha) return escolher([id!]);
      if (minhasUnidades().length || predioQueTreina()) return mandar(p.x, p.y);
      return escolher(id !== null ? [id] : []);
    }
    if (g.modo === 'caixa') {
      if (g.moveu) {
        const ids = v.noRetangulo(g.x0, g.y0, p.x, p.y);
        // de arrasto, quem luta vem antes de quem trabalha (como se espera): só os trabalhadores, se não houver outro
        const soldados = ids.filter((x) => {
          const u = sim.porId.get(x);
          return eUnidade(u) && u.tipo !== 'trabalhador';
        });
        escolher(soldados.length ? soldados : ids);
      } else clicar(p.x, p.y, e.shiftKey);
      return;
    }
    if (g.modo === 'mapa' && !g.moveu) {
      if (g.botao === 2) {
        if (colocandoRef.current) colocar(null);
        else mandar(p.x, p.y);
      } else if (g.botao === 0 && colocandoRef.current) porPredio(p.x, p.y, e.shiftKey);
    }
  };
  const aoRolar = (e: WE<HTMLDivElement>) => {
    const p = local(e);
    vistaRef.current?.zoom(e.deltaY > 0 ? 1.12 : 1 / 1.12, p.x, p.y);
  };
  const aoDuploClique = (e: ME<HTMLDivElement>) => {
    const v = vistaRef.current;
    if (!v || colocandoRef.current) return;
    const p = local(e);
    const id = v.pegar(p.x, p.y);
    const u = id !== null ? sim.porId.get(id) : undefined;
    if (!eUnidade(u) || u.dono !== eu) return;
    const c = caixa.current!;
    escolher(v.noRetangulo(0, 0, c.clientWidth, c.clientHeight).filter((x) => (sim.porId.get(x) as { tipo?: string })?.tipo === u.tipo));
  };

  // ---- o minimapa ----
  const aoTocarNoMapa = (e: PE<HTMLCanvasElement>) => {
    const c = e.currentTarget;
    const r = c.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * TAMANHO;
    const y = ((e.clientY - r.top) / r.height) * TAMANHO;
    if (e.button === 2) {
      const ids = minhasUnidades().map((u) => u.id);
      if (ids.length) {
        ordenar({ t: 'mover', ids, x, y });
        tocar('clique');
      }
      return;
    }
    if (e.buttons || e.type === 'pointerdown') vistaRef.current?.centrar(x, y);
  };

  // ---- os botões ----
  const escolhidos = sel.map((x) => sim.porId.get(x)).filter(Boolean) as NonNullable<ReturnType<typeof sim.porId.get>>[];
  const unidades = escolhidos.filter(eUnidade).filter((u) => u.dono === eu);
  const trabalhadores = unidades.filter((u) => u.tipo === 'trabalhador');
  const predio = escolhidos.length === 1 && ePredio(escolhidos[0]) ? escolhidos[0] : null;
  const unico = escolhidos.length === 1 ? escolhidos[0] : null;
  void painel.versao;

  const custo = (c: Custo) => (
    <span className="tocas-custo">
      {RECURSOS.filter((k) => c[k]).map((k) => (
        <span key={k} className={`tocas-rec-${k}${(c[k] ?? 0) > painel.recursos[k] ? ' falta' : ''}`}>
          <img src={ICONE(k)} alt="" />
          {c[k]}
        </span>
      ))}
    </span>
  );

  const botaoConstruir = (tipo: TipoPredio) => {
    const d = PREDIOS[tipo];
    const travado = painel.era < d.era;
    const pode = !travado && podePagar(sim, eu, d.custo);
    return (
      <button
        key={tipo}
        type="button"
        className={`tocas-botao${colocando?.tipo === tipo ? ' ativo' : ''}`}
        disabled={travado}
        aria-disabled={!pode}
        title={travado ? t('Pede a era 2') : undefined}
        onClick={() => {
          if (!pode) return void tocar('erro');
          colocar(colocando?.tipo === tipo ? null : { tipo, inicio: null });
        }}
      >
        <span className="tocas-botao-nome">{t(NOME[tipo])}</span>
        {custo(d.custo)}
      </button>
    );
  };

  const botaoTreinar = (tipo: TipoUnidade) => {
    const d = UNIDADES[tipo];
    const travado = painel.era < d.era;
    const pode = !travado && podePagar(sim, eu, d.custo) && !!predio && predio.fila.length < 5 && predio.pronto;
    return (
      <button
        key={tipo}
        type="button"
        className="tocas-botao"
        disabled={travado}
        aria-disabled={!pode}
        title={travado ? t('Pede a era 2') : undefined}
        onClick={() => {
          if (!predio) return;
          if (!pode) {
            tocar('erro');
            // o que impede, dito (antes, o clique sem recurso não fazia nada à vista: "cliquei no cavaleiro e não saiu")
            if (predio.fila.length >= 5) avisar(t('A fila está cheia.'));
            else {
              const falta = RECURSOS.filter((k) => (d.custo[k] ?? 0) > sim.jogadores[eu].recursos[k]);
              avisar(t('Falta: {lista}', { lista: falta.map((k) => t(NOME_DO_RECURSO[k])).join(', ') }));
            }
            return;
          }
          ordenar({ t: 'treinar', predio: predio.id, unidade: tipo });
          tocar('clique');
        }}
      >
        <span className="tocas-botao-nome">{t(NOME[tipo])}</span>
        {custo(d.custo)}
      </button>
    );
  };

  /**
   * O SINO do centro da vila (06/11/2026, pedido dele): o primeiro toque manda todos os trabalhadores para dentro (o centro atira
   * mais com eles lá), o segundo os devolve ao que faziam. Mora no atalho e no painel do centro.
   */
  /** O FERREIRO (19/11/2026): uma melhoria por botão, com o custo; a que já está em estudo noutro ferreiro fica apagada. */
  const botaoMelhoria = (m: Melhoria) => {
    const d = MELHORIAS[m];
    const ocupado = !!predio?.estudo || sim.predios.some((p) => p.dono === eu && p.estudo === m);
    const pode = !ocupado && podePagar(sim, eu, d.custo);
    return (
      <button
        key={m}
        type="button"
        className="tocas-botao"
        disabled={ocupado}
        aria-disabled={!pode}
        onClick={() => {
          if (!predio) return;
          if (!pode) {
            tocar('erro');
            const falta = RECURSOS.filter((k) => (d.custo[k] ?? 0) > sim.jogadores[eu].recursos[k]);
            if (falta.length) avisar(t('Falta: {lista}', { lista: falta.map((k) => t(NOME_DO_RECURSO[k])).join(', ') }));
            return;
          }
          ordenar({ t: 'melhorar', predio: predio.id, m });
          tocar('clique');
        }}
      >
        <span className="tocas-botao-nome">{t(NOME_DA_MELHORIA[m])}</span>
        {custo(d.custo)}
      </button>
    );
  };

  /**
   * O MERCADO (a novidade da era 2): cada botão é uma troca, em figuras (o recurso que sai, a seta, o que entra e quanto). O
   * preço anda: vender o mesmo barateia.
   */
  const botoesDoMercado = (predioId: number) =>
    RECURSOS.flatMap((de) =>
      RECURSOS.filter((para) => para !== de).map((para) => {
        const ganho = precoDaTroca(sim, eu, de, para);
        const pode = painel.recursos[de] >= MERCADO.lote;
        const rotulo = t('Trocar {qtd} de {de} por {ganho} de {para}', { qtd: MERCADO.lote, de: t(NOME_DO_RECURSO[de]), ganho, para: t(NOME_DO_RECURSO[para]) });
        return (
          <button
            key={`${de}-${para}`}
            type="button"
            className="tocas-botao tocas-troca"
            aria-disabled={!pode}
            title={rotulo}
            aria-label={rotulo}
            onClick={() => {
              if (!pode) return void tocar('erro');
              ordenar({ t: 'trocar', predio: predioId, de, para });
              tocar('clique');
            }}
          >
            <span className={`tocas-rec-${de}${pode ? '' : ' falta'}`}>
              <img src={ICONE(de)} alt="" />
              {MERCADO.lote}
            </span>
            <span aria-hidden="true">→</span>
            <span className={`tocas-rec-${para}`}>
              <img src={ICONE(para)} alt="" />
              {ganho}
            </span>
          </button>
        );
      }),
    );

  const botaoSino = (classe: string) => {
    const meuCentro = sim.predios.find((p) => p.dono === eu && p.tipo === 'centro');
    const rotulo = painel.sino ? t('Tocar o sino de novo: todos de volta ao trabalho') : t('Tocar o sino: todos os trabalhadores para dentro do centro da vila');
    return (
      <button
        type="button"
        className={`${classe} tocas-sino${painel.sino ? ' ativo' : ''}`}
        title={rotulo}
        aria-label={rotulo}
        aria-pressed={painel.sino}
        disabled={!meuCentro || acabou}
        onClick={() => {
          if (!meuCentro) return;
          ordenar({ t: 'sino', predio: meuCentro.id });
          tocar('clique');
        }}
      >
        <Bell size={20} aria-hidden="true" />
        {painel.sino && painel.abrigados > 0 && <span className="tocas-atalho-numero">{painel.abrigados}</span>}
      </button>
    );
  };

  const maravilha = painel.maravilha;
  return (
    <div className="tocas">
      <div className="tocas-moldura">
      <div className="tocas-topo">
        {RECURSOS.map((k) => (
          <span key={k} className={`tocas-recurso tocas-rec-${k}`} title={t(NOME_DO_RECURSO[k])}>
            <img src={ICONE(k)} alt={t(NOME_DO_RECURSO[k])} />
            <span className="tocas-recurso-qtd">{Math.floor(painel.recursos[k])}</span>
            <span className="tocas-recurso-taxa">+{painel.taxa[k]}</span>
          </span>
        ))}
        <span className={`tocas-recurso${painel.pop.usada >= painel.pop.max ? ' cheia' : ''}`} title={t('População')}>
          <img src={ICONE('populacao')} alt={t('População')} />
          <span className="tocas-recurso-qtd">
            {painel.pop.usada}/{painel.pop.max}
          </span>
        </span>
        <span className="tocas-era">{t('Era {n}', { n: painel.era })}</span>
        <span className="tocas-relogio">{relogio(painel.passo)}</span>
        {maravilha[0] > 0 && <span className="tocas-maravilha">{t('Maravilha: {tempo}', { tempo: relogio(PASSOS_DA_MARAVILHA - maravilha[0]) })}</span>}
        {maravilha[1] > 0 && <span className="tocas-maravilha inimiga">{outro ? t('Maravilha de {nome}: {tempo}', { nome: outro, tempo: relogio(PASSOS_DA_MARAVILHA - maravilha[1]) }) : t('Maravilha do computador: {tempo}', { tempo: relogio(PASSOS_DA_MARAVILHA - maravilha[1]) })}</span>}
        <button type="button" className="tocas-desistir" disabled={acabou} onClick={() => void agir({ tipo: 'desistir', passos: sim.passo })}>
          {t('Desistir')}
        </button>
      </div>
        <div
          ref={caixa}
          className={`tocas-caixa${pronta ? '' : ' carregando'}${colocando ? ' colocando' : ''}`}
          onPointerDown={aoApertar}
          onPointerMove={aoMover}
          onPointerUp={aoSoltar}
          onPointerCancel={aoSoltar}
          onWheel={aoRolar}
          onDoubleClick={aoDuploClique}
          onContextMenu={(e) => e.preventDefault()}
        >
          <div ref={caixaSel} className="tocas-selecao" />
        </div>
        <div ref={camadaDosSelos} className="tocas-selos" aria-hidden="true" />
        {aviso && <div className="tocas-aviso">{aviso}</div>}
        {acabou && (
          <div className="tocas-acabou">{sim.vencedor === eu ? t('Vitória!') : t('Derrota')}</div>
        )}
        {espera && !acabou && <div className="tocas-espera" role="status">{espera}</div>}
        {tutorial && !acabou && (
          <div className="tocas-tutorial" role="status">
            <span className="tocas-tutorial-passos" aria-hidden="true">
              {PASSOS_DO_TUTORIAL.map((_, i) => (
                <i key={i} className={i < passoDoTutorial ? 'feito' : i === passoDoTutorial ? 'agora' : ''} />
              ))}
            </span>
            {passoDoTutorial < PASSOS_DO_TUTORIAL.length ? t(PASSOS_DO_TUTORIAL[passoDoTutorial].texto) : t('Pronto! Agora é com você: derrube o centro da vila do computador.')}
          </div>
        )}
      <div className="tocas-baixo">
        <canvas ref={mapa} className="tocas-mapa" width={TAMANHO * 3} height={TAMANHO * 3} onPointerDown={aoTocarNoMapa} onPointerMove={(e) => e.buttons === 1 && aoTocarNoMapa(e)} onContextMenu={(e) => e.preventDefault()} />
        {/* os atalhos são ÍCONES ao lado do minimapa, sem texto (pedido dele, 06/11/2026) */}
        <div className="tocas-atalhos">
          <button type="button" className="tocas-atalho" onClick={irAoCentro} title={t('Centro da vila')} aria-label={t('Centro da vila')}>
            <IconeDeHud nome="casa" tamanho={22} />
          </button>
          <button
            type="button"
            className={`tocas-atalho${painel.ociosos ? ' alerta' : ''}`}
            title={t('Trabalhador parado')}
            aria-label={`${t('Trabalhador parado')}: ${painel.ociosos}`}
            onClick={() => {
              const ociosos = sim.unidades.filter((u) => u.dono === eu && u.tipo === 'trabalhador' && u.ordem.tipo === 'parado' && !u.abrigado);
              if (!ociosos.length) return void tocar('erro');
              const atual = selRef.current.length === 1 ? ociosos.findIndex((u) => u.id === selRef.current[0]) : -1;
              const u = ociosos[(atual + 1) % ociosos.length];
              escolher([u.id]);
              vistaRef.current?.centrar(u.x, u.y);
            }}
          >
            <IconeDeHud nome="peao" tamanho={22} />
            {painel.ociosos > 0 && <span className="tocas-atalho-numero">{painel.ociosos}</span>}
          </button>
          <button
            type="button"
            className="tocas-atalho"
            title={t('Exército')}
            aria-label={t('Exército')}
            onClick={() => escolher(sim.unidades.filter((u) => u.dono === eu && UNIDADES[u.tipo].combate).map((u) => u.id))}
          >
            <IconeDeHud nome="punho" tamanho={22} />
          </button>
          {botaoSino('tocas-atalho')}
        </div>
        <div className="tocas-info">
          {unico ? (
            <>
              <p className="tocas-info-nome">
                {eFonte(unico) ? t(unico.tipo === 'arvore' ? 'Madeira' : 'Ouro') : t(NOME[unico.tipo])}
                {!eFonte(unico) && unico.dono !== eu && <span className="tocas-inimigo"> · {deles}</span>}
              </p>
              {eFonte(unico) ? (
                <p className="tocas-info-linha">{Math.floor(unico.qtd)}</p>
              ) : (
                <div className="tocas-vida" style={{ ['--vida' as string]: String(Math.max(0, unico.vida / unico.vidaMax)) }}>
                  <span />
                  <small>
                    {Math.ceil(unico.vida)}/{unico.vidaMax}
                  </small>
                </div>
              )}
              {eUnidade(unico) && unico.carga && (
                <p className="tocas-info-linha">
                  {t(NOME_DO_RECURSO[unico.carga.rec])}: {unico.carga.qtd}
                </p>
              )}
              {predio && !predio.pronto && <p className="tocas-info-linha">{Math.floor((predio.progresso / PREDIOS[predio.tipo].tempo) * 100)}%</p>}
              {predio && predio.dono === eu && (predio.fila.length > 0 || predio.pesquisa > 0 || !!predio.estudo) && (
                <div className="tocas-fila">
                  {predio.pesquisa > 0 ? (
                    <span className="tocas-fila-item">
                      {t('Avançando de era…')} {Math.floor((predio.pesquisa / ERA2.tempo) * 100)}%
                    </span>
                  ) : predio.estudo ? (
                    <span className="tocas-fila-item">
                      {t(NOME_DA_MELHORIA[predio.estudo])} {Math.floor((predio.estudoPassos / MELHORIAS[predio.estudo].tempo) * 100)}%
                    </span>
                  ) : (
                    predio.fila.map((u, i) => (
                      <span key={i} className={`tocas-fila-item${i === 0 && predio.treino >= UNIDADES[u].tempo ? ' esperando' : ''}`}>
                        {t(NOME[u])}
                        {i === 0 && (predio.treino >= UNIDADES[u].tempo ? ` · ${t('Falta casa')}` : ` ${Math.floor((predio.treino / UNIDADES[u].tempo) * 100)}%`)}
                      </span>
                    ))
                  )}
                  <button type="button" className="tocas-cancelar" onClick={() => ordenar({ t: 'cancelar', predio: predio.id })} aria-label={t('Cancelar')}>
                    ✕
                  </button>
                </div>
              )}
            </>
          ) : unidades.length > 1 ? (
            <div className="tocas-grupo">
              {(Object.keys(UNIDADES) as TipoUnidade[])
                .filter((k) => unidades.some((u) => u.tipo === k))
                .map((k) => (
                  <span key={k} className="tocas-grupo-item">
                    {t(NOME[k])} × {unidades.filter((u) => u.tipo === k).length}
                  </span>
                ))}
            </div>
          ) : null}
        </div>
        <div className="tocas-acoes">
          {trabalhadores.length > 0 && CONSTRUIVEIS.map(botaoConstruir)}
          {predio && predio.dono === eu && predio.pronto && (
            <>
              {(Object.keys(UNIDADES) as TipoUnidade[]).filter((k) => UNIDADES[k].de === predio.tipo).map(botaoTreinar)}
              {predio.tipo === 'centro' && botaoSino('tocas-botao')}
              {predio.tipo === 'ferreiro' && ORDEM_DAS_MELHORIAS.filter((m) => !temMelhoria(sim, eu, m)).map(botaoMelhoria)}
              {predio.tipo === 'mercado' && botoesDoMercado(predio.id)}
              {predio.tipo === 'centro' && painel.era === 1 && predio.pesquisa === 0 && (
                <button
                  type="button"
                  className="tocas-botao era"
                  aria-disabled={!podePagar(sim, eu, ERA2.custo)}
                  onClick={() => {
                    if (!podePagar(sim, eu, ERA2.custo)) return void tocar('erro');
                    ordenar({ t: 'era', predio: predio.id });
                    tocar('clique');
                  }}
                >
                  <span className="tocas-botao-nome">{t('Avançar de era')}</span>
                  {custo(ERA2.custo)}
                </button>
              )}
            </>
          )}
          {colocando?.tipo === 'muralha' && <p className="tocas-dica">{colocando.inicio ? t('Agora a outra ponta da muralha.') : t('Escolha onde a muralha começa.')}</p>}
          {predioQueTreina() && !colocando && <p className="tocas-dica">{t('Botão direito no mapa: para onde vai quem nasce aqui.')}</p>}
        </div>
      </div>
      </div>
      <ComandosDoJogo
        itens={[
          { teclas: ['mouse-arrastar'], toque: 'toque', rotulo: t('Escolher') },
          { teclas: ['mouse-direito'], rotulo: t('Botão direito: mandar') },
          { teclas: ['setas'], toque: 'toque-arrastar', rotulo: t('Mover o mapa') },
        ]}
      />
    </div>
  );
}

function pertoDeCasa(sim: Sim, eu: Dono, x: number, y: number): boolean {
  const c = sim.predios.find((p) => p.dono === eu && p.tipo === 'centro');
  if (!c) return false;
  const dx = x - (c.gx + 1.5);
  const dy = y - (c.gy + 1.5);
  return dx * dx + dy * dy < 15 * 15;
}

/** O que o botão direito faria agora, debaixo do mouse: o cursor mostra (vazio, o ponteiro de sempre). */
type Acao = 'mover' | 'recolher' | 'atacar' | 'construir' | 'reunir';
const ICONE_DA_ACAO: Record<Acao, NomeDoIconeDeHud> = { mover: 'mao', recolher: 'cesta', atacar: 'mira', construir: 'chave', reunir: 'bandeira' };

function acaoDoMouse(sim: Sim, eu: Dono, v: Vista, sel: number[], px: number, py: number): Acao | '' {
  const escolhidos = sel.map((x) => sim.porId.get(x));
  const us = escolhidos.filter(eUnidade).filter((u) => u.dono === eu && !u.abrigado);
  if (!us.length) {
    // o prédio que treina, escolhido sozinho: o direito marca o ponto de reunião
    const p = escolhidos.length === 1 ? escolhidos[0] : undefined;
    if (ePredio(p) && p.dono === eu && p.pronto && (Object.keys(UNIDADES) as TipoUnidade[]).some((k) => UNIDADES[k].de === p.tipo)) return 'reunir';
    return '';
  }
  const id = v.pegar(px, py);
  const e = id !== null ? sim.porId.get(id) : undefined;
  const trabalhador = us.some((u) => u.tipo === 'trabalhador');
  if (!e) return v.chao(px, py) ? 'mover' : '';
  if (eFonte(e)) return trabalhador ? 'recolher' : 'mover';
  if (e.dono !== eu) return 'atacar';
  if (ePredio(e) && trabalhador) {
    if (!e.pronto) return 'construir';
    if (e.tipo === 'fazenda') return 'recolher';
  }
  return eUnidade(e) ? '' : 'mover';
}

function vezes(c: Custo, n: number): Custo {
  const r: Custo = {};
  for (const k of RECURSOS) if (c[k]) r[k] = c[k]! * n;
  return r;
}

function lerPainel(sim: Sim, eu: Dono, versao: number, entregas: { passo: number; rec: Recurso; qtd: number }[]): Painel {
  const j = sim.jogadores[eu];
  const taxa: Record<Recurso, number> = { comida: 0, madeira: 0, ouro: 0 };
  for (const e of entregas) if (e.passo > sim.passo - JANELA_DA_TAXA) taxa[e.rec] += e.qtd;
  // no primeiro minuto, a média do que já passou (senão a taxa começaria pequena demais)
  const passou = Math.max(PASSOS_POR_SEGUNDO * 10, Math.min(JANELA_DA_TAXA, sim.passo));
  for (const k of RECURSOS) taxa[k] = Math.round((taxa[k] * JANELA_DA_TAXA) / passou);
  return {
    recursos: { ...j.recursos },
    taxa,
    pop: populacao(sim, eu),
    era: j.era,
    passo: sim.passo,
    maravilha: [sim.jogadores[eu].maravilha, sim.jogadores[1 - eu].maravilha],
    ociosos: sim.unidades.filter((u) => u.dono === eu && u.tipo === 'trabalhador' && u.ordem.tipo === 'parado' && !u.abrigado).length,
    sino: !!sim.predios.find((p) => p.dono === eu && p.tipo === 'centro')?.sino,
    abrigados: sim.unidades.filter((u) => u.dono === eu && u.abrigado).length,
    versao,
  };
}

/** O minimapa: o mapa inteiro, a névoa, os prédios e as unidades, e o retângulo do que a tela mostra. */
function desenharMapa(tela: HTMLCanvasElement | null, sim: Sim, eu: Dono, vista: Vista) {
  if (!tela) return;
  const g = tela.getContext('2d');
  if (!g) return;
  const k = tela.width / TAMANHO;
  const j = sim.jogadores[eu];
  g.fillStyle = '#6f9a52';
  g.fillRect(0, 0, tela.width, tela.height);
  for (const f of sim.fontes) {
    if (!j.explorado[f.gy * TAMANHO + f.gx]) continue;
    g.fillStyle = f.tipo === 'arvore' ? '#2f5a2c' : '#f0cf3c';
    g.fillRect(f.gx * k, f.gy * k, k, k);
  }
  g.fillStyle = '#4f86b8';
  for (const a of sim.agua) if (j.explorado[a.gy * TAMANHO + a.gx]) g.fillRect(a.gx * k, a.gy * k, k, k);
  g.fillStyle = '#8b8577';
  for (const p of sim.pedras) if (j.explorado[p.gy * TAMANHO + p.gx]) g.fillRect(p.gx * k, p.gy * k, k, k);
  for (const p of sim.predios) {
    if (p.dono !== eu && !j.explorado[p.gy * TAMANHO + p.gx]) continue;
    g.fillStyle = CORES[p.dono];
    g.fillRect(p.gx * k, p.gy * k, p.tam * k, p.tam * k);
  }
  for (const u of sim.unidades) {
    if (u.abrigado || (u.dono !== eu && !j.visivel[Math.floor(u.y) * TAMANHO + Math.floor(u.x)])) continue;
    g.fillStyle = u.dono === 0 ? '#bcd3ff' : '#ffb3a8';
    g.fillRect(u.x * k - 1.5, u.y * k - 1.5, 3, 3);
  }
  for (let y = 0; y < TAMANHO; y++)
    for (let x = 0; x < TAMANHO; x++) {
      const i = y * TAMANHO + x;
      if (j.visivel[i]) continue;
      g.fillStyle = j.explorado[i] ? 'rgba(10,14,20,0.4)' : 'rgba(10,14,20,0.9)';
      g.fillRect(x * k, y * k, k, k);
    }
  const c = vista.cantos();
  g.strokeStyle = '#ffffff';
  g.lineWidth = 1.5;
  g.beginPath();
  c.forEach((p, i) => (i ? g.lineTo(p.x * k, p.y * k) : g.moveTo(p.x * k, p.y * k)));
  g.closePath();
  g.stroke();
}
