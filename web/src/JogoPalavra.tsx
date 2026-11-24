import { Delete } from 'lucide-react';
import { type CSSProperties, useEffect, useRef, useState } from 'react';
import { useT } from './i18n';
import { Placar, Relogio } from './Minijogo';
import type { EstadoPalavra, Partida } from './minijogos';
import { tocar } from './somDosJogos';
import './jogosDePalavras.css';

const PALAVRA_MS = 3 * 60_000;
const PALAVRA_SOLO_MS = 10 * 60_000;
const TECLADO = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
/** O teclado da tela no espanhol (24/11/2026): o Ñ é uma letra à parte, no fim da fileira do meio, como no teclado de lá. */
const TECLADO_ES = ['qwertyuiop', 'asdfghjklñ', 'zxcvbnm'];
/** E no francês, o AZERTY, o teclado de lá (as letras são as mesmas a-z). */
const TECLADO_FR = ['azertyuiop', 'qsdfghjklm', 'wxcvbn'];
/** E no alemão, o QWERTZ (só a-z: o Ä do teclado do computador vira AE, como no servidor). */
const TECLADO_DE = ['qwertzuiop', 'asdfghjkl', 'yxcvbnm'];
const CLASSE = ['nao-tem', 'outro-lugar', 'no-lugar'];

/** O que o servidor de 19/11/2026 manda a mais: o dueto e o quarteto, o modo difícil e a sequência do Solo. */
type EstadoPalavraNovo = Omit<EstadoPalavra, 'meu' | 'outros'> & {
  palavras?: number;
  /** Quantas letras tem a palavra (4, 5 ou 6; 21/11/2026). Servidor antigo: 5. */
  letras?: number;
  dificil?: boolean;
  meu: { texto: string; cores: number[]; coresTodas?: number[][] }[];
  resolvidas?: (number | null)[];
  palavrasReveladas?: string[] | null;
  outros: (EstadoPalavra['outros'][number] & { coresTodas?: number[][][] })[];
  sequencia?: { atual: number; recorde: number | null; novo: boolean } | null;
  /** O idioma das palavras (pt, en, es, fr ou de; 24/11/2026). Servidor antigo: português. */
  idioma?: string;
};

/**
 * Sem acento e em minúscula: é assim que o servidor confere o chute (chaveDe em server/src/minijogo-palavra.ts). No espanhol o
 * ñ fica, porque lá ele é outra letra; no alemão, ä ö ü ß viram ae oe ue ss.
 */
const limpar = (texto: string, idioma = 'pt') => {
  let t = texto.normalize('NFC').toLowerCase();
  if (idioma === 'de') t = t.replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');
  if (idioma === 'es') t = t.replace(/ñ/g, '\uE000');
  t = t.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return t.replace(/\uE000/g, 'ñ').replace(/ç/g, 'c');
};

/** As cores de um chute para cada palavra (servidor antigo: só a primeira). */
const coresDe = (c: { cores: number[]; coresTodas?: number[][] }) => c.coresTodas ?? [c.cores];

/**
 * A PALAVRA SECRETA, EM CORRIDA (ver server/src/minijogo-palavra.ts): o Termo da turma. Cada um chuta no seu quadro,
 * pelo teclado do computador ou pelo da tela, e embaixo a sala vê os quadros dos outros só com as cores. Na revelação,
 * a palavra e as letras de todo mundo aparecem.
 *
 * DESDE 19/11/2026: no Solo (uma palavra de cada vez, com a sequência de vitórias da sessão), o dueto e o quarteto (um quadro
 * por palavra, o mesmo chute em todos) e o modo difícil (quem confere é o servidor).
 */
export function JogoPalavra({
  estado: estadoBase,
  eu,
  jogador,
  restante,
  agir,
}: {
  estado: EstadoPalavra & Partida;
  eu: number;
  /** Quem só assiste não chuta: nem quadro para escrever, nem teclado. */
  jogador: boolean;
  restante: number;
  /** (devolve a promessa do pedido: o próximo chute espera ela terminar) */
  agir: (corpo: Record<string, unknown>) => unknown;
}) {
  const t = useT();
  const estado = estadoBase as unknown as EstadoPalavraNovo & Partida;
  const nPalavras = estado.palavras ?? 1;
  const n = estado.letras ?? 5;
  const idioma = estado.idioma ?? 'pt';
  // (no alemão uma tecla pode dar duas letras: Ä é AE)
  const letra = idioma === 'es' ? /^[a-zñ]$/ : idioma === 'de' ? /^[a-z]{1,2}$/ : /^[a-z]$/;
  const teclado = idioma === 'es' ? TECLADO_ES : idioma === 'fr' ? TECLADO_FR : idioma === 'de' ? TECLADO_DE : TECLADO;
  const resolvidas = estado.resolvidas ?? [estado.acertei ? estado.meu.length : null];
  const [escrito, setEscrito] = useState('');
  // Um chute por vez (revisão de 16/10/2026): Enter segurado, ou duas vezes com a internet lenta, mandava o mesmo
  // chute de novo e gastava duas das 6 tentativas.
  const [enviando, setEnviando] = useState(false);
  const chutando = jogador && estado.fase === 'chutando' && !estado.acertei && estado.meu.length < estado.chutes;

  // Rodada nova: o que estava escrito some.
  useEffect(() => setEscrito(''), [estado.rodada]);
  // O chute foi aceito (o quadro cresceu): a linha de escrever fica vazia. Recusado, o texto fica para corrigir.
  useEffect(() => setEscrito(''), [estado.meu.length]);

  // OS SONS (19/11/2026): cada palavra acertada, o último chute que não acertou, e a medalha da sequência nova.
  const acertadas = resolvidas.filter((n) => n !== null).length;
  const antesDoSom = useRef({ chutes: estado.meu.length, acertadas, rodada: estado.rodada, novo: !!estado.sequencia?.novo });
  useEffect(() => {
    const a = antesDoSom.current;
    const novo = !!estado.sequencia?.novo;
    if (estado.rodada === a.rodada) {
      if (novo && !a.novo) tocar('medalha');
      else if (acertadas > a.acertadas) tocar('acerto');
      else if (estado.meu.length > a.chutes && estado.meu.length >= estado.chutes) tocar('derrota');
      else if (estado.meu.length > a.chutes) tocar('carta');
    }
    antesDoSom.current = { chutes: estado.meu.length, acertadas, rodada: estado.rodada, novo };
  }, [estado.meu.length, acertadas, estado.rodada, estado.sequencia?.novo, estado.chutes]);

  const tecla = (k: string) => {
    if (!chutando) return;
    if (k === 'Enter') {
      if (escrito.length === n && !enviando) {
        setEnviando(true);
        void Promise.resolve(agir({ tipo: 'chute', texto: escrito })).finally(() => setEnviando(false));
      }
    } else if (k === 'Backspace') setEscrito((e) => e.slice(0, -1));
    else if (letra.test(k)) setEscrito((e) => (e.length + k.length <= n ? e + k : e));
  };

  useEffect(() => {
    // Só enquanto há o que chutar: fora disso (quem assiste, quem já acertou, a revelação, o placar), o Enter dos botões
    // do app inteiro voltava a não funcionar com o painel aberto.
    if (!chutando) return;
    const ouvir = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || (e.repeat && e.key === 'Enter')) return;
      // Quem está escrevendo no chat (ou em qualquer campo) não está chutando; o Enter de um botão é do botão.
      const alvo = e.target as HTMLElement | null;
      if (alvo && (alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA' || alvo.tagName === 'SELECT' || alvo.isContentEditable)) return;
      if (alvo && e.key === 'Enter' && (alvo.tagName === 'BUTTON' || alvo.tagName === 'A')) return;
      // (as teclas com nome, como Shift ou F1, têm mais de um caractere: só as de letra viram chute)
      const k = e.key === 'Enter' || e.key === 'Backspace' ? e.key : e.key.length === 1 ? limpar(e.key, idioma) : '';
      if (k === 'Enter' || k === 'Backspace' || letra.test(k)) {
        e.preventDefault();
        tecla(k);
      }
    };
    window.addEventListener('keydown', ouvir);
    return () => window.removeEventListener('keydown', ouvir);
  });

  const reveladas = (estado.palavrasReveladas ?? (estado.palavra ? [estado.palavra] : [])).map((p) => p.toUpperCase()).join(' · ');

  if (estado.terminada) {
    return (
      <>
        {estado.solo ? (
          reveladas && (
            <p className="minijogo-situacao" role="status">
              {t('A palavra era: {palavra}', { palavra: reveladas })}
            </p>
          )
        ) : (
          <Placar eu={eu} linhas={estado.placar.map((l) => ({ ...l, valor: String(l.pontos) }))} />
        )}
        <Sequencia sequencia={estado.sequencia} />
      </>
    );
  }

  // A cor de cada tecla: a melhor que ela já teve nos meus chutes. No dueto e no quarteto, só as palavras que ainda faltam
  // contam (a tecla de uma palavra acertada não diz mais nada).
  const corDaTecla = new Map<string, number>();
  for (const c of estado.meu) {
    coresDe(c).forEach((cs, b) => {
      if (cs.length !== n || (nPalavras > 1 && resolvidas[b] !== null)) return;
      [...limpar(c.texto, idioma)].forEach((letra, i) => corDaTecla.set(letra, Math.max(corDaTecla.get(letra) ?? -1, cs[i])));
    });
  }

  /** As linhas do quadro de uma palavra: depois de acertada, as linhas seguintes ficam vazias. */
  const linhasDe = (b: number) =>
    Array.from({ length: estado.chutes }, (_, l) => {
      const feito = estado.meu[l];
      const cs = feito ? coresDe(feito)[b] : undefined;
      if (feito && cs && cs.length === n) return { letras: [...feito.texto], cores: cs, atual: false };
      if (!feito && l === estado.meu.length && chutando && resolvidas[b] === null) return { letras: [...escrito.padEnd(n)], cores: null, atual: true };
      return { letras: [...' '.repeat(n)], cores: null, atual: false };
    });

  let situacao: string;
  if (estado.fase === 'revelando') situacao = t('A palavra era: {palavra}', { palavra: reveladas });
  else if (estado.acertei) situacao = t('Acertou! Agora é torcer pelos outros.');
  else if (estado.meu.length >= estado.chutes) situacao = t('Acabaram os seus chutes. Espere a palavra.');
  // (a de 5 é o texto de sempre; a de 4 e a de 6, o mesmo com o número)
  else situacao = n === 5 ? t('Escreva uma palavra de 5 letras e aperte Enter.') : t('Escreva uma palavra de {n} letras e aperte Enter.', { n });

  const outros = estado.outros.filter((o) => o.userId !== eu);
  return (
    <div className="palavra" style={{ '--letras': n } as CSSProperties}>
      <div className={`palavra-quadros${nPalavras > 1 ? ' varias' : ''}`}>
        {Array.from({ length: nPalavras }, (_, b) => (
          <div key={b} className={`palavra-quadro${nPalavras > 1 && resolvidas[b] !== null ? ' resolvido' : ''}`} aria-label={t('Seu quadro')}>
            {linhasDe(b).map((linha, l) => (
              <div key={l} className={`palavra-linha${linha.atual ? ' atual' : ''}`}>
                {linha.letras.map((letra, i) => (
                  <span key={i} className={`palavra-casa${linha.cores ? ` ${CLASSE[linha.cores[i]]}` : ''}`}>
                    {letra.trim().toUpperCase()}
                  </span>
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>
      <p className="minijogo-situacao" role="status">
        {situacao}
      </p>
      {chutando && (
        <div className="palavra-teclado">
          {teclado.map((fileira, f) => (
            <div key={fileira}>
              {f === 2 && (
                <button type="button" className="larga" onClick={() => tecla('Enter')}>
                  {t('Enviar')}
                </button>
              )}
              {[...fileira].map((k) => (
                <button key={k} type="button" className={corDaTecla.has(k) ? CLASSE[corDaTecla.get(k)!] : ''} onClick={() => tecla(k)}>
                  {k.toUpperCase()}
                </button>
              ))}
              {f === 2 && (
                <button type="button" className="larga" aria-label={t('Apagar')} onClick={() => tecla('Backspace')}>
                  <Delete size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {outros.length > 0 && (
        <ul className="palavra-outros">
          {outros.map((o) => (
            <li key={o.userId}>
              <span className="minijogo-nome">
                {o.username}
                {o.acertou && ' ✓'}
              </span>
              <div className="palavra-minis">
                {Array.from({ length: nPalavras }, (_, b) => (
                  <div key={b} className="palavra-mini">
                    {(o.coresTodas ?? o.cores.map((c) => [c])).map((todas, l) =>
                      (todas[b] ?? []).length === n ? (
                        <div key={l}>
                          {todas[b].map((c, i) => (
                            <span key={i} className={CLASSE[c]}>
                              {o.letras ? ([...o.letras[l]][i] ?? '').toUpperCase() : ''}
                            </span>
                          ))}
                        </div>
                      ) : null,
                    )}
                  </div>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
      {estado.solo && <Sequencia sequencia={estado.sequencia} />}
      {estado.fase === 'chutando' && <Relogio restante={restante} total={estado.solo ? PALAVRA_SOLO_MS : PALAVRA_MS} />}
    </div>
  );
}

/**
 * A SEQUÊNCIA DO SOLO (ver SESSAO_MS em server/src/minijogo-palavra.ts): as vitórias seguidas desta sessão e o recorde. Sem
 * contagem de dias: errar zera, e meia hora parada também.
 */
function Sequencia({ sequencia }: { sequencia: EstadoPalavraNovo['sequencia'] }) {
  const t = useT();
  if (!sequencia) return null;
  return (
    <p className="palavra-sequencia" role="status">
      {t('Vitórias seguidas: {n}', { n: sequencia.atual })}
      {sequencia.novo ? ` · 🏅 ${t('Novo recorde!')}` : sequencia.recorde !== null ? ` · ${t('Seu recorde: {n}', { n: sequencia.recorde })}` : ''}
    </p>
  );
}
