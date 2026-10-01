import { Check, Gift, Lock, Music, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from './api';
import { acharInsignia } from './insignias';
import { Insignia } from './Medalha';
import { acharVisual, COMO_SE_GANHA } from './loja';

import { MobileBackButton } from './MobileBackButton';
import type { ItemDaLoja, Loja as LojaDados, TipoDeItem, User } from './types';
import { chave, useT } from './i18n';

// A loja de cosméticos do Syden. **Tudo o que está nela é de graça.**
//
// Não é um detalhe de implementação, é o modelo do produto: a filosofia é a do WinRAR — o programa
// funciona inteiro, sem cobrar, sem travar, sem "versão pro". Nada aqui compra vantagem: é cor de nome,
// fundo de perfil e anel em volta do avatar.
//
// E NÃO SE PEDE DINHEIRO NESTA TELA. Quem quiser ajudar a pagar o servidor encontra isso numa aba do
// site, fora do app. Aqui os itens só se dividem entre os que já são seus e os que se conquistam usando
// o Syden — os trancados aparecem marcados, em vez de escondidos: mostrar o que existe é honesto,
// fingir que não existe e um dia aparecer do nada, não.

// 'pacotes' NÃO É UM TIPO DE ITEM, é uma aba que leva para outro lugar — por isso ela entra aqui
// como um à parte, e não na lista de tipos. O bloco dos pacotes ficava fora do `if` da aba e
// aparecia embaixo das quatro, repetido, como se fosse rodapé.
type Aba = TipoDeItem | 'pacotes';

const ABAS: { tipo: Aba; nome: string }[] = [
  { tipo: 'cor', nome: chave('Cor do nome') },
  { tipo: 'fundo', nome: chave('Fundo do perfil') },
  { tipo: 'moldura', nome: chave('Moldura do avatar') },
  { tipo: 'insignia', nome: chave('Insígnias') },
  { tipo: 'pacotes', nome: chave('Pacotes') },
];

/** O quadradinho que mostra como o item fica, sem precisar vestir para descobrir. */
function Amostra({ item }: { item: ItemDaLoja }) {
  if (item.tipo === 'cor') {
    return (
      <span className="loja-amostra cor" data-cor={item.codigo === 'padrao' ? undefined : item.codigo}>
        Aa
      </span>
    );
  }
  if (item.tipo === 'fundo') return <span className={`loja-amostra fundo fundo-${item.codigo}`} />;
  if (item.tipo === 'moldura') {
    // A AMOSTRA USA A MESMA MARCAÇÃO DO AVATAR DE VERDADE, e isso conserta um defeito: ela usava
    // `.loja-amostra.moldura-ouro`, um seletor que NÃO EXISTE na folha de estilo. Os dez anéis moram
    // em `.avatar[data-moldura='…']::after` e em lugar nenhum mais. Resultado: as dez molduras
    // apareciam como a mesma bola escura, e só dava para saber o que cada uma era vestindo-a. Uma
    // amostra que não mostra o item é pior do que amostra nenhuma.
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

function Cartao({
  item,
  vestido,
  onVestir,
}: {
  item: ItemDaLoja;
  vestido: boolean;
  onVestir: (item: ItemDaLoja) => void;
}) {
  const t = useT();
  const visual = item.tipo === 'insignia' ? acharInsignia(item.codigo) : acharVisual(item.tipo, item.codigo);
  // Código que o servidor conhece e este site ainda não: some, em vez de virar um quadro vazio.
  if (!visual) return null;

  const trancado = !item.tenho;
  return (
    <div className={`loja-cartao${vestido ? ' vestido' : ''}${trancado ? ' trancado' : ''}`}>
      <Amostra item={item} />
      <div className="loja-cartao-texto">
        <strong>{visual.nome}</strong>
        <small>{visual.descricao}</small>
        {item.comoSeGanha === 'conquista' && (
          <span className="loja-etiqueta conquista">
            <Gift size={12} aria-hidden="true" /> {COMO_SE_GANHA.conquista}
          </span>
        )}
      </div>
      {vestido ? (
        <span className="loja-vestido" aria-label="Em uso">
          <Check size={16} /> Em uso
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

// A LOJA NÃO PEDE DINHEIRO, EM LUGAR NENHUM.
//
// Aqui havia um bloco de contribuição que aparecia no navegador e se escondia no aplicativo instalado.
// Saiu inteiro: a contribuição agora mora numa aba do site (web/site/contribuir.html), e só lá.
//
// Duas razões. A primeira é de produto: dinheiro no meio de uma loja onde tudo é de graça faz a pessoa
// procurar o que está trancado — e não há nada trancado, então a pergunta não devia nascer. A segunda é
// de regra de loja de aplicativo: Apple, Google e Microsoft cobram porcentagem sobre o que é vendido
// dentro do app, e algumas exigem que o pagamento passe por elas. Sem nenhum pedido de dinheiro aqui,
// não há o que discutir — e discutir custaria uma reprovação.

export function TelaDaLoja({
  user,
  aoAbrirPacotes,
  aoVoltar,
}: {
  user: User;
  /** Os pacotes de som e de emoji moram nas configurações; daqui só se aponta para lá. */
  aoAbrirPacotes: () => void;
  aoVoltar: () => void;
}) {
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
      // Quem avisa o resto do app é o servidor, pelo "user:updated" que o diretório escuta — por isso
      // o nome muda de cor na lista de membros sem esta tela precisar contar nada a ninguém.
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
  if (!dados) return <p className="settings-hint">{t('Carregando a loja…')}</p>;

  const doTipo = dados.itens.filter((item) => item.tipo === aba);
  const vestidoAgora = (item: ItemDaLoja) =>
    item.tipo === 'insignia'
      ? dados.vestindo.insignias.includes(item.codigo)
      : dados.vestindo[item.tipo as 'cor' | 'fundo' | 'moldura'] === item.codigo;

  return (
    <div className="loja">
      <header className="loja-cabecalho">
        <MobileBackButton onBack={aoVoltar} />
        <h2>
          <Sparkles size={22} aria-hidden="true" /> {t('Loja')}
        </h2>
        <p>{t('Tudo aqui é de graça. Escolha o que quiser, troque quando quiser.')}</p>
      </header>

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
          Insígnias não se compram: vêm de ter feito alguma coisa. Quais delas aparecem no seu perfil, e em que ordem,
          você escolhe em Configurações.
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

      <p className="settings-hint loja-rodape">
        Enfeitando o perfil de <strong>{user.username}</strong>.
      </p>
    </div>
  );
}
