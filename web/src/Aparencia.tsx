import { Check, Gift, Lock, Music, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api, ApiError } from './api';
import { Avatar } from './Avatar';
import { chave, useT } from './i18n';
import { acharInsignia } from './insignias';
import { Insignia } from './Medalha';
import { acharVisual, COMO_SE_GANHA } from './guardaRoupa';
import { aplicarCorDeDestaque, corLegivel, destaqueDaPaleta } from './corDeDestaque';
import { escolherPaleta, PALETAS } from './theme';
import { classeDoFundo, corDoNome, efeitoDoNome, letraDoNome } from './profileStyles';
import { FONTES_DA_COMUNIDADE, fonteCobre } from './fontesDaComunidade';
import { algarismos } from './algarismos';
import { updateSettings, useSettings } from './settings';
import type { GuardaRoupa, ItemDoGuardaRoupa, TipoDeItem, User } from './types';

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
function Amostra({ item, corVestida }: { item: ItemDoGuardaRoupa; corVestida?: string }) {
  // AS LETRAS NUM SPAN PRÓPRIO, E NÃO NO QUADRADO. O prisma e o arco-íris pintam com um gradiente
  // recortado pelo texto (`background-clip: text`), e o quadrado tem o fundo escuro dele numa regra
  // mais específica: no mesmo elemento, o fundo escuro vencia o gradiente e era ELE que ficava
  // recortado nas letras — escuro sobre escuro, um quadro vazio.
  if (item.tipo === 'cor') {
    return (
      <span className="guarda-roupa-amostra cor">
        <span data-cor={corDoNome(item.codigo)}>Aa</span>
      </span>
    );
  }
  // A letra, no "Aa" de sempre: o cartão diz o nome da fonte, e a amostra mostra o desenho dela.
  if (item.tipo === 'letra') {
    return (
      <span className="guarda-roupa-amostra cor">
        <span data-cor={corVestida} style={{ fontFamily: letraDoNome(item.codigo) }}>
          Aa
        </span>
      </span>
    );
  }
  // O efeito é mostrado na cor que a pessoa já veste: é assim que ele vai ficar NELA.
  if (item.tipo === 'efeito') {
    return (
      <span className="guarda-roupa-amostra cor">
        <span data-cor={corVestida} data-efeito={efeitoDoNome(item.codigo)}>
          Aa
        </span>
      </span>
    );
  }
  if (item.tipo === 'fundo') return <span className={`guarda-roupa-amostra fundo ${classeDoFundo(item.codigo)}`} />;
  if (item.tipo === 'moldura') {
    // A MESMA MARCAÇÃO DO AVATAR DE VERDADE: os anéis moram em `.avatar[data-moldura]::after` e em
    // lugar nenhum mais. Uma amostra que não seja um `.avatar` não desenha moldura alguma — foi
    // assim que as dez apareceram como a mesma bola escura.
    return (
      <span className="guarda-roupa-amostra">
        <span className="avatar guarda-roupa-amostra-avatar" data-moldura={item.codigo === 'nenhuma' ? undefined : item.codigo} />
      </span>
    );
  }
  const insignia = acharInsignia(item.codigo);
  return (
    <span className="guarda-roupa-amostra insignia">
      {insignia && <Insignia arte={insignia.arte} titulo={insignia.nome} moldura={insignia.moldura} tamanho={40} />}
    </span>
  );
}

function Cartao({
  item,
  vestido,
  corVestida,
  onVestir,
}: {
  item: ItemDoGuardaRoupa;
  vestido: boolean;
  corVestida?: string;
  onVestir: (item: ItemDoGuardaRoupa) => void;
}) {
  const t = useT();
  const visual = item.tipo === 'insignia' ? acharInsignia(item.codigo) : acharVisual(item.tipo, item.codigo);
  // Código que o servidor conhece e este site ainda não: some, em vez de virar um quadro vazio.
  if (!visual) return null;

  const trancado = !item.tenho;
  return (
    <div className={`guarda-roupa-cartao${vestido ? ' vestido' : ''}${trancado ? ' trancado' : ''}`}>
      <Amostra item={item} corVestida={corVestida} />
      <div className="guarda-roupa-cartao-texto">
        <strong>{t(visual.nome)}</strong>
        {visual.descricao && <small>{t(visual.descricao)}</small>}
        {item.comoSeGanha === 'conquista' && (
          <span className="guarda-roupa-etiqueta conquista">
            <Gift size={12} aria-hidden="true" /> {t(COMO_SE_GANHA.conquista)}
          </span>
        )}
      </div>
      {vestido ? (
        <span className="guarda-roupa-vestido" aria-label={t('Em uso')}>
          <Check size={16} /> {t('Em uso')}
        </span>
      ) : trancado ? (
        <span className="guarda-roupa-trancado" aria-label={t('Você ainda não tem este item')}>
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
  { tipo: 'efeito', nome: chave('Efeito do nome') },
  { tipo: 'letra', nome: chave('Letra do nome') },
  { tipo: 'insignia', nome: chave('Insígnias') },
  { tipo: 'pacotes', nome: chave('Pacotes') },
];

/**
 * A PALETA DO SYDEN: o conjunto de cores do tema escuro (fundos, texto e destaque), entre as que estão
 * em theme.ts. Uma delas é a de antes do rebrand — pedido de quem usa, para ninguém perder a cara do
 * Syden de que gostava.
 *
 * Fica ACIMA da cor de destaque porque é a escolha maior: a cor de destaque, se houver, vai por cima
 * de qualquer paleta. Como a cor, vale na hora e não tem botão de salvar.
 */
function PaletaDoSyden() {
  const t = useT();
  const settings = useSettings();
  return (
    <div className="paleta-do-syden">
      <div className="paleta-do-syden-opcoes" role="radiogroup" aria-label={t('Paleta de cores')}>
        {PALETAS.map((p) => (
          <button
            key={p.valor}
            type="button"
            role="radio"
            aria-checked={settings.paleta === p.valor}
            className={`paleta-do-syden-opcao${settings.paleta === p.valor ? ' escolhida' : ''}`}
            onClick={() => escolherPaleta(p.valor)}
          >
            {/* A amostra é um pedacinho do app: lateral, fundo, uma linha de texto e um botão. */}
            <span className="paleta-amostra" aria-hidden="true" style={{ background: p.amostra[0] }}>
              <span className="paleta-amostra-lateral" style={{ background: p.amostra[1] }} />
              <span className="paleta-amostra-texto" style={{ background: p.amostra[2] }} />
              <span className="paleta-amostra-botao" style={{ background: p.amostra[3] }} />
            </span>
            <strong>{t(p.nome)}</strong>
            <small>{t(p.descricao)}</small>
            {settings.paleta === p.valor && <Check size={16} className="paleta-do-syden-marca" aria-hidden="true" />}
          </button>
        ))}
      </div>
      {settings.theme === 'light' && (
        <p className="settings-hint">{t('A paleta vale no tema escuro. Com o sol ligado, o Syden usa o tema claro.')}</p>
      )}
    </div>
  );
}

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
  // Sem cor própria, o seletor abre no destaque da paleta em uso (o âmbar na D4, o azul na Clássica).
  const escolhida = settings.corDeDestaque ?? destaqueDaPaleta();
  // Sem cor própria, a prévia é a da paleta como ela está; só a cor escolhida é escurecida para o branco.
  const naTela = settings.corDeDestaque ? corLegivel(escolhida) : escolhida;

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

/**
 * A ROTA MUDOU DE NOME, E O SITE SOBE ANTES DO SERVIDOR.
 *
 * São dois caminhos de publicação independentes: o site sai sozinho no push, o servidor só quando
 * alguém roda o deploy na máquina. Entre um e outro existe uma janela — e nela um site novo pedindo
 * /api/guarda-roupa a um servidor antigo tomaria 404, e esta aba abriria com "Erro 404" em vez do
 * catálogo. Não é hipótese: hoje mesmo o servidor está atrás do site.
 *
 * Então pede o nome novo e, SÓ NO 404, tenta o velho. Qualquer outro erro sobe como erro, porque
 * sessão vencida e servidor fora do ar não se resolvem trocando o endereço.
 *
 * Isto sai quando o servidor estiver atualizado, junto com o apelido `/api/loja` do lado de lá.
 */
async function buscarOGuardaRoupa(): Promise<GuardaRoupa> {
  try {
    return await api<GuardaRoupa>('/api/guarda-roupa');
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return api<GuardaRoupa>('/api/loja');
    throw e;
  }
}

export function Aparencia({ user, aoAbrirPacotes }: { user: User; aoAbrirPacotes: () => void }) {
  const t = useT();
  const [dados, setDados] = useState<GuardaRoupa | null>(null);
  const [aba, setAba] = useState<Aba>('cor');
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    void buscarOGuardaRoupa()
      .then(setDados)
      .catch((e) => setErro((e as Error).message));
  }, []);

  async function vestir(item: ItemDoGuardaRoupa) {
    if (!dados) return;
    setErro(null);
    // Insígnia não se veste por aqui: ela vai para a vitrine, onde a pessoa escolhe quais e em que ordem.
    const campo = { cor: 'nameColor', fundo: 'banner', moldura: 'moldura', efeito: 'nameEffect', letra: 'nameFont' }[
      item.tipo as 'cor' | 'fundo' | 'moldura' | 'efeito' | 'letra'
    ];
    const jaEstava = dados.vestindo[item.tipo as 'cor' | 'fundo' | 'moldura' | 'efeito' | 'letra'] === item.codigo;
    try {
      const atualizado = await api<User>('/api/me/profile', {
        method: 'PUT',
        body: {
          nameColor: dados.vestindo.cor,
          banner: dados.vestindo.fundo,
          moldura: dados.vestindo.moldura,
          nameEffect: dados.vestindo.efeito,
          nameFont: dados.vestindo.letra ?? null,
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
          efeito: atualizado.nameEffect,
          letra: atualizado.nameFont ?? null,
        },
      });
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  if (erro && !dados) return <p className="form-error">{erro}</p>;
  if (!dados) return <p className="settings-hint">{t('Carregando…')}</p>;

  // A LETRA SÓ APARECE SE TEM AS LETRAS DO NOME — a mesma regra do nome da comunidade (ver
  // fontesDaComunidade.ts). A vestida aparece sempre: sumir com ela deixaria a pessoa sem como trocar.
  const cobreMeuNome = (item: ItemDoGuardaRoupa) => {
    if (item.tipo !== 'letra' || item.codigo === dados.vestindo.letra) return true;
    const fonte = FONTES_DA_COMUNIDADE.find((f) => 'letra-' + f.id === item.codigo);
    return !fonte || fonteCobre(fonte, user.username);
  };
  const doTipo = dados.itens.filter((item) => item.tipo === aba && cobreMeuNome(item));
  const escondidas = dados.itens.filter((item) => item.tipo === aba && !cobreMeuNome(item)).length;
  const vestidoAgora = (item: ItemDoGuardaRoupa) =>
    item.tipo === 'insignia'
      ? dados.vestindo.insignias.includes(item.codigo)
      : dados.vestindo[item.tipo as 'cor' | 'fundo' | 'moldura' | 'efeito' | 'letra'] === item.codigo;

  return (
    <>
      <h2>
        <Sparkles size={20} aria-hidden="true" /> {t('Aparência')}
      </h2>
      <p className="settings-hint">{t('Tudo aqui é de graça. Escolha o que quiser, troque quando quiser.')}</p>

      <PaletaDoSyden />
      <CorDoSyden />

      {/* A PRÉVIA FICA NO ALTO E NÃO SE MEXE DE LUGAR enquanto você experimenta: é o ponto de
          referência. Ela usa o estado do servidor (o diretório), e não o desta tela, porque é
          exatamente assim que os outros vão te ver. */}
      <div className={`perfil-previa ${classeDoFundo(dados.vestindo.fundo ?? 'nenhum')}`}>
        <Avatar name={user.username} userId={user.id} size={56} />
        <strong
          data-cor={corDoNome(dados.vestindo.cor ?? 'padrao')}
          data-efeito={efeitoDoNome(dados.vestindo.efeito)}
          style={{ fontFamily: letraDoNome(dados.vestindo.letra) }}
        >
          {user.username}
        </strong>
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

      {escondidas > 0 && (
        <p className="settings-hint">{t('Escondidas por não terem todas as letras deste nome: {n}', { n: algarismos(escondidas) })}</p>
      )}

      {aba !== 'pacotes' && (
        <div className="guarda-roupa-grade">
          {doTipo.map((item) => (
            <Cartao
              key={item.codigo}
              item={item}
              vestido={vestidoAgora(item)}
              corVestida={corDoNome(dados.vestindo.cor ?? 'padrao')}
              onVestir={(i) => void vestir(i)}
            />
          ))}
        </div>
      )}

      {aba === 'pacotes' && (
        <section className="guarda-roupa-pacotes">
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
