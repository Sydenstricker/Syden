import { type ReactNode, useEffect, useRef, useState } from 'react';
import { sounds } from './sounds';

// A vila do Syden: uma praça vista de cima e de lado, como nos jogos de fazenda, desenhada inteira em
// SVG — nenhuma imagem, nenhum download. As casas levam a lugares de verdade do app, e os coelhos andam
// por conta própria pela praça.
//
// Tudo é posicionado num tabuleiro de coluna/fileira e traduzido para a tela por `iso()`. É o que dá o
// ângulo: andar uma casa para o lado move meia largura de piso na horizontal e meia altura na vertical.

/** Metade da largura e da altura de um piso do tabuleiro. */
const TW = 48;
const TH = 24;
/** Onde fica a coluna 0, fileira 0 dentro do desenho. */
const OX = 600;
const OY = 300;
export const LARGURA = 1200;
export const ALTURA = 740;

interface P {
  x: number;
  y: number;
}

/** Leva um ponto do tabuleiro (coluna, fileira, altura em pixels) para o desenho. */
function iso(c: number, r: number, h = 0): P {
  return { x: OX + (c - r) * TW, y: OY + (c + r) * TH - h };
}

/** O caminho de volta: de um ponto do desenho para o tabuleiro (usado no clique na grama). */
function deIso(x: number, y: number) {
  const a = (x - OX) / TW;
  const b = (y - OY) / TH;
  return { c: (a + b) / 2, r: (b - a) / 2 };
}

const pts = (...lista: P[]) => lista.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
const lerp = (a: P, b: P, t: number): P => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const sobe = (p: P, h: number): P => ({ x: p.x, y: p.y - h });

/** Um retângulo colado numa parede: t é o quanto anda pela base, y é a altura. */
function painel(a: P, b: P, t0: number, t1: number, y0: number, y1: number) {
  const p0 = lerp(a, b, t0);
  const p1 = lerp(a, b, t1);
  return pts(sobe(p0, y0), sobe(p1, y0), sobe(p1, y1), sobe(p0, y1));
}

/** Estrela de cinco pontas, a mesma do logo. */
function estrela(cx: number, cy: number, raio: number) {
  const saida = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? raio : raio * 0.42;
    const ang = (Math.PI / 5) * i - Math.PI / 2;
    saida.push(`${(cx + r * Math.cos(ang)).toFixed(2)},${(cy + r * Math.sin(ang)).toFixed(2)}`);
  }
  return saida.join(' ');
}

// ---------------------------------------------------------------------------------------------------
// A ilha
// ---------------------------------------------------------------------------------------------------

const ILHA = { c0: -5.6, c1: 5.6, r0: -3.6, r1: 3.6 };
const ALTURA_ILHA = 116;

const CANTO_TOPO = iso(ILHA.c0, ILHA.r0);
const CANTO_DIR = iso(ILHA.c1, ILHA.r0);
const CANTO_BAIXO = iso(ILHA.c1, ILHA.r1);
const CANTO_ESQ = iso(ILHA.c0, ILHA.r1);

function Ilha() {
  const baixoF = sobe(CANTO_BAIXO, -ALTURA_ILHA);
  const esqF = sobe(CANTO_ESQ, -ALTURA_ILHA);
  const dirF = sobe(CANTO_DIR, -ALTURA_ILHA);
  return (
    <g>
      {/* as duas paredes de pedra que sustentam a vila */}
      <polygon points={pts(CANTO_ESQ, CANTO_BAIXO, baixoF, esqF)} className="v-rocha" />
      <polygon points={pts(CANTO_BAIXO, CANTO_DIR, dirF, baixoF)} className="v-rocha-clara" />
      {/* faixa de terra logo abaixo da grama, para a borda não ficar reta demais */}
      <polygon points={pts(CANTO_ESQ, CANTO_BAIXO, sobe(CANTO_BAIXO, -16), sobe(CANTO_ESQ, -16))} className="v-terra" />
      <polygon points={pts(CANTO_BAIXO, CANTO_DIR, sobe(CANTO_DIR, -16), sobe(CANTO_BAIXO, -16))} className="v-terra-clara" />
      {/* o tampo de grama */}
      <polygon points={pts(CANTO_TOPO, CANTO_DIR, CANTO_BAIXO, CANTO_ESQ)} className="v-grama" />
      <polygon points={pts(CANTO_TOPO, CANTO_DIR, iso(2.2, 0.4), iso(-2.2, -1.2))} className="v-grama-clara" />
      {/* pedras soltas na parede de rocha */}
      {[
        [0.3, 0.55, 14],
        [0.55, 0.3, 10],
        [0.75, 0.62, 12],
        [0.2, 0.75, 9],
      ].map(([t, k, rr], i) => {
        const base = lerp(CANTO_ESQ, CANTO_BAIXO, t);
        return <ellipse key={`e${i}`} cx={base.x} cy={base.y + ALTURA_ILHA * k} rx={rr} ry={rr * 0.7} className="v-pedra-solta" />;
      })}
      {[
        [0.35, 0.45, 12],
        [0.6, 0.7, 10],
        [0.8, 0.35, 13],
      ].map(([t, k, rr], i) => {
        const base = lerp(CANTO_BAIXO, CANTO_DIR, t);
        return <ellipse key={`d${i}`} cx={base.x} cy={base.y + ALTURA_ILHA * k} rx={rr} ry={rr * 0.7} className="v-pedra-solta" />;
      })}
    </g>
  );
}

/** A praça de pedra no meio, onde os coelhos se encontram. */
function Praca() {
  const p = { c0: -3.0, c1: 3.2, r0: -1.2, r1: 3.0 };
  const a = iso(p.c0, p.r0);
  const b = iso(p.c1, p.r0);
  const c = iso(p.c1, p.r1);
  const d = iso(p.c0, p.r1);
  const linhas = [];
  for (let i = 1; i < 7; i++) {
    const t = p.c0 + ((p.c1 - p.c0) * i) / 7;
    linhas.push(<line key={`c${i}`} x1={iso(t, p.r0).x} y1={iso(t, p.r0).y} x2={iso(t, p.r1).x} y2={iso(t, p.r1).y} className="v-junta" />);
  }
  for (let i = 1; i < 5; i++) {
    const t = p.r0 + ((p.r1 - p.r0) * i) / 5;
    linhas.push(<line key={`r${i}`} x1={iso(p.c0, t).x} y1={iso(p.c0, t).y} x2={iso(p.c1, t).x} y2={iso(p.c1, t).y} className="v-junta" />);
  }
  return (
    <g>
      <polygon points={pts(a, b, c, d)} className="v-pedra" />
      {linhas}
    </g>
  );
}

/** Um caminho de pedra saindo de uma casa em direção à praça. */
function Caminho({ c, r, passos }: { c: number; r: number; passos: number }) {
  const largura = 0.55;
  const a = iso(c - largura, r);
  const b = iso(c + largura, r);
  const a2 = iso(c - largura, r + passos);
  const b2 = iso(c + largura, r + passos);
  return <polygon points={pts(a, b, b2, a2)} className="v-pedra" />;
}

// ---------------------------------------------------------------------------------------------------
// As casas
// ---------------------------------------------------------------------------------------------------

/** Altura do telhado de todas as casas: o balão precisa saber disso para flutuar na altura certa. */
const TELHADO = 38;

function Casa({
  c,
  r,
  w,
  d,
  alt,
  telhado = TELHADO,
  aceso,
  destaque,
}: {
  c: number;
  r: number;
  w: number;
  d: number;
  alt: number;
  telhado?: number;
  aceso: boolean;
  destaque: boolean;
}) {
  const A0 = iso(c - w / 2, r - d / 2);
  const B0 = iso(c + w / 2, r - d / 2);
  const C0 = iso(c + w / 2, r + d / 2);
  const D0 = iso(c - w / 2, r + d / 2);
  const o = 0.24;
  const A = sobe(iso(c - w / 2 - o, r - d / 2 - o), alt);
  const B = sobe(iso(c + w / 2 + o, r - d / 2 - o), alt);
  const C = sobe(iso(c + w / 2 + o, r + d / 2 + o), alt);
  const D = sobe(iso(c - w / 2 - o, r + d / 2 + o), alt);
  const m1 = sobe(lerp(A, D, 0.5), telhado);
  const m2 = sobe(lerp(B, C, 0.5), telhado);
  const sombra = iso(c, r + d / 2 + 0.2);
  const meioFrente = lerp(lerp(D, C, 0.5), m1, 0.42);

  return (
    <g className={`v-casa${destaque ? ' destaque' : ''}`}>
      <ellipse cx={sombra.x} cy={sombra.y} rx={w * TW * 0.8} ry={d * TH * 0.8} className="v-sombra" />
      {/* paredes */}
      <polygon points={pts(D0, C0, sobe(C0, alt), sobe(D0, alt))} className="v-parede" />
      <polygon points={pts(C0, B0, sobe(B0, alt), sobe(C0, alt))} className="v-parede-sombra" />
      {/* porta e janelas */}
      <polygon points={painel(D0, C0, 0.42, 0.62, 0, alt * 0.6)} className="v-porta" />
      <polygon points={painel(D0, C0, 0.12, 0.3, alt * 0.28, alt * 0.62)} className={`v-janela${aceso ? ' acesa' : ''}`} />
      <polygon points={painel(D0, C0, 0.72, 0.9, alt * 0.28, alt * 0.62)} className={`v-janela${aceso ? ' acesa' : ''}`} />
      <polygon points={painel(C0, B0, 0.24, 0.46, alt * 0.28, alt * 0.62)} className={`v-janela${aceso ? ' acesa' : ''}`} />
      <polygon points={painel(C0, B0, 0.6, 0.82, alt * 0.28, alt * 0.62)} className={`v-janela${aceso ? ' acesa' : ''}`} />
      {/* telhado */}
      <polygon points={pts(A, B, m2, m1)} className="v-telhado-fundo" />
      <polygon points={pts(A, D, m1)} className="v-telhado-lado" />
      <polygon points={pts(B, C, m2)} className="v-telhado-lado-claro" />
      <polygon points={pts(D, C, m2, m1)} className="v-telhado" />
      <line x1={m1.x} y1={m1.y} x2={m2.x} y2={m2.y} className="v-cumeeira" />
      {/* a estrela do Syden na frente do telhado */}
      <polygon points={estrela(meioFrente.x, meioFrente.y, 9)} className="v-estrela" />
    </g>
  );
}

// ---------------------------------------------------------------------------------------------------
// Coisas pequenas que enchem a vila
// ---------------------------------------------------------------------------------------------------

function Arvore({ c, r, escala = 1 }: { c: number; r: number; escala?: number }) {
  const p = iso(c, r);
  return (
    <g transform={`translate(${p.x} ${p.y}) scale(${escala})`}>
      <ellipse cx={0} cy={0} rx={16} ry={7} className="v-sombra" />
      <rect x={-3} y={-24} width={6} height={24} rx={2} className="v-tronco" />
      <polygon points="0,-78 -20,-34 20,-34" className="v-folha-escura" />
      <polygon points="0,-66 -17,-26 17,-26" className="v-folha" />
      <polygon points="0,-52 -14,-14 14,-14" className="v-folha-clara" />
    </g>
  );
}

/** Um canteiro de cenouras: três fileiras de terra com folhinhas verdes espetadas. */
function Horta({ c, r }: { c: number; r: number }) {
  const a = iso(c - 1.1, r - 0.8);
  const b = iso(c + 1.1, r - 0.8);
  const d = iso(c + 1.1, r + 0.8);
  const e = iso(c - 1.1, r + 0.8);
  const mudas = [];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      const p = iso(c - 0.7 + i * 0.7, r - 0.5 + j * 0.5);
      mudas.push(
        <g key={`${i}-${j}`}>
          <path d={`M${p.x},${p.y} q-5,-6 -8,-3 q5,1 6,4 z`} className="v-folha" />
          <path d={`M${p.x},${p.y} q5,-6 8,-3 q-5,1 -6,4 z`} className="v-folha-escura" />
        </g>,
      );
    }
  }
  return (
    <g>
      <polygon points={pts(a, b, d, e)} className="v-terra-clara" />
      {mudas}
    </g>
  );
}

function Lanterna({ c, r, aceso }: { c: number; r: number; aceso: boolean }) {
  const p = iso(c, r);
  return (
    <g transform={`translate(${p.x} ${p.y})`}>
      <ellipse cx={0} cy={0} rx={7} ry={3} className="v-sombra" />
      <rect x={-2} y={-52} width={4} height={52} rx={2} className="v-ferro" />
      {aceso && <circle cx={0} cy={-58} r={24} className="v-brilho" />}
      <path d="M-7,-66 L7,-66 L5,-52 L-5,-52 Z" className={`v-lampada${aceso ? ' acesa' : ''}`} />
    </g>
  );
}

function Bandeira({ c, r, altura = 86 }: { c: number; r: number; altura?: number }) {
  const p = iso(c, r);
  return (
    <g transform={`translate(${p.x} ${p.y})`}>
      <ellipse cx={0} cy={0} rx={6} ry={3} className="v-sombra" />
      <rect x={-1.6} y={-altura} width={3.2} height={altura} rx={1.6} className="v-ferro" />
      <g className="v-pano">
        <path d={`M1.6,${-altura + 4} L34,${-altura + 12} L34,${-altura + 40} L1.6,${-altura + 34} Z`} className="v-bandeira" />
        <polygon points={estrela(16, -altura + 24, 7)} className="v-estrela" />
      </g>
    </g>
  );
}

function Cerca({ de, para }: { de: [number, number]; para: [number, number] }) {
  const a = iso(de[0], de[1]);
  const b = iso(para[0], para[1]);
  const postes = [];
  const quantos = 6;
  for (let i = 0; i <= quantos; i++) {
    const p = lerp(a, b, i / quantos);
    postes.push(<rect key={i} x={p.x - 2} y={p.y - 26} width={4} height={26} rx={1.5} className="v-madeira" />);
  }
  return (
    <g>
      <line x1={a.x} y1={a.y - 20} x2={b.x} y2={b.y - 20} className="v-trave" />
      <line x1={a.x} y1={a.y - 11} x2={b.x} y2={b.y - 11} className="v-trave" />
      {postes}
    </g>
  );
}

function Fonte({ c, r }: { c: number; r: number }) {
  const a = iso(c - 1, r - 1);
  const b = iso(c + 1, r - 1);
  const d = iso(c + 1, r + 1);
  const e = iso(c - 1, r + 1);
  const meio = iso(c, r);
  return (
    <g>
      <polygon points={pts(e, d, sobe(d, 12), sobe(e, 12))} className="v-fonte-parede" />
      <polygon points={pts(sobe(a, 12), sobe(b, 12), sobe(d, 12), sobe(e, 12))} className="v-fonte-borda" />
      <polygon
        points={pts(
          sobe(lerp(a, meio, 0.34), 10),
          sobe(lerp(b, meio, 0.34), 10),
          sobe(lerp(d, meio, 0.34), 10),
          sobe(lerp(e, meio, 0.34), 10),
        )}
        className="v-agua-fonte"
      />
      <g className="v-esguicho">
        <rect x={meio.x - 3} y={meio.y - 42} width={6} height={30} rx={3} className="v-fonte-parede" />
        <circle cx={meio.x} cy={meio.y - 48} r={8} className="v-agua-fonte" />
      </g>
    </g>
  );
}

/** A estátua do coelho no meio da praça: o mesmo do logo, de pedra, com a bandeira na mão. */
function Estatua({ c, r }: { c: number; r: number }) {
  const base = iso(c, r);
  const a = iso(c - 0.72, r - 0.72);
  const b = iso(c + 0.72, r - 0.72);
  const d = iso(c + 0.72, r + 0.72);
  const e = iso(c - 0.72, r + 0.72);
  const h = 42;
  return (
    <g>
      <ellipse cx={base.x} cy={base.y + 3} rx={42} ry={19} className="v-sombra" />
      <polygon points={pts(e, d, sobe(d, h), sobe(e, h))} className="v-pedestal" />
      <polygon points={pts(d, b, sobe(b, h), sobe(d, h))} className="v-pedestal-sombra" />
      <polygon points={pts(sobe(a, h), sobe(b, h), sobe(d, h), sobe(e, h))} className="v-pedestal-topo" />
      <polygon points={estrela(lerp(e, d, 0.5).x, lerp(e, d, 0.5).y - h / 2, 11)} className="v-estrela" />
      {/* É o mesmo coelho que anda pela praça, só que maior e com a bandeira na mão: assim quem olha
          reconhece o personagem na hora, em vez de ver um vulto de pedra. */}
      <g transform={`translate(${base.x} ${base.y - h - 2}) scale(2.2)`}>
        <rect x={9} y={-46} width={2} height={46} rx={1} className="v-estatua-escura" />
        <path d="M11,-46 L29,-41 L29,-27 L11,-32 Z" className="v-bandeira" />
        <CoelhoArte id={0} />
      </g>
    </g>
  );
}

/** A ponte de madeira que sai da vila para o desconhecido. */
function Ponte({ c, r }: { c: number; r: number }) {
  const a = iso(c, r);
  const b = iso(c - 2.4, r + 2.4);
  const tabuas = [];
  for (let i = 0; i <= 8; i++) {
    const p = lerp(a, b, i / 8);
    tabuas.push(<rect key={i} x={p.x - 19} y={p.y - 3} width={38} height={6} rx={2} className="v-madeira" transform={`rotate(-26 ${p.x} ${p.y})`} />);
  }
  return (
    <g>
      <polygon points={pts(sobe(a, -8), sobe(b, -8), sobe(b, 4), sobe(a, 4))} className="v-madeira-escura" />
      {tabuas}
      <line x1={a.x - 14} y1={a.y - 24} x2={b.x - 14} y2={b.y - 24} className="v-trave" />
      <line x1={a.x + 14} y1={a.y - 18} x2={b.x + 14} y2={b.y - 18} className="v-trave" />
    </g>
  );
}

/** O píer e o barquinho de vela vermelha: os dois na água, depois da borda da ilha. */
function Pier() {
  // Coordenadas na mão: o píer nasce no pé da rocha, que fica abaixo da ponta de baixo da ilha.
  const a = { x: 740, y: 620 };
  const b = { x: 876, y: 688 };
  const a2 = { x: 740, y: 644 };
  const b2 = { x: 876, y: 712 };
  const barco = { x: 996, y: 612 };
  return (
    <g>
      <polygon points={pts(a, b, b2, a2)} className="v-madeira" />
      <polygon points={pts(a2, b2, sobe(b2, -9), sobe(a2, -9))} className="v-madeira-escura" />
      {[0.2, 0.55, 0.9].map((t) => {
        const p = lerp(a2, b2, t);
        return <rect key={t} x={p.x - 2.5} y={p.y} width={5} height={22} rx={2} className="v-madeira-escura" />;
      })}
      <g className="v-barco">
        <ellipse cx={barco.x} cy={barco.y + 16} rx={60} ry={9} className="v-reflexo" />
        <path d={`M${barco.x - 44},${barco.y} q44,28 88,0 q-44,15 -88,0 Z`} className="v-casco" />
        <rect x={barco.x + 2} y={barco.y - 64} width={4} height={64} rx={2} className="v-madeira-escura" />
        <path d={`M${barco.x + 6},${barco.y - 62} L${barco.x + 48},${barco.y - 14} L${barco.x + 6},${barco.y - 6} Z`} className="v-bandeira" />
        <polygon points={estrela(barco.x + 20, barco.y - 32, 7)} className="v-estrela" />
      </g>
    </g>
  );
}

// ---------------------------------------------------------------------------------------------------
// Os coelhos
// ---------------------------------------------------------------------------------------------------

/**
 * Coelho não fala: sente. Cutucado, ele solta um sentimento numa bolha — e o mesmo desenho serve para
 * qualquer pessoa, em qualquer idioma.
 */
const SENTIMENTOS = ['❤️', '✨', '🥕', '😴', '🎵', '🌸', '😊', '👀', '🥰', '😮', '🌟', '🍀', '☀️', '🫧'];

/** Quantas cenouras é preciso plantar para a turma engordar. */
const CENOURAS_PARA_ENGORDAR = 5;
const CHAVE_CENOURAS = 'syden.cenouras';

function lerCenouras(): number {
  try {
    return Number(localStorage.getItem(CHAVE_CENOURAS)) || 0;
  } catch {
    return 0; // navegador sem armazenamento: os coelhos só não guardam a dieta
  }
}

function guardarCenouras(quantas: number) {
  try {
    localStorage.setItem(CHAVE_CENOURAS, String(quantas));
  } catch {
    // sem armazenamento: vale só enquanto a aba estiver aberta
  }
}

/** Onde os coelhos podem andar: a praça e o gramado da frente. */
const PASSEIO = { c0: -2.6, c1: 2.8, r0: -0.6, r1: 2.8 };
/** Velocidade: quantos pisos por segundo. */
const PASSO = 0.9;

const UNIFORMES = [
  { pano: '#c8102e', sombra: '#990c23' },
  { pano: '#d8572f', sombra: '#a8401f' },
  { pano: '#b4243f', sombra: '#8a1a30' },
  { pano: '#c8102e', sombra: '#990c23' },
  { pano: '#e07a3c', sombra: '#b05a28' },
  { pano: '#a81d3a', sombra: '#7f142b' },
];

interface CoelhoNaVila {
  id: number;
  c: number;
  r: number;
  dur: number;
  olhandoEsquerda: boolean;
  fala: string | null;
  pulando: boolean;
}

/** Onde fica a fonte: ninguém anda por dentro dela. */
const FONTE = { c: 0.6, r: 1.9, raio: 1.35 };

/** Empurra um ponto para fora da fonte: cenoura dentro d'água faria a turma toda pisar nela. */
function foraDaFonte(ponto: { c: number; r: number }) {
  const dc = ponto.c - FONTE.c;
  const dr = ponto.r - FONTE.r;
  const dist = Math.hypot(dc, dr);
  if (dist >= FONTE.raio) return ponto;
  if (dist < 0.001) return { c: FONTE.c, r: FONTE.r + FONTE.raio };
  return { c: FONTE.c + (dc / dist) * FONTE.raio, r: FONTE.r + (dr / dist) * FONTE.raio };
}

function sorteioNoPasseio() {
  for (let tentativa = 0; tentativa < 12; tentativa++) {
    const ponto = {
      c: PASSEIO.c0 + Math.random() * (PASSEIO.c1 - PASSEIO.c0),
      r: PASSEIO.r0 + Math.random() * (PASSEIO.r1 - PASSEIO.r0),
    };
    if (Math.hypot(ponto.c - FONTE.c, ponto.r - FONTE.r) > FONTE.raio) return ponto;
  }
  return { c: PASSEIO.c0, r: PASSEIO.r0 };
}

/**
 * O coelho. Bem alimentado (cinco cenouras plantadas), ele engorda: a barriga alarga, as bochechas
 * crescem e as orelhas encolhem um pouco — é o "BigChunkus" que o usuário desenhou, em movimento.
 */
function CoelhoArte({ id, gordo = false }: { id: number; gordo?: boolean }) {
  const u = UNIFORMES[id % UNIFORMES.length];
  // Uma medida só comanda a silhueta inteira, para o gordo continuar sendo o mesmo bicho.
  const barriga = gordo ? 12.6 : 8.6;
  const altura = gordo ? 10.4 : 9.6;
  const cabeca = gordo ? 9.2 : 7.8;
  const orelha = gordo ? 7.6 : 9;
  const patas = gordo ? 7 : 5;
  const centro = gordo ? -11.5 : -11;
  const topo = gordo ? -24.5 : -23;
  const pontaOrelha = topo - (gordo ? 7 : 8);
  return (
    <g className={gordo ? 'v-gordo' : undefined}>
      <ellipse cx={0} cy={0} rx={gordo ? 15 : 12} ry={gordo ? 6 : 5} className="v-sombra" />
      {/* orelhas */}
      <ellipse cx={-4.6} cy={pontaOrelha} rx={3.2} ry={orelha} fill="#f7f1e6" transform={`rotate(-10 -4.6 ${pontaOrelha})`} />
      <ellipse cx={4.6} cy={pontaOrelha} rx={3.2} ry={orelha} fill="#f7f1e6" transform={`rotate(10 4.6 ${pontaOrelha})`} />
      <ellipse cx={-4.6} cy={pontaOrelha} rx={1.4} ry={orelha * 0.6} fill="#efaab6" transform={`rotate(-10 -4.6 ${pontaOrelha})`} />
      <ellipse cx={4.6} cy={pontaOrelha} rx={1.4} ry={orelha * 0.6} fill="#efaab6" transform={`rotate(10 4.6 ${pontaOrelha})`} />
      {/* pés e corpo de uniforme */}
      <ellipse cx={-patas} cy={-2} rx={4} ry={2.4} fill={u.sombra} />
      <ellipse cx={patas} cy={-2} rx={4} ry={2.4} fill={u.sombra} />
      <ellipse cx={0} cy={centro} rx={barriga} ry={altura} fill={u.pano} />
      <ellipse cx={-(barriga - 1.2)} cy={centro} rx={2.6} ry={5} fill={u.sombra} />
      <ellipse cx={barriga - 1.2} cy={centro} rx={2.6} ry={5} fill={u.sombra} />
      <polygon points={estrela(0, centro, gordo ? 4.4 : 3.6)} className="v-estrela" />
      {/* cabeça */}
      <circle cx={0} cy={topo} r={cabeca} fill="#f7f1e6" />
      {gordo && (
        <>
          <ellipse cx={-cabeca * 0.78} cy={topo + 2.6} rx={3.4} ry={3} fill="#f7f1e6" />
          <ellipse cx={cabeca * 0.78} cy={topo + 2.6} rx={3.4} ry={3} fill="#f7f1e6" />
        </>
      )}
      <circle cx={-3} cy={topo - 0.4} r={1.3} fill="#3b3a38" />
      <circle cx={3} cy={topo - 0.4} r={1.3} fill="#3b3a38" />
      <circle cx={-2.6} cy={topo - 0.9} r={0.45} fill="#fff" />
      <circle cx={3.4} cy={topo - 0.9} r={0.45} fill="#fff" />
      <path d={`M0,${topo + 2} l-1.3,1.2 h2.6 z`} fill="#e0879a" />
      {/* boné com estrela */}
      <path d={`M-8.4,${topo - 4.4} Q0,${topo - 10.6} 8.4,${topo - 4.4} L8.4,${topo - 2.6} Q0,${topo - 7.4} -8.4,${topo - 2.6} Z`} fill={u.pano} />
      <path d={`M-9.8,${topo - 3} Q0,${topo - 6.6} 5.4,${topo - 2.4} L-9.6,${topo - 1.4} Z`} fill={u.sombra} />
      <polygon points={estrela(0, topo - 6.4, 2.4)} className="v-estrela" />
    </g>
  );
}

// ---------------------------------------------------------------------------------------------------
// A cena inteira
// ---------------------------------------------------------------------------------------------------

export type Periodo = 'manha' | 'tarde' | 'entardecer' | 'noite';

export interface PinoVila {
  id: string;
  titulo: string;
  sub: string;
  icone: ReactNode;
  /** Posição do balão em % da cena. */
  x: number;
  y: number;
  onClick: () => void;
}

/** Onde cada casa fica no tabuleiro — os balões apontam para elas, e nenhuma pode passar da borda. */
export const CASAS = {
  salas: { c: -3.6, r: -1.4, w: 3.0, d: 2.4, alt: 58 },
  loja: { c: 1.0, r: -2.4, w: 2.6, d: 2.0, alt: 52 },
  aprender: { c: 4.0, r: -0.6, w: 2.6, d: 2.2, alt: 56 },
  explorar: { c: -4.2, r: 2.4, w: 2.2, d: 1.8, alt: 46 },
};

/** Onde o balão de uma casa deve flutuar, em % da cena: logo acima do telhado. */
export function balaoDaCasa(casa: { c: number; r: number; alt: number }, telhado = TELHADO) {
  const p = iso(casa.c, casa.r, casa.alt + telhado);
  // O balão cresce para cima a partir daqui; abaixo de 10% ele sairia pela borda de cima da cena.
  return { x: (p.x / LARGURA) * 100, y: Math.max(10, (p.y / ALTURA) * 100) };
}

export function Vila({
  periodo,
  onLuz,
  pinos,
  destaque,
  onDestaque,
}: {
  periodo: Periodo;
  onLuz: () => void;
  pinos: PinoVila[];
  /** O balão sob o mouse acende a casa correspondente. */
  destaque: string | null;
  onDestaque: (id: string | null) => void;
}) {
  const noite = periodo === 'noite';
  const [coelhos, setCoelhos] = useState<CoelhoNaVila[]>(() =>
    [0, 1, 2, 3, 4, 5].map((id) => ({ id, ...sorteioNoPasseio(), dur: 0, olhandoEsquerda: id % 2 === 0, fala: null, pulando: false })),
  );
  const [cenoura, setCenoura] = useState<{ c: number; r: number; id: number } | null>(null);
  const [cutucados, setCutucados] = useState(0);
  // Cenouras plantadas até hoje. Passando de cinco, a turma engorda — e continua gorda no próximo dia.
  const [cenouras, setCenouras] = useState(lerCenouras);
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Vida própria: de tempos em tempos um ou outro resolve dar uma volta.
  useEffect(() => {
    const timer = setInterval(() => {
      setCoelhos((lista) => lista.map((coelho) => (Math.random() < 0.5 ? caminhar(coelho, sorteioNoPasseio()) : coelho)));
    }, 2600);
    return () => clearInterval(timer);
  }, []);

  function cutucar(id: number) {
    sounds.bunny();
    setCutucados((n) => n + 1);
    const fala = SENTIMENTOS[Math.floor(Math.random() * SENTIMENTOS.length)];
    setCoelhos((lista) => lista.map((c) => (c.id === id ? { ...c, fala, pulando: true } : c)));
    setTimeout(() => setCoelhos((lista) => lista.map((c) => (c.id === id ? { ...c, pulando: false } : c))), 800);
    setTimeout(() => setCoelhos((lista) => lista.map((c) => (c.id === id ? { ...c, fala: null } : c))), 2800);
  }

  /** Clicar na grama planta uma cenoura, e a turma toda vai atrás dela. */
  function plantar(event: React.MouseEvent<SVGElement>) {
    const caixa = svgRef.current?.getBoundingClientRect();
    if (!caixa) return;
    const x = ((event.clientX - caixa.left) / caixa.width) * LARGURA;
    const y = ((event.clientY - caixa.top) / caixa.height) * ALTURA;
    const ponto = deIso(x, y);
    const alvo = foraDaFonte({
      c: Math.min(PASSEIO.c1, Math.max(PASSEIO.c0, ponto.c)),
      r: Math.min(PASSEIO.r1, Math.max(PASSEIO.r0, ponto.r)),
    });
    const id = Date.now();
    setCenoura({ ...alvo, id });
    setCenouras((quantas) => {
      const proxima = quantas + 1;
      guardarCenouras(proxima);
      return proxima;
    });
    setCoelhos((lista) =>
      lista.map((coelho, i) =>
        caminhar(coelho, {
          c: Math.min(PASSEIO.c1, Math.max(PASSEIO.c0, alvo.c + (i - 2.5) * 0.42)),
          r: Math.min(PASSEIO.r1, Math.max(PASSEIO.r0, alvo.r + (i % 2 === 0 ? 0.34 : -0.34))),
        }),
      ),
    );
    setTimeout(() => setCenoura((atual) => (atual?.id === id ? null : atual)), 5200);
  }

  /** Bem alimentados: passou de cinco cenouras, a turma engorda. */
  const gordos = cenouras >= CENOURAS_PARA_ENGORDAR;

  /** Quem engordou pode voltar à forma: zera a conta das cenouras. */
  function reiniciarDieta() {
    setCenouras(0);
    guardarCenouras(0);
  }

  const cenouraPonto = cenoura ? iso(cenoura.c, cenoura.r) : null;

  return (
    <div className={`vila vila-${periodo}`}>
      <svg ref={svgRef} className="vila-art" viewBox={`0 0 ${LARGURA} ${ALTURA}`} role="img" aria-label="A vila do Syden">
        <defs>
          <linearGradient id="v-ceu" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" className="v-ceu-alto" />
            <stop offset="100%" className="v-ceu-baixo" />
          </linearGradient>
          <linearGradient id="v-mar" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" className="v-mar-alto" />
            <stop offset="100%" className="v-mar-baixo" />
          </linearGradient>
          <radialGradient id="v-brilho-sol">
            <stop offset="35%" className="v-halo-dentro" />
            <stop offset="100%" className="v-halo-fora" />
          </radialGradient>
        </defs>

        <rect width={LARGURA} height={ALTURA} fill="url(#v-ceu)" />

        {/* o sol (ou a lua): clicar troca o tema do Syden inteiro */}
        <g
          className="v-luz"
          role="button"
          tabIndex={0}
          aria-label={noite ? 'Clarear o Syden' : 'Escurecer o Syden'}
          onClick={onLuz}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onLuz()}
        >
          <title>{noite ? 'Clarear o Syden' : 'Escurecer o Syden'}</title>
          <circle cx={1064} cy={96} r={noite ? 78 : 146} className="v-halo" fill="url(#v-brilho-sol)" />
          <circle cx={1064} cy={96} r={noite ? 54 : 118} className="v-disco" />
          {noite && <circle cx={1092} cy={76} r={46} className="v-lua-mordida" />}
        </g>

        {noite &&
          Array.from({ length: 34 }, (_, i) => (
            <circle
              key={i}
              className="v-estrelinha"
              cx={(i * 149) % LARGURA}
              cy={(i * 83) % 290}
              r={i % 3 === 0 ? 2 : 1.3}
              style={{ animationDelay: `${(i % 7) * 0.4}s` }}
            />
          ))}

        {/* montanhas ao fundo */}
        <polygon points="0,340 130,150 250,250 360,120 520,340" className="v-montanha-longe" />
        <polygon points="700,340 860,140 980,240 1090,130 1200,340" className="v-montanha-longe" />
        <polygon points="-40,344 120,205 300,344" className="v-montanha" />
        <polygon points="240,344 420,170 600,344" className="v-montanha" />
        <polygon points="560,344 760,190 960,344" className="v-montanha" />
        <polygon points="900,344 1080,200 1240,344" className="v-montanha" />

        <g className="v-nuvens">
          <ellipse className="v-nuvem n1" cx={200} cy={120} rx={70} ry={21} />
          <ellipse className="v-nuvem n2" cx={520} cy={84} rx={54} ry={17} />
          <ellipse className="v-nuvem n3" cx={1040} cy={190} rx={62} ry={19} />
        </g>

        {/* o mar */}
        <rect x={0} y={300} width={LARGURA} height={ALTURA - 300} fill="url(#v-mar)" />
        {[380, 440, 500, 580, 660, 730].map((y, i) => (
          <line key={y} className="v-onda" x1={60 + (i % 3) * 130} y1={y} x2={280 + (i % 3) * 170} y2={y} style={{ animationDelay: `${i * 0.6}s` }} />
        ))}

        <Ilha />
        <Praca />
        <Caminho c={CASAS.loja.c} r={CASAS.loja.r + 1.1} passos={1.4} />
        <Caminho c={CASAS.salas.c + 1.0} r={CASAS.salas.r + 1.3} passos={1.4} />

        {/* o fundo da vila */}
        <Arvore c={-1.4} r={-3.2} escala={0.95} />
        <Arvore c={3.0} r={-3.2} escala={0.85} />
        <Arvore c={5.0} r={-3.0} escala={0.9} />
        <Arvore c={-5.0} r={-2.4} escala={0.8} />
        <Bandeira c={-0.4} r={-3.3} />
        <Bandeira c={4.2} r={-3.2} altura={72} />

        <Casa {...CASAS.loja} aceso={noite} destaque={destaque === 'loja'} />
        <Casa {...CASAS.salas} aceso={noite} destaque={destaque === 'salas'} />
        <Casa {...CASAS.aprender} aceso={noite} destaque={destaque === 'aprender'} />

        <Horta c={3.4} r={-2.6} />
        <Estatua c={-0.4} r={-0.4} />
        <Lanterna c={-2.6} r={-0.9} aceso={noite} />
        <Lanterna c={2.9} r={-0.9} aceso={noite} />

        <Casa {...CASAS.explorar} aceso={noite} destaque={destaque === 'explorar'} />
        <Ponte c={-5.0} r={3.0} />
        <Cerca de={[-5.3, 3.35]} para={[-2.2, 3.35]} />
        <Cerca de={[1.4, 3.35]} para={[5.3, 3.35]} />
        <Arvore c={-4.6} r={0.6} escala={0.75} />
        <Arvore c={5.0} r={1.2} escala={0.75} />
        <Arvore c={4.4} r={2.4} escala={0.7} />

        <Fonte c={0.6} r={1.9} />
        <Lanterna c={-2.9} r={2.6} aceso={noite} />
        <Lanterna c={3.1} r={2.4} aceso={noite} />
        {/* florzinhas soltas na grama da frente */}
        {[
          [-1.9, 3.0],
          [-0.7, 3.1],
          [1.0, 3.1],
          [2.2, 2.9],
          [-3.4, 2.0],
          [4.6, 0.2],
        ].map(([fc, fr], i) => {
          const p = iso(fc, fr);
          return (
            <g key={`f${i}`}>
              <circle cx={p.x} cy={p.y - 4} r={3} className={i % 2 === 0 ? 'v-flor-a' : 'v-flor-b'} />
              <rect x={p.x - 0.8} y={p.y - 4} width={1.6} height={5} className="v-folha-escura" />
            </g>
          );
        })}

        {/* o gramado que aceita cenoura */}
        <polygon className="v-chao-clicavel" points={pts(CANTO_TOPO, CANTO_DIR, CANTO_BAIXO, CANTO_ESQ)} onClick={plantar}>
          <title>Plantar uma cenoura</title>
        </polygon>

        {cenouraPonto && (
          <g transform={`translate(${cenouraPonto.x} ${cenouraPonto.y})`}>
            {/* o desenho fica num grupo de dentro: a animação mexe no transform, e o de fora é a posição */}
            <g className="v-cenoura">
              <ellipse cx={0} cy={0} rx={9} ry={4} className="v-sombra" />
              <path d="M-6,-20 L6,-20 L0,0 Z" fill="#e8762c" />
              <path d="M0,-20 q-8,-8 -11,-3 q7,1 9,5 z" fill="#5f9a4a" />
              <path d="M0,-20 q8,-8 11,-3 q-7,1 -9,5 z" fill="#4f8a3c" />
            </g>
          </g>
        )}

        {/* os coelhos, sempre por cima do cenário do meio */}
        {coelhos.map((coelho) => {
          const p = iso(coelho.c, coelho.r);
          const escala = 0.95 + ((coelho.r - PASSEIO.r0) / (PASSEIO.r1 - PASSEIO.r0)) * 0.3;
          return (
            <g
              key={coelho.id}
              className={`v-coelho${coelho.pulando ? ' cutucado' : ''}`}
              style={{ transform: `translate(${p.x}px, ${p.y}px)`, transitionDuration: `${coelho.dur}s` }}
              role="button"
              tabIndex={0}
              aria-label="Cutucar o coelho"
              onClick={(e) => {
                e.stopPropagation();
                cutucar(coelho.id);
              }}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && cutucar(coelho.id)}
            >
              <title>Cutucar o coelho</title>
              {/* o tamanho vai no atributo, não no CSS: assim a animação de andar mexe só na posição */}
              <g transform={`scale(${(coelho.olhandoEsquerda ? -escala : escala).toFixed(2)} ${escala.toFixed(2)})`}>
                <g className="v-coelho-corpo">
                  <CoelhoArte id={coelho.id} gordo={gordos} />
                </g>
              </g>
              {coelho.fala && (
                <g className="v-fala">
                  <circle cx={0} cy={-58} r={17} />
                  <circle cx={-5} cy={-38} r={4} />
                  <circle cx={-10} cy={-30} r={2.4} />
                  <text x={0} y={-51} textAnchor="middle">
                    {coelho.fala}
                  </text>
                </g>
              )}
            </g>
          );
        })}

        <Pier />
      </svg>

      {/* Os balões: é por aqui que a vila leva a algum lugar de verdade. */}
      {pinos.map((pino) => (
        <button
          key={pino.id}
          className={`vila-pino${destaque === pino.id ? ' aceso' : ''}`}
          style={{ left: `${pino.x}%`, top: `${pino.y}%` }}
          onClick={pino.onClick}
          onMouseEnter={() => onDestaque(pino.id)}
          onMouseLeave={() => onDestaque(null)}
          onFocus={() => onDestaque(pino.id)}
          onBlur={() => onDestaque(null)}
        >
          <span className="vila-pino-icone" aria-hidden="true">
            {pino.icone}
          </span>
          <span className="vila-pino-texto">
            <strong>{pino.titulo}</strong>
            <small>{pino.sub}</small>
          </span>
        </button>
      ))}

      <p className="vila-dica">
        Cutuque os coelhos, clique na grama para plantar uma cenoura.
        {cutucados > 0 && ` · ${cutucados} ${cutucados === 1 ? 'cutucada' : 'cutucadas'} hoje`}
        {cenouras > 0 && ` · 🥕 ${cenouras}`}
        {gordos && (
          <>
            {' · a turma engordou! '}
            <button className="vila-dieta" onClick={reiniciarDieta}>
              colocar de dieta
            </button>
          </>
        )}
      </p>
    </div>
  );
}

/** Manda um coelho para um lugar novo, com o tempo de viagem proporcional à distância. */
function caminhar(coelho: CoelhoNaVila, destino: { c: number; r: number }): CoelhoNaVila {
  const dist = Math.hypot(destino.c - coelho.c, destino.r - coelho.r);
  const alvoX = iso(destino.c, destino.r).x;
  return {
    ...coelho,
    c: destino.c,
    r: destino.r,
    dur: Math.max(0.6, dist / PASSO),
    olhandoEsquerda: alvoX < iso(coelho.c, coelho.r).x,
  };
}
