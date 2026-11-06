import { useEffect, useRef, useState } from 'react';
import { chave, useT } from '../i18n';
import { tocar } from '../somDosJogos';
import { CoelhoDeFrente, microjogoDaTela, Moldura, useRelogio, type PropsDoMicro } from './comum';
import { anotarDirecao, useDirecao, usePassos } from './lote2comum';
import { ALERTA, CERCA, cercadoInicial, GALINHA_MS, GALINHA_PASSOS, passoDoCercado, type Cercado, type DadosGalinha, type Entrada } from './lote2sim';

/**
 * PEGUE A GALINHA (05/11/2026, server/src/festa/galinha.ts): cada um corre atrás da SUA galinha no cercado. Chegando perto, ela
 * dispara; cansada, fica lenta (as gotinhas de suor). O cercado anda pela mesma conta do servidor (./lote2sim), e cada mudança de
 * direção vai na hora.
 */

function Galinha({ correndo, cansada, olhaPara, e }: { correndo: boolean; cansada: boolean; olhaPara: number; e: number }) {
  const passo = correndo ? Math.sin(e / 35) * 3 : cansada ? Math.sin(e / 120) : 0;
  return (
    <g transform={`scale(${olhaPara < 0 ? -1 : 1} 1)`}>
      <ellipse cx="0" cy="10" rx="9" ry="2.5" fill="rgba(0,0,0,0.2)" />
      <path d={`M-3 6 L${-4 + passo} 11 M3 6 L${4 - passo} 11`} stroke="#e0a030" strokeWidth="1.8" strokeLinecap="round" />
      <ellipse cx="0" cy="0" rx="10" ry="8" fill="#fbf7ee" stroke="#c9bfa8" strokeWidth="1.2" />
      <path d="M-10 -2 L-15 -6 L-13 1 Z" fill="#fbf7ee" stroke="#c9bfa8" strokeWidth="1" />
      <circle cx="7" cy="-7" r="5.5" fill="#fbf7ee" stroke="#c9bfa8" strokeWidth="1.2" />
      <path d="M5 -12 Q6 -15 8 -12 Q9 -15 10 -11" fill="#d9534f" />
      <path d="M12 -7 L15 -6 L12 -5 Z" fill="#e0a030" />
      <circle cx="9" cy="-8" r="1.1" fill="#2a2a2a" />
      <path d="M-4 -1 Q0 3 4 -1" stroke="#e6dcc6" strokeWidth="1.5" fill="none" />
      {cansada && <path d="M-8 -14 q-2 3 0 4 q2 -1 0 -4 M-14 -10 q-2 3 0 4 q2 -1 0 -4" fill="#8fcbe2" />}
    </g>
  );
}

function PegueAGalinha({ dados, inicio, ativo, enviar, lance }: PropsDoMicro<DadosGalinha>) {
  const t = useT();
  const { svg, ponteiro, ler } = useDirecao(ativo);
  const agora = useRelogio(ativo);
  const e = agora - inicio;
  const entradas = useRef<Entrada[]>([]);
  const ok = !!dados.surgir?.length && !!dados.lado?.length && !!dados.passeio?.length;
  const criar = (): Cercado => (ok ? cercadoInicial(dados) : { n: 0, j: 0, cx: 150, cy: 160, gx: 150, gy: 60, folego: 0, cansada: 0, k: 0, ultimo: 0 });
  const { s, antes, entre } = usePassos(e, criar, (c) => (ok ? passoDoCercado(c, dados, entradas.current) : c.n++), GALINHA_PASSOS);
  const fim = useRef(false);
  const [pegou, setPegou] = useState<{ x: number; y: number; em: number } | null>(null);
  const pegasAntes = useRef(0);

  useEffect(() => {
    if (!ativo || fim.current || e < 0) return;
    if (s.n >= GALINHA_PASSOS) {
      fim.current = true;
      tocar('fim');
      enviar({});
      return;
    }
    anotarDirecao(entradas.current, s.n, ler([s.cx, s.cy], 8), lance);
    if (s.k > pegasAntes.current) {
      pegasAntes.current = s.k;
      setPegou({ x: antes.gx, y: antes.gy, em: e });
      tocar('acerto');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agora]);

  // a galinha que acabou de ser pega não desliza até o galinheiro: aparece no lugar novo
  const saltou = s.k !== antes.k;
  const gx = saltou ? s.gx : entre(antes.gx, s.gx);
  const gy = saltou ? s.gy : entre(antes.gy, s.gy);
  const cx = entre(antes.cx, s.cx);
  const cy = entre(antes.cy, s.cy);
  const perto = (gx - cx) ** 2 + (gy - cy) ** 2 < ALERTA * ALERTA;
  return (
    <Moldura placar={`🐔 × ${s.k}`} fracao={e / GALINHA_MS}>
      <svg
        ref={svg}
        viewBox="0 0 300 200"
        role="img"
        aria-label={t(NOME)}
        style={{ width: '100%', touchAction: 'none', cursor: ativo ? 'crosshair' : 'default' }}
        {...ponteiro}
      >
        <rect x="0" y="0" width="300" height="200" rx="12" fill="#8cc06a" />
        <rect x={CERCA.x0 - 6} y={CERCA.y0 - 8} width={CERCA.x1 - CERCA.x0 + 12} height={CERCA.y1 - CERCA.y0 + 14} rx="6" fill="#a7cf7f" />
        {[[60, 60], [230, 140], [120, 150], [200, 50], [40, 160]].map(([x, y], k) => (
          <path key={k} d={`M${x} ${y} q3 -7 6 0 q3 -6 6 0`} fill="#79ad58" />
        ))}
        {/* a cerca de madeira em volta */}
        <rect x={CERCA.x0 - 8} y={CERCA.y0 - 10} width={CERCA.x1 - CERCA.x0 + 16} height={CERCA.y1 - CERCA.y0 + 18} rx="6" fill="none" stroke="#a97c50" strokeWidth="4" />
        {Array.from({ length: 13 }, (_, k) => (
          <g key={k}>
            <rect x={CERCA.x0 - 10 + k * 23} y={CERCA.y0 - 14} width="4" height="10" fill="#8a5a3a" />
            <rect x={CERCA.x0 - 10 + k * 23} y={CERCA.y1 + 4} width="4" height="10" fill="#8a5a3a" />
          </g>
        ))}
        {/* as penas da que foi pega */}
        {pegou && e - pegou.em < 600 && (
          <g transform={`translate(${pegou.x} ${pegou.y})`} opacity={1 - (e - pegou.em) / 600}>
            {[0, 1, 2, 3, 4].map((k) => (
              <ellipse key={k} cx={(k - 2) * 6 * (1 + (e - pegou.em) / 300)} cy={-((e - pegou.em) / 25) - (k % 2) * 4} rx="3" ry="1.5" fill="#fbf7ee" />
            ))}
          </g>
        )}
        {/* quem está mais embaixo fica na frente */}
        {[
          {
            y: gy,
            el: (
              <g key="g" transform={`translate(${gx} ${gy})`}>
                <Galinha correndo={perto && s.cansada === 0} cansada={s.cansada > 0} olhaPara={gx - cx} e={e} />
              </g>
            ),
          },
          {
            y: cy,
            el: (
              <g key="c" transform={`translate(${cx} ${cy + 8})`}>
                <ellipse cx="0" cy="1" rx="9" ry="2.5" fill="rgba(0,0,0,0.2)" />
                <ellipse cx="0" cy="-4" rx="8" ry="6" fill="#e8dccb" />
                <CoelhoDeFrente y={-6} escala={0.72} />
              </g>
            ),
          },
        ]
          .sort((a, b) => a.y - b.y)
          .map((o) => o.el)}
      </svg>
    </Moldura>
  );
}

const NOME = chave('Pegue a galinha');

export default microjogoDaTela({
  id: 'galinha',
  nome: NOME,
  dica: chave('Encurrale a galinha. Cansada, ela fica lenta.'),
  Tela: PegueAGalinha,
  valor: (v) => `🐔 × ${v}`,
  errouComValor: true,
});
