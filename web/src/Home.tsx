import { useEffect, useState } from 'react';
import { CHANGELOG, marcarNovidadesVistas } from './changelog';
import { sounds } from './sounds';

// Tela inicial do Syden: um cantinho tranquilo com coelhos que respondem quando a gente cutuca, e as
// novidades do app ao lado. Nada aqui é essencial para conversar — é o lugar de chegar, dar uma olhada
// no que mudou e brincar um pouco antes de entrar numa sala.
//
// Tudo é desenhado em SVG e animado por CSS: nenhuma imagem externa, nenhum som baixado.

const FALAS = [
  'oi!',
  'cenoura?',
  'pula pula',
  'zzz…',
  'tem alguém na Sala 1?',
  'toca um som aí',
  'que dia bonito',
  'só passando',
  'me cutuca de novo',
  'cadê a turma?',
];

/** Cores de pelo dos coelhos: o branco do logo, um cinza e dois tons quentes. */
const PELOS = ['#f7f3ee', '#d9d2c8', '#e8c9a0', '#f7f3ee', '#cbb9a6'];

type Periodo = 'manha' | 'tarde' | 'entardecer' | 'noite';

function periodoDoDia(hora: number): Periodo {
  if (hora >= 6 && hora < 12) return 'manha';
  if (hora >= 12 && hora < 17) return 'tarde';
  if (hora >= 17 && hora < 20) return 'entardecer';
  return 'noite';
}

function Coelho({ cor }: { cor: string }) {
  return (
    <svg className="bunny-art" viewBox="0 0 40 48" aria-hidden="true">
      <ellipse className="bunny-ear left" cx="14" cy="11" rx="4.2" ry="10.5" fill={cor} />
      <ellipse className="bunny-ear right" cx="26" cy="11" rx="4.2" ry="10.5" fill={cor} />
      <ellipse cx="14" cy="12" rx="1.9" ry="7" fill="#f0a9b6" opacity="0.85" />
      <ellipse cx="26" cy="12" rx="1.9" ry="7" fill="#f0a9b6" opacity="0.85" />
      <ellipse cx="20" cy="35" rx="13" ry="11.5" fill={cor} />
      <ellipse cx="33" cy="36" rx="3.4" ry="3.2" fill="#fffdf9" />
      <circle cx="20" cy="24" r="10" fill={cor} />
      <circle cx="16.4" cy="23" r="1.7" fill="#3b3a38" />
      <circle cx="23.6" cy="23" r="1.7" fill="#3b3a38" />
      <circle cx="16.9" cy="22.4" r="0.6" fill="#fff" />
      <circle cx="24.1" cy="22.4" r="0.6" fill="#fff" />
      <path d="M20 26.4 l-1.7 1.5 h3.4 z" fill="#e88ea0" />
      <ellipse cx="13.5" cy="45" rx="5" ry="2.5" fill={cor} />
      <ellipse cx="26.5" cy="45" rx="5" ry="2.5" fill={cor} />
    </svg>
  );
}

interface CoelhoNaTela {
  id: number;
  x: number; // posição em % da largura da cena
  escala: number;
  cor: string;
  fala: string | null;
  pulando: boolean;
}

function novoCoelho(id: number): CoelhoNaTela {
  return {
    id,
    x: 8 + Math.random() * 78,
    escala: 0.75 + Math.random() * 0.45,
    cor: PELOS[id % PELOS.length],
    fala: null,
    pulando: false,
  };
}

export function Home() {
  const [coelhos, setCoelhos] = useState<CoelhoNaTela[]>(() => [0, 1, 2, 3, 4].map(novoCoelho));
  // O céu segue o relógio, mas dá para mudar na mão — às vezes a gente quer a noite estrelada de dia.
  const [periodo, setPeriodo] = useState<Periodo>(() => periodoDoDia(new Date().getHours()));
  const [cenoura, setCenoura] = useState<{ x: number; id: number } | null>(null);
  const [cutucados, setCutucados] = useState(0);

  // Abriu a tela inicial: as novidades deixam de ser novidade (a bolinha do logo apaga).
  useEffect(marcarNovidadesVistas, []);

  // Vida própria: de tempos em tempos, um coelho dá uns pulinhos e anda um pouco para o lado.
  useEffect(() => {
    const timer = setInterval(() => {
      setCoelhos((lista) => {
        const sorteado = Math.floor(Math.random() * lista.length);
        return lista.map((coelho, i) =>
          i === sorteado
            ? { ...coelho, x: Math.min(92, Math.max(4, coelho.x + (Math.random() * 24 - 12))), pulando: true }
            : coelho,
        );
      });
      setTimeout(() => setCoelhos((lista) => lista.map((c) => ({ ...c, pulando: false }))), 900);
    }, 3800);
    return () => clearInterval(timer);
  }, []);

  /** Cutucar um coelho: ele pula, fala alguma bobagem e some com a fala depois de uns segundos. */
  function cutucar(id: number) {
    sounds.bunny();
    setCutucados((n) => n + 1);
    const fala = FALAS[Math.floor(Math.random() * FALAS.length)];
    setCoelhos((lista) => lista.map((c) => (c.id === id ? { ...c, fala, pulando: true } : c)));
    setTimeout(() => setCoelhos((lista) => lista.map((c) => (c.id === id ? { ...c, pulando: false } : c))), 700);
    setTimeout(() => setCoelhos((lista) => lista.map((c) => (c.id === id ? { ...c, fala: null } : c))), 2600);
  }

  /** Clicar na grama planta uma cenoura, e a turma toda vai atrás dela. */
  function plantarCenoura(event: React.MouseEvent<HTMLDivElement>) {
    const area = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - area.left) / area.width) * 100;
    const id = Date.now();
    setCenoura({ x, id });
    setCoelhos((lista) =>
      lista.map((coelho, i) => ({
        ...coelho,
        x: Math.min(94, Math.max(3, x + (i - (lista.length - 1) / 2) * 7)),
        pulando: true,
      })),
    );
    setTimeout(() => setCoelhos((lista) => lista.map((c) => ({ ...c, pulando: false }))), 1200);
    setTimeout(() => setCenoura((atual) => (atual?.id === id ? null : atual)), 2600);
  }

  const noite = periodo === 'noite';

  /** Botão do sol/lua: de dia anoitece; de noite volta ao período do relógio (ou à tarde, se já for noite). */
  function alternarLuz() {
    setPeriodo((atual) => {
      if (atual !== 'noite') return 'noite';
      const doRelogio = periodoDoDia(new Date().getHours());
      return doRelogio === 'noite' ? 'tarde' : doRelogio;
    });
  }

  return (
    <div className="home">
      <section className={`scene scene-${periodo}`} aria-label="Cantinho dos coelhos">
        <div className="scene-sky">
          {noite &&
            Array.from({ length: 28 }, (_, i) => (
              <span key={i} className="star" style={{ left: `${(i * 37) % 100}%`, top: `${(i * 23) % 60}%`, animationDelay: `${i * 0.2}s` }} />
            ))}
          <button
            className="sky-light"
            title={noite ? 'Trazer o dia de volta' : 'Deixar a noite cair'}
            aria-label={noite ? 'Trazer o dia de volta' : 'Deixar a noite cair'}
            onClick={alternarLuz}
          >
            {noite ? '🌙' : '☀️'}
          </button>
          <span className="cloud cloud-1" />
          <span className="cloud cloud-2" />
          <span className="cloud cloud-3" />
        </div>

        <div className="scene-hills">
          <span className="hill hill-back" />
          <span className="hill hill-front" />
        </div>

        <div className="scene-ground" onClick={plantarCenoura}>
          <div className="house">
            <span className="house-roof" />
            <span className="house-body" />
            <span className={`house-window${noite ? ' lit' : ''}`} />
          </div>

          <span className="tree tree-1">
            <span className="tree-top" />
            <span className="tree-trunk" />
          </span>
          <span className="tree tree-2">
            <span className="tree-top" />
            <span className="tree-trunk" />
          </span>

          <span className="fence" />
          {[12, 30, 47, 63, 81, 92].map((x) => (
            <span key={x} className="flower" style={{ left: `${x}%` }} />
          ))}

          {noite &&
            Array.from({ length: 7 }, (_, i) => (
              <span key={i} className="firefly" style={{ left: `${10 + i * 12}%`, animationDelay: `${i * 0.9}s` }} />
            ))}

          {cenoura && (
            <span className="carrot" style={{ left: `${cenoura.x}%` }} aria-hidden="true">
              🥕
            </span>
          )}

          {coelhos.map((coelho) => (
            <button
              key={coelho.id}
              className={`bunny${coelho.pulando ? ' hop' : ''}`}
              style={{ left: `${coelho.x}%`, transform: `scale(${coelho.escala})` }}
              title="Cutucar o coelho"
              // Sem foco no clique: a cena rolaria para dentro da tela e sairia o enquadramento.
              onMouseDown={(e) => e.preventDefault()}
              aria-label="Cutucar o coelho"
              onClick={(e) => {
                e.stopPropagation();
                cutucar(coelho.id);
              }}
            >
              {coelho.fala && <span className="bunny-talk">{coelho.fala}</span>}
              <Coelho cor={coelho.cor} />
            </button>
          ))}
        </div>

        <p className="scene-hint">
          Cutuque os coelhos, clique na grama para plantar uma cenoura.
          {cutucados > 0 && ` · ${cutucados} ${cutucados === 1 ? 'cutucada' : 'cutucadas'} hoje`}
        </p>
      </section>

      <section className="home-news" aria-label="Novidades do Syden">
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
                <time dateTime={update.date}>{new Date(update.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}</time>
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
