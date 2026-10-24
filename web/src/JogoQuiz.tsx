import { ArrowDown, ArrowUp } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from './api';
import { idiomaAtual, useT } from './i18n';
import { Placar, Relogio } from './Minijogo';
import type { Partida } from './minijogos';
import { CREDITOS, type EstadoQuiz, type IdDoQuiz, ROTULOS, sugestoes, textoDoValor } from './quiz';

const QUIZ_MS = 3 * 60_000;
const CLASSE = ['nao-bate', 'em-parte', 'bate'];

/**
 * O QUIZ DE ADIVINHAR, EM CORRIDA (ver server/src/minijogo-quiz.ts e quiz.ts): escreve-se o começo do nome, escolhe-se
 * da lista, e o chute vira uma linha com as colunas coloridas. Embaixo a sala vê as linhas dos outros só com as cores.
 */
export function JogoQuiz({
  tema,
  estado,
  eu,
  jogador,
  restante,
  agir,
}: {
  tema: IdDoQuiz;
  estado: EstadoQuiz & Partida;
  eu: number;
  jogador: boolean;
  restante: number;
  agir: (corpo: Record<string, unknown>) => unknown;
}) {
  const t = useT();
  const [itens, setItens] = useState<{ id: string; nome: string }[]>([]);
  const [escrito, setEscrito] = useState('');
  const [marcada, setMarcada] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const campo = useRef<HTMLInputElement>(null);
  const idioma = idiomaAtual();

  // A lista para chutar, no idioma de quem lê (só id e nome: qual é o secreto, o servidor não conta).
  useEffect(() => {
    let vivo = true;
    void api<{ itens: { id: string; nome: string }[] }>(`/api/minijogos/quiz/${tema}?idioma=${encodeURIComponent(idioma)}`)
      .then((r) => vivo && setItens(r.itens))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [tema, idioma]);
  const nome = useMemo(() => new Map(itens.map((i) => [i.id, i.nome])), [itens]);

  const chutando = jogador && estado.fase === 'chutando' && !estado.acertei;
  const jaChutados = useMemo(() => new Set(estado.meu.map((l) => l.id)), [estado.meu]);
  const lista = sugestoes(itens, escrito, jaChutados);

  useEffect(() => setEscrito(''), [estado.rodada, estado.meu.length]);
  useEffect(() => setMarcada(0), [escrito]);

  const chutar = (id: string) => {
    if (!chutando || enviando) return;
    setEnviando(true);
    void Promise.resolve(agir({ tipo: 'chute', id })).finally(() => {
      setEnviando(false);
      campo.current?.focus();
    });
  };

  if (estado.terminada) {
    return <Placar eu={eu} linhas={estado.placar.map((l) => ({ ...l, valor: String(l.pontos) }))} />;
  }

  const rotulos = ROTULOS[tema];
  const colunas = estado.colunas;
  const celula = (coluna: string, valor: unknown) => textoDoValor(tema, coluna, valor, t);
  // A linha mais nova em cima: é ela que se lê depois de chutar.
  const minhas = [...estado.meu].reverse();

  let situacao: string;
  if (estado.fase === 'revelando' && estado.resposta) situacao = t('Era: {nome}', { nome: nome.get(estado.resposta.id) ?? estado.resposta.id });
  else if (estado.acertei) situacao = t('Acertou! Agora é torcer pelos outros.');
  else situacao = t('Escreva o começo do nome e escolha da lista.');

  const outros = estado.outros.filter((o) => o.userId !== eu);
  const credito = CREDITOS[tema];
  return (
    <div className="quiz">
      {chutando && (
        <div className="quiz-busca">
          <input
            ref={campo}
            type="text"
            value={escrito}
            autoFocus
            role="combobox"
            aria-expanded={lista.length > 0}
            aria-controls="quiz-sugestoes"
            aria-label={t('Escreva o começo do nome e escolha da lista.')}
            placeholder={t('Seu chute')}
            onChange={(e) => setEscrito(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') setMarcada((m) => Math.min(m + 1, lista.length - 1));
              else if (e.key === 'ArrowUp') setMarcada((m) => Math.max(m - 1, 0));
              else if (e.key === 'Enter' && lista[marcada]) chutar(lista[marcada].id);
              else return;
              e.preventDefault();
            }}
          />
          {lista.length > 0 && (
            <ul id="quiz-sugestoes" role="listbox">
              {lista.map((item, i) => (
                <li key={item.id} role="option" aria-selected={i === marcada}>
                  <button type="button" className={i === marcada ? 'marcada' : ''} onClick={() => chutar(item.id)}>
                    {item.nome}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <p className="minijogo-situacao" role="status">
        {situacao}
      </p>

      {(minhas.length > 0 || estado.resposta) && (
        <div className="quiz-tabela-rolagem">
          <table className="quiz-tabela">
            <thead>
              <tr>
                <th />
                {colunas.map((c) => (
                  <th key={c.id}>{t(rotulos.colunas[c.id] ?? c.id)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {estado.fase !== 'chutando' && estado.resposta && !estado.acertei && (
                <tr className="quiz-resposta">
                  <th scope="row">{nome.get(estado.resposta.id) ?? estado.resposta.id}</th>
                  {colunas.map((c) => (
                    <td key={c.id} className="bate">
                      {celula(c.id, estado.resposta!.valores[c.id])}
                    </td>
                  ))}
                </tr>
              )}
              {minhas.map((linha) => (
                <tr key={linha.id}>
                  <th scope="row">{nome.get(linha.id) ?? linha.id}</th>
                  {colunas.map((c, i) => {
                    const v = linha.vereditos[i];
                    return (
                      <td key={c.id} className={CLASSE[v.cor]}>
                        {celula(c.id, linha.valores[c.id])}
                        {v.seta === 1 && <ArrowUp size={14} aria-label={t('Mais')} />}
                        {v.seta === -1 && <ArrowDown size={14} aria-label={t('Menos')} />}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
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
              <div className="quiz-mini" style={{ gridTemplateColumns: `repeat(${colunas.length}, 12px)` }}>
                {o.cores.slice(-6).flatMap((linha, l) =>
                  linha.map((cor, i) => <span key={`${l}-${i}`} className={CLASSE[cor]} />),
                )}
              </div>
              {o.chutes && <small className="quiz-chutes">{t('{n} chutes', { n: o.chutes.length })}</small>}
            </li>
          ))}
        </ul>
      )}
      {estado.fase === 'chutando' && <Relogio restante={restante} total={QUIZ_MS} />}
      {credito && (
        <p className="quiz-credito" lang="en">
          {credito}
        </p>
      )}
    </div>
  );
}
