import { Check, Hand } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useT } from './i18n';
import { Placar, PlacarAoVivo, Relogio, type Agir } from './Minijogo';
import { nomeDaCategoriaDoStop, type EstadoStop, type Partida } from './minijogos';
import { tocar } from './somDosJogos';
import './jogosDePalavras.css';

/**
 * O STOP na sala de voz (ver server/src/minijogo-stop.ts). Três momentos por rodada:
 *
 * - ESCREVENDO: a letra grande e uma caixa por categoria. O que se digita vai ao servidor sozinho, um
 *   instante depois de parar de digitar — assim, quando alguém aperta STOP, a palavra de todo mundo já
 *   está lá. O STOP só acende com tudo preenchido.
 * - CONFERINDO: as respostas de todo mundo, UMA CATEGORIA DE CADA VEZ (21/11/2026), a turma inteira na mesma, com as
 *   respostas lado a lado. Clicar na resposta de outra pessoa diz "não vale"; a resposta cai quando mais da metade dos
 *   outros concorda (com dois, quando quem escreveu aceita). O "Pronto" de todos passa à próxima. É a parte da conversa.
 * - RESULTADO: os pontos de cada resposta, por alguns segundos, e a rodada seguinte começa sozinha.
 */
export function JogoStop({
  estado,
  eu,
  restante,
  agir,
  aoAgir,
}: {
  estado: EstadoStop & Partida;
  eu: number;
  restante: number;
  agir: (corpo: Record<string, unknown>) => void;
  aoAgir: Agir;
}) {
  const t = useT();
  const [textos, setTextos] = useState<string[]>(estado.minhas);
  const textosRef = useRef(textos);
  textosRef.current = textos;
  const envio = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Rodada nova: as caixas voltam vazias (ou com o que o servidor guardou, para quem recarregou a página).
  useEffect(() => {
    setTextos(estado.minhas);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado.rodada]);

  const enviar = (lista: string[]) => void aoAgir({ tipo: 'respostas', respostas: lista }).catch(() => {});

  // OS SONS (19/11/2026): a letra nova, o STOP de alguém, e os pontos da rodada (a medalha quando os meus somam bem).
  const antesDoSom = useRef({ fase: estado.fase, rodada: estado.rodada });
  useEffect(() => {
    const a = antesDoSom.current;
    if (estado.rodada !== a.rodada || (estado.fase === 'escrevendo' && a.fase !== 'escrevendo')) tocar('vez');
    else if (estado.fase === 'parando' && a.fase === 'escrevendo') tocar('alarme');
    else if (estado.fase === 'resultado' && a.fase !== 'resultado') tocar('moeda');
    antesDoSom.current = { fase: estado.fase, rodada: estado.rodada };
  }, [estado.fase, estado.rodada]);

  // A conferência passou à próxima categoria (21/11/2026): um som de carta virando.
  const categoriaAtual = (estado as { categoriaAtual?: number | null }).categoriaAtual ?? null;
  const categoriaAntes = useRef(categoriaAtual);
  useEffect(() => {
    if (categoriaAtual !== null && categoriaAntes.current !== null && categoriaAtual > categoriaAntes.current) tocar('carta');
    categoriaAntes.current = categoriaAtual;
  }, [categoriaAtual]);

  // Alguém apertou STOP: manda já o que está escrito, sem esperar a pausa da digitação.
  useEffect(() => {
    if (estado.fase !== 'parando') return;
    if (envio.current) clearTimeout(envio.current);
    enviar(textosRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado.fase]);

  if (estado.terminada) {
    return <Placar eu={eu} linhas={estado.placar.map((l) => ({ ...l, valor: String(l.pontos) }))} />;
  }

  const escrevendo = estado.fase === 'escrevendo';
  const completo = textos.every((x) => x.trim() !== '');
  const jogadores = estado.placar.length;
  const nomeDe = (userId: number | null) => estado.placar.find((l) => l.userId === userId)?.username ?? '?';

  if (escrevendo || estado.fase === 'parando') {
    return (
      <div className="stop">
        <PlacarAoVivo eu={eu} linhas={estado.placar} />
        <div className="stop-letra" aria-label={t('Letra: {letra}', { letra: estado.letra })}>
          {estado.letra}
        </div>
        <div className="stop-campos">
          {estado.categorias.map((categoria, i) => (
            <label key={categoria} className="stop-campo">
              <span>{nomeDaCategoriaDoStop(categoria, t)}</span>
              <input
                value={textos[i] ?? ''}
                maxLength={40}
                disabled={!escrevendo}
                placeholder={`${estado.letra}…`}
                onChange={(e) => {
                  const nova = [...textos];
                  nova[i] = e.target.value;
                  setTextos(nova);
                  if (envio.current) clearTimeout(envio.current);
                  envio.current = setTimeout(() => enviar(nova), 400);
                }}
              />
            </label>
          ))}
        </div>
        <Relogio restante={restante} total={escrevendo ? ((estado as { tempoMs?: number }).tempoMs ?? 90_000) : 2_000} />
        {escrevendo ? (
          <div className="stop-rodape">
            <span className="minijogo-situacao">{t('{n} de {total} já completaram.', { n: estado.completos.length, total: jogadores })}</span>
            <button
              type="button"
              className="btn-primary stop-botao"
              disabled={!completo}
              title={completo ? undefined : t('Preencha todas as categorias antes de parar.')}
              onClick={async () => {
                if (envio.current) clearTimeout(envio.current);
                // A última palavra vai antes do STOP: o servidor só aceita parar com tudo preenchido.
                await aoAgir({ tipo: 'respostas', respostas: textos }).catch(() => {});
                agir({ tipo: 'stop' });
              }}
            >
              <Hand size={16} aria-hidden="true" /> {t('STOP')}
            </button>
          </div>
        ) : (
          <p className="minijogo-situacao stop-parou" role="status">
            {t('{nome} apertou STOP!', { nome: nomeDe(estado.quemParou) })}
          </p>
        )}
      </div>
    );
  }

  // Conferência e resultado: as respostas de todo mundo, categoria por categoria.
  const conferindo = estado.fase === 'conferindo';
  const prontoEu = estado.prontos.includes(eu);
  const extra = estado as EstadoStop & { categoriaAtual?: number | null; conferindoPorCategoriaMs?: number };

  /** O botão de uma resposta: contestar a dos outros, aceitar a minha contestada; com os pontos no resultado. */
  const resposta = (c: number, pessoa: NonNullable<EstadoStop['respostas']>[number], classe = '') => {
    const r = pessoa.respostas[c];
    const minha = pessoa.userId === eu;
    const podeContestar = conferindo && !minha && r.texto.trim() !== '';
    // a minha resposta contestada: posso aceitar que não vale (com dois, é o que a derruba)
    const podeAceitar = conferindo && minha && r.contra > 0;
    const marcada = podeAceitar ? r.aceita === true : r.contestei;
    return (
      <button
        type="button"
        className={`stop-resposta${classe}${r.valida ? '' : ' nao-vale'}${marcada ? ' contestei' : ''}`}
        disabled={!podeContestar && !podeAceitar}
        aria-pressed={podeContestar || podeAceitar ? marcada : undefined}
        title={podeContestar || podeAceitar ? (marcada ? t('Desfazer') : podeAceitar ? t('Aceitar que não vale') : t('Não vale')) : undefined}
        onClick={() => {
          tocar('clique');
          agir(podeAceitar ? { tipo: 'aceitar', categoria: c } : { tipo: 'contestar', categoria: c, alvo: pessoa.userId });
        }}
      >
        <span className="stop-quem">{pessoa.username}</span>
        <span className="stop-texto">{r.texto.trim() || '—'}</span>
        {r.contra > 0 && <span className="stop-contra">✕{r.contra}</span>}
        {r.pontos !== null && <span className="stop-pontos">+{r.pontos}</span>}
      </button>
    );
  };

  // A CONFERÊNCIA POR CATEGORIA (21/11/2026): a de agora, grande, com as respostas lado a lado; em cima, todas as categorias,
  // a de agora marcada e as já conferidas esmaecidas.
  const atual = conferindo ? (extra.categoriaAtual ?? null) : null;
  if (atual !== null && atual >= 0 && atual < estado.categorias.length) {
    return (
      <div className="stop">
        <PlacarAoVivo eu={eu} linhas={estado.placar} />
        <ol className="stop-etapas">
          {estado.categorias.map((categoria, c) => (
            <li key={categoria} className={c === atual ? 'atual' : c < atual ? 'feita' : ''} aria-current={c === atual ? 'step' : undefined}>
              {nomeDaCategoriaDoStop(categoria, t)}
            </li>
          ))}
        </ol>
        <h3 className="stop-categoria-atual">
          <span className="stop-letra-pequena">{estado.letra}</span> {nomeDaCategoriaDoStop(estado.categorias[atual], t)}
        </h3>
        <p className="minijogo-situacao">
          {estado.precisaAceite
            ? t('Toque numa resposta que não vale. Com dois, ela só cai se quem escreveu aceitar.')
            : t('Clique numa resposta que não vale. Ela cai se mais da metade concordar.')}
        </p>
        <ul className="stop-lado-a-lado">
          {(estado.respostas ?? []).map((pessoa) => (
            <li key={pessoa.userId}>{resposta(atual, pessoa, ' carta')}</li>
          ))}
        </ul>
        <Relogio restante={restante} total={extra.conferindoPorCategoriaMs ?? 25_000} />
        <div className="stop-rodape">
          <span className="minijogo-situacao">{t('{n} de {total} prontos.', { n: estado.prontos.length, total: jogadores })}</span>
          <button type="button" className="btn-primary" disabled={prontoEu} onClick={() => agir({ tipo: 'pronto' })}>
            <Check size={16} aria-hidden="true" /> {t('Pronto')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="stop">
      <PlacarAoVivo eu={eu} linhas={estado.placar} />
      <p className="minijogo-situacao">
        {conferindo
          ? estado.precisaAceite
            ? t('Toque numa resposta que não vale. Com dois, ela só cai se quem escreveu aceitar.')
            : t('Clique numa resposta que não vale. Ela cai se mais da metade concordar.')
          : t('Pontos da rodada')}
      </p>
      {!conferindo && estado.bonus && (
        <p className="minijogo-situacao stop-parou" role="status">
          <Hand size={14} aria-hidden="true" /> {t('{nome} parou com tudo valendo: +{n}', { nome: nomeDe(estado.bonus.userId), n: estado.bonus.pontos })}
        </p>
      )}
      <div className="stop-conferencia">
        {estado.categorias.map((categoria, c) => (
          <section key={categoria}>
            <h4>{nomeDaCategoriaDoStop(categoria, t)}</h4>
            <ul>
              {(estado.respostas ?? []).map((pessoa) => (
                <li key={pessoa.userId}>{resposta(c, pessoa)}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      {conferindo && (
        <>
          <Relogio restante={restante} total={60_000} />
          <div className="stop-rodape">
            <span className="minijogo-situacao">{t('{n} de {total} prontos.', { n: estado.prontos.length, total: jogadores })}</span>
            <button type="button" className="btn-primary" disabled={prontoEu} onClick={() => agir({ tipo: 'pronto' })}>
              <Check size={16} aria-hidden="true" /> {t('Pronto')}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
