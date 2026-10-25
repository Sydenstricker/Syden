import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from './api';
import { idiomaAtual, useT } from './i18n';
import { Placar, Relogio } from './Minijogo';
import type { Partida } from './minijogos';
import { CREDITOS, type EstadoQuiz, type IdDoQuiz, ROTULOS, sugestoes, textoDoValor, type Veredito } from './quiz';

const QUIZ_MS = 3 * 60_000;
const CLASSE = ['nao-bate', 'em-parte', 'bate'];

/**
 * A BÚSSOLA da coluna de distância (pedido dele, 24/10/2026: a seta sozinha não dizia que era direção). O mostrador fica
 * parado, com a marca do norte em cima; a seta gira para onde fica o secreto (0° = norte, 90° = leste). Sem letra
 * nenhuma: "N" seria um texto a traduzir, e a marca em cima já diz qual é o norte.
 */
function Bussola({ rumo }: { rumo: number }) {
  return (
    <svg className="quiz-bussola" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10.5" fill="rgba(0,0,0,0.28)" stroke="currentColor" strokeWidth="1.4" />
      <path d="M12 0.6 L14 3.6 L10 3.6 Z" fill="currentColor" />
      <path transform={`rotate(${rumo} 12 12)`} d="M12 4 L16.5 10 L13.3 10 L13.3 18 L10.7 18 L10.7 10 L7.5 10 Z" fill="currentColor" />
    </svg>
  );
}

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
    const categoria = estado.categoria ? `&categoria=${encodeURIComponent(estado.categoria)}` : '';
    void api<{ itens: { id: string; nome: string }[] }>(`/api/minijogos/quiz/${tema}?idioma=${encodeURIComponent(idioma)}${categoria}`)
      .then((r) => vivo && setItens(r.itens))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [tema, idioma, estado.categoria]);
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
  const tipoDe = new Map(colunas.map((c) => [c.id, c.tipo]));
  /** A coluna de distância (o Worldle) mostra os km e uma seta para onde fica o secreto, e não o valor cru. */
  const distancia = (v: Veredito) =>
    v.km === 0 ? (
      '✓'
    ) : (
      <>
        {new Intl.NumberFormat(idioma).format(v.km ?? 0)} km
        <Bussola rumo={v.rumo ?? 0} />
      </>
    );
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
                      {tipoDe.get(c.id) === 'distancia' ? '✓' : celula(c.id, estado.resposta!.valores[c.id])}
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
                        {tipoDe.get(c.id) === 'distancia' ? distancia(v) : celula(c.id, linha.valores[c.id])}
                        {/* A seta é o caractere, e não um texto: o leitor de tela a anuncia na língua de quem ouve, e a
                            chave Mais do app quer dizer mais opções (um menu) em várias línguas. */}
                        {v.seta === 1 && <span className="quiz-seta">↑</span>}
                        {v.seta === -1 && <span className="quiz-seta">↓</span>}
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
              {o.chutes && <small className="quiz-chutes">{t('Chutes: {n}', { n: o.chutes.length })}</small>}
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

/** A escolha de categoria de um quiz (a mitologia por continente), antes de começar: como a do "Qual é o tamanho?". */
export function EscolhaDoQuiz({
  categorias,
  aoEscolher,
  aoVoltar,
}: {
  categorias: { id: string; nome: string }[];
  aoEscolher: (categoria: string) => void;
  aoVoltar: () => void;
}) {
  const t = useT();
  return (
    <>
      <ul className="quiz-categorias">
        {categorias.map((categoria) => (
          <li key={categoria.id}>
            <button type="button" className="minijogo-jogo" onClick={() => aoEscolher(categoria.id)}>
              <span>{t(categoria.nome)}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="minijogo-acoes">
        <button type="button" className="btn-secondary" onClick={aoVoltar}>
          {t('Outros jogos')}
        </button>
      </div>
    </>
  );
}
