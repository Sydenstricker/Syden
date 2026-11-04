import { ChevronsUp, Infinity as SemFim, Timer } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ALTURA, desenharMiniatura, desenharTabuleiro, LARGURA, PECA, type Enfeites } from './blocos/desenho';
import { MAX_NA_FILA, registrarEntrada, type Entrada } from './blocos/entrada';
import { acertarComOServidor, foraDoJogo, pedirSincroniaUmaVez } from './blocos/acerto';
import { escolherJogada } from './blocos/piloto';
import * as Sim from './blocos/sim';
import { useT } from './i18n';
import { Placar, type Agir } from './Minijogo';
import type { EstadoBlocos, Partida } from './minijogos';

/**
 * A HORTA EM CASCATA (03/11/2026, server/src/minijogo-blocos.ts): trocar e combinar com a pilha subindo. Cada um joga na
 * própria tela, com a simulação daqui (blocos/sim.ts, igual à do servidor), e manda as jogadas em lotes; o servidor refaz a
 * partida e é dele o placar, os caixotes e quem chegou ao topo. Os outros aparecem pequenos, ao lado, pelo que o servidor
 * viu.
 *
 * O TEMPO É O PASSO (60 por segundo), contado do começo NESTE relógio. No versus ele não para (a pilha dos outros também
 * não); no Solo, a janela sem foco pausa.
 */

type Casa = { l: number; c: number };

/** O que a partida desta tela guarda entre um quadro e outro (fora do React: muda 60 vezes por segundo). */
interface Caixa {
  s: Sim.Simulacao;
  /** Quantas jogadas desta lista o servidor já leu, e o número (na conta do servidor) da primeira que falta. */
  enviadasIdx: number;
  deBase: number;
  versao: number;
  fila: Entrada[];
  cursor: Casa;
  escolhida: Casa | null;
  arrasto: (Casa & { moveu: boolean }) | null;
  avisos: Enfeites['avisos'];
  subindo: boolean;
  pausaMs: number;
  pausadoDesde: number | null;
  enviando: boolean;
  ultimoEnvio: number;
  passoEnviado: number;
  pronto: boolean;
  /** Até quando (Date.now) a tela diz que uma jogada não valeu (o servidor a recusou). */
  recusadaAte: number;
  /** Já pediu ao servidor a lista do que ele leu (o painel aberto de novo no meio): uma vez só. */
  pediuSincronia: boolean;
}


const limiteDo = (modo: EstadoBlocos['modo']) => (modo === 'dois-minutos' ? Sim.DOIS_MINUTOS : 0);

export function JogoBlocos({ estado, eu, jogador, aoAgir }: { estado: EstadoBlocos & Partida; eu: number; jogador: boolean; aoAgir: Agir }) {
  if (estado.terminada || estado.fase === 'fim') {
    // o lugar é a ordem de eliminação (empatados dividem), só entre quem ficou até o fim, como no troféu; quem saiu vem
    // embaixo, sem posição nem medalha. O número é o placar de cada um.
    const resultado = estado.resultado ?? [];
    const sairam = resultado.filter((r) => r.lugar === null);
    return (
      <>
        <Placar
          eu={eu}
          linhas={resultado.filter((r) => r.lugar !== null).map((r) => ({ userId: r.userId, username: r.username, valor: String(r.pontos), posicao: r.lugar ?? undefined }))}
        />
        {sairam.length > 0 && (
          <ul className="minijogo-placar blocos-sairam">
            {sairam.map((r) => (
              <li key={r.userId} className={r.userId === eu ? 'eu' : ''}>
                <span className="minijogo-medalha" aria-hidden="true">
                  –
                </span>
                <span className="minijogo-nome">{r.username}</span>
                <span className="minijogo-pontos">{r.pontos}</span>
              </li>
            ))}
          </ul>
        )}
      </>
    );
  }
  const joga = jogador && estado.meu !== null;
  const outros = estado.jogadores.filter((j) => j.userId !== eu || !joga);
  return (
    <div className="blocos">
      {joga && <MeuTabuleiro estado={estado} eu={eu} aoAgir={aoAgir} />}
      {outros.length > 0 && (
        <ul className={`blocos-outros${joga ? '' : ' grandes'}`}>
          {outros.map((j) => (
            <Miniatura key={j.userId} jogador={j} />
          ))}
        </ul>
      )}
    </div>
  );
}

/** A escolha do Solo: sem fim, ou 2 minutos contra o relógio. */
export function EscolhaDosBlocos({ aoEscolher, aoVoltar }: { aoEscolher: (modo: string) => void; aoVoltar: () => void }) {
  const t = useT();
  return (
    <>
      <ul className="blocos-modos">
        <li>
          <button type="button" className="minijogo-jogo" onClick={() => aoEscolher('sem-fim')}>
            <SemFim size={40} aria-hidden="true" />
            <span>{t('Sem fim')}</span>
          </button>
        </li>
        <li>
          <button type="button" className="minijogo-jogo" onClick={() => aoEscolher('dois-minutos')}>
            <Timer size={40} aria-hidden="true" />
            <span>{t('2 minutos')}</span>
          </button>
        </li>
      </ul>
      <div className="minijogo-acoes">
        <button type="button" className="btn-secondary" onClick={aoVoltar}>
          {t('Outros jogos')}
        </button>
      </div>
    </>
  );
}

function Miniatura({ jogador }: { jogador: EstadoBlocos['jogadores'][number] }) {
  const tela = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = tela.current?.getContext('2d');
    if (ctx) desenharMiniatura(ctx, jogador.grade, jogador.vivo);
  }, [jogador.grade, jogador.vivo]);
  return (
    <li className={jogador.vivo ? undefined : 'fora'}>
      <canvas ref={tela} width={Sim.COLUNAS * 4} height={Sim.LINHAS * 4} aria-hidden="true" />
      <span className="minijogo-nome">{jogador.username}</span>
      <strong>{jogador.pontos}</strong>
    </li>
  );
}

const tempoLegivel = (passos: number) => {
  const s = Math.max(0, Math.ceil(passos / Sim.PASSOS_POR_SEGUNDO));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

function MeuTabuleiro({ estado, eu, aoAgir }: { estado: EstadoBlocos & Partida; eu: number; aoAgir: Agir }) {
  const t = useT();
  const tela = useRef<HTMLCanvasElement>(null);
  const atual = useRef(estado);
  atual.current = estado;
  const agirRef = useRef(aoAgir);
  agirRef.current = aoAgir;
  const versus = estado.modo === 'versus';
  // o começo, neste relógio: na largada ele se acerta a cada estado; jogando, fica o primeiro que se soube
  const inicio = useRef<number | null>(null);
  if (estado.fase === 'largada') inicio.current = estado.recebidaEm + estado.restanteMs;
  // (no Solo, quem volta ao painel no meio continua de onde o servidor está: lá a pilha não anda com o painel fechado)
  else if (estado.fase === 'jogando' && inicio.current === null) {
    inicio.current = versus ? estado.recebidaEm - estado.decorridoMs : estado.recebidaEm - ((estado.meu?.passo ?? 0) * 1000) / Sim.PASSOS_POR_SEGUNDO;
  }

  const [caixa] = useState<Caixa>(() => ({
    s: Sim.simulacao(estado.semente, limiteDo(estado.modo)),
    enviadasIdx: 0,
    deBase: 0,
    versao: 0,
    fila: [],
    cursor: { l: Sim.LINHAS - 4, c: 2 },
    escolhida: null,
    arrasto: null,
    avisos: [],
    subindo: false,
    pausaMs: 0,
    pausadoDesde: null,
    enviando: false,
    ultimoEnvio: 0,
    passoEnviado: 0,
    // o painel aberto de novo no meio da partida: espera a lista de jogadas do servidor antes de andar
    pronto: !estado.meu || estado.meu.recebidas === 0,
    recusadaAte: 0,
    pediuSincronia: false,
  }));
  const [painel, setPainel] = useState({ pontos: 0, passo: 0, fim: false, lixos: 0, recusada: false });

  // O QUE O SERVIDOR DISSE: as jogadas que ele já leu, os caixotes que vêm, e (se ele recusou alguma) a lista aceita
  useEffect(() => {
    const g = caixa;
    const meu = estado.meu;
    if (!meu) return;
    // a lista do servidor (quando ele já recusou alguma) tem de ser o começo da daqui; senão, vale a dele, com as trocas
    // daqui que ele ainda não leu depois dela (blocos/acerto.ts)
    const a = acertarComOServidor({ jogadas: g.s.jogadas, enviadasIdx: g.enviadasIdx, deBase: g.deBase, versao: g.versao, pronto: g.pronto }, meu);
    // o servidor recusou alguma jogada daqui (e não foi só o painel aberto de novo): a tela diz, em vez de sumir com ela
    if (a.recusada) g.recusadaAte = Date.now() + 2500;
    g.enviadasIdx = a.enviadasIdx;
    g.deBase = a.deBase;
    g.versao = a.versao;
    g.pronto = a.pronto;
    let refazer = a.refazer;
    const jogadas = a.jogadas;
    const conhecidos = new Set(g.s.lixos.map((l) => l.id));
    const novos = meu.lixos.filter((l) => !conhecidos.has(l.id));
    if (novos.some((l) => l.n < g.s.e.passo)) refazer = true;
    if (refazer) {
      // o caixote chegou atrasado (ou uma jogada não valeu): a partida é refeita do começo, igual à do servidor
      const s = Sim.simulacao(estado.semente, limiteDo(estado.modo));
      s.jogadas = jogadas;
      s.lixos = meu.lixos.slice();
      Sim.avancar(s, g.s.e.passo);
      g.s = s;
    } else if (novos.length) {
      g.s.lixos = meu.lixos.slice();
    }
  }, [estado, caixa]);

  // O LAÇO: a simulação anda pelo relógio, as entradas entram no passo em que se aplicam, e a tela é desenhada
  useEffect(() => {
    const g = caixa;
    const ctx = tela.current?.getContext('2d');
    if (!ctx) return;
    let quadro = 0;
    let id = 0;
    const alvo = () => {
      if (atual.current.fase !== 'jogando' || inicio.current === null) return 0;
      const agora = Date.now();
      const pausa = g.pausaMs + (g.pausadoDesde !== null ? agora - g.pausadoDesde : 0);
      return Math.max(0, Math.floor(((agora - inicio.current - pausa) * Sim.PASSOS_POR_SEGUNDO) / 1000));
    };
    const aoPasso = (r: Sim.ResultadoDoPasso) => {
      if (r.linhaNova) {
        // tudo subiu uma casa: o cursor, o dedo e as trocas que esperam a vez acompanham
        g.fila = g.fila.flatMap((x): Entrada[] => (x.tipo !== 'troca' ? [x] : x.l > 0 ? [{ ...x, l: x.l - 1 }] : []));
        g.cursor.l = Math.max(0, g.cursor.l - 1);
        if (g.escolhida) g.escolhida = g.escolhida.l > 0 ? { l: g.escolhida.l - 1, c: g.escolhida.c } : null;
        if (g.arrasto) g.arrasto.l--;
      }
      if (r.cadeia >= 2 || r.combo >= 4) {
        let x = 0;
        let y = 0;
        let n = 0;
        for (let i = 0; i < g.s.e.tipo.length; i++) {
          if (g.s.e.estado[i] === Sim.LIMPANDO && g.s.e.timer[i] === Sim.LIMPAR_PASSOS) {
            x += (i % Sim.COLUNAS) * PECA + PECA / 2;
            y += Math.floor(i / Sim.COLUNAS) * PECA + PECA / 2 - g.s.e.subida;
            n++;
          }
        }
        if (n) g.avisos.push({ texto: r.cadeia >= 2 ? 'x' + r.cadeia : String(r.combo), x: x / n, y: y / n, idade: 0 });
      }
    };
    const quadroDoJogo = () => {
      id = requestAnimationFrame(quadroDoJogo);
      const e = atual.current;
      const auto = import.meta.env.DEV && (window as { blocosPilotoAutomatico?: boolean }).blocosPilotoAutomatico;
      // fora da partida no servidor (a pilha dele chegou ao topo, ou a pessoa saiu da sala), a daqui para: ela não conta mais
      if (e.fase === 'jogando' && !g.s.e.fim && g.pronto && !e.meu?.fim) {
        const ate = alvo();
        for (let k = 0; g.s.e.passo < ate && !g.s.e.fim && k < 600; k++) {
          const n = g.s.e.passo;
          if (auto && n % 8 === 0) {
            const j = escolherJogada(g.s.e);
            if (j) g.fila.push(j);
          }
          if (g.subindo) g.fila.push({ tipo: 'subir' });
          // a troca que ainda não pode (o intervalo, o ritmo) espera o passo seguinte; nenhuma some calada
          const esperam = g.fila.splice(0).filter((x) => !registrarEntrada(g.s, x, n));
          g.fila.push(...esperam.slice(-MAX_NA_FILA));
          Sim.avancar(g.s, n + 1, aoPasso);
        }
      } else if (e.fase !== 'jogando') {
        g.fila.length = 0;
      }
      for (const a of g.avisos) a.idade++;
      g.avisos = g.avisos.filter((a) => a.idade < 60);
      const contagem = e.fase === 'largada' && inicio.current !== null ? Math.max(1, Math.ceil((inicio.current - Date.now()) / 1000)) : null;
      const fim = g.s.e.fim !== null || e.meu?.fim === true;
      desenharTabuleiro(ctx, g.s.e, { cursor: g.cursor, escolhida: g.escolhida, avisos: g.avisos, contagem, apagado: fim });
      if (++quadro % 6 === 0) {
        const lixos = g.s.e.fila.reduce((a, l) => a + l.altura, 0) + g.s.lixos.filter((l) => l.n >= g.s.e.passo).reduce((a, l) => a + l.altura, 0);
        const recusada = Date.now() < g.recusadaAte;
        setPainel((p) =>
          p.pontos === g.s.e.pontos && p.passo === g.s.e.passo && p.fim === fim && p.lixos === lixos && p.recusada === recusada
            ? p
            : { pontos: g.s.e.pontos, passo: g.s.e.passo, fim, lixos, recusada },
        );
      }
    };
    id = requestAnimationFrame(quadroDoJogo);

    // OS LOTES: as jogadas novas, ou só o passo (para o servidor saber que a pilha está viva), uma de cada vez
    const enviar = () => {
      const e = atual.current;
      if (g.enviando || !g.pronto || e.fase !== 'jogando' || e.meu?.fim) return;
      const pendentes = g.s.jogadas.length - g.enviadasIdx;
      const agora = Date.now();
      const passo = g.s.e.passo;
      if (passo === g.passoEnviado && pendentes === 0) return;
      if (!(pendentes > 0 && agora - g.ultimoEnvio >= 300) && passo - g.passoEnviado < Sim.PASSOS_POR_SEGUNDO && g.s.e.fim === null) return;
      g.enviando = true;
      g.ultimoEnvio = agora;
      agirRef
        .current({ tipo: 'jogadas', de: g.deBase, passo, versao: g.versao, jogadas: g.s.jogadas.slice(g.enviadasIdx) })
        .then(() => {
          g.passoEnviado = passo;
        })
        .catch(() => {})
        .finally(() => {
          g.enviando = false;
        });
    };
    const lotes = setInterval(enviar, 150);
    // aberto no meio: pede ao servidor a lista do que ele já leu (ela vem no estado seguinte)
    // (uma vez só: o modo estrito roda este efeito duas vezes, e a segunda sincronia virava um falso "Uma jogada não valeu.")
    if (!g.pronto) pedirSincroniaUmaVez(g, () => void agirRef.current({ tipo: 'sincronizar' }).catch(() => {}));

    // A PAUSA (só no Solo) e as teclas soltas quando a janela perde o foco
    const conferirFoco = () => {
      g.subindo = false;
      if (versus) return;
      const parado = document.hidden || !document.hasFocus();
      if (parado && g.pausadoDesde === null) g.pausadoDesde = Date.now();
      else if (!parado && g.pausadoDesde !== null) {
        g.pausaMs += Date.now() - g.pausadoDesde;
        g.pausadoDesde = null;
      }
    };
    window.addEventListener('blur', conferirFoco);
    window.addEventListener('focus', conferirFoco);
    document.addEventListener('visibilitychange', conferirFoco);

    const baixo = (ev: KeyboardEvent) => {
      const alvoDaTecla = ev.target as HTMLElement | null;
      if (alvoDaTecla && (alvoDaTecla.tagName === 'INPUT' || alvoDaTecla.tagName === 'TEXTAREA' || alvoDaTecla.isContentEditable)) return;
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
      const c = g.cursor;
      switch (ev.key) {
        case 'ArrowLeft':
          c.c = Math.max(0, c.c - 1);
          break;
        case 'ArrowRight':
          c.c = Math.min(Sim.COLUNAS - 2, c.c + 1);
          break;
        case 'ArrowUp':
          c.l = Math.max(0, c.l - 1);
          break;
        case 'ArrowDown':
          c.l = Math.min(Sim.LINHAS - 1, c.l + 1);
          break;
        case ' ':
        case 'z':
        case 'Z':
          if (!ev.repeat) g.fila.push({ tipo: 'troca', l: c.l, c: c.c });
          break;
        case 'x':
        case 'X':
          g.subindo = true;
          break;
        default:
          return;
      }
      g.escolhida = null;
      ev.preventDefault();
    };
    const cima = (ev: KeyboardEvent) => {
      if (ev.key === 'x' || ev.key === 'X') g.subindo = false;
    };
    window.addEventListener('keydown', baixo);
    window.addEventListener('keyup', cima);

    return () => {
      cancelAnimationFrame(id);
      clearInterval(lotes);
      window.removeEventListener('blur', conferirFoco);
      window.removeEventListener('focus', conferirFoco);
      document.removeEventListener('visibilitychange', conferirFoco);
      window.removeEventListener('keydown', baixo);
      window.removeEventListener('keyup', cima);
      g.subindo = false;
    };
  }, [caixa, versus]);

  // O TOQUE E O MOUSE: tocar numa peça e depois na vizinha, ou arrastar para o lado
  const casaDo = (ev: React.PointerEvent): Casa | null => {
    const r = tela.current?.getBoundingClientRect();
    if (!r || r.width === 0) return null;
    const x = ((ev.clientX - r.left) / r.width) * LARGURA;
    const y = ((ev.clientY - r.top) / r.height) * ALTURA + caixa.s.e.subida;
    const l = Math.floor(y / PECA);
    const c = Math.floor(x / PECA);
    if (l < 0 || l >= Sim.LINHAS || c < 0 || c >= Sim.COLUNAS) return null;
    return { l, c };
  };
  const trocar = (l: number, a: number, b: number) => caixa.fila.push({ tipo: 'troca', l, c: Math.min(a, b) });
  const apertar = (ev: React.PointerEvent<HTMLCanvasElement>) => {
    const casa = casaDo(ev);
    if (!casa) return;
    ev.currentTarget.setPointerCapture?.(ev.pointerId);
    const g = caixa;
    g.cursor = { l: casa.l, c: Math.min(casa.c, Sim.COLUNAS - 2) };
    if (g.escolhida && g.escolhida.l === casa.l && Math.abs(g.escolhida.c - casa.c) === 1) {
      trocar(casa.l, casa.c, g.escolhida.c);
      g.escolhida = null;
      g.arrasto = null;
      return;
    }
    g.escolhida = casa;
    g.arrasto = { ...casa, moveu: false };
  };
  const mover = (ev: React.PointerEvent<HTMLCanvasElement>) => {
    const g = caixa;
    if (!g.arrasto) return;
    const casa = casaDo(ev);
    if (!casa || casa.l !== g.arrasto.l || Math.abs(casa.c - g.arrasto.c) !== 1) return;
    trocar(casa.l, casa.c, g.arrasto.c);
    g.arrasto = { l: casa.l, c: casa.c, moveu: true };
    g.escolhida = { l: casa.l, c: casa.c };
  };
  const soltar = () => {
    const g = caixa;
    if (g.arrasto?.moveu) g.escolhida = null;
    g.arrasto = null;
  };
  const subir = (sim: boolean) => () => {
    caixa.subindo = sim;
  };

  const restante = estado.modo === 'dois-minutos' ? Sim.DOIS_MINUTOS - painel.passo : painel.passo;
  const fora = foraDoJogo(estado, eu);
  return (
    <div className="blocos-jogo">
      <div className="blocos-topo">
        <span>
          {t('Placar')}: <strong>{painel.pontos}</strong>
        </span>
        {!versus && <span className="blocos-relogio">{tempoLegivel(restante)}</span>}
        {painel.lixos > 0 && (
          <span className="blocos-lixo" aria-hidden="true">
            {Array.from({ length: Math.min(8, painel.lixos) }, (_, i) => (
              <i key={i} />
            ))}
          </span>
        )}
      </div>
      <canvas
        ref={tela}
        className="blocos-tela"
        width={LARGURA}
        height={ALTURA}
        onPointerDown={apertar}
        onPointerMove={mover}
        onPointerUp={soltar}
        onPointerCancel={soltar}
        onLostPointerCapture={soltar}
      />
      {fora === 'saiu' ? (
        <p className="minijogo-situacao">{t('Você saiu da sala, e a partida continuou sem você.')}</p>
      ) : (
        painel.fim && versus && <p className="minijogo-situacao">{t('Sua pilha chegou ao topo.')}</p>
      )}
      {painel.recusada && !painel.fim && (
        <p className="minijogo-situacao blocos-recusada" role="status">
          {t('Uma jogada não valeu.')}
        </p>
      )}
      {!painel.fim && (
        <button
          type="button"
          className="btn-secondary blocos-subir"
          aria-label={t('Subir a pilha')}
          title={t('Subir a pilha')}
          onPointerDown={subir(true)}
          onPointerUp={subir(false)}
          onPointerLeave={subir(false)}
          onPointerCancel={subir(false)}
          onClick={() => caixa.fila.push({ tipo: 'subir' })}
        >
          <ChevronsUp size={20} aria-hidden="true" />
        </button>
      )}
      <p className="settings-hint blocos-dica">{t('Setas para mover, Espaço para trocar, X para subir a pilha.')}</p>
    </div>
  );
}
