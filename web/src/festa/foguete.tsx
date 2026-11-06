import { useEffect, useRef, useState } from 'react';
import { chave, useT } from '../i18n';
import { tocar } from '../somDosJogos';
import { CoelhoDeFrente, ehAperto, menosMovimento, microjogoDaTela, Moldura, useRelogio, useTeclas, type PropsDoMicro } from './comum';

/**
 * O FOGUETE DE CENOURA (05/11/2026, server/src/festa/foguete.ts): bombear na batida. Um anel se fecha sobre a bomba e acende
 * quando é a hora; cada bombada vai na hora (a ação 'acerto'), e o servidor faz a mesma conta, abaixo, igual à dele.
 */

// Os mesmos números e as mesmas contas do servidor.
const FOGUETE_PRIMEIRA_MS = 900;
const FOGUETE_BATIDAS = 16;
const FOGUETE_NA_MOSCA = 70;
const FOGUETE_PERTO = 150;
const FOGUETE_LONGE = 250;
const METROS_POR_PONTO = 10;
interface DadosFoguete {
  periodoMs?: number;
}
interface Bomba {
  ar: number;
  usadas: number[];
  boas: number;
  engasgos: number;
}
const bombaNova = (): Bomba => ({ ar: 0, usadas: [], boas: 0, engasgos: 0 });
function valorDaBombada(periodoMs: number, b: Bomba, t: number) {
  const k = Math.min(FOGUETE_BATIDAS - 1, Math.max(0, Math.round((t - FOGUETE_PRIMEIRA_MS) / periodoMs)));
  const erro = Math.abs(t - (FOGUETE_PRIMEIRA_MS + k * periodoMs));
  if (b.usadas.includes(k) || erro > FOGUETE_LONGE) return { k, vale: -1 };
  return { k, vale: erro <= FOGUETE_NA_MOSCA ? 3 : erro <= FOGUETE_PERTO ? 2 : 1 };
}
function bombar(periodoMs: number, b: Bomba, t: number): number {
  const { k, vale } = valorDaBombada(periodoMs, b, t);
  if (vale > 0) {
    b.usadas.push(k);
    b.boas++;
  } else b.engasgos++;
  b.ar = Math.max(0, b.ar + vale);
  return vale;
}

/** O ar que enche o foguete inteiro, no desenho (todas na mosca). */
const AR_CHEIO = FOGUETE_BATIDAS * 3;
const SUBIDA_MS = 2200;

function Foguete({ dados, inicio, ativo, enviar, lance }: PropsDoMicro<DadosFoguete>) {
  const t = useT();
  const periodo = dados.periodoMs ?? 620;
  const fim = FOGUETE_PRIMEIRA_MS + (FOGUETE_BATIDAS - 1) * periodo + FOGUETE_LONGE;
  const bomba = useRef(bombaNova());
  const [ultima, setUltima] = useState<{ vale: number; em: number } | null>(null);
  const [subiu, setSubiu] = useState<number | null>(null);
  const subindo = subiu !== null && Date.now() - subiu < SUBIDA_MS + 400;
  const agora = useRelogio(ativo || subindo);
  const e = agora - inicio;
  const quieto = menosMovimento();

  // o fim das batidas: o foguete sobe, e o resultado vai
  useEffect(() => {
    if (!ativo || e < fim || subiu !== null) return;
    setSubiu(Date.now());
    tocar(bomba.current.ar > 0 ? 'chegada' : 'erro');
    enviar({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo, e >= fim]);

  const apertar = () => {
    if (!ativo || subiu !== null) return;
    const ms = Math.round(Date.now() - inicio);
    if (ms < 0 || ms > fim) return;
    const b = bomba.current;
    if (b.boas + b.engasgos >= FOGUETE_BATIDAS * 3) return;
    const vale = bombar(periodo, b, ms);
    setUltima({ vale, em: Date.now() });
    tocar(vale === 3 ? 'acerto' : vale > 0 ? 'clique' : 'erro');
    lance({ t: ms });
  };
  useTeclas(ativo && subiu === null, (ev) => {
    if (!ehAperto(ev) && ev.key !== 'ArrowDown' && ev.key.toLowerCase() !== 's') return false;
    apertar();
    return true;
  });

  const b = bomba.current;
  // o anel: de grande a justo na bomba, entre uma batida e a seguinte (só enquanto há batidas pela frente)
  const k = Math.ceil((e - FOGUETE_PRIMEIRA_MS) / periodo);
  const proxima = FOGUETE_PRIMEIRA_MS + Math.max(0, k) * periodo;
  const falta = proxima - e;
  const temBatida = e >= 0 && k < FOGUETE_BATIDAS && subiu === null;
  const anel = 16 + 30 * Math.min(1, Math.max(0, falta / periodo));
  // o brilho da batida: aceso perto dela (antes e depois)
  const desdeABatida = Math.min(Math.abs(e - (proxima - periodo)), Math.abs(falta));
  const aceso = e >= FOGUETE_PRIMEIRA_MS - FOGUETE_NA_MOSCA && desdeABatida <= FOGUETE_NA_MOSCA && e <= fim;
  // a bombada que acabou de sair: a alça desce e sobe
  const desdeABombada = ultima ? agora - ultima.em : Infinity;
  const alca = desdeABombada < 160 ? 12 * (1 - desdeABombada / 160) : 0;
  const cheio = Math.min(1, b.ar / AR_CHEIO);
  const s = subiu === null ? 0 : Math.min(1, (Date.now() - subiu) / SUBIDA_MS);
  // a subida: some no céu (mais ar, mais depressa); o número diz até onde foi
  const altura = quieto ? 0 : s * s * (220 + 120 * cheio);

  return (
    <Moldura placar={`🚀 ${b.ar * METROS_POR_PONTO} m`} fracao={e / fim}>
      <svg
        viewBox="0 0 300 200"
        role="button"
        aria-label={t(NOME)}
        style={{ width: '100%', touchAction: 'none', cursor: ativo ? 'pointer' : 'default' }}
        onPointerDown={(ev) => {
          ev.preventDefault();
          apertar();
        }}
      >
        <defs>
          <linearGradient id="foguete-ceu" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#7fb6e0" />
            <stop offset="1" stopColor="#cfe6f2" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="300" height="200" rx="12" fill="url(#foguete-ceu)" />
        <rect x="0" y="160" width="300" height="40" rx="0" fill="#7cb35e" />
        {/* a mangueira, da bomba ao foguete */}
        <path d="M200 168 C 170 186, 120 186, 96 170" stroke="#5a3a2a" strokeWidth="4" fill="none" />
        {/* a base e o foguete de cenoura (o ar enche de baixo para cima) */}
        <rect x="66" y="160" width="60" height="8" rx="2" fill="#8a6548" />
        <g transform={`translate(96 ${158 - altura})`}>
          {s > 0 && !quieto && (
            <path d={`M-8 2 Q0 ${30 + 20 * cheio} 8 2 Z`} fill="#f2c46a" opacity={0.85}>
              <animate attributeName="opacity" values="0.6;1;0.6" dur="0.2s" repeatCount="indefinite" />
            </path>
          )}
          <clipPath id="foguete-corpo">
            <path d="M-14 0 L14 0 L4 -88 Q0 -96 -4 -88 Z" />
          </clipPath>
          <path d="M-14 0 L14 0 L4 -88 Q0 -96 -4 -88 Z" fill="#c76a2a" />
          <rect x="-16" y={-92 * cheio} width="32" height={92 * cheio + 1} fill="#e8893a" clipPath="url(#foguete-corpo)" />
          <path d="M-10 -24 L8 -26 M-8 -50 L6 -52 M-5 -72 L4 -73" stroke="#a8541e" strokeWidth="1.6" />
          <path d="M-4 -90 L-12 -108 M0 -92 L0 -112 M4 -90 L12 -108" stroke="#6fa356" strokeWidth="4" strokeLinecap="round" />
          <path d="M-14 0 L-22 8 L-12 -10 Z M14 0 L22 8 L12 -10 Z" fill="#6fa356" />
        </g>
        {/* a bomba: o corpo, a alça e o anel do ritmo */}
        {temBatida && (
          <circle cx="210" cy="112" r={anel} fill="none" stroke={aceso ? '#f2c46a' : '#fff4e6'} strokeWidth={aceso ? 4 : 2} opacity={0.9} />
        )}
        <circle cx="210" cy="112" r="16" fill={aceso ? 'rgba(242,196,106,0.5)' : 'rgba(255,255,255,0.15)'} />
        <rect x="202" y="118" width="16" height="50" rx="3" fill="#d9534f" stroke="#7a2a24" strokeWidth="1" />
        <rect x="208" y={98 + alca} width="4" height="22" fill="#8a7a66" />
        <rect x="194" y={94 + alca} width="32" height="6" rx="3" fill="#5a3a2a" />
        {/* o coelho segurando a alça */}
        <ellipse cx="246" cy="166" rx="16" ry="4" fill="rgba(0,0,0,0.2)" />
        <ellipse cx="246" cy="150" rx="14" ry="14" fill="#e8dccb" />
        <CoelhoDeFrente x={246} y={142} escala={1.4} />
        <path d={`M236 ${146} L222 ${97 + alca}`} stroke="#e8dccb" strokeWidth="5" strokeLinecap="round" />
        {subiu !== null && (
          <text x="160" y="40" textAnchor="middle" fontSize="20" fontWeight="700" fill="#2a1c14" opacity={Math.min(1, s * 2)}>
            {b.ar * METROS_POR_PONTO} m
          </text>
        )}
        {/* o que a última bombada valeu */}
        {ultima && desdeABombada < 500 && (
          <text
            x="210"
            y={70 - desdeABombada / 25}
            textAnchor="middle"
            fontSize="16"
            fontWeight="700"
            fill={ultima.vale > 0 ? '#2f6b2a' : '#a8322e'}
            opacity={1 - desdeABombada / 500}
          >
            {ultima.vale > 0 ? '★'.repeat(ultima.vale) : '✕'}
          </text>
        )}
      </svg>
    </Moldura>
  );
}

const NOME = chave('Foguete de cenoura');

export default microjogoDaTela({
  id: 'foguete',
  nome: NOME,
  dica: chave('Bombeie quando o anel acender. Fora do ritmo, o ar escapa.'),
  Tela: Foguete,
  valor: (v, f) => `🚀 ${f.inteiro.format(v)} m`,
  errouComValor: true,
  naRevelacao: true,
});
