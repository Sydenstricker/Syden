import { useEffect, useState } from 'react';
import { chave, useT } from '../i18n';
import { tocar } from '../somDosJogos';
import { CoelhoDeFrente, microjogoDaTela, Moldura, useRelogio, useTeclas, type PropsDoMicro } from './comum';

/**
 * PRAGA NA TOCA (05/11/2026, server/src/festa/praga.ts): as lagartas saem das seis tocas e cada um bate nelas; o coelhinho
 * que sai de vez em quando não se bate (custa dois). Cada batida vai na hora; o servidor confere pelo instante.
 */

// Os mesmos números do servidor.
const PRAGA_MS = 20000;
const CUSTO_DO_COELHO = 2;
/** Quanto leva para sair e voltar para a toca (só o desenho). */
const SOBE_MS = 140;

interface Bicho {
  t: number;
  toca: number;
  vida: number;
  coelho: boolean;
}

/** O centro de cada toca no desenho: duas fileiras de três. */
const TOCA = Array.from({ length: 6 }, (_, i) => ({ x: 55 + (i % 3) * 95, y: 82 + Math.floor(i / 3) * 78 }));

function Lagarta() {
  return (
    <g>
      {[-16, -6, 4].map((dx, k) => (
        <circle key={k} cx={dx} cy={-10 - k * 3} r={9} fill={k % 2 ? '#7cb85a' : '#8ccc66'} stroke="#4f7d3a" strokeWidth="1.5" />
      ))}
      <circle cx="12" cy="-22" r="12" fill="#9ad470" stroke="#4f7d3a" strokeWidth="1.5" />
      <path d="M8 -33 L4 -42 M16 -33 L20 -42" stroke="#4f7d3a" strokeWidth="2" strokeLinecap="round" />
      <circle cx="4" cy="-42" r="2.2" fill="#d9534f" />
      <circle cx="20" cy="-42" r="2.2" fill="#d9534f" />
      {/* a cara de quem está comendo a horta */}
      <circle cx="8" cy="-24" r="2.6" fill="#fff" />
      <circle cx="17" cy="-24" r="2.6" fill="#fff" />
      <circle cx="8.6" cy="-23.5" r="1.4" fill="#2a2a2a" />
      <circle cx="17.6" cy="-23.5" r="1.4" fill="#2a2a2a" />
      <path d="M8 -16 Q12.5 -13 17 -16" stroke="#2a2a2a" strokeWidth="1.6" fill="none" strokeLinecap="round" />
    </g>
  );
}

function Praga({ dados, inicio, ativo, enviar, lance }: PropsDoMicro<{ bichos?: Bicho[] }>) {
  const t = useT();
  const bichos = dados.bichos ?? [];
  const [batidos, setBatidos] = useState<{ i: number; em: number }[]>([]);
  const agora = useRelogio(ativo);
  const e = agora - inicio;
  const foiBatido = (i: number) => batidos.some((b) => b.i === i);
  const pragas = batidos.filter((b) => !bichos[b.i]?.coelho).length;
  const coelhos = batidos.length - pragas;
  const pontos = Math.max(0, pragas - CUSTO_DO_COELHO * coelhos);

  /** Quem está fora da toca agora (e o quanto já saiu, de 0 a 1). */
  const naToca = (toca: number) => {
    for (let i = 0; i < bichos.length; i++) {
      const b = bichos[i];
      if (b.toca !== toca || e < b.t || e >= b.t + b.vida) continue;
      const fora = Math.min(1, (e - b.t) / SOBE_MS, (b.t + b.vida - e) / SOBE_MS);
      return { i, b, fora };
    }
    return null;
  };

  const bater = (toca: number) => {
    if (!ativo || Date.now() - inicio >= PRAGA_MS) return;
    const achado = naToca(toca);
    if (!achado || foiBatido(achado.i)) return;
    setBatidos((l) => [...l, { i: achado.i, em: Date.now() }]);
    tocar(achado.b.coelho ? 'erro' : 'soco');
    // cada batida vai na hora: o servidor confere no relógio dele que o bicho estava fora
    lance({ i: achado.i });
  };
  useEffect(() => {
    if (ativo && e >= PRAGA_MS) enviar({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo, e >= PRAGA_MS]);
  useTeclas(ativo, (ev) => {
    const n = Number(ev.key);
    if (!Number.isInteger(n) || n < 1 || n > 6) return false;
    bater(n - 1);
    return true;
  });

  return (
    <Moldura placar={`🐛 × ${pontos}`} fracao={e / PRAGA_MS}>
      <svg viewBox="0 0 300 200" role="group" aria-label={t(NOME)} style={{ width: '100%', touchAction: 'none', cursor: ativo ? 'pointer' : 'default' }}>
        {/* a horta: a terra, a grama em cima e umas folhas de enfeite */}
        <rect x="0" y="0" width="300" height="200" rx="12" fill="#8a6548" />
        <rect x="0" y="0" width="300" height="26" rx="12" fill="#6fa356" />
        <rect x="0" y="16" width="300" height="10" fill="#6fa356" />
        {[20, 70, 125, 180, 235, 280].map((x, k) => (
          <path key={k} d={`M${x} 26 q4 -14 8 0 q4 -12 8 0`} fill="#5d8f47" />
        ))}
        {[[28, 128], [150, 122], [272, 130], [100, 190], [205, 190]].map(([x, y], k) => (
          <circle key={k} cx={x} cy={y} r={2} fill="#6e4f38" />
        ))}
        {TOCA.map(({ x, y }, toca) => {
          const achado = naToca(toca);
          const batido = achado ? batidos.find((b) => b.i === achado.i) : undefined;
          // batido: some para dentro da toca na hora (a lagarta amassada; o coelhinho tonto)
          const fora = achado ? (batido ? Math.max(0, 1 - (agora - batido.em) / 250) : achado.fora) : 0;
          return (
            <g
              key={toca}
              onPointerDown={(ev) => {
                ev.preventDefault();
                bater(toca);
              }}
            >
              {/* a toca: o buraco, e o que sai dele fica recortado pela borda */}
              <ellipse cx={x} cy={y} rx="36" ry="13" fill="#3e2a1e" />
              <clipPath id={`praga-toca-${toca}`}>
                <rect x={x - 40} y={y - 70} width="80" height="70" />
              </clipPath>
              {achado && fora > 0 && (
                <g clipPath={`url(#praga-toca-${toca})`}>
                  <g transform={`translate(${x} ${y + 4 + (1 - fora) * 50}) scale(1.3 ${batido ? 0.9 : 1.3})`}>
                    {achado.b.coelho ? <CoelhoDeFrente y={-10} escala={0.95} olhos={batido ? 'tontos' : 'abertos'} /> : <Lagarta />}
                  </g>
                </g>
              )}
              <path d={`M${x - 36} ${y} A36 13 0 0 0 ${x + 36} ${y}`} fill="none" stroke="#a37b58" strokeWidth="5" />
              {/* a estrela da batida */}
              {batido && agora - batido.em < 300 && (
                <path
                  transform={`translate(${x} ${y - 28})`}
                  d="M0 -14 L4 -4 L14 -4 L6 2 L9 12 L0 6 L-9 12 L-6 2 L-14 -4 L-4 -4 Z"
                  fill={achado!.b.coelho ? '#d9534f' : '#f2c46a'}
                />
              )}
              <rect x={x - 45} y={y - 60} width="90" height="76" fill="transparent" />
            </g>
          );
        })}
      </svg>
    </Moldura>
  );
}

const NOME = chave('Praga na toca');

export default microjogoDaTela({
  id: 'praga',
  nome: NOME,
  dica: chave('Bata nas lagartas que saírem das tocas. No coelhinho, não!'),
  Tela: Praga,
  valor: (v) => `🐛 × ${v}`,
  errouComValor: true,
});
