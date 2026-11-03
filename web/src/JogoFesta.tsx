import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { chave, idiomaAtual, useT } from './i18n';
import { Placar, PlacarAoVivo } from './Minijogo';
import type { EstadoFesta, LinhaDaFesta, Microjogo, Partida } from './minijogos';

/**
 * A FESTA DOS COELHOS (03/11/2026, server/src/minijogo-festa.ts): cinco rodadas de microjogos, cada um na própria tela, e
 * o resultado comparado na revelação. Só a mecânica dos jogos de festa de console: o desenho é todo daqui, por código.
 *
 * O TEMPO DE CADA UM: o "prepare-se" diz quanto falta para o jogo começar (restanteMs), e o jogo começa nesse instante NO
 * RELÓGIO DESTE COMPUTADOR. O que se mede (o tempo parado, a força, quando se acertou) é medido daqui, e o servidor confere
 * contra o relógio dele. No saque, a reação conta do momento em que o sinal APARECEU nesta tela.
 */

const NOMES: Record<Microjogo, { nome: string; dica: string }> = {
  saque: { nome: chave('Saque rápido'), dica: chave('Espere o sinal e aperte o mais rápido que puder. Antes do sinal, está fora.') },
  forca: { nome: chave('Medidor de força'), dica: chave('Pare a barra o mais perto possível de 100%.') },
  relogio: { nome: chave('Parar o relógio'), dica: chave('Pare o relógio em 10 segundos exatos. Os números somem depois de 3.') },
  copos: { nome: chave('Jogo dos copos'), dica: chave('Veja onde fica a cenoura e siga o copo. Acertar mais rápido vale mais.') },
  siga: { nome: chave('Siga o coelho'), dica: chave('Repita as setas na ordem. A cada acerto, vem mais uma.') },
  alvo: { nome: chave('Tiro ao alvo'), dica: chave('Acerte as cenouras que aparecerem. Cada uma vale um ponto.') },
};

// Os mesmos números do servidor (minijogo-festa.ts).
const FORCA_MS = 8000;
const RELOGIO_MS = 15000;
const RELOGIO_SOME_MS = 3000;
const COPOS_MOSTRA_MS = 2000;
const SIGA_MS = 40000;
const SIGA_PASSO_MS = 600;
const SIGA_ACESA_MS = 450;
const ALVO_MS = 20000;
const ALVO_VIDA_MS = 1100;

const valorDaForca = (periodoMs: number, t: number) => {
  const fase = (((t % periodoMs) + periodoMs) % periodoMs) / periodoMs;
  return 100 * (1 - Math.abs(fase * 2 - 1));
};

/** O relógio da tela, a cada quadro, enquanto ligado. */
function useRelogio(ligado: boolean) {
  const [agora, setAgora] = useState(Date.now);
  useEffect(() => {
    if (!ligado) return;
    let id = 0;
    const passo = () => {
      setAgora(Date.now());
      id = requestAnimationFrame(passo);
    };
    id = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(id);
  }, [ligado]);
  return agora;
}

/** As teclas enquanto o jogo está valendo (fora dos campos de texto, sem a repetição da tecla segurada). */
function useTeclas(ligado: boolean, aoApertar: (e: KeyboardEvent) => boolean) {
  const ref = useRef(aoApertar);
  ref.current = aoApertar;
  useEffect(() => {
    if (!ligado) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      const alvo = e.target as HTMLElement | null;
      if (alvo && (alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA' || alvo.isContentEditable)) return;
      if (ref.current(e)) e.preventDefault();
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [ligado]);
}

const ehAperto = (e: KeyboardEvent) => e.key === ' ' || e.key === 'Enter';

interface PropsDoMicro {
  dados: NonNullable<EstadoFesta['dados']>;
  /** Quando o jogo começa, no relógio deste computador (Date.now). */
  inicio: number;
  /** Valendo: sou jogador, a rodada está correndo e ainda não mandei. */
  ativo: boolean;
  enviar: (corpo: Record<string, unknown>) => void;
  /** Tiro ao alvo: cada acerto, na hora (o servidor confere no relógio dele). */
  marcar?: (i: number) => void;
}

export function JogoFesta({
  estado,
  eu,
  jogador,
  restante,
  agir,
}: {
  estado: EstadoFesta & Partida;
  eu: number;
  jogador: boolean;
  restante: number;
  agir: (corpo: Record<string, unknown>) => unknown;
}) {
  const t = useT();
  const formatos = useFormatos();
  const inicio = useRef<{ rodada: number; em: number } | null>(null);
  const enviado = useRef(0);
  const [enviei, setEnviei] = useState(0);

  // o começo do jogo, neste relógio: no "prepare-se" ele se acerta a cada estado; jogando, fica o primeiro que se soube
  if (estado.fase === 'preparando') inicio.current = { rodada: estado.rodada, em: estado.recebidaEm + estado.restanteMs };
  else if (estado.fase === 'jogando' && inicio.current?.rodada !== estado.rodada) {
    inicio.current = { rodada: estado.rodada, em: estado.recebidaEm + estado.restanteMs - estado.duracaoMs };
  }

  if (estado.terminada || estado.fase === 'fim') {
    // empatados dividem a posição, como no troféu (revisão de 03/11/2026: a tela dava ouro e prata a quem empatou)
    return (
      <Placar
        eu={eu}
        linhas={estado.placar.map((l) => ({ ...l, valor: String(l.pontos), posicao: 1 + estado.placar.filter((o) => o.pontos > l.pontos).length }))}
      />
    );
  }

  const souJogador = jogador && estado.jogadores.some((j) => j.userId === eu);
  const jaMandei = estado.meu !== null || enviei === estado.rodada;
  const ativo = souJogador && estado.fase === 'jogando' && !jaMandei;
  const enviar = (corpo: Record<string, unknown>) => {
    if (enviado.current === estado.rodada) return;
    enviado.current = estado.rodada;
    setEnviei(estado.rodada);
    void agir({ tipo: 'resultado', ...corpo });
  };
  const nome = NOMES[estado.microjogo];
  const props: PropsDoMicro | null =
    estado.dados && inicio.current
      ? { dados: estado.dados, inicio: inicio.current.em, ativo, enviar, marcar: (i: number) => void agir({ tipo: 'acerto', i }) }
      : null;
  const mostrarJogo = (estado.fase === 'jogando' && souJogador) || (estado.fase === 'revelando' && estado.microjogo === 'copos');

  return (
    <div className={`festa festa-jogo-${estado.microjogo}`}>
      <PlacarAoVivo eu={eu} linhas={estado.placar} />
      {estado.fase === 'preparando' && (
        <div className="festa-preparo">
          <strong className="festa-nome">{t(nome.nome)}</strong>
          <p>{t(nome.dica)}</p>
          <span className="festa-contagem" aria-hidden="true">
            {Math.max(1, Math.ceil(restante / 1000))}
          </span>
        </div>
      )}
      {estado.fase !== 'preparando' && <strong className="festa-nome pequeno">{t(nome.nome)}</strong>}
      {mostrarJogo && props && (
        <div className="festa-palco" key={estado.rodada}>
          {estado.microjogo === 'saque' && <Saque {...props} sinal={estado.sinal} />}
          {estado.microjogo === 'forca' && <Forca {...props} />}
          {estado.microjogo === 'relogio' && <Relogio {...props} />}
          {estado.microjogo === 'copos' && <Copos {...props} resposta={estado.resposta} />}
          {estado.microjogo === 'siga' && <Siga {...props} />}
          {estado.microjogo === 'alvo' && <Alvo {...props} />}
        </div>
      )}
      {estado.fase === 'jogando' && souJogador && jaMandei && (
        <p className="minijogo-situacao">
          {estado.meu?.motivo === 'cedo' ? t('Cedo demais!') : t('Você terminou! Agora é torcer pelos outros.')}
        </p>
      )}
      {estado.fase === 'jogando' && !souJogador && <p className="minijogo-situacao">{t(nome.dica)}</p>}
      {estado.fase === 'jogando' && estado.jogadores.length > 1 && (
        <ul className="festa-prontos">
          {estado.jogadores.map((j) => (
            <li key={j.userId} className={estado.prontos.includes(j.userId) ? 'pronto' : ''}>
              <span className="minijogo-nome">{j.username}</span>
              <span aria-hidden="true">{estado.prontos.includes(j.userId) ? '✓' : '…'}</span>
            </li>
          ))}
        </ul>
      )}
      {estado.fase === 'revelando' && estado.linhas && (
        <ol className="festa-revelacao">
          {estado.linhas.map((l) => (
            <li key={l.userId} className={`${l.userId === eu ? 'eu' : ''}${l.posicao === null ? ' fora' : ''}`}>
              <span className="festa-posicao">{l.posicao ?? '–'}</span>
              <span className="minijogo-nome">{l.username}</span>
              <span className="festa-valor">{textoDoResultado(estado.microjogo, l, formatos, t)}</span>
              <strong className="festa-pontos">+{l.pontos}</strong>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function useFormatos() {
  const idioma = idiomaAtual();
  const [f] = useState(() => ({
    ms: new Intl.NumberFormat(idioma, { style: 'unit', unit: 'millisecond', unitDisplay: 'short', maximumFractionDigits: 0 }),
    s: new Intl.NumberFormat(idioma, { style: 'unit', unit: 'second', unitDisplay: 'short', minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    numero: new Intl.NumberFormat(idioma, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    pct: new Intl.NumberFormat(idioma, { style: 'percent', maximumFractionDigits: 1 }),
  }));
  return f;
}
type Formatos = ReturnType<typeof useFormatos>;

function textoDoResultado(m: Microjogo, l: LinhaDaFesta, f: Formatos, t: (texto: string) => string): string {
  if (l.motivo === 'cedo') return t('Cedo demais!');
  if (l.motivo === 'invalido') return t('Não valeu');
  if (l.motivo === 'nada') return t('Sem resposta');
  if (l.motivo === 'errou' && m !== 'alvo') return t('Errou');
  const v = l.valor ?? 0;
  switch (m) {
    case 'saque':
    case 'copos':
      return f.ms.format(v);
    case 'forca':
      return f.pct.format(v / 100);
    case 'relogio':
      return f.s.format(v / 1000);
    case 'siga':
      return `➜ × ${v}`;
    case 'alvo':
      return `🥕 × ${v}`;
  }
}

/* ------------------------------------------------------------------ os microjogos ------------------------------------------------------------------ */

/** O saque: espera-se o sinal; antes dele, está fora. A reação conta de quando o sinal apareceu NESTA tela. */
function Saque({ ativo, enviar, sinal }: PropsDoMicro & { sinal: boolean }) {
  const t = useT();
  const f = useFormatos();
  const vistoEm = useRef<number | null>(null);
  const [meu, setMeu] = useState<'cedo' | number | null>(null);
  useLayoutEffect(() => {
    if (!sinal || vistoEm.current !== null) return;
    vistoEm.current = performance.now();
    // o quadro em que o sinal foi pintado
    requestAnimationFrame(() => (vistoEm.current = performance.now()));
  }, [sinal]);
  const apertar = () => {
    if (!ativo || meu !== null) return;
    if (!sinal || vistoEm.current === null) {
      setMeu('cedo');
      enviar({ cedo: true });
      return;
    }
    const reacao = Math.round(performance.now() - vistoEm.current);
    setMeu(reacao);
    enviar({ reacaoMs: reacao });
  };
  useTeclas(ativo && meu === null, (e) => {
    if (!ehAperto(e)) return false;
    apertar();
    return true;
  });
  return (
    <button
      type="button"
      className={`festa-saque${sinal ? ' sinal' : ''}${meu === 'cedo' ? ' cedo' : ''}`}
      onPointerDown={(e) => {
        e.preventDefault();
        apertar();
      }}
      aria-label={t(NOMES.saque.nome)}
    >
      <svg viewBox="0 0 120 80" aria-hidden="true">
        {sinal && meu !== 'cedo' ? (
          <>
            <circle cx="60" cy="40" r="30" fill="#f2c46a" />
            <rect x="55" y="18" width="10" height="30" rx="4" fill="#5a3a2a" />
            <circle cx="60" cy="58" r="5.5" fill="#5a3a2a" />
          </>
        ) : (
          <>
            {/* o coelho esperando, de orelha em pé */}
            <ellipse cx="50" cy="20" rx="5" ry="15" fill="#e8dccb" />
            <ellipse cx="70" cy="20" rx="5" ry="15" fill="#e8dccb" />
            <circle cx="60" cy="46" r="20" fill="#e8dccb" />
            <circle cx="53" cy="44" r="2.5" fill="#3a2e2a" />
            <circle cx="67" cy="44" r="2.5" fill="#3a2e2a" />
            <circle cx="60" cy="51" r="2" fill="#d98a8a" />
            {meu === null && [0, 1, 2].map((i) => <circle key={i} className="festa-ponto" style={{ animationDelay: `${i * 0.25}s` }} cx={96 + i * 8} cy="66" r="2.5" fill="#e8dccb" />)}
          </>
        )}
      </svg>
      {meu === 'cedo' && <span className="festa-saque-texto">{t('Cedo demais!')}</span>}
      {typeof meu === 'number' && <span className="festa-saque-texto">{f.ms.format(meu)}</span>}
    </button>
  );
}

/** A barra de força: sobe e desce, e para no aperto. */
function Forca({ dados, inicio, ativo, enviar }: PropsDoMicro) {
  const t = useT();
  const f = useFormatos();
  const [parado, setParado] = useState<number | null>(null);
  const agora = useRelogio(ativo && parado === null);
  const periodo = dados.periodoMs ?? 1400;
  const tempo = Math.min(FORCA_MS, Math.max(0, agora - inicio));
  const valor = parado ?? (agora < inicio ? 0 : valorDaForca(periodo, tempo));
  const parar = () => {
    if (!ativo || parado !== null || Date.now() < inicio) return;
    const ms = Math.min(FORCA_MS, Date.now() - inicio);
    const v = valorDaForca(periodo, ms);
    setParado(v);
    enviar({ t: Math.round(ms) });
  };
  useTeclas(ativo && parado === null, (e) => {
    if (!ehAperto(e)) return false;
    parar();
    return true;
  });
  return (
    <div className="festa-forca">
      <div className="festa-forca-barra" aria-hidden="true">
        <span className="festa-forca-cheia" style={{ height: `${valor}%` }} />
        <span className="festa-forca-topo" />
      </div>
      <div className="festa-forca-lado">
        <span className="festa-mostrador">{f.pct.format((parado ?? valor) / 100)}</span>
        <button type="button" className="btn-primary" disabled={!ativo || parado !== null} onPointerDown={(e) => (e.preventDefault(), parar())}>
          {t('Parar')}
        </button>
      </div>
    </div>
  );
}

/** O relógio: conta a partir do zero, e os números somem depois de 3 s. */
function Relogio({ inicio, ativo, enviar }: PropsDoMicro) {
  const t = useT();
  const f = useFormatos();
  const [parado, setParado] = useState<number | null>(null);
  const agora = useRelogio(ativo && parado === null);
  const tempo = parado ?? Math.min(RELOGIO_MS, Math.max(0, agora - inicio));
  const escondido = parado === null && tempo >= RELOGIO_SOME_MS;
  const parar = () => {
    if (!ativo || parado !== null || Date.now() < inicio) return;
    const ms = Math.min(RELOGIO_MS, Date.now() - inicio);
    setParado(ms);
    enviar({ t: Math.round(ms) });
  };
  useTeclas(ativo && parado === null, (e) => {
    if (!ehAperto(e)) return false;
    parar();
    return true;
  });
  return (
    <div className="festa-relogio">
      <span className={`festa-mostrador grande${escondido ? ' escondido' : ''}`}>{escondido ? '?' : f.numero.format(tempo / 1000)}</span>
      <span className="festa-meta" aria-hidden="true">
        {f.numero.format(10)}
      </span>
      <button type="button" className="btn-primary" disabled={!ativo || parado !== null} onPointerDown={(e) => (e.preventDefault(), parar())}>
        {t('Parar')}
      </button>
    </div>
  );
}

const X_DOS_COPOS = [60, 150, 240];
const suave = (p: number) => (p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2);

/** Os copos: a cenoura aparece, os copos descem e trocam de lugar, e escolhe-se um. */
function Copos({ dados, inicio, ativo, enviar, resposta }: PropsDoMicro & { resposta: number | null }) {
  const t = useT();
  const [escolhido, setEscolhido] = useState<number | null>(null);
  const trocas = dados.trocas ?? [];
  const passos = dados.passos ?? [];
  const animacao = COPOS_MOSTRA_MS + passos.reduce((a, b) => a + b, 0);
  const revelando = resposta !== null;
  const agora = useRelogio(!revelando && (ativo || Date.now() < inicio + animacao));
  const e = revelando ? Infinity : agora - inicio;

  // onde está cada copo: o copo i começa no lugar i; as trocas já feitas, e a que está andando
  const lugar = [0, 1, 2];
  let andando: { a: number; b: number; p: number } | null = null;
  let tempo = COPOS_MOSTRA_MS;
  for (let i = 0; i < trocas.length; i++) {
    const [a, b] = trocas[i];
    if (e < tempo) break;
    if (e < tempo + passos[i]) {
      andando = { a, b, p: suave((e - tempo) / passos[i]) };
      break;
    }
    const ca = lugar.indexOf(a);
    const cb = lugar.indexOf(b);
    lugar[ca] = b;
    lugar[cb] = a;
    tempo += passos[i];
  }
  const podeEscolher = ativo && e >= animacao && escolhido === null;
  const escolher = (slot: number) => {
    if (!podeEscolher) return;
    setEscolhido(slot);
    enviar({ copo: slot, ms: Math.max(0, Math.round(Date.now() - (inicio + animacao))) });
  };
  useTeclas(podeEscolher, (ev) => {
    const slot = { '1': 0, '2': 1, '3': 2, ArrowLeft: 0, ArrowDown: 1, ArrowRight: 2 }[ev.key];
    if (slot === undefined) return false;
    escolher(slot);
    return true;
  });
  // a cenoura é do copo que começou no lugar inicial
  const copoDaCenoura = dados.inicial ?? 0;
  const levantado = (copo: number) => {
    const slot = lugar[copo];
    if (revelando) return slot === resposta ? -44 : 0;
    if (e < COPOS_MOSTRA_MS - 500) return -44;
    if (e < COPOS_MOSTRA_MS) return -44 * (1 - (e - (COPOS_MOSTRA_MS - 500)) / 500);
    return 0;
  };
  const posicao = (copo: number) => {
    const slot = lugar[copo];
    if (andando && (slot === andando.a || slot === andando.b)) {
      const de = X_DOS_COPOS[slot];
      const para = X_DOS_COPOS[slot === andando.a ? andando.b : andando.a];
      const arco = Math.sin(Math.PI * andando.p) * (slot === andando.a ? -14 : 8);
      return { x: de + (para - de) * andando.p, y: arco };
    }
    return { x: X_DOS_COPOS[slot], y: 0 };
  };
  const cenoura = posicao(copoDaCenoura);
  const cenouraVisivel = revelando ? lugar[copoDaCenoura] === resposta : e < COPOS_MOSTRA_MS;
  return (
    <svg className="festa-copos" viewBox="0 0 300 150" role="group" aria-label={t(NOMES.copos.nome)}>
      <rect x="0" y="118" width="300" height="32" fill="#6b4a3a" />
      <rect x="0" y="116" width="300" height="4" fill="#8e6a52" />
      {cenouraVisivel && (
        <g transform={`translate(${cenoura.x} 0)`}>
          <path d="M-9 100 L9 100 L0 118 Z" fill="#e07a2e" />
          <path d="M-3 100 L-7 92 M0 100 L0 90 M3 100 L7 92" stroke="#6fa356" strokeWidth="3" strokeLinecap="round" />
        </g>
      )}
      {[0, 1, 2]
        .slice()
        .sort((a, b) => posicao(a).y - posicao(b).y)
        .map((copo) => {
          const { x, y } = posicao(copo);
          const slot = lugar[copo];
          const marcado = escolhido === slot;
          return (
            <g
              key={copo}
              transform={`translate(${x} ${y + levantado(copo)})`}
              className={`festa-copo${podeEscolher ? ' escolhe' : ''}${marcado ? ' escolhido' : ''}`}
              onPointerDown={(ev) => {
                ev.preventDefault();
                escolher(slot);
              }}
            >
              <path d="M-28 118 L-20 62 L20 62 L28 118 Z" fill={marcado ? '#d0894f' : '#b8743f'} />
              <rect x="-31" y="112" width="62" height="8" rx="2" fill="#8e5530" />
              <rect x="-21" y="59" width="42" height="6" rx="2" fill="#d39a62" />
              <path d="M-12 72 L-15 104" stroke="#d39a62" strokeWidth="3" strokeLinecap="round" opacity="0.6" />
            </g>
          );
        })}
    </svg>
  );
}

/** As quatro setas: 0 cima, 1 direita, 2 baixo, 3 esquerda (o desenho gira; nenhuma letra). */
function Seta({ direcao }: { direcao: number }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path transform={`rotate(${direcao * 90} 12 12)`} d="M12 3 L20 12 L15 12 L15 21 L9 21 L9 12 L4 12 Z" fill="currentColor" />
    </svg>
  );
}

const TECLA_DA_SETA: Record<string, number> = { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3, w: 0, d: 1, s: 2, a: 3 };

/** Siga o coelho: a sequência aparece, repete-se, e cresce uma seta a cada acerto. */
function Siga({ dados, inicio, ativo, enviar }: PropsDoMicro) {
  const setas = dados.setas ?? [];
  const [nivel, setNivel] = useState(1);
  const [modo, setModo] = useState<'mostrando' | 'repetindo' | 'fim'>('mostrando');
  const [mostrarDesde, setMostrarDesde] = useState(inicio);
  const [digitadas, setDigitadas] = useState<number[]>([]);
  const [ultimaCompleta, setUltimaCompleta] = useState<number[]>([]);
  const [apertada, setApertada] = useState<{ seta: number; em: number; certa: boolean } | null>(null);
  const agora = useRelogio(ativo && modo !== 'fim');

  const terminar = (completas: number[], errada?: number) => {
    setModo('fim');
    enviar({ acertos: completas.length, setas: errada === undefined ? completas : [...completas, errada], ms: Math.round(Date.now() - inicio) });
  };

  // a sequência acabou de ser mostrada: a vez de repetir
  useEffect(() => {
    if (modo === 'mostrando' && agora - mostrarDesde >= nivel * SIGA_PASSO_MS) setModo('repetindo');
  }, [agora, modo, mostrarDesde, nivel]);
  // o tempo da rodada acabou
  useEffect(() => {
    if (ativo && modo !== 'fim' && agora - inicio >= SIGA_MS) terminar(ultimaCompleta);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agora]);

  const apertar = (seta: number) => {
    if (!ativo || modo !== 'repetindo') return;
    const certa = seta === setas[digitadas.length];
    setApertada({ seta, em: Date.now(), certa });
    if (!certa) return terminar(ultimaCompleta, seta);
    const novas = [...digitadas, seta];
    if (novas.length < nivel) return setDigitadas(novas);
    setUltimaCompleta(novas);
    setDigitadas([]);
    if (nivel >= setas.length) return terminar(novas);
    setNivel(nivel + 1);
    setModo('mostrando');
    setMostrarDesde(Date.now() + 400);
  };
  useTeclas(ativo && modo === 'repetindo', (e) => {
    const seta = TECLA_DA_SETA[e.key.length === 1 ? e.key.toLowerCase() : e.key];
    if (seta === undefined) return false;
    apertar(seta);
    return true;
  });

  const desde = agora - mostrarDesde;
  const acesa =
    modo === 'mostrando' && desde >= 0 && desde % SIGA_PASSO_MS < SIGA_ACESA_MS && Math.floor(desde / SIGA_PASSO_MS) < nivel
      ? setas[Math.floor(desde / SIGA_PASSO_MS)]
      : apertada && agora - apertada.em < 250
        ? apertada.seta
        : null;
  const errou = apertada !== null && !apertada.certa;
  return (
    <div className={`festa-siga${modo === 'repetindo' ? ' sua-vez' : ''}`}>
      <div className="festa-siga-pontos" aria-hidden="true">
        {Array.from({ length: nivel }, (_, i) => (
          <span key={i} className={i < digitadas.length ? 'feita' : ''} />
        ))}
      </div>
      <div className="festa-siga-cruz">
        {[0, 1, 2, 3].map((seta) => (
          <button
            key={seta}
            type="button"
            className={`festa-seta s${seta}${acesa === seta ? (errou && modo === 'fim' ? ' errada' : ' acesa') : ''}`}
            disabled={!ativo || modo !== 'repetindo'}
            onPointerDown={(e) => {
              e.preventDefault();
              apertar(seta);
            }}
          >
            <Seta direcao={seta} />
          </button>
        ))}
        <span className="festa-siga-coelho" aria-hidden="true">
          <svg viewBox="0 0 40 40">
            <ellipse cx="14" cy="10" rx="3.5" ry="9" fill="#e8dccb" />
            <ellipse cx="26" cy="10" rx="3.5" ry="9" fill="#e8dccb" />
            <circle cx="20" cy="25" r="12" fill="#e8dccb" />
            <circle cx="16" cy="24" r="1.8" fill="#3a2e2a" />
            <circle cx="24" cy="24" r="1.8" fill="#3a2e2a" />
            <circle cx="20" cy="28" r="1.5" fill="#d98a8a" />
          </svg>
        </span>
      </div>
    </div>
  );
}

/** Tiro ao alvo: as cenouras aparecem numa grade 3 × 3; clique, toque, ou as teclas 1 a 9 na ordem de leitura. */
function Alvo({ dados, inicio, ativo, enviar, marcar }: PropsDoMicro) {
  const alvos = dados.alvos ?? [];
  const [acertos, setAcertos] = useState<number[]>([]);
  const agora = useRelogio(ativo);
  const e = agora - inicio;
  const naCasa = (casa: number) =>
    alvos.findIndex((a, i) => a.casa === casa && e >= a.t && e < a.t + ALVO_VIDA_MS && !acertos.includes(i));
  const acertar = (casa: number) => {
    if (!ativo || Date.now() - inicio >= ALVO_MS) return;
    const i = naCasa(casa);
    if (i < 0) return;
    setAcertos((a) => (a.includes(i) ? a : [...a, i]));
    // cada acerto vai na hora: o servidor confere no relógio dele que o alvo estava na tela
    marcar?.(i);
  };
  useEffect(() => {
    if (ativo && e >= ALVO_MS) enviar({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo, e >= ALVO_MS]);
  useTeclas(ativo, (ev) => {
    const n = Number(ev.key);
    if (!Number.isInteger(n) || n < 1 || n > 9) return false;
    acertar(n - 1);
    return true;
  });
  const fracao = Math.min(1, Math.max(0, e / ALVO_MS));
  return (
    <div className="festa-alvo">
      <div className="festa-alvo-topo">
        <span className="festa-mostrador">🥕 × {acertos.length}</span>
        <span className="festa-alvo-tempo" aria-hidden="true">
          <span style={{ width: `${(1 - fracao) * 100}%` }} />
        </span>
      </div>
      <div className="festa-alvo-grade">
        {Array.from({ length: 9 }, (_, casa) => {
          const i = naCasa(casa);
          return (
            <button
              key={casa}
              type="button"
              className="festa-alvo-casa"
              onPointerDown={(ev) => {
                ev.preventDefault();
                acertar(casa);
              }}
              disabled={!ativo}
            >
              <small aria-hidden="true">{casa + 1}</small>
              {i >= 0 && (
                <svg key={i} className="festa-cenoura" viewBox="0 0 40 40" aria-hidden="true">
                  <path d="M12 14 L28 14 L20 38 Z" fill="#e07a2e" />
                  <path d="M16 18 L22 19 M15 24 L21 25" stroke="#b85a1e" strokeWidth="1.5" />
                  <path d="M17 14 L12 4 M20 14 L20 2 M23 14 L28 4" stroke="#6fa356" strokeWidth="3.5" strokeLinecap="round" />
                </svg>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
