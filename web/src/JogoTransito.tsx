import { useEffect, useRef, useState } from 'react';
import { ComandosDoJogo } from './ComandosDosJogos';
import { useT } from './i18n';
import { comandoDaPausa, TelaDePausa, usePausaComEsc } from './pausaDosJogos';
import { tocar } from './somDosJogos';
import { ALTURA, carregarImagens, DesenhoDoTransito, LARGURA, TECLAS } from './transito/desenho';
import { escolhaDoPiloto } from './transito/piloto';
import { liberar, novaPartida, passo, PASSO, PASSOS_DA_PARTIDA, travado, type Estado } from './transito/sim';
import './transito.css';

/**
 * O TRÂNSITO DA TOCA (06/11/2026, pedido dele: "1 minuto para liberar o maior número possível de carros sem fazer com que eles
 * batam"). SÓ A MECÂNICA do gênero de controlar o cruzamento; a cidade e os carros são da Kenney (CC0), o resto por código.
 *
 * A PARTIDA É DESTE COMPUTADOR, como o Rolê do coelho: a regra (transito/sim.ts) anda em passos fixos de 1/60 s, e o minuto são
 * 3600 passos — a janela sem foco pausa tudo, e no Solo o ESC também. Cada clique (ou tecla) que soltou um carro fica guardado com
 * o passo; no fim, a lista vai ao servidor (server/src/minijogo-transito.ts), que REFAZ a partida com a mesma regra e a mesma
 * semente, e os pontos são os dele. As regras escolhidas (a batida trava o cruzamento, a fila cheia buzina) estão em sim.ts.
 */

export interface EstadoTransito {
  fase: 'jogando' | 'fim';
  semente: number;
  duracaoMs: number;
  meu: { pontos: number | null; atravessaram: number | null; batidas: number | null } | null;
  placar: { userId: number; username: string; pontos: number | null; atravessaram: number | null; batidas: number | null; posicao: number | null }[];
  recorde: { antes: number | null; novo: boolean } | null;
  partidaId: string;
}

type Props = {
  estado: EstadoTransito & { terminada?: boolean };
  eu: number;
  jogador: boolean;
  agir: (corpo: Record<string, unknown>) => unknown;
};

/** Os ícones de HUD da Kenney (CC0, web/public/icones-hud/), como máscara: a cor é a do texto. */
function Icone({ nome }: { nome: 'car' | 'trophy' | 'warning' | 'star' }) {
  const url = `url(${import.meta.env.BASE_URL}icones-hud/${nome}.png)`;
  return <span className="transito-icone" aria-hidden="true" style={{ WebkitMaskImage: url, maskImage: url }} />;
}

export function JogoTransito({ estado, eu, jogador, agir }: Props) {
  const t = useT();
  const fim = estado.terminada || estado.fase === 'fim';
  const meu = estado.placar.find((l) => l.userId === eu);
  if (fim || (meu && meu.pontos !== null)) {
    const linhas = estado.placar.filter((l) => l.pontos !== null);
    return (
      <div className="transito-fim">
        {meu && meu.pontos !== null && <p className="transito-fim-pontos">{t('Pontos: {n}', { n: meu.pontos })}</p>}
        {meu && meu.atravessaram !== null && (
          <p className="transito-fim-conta">
            <span>
              <Icone nome="car" /> {meu.atravessaram}
            </span>
            <span className={meu.batidas ? 'bateu' : undefined}>
              <Icone nome="warning" /> {meu.batidas ?? 0}
            </span>
          </p>
        )}
        {estado.recorde &&
          (estado.recorde.novo ? (
            <p className="minijogo-situacao transito-recorde">
              <Icone nome="trophy" /> {t('Novo recorde!')}
            </p>
          ) : (
            estado.recorde.antes !== null && (
              <p className="minijogo-situacao">
                <Icone nome="trophy" /> {t('Seu recorde: {tempo}', { tempo: estado.recorde.antes })}
              </p>
            )
          ))}
        {linhas.length > 1 && (
          <ol className="transito-placar">
            {linhas.map((l) => (
              <li key={l.userId} className={l.userId === eu ? 'eu' : undefined}>
                <span className="transito-placar-pos">{l.posicao ?? '–'}</span>
                <span className="minijogo-nome">{l.username}</span>
                <strong>{l.pontos}</strong>
              </li>
            ))}
          </ol>
        )}
      </div>
    );
  }
  if (!jogador || !meu) return <p className="minijogo-situacao">…</p>;
  // ESC pausa só no Solo (o recorde é dele): na sala, o relógio é o de todos
  return <Cruzamento key={estado.partidaId} semente={estado.semente} solo={estado.recorde !== null} aoTerminar={(liberacoes) => void agir({ tipo: 'fim', liberacoes })} />;
}

declare global {
  interface Window {
    /** Só no site de desenvolvimento: o e2e liga o piloto automático e lê a partida. */
    transitoPilotoAutomatico?: boolean;
    transitoDoTeste?: Estado;
  }
}

const CONTAGEM_MS = 3000;

interface Painel {
  pontos: number;
  restante: number;
  sequencia: number;
  travado: boolean;
  contagem: number | null;
}

function Cruzamento({ semente, solo, aoTerminar }: { semente: number; solo: boolean; aoTerminar: (liberacoes: number[]) => void }) {
  const t = useT();
  const tela = useRef<HTMLCanvasElement>(null);
  const [pronta, setPronta] = useState(false);
  const [falhou, setFalhou] = useState(false);
  const [painel, setPainel] = useState<Painel>({ pontos: 0, restante: PASSOS_DA_PARTIDA, sequencia: 0, travado: false, contagem: 3 });
  const terminar = useRef(aoTerminar);
  terminar.current = aoTerminar;
  const { pausa, pausado, continuar } = usePausaComEsc(solo && pronta);
  /** Quem joga chama isto (clique, toque ou tecla); o laço o monta. */
  const soltar = useRef<(entrada: number) => void>(() => {});
  const desenho = useRef<DesenhoDoTransito | null>(null);

  useEffect(() => {
    const canvas = tela.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setFalhou(true);
      return;
    }
    let viva = true;
    let id = 0;
    carregarImagens(import.meta.env.BASE_URL)
      .then((img) => {
        if (!viva) return;
        const d = new DesenhoDoTransito(ctx, img, { teclas: !matchMedia('(pointer: coarse)').matches });
        desenho.current = d;
        setPronta(true);
        const e = novaPartida(semente);
        if (import.meta.env.DEV) window.transitoDoTeste = e;
        const liberacoes: number[] = [];
        let acumulado = 0;
        let ultimo = performance.now();
        let ultimoPainel = 0;
        let largada = performance.now() + CONTAGEM_MS;
        let mandou = false;

        soltar.current = (entrada) => {
          if (e.terminou || largada > performance.now() || pausa.ativa) return;
          // um carro por rua por passo (o servidor confere)
          const n = liberacoes.length;
          for (let k = n - 2; k >= 0 && liberacoes[k] === e.passo; k -= 2) if (liberacoes[k + 1] === entrada) return;
          if (liberar(e, entrada)) {
            liberacoes.push(e.passo, entrada);
            tocar('clique');
          } else if (travado(e)) tocar('erro');
        };

        const ouvir = () => {
          for (const ev of e.eventos) {
            switch (ev.tipo) {
              case 'saiu':
                tocar('moeda');
                d.placa(ev.x, ev.y, `+${ev.valor}`, e.passo);
                break;
              case 'batida':
                tocar('queda');
                d.batida(ev.x, ev.y, e.passo);
                d.placa(ev.x, ev.y, '−3', e.passo);
                break;
              case 'buzina':
                tocar('erro');
                break;
              case 'sequencia':
                tocar('combo');
                d.placa(3.5, 3.5, `×${ev.n} +5`, e.passo, true);
                break;
            }
          }
        };

        const quadro = () => {
          if (!viva) return;
          id = requestAnimationFrame(quadro);
          const agora = performance.now();
          const dt = Math.min(0.1, (agora - ultimo) / 1000);
          ultimo = agora;
          // sem foco (o jogo de verdade, outra janela), escondida ou pausada (ESC): nem regra, nem desenho, e a contagem espera
          if (document.hidden || !document.hasFocus() || pausa.ativa) {
            if (largada > agora) largada += dt * 1000;
            return;
          }
          const contando = largada > agora;
          if (!contando && !e.terminou) {
            acumulado += dt;
            let n = 0;
            while (acumulado >= PASSO && n < 6 && !e.terminou) {
              if (import.meta.env.DEV && window.transitoPilotoAutomatico && e.passo % 6 === 0) {
                const q = escolhaDoPiloto(e);
                if (q >= 0) soltar.current(q);
              }
              passo(e);
              ouvir();
              acumulado -= PASSO;
              n++;
            }
            if (n === 6) acumulado = 0;
          }
          d.desenhar(e, agora);
          if (agora - ultimoPainel > 80) {
            ultimoPainel = agora;
            setPainel({
              pontos: e.pontos,
              restante: Math.max(0, PASSOS_DA_PARTIDA - e.passo),
              sequencia: e.sequencia,
              travado: travado(e),
              contagem: contando ? Math.ceil((largada - agora) / 1000) : null,
            });
          }
          if (e.terminou && !mandou) {
            mandou = true;
            tocar('fim');
            terminar.current(liberacoes);
          }
        };
        id = requestAnimationFrame(quadro);
      })
      .catch(() => viva && setFalhou(true));
    return () => {
      viva = false;
      cancelAnimationFrame(id);
      soltar.current = () => {};
    };
    // a partida nasce uma vez por semente
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [semente]);

  // as teclas: Q, E, C e Z, as pontas do teclado como as pontas do mapa (e 7, 9, 3 e 1 no teclado numérico)
  useEffect(() => {
    const tecla = (ev: KeyboardEvent) => {
      if (ev.repeat || ev.ctrlKey || ev.metaKey || ev.altKey) return;
      const alvo = ev.target as HTMLElement | null;
      if (alvo && (alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA' || alvo.isContentEditable)) return;
      const k = ev.key.toLowerCase();
      let entrada = TECLAS.indexOf(k);
      if (entrada < 0) entrada = ['7', '9', '3', '1'].indexOf(k);
      if (entrada < 0) return;
      ev.preventDefault();
      soltar.current(entrada);
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, []);

  const tocou = (ev: React.PointerEvent<HTMLCanvasElement>) => {
    const c = tela.current;
    const d = desenho.current;
    if (!c || !d) return;
    const r = c.getBoundingClientRect();
    const entrada = d.entradaEm(((ev.clientX - r.left) / r.width) * LARGURA, ((ev.clientY - r.top) / r.height) * ALTURA);
    if (entrada >= 0) soltar.current(entrada);
  };

  if (falhou) return <p className="minijogo-situacao">…</p>;
  const seg = Math.ceil(painel.restante * PASSO);
  const relogio = `${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, '0')}`;
  return (
    <div className="transito">
      <div className="transito-moldura">
        <canvas ref={tela} className="transito-tela" width={LARGURA} height={ALTURA} onPointerDown={tocou} />
        {pronta && (
          <div className="transito-painel" aria-hidden="true">
            <span className="transito-pontos">
              <Icone nome="car" /> {painel.pontos}
            </span>
            <span className={`transito-relogio${painel.restante < 600 ? ' acabando' : ''}`}>{relogio}</span>
            {painel.sequencia >= 2 && (
              <span className="transito-sequencia">
                <Icone nome="star" /> ×{painel.sequencia}
              </span>
            )}
            {painel.travado && (
              <span className="transito-travado">
                <Icone nome="warning" />
              </span>
            )}
            {painel.contagem !== null && <span className="transito-contagem">{painel.contagem}</span>}
          </div>
        )}
        {pausado && <TelaDePausa aoContinuar={continuar} />}
      </div>
      <ComandosDoJogo itens={[{ teclas: ['mouse-clique', 'q', 'e', 'z', 'c'], toque: 'toque', rotulo: t('Liberar') }, ...(solo ? [comandoDaPausa(t)] : [])]} />
    </div>
  );
}
