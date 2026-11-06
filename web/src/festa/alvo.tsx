import { useEffect, useState } from 'react';
import { chave } from '../i18n';
import { microjogoDaTela, useRelogio, useTeclas, type PropsDoMicro } from './comum';

// Os mesmos números do servidor (server/src/festa/alvo.ts).
const ALVO_MS = 20000;
const ALVO_VIDA_MS = 1100;

/** Tiro ao alvo: as cenouras aparecem numa grade 3 × 3; clique, toque, ou as teclas 1 a 9 na ordem de leitura. */
function Alvo({ dados, inicio, ativo, enviar, lance }: PropsDoMicro<{ alvos?: { t: number; casa: number }[] }>) {
  const alvos = dados.alvos ?? [];
  const [acertos, setAcertos] = useState<number[]>([]);
  const agora = useRelogio(ativo);
  const e = agora - inicio;
  const naCasa = (casa: number) =>
    alvos.findIndex((a, i) => a.casa === casa && e >= a.t && e < a.t + ALVO_VIDA_MS && !acertos.includes(i));
  const acertar = (casa: number) => {
    if (!ativo || Date.now() - inicio >= ALVO_MS) return;
    const i = naCasa(casa);
    if (i < 0) return;
    setAcertos((a) => (a.includes(i) ? a : [...a, i]));
    // cada acerto vai na hora: o servidor confere no relógio dele que o alvo estava na tela
    lance({ i });
  };
  useEffect(() => {
    if (ativo && e >= ALVO_MS) enviar({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo, e >= ALVO_MS]);
  useTeclas(ativo, (ev) => {
    const n = Number(ev.key);
    if (!Number.isInteger(n) || n < 1 || n > 9) return false;
    acertar(n - 1);
    return true;
  });
  const fracao = Math.min(1, Math.max(0, e / ALVO_MS));
  return (
    <div className="festa-alvo">
      <div className="festa-alvo-topo">
        <span className="festa-mostrador">🥕 × {acertos.length}</span>
        <span className="festa-alvo-tempo" aria-hidden="true">
          <span style={{ width: `${(1 - fracao) * 100}%` }} />
        </span>
      </div>
      <div className="festa-alvo-grade">
        {Array.from({ length: 9 }, (_, casa) => {
          const i = naCasa(casa);
          return (
            <button
              key={casa}
              type="button"
              className="festa-alvo-casa"
              onPointerDown={(ev) => {
                ev.preventDefault();
                acertar(casa);
              }}
              disabled={!ativo}
            >
              <small aria-hidden="true">{casa + 1}</small>
              {i >= 0 && (
                <svg key={i} className="festa-cenoura" viewBox="0 0 40 40" aria-hidden="true">
                  <path d="M12 14 L28 14 L20 38 Z" fill="#e07a2e" />
                  <path d="M16 18 L22 19 M15 24 L21 25" stroke="#b85a1e" strokeWidth="1.5" />
                  <path d="M17 14 L12 4 M20 14 L20 2 M23 14 L28 4" stroke="#6fa356" strokeWidth="3.5" strokeLinecap="round" />
                </svg>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default microjogoDaTela({
  id: 'alvo',
  nome: chave('Tiro ao alvo'),
  dica: chave('Acerte as cenouras que aparecerem. Cada uma vale um ponto.'),
  Tela: Alvo,
  valor: (v) => `🥕 × ${v}`,
  errouComValor: true,
});
