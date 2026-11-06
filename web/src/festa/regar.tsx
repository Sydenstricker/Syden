import { useEffect, useRef } from 'react';
import { chave, useT } from '../i18n';
import { tocar } from '../somDosJogos';
import { microjogoDaTela, Moldura, useFormatos, useRelogio, type PropsDoMicro } from './comum';
import { anotarDirecao, useDirecao, usePassos } from './lote2comum';
import { CANTEIROS, nuvemInicial, PASSO_MS, passoDaNuvem, RAIO_DA_CHUVA, RAJADA_MS, REGAR_MS, REGAR_PASSOS, sedeEm, type DadosRegar, type Entrada } from './lote2sim';

/**
 * REGAR A HORTA (05/11/2026, server/src/festa/regar.ts): um canteiro de cada vez fica com sede, e cada um sopra a SUA nuvem até
 * ele, contra o vento. A nuvem anda pela mesma conta do servidor (./lote2sim), e cada mudança de direção vai na hora.
 */

function Planta({ sede, cresceu }: { sede: boolean; cresceu: number }) {
  // murcha (caída e amarelada) com sede; molhada, cresce um pouco
  const s = 0.8 + Math.min(0.5, cresceu);
  return (
    <g transform={`scale(${s})`}>
      <path d={sede ? 'M0 0 Q2 -8 8 -10' : 'M0 0 L0 -14'} stroke={sede ? '#9a9a4a' : '#4f8a3a'} strokeWidth="2.2" fill="none" />
      <ellipse cx={sede ? 9 : -5} cy={sede ? -8 : -10} rx="5" ry="2.5" fill={sede ? '#c2b45a' : '#6fb34e'} transform={sede ? 'rotate(30 9 -8)' : 'rotate(-30 -5 -10)'} />
      <ellipse cx={sede ? 4 : 5} cy={sede ? -5 : -13} rx="5" ry="2.5" fill={sede ? '#b5a84e' : '#7cc45a'} transform={sede ? 'rotate(60 4 -5)' : 'rotate(30 5 -13)'} />
    </g>
  );
}

function Regar({ dados, inicio, ativo, enviar, lance }: PropsDoMicro<DadosRegar>) {
  const t = useT();
  const f = useFormatos();
  const { svg, ponteiro, ler } = useDirecao(ativo);
  const agora = useRelogio(ativo);
  const e = agora - inicio;
  const entradas = useRef<Entrada[]>([]);
  const ok = !!dados.sede && !!dados.ventos;
  const { s, antes, entre } = usePassos(e, nuvemInicial, (n) => (ok ? passoDaNuvem(n, dados, entradas.current) : n.n++), REGAR_PASSOS);
  const fim = useRef(false);
  const aguaAntes = useRef(0);
  const molhadoDesde = useRef<number | null>(null);

  useEffect(() => {
    if (!ativo || fim.current || e < 0) return;
    if (s.n >= REGAR_PASSOS) {
      fim.current = true;
      tocar('fim');
      enviar({});
      return;
    }
    anotarDirecao(entradas.current, s.n, ler([s.x, s.y], 10), lance);
    // começou a chover no canteiro com sede: o barulhinho de água
    const molhando = s.agua > aguaAntes.current;
    if (molhando && molhadoDesde.current === null) {
      molhadoDesde.current = e;
      tocar('agua');
    }
    if (!molhando) molhadoDesde.current = null;
    aguaAntes.current = s.agua;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agora]);

  if (!ok) return <Moldura placar="💧" fracao={0}>{null}</Moldura>;
  const x = entre(antes.x, s.x);
  const y = entre(antes.y, s.y);
  const sede = sedeEm(dados, s.n);
  const vento = dados.ventos[Math.min(dados.ventos.length - 1, Math.floor((s.n * PASSO_MS) / RAJADA_MS))];
  const [cx, cy] = CANTEIROS[sede];
  const molhando = (x - cx) ** 2 + (y - cy) ** 2 <= RAIO_DA_CHUVA * RAIO_DA_CHUVA;
  return (
    <Moldura placar={`💧 ${f.s.format((s.agua * PASSO_MS) / 1000)}`} fracao={e / REGAR_MS}>
      <svg
        ref={svg}
        viewBox="0 0 300 200"
        role="img"
        aria-label={t(NOME)}
        style={{ width: '100%', touchAction: 'none', cursor: ativo ? 'crosshair' : 'default' }}
        {...ponteiro}
      >
        <rect x="0" y="0" width="300" height="200" rx="12" fill="#7cb85a" />
        {[[30, 104], [270, 104], [150, 22], [150, 182], [105, 40], [195, 165]].map(([gx, gy], k) => (
          <path key={k} d={`M${gx} ${gy} q3 -8 6 0 q3 -7 6 0`} fill="#5d8f47" />
        ))}
        {/* os canteiros: o com sede tem a planta murcha e o anel pulsando */}
        {CANTEIROS.map(([px, py], k) => (
          <g key={k} transform={`translate(${px} ${py})`}>
            {k === sede && <circle r={RAIO_DA_CHUVA + 4 + 3 * Math.sin(e / 150)} fill="none" stroke="#f2e6a6" strokeWidth="2.5" strokeDasharray="5 4" />}
            <ellipse rx="26" ry="15" fill={k === sede ? '#a3784f' : '#7a5238'} stroke="#5a3a2a" strokeWidth="2" />
            {[-12, 0, 12].map((dx) => (
              <g key={dx} transform={`translate(${dx} ${dx === 0 ? 2 : -2})`}>
                <Planta sede={k === sede && !molhando} cresceu={k === sede && molhando ? 0.25 : 0} />
              </g>
            ))}
          </g>
        ))}
        {/* o vento: as folhinhas voando para o lado dele */}
        {Array.from({ length: 6 }, (_, k) => {
          const passo = ((e / 1000) * 90 + k * 55) % 330;
          const fx = (k * 61 + passo * vento[0] + 330) % 330 - 15;
          const fy = (k * 37 + passo * vento[1] + 230) % 230 - 15;
          return <ellipse key={k} cx={fx} cy={fy} rx="3.5" ry="1.6" fill="#b9d88a" opacity={0.3 + Math.abs(vento[0]) * 0.3 + Math.abs(vento[1]) * 0.3} transform={`rotate(${k * 40} ${fx} ${fy})`} />;
        })}
        {/* a sombra da nuvem no chão, a chuva e a nuvem um pouco acima */}
        <ellipse cx={x} cy={y} rx={RAIO_DA_CHUVA} ry={RAIO_DA_CHUVA * 0.55} fill="rgba(40,60,90,0.25)" />
        {Array.from({ length: 9 }, (_, k) => {
          const dx = ((k * 7) % 9) * 5 - 20;
          const queda = (e / 3 + k * 13) % 26;
          return <line key={k} x1={x + dx} y1={y - 26 + queda} x2={x + dx - 1} y2={y - 21 + queda} stroke={molhando ? '#5fb0e8' : '#9cc9e6'} strokeWidth="1.6" strokeLinecap="round" />;
        })}
        <g transform={`translate(${x} ${y - 30})`}>
          <ellipse cx="-12" cy="2" rx="14" ry="10" fill="#e3e8ee" />
          <ellipse cx="10" cy="2" rx="15" ry="11" fill="#e9edf2" />
          <ellipse cx="0" cy="-6" rx="15" ry="12" fill="#f4f6f9" />
          <ellipse cx="0" cy="6" rx="24" ry="6" fill="#d4dbe3" />
          <circle cx="-5" cy="-2" r="1.6" fill="#5a6470" />
          <circle cx="5" cy="-2" r="1.6" fill="#5a6470" />
          <path d={molhando ? 'M-4 3 Q0 6 4 3' : 'M-3 4 L3 4'} stroke="#5a6470" strokeWidth="1.3" fill="none" strokeLinecap="round" />
        </g>
      </svg>
    </Moldura>
  );
}

const NOME = chave('Regar a horta');

export default microjogoDaTela({
  id: 'regar',
  nome: NOME,
  dica: chave('Leve a nuvem até o canteiro com sede.'),
  Tela: Regar,
  valor: (v, f) => `💧 ${f.s.format(v / 1000)}`,
  errouComValor: true,
});
