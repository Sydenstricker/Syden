import { useEffect, useRef, useState } from 'react';
import { chave, useT } from '../i18n';
import { tocar } from '../somDosJogos';
import { CoelhoDeFrente, microjogoDaTela, Moldura, useRelogio, type PropsDoMicro } from './comum';
import { piscando, useDirecao } from './lote2comum';

/**
 * BRASAS DA FOGUEIRA (05/11/2026, server/src/festa/brasas.ts): a fogueira solta brasas em anéis com uma brecha, em fileiras que
 * varrem o chão com um vão, e em pontos marcados antes de cair. Três corações. O golpe é desta tela (quem leva diz, na hora).
 */

// Os mesmos números do servidor.
const BRASAS_MS = 25000;
const CORACOES = 3;
const INVULNERAVEL_MS = 1500;
const AVISO_MS = 900;
const COM_CORACOES = 100000;
/** Só na tela. */
const FOGO: [number, number] = [150, 100];
const RAIO_DO_FOGO = 17;
const VEL = 120;
const RAIO = 7;
/** O anel cresce isto por segundo, e a brecha tem esta meia-abertura (radianos). */
const ANEL_VEL = 85;
const BRECHA = 0.5;
/** A fileira anda isto por segundo, e o vão tem esta meia-largura. */
const FILA_VEL = 100;
const VAO = 26;
/** A brasa marcada: o tamanho, e quanto tempo queima depois do aviso. */
const PONTO = 15;
const PONTO_MS = 600;

interface Padrao {
  t: number;
  tipo: number;
  a: number;
  b: number;
  pontos?: [number, number][];
}

/** Quanto cada padrão dura queimando, depois do aviso. */
const duracao = (p: Padrao) =>
  p.tipo === 0 ? (200 / ANEL_VEL) * 1000 : p.tipo === 1 ? (330 / FILA_VEL) * 1000 : p.tipo === 2 ? (230 / FILA_VEL) * 1000 : PONTO_MS;

/** O ângulo (0 a 1 da volta) de um ponto em volta da fogueira, e a distância de dois ângulos. */
const voltaDe = (x: number, y: number) => {
  const a = Math.atan2(y - FOGO[1], x - FOGO[0]) / (2 * Math.PI);
  return a < 0 ? a + 1 : a;
};
const distVolta = (a: number, b: number) => {
  const d = Math.abs(a - b) % 1;
  return Math.min(d, 1 - d) * 2 * Math.PI;
};

/** Onde está a frente de cada padrão (o raio do anel, a posição da fileira), `q` ms depois do aviso. */
const frente = (p: Padrao, q: number) =>
  p.tipo === 0
    ? RAIO_DO_FOGO + (ANEL_VEL * q) / 1000
    : p.tipo === 1
      ? p.b > 0
        ? -15 + (FILA_VEL * q) / 1000
        : 315 - (FILA_VEL * q) / 1000
      : p.b > 0
        ? -15 + (FILA_VEL * q) / 1000
        : 215 - (FILA_VEL * q) / 1000;

/** O coelho em (x, y) está sendo queimado pelo padrão, no instante `e`? */
function queima(p: Padrao, e: number, x: number, y: number): boolean {
  const q = e - p.t - AVISO_MS;
  if (q < 0 || q > duracao(p)) return false;
  if (p.tipo === 0) {
    const d = Math.sqrt((x - FOGO[0]) ** 2 + (y - FOGO[1]) ** 2);
    return Math.abs(d - frente(p, q)) < RAIO + 4 && distVolta(voltaDe(x, y), p.a) > BRECHA;
  }
  if (p.tipo === 1) return Math.abs(x - frente(p, q)) < RAIO + 4 && Math.abs(y - p.a) > VAO;
  if (p.tipo === 2) return Math.abs(y - frente(p, q)) < RAIO + 4 && Math.abs(x - p.a) > VAO;
  return (p.pontos ?? []).some(([px, py]) => (px - x) ** 2 + (py - y) ** 2 < (PONTO + RAIO - 3) ** 2);
}

function Brasa({ x, y, k }: { x: number; y: number; k: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r="5" fill="#e0482b" />
      <circle r="3" fill={k % 2 ? '#f6b04a' : '#f8d36a'} />
    </g>
  );
}

function DesenhoDoPadrao({ p, e }: { p: Padrao; e: number }) {
  const q = e - p.t - AVISO_MS;
  if (q > duracao(p)) return null;
  const aviso = q < 0;
  const opac = aviso ? 0.35 + 0.35 * Math.abs(Math.sin(e / 90)) : 1;
  if (p.tipo === 0) {
    // o anel: brasas na volta, menos na brecha (no aviso, a volta tracejada e a brecha clara)
    const r = aviso ? RAIO_DO_FOGO + 14 : frente(p, q);
    const n = Math.max(10, Math.floor((2 * Math.PI * r) / 13));
    return (
      <g opacity={opac}>
        {Array.from({ length: n }, (_, k) => {
          const a = k / n;
          if (distVolta(a, p.a) <= BRECHA) return null;
          const x = FOGO[0] + r * Math.cos(a * 2 * Math.PI);
          const y = FOGO[1] + r * Math.sin(a * 2 * Math.PI);
          return aviso ? <circle key={k} cx={x} cy={y} r="2" fill="#e0482b" /> : <Brasa key={k} x={x} y={y} k={k} />;
        })}
      </g>
    );
  }
  if (p.tipo === 3) {
    return (
      <g>
        {(p.pontos ?? []).map(([x, y], k) =>
          aviso ? (
            <circle key={k} cx={x} cy={y} r={PONTO * (0.5 + 0.5 * ((q + AVISO_MS) / AVISO_MS))} fill="rgba(224,72,43,0.18)" stroke="#e0482b" strokeWidth="1.5" strokeDasharray="3 3" />
          ) : (
            <g key={k} transform={`translate(${x} ${y})`}>
              <circle r={PONTO} fill="rgba(224,72,43,0.35)" />
              <path d="M0 -14 Q7 -4 3 6 Q0 10 -3 6 Q-7 -4 0 -14 Z" fill="#f08a3a" />
              <path d="M0 -6 Q3 0 1 5 Q0 7 -1 5 Q-3 0 0 -6 Z" fill="#f8d36a" />
            </g>
          ),
        )}
      </g>
    );
  }
  // a fileira: uma linha de brasas com o vão (no aviso, a seta na borda de onde ela vem e o vão marcado)
  const deLado = p.tipo === 1;
  const pos = aviso ? (p.b > 0 ? 6 : deLado ? 294 : 194) : frente(p, q);
  const comprimento = deLado ? 200 : 300;
  const brasas = [];
  for (let s = 6; s < comprimento; s += 12) {
    if (Math.abs(s - p.a) <= VAO) continue;
    const [x, y] = deLado ? [pos, s] : [s, pos];
    brasas.push(aviso ? <circle key={s} cx={x} cy={y} r="2" fill="#e0482b" /> : <Brasa key={s} x={x} y={y} k={s} />);
  }
  return <g opacity={opac}>{brasas}</g>;
}

function Brasas({ dados, inicio, ativo, enviar, lance }: PropsDoMicro<{ padroes?: Padrao[] }>) {
  const t = useT();
  const padroes = dados.padroes ?? [];
  const { svg, ponteiro, vetor } = useDirecao(ativo);
  const agora = useRelogio(ativo);
  const e = agora - inicio;
  const coelho = useRef({ x: 150, y: 160, antes: 0 });
  const [coracoes, setCoracoes] = useState(CORACOES);
  const invulneravel = useRef(0);
  const fim = useRef(false);

  useEffect(() => {
    if (!ativo || fim.current) return;
    const c = coelho.current;
    const dt = Math.min(0.05, Math.max(0, (agora - (c.antes || agora)) / 1000));
    c.antes = agora;
    if (e < 0) return;
    if (e >= BRASAS_MS) {
      fim.current = true;
      tocar('fim');
      enviar({});
      return;
    }
    const [vx, vy] = vetor([c.x, c.y]);
    c.x = Math.min(300 - 12, Math.max(12, c.x + vx * VEL * dt));
    c.y = Math.min(200 - 12, Math.max(14, c.y + vy * VEL * dt));
    // a fogueira não se atravessa
    const fx = c.x - FOGO[0];
    const fy = c.y - FOGO[1];
    const fd = Math.sqrt(fx * fx + fy * fy);
    if (fd < RAIO_DO_FOGO + RAIO) {
      c.x = FOGO[0] + (fx / (fd || 1)) * (RAIO_DO_FOGO + RAIO);
      c.y = FOGO[1] + (fy / (fd || 1)) * (RAIO_DO_FOGO + RAIO);
    }
    if (e < invulneravel.current) return;
    if (!padroes.some((p) => queima(p, e, c.x, c.y))) return;
    // queimou: quem leva diz, na hora
    invulneravel.current = e + INVULNERAVEL_MS;
    lance({ golpe: true, t: Math.round(e) });
    const resta = coracoes - 1;
    setCoracoes(resta);
    if (resta <= 0) {
      fim.current = true;
      tocar('erro');
      enviar({});
    } else tocar('queda');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agora]);

  const c = coelho.current;
  return (
    <Moldura placar={'❤️'.repeat(coracoes) + '🖤'.repeat(CORACOES - coracoes)} fracao={e / BRASAS_MS}>
      <svg
        ref={svg}
        viewBox="0 0 300 200"
        role="img"
        aria-label={t(NOME)}
        style={{ width: '100%', touchAction: 'none', cursor: ativo ? 'crosshair' : 'default' }}
        {...ponteiro}
      >
        {/* a clareira de noite, a terra batida em volta da fogueira */}
        <rect x="0" y="0" width="300" height="200" rx="12" fill="#3d4f3a" />
        <ellipse cx={FOGO[0]} cy={FOGO[1]} rx="140" ry="92" fill="#6b5640" />
        <ellipse cx={FOGO[0]} cy={FOGO[1]} rx="60" ry="40" fill="#7a6248" />
        {[[22, 20], [278, 24], [20, 180], [282, 178], [150, 10]].map(([x, y], k) => (
          <circle key={k} cx={x} cy={y} r="9" fill="#2f4030" />
        ))}
        {/* a fogueira: lenha e as chamas */}
        <g transform={`translate(${FOGO[0]} ${FOGO[1]})`}>
          <circle r={RAIO_DO_FOGO + 3} fill="#5a4636" />
          <path d="M-14 6 L14 -2 M-14 -2 L14 6" stroke="#7a5238" strokeWidth="5" strokeLinecap="round" />
          <path d={`M0 ${-18 - 2 * Math.sin(e / 70)} Q10 -6 7 4 Q0 9 -7 4 Q-10 -6 0 ${-18 - 2 * Math.sin(e / 70)} Z`} fill="#f08a3a" />
          <path d={`M0 ${-9 - Math.sin(e / 50)} Q5 -2 3 3 Q0 5 -3 3 Q-5 -2 0 ${-9 - Math.sin(e / 50)} Z`} fill="#f8d36a" />
        </g>
        {padroes.map((p, k) => (e >= p.t && e < p.t + AVISO_MS + duracao(p) ? <DesenhoDoPadrao key={k} p={p} e={e} /> : null))}
        {!piscando(e, invulneravel.current) && coracoes > 0 && (
          <g transform={`translate(${c.x} ${c.y + 6})`}>
            <ellipse cx="0" cy="1" rx="8" ry="2.5" fill="rgba(0,0,0,0.3)" />
            <ellipse cx="0" cy="-4" rx="7" ry="5" fill="#e8dccb" />
            <CoelhoDeFrente y={-6} escala={0.62} olhos={e < invulneravel.current ? 'tontos' : 'abertos'} />
          </g>
        )}
      </svg>
    </Moldura>
  );
}

const NOME = chave('Brasas da fogueira');

export default microjogoDaTela({
  id: 'brasas',
  nome: NOME,
  dica: chave('Desvie das brasas. São só três corações!'),
  Tela: Brasas,
  valor: (v, f) => (v >= COM_CORACOES ? '❤️'.repeat(v - COM_CORACOES) : `🔥 ${f.s.format(v / 1000)}`),
});
