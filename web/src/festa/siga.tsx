import { useEffect, useState } from 'react';
import { chave } from '../i18n';
import { microjogoDaTela, useRelogio, useTeclas, type PropsDoMicro } from './comum';

// Os mesmos números do servidor (server/src/festa/siga.ts).
const SIGA_MS = 40000;
const SIGA_PASSO_MS = 600;
const SIGA_ACESA_MS = 450;

/** As quatro setas: 0 cima, 1 direita, 2 baixo, 3 esquerda (o desenho gira; nenhuma letra). */
function Seta({ direcao }: { direcao: number }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path transform={`rotate(${direcao * 90} 12 12)`} d="M12 3 L20 12 L15 12 L15 21 L9 21 L9 12 L4 12 Z" fill="currentColor" />
    </svg>
  );
}

const TECLA_DA_SETA: Record<string, number> = { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3, w: 0, d: 1, s: 2, a: 3 };

/** Siga o coelho: a sequência aparece, repete-se, e cresce uma seta a cada acerto. */
function Siga({ dados, inicio, ativo, enviar }: PropsDoMicro<{ setas?: number[] }>) {
  const setas = dados.setas ?? [];
  const [nivel, setNivel] = useState(1);
  const [modo, setModo] = useState<'mostrando' | 'repetindo' | 'fim'>('mostrando');
  const [mostrarDesde, setMostrarDesde] = useState(inicio);
  const [digitadas, setDigitadas] = useState<number[]>([]);
  const [ultimaCompleta, setUltimaCompleta] = useState<number[]>([]);
  const [apertada, setApertada] = useState<{ seta: number; em: number; certa: boolean } | null>(null);
  const agora = useRelogio(ativo && modo !== 'fim');

  const terminar = (completas: number[], errada?: number) => {
    setModo('fim');
    enviar({ acertos: completas.length, setas: errada === undefined ? completas : [...completas, errada], ms: Math.round(Date.now() - inicio) });
  };

  // a sequência acabou de ser mostrada: a vez de repetir
  useEffect(() => {
    if (modo === 'mostrando' && agora - mostrarDesde >= nivel * SIGA_PASSO_MS) setModo('repetindo');
  }, [agora, modo, mostrarDesde, nivel]);
  // o tempo da rodada acabou
  useEffect(() => {
    if (ativo && modo !== 'fim' && agora - inicio >= SIGA_MS) terminar(ultimaCompleta);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agora]);

  const apertar = (seta: number) => {
    if (!ativo || modo !== 'repetindo') return;
    const certa = seta === setas[digitadas.length];
    setApertada({ seta, em: Date.now(), certa });
    if (!certa) return terminar(ultimaCompleta, seta);
    const novas = [...digitadas, seta];
    if (novas.length < nivel) return setDigitadas(novas);
    setUltimaCompleta(novas);
    setDigitadas([]);
    if (nivel >= setas.length) return terminar(novas);
    setNivel(nivel + 1);
    setModo('mostrando');
    setMostrarDesde(Date.now() + 400);
  };
  useTeclas(ativo && modo === 'repetindo', (e) => {
    const seta = TECLA_DA_SETA[e.key.length === 1 ? e.key.toLowerCase() : e.key];
    if (seta === undefined) return false;
    apertar(seta);
    return true;
  });

  const desde = agora - mostrarDesde;
  const acesa =
    modo === 'mostrando' && desde >= 0 && desde % SIGA_PASSO_MS < SIGA_ACESA_MS && Math.floor(desde / SIGA_PASSO_MS) < nivel
      ? setas[Math.floor(desde / SIGA_PASSO_MS)]
      : apertada && agora - apertada.em < 250
        ? apertada.seta
        : null;
  const errou = apertada !== null && !apertada.certa;
  return (
    <div className={`festa-siga${modo === 'repetindo' ? ' sua-vez' : ''}`}>
      <div className="festa-siga-pontos" aria-hidden="true">
        {Array.from({ length: nivel }, (_, i) => (
          <span key={i} className={i < digitadas.length ? 'feita' : ''} />
        ))}
      </div>
      <div className="festa-siga-cruz">
        {[0, 1, 2, 3].map((seta) => (
          <button
            key={seta}
            type="button"
            className={`festa-seta s${seta}${acesa === seta ? (errou && modo === 'fim' ? ' errada' : ' acesa') : ''}`}
            disabled={!ativo || modo !== 'repetindo'}
            onPointerDown={(e) => {
              e.preventDefault();
              apertar(seta);
            }}
          >
            <Seta direcao={seta} />
          </button>
        ))}
        <span className="festa-siga-coelho" aria-hidden="true">
          <svg viewBox="0 0 40 40">
            <ellipse cx="14" cy="10" rx="3.5" ry="9" fill="#e8dccb" />
            <ellipse cx="26" cy="10" rx="3.5" ry="9" fill="#e8dccb" />
            <circle cx="20" cy="25" r="12" fill="#e8dccb" />
            <circle cx="16" cy="24" r="1.8" fill="#3a2e2a" />
            <circle cx="24" cy="24" r="1.8" fill="#3a2e2a" />
            <circle cx="20" cy="28" r="1.5" fill="#d98a8a" />
          </svg>
        </span>
      </div>
    </div>
  );
}

export default microjogoDaTela({
  id: 'siga',
  nome: chave('Siga o coelho'),
  dica: chave('Repita as setas na ordem. A cada acerto, vem mais uma.'),
  Tela: Siga,
  valor: (v) => `➜ × ${v}`,
});
