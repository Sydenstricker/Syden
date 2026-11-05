import { useT } from './i18n';

/**
 * QUANTOS ADVERSÁRIOS DO COMPUTADOR (o Solo contra o computador, pedido dele de 05/11/2026; o servidor em
 * server/src/minijogo-robos.ts). Cada opção é o número de robôs que o servidor recebe (`robos`) e a mesa desenhada só com
 * figuras, sem texto novo para traduzir: "🤖 2" são dois adversários, cada um por si (como no Cidades à venda), e na dupla, em
 * que a pessoa joga com um robô de parceiro, a mesa aparece com os lados: "👤🤖 × 🤖🤖" (👤 é a pessoa).
 */
export interface OpcaoDeRobos {
  robos: number;
  /** A mesa: os lados, cada um uma lista de figuras. */
  lados: string[];
}

/** Cada um por si, contra `robos` robôs: "🤖 2", como no Cidades à venda. */
export const cadaUmPorSi = (robos: number): OpcaoDeRobos => ({ robos, lados: [`🤖 ${robos}`] });
/** Em duplas de quatro, com um robô de parceiro. */
export const EM_DUPLAS: OpcaoDeRobos = { robos: 3, lados: ['👤🤖', '🤖🤖'] };

/** Os botões das opções (com a de agora marcada, se houver). */
export function BotoesDosRobos({ opcoes, escolhida, aoEscolher }: { opcoes: OpcaoDeRobos[]; escolhida?: number; aoEscolher: (robos: number) => void }) {
  const t = useT();
  return (
    <>
      <p className="minijogo-situacao">{t('Quantos adversários?')}</p>
      <ul className="tab-rodadas cid-robos">
        {opcoes.map((o) => (
          <li key={`${o.robos}-${o.lados.join('')}`}>
            <button
              type="button"
              className={`cid-robos-botao${escolhida === o.robos ? ' escolhido' : ''}`}
              aria-pressed={escolhida === undefined ? undefined : escolhida === o.robos}
              onClick={() => aoEscolher(o.robos)}
            >
              {o.lados.join(' × ')}
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
