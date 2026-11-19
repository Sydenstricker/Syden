import { chave, useT } from './i18n';
import type { EstadoTabuleiro, ItemDoTabuleiro } from './minijogos';

/**
 * AS PEÇAS NOVAS DO TABULEIRO DA TURMA (19/11/2026, server/src/minijogo-tabuleiro-da-turma.ts): os itens (a figura e o nome), a
 * loja, a bifurcação, o duelo, a reta final e os prêmios bônus. Tudo desenhado por código, pixel a pixel, como o resto do
 * tabuleiro; o servidor decide tudo, e estes painéis só pedem (e só a quem está na vez).
 */

export const ITENS_DO_TABULEIRO: ItemDoTabuleiro[] = ['duplo', 'escolhido', 'troca', 'ima', 'escudo'];
export const NOME_DO_ITEM: Record<ItemDoTabuleiro, string> = {
  duplo: chave('Dado duplo'),
  escolhido: chave('Dado escolhido'),
  troca: chave('Troca de lugar'),
  ima: chave('Ímã da dourada'),
  escudo: chave('Escudo'),
};

/** A figura de cada item, de pixels grandes (16 × 16). */
export function IconeDoItem({ item, tamanho = 22 }: { item: ItemDoTabuleiro; tamanho?: number }) {
  return (
    <svg className="tab-item-icone" width={tamanho} height={tamanho} viewBox="0 0 16 16" aria-hidden="true" shapeRendering="crispEdges">
      {item === 'duplo' && (
        <>
          <rect x="1" y="5" width="8" height="8" fill="#a89276" />
          <rect x="1" y="4" width="8" height="8" fill="#f3ead8" />
          <rect x="3" y="6" width="2" height="2" fill="#5a3a2a" />
          <rect x="6" y="9" width="2" height="2" fill="#5a3a2a" />
          <rect x="7" y="2" width="8" height="8" fill="#a89276" />
          <rect x="7" y="1" width="8" height="8" fill="#f3ead8" />
          <rect x="8" y="2" width="2" height="2" fill="#5a3a2a" />
          <rect x="12" y="2" width="2" height="2" fill="#5a3a2a" />
          <rect x="8" y="6" width="2" height="2" fill="#5a3a2a" />
          <rect x="12" y="6" width="2" height="2" fill="#5a3a2a" />
        </>
      )}
      {item === 'escolhido' && (
        <>
          <rect x="3" y="3" width="10" height="11" fill="#a89276" />
          <rect x="3" y="2" width="10" height="10" fill="#f3ead8" />
          <rect x="6" y="4" width="4" height="2" fill="#4f8fc8" />
          <rect x="9" y="5" width="2" height="2" fill="#4f8fc8" />
          <rect x="7" y="7" width="2" height="2" fill="#4f8fc8" />
          <rect x="7" y="10" width="2" height="1" fill="#4f8fc8" />
        </>
      )}
      {item === 'troca' && (
        <>
          <rect x="2" y="4" width="10" height="2" fill="#5fa8a0" />
          <rect x="10" y="2" width="2" height="6" fill="#5fa8a0" />
          <rect x="12" y="4" width="2" height="2" fill="#5fa8a0" />
          <rect x="4" y="10" width="10" height="2" fill="#d9774f" />
          <rect x="4" y="8" width="2" height="6" fill="#d9774f" />
          <rect x="2" y="10" width="2" height="2" fill="#d9774f" />
        </>
      )}
      {item === 'ima' && (
        <>
          <rect x="3" y="3" width="3" height="8" fill="#c94a3a" />
          <rect x="10" y="3" width="3" height="8" fill="#c94a3a" />
          <rect x="3" y="11" width="10" height="3" fill="#c94a3a" />
          <rect x="3" y="1" width="3" height="2" fill="#dcdcdc" />
          <rect x="10" y="1" width="3" height="2" fill="#dcdcdc" />
          <rect x="7" y="4" width="2" height="2" fill="#f2c46a" />
        </>
      )}
      {item === 'escudo' && (
        <>
          <rect x="3" y="2" width="10" height="7" fill="#6a8fc8" />
          <rect x="4" y="9" width="8" height="2" fill="#6a8fc8" />
          <rect x="5" y="11" width="6" height="2" fill="#6a8fc8" />
          <rect x="7" y="13" width="2" height="2" fill="#6a8fc8" />
          <rect x="7" y="3" width="2" height="9" fill="#f3ead8" />
          <rect x="4" y="5" width="8" height="2" fill="#f3ead8" />
        </>
      )}
    </svg>
  );
}

/** Os itens de alguém, em fileira (o placar e a minha mão). */
export function ItensDe({ itens }: { itens: ItemDoTabuleiro[] }) {
  const t = useT();
  if (!itens.length) return null;
  return (
    <span className="tab-itens">
      {itens.map((item, i) => (
        <span key={i} title={t(NOME_DO_ITEM[item])}>
          <IconeDoItem item={item} tamanho={16} />
        </span>
      ))}
    </span>
  );
}

/** Na minha vez, antes do dado: os itens que dá para usar (o escudo funciona sozinho). */
export function UsarItens({
  itens,
  outros,
  escolhendo,
  setEscolhendo,
  pedir,
  desligado,
}: {
  itens: ItemDoTabuleiro[];
  outros: { userId: number; username: string }[];
  escolhendo: ItemDoTabuleiro | null;
  setEscolhendo: (i: ItemDoTabuleiro | null) => void;
  pedir: (corpo: Record<string, unknown>) => void;
  desligado: boolean;
}) {
  const t = useT();
  const usaveis = [...new Set(itens.filter((i) => i !== 'escudo'))];
  if (!usaveis.length) return null;
  if (escolhendo === 'escolhido')
    return (
      <div className="tab-usar">
        <p className="minijogo-situacao">{t('Qual número?')}</p>
        <div className="minijogo-acoes">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <button key={n} type="button" className="btn-secondary" disabled={desligado} onClick={() => pedir({ tipo: 'usar', item: 'escolhido', valor: n })}>
              {n}
            </button>
          ))}
          <button type="button" className="btn-secondary" onClick={() => setEscolhendo(null)}>
            {t('Voltar')}
          </button>
        </div>
      </div>
    );
  if (escolhendo === 'troca')
    return (
      <div className="tab-usar">
        <p className="minijogo-situacao">{t('Trocar com quem?')}</p>
        <div className="minijogo-acoes">
          {outros.map((o) => (
            <button key={o.userId} type="button" className="btn-secondary" disabled={desligado} onClick={() => pedir({ tipo: 'usar', item: 'troca', alvo: o.userId })}>
              {o.username}
            </button>
          ))}
          <button type="button" className="btn-secondary" onClick={() => setEscolhendo(null)}>
            {t('Voltar')}
          </button>
        </div>
      </div>
    );
  return (
    <div className="tab-usar minijogo-acoes">
      {usaveis.map((item) => (
        <button
          key={item}
          type="button"
          className="btn-secondary tab-usar-item"
          disabled={desligado || (item === 'troca' && !outros.length)}
          onClick={() => (item === 'escolhido' || item === 'troca' ? setEscolhendo(item) : pedir({ tipo: 'usar', item }))}
        >
          <IconeDoItem item={item} /> {t(NOME_DO_ITEM[item])}
        </button>
      ))}
    </div>
  );
}

/** A loja de itens: cada item com o preço; o que não cabe no bolso fica apagado. */
export function Loja({
  cenouras,
  precos,
  pedir,
  desligado,
}: {
  cenouras: number;
  precos: EstadoTabuleiro['precos'];
  pedir: (corpo: Record<string, unknown>) => void;
  desligado: boolean;
}) {
  const t = useT();
  return (
    <div className="tab-loja">
      <p className="minijogo-situacao">{t('Loja de itens')}</p>
      <ul className="tab-loja-lista">
        {ITENS_DO_TABULEIRO.map((item) => (
          <li key={item}>
            <button type="button" className="tab-loja-item" disabled={desligado || cenouras < precos[item]} onClick={() => pedir({ tipo: 'item', item })}>
              <IconeDoItem item={item} tamanho={30} />
              <span>{t(NOME_DO_ITEM[item])}</span>
              <strong>🥕 {precos[item]}</strong>
            </button>
          </li>
        ))}
      </ul>
      <div className="minijogo-acoes">
        <button type="button" className="btn-secondary" disabled={desligado} onClick={() => pedir({ tipo: 'item', item: null })}>
          {t('Agora não')}
        </button>
      </div>
    </div>
  );
}

/** A bifurcação: as duas setas (a volta segue reto; o desvio sai para fora). */
export function Bifurcacao({ pedir, desligado }: { pedir: (corpo: Record<string, unknown>) => void; desligado: boolean }) {
  const t = useT();
  const seta = (desvio: boolean) => (
    <svg width="22" height="22" viewBox="0 0 16 16" aria-hidden="true" shapeRendering="crispEdges">
      {desvio ? (
        <>
          <rect x="3" y="7" width="2" height="8" fill="currentColor" />
          <rect x="3" y="5" width="8" height="2" fill="currentColor" />
          <rect x="9" y="3" width="2" height="6" fill="currentColor" />
          <rect x="11" y="5" width="2" height="2" fill="currentColor" />
        </>
      ) : (
        <>
          <rect x="7" y="4" width="2" height="11" fill="currentColor" />
          <rect x="5" y="4" width="6" height="2" fill="currentColor" />
          <rect x="6" y="2" width="4" height="2" fill="currentColor" />
          <rect x="7" y="1" width="2" height="1" fill="currentColor" />
        </>
      )}
    </svg>
  );
  return (
    <div className="minijogo-acoes">
      <button type="button" className="btn-primary" disabled={desligado} onClick={() => pedir({ tipo: 'caminho', ramal: false })}>
        {seta(false)} {t('Seguir a volta')}
      </button>
      <button type="button" className="btn-secondary" disabled={desligado} onClick={() => pedir({ tipo: 'caminho', ramal: true })}>
        {seta(true)} {t('Pegar o desvio')}
      </button>
    </div>
  );
}

/** O duelo: quem parou escolhe quem enfrentar. */
export function EscolhaDoDuelo({
  outros,
  pedir,
  desligado,
}: {
  outros: { userId: number; username: string; cenouras: number }[];
  pedir: (corpo: Record<string, unknown>) => void;
  desligado: boolean;
}) {
  const t = useT();
  return (
    <>
      <p className="minijogo-situacao">{t('Escolha quem enfrentar.')}</p>
      <div className="minijogo-acoes">
        {outros.map((o) => (
          <button key={o.userId} type="button" className="btn-secondary" disabled={desligado} onClick={() => pedir({ tipo: 'duelo', contra: o.userId })}>
            {o.username} · 🥕 {o.cenouras}
          </button>
        ))}
      </div>
    </>
  );
}

const TITULO_DO_PREMIO: Record<'microjogos' | 'andarilho' | 'eventos', string> = {
  microjogos: chave('Craque dos microjogos'),
  andarilho: chave('Quem mais andou'),
  eventos: chave('Quem mais caiu em evento'),
};

/** A figura de cada prêmio: o troféu, a bota e o ponto de interrogação. */
function FiguraDoPremio({ tipo }: { tipo: 'microjogos' | 'andarilho' | 'eventos' }) {
  return (
    <svg width="34" height="34" viewBox="0 0 16 16" aria-hidden="true" shapeRendering="crispEdges">
      {tipo === 'microjogos' && (
        <>
          <rect x="4" y="2" width="8" height="6" fill="#f2c46a" />
          <rect x="2" y="3" width="2" height="3" fill="#f2c46a" />
          <rect x="12" y="3" width="2" height="3" fill="#f2c46a" />
          <rect x="5" y="8" width="6" height="2" fill="#e3a640" />
          <rect x="7" y="10" width="2" height="2" fill="#d08e2c" />
          <rect x="4" y="12" width="8" height="2" fill="#8e6a52" />
          <rect x="5" y="3" width="2" height="2" fill="#fff1c8" />
        </>
      )}
      {tipo === 'andarilho' && (
        <>
          <rect x="5" y="2" width="5" height="8" fill="#8e6a52" />
          <rect x="5" y="10" width="9" height="3" fill="#8e6a52" />
          <rect x="5" y="13" width="10" height="1" fill="#3a2c22" />
          <rect x="6" y="4" width="3" height="1" fill="#c9a37a" />
          <rect x="1" y="6" width="3" height="1" fill="#c9b48f" />
          <rect x="0" y="9" width="4" height="1" fill="#c9b48f" />
        </>
      )}
      {tipo === 'eventos' && (
        <>
          <rect x="2" y="2" width="12" height="12" fill="#8e7cc3" />
          <rect x="6" y="4" width="4" height="2" fill="#ffe9a0" />
          <rect x="9" y="5" width="2" height="3" fill="#ffe9a0" />
          <rect x="7" y="8" width="2" height="2" fill="#ffe9a0" />
          <rect x="7" y="11" width="2" height="2" fill="#ffe9a0" />
        </>
      )}
    </svg>
  );
}

/** Os prêmios bônus: um de cada vez (`mostrados`), cada um com quem ganhou a dourada. */
export function PremiosBonus({
  premios,
  mostrados,
  nomeDe,
  eu,
}: {
  premios: NonNullable<EstadoTabuleiro['premios']>;
  mostrados: number;
  nomeDe: (id: number) => string;
  eu: number;
}) {
  const t = useT();
  return (
    <div className="tab-premios">
      <p className="minijogo-situacao">{t('Prêmios bônus')}</p>
      <ol>
        {premios.slice(0, mostrados).map((p) => (
          <li key={p.tipo} className={`tab-premio${p.ganhadores.includes(eu) ? ' eu' : ''}`}>
            <FiguraDoPremio tipo={p.tipo} />
            <span className="tab-premio-titulo">{t(TITULO_DO_PREMIO[p.tipo])}</span>
            <span className="tab-premio-quem">{p.ganhadores.length ? p.ganhadores.map(nomeDe).join(', ') : '—'}</span>
            {p.ganhadores.length > 0 && <strong className="tab-premio-mais">+1 ★</strong>}
          </li>
        ))}
      </ol>
    </div>
  );
}
