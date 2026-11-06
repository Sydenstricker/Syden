import { useEffect, useRef, useState } from 'react';
import { chave, useT } from '../i18n';
import { tocar } from '../somDosJogos';
import { CoelhoDeFrente, ehAperto, microjogoDaTela, Moldura, useRelogio, useTeclas, type PropsDoMicro } from './comum';
import { balanco, CIPO_MS, CIPOS, cipozalInicial, QUEDA_MS, soltar, VOO_MS, type DadosCipo } from './lote2sim';

/**
 * DE GALHO EM GALHO (05/11/2026, server/src/festa/cipo.ts): o coelho balança pendurado no cipó e solta (apertar ou tocar) quando
 * ele está lá na frente, na faixa clara; fora dela, cai na água e sobe de novo no mesmo. O balanço é a mesma conta do servidor
 * (./lote2sim), e cada soltura vai na hora.
 */

/** O galho de cima: onde pende cada cipó, o comprimento, e o quanto o balanço abre (radianos). */
const ENTRE = 92;
const COMPRIMENTO = 104;
const ABRE = 0.8;
const Y_DO_GALHO = 10;
const Y_DA_AGUA = 178;
const CAI_MS = 380;

const pivo = (k: number) => k * ENTRE;
const ponta = (k: number, angulo: number): [number, number] => [pivo(k) + COMPRIMENTO * Math.sin(angulo), Y_DO_GALHO + COMPRIMENTO * Math.cos(angulo)];

function Cipo({ dados, inicio, ativo, enviar, lance }: PropsDoMicro<DadosCipo>) {
  const t = useT();
  const periodos = dados.periodos ?? [];
  const limiares = dados.limiares ?? [];
  const estado = useRef(cipozalInicial());
  const [ultimo, setUltimo] = useState<{ tipo: 'pegou' | 'caiu'; em: number; de: [number, number] } | null>(null);
  const agora = useRelogio(ativo || (ultimo !== null && Date.now() - inicio < CIPO_MS + 1000));
  const e = agora - inicio;
  const fim = useRef(false);
  const s = estado.current;

  /** O ângulo do cipó em que o coelho está, agora. */
  const anguloAgora = (k: number, g: number, em: number) => (em < g || !periodos[k] ? 0 : balanco((em - g) / periodos[k]) * ABRE);

  const soltarAgora = () => {
    if (!ativo || fim.current || !periodos.length) return;
    const ms = Math.round(Date.now() - inicio);
    if (ms < 0 || ms > CIPO_MS || ms < s.g || s.k >= CIPOS) return;
    const de = ponta(s.k, anguloAgora(s.k, s.g, ms));
    const r = soltar(s, dados, ms);
    if (!r) return;
    setUltimo({ tipo: r, em: ms, de });
    tocar(r === 'pegou' ? 'pulo' : 'erro');
    lance({ t: ms });
  };
  useTeclas(ativo, (ev) => {
    if (!ehAperto(ev) && ev.key !== 'ArrowUp' && ev.key !== 'ArrowRight') return false;
    soltarAgora();
    return true;
  });

  useEffect(() => {
    if (!ativo || fim.current) return;
    // chegou ao último, ou acabou o tempo
    if (s.chegou !== null && e >= s.chegou) {
      fim.current = true;
      tocar('fim');
      enviar({});
    } else if (e >= CIPO_MS) {
      fim.current = true;
      enviar({});
    } else if (ultimo && e >= s.g && e - 40 < s.g) tocar(ultimo.tipo === 'pegou' ? 'acerto' : 'agua');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agora]);

  // onde o coelho está: no cipó, voando para o próximo, ou caindo e subindo de volta
  let [x, y] = ponta(Math.min(s.k, CIPOS - 1), anguloAgora(s.k, s.g, e));
  let caido = false;
  if (ultimo && e < s.g) {
    const q = e - ultimo.em;
    if (ultimo.tipo === 'pegou') {
      const p = Math.min(1, q / VOO_MS);
      const alvo = ponta(Math.min(s.k, CIPOS - 1), 0);
      if (s.k >= CIPOS) alvo[0] += 30;
      x = ultimo.de[0] + (alvo[0] - ultimo.de[0]) * p;
      y = ultimo.de[1] + (alvo[1] - ultimo.de[1]) * p - 4 * p * (1 - p) * 40;
    } else if (q < CAI_MS) {
      const p = q / CAI_MS;
      x = ultimo.de[0] + 10 * p;
      y = ultimo.de[1] + (Y_DA_AGUA - ultimo.de[1]) * p * p;
      caido = true;
    } else {
      // subindo pelo cipó de volta
      const p = (q - CAI_MS) / (QUEDA_MS - CAI_MS);
      const [px, py] = ponta(s.k, 0);
      x = px;
      y = Y_DA_AGUA + (py - Y_DA_AGUA) * p;
      caido = true;
    }
  }
  const camera = Math.max(-40, Math.min(pivo(CIPOS - 1) - 180, x - 120));
  const k = Math.min(s.k, CIPOS - 1);
  const segurando = e >= s.g && s.k < CIPOS;
  // a faixa clara: de onde o balanço passa do ponto até o fim da ida
  const faixa = (lim: number) => {
    const a0 = lim * ABRE;
    const pts = Array.from({ length: 9 }, (_, j) => ponta(k, a0 + ((ABRE - a0) * j) / 8));
    return pts.map(([px, py], j) => `${j ? 'L' : 'M'}${px} ${py}`).join(' ');
  };
  return (
    <Moldura placar={`🌿 × ${s.k}`} fracao={e / CIPO_MS}>
      <svg
        viewBox="0 0 300 200"
        role="button"
        aria-label={t(NOME)}
        style={{ width: '100%', touchAction: 'none', cursor: ativo ? 'pointer' : 'default' }}
        onPointerDown={(ev) => {
          ev.preventDefault();
          soltarAgora();
        }}
      >
        <rect x="0" y="0" width="300" height="200" rx="12" fill="#cfe8d0" />
        <g transform={`translate(${-camera} 0)`}>
          {/* as árvores ao fundo, o rio embaixo e o galho comprido em cima */}
          {Array.from({ length: CIPOS + 3 }, (_, j) => (
            <g key={j} transform={`translate(${j * ENTRE - 46} 0)`} opacity="0.5">
              <rect x="-6" y="30" width="12" height="160" fill="#8a6a4a" />
              <ellipse cx="0" cy="40" rx="30" ry="22" fill="#86c06a" />
            </g>
          ))}
          <rect x={-200} y={Y_DA_AGUA - 4} width={CIPOS * ENTRE + 400} height="40" fill="#5aa7c8" />
          {Array.from({ length: CIPOS * 3 }, (_, j) => (
            <path key={j} d={`M${j * 34 - 100 + ((e / 30) % 34)} ${Y_DA_AGUA + 6} q5 -3 10 0`} stroke="#8fcbe2" strokeWidth="2" fill="none" />
          ))}
          <rect x={-200} y={Y_DO_GALHO - 8} width={CIPOS * ENTRE + 400} height="10" rx="5" fill="#7a5238" />
          {/* a outra margem: o fim */}
          <rect x={pivo(CIPOS - 1) + 70} y={Y_DA_AGUA - 30} width="200" height="60" fill="#7cb85a" />
          {Array.from({ length: CIPOS }, (_, j) => {
            const angulo = j === s.k && segurando ? anguloAgora(j, s.g, e) : Math.sin(e / 600 + j) * 0.05;
            const [px, py] = ponta(j, angulo);
            return (
              <g key={j}>
                {j === s.k && segurando && <path d={faixa(limiares[j] ?? 1)} stroke="#fff6b0" strokeWidth="9" strokeLinecap="round" fill="none" opacity="0.75" />}
                <path d={`M${pivo(j)} ${Y_DO_GALHO} Q${(pivo(j) + px) / 2 + 4} ${(Y_DO_GALHO + py) / 2} ${px} ${py}`} stroke="#4f8a3a" strokeWidth="3" fill="none" />
                <ellipse cx={px} cy={py} rx="4" ry="3" fill="#6fb34e" />
              </g>
            );
          })}
          {/* o coelho pendurado pelas mãos */}
          <g transform={`translate(${x} ${y + 14})`}>
            {caido && y > Y_DA_AGUA - 20 && <ellipse cx="0" cy="-2" rx="16" ry="4" fill="#e4f3fa" opacity="0.8" />}
            <path d="M-6 -12 L-2 -22 M6 -12 L2 -22" stroke="#e8dccb" strokeWidth="3" strokeLinecap="round" />
            <ellipse cx="0" cy="-2" rx="8" ry="9" fill="#e8dccb" />
            <CoelhoDeFrente y={-6} escala={0.62} olhos={caido ? 'tontos' : 'abertos'} />
          </g>
        </g>
      </svg>
    </Moldura>
  );
}

const NOME = chave('De galho em galho');

export default microjogoDaTela({
  id: 'cipo',
  nome: NOME,
  dica: chave('Solte o cipó quando ele estiver na faixa clara.'),
  Tela: Cipo,
  valor: (v) => `🌿 × ${v}`,
  errouComValor: true,
});
