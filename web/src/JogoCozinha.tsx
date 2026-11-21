import { temWebGL } from './temWebGL';
import { useEffect, useRef, useState } from 'react';
import { ComandosDoJogo } from './ComandosDosJogos';
import { tocar } from './somDosJogos';
import { useT } from './i18n';
import { Placar, PlacarAoVivo, Relogio } from './Minijogo';
import type { Partida } from './minijogos';
import type { CenaDaCozinha, Icones } from './cozinha/cena';
import { COLUNAS, LINHAS, irPara, novaCozinha, passo, espaco, progresso, usar, type Cozinha, type Evento, type TipoDeEstacao } from './cozinha/cozinha';
import { pilotar } from './cozinha/piloto';
import { PLANTAS_DA_COZINHA, RECEITAS, confere, itemDaChave, type IdDaReceita, type Item, type PlantaDaCozinha } from './cozinha/receitas';
import './cozinha.css';

/** A Cozinha da toca (server/src/minijogo-cozinha.ts): cada um na própria cozinha, os mesmos pedidos para todos. */
export interface EstadoCozinha {
  /** 'escolhendo': quem começou escolhe a planta (19/11/2026). */
  fase: 'escolhendo' | 'preparando' | 'jogando' | 'fim';
  duracaoMs: number;
  /** Quanto da partida já passou, no servidor (só jogando). */
  decorridoMs: number | null;
  /** A minha fila de pedidos (o índice na sequência da partida e a receita), os pratos entregues e os pontos. */
  meu: {
    /** prazoMs e restaMs (20/11/2026): a paciência do pedido, no relógio do servidor, quando o estado saiu de lá. */
    fila: { indice: number; receita: IdDaReceita; prazoMs?: number; restaMs?: number | null }[];
    pratos: number;
    pontos: number;
    gorjetas?: number;
    perdidos?: number;
  } | null;
  /** Mais pratos primeiro (os pontos desempatam); a posição só entre quem está na sala. */
  placar: { userId: number; username: string; pratos: number; pontos: number; posicao: number | null }[];
  solo: boolean;
  /** A planta da cozinha (a da toca até alguém escolher). */
  planta?: PlantaDaCozinha;
  /** Quem escolhe a planta. */
  escolhe?: number;
  /** No Solo, na escolha: o recorde de cada planta (os pontos). */
  recordes?: Partial<Record<PlantaDaCozinha, number>> | null;
  /** No fim do Solo: se a partida virou o recorde, e o recorde de antes. */
  recorde?: { antes: number | null; novo: boolean } | null;
  partidaId: string;
}

/**
 * A COZINHA DA TOCA (05/11/2026). A cozinha roda inteira AQUI (cozinha/cozinha.ts), e o servidor só confere o prato
 * entregue: a janela aceita o prato se ele é um dos pedidos da minha fila, a entrega vai ao servidor na hora, e o pedido
 * some da fila sem esperar a resposta. Se o servidor recusar (o prato não era o pedido), a fila volta a ser a dele.
 *
 * Os comandos: setas (ou WASD) andam, Espaço pega e larga, E usa (pica na tábua, serve o sorvete). Clicar (ou tocar) numa
 * estação leva o coelho até ela e faz o que faria o Espaço — ou o E, na tábua com algo para picar e no pote de sorvete.
 *
 * O RELÓGIO DA PARTIDA, neste computador, como no golfe e na Caça: o começo é quando o "prepare-se" acaba (restanteMs) ou,
 * para quem chega no meio, o que o servidor diz que já passou (decorridoMs).
 *
 * O PONTO É DO SERVIDOR (06/11/2026): o que entra e sai do fogo vai ao servidor na hora (o evento 'fogo' da cozinha), e ele
 * mede pelo relógio dele. Por isso tudo o que vai ao servidor sai em FILA, um depois do outro: o "tirei" nunca chega antes
 * do "pus", nem o prato antes do "tirei". O fogo daqui anda pela hora de verdade (Date.now), como o de lá; sem foco, nada
 * se desenha, mas o fogo continua. Não há pausa: o relógio da partida é do servidor, também no Solo.
 */
export function JogoCozinha({ estado, eu, jogador, agir }: { estado: EstadoCozinha & Partida; eu: number; jogador: boolean; agir: (corpo: Record<string, unknown>) => unknown }) {
  const t = useT();
  if (estado.terminada || estado.fase === 'fim') {
    const ficaram = estado.placar.filter((l) => l.posicao !== null);
    const meu = estado.placar.find((l) => l.userId === eu);
    return (
      <>
        {estado.recorde &&
          (estado.recorde.novo ? (
            <p className="minijogo-situacao cozinha-recorde">
              {t('Novo recorde!')} {meu ? `· ${t('+{n} pontos', { n: meu.pontos })}` : ''}
            </p>
          ) : (
            estado.recorde.antes !== null && <p className="minijogo-situacao">{t('Seu recorde: {n} pontos', { n: estado.recorde.antes })}</p>
          ))}
        <Placar eu={eu} linhas={(ficaram.length ? ficaram : estado.placar).map((l) => ({ ...l, valor: `🍽️ ${l.pratos} · ${l.pontos}`, posicao: l.posicao ?? undefined }))} />
      </>
    );
  }
  if (estado.fase === 'escolhendo') {
    if (estado.escolhe !== eu) return <p className="minijogo-situacao">{t('Esperando a escolha de quem começou…')}</p>;
    return (
      <ul className="cozinha-plantas">
        {PLANTAS_DA_COZINHA.map((p) => (
          <li key={p}>
            <button
              type="button"
              className="minijogo-jogo"
              onClick={() => {
                tocar('clique');
                void agir({ tipo: 'planta', planta: p });
              }}
            >
              <MapaDaPlanta planta={p} />
              {estado.recordes?.[p] !== undefined && <span className="cozinha-planta-recorde">🏆 {estado.recordes[p]}</span>}
            </button>
          </li>
        ))}
      </ul>
    );
  }
  return <CozinhaNaTela key={estado.partidaId} estado={estado} eu={eu} jogador={jogador} agir={agir} />;
}

/** As cores do mapinha de cada planta, por estação (sem texto: o desenho diz). */
const COR_DO_MAPA: Record<TipoDeEstacao, string> = {
  caixote: '#b98a5a',
  balcao: '#d9cbb4',
  tabua: '#8fbf6a',
  fogao: '#e0533c',
  forno: '#c4632a',
  pratos: '#f4f1ea',
  sorvete: '#e9a3c2',
  lixeira: '#7f8a87',
  entrega: '#e8b64a',
  pia: '#7cb6d8',
  extintor: '#b8322a',
};

/** O mapinha de uma planta, visto de cima: cada estação um quadrado da cor dela, e o chão livre em volta. */
function MapaDaPlanta({ planta }: { planta: PlantaDaCozinha }) {
  const k = novaCozinha(planta);
  const casa = 9;
  return (
    <svg className="cozinha-planta" viewBox={`0 0 ${COLUNAS * casa} ${LINHAS * casa}`} width={COLUNAS * casa * 1.6} height={LINHAS * casa * 1.6} aria-hidden="true">
      <rect x={0} y={0} width={COLUNAS * casa} height={LINHAS * casa} fill="#efe2cc" rx={2} />
      {k.estacoes.map((e) => (
        <rect key={e.id} x={e.c * casa + 0.6} y={e.l * casa + 0.6} width={casa - 1.2} height={casa - 1.2} rx={1.5} fill={COR_DO_MAPA[e.tipo]} />
      ))}
    </svg>
  );
}

const DIRECOES: Record<string, [number, number]> = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  KeyW: [0, -1],
  KeyS: [0, 1],
  KeyA: [-1, 0],
  KeyD: [1, 0],
};

const SOM: Partial<Record<Evento['tipo'], Parameters<typeof tocar>[0]>> = {
  pegou: 'clique',
  largou: 'clique',
  juntou: 'clique',
  faca: 'carta',
  picou: 'acerto',
  pronto: 'vez',
  queimando: 'chiado',
  queimou: 'erro',
  'jogou-fora': 'queda',
  entregue: 'chegada',
  recusado: 'erro',
  esfrega: 'agua',
  lavou: 'acerto',
  sujo: 'clique',
  incendio: 'alarme',
  apagou: 'desliza',
};

/** Os ingredientes de cada pedido, para o desenho da fila dizer de quais caixotes tirar. */
function ingredientesDe(id: IdDaReceita): string[] {
  const lista: string[] = [];
  for (const k of RECEITAS[id].itens) {
    const i = itemDaChave(k);
    if (i.ing === 'casquinha') continue;
    lista.push(i.ing);
    if (i.ing === 'massa') lista.push(...(i.com ?? []));
  }
  return lista;
}
/** Enquanto os desenhos não ficam prontos. */
const RESERVA: Record<string, string> = { sorvete: '🍦', salada: '🥗', pizza: '🍕', hamburguer: '🍔', x: '🍔', cachorro: '🌭', pao: '🍳', sushi: '🍣', peixe: '🐟', prato: '🍛', cafe: '🥓', bife: '🥩' };
const reservaDe = (id: string) => RESERVA[id.split('-')[0]] ?? '🍽️';

function CozinhaNaTela({ estado, eu, jogador, agir }: { estado: EstadoCozinha & Partida; eu: number; jogador: boolean; agir: (corpo: Record<string, unknown>) => unknown }) {
  const t = useT();
  const caixa = useRef<HTMLDivElement>(null);
  const k = useRef<Cozinha>(null as unknown as Cozinha);
  if (!k.current) {
    k.current = novaCozinha(estado.planta ?? 'toca');
    k.current.relogio = Date.now();
  }
  const [carga, setCarga] = useState<'carregando' | 'pronta' | 'falhou'>(() => (temWebGL() ? 'carregando' : 'falhou'));
  const [icones, setIcones] = useState<Icones | null>(null);
  const souJogador = jogador && estado.meu !== null && estado.placar.some((l) => l.userId === eu);

  // o começo da partida, neste relógio: o primeiro que se soube
  const inicio = useRef<number | null>(null);
  if (inicio.current === null) {
    if (estado.fase === 'preparando') inicio.current = estado.recebidaEm + estado.restanteMs;
    else if (estado.decorridoMs !== null) inicio.current = estado.recebidaEm - estado.decorridoMs;
  }
  const [agora, setAgora] = useState(Date.now());

  /**
   * Os pedidos entregues daqui que o servidor ainda não tirou da fila: somem na hora e já contam no número de pratos. Se em
   * 4 s o servidor não os tirou (ele recusou), voltam: quem manda na fila é ele.
   */
  const entregues = useRef(new Map<number, number>());
  const filaDoServidor = estado.meu?.fila ?? [];
  const pendente = (indice: number) => {
    const em = entregues.current.get(indice);
    return em !== undefined && Date.now() - em < 4000;
  };
  /** Quanto falta para o pedido vencer, neste relógio (a paciência, 20/11/2026); null: sem prazo (fora da partida). */
  const restaDe = (p: { restaMs?: number | null }) => (p.restaMs == null ? null : p.restaMs - (Date.now() - estado.recebidaEm));
  // o vencido some daqui sem esperar o servidor (ele o tira na hora em que alguém pergunta, ou na conferência)
  const fila = filaDoServidor.filter((p) => !pendente(p.indice) && (restaDe(p) ?? 1) > 0);
  const pratos = (estado.meu?.pratos ?? 0) + filaDoServidor.filter((p) => pendente(p.indice)).length;
  const filaRef = useRef(fila);
  filaRef.current = fila;
  useEffect(() => {
    // o que o servidor já tirou da fila não precisa mais ser lembrado
    const naFila = new Set((estado.meu?.fila ?? []).map((p) => p.indice));
    for (const i of [...entregues.current.keys()]) if (!naFila.has(i)) entregues.current.delete(i);
  }, [estado.meu]);
  const ultimaEntrega = useRef(0);
  const ultimoChiado = useRef(0);
  // o pedido que venceu (20/11/2026): o alarme curto
  const perdidos = estado.meu?.perdidos ?? 0;
  const perdidosAntes = useRef(perdidos);
  useEffect(() => {
    if (perdidos > perdidosAntes.current) tocar('alarme');
    perdidosAntes.current = perdidos;
  }, [perdidos]);
  // a gorjeta (19/11/2026): quando o servidor soma uma, a moedinha toca
  const gorjetas = estado.meu?.gorjetas ?? 0;
  const gorjetasAntes = useRef(gorjetas);
  useEffect(() => {
    if (gorjetas > gorjetasAntes.current) tocar('moeda');
    gorjetasAntes.current = gorjetas;
  }, [gorjetas]);
  const [recusado, setRecusado] = useState(0);

  const jogando = () => estado.fase === 'jogando' || (inicio.current !== null && Date.now() >= inicio.current);

  /** A janela aceita o prato que é um dos pedidos (o primeiro da fila que bate). */
  const pedidoDaEntrega = useRef<number | null>(null);
  const aceitaEntrega = (itens: Item[]) => {
    // o servidor aceita um prato a cada 0,4 s
    if (!souJogador || !jogando() || Date.now() - ultimaEntrega.current < 450) return false;
    const p = filaRef.current.find((f) => confere(f.receita, itens));
    pedidoDaEntrega.current = p ? p.indice : null;
    return !!p;
  };
  const aceitaRef = useRef(aceitaEntrega);
  aceitaRef.current = aceitaEntrega;
  const aceita = (itens: Item[]) => aceitaRef.current(itens);

  /** O que vai ao servidor, em fila: cada um sai quando o anterior respondeu. */
  const envio = useRef<Promise<unknown>>(Promise.resolve());
  const enviar = (corpo: Record<string, unknown>) => {
    envio.current = envio.current.then(() => agir(corpo)).catch(() => {});
  };

  const tratar = (eventos: Evento[]) => {
    for (const e of eventos) {
      const som = SOM[e.tipo];
      if (som) tocar(som);
      if (e.tipo === 'recusado') setRecusado(Date.now());
      if (e.tipo === 'fogo')
        enviar(
          e.extintor
            ? { tipo: 'extintor', estacao: e.estacao }
            : e.pos
              ? { tipo: 'fogo', estacao: e.estacao, item: e.pos }
              : { tipo: 'fogo', estacao: e.estacao, tirou: true },
        );
      if (e.tipo === 'entregue' && pedidoDaEntrega.current !== null) {
        const pedido = pedidoDaEntrega.current;
        pedidoDaEntrega.current = null;
        entregues.current.set(pedido, Date.now());
        ultimaEntrega.current = Date.now();
        setAgora(Date.now());
        enviar({ tipo: 'entregar', pedido, prato: e.itens.map((i) => ({ ...i, com: i.com ? [...i.com] : undefined })) });
      }
    }
  };
  const tratarRef = useRef(tratar);
  tratarRef.current = tratar;

  // O TECLADO: as setas guardadas, o Espaço e o E na hora
  const teclas = useRef(new Set<string>());
  useEffect(() => {
    if (!souJogador) return;
    const digitando = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement | null;
      return !!alvo && (alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA' || alvo.isContentEditable);
    };
    const desce = (e: KeyboardEvent) => {
      if (digitando(e) || e.ctrlKey || e.metaKey || e.altKey) return;
      if (DIRECOES[e.code]) {
        teclas.current.add(e.code);
        e.preventDefault();
      } else if (e.code === 'Space' || e.code === 'KeyE') {
        e.preventDefault();
        if (e.repeat || !jogando()) return;
        k.current.relogio = Date.now();
        tratarRef.current(e.code === 'Space' ? espaco(k.current, aceita) : usar(k.current, aceita));
      }
    };
    const sobe = (e: KeyboardEvent) => teclas.current.delete(e.code);
    const solta = () => teclas.current.clear();
    window.addEventListener('keydown', desce);
    window.addEventListener('keyup', sobe);
    window.addEventListener('blur', solta);
    return () => {
      window.removeEventListener('keydown', desce);
      window.removeEventListener('keyup', sobe);
      window.removeEventListener('blur', solta);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [souJogador]);

  // A CENA: o three.js num pedaço à parte, só quando a cozinha abre
  useEffect(() => {
    if (carga === 'falhou' || !caixa.current) return;
    let viva = true;
    let criada: CenaDaCozinha | null = null;
    import('./cozinha/cena')
      .then(async ({ CenaDaCozinha }) => {
        if (!viva || !caixa.current) return;
        criada = new CenaDaCozinha(caixa.current, (estacao) => {
          if (!souJogador || !jogando()) return;
          const e = k.current.estacoes[estacao];
          // na tábua com algo para picar e no pote de sorvete, o clique é o E; no resto, o Espaço
          const picar = e.tipo === 'tabua' && e.em?.tipo === 'item' && e.em.item.estado === 'cru' && !k.current.coelho.mao;
          irPara(k.current, estacao, picar || e.tipo === 'sorvete' || e.tipo === 'pia' ? 'usar' : 'espaco');
        });
        criada.usar(k.current);
        // a cozinha à mão do e2e (só no site de desenvolvimento)
        if (import.meta.env.DEV) Object.assign(window, { cozinhaDoTeste: k.current, cenaDaCozinhaDoTeste: criada });
        criada.aoQuadro = (dt) => {
          if (!jogando() || !souJogador) return;
          let x = 0;
          let z = 0;
          for (const c of teclas.current) {
            x += DIRECOES[c][0];
            z += DIRECOES[c][1];
          }
          // o piloto automático do e2e (só no site de desenvolvimento): cozinha o primeiro pedido da fila
          if (import.meta.env.DEV && (window as { cozinhaPilotoAutomatico?: boolean }).cozinhaPilotoAutomatico) pilotar(k.current, filaRef.current[0]?.receita);
          tratarRef.current(passo(k.current, x || z ? { x, z } : null, dt, aceita, Date.now()));
          // o chiado de quem passa do ponto, enquanto não sai do fogo
          if (Date.now() - ultimoChiado.current > 1400 && k.current.estacoes.some((e) => {
            const p = progresso(e);
            return p?.tipo === 'fogo' && (p.fase === 'queimando' || p.fase === 'queimado');
          })) {
            ultimoChiado.current = Date.now();
            tocar('chiado');
          }
        };
        const desenhos = await criada.montar();
        if (!viva) return;
        setIcones(desenhos);
        setCarga('pronta');
      })
      .catch(() => {
        criada?.destruir();
        criada = null;
        if (viva) setCarga('falhou');
      });
    return () => {
      viva = false;
      criada?.destruir();
    };
    // a cena nasce uma vez por partida
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carga === 'falhou']);

  // o relógio na tela
  useEffect(() => {
    const id = window.setInterval(() => setAgora(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);

  const restante = inicio.current === null || estado.fase === 'preparando' ? estado.duracaoMs : Math.max(0, estado.duracaoMs - (agora - inicio.current));
  const contagem = estado.fase === 'preparando' && inicio.current !== null && agora < inicio.current ? Math.max(1, Math.ceil((inicio.current - agora) / 1000)) : null;
  const balancar = Date.now() - recusado < 500;

  return (
    <div className="cozinha">
      <div className="cozinha-topo">
        {souJogador && (
          <span className="cozinha-pratos">
            🍽️ {pratos}
          </span>
        )}
        {souJogador && gorjetas > 0 && (
          <span className="cozinha-pratos cozinha-gorjeta" aria-hidden="true">
            ⭐ {gorjetas}
          </span>
        )}
        {estado.fase === 'jogando' && <Relogio restante={restante} total={estado.duracaoMs} />}
      </div>
      {!estado.solo && <PlacarAoVivo eu={eu} linhas={estado.placar.map((l) => ({ userId: l.userId, username: l.username, pontos: l.pratos }))} />}
      {souJogador && (
        <ol className={`cozinha-fila${balancar ? ' recusou' : ''}`} aria-hidden="true">
          {fila.map((p, n) => (
            <li key={p.indice} className={n === 0 ? 'primeiro' : undefined}>
              {icones?.receitas[p.receita] ? <img src={icones.receitas[p.receita]} alt="" className="cozinha-prato" /> : <span className="cozinha-prato">{reservaDe(p.receita)}</span>}
              <span className="cozinha-ingredientes">
                {icones &&
                  ingredientesDe(p.receita).map((ing, j) => (icones.ingredientes[ing] ? <img key={j} src={icones.ingredientes[ing]} alt="" /> : null))}
              </span>
              {p.prazoMs ? <Paciencia resta={restaDe(p)} prazo={p.prazoMs} /> : null}
            </li>
          ))}
        </ol>
      )}
      <div className="cozinha-palco">
        {carga === 'falhou' ? (
          <p className="minijogo-situacao">{t('Este jogo precisa de gráficos 3D, que não abriram neste aparelho.')}</p>
        ) : (
          <div ref={caixa} className={`cozinha-3d${carga === 'pronta' ? '' : ' carregando'}`} />
        )}
        {contagem !== null && (
          <span className="cozinha-contagem" aria-hidden="true">
            {contagem}
          </span>
        )}
      </div>
      {souJogador && (
        <ComandosDoJogo
          itens={[
            { teclas: ['setas'], toque: 'toque', rotulo: t('Andar') },
            { teclas: ['espaco'], rotulo: t('Pegar ou largar') },
            { teclas: ['e'], rotulo: t('Usar') },
          ]}
        />
      )}
    </div>
  );
}

/** A PACIÊNCIA DO PEDIDO (20/11/2026): a barra embaixo da comanda, que encolhe até o prazo; amarela na metade, vermelha no fim. */
function Paciencia({ resta, prazo }: { resta: number | null; prazo: number }) {
  if (resta === null) return null;
  const f = Math.max(0, Math.min(1, resta / prazo));
  return (
    <span className={`cozinha-paciencia${f < 0.25 ? ' fim' : f < 0.5 ? ' meio' : ''}`}>
      <span style={{ width: `${f * 100}%` }} />
    </span>
  );
}
