import { chave } from '../i18n';
import { Arena, ARENA_A, ARENA_L, placarDeSobrevivencia, type DadosDaArena, type QuadroDaArena } from './arena';
import { menosMovimento, microjogoDaTela, type PropsDoMicro } from './comum';

/**
 * CHÃO QUE DESMORONA (lote 5, 05/11/2026; server/src/festa/desmorona.ts): o assoalho de tábuas sobre o lago; a tábua pisada
 * racha e cai, e dá para empurrar os outros para os buracos. O motor comum é ./arena.tsx.
 */

// Os mesmos números do servidor.
const DESMORONA_MS = 25000;
const COLUNAS = 10;
const LINHAS = 7;
const TABUA_L = 26;
const TABUA_A = 24;
const X0 = 20;
const Y0 = 16;
const RACHA_MS = 1100;

const tabuaEm = (x: number, y: number) => {
  const c = Math.floor((x - X0) / TABUA_L);
  const l = Math.floor((y - Y0) / TABUA_A);
  if (c < 0 || l < 0 || c >= COLUNAS || l >= LINHAS) return -1;
  return l * COLUNAS + c;
};
/** Quando cada tábua cai, pelo último quadro (as que não estão lá estão inteiras). */
const caiDe = (q: QuadroDaArena | null) => new Map(((q?.b as [number, number][] | undefined) ?? []).map(([i, t]) => [i, t]));

function TelaDesmorona(props: PropsDoMicro<DadosDaArena>) {
  const quieto = menosMovimento();
  return (
    <Arena
      {...props}
      id="desmorona"
      nome={NOME}
      duracaoMs={DESMORONA_MS}
      placar={placarDeSobrevivencia}
      meta={(q, _eu, x, y) => {
        // o piloto dos testes: a tábua inteira mais perto, que não seja a de agora
        const cai = caiDe(q);
        const agora = tabuaEm(x, y);
        let melhor: [number, number] | null = null;
        let dist = Infinity;
        for (let i = 0; i < COLUNAS * LINHAS; i++) {
          if (i === agora || cai.has(i)) continue;
          const cx = X0 + (i % COLUNAS) * TABUA_L + TABUA_L / 2;
          const cy = Y0 + Math.floor(i / COLUNAS) * TABUA_A + TABUA_A / 2;
          const d = (cx - x) * (cx - x) + (cy - y) * (cy - y);
          if (d < dist) [dist, melhor] = [d, [cx, cy]];
        }
        return melhor;
      }}
      prender={(x, y, e, q, x0, y0) => {
        // o assoalho é o limite, e o buraco que já existe é parede (escorrega pelo lado que dá)
        const cai = caiDe(q);
        const ok = (px: number, py: number) => {
          const i = tabuaEm(px, py);
          return i >= 0 && (cai.get(i) ?? Infinity) > e;
        };
        if (ok(x, y)) return [x, y];
        if (ok(x, y0)) return [x, y0];
        if (ok(x0, y)) return [x0, y];
        return [x0, y0];
      }}
      chao={(e, q) => {
        const cai = caiDe(q);
        return (
          <g>
            {/* o lago, com umas ondinhas */}
            <rect x="0" y="0" width={ARENA_L} height={ARENA_A} rx="12" fill="#4f8fb8" />
            {[[40, 10], [150, 192], [260, 8], [10, 120], [290, 90]].map(([x, y], k) => (
              <path key={k} d={`M${x - 8} ${y} q4 -3 8 0 q4 3 8 0`} stroke="#9cc8e0" strokeWidth="1.5" fill="none" />
            ))}
            {Array.from({ length: COLUNAS * LINHAS }, (_, i) => {
              const t = cai.get(i) ?? Infinity;
              if (t <= e) return null;
              const x = X0 + (i % COLUNAS) * TABUA_L;
              const y = Y0 + Math.floor(i / COLUNAS) * TABUA_A;
              const falta = t - e;
              const rachando = falta < RACHA_MS + 200;
              // a tábua que racha treme (mais perto da queda, mais), e escurece
              const treme = rachando && !quieto ? ((Math.floor(e / 60) % 2) * 2 - 1) * (1 - falta / RACHA_MS) * 1.6 : 0;
              const madeira = (i + Math.floor(i / COLUNAS)) % 2 ? '#b98a5a' : '#c49766';
              return (
                <g key={i} transform={`translate(${x + treme} ${y})`}>
                  <rect x="0.5" y="0.5" width={TABUA_L - 1} height={TABUA_A - 1} rx="2" fill={rachando ? '#8f6a46' : madeira} stroke="#7a5236" strokeWidth="1" />
                  <path d={`M3 ${TABUA_A / 3} h${TABUA_L - 6} M3 ${(TABUA_A * 2) / 3} h${TABUA_L - 6}`} stroke="#a07448" strokeWidth="0.8" />
                  {rachando && <path d={`M${TABUA_L / 2} 2 l-4 7 l6 4 l-5 9 M${TABUA_L / 2} 11 l7 3`} stroke="#3e2a1e" strokeWidth="1.3" fill="none" />}
                </g>
              );
            })}
          </g>
        );
      }}
    />
  );
}

const NOME = chave('Chão que desmorona');

export default microjogoDaTela<DadosDaArena>({
  id: 'desmorona',
  nome: NOME,
  dica: chave('A tábua racha quando alguém para em cima. Continue andando e empurre os outros para a água!'),
  Tela: TelaDesmorona,
  valor: (v, f) => f.s.format(v / 1000),
});
