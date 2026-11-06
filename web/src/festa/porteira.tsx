import { useRef } from 'react';
import { chave } from '../i18n';
import { tocar } from '../somDosJogos';
import { Arena, ARENA_A, ARENA_L, type DadosDaArena, type QuadroDaArena } from './arena';
import { microjogoDaTela, type PropsDoMicro } from './comum';

/**
 * AS CHAVES DA PORTEIRA (lote 5, 05/11/2026; server/src/festa/porteira.ts): uma cenoura dourada a menos que a turma; pegue uma e
 * leve até a porteira. O empurrão derruba a cenoura de quem carrega. O motor comum é ./arena.tsx.
 */

// Os mesmos números do servidor.
const PORTEIRA_MS = 25000;
const PORTEIRA_X = 150;
const PORTEIRA_MEIA = 18;
const CERCA_Y = 26;
const PEGA_RAIO = 26;

/** k = [x, y, dono (0: no chão), usada, livreEm]; pp = quem já passou, na ordem. */
const chavesDe = (q: QuadroDaArena | null) => (q?.k as number[][] | undefined) ?? [];

/** A cenoura dourada (a "chave"), em pé. */
function Dourada({ x, y, brilha = true }: { x: number; y: number; brilha?: boolean }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      {brilha && <circle r="11" fill="#f2d16a" opacity="0.35" />}
      <path d="M-4 -6 L4 -6 L0 9 Z" fill="#e8a020" stroke="#b77810" strokeWidth="1" />
      <path d="M-1 -6 l-3 -6 M1 -6 l0 -7 M2 -6 l4 -5" stroke="#5d8f47" strokeWidth="2" strokeLinecap="round" />
    </g>
  );
}

function TelaPorteira(props: PropsDoMicro<DadosDaArena>) {
  const pedido = useRef(new Map<number, number>());
  const meus = (q: QuadroDaArena | null, eu: number) => chavesDe(q).some((k) => k[2] === eu && !k[3]);
  return (
    <Arena
      {...props}
      id="porteira"
      nome={NOME}
      duracaoMs={PORTEIRA_MS}
      placar={(q, eu) => {
        const pp = (q?.pp as number[] | undefined) ?? [];
        const ordem = pp.indexOf(eu);
        return ordem >= 0 ? `🚪 ✓ ${ordem + 1}` : `🥕 × ${chavesDe(q).filter((k) => !k[3]).length}`;
      }}
      velocidade={(q, eu) => (meus(q, eu) ? 95 * 0.8 : 95)}
      prender={(x, y) => {
        // a cerca: só a porteira deixa subir
        const naPorteira = Math.abs(x - PORTEIRA_X) <= PORTEIRA_MEIA - 4;
        return [x, Math.max(naPorteira ? 12 : CERCA_Y + 4, y)];
      }}
      aoAndar={(x, y, q, eu) => {
        if (meus(q, eu)) return null;
        // perto de uma cenoura no chão: pede para pegar (no máximo a cada 300 ms por cenoura)
        const ks = chavesDe(q);
        for (let i = 0; i < ks.length; i++) {
          const k = ks[i];
          if (k[2] || k[3]) continue;
          if ((k[0] - x) * (k[0] - x) + (k[1] - y) * (k[1] - y) > (PEGA_RAIO - 8) * (PEGA_RAIO - 8)) continue;
          if (Date.now() - (pedido.current.get(i) ?? 0) < 300) continue;
          pedido.current.set(i, Date.now());
          return { tipo: 'pega', i };
        }
        return null;
      }}
      aoQuadro={(quadro, eu) => {
        for (const ev of quadro.q.e) {
          if (ev[0] === 'p' && ev[1] === eu) tocar('moeda');
          if (ev[0] === 's' && ev[1] === eu) tocar('erro');
        }
      }}
      meta={(q, eu, x, y) => {
        // o piloto dos testes: com a cenoura, à porteira; sem, à mais perto no chão
        if (meus(q, eu)) return [PORTEIRA_X, 14];
        const livres = chavesDe(q).filter((k) => !k[2] && !k[3]);
        livres.sort((a, b) => (a[0] - x) ** 2 + (a[1] - y) ** 2 - ((b[0] - x) ** 2 + (b[1] - y) ** 2));
        return livres[0] ? [livres[0][0], livres[0][1]] : null;
      }}
      enfeite={(id, q) => (chavesDe(q).some((k) => k[2] === id && !k[3]) ? <Dourada x={0} y={-44} brilha={false} /> : null)}
      chao={() => (
        <g>
          {/* a horta: a grama, uns canteiros de enfeite e a cerca com a porteira no meio */}
          <rect x="0" y="0" width={ARENA_L} height={ARENA_A} rx="12" fill="#7cb85a" />
          {[[40, 60], [250, 70], [70, 160], [230, 165]].map(([x, y], k) => (
            <g key={k} opacity="0.5">
              <rect x={x - 18} y={y - 8} width="36" height="16" rx="4" fill="#8a6548" />
              {[-10, 0, 10].map((dx) => (
                <path key={dx} d={`M${x + dx} ${y} l-3 -6 M${x + dx} ${y} l3 -6`} stroke="#5d8f47" strokeWidth="2" />
              ))}
            </g>
          ))}
          <rect x="0" y="0" width={ARENA_L} height={CERCA_Y - 4} rx="12" fill="#6fa356" />
          {Array.from({ length: 21 }, (_, i) => 6 + i * 14.4).map((x, i) =>
            Math.abs(x - PORTEIRA_X) < PORTEIRA_MEIA ? null : <rect key={i} x={x - 3} y={CERCA_Y - 18} width="6" height="20" rx="2" fill="#a37b58" stroke="#7a5236" />,
          )}
          <rect x="0" y={CERCA_Y - 13} width={PORTEIRA_X - PORTEIRA_MEIA} height="4" fill="#8a6548" />
          <rect x={PORTEIRA_X + PORTEIRA_MEIA} y={CERCA_Y - 13} width={ARENA_L - PORTEIRA_X - PORTEIRA_MEIA} height="4" fill="#8a6548" />
          {/* a porteira, aberta, com o caminho */}
          <rect x={PORTEIRA_X - PORTEIRA_MEIA} y="0" width={PORTEIRA_MEIA * 2} height={CERCA_Y + 6} fill="#c49766" opacity="0.7" />
          <path d={`M${PORTEIRA_X - PORTEIRA_MEIA} ${CERCA_Y - 18} l-10 -6 v20 l10 4 Z M${PORTEIRA_X + PORTEIRA_MEIA} ${CERCA_Y - 18} l10 -6 v20 l-10 4 Z`} fill="#e8b33c" stroke="#7a5236" />
        </g>
      )}
      objetos={(e, q) => (
        <g pointerEvents="none">
          {chavesDe(q).map((k, i) => {
            if (k[2] || k[3]) return null;
            // a que acabou de cair pisca até poder ser pega
            const caida = k[4] > e;
            if (caida && Math.floor(e / 100) % 2) return null;
            return <Dourada key={i} x={k[0]} y={k[1]} />;
          })}
          {/* quem já passou espia por cima da cerca, na ordem */}
          {((q?.pp as number[] | undefined) ?? []).map((id, i) => (
            <text key={id} x={PORTEIRA_X + (i % 2 ? 1 : -1) * (30 + Math.floor(i / 2) * 22)} y="10" textAnchor="middle" fontSize="9">
              {i + 1}🐰
            </text>
          ))}
        </g>
      )}
    />
  );
}

const NOME = chave('As chaves da porteira');

export default microjogoDaTela<DadosDaArena>({
  id: 'porteira',
  nome: NOME,
  dica: chave('Pegue uma cenoura dourada e leve até a porteira. Falta uma: empurre quem estiver carregando!'),
  Tela: TelaPorteira,
  valor: (v) => (v > 0 ? `🚪 ${v}` : '🥕 ✗'),
});
