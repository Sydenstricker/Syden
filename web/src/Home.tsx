import { ExternalLink, Gamepad2, Lightbulb, Send, Volume2 } from 'lucide-react';
import { JOGOS, nomeDoIdioma, pedirParaAbrirAoEntrar, SITES_PARA_TRANSMITIR } from './minijogos';
import { SiteEmbutido } from './SiteEmbutido';
import { type FormEvent, useRef, useState } from 'react';
import { api } from './api';
import { useDirectory } from './directory';
import { getTheme, toggleTheme } from './theme';
import type { Channel, Community, VoiceMember } from './types';
import { Farol, atividadeAgora } from './Farol';
import { type AcoesDoQuarto, Quarto } from './Quarto';
import { QuartoNovo } from './QuartoNovo';
import type { Periodo } from './Vila';
import { idiomaAtual, useT } from './i18n';

// Tela inicial do Syden: o quarto do coelho (Quarto.tsx). Um lugar para chegar, dar uma olhada no que mudou e cutucar
// o coelho antes de entrar numa sala. Os objetos não são enfeite: cada um leva a uma parte de verdade do app. Até
// 08/10/2026 era a vila (Vila.tsx), que continua no projeto: os desenhos de coelho dela são usados em outras telas.

/**
 * A caixa de ideias da vila. Por baixo não existe caixa nenhuma: o que a pessoa escreve vira uma
 * mensagem privada para quem cuida do Syden, na mesma conversa de sempre — assim ele lê no lugar em que
 * já lê tudo, e pode responder ali mesmo.
 */
function CaixaDeIdeias({ souODono }: { souODono: boolean }) {
  const t = useT();
  const { members } = useDirectory();
  const dono = [...members.values()].find((m) => m.isOwner);
  const [texto, setTexto] = useState('');
  const [estado, setEstado] = useState<'parado' | 'enviando' | 'enviado'>('parado');
  const [erro, setErro] = useState<string | null>(null);


  async function enviar(event: FormEvent) {
    event.preventDefault();
    if (texto.trim().length < 4) return setErro(t('Escreva um pouco mais sobre a sua ideia.'));
    setEstado('enviando');
    setErro(null);
    try {
      await api('/api/suggestions', { method: 'POST', body: { content: texto.trim() } });
      setTexto('');
      setEstado('enviado');
    } catch (e) {
      setErro((e as Error).message);
      setEstado('parado');
    }
  }

  // Quem RECEBE as ideias não manda ideia a si mesmo: para ele a caixa fica como demonstração, para
  // saber o que os amigos veem aqui e por onde as ideias chegam.
  if (souODono) {
    return (
      <section className="ideias exemplo" aria-label={t('Caixa de ideias (como os outros veem)')}>
        <h2>
          <Lightbulb size={20} aria-hidden="true" />
          {t('Tem uma ideia para o Syden?')}
        </h2>
        <p className="ideias-lead">
          {t(
            'É isto que os seus amigos veem aqui embaixo do quarto. O que eles escreverem chega para você como conversa privada, com 💡 na frente — e o Syden já responde agradecendo na hora. Quando a ideia entrar no app, use o joinha na mensagem: do lado deles cai confete e a medalha aparece no perfil.',
          )}
        </p>
        <form onSubmit={(e) => e.preventDefault()} aria-hidden="true">
          <textarea rows={3} placeholder={t('Seria bom se…')} disabled />
          <div className="ideias-rodape">
            <span className="ideias-conta" />
            <button type="button" disabled>
              <Send size={16} aria-hidden="true" />
              {t('Enviar')}
            </button>
          </div>
        </form>
      </section>
    );
  }

  return (
    <section className="ideias" aria-label={t('Sugestões de melhoria')}>
      <h2>
        <Lightbulb size={20} aria-hidden="true" />
        {t('Tem uma ideia para o Syden?')}
      </h2>
      <p className="ideias-lead">
        {t('Escreva aqui o que você gostaria que existisse — ou o que está atrapalhando. Chega como mensagem privada para')}{' '}
        {dono ? <strong>{dono.username}</strong> : t('quem cuida do Syden')}
        {t(', e a resposta volta pela mesma conversa.')}
      </p>
      {estado === 'enviado' ? (
        <div className="ideias-obrigado">
          <p>{t('Chegou. Obrigado!')}</p>
          <button onClick={() => setEstado('parado')}>{t('Mandar outra')}</button>
        </div>
      ) : (
        <form onSubmit={enviar}>
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            maxLength={1500}
            rows={3}
            placeholder={t('Seria bom se…')}
            aria-label={t('Sua ideia')}
          />
          <div className="ideias-rodape">
            <span className="ideias-conta">{texto.length > 0 && `${texto.length}/1500`}</span>
            <button type="submit" disabled={estado === 'enviando'}>
              <Send size={16} aria-hidden="true" />
              {estado === 'enviando' ? t('Enviando…') : t('Enviar')}
            </button>
          </div>
          {erro && <p className="form-error">{erro}</p>}
        </form>
      )}
    </section>
  );
}

/** De dia a cena segue o relógio; se já for noite pelo relógio, mostra a tarde. */
function periodoClaro(): Periodo {
  const hora = new Date().getHours();
  if (hora >= 6 && hora < 12) return 'manha';
  if (hora >= 12 && hora < 17) return 'tarde';
  return 'entardecer';
}

export function Home({
  comunidade,
  salas,
  naVoz,
  aoEntrar,
  aoAbrirGuardaRoupa,
  aoAbrirAmigos,
  aoExplorar,
  souODono,
  comunidades,
  vozDeTodas,
  eu,
  aoIrParaComunidade,
}: {
  /** Nome da comunidade aberta agora, se houver. */
  comunidade?: string;
  /** As salas de voz dessa comunidade. */
  salas: Channel[];
  /** Quem está em cada sala, para a lista mostrar companhia. */
  naVoz: VoiceMember[];
  aoEntrar: (channelId: number) => void;
  aoAbrirGuardaRoupa: () => void;
  aoAbrirAmigos: () => void;
  aoExplorar: () => void;
  /** Quem cuida do Syden recebe as ideias em vez de mandar: para ele a caixa não aparece. */
  souODono: boolean;
  /** Todas as comunidades da pessoa, e quem está em chamada em cada uma: é o que acende o farol. */
  comunidades: Community[];
  vozDeTodas: Record<number, VoiceMember[]>;
  eu: number;
  aoIrParaComunidade: (communityId: number) => void;
}) {
  const t = useT();
  // O céu segue o relógio, mas dá para mudar na mão clicando no sol — e isso troca o tema do app.
  const [periodo, setPeriodo] = useState<Periodo>(() => (getTheme() === 'light' ? periodoClaro() : 'noite'));
  const [salasAbertas, setSalasAbertas] = useState(false);
  const [jogosAbertos, setJogosAbertos] = useState(false);
  // O quarto novo, só no desenvolvimento, escolhido por um botão e lembrado neste navegador.
  const [quartoNovo, setQuartoNovo] = useState(() => {
    try {
      return import.meta.env.DEV && localStorage.getItem('syden:quarto-novo') === '1';
    } catch {
      return false;
    }
  });
  function alternarQuartoNovo() {
    setQuartoNovo((agora) => {
      try {
        localStorage.setItem('syden:quarto-novo', agora ? '0' : '1');
      } catch {
        /* só nesta visita */
      }
      return !agora;
    });
  }
  /** O jogo de parceiro aberto aqui dentro (SiteEmbutido.tsx). */
  const [siteAberto, setSiteAberto] = useState<{ nome: string; endereco: string } | null>(null);
  const ideiasRef = useRef<HTMLDivElement | null>(null);


  function alternarLuz() {
    setPeriodo(toggleTheme() === 'light' ? periodoClaro() : 'noite');
  }

  // Cada função da home mora num objeto do quarto. O computador abre os Mini-games (desde 12/10/2026). O gabinete e o
  // vaso (Plantar cenoura) ficam só como desenho até essas funções existirem: objeto que acende e não leva a lugar
  // nenhum afirmaria o que não é. O pôster também: ele abria a escolha entre OurBunny e BigChunkus, que não aparecem mais em lugar nenhum da
  // home (o coelho do quarto é o da pintura), e a escolha saiu até haver outros coelhos (09/10/2026).
  const acoes: AcoesDoQuarto = {
    fone: {
      rotulo: t('Salas'),
      sub: comunidade ? t('Converse e jogue em {nome}', { nome: comunidade }) : t('Converse e jogue'),
      onClick: () => {
        setJogosAbertos(false);
        setSalasAbertas((aberto) => !aberto);
      },
    },
    quadro: { rotulo: t('Amigos'), sub: t('Quem anda com você'), onClick: aoAbrirAmigos },
    gavetas: { rotulo: t('Guarda-roupa'), sub: t('Enfeites, sons e emojis'), onClick: aoAbrirGuardaRoupa },
    janela: { rotulo: t('Explorar'), sub: t('Entrar em outra comunidade'), onClick: aoExplorar },
    cortica: { rotulo: t('Tem uma ideia para o Syden?'), onClick: () => ideiasRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) },
    abajur: { rotulo: t('Dia e noite'), onClick: alternarLuz },
    computador: {
      rotulo: t('Mini-games'),
      sub: t('Jogar com a turma'),
      onClick: () => {
        setSalasAbertas(false);
        setJogosAbertos((aberto) => !aberto);
      },
    },
  };

  const atividade = atividadeAgora(comunidades, vozDeTodas, eu);

  return (
    <div className="home">
      <div className="home-cena">
        {quartoNovo ? <QuartoNovo noite={periodo === 'noite'} acoes={acoes} /> : <Quarto noite={periodo === 'noite'} acoes={acoes} />}
        {/* SÓ NO DESENVOLVIMENTO: liga e desliga o quarto novo (QuartoNovo.tsx), que ainda não foi lançado. Um ícone, sem
            texto: o botão não existe no site publicado, e texto aqui seria mais uma frase cravada fora da tradução. */}
        {import.meta.env.DEV && (
          <button type="button" className="quarto-novo-alternar" aria-pressed={quartoNovo} onClick={() => alternarQuartoNovo()}>
            🧪
          </button>
        )}
        {salasAbertas && (
          <div className="vila-painel" role="dialog" aria-label={t('Salas de voz')}>
            <header>
              <h3>{comunidade ? t('Salas de {nome}', { nome: comunidade }) : t('Salas')}</h3>
              <button className="vila-painel-fechar" aria-label={t('Fechar')} onClick={() => setSalasAbertas(false)}>
                ✕
              </button>
            </header>
            {salas.length === 0 ? (
              <p className="vila-painel-vazio">
                {comunidade ? t('Esta comunidade ainda não tem sala de voz.') : t('Entre numa comunidade para ver as salas.')}
              </p>
            ) : (
              <ul>
                {salas.map((sala) => {
                  const gente = naVoz.filter((m) => m.channelId === sala.id);
                  return (
                    <li key={sala.id}>
                      <button
                        onClick={() => {
                          setSalasAbertas(false);
                          aoEntrar(sala.id);
                        }}
                      >
                        <Volume2 size={16} aria-hidden="true" />
                        <span className="vila-sala-nome">{sala.name}</span>
                        <span className={`vila-sala-gente${gente.length > 0 ? ' cheia' : ''}`}>
                          {gente.length === 0 ? t('vazia') : gente.map((g) => g.username).join(', ')}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
        {jogosAbertos && (
          <div className="vila-painel jogos-painel" role="dialog" aria-label={t('Mini-games')}>
            <header>
              <h3>{t('Mini-games')}</h3>
              <button className="vila-painel-fechar" aria-label={t('Fechar')} onClick={() => setJogosAbertos(false)}>
                ✕
              </button>
            </header>
            <section className="jogos-do-syden">
              <h4>
                <Gamepad2 size={16} aria-hidden="true" /> {t('Na sala de voz, com a turma')}
              </h4>
              <p>{JOGOS.map((jogo) => t(jogo.nome)).join(' · ')}</p>
              {salas.length === 0 ? (
                <p className="vila-painel-vazio">
                  {comunidade ? t('Esta comunidade ainda não tem sala de voz.') : t('Entre numa comunidade para ver as salas.')}
                </p>
              ) : (
                <>
                  <p className="jogos-escolha">{t('Escolha a sala para jogar com a turma:')}</p>
                  <ul>
                    {salas.map((sala) => {
                      const gente = naVoz.filter((m) => m.channelId === sala.id);
                      return (
                        <li key={sala.id}>
                          <button
                            onClick={() => {
                              setJogosAbertos(false);
                              pedirParaAbrirAoEntrar(sala.id);
                              aoEntrar(sala.id);
                            }}
                          >
                            <Volume2 size={16} aria-hidden="true" />
                            <span className="vila-sala-nome">{sala.name}</span>
                            <span className={`vila-sala-gente${gente.length > 0 ? ' cheia' : ''}`}>
                              {gente.length === 0 ? t('vazia') : gente.map((g) => g.username).join(', ')}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </section>
            {/* Os de fora: sem anúncio (medido em 07/10/2026). Os que deixam ser embutidos rodam aqui dentro, depois
                do clique (SiteEmbutido.tsx); os outros abrem no navegador, e quem joga transmite. */}
            <section className="jogos-de-fora">
              <h4>{t('Para jogar fora e transmitir')}</h4>
              <ul>
                {SITES_PARA_TRANSMITIR.map((site) => {
                  const conteudo = (
                    <>
                      {site.embutir ? <Gamepad2 size={14} aria-hidden="true" /> : <ExternalLink size={14} aria-hidden="true" />}
                      <span className="vila-sala-nome">{site.nome}</span>
                      <span className="vila-sala-gente">
                        {t(site.dica)}
                        {/* O site de uma língua só aparece para todo mundo, com o nome da língua (decisão dele). */}
                        {site.idioma && !idiomaAtual().startsWith(site.idioma) && (
                          <span className="jogos-idioma"> · {nomeDoIdioma(site.idioma, idiomaAtual())}</span>
                        )}
                      </span>
                    </>
                  );
                  return (
                    <li key={site.endereco}>
                      {site.embutir ? (
                        <button type="button" onClick={() => setSiteAberto(site)}>
                          {conteudo}
                        </button>
                      ) : (
                        <a href={site.endereco} target="_blank" rel="noopener noreferrer">
                          {conteudo}
                        </a>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          </div>
        )}
      </div>

      <Farol atividade={atividade} aoIr={aoIrParaComunidade} />
      {siteAberto && <SiteEmbutido nome={siteAberto.nome} endereco={siteAberto.endereco} aoFechar={() => setSiteAberto(null)} />}


      <div ref={ideiasRef}>
        <CaixaDeIdeias souODono={souODono} />
      </div>
    </div>
  );
}
