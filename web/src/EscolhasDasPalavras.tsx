import { useState, type ReactNode } from 'react';
import { idiomaAtual, useT } from './i18n';
import { CATEGORIAS_DO_STOP, letrasDoStop, type IdDoJogo } from './minijogos';
import './jogosDePalavras.css';

/**
 * A LARGADA DOS JOGOS DE PALAVRA (19/11/2026, a auditoria dos mini-games): o que quem começa escolhe antes do convite (ou do
 * Solo). Cada escolha vai no corpo do começo, e o servidor confere tudo (os números fora da lista viram o de fábrica).
 *
 * - Sudoku: a dificuldade (35, 45, 52 ou 58 casas vazias) e se o número errado aparece na hora ou só no fim.
 * - Stop: rodadas, tempo, as categorias (da lista nossa, traduzida, e as LIVRES, escritas pela turma e nunca traduzidas) e
 *   as letras que ficam fora do sorteio.
 * - Palavra secreta: normal, dueto ou quarteto, e o modo difícil.
 * - Desenha e adivinha: a lista própria da sala (escrita por quem começa, nunca traduzida), sozinha ou junto com a nossa.
 */
export const JOGOS_COM_ESCOLHA_DE_PALAVRAS: ReadonlySet<IdDoJogo> = new Set<IdDoJogo>(['sudoku', 'stop', 'palavra', 'desenho']);

/** As linhas de uma caixa de texto: sem as vazias e sem as repetidas. */
const linhas = (texto: string, maximo: number, tamanho: number) =>
  [...new Set(texto.split('\n').map((l) => l.replace(/\s+/g, ' ').trim().slice(0, tamanho)).filter(Boolean))].slice(0, maximo);

function Opcoes<T extends string | number>({
  valor,
  opcoes,
  aoMudar,
}: {
  valor: T;
  opcoes: { valor: T; nome: string }[];
  aoMudar: (v: T) => void;
}) {
  return (
    <div className="opcoes">
      {opcoes.map((o) => (
        <button key={String(o.valor)} type="button" aria-pressed={o.valor === valor} onClick={() => aoMudar(o.valor)}>
          {o.nome}
        </button>
      ))}
    </div>
  );
}

export function EscolhaDosJogosDePalavras({
  jogo,
  aoEscolher,
  aoVoltar,
}: {
  jogo: IdDoJogo;
  aoEscolher: (corpo: Record<string, unknown>) => void;
  aoVoltar: () => void;
}) {
  const t = useT();
  // Sudoku
  const [dificuldade, setDificuldade] = useState<'facil' | 'medio' | 'dificil' | 'extremo'>('medio');
  const [conferencia, setConferencia] = useState<'hora' | 'fim'>('hora');
  // Stop
  const [rodadas, setRodadas] = useState(3);
  const [tempo, setTempo] = useState(90_000);
  const [categorias, setCategorias] = useState<Set<string>>(new Set());
  const [livres, setLivres] = useState('');
  const [excluidas, setExcluidas] = useState<Set<string>>(new Set());
  // Palavra secreta
  const [modo, setModo] = useState<'normal' | 'dueto' | 'quarteto'>('normal');
  const [dificil, setDificil] = useState(false);
  // Desenho
  const [lista, setLista] = useState('');
  const [soLista, setSoLista] = useState(false);

  const alternar = (conjunto: Set<string>, item: string, mudar: (s: Set<string>) => void) => {
    const novo = new Set(conjunto);
    if (novo.has(item)) novo.delete(item);
    else novo.add(item);
    mudar(novo);
  };

  let corpo: Record<string, unknown> = {};
  let conteudo: ReactNode = null;
  let pode = true;
  if (jogo === 'sudoku') {
    corpo = { dificuldade, conferencia };
    conteudo = (
      <>
        <fieldset>
          <legend>{t('Dificuldade')}</legend>
          <Opcoes
            valor={dificuldade}
            aoMudar={setDificuldade}
            opcoes={[
              { valor: 'facil', nome: t('Fácil') },
              { valor: 'medio', nome: t('Médio') },
              { valor: 'dificil', nome: t('Difícil') },
              { valor: 'extremo', nome: t('Muito difícil') },
            ]}
          />
        </fieldset>
        <fieldset>
          <legend>{t('Conferir')}</legend>
          <Opcoes
            valor={conferencia}
            aoMudar={setConferencia}
            opcoes={[
              { valor: 'hora', nome: t('Na hora') },
              { valor: 'fim', nome: t('Só no fim') },
            ]}
          />
        </fieldset>
      </>
    );
  } else if (jogo === 'stop') {
    const asLivres = linhas(livres, 6, 30);
    const total = (categorias.size || (asLivres.length ? Math.max(0, 6 - asLivres.length) : 6)) + asLivres.length;
    pode = total >= 3 && total <= 12;
    corpo = {
      rodadas,
      tempoMs: tempo,
      excluir: [...excluidas].join(''),
      livres: asLivres,
      ...(categorias.size ? { categorias: [...categorias] } : {}),
    };
    conteudo = (
      <>
        <fieldset>
          <legend>{t('Rodadas')}</legend>
          <Opcoes valor={rodadas} aoMudar={setRodadas} opcoes={[1, 2, 3, 4, 5, 6].map((n) => ({ valor: n, nome: String(n) }))} />
        </fieldset>
        <fieldset>
          <legend>{t('Tempo')}</legend>
          <Opcoes valor={tempo} aoMudar={setTempo} opcoes={[60_000, 90_000, 120_000, 180_000].map((ms) => ({ valor: ms, nome: `${ms / 1000} s` }))} />
        </fieldset>
        <fieldset>
          <legend>
            {t('Categorias')} <span className="contagem">({total})</span>
          </legend>
          <div className="opcoes">
            {Object.entries(CATEGORIAS_DO_STOP).map(([id, nome]) => (
              <button key={id} type="button" aria-pressed={categorias.has(id)} onClick={() => alternar(categorias, id, setCategorias)}>
                {t(nome)}
              </button>
            ))}
          </div>
          {categorias.size === 0 && <span className="contagem">{t('Sem escolher, a partida sorteia.')}</span>}
          <textarea rows={2} maxLength={6 * 31} value={livres} placeholder={t('Categorias da turma, uma por linha')} onChange={(e) => setLivres(e.target.value)} />
        </fieldset>
        <fieldset>
          <legend>{t('Letras fora do sorteio')}</legend>
          <div className="opcoes letras">
            {Array.from(letrasDoStop(idiomaAtual()).letras).map((l) => (
              <button key={l} type="button" aria-pressed={excluidas.has(l)} onClick={() => alternar(excluidas, l, setExcluidas)}>
                {l}
              </button>
            ))}
          </div>
        </fieldset>
      </>
    );
  } else if (jogo === 'palavra') {
    corpo = { modo, dificil };
    conteudo = (
      <>
        <fieldset>
          <legend>{t('Palavras ao mesmo tempo')}</legend>
          <Opcoes
            valor={modo}
            aoMudar={setModo}
            opcoes={[
              { valor: 'normal', nome: '1' },
              { valor: 'dueto', nome: '2' },
              { valor: 'quarteto', nome: '4' },
            ]}
          />
        </fieldset>
        <label className="marcar">
          <input type="checkbox" checked={dificil} onChange={(e) => setDificil(e.target.checked)} />
          {t('Modo difícil: as letras reveladas têm de ser usadas')}
        </label>
      </>
    );
  } else if (jogo === 'desenho') {
    const palavras = linhas(lista, 200, 30);
    pode = !soLista || palavras.length >= 3;
    corpo = palavras.length ? { lista: palavras, soLista } : {};
    conteudo = (
      <fieldset>
        <legend>
          {t('Palavras da turma')} <span className="contagem">({palavras.length})</span>
        </legend>
        <textarea rows={4} maxLength={200 * 31} value={lista} placeholder={t('Uma por linha')} onChange={(e) => setLista(e.target.value)} />
        <label className="marcar">
          <input type="checkbox" checked={soLista} onChange={(e) => setSoLista(e.target.checked)} />
          {t('Só as palavras da turma')}
        </label>
      </fieldset>
    );
  }

  return (
    <>
      <div className="escolha-palavras">{conteudo}</div>
      <div className="minijogo-acoes">
        <button type="button" className="btn-primary" disabled={!pode} onClick={() => aoEscolher(corpo)}>
          {t('Começar')}
        </button>
        <button type="button" className="btn-secondary" onClick={aoVoltar}>
          {t('Outros jogos')}
        </button>
      </div>
    </>
  );
}
