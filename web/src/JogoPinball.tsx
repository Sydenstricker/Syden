import { useEffect, useRef, useState } from 'react';
import { ComandosDoJogo } from './ComandosDosJogos';
import { chave, useT } from './i18n';
import { criarImpacto } from './impacto';
import { Crown, Star, Vibrate } from 'lucide-react';
import { comandoDaPausa, TelaDePausa, usePausaComEsc } from './pausaDosJogos';
import { desenharFundo, desenharMesa, type Texto } from './pinball/desenho';
import { BOLAS, compactar, DIR, ESQ, FINAL_PASSOS, FINAL_VEZES, LARGURA, MISSOES, MOLA, novaMesa, PASSO, passo, PASSOS_POR_TRECHO, pilotoAutomatico, SACUDIR, type Evento, type IdDaMissao, type Mesa } from './pinball/sim';
import { tocar, type Efeito } from './somDosJogos';
import './pinball/pinball.css';

/**
 * O PINBALL DA HORTA (16/11/2026): uma mesa de pinball de 16 bits, com as palhetas, a mola, os repolhos que rebatem, os
 * estilingues, as cenouras que caem, a órbita, a toca do coelho que solta o multibola, a bola salva e a mesa que trava quando se
 * sacode demais. SÓ A MECÂNICA dos pinballs; a mesa e o desenho são nossos (pinball/desenho.ts), sem música (a regra do "nunca
 * fazer a nossa"; os efeitos são os de somDosJogos.ts).
 *
 * A PARTIDA ANDA NESTE COMPUTADOR, em passos fixos de 1/60 s (pinball/sim.ts), e os COMANDOS de cada passo vão ao servidor em
 * trechos, durante a partida (server/src/minijogo-pinball.ts), que refaz a mesa com a mesma regra: os pontos que valem, a bola
 * da vez e o fim são os dele. O trecho seguinte sai sempre do último passo que o servidor confirmou, então um trecho perdido
 * volta sozinho. A janela sem foco pausa a mesa (e, no Solo, o ESC também).
 *
 * NA SALA, cada um joga a SUA mesa ao mesmo tempo, por 3 minutos de mesa; a ordem ao vivo no canto é a dos pontos já refeitos
 * pelo servidor.
 */

type Agir = (corpo: Record<string, unknown>) => Promise<unknown> | unknown;

interface MeuResumo {
  passo: number;
  pontos: number;
  bola: number;
  terminou: boolean;
}

export interface EstadoPinball {
  fase: 'escolha' | 'jogando' | 'resultado' | 'largada' | 'fim';
  solo: boolean;
  rodada?: number;
  limite: number;
  meu: MeuResumo | null;
  /** No Solo: o meu recorde e o dos amigos aceitos. */
  recordes?: { userId: number; nome: string; pontos: number }[];
  /** No Solo (19/11/2026): a mesa da partida (0 a horta, 1 o pomar) e o meu recorde no pomar. */
  mesa?: number;
  recordeDoPomar?: number | null;
  resultado?: { pontos: number; recorde: boolean; anterior: number | null } | null;
  /** Na sala: mais pontos primeiro (os pontos refeitos pelo servidor). */
  placar?: { userId: number; username: string; pontos: number; bola: number; terminou: boolean; posicao: number | null }[];
  recorde?: { antes: number | null; novo: boolean } | null;
  partidaId: string;
}

type Props = {
  estado: EstadoPinball & { terminada?: boolean };
  eu: number;
  jogador: boolean;
  agir: Agir;
  /** Na sala: quanto falta para o verde (o relógio da partida). */
  restante?: number;
};

const mil = (n: number) => n.toLocaleString();
const MEDALHAS = ['🥇', '🥈', '🥉'];

declare global {
  interface Window {
    /** Só no site de desenvolvimento: o e2e liga o piloto automático e lê a mesa. */
    pinballPilotoAutomatico?: boolean;
    pinballDoTeste?: Mesa;
  }
}

export function JogoPinball(props: Props) {
  return props.estado.solo ? <PinballSolo {...props} /> : <PinballNaSala {...props} />;
}

function Recordes({ estado, eu }: { estado: EstadoPinball; eu: number }) {
  const t = useT();
  const lista = estado.recordes ?? [];
  if (lista.length === 0) return null;
  return (
    <div className="pinball-recordes">
      <h4>{t('Recordes dos amigos')}</h4>
      <ol>
        {lista.map((r) => (
          <li key={r.userId} className={r.userId === eu ? 'eu' : undefined}>
            <span className="minijogo-nome">{r.nome}</span>
            <strong>{mil(r.pontos)}</strong>
          </li>
        ))}
      </ol>
    </div>
  );
}

function PinballSolo({ estado, eu, jogador, agir }: Props) {
  const t = useT();
  const [erro, setErro] = useState<string | null>(null);
  // a mesa (19/11/2026): a horta ou o pomar, escolhida aqui; começa na da última partida
  const [mesa, setMesa] = useState(estado.mesa ?? 0);
  const jogar = () => {
    setErro(null);
    Promise.resolve(agir({ tipo: 'jogar', mesa })).catch((e) => setErro((e as Error).message));
  };
  if (!jogador) return <p className="minijogo-situacao">…</p>;
  if (estado.fase === 'jogando' && estado.meu && !estado.meu.terminou) {
    return <Partida key={`${estado.partidaId}-${estado.rodada ?? 0}`} solo meu={estado.meu} limite={estado.limite} mesa={estado.mesa ?? 0} agir={agir} />;
  }
  const r = estado.resultado;
  const meuNaHorta = estado.recordes?.find((x) => x.userId === eu);
  const meu = mesa === 1 ? (estado.recordeDoPomar != null ? { pontos: estado.recordeDoPomar } : undefined) : meuNaHorta;
  return (
    <div className="pinball pinball-escolha">
      <div className="pinball-mesas" role="radiogroup" aria-label={t('Mesa')}>
        {[0, 1].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={mesa === n} aria-label={`${t('Mesa')} ${n + 1}`} className={mesa === n ? 'escolhida' : undefined} onClick={() => setMesa(n)}>
            <Previa mesa={n} />
          </button>
        ))}
      </div>
      {r && <p className="pinball-fim-pontos">{t('Pontos: {n}', { n: mil(r.pontos) })}</p>}
      {r?.recorde && <p className="minijogo-situacao pinball-novo">{t('Novo recorde!')}</p>}
      {!r?.recorde && meu && <p className="minijogo-situacao">{t('Seu recorde: {tempo}', { tempo: mil(meu.pontos) })}</p>}
      {mesa === 0 && <Recordes estado={estado} eu={eu} />}
      <Comandos solo />
      <div className="minijogo-acoes">
        <button type="button" className="btn-primary" onClick={jogar}>
          {r ? t('Jogar de novo') : t('Começar')}
        </button>
      </div>
      {erro && <p className="form-error small">{erro}</p>}
    </div>
  );
}

/** A mesa parada, antes de começar: o desenho da mesa nova, sem laço nenhum. */
function Previa({ mesa = 0 }: { mesa?: number }) {
  const tela = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = tela.current?.getContext('2d');
    if (!c) return;
    const fundo = desenharFundo(mesa);
    desenharMesa(c, fundo, novaMesa(undefined, mesa), [], 0);
    // a folha do coelho chega depois: desenha de novo quando ela carregar
    const t = setTimeout(() => desenharMesa(c, fundo, novaMesa(undefined, mesa), [], 0), 400);
    return () => clearTimeout(t);
  }, [mesa]);
  return <canvas ref={tela} className="pinball-previa" width={LARGURA} height={400} aria-hidden="true" />;
}

function Placar({ estado, eu, fim }: { estado: EstadoPinball; eu: number; fim: boolean }) {
  const t = useT();
  const linhas = estado.placar ?? [];
  const meu = linhas.find((l) => l.userId === eu);
  const valem = linhas.filter((l) => l.posicao !== null).length;
  return (
    <div className="pinball pinball-escolha">
      {meu && meu.terminou && <p className="pinball-fim-pontos">{t('Pontos: {n}', { n: mil(meu.pontos) })}</p>}
      {estado.recorde?.novo && <p className="minijogo-situacao pinball-novo">{t('Novo recorde!')}</p>}
      <ol className="pinball-placar">
        {linhas.map((l) => (
          <li key={l.userId} className={l.userId === eu ? 'eu' : undefined}>
            <span className="pinball-placar-pos">{fim ? (l.posicao === null ? '–' : valem >= 2 && l.posicao <= 3 ? MEDALHAS[l.posicao - 1] : l.posicao) : l.terminou ? '✓' : '…'}</span>
            <span className="minijogo-nome">{l.username}</span>
            <strong>{mil(l.pontos)}</strong>
          </li>
        ))}
      </ol>
    </div>
  );
}

function PinballNaSala({ estado, eu, jogador, agir, restante = 0 }: Props) {
  const fim = !!estado.terminada || estado.fase === 'fim';
  // quem abre a página com a partida já andando assiste (o relógio do servidor não deixaria a mesa dela valer)
  const [desdeALargada] = useState(() => estado.fase === 'largada');
  const [contagem] = useState(() => (estado.fase === 'largada' ? Math.max(0, restante) : 0));
  const joga = jogador && !!estado.meu && desdeALargada;
  if (fim || !joga || estado.meu!.terminou) return <Placar estado={estado} eu={eu} fim={fim} />;
  return <Partida key={estado.partidaId} meu={estado.meu!} limite={estado.limite} agir={agir} contagemMs={contagem} placar={estado.placar ?? []} eu={eu} />;
}

function Comandos({ solo }: { solo?: boolean }) {
  const t = useT();
  return (
    <ComandosDoJogo
      itens={[
        { teclas: ['setas-lado'], toque: 'toque', rotulo: t('Palhetas') },
        { teclas: ['espaco'], toque: 'toque-segurar', rotulo: t('Mola') },
        { teclas: ['c'], toque: 'toque', rotulo: t('Sacudir') },
        ...(solo ? [comandoDaPausa(t)] : []),
      ]}
    />
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// O TECLADO E O TOQUE: ← ou Z (palheta esquerda), → ou X (direita), Espaço ou ↓ (mola, segurar e soltar), C ou ↑ (sacudir)
// ---------------------------------------------------------------------------------------------------------------------

function useComandos() {
  const bits = useRef(0);
  const toque = useRef(0);
  /** MULTITOQUE (20/11/2026): cada dedo guarda o seu comando, e o toque da mesa é a soma; levantar um dedo só solta o dele. */
  const dedos = useRef(new Map<number, number>());
  useEffect(() => {
    const tecla = (e: KeyboardEvent, apertada: boolean) => {
      const alvo = e.target as HTMLElement | null;
      if (apertada && alvo && (alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA' || alvo.isContentEditable)) return;
      const k = e.key.toLowerCase();
      const bit =
        k === 'arrowleft' || k === 'z' || k === 'a' ? ESQ : k === 'arrowright' || k === 'x' || k === 'd' || k === '/' ? DIR : k === ' ' || k === 'arrowdown' || k === 'enter' ? MOLA : k === 'c' || k === 'arrowup' ? SACUDIR : 0;
      if (!bit) return;
      e.preventDefault();
      bits.current = apertada ? bits.current | bit : bits.current & ~bit;
    };
    const desce = (e: KeyboardEvent) => tecla(e, true);
    const sobe = (e: KeyboardEvent) => tecla(e, false);
    const soltar = () => {
      bits.current = 0;
      toque.current = 0;
      dedos.current.clear();
    };
    window.addEventListener('keydown', desce);
    window.addEventListener('keyup', sobe);
    window.addEventListener('blur', soltar);
    return () => {
      window.removeEventListener('keydown', desce);
      window.removeEventListener('keyup', sobe);
      window.removeEventListener('blur', soltar);
    };
  }, []);
  const dedo = (id: number, comando: number | null) => {
    if (comando === null) dedos.current.delete(id);
    else dedos.current.set(id, comando);
    let soma = 0;
    for (const c of dedos.current.values()) soma |= c;
    toque.current = soma;
  };
  return { bits, toque, dedo };
}

// ---------------------------------------------------------------------------------------------------------------------
// A PARTIDA: a mesa deste computador, o desenho e os trechos ao servidor
// ---------------------------------------------------------------------------------------------------------------------

const SOM: Partial<Record<Evento['tipo'], Efeito>> = {
  palheta: 'clique',
  mola: 'mola',
  repolho: 'moeda',
  estilingue: 'tacada',
  cenoura: 'acerto',
  colheita: 'combo',
  pista: 'carta',
  multiplicador: 'combo',
  toca: 'buraco',
  multibola: 'chegada',
  orbita: 'derrapa',
  salva: 'bandeira',
  aviso: 'rangido',
  tilt: 'erro',
  perdeu: 'queda',
  fim: 'fim',
  tacada: 'medalha',
  extra: 'medalha',
  rampa: 'turbo',
  final: 'torcida',
};

/** O texto de cada missão (19/11/2026), com a meta dela. */
const TEXTO_DA_MISSAO: Record<IdDaMissao, string> = {
  cenouras: chave('Derrube {n} cenouras'),
  repolhos: chave('Acerte {n} repolhos'),
  orbitas: chave('Faça {n} órbitas'),
  rampas: chave('Suba {n} rampas'),
  toca: chave('Ponha a bola na toca'),
  estilingues: chave('Acerte {n} estilingues'),
};

/** As faíscas dos rebatedores (19/11/2026, só desenho). */
interface Faisca {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ate: number;
  cor: string;
}

const CONTAGEM_MS = 0;

interface Painel {
  pontos: number;
  bola: number;
  mult: number;
  restante: number;
  contagem: number | null;
  aviso: 'salva' | 'multibola' | 'tilt' | 'cuidado' | 'tacada' | 'extra' | 'missao' | 'final' | null;
  missao: number;
  /** O modo final (21/11/2026): os passos que faltam (0: fora dele). */
  final: number;
  missaoConta: number;
  missaoResta: number;
  patente: number;
}

function Partida({
  solo = false,
  mesa = 0,
  meu,
  limite,
  agir,
  contagemMs = CONTAGEM_MS,
  placar,
  eu,
}: {
  solo?: boolean;
  mesa?: number;
  meu: MeuResumo;
  limite: number;
  agir: Agir;
  contagemMs?: number;
  placar?: NonNullable<EstadoPinball['placar']>;
  eu?: number;
}) {
  const t = useT();
  const tela = useRef<HTMLCanvasElement>(null);
  const { bits, toque, dedo } = useComandos();
  /** O tranco pedido pelo botão de toque: vale um passo (o toque rápido não se perde entre dois passos), e solta no seguinte. */
  const tranco = useRef(false);
  /** A tela de toque se revela no primeiro dedo na mesa: só então aparece o botão do tranco. */
  const [eToque, setToque] = useState(false);
  const { pausa, pausado, continuar } = usePausaComEsc(solo);
  const confirmado = useRef(meu.passo);
  confirmado.current = meu.passo;
  const agirRef = useRef(agir);
  agirRef.current = agir;
  const [painel, setPainel] = useState<Painel>({
    pontos: 0,
    bola: 1,
    mult: 1,
    restante: limite,
    contagem: contagemMs > 0 ? Math.ceil(contagemMs / 1000) : null,
    aviso: null,
    missao: 0,
    missaoConta: 0,
    missaoResta: MISSOES[0].passos,
    patente: 1,
    final: 0,
  });

  useEffect(() => {
    const c = tela.current?.getContext('2d');
    if (!c) return;
    const fundo = desenharFundo(mesa);
    const k = novaMesa(limite, mesa);
    if (import.meta.env.DEV) window.pinballDoTeste = k;
    const comandos: number[] = [];
    const textos: Texto[] = [];
    const faiscas: Faisca[] = [];
    const impacto = criarImpacto({ pixelsPorForca: 3 });
    const soltarFaiscas = (x: number, y: number, n: number, cor: string) => {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + Math.random() * 0.5;
        const v = 0.8 + Math.random() * 1.4;
        faiscas.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, ate: quadro + 14 + Math.floor(Math.random() * 8), cor });
      }
    };
    let quadro = 0;
    let acumulado = 0;
    let ultimo = performance.now();
    let largada = performance.now() + contagemMs;
    let ultimoPainel = 0;
    let aviso: Painel['aviso'] = null;
    let avisoAte = 0;
    let viva = true;
    let id = 0;
    const avisar = (a: Painel['aviso'], ms: number) => {
      aviso = a;
      avisoAte = performance.now() + ms;
    };

    const ouvir = (e: Evento) => {
      const s = SOM[e.tipo];
      if (s) tocar(s);
      if ('pontos' in e && e.pontos > 0) textos.push({ x: e.x, y: e.y, texto: `+${e.pontos}`, ate: quadro + 40, cor: e.pontos >= 1000 ? '#ffd65a' : '#ffffff' });
      if (e.tipo === 'perdeu' && e.bonus > 0) textos.push({ x: LARGURA / 2 - 7, y: 250, texto: `+${e.bonus}`, ate: quadro + 60, cor: '#ffd65a' });
      if (e.tipo === 'multiplicador') textos.push({ x: LARGURA / 2 - 7, y: 280, texto: `×${e.mult}`, ate: quadro + 50, cor: '#ffd65a' });
      // só desenho: o rebatedor treme a tela de leve e solta faíscas
      if (e.tipo === 'repolho') {
        impacto.tremer(0.25, 120);
        soltarFaiscas(e.x, e.y, 8, '#b8e07a');
      } else if (e.tipo === 'estilingue') {
        impacto.tremer(0.18, 100);
        soltarFaiscas(e.x, e.y, 6, '#ffffff');
      } else if (e.tipo === 'rampa' || e.tipo === 'tacada') soltarFaiscas(e.x, e.y, 10, '#ffd65a');
      if (e.tipo === 'tacada') avisar('tacada', 2000);
      else if (e.tipo === 'extra') avisar('extra', 2200);
      else if (e.tipo === 'missao' && e.cumpriu) {
        avisar('missao', 2000);
        impacto.tremer(0.4, 200);
      }
      if (e.tipo === 'salva') avisar('salva', 1800);
      else if (e.tipo === 'multibola') avisar('multibola', 2000);
      else if (e.tipo === 'tilt') avisar('tilt', 3000);
      else if (e.tipo === 'aviso') avisar('cuidado', 1200);
      // o modo final (21/11/2026): o aviso grande e o tremor ao começar (no fim, os pontos dele sobem no meio da mesa, como os outros)
      if (e.tipo === 'final' && e.comecou) {
        avisar('final', 2600);
        impacto.tremer(0.6, 400);
        soltarFaiscas(LARGURA / 2, 200, 24, '#ffd65a');
      }
    };

    // OS TRECHOS: do último passo que o servidor confirmou até o meu, um de cada vez
    let enviando = false;
    const enviar = () => {
      if (enviando) return;
      const de = Math.min(confirmado.current, comandos.length);
      if (de >= comandos.length) return;
      const ate = Math.min(comandos.length, de + PASSOS_POR_TRECHO);
      enviando = true;
      Promise.resolve(agirRef.current({ tipo: 'trecho', de, entradas: compactar(comandos, de, ate) }))
        .catch(() => {})
        .finally(() => {
          enviando = false;
        });
    };
    const trechos = setInterval(enviar, 500);

    const quadroDoJogo = () => {
      if (!viva) return;
      id = requestAnimationFrame(quadroDoJogo);
      const agora = performance.now();
      const dt = Math.min(0.1, (agora - ultimo) / 1000);
      ultimo = agora;
      // sem foco (o jogo de verdade, outra janela), escondida ou pausada: nem conta, nem desenho, e a contagem espera
      if (document.hidden || !document.hasFocus() || pausa.ativa) {
        if (largada > agora) largada += dt * 1000;
        return;
      }
      const contando = largada > agora;
      if (!contando && !k.terminou) {
        acumulado += dt;
        let n = 0;
        while (acumulado >= PASSO && n < 6 && !k.terminou) {
          acumulado -= PASSO;
          n++;
          let comando = import.meta.env.DEV && window.pinballPilotoAutomatico ? pilotoAutomatico(k) : bits.current | toque.current;
          if (tranco.current) {
            // o passo anterior sem o tranco, para a mesa ver o "apertou" (ela só sacode na borda do comando)
            if ((k.antes & SACUDIR) === 0) {
              comando |= SACUDIR;
              tranco.current = false;
            }
          }
          comandos.push(comando);
          passo(k, comando);
          for (const e of k.eventos) ouvir(e);
          if (k.terminou) enviar();
        }
        if (n === 6) acumulado = 0;
      }
      quadro++;
      for (let i = textos.length - 1; i >= 0; i--) if (textos[i].ate <= quadro) textos.splice(i, 1);
      const { dx, dy } = impacto.quadro(agora);
      c.save();
      c.translate(Math.round(dx), Math.round(dy));
      desenharMesa(c, fundo, k, textos, quadro);
      for (let i = faiscas.length - 1; i >= 0; i--) {
        const f = faiscas[i];
        if (f.ate <= quadro) {
          faiscas.splice(i, 1);
          continue;
        }
        f.x += f.vx;
        f.y += f.vy;
        c.fillStyle = f.cor;
        c.fillRect(Math.round(f.x), Math.round(f.y), 1, 1);
      }
      c.restore();
      if (agora - ultimoPainel > 100) {
        ultimoPainel = agora;
        if (aviso && agora > avisoAte) aviso = k.tilt ? 'tilt' : null;
        setPainel({
          pontos: k.pontos,
          bola: k.bola,
          mult: k.mult,
          restante: k.limite - k.passo,
          contagem: contando ? Math.ceil((largada - agora) / 1000) : null,
          aviso: k.tilt ? 'tilt' : aviso,
          missao: k.missao,
          missaoConta: k.missaoConta,
          missaoResta: k.missaoResta,
          patente: k.patente,
          final: k.final,
        });
      }
    };
    id = requestAnimationFrame(quadroDoJogo);
    return () => {
      viva = false;
      cancelAnimationFrame(id);
      clearInterval(trechos);
    };
    // a mesa nasce uma vez por partida
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * O toque, com MULTITOQUE (20/11/2026): a metade esquerda é a palheta esquerda, a direita a direita, e segurar embaixo da
   * raia da mola puxa a mola. Cada dedo é dono do seu lado (pelo pointerId): os dois polegares seguram as duas palhetas, e
   * levantar um solta só o lado dele.
   */
  const tocou = (e: React.PointerEvent<HTMLCanvasElement>, apertou: boolean) => {
    if (e.pointerType === 'mouse') return;
    if (!apertou) {
      dedo(e.pointerId, null);
      return;
    }
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    dedo(e.pointerId, x > 0.88 && y > 0.6 ? MOLA : x < 0.5 ? ESQ : DIR);
    setToque(true);
  };

  const seg = Math.ceil(painel.restante * PASSO);
  const relogio = `${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, '0')}`;
  const ordem = placar && placar.length > 1 ? placar : null;
  return (
    <div className="pinball">
      <div className="pinball-mesa">
        <div className="pinball-moldura">
          <canvas
            ref={tela}
            className="pinball-tela"
            width={LARGURA}
            height={400}
            onPointerDown={(e) => tocou(e, true)}
            onPointerUp={(e) => tocou(e, false)}
            onPointerCancel={(e) => tocou(e, false)}
            onLostPointerCapture={(e) => tocou(e, false)}
            onContextMenu={(e) => e.preventDefault()}
          />
          {/* O TRANCO NO TOQUE (20/11/2026): o botão do canto sacode a mesa (o comando da tecla C), um tranco por toque */}
          {eToque && (
            <button
              type="button"
              className="pinball-tranco"
              aria-label={t('Sacudir')}
              onPointerDown={(e) => {
                e.stopPropagation();
                tranco.current = true;
              }}
              onContextMenu={(e) => e.preventDefault()}
            >
              <Vibrate size={22} aria-hidden="true" />
            </button>
          )}
          <div className="pinball-painel" aria-hidden="true">
            <span className="pinball-pontos">{mil(painel.pontos)}</span>
            <span className="pinball-bolas">
              {Array.from({ length: BOLAS }, (_, i) => (
                <i key={i} className={i < BOLAS - painel.bola + 1 ? 'viva' : ''} />
              ))}
            </span>
            {painel.mult > 1 && <span className="pinball-mult">×{painel.mult}</span>}
            {!solo && <span className={`pinball-relogio${painel.restante < 1800 ? ' acabando' : ''}`}>{relogio}</span>}
            {painel.aviso && (
              <span className={`pinball-aviso ${painel.aviso}`}>
                {painel.aviso === 'salva'
                  ? t('Bola salva!')
                  : painel.aviso === 'multibola'
                    ? t('Multibola!')
                    : painel.aviso === 'tilt'
                      ? t('Mesa travada!')
                      : painel.aviso === 'tacada'
                        ? t('Tacada certeira!')
                        : painel.aviso === 'extra'
                          ? t('Bola extra!')
                          : painel.aviso === 'missao'
                            ? t('Missão cumprida!')
                            : painel.aviso === 'final'
                            ? t('Modo final: tudo vale ×{n}!', { n: FINAL_VEZES })
                            : t('Cuidado!')}
              </span>
            )}
            {painel.contagem !== null && <span className="pinball-contagem">{painel.contagem}</span>}
          </div>
          {/* A MISSÃO DA VEZ (19/11/2026): o que fazer, quanto falta, o prazo, e a patente da partida */}
          {/* O MODO FINAL (21/11/2026): no lugar da missão, a coroa, o ×3 e a barra do prazo dele */}
          {painel.final > 0 ? (
            <div className="pinball-missao pinball-final" aria-live="polite">
              <Crown size={14} aria-hidden="true" />
              <span className="pinball-missao-texto">×{FINAL_VEZES}</span>
              <span className="pinball-final-barra" aria-hidden="true">
                <i style={{ width: `${Math.round((100 * painel.final) / FINAL_PASSOS)}%` }} />
              </span>
              <span className="pinball-missao-conta">{Math.ceil(painel.final * PASSO)}s</span>
            </div>
          ) : (
            <div className="pinball-missao" aria-live="polite">
              <span className="pinball-patente" title={`★ ${painel.patente}`}>
                <Star size={12} aria-hidden="true" /> {painel.patente}
              </span>
              <span className="pinball-missao-texto">{t(TEXTO_DA_MISSAO[MISSOES[painel.missao].id], { n: MISSOES[painel.missao].meta })}</span>
              <span className="pinball-missao-conta">
                {painel.missaoConta}/{MISSOES[painel.missao].meta} · {Math.ceil(painel.missaoResta * PASSO)}s
              </span>
            </div>
          )}
          {pausado && <TelaDePausa aoContinuar={continuar} />}
        </div>
        {ordem && (
          <ol className="pinball-ordem">
            {ordem.map((l) => (
              <li key={l.userId} className={l.userId === eu ? 'eu' : undefined}>
                <span className="minijogo-nome">{l.username}</span>
                <strong>{mil(l.pontos)}</strong>
              </li>
            ))}
          </ol>
        )}
      </div>
      <Comandos solo={solo} />
    </div>
  );
}
