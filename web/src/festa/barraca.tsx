import { useEffect, useState } from 'react';
import { chave, useT } from '../i18n';
import { tocar } from '../somDosJogos';
import { CoelhoDeFrente, microjogoDaTela, Moldura, useRelogio, useTeclas, type PropsDoMicro } from './comum';

/**
 * BARRACA DE TIRO DA QUERMESSE (05/11/2026, server/src/festa/barraca.ts): três trilhos levam figuras de madeira de um lado para o
 * outro. Corvo se acerta; o coelhinho custa dois. Toca-se na figura, ou 1, 2, 3 atiram na mira do meio de cada trilho.
 */

// Os mesmos números e a mesma conta do servidor.
const BARRACA_MS = 20000;
const LARGURA = 300;
const MARGEM = 24;
const CUSTO_DO_COELHO = 2;
interface Figura {
  t: number;
  trilho: number;
  dir: number;
  vel: number;
  coelho: boolean;
}
const posicaoDaFigura = (f: Figura, t: number) => {
  const andou = ((t - f.t) * f.vel) / 1000;
  return f.dir > 0 ? -MARGEM + andou : LARGURA + MARGEM - andou;
};

const NOME = chave('Barraca de tiro');
const TRILHO_Y = [72, 122, 172];
/** A mira de cada trilho (as teclas): a figura com o centro até aqui do meio é acertada. */
const MIRA = 22;

function Corvo() {
  return (
    <g>
      <rect x="-2" y="-6" width="4" height="10" fill="#8e6a4a" />
      <ellipse cx="0" cy="-20" rx="15" ry="13" fill="#2e2b33" stroke="#f4ede2" strokeWidth="1.5" />
      <path d="M-14 -22 Q-24 -30 -16 -12 Z" fill="#45404d" />
      <circle cx="9" cy="-30" r="9" fill="#2e2b33" stroke="#f4ede2" strokeWidth="1.5" />
      <circle cx="11" cy="-32" r="2.6" fill="#f4ede2" />
      <circle cx="11.6" cy="-32" r="1.3" fill="#3a2e2a" />
      <path d="M17 -30 L26 -27 L17 -25 Z" fill="#f2c46a" />
      {/* o alvo pintado no peito */}
      <circle cx="-1" cy="-17" r="5" fill="#d9534f" />
      <circle cx="-1" cy="-17" r="2" fill="#f4ede2" />
    </g>
  );
}

function Coelhinho() {
  return (
    <g>
      <rect x="-2" y="-6" width="4" height="10" fill="#8e6a4a" />
      <ellipse cx="0" cy="-14" rx="11" ry="10" fill="#e8dccb" stroke="#f4ede2" strokeWidth="1.5" />
      <CoelhoDeFrente y={-20} escala={0.95} />
      {/* o laço azul: inocente */}
      <path d="M-6 -6 L0 -9 L6 -6 L6 -12 L0 -9 L-6 -12 Z" fill="#6aa7c8" />
    </g>
  );
}

function Barraca({ dados, inicio, ativo, enviar, lance }: PropsDoMicro<{ figuras?: Figura[] }>) {
  const t = useT();
  const figuras = dados.figuras ?? [];
  const [acertos, setAcertos] = useState<{ i: number; em: number }[]>([]);
  const [tiro, setTiro] = useState<{ x: number; y: number; em: number } | null>(null);
  const agora = useRelogio(ativo);
  const e = agora - inicio;
  const foiAcertada = (i: number) => acertos.some((a) => a.i === i);
  const corvos = acertos.filter((a) => !figuras[a.i]?.coelho).length;
  const pontos = Math.max(0, corvos - CUSTO_DO_COELHO * (acertos.length - corvos));

  const naBarraca = (i: number, ms: number) => {
    const x = posicaoDaFigura(figuras[i], ms);
    return ms >= figuras[i].t && x >= -MARGEM && x <= LARGURA + MARGEM;
  };
  const atirar = (i: number) => {
    const ms = Date.now() - inicio;
    if (!ativo || ms >= BARRACA_MS || i < 0 || foiAcertada(i) || !naBarraca(i, ms)) return;
    setAcertos((l) => [...l, { i, em: Date.now() }]);
    setTiro({ x: posicaoDaFigura(figuras[i], ms), y: TRILHO_Y[figuras[i].trilho] - 20, em: Date.now() });
    tocar(figuras[i].coelho ? 'erro' : 'tiro');
    // cada tiro vai na hora: o servidor confere no relógio dele que a figura estava na barraca
    lance({ i });
  };
  /** A tecla do trilho: a figura mais perto da mira do meio, se estiver nela. */
  const atirarNaMira = (trilho: number) => {
    const ms = Date.now() - inicio;
    let melhor = -1;
    let perto = MIRA;
    figuras.forEach((f, i) => {
      if (f.trilho !== trilho || foiAcertada(i) || !naBarraca(i, ms)) return;
      const d = Math.abs(posicaoDaFigura(f, ms) - LARGURA / 2);
      if (d <= perto) {
        perto = d;
        melhor = i;
      }
    });
    if (melhor >= 0) atirar(melhor);
    else {
      setTiro({ x: LARGURA / 2, y: TRILHO_Y[trilho] - 20, em: Date.now() });
      tocar('clique');
    }
  };
  useEffect(() => {
    if (ativo && e >= BARRACA_MS) enviar({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo, e >= BARRACA_MS]);
  useTeclas(ativo, (ev) => {
    const n = Number(ev.key);
    if (!Number.isInteger(n) || n < 1 || n > 3) return false;
    atirarNaMira(n - 1);
    return true;
  });

  return (
    <Moldura placar={`🎯 × ${pontos}`} fracao={e / BARRACA_MS}>
      <svg viewBox="0 0 300 200" role="group" aria-label={t(NOME)} style={{ width: '100%', touchAction: 'none', userSelect: 'none' }}>
        {/* a barraca: o toldo listrado, o fundo e os três trilhos */}
        <rect x="0" y="0" width="300" height="200" rx="12" fill="#3e6f8c" />
        {Array.from({ length: 10 }, (_, k) => (
          <path key={k} d={`M${k * 30} 0 h30 v20 q-15 10 -30 0 Z`} fill={k % 2 ? '#f4ede2' : '#d9534f'} />
        ))}
        {TRILHO_Y.map((y, trilho) => (
          <g key={trilho}>
            <rect x="0" y={y} width="300" height="8" fill="#8e6a4a" />
            <rect x="0" y={y + 8} width="300" height="3" fill="#6e4f38" />
            {/* a mira do meio, e o número da tecla */}
            <circle cx="150" cy={y - 20} r={MIRA} fill="none" stroke="#f2c46a" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.7" />
            <text x="150" y={y + 7} textAnchor="middle" fontSize="7" fontWeight="700" fill="#f2e2c4">
              {trilho + 1}
            </text>
          </g>
        ))}
        {figuras.map((f, i) => {
          if (!naBarraca(i, e)) return null;
          const acerto = acertos.find((a) => a.i === i);
          // acertada, ela tomba para trás e some
          const tombo = acerto ? Math.min(1, (Date.now() - acerto.em) / 250) : 0;
          if (tombo >= 1) return null;
          const x = posicaoDaFigura(f, e);
          return (
            <g
              key={i}
              transform={`translate(${x} ${TRILHO_Y[f.trilho]}) scale(${f.dir < 0 && !f.coelho ? -1 : 1} ${1 - tombo})`}
              style={{ cursor: ativo ? 'crosshair' : 'default' }}
              onPointerDown={(ev) => {
                ev.preventDefault();
                atirar(i);
              }}
            >
              {f.coelho ? <Coelhinho /> : <Corvo />}
              <rect x="-22" y="-46" width="44" height="50" fill="transparent" />
            </g>
          );
        })}
        {/* o estalo do tiro */}
        {tiro && Date.now() - tiro.em < 160 && (
          <path
            transform={`translate(${tiro.x} ${tiro.y})`}
            d="M0 -12 L3 -3 L12 0 L3 3 L0 12 L-3 3 L-12 0 L-3 -3 Z"
            fill="#f2c46a"
            opacity={1 - (Date.now() - tiro.em) / 160}
          />
        )}
      </svg>
    </Moldura>
  );
}

export default microjogoDaTela({
  id: 'barraca',
  nome: NOME,
  dica: chave('Acerte os corvos que passarem. No coelhinho, não!'),
  Tela: Barraca,
  valor: (v) => `🎯 × ${v}`,
  errouComValor: true,
});
