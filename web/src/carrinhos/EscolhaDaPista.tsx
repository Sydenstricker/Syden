import { useMemo, useState } from 'react';
import { chave, useT } from '../i18n';
import './carrinhos.css';
import { tempoLegivel } from '../jato/util';
import {
  amostrasDaLinhaDoMeio,
  codigoDaPista,
  fimDoTracado,
  IDS_DAS_PISTAS,
  lerCodigoDaPista,
  montarPista,
  normalizarTracado,
  PECAS_NO_MAXIMO,
  PISTA_PADRAO,
  PISTAS,
  validarTracado,
  VOLTAS,
  VOLTAS_DA_RESISTENCIA,
  sufixoDasVoltas,
  type ErroDoTracado,
  type LetraDaPeca,
  type Pista,
} from './sim';

/**
 * A ESCOLHA DA PISTA DOS CARRINHOS (19/11/2026): os cinco traçados prontos (um mapa de cada, sem nome: o desenho já diz), as
 * voltas (5, ou 20 na resistência) e o EDITOR, em que se monta a própria pista peça a peça (reta, curva para cada lado e o
 * cruzamento). A pista do editor só vale se fechar (a mesma conferência do servidor, `validarTracado` em sim.ts), e vira um
 * código de texto para copiar e colar ("SYDP1-…"), que outra pessoa usa como está. O último traçado do editor fica neste
 * navegador (só uma conveniência: a pista de verdade é o código).
 */

/** A pista que o estado do servidor diz (a pronta pelo id, a do editor pelo traçado). */
const montadas = new Map<string, Pista>();
export function pistaDoEstado(estado: { pista?: string; tracado?: string }): Pista {
  if (estado.pista && PISTAS[estado.pista]) return PISTAS[estado.pista];
  if (!estado.tracado) return PISTA_PADRAO;
  let p = montadas.get(estado.tracado);
  if (!p) {
    p = montarPista(estado.tracado);
    montadas.set(estado.tracado, p);
  }
  return p;
}

const GUARDADO = 'syden:carrinhos-editor';
const lerGuardado = () => {
  try {
    return normalizarTracado(localStorage.getItem(GUARDADO) ?? '').slice(0, PECAS_NO_MAXIMO);
  } catch {
    return '';
  }
};
const guardar = (t: string) => {
  try {
    localStorage.setItem(GUARDADO, t);
  } catch {
    /* fica sem */
  }
};

/** O mapa de um traçado, visto de cima (como a câmera da corrida: o +x à direita, o +z para baixo). */
export function MapaDaPista({ tracado, aberto = false }: { tracado: string; aberto?: boolean }) {
  const desenho = useMemo(() => {
    const pontos = amostrasDaLinhaDoMeio(tracado, 0.5);
    const pista = montarPista(tracado);
    const fim = fimDoTracado(tracado);
    const xs = pontos.map((p) => p.x), zs = pontos.map((p) => p.z);
    const m = 3;
    const x0 = Math.min(...xs) - m, z0 = Math.min(...zs) - m;
    const w = Math.max(...xs) + m - x0, h = Math.max(...zs) + m - z0;
    const caminho = pontos.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(2)} ${p.z.toFixed(2)}`).join(' ');
    // os riscos dos cruzamentos (as faixas trocando de lado)
    const riscos: string[] = [];
    pista.trechos.forEach((lista) =>
      lista.forEach((t) => {
        if (!t.ladoX && !t.ladoZ) return;
        const bx = t.x + Math.cos(t.rumo) * 4 + t.ladoX, bz = t.z + Math.sin(t.rumo) * 4 + t.ladoZ;
        riscos.push(`M${t.x.toFixed(2)} ${t.z.toFixed(2)} L${bx.toFixed(2)} ${bz.toFixed(2)}`);
      }),
    );
    // as agulhas (24/11/2026): o desvio de cada faixa para a outra da fileira, tracejado
    const agulhas: string[] = [];
    pista.trechos.forEach((lista, f) =>
      lista.forEach((t, i) => {
        if (!t.troca) return;
        const o = pista.trechos[f ^ 1][i];
        const bx = o.x + Math.cos(t.rumo) * 4, bz = o.z + Math.sin(t.rumo) * 4;
        agulhas.push(`M${t.x.toFixed(2)} ${t.z.toFixed(2)} L${bx.toFixed(2)} ${bz.toFixed(2)}`);
      }),
    );
    // a largada: um traço de lado a lado no começo
    const a = pontos[0], b = pontos[1] ?? { x: a.x + 1, z: a.z };
    const l = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    const nx = -(b.z - a.z) / l, nz = (b.x - a.x) / l;
    const largada = `M${(a.x + nx * 2).toFixed(2)} ${(a.z + nz * 2).toFixed(2)} L${(a.x - nx * 2).toFixed(2)} ${(a.z - nz * 2).toFixed(2)}`;
    const [dx, dz] = [
      [1, 0],
      [0, 1],
      [-1, 0],
      [0, -1],
    ][((fim.q % 4) + 4) % 4];
    const seta = `M${fim.x + dx * 1.8} ${fim.z + dz * 1.8} L${fim.x - dz * 1.2} ${fim.z + dx * 1.2} L${fim.x + dz * 1.2} ${fim.z - dx * 1.2} Z`;
    return { vista: `${x0} ${z0} ${w} ${h}`, caminho, riscos, agulhas, largada, seta };
  }, [tracado]);
  return (
    <svg className="carrinhos-mapa" viewBox={desenho.vista} aria-hidden="true">
      {tracado && (
        <>
          <path d={desenho.caminho} fill="none" stroke="#4f4c55" strokeWidth="4" strokeLinejoin="round" />
          <path d={desenho.caminho} fill="none" stroke="#f3ead2" strokeWidth="0.18" strokeDasharray="0.8 0.8" />
          {desenho.riscos.map((d, i) => (
            <path key={i} d={d} stroke="#ffe08a" strokeWidth="0.3" />
          ))}
          {desenho.agulhas.map((d, i) => (
            <path key={`a${i}`} d={d} stroke="#ffd36b" strokeWidth="0.3" strokeDasharray="0.6 0.5" />
          ))}
          <path d={desenho.largada} stroke="#ffffff" strokeWidth="0.7" />
        </>
      )}
      {aberto && <path d={desenho.seta} fill="#ff6b5b" />}
    </svg>
  );
}

/** A figura de cada peça no botão do editor. */
function FiguraDaPeca({ peca }: { peca: LetraDaPeca }) {
  const asfalto = { fill: 'none', stroke: 'currentColor', strokeWidth: 5, strokeLinecap: 'butt' as const };
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      {peca === 'R' && <path d="M12 22 V2" {...asfalto} />}
      {peca === '+' && <path d="M8 22 V16 A8 8 0 0 1 16 8 H22" {...asfalto} />}
      {peca === '-' && <path d="M16 22 V16 A8 8 0 0 0 8 8 H2" {...asfalto} />}
      {peca === 'X' && (
        <>
          <path d="M12 22 V2" {...asfalto} strokeWidth={9} opacity={0.35} />
          <path d="M8 21 L16 3 M16 21 L8 3" stroke="currentColor" strokeWidth="2" />
        </>
      )}
      {peca === 'T' && (
        <>
          <path d="M12 22 V2" {...asfalto} strokeWidth={9} opacity={0.35} />
          <path d="M9.5 22 V2 M9.5 18 L14.5 6 V2" fill="none" stroke="currentColor" strokeWidth="2" />
        </>
      )}
    </svg>
  );
}

const PECAS_DO_EDITOR: { peca: LetraDaPeca; rotulo: string }[] = [
  { peca: 'R', rotulo: chave('Reta') },
  { peca: '-', rotulo: chave('Curva à esquerda') },
  { peca: '+', rotulo: chave('Curva à direita') },
  { peca: 'X', rotulo: chave('Cruzamento') },
  { peca: 'T', rotulo: chave('Troca de faixa') },
];

const MENSAGEM: Record<ErroDoTracado, string> = {
  pecas: chave('A pista precisa de mais peças.'),
  reta: chave('A largada precisa de uma reta.'),
  curta: chave('A pista está curta demais.'),
  'nao-fecha': chave('A pista ainda não fecha a volta.'),
  impar: chave('Os cruzamentos vão em par.'),
  cruza: chave('A pista passa por cima dela mesma.'),
};

/** O EDITOR: montar a pista peça a peça, conferir, copiar o código ou colar o de alguém. `aoUsar` recebe o traçado que vale. */
export function EditorDePista({ aoUsar }: { aoUsar: (tracado: string) => void }) {
  const t = useT();
  const [tracado, setTracado] = useState(lerGuardado);
  const [colado, setColado] = useState('');
  const [aviso, setAviso] = useState<{ texto: string; ruim?: boolean } | null>(null);
  const mudar = (novo: string) => {
    setTracado(novo);
    guardar(novo);
    setAviso(null);
  };
  const normal = normalizarTracado(tracado);
  const conferido = normal ? validarTracado(normal) : null;
  const vale = conferido && 'pista' in conferido;
  const codigo = vale ? codigoDaPista(normal) : '';
  return (
    <div className="carrinhos-editor">
      <MapaDaPista tracado={tracado} aberto={!vale} />
      <div className="carrinhos-pecas" role="group" aria-label={t('Montar uma pista')}>
        {PECAS_DO_EDITOR.map(({ peca, rotulo }) => (
          <button key={peca} type="button" title={t(rotulo)} aria-label={t(rotulo)} disabled={tracado.length >= PECAS_NO_MAXIMO} onClick={() => mudar(tracado + peca)}>
            <FiguraDaPeca peca={peca} />
          </button>
        ))}
        <button type="button" title={t('Desfazer')} aria-label={t('Desfazer')} disabled={!tracado} onClick={() => mudar(tracado.slice(0, -1))}>
          ↶
        </button>
        <button type="button" title={t('Apagar')} aria-label={t('Apagar')} disabled={!tracado} onClick={() => mudar('')}>
          ✕
        </button>
      </div>
      {conferido && 'erro' in conferido && <p className="settings-hint">{t(MENSAGEM[conferido.erro])}</p>}
      {vale && (
        <div className="carrinhos-codigo">
          <input readOnly value={codigo} aria-label={t('Código da pista')} onFocus={(e) => e.currentTarget.select()} />
          <button
            type="button"
            className="btn-secondary"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(codigo);
                setAviso({ texto: t('Código copiado.') });
              } catch {
                setAviso({ texto: t('Selecione o código e copie com Ctrl+C.') });
              }
            }}
          >
            {t('Copiar')}
          </button>
          <button type="button" className="btn-primary" onClick={() => aoUsar(normal)}>
            {t('Usar')}
          </button>
        </div>
      )}
      <form
        className="carrinhos-codigo"
        onSubmit={(e) => {
          e.preventDefault();
          const lido = lerCodigoDaPista(colado);
          if (!lido) return setAviso({ texto: t('Esse código não é de uma pista dos carrinhos.'), ruim: true });
          setColado('');
          mudar(lido);
        }}
      >
        <input value={colado} placeholder={t('Cole um código aqui')} aria-label={t('Cole um código aqui')} onChange={(e) => setColado(e.target.value)} />
        <button className="btn-secondary" disabled={!colado.trim()}>
          {t('Usar')}
        </button>
      </form>
      {aviso && (
        <p className={aviso.ruim ? 'form-error small' : 'form-success small'} role="status">
          {aviso.texto}
        </p>
      )}
    </div>
  );
}

/** O que a escolha pede: uma pista pronta pelo id, ou a do editor pelo código, e as voltas. */
export interface PedidoDePista {
  pista?: string;
  codigo?: string;
  voltas?: number;
}

/**
 * A ESCOLHA (no Solo, dentro do jogo; na sala, antes do convite): os mapas das pistas prontas, a do editor (quando há uma), as
 * voltas e o botão que abre o editor. `pista`/`tracado` são os escolhidos; cada mudança vai por `aoMudar`.
 */
export function EscolhaDaPistaDosCarrinhos({
  pista,
  tracado,
  voltas,
  meusTempos,
  aoMudar,
}: {
  pista: string;
  tracado: string;
  voltas: number;
  meusTempos?: Record<string, number>;
  aoMudar: (pedido: PedidoDePista) => void;
}) {
  const t = useT();
  const [editando, setEditando] = useState(false);
  const doEditor = !PISTAS[pista] && tracado ? tracado : null;
  const sufixo = sufixoDasVoltas(voltas);
  return (
    <div className="carrinhos-escolha-pista">
      <ul className="carrinhos-pistas">
        {IDS_DAS_PISTAS.map((id, i) => {
          const meu = meusTempos?.[id + sufixo];
          return (
            <li key={id}>
              <button
                type="button"
                className={`carrinhos-pista${pista === id ? ' escolhido' : ''}`}
                aria-pressed={pista === id}
                aria-label={t('Pista {n}', { n: i + 1 })}
                onClick={() => {
                  setEditando(false);
                  aoMudar({ pista: id });
                }}
              >
                <MapaDaPista tracado={PISTAS[id].tracado} />
                <span>{meu !== undefined ? tempoLegivel(meu) : i + 1}</span>
              </button>
            </li>
          );
        })}
        {doEditor && (
          <li>
            <button type="button" className="carrinhos-pista escolhido" aria-pressed="true" aria-label={t('Código da pista')} onClick={() => setEditando(true)}>
              <MapaDaPista tracado={doEditor} />
              <span>✎</span>
            </button>
          </li>
        )}
        <li>
          <button type="button" className={`carrinhos-pista carrinhos-montar${editando ? ' escolhido' : ''}`} aria-expanded={editando} onClick={() => setEditando((e) => !e)}>
            <FiguraDaPeca peca="+" />
            <span>{t('Montar uma pista')}</span>
          </button>
        </li>
      </ul>
      {editando && (
        <EditorDePista
          aoUsar={(novo) => {
            setEditando(false);
            aoMudar({ codigo: codigoDaPista(novo) });
          }}
        />
      )}
      <fieldset className="carrinhos-robos">
        <legend>🏁 {t('Voltas')}</legend>
        <div role="radiogroup">
          {[VOLTAS, VOLTAS_DA_RESISTENCIA].map((n) => (
            <button key={n} type="button" role="radio" aria-checked={voltas === n} className={voltas === n ? 'escolhido' : ''} onClick={() => aoMudar({ voltas: n })}>
              {n}
            </button>
          ))}
        </div>
      </fieldset>
    </div>
  );
}

/** Na sala, antes do convite: a escolha guardada aqui, e o "Começar" convida a turma para ela. */
export function EscolhaDaPistaNaSala({ aoEscolher, aoVoltar }: { aoEscolher: (pedido: PedidoDePista) => void; aoVoltar: () => void }) {
  const t = useT();
  const [pedido, setPedido] = useState<{ pista: string; tracado: string; voltas: number; codigo?: string }>({
    pista: PISTA_PADRAO.id,
    tracado: PISTA_PADRAO.tracado,
    voltas: VOLTAS,
  });
  return (
    <div className="carrinhos-escolha">
      <EscolhaDaPistaDosCarrinhos
        pista={pedido.pista}
        tracado={pedido.tracado}
        voltas={pedido.voltas}
        aoMudar={(m) =>
          setPedido((p) => {
            if (m.voltas !== undefined) return { ...p, voltas: m.voltas };
            if (m.pista) return { pista: m.pista, tracado: PISTAS[m.pista].tracado, voltas: p.voltas };
            const lido = m.codigo ? lerCodigoDaPista(m.codigo) : null;
            return lido ? { pista: pistaDoEstado({ tracado: lido }).id, tracado: lido, voltas: p.voltas, codigo: m.codigo } : p;
          })
        }
      />
      <div className="minijogo-acoes">
        <button
          type="button"
          className="btn-primary"
          onClick={() => aoEscolher(pedido.codigo && !PISTAS[pedido.pista] ? { codigo: pedido.codigo, voltas: pedido.voltas } : { pista: pedido.pista, voltas: pedido.voltas })}
        >
          {t('Começar')}
        </button>
        <button type="button" className="btn-secondary" onClick={aoVoltar}>
          {t('Outros jogos')}
        </button>
      </div>
    </div>
  );
}
