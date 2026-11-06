import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { chave, useT } from '../i18n';
import { tocar } from '../somDosJogos';
import { ehAperto, microjogoDaTela, Moldura, useRelogio, useTeclas, type PropsDoMicro } from './comum';

/**
 * BATE QUANDO DER A FLOR (05/11/2026, server/src/festa/flor.ts): as figuras da horta vão aparecendo no prato, uma de cada vez;
 * quando sai a flor igual à do quadrinho, bate. Bater em outra elimina. Como o sinal do saque, cada figura só chega quando sai,
 * e a reação conta de quando ela APARECEU nesta tela.
 */

const FLOR = 0;
const REACAO_MINIMA = 100;

/** As figuras, centradas em (0, 0), com uns 60 de altura. */
function Figura({ tipo }: { tipo: number }) {
  switch (tipo) {
    case 0:
    case 1: {
      // a flor que vale (amarela) e a parecida (rosa): o mesmo desenho, outra cor
      const petala = tipo === 0 ? '#f2c94c' : '#e88fb4';
      const borda = tipo === 0 ? '#c99a1e' : '#b8587e';
      return (
        <g>
          <path d="M0 8 Q-2 22 0 32" stroke="#4f7d3a" strokeWidth="4" fill="none" />
          <path d="M0 22 Q-12 14 -16 22 Q-8 28 0 24" fill="#6fa356" />
          {Array.from({ length: 8 }, (_, k) => (
            <ellipse key={k} cx="0" cy="-15" rx="6.5" ry="12" fill={petala} stroke={borda} strokeWidth="1.2" transform={`rotate(${k * 45})`} />
          ))}
          <circle cx="0" cy="0" r="9" fill="#a0612a" stroke="#6e3f18" strokeWidth="1.2" />
          <circle cx="-3" cy="-2" r="1.4" fill="#6e3f18" />
          <circle cx="3" cy="1" r="1.4" fill="#6e3f18" />
          <circle cx="0" cy="4" r="1.4" fill="#6e3f18" />
        </g>
      );
    }
    case 2:
      return (
        <g transform="rotate(20)">
          <path d="M-11 -14 L11 -14 L0 30 Z" fill="#e07a2e" stroke="#9a4a1a" strokeWidth="1.2" />
          <path d="M-5 -6 L3 -5 M-4 6 L3 7" stroke="#b85a1e" strokeWidth="2" />
          <path d="M-5 -14 L-11 -30 M0 -14 L0 -32 M5 -14 L11 -30" stroke="#6fa356" strokeWidth="5" strokeLinecap="round" />
        </g>
      );
    case 3:
      return (
        <g>
          <circle cx="0" cy="2" r="26" fill="#9ccf6e" stroke="#5d8f47" strokeWidth="1.5" />
          <path d="M0 -22 Q-14 0 0 26 M0 -22 Q14 0 0 26 M-22 -6 Q0 2 22 -6" stroke="#5d8f47" strokeWidth="2" fill="none" />
          <circle cx="0" cy="4" r="10" fill="#c6e59a" />
        </g>
      );
    case 4:
      return (
        <g>
          <circle cx="0" cy="8" r="18" fill="#c8375a" stroke="#8a1f3a" strokeWidth="1.5" />
          <path d="M0 26 L0 34" stroke="#e8dccb" strokeWidth="3" strokeLinecap="round" />
          <path d="M0 -10 Q-12 -30 -18 -26 Q-12 -14 0 -10 M0 -10 Q12 -30 18 -26 Q12 -14 0 -10" fill="#6fa356" />
          <ellipse cx="-6" cy="2" rx="4" ry="6" fill="rgba(255,255,255,0.3)" />
        </g>
      );
    default:
      return (
        <g>
          <rect x="-7" y="0" width="14" height="24" rx="5" fill="#f2efe6" stroke="#b8a888" strokeWidth="1.5" />
          <path d="M-26 4 Q-26 -26 0 -26 Q26 -26 26 4 Z" fill="#c0503a" stroke="#7a2a1a" strokeWidth="1.5" />
          <circle cx="-12" cy="-10" r="4" fill="#f2efe6" />
          <circle cx="8" cy="-16" r="3.5" fill="#f2efe6" />
          <circle cx="14" cy="-4" r="3" fill="#f2efe6" />
        </g>
      );
  }
}

/** Uma pata de coelho, de cima (a esquerda; a direita é espelhada). */
function Pata({ x, y, espelhar }: { x: number; y: number; espelhar?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${espelhar ? -1 : 1} 1)`}>
      <ellipse cx="0" cy="0" rx="17" ry="13" fill="#e8dccb" stroke="#b8a888" strokeWidth="1.5" />
      <ellipse cx="0" cy="3" rx="7" ry="5" fill="#e4b5b0" />
      {[-9, 0, 9].map((dx) => (
        <ellipse key={dx} cx={dx} cy="-9" rx="3.5" ry="3" fill="#e4b5b0" />
      ))}
    </g>
  );
}

function Flor({ dados, inicio, ativo, enviar, lance }: PropsDoMicro<{ figuras?: { t: number; tipo: number }[]; fim?: number }>) {
  const t = useT();
  const figuras = dados.figuras ?? [];
  const fim = dados.fim ?? 0;
  const i = figuras.length - 1;
  const atual = figuras[i];
  /** Quando cada figura apareceu nesta tela. */
  const vistaEm = useRef<number[]>([]);
  const [batidas, setBatidas] = useState<{ i: number; em: number }[]>([]);
  const [fora, setFora] = useState(false);
  const [mandou, setMandou] = useState(false);
  const agora = useRelogio(ativo && !mandou);
  const e = agora - inicio;

  useLayoutEffect(() => {
    if (i < 0 || vistaEm.current[i] !== undefined) return;
    vistaEm.current[i] = performance.now();
    // o quadro em que a figura foi pintada
    requestAnimationFrame(() => (vistaEm.current[i] = performance.now()));
  }, [i]);

  const terminar = () => {
    if (mandou) return;
    setMandou(true);
    enviar({});
  };
  // a última figura saiu da mesa: vai o fim
  const acabou = fim > 0 && e >= fim;
  useEffect(() => {
    if (ativo && acabou) terminar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo, acabou]);

  const bater = () => {
    if (!ativo || fora || mandou || !atual || vistaEm.current[i] === undefined || batidas.some((b) => b.i === i)) return;
    const reacao = Math.round(performance.now() - vistaEm.current[i]);
    setBatidas((l) => [...l, { i, em: Date.now() }]);
    if (atual.tipo !== FLOR || reacao < REACAO_MINIMA) {
      // a batida errada vai junto com o fim (separadas, o fim podia chegar antes dela)
      setFora(true);
      setMandou(true);
      tocar('erro');
      // um instante depois, para o X ser visto (sendo o último, a revelação vem na hora)
      setTimeout(() => enviar({ i, reacaoMs: reacao }), 600);
      return;
    }
    tocar('acerto');
    lance({ i, reacaoMs: reacao });
  };
  useTeclas(ativo && !fora && !mandou, (ev) => {
    if (!ehAperto(ev)) return false;
    bater();
    return true;
  });

  const ultima = batidas[batidas.length - 1];
  const batendo = ultima && Date.now() - ultima.em < 180;
  const flores = batidas.filter((b) => figuras[b.i]?.tipo === FLOR).length - (fora && atual?.tipo === FLOR ? 1 : 0);
  // a figura nova entra crescendo (com "menos movimento", já do tamanho)
  const surgiu = vistaEm.current[i] !== undefined ? Math.min(1, (performance.now() - vistaEm.current[i]) / 90) : 1;

  return (
    <Moldura placar={`🌻 × ${Math.max(0, flores)}`} fracao={fim ? e / fim : 0}>
      <svg
        viewBox="0 0 300 200"
        role="button"
        aria-label={t(NOME)}
        style={{ width: '100%', touchAction: 'none', cursor: ativo && !fora ? 'pointer' : 'default' }}
        onPointerDown={(ev) => {
          ev.preventDefault();
          bater();
        }}
      >
        {/* a mesa e o prato */}
        <rect x="0" y="0" width="300" height="200" rx="12" fill="#a97c50" />
        {[40, 80, 120, 160].map((y) => (
          <path key={y} d={`M0 ${y} H300`} stroke="#9a6e48" strokeWidth="2" />
        ))}
        <ellipse cx="150" cy="104" rx="70" ry="62" fill="#f2efe6" stroke="#cdbfa3" strokeWidth="3" />
        <ellipse cx="150" cy="104" rx="54" ry="47" fill="none" stroke="#e3d8c2" strokeWidth="2" />
        {/* o quadrinho com a flor que vale */}
        <rect x="10" y="10" width="54" height="54" rx="6" fill="#fff7e0" stroke="#5a3a2a" strokeWidth="3" />
        <g transform="translate(37 34) scale(0.55)">
          <Figura tipo={FLOR} />
        </g>
        {atual && (
          <g transform={`translate(150 100) scale(${0.6 + 0.4 * surgiu})`} opacity={fora ? 0.5 : 1}>
            <Figura tipo={atual.tipo} />
          </g>
        )}
        {/* as patas: descem no prato quando bate */}
        <Pata x={batendo ? 128 : 92} y={batendo ? 128 : 182} />
        <Pata x={batendo ? 172 : 208} y={batendo ? 128 : 182} espelhar />
        {fora && <path d="M118 70 L182 134 M182 70 L118 134" stroke="#d9534f" strokeWidth="10" strokeLinecap="round" opacity="0.85" />}
      </svg>
    </Moldura>
  );
}

const NOME = chave('Bate quando der a flor');

export default microjogoDaTela({
  id: 'flor',
  nome: NOME,
  dica: chave('Bata quando aparecer a flor igual à do quadrinho. Na figura errada, está fora.'),
  Tela: Flor,
  valor: (v) => `🌻 × ${v}`,
});
