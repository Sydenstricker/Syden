import { Delete } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useT } from './i18n';
import { Placar, Relogio } from './Minijogo';
import type { EstadoPalavra, Partida } from './minijogos';

const PALAVRA_MS = 3 * 60_000;
const TECLADO = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
const CLASSE = ['nao-tem', 'outro-lugar', 'no-lugar'];

/** Sem acento e em minúscula: é assim que o servidor confere o chute. */
const limpar = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/ç/g, 'c');

/**
 * A PALAVRA SECRETA, EM CORRIDA (ver server/src/minijogo-palavra.ts): o Termo da turma. Cada um chuta no seu quadro,
 * pelo teclado do computador ou pelo da tela, e embaixo a sala vê os quadros dos outros só com as cores. Na revelação,
 * a palavra e as letras de todo mundo aparecem.
 */
export function JogoPalavra({
  estado,
  eu,
  restante,
  agir,
}: {
  estado: EstadoPalavra & Partida;
  eu: number;
  restante: number;
  agir: (corpo: Record<string, unknown>) => void;
}) {
  const t = useT();
  const [escrito, setEscrito] = useState('');
  const chutando = estado.fase === 'chutando' && !estado.acertei && estado.meu.length < estado.chutes;

  // Rodada nova: o que estava escrito some.
  useEffect(() => setEscrito(''), [estado.rodada]);
  // O chute foi aceito (o quadro cresceu): a linha de escrever fica vazia. Recusado, o texto fica para corrigir.
  useEffect(() => setEscrito(''), [estado.meu.length]);

  const tecla = (k: string) => {
    if (!chutando) return;
    if (k === 'Enter') {
      if (escrito.length === 5) agir({ tipo: 'chute', texto: escrito });
    } else if (k === 'Backspace') setEscrito((e) => e.slice(0, -1));
    else if (/^[a-z]$/.test(k)) setEscrito((e) => (e.length < 5 ? e + k : e));
  };

  useEffect(() => {
    const ouvir = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      // Quem está escrevendo no chat (ou em qualquer campo) não está chutando.
      const alvo = e.target as HTMLElement | null;
      if (alvo && (alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA' || alvo.isContentEditable)) return;
      const k = e.key === 'Enter' || e.key === 'Backspace' ? e.key : limpar(e.key);
      if (k === 'Enter' || k === 'Backspace' || /^[a-z]$/.test(k)) {
        e.preventDefault();
        tecla(k);
      }
    };
    window.addEventListener('keydown', ouvir);
    return () => window.removeEventListener('keydown', ouvir);
  });

  if (estado.terminada) {
    return <Placar eu={eu} linhas={estado.placar.map((l) => ({ ...l, valor: String(l.pontos) }))} />;
  }

  // A cor de cada tecla: a melhor que ela já teve nos meus chutes.
  const corDaTecla = new Map<string, number>();
  for (const c of estado.meu) {
    [...limpar(c.texto)].forEach((letra, i) => corDaTecla.set(letra, Math.max(corDaTecla.get(letra) ?? -1, c.cores[i])));
  }

  const linhas = Array.from({ length: estado.chutes }, (_, l) => {
    const feito = estado.meu[l];
    if (feito) return { letras: [...feito.texto], cores: feito.cores };
    if (l === estado.meu.length && chutando) return { letras: [...escrito.padEnd(5)], cores: null, atual: true };
    return { letras: [...'     '], cores: null };
  });

  let situacao: string;
  if (estado.fase === 'revelando') situacao = t('A palavra era: {palavra}', { palavra: (estado.palavra ?? '').toUpperCase() });
  else if (estado.acertei) situacao = t('Acertou! Agora é torcer pelos outros.');
  else if (estado.meu.length >= estado.chutes) situacao = t('Acabaram os seus chutes. Espere a palavra.');
  else situacao = t('Escreva uma palavra de 5 letras e aperte Enter.');

  const outros = estado.outros.filter((o) => o.userId !== eu);
  return (
    <div className="palavra">
      <div className="palavra-quadro" aria-label={t('Seu quadro')}>
        {linhas.map((linha, l) => (
          <div key={l} className={`palavra-linha${'atual' in linha ? ' atual' : ''}`}>
            {linha.letras.map((letra, i) => (
              <span key={i} className={`palavra-casa${linha.cores ? ` ${CLASSE[linha.cores[i]]}` : ''}`}>
                {letra.trim().toUpperCase()}
              </span>
            ))}
          </div>
        ))}
      </div>
      <p className="minijogo-situacao" role="status">
        {situacao}
      </p>
      {chutando && (
        <div className="palavra-teclado">
          {TECLADO.map((fileira, f) => (
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
              <div className="palavra-mini">
                {o.cores.map((linha, l) => (
                  <div key={l}>
                    {linha.map((c, i) => (
                      <span key={i} className={CLASSE[c]}>
                        {o.letras ? [...o.letras[l]][i].toUpperCase() : ''}
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
      {estado.fase === 'chutando' && <Relogio restante={restante} total={PALAVRA_MS} />}
    </div>
  );
}
