import { useId } from 'react';
import { useT } from './i18n';
import { IconeDeHud } from './iconesDeHud';

/**
 * QUANTOS ADVERSÁRIOS DO COMPUTADOR (o Solo contra o computador, pedido dele de 05/11/2026; o servidor em
 * server/src/minijogo-robos.ts). Cada opção é o número de robôs que o servidor recebe (`robos`) e a MESA desenhada só com
 * figuras, sem texto novo para traduzir (os ícones de HUD da Kenney, 06/11/2026, no lugar dos emojis 👤 e 🤖): você contra
 * tantos robôs, cada um por si (como no Capitais), e na dupla, em que a pessoa joga com um robô de parceiro, os dois lados.
 * O leitor de tela ouve o número de adversários (ou "2 × 2" na dupla), sob a pergunta.
 */
export type Figura = 'eu' | 'robo';

export interface OpcaoDeRobos {
  robos: number;
  /** A mesa: os lados, cada um uma lista de figuras. */
  lados: Figura[][];
  /** O que o leitor de tela lê (e a dica do mouse). */
  rotulo: string;
}

/** Cada um por si, contra `robos` robôs: você × os robôs, um ícone por adversário. */
export const cadaUmPorSi = (robos: number): OpcaoDeRobos => ({ robos, lados: [['eu'], Array<Figura>(robos).fill('robo')], rotulo: String(robos) });
/** Em duplas de quatro, com um robô de parceiro. */
export const EM_DUPLAS: OpcaoDeRobos = { robos: 3, lados: [['eu', 'robo'], ['robo', 'robo']], rotulo: '2 × 2' };

/** A mesa de uma opção, em figuras: "você 🤖 × 🤖 🤖". */
export function MesaDosRobos({ lados }: { lados: Figura[][] }) {
  return (
    <span className="mesa-dos-robos" aria-hidden="true">
      {lados.map((lado, i) => (
        <span key={i} className="mesa-dos-robos-lado">
          {i > 0 && <span className="mesa-dos-robos-contra">×</span>}
          {lado.map((f, j) =>
            f === 'eu' ? (
              <IconeDeHud key={j} nome="singleplayer" tamanho={22} className="mesa-dos-robos-voce" />
            ) : (
              <IconeDeHud key={j} nome="robo" tamanho={22} />
            ),
          )}
        </span>
      ))}
    </span>
  );
}

/** Os botões das opções (com a de agora marcada, se houver). */
export function BotoesDosRobos({
  opcoes,
  escolhida,
  aoEscolher,
  pergunta,
}: {
  opcoes: OpcaoDeRobos[];
  escolhida?: number;
  aoEscolher: (robos: number) => void;
  /** A frase de cima, já traduzida; sem ela, "Quantos adversários?". */
  pergunta?: string;
}) {
  const t = useT();
  const id = useId();
  return (
    <>
      <p className="minijogo-situacao" id={id}>
        {pergunta ?? t('Quantos adversários?')}
      </p>
      <ul className="tab-rodadas cid-robos" aria-labelledby={id}>
        {opcoes.map((o) => (
          <li key={`${o.robos}-${o.rotulo}`}>
            <button
              type="button"
              className={`cid-robos-botao${escolhida === o.robos ? ' escolhido' : ''}`}
              aria-pressed={escolhida === undefined ? undefined : escolhida === o.robos}
              aria-label={o.rotulo}
              title={o.rotulo}
              onClick={() => aoEscolher(o.robos)}
            >
              <MesaDosRobos lados={o.lados} />
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

/** A escolha inteira, antes de um jogo que só pede isso (o Dominó, o Truco): clicar já começa. */
export function EscolhaDosRobos({ opcoes, aoEscolher, aoVoltar }: { opcoes: OpcaoDeRobos[]; aoEscolher: (robos: number) => void; aoVoltar: () => void }) {
  const t = useT();
  return (
    <div className="tab-escolha">
      <BotoesDosRobos opcoes={opcoes} aoEscolher={aoEscolher} />
      <div className="minijogo-acoes">
        <button type="button" className="btn-secondary" onClick={aoVoltar}>
          {t('Outros jogos')}
        </button>
      </div>
    </div>
  );
}
