import { useEffect, useRef, useState } from 'react';
import { chave, useT } from '../i18n';
import { tocar } from '../somDosJogos';
import { ehAperto, microjogoDaTela, Moldura, useFormatos, useRelogio, useTeclas, type PropsDoMicro } from './comum';

/**
 * RETRATO DO COELHO (05/11/2026, server/src/festa/retrato.ts): o retrato está cortado em três faixas que correm de um lado para
 * o outro; cada aperto para a de cima que ainda corre. Cada parada vai na hora, e o servidor refaz a mesma conta.
 */

// Os mesmos números e a mesma conta do servidor.
const FAIXAS = 3;
const AMPLITUDE = 60;
const RETRATO_MS = 10000;
const ENTRE_PARADAS_MS = 200;
const REACAO_MINIMA = 100;
function deslocamento(f: { periodo: number; fase: number }, t: number): number {
  const u = ((t + f.fase) % f.periodo) / f.periodo;
  const x = u < 0.5 ? 4 * u - 1 : 3 - 4 * u;
  return Math.round(AMPLITUDE * x);
}
const precisao = (erro: number) => Math.round(100 - (erro * 100) / (FAIXAS * AMPLITUDE));

/** As faixas no desenho (de cima para baixo): as orelhas, os olhos, o focinho. */
const CORTES = [8, 76, 122, 176];
const NOME = chave('Retrato do coelho');

/** O retrato inteiro, de frente (o coelho da festa, grande), para cada faixa recortar o seu pedaço. */
function Rosto() {
  return (
    <g>
      {/* o capuz do moletom, embaixo */}
      <path d="M96 176 Q100 150 150 150 Q200 150 204 176 Z" fill="#6aa7c8" />
      <path d="M128 152 L150 166 L172 152" stroke="#3e6f8c" strokeWidth="3" fill="none" />
      <g transform="translate(150 166) scale(4)">
        <ellipse cx="-6" cy="-30" rx="3.5" ry="9" fill="#e8dccb" />
        <ellipse cx="6" cy="-30" rx="3.5" ry="9" fill="#e8dccb" />
        <ellipse cx="-6" cy="-29" rx="1.5" ry="6" fill="#e4b5b0" />
        <ellipse cx="6" cy="-29" rx="1.5" ry="6" fill="#e4b5b0" />
        <circle cx="0" cy="-12" r="12" fill="#e8dccb" />
        <circle cx="-4" cy="-13" r="1.8" fill="#3a2e2a" />
        <circle cx="4" cy="-13" r="1.8" fill="#3a2e2a" />
        <circle cx="-3.5" cy="-13.6" r="0.6" fill="#fff" />
        <circle cx="4.5" cy="-13.6" r="0.6" fill="#fff" />
        <circle cx="-7.5" cy="-8.5" r="1.8" fill="#e4b5b0" opacity="0.7" />
        <circle cx="7.5" cy="-8.5" r="1.8" fill="#e4b5b0" opacity="0.7" />
        <circle cx="0" cy="-9" r="1.5" fill="#d98a8a" />
        <path d="M0 -7.5 L0 -6 M-2.2 -5 Q-1 -4 0 -6 Q1 -4 2.2 -5" stroke="#3a2e2a" strokeWidth="0.5" fill="none" strokeLinecap="round" />
      </g>
    </g>
  );
}

function Retrato({ dados, inicio, ativo, enviar, lance }: PropsDoMicro<{ faixas?: { periodo: number; fase: number }[] }>) {
  const t = useT();
  const f = useFormatos();
  const faixas = dados.faixas ?? [];
  const paradas = useRef<number[]>([]);
  const [, setParou] = useState(0);
  const [acabou, setAcabou] = useState(false);
  const agora = useRelogio(ativo);
  const e = Math.min(agora - inicio, RETRATO_MS);

  const parar = () => {
    if (!ativo || acabou || faixas.length < FAIXAS) return;
    const ms = Math.round(Date.now() - inicio);
    const ultima = paradas.current[paradas.current.length - 1];
    if (ms < REACAO_MINIMA || ms > RETRATO_MS || (ultima !== undefined && ms < ultima + ENTRE_PARADAS_MS)) return;
    const k = paradas.current.length;
    paradas.current.push(ms);
    setParou((n) => n + 1);
    // cada parada vai na hora: o servidor confere no relógio dele e refaz onde a faixa estava
    lance({ t: ms });
    tocar(Math.abs(deslocamento(faixas[k], ms)) <= 4 ? 'acerto' : 'clique');
    if (k + 1 === FAIXAS) {
      setAcabou(true);
      tocar('fim');
      // o retrato montado fica um instante na tela antes de o fim ir
      setTimeout(() => enviar({}), 600);
    }
  };
  useEffect(() => {
    if (ativo && !acabou && agora - inicio >= RETRATO_MS) enviar({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo, acabou, agora - inicio >= RETRATO_MS]);
  useTeclas(ativo && !acabou, (ev) => {
    if (!ehAperto(ev) && ev.key !== 'ArrowDown' && ev.key.toLowerCase() !== 's') return false;
    parar();
    return true;
  });

  const feitas = paradas.current.length;
  const posicao = (k: number) => (faixas[k] ? deslocamento(faixas[k], paradas.current[k] ?? Math.max(0, e)) : 0);
  const erro = paradas.current.reduce((s, p, k) => s + Math.abs(deslocamento(faixas[k], p)), 0);
  const placar = feitas === FAIXAS ? f.pct.format(precisao(erro) / 100) : `${feitas}/${FAIXAS}`;

  return (
    <Moldura placar={placar} fracao={e / RETRATO_MS}>
      <svg
        viewBox="0 0 300 200"
        role="button"
        aria-label={t(NOME)}
        style={{ width: '100%', touchAction: 'none', cursor: ativo ? 'pointer' : 'default' }}
        onPointerDown={(ev) => {
          ev.preventDefault();
          parar();
        }}
      >
        {/* a parede da toca, e a moldura dourada do retrato */}
        <rect x="0" y="0" width="300" height="200" rx="12" fill="#c9a77c" />
        <path d="M0 40 H300 M0 90 H300 M0 140 H300" stroke="#b8936a" strokeWidth="2" />
        <rect x="62" y="2" width="176" height="184" rx="6" fill="#a97c50" />
        <rect x="70" y="8" width="160" height="168" fill="#f2e2c4" />
        <defs>
          {CORTES.slice(0, FAIXAS).map((y, k) => (
            <clipPath key={k} id={`retrato-faixa-${k}`}>
              <rect x="70" y={y} width="160" height={CORTES[k + 1] - y} />
            </clipPath>
          ))}
        </defs>
        {/* o contorno do lugar certo, tracejado, para mirar */}
        <g fill="none" stroke="#a97c50" strokeWidth="2" strokeDasharray="5 4" opacity="0.6">
          <circle cx="150" cy="118" r="48" />
          <ellipse cx="126" cy="46" rx="14" ry="36" />
          <ellipse cx="174" cy="46" rx="14" ry="36" />
        </g>
        {faixas.slice(0, FAIXAS).map((_, k) => (
          <g key={k} clipPath={`url(#retrato-faixa-${k})`}>
            <g transform={`translate(${posicao(k)} 0)`}>
              <Rosto />
            </g>
          </g>
        ))}
        {/* os cortes entre as faixas */}
        {CORTES.slice(1, FAIXAS).map((y) => (
          <line key={y} x1="70" y1={y} x2="230" y2={y} stroke="#a97c50" strokeWidth="1.5" strokeDasharray="4 3" />
        ))}
        {/* as marcas do meio, em cima e embaixo da moldura */}
        <path d="M150 8 l-6 -6 h12 Z M150 176 l-6 6 h12 Z" fill="#f2c46a" />
        {/* a seta da faixa da vez, dos dois lados */}
        {feitas < FAIXAS && (
          <g>
            <path
              transform={`translate(54 ${(CORTES[feitas] + CORTES[feitas + 1]) / 2})`}
              d="M-12 -9 L2 0 L-12 9 Z"
              fill="#d9534f"
              stroke="#fff"
              strokeWidth="1.5"
            />
            <path
              transform={`translate(246 ${(CORTES[feitas] + CORTES[feitas + 1]) / 2})`}
              d="M12 -9 L-2 0 L12 9 Z"
              fill="#d9534f"
              stroke="#fff"
              strokeWidth="1.5"
            />
          </g>
        )}
        {/* o certinho de cada faixa parada */}
        {paradas.current.map((p, k) => {
          const d = Math.abs(deslocamento(faixas[k], p));
          const y = (CORTES[k] + CORTES[k + 1]) / 2;
          return d <= 6 ? (
            <path key={k} transform={`translate(262 ${y})`} d="M-7 0 L-2 6 L8 -6" stroke="#4f7d3a" strokeWidth="4" fill="none" strokeLinecap="round" />
          ) : (
            <circle key={k} cx="262" cy={y} r={Math.min(9, 3 + d / 8)} fill="#e0a83a" opacity="0.8" />
          );
        })}
      </svg>
    </Moldura>
  );
}

export default microjogoDaTela({
  id: 'retrato',
  nome: NOME,
  dica: chave('Pare cada faixa com o retrato no lugar, de cima para baixo.'),
  Tela: Retrato,
  valor: (v, f) => f.pct.format(v / 100),
  errouComValor: true,
});
