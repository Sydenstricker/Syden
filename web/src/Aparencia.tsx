import { Check, Gift, Lock, Music, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from './api';
import { Avatar } from './Avatar';
import { chave, useT } from './i18n';
import { acharInsignia } from './insignias';
import { Insignia } from './Medalha';
import { acharVisual, COMO_SE_GANHA } from './loja';
import { aplicarCorDeDestaque, COR_PADRAO, corLegivel } from './corDeDestaque';
import { classeDoFundo, corDoNome } from './profileStyles';
import { updateSettings, useSettings } from './settings';
import type { ItemDaLoja, Loja as LojaDados, TipoDeItem, User } from './types';

// APARÊNCIA: um lugar só para tudo o que muda a sua cara no Syden.
//
// POR QUE ESTA TELA SUBSTITUIU A LOJA, e a pergunta que a derrubou: "se a loja ajusta o cosmético do
// usuário e as configurações também, elas são redundantes". Estava certo. Cor do nome e fundo do
// perfil se escolhiam nos DOIS lugares; a moldura só num deles; as insígnias num terceiro. Três
// telas para a mesma decisão, e nenhuma delas completa.
//
// E "loja" era a palavra errada desde o começo. No Discord a separação faz sentido porque lá se
// VENDE: a loja é o caixa e as configurações são o guarda-roupa. No Syden tudo já é seu na hora em
// que você entra — não existe caixa, então não existe loja. Existe aparência.
//
// O QUE SOBREVIVEU DA LOJA: o formato de catálogo, com nome, descrição, amostra e o estado "em uso".
// Ele é melhor do que a fileira de quadradinhos que estava nas Configurações, porque diz o que cada
// coisa É antes de você vestir para descobrir.

/** O quadradinho que mostra como o item fica, sem precisar vestir para descobrir. */
function Amostra({ item }: { item: ItemDaLoja }) {
  if (item.tipo === 'cor') {
    return (
      <span className="loja-amostra cor" data-cor={item.codigo === 'padrao' ? undefined : item.codigo}>
        Aa
      </span>
    );
  }
  if (item.tipo === 'fundo') return <span className={`loja-amostra fundo ${classeDoFundo(item.codigo)}`} />;
  if (item.tipo === 'moldura') {
    // A MESMA MARCAÇÃO DO AVATAR DE VERDADE: os anéis moram em `.avatar[data-moldura]::after` e em
    // lugar nenhum mais. Uma amostra que não seja um `.avatar` não desenha moldura alguma — foi
    // assim que as dez apareceram como a mesma bola escura.
    return (
      <span className="loja-amostra">
        <span className="avatar loja-amostra-avatar" data-moldura={item.codigo === 'nenhuma' ? undefined : item.codigo} />
      </span>
    );
  }
  const insignia = acharInsignia(item.codigo);
  return (
    <span className="loja-amostra insignia">
      {insignia && <Insignia arte={insignia.arte} titulo={insignia.nome} moldura={insignia.moldura} tamanho={40} />}
    </span>
  );
}

function Cartao({ item, vestido, onVestir }: { item: ItemDaLoja; vestido: boolean; onVestir: (item: ItemDaLoja) => void }) {
  const t = useT();
  const visual = item.tipo === 'insignia' ? acharInsignia(item.codigo) : acharVisual(item.tipo, item.codigo);
  // Código que o servidor conhece e este site ainda não: some, em vez de virar um quadro vazio.
  if (!visual) return null;

  const trancado = !item.tenho;
  return (
    <div className={`loja-cartao${vestido ? ' vestido' : ''}${trancado ? ' trancado' : ''}`}>
      <Amostra item={item} />
      <div className="loja-cartao-texto">
        <strong>{t(visual.nome)}</strong>
        <small>{t(visual.descricao)}</small>
        {item.comoSeGanha === 'conquista' && (
          <span className="loja-etiqueta conquista">
            <Gift size={12} aria-hidden="true" /> {t(COMO_SE_GANHA.conquista)}
          </span>
        )}
      </div>
      {vestido ? (
        <span className="loja-vestido" aria-label={t('Em uso')}>
          <Check size={16} /> {t('Em uso')}
        </span>
      ) : trancado ? (
        <span className="loja-trancado" aria-label={t('Você ainda não tem este item')}>
          <Lock size={16} />
        </span>
      ) : (
        <button type="button" className="btn-secondary" onClick={() => onVestir(item)}>
          {t('Usar')}
        </button>
      )}
    </div>
  );
}

// 'pacotes' não é um tipo de item: é uma aba que leva para outro lugar.
type Aba = TipoDeItem | 'pacotes';

const ABAS: { tipo: Aba; nome: string }[] = [
  { tipo: 'cor', nome: chave('Cor do nome') },
  { tipo: 'fundo', nome: chave('Fundo do perfil') },
  { tipo: 'moldura', nome: chave('Moldura do avatar') },
  { tipo: 'insignia', nome: chave('Insígnias') },
  { tipo: 'pacotes', nome: chave('Pacotes') },
];

/**
 * A COR DO SYDEN INTEIRO, escolhida por quem usa.
 *
 * Fica no alto da Aparência, antes dos cosméticos, porque é a única escolha daqui que muda o app
 * TODO e não só o perfil — e porque o efeito é imediato: não há botão de salvar, a tela já está
 * mudando enquanto a pessoa arrasta.
 *
 * O seletor guarda a cor COMO ESCOLHIDA; quem a põe na tela escurece o quanto for preciso para o
 * texto branco continuar legível (ver corDeDestaque.ts). Por isso a bolinha de prévia mostra a cor
 * que vai MESMO aparecer, e não a do seletor: entre prometer e cumprir, a tela mostra o que cumpre.
 */
function CorDoSyden() {
  const t = useT();
  const settings = useSettings();
  const escolhida = settings.corDeDestaque ?? COR_PADRAO;
  const naTela = corLegivel(escolhida);

  function escolher(cor: string | null) {
    updateSettings({ corDeDestaque: cor });
    aplicarCorDeDestaque(cor);
  }

  return (
    <div className="cor-do-syden">
      <label className="cor-do-syden-escolha">
        <input type="color" value={escolhida} onChange={(e) => escolher(e.target.value)} aria-label={t('A cor do Syden')} />
        <span>
          <strong>{t('A cor do Syden')}</strong>
          <small>{t('Vale no app inteiro, só para você.')}</small>
        </span>
      </label>
      <span className="cor-do-syden-previa" style={{ background: naTela }} aria-hidden="true" />
      {settings.corDeDestaque && (
        <button type="button" className="link-button" onClick={() => escolher(null)}>
          {t('Voltar ao padrão')}
        </button>
      )}
    </div>
  );
}

export function Aparencia({ user, aoAbrirPacotes }: { user: User; aoAbrirPacotes: () => void }) {
  const t = useT();
  const [dados, setDados] = useState<LojaDados | null>(null);
  const [aba, setAba] = useState<Aba>('cor');
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    void api<LojaDados>('/api/loja')
      .then(setDados)
      .catch((e) => setErro((e as Error).message));
  }, []);

  async function vestir(item: ItemDaLoja) {
    if (!dados) return;
    setErro(null);
    // Insígnia não se veste por aqui: ela vai para a vitrine, onde a pessoa escolhe quais e em que ordem.
    const campo = { cor: 'nameColor', fundo: 'banner', moldura: 'moldura' }[item.tipo as 'cor' | 'fundo' | 'moldura'];
    const jaEstava = dados.vestindo[item.tipo as 'cor' | 'fundo' | 'moldura'] === item.codigo;
    try {
      const atualizado = await api<User>('/api/me/profile', {
        method: 'PUT',
        body: {
          nameColor: dados.vestindo.cor,
          banner: dados.vestindo.fundo,
          moldura: dados.vestindo.moldura,
          // Clicar no que já está em uso tira: é o jeito de voltar ao padrão sem procurar o "sem nada".
          [campo]: jaEstava ? null : item.codigo,
        },
      });
      setDados({
        ...dados,
        vestindo: {
          ...dados.vestindo,
          cor: atualizado.nameColor,
          fundo: atualizado.banner,
          moldura: atualizado.moldura,
        },
      });
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  if (erro && !dados) return <p className="form-error">{erro}</p>;
  if (!dados) return <p className="settings-hint">{t('Carregando…')}</p>;

  const doTipo = dados.itens.filter((item) => item.tipo === aba);
  const vestidoAgora = (item: ItemDaLoja) =>
    item.tipo === 'insignia'
      ? dados.vestindo.insignias.includes(item.codigo)
      : dados.vestindo[item.tipo as 'cor' | 'fundo' | 'moldura'] === item.codigo;

  return (
    <>
      <h2>
        <Sparkles size={20} aria-hidden="true" /> {t('Aparência')}
      </h2>
      <p className="settings-hint">{t('Tudo aqui é de graça. Escolha o que quiser, troque quando quiser.')}</p>

      <CorDoSyden />

      {/* A PRÉVIA FICA NO ALTO E NÃO SE MEXE DE LUGAR enquanto você experimenta: é o ponto de
          referência. Ela usa o estado do servidor (o diretório), e não o desta tela, porque é
          exatamente assim que os outros vão te ver. */}
      <div className={`perfil-previa ${classeDoFundo(dados.vestindo.fundo ?? 'nenhum')}`}>
        <Avatar name={user.username} userId={user.id} size={56} />
        <strong data-cor={corDoNome(dados.vestindo.cor ?? 'padrao')}>{user.username}</strong>
      </div>
      <p className="settings-hint">{t('É assim que os outros veem você na lista e nas conversas.')}</p>

      <div className="tab-row" role="tablist" aria-label={t('Tipos de cosmético')}>
        {ABAS.map((opcao) => (
          <button
            key={opcao.tipo}
            role="tab"
            aria-selected={aba === opcao.tipo}
            className={`tab${aba === opcao.tipo ? ' active' : ''}`}
            onClick={() => setAba(opcao.tipo)}
          >
            {t(opcao.nome)}
          </button>
        ))}
      </div>

      {erro && <p className="form-error">{erro}</p>}

      {aba === 'insignia' && (
        <p className="settings-hint">
          {t('Insígnias não se compram: vêm de ter feito alguma coisa. Quais delas aparecem no seu perfil, e em que ordem, você escolhe mais abaixo, em Minha conta.')}
        </p>
      )}

      {aba !== 'pacotes' && (
        <div className="loja-grade">
          {doTipo.map((item) => (
            <Cartao key={item.codigo} item={item} vestido={vestidoAgora(item)} onVestir={(i) => void vestir(i)} />
          ))}
        </div>
      )}

      {aba === 'pacotes' && (
        <section className="loja-pacotes">
          <h3>
            <Music size={18} aria-hidden="true" /> {t('Pacotes de sons e de emojis')}
          </h3>
          <p className="settings-hint">
            {t(
              'Também de graça, e também trocáveis quando quiser. Ficam nas configurações da comunidade, porque valem para a comunidade inteira e não só para você.',
            )}
          </p>
          <button type="button" className="btn-secondary" onClick={aoAbrirPacotes}>
            {t('Abrir os pacotes')}
          </button>
        </section>
      )}

      {/* NÃO SE PEDE DINHEIRO AQUI, em lugar nenhum. Quem quiser ajudar a pagar o servidor encontra
          isso numa aba do site, fora do app. Duas razões: dinheiro no meio de uma tela onde tudo é
          de graça faz a pessoa procurar o que está trancado — e não há nada trancado; e Apple,
          Google e Microsoft cobram porcentagem sobre o que é vendido dentro do app. Sem pedido
          nenhum, não há o que discutir. */}
    </>
  );
}
