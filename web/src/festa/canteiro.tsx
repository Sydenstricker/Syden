import { chave } from '../i18n';
import { Arena, ARENA_A, ARENA_L, placarDeSobrevivencia, type DadosDaArena } from './arena';
import { microjogoDaTela, type PropsDoMicro } from './comum';

/**
 * CANTEIRO QUE ENCOLHE (lote 5, 05/11/2026; server/src/festa/canteiro.ts): todos num canteiro da horta, empurrando uns aos
 * outros para fora; a borda racha e desmorona, e o canteiro fica menor. O motor comum é ./arena.tsx.
 */

// Os mesmos números do servidor.
const CANTEIRO_MS = 25000;
const CANTEIRO_AVISO_MS = 1500;
const CANTEIRO_INICIAL = { x0: 20, y0: 14, x1: 280, y1: 186 };

interface Etapa {
  t: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
interface DadosCanteiro extends DadosDaArena {
  etapas?: Etapa[];
}

const canteiroEm = (etapas: Etapa[], t: number): Etapa => {
  let r: Etapa = { t: 0, ...CANTEIRO_INICIAL };
  for (const e of etapas) if (e.t <= t) r = e;
  return r;
};

/** As tábuas da borda do canteiro (o retângulo de madeira), e a terra dentro. */
function Canteiro({ r, cor = '#7a5236' }: { r: Omit<Etapa, 't'>; cor?: string }) {
  return (
    <g>
      <rect x={r.x0 - 4} y={r.y0 - 3} width={r.x1 - r.x0 + 8} height={r.y1 - r.y0 + 10} rx="3" fill="#5e3d27" />
      <rect x={r.x0 - 4} y={r.y0 - 4} width={r.x1 - r.x0 + 8} height={r.y1 - r.y0 + 8} rx="3" fill={cor} />
      <rect x={r.x0} y={r.y0} width={r.x1 - r.x0} height={r.y1 - r.y0} fill="#8a6548" />
    </g>
  );
}

function TelaCanteiro(props: PropsDoMicro<DadosCanteiro>) {
  const etapas = props.dados.etapas ?? [];
  return (
    <Arena
      {...props}
      id="canteiro"
      nome={NOME}
      duracaoMs={CANTEIRO_MS}
      placar={placarDeSobrevivencia}
      prender={(x, y, e) => {
        const r = canteiroEm(etapas, e);
        return [Math.min(r.x1 - 2, Math.max(r.x0 + 2, x)), Math.min(r.y1 - 2, Math.max(r.y0 + 2, y))];
      }}
      chao={(e) => {
        const agora = canteiroEm(etapas, e);
        const proxima = etapas.find((et) => et.t > e && et.t - e <= CANTEIRO_AVISO_MS);
        // a faixa que vai cair pisca (mais rápido perto da hora)
        const falta = proxima ? proxima.t - e : 0;
        const pisca = proxima ? (Math.floor(e / (falta < 600 ? 90 : 180)) % 2 === 0 ? 0.55 : 0.25) : 0;
        return (
          <g>
            {/* a grama em volta, e o buraco escuro onde a terra já caiu */}
            <rect x="0" y="0" width={ARENA_L} height={ARENA_A} rx="12" fill="#6fa356" />
            {[18, 64, 110, 170, 230, 282].map((x, k) => (
              <path key={k} d={`M${x} ${k % 2 ? 196 : 8} q3 -8 6 0 q3 -7 6 0`} fill="#5d8f47" />
            ))}
            <rect x={CANTEIRO_INICIAL.x0} y={CANTEIRO_INICIAL.y0} width={CANTEIRO_INICIAL.x1 - CANTEIRO_INICIAL.x0} height={CANTEIRO_INICIAL.y1 - CANTEIRO_INICIAL.y0} fill="#3e2a1e" opacity="0.55" />
            <Canteiro r={agora} />
            {proxima && (
              <g pointerEvents="none">
                {/* o que vai ficar, contornado; o que vai cair, rachado e piscando */}
                <path
                  fillRule="evenodd"
                  d={`M${agora.x0} ${agora.y0}h${agora.x1 - agora.x0}v${agora.y1 - agora.y0}h${agora.x0 - agora.x1}Z M${proxima.x0} ${proxima.y0}v${proxima.y1 - proxima.y0}h${proxima.x1 - proxima.x0}v${proxima.y0 - proxima.y1}Z`}
                  fill="#3e2a1e"
                  opacity={pisca}
                />
                <rect x={proxima.x0} y={proxima.y0} width={proxima.x1 - proxima.x0} height={proxima.y1 - proxima.y0} fill="none" stroke="#f2c46a" strokeWidth="2" strokeDasharray="6 4" />
              </g>
            )}
            {/* uns pés de alface de enfeite nos cantos de dentro, que não atrapalham ninguém */}
            {[[agora.x0 + 10, agora.y0 + 10], [agora.x1 - 10, agora.y1 - 8]].map(([x, y], k) => (
              <g key={k} transform={`translate(${x} ${y})`} opacity="0.7">
                <circle r="5" fill="#7cb85a" />
                <circle r="3" fill="#9ad470" />
              </g>
            ))}
          </g>
        );
      }}
    />
  );
}

const NOME = chave('Canteiro que encolhe');

export default microjogoDaTela<DadosCanteiro>({
  id: 'canteiro',
  nome: NOME,
  dica: chave('Empurre os outros para fora do canteiro. A borda que pisca vai cair!'),
  Tela: TelaCanteiro,
  valor: (v, f) => f.s.format(v / 1000),
});
