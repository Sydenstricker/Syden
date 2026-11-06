import { useEffect, useRef, useState } from 'react';
import { useT } from './i18n';
import { Relogio } from './Minijogo';
import { Mar3D } from './naval3d/Mar3D';
import { FROTA, casasDoNavio, encosta, inicioDoNavio } from './naval3d/montagem';
import type { FrotaDaCena } from './naval3d/cena';
import type { Partida } from './minijogos';
import './naval3d/naval.css';

const JOGADA_MS = 90_000;
/** O tempo da montagem (server/src/minijogo-naval.ts, MONTAGEM_MS): o mesmo da jogada. */
const MONTAGEM_MS = 90_000;
const LADO = 10;

/** O que se vê de um mar (server/src/minijogo-naval.ts): os tiros (0 nada, 1 água, 2 fogo) e os navios visíveis. */
export interface MarNaval {
  tiros: number[];
  navios: { casas: number[]; afundado: boolean }[];
}

export interface EstadoNaval {
  fase: 'esperando' | 'montando' | 'jogando' | 'fim';
  jogadores: { userId: number; username: string }[];
  vez: 0 | 1;
  vencedor: 0 | 1 | 'empate' | null;
  motivo: 'jogo' | 'tempo' | 'desistiu' | null;
  mares: [MarNaval, MarNaval];
  /** Os tamanhos dos navios que ainda boiam, por lado. */
  restam: [number[], number[]];
  ultimo: { lado: 0 | 1; casa: number; resultado: 'agua' | 'acertou' | 'afundou' } | null;
  /** A montagem: a MINHA frota na ordem da FROTA (null: ainda não posto; quem assiste recebe null), e quem já está pronto. */
  montagem?: { navios: (number[] | null)[] | null; prontos: [boolean, boolean] };
}

/** A frota que a pessoa vê no 3D (só aparência, só neste aparelho): a pirata ou a moderna. */
const FROTA_GUARDADA = 'syden:naval-frota';
function frotaGuardada(): FrotaDaCena {
  try {
    return localStorage.getItem(FROTA_GUARDADA) === 'moderna' ? 'moderna' : 'piratas';
  } catch {
    return 'piratas';
  }
}

/** A coordenada do jogo de papel: a letra é a coluna, o número a linha ("B7"). */
const coordenada = (casa: number) => `${String.fromCharCode(65 + (casa % LADO))}${Math.floor(casa / LADO) + 1}`;

/**
 * BATALHA NAVAL, na mesa de duas pessoas (a mesma de JogoDuelo.tsx): quem joga vê o próprio mar com os navios e o mar do
 * outro, onde atira na sua vez; quem assiste vê os dois mares só com o que os tiros revelaram. Antes do primeiro tiro, a
 * MONTAGEM (05/11/2026): cada um põe os próprios navios (MontagemDaFrota, abaixo).
 */
export function JogoNaval({
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
  const estado = partida as unknown as EstadoNaval & Partida;
  const meuLado = estado.jogadores.findIndex((j) => j.userId === eu);
  const sentado = meuLado === 0 || meuLado === 1;
  const jogando = estado.fase === 'jogando';
  const montando = estado.fase === 'montando';
  const minhaVez = jogando && meuLado === estado.vez;
  const nome = (lado: number) => estado.jogadores[lado]?.username ?? '?';
  const prontos = estado.montagem?.prontos ?? [false, false];
  const euPronto = sentado && prontos[meuLado];
  const [frota, setFrota] = useState<FrotaDaCena>(frotaGuardada);
  const escolherFrota = (f: FrotaDaCena) => {
    setFrota(f);
    try {
      localStorage.setItem(FROTA_GUARDADA, f);
    } catch {
      /* sem guardar: vale só agora */
    }
  };

  let situacao: string;
  if (estado.fase === 'esperando') {
    situacao = sentado ? t('Esperando alguém da sala sentar do outro lado…') : t('{nome} quer jogar. Sente do outro lado!', { nome: nome(0) });
  } else if (montando) {
    situacao = !sentado
      ? t('Os dois estão pondo os navios…')
      : euPronto
        ? t('Esperando {nome} pôr os navios…', { nome: nome(meuLado === 0 ? 1 : 0) })
        : t('Ponha os seus navios no mar.');
  } else if (jogando) {
    situacao = minhaVez ? t('Sua vez!') : t('Vez de {nome}.', { nome: nome(estado.vez) });
  } else if (estado.vencedor === 'empate') {
    situacao = t('Empate!');
  } else if (estado.vencedor === null) {
    situacao = t('Ninguém sentou para jogar.');
  } else {
    const perdedor = estado.vencedor === 0 ? 1 : 0;
    situacao =
      estado.motivo === 'tempo'
        ? t('{nome} demorou demais para jogar. {vencedor} venceu!', { nome: nome(perdedor), vencedor: nome(estado.vencedor) })
        : estado.motivo === 'desistiu'
          ? t('{nome} desistiu. {vencedor} venceu!', { nome: nome(perdedor), vencedor: nome(estado.vencedor) })
          : t('{nome} venceu!', { nome: nome(estado.vencedor) });
  }

  const ultimo = estado.ultimo;
  let resultado: string | null = null;
  if (ultimo && jogando) {
    resultado =
      ultimo.resultado === 'agua'
        ? t('Água!')
        : ultimo.resultado === 'afundou'
          ? t('Afundou!')
          : ultimo.lado === meuLado
            ? t('Acertou! Atire de novo.')
            : t('Acertou!');
  }

  // Quem joga vê primeiro o mar onde atira; quem assiste, os dois na ordem da mesa.
  const ordem: (0 | 1)[] = sentado ? [meuLado === 0 ? 1 : 0, meuLado as 0 | 1] : [0, 1];

  return (
    <div className="duelo duelo-naval">
      <div className="duelo-mesa">
        {[0, 1].map((lado) => (
          <span key={lado} className={`duelo-jogador${jogando && estado.vez === lado ? ' da-vez' : ''}${estado.vencedor === lado ? ' venceu' : ''}`}>
            <span className={`duelo-peca lado-${lado}`} aria-hidden="true" />
            {estado.jogadores[lado]?.username ?? '…'}
            {montando && prontos[lado] && <span className="naval-pronto"> ✓</span>}
          </span>
        ))}
      </div>

      {/* a frota que se vê no 3D: no 2D, o casco é um só */}
      {temWebGLNaval() && (
        <div className="naval-frotas" role="radiogroup" aria-label={t('Navios')}>
          {(['piratas', 'moderna'] as const).map((f) => (
            <button
              key={f}
              type="button"
              role="radio"
              aria-checked={frota === f}
              className={`naval-frotas-opcao${frota === f ? ' escolhida' : ''}`}
              aria-label={f === 'piratas' ? t('Navios piratas') : t('Navios modernos')}
              title={f === 'piratas' ? t('Navios piratas') : t('Navios modernos')}
              onClick={() => escolherFrota(f)}
            >
              {f === 'piratas' ? <FiguraPirata /> : <FiguraModerna />}
            </button>
          ))}
        </div>
      )}

      {montando && sentado ? (
        <MontagemDaFrota
          frotaVista={frota}
          mar={estado.mares[meuLado]}
          frota={estado.montagem?.navios ?? FROTA.map(() => null)}
          pronto={euPronto}
          agir={agir}
        />
      ) : (
        <div className="naval-mares">
          {ordem.map((lado) => {
            const meu = sentado && lado === meuLado;
            const alvo = sentado && !meu;
            return (
              <MarDaTela
                key={lado}
                titulo={meu ? t('Seu mar') : t('Mar de {nome}', { nome: nome(lado) })}
                mar={estado.mares[lado]}
                restam={estado.restam[lado]}
                meu={meu}
                alvo={alvo}
                daVez={jogando && estado.vez !== lado}
                podeAtirar={alvo && minhaVez}
                ultima={ultimo && ultimo.lado !== lado ? ultimo.casa : null}
                atirar={(casa) => agir({ tipo: 'jogada', casa })}
                frota={frota}
              />
            );
          })}
        </div>
      )}

      <p className={`minijogo-situacao${minhaVez || (montando && sentado && !euPronto) ? ' minha-vez' : ''}`} role="status">
        {situacao}
        {resultado && <span className={`naval-resultado ${ultimo?.resultado}`}> {resultado}</span>}
      </p>
      {/* no Solo, contra o computador, pensar não tem prazo */}
      {jogando && !estado.solo && <Relogio restante={restante} total={JOGADA_MS} />}
      {montando && !estado.solo && <Relogio restante={restante} total={MONTAGEM_MS} />}
      {estado.fase === 'esperando' && !sentado && (
        <button type="button" className="btn-primary duelo-sentar" onClick={() => agir({ tipo: 'sentar' })}>
          {t('Jogar')}
        </button>
      )}
      {(jogando || montando) && sentado && (
        <button type="button" className="link-button duelo-desistir" onClick={() => agir({ tipo: 'desistir' })}>
          {t('Desistir')}
        </button>
      )}
    </div>
  );
}

/**
 * A MONTAGEM DA FROTA (05/11/2026, pedido dele: "eu quero primeiro colocar os navios antes de jogar"). O próprio mar, a fila
 * dos cinco navios e três botões: Girar (ou a tecla R), Sortear a frota e Pronto. Escolhe-se o navio e toca-se na casa; um
 * navio já posto se arrasta para outro lugar, ou se escolhe tocando nele. O fantasma mostra onde ele vai cair (verde cabe,
 * vermelho não), no 3D e na grade. A grade de botões é também a do teclado e do leitor de tela. O servidor confere tudo.
 */
function MontagemDaFrota({
  frotaVista,
  mar,
  frota,
  pronto,
  agir,
}: {
  frotaVista: FrotaDaCena;
  mar: MarNaval;
  frota: (number[] | null)[];
  pronto: boolean;
  agir: (corpo: Record<string, unknown>) => void;
}) {
  const t = useT();
  const primeiroLivre = (excluir: number | null = null) => {
    const i = frota.findIndex((n, k) => n === null && k !== excluir);
    return i >= 0 ? i : null;
  };
  const [escolhido, setEscolhido] = useState<number | null>(() => primeiroLivre());
  const [deitado, setDeitado] = useState(true);
  /** A casa do navio que o ponteiro segura (0: a primeira), para o navio arrastado cair onde a mão está. */
  const [pega, setPega] = useState(0);
  const [sobre, setSobre] = useState<number | null>(null);
  const arrasto = useRef<{ navio: number; origem: number } | null>(null);
  const soltouEm = useRef(0);

  const orientacao = (casas: number[]) => casas.length < 2 || Math.abs(casas[1] - casas[0]) === 1;
  const donoDa = (casa: number) => frota.findIndex((n) => n?.includes(casa));
  const outros = (i: number) => frota.filter((_, k) => k !== i);
  const cabe = (i: number, inicio: number, deitadoAgora: boolean) => {
    const casas = casasDoNavio(inicio, FROTA[i], deitadoAgora);
    return casas && !encosta(casas, outros(i)) ? casas : null;
  };

  const por = (i: number, inicio: number, deitadoAgora: boolean, seguir: boolean) => {
    const atual = frota[i];
    if (atual && atual[0] === inicio && orientacao(atual) === deitadoAgora) return;
    if (!cabe(i, inicio, deitadoAgora)) return;
    agir({ tipo: 'montar', acao: 'por', navio: i, casa: inicio, deitado: deitadoAgora });
    if (seguir) {
      // o próximo navio que falta já vem escolhido: tocar, tocar, tocar…
      const proximo = primeiroLivre(i);
      setEscolhido(proximo);
      setPega(0);
    }
  };

  const escolher = (i: number) => {
    setEscolhido(i);
    setPega(0);
    const casas = frota[i];
    if (casas) setDeitado(orientacao(casas));
  };

  /** Tocar numa casa (o clique, o Enter na grade, o toque): escolhe o navio que está nela, ou põe o escolhido ali. */
  const clicar = (casa: number) => {
    if (pronto) return;
    const dono = donoDa(casa);
    if (dono >= 0 && dono !== escolhido) return escolher(dono);
    if (escolhido === null || dono === escolhido) return;
    por(escolhido, inicioDoNavio(casa, 0, FROTA[escolhido], deitado), deitado, frota[escolhido] === null);
  };

  const apertar = (casa: number) => {
    if (pronto) return;
    const dono = donoDa(casa);
    if (dono < 0) return;
    const casas = frota[dono]!;
    arrasto.current = { navio: dono, origem: casa };
    setEscolhido(dono);
    setDeitado(orientacao(casas));
    setPega(casas.indexOf(casa));
  };

  /** Soltar o ponteiro: o navio arrastado cai onde o ponteiro está. `comClique`: sem arrasto, conta como tocar (a cena 3D). */
  const soltar = (casa: number | null, comClique: boolean) => {
    const a = arrasto.current;
    arrasto.current = null;
    if (!a) {
      if (comClique && casa !== null) clicar(casa);
      return;
    }
    if (casa !== null && casa !== a.origem) {
      soltouEm.current = performance.now();
      const casas = frota[a.navio];
      por(a.navio, inicioDoNavio(casa, pega, FROTA[a.navio], casas ? orientacao(casas) : deitado), casas ? orientacao(casas) : deitado, false);
    }
    setPega(0);
  };

  const girar = () => {
    if (pronto) return;
    const novo = !deitado;
    setDeitado(novo);
    if (escolhido === null) return;
    const casas = frota[escolhido];
    // o navio já posto gira na própria casa de cima (ou da esquerda), empurrado para dentro do mar; não cabendo, só o fantasma gira
    if (casas) por(escolhido, inicioDoNavio(Math.min(...casas), 0, FROTA[escolhido], novo), novo, false);
  };

  const girarAgora = useRef(girar);
  girarAgora.current = girar;
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== 'r' && e.key !== 'R') return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const alvo = e.target as HTMLElement | null;
      if (alvo && (alvo.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(alvo.tagName))) return;
      e.preventDefault();
      girarAgora.current();
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, []);

  // o fantasma: o navio escolhido onde o ponteiro está (arrastando, com a casa que a mão segura)
  let fantasma: { casas: number[]; ok: boolean; ordem: number } | null = null;
  if (!pronto && escolhido !== null && sobre !== null) {
    const naoSaiu = arrasto.current !== null && sobre === arrasto.current.origem;
    // sem arrasto, tocar num navio o escolhe (não põe nada ali): sobre um navio, o fantasma não aparece
    const sobreNavio = !arrasto.current && donoDa(sobre) >= 0;
    if (!naoSaiu && !sobreNavio) {
      const inicio = inicioDoNavio(sobre, arrasto.current ? pega : 0, FROTA[escolhido], deitado);
      const casas = casasDoNavio(inicio, FROTA[escolhido], deitado);
      const ordem = FROTA.slice(0, escolhido).filter((x) => x === FROTA[escolhido!]).length;
      if (casas) fantasma = { casas, ok: !encosta(casas, outros(escolhido)), ordem };
    }
  }
  const casasDoFantasma = new Map((fantasma?.casas ?? []).map((c) => [c, fantasma!.ok]));
  const escolhidas = escolhido !== null ? frota[escolhido] : null;
  const falta = frota.some((n) => n === null);

  const casaNoPonto = (x: number, y: number) => {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-casa]');
    return el ? Number(el.dataset.casa) : null;
  };

  const grade = (
    <div
      className="naval-grade naval-grade-montagem"
      onPointerMove={(e) => setSobre(casaNoPonto(e.clientX, e.clientY))}
      onPointerLeave={() => !arrasto.current && setSobre(null)}
      onPointerUp={(e) => soltar(casaNoPonto(e.clientX, e.clientY), false)}
    >
      {frota.map((casas, i) => {
        if (!casas) return null;
        const ordenadas = [...casas].sort((a, b) => a - b);
        const deitadoAqui = orientacao(ordenadas);
        const linha = Math.floor(ordenadas[0] / LADO) + 1;
        const coluna = (ordenadas[0] % LADO) + 1;
        return (
          <span
            key={i}
            className={`naval-navio${deitadoAqui ? ' deitado' : ' em-pe'}${escolhido === i ? ' escolhido' : ''}`}
            style={{
              gridRow: deitadoAqui ? `${linha}` : `${linha} / span ${casas.length}`,
              gridColumn: deitadoAqui ? `${coluna} / span ${casas.length}` : `${coluna}`,
            }}
            aria-hidden="true"
          />
        );
      })}
      {mar.tiros.map((_, casa) => {
        const dono = donoDa(casa);
        const noFantasma = casasDoFantasma.get(casa);
        return (
          <button
            key={casa}
            type="button"
            data-casa={casa}
            className={`naval-casa${noFantasma === true ? ' fantasma-ok' : noFantasma === false ? ' fantasma-ruim' : ''}${escolhidas?.includes(casa) ? ' do-escolhido' : ''}`}
            style={{ gridRow: Math.floor(casa / LADO) + 1, gridColumn: (casa % LADO) + 1 }}
            disabled={pronto}
            aria-label={dono >= 0 ? `${coordenada(casa)} · ${t('Navio de {n} casas', { n: FROTA[dono] })}` : coordenada(casa)}
            onFocus={() => setSobre(casa)}
            onPointerDown={(e) => {
              if (e.button > 0) return;
              apertar(casa);
            }}
            onClick={() => {
              // o soltar de um arrasto já pôs o navio
              if (performance.now() - soltouEm.current < 300) return;
              clicar(casa);
            }}
          />
        );
      })}
    </div>
  );

  return (
    <div className={`naval-montagem${pronto ? ' pronto' : ''}`}>
      <section className="naval-mar meu">
        <h4 className="naval-titulo">{t('Seu mar')}</h4>
        <Mar3D
          dados={{
            tiros: mar.tiros,
            navios: mar.navios,
            meu: true,
            podeAtirar: false,
            ultima: null,
            frota: frotaVista,
            montagem: pronto ? { fantasma: null, escolhido: null } : { fantasma, escolhido: escolhidas },
          }}
          aoAtirar={() => {}}
          toques={{ passar: setSobre, apertar, soltar: (casa) => soltar(casa, true) }}
          grade={grade}
        />
      </section>

      {!pronto && (
        <>
          <div className="naval-frota" role="group" aria-label={t('Seus navios')}>
            {FROTA.map((tamanho, i) => (
              <button
                key={i}
                type="button"
                className={`naval-frota-navio${escolhido === i ? ' escolhido' : ''}${frota[i] ? ' posto' : ''}`}
                aria-pressed={escolhido === i}
                aria-label={t('Navio de {n} casas', { n: tamanho })}
                onClick={() => escolher(i)}
              >
                <span className="naval-frota-casco" style={{ width: `${tamanho * 11}px` }} aria-hidden="true" />
              </button>
            ))}
          </div>
          <p className="naval-dica">{t('Escolha um navio e toque no mar. Arraste para mudar de lugar.')}</p>
          <div className="naval-botoes">
            <button type="button" className="btn-secondary" onClick={girar} aria-keyshortcuts="R">
              {t('Girar')} <kbd aria-hidden="true">R</kbd>
            </button>
            <button type="button" className="btn-secondary" onClick={() => agir({ tipo: 'montar', acao: 'sortear' })}>
              {t('Sortear a frota')}
            </button>
            <button type="button" className="btn-primary" disabled={falta} onClick={() => agir({ tipo: 'montar', acao: 'pronto' })}>
              {t('Pronto')}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function MarDaTela({
  titulo,
  mar,
  restam,
  meu,
  alvo,
  daVez,
  podeAtirar,
  ultima,
  atirar,
  frota,
}: {
  frota: FrotaDaCena;
  titulo: string;
  mar: MarNaval;
  restam: number[];
  meu: boolean;
  alvo: boolean;
  /** É o mar que está levando tiro agora. */
  daVez: boolean;
  podeAtirar: boolean;
  ultima: number | null;
  atirar: (casa: number) => void;
}) {
  return (
    <section className={`naval-mar${meu ? ' meu' : ''}${alvo ? ' alvo' : ''}${daVez ? ' na-mira' : ''}`}>
      <h4 className="naval-titulo">{titulo}</h4>
      <Mar3D
        dados={{ tiros: mar.tiros, navios: mar.navios, meu, podeAtirar, ultima, frota }}
        aoAtirar={atirar}
        grade={
      <div className="naval-grade">
        {mar.navios.map((navio) => {
          const casas = [...navio.casas].sort((a, b) => a - b);
          const primeira = casas[0];
          const deitado = casas.length > 1 && casas[1] - casas[0] === 1;
          const linha = Math.floor(primeira / LADO) + 1;
          const coluna = (primeira % LADO) + 1;
          return (
            <span
              key={primeira}
              className={`naval-navio${deitado ? ' deitado' : ' em-pe'}${navio.afundado ? ' afundado' : ''}`}
              style={{
                gridRow: deitado ? `${linha}` : `${linha} / span ${casas.length}`,
                gridColumn: deitado ? `${coluna} / span ${casas.length}` : `${coluna}`,
              }}
              aria-hidden="true"
            />
          );
        })}
        {mar.tiros.map((tiro, casa) => (
          <button
            key={casa}
            type="button"
            className={`naval-casa${tiro === 1 ? ' agua' : tiro === 2 ? ' fogo' : ''}${ultima === casa ? ' ultima' : ''}`}
            style={{ gridRow: Math.floor(casa / LADO) + 1, gridColumn: (casa % LADO) + 1 }}
            disabled={!podeAtirar || tiro !== 0}
            aria-label={coordenada(casa)}
            onClick={() => atirar(casa)}
          />
        ))}
      </div>
        }
      />
      <div className="naval-restam" aria-hidden="true">
        {restam.map((tamanho, k) => (
          <span key={k} className="naval-silhueta" style={{ width: `${tamanho * 7}px` }} />
        ))}
      </div>
    </section>
  );
}

/** As figuras das duas frotas, no lugar de texto: o veleiro com a bandeira e o navio com a chaminé. */
function FiguraPirata() {
  return (
    <svg viewBox="0 0 32 24" width="32" height="24" aria-hidden="true">
      <path d="M3 16h26l-4 6H7z" fill="#8a5a33" />
      <path d="M15 2v14" stroke="#4a3322" strokeWidth="1.6" />
      <path d="M15.8 3c5 1.5 7.5 6 7.5 11H15.8z" fill="#f1e6cf" />
      <path d="M14.2 5c-4 1.5-6 5-6 9h6z" fill="#e6d8bb" />
      <path d="M15 2h6v3h-6z" fill="#2b2b2b" />
    </svg>
  );
}
function FiguraModerna() {
  return (
    <svg viewBox="0 0 32 24" width="32" height="24" aria-hidden="true">
      <path d="M2 15h28l-4 7H6z" fill="#2f5d8a" />
      <path d="M6 10h18v5H6z" fill="#f4f4f0" />
      <path d="M9 6h12v4H9z" fill="#e8e8e2" />
      <path d="M17 1h4v5h-4z" fill="#d8453a" />
      <path d="M8 12h2M12 12h2M16 12h2M20 12h2" stroke="#2f5d8a" strokeWidth="1.4" />
    </svg>
  );
}

/** A escolha da frota é só do 3D (no 2D o casco é um só): aparece onde o 3D pode abrir. */
function temWebGLNaval(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}
