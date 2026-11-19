import { useLayoutEffect, useRef, useState } from 'react';
import { chave, useT } from '../i18n';
import { tocar } from '../somDosJogos';
import { ehAperto, menosMovimento, microjogoDaTela, useFormatos, useTeclas, type PropsDoMicro } from './comum';

const NOME = chave('Saque rápido');

/**
 * O saque: espera-se o sinal; antes dele, está fora. A reação conta de quando o sinal apareceu NESTA tela.
 *
 * A CENA (19/11/2026, pedido dele: "dar cena"): o coelho espera agachado ao lado do alvo, de orelhas baixas; o sinal levanta as
 * orelhas e acende o "!" no balão; apertando depois do sinal, a cenoura sai voando até o alvo (e crava nele); antes do sinal, o
 * coelho tropeça e fica tonto, com as estrelinhas. Só desenho: a reação medida é a mesma de antes.
 */
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
      tocar('erro');
      return;
    }
    const reacao = Math.round(performance.now() - vistoEm.current);
    setMeu(reacao);
    enviar({ reacaoMs: reacao });
    tocar('tiro');
    setTimeout(() => tocar('acerto'), 260);
  };
  useTeclas(ativo && meu === null, (e) => {
    if (!ehAperto(e)) return false;
    apertar();
    return true;
  });
  const calmo = menosMovimento();
  const cedo = meu === 'cedo';
  const lancou = typeof meu === 'number';
  const alerta = sinal && !cedo;
  return (
    <button
      type="button"
      className={`festa-saque${sinal ? ' sinal' : ''}${cedo ? ' cedo' : ''}`}
      onPointerDown={(e) => {
        e.preventDefault();
        apertar();
      }}
      aria-label={t(NOME)}
    >
      <svg viewBox="0 0 160 90" aria-hidden="true">
        <rect x="0" y="76" width="160" height="14" fill="#8fb86a" />
        {/* o alvo, à direita */}
        <circle cx="136" cy="48" r="20" fill="#f3ead8" />
        <circle cx="136" cy="48" r="14" fill="#c94a3a" />
        <circle cx="136" cy="48" r="8" fill="#f3ead8" />
        <circle cx="136" cy="48" r="3.5" fill="#c94a3a" />
        <rect x="134" y="66" width="4" height="12" fill="#8e6a52" />
        {/* a cenoura: na mão, voando, ou cravada no alvo */}
        {lancou ? (
          <g>
            {!calmo && <animateTransform attributeName="transform" type="translate" from="-80 0" to="0 0" dur="0.25s" fill="freeze" />}
            <polygon points="112,46 132,48 112,50" fill="#e07a2e" />
            <rect x="106" y="44" width="7" height="2" fill="#7fae5a" />
            <rect x="106" y="50" width="7" height="2" fill="#7fae5a" />
          </g>
        ) : (
          !cedo && <polygon points="56,54 72,56 56,58" fill="#e07a2e" />
        )}
        {/* o coelho: agachado esperando, alerta no sinal, tonto se apertou cedo */}
        <g transform={cedo ? 'rotate(-28 40 60)' : alerta ? 'translate(0 -4)' : undefined}>
          <g transform={`rotate(${alerta ? 0 : -55} 32 34)`}>
            <ellipse cx="32" cy="22" rx="5" ry="14" fill="#e8dccb" />
          </g>
          <g transform={`rotate(${alerta ? 0 : -55} 46 34)`}>
            <ellipse cx="46" cy="22" rx="5" ry="14" fill="#e8dccb" />
          </g>
          <circle cx="40" cy="48" r="18" fill="#e8dccb" />
          <ellipse cx="40" cy="70" rx="14" ry="9" fill="#d9774f" />
          {cedo ? (
            <>
              <path d="M30 44 l6 6 M36 44 l-6 6" stroke="#3a2e2a" strokeWidth="2" />
              <path d="M44 44 l6 6 M50 44 l-6 6" stroke="#3a2e2a" strokeWidth="2" />
            </>
          ) : (
            <>
              <circle cx="34" cy="46" r={alerta ? 3 : 2.2} fill="#3a2e2a" />
              <circle cx="47" cy="46" r={alerta ? 3 : 2.2} fill="#3a2e2a" />
            </>
          )}
          <circle cx="40" cy="53" r="2" fill="#d98a8a" />
        </g>
        {/* as estrelinhas de quem apertou antes */}
        {cedo &&
          [0, 1, 2].map((i) => (
            <g key={i}>
              {!calmo && <animateTransform attributeName="transform" type="rotate" from={`0 34 22`} to={`360 34 22`} dur="1.2s" repeatCount="indefinite" />}
              <circle cx={22 + i * 12} cy={14 + (i % 2) * 6} r="3" fill="#f2c46a" />
            </g>
          ))}
        {/* o balão do sinal */}
        {sinal && !cedo && !lancou && (
          <g>
            <path d="M66 6 h34 a6 6 0 0 1 6 6 v18 a6 6 0 0 1 -6 6 h-22 l-8 8 v-8 h-4 a6 6 0 0 1 -6 -6 v-18 a6 6 0 0 1 6 -6 z" fill="#f2c46a" />
            <rect x="80" y="11" width="6" height="15" rx="2" fill="#5a3a2a" />
            <circle cx="83" cy="31" r="3" fill="#5a3a2a" />
          </g>
        )}
        {meu === null && !sinal && [0, 1, 2].map((i) => <circle key={i} className="festa-ponto" style={{ animationDelay: `${i * 0.25}s` }} cx={76 + i * 8} cy="20" r="2.5" fill="#e8dccb" />)}
      </svg>
      {cedo && <span className="festa-saque-texto">{t('Cedo demais!')}</span>}
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
