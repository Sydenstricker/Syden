import { useEffect, useRef, useState } from 'react';
import { ComandosDoJogo } from './ComandosDosJogos';
import { useT } from './i18n';
import { comandoDaPausa, TelaDePausa, usePausaComEsc } from './pausaDosJogos';
import { tocar } from './somDosJogos';
import { comboAberto, NADA, novoSkatista, PASSO, passo, PASSOS_DA_SESSAO, valorDoCombo, type Comandos, type Evento, type Manobra, type Skatista } from './skate/fisica';
import { criarPiloto } from './skate/piloto';
import type { CenaDoSkate } from './skate/cena';
import './skate.css';

/**
 * O ROLÊ DO COELHO (05/11/2026, pedido dele: "um mini Tony Hawk"): dois minutos numa pista de skate pequena, com o nosso coelho
 * 3D em cima da prancha da Kenney. SÓ A MECÂNICA dos jogos de skate de pontos: nada de nome, personagem, fase ou música de
 * ninguém (e sem música nenhuma: a regra do "nunca fazer a nossa"; os efeitos são os de somDosJogos.ts).
 *
 * A SESSÃO É DESTE COMPUTADOR, como o contra o relógio do kart: a física (skate/fisica.ts) anda em passos fixos de 1/60 s, e
 * os 2 minutos são 7200 passos — a janela sem foco pausa tudo. No fim, os pontos vão ao servidor (server/src/minijogo-skate.ts),
 * que confere o que dá (o tempo que passou, o tamanho) e guarda o recorde. A física não usa seno nem cosseno, para que um dia o
 * servidor possa refazer a sessão inteira a partir dos comandos, como no golfe.
 */

export interface EstadoSkate {
  fase: 'jogando' | 'fim';
  duracaoMs: number;
  /** O que eu já mandei (null: ainda andando). */
  meu: { pontos: number | null; melhorCombo: number | null } | null;
  /** Mais pontos primeiro; a posição só entre quem terminou (empatados dividem). */
  placar: { userId: number; username: string; pontos: number | null; melhorCombo: number | null; posicao: number | null }[];
  /** No Solo: o recorde de antes, e se esta sessão virou o novo. */
  recorde: { antes: number | null; novo: boolean } | null;
  partidaId: string;
}

type Props = {
  estado: EstadoSkate & { terminada?: boolean };
  eu: number;
  jogador: boolean;
  agir: (corpo: Record<string, unknown>) => unknown;
};

const mil = (n: number) => n.toLocaleString();

export function JogoSkate({ estado, eu, jogador, agir }: Props) {
  const t = useT();
  const fim = estado.terminada || estado.fase === 'fim';
  const meu = estado.placar.find((l) => l.userId === eu);
  if (fim || (meu && meu.pontos !== null)) {
    const linhas = estado.placar.filter((l) => l.pontos !== null);
    return (
      <div className="skate-fim">
        {meu && meu.pontos !== null && <p className="skate-fim-pontos">{t('Pontos: {n}', { n: mil(meu.pontos) })}</p>}
        {estado.recorde &&
          (estado.recorde.novo ? (
            <p className="minijogo-situacao skate-recorde">{t('Novo recorde!')}</p>
          ) : (
            estado.recorde.antes !== null && <p className="minijogo-situacao">{t('Seu recorde: {tempo}', { tempo: mil(estado.recorde.antes) })}</p>
          ))}
        {meu && meu.melhorCombo !== null && meu.melhorCombo > 0 && <p className="minijogo-situacao">{t('Melhor combo: {n}', { n: mil(meu.melhorCombo) })}</p>}
        {linhas.length > 1 && (
          <ol className="skate-placar">
            {linhas.map((l) => (
              <li key={l.userId} className={l.userId === eu ? 'eu' : undefined}>
                <span className="skate-placar-pos">{l.posicao ?? '–'}</span>
                <span className="minijogo-nome">{l.username}</span>
                <strong>{mil(l.pontos ?? 0)}</strong>
              </li>
            ))}
          </ol>
        )}
      </div>
    );
  }
  if (!jogador || !meu) return <p className="minijogo-situacao">…</p>;
  // ESC pausa só no Solo (o recorde é dele): na sala, o relógio é o de todos
  return <Sessao key={estado.partidaId} solo={estado.recorde !== null} aoTerminar={(k) => void agir({ tipo: 'fim', pontos: k.pontos, passos: k.passo, melhorCombo: k.melhorCombo })} />;
}

// ---------------------------------------------------------------------------------------------------------------------
// O TECLADO: setas andam (e giram no ar), Espaço pula (segurar carrega), Z flip, X grab, C manual
// ---------------------------------------------------------------------------------------------------------------------

function useTeclado() {
  const comandos = useRef<Comandos>({ ...NADA });
  useEffect(() => {
    const tecla = (e: KeyboardEvent, apertada: boolean) => {
      const alvo = e.target as HTMLElement | null;
      if (apertada && alvo && (alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA' || alvo.isContentEditable)) return;
      const c = comandos.current;
      const k = e.key.toLowerCase();
      let usou = true;
      if (k === 'arrowup' || k === 'w') c.frente = apertada;
      else if (k === 'arrowdown' || k === 's') c.tras = apertada;
      else if (k === 'arrowleft' || k === 'a') c.esquerda = apertada;
      else if (k === 'arrowright' || k === 'd') c.direita = apertada;
      else if (k === ' ') c.pulo = apertada;
      else if (k === 'z') c.flip = apertada;
      else if (k === 'x') c.grab = apertada;
      else if (k === 'c') c.manual = apertada;
      else usou = false;
      if (usou) e.preventDefault();
    };
    const desce = (e: KeyboardEvent) => tecla(e, true);
    const sobe = (e: KeyboardEvent) => tecla(e, false);
    const soltar = () => Object.assign(comandos.current, NADA);
    const escondeu = () => document.hidden && soltar();
    window.addEventListener('keydown', desce);
    window.addEventListener('keyup', sobe);
    window.addEventListener('blur', soltar);
    document.addEventListener('visibilitychange', escondeu);
    return () => {
      window.removeEventListener('keydown', desce);
      window.removeEventListener('keyup', sobe);
      window.removeEventListener('blur', soltar);
      document.removeEventListener('visibilitychange', escondeu);
    };
  }, []);
  return comandos;
}

// ---------------------------------------------------------------------------------------------------------------------
// A SESSÃO
// ---------------------------------------------------------------------------------------------------------------------

interface Placa {
  id: number;
  tipo: 'combo' | 'queda';
  pontos: number;
  vezes: number;
}

interface Painel {
  pontos: number;
  restante: number;
  combo: Manobra[];
  modo: Skatista['modo'];
  contagem: number | null;
}

declare global {
  interface Window {
    /** Só no site de desenvolvimento: o e2e liga o piloto automático e lê a sessão. */
    skatePilotoAutomatico?: boolean;
    skateSessaoDoTeste?: Skatista;
  }
}

const CONTAGEM_MS = 3000;

export function Sessao({ aoTerminar, solo = false }: { aoTerminar: (k: Skatista) => void; solo?: boolean }) {
  const t = useT();
  const caixa = useRef<HTMLDivElement>(null);
  const medidor = useRef<HTMLDivElement>(null);
  const teclado = useTeclado();
  const [estado, setEstado] = useState<'carregando' | 'pronta' | 'falhou'>(() => (temWebGL() ? 'carregando' : 'falhou'));
  const [painel, setPainel] = useState<Painel>({ pontos: 0, restante: PASSOS_DA_SESSAO, combo: [], modo: 'chao', contagem: 3 });
  const [placas, setPlacas] = useState<Placa[]>([]);
  const terminar = useRef(aoTerminar);
  terminar.current = aoTerminar;
  const { pausa, pausado, continuar } = usePausaComEsc(solo && estado === 'pronta');

  useEffect(() => {
    if (estado === 'falhou' || !caixa.current) return;
    let viva = true;
    let cena: CenaDoSkate | null = null;
    let id = 0;
    let placaId = 0;
    import('./skate/cena')
      .then(async ({ CenaDoSkate }) => {
        if (!viva || !caixa.current) return;
        cena = new CenaDoSkate(caixa.current);
        await cena.montar();
        if (!viva) return;
        setEstado('pronta');
        const k = novoSkatista();
        if (import.meta.env.DEV) window.skateSessaoDoTeste = k;
        const piloto = criarPiloto();
        let antes = { x: k.x, y: k.y, z: k.z };
        let acumulado = 0;
        let ultimo = performance.now();
        let ultimoPainel = 0;
        let largada = performance.now() + CONTAGEM_MS;
        let mandou = false;
        let comandos: Comandos = NADA;

        const ouvir = (e: Evento) => {
          switch (e.tipo) {
            case 'ollie':
              tocar('pulo');
              break;
            case 'pouso':
              tocar('tacada');
              break;
            case 'grind':
              tocar('carta');
              break;
            case 'manobra':
              if (e.nome === 'Kickflip') tocar('clique');
              break;
            case 'combo':
              tocar(e.vezes >= 3 ? 'combo' : 'moeda');
              if (e.vezes >= 2 || e.pontos >= 300) {
                const p: Placa = { id: ++placaId, tipo: 'combo', pontos: e.pontos, vezes: e.vezes };
                setPlacas((l) => [...l.slice(-2), p]);
                setTimeout(() => setPlacas((l) => l.filter((x) => x.id !== p.id)), 1800);
              }
              break;
            case 'queda': {
              tocar('queda');
              const p: Placa = { id: ++placaId, tipo: 'queda', pontos: e.perdeu, vezes: 0 };
              setPlacas((l) => [...l.slice(-2), p]);
              setTimeout(() => setPlacas((l) => l.filter((x) => x.id !== p.id)), 1600);
              break;
            }
          }
        };

        const quadro = () => {
          if (!viva || !cena) return;
          id = requestAnimationFrame(quadro);
          const agora = performance.now();
          const dt = Math.min(0.1, (agora - ultimo) / 1000);
          ultimo = agora;
          // sem foco (o jogo de verdade, outra janela), escondida ou pausada (ESC): nem física, nem desenho, e a contagem espera
          if (document.hidden || !document.hasFocus() || pausa.ativa) {
            if (largada > agora) largada += dt * 1000;
            return;
          }
          const contando = largada > agora;
          if (!contando && !k.terminou) {
            acumulado += dt;
            let n = 0;
            while (acumulado >= PASSO && n < 6 && !k.terminou) {
              antes = { x: k.x, y: k.y, z: k.z };
              comandos = import.meta.env.DEV && window.skatePilotoAutomatico ? piloto(k) : teclado.current;
              passo(k, comandos);
              for (const e of k.eventos) ouvir(e);
              acumulado -= PASSO;
              n++;
            }
            if (n === 6) acumulado = 0;
          }
          cena.desenhar(antes, k, contando ? 1 : Math.min(1, acumulado / PASSO), dt, comandos.frente);
          // o equilíbrio vai direto na barra (todo quadro); o resto do painel, umas 12 vezes por segundo
          const m = medidor.current;
          if (m) {
            const mostra = k.modo === 'grind' || k.modo === 'manual';
            m.style.visibility = mostra ? 'visible' : 'hidden';
            m.dataset.eixo = k.modo === 'manual' ? 'vertical' : 'horizontal';
            m.style.setProperty('--equilibrio', String(Math.max(-1, Math.min(1, k.equilibrio))));
          }
          if (agora - ultimoPainel > 80) {
            ultimoPainel = agora;
            setPainel({
              pontos: k.pontos,
              restante: Math.max(0, PASSOS_DA_SESSAO - k.passo),
              combo: comboAberto(k),
              modo: k.modo,
              contagem: contando ? Math.ceil((largada - agora) / 1000) : null,
            });
          }
          if (k.terminou && !mandou) {
            mandou = true;
            tocar('fim');
            terminar.current(k);
          }
        };
        id = requestAnimationFrame(quadro);
      })
      .catch(() => {
        cena?.destruir();
        cena = null;
        if (viva) setEstado('falhou');
      });
    return () => {
      viva = false;
      cancelAnimationFrame(id);
      cena?.destruir();
    };
    // a cena nasce uma vez por sessão
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado === 'falhou']);

  if (estado === 'falhou') return <p className="minijogo-situacao">{t('Este jogo precisa de gráficos 3D, que não abriram neste aparelho.')}</p>;

  const seg = Math.ceil((painel.restante * PASSO));
  const relogio = `${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, '0')}`;
  const combo = painel.combo;
  return (
    <div className="skate">
      <div className="skate-moldura">
        <div ref={caixa} className={`skate-caixa${estado === 'pronta' ? '' : ' escondida'}`} />
        {estado === 'pronta' && (
          <div className="skate-painel" aria-hidden="true">
            <span className="skate-pontos">{mil(painel.pontos)}</span>
            <span className={`skate-relogio${painel.restante < 600 ? ' acabando' : ''}`}>{relogio}</span>
            {combo.length > 0 && (
              <div className="skate-combo">
                <span className="skate-manobras">{combo.map((m) => m.nome).join(' + ')}</span>
                <span className="skate-valor">
                  {mil(combo.reduce((s, m) => s + m.pontos, 0))} × {combo.length}
                  <small> = {mil(valorDoCombo(combo))}</small>
                </span>
              </div>
            )}
            <div className="skate-placas">
              {placas.map((p) =>
                p.tipo === 'combo' ? (
                  <span key={p.id} className="skate-placa">
                    +{mil(p.pontos)}
                  </span>
                ) : (
                  <span key={p.id} className="skate-placa queda">
                    {t('Caiu!')}
                    {p.pontos > 0 && <s> {mil(p.pontos)}</s>}
                  </span>
                ),
              )}
            </div>
            <div ref={medidor} className="skate-equilibrio" style={{ visibility: 'hidden' }}>
              <span />
            </div>
            {painel.contagem !== null && <span className="skate-contagem">{painel.contagem}</span>}
          </div>
        )}
        {pausado && <TelaDePausa aoContinuar={continuar} />}
      </div>
      <ComandosDoJogo
        itens={[
          { teclas: ['setas'], rotulo: t('Andar') },
          { teclas: ['espaco'], rotulo: t('Pular') },
          { teclas: ['setas-lado'], rotulo: t('Girar') },
          { teclas: ['z'], rotulo: t('Kickflip') },
          { teclas: ['x'], rotulo: t('Grab') },
          { teclas: ['c'], rotulo: t('Manual') },
          ...(solo ? [comandoDaPausa(t)] : []),
        ]}
      />
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
