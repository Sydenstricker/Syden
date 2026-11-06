import { useLayoutEffect, useRef, useState } from 'react';
import { chave, useT } from '../i18n';
import { ehAperto, microjogoDaTela, useFormatos, useTeclas, type PropsDoMicro } from './comum';

const NOME = chave('Saque rápido');

/** O saque: espera-se o sinal; antes dele, está fora. A reação conta de quando o sinal apareceu NESTA tela. */
function Saque({ ativo, enviar, sinal }: PropsDoMicro) {
  const t = useT();
  const f = useFormatos();
  const vistoEm = useRef<number | null>(null);
  const [meu, setMeu] = useState<'cedo' | number | null>(null);
  useLayoutEffect(() => {
    if (!sinal || vistoEm.current !== null) return;
    vistoEm.current = performance.now();
    // o quadro em que o sinal foi pintado
    requestAnimationFrame(() => (vistoEm.current = performance.now()));
  }, [sinal]);
  const apertar = () => {
    if (!ativo || meu !== null) return;
    if (!sinal || vistoEm.current === null) {
      setMeu('cedo');
      enviar({ cedo: true });
      return;
    }
    const reacao = Math.round(performance.now() - vistoEm.current);
    setMeu(reacao);
    enviar({ reacaoMs: reacao });
  };
  useTeclas(ativo && meu === null, (e) => {
    if (!ehAperto(e)) return false;
    apertar();
    return true;
  });
  return (
    <button
      type="button"
      className={`festa-saque${sinal ? ' sinal' : ''}${meu === 'cedo' ? ' cedo' : ''}`}
      onPointerDown={(e) => {
        e.preventDefault();
        apertar();
      }}
      aria-label={t(NOME)}
    >
      <svg viewBox="0 0 120 80" aria-hidden="true">
        {sinal && meu !== 'cedo' ? (
          <>
            <circle cx="60" cy="40" r="30" fill="#f2c46a" />
            <rect x="55" y="18" width="10" height="30" rx="4" fill="#5a3a2a" />
            <circle cx="60" cy="58" r="5.5" fill="#5a3a2a" />
          </>
        ) : (
          <>
            {/* o coelho esperando, de orelha em pé */}
            <ellipse cx="50" cy="20" rx="5" ry="15" fill="#e8dccb" />
            <ellipse cx="70" cy="20" rx="5" ry="15" fill="#e8dccb" />
            <circle cx="60" cy="46" r="20" fill="#e8dccb" />
            <circle cx="53" cy="44" r="2.5" fill="#3a2e2a" />
            <circle cx="67" cy="44" r="2.5" fill="#3a2e2a" />
            <circle cx="60" cy="51" r="2" fill="#d98a8a" />
            {meu === null && [0, 1, 2].map((i) => <circle key={i} className="festa-ponto" style={{ animationDelay: `${i * 0.25}s` }} cx={96 + i * 8} cy="66" r="2.5" fill="#e8dccb" />)}
          </>
        )}
      </svg>
      {meu === 'cedo' && <span className="festa-saque-texto">{t('Cedo demais!')}</span>}
      {typeof meu === 'number' && <span className="festa-saque-texto">{f.ms.format(meu)}</span>}
    </button>
  );
}

export default microjogoDaTela({
  id: 'saque',
  nome: NOME,
  dica: chave('Espere o sinal e aperte o mais rápido que puder. Antes do sinal, está fora.'),
  Tela: Saque,
  valor: (v, f) => f.ms.format(v),
});
