import { Lightbulb, Send, Volume2 } from 'lucide-react';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { api } from './api';
import { CHANGELOG, marcarNovidadesVistas } from './changelog';
import { useDirectory } from './directory';
import { getTheme, toggleTheme } from './theme';
import type { Channel, Community, VoiceMember } from './types';
import { Farol, atividadeAgora } from './Farol';
import { type AcoesDoQuarto, Quarto } from './Quarto';
import type { Periodo } from './Vila';
import { useT } from './i18n';

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
            'É isto que os seus amigos veem aqui embaixo da vila. O que eles escreverem chega para você como conversa privada, com 💡 na frente — e o Syden já responde agradecendo na hora. Quando a ideia entrar no app, use o joinha na mensagem: do lado deles cai confete e a medalha aparece no perfil.',
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
  const novidadesRef = useRef<HTMLElement | null>(null);
  const ideiasRef = useRef<HTMLDivElement | null>(null);

  // Abriu a tela inicial: as novidades deixam de ser novidade (a bolinha do logo apaga).
  useEffect(marcarNovidadesVistas, []);

  function alternarLuz() {
    setPeriodo(toggleTheme() === 'light' ? periodoClaro() : 'noite');
  }

  // Cada função da home mora num objeto do quarto. O computador e o gabinete (Mini-games) e o vaso (Plantar cenoura)
  // ficam só como desenho até essas funções existirem: objeto que acende e não leva a lugar nenhum afirmaria o que não
  // é. O pôster também: ele abria a escolha entre OurBunny e BigChunkus, que não aparecem mais em lugar nenhum da
  // home (o coelho do quarto é o da pintura), e a escolha saiu até haver outros coelhos (09/10/2026).
  const acoes: AcoesDoQuarto = {
    fone: { rotulo: t('Salas'), sub: comunidade ? t('Converse e jogue em {nome}', { nome: comunidade }) : t('Converse e jogue'), onClick: () => setSalasAbertas((aberto) => !aberto) },
    quadro: { rotulo: t('Amigos'), sub: t('Quem anda com você'), onClick: aoAbrirAmigos },
    gavetas: { rotulo: t('Guarda-roupa'), sub: t('Enfeites, sons e emojis'), onClick: aoAbrirGuardaRoupa },
    prateleira: { rotulo: t('Novidades'), sub: t('O que mudou no Syden'), onClick: () => novidadesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) },
    janela: { rotulo: t('Explorar'), sub: t('Entrar em outra comunidade'), onClick: aoExplorar },
    cortica: { rotulo: t('Tem uma ideia para o Syden?'), onClick: () => ideiasRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) },
    abajur: { rotulo: t('Dia e noite'), onClick: alternarLuz },
  };

  const atividade = atividadeAgora(comunidades, vozDeTodas, eu);

  return (
    <div className="home">
      <div className="home-cena">
        <Quarto noite={periodo === 'noite'} acoes={acoes} />
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
      </div>

      <Farol atividade={atividade} aoIr={aoIrParaComunidade} />


      <div ref={ideiasRef}>
        <CaixaDeIdeias souODono={souODono} />
      </div>

      <section className="home-news" aria-label="Novidades do Syden" ref={novidadesRef}>
        <h2>{t('Novidades')}</h2>
        <p className="home-news-lead">{t('O que mudou por aqui, do mais novo para o mais antigo.')}</p>
        {CHANGELOG.map((update, index) => (
          <article key={update.date + update.title} className={`update${index === 0 ? ' latest' : ''}`}>
            <header>
              <span className="update-icon" aria-hidden="true">
                {update.icon}
              </span>
              <div>
                <h3>{update.title}</h3>
                <time dateTime={update.date}>
                  {new Date(update.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}
                </time>
              </div>
              {index === 0 && <span className="update-badge">novo</span>}
            </header>
            <ul>
              {update.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        ))}
      </section>
    </div>
  );
}
