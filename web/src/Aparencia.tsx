import { Check, Gift, Lock, Music, Shirt, Sparkles, X } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { api, mediaUrl } from './api';
import { Avatar, enderecoDoCoelhoPronto, FotoDoAvatar } from './Avatar';
import { nomeDe, useDirectory } from './directory';
import { primeiraForma } from './minijogos';
import { CriadorDoCoelho } from './coelho/CriadorDoCoelho';
import { LinhaDoPersonagem, PixelGrande } from './personagemUi';
import { chave, useT } from './i18n';
import { acharInsignia } from './insignias';
import { Insignia } from './Medalha';
import { acharVisual, COMO_SE_GANHA } from './guardaRoupa';
import { aplicarCorDeDestaque, corLegivel, destaqueDaPaleta } from './corDeDestaque';
import { escolherPaleta, PALETAS } from './theme';
import { classeDoFundo, corDoNome, efeitoDoNome, letraDoNome } from './profileStyles';
import { FONTES_DA_COMUNIDADE, fonteCobre } from './fontesDaComunidade';
import { algarismos } from './algarismos';
import { avisarQuartoMudou } from './quartoMudou';
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
//
// E A TELA GANHOU DUAS ORELHAS DE FICHÁRIO (09/11/2026, pedido e desenho dele): "uma coisa é mudar a aparência do
// aplicativo Syden, outra é mudar o nosso avatar". A orelha do APLICATIVO tem a paleta e a cor de destaque; a do AVATAR,
// que o guarda-roupa do quarto abre, tem o personagem com as setas, o bicho do quarto e os enfeites do perfil.

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
  // O CARTÃO INTEIRO É O BOTÃO (13/10/2026, pedido do Sydenstricker: "clicar no card já deveria aplicar"). Havia um
  // "Usar" dentro de cada um. O que já está em uso não faz nada ao clicar: tirá-lo é escolher outro, ou o "sem nada".
  const vestivel = !trancado && !vestido;
  return (
    <div
      className={`guarda-roupa-cartao${vestido ? ' vestido' : ''}${trancado ? ' trancado' : ''}${vestivel ? ' vestivel' : ''}`}
      role={vestivel ? 'button' : undefined}
      tabIndex={vestivel ? 0 : undefined}
      onClick={vestivel ? () => onVestir(item) : undefined}
      onKeyDown={
        vestivel
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onVestir(item);
              }
            }
          : undefined
      }
    >
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
      ) : (
        trancado && (
          <span className="guarda-roupa-trancado" aria-label={t('Você ainda não tem este item')}>
            <Lock size={16} />
          </span>
        )
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

type Vestivel = 'cor' | 'fundo' | 'moldura' | 'efeito' | 'letra';

/**
 * O guarda-roupa da pessoa e o jeito de vestir um item. É o MESMO para o Guarda-roupa e para o lápis do
 * cartão de perfil (ProfileCard.tsx): dois caminhos para a mesma escolha, e um só código decidindo o
 * que ela faz — senão um dia os dois lugares discordariam sobre o que "clicar no que está em uso" faz.
 */
export function useGuardaRoupa() {
  const [dados, setDados] = useState<GuardaRoupa | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    void api<GuardaRoupa>('/api/guarda-roupa')
      .then(setDados)
      .catch((e) => setErro((e as Error).message));
  }, []);

  async function vestir(item: ItemDoGuardaRoupa) {
    if (!dados) return;
    setErro(null);
    // Insígnia não se veste por aqui: ela vai para a vitrine, onde a pessoa escolhe quais e em que ordem.
    const campo = { cor: 'nameColor', fundo: 'banner', moldura: 'moldura', efeito: 'nameEffect', letra: 'nameFont' }[
      item.tipo as Vestivel
    ];
    const jaEstava = dados.vestindo[item.tipo as Vestivel] === item.codigo;
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

  return { dados, erro, vestir };
}

/**
 * A LETRA SÓ APARECE SE TEM AS LETRAS DO NOME — a mesma regra do nome da comunidade (ver
 * fontesDaComunidade.ts). A vestida aparece sempre: sumir com ela deixaria a pessoa sem como trocar.
 */
function cobreONome(item: ItemDoGuardaRoupa, dados: GuardaRoupa, nome: string) {
  if (item.tipo !== 'letra' || item.codigo === dados.vestindo.letra) return true;
  const fonte = FONTES_DA_COMUNIDADE.find((f) => 'letra-' + f.id === item.codigo);
  return !fonte || fonteCobre(fonte, nome);
}

function estaVestido(item: ItemDoGuardaRoupa, dados: GuardaRoupa) {
  return item.tipo === 'insignia'
    ? dados.vestindo.insignias.includes(item.codigo)
    : dados.vestindo[item.tipo as Vestivel] === item.codigo;
}

const ABAS_DO_CARTAO = ABAS.filter((aba) => aba.tipo !== 'insignia' && aba.tipo !== 'pacotes');

/**
 * A APARÊNCIA DENTRO DO CARTÃO DE PERFIL, pelo lápis (decisão do Sydenstricker, 11/10/2026: "dois
 * caminhos" — o Guarda-roupa de sempre, e o cartão para quem se vê numa comunidade e quer mudar ali).
 *
 * Compacta porque o cartão tem 300 px: só as amostras, com o nome no título, e só o que a pessoa já
 * tem — trancado é catálogo, e catálogo é o Guarda-roupa. Ficam de fora as insígnias (a ordem delas se
 * escolhe em Minha conta), os pacotes e a paleta, que não aparecem no cartão. O próprio cartão é a
 * prévia: ele lê a pessoa do diretório, que se atualiza ao vestir.
 */
export function EscolhasDoCartao({ nome, aoAbrirGuardaRoupa }: { nome: string; aoAbrirGuardaRoupa: () => void }) {
  const t = useT();
  const { dados, erro, vestir } = useGuardaRoupa();
  // A aba do COELHO vem primeiro (13/10/2026: ele procurou trocar o coelho pelo lápis e não achou; só havia em
  // Configurações → Minha conta). Ela troca o avatar pronto, e não um cosmético do guarda-roupa.
  const [aba, setAba] = useState<Vestivel | 'coelho'>('coelho');
  const { members } = useDirectory();
  const [coelho, setCoelho] = useState<number | null | undefined>(undefined);
  const coelhoAtual = coelho !== undefined ? coelho : ([...members.values()].find((m) => m.username === nome)?.avatarPronto ?? null);
  const [erroDoCoelho, setErroDoCoelho] = useState<string | null>(null);
  async function escolherCoelho(numero: number) {
    setErroDoCoelho(null);
    try {
      await api('/api/me/avatar-pronto', { method: 'PUT', body: { numero } });
      setCoelho(numero);
    } catch (e) {
      setErroDoCoelho((e as Error).message);
    }
  }

  if (erro && !dados) return <p className="form-error small">{erro}</p>;
  if (!dados) return <p className="settings-hint">{t('Carregando…')}</p>;

  const doTipo = dados.itens.filter((item) => item.tipo === aba && item.tenho && cobreONome(item, dados, nome));
  const corVestida = corDoNome(dados.vestindo.cor ?? 'padrao');

  return (
    <div className="perfil-escolhas">
      <div className="perfil-escolhas-abas" role="tablist" aria-label={t('Tipos de cosmético')}>
        <button type="button" role="tab" aria-selected={aba === 'coelho'} className={aba === 'coelho' ? 'escolhida' : ''} onClick={() => setAba('coelho')}>
          {primeiraForma(t('Coelho'))}
        </button>
        {ABAS_DO_CARTAO.map((opcao) => (
          <button
            key={opcao.tipo}
            type="button"
            role="tab"
            aria-selected={aba === opcao.tipo}
            className={aba === opcao.tipo ? 'escolhida' : ''}
            onClick={() => setAba(opcao.tipo as Vestivel)}
          >
            {t(opcao.nome)}
          </button>
        ))}
      </div>
      {erro && <p className="form-error small">{erro}</p>}
      {aba === 'coelho' && erroDoCoelho && <p className="form-error small">{erroDoCoelho}</p>}
      <div className="perfil-escolhas-grade">
        {aba === 'coelho' &&
          Array.from({ length: 16 }, (_, i) => i + 1).map((numero) => (
            <button
              key={numero}
              type="button"
              className={`perfil-escolha${coelhoAtual === numero ? ' vestido' : ''}`}
              aria-pressed={coelhoAtual === numero}
              title={t('Usar este coelho')}
              aria-label={t('Usar este coelho')}
              onClick={() => void escolherCoelho(numero)}
            >
              <img className="perfil-escolha-coelho" src={enderecoDoCoelhoPronto(numero)} alt="" loading="lazy" />
            </button>
          ))}
        {doTipo.map((item) => {
          const visual = acharVisual(item.tipo, item.codigo);
          if (!visual) return null;
          const vestido = estaVestido(item, dados);
          return (
            <button
              key={item.codigo}
              type="button"
              className={`perfil-escolha${vestido ? ' vestido' : ''}`}
              aria-pressed={vestido}
              title={t(visual.nome)}
              aria-label={t(visual.nome)}
              onClick={() => void vestir(item)}
            >
              <Amostra item={item} corVestida={corVestida} />
            </button>
          );
        })}
      </div>
      <button type="button" className="link-button perfil-escolhas-mais" onClick={aoAbrirGuardaRoupa}>
        <Shirt size={14} aria-hidden="true" /> {t('Guarda-roupa')}
      </button>
    </div>
  );
}

/**
 * AS ORELHAS DO FICHÁRIO (09/11/2026, o desenho dele): a Aparência é UMA tela com duas orelhas, "uma aparência para o
 * aplicativo, outra para o avatar". O Aplicativo é o que muda o Syden na tela de quem usa (a paleta e a cor de destaque);
 * o Avatar é a cara da PESSOA para os outros (o coelho, o bicho do quarto e os enfeites do perfil), e é o que o
 * guarda-roupa do quarto abre: o guarda-roupa É a orelha do Avatar.
 */
export type OrelhaDaAparencia = 'aplicativo' | 'avatar';

const ORELHAS: { id: OrelhaDaAparencia; nome: string }[] = [
  { id: 'aplicativo', nome: chave('Aplicativo') },
  { id: 'avatar', nome: chave('Avatar') },
];

export function Aparencia({
  user,
  orelha,
  aoTrocarOrelha,
  editorDaFoto,
  aoAbrirPacotes,
}: {
  user: User;
  orelha: OrelhaDaAparencia;
  aoTrocarOrelha: (orelha: OrelhaDaAparencia) => void;
  /** O envio de foto e GIF (SettingsModal.tsx: o recorte e os botões de arquivo moram lá). */
  editorDaFoto: ReactNode;
  aoAbrirPacotes: () => void;
}) {
  const t = useT();
  const botoes = useRef<(HTMLButtonElement | null)[]>([]);

  // O teclado das abas (o padrão do WAI-ARIA): setas, Home e End andam de orelha em orelha e já abrem a folha.
  function teclado(e: KeyboardEvent<HTMLDivElement>) {
    const i = ORELHAS.findIndex((o) => o.id === orelha);
    const rtl = getComputedStyle(e.currentTarget).direction === 'rtl';
    const direita = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    const passo = rtl ? -direita : direita;
    const proxima = e.key === 'Home' ? 0 : e.key === 'End' ? ORELHAS.length - 1 : passo ? (i + passo + ORELHAS.length) % ORELHAS.length : -1;
    if (proxima < 0) return;
    e.preventDefault();
    aoTrocarOrelha(ORELHAS[proxima].id);
    botoes.current[proxima]?.focus();
  }

  return (
    <>
      <h2>
        <Sparkles size={20} aria-hidden="true" /> {t('Aparência')}
      </h2>
      <div className="aparencia-fichario">
        <div className="aparencia-fichario-orelhas" role="tablist" aria-label={t('Aparência')} onKeyDown={teclado}>
          {ORELHAS.map((o, i) => (
            <button
              key={o.id}
              ref={(b) => {
                botoes.current[i] = b;
              }}
              type="button"
              role="tab"
              id={'orelha-' + o.id}
              aria-selected={orelha === o.id}
              aria-controls={'folha-' + o.id}
              tabIndex={orelha === o.id ? 0 : -1}
              className={`aparencia-fichario-orelha aparencia-fichario-orelha-${o.id}${orelha === o.id ? ' aberta' : ''}`}
              onClick={() => aoTrocarOrelha(o.id)}
            >
              {o.id === 'aplicativo' ? <Sparkles size={16} aria-hidden="true" /> : <Shirt size={16} aria-hidden="true" />} {t(o.nome)}
            </button>
          ))}
        </div>
        <div className={`aparencia-fichario-folha aparencia-fichario-folha-${orelha}`} role="tabpanel" id={'folha-' + orelha} aria-labelledby={'orelha-' + orelha}>
          {orelha === 'aplicativo' ? (
            <>
              <PaletaDoSyden />
              <CorDoSyden />
            </>
          ) : (
            <FolhaDoAvatar user={user} editorDaFoto={editorDaFoto} aoAbrirPacotes={aoAbrirPacotes} />
          )}
        </div>
      </div>
    </>
  );
}

/** Os bichos do quarto (cores.pet na arrumação; a página do quarto conhece os mesmos). 'nenhum' é guardado. */
const BICHOS = ['gato', 'nenhum'] as const;
type Bicho = (typeof BICHOS)[number];
const FIGURA_DO_BICHO: Record<Bicho, string | null> = { gato: `${import.meta.env.BASE_URL}guarda-roupa/gato-sentado.png`, nenhum: null };
const NOME_DO_BICHO: Record<Bicho, string> = { gato: chave('Gato'), nenhum: chave('Sem bicho') };
const NOME_DO_PET_MAXIMO = 20; // o mesmo do servidor (quarto.ts)

/**
 * A FOLHA DO AVATAR (o desenho dele): o personagem grande com as setas de cada atributo; embaixo, o bicho do quarto com as
 * setas e o nome; a foto como opção recolhida; e, por último, os enfeites do perfil (o nome, o fundo, a moldura…).
 */
function FolhaDoAvatar({ user, editorDaFoto, aoAbrirPacotes }: { user: User; editorDaFoto: ReactNode; aoAbrirPacotes: () => void }) {
  const t = useT();
  const { members } = useDirectory();
  const eu = members.get(user.id);
  // O AVATAR QUE ESTÁ VALENDO (o do servidor, pelo diretório): uma foto (ou GIF), um coelho pronto, o coelho montado, ou nada.
  const atualPronto = eu?.avatarPronto ?? null;
  const atualFoto = (eu?.avatarVersion ?? null) !== null;
  const [erro, setErro] = useState<string | null>(null);

  // O BICHO DO QUARTO mora na arrumação do quarto (cores.pet e nomeDoPet), e muda por PUT /api/quarto/pet.
  const [bicho, setBicho] = useState<Bicho | null>(null);
  const [nomeGuardado, setNomeGuardado] = useState('');
  const [nome, setNome] = useState('');
  const [salvo, setSalvo] = useState(false);
  useEffect(() => {
    void api<{ arrumacao: { cores?: Record<string, string>; nomeDoPet?: string } | null }>('/api/quarto')
      .then(({ arrumacao }) => {
        const pet = arrumacao?.cores?.pet;
        setBicho(pet === 'nenhum' ? 'nenhum' : 'gato');
        setNome(arrumacao?.nomeDoPet ?? '');
        setNomeGuardado(arrumacao?.nomeDoPet ?? '');
      })
      .catch(() => setBicho('gato'));
  }, []);

  async function guardarBicho(mudanca: { pet?: Bicho; nome?: string }) {
    setErro(null);
    setSalvo(false);
    try {
      const r = await api<{ pet: string; nome: string }>('/api/quarto/pet', { method: 'PUT', body: mudanca });
      setBicho(r.pet === 'nenhum' ? 'nenhum' : 'gato');
      setNome(r.nome);
      setNomeGuardado(r.nome);
      if (mudanca.nome !== undefined) setSalvo(true);
      avisarQuartoMudou(); // o quarto aberto atrás das Configurações relê
    } catch (e) {
      setErro((e as Error).message);
    }
  }
  function trocarBicho(passo: number) {
    if (!bicho) return;
    const i = BICHOS.indexOf(bicho);
    const novo = BICHOS[(i + passo + BICHOS.length) % BICHOS.length];
    setBicho(novo);
    void guardarBicho({ pet: novo });
  }

  const figuraDoBicho = bicho ? FIGURA_DO_BICHO[bicho] : null;

  return (
    <>
      {/* O CRIADOR (10/11/2026): o coelho em camadas, com as 16 sugestões; ver coelho/CriadorDoCoelho.tsx */}
      <CriadorDoCoelho eu={eu} avatarAtual={<Avatar name={nomeDe(user)} userId={user.id} size={56} />} />

      <section className="personagem personagem-bicho">
        <div className="personagem-palco pequeno">{figuraDoBicho && <PixelGrande key={figuraDoBicho} src={figuraDoBicho} altura={96} />}</div>
        <div className="personagem-linhas">
          <LinhaDoPersonagem
            rotulo={t('Bicho do quarto')}
            valor={bicho ? t(NOME_DO_BICHO[bicho]) : '…'}
            anterior={() => trocarBicho(-1)}
            proximo={() => trocarBicho(1)}
            ocupado={!bicho}
          />
          {bicho === 'gato' && (
            <form
              className="personagem-nome"
              onSubmit={(e) => {
                e.preventDefault();
                void guardarBicho({ nome: nome.trim() });
              }}
            >
              <label>
                {t('Nome do bicho')}
                <input
                  value={nome}
                  maxLength={NOME_DO_PET_MAXIMO}
                  onChange={(e) => {
                    setNome(e.target.value);
                    setSalvo(false);
                  }}
                />
              </label>
              <button className="btn-secondary" disabled={nome.trim() === nomeGuardado}>
                {t('Salvar')}
              </button>
              {salvo && <span className="form-success">{t('Salvo.')}</span>}
            </form>
          )}
        </div>
      </section>
      {erro && <p className="form-error">{erro}</p>}

      {/* A FOTO (ou GIF) continua valendo, como opção recolhida: o coelho é o caminho principal do desenho dele. */}
      <details className="personagem-foto" open={atualFoto || undefined}>
        <summary>{t('Usar uma foto')}</summary>
        {editorDaFoto}
      </details>

      <AvataresAnteriores versao={eu?.avatarVersion ?? null} pronto={atualPronto} />

      <EnfeitesDoPerfil user={user} aoAbrirPacotes={aoAbrirPacotes} />
    </>
  );
}

interface AvatarAnterior {
  id: number;
  chave: string;
  animado: boolean;
}

/**
 * OS AVATARES ANTERIORES (09/11/2026, pedido dele: "se eu altero o avatar, não consigo escolher o antigo; no meu caso era um
 * GIF. Seria legal mostrar o histórico dos últimos 5 para resgatar"). As fotos e os GIFs que a pessoa trocou, até 5, o mais
 * novo primeiro (o servidor guarda; ver avatares_anteriores em db.ts). Clicar volta a ele, e o "×" o tira do histórico. O
 * GIF fica parado e anima sob o mouse, como nas listas. Sem nenhum, a seção não aparece.
 */
function AvataresAnteriores({ versao, pronto }: { versao: number | null; pronto: number | null }) {
  const t = useT();
  const [lista, setLista] = useState<AvatarAnterior[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  // relê quando o avatar muda (por aqui, pelo editor da foto ou pelas setas do coelho)
  useEffect(() => {
    let vivo = true;
    void api<AvatarAnterior[]>('/api/me/avatares-anteriores')
      .then((l) => vivo && setLista(l))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [versao, pronto]);

  async function voltar(id: number) {
    setErro(null);
    setOcupado(true);
    try {
      await api('/api/me/avatar/anterior', { method: 'PUT', body: { id } });
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setOcupado(false);
    }
  }
  async function tirar(id: number) {
    setErro(null);
    try {
      await api(`/api/me/avatares-anteriores/${id}`, { method: 'DELETE' });
      setLista((l) => l.filter((a) => a.id !== id));
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  if (!lista.length) return null;
  return (
    <section className="avatares-anteriores">
      <h3>{t('Avatares anteriores')}</h3>
      <ul>
        {lista.map((a) => (
          <li key={a.id}>
            <button className="avatar-anterior" disabled={ocupado} title={t('Voltar a este avatar')} aria-label={t('Voltar a este avatar')} onClick={() => void voltar(a.id)}>
              <span className="avatar">
                <FotoDoAvatar src={mediaUrl.avatarAnterior(a.id, a.chave)} animado={a.animado} estado={null} size={56} />
              </span>
            </button>
            <button className="avatar-anterior-tirar icon-plain" title={t('Tirar do histórico')} aria-label={t('Tirar do histórico')} onClick={() => void tirar(a.id)}>
              <X size={14} />
            </button>
          </li>
        ))}
      </ul>
      {erro && <p className="form-error">{erro}</p>}
    </section>
  );
}

/**
 * OS ENFEITES DO PERFIL, na folha do Avatar, embaixo do personagem: a prévia de como os outros veem você e as abas de
 * sempre (o nome, o fundo, a moldura, o efeito, a letra, as insígnias, os pacotes).
 */
function EnfeitesDoPerfil({ user, aoAbrirPacotes }: { user: User; aoAbrirPacotes: () => void }) {
  const t = useT();
  const { dados, erro, vestir } = useGuardaRoupa();
  const [aba, setAba] = useState<Aba>('cor');

  if (erro && !dados) return <p className="form-error">{erro}</p>;
  if (!dados) return <p className="settings-hint">{t('Carregando…')}</p>;

  const cobreMeuNome = (item: ItemDoGuardaRoupa) => cobreONome(item, dados, nomeDe(user));
  const doTipo = dados.itens.filter((item) => item.tipo === aba && cobreMeuNome(item));
  const escondidas = dados.itens.filter((item) => item.tipo === aba && !cobreMeuNome(item)).length;

  return (
    <section className="enfeites-do-perfil">
      <p className="settings-hint">{t('Tudo aqui é de graça. Escolha o que quiser, troque quando quiser.')}</p>
      {/* A PRÉVIA FICA NO ALTO E NÃO SE MEXE DE LUGAR enquanto você experimenta: é o ponto de
          referência. Ela usa o estado do servidor (o diretório), e não o desta tela, porque é
          exatamente assim que os outros vão te ver. */}
      <div className={`perfil-previa ${classeDoFundo(dados.vestindo.fundo ?? 'nenhum')}`}>
        <Avatar name={nomeDe(user)} userId={user.id} size={56} />
        <strong
          data-cor={corDoNome(dados.vestindo.cor ?? 'padrao')}
          data-efeito={efeitoDoNome(dados.vestindo.efeito)}
          style={{ fontFamily: letraDoNome(dados.vestindo.letra) }}
        >
          {nomeDe(user)}
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
              vestido={estaVestido(item, dados)}
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
    </section>
  );
}
