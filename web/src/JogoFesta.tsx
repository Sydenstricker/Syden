import { useEffect, useRef, useState } from 'react';
import { useT } from './i18n';
import { Placar, PlacarAoVivo } from './Minijogo';
import type { EstadoFesta, LinhaDaFesta, Partida } from './minijogos';
import { useFormatos, type Formatos, type MicrojogoDaTela, type PropsDoMicro } from './festa/comum';
import * as registro from './festa/registro';

/**
 * A FESTA DOS COELHOS (03/11/2026, server/src/minijogo-festa.ts): cinco rodadas de microjogos, cada um na própria tela, e
 * o resultado comparado na revelação. Só a mecânica dos jogos de festa de console: o desenho é todo daqui, por código.
 *
 * O TEMPO DE CADA UM: o "prepare-se" diz quanto falta para o jogo começar (restanteMs), e o jogo começa nesse instante NO
 * RELÓGIO DESTE COMPUTADOR. O que se mede (o tempo parado, a força, quando se acertou) é medido daqui, e o servidor confere
 * contra o relógio dele. No saque, a reação conta do momento em que o sinal APARECEU nesta tela.
 *
 * CADA MICROJOGO MORA EM festa/<id>.tsx (05/11/2026), junto pelo registro festa/registro.ts; o guia de como fazer um novo
 * está no topo de server/src/festa/registro.ts. Aqui fica só a rodada comum e a partida.
 */

/** As telas pelo id. */
const TELAS = new Map<string, MicrojogoDaTela<never>>(Object.values(registro).map((m) => [m.id, m as unknown as MicrojogoDaTela<never>]));

/** Uma linha da classificação do fim (server/src/minijogo-festa.ts, classificacaoFinal): posição só para quem ficou até o fim. */
interface LinhaFinal {
  userId: number;
  username: string;
  pontos: number;
  posicao: number | null;
  saiu: boolean;
}
// (o tipo de minijogos.ts ainda não tem este campo: vai aqui até ele ganhar)
type EstadoFinal = EstadoFesta & { classificacao?: LinhaFinal[] | null };

export function JogoFesta({
  estado,
  eu,
  jogador,
  restante,
  agir,
}: {
  estado: EstadoFesta & Partida;
  eu: number;
  jogador: boolean;
  restante: number;
  agir: (corpo: Record<string, unknown>) => unknown;
}) {
  const t = useT();
  if (estado.terminada || estado.fase === 'fim') {
    // A CLASSIFICAÇÃO DO SERVIDOR, a mesma dos troféus (revisão independente, 03/11/2026: a tela dava medalha pelo placar de
    // todos, inclusive a quem tinha saído, e ao único que ficou): só quem ficou até o fim, com 2 ou mais, tem posição e
    // medalha (empatados dividem); quem saiu vem depois, sem posição. Sem pódio, os pontos sem medalha.
    const classificacao: LinhaFinal[] =
      (estado as EstadoFinal).classificacao ?? estado.placar.map((l) => ({ ...l, posicao: null, saiu: false }));
    const comPosicao = classificacao.filter((l) => l.posicao !== null);
    const semPosicao = classificacao.filter((l) => l.posicao === null);
    return (
      <div className="tabuleiro-jogo">
        {comPosicao.length > 0 && <Placar eu={eu} linhas={comPosicao.map((l) => ({ ...l, valor: String(l.pontos), posicao: l.posicao ?? undefined }))} />}
        {comPosicao.length === 0 && estado.jogadores.length > 1 && (
          <p className="minijogo-situacao">{t('Menos de duas pessoas ficaram até o fim: desta vez, sem pódio.')}</p>
        )}
        {semPosicao.length > 0 && (
          <ol className="minijogo-placar tabuleiro-sem-posicao">
            {semPosicao.map((l) => (
              <li key={l.userId} className={l.userId === eu ? 'eu' : ''}>
                <span className="minijogo-medalha" aria-hidden="true" />
                <span className="minijogo-nome">{l.username}</span>
                {l.saiu && <span className="tabuleiro-saiu">{t('Saiu antes do fim')}</span>}
                <span className="minijogo-pontos">{l.pontos}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    );
  }
  return (
    <div className={`festa festa-jogo-${estado.microjogo}`}>
      <PlacarAoVivo eu={eu} linhas={estado.placar} />
      <RodadaDaFesta estado={{ ...estado, fase: estado.fase }} eu={eu} jogador={jogador} restante={restante} agir={agir} />
    </div>
  );
}

/** Uma rodada de microjogo, como o servidor a manda (rodadaDeFesta, em server/src/minijogo-festa.ts), com o relógio da partida. */
export type EstadoDaRodada = Pick<EstadoFesta, 'rodada' | 'microjogo' | 'dados' | 'duracaoMs' | 'sinal' | 'meu' | 'prontos' | 'jogadores' | 'resposta' | 'linhas'> & {
  fase: 'preparando' | 'jogando' | 'revelando';
  recebidaEm: number;
  restanteMs: number;
  /** A medida da rede (só no "prepare-se"): devolvido na hora pela ação 'eco', o servidor sabe a ida e volta de cada um. */
  eco?: number | null;
  /** Jogando: há quanto o jogo começou, no relógio do servidor. */
  jogandoHaMs?: number | null;
};

/**
 * UMA RODADA DE MICROJOGO (o "prepare-se", o jogo e a revelação), sem o placar da partida: a Festa encadeia cinco, e o
 * Tabuleiro da turma joga uma entre as rodadas dele (JogoTabuleiro.tsx). Vai dentro de um `festa festa-jogo-<microjogo>`.
 */
export function RodadaDaFesta({
  estado,
  eu,
  jogador,
  restante,
  agir,
}: {
  estado: EstadoDaRodada;
  eu: number;
  jogador: boolean;
  restante: number;
  agir: (corpo: Record<string, unknown>) => unknown;
}) {
  const t = useT();
  const formatos = useFormatos();
  const inicio = useRef<{ rodada: number; em: number } | null>(null);
  const enviado = useRef(0);
  const [enviei, setEnviei] = useState(0);

  // o começo do jogo, neste relógio: no "prepare-se" ele se acerta a cada estado; jogando, fica o primeiro que se soube
  if (estado.fase === 'preparando') inicio.current = { rodada: estado.rodada, em: estado.recebidaEm + estado.restanteMs };
  else if (estado.fase === 'jogando' && inicio.current?.rodada !== estado.rodada) {
    // quem chega no meio (ou recarrega): pelo que o servidor diz que já passou; o relógio da partida pode estar marcado para
    // outra coisa (o sinal do saque, a próxima figura da flor)
    const ha = estado.jogandoHaMs;
    inicio.current = { rodada: estado.rodada, em: typeof ha === 'number' ? estado.recebidaEm - ha : estado.recebidaEm + estado.restanteMs - estado.duracaoMs };
  }

  const souJogador = jogador && estado.jogadores.some((j) => j.userId === eu);

  // O ECO (revisão independente, 03/11/2026): o servidor mede a ida e volta de cada um devolvendo o número do estado NA HORA,
  // e a folga que ele dá ao tempo de cada um é essa. Cada número volta uma vez só (o StrictMode roda o efeito duas vezes).
  const ecosDevolvidos = useRef(new Set<number>());
  const eco = estado.fase === 'preparando' && souJogador ? (estado.eco ?? null) : null;
  useEffect(() => {
    if (eco === null || ecosDevolvidos.current.has(eco)) return;
    ecosDevolvidos.current.add(eco);
    void agir({ tipo: 'eco', eco });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eco]);

  const jaMandei = estado.meu !== null || enviei === estado.rodada;
  const ativo = souJogador && estado.fase === 'jogando' && !jaMandei;
  const enviar = (corpo: Record<string, unknown>) => {
    if (enviado.current === estado.rodada) return;
    enviado.current = estado.rodada;
    setEnviei(estado.rodada);
    void agir({ tipo: 'resultado', ...corpo });
  };
  const micro = TELAS.get(estado.microjogo as string);
  const nome = micro ?? { nome: '', dica: '' };
  const props: PropsDoMicro<never> | null =
    estado.dados && inicio.current
      ? {
          dados: estado.dados as never,
          inicio: inicio.current.em,
          ativo,
          enviar,
          lance: (corpo: Record<string, unknown>) => void agir({ tipo: 'acerto', ...corpo }),
          sinal: estado.sinal,
          resposta: estado.resposta,
        }
      : null;
  const mostrarJogo = (estado.fase === 'jogando' && souJogador) || (estado.fase === 'revelando' && !!micro?.naRevelacao);

  return (
    <>
      {estado.fase === 'preparando' && (
        <div className="festa-preparo">
          <strong className="festa-nome">{t(nome.nome)}</strong>
          <p>{t(nome.dica)}</p>
          <span className="festa-contagem" aria-hidden="true">
            {Math.max(1, Math.ceil(restante / 1000))}
          </span>
        </div>
      )}
      {estado.fase !== 'preparando' && <strong className="festa-nome pequeno">{t(nome.nome)}</strong>}
      {mostrarJogo && props && (
        <div className="festa-palco" key={estado.rodada}>
          {micro && <micro.Tela {...props} />}
        </div>
      )}
      {estado.fase === 'jogando' && souJogador && jaMandei && (
        <p className="minijogo-situacao">
          {estado.meu?.motivo === 'cedo' ? t('Cedo demais!') : t('Você terminou! Agora é torcer pelos outros.')}
        </p>
      )}
      {estado.fase === 'jogando' && !souJogador && <p className="minijogo-situacao">{t(nome.dica)}</p>}
      {estado.fase === 'jogando' && estado.jogadores.length > 1 && (
        <ul className="festa-prontos">
          {estado.jogadores.map((j) => (
            <li key={j.userId} className={estado.prontos.includes(j.userId) ? 'pronto' : ''}>
              <span className="minijogo-nome">{j.username}</span>
              <span aria-hidden="true">{estado.prontos.includes(j.userId) ? '✓' : '…'}</span>
            </li>
          ))}
        </ul>
      )}
      {estado.fase === 'revelando' && estado.linhas && (
        <ol className="festa-revelacao">
          {estado.linhas.map((l) => (
            <li key={l.userId} className={`${l.userId === eu ? 'eu' : ''}${l.posicao === null ? ' fora' : ''}`}>
              <span className="festa-posicao">{l.posicao ?? '–'}</span>
              <span className="minijogo-nome">{l.username}</span>
              <span className="festa-valor">{micro ? textoDoResultado(micro, l, formatos, t) : ''}</span>
              <strong className="festa-pontos">+{l.pontos}</strong>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}

function textoDoResultado(m: MicrojogoDaTela<never>, l: LinhaDaFesta, f: Formatos, t: (texto: string) => string): string {
  if (l.motivo === 'cedo') return t('Cedo demais!');
  if (l.motivo === 'invalido') return t('Não valeu');
  if (l.motivo === 'nada') return t('Sem resposta');
  if (l.motivo === 'errou' && !m.errouComValor) return t('Errou');
  return m.valor(l.valor ?? 0, f);
}
