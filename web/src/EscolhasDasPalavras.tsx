import { useState, type ReactNode } from 'react';
import { idiomaAtual, useT } from './i18n';
import { CATEGORIAS_DO_STOP, letrasDoStop, nomeDoIdioma, type IdDoJogo } from './minijogos';
import './jogosDePalavras.css';

/**
 * A LARGADA DOS JOGOS DE PALAVRA (19/11/2026, a auditoria dos mini-games): o que quem começa escolhe antes do convite (ou do
 * Solo). Cada escolha vai no corpo do começo, e o servidor confere tudo (os números fora da lista viram o de fábrica).
 *
 * - Sudoku: a dificuldade (desde 20/11/2026, pela técnica que o tabuleiro pede), se o número errado aparece na hora ou só no fim,
 *   e o Sudoku X (as duas diagonais também valem).
 * - Stop: rodadas, tempo, as categorias (da lista nossa, traduzida, e as LIVRES, escritas pela turma e nunca traduzidas) e
 *   as letras que ficam fora do sorteio.
 * - Palavra secreta: normal, dueto ou quarteto, o modo difícil e, desde 21/11/2026, palavras de 4, 5 ou 6 letras (a de 5 é a de
 *   fábrica; o recorde do Solo de cada tamanho é à parte); desde 24/11/2026, o IDIOMA das palavras (português, inglês, espanhol,
 *   francês ou alemão: os que têm dicionário no servidor), que de fábrica é o de quem começa, ou o português.
 * - Desenha e adivinha: as rodadas (1 a 3) e o tempo de cada desenho (20/11/2026), e a lista própria da sala (escrita por quem
 *   começa, nunca traduzida), sozinha ou junto com a nossa.
 */
/** Os idiomas da Palavra secreta: os que têm dicionário no servidor (IDIOMAS em server/src/minijogo-palavra.ts). */
export const IDIOMAS_DA_PALAVRA = ['pt', 'en', 'es', 'fr', 'de'] as const;
type IdiomaDaPalavra = (typeof IDIOMAS_DA_PALAVRA)[number];
/** O de fábrica: o de quem começa, se o jogo tem; senão, o português. */
export const idiomaDaPalavraDe = (idioma: string): IdiomaDaPalavra => {
  const base = idioma.toLowerCase().split(/[-_]/)[0];
  return (IDIOMAS_DA_PALAVRA as readonly string[]).includes(base) ? (base as IdiomaDaPalavra) : 'pt';
};

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
  solo = false,
  aoEscolher,
  aoVoltar,
}: {
  jogo: IdDoJogo;
  /** No Solo não há o Sudoku cooperativo (21/11/2026): sozinho, é a corrida de sempre. */
  solo?: boolean;
  aoEscolher: (corpo: Record<string, unknown>) => void;
  aoVoltar: () => void;
}) {
  const t = useT();
  // Sudoku
  const [dificuldade, setDificuldade] = useState<'facil' | 'medio' | 'dificil' | 'extremo'>('medio');
  const [juntos, setJuntos] = useState(false);
  const [conferencia, setConferencia] = useState<'hora' | 'fim'>('hora');
  const [x, setX] = useState(false);
  // Stop
  const [rodadas, setRodadas] = useState(3);
  const [tempo, setTempo] = useState(90_000);
  const [categorias, setCategorias] = useState<Set<string>>(new Set());
  const [livres, setLivres] = useState('');
  const [excluidas, setExcluidas] = useState<Set<string>>(new Set());
  // Palavra secreta
  const [modo, setModo] = useState<'normal' | 'dueto' | 'quarteto'>('normal');
  const [dificil, setDificil] = useState(false);
  const [letras, setLetras] = useState<4 | 5 | 6>(5);
  const [idiomaDaPalavra, setIdiomaDaPalavra] = useState<IdiomaDaPalavra>(() => idiomaDaPalavraDe(idiomaAtual()));
  // Desenho
  const [lista, setLista] = useState('');
  const [soLista, setSoLista] = useState(false);
  const [rodadasDoDesenho, setRodadasDoDesenho] = useState(3);
  const [tempoDoDesenho, setTempoDoDesenho] = useState(80_000);
  const [telefone, setTelefone] = useState(false);

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
    corpo = { dificuldade, conferencia, ...(x ? { x: true } : {}), ...(juntos && !solo ? { modo: 'juntos' } : {}) };
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
          <legend>{t('Regra')}</legend>
          <Opcoes
            valor={x ? 'x' : 'classico'}
            aoMudar={(v) => setX(v === 'x')}
            opcoes={[
              { valor: 'classico', nome: t('Clássico') },
              { valor: 'x', nome: `✕ ${t('Sudoku X')}` },
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
        {/* O COOPERATIVO (21/11/2026): a turma no mesmo tabuleiro, ao lado da corrida de sempre */}
        {!solo && (
          <fieldset>
            <legend>{t('Modo')}</legend>
            <Opcoes
              valor={juntos ? 'juntos' : 'corrida'}
              aoMudar={(v) => setJuntos(v === 'juntos')}
              opcoes={[
                { valor: 'corrida', nome: `🏁 ${t('Corrida')}` },
                { valor: 'juntos', nome: `🤝 ${t('Juntos')}` },
              ]}
            />
          </fieldset>
        )}
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
    corpo = { modo, dificil, letras, idioma: idiomaDaPalavra };
    conteudo = (
      <>
        <fieldset>
          <legend>{t('Idioma')}</legend>
          <Opcoes
            valor={idiomaDaPalavra}
            aoMudar={setIdiomaDaPalavra}
            opcoes={IDIOMAS_DA_PALAVRA.map((codigo) => ({ valor: codigo, nome: nomeDoIdioma(codigo, idiomaAtual()) }))}
          />
        </fieldset>
        <fieldset>
          <legend>{t('Letras')}</legend>
          <Opcoes valor={letras} aoMudar={setLetras} opcoes={([4, 5, 6] as const).map((n) => ({ valor: n, nome: String(n) }))} />
        </fieldset>
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
    pode = telefone || !soLista || palavras.length >= 3;
    // O TELEFONE SEM FIO (24/11/2026): só o tempo de cada desenho; as frases são da turma, escritas na hora
    corpo = telefone
      ? { modo: 'telefone', tempoMs: tempoDoDesenho }
      : { rodadas: rodadasDoDesenho, tempoMs: tempoDoDesenho, ...(palavras.length ? { lista: palavras, soLista } : {}) };
    conteudo = (
      <>
      {!solo && (
        <fieldset>
          <legend>{t('Modo')}</legend>
          <Opcoes
            valor={telefone ? 'telefone' : 'classico'}
            aoMudar={(v) => setTelefone(v === 'telefone')}
            opcoes={[
              { valor: 'classico', nome: `✏️ ${t('Clássico')}` },
              { valor: 'telefone', nome: `📞 ${t('Telefone sem fio')}` },
            ]}
          />
          {telefone && <span className="contagem">{t('Cada um escreve, o próximo desenha, o próximo adivinha. De 3 pessoas em diante.')}</span>}
        </fieldset>
      )}
      {/* as rodadas e o tempo de cada desenho (20/11/2026), como no Stop */}
      {!telefone && (
      <fieldset>
        <legend>{t('Rodadas')}</legend>
        <Opcoes valor={rodadasDoDesenho} aoMudar={setRodadasDoDesenho} opcoes={[1, 2, 3].map((n) => ({ valor: n, nome: String(n) }))} />
      </fieldset>
      )}
      <fieldset>
        <legend>{t('Tempo')}</legend>
        <Opcoes valor={tempoDoDesenho} aoMudar={setTempoDoDesenho} opcoes={[45_000, 60_000, 80_000, 120_000].map((ms) => ({ valor: ms, nome: `${ms / 1000} s` }))} />
      </fieldset>
      {!telefone && (
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
      )}
      </>
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
