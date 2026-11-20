import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { desenhoDoCoelho, folhaDe, FOLHA } from './briga/desenho';
import {
  alturaDoBicho,
  ALTURA_PX,
  CASA_PX,
  carregarBichos,
  COR_DO_ELEMENTO,
  desenharBicho,
  desenharCampo,
  desenharAchado,
  desenharFundoDaLuta,
  LARGURA_PX,
  NOME_DO_ELEMENTO,
  type PoseDoBicho,
} from './bichos/desenho';
import { antesDe, DESAFIANTES, DIRECOES, eficacia, ELEMENTOS, ESPECIES, GOLPES, VENCE, INICIAIS, mapaDe, passoNoMapa, PRECOS, TAMANHO_DA_EQUIPE, type DadosDoGolpe } from './bichos/regras';
import { useT } from './i18n';
import { useJanelaComFoco } from './janelaComFoco';
import { primeiraForma, type Partida } from './minijogos';
import { tocar } from './somDosJogos';
import './bichos.css';

/**
 * BICHOS DA TOCA (16/11/2026; o servidor é server/src/minijogo-bichos.ts, as regras bichos/regras.ts). No Solo, a aventura: o
 * campo visto de cima, o primeiro bicho, o mato, a luta por turnos, a cenoura da amizade e a casa do desafio. Na sala, a luta
 * entre duas pessoas na mesa. A tela só escolhe: cada passo e cada golpe vão ao servidor, e o que volta é contado aqui, um
 * acontecimento por vez (a vida desce junto com o texto).
 *
 * Os nomes dos bichos (Brotel, Tisco…) são nomes próprios inventados, iguais em todo idioma; os golpes e os elementos passam
 * pelo t(), pela primeira forma ("Raio" tem alternativas, por ser palavra do Desenha e adivinha).
 */

interface BichoNaLuta {
  especie: string;
  nivel: number;
  pv: number;
  pvMax: number;
  golpes?: string[];
  /** Os efeitos da luta (19/11/2026): o cochilo ou o veneno, e os degraus de ataque e defesa. */
  estado?: 'cochilo' | 'veneno';
  atqD?: number;
  defD?: number;
}
interface LadoNaTela {
  ativo: number;
  precisaTrocar: boolean;
  equipe: BichoNaLuta[];
  escolheu?: boolean;
}
interface BichoDaEquipe extends BichoNaLuta {
  id: number;
  golpes: string[];
  xpDoNivel: number;
  xpParaSubir: number;
}
type Evento = { id: number; t: string; [k: string]: unknown };

interface EstadoSolo {
  modo: 'solo';
  fase: 'inicial' | 'mapa' | 'batalha';
  partidaId: string;
  avatar: number | string | null;
  /** A tela do mapa (campo, bosque, serra). */
  mapa?: string;
  moedas?: number;
  caderno?: { vistos: string[]; pegos: string[] };
  escada?: number[];
  vencidos?: string[];
  achados?: string[];
  /** De pé na porta da lojinha. */
  loja?: boolean;
  x: number;
  y: number;
  equipe: BichoDaEquipe[];
  toca: number;
  cenouras: number;
  chas: number;
  desafios: number;
  luta: { tipo: 'mato' | 'desafio' | 'pessoa'; acabou: string | null; meu: LadoNaTela; outro: LadoNaTela; chance: number } | null;
  eventos: Evento[];
}
interface EstadoSala {
  modo: 'sala';
  /** Todos lutam neste nível (19/11/2026). */
  nivel?: number;
  fase: 'esperando' | 'escolhendo' | 'fim';
  partidaId: string;
  lugares: { userId: number; username: string; emprestada: boolean }[];
  meuLado: number;
  lados: [LadoNaTela, LadoNaTela] | null;
  precisaEscolher: boolean;
  vencedor: number | null;
  eventos: Evento[];
}
export type EstadoBichos = EstadoSolo | EstadoSala;

const nomeDe = (especie: unknown) => ESPECIES[String(especie)]?.nome ?? '?';
const clonar = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

/** O texto de um acontecimento, traduzido. `meu`: o lado de quem olha (para "você" no fim). */
function textoDo(e: Evento, t: ReturnType<typeof useT>, nomeDaPessoa: (id: number) => string): string {
  const nome = nomeDe(e.especie);
  switch (e.t) {
    case 'golpe': {
      const frase = t('{nome} usou {golpe}!', { nome, golpe: primeiraForma(t(GOLPES[String(e.golpe)]?.nome ?? '')) });
      if (e.apoio) return frase;
      if (e.efic === 2) return `${frase} ${t('Funcionou muito bem!')}`;
      if (e.efic === 0.5) return `${frase} ${t('Não funcionou muito bem.')}`;
      return frase;
    }
    case 'sono':
      return t('{nome} pegou no sono.', { nome });
    case 'errou':
      return t('{nome} errou o golpe.', { nome });
    case 'efeito':
      return `${ICONE_DO_EFEITO[String(e.efeito)] ?? ''} ${textoDoEfeito(String(e.efeito), nome, t)}`.trim();
    case 'moedas':
      return `🪙 ${t('Você ganhou {n} moedas.', { n: Number(e.n) })}`;
    case 'raro':
      return t('Um bicho raro apareceu: {nome}!', { nome });
    case 'espera':
      return t('{nome} espera você vencer {antes} primeiro.', { nome: String(e.nome), antes: String(e.antes) });
    case 'achou':
      return `${ICONE_DO_ITEM[String(e.item)] ?? ''} +${Number(e.qtd)}`;
    case 'comprou':
      return `${ICONE_DO_ITEM[String(e.item)] ?? ''} +1`;
    case 'troca':
      return t('{nome} entrou na luta!', { nome });
    case 'cha':
      return t('{nome} tomou chá e se sentiu melhor.', { nome });
    case 'apareceu':
      return t('{nome} apareceu no mato!', { nome });
    case 'desafio':
      return t('{nome} desafia você!', { nome: String(e.nome) });
    case 'amigo':
      return t('{nome} virou seu amigo!', { nome });
    case 'recusou':
      return t('{nome} não quis a cenoura.', { nome });
    case 'toca':
      return t('{nome} foi morar na toca.', { nome });
    case 'nivel':
      return t('{nome} subiu para o nível {n}!', { nome, n: Number(e.n) });
    case 'evoluiu':
      return t('{nome} cresceu e virou {novo}!', { nome: nomeDe(e.de), novo: nomeDe(e.para) });
    case 'fugiu':
      return t('Você fugiu.');
    case 'naoFugiu':
      return t('Não deu para fugir!');
    case 'vitoria':
      return t('Vitória!');
    case 'venceuDesafio':
      return t('Você venceu o desafio!');
    case 'derrota':
      return t('Todos os seus bichos pegaram no sono. Vocês voltaram para casa.');
    case 'descansou':
      return t('Seus bichos descansaram.');
    case 'venceu':
      return t('{nome} venceu!', { nome: nomeDaPessoa(Number(e.userId)) });
    default:
      return '';
  }
}

/** O ícone de cada efeito da luta (na narração e no cartão do bicho). */
const ICONE_DO_EFEITO: Record<string, string> = {
  cochilou: '💤', cochilando: '💤', acordou: '☀️', envenenou: '🟣', veneno: '🟣', 'atq+': '⚔️▲', 'atq-': '⚔️▼', 'def+': '🛡️▲', 'def-': '🛡️▼',
  cura: '💚', falhou: '✖',
};
const ICONE_DO_ITEM: Record<string, string> = { cenoura: '🥕', cha: '🍵', moedas: '🪙' };

function textoDoEfeito(efeito: string, nome: string, t: ReturnType<typeof useT>): string {
  switch (efeito) {
    case 'cochilou':
      return t('{nome} cochilou.', { nome });
    case 'cochilando':
      return t('{nome} está cochilando.', { nome });
    case 'acordou':
      return t('{nome} acordou.', { nome });
    case 'envenenou':
      return t('O veneno pegou {nome}.', { nome });
    case 'veneno':
      return t('{nome} sentiu o veneno.', { nome });
    case 'atq+':
      return t('{nome} ficou com mais ataque.', { nome });
    case 'atq-':
      return t('{nome} ficou com menos ataque.', { nome });
    case 'def+':
      return t('{nome} ficou com mais defesa.', { nome });
    case 'def-':
      return t('{nome} ficou com menos defesa.', { nome });
    case 'cura':
      return t('{nome} recuperou vida.', { nome });
    default:
      return t('Não fez efeito.');
  }
}

/** O ícone do que um golpe faz além do dano (nos botões): o efeito, ir primeiro, a precisão. */
function iconesDoGolpe(g: DadosDoGolpe): string {
  const ef = g.efeito;
  const partes: string[] = [];
  if (ef) partes.push(ef.tipo === 'cochilo' ? '💤' : ef.tipo === 'veneno' ? '🟣' : ef.tipo === 'cura' ? '💚' : `${ef.tipo === 'atq' ? '⚔️' : '🛡️'}${(ef.valor ?? 1) > 0 ? '▲' : '▼'}`);
  if (g.prioridade) partes.push('⏩');
  if (g.precisao !== undefined && g.precisao < 1) partes.push(`🎯${Math.round(g.precisao * 100)}%`);
  return partes.join(' ');
}

function somDo(e: Evento) {
  if (e.t === 'golpe') tocar(e.apoio ? 'item' : 'soco');
  else if (e.t === 'errou') tocar('erro');
  else if (e.t === 'efeito') tocar(e.efeito === 'cura' ? 'cura' : e.efeito === 'veneno' ? 'dano' : 'item');
  else if (e.t === 'moedas' || e.t === 'achou' || e.t === 'comprou') tocar('moeda');
  else if (e.t === 'raro') tocar('medalha');
  else if (e.t === 'amigo' || e.t === 'venceuDesafio') tocar('chegada');
  else if (e.t === 'recusou' || e.t === 'naoFugiu') tocar('erro');
  else if (e.t === 'nivel' || e.t === 'evoluiu') tocar('moeda');
  else if (e.t === 'sono') tocar('queda');
  else if (e.t === 'vitoria' || e.t === 'venceu') tocar('fim');
}

/** O selo do elemento: a cor e o nome. */
export function Selo({ especie }: { especie: string }) {
  const t = useT();
  const el = ESPECIES[especie]?.elemento;
  if (!el) return null;
  return (
    <span className="bichos-selo" style={{ '--cor': COR_DO_ELEMENTO[el] } as CSSProperties}>
      {primeiraForma(t(NOME_DO_ELEMENTO[el]))}
    </span>
  );
}

export function BarraDeVida({ pv, pvMax }: { pv: number; pvMax: number }) {
  const pct = Math.max(0, Math.min(100, (pv / Math.max(1, pvMax)) * 100));
  return (
    <span className={`bichos-vida${pct < 25 ? ' pouca' : pct < 50 ? ' meia' : ''}`} aria-label={`${pv}/${pvMax}`}>
      <span style={{ width: `${pct}%` }} />
    </span>
  );
}

/** Um bicho pequeno, desenhado numa tela própria (a folha pode chegar depois: tenta de novo por alguns segundos). */
export function Retrato({ especie, dormindo = false, tamanho = 48 }: { especie: string; dormindo?: boolean; tamanho?: number }) {
  const tela = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    carregarBichos([especie]);
    let vezes = 0;
    const desenhar = () => {
      const c = tela.current;
      const g = c?.getContext('2d');
      if (!c || !g) return;
      g.clearRect(0, 0, c.width, c.height);
      g.imageSmoothingEnabled = false;
      // o bicho ocupa a altura do quadro, seja ele um besouro ou um dragão
      desenharBicho(g, especie, c.width / 2, c.height - 4, 1, Math.min(2.5, (c.height - 8) / alturaDoBicho(especie)), dormindo ? 'dormindo' : 'parado', 0);
    };
    desenhar();
    const relogio = setInterval(() => {
      desenhar();
      if (++vezes > 15) clearInterval(relogio);
    }, 250);
    return () => clearInterval(relogio);
  }, [especie, dormindo]);
  return <canvas ref={tela} className="bichos-retrato" width={tamanho} height={tamanho} aria-hidden="true" />;
}

export function JogoBichos({ estado: partida, eu, jogador, agir }: { estado: Partida; eu: number; jogador: boolean; agir: (corpo: Record<string, unknown>) => Promise<void> }) {
  const estado = partida as unknown as EstadoBichos;
  if (import.meta.env.DEV) window.bichosEstado = estado;
  if (estado.modo === 'sala') return <LutaNaSala estado={estado} eu={eu} jogador={jogador} agir={agir} />;
  return <Aventura estado={estado} agir={agir} />;
}

// ------------------------------------------------------------------ OS ACONTECIMENTOS, UM POR VEZ
/**
 * A fila dos acontecimentos: cada um fica ~1 s na tela, e a luta mostrada anda com eles (a vida desce, quem dorme deita, a troca
 * entra). Quando a fila acaba, a tela volta ao estado do servidor. `lados`: o par de agora, na ordem do servidor.
 */
function useNarracao(eventos: Evento[], lados: [LadoNaTela, LadoNaTela] | null, partidaId: string) {
  // quem abre a tela no meio (recarregou, voltou ao jogo) não revê o que já passou
  const ultimo = useRef(eventos.length ? eventos[eventos.length - 1].id : 0);
  const anteriores = useRef<[LadoNaTela, LadoNaTela] | null>(null);
  const [fila, setFila] = useState<Evento[]>([]);
  const [vista, setVista] = useState<[LadoNaTela, LadoNaTela] | null>(lados);
  const [atual, setAtual] = useState<Evento | null>(null);
  const [golpe, setGolpe] = useState<{ lado: number; em: number; apoio?: boolean } | null>(null);
  const partida = useRef(partidaId);

  useEffect(() => {
    if (partida.current !== partidaId) {
      partida.current = partidaId;
      ultimo.current = 0;
    }
    const novos = eventos.filter((e) => e.id > ultimo.current);
    if (novos.length) ultimo.current = novos[novos.length - 1].id;
    if (novos.length) {
      setVista(anteriores.current && lados ? clonar(anteriores.current) : lados && clonar(lados));
      setFila((f) => [...f, ...novos]);
    } else if (!fila.length) setVista(lados && clonar(lados));
    anteriores.current = lados && clonar(lados);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventos, lados, partidaId]);

  useEffect(() => {
    if (atual || !fila.length) {
      if (!atual && !fila.length) setVista(anteriores.current && clonar(anteriores.current));
      return;
    }
    const [e, ...resto] = fila;
    setFila(resto);
    setAtual(e);
    somDo(e);
    setVista((v) => {
      if (!v) return v;
      const n = clonar(v);
      const l = Number(e.lado);
      if (e.t === 'golpe') {
        const alvo = n[1 - l];
        if (alvo?.equipe[alvo.ativo]) alvo.equipe[alvo.ativo].pv = Number(e.pv);
        setGolpe({ lado: l, em: performance.now(), apoio: !!e.apoio });
      } else if (e.t === 'efeito' && n[l]?.equipe[n[l].ativo]) {
        const b = n[l].equipe[n[l].ativo];
        if (e.pv !== undefined) b.pv = Number(e.pv);
        const ef = String(e.efeito);
        if (ef === 'cochilou') b.estado = 'cochilo';
        else if (ef === 'envenenou') b.estado = 'veneno';
        else if (ef === 'acordou') delete b.estado;
        else if (/^(atq|def)[+-]$/.test(ef)) {
          const k = ef.startsWith('atq') ? 'atqD' : 'defD';
          b[k] = Math.max(-3, Math.min(3, (b[k] ?? 0) + (ef.endsWith('+') ? 1 : -1)));
        }
      } else if (e.t === 'troca' && n[l]) n[l].ativo = Number(e.i);
      else if (e.t === 'cha' && n[l]?.equipe[n[l].ativo]) n[l].equipe[n[l].ativo].pv = Number(e.pv);
      return n;
    });
  }, [fila, atual]);

  // cada acontecimento fica um pouco na tela (num efeito à parte: o de cima roda de novo quando a fila anda, e levaria o relógio junto)
  useEffect(() => {
    if (!atual) return;
    const relogio = setTimeout(() => setAtual(null), atual.t === 'golpe' ? 1100 : 1300);
    return () => clearTimeout(relogio);
  }, [atual]);

  return { vista, atual, ocupado: atual !== null || fila.length > 0, golpe };
}

// ------------------------------------------------------------------ A TELA DA LUTA
/** O palco da luta, de lado: o meu embaixo à esquerda, o outro em cima à direita. `meu`: o índice do meu lado no par. */
function PalcoDaLuta({ lados, meu, golpe, desafio }: { lados: [LadoNaTela, LadoNaTela]; meu: number; golpe: { lado: number; em: number; apoio?: boolean } | null; desafio: boolean }) {
  const t = useT();
  const tela = useRef<HTMLCanvasElement>(null);
  const comFoco = useJanelaComFoco();
  const agora = useRef({ lados, meu, golpe });
  agora.current = { lados, meu, golpe };
  useEffect(() => {
    carregarBichos(lados.flatMap((l) => l.equipe.map((b) => b.especie)));
  }, [lados]);
  useEffect(() => {
    // sem foco, nada se desenha (a regra do Syden: o jogo da pessoa vem primeiro)
    if (!comFoco) return;
    let quadro = 0;
    const desenhar = (tempo: number) => {
      const c = tela.current;
      const g = c?.getContext('2d');
      if (c && g) {
        g.imageSmoothingEnabled = false;
        const { lados: ls, meu: m, golpe: gp } = agora.current;
        desenharFundoDaLuta(g, c.width, c.height, desafio);
        for (const [lado, sx, sy, vira, escala] of [[1 - m, 236, 112, -1, 1.25], [m, 92, 168, 1, 1.6]] as const) {
          const l = ls[lado];
          const b = l?.equipe[l.ativo];
          if (!b) continue;
          const desde = gp ? tempo - gp.em : 9999;
          let pose: PoseDoBicho = b.pv <= 0 ? 'dormindo' : 'parado';
          let dx = 0;
          if (gp && desde < 380 && b.pv > 0) {
            if (gp.lado === lado) {
              pose = 'golpe';
              dx = vira * Math.sin((desde / 380) * Math.PI) * 14;
            } else if (desde > 160 && !gp.apoio) {
              pose = 'dor';
              dx = -vira * 3 * Math.sin(desde / 20);
            }
          }
          desenharBicho(g, b.especie, sx + dx, sy, vira, escala, pose, tempo);
        }
      }
      quadro = requestAnimationFrame(desenhar);
    };
    quadro = requestAnimationFrame(desenhar);
    return () => cancelAnimationFrame(quadro);
  }, [comFoco, desafio]);

  const cartao = (lado: number, onde: string) => {
    const l = lados[lado];
    const b = l?.equipe[l.ativo];
    if (!b) return null;
    return (
      <div className={`bichos-cartao ${onde}`}>
        <strong>{nomeDe(b.especie)}</strong> <Selo especie={b.especie} /> <small>{`${t('Nível')} ${b.nivel}`}</small>
        <EfeitosDoBicho bicho={b} />
        <BarraDeVida pv={b.pv} pvMax={b.pvMax} />
        {onde === 'meu' && <small className="bichos-pv">{`${b.pv}/${b.pvMax}`}</small>}
        <span className="bichos-pontinhos" aria-hidden="true">
          {l.equipe.map((x, i) => (
            <i key={i} className={x.pv > 0 ? '' : 'dorme'} />
          ))}
        </span>
      </div>
    );
  };
  return (
    <div className="bichos-palco">
      <canvas ref={tela} className="bichos-tela-luta" width={320} height={190} />
      {cartao(1 - meu, 'outro')}
      {cartao(meu, 'meu')}
    </div>
  );
}

/** Os efeitos que o bicho carrega na luta, em ícones (o cochilo, o veneno, os degraus). */
function EfeitosDoBicho({ bicho }: { bicho: BichoNaLuta }) {
  const t = useT();
  const partes: [string, string][] = [];
  if (bicho.estado === 'cochilo') partes.push(['💤', t('{nome} está cochilando.', { nome: nomeDe(bicho.especie) })]);
  if (bicho.estado === 'veneno') partes.push(['🟣', t('{nome} sentiu o veneno.', { nome: nomeDe(bicho.especie) })]);
  for (const [k, icone] of [['atqD', '⚔️'], ['defD', '🛡️']] as const) {
    const d = bicho[k] ?? 0;
    if (d) partes.push([`${icone}${(d > 0 ? '▲' : '▼').repeat(Math.abs(d))}`, '']);
  }
  if (!partes.length) return null;
  return (
    <span className="bichos-efeitos">
      {partes.map(([icone, titulo]) => (
        <span key={icone} title={titulo || undefined}>
          {icone}
        </span>
      ))}
    </span>
  );
}

/**
 * Os botões dos golpes do bicho da frente, com o elemento de cada um. A VANTAGEM (20/11/2026): contra o bicho da frente do
 * outro lado, o selo ×2 (vale o dobro) ou ½ (vale a metade), pela mesma roda da regra (`eficacia`, bichos/regras.ts).
 */
function Golpes({ bicho, contra, desligado, aoEscolher }: { bicho: BichoNaLuta; contra?: BichoNaLuta | null; desligado: boolean; aoEscolher: (i: number) => void }) {
  const t = useT();
  const defesa = contra ? (ESPECIES[contra.especie]?.elemento ?? 'nenhum') : 'nenhum';
  return (
    <div className="bichos-golpes">
      {(bicho.golpes ?? []).map((g, i) => {
        const el = GOLPES[g]?.elemento ?? 'nenhum';
        const vale = GOLPES[g]?.poder ? eficacia(el, defesa) : 1;
        return (
          <button key={g} type="button" className="bichos-golpe" disabled={desligado} style={{ '--cor': COR_DO_ELEMENTO[el] } as CSSProperties} onClick={() => aoEscolher(i)}>
            {vale !== 1 && (
              <span className={`bichos-golpe-vantagem ${vale > 1 ? 'forte' : 'fraco'}`} aria-label={vale > 1 ? '×2' : '×½'}>
                {vale > 1 ? '×2' : '½'}
              </span>
            )}
            {primeiraForma(t(GOLPES[g].nome))}
            {el !== 'nenhum' && <small>{primeiraForma(t(NOME_DO_ELEMENTO[el]))}</small>}
            {iconesDoGolpe(GOLPES[g]) && <small className="bichos-golpe-efeito">{iconesDoGolpe(GOLPES[g])}</small>}
          </button>
        );
      })}
    </div>
  );
}

/** A lista para trocar o bicho da frente: os acordados que não estão lutando. */
function Troca({ lado, desligado, aoEscolher }: { lado: LadoNaTela; desligado: boolean; aoEscolher: (i: number) => void }) {
  const t = useT();
  return (
    <ul className="bichos-troca">
      {lado.equipe.map((b, i) => (
        <li key={i}>
          <button type="button" disabled={desligado || b.pv <= 0 || i === lado.ativo} onClick={() => aoEscolher(i)}>
            <Retrato especie={b.especie} dormindo={b.pv <= 0} tamanho={36} />
            <span>
              {nomeDe(b.especie)} <small>{`${t('Nível')} ${b.nivel}`}</small>
            </span>
            <BarraDeVida pv={b.pv} pvMax={b.pvMax} />
          </button>
        </li>
      ))}
    </ul>
  );
}

// ------------------------------------------------------------------ O SOLO: A AVENTURA
function Aventura({ estado, agir }: { estado: EstadoSolo; agir: (corpo: Record<string, unknown>) => Promise<void> }) {
  const t = useT();
  const lados = useMemo<[LadoNaTela, LadoNaTela] | null>(() => (estado.luta ? [estado.luta.meu, estado.luta.outro] : null), [estado.luta]);
  const narracao = useNarracao(estado.eventos, lados, estado.partidaId);
  const [trocando, setTrocando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  // o aviso do campo (descansou, achou algo, comprou, a casa da escada ainda fechada): aparece um pouco e some
  // (o que já tinha acontecido antes de a tela abrir não volta a avisar)
  const ultimoAviso = useRef(estado.eventos.length ? estado.eventos[estado.eventos.length - 1].id : 0);
  useEffect(() => {
    const e = [...estado.eventos].reverse().find((x) => ['descansou', 'achou', 'comprou', 'espera'].includes(x.t));
    if (e && e.id > ultimoAviso.current) {
      ultimoAviso.current = e.id;
      if (estado.fase === 'mapa') {
        setAviso(e.t === 'descansou' ? t('Seus bichos descansaram.') : textoDo(e, t, () => ''));
        tocar(e.t === 'espera' ? 'erro' : 'moeda');
        const r = setTimeout(() => setAviso(null), 2500);
        return () => clearTimeout(r);
      }
    }
  }, [estado.eventos, estado.fase, t]);

  if (estado.fase === 'inicial') {
    return (
      <div className="bichos bichos-inicial">
        <p className="bichos-titulo">{t('Escolha o seu primeiro bicho.')}</p>
        <div className="bichos-iniciais">
          {INICIAIS.map((e) => (
            <button key={e} type="button" className="bichos-inicial-cartao" onClick={() => void agir({ tipo: 'inicial', especie: e })}>
              <Retrato especie={e} tamanho={96} />
              <strong>{nomeDe(e)}</strong>
              <Selo especie={e} />
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (estado.fase === 'batalha' && estado.luta && narracao.vista) {
    const luta = estado.luta;
    const meu = luta.meu;
    const frente = meu.equipe[meu.ativo];
    const ocupado = narracao.ocupado;
    const fazer = (corpo: Record<string, unknown>) => {
      setTrocando(false);
      void agir(corpo);
    };
    return (
      <div className="bichos bichos-luta">
        <PalcoDaLuta lados={narracao.vista} meu={0} golpe={narracao.golpe} desafio={luta.tipo === 'desafio'} />
        <p className="bichos-narracao" aria-live="polite">
          {narracao.atual ? textoDo(narracao.atual, t, () => '') : ' '}
        </p>
        {!ocupado && luta.acabou && (
          <div className="bichos-acoes">
            <button type="button" className="btn-primary" onClick={() => fazer({ tipo: 'continuar' })}>
              {t('Continuar')}
            </button>
          </div>
        )}
        {!ocupado && !luta.acabou && (meu.precisaTrocar || trocando) && (
          <Troca lado={meu} desligado={ocupado} aoEscolher={(i) => fazer({ tipo: 'trocar', i })} />
        )}
        {!ocupado && !luta.acabou && !meu.precisaTrocar && !trocando && frente && (
          <>
            <Golpes bicho={frente} contra={luta.outro.equipe[luta.outro.ativo]} desligado={ocupado} aoEscolher={(i) => fazer({ tipo: 'golpe', i })} />
            <div className="bichos-acoes">
              {luta.tipo === 'mato' && (
                <button type="button" className="btn-secondary bichos-cenoura" disabled={estado.cenouras <= 0} onClick={() => fazer({ tipo: 'cenoura' })}>
                  🥕 {t('Oferecer cenoura')} <small>{estado.cenouras}</small>
                </button>
              )}
              <button type="button" className="btn-secondary" disabled={estado.chas <= 0 || frente.pv >= frente.pvMax} onClick={() => fazer({ tipo: 'cha' })}>
                🍵 {t('Chá')} <small>{estado.chas}</small>
              </button>
              {meu.equipe.some((b, i) => b.pv > 0 && i !== meu.ativo) && (
                <button type="button" className="btn-secondary" onClick={() => setTrocando(true)}>
                  {t('Trocar')}
                </button>
              )}
              {luta.tipo === 'mato' && (
                <button type="button" className="btn-secondary" onClick={() => fazer({ tipo: 'fugir' })}>
                  {t('Fugir')}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    );
  }

  return <Campo estado={estado} agir={agir} aviso={aviso} />;
}

declare global {
  interface Window {
    /** Para o e2e (só no site de desenvolvimento): onde o coelho está, e quantos passos esperam o servidor. */
    bichosDoTeste?: { x: number; y: number; fila: number; mapa?: string };
    bichosEstado?: EstadoBichos;
  }
}

/**
 * O campo visto de cima, com o coelho andando casa a casa (cada passo vai ao servidor, que confere e sorteia o mato). Desde
 * 19/11/2026, as telas do mapa (campo, Bosque, Serra: passa-se pela borda), as pessoas do caminho, os achados no chão, a lojinha
 * (de pé na porta dela) e o caderno da toca.
 */
function Campo({ estado, agir, aviso }: { estado: EstadoSolo; agir: (corpo: Record<string, unknown>) => Promise<void>; aviso: string | null }) {
  const t = useT();
  const tela = useRef<HTMLCanvasElement>(null);
  const comFoco = useJanelaComFoco();
  const [caderno, setCaderno] = useState(false);
  const mapaDoServidor = estado.mapa ?? 'campo';
  const coelho = useMemo(() => {
    if (typeof Image === 'undefined') return null;
    const img = new Image();
    img.src = `${import.meta.env.BASE_URL}briga/coelho.png`;
    return img;
  }, []);
  // a posição na tela anda na frente do servidor; os passos esperam numa fila curta
  const pos = useRef({ mapa: mapaDoServidor, x: estado.x, y: estado.y, deX: estado.x, deY: estado.y, desde: 0, lado: 1 });
  const fila = useRef<string[]>([]);
  const enviando = useRef(false);
  const ultimoPasso = useRef(0);
  const estadoRef = useRef(estado);
  estadoRef.current = estado;

  // sem passo pendente, a posição é a do servidor
  useEffect(() => {
    if (!enviando.current && !fila.current.length) {
      pos.current = { ...pos.current, mapa: mapaDoServidor, x: estado.x, y: estado.y, deX: estado.x, deY: estado.y };
    }
    if (import.meta.env.DEV) window.bichosDoTeste = { x: estado.x, y: estado.y, fila: fila.current.length, mapa: mapaDoServidor };
  }, [estado.x, estado.y, mapaDoServidor]);

  const mandar = () => {
    if (enviando.current) return;
    const dir = fila.current.shift();
    if (!dir) return;
    enviando.current = true;
    void agir({ tipo: 'andar', dir }).finally(() => {
      enviando.current = false;
      const e = estadoRef.current;
      // o servidor pôs numa luta (ou discordou do lugar): para tudo e fica onde ele diz
      if (e.fase !== 'mapa' || fila.current.length === 0) {
        fila.current = [];
        pos.current = { ...pos.current, mapa: e.mapa ?? 'campo', x: e.x, y: e.y, deX: e.x, deY: e.y };
      }
      if (import.meta.env.DEV) window.bichosDoTeste = { x: e.x, y: e.y, fila: fila.current.length, mapa: e.mapa ?? 'campo' };
      mandar();
    });
  };

  const passo = (dir: string) => {
    const agora = performance.now();
    if (agora - ultimoPasso.current < 140 || fila.current.length >= 2) return;
    const [dx] = DIRECOES[dir];
    const p = pos.current;
    if (dx) p.lado = dx;
    const destino = passoNoMapa(p.mapa, p.x, p.y, dir);
    if (!destino) return;
    ultimoPasso.current = agora;
    // trocou de tela: sem deslizar de uma ponta à outra
    const mesma = destino.mapa === p.mapa;
    pos.current = { mapa: destino.mapa, x: destino.x, y: destino.y, deX: mesma ? p.x : destino.x, deY: mesma ? p.y : destino.y, desde: agora, lado: p.lado };
    fila.current.push(dir);
    tocar('clique');
    mandar();
  };

  /**
   * SEGURAR A SETA DA TELA (20/11/2026): anda como a tecla segurada, um passo a cada 140 ms (o próprio `passo` segura o ritmo e
   * espera a fila do servidor), até o dedo sair. O Enter no botão (detail 0) continua dando um passo.
   */
  const repetindo = useRef<ReturnType<typeof setInterval> | null>(null);
  const pararSeta = () => {
    if (repetindo.current) clearInterval(repetindo.current);
    repetindo.current = null;
  };
  useEffect(() => pararSeta, []);
  const segurarSeta = (dir: string) => ({
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      if (e.pointerType === 'mouse' && e.button > 0) return;
      e.preventDefault();
      e.currentTarget.setPointerCapture?.(e.pointerId);
      pararSeta();
      passo(dir);
      repetindo.current = setInterval(() => passo(dir), 40);
    },
    onPointerUp: pararSeta,
    onPointerCancel: pararSeta,
    onLostPointerCapture: pararSeta,
    onClick: (e: React.MouseEvent) => {
      if (e.detail === 0) passo(dir);
    },
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });

  useEffect(() => {
    const teclas: Record<string, string> = { ArrowUp: 'c', ArrowDown: 'b', ArrowLeft: 'e', ArrowRight: 'd', w: 'c', s: 'b', a: 'e', d: 'd', W: 'c', S: 'b', A: 'e', D: 'd' };
    const ouvir = (ev: KeyboardEvent) => {
      const dir = teclas[ev.key];
      if (!dir || (ev.target as HTMLElement)?.closest?.('input, textarea')) return;
      ev.preventDefault();
      passo(dir);
    };
    window.addEventListener('keydown', ouvir);
    return () => window.removeEventListener('keydown', ouvir);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!comFoco || typeof document === 'undefined') return;
    let quadro = 0;
    const desenhar = (tempo: number) => {
      const c = tela.current;
      const g = c?.getContext('2d');
      const p = pos.current;
      if (c && g) {
        g.imageSmoothingEnabled = false;
        g.drawImage(desenharCampo(p.mapa), 0, 0);
        const e = estadoRef.current;
        const dados = mapaDe(p.mapa);
        // os achados que ainda estão no chão (balançando um pouco)
        for (const a of dados.achados) {
          if (e.achados?.includes(a.id)) continue;
          desenharAchado(g, a.item, a.x * CASA_PX + CASA_PX / 2, a.y * CASA_PX + CASA_PX - 2 - (Math.floor(tempo / 400) % 2));
        }
        const coelhoEm = (x: number, y: number, lado: number, avatar: number | string | null, andando: boolean, escala = 0.42) => {
          g.fillStyle = 'rgba(30,40,20,0.3)';
          g.beginPath();
          g.ellipse(x, y, 6, 2, 0, 0, Math.PI * 2);
          g.fill();
          const folha = coelho ? folhaDe(coelho, avatar) : null;
          if (!folha) return;
          const q = desenhoDoCoelho(andando ? 'andando' : 'parado', tempo, false);
          g.save();
          g.translate(Math.round(x), Math.round(y));
          g.scale(lado * escala, escala);
          g.drawImage(folha, q * FOLHA.lado, 0, FOLHA.lado, FOLHA.lado, -FOLHA.peX, -FOLHA.peY, FOLHA.lado, FOLHA.lado);
          g.restore();
        };
        // as pessoas do caminho (a que já foi vencida ganha a estrelinha; a que ainda desafia, o "!")
        for (const pe of dados.pessoas) {
          const px = pe.x * CASA_PX + CASA_PX / 2;
          const py = pe.y * CASA_PX + CASA_PX - 2;
          coelhoEm(px, py, pe.olha === 'e' ? -1 : 1, pe.avatar, false);
          if (e.vencidos?.includes(pe.id)) {
            g.fillStyle = '#f2c84b';
            g.fillRect(px - 1, py - 26, 3, 3);
          } else {
            g.fillStyle = '#ffffff';
            g.fillRect(px - 1, py - 28, 2, 4);
            g.fillRect(px - 1, py - 23, 2, 1);
          }
        }
        const k = Math.min(1, (tempo - p.desde) / 140);
        const x = (p.deX + (p.x - p.deX) * k) * CASA_PX + CASA_PX / 2;
        const y = (p.deY + (p.y - p.deY) * k) * CASA_PX + CASA_PX - 2;
        coelhoEm(x, y, p.lado, e.avatar, k < 1);
      }
      quadro = requestAnimationFrame(desenhar);
    };
    quadro = requestAnimationFrame(desenhar);
    return () => cancelAnimationFrame(quadro);
  }, [comFoco, coelho]);

  const moedas = estado.moedas ?? 0;
  const escada = estado.escada ?? [];
  return (
    <div className="bichos bichos-mapa">
      <div className="bichos-campo">
        <canvas ref={tela} className="bichos-tela-campo" width={LARGURA_PX} height={ALTURA_PX} />
        {aviso && <p className="bichos-aviso">{aviso}</p>}
        <div className="bichos-setas">
          <button type="button" className="cima" aria-label={t('Para cima')} {...segurarSeta('c')}>▲</button>
          <button type="button" className="esq" aria-label={t('Para a esquerda')} {...segurarSeta('e')}>◀</button>
          <button type="button" className="dir" aria-label={t('Para a direita')} {...segurarSeta('d')}>▶</button>
          <button type="button" className="baixo" aria-label={t('Para baixo')} {...segurarSeta('b')}>▼</button>
        </div>
        {caderno && <CadernoDaToca estado={estado} aoFechar={() => setCaderno(false)} />}
      </div>
      <aside className="bichos-lado">
        <p className="bichos-dica">{t('Setas ou WASD para andar.')}</p>
        <p className="bichos-cesta">
          <span title={t('Cenoura')}>🥕 {estado.cenouras}</span>
          <span title={t('Chá')}>🍵 {estado.chas}</span>
          <span title={t('Moedas')}>🪙 {moedas}</span>
          <span title={t('Toca')}>🏠 {estado.toca}</span>
          {estado.desafios > 0 && <span>🏅 {estado.desafios}</span>}
        </p>
        {/* a escada dos desafios: uma estrela por casa vencida, com o nome de quem desafia */}
        <p className="bichos-escada" aria-label={`${escada.length}/${DESAFIANTES.length}`}>
          {DESAFIANTES.map((d, i) => (
            <span key={d.nome} className={escada.includes(i) ? 'vencida' : ''} title={d.nome}>
              {escada.includes(i) ? '★' : '☆'}
            </span>
          ))}
        </p>
        <button type="button" className="btn-secondary bichos-caderno-botao" onClick={() => setCaderno((c) => !c)} aria-pressed={caderno}>
          📖 {t('Caderno da toca')} <small>{`${estado.caderno?.pegos.length ?? 0}/${Object.keys(ESPECIES).length}`}</small>
        </button>
        {estado.loja && (
          <div className="bichos-loja" role="group" aria-label={t('Lojinha')}>
            <h4>🏪 {t('Lojinha')}</h4>
            {(Object.keys(PRECOS) as (keyof typeof PRECOS)[]).map((item) => (
              <button key={item} type="button" className="btn-secondary" disabled={moedas < PRECOS[item]} onClick={() => void agir({ tipo: 'comprar', item })}>
                {item === 'cenoura' ? '🥕' : '🍵'} +1 <small>🪙 {PRECOS[item]}</small>
              </button>
            ))}
          </div>
        )}
        <h4>{t('Equipe')} <small>{`${estado.equipe.length}/${TAMANHO_DA_EQUIPE}`}</small></h4>
        <ul className="bichos-equipe">
          {estado.equipe.map((b, i) => (
            <li key={b.id}>
              <Retrato especie={b.especie} dormindo={b.pv <= 0} tamanho={40} />
              <span className="bichos-equipe-nome">
                <strong>{nomeDe(b.especie)}</strong> <Selo especie={b.especie} />
                <small>{`${t('Nível')} ${b.nivel}`}</small>
                <BarraDeVida pv={b.pv} pvMax={b.pvMax} />
                <span className="bichos-xp" aria-hidden="true">
                  <span style={{ width: `${b.xpParaSubir ? (b.xpDoNivel / b.xpParaSubir) * 100 : 100}%` }} />
                </span>
              </span>
              {i > 0 && (
                <button type="button" className="link-button" onClick={() => void agir({ tipo: 'frente', i })}>
                  {t('Pôr na frente')}
                </button>
              )}
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}

/**
 * O CADERNO DA TOCA (19/11/2026): todas as espécies, na ordem; a vista mostra o desenho e o nome, a que já foi amiga ganha a
 * marca. A que ainda não foi vista é só o número e um "?". A forma crescida diz de quem ela cresce.
 */
/**
 * A RODA DOS ELEMENTOS (20/11/2026), no caderno: os seis em círculo, e uma seta de cada um para os dois que ele vence (o golpe
 * dele vale o dobro contra eles). A mesma tabela da regra (`VENCE`), desenhada; o nome de cada um aparece ao passar o mouse e
 * para o leitor de tela, que lê a roda como uma lista.
 */
/** A figura de cada elemento na roda: sem texto, igual em todo idioma (o nome vem no "title" e no leitor de tela). */
const FIGURA_DO_ELEMENTO: Record<(typeof ELEMENTOS)[number], string> = { folha: '🍃', brasa: '🔥', gota: '💧', pedra: '🪨', vento: '🌀', faisca: '⚡' };

function RodaDosElementos() {
  const t = useT();
  const R = 62, C = 90, BOLA = 15;
  const pos = (i: number) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / ELEMENTOS.length;
    return [C + R * Math.cos(a), C + R * Math.sin(a)] as const;
  };
  const nome = (el: (typeof ELEMENTOS)[number]) => primeiraForma(t(NOME_DO_ELEMENTO[el]));
  return (
    <figure className="bichos-roda">
      <svg viewBox="0 0 180 180" width="180" height="180" aria-hidden="true">
        <defs>
          {ELEMENTOS.map((el) => (
            <marker key={el} id={`roda-${el}`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M0,0 L8,4 L0,8 z" fill={COR_DO_ELEMENTO[el]} />
            </marker>
          ))}
        </defs>
        {ELEMENTOS.flatMap((el, i) =>
          VENCE[el].map((alvo) => {
            const [x0, y0] = pos(i);
            const [x1, y1] = pos(ELEMENTOS.indexOf(alvo as (typeof ELEMENTOS)[number]));
            const d = Math.hypot(x1 - x0, y1 - y0) || 1;
            const ux = (x1 - x0) / d, uy = (y1 - y0) / d;
            return (
              <line
                key={`${el}-${alvo}`}
                x1={x0 + ux * (BOLA + 2)}
                y1={y0 + uy * (BOLA + 2)}
                x2={x1 - ux * (BOLA + 3)}
                y2={y1 - uy * (BOLA + 3)}
                stroke={COR_DO_ELEMENTO[el]}
                strokeWidth="2"
                opacity="0.85"
                markerEnd={`url(#roda-${el})`}
              />
            );
          }),
        )}
        {ELEMENTOS.map((el, i) => {
          const [x, y] = pos(i);
          return (
            <g key={el}>
              <title>{nome(el)}</title>
              <circle cx={x} cy={y} r={BOLA} fill={COR_DO_ELEMENTO[el]} stroke="rgba(0,0,0,0.35)" strokeWidth="1.5" />
              <text x={x} y={y + 5} textAnchor="middle" fontSize="14">
                {FIGURA_DO_ELEMENTO[el]}
              </text>
            </g>
          );
        })}
      </svg>
      <ul className="so-para-leitor">
        {ELEMENTOS.map((el) => (
          <li key={el}>{`${nome(el)} → ${VENCE[el].map((v) => nome(v as (typeof ELEMENTOS)[number])).join(', ')}`}</li>
        ))}
      </ul>
    </figure>
  );
}

function CadernoDaToca({ estado, aoFechar }: { estado: EstadoSolo; aoFechar: () => void }) {
  const t = useT();
  const vistos = new Set(estado.caderno?.vistos ?? []);
  const pegos = new Set(estado.caderno?.pegos ?? []);
  const ordem = Object.keys(ESPECIES);
  return (
    <div className="bichos-caderno" role="dialog" aria-label={t('Caderno da toca')}>
      <div className="bichos-caderno-topo">
        <strong>📖 {t('Caderno da toca')}</strong>
        <small>{`👁 ${vistos.size} · 🤝 ${pegos.size} / ${ordem.length}`}</small>
        <button type="button" className="link-button" onClick={aoFechar}>
          {t('Fechar')}
        </button>
      </div>
      <RodaDosElementos />
      <ul>
        {ordem.map((e, i) => {
          const visto = vistos.has(e);
          const antes = antesDe(e);
          return (
            <li key={e} className={(pegos.has(e) ? 'pego' : '') + (visto ? '' : ' nao-visto')}>
              <small className="bichos-caderno-n">{String(i + 1).padStart(2, '0')}</small>
              {visto ? <Retrato especie={e} tamanho={40} /> : <span className="bichos-caderno-oculto" aria-hidden="true">?</span>}
              <span>{visto ? nomeDe(e) : '???'}</span>
              {visto && <Selo especie={e} />}
              {pegos.has(e) && <span aria-hidden="true">🤝</span>}
              {visto && antes && vistos.has(antes) && <small className="bichos-caderno-de">{`◀ ${nomeDe(antes)}`}</small>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ------------------------------------------------------------------ A SALA: A LUTA ENTRE DUAS PESSOAS
function LutaNaSala({ estado, eu, jogador, agir }: { estado: EstadoSala; eu: number; jogador: boolean; agir: (corpo: Record<string, unknown>) => Promise<void> }) {
  const t = useT();
  const narracao = useNarracao(estado.eventos, estado.lados, estado.partidaId);
  const [trocando, setTrocando] = useState(false);
  const meuLado = estado.meuLado;
  const ver = meuLado >= 0 ? meuLado : 0;
  const nome = (id: number) => estado.lugares.find((l) => l.userId === id)?.username ?? '';

  if (estado.fase === 'esperando' || !estado.lados || !narracao.vista) {
    const dono = estado.lugares[0];
    return (
      <div className="bichos bichos-sala">
        <p className="bichos-titulo">
          {meuLado >= 0 ? t('Esperando alguém da sala sentar do outro lado…') : t('{nome} quer jogar. Sente do outro lado!', { nome: dono?.username ?? '' })}
        </p>
        {estado.nivel && <p className="bichos-dica">{t('Na mesa, todos os bichos lutam no nível {n}.', { n: estado.nivel })}</p>}
        {meuLado < 0 && jogador !== false && (
          <div className="bichos-acoes">
            <button type="button" className="btn-primary" onClick={() => void agir({ tipo: 'sentar' })}>
              {t('Sentar')}
            </button>
          </div>
        )}
      </div>
    );
  }

  const meu = estado.lados[ver];
  const frente = meu.equipe[meu.ativo];
  const outro = estado.lugares[1 - ver];
  const ocupado = narracao.ocupado;
  const fazer = (corpo: Record<string, unknown>) => {
    setTrocando(false);
    void agir(corpo);
  };
  let situacao = '';
  if (estado.fase === 'fim') situacao = estado.vencedor !== null ? t('{nome} venceu!', { nome: nome(estado.vencedor) }) : '';
  else if (meuLado >= 0 && !estado.precisaEscolher) situacao = t('Esperando {nome} escolher.', { nome: outro?.username ?? '' });
  else if (meuLado >= 0) situacao = t('Escolha um golpe.');

  return (
    <div className="bichos bichos-luta bichos-sala">
      <p className="bichos-placa">
        <span className={ver === 0 ? 'eu' : ''}>{estado.lugares[ver]?.username}</span> × <span>{outro?.username}</span>
      </p>
      <PalcoDaLuta lados={narracao.vista} meu={ver} golpe={narracao.golpe} desafio={false} />
      <p className="bichos-narracao" aria-live="polite">
        {narracao.atual ? textoDo(narracao.atual, t, nome) : situacao || ' '}
      </p>
      {meuLado >= 0 && estado.fase === 'escolhendo' && estado.precisaEscolher && !ocupado && (
        <>
          {meu.precisaTrocar || trocando ? (
            <Troca lado={meu} desligado={ocupado} aoEscolher={(i) => fazer({ tipo: 'trocar', i })} />
          ) : (
            frente && (
              <>
                <Golpes bicho={frente} contra={estado.lados[1 - ver]?.equipe[estado.lados[1 - ver].ativo]} desligado={ocupado} aoEscolher={(i) => fazer({ tipo: 'golpe', i })} />
                <div className="bichos-acoes">
                  {meu.equipe.some((b, i) => b.pv > 0 && i !== meu.ativo) && (
                    <button type="button" className="btn-secondary" onClick={() => setTrocando(true)}>
                      {t('Trocar')}
                    </button>
                  )}
                  <button type="button" className="link-button" onClick={() => fazer({ tipo: 'desistir' })}>
                    {t('Desistir')}
                  </button>
                </div>
              </>
            )
          )}
        </>
      )}
    </div>
  );
}
