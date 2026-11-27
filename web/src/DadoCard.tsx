import { Eye, EyeOff } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { api } from './api';
import { useJanelaComFoco } from './janelaComFoco';
import { useT } from './i18n';
import { tocar } from './somDosJogos';
import type { DadoNaMensagem, DadoSorteado, TermoDeDados } from './types';

/**
 * O dado, a moeda ou o sorteio dentro da mensagem (27/11/2026; o porquê no CLAUDE.md, "O bot de dados"). Tudo em 2D, em SVG e
 * CSS: o servidor já decidiu o que saiu, e a tela só encena (os números trocam depressa e travam no resultado).
 *
 * A encenação toca UMA vez, para quem está com a conversa aberta na hora; ao rolar o histórico o cartão já vem com o
 * resultado. Com "menos movimento" ou com a janela sem foco, nunca anima.
 */

const JANELA_DE_ENCENACAO_MS = 8000;
/** Quais mensagens já foram encenadas (a lista virtualiza e remonta; não repete). */
const jaEncenadas = new Set<number>();

function menosMovimento() {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Deve encenar? Só a rolagem de agora (até 8 s; o relógio do aparelho pode diferir um pouco), uma vez, com a janela à vista. */
function useEncenar(messageId: number, createdAt: string): boolean {
  const comFoco = useJanelaComFoco();
  const [encenar] = useState(() => {
    if (jaEncenadas.has(messageId)) return false;
    const idade = Date.now() - Date.parse(createdAt);
    return idade < JANELA_DE_ENCENACAO_MS && idade > -30_000 && !menosMovimento() && !document.hidden && document.hasFocus();
  });
  useEffect(() => {
    if (encenar) jaEncenadas.add(messageId);
  }, [encenar, messageId]);
  return encenar && comFoco;
}

/** O número que "rola": troca depressa, vai desacelerando e trava no valor final. Sem encenar, é o valor final de cara. */
function useNumeroRolando(final: number, faces: number, encenar: boolean, atrasoMs: number, aoTerminar?: () => void) {
  const [mostrado, setMostrado] = useState(encenar ? Math.max(1, Math.ceil(Math.random() * faces)) : final);
  const [rolando, setRolando] = useState(encenar);
  const terminou = useRef(aoTerminar);
  terminou.current = aoTerminar;
  useEffect(() => {
    if (!encenar) {
      setMostrado(final);
      setRolando(false);
      return;
    }
    let parado = false;
    let passo = 0;
    const total = 11;
    const timers: number[] = [];
    const proximo = () => {
      if (parado) return;
      passo++;
      if (passo >= total) {
        setMostrado(final);
        setRolando(false);
        terminou.current?.();
        return;
      }
      setMostrado(1 + Math.floor(Math.random() * Math.max(2, faces)));
      timers.push(window.setTimeout(proximo, 45 + passo * 14));
    };
    timers.push(window.setTimeout(proximo, atrasoMs));
    return () => {
      parado = true;
      for (const t of timers) clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [encenar, final, faces, atrasoMs]);
  return { mostrado, rolando };
}

// ---------- A silhueta de cada dado ----------

/** Os pontos da silhueta, num quadro de 48 × 48. */
function silhueta(faces: number | 'F'): { tipo: 'poligono'; pontos: string } | { tipo: 'quadrado' } | { tipo: 'circulo' } {
  switch (faces) {
    case 4:
      return { tipo: 'poligono', pontos: '24,4 45,42 3,42' };
    case 6:
    case 'F':
      return { tipo: 'quadrado' };
    case 8:
      return { tipo: 'poligono', pontos: '24,2 46,24 24,46 2,24' };
    case 10:
    case 100:
      return { tipo: 'poligono', pontos: '24,2 44,18 24,46 4,18' };
    case 12:
      return { tipo: 'poligono', pontos: '24,3 45,19 37,44 11,44 3,19' };
    case 20:
      return { tipo: 'poligono', pontos: '24,2 43,13 43,35 24,46 5,35 5,13' };
    default:
      return { tipo: 'circulo' };
  }
}

function FormaDoDado({ faces, texto, estado }: { faces: number | 'F'; texto: string; estado?: 'rolando' | 'descartado' | 'critico' | 'falha' | 'maximo' }) {
  const forma = silhueta(faces);
  const miolo = faces === 20 && forma.tipo === 'poligono' ? <polygon className="dado-miolo" points="24,13 35,32 13,32" /> : null;
  return (
    <svg className={`dado-forma${estado ? ' ' + estado : ''}`} viewBox="0 0 48 48" width="44" height="44" aria-hidden="true">
      {forma.tipo === 'poligono' && <polygon className="dado-corpo" points={forma.pontos} />}
      {forma.tipo === 'quadrado' && <rect className="dado-corpo" x="5" y="5" width="38" height="38" rx="8" />}
      {forma.tipo === 'circulo' && <circle className="dado-corpo" cx="24" cy="24" r="21" />}
      {miolo}
      <text className="dado-numero" x="24" y={faces === 4 ? 33 : 29} textAnchor="middle" fontSize={texto.length > 2 ? 14 : 18}>
        {texto}
      </text>
    </svg>
  );
}

function textoDoValor(faces: number | 'F', valor: number): string {
  if (faces === 'F') return valor > 0 ? '+' : valor < 0 ? '−' : '';
  return String(valor);
}

function UmDado({ faces, valor, usado, encenar, atraso, estadoFinal }: { faces: number | 'F'; valor: number; usado: boolean; encenar: boolean; atraso: number; estadoFinal?: 'critico' | 'falha' | 'maximo' }) {
  const faixa = faces === 'F' ? 3 : faces;
  const { mostrado, rolando } = useNumeroRolando(faces === 'F' ? valor + 2 : valor, faixa, encenar, atraso);
  const texto = rolando ? textoDoValor(faces, faces === 'F' ? mostrado - 2 : mostrado) : textoDoValor(faces, valor);
  return <FormaDoDado faces={faces} texto={texto} estado={rolando ? 'rolando' : !usado ? 'descartado' : estadoFinal} />;
}

// ---------- Cada tipo de sorteio ----------

function CartaoDeDados({ dado, encenar }: { dado: Extract<DadoSorteado, { tipo: 'dados' }>; encenar: boolean }) {
  const t = useT();
  const [pronto, setPronto] = useState(!encenar);
  const quantos = dado.termos.reduce((n, termo) => n + (termo.tipo === 'dados' ? termo.rolados.length : 0), 0);
  const demais = quantos > 24;
  const total = useNumeroRolando(dado.total, Math.max(10, Math.abs(dado.total) * 2), encenar, 0, () => setPronto(true));
  const algumSucesso = dado.termos.some((x) => x.tipo === 'dados' && x.sucessos);
  const total_final = pronto ? dado.total : total.mostrado;
  const destaque = pronto ? dado.destaque : null;

  let indice = 0;
  return (
    <div className={`dado-corpo-do-cartao${destaque ? ' ' + destaque : ''}`}>
      <div className="dado-linha-de-dados" aria-hidden="true">
        {demais ? (
          <span className="dado-demais">{dado.termos.filter((x): x is TermoDeDados => x.tipo === 'dados').map((x) => `[${x.rolados.join(', ')}]`).join(' ')}</span>
        ) : (
          dado.termos.map((termo, i) =>
            termo.tipo === 'num' ? (
              <span key={i} className="dado-constante">
                {termo.sinal === -1 ? '−' : '+'}
                {termo.valor}
              </span>
            ) : (
              <span key={i} className="dado-grupo">
                {i > 0 && <span className="dado-constante">{termo.sinal === -1 ? '−' : '+'}</span>}
                {termo.rolados.map((valor, k) => {
                  const faces = termo.faces;
                  const unico = dado.termos.length === 1 && termo.rolados.filter((_, j) => termo.usados[j]).length === 1;
                  const maximo = faces !== 'F' && faces !== 100 && valor === faces && termo.usados[k];
                  const estadoFinal = unico && dado.destaque && termo.usados[k] ? dado.destaque : maximo ? 'maximo' : undefined;
                  return <UmDado key={k} faces={faces} valor={valor} usado={termo.usados[k]} encenar={encenar} atraso={indice++ * 90} estadoFinal={estadoFinal} />;
                })}
              </span>
            ),
          )
        )}
      </div>
      <div className="dado-total" aria-live="polite">
        <span className={`dado-total-numero${total.rolando ? ' rolando' : ''}`}>{total_final}</span>
        {algumSucesso && <span className="dado-total-legenda">{t('sucessos')}</span>}
        {destaque === 'critico' && <span className="dado-total-legenda critico">{t('Crítico!')}</span>}
        {destaque === 'falha' && <span className="dado-total-legenda falha">{t('Falha crítica')}</span>}
        {pronto && dado.modo && <span className="dado-total-legenda">{dado.modo === 'vantagem' ? t('com vantagem') : t('com desvantagem')}</span>}
      </div>
    </div>
  );
}

function CartaoDeMoeda({ resultado, encenar }: { resultado: 'cara' | 'coroa'; encenar: boolean }) {
  const t = useT();
  const [girando, setGirando] = useState(encenar);
  useEffect(() => {
    if (!encenar) return;
    const id = window.setTimeout(() => setGirando(false), 1100);
    return () => clearTimeout(id);
  }, [encenar]);
  return (
    <div className="dado-corpo-do-cartao moeda">
      <div className={`dado-moeda${girando ? ' girando' : ''}`} aria-hidden="true">
        <span>{girando ? '🪙' : resultado === 'cara' ? '🙂' : '👑'}</span>
      </div>
      <div className="dado-total" aria-live="polite">
        {!girando && <span className="dado-total-numero palavra">{resultado === 'cara' ? t('Cara') : t('Coroa')}</span>}
      </div>
    </div>
  );
}

function CartaoDeNumero({ dado, encenar }: { dado: Extract<DadoSorteado, { tipo: 'numero' }>; encenar: boolean }) {
  const t = useT();
  const { mostrado, rolando } = useNumeroRolando(dado.valor, Math.min(Math.max(dado.max - dado.min + 1, 2), 999), encenar, 0);
  const valor = rolando ? dado.min + (mostrado % (dado.max - dado.min + 1)) : dado.valor;
  return (
    <div className="dado-corpo-do-cartao">
      <div className="dado-total" aria-live="polite">
        <span className={`dado-total-numero${rolando ? ' rolando' : ''}`}>{valor}</span>
        <span className="dado-total-legenda">{t('de {min} a {max}', { min: dado.min, max: dado.max })}</span>
      </div>
    </div>
  );
}

function CartaoDeEscolha({ dado, encenar }: { dado: Extract<DadoSorteado, { tipo: 'escolha' }>; encenar: boolean }) {
  const [aceso, setAceso] = useState<number | null>(encenar ? 0 : dado.escolhida);
  const [terminou, setTerminou] = useState(!encenar);
  useEffect(() => {
    if (!encenar) {
      setAceso(dado.escolhida);
      setTerminou(true);
      return;
    }
    // a roleta: percorre as opções, desacelera e para na sorteada
    const n = dado.opcoes.length;
    const voltas = 2;
    const passos = voltas * n + ((dado.escolhida - 0 + n) % n);
    let i = 0;
    let parado = false;
    let id = 0;
    const andar = () => {
      if (parado) return;
      setAceso(i % n);
      if (i >= passos) {
        setTerminou(true);
        return;
      }
      i++;
      id = window.setTimeout(andar, 60 + (i / passos) ** 3 * 360);
    };
    andar();
    return () => {
      parado = true;
      clearTimeout(id);
    };
  }, [encenar, dado.escolhida, dado.opcoes.length]);
  return (
    <ul className="dado-roleta" aria-label={dado.opcoes[dado.escolhida]}>
      {dado.opcoes.map((opcao, i) => (
        <li key={i} className={`${aceso === i ? 'aceso' : ''}${terminou && i === dado.escolhida ? ' escolhida' : ''}`}>
          {opcao}
        </li>
      ))}
    </ul>
  );
}

function CartaoDeOrdem({ itens }: { itens: string[] }) {
  return (
    <ol className="dado-lista">
      {itens.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ol>
  );
}

function CartaoDeTimes({ times }: { times: string[][] }) {
  const t = useT();
  return (
    <div className="dado-times">
      {times.map((time, i) => (
        <div key={i} className="dado-time">
          <strong>{t('Time {n}', { n: i + 1 })}</strong>
          <ul>
            {time.map((nome, k) => (
              <li key={k}>{nome}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function CartaoDeIniciativa({ entradas }: { entradas: Extract<DadoSorteado, { tipo: 'iniciativa' }>['entradas'] }) {
  return (
    <ol className="dado-iniciativa">
      {entradas.map((e, i) => (
        <li key={i}>
          <span className="nome">{e.nome}</span>
          <span className="conta">
            d20 {e.dado}
            {e.mod !== 0 && ` ${e.mod > 0 ? '+' : '−'} ${Math.abs(e.mod)}`}
          </span>
          <strong>{e.total}</strong>
        </li>
      ))}
    </ol>
  );
}

function titulo(dado: DadoSorteado, t: ReturnType<typeof useT>): string {
  switch (dado.tipo) {
    case 'dados':
      return dado.expressao;
    case 'moeda':
      return t('Cara ou coroa');
    case 'numero':
      return t('Número sorteado');
    case 'escolha':
      return t('Sorteio');
    case 'ordem':
      return t('Ordem sorteada');
    case 'times':
      return t('Times sorteados');
    case 'iniciativa':
      return t('Iniciativa');
  }
}

/** O texto que um leitor de tela lê: o resultado, sem a encenação. */
function falado(dado: DadoSorteado): string {
  switch (dado.tipo) {
    case 'dados':
      return `${dado.expressao}: ${dado.total}`;
    case 'moeda':
      return dado.resultado === 'cara' ? 'Cara' : 'Coroa';
    case 'numero':
      return String(dado.valor);
    case 'escolha':
      return dado.opcoes[dado.escolhida];
    case 'ordem':
      return dado.itens.join(', ');
    case 'times':
      return dado.times.map((x, i) => `Time ${i + 1}: ${x.join(', ')}`).join('. ');
    case 'iniciativa':
      return dado.entradas.map((e) => `${e.nome} ${e.total}`).join(', ');
  }
}

export function DadoCard({ messageId, createdAt, info, ehMeu }: { messageId: number; createdAt: string; info: DadoNaMensagem; ehMeu: boolean }) {
  const t = useT();
  const encenarAoChegar = useEncenar(messageId, createdAt);
  // A revelação da rolagem secreta sempre encena: quem estava vendo o cartão escondido assiste ao resultado sair.
  const estavaOculta = useRef(info.oculta);
  const [revelou, setRevelou] = useState(false);
  useEffect(() => {
    if (estavaOculta.current && !info.oculta) {
      estavaOculta.current = false;
      if (!menosMovimento() && !document.hidden) setRevelou(true);
    }
  }, [info.oculta]);
  const encenar = encenarAoChegar || revelou;
  const [revelando, setRevelando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const dado = info.dado;

  // o som de quando a encenação começa (os de jogos; respeitam o botão de silenciar deles)
  useEffect(() => {
    if (!encenar || !dado) return;
    tocar(dado.tipo === 'moeda' ? 'moeda' : dado.tipo === 'escolha' ? 'vez' : 'dado');
  }, [encenar, dado]);

  async function revelar() {
    setRevelando(true);
    try {
      await api(`/api/messages/${messageId}/dado/revelar`, { method: 'POST', body: {} });
      setErro(null);
    } catch (e) {
      setErro((e as Error).message);
      setRevelando(false);
    }
  }

  if (info.oculta || !dado) {
    return (
      <div className="dado-cartao oculta">
        <div className="dado-cabeca">
          <EyeOff size={15} aria-hidden="true" />
          <span>{t('Rolagem secreta')}</span>
          {info.rotulo && <span className="dado-rotulo">{info.rotulo}</span>}
        </div>
        <p className="dado-aviso">{t('Só quem rolou vê o resultado, até revelar.')}</p>
      </div>
    );
  }

  return (
    <div className={`dado-cartao tipo-${dado.tipo}${info.secreta && !info.revelada ? ' secreta' : ''}`} role="group" aria-label={falado(dado)}>
      <div className="dado-cabeca">
        <span className="dado-titulo">{titulo(dado, t)}</span>
        {info.rotulo && <span className="dado-rotulo">{info.rotulo}</span>}
      </div>
      {dado.tipo === 'dados' && <CartaoDeDados dado={dado} encenar={encenar} />}
      {dado.tipo === 'moeda' && <CartaoDeMoeda resultado={dado.resultado} encenar={encenar} />}
      {dado.tipo === 'numero' && <CartaoDeNumero dado={dado} encenar={encenar} />}
      {dado.tipo === 'escolha' && <CartaoDeEscolha dado={dado} encenar={encenar} />}
      {dado.tipo === 'ordem' && <CartaoDeOrdem itens={dado.itens} />}
      {dado.tipo === 'times' && <CartaoDeTimes times={dado.times} />}
      {dado.tipo === 'iniciativa' && <CartaoDeIniciativa entradas={dado.entradas} />}
      {info.secreta && !info.revelada && ehMeu && (
        <div className="dado-secreta-aviso">
          <span>
            <Eye size={14} aria-hidden="true" /> {t('Só você vê.')}
          </span>
          <button type="button" className="link-button" disabled={revelando} onClick={() => void revelar()}>
            {revelando ? t('Revelando…') : t('Revelar para todos')}
          </button>
        </div>
      )}
      {erro && <p className="form-error small">{erro}</p>}
    </div>
  );
}
