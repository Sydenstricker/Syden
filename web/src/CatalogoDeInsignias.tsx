import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from './api';
import { useT } from './i18n';
import { acharInsignia, ORDEM_DAS_INSIGNIAS } from './insignias';
import { Insignia } from './Medalha';

interface DoCatalogo {
  codigo: string;
  tenho: boolean;
}

/**
 * O CATÁLOGO DAS INSÍGNIAS (19/11/2026, pedido dele: "traga as duas coisas", vendo as insígnias do Discord). Todas as que
 * existem: as que a pessoa tem, inteiras, e as outras ESMAECIDAS, com a frase de como se ganham. Sem barra de progresso,
 * sem "faltam", sem contagem, sem raridade e sem prazo — a regra das conquistas. É também o lugar de escolher a VITRINE
 * (quais aparecem no perfil, até o limite, e em que ordem): o mesmo componente em Minha conta e no Guarda-roupa, para os
 * dois caminhos nunca discordarem.
 */
export function CatalogoDeInsignias() {
  const t = useT();
  const [catalogo, setCatalogo] = useState<DoCatalogo[] | null>(null);
  const [vitrine, setVitrine] = useState<string[]>([]);
  const [limite, setLimite] = useState(5);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    void api<{ insignias: DoCatalogo[]; vitrine: string[]; limite: number }>('/api/me/insignias')
      .then((r) => {
        setCatalogo(r.insignias);
        setVitrine(r.vitrine ?? []);
        setLimite(r.limite);
      })
      .catch(() =>
        // O servidor ainda sem o catálogo (o site sobe antes): o que a pessoa tem, e as outras como "não tem".
        api<{ itens: { code: string }[]; vitrine: string[]; limite: number }>('/api/me/itens')
          .then((r) => {
            const tem = new Set(r.itens.map((i) => i.code));
            setCatalogo(ORDEM_DAS_INSIGNIAS.map((codigo) => ({ codigo, tenho: tem.has(codigo) })));
            setVitrine(r.vitrine ?? []);
            setLimite(r.limite);
          })
          .catch(() => setCatalogo([])),
      );
  }, []);

  function guardar(nova: string[]) {
    setErro(null);
    setVitrine(nova); // a tela responde na hora; se o servidor recusar, a mensagem aparece embaixo
    void api('/api/me/vitrine', { method: 'PUT', body: { codigos: nova } }).catch((e) => setErro((e as Error).message));
  }

  function alternar(codigo: string) {
    if (vitrine.includes(codigo)) return guardar(vitrine.filter((c) => c !== codigo));
    if (vitrine.length >= limite) return setErro(t('Dá para exibir no máximo {limite} insígnias ao mesmo tempo.', { limite }));
    guardar([...vitrine, codigo]);
  }

  function mover(codigo: string, passo: -1 | 1) {
    const i = vitrine.indexOf(codigo);
    const j = i + passo;
    if (i < 0 || j < 0 || j >= vitrine.length) return;
    const nova = [...vitrine];
    [nova[i], nova[j]] = [nova[j], nova[i]];
    guardar(nova);
  }

  if (catalogo === null) return null;

  // A ordem é a do app (insignias.ts); código que o app não conhece fica de fora, em vez de virar um quadro vazio.
  const tenho = new Set(catalogo.filter((i) => i.tenho).map((i) => i.codigo));
  const todas = ORDEM_DAS_INSIGNIAS.filter((codigo) => catalogo.some((i) => i.codigo === codigo) || tenho.has(codigo));
  const naVitrine = vitrine.filter((codigo) => tenho.has(codigo) && acharInsignia(codigo));

  return (
    <section className="catalogo-de-insignias">
      <h3>{t('Minhas insígnias')}</h3>

      {tenho.size === 0 && (
        <p className="settings-hint">
          {t('Você ainda não tem nenhuma. Elas chegam como presente ou como recompensa — por exemplo, quando uma ideia sua entra no Syden.')}
        </p>
      )}

      {tenho.size > 0 && (
        <>
          <p className="settings-hint">{t('Clique para escolher quais aparecem no seu perfil (até {limite}).', { limite })}</p>
          {naVitrine.length > 0 && (
            <ol className="insignias-na-vitrine" aria-label={t('No seu perfil')}>
              {naVitrine.map((codigo, i) => {
                const insignia = acharInsignia(codigo)!;
                return (
                  <li key={codigo}>
                    <button
                      type="button"
                      className="icon-plain"
                      disabled={i === 0}
                      onClick={() => mover(codigo, -1)}
                      title={t('Mover para a esquerda')}
                      aria-label={t('Mover para a esquerda')}
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <Insignia arte={insignia.arte} titulo={insignia.nome} moldura={insignia.moldura} tamanho={44} />
                    <button
                      type="button"
                      className="icon-plain"
                      disabled={i === naVitrine.length - 1}
                      onClick={() => mover(codigo, 1)}
                      title={t('Mover para a direita')}
                      aria-label={t('Mover para a direita')}
                    >
                      <ChevronRight size={14} />
                    </button>
                  </li>
                );
              })}
            </ol>
          )}
          {naVitrine.length > 0 && (
            <button type="button" className="link-button" onClick={() => guardar([])}>
              {t('Esconder todas')}
            </button>
          )}
        </>
      )}

      <div className="insignias-grade">
        {todas.map((codigo) => {
          const insignia = acharInsignia(codigo);
          if (!insignia) return null;
          if (!tenho.has(codigo)) {
            // A que a pessoa não tem: a silhueta e a frase de como se ganha. Nada de contagem nem de "faltam".
            return (
              <div key={codigo} className="insignia-escolha nao-tenho">
                <Insignia arte={insignia.arte} titulo={insignia.nome} moldura={insignia.moldura} tamanho={40} />
                <span>
                  <strong>{insignia.nome}</strong>
                  <small>{insignia.comoSeGanha}</small>
                </span>
              </div>
            );
          }
          const exibindo = naVitrine.includes(codigo);
          return (
            <button
              key={codigo}
              type="button"
              className={`insignia-escolha${exibindo ? ' exibindo' : ''}`}
              onClick={() => alternar(codigo)}
              aria-pressed={exibindo}
            >
              <Insignia arte={insignia.arte} titulo={insignia.nome} moldura={insignia.moldura} tamanho={40} />
              <span>
                <strong>{insignia.nome}</strong>
                <small>{exibindo ? t('Aparecendo no perfil') : insignia.descricao}</small>
              </span>
            </button>
          );
        })}
      </div>
      {erro && <p className="form-error">{erro}</p>}
    </section>
  );
}
