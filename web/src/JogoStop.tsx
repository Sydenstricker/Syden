import { Check, Hand } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useT } from './i18n';
import { Placar, Relogio, type Agir } from './Minijogo';
import { CATEGORIAS_DO_STOP, type EstadoStop, type Partida } from './minijogos';

/**
 * O STOP na sala de voz (ver server/src/minijogo-stop.ts). Três momentos por rodada:
 *
 * - ESCREVENDO: a letra grande e uma caixa por categoria. O que se digita vai ao servidor sozinho, um
 *   instante depois de parar de digitar — assim, quando alguém aperta STOP, a palavra de todo mundo já
 *   está lá. O STOP só acende com tudo preenchido.
 * - CONFERINDO: as respostas de todo mundo, categoria por categoria. Clicar na resposta de outra pessoa
 *   diz "não vale"; a resposta cai quando mais da metade dos outros concorda. É a parte da conversa.
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
        <div className="stop-letra" aria-label={t('Letra: {letra}', { letra: estado.letra })}>
          {estado.letra}
        </div>
        <div className="stop-campos">
          {estado.categorias.map((categoria, i) => (
            <label key={categoria} className="stop-campo">
              <span>{t(CATEGORIAS_DO_STOP[categoria] ?? categoria)}</span>
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
        <Relogio restante={restante} total={escrevendo ? 90_000 : 2_000} />
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
  return (
    <div className="stop">
      <p className="minijogo-situacao">
        {conferindo ? t('Clique numa resposta que não vale. Ela cai se mais da metade concordar.') : t('Pontos da rodada')}
      </p>
      <div className="stop-conferencia">
        {estado.categorias.map((categoria, c) => (
          <section key={categoria}>
            <h4>{t(CATEGORIAS_DO_STOP[categoria] ?? categoria)}</h4>
            <ul>
              {(estado.respostas ?? []).map((pessoa) => {
                const r = pessoa.respostas[c];
                const minha = pessoa.userId === eu;
                const podeContestar = conferindo && !minha && r.texto.trim() !== '';
                return (
                  <li key={pessoa.userId}>
                    <button
                      type="button"
                      className={`stop-resposta${r.valida ? '' : ' nao-vale'}${r.contestei ? ' contestei' : ''}`}
                      disabled={!podeContestar}
                      aria-pressed={podeContestar ? r.contestei : undefined}
                      title={podeContestar ? (r.contestei ? t('Desfazer') : t('Não vale')) : undefined}
                      onClick={() => agir({ tipo: 'contestar', categoria: c, alvo: pessoa.userId })}
                    >
                      <span className="stop-quem">{pessoa.username}</span>
                      <span className="stop-texto">{r.texto.trim() || '—'}</span>
                      {r.contra > 0 && <span className="stop-contra">✕{r.contra}</span>}
                      {r.pontos !== null && <span className="stop-pontos">+{r.pontos}</span>}
                    </button>
                  </li>
                );
              })}
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
