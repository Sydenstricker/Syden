import { CoelhoDeFrente } from './comum';

/**
 * OS BICHOS DA HORTA do lote 1 de microjogos (05/11/2026): os desenhos de frente que o "Quem dançou em terceiro?", o "Quem está
 * atrás da turma?" e o "Quem está em qual toca?" usam. Cada bicho tem o pé em (0, 0), uns 56 de altura e 46 de largura; todos
 * diferentes pela FORMA e pela COR (nenhuma letra), para serem reconhecidos de relance e por quem não distingue bem as cores.
 */
export type NomeDoBicho = 'coelho' | 'raposa' | 'corvo' | 'sapo' | 'ourico' | 'toupeira' | 'esquilo' | 'gato' | 'cachorro' | 'coruja';

const CONTORNO = '#3a2e2a';

function Olhos({ y = -36, dx = 5, r = 2 }: { y?: number; dx?: number; r?: number }) {
  return (
    <>
      <circle cx={-dx} cy={y} r={r} fill={CONTORNO} />
      <circle cx={dx} cy={y} r={r} fill={CONTORNO} />
      <circle cx={-dx + 0.7} cy={y - 0.7} r={r / 3} fill="#fff" />
      <circle cx={dx + 0.7} cy={y - 0.7} r={r / 3} fill="#fff" />
    </>
  );
}

function Pes({ cor }: { cor: string }) {
  return (
    <>
      <ellipse cx="-8" cy="-2" rx="6" ry="3" fill={cor} />
      <ellipse cx="8" cy="-2" rx="6" ry="3" fill={cor} />
    </>
  );
}

export function Bicho({ nome, x = 0, y = 0, escala = 1, espelhar = false }: { nome: NomeDoBicho; x?: number; y?: number; escala?: number; espelhar?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${espelhar ? -escala : escala} ${escala})`}>
      <Desenho nome={nome} />
    </g>
  );
}

function Desenho({ nome }: { nome: NomeDoBicho }) {
  switch (nome) {
    case 'coelho':
      return (
        <>
          <Pes cor="#d8c9b4" />
          <ellipse cx="0" cy="-14" rx="14" ry="13" fill="#e8dccb" />
          <ellipse cx="0" cy="-11" rx="8" ry="8" fill="#f4ede2" />
          {/* o cachecol vermelho: o coelho da turma, diferente dos outros de relance */}
          <rect x="-12" y="-27" width="24" height="5" rx="2.5" fill="#d9534f" />
          <CoelhoDeFrente y={-24} escala={1.05} />
        </>
      );
    case 'raposa':
      return (
        <>
          <path d="M10 -8 Q30 -12 26 -30 Q20 -18 8 -16 Z" fill="#e07a2e" />
          <path d="M26 -30 Q29 -24 24 -21 Q22 -26 26 -30 Z" fill="#f4ede2" />
          <Pes cor={CONTORNO} />
          <ellipse cx="0" cy="-14" rx="12" ry="13" fill="#e07a2e" />
          <ellipse cx="0" cy="-11" rx="6" ry="8" fill="#f4ede2" />
          <path d="M-15 -34 L-12 -54 L-3 -42 Z M15 -34 L12 -54 L3 -42 Z" fill="#e07a2e" />
          <path d="M-12.5 -38 L-11.5 -49 L-6 -42 Z M12.5 -38 L11.5 -49 L6 -42 Z" fill={CONTORNO} />
          <path d="M-16 -36 Q0 -48 16 -36 L0 -20 Z" fill="#e07a2e" />
          <path d="M-12 -30 L0 -20 L12 -30 Q0 -26 -12 -30 Z" fill="#f4ede2" />
          <Olhos y={-35} dx={6} />
          <circle cx="0" cy="-22" r="2" fill={CONTORNO} />
        </>
      );
    case 'corvo':
      return (
        <>
          <path d="M-5 -1 L-5 -6 M5 -1 L5 -6" stroke="#e0a83a" strokeWidth="2" />
          <path d="M-8 0 L-2 0 M2 0 L8 0" stroke="#e0a83a" strokeWidth="2" strokeLinecap="round" />
          <ellipse cx="0" cy="-20" rx="14" ry="15" fill="#2e2b33" />
          <path d="M-14 -20 Q-22 -10 -12 -8 Z M14 -20 Q22 -10 12 -8 Z" fill="#45404d" />
          <circle cx="0" cy="-38" r="11" fill="#2e2b33" />
          <path d="M-4 -46 L-2 -52 L1 -47 L4 -51 L4 -45 Z" fill="#2e2b33" />
          <circle cx="-4.5" cy="-40" r="3.2" fill="#f4ede2" />
          <circle cx="4.5" cy="-40" r="3.2" fill="#f4ede2" />
          <circle cx="-4" cy="-40" r="1.6" fill={CONTORNO} />
          <circle cx="5" cy="-40" r="1.6" fill={CONTORNO} />
          <path d="M-5 -35 L5 -35 L0 -26 Z" fill="#f2c46a" stroke="#c98a2e" strokeWidth="0.8" />
        </>
      );
    case 'sapo':
      return (
        <>
          <ellipse cx="-12" cy="-3" rx="9" ry="4" fill="#5d8f47" />
          <ellipse cx="12" cy="-3" rx="9" ry="4" fill="#5d8f47" />
          <ellipse cx="0" cy="-14" rx="19" ry="13" fill="#7cb85a" />
          <ellipse cx="0" cy="-11" rx="11" ry="7" fill="#c9e3a0" />
          <ellipse cx="0" cy="-30" rx="21" ry="12" fill="#7cb85a" />
          <circle cx="-11" cy="-41" r="7" fill="#7cb85a" />
          <circle cx="11" cy="-41" r="7" fill="#7cb85a" />
          <circle cx="-11" cy="-42" r="4.5" fill="#f4ede2" />
          <circle cx="11" cy="-42" r="4.5" fill="#f4ede2" />
          <circle cx="-11" cy="-42" r="2.4" fill={CONTORNO} />
          <circle cx="11" cy="-42" r="2.4" fill={CONTORNO} />
          <path d="M-12 -27 Q0 -20 12 -27" stroke="#3e6a2e" strokeWidth="2" fill="none" strokeLinecap="round" />
        </>
      );
    case 'ourico':
      return (
        <>
          <Pes cor="#6e4f38" />
          {/* os espinhos em volta, a cara clara no meio */}
          <path
            d="M-22 -6 L-28 -14 L-22 -18 L-29 -27 L-20 -30 L-24 -41 L-13 -40 L-12 -52 L-3 -45 L2 -56 L8 -45 L16 -52 L16 -40 L26 -42 L22 -31 L30 -27 L23 -18 L29 -12 L22 -6 Z"
            fill="#7a5238"
          />
          <ellipse cx="0" cy="-20" rx="14" ry="16" fill="#e8d2b0" />
          <Olhos y={-26} dx={5} />
          <ellipse cx="0" cy="-17" rx="3.4" ry="2.6" fill={CONTORNO} />
          <circle cx="-9" cy="-19" r="2.4" fill="#e4b5b0" opacity="0.8" />
          <circle cx="9" cy="-19" r="2.4" fill="#e4b5b0" opacity="0.8" />
        </>
      );
    case 'toupeira':
      return (
        <>
          <ellipse cx="0" cy="-20" rx="17" ry="20" fill="#5e5560" />
          <ellipse cx="0" cy="-14" rx="10" ry="11" fill="#7a7180" />
          {/* as mãos de cavar, rosadas, e o focinho comprido */}
          <path d="M-20 -10 l-6 4 l2 -6 l-4 -1 l6 -4 Z M20 -10 l6 4 l-2 -6 l4 -1 l-6 -4 Z" fill="#e4a5a0" />
          <ellipse cx="-7" cy="-1" rx="6" ry="2.5" fill="#e4a5a0" />
          <ellipse cx="7" cy="-1" rx="6" ry="2.5" fill="#e4a5a0" />
          <path d="M-3 -46 L-1 -51 L1 -46 L3 -51 L5 -45 Z" fill="#5e5560" />
          <circle cx="-6" cy="-34" r="1.4" fill={CONTORNO} />
          <circle cx="6" cy="-34" r="1.4" fill={CONTORNO} />
          <ellipse cx="0" cy="-27" rx="6" ry="4.5" fill="#e48a95" />
          <ellipse cx="0" cy="-28" rx="2" ry="1.2" fill="#f4ede2" opacity="0.7" />
        </>
      );
    case 'esquilo':
      return (
        <>
          {/* o rabo enrolado, maior que o corpo */}
          <path d="M8 -6 Q34 -4 30 -32 Q28 -54 12 -50 Q24 -42 18 -30 Q14 -20 6 -18 Z" fill="#b8643a" />
          <path d="M24 -44 Q28 -36 22 -30" stroke="#d98a5a" strokeWidth="3" fill="none" strokeLinecap="round" />
          <Pes cor="#8e4a2a" />
          <ellipse cx="-2" cy="-14" rx="11" ry="13" fill="#b8643a" />
          <ellipse cx="-2" cy="-11" rx="6" ry="8" fill="#f2d9b8" />
          <circle cx="-2" cy="-34" r="11" fill="#b8643a" />
          <path d="M-12 -40 L-11 -51 L-6 -43 Z M8 -40 L7 -51 L2 -43 Z" fill="#b8643a" />
          <path d="M-11 -51 l-1 -3 M-11 -51 l2 -3 M7 -51 l-2 -3 M7 -51 l1 -3" stroke="#8e4a2a" strokeWidth="1.5" strokeLinecap="round" />
          <Olhos y={-36} dx={4.5} />
          <ellipse cx="-2" cy="-29" rx="5" ry="3.5" fill="#f2d9b8" />
          <circle cx="-2" cy="-30" r="1.4" fill={CONTORNO} />
        </>
      );
    case 'gato':
      return (
        <>
          <path d="M10 -6 Q26 -6 24 -22 Q23 -30 28 -32" stroke="#9a9aa4" strokeWidth="5" fill="none" strokeLinecap="round" />
          <Pes cor="#7c7c86" />
          <ellipse cx="0" cy="-14" rx="12" ry="13" fill="#9a9aa4" />
          <path d="M-10 -18 L-4 -16 M-11 -12 L-5 -11 M10 -18 L4 -16 M11 -12 L5 -11" stroke="#6a6a74" strokeWidth="2" strokeLinecap="round" />
          <path d="M-14 -36 L-12 -52 L-3 -44 Z M14 -36 L12 -52 L3 -44 Z" fill="#9a9aa4" />
          <path d="M-12 -39 L-11 -48 L-6 -44 Z M12 -39 L11 -48 L6 -44 Z" fill="#e4b5b0" />
          <circle cx="0" cy="-35" r="13" fill="#9a9aa4" />
          <path d="M-3 -47 L-2 -42 M3 -47 L2 -42 M0 -48 L0 -43" stroke="#6a6a74" strokeWidth="1.6" strokeLinecap="round" />
          {/* os olhos verdes de gato, e os bigodes */}
          <ellipse cx="-5" cy="-36" rx="2.6" ry="3" fill="#9ad470" />
          <ellipse cx="5" cy="-36" rx="2.6" ry="3" fill="#9ad470" />
          <ellipse cx="-5" cy="-36" rx="0.9" ry="2.6" fill={CONTORNO} />
          <ellipse cx="5" cy="-36" rx="0.9" ry="2.6" fill={CONTORNO} />
          <path d="M-1.5 -31 L1.5 -31 L0 -29 Z" fill="#e48a95" />
          <path d="M-4 -29 L-16 -31 M-4 -28 L-15 -26 M4 -29 L16 -31 M4 -28 L15 -26" stroke="#f4ede2" strokeWidth="1" />
        </>
      );
    case 'cachorro':
      return (
        <>
          <path d="M11 -10 Q22 -14 20 -24" stroke="#d6aa72" strokeWidth="5" fill="none" strokeLinecap="round" />
          <Pes cor="#b8874f" />
          <ellipse cx="0" cy="-14" rx="12" ry="13" fill="#d6aa72" />
          <ellipse cx="0" cy="-11" rx="6" ry="8" fill="#f2e2c4" />
          <circle cx="0" cy="-35" r="13" fill="#d6aa72" />
          {/* as orelhas caídas, mais escuras */}
          <path d="M-11 -44 Q-22 -40 -18 -24 Q-12 -28 -10 -36 Z M11 -44 Q22 -40 18 -24 Q12 -28 10 -36 Z" fill="#8e5a34" />
          <circle cx="5" cy="-38" r="5" fill="#b8874f" opacity="0.6" />
          <Olhos y={-38} dx={5} />
          <ellipse cx="0" cy="-29" rx="7" ry="5" fill="#f2e2c4" />
          <ellipse cx="0" cy="-31" rx="3" ry="2.2" fill={CONTORNO} />
          <path d="M-1.5 -26 Q0 -21 2.5 -24 L1.5 -27 Z" fill="#e48a95" />
        </>
      );
    case 'coruja':
      return (
        <>
          <path d="M-6 0 L-6 -4 M6 0 L6 -4" stroke="#e0a83a" strokeWidth="2.4" strokeLinecap="round" />
          <ellipse cx="0" cy="-24" rx="17" ry="22" fill="#8e6a4a" />
          <ellipse cx="0" cy="-16" rx="10" ry="12" fill="#d9c09a" />
          <path d="M-5 -20 l2 2 l2 -2 M1 -20 l2 2 l2 -2 M-3 -14 l2 2 l2 -2 M3 -14 l2 2 l2 -2" stroke="#8e6a4a" strokeWidth="1" fill="none" />
          <path d="M-15 -40 L-14 -52 L-6 -44 Z M15 -40 L14 -52 L6 -44 Z" fill="#8e6a4a" />
          {/* os olhos enormes, amarelos */}
          <circle cx="-7" cy="-36" r="7" fill="#f2c46a" stroke="#6e4f38" strokeWidth="1.5" />
          <circle cx="7" cy="-36" r="7" fill="#f2c46a" stroke="#6e4f38" strokeWidth="1.5" />
          <circle cx="-7" cy="-36" r="3.2" fill={CONTORNO} />
          <circle cx="7" cy="-36" r="3.2" fill={CONTORNO} />
          <path d="M-2.5 -31 L2.5 -31 L0 -25 Z" fill="#e0a83a" />
        </>
      );
  }
}
