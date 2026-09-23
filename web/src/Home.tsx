import { BookOpen, Compass, ShoppingBag, Users, Volume2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { CHANGELOG, marcarNovidadesVistas } from './changelog';
import { getTheme, toggleTheme } from './theme';
import type { Channel, VoiceMember } from './types';
import { balaoDaCasa, CASAS, type Periodo, type PinoVila, Vila } from './Vila';

// Tela inicial do Syden: a vila. Um lugar para chegar, ver quem está onde, dar uma olhada no que mudou
// e cutucar uns coelhos antes de entrar numa sala. As quatro casas não são enfeite: cada uma leva a uma
// parte de verdade do app.

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
}) {
  // O céu segue o relógio, mas dá para mudar na mão clicando no sol — e isso troca o tema do app.
  const [periodo, setPeriodo] = useState<Periodo>(() => (getTheme() === 'light' ? periodoClaro() : 'noite'));
  const [destaque, setDestaque] = useState<string | null>(null);
  const [salasAbertas, setSalasAbertas] = useState(false);
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
