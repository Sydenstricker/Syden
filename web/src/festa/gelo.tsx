import { useEffect, useRef, useState } from 'react';
import { chave, useT } from '../i18n';
import { tocar } from '../somDosJogos';
import { CoelhoDeFrente, microjogoDaTela, Moldura, useRelogio, type PropsDoMicro } from './comum';
import { Cenoura, piscando, useDirecao } from './lote2comum';

/**
 * REPOLHOS NO GELO (05/11/2026, server/src/festa/gelo.ts): o coelho escorrega no lago congelado pegando cenouras, e os repolhos
 * deslizam batendo nas margens. A cenoura vai na hora, com onde o coelho estava; o golpe do repolho é desta tela (quem leva diz).
 */

// Os mesmos números do servidor.
const GELO_MS = 22000;
const RINQUE = { x0: 20, x1: 280, y0: 22, y1: 182 };
const GELO_VMAX = 115;
const CENOURA_VIDA_MS = 4500;
const INVULNERAVEL_MS = 1500;
const CUSTO_DO_GOLPE = 2;
/** Só na tela: o empurrão das setas, o quase nada que o gelo freia, o tamanho do coelho e de quão perto se pega a cenoura. */
const ACEL = 240;
const ATRITO = 0.35;
const RAIO = 9;
const PEGA = 15;
/** O aviso de que um repolho vai entrar. */
const AVISO_MS = 700;

interface Repolho {
  t: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
}
interface Dados {
  repolhos?: Repolho[];
  cenouras?: { t: number; x: number; y: number }[];
}

/** O vai e volta entre as margens: o ponto `v` refletido no intervalo [a, b]. */
function refletir(v: number, a: number, b: number) {
  const l = b - a;
  let u = (v - a) % (2 * l);
  if (u < 0) u += 2 * l;
  return a + (u <= l ? u : 2 * l - u);
}
const ondeEsta = (r: Repolho, e: number): [number, number] => [
  refletir(r.x + (r.vx * (e - r.t)) / 1000, RINQUE.x0 + r.r, RINQUE.x1 - r.r),
  refletir(r.y + (r.vy * (e - r.t)) / 1000, RINQUE.y0 + r.r, RINQUE.y1 - r.r),
];

function DesenhoDoRepolho({ r, giro }: { r: number; giro: number }) {
  return (
    <g transform={`rotate(${giro})`}>
      <circle r={r} fill="#8cc06a" stroke="#4f7d3a" strokeWidth="1.5" />
      <path d={`M0 ${-r} Q${r * 0.5} 0 0 ${r} M${-r} 0 Q0 ${r * 0.4} ${r} 0`} stroke="#5f9a46" strokeWidth="1.3" fill="none" />
      <circle r={r * 0.35} fill="#b3dc8e" />
    </g>
  );
}

function Gelo({ dados, inicio, ativo, enviar, lance }: PropsDoMicro<Dados>) {
  const t = useT();
  const repolhos = dados.repolhos ?? [];
  const cenouras = dados.cenouras ?? [];
  const { svg, ponteiro, vetor } = useDirecao(ativo);
  const agora = useRelogio(ativo);
  const e = agora - inicio;
  const coelho = useRef({ x: 150, y: 102, vx: 0, vy: 0, antes: 0 });
  const [pegas, setPegas] = useState<number[]>([]);
  const [golpes, setGolpes] = useState(0);
  const invulneravel = useRef(0);
  const fim = useRef(false);

  // a cada quadro: o coelho escorrega, pega o que tocar e leva o que bater
  useEffect(() => {
    if (!ativo || fim.current) return;
    const c = coelho.current;
    const dt = Math.min(0.05, Math.max(0, (agora - (c.antes || agora)) / 1000));
    c.antes = agora;
    if (e < 0) return;
    if (e >= GELO_MS) {
      fim.current = true;
      tocar('fim');
      enviar({});
      return;
    }
    const [ax, ay] = vetor([c.x, c.y]);
    c.vx = (c.vx + ax * ACEL * dt) * (1 - ATRITO * dt);
    c.vy = (c.vy + ay * ACEL * dt) * (1 - ATRITO * dt);
    const v = Math.sqrt(c.vx * c.vx + c.vy * c.vy);
    if (v > GELO_VMAX) {
      c.vx *= GELO_VMAX / v;
      c.vy *= GELO_VMAX / v;
    }
    c.x += c.vx * dt;
    c.y += c.vy * dt;
    // a margem devolve um pouco
    if (c.x < RINQUE.x0 + RAIO || c.x > RINQUE.x1 - RAIO) {
      c.x = Math.min(RINQUE.x1 - RAIO, Math.max(RINQUE.x0 + RAIO, c.x));
      c.vx *= -0.5;
    }
    if (c.y < RINQUE.y0 + RAIO || c.y > RINQUE.y1 - RAIO) {
      c.y = Math.min(RINQUE.y1 - RAIO, Math.max(RINQUE.y0 + RAIO, c.y));
      c.vy *= -0.5;
    }
    const ms = Math.round(e);
    cenouras.forEach((ce, i) => {
      if (e < ce.t || e >= ce.t + CENOURA_VIDA_MS || pegas.includes(i)) return;
      if ((ce.x - c.x) ** 2 + (ce.y - c.y) ** 2 > PEGA * PEGA) return;
      setPegas((l) => (l.includes(i) ? l : [...l, i]));
      tocar('moeda');
      lance({ i, t: ms, x: Math.round(c.x * 10) / 10, y: Math.round(c.y * 10) / 10 });
    });
    if (e < invulneravel.current) return;
    for (const r of repolhos) {
      if (e < r.t) continue;
      const [rx, ry] = ondeEsta(r, e);
      const dx = c.x - rx;
      const dy = c.y - ry;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d >= r.r + RAIO) continue;
      // levou: quem leva diz (o servidor só confere o instante), e o repolho empurra
      invulneravel.current = e + INVULNERAVEL_MS;
      setGolpes((g) => g + 1);
      tocar('soco');
      lance({ golpe: true, t: ms });
      c.vx = (dx / (d || 1)) * GELO_VMAX;
      c.vy = (dy / (d || 1)) * GELO_VMAX;
      break;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agora]);

  const c = coelho.current;
  const pontos = Math.max(0, pegas.length - CUSTO_DO_GOLPE * golpes);
  return (
    <Moldura placar={`🥕 × ${pontos}`} fracao={e / GELO_MS}>
      <svg
        ref={svg}
        viewBox="0 0 300 200"
        role="img"
        aria-label={t(NOME)}
        style={{ width: '100%', touchAction: 'none', cursor: ativo ? 'crosshair' : 'default' }}
        {...ponteiro}
      >
        {/* a margem de neve e o gelo, com uns riscos de patins */}
        <rect x="0" y="0" width="300" height="200" rx="12" fill="#eef4f7" />
        <rect x={RINQUE.x0} y={RINQUE.y0} width={RINQUE.x1 - RINQUE.x0} height={RINQUE.y1 - RINQUE.y0} rx="18" fill="#bfe0ee" stroke="#8fbfd6" strokeWidth="3" />
        {[[50, 50, 120, 70], [170, 140, 250, 120], [90, 150, 140, 165], [200, 45, 245, 60]].map(([x1, y1, x2, y2], k) => (
          <path key={k} d={`M${x1} ${y1} Q${(x1 + x2) / 2} ${y1 - 12} ${x2} ${y2}`} stroke="#e4f3fa" strokeWidth="2" fill="none" />
        ))}
        {/* as cenouras do gelo (piscando quando estão para sumir) */}
        {cenouras.map((ce, i) =>
          e >= ce.t && e < ce.t + CENOURA_VIDA_MS && !pegas.includes(i) && !(e > ce.t + CENOURA_VIDA_MS - 900 && Math.floor(e / 150) % 2) ? (
            <g key={i}>
              <ellipse cx={ce.x} cy={ce.y + 10} rx="6" ry="2" fill="rgba(40,80,110,0.25)" />
              <Cenoura x={ce.x} y={ce.y} escala={0.9} />
            </g>
          ) : null,
        )}
        {/* os repolhos: o aviso de onde vão entrar, e eles girando */}
        {repolhos.map((r, k) => {
          if (e < r.t - AVISO_MS) return null;
          if (e < r.t) return <circle key={k} cx={r.x} cy={r.y} r={r.r} fill="none" stroke="#5f9a46" strokeWidth="2" strokeDasharray="3 3" opacity={0.4 + 0.4 * ((e - r.t + AVISO_MS) / AVISO_MS)} />;
          const [x, y] = ondeEsta(r, e);
          return (
            <g key={k} transform={`translate(${x} ${y})`}>
              <ellipse cx="0" cy={r.r - 1} rx={r.r} ry="3" fill="rgba(40,80,110,0.25)" />
              <DesenhoDoRepolho r={r.r} giro={((e - r.t) / 4) % 360} />
            </g>
          );
        })}
        {/* o coelho, inclinado para onde escorrega */}
        {!piscando(e, invulneravel.current) && (
          <g transform={`translate(${c.x} ${c.y + 8}) rotate(${Math.max(-20, Math.min(20, c.vx / 5))})`}>
            <ellipse cx="0" cy="1" rx="10" ry="3" fill="rgba(40,80,110,0.3)" />
            <ellipse cx="0" cy="-4" rx="8" ry="6" fill="#e8dccb" />
            <CoelhoDeFrente y={-6} escala={0.75} olhos={e < invulneravel.current ? 'tontos' : 'abertos'} />
          </g>
        )}
      </svg>
    </Moldura>
  );
}

const NOME = chave('Repolhos no gelo');

export default microjogoDaTela({
  id: 'gelo',
  nome: NOME,
  dica: chave('Pegue as cenouras no gelo e fuja dos repolhos.'),
  Tela: Gelo,
  valor: (v) => `🥕 × ${v}`,
  errouComValor: true,
});
