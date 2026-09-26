import { BookOpen, Compass, Lightbulb, Rabbit, Send, ShoppingBag, Users, Volume2 } from 'lucide-react';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { api } from './api';
import { CHANGELOG, marcarNovidadesVistas } from './changelog';
import { useDirectory } from './directory';
import { getTheme, toggleTheme } from './theme';
import type { Channel, VoiceMember } from './types';
import { PainelCoelhos } from './PainelCoelhos';
import { balaoDaCasa, CASAS, ESTATUA, type Periodo, type PinoVila, Vila } from './Vila';

// Tela inicial do Syden: a vila. Um lugar para chegar, ver quem está onde, dar uma olhada no que mudou
// e cutucar uns coelhos antes de entrar numa sala. As quatro casas não são enfeite: cada uma leva a uma
// parte de verdade do app.

/**
 * A caixa de ideias da vila. Por baixo não existe caixa nenhuma: o que a pessoa escreve vira uma
 * mensagem privada para quem cuida do Syden, na mesma conversa de sempre — assim ele lê no lugar em que
 * já lê tudo, e pode responder ali mesmo.
 */
function CaixaDeIdeias({ souODono }: { souODono: boolean }) {
  const { members } = useDirectory();
  const dono = [...members.values()].find((m) => m.isOwner);
  const [texto, setTexto] = useState('');
  const [estado, setEstado] = useState<'parado' | 'enviando' | 'enviado'>('parado');
  const [erro, setErro] = useState<string | null>(null);


  async function enviar(event: FormEvent) {
    event.preventDefault();
    if (texto.trim().length < 4) return setErro('Escreva um pouco mais sobre a sua ideia.');
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
      <section className="ideias exemplo" aria-label="Caixa de ideias (como os outros veem)">
        <h2>
          <Lightbulb size={20} aria-hidden="true" />
          Tem uma ideia para o Syden?
        </h2>
        <p className="ideias-lead">
          É isto que os seus amigos veem aqui embaixo da vila. O que eles escreverem chega para você como conversa
          privada, com 💡 na frente — e o Syden já responde agradecendo na hora. Quando a ideia entrar no app, use o
          joinha na mensagem: do lado deles cai confete e a medalha aparece no perfil.
        </p>
        <form onSubmit={(e) => e.preventDefault()} aria-hidden="true">
          <textarea rows={3} placeholder="Seria bom se…" disabled />
          <div className="ideias-rodape">
            <span className="ideias-conta" />
            <button type="button" disabled>
              <Send size={16} aria-hidden="true" />
              Enviar
            </button>
          </div>
        </form>
      </section>
    );
  }

  return (
    <section className="ideias" aria-label="Sugestões de melhoria">
      <h2>
        <Lightbulb size={20} aria-hidden="true" />
        Tem uma ideia para o Syden?
      </h2>
      <p className="ideias-lead">
        Escreva aqui o que você gostaria que existisse — ou o que está atrapalhando. Chega como mensagem privada para{' '}
        {dono ? <strong>{dono.username}</strong> : 'quem cuida do Syden'}, e a resposta volta pela mesma conversa.
      </p>
      {estado === 'enviado' ? (
        <div className="ideias-obrigado">
          <p>Chegou. Obrigado!</p>
          <button onClick={() => setEstado('parado')}>Mandar outra</button>
        </div>
      ) : (
        <form onSubmit={enviar}>
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            maxLength={1500}
            rows={3}
            placeholder="Seria bom se…"
            aria-label="Sua ideia"
          />
          <div className="ideias-rodape">
            <span className="ideias-conta">{texto.length > 0 && `${texto.length}/1500`}</span>
            <button type="submit" disabled={estado === 'enviando'}>
              <Send size={16} aria-hidden="true" />
              {estado === 'enviando' ? 'Enviando…' : 'Enviar'}
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
  aoAbrirLoja,
  aoExplorar,
  souODono,
}: {
  /** Nome da comunidade aberta agora, se houver. */
  comunidade?: string;
  /** As salas de voz dessa comunidade. */
  salas: Channel[];
  /** Quem está em cada sala, para a lista mostrar companhia. */
  naVoz: VoiceMember[];
  aoEntrar: (channelId: number) => void;
  aoAbrirLoja: () => void;
  aoExplorar: () => void;
  /** Quem cuida do Syden recebe as ideias em vez de mandar: para ele a caixa não aparece. */
  souODono: boolean;
}) {
  // O céu segue o relógio, mas dá para mudar na mão clicando no sol — e isso troca o tema do app.
  const [periodo, setPeriodo] = useState<Periodo>(() => (getTheme() === 'light' ? periodoClaro() : 'noite'));
  const [destaque, setDestaque] = useState<string | null>(null);
  const [salasAbertas, setSalasAbertas] = useState(false);
  const [coelhosAbertos, setCoelhosAbertos] = useState(false);
  const novidadesRef = useRef<HTMLElement | null>(null);

  // Abriu a tela inicial: as novidades deixam de ser novidade (a bolinha do logo apaga).
  useEffect(marcarNovidadesVistas, []);

  function alternarLuz() {
    setPeriodo(toggleTheme() === 'light' ? periodoClaro() : 'noite');
  }

  const pinos: PinoVila[] = [
    {
      id: 'salas',
      titulo: 'Salas',
      sub: comunidade ? `Converse e jogue em ${comunidade}` : 'Converse e jogue',
      icone: <Users size={18} />,
      ...balaoDaCasa(CASAS.salas),
      onClick: () => setSalasAbertas((aberto) => !aberto),
    },
    {
      id: 'loja',
      titulo: 'Sons',
      sub: 'Pacotes de efeitos',
      icone: <ShoppingBag size={18} />,
      ...balaoDaCasa(CASAS.loja),
      onClick: aoAbrirLoja,
    },
    {
      id: 'aprender',
      titulo: 'Novidades',
      sub: 'O que mudou no Syden',
      icone: <BookOpen size={18} />,
      ...balaoDaCasa(CASAS.aprender),
      onClick: () => novidadesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    },
    {
      id: 'coelhos',
      titulo: 'Coelhos',
      sub: 'Escolha o seu',
      icone: <Rabbit size={18} />,
      ...balaoDaCasa(ESTATUA, 0),
      onClick: () => setCoelhosAbertos((aberto) => !aberto),
    },
    {
      id: 'explorar',
      titulo: 'Explorar',
      sub: 'Entrar em outra comunidade',
      icone: <Compass size={18} />,
      ...balaoDaCasa(CASAS.explorar),
      onClick: aoExplorar,
    },
  ];

  return (
    <div className="home">
      <div className="home-cena">
        <Vila periodo={periodo} onLuz={alternarLuz} pinos={pinos} destaque={destaque} onDestaque={setDestaque} />
        {coelhosAbertos && <PainelCoelhos aoFechar={() => setCoelhosAbertos(false)} />}
        {salasAbertas && (
          <div className="vila-painel" role="dialog" aria-label="Salas de voz">
            <header>
              <h3>{comunidade ? `Salas de ${comunidade}` : 'Salas'}</h3>
              <button className="vila-painel-fechar" aria-label="Fechar" onClick={() => setSalasAbertas(false)}>
                ✕
              </button>
            </header>
            {salas.length === 0 ? (
              <p className="vila-painel-vazio">
                {comunidade ? 'Esta comunidade ainda não tem sala de voz.' : 'Entre numa comunidade para ver as salas.'}
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
                          {gente.length === 0 ? 'vazia' : gente.map((g) => g.username).join(', ')}
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

      <CaixaDeIdeias souODono={souODono} />

      <section className="home-news" aria-label="Novidades do Syden" ref={novidadesRef}>
        <h2>Novidades</h2>
        <p className="home-news-lead">O que mudou por aqui, do mais novo para o mais antigo.</p>
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
