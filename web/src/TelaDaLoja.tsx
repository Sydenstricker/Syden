import { Check, Gift, Heart, Lock, Music, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from './api';
import { acharInsignia } from './insignias';
import { Insignia } from './Medalha';
import { acharVisual, COMO_SE_GANHA, NIVEIS, nomeDoNivel } from './loja';
import { MobileBackButton } from './MobileBackButton';
import type { ItemDaLoja, Loja as LojaDados, TipoDeItem, User } from './types';

// A loja de cosméticos do Syden. **Tudo o que está nela é de graça.**
//
// Não é um detalhe de implementação, é o modelo do produto: a filosofia é a do WinRAR — o programa
// funciona inteiro, sem cobrar, sem travar, sem "versão pro". Quem quiser ajudar a pagar o servidor
// contribui porque quis, e ganha enfeites por isso. Nada aqui compra vantagem: é cor de nome, fundo de
// perfil e anel em volta do avatar.
//
// Os itens de contribuinte aparecem desde já, marcados e sem esconder que ainda não dá para obtê-los.
// Mostrar o que vai existir é honesto; fingir que não existe e um dia aparecer do nada, não.

const ABAS: { tipo: TipoDeItem; nome: string }[] = [
  { tipo: 'cor', nome: 'Cor do nome' },
  { tipo: 'fundo', nome: 'Fundo do perfil' },
  { tipo: 'moldura', nome: 'Moldura do avatar' },
  { tipo: 'insignia', nome: 'Insígnias' },
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
    return (
      <span className={`loja-amostra moldura moldura-${item.codigo}`}>
        <span className="loja-amostra-avatar" />
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
        {item.comoSeGanha === 'contribuinte' && (
          <span className="loja-etiqueta contribuinte">
            <Heart size={12} aria-hidden="true" /> {nomeDoNivel(item.nivel)}
          </span>
        )}
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
        <span className="loja-trancado" aria-label="Você ainda não tem este item">
          <Lock size={16} />
        </span>
      ) : (
        <button type="button" className="btn-secondary" onClick={() => onVestir(item)}>
          Usar
        </button>
      )}
    </div>
  );
}

/** A explicação de por que existe dinheiro numa loja em que tudo é de graça. */
function Contribuir() {
  return (
    <section className="loja-contribuir">
      <h3>
        <Heart size={18} aria-hidden="true" /> Ajudar a pagar o servidor
      </h3>
      <p>
        O Syden é de graça e vai continuar sendo — inteiro, sem travar nada, sem "versão pro". Isto aqui não é
        assinatura: é uma forma de dividir a conta do servidor com quem usa e quiser ajudar. Nada do que está abaixo
        muda o que você pode fazer no Syden. São enfeites.
      </p>
      <ul className="loja-niveis">
        {NIVEIS.map((nivel) => (
          <li key={nivel.nivel}>
            <strong>{nivel.preco}</strong>
            <span>{nivel.nome}</span>
            <small>por mês</small>
          </li>
        ))}
      </ul>
      <p className="settings-hint">
        Ainda não dá para contribuir: falta ligar o Syden a um meio de pagamento, e isso tem burocracia (nota, imposto,
        regra das lojas de aplicativo). Os enfeites já estão aqui para você ver o que vai existir.
      </p>
    </section>
  );
}

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
  const [dados, setDados] = useState<LojaDados | null>(null);
  const [aba, setAba] = useState<TipoDeItem>('cor');
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
  if (!dados) return <p className="settings-hint">Carregando a loja…</p>;

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
          <Sparkles size={22} aria-hidden="true" /> Loja
        </h2>
        <p>Tudo aqui é de graça. Escolha o que quiser, troque quando quiser.</p>
      </header>

      <div className="tab-row" role="tablist" aria-label="Tipos de cosmético">
        {ABAS.map((opcao) => (
          <button
            key={opcao.tipo}
            role="tab"
            aria-selected={aba === opcao.tipo}
            className={`tab${aba === opcao.tipo ? ' active' : ''}`}
            onClick={() => setAba(opcao.tipo)}
          >
            {opcao.nome}
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

      <div className="loja-grade">
        {doTipo.map((item) => (
          <Cartao key={item.codigo} item={item} vestido={vestidoAgora(item)} onVestir={(i) => void vestir(i)} />
        ))}
      </div>

      <section className="loja-pacotes">
        <h3>
          <Music size={18} aria-hidden="true" /> Pacotes de sons e de emojis
        </h3>
        <p className="settings-hint">
          Também de graça, e também trocáveis quando quiser. Ficam nas configurações da comunidade, porque valem
          para a comunidade inteira e não só para você.
        </p>
        <button type="button" className="btn-secondary" onClick={aoAbrirPacotes}>
          Abrir os pacotes
        </button>
      </section>

      <Contribuir />
      <p className="settings-hint loja-rodape">
        Enfeitando o perfil de <strong>{user.username}</strong>.
      </p>
    </div>
  );
}
