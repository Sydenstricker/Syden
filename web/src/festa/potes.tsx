import { useEffect, useRef, useState } from 'react';
import { chave, useT } from '../i18n';
import { tocar } from '../somDosJogos';
import { microjogoDaTela, Moldura, useRelogio, useTeclas, type PropsDoMicro } from './comum';

/**
 * DESTAMPE OS POTES (05/11/2026, server/src/festa/potes.ts): cada tampa mostra a seta do lado em que abre e as voltas que faltam;
 * gira-se para aquele lado (← → ou os dois botões), e o lado errado aperta de novo. Cada pote aberto vai na hora.
 */

// Os mesmos números e a mesma regra do servidor.
const POTES_MS = 15000;
const GIRO_MINIMO_MS = 60;
const REACAO_MINIMA = 100;
const NOME = chave('Destampe os potes');

/** O recheio de cada pote (só a cor, pela posição na fila). */
const RECHEIO = ['#e07a2e', '#7cb85a', '#b0465a', '#f2c46a', '#8e6bb8', '#d9534f', '#e9d36a'];

interface Pote {
  lado: number;
  voltas: number;
}

/** A seta curva de girar: −1 para a esquerda (anti-horário), 1 para a direita. */
function SetaDeGirar({ lado, cor = '#3a2e2a', tamanho = 1 }: { lado: number; cor?: string; tamanho?: number }) {
  return (
    <g transform={`scale(${lado * tamanho} ${tamanho})`}>
      <path d="M-12 6 A13 13 0 1 1 6 11" fill="none" stroke={cor} strokeWidth="4.5" strokeLinecap="round" />
      <path d="M-1 3 L14 9 L1 19 Z" fill={cor} />
    </g>
  );
}

/** Um pote de conserva (o fundo em 0, 0), com a tampa subindo `solta` (de 0 a 1) e girada `giro` (só o desenho das ranhuras). */
function Vidro({ recheio, solta = 0, giro = 0, escala = 1, semTampa = false }: { recheio: string; solta?: number; giro?: number; escala?: number; semTampa?: boolean }) {
  const deslize = ((giro % 4) + 4) % 4;
  return (
    <g transform={`scale(${escala})`}>
      <rect x="-30" y="-74" width="60" height="74" rx="12" fill="#dbe9ee" stroke="#9fb7c0" strokeWidth="2" />
      <rect x="-26" y="-52" width="52" height="48" rx="9" fill={recheio} />
      <rect x="-20" y="-68" width="7" height="56" rx="3" fill="#fff" opacity="0.45" />
      <rect x="-24" y="-80" width="48" height="10" rx="3" fill="#c9d9df" />
      {!semTampa && (
        <g transform={`translate(0 ${-solta * 10})`}>
          <rect x="-29" y="-94" width="58" height="16" rx="4" fill="#d9534f" stroke="#8e3446" strokeWidth="2" />
          {/* as ranhuras andam a cada giro: o olho lê a tampa girando */}
          {[-24, -16, -8, 0, 8, 16, 24].map((x) => (
            <line key={x} x1={x + deslize * 2 - 3} y1="-91" x2={x + deslize * 2 - 3} y2="-81" stroke="#8e3446" strokeWidth="1.6" opacity={Math.abs(x + deslize * 2 - 3) < 26 ? 0.8 : 0} />
          ))}
        </g>
      )}
    </g>
  );
}

function Potes({ dados, inicio, ativo, enviar, lance }: PropsDoMicro<{ potes?: Pote[] }>) {
  const t = useT();
  const potes = dados.potes ?? [];
  const abertos = useRef<number[]>([]);
  const giros = useRef({ progresso: 0, ultimo: -Infinity, total: 0 });
  const [, setMexeu] = useState(0);
  const [tremor, setTremor] = useState(0);
  const agora = useRelogio(ativo);
  const e = Math.min(agora - inicio, POTES_MS);

  const girar = (lado: number) => {
    if (!ativo) return;
    const ms = Math.round(Date.now() - inicio);
    const g = giros.current;
    const i = abertos.current.length;
    const pote = potes[i];
    if (!pote || ms < 0 || ms > POTES_MS || ms - g.ultimo < GIRO_MINIMO_MS) return;
    g.ultimo = ms;
    if (lado !== pote.lado) {
      // o lado errado aperta de novo
      g.progresso = Math.max(0, g.progresso - 1);
      g.total -= 1;
      setTremor(Date.now());
      tocar('erro');
    } else {
      // a última volta só abre com o tempo de mão que o servidor confere (mais rápido que isso, o giro não conta)
      const antes = abertos.current[i - 1] ?? REACAO_MINIMA;
      if (g.progresso + 1 >= pote.voltas && ms < antes + pote.voltas * GIRO_MINIMO_MS) return;
      g.progresso++;
      g.total += 1;
      if (g.progresso >= pote.voltas) {
        abertos.current.push(ms);
        g.progresso = 0;
        // cada pote aberto vai na hora: o servidor confere no relógio dele
        lance({ i, t: ms });
        tocar('moeda');
      } else tocar('clique');
    }
    setMexeu((n) => n + 1);
  };
  useEffect(() => {
    if (ativo && agora - inicio >= POTES_MS) enviar({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo, agora - inicio >= POTES_MS]);
  useTeclas(ativo, (ev) => {
    const k = ev.key.toLowerCase();
    if (k === 'arrowleft' || k === 'a') girar(-1);
    else if (k === 'arrowright' || k === 'd') girar(1);
    else return false;
    return true;
  });

  const i = abertos.current.length;
  const pote = potes[i];
  const { progresso, total } = giros.current;
  // o pote que acabou de abrir: a tampa voa
  const ultimo = abertos.current[i - 1];
  const voo = ultimo !== undefined ? Math.min(1, (e - ultimo) / 350) : 1;
  const treme = Date.now() - tremor < 200 ? Math.sin((Date.now() - tremor) / 18) * 3 : 0;

  const botao = (lado: number, x: number) => (
    <g
      transform={`translate(${x} 156)`}
      style={{ cursor: ativo ? 'pointer' : 'default' }}
      onPointerDown={(ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        girar(lado);
      }}
    >
      <circle r="27" fill={pote?.lado === lado ? '#f2c46a' : '#f2e2c4'} stroke="#a97c50" strokeWidth="3" />
      <SetaDeGirar lado={lado} />
      {/* a tecla do lado */}
      <text x={lado * 36} y="22" textAnchor="middle" fontSize="11" fontWeight="700" fill="#6e4f38">
        {lado < 0 ? '←' : '→'}
      </text>
    </g>
  );

  return (
    <Moldura placar={`🍯 × ${i}`} fracao={e / POTES_MS}>
      <svg viewBox="0 0 300 192" role="group" aria-label={t(NOME)} style={{ width: '100%', touchAction: 'none', userSelect: 'none' }}>
        <rect x="0" y="0" width="300" height="192" rx="12" fill="#c9a77c" />
        <rect x="0" y="128" width="300" height="64" fill="#a97c50" />
        <path d="M0 128 H300" stroke="#8e6a4a" strokeWidth="3" />
        {/* os abertos, à esquerda, sem tampa (os últimos três) */}
        {abertos.current.slice(-3).map((_, k, l) => (
          <g key={i - l.length + k} transform={`translate(${26 + k * 22} 128)`}>
            <Vidro recheio={RECHEIO[(i - l.length + k) % RECHEIO.length]} escala={0.42} semTampa />
          </g>
        ))}
        {/* os próximos da fila, à direita */}
        {potes.slice(i + 1, i + 3).map((_, k) => (
          <g key={i + 1 + k} transform={`translate(${236 + k * 30} 128)`}>
            <Vidro recheio={RECHEIO[(i + 1 + k) % RECHEIO.length]} escala={0.42} />
          </g>
        ))}
        {/* a tampa do que acabou de abrir, voando */}
        {voo < 1 && (
          <g transform={`translate(${150 - voo * 80} ${30 - voo * 40}) rotate(${-voo * 200})`} opacity={1 - voo}>
            <rect x="-29" y="-8" width="58" height="16" rx="4" fill="#d9534f" />
          </g>
        )}
        {pote && (
          <g transform={`translate(${150 + treme} 126)`}>
            <Vidro recheio={RECHEIO[i % RECHEIO.length]} solta={progresso / pote.voltas} giro={total * pote.lado} escala={0.85} />
            {/* em cima da tampa, a seta do lado; no vidro, uma bolinha por volta (cheia quando girada) */}
            <g transform="translate(0 -100)">
              <SetaDeGirar lado={pote.lado} cor="#b0465a" tamanho={0.95} />
            </g>
            {Array.from({ length: pote.voltas }, (_, k) => (
              <circle key={k} cx={(k - (pote.voltas - 1) / 2) * 13} cy="-30" r="4.5" fill={k < progresso ? '#7cb85a' : '#f4ede2'} stroke="#6e4f38" strokeWidth="1.5" />
            ))}
          </g>
        )}
        {botao(-1, 60)}
        {botao(1, 240)}
      </svg>
    </Moldura>
  );
}

export default microjogoDaTela({
  id: 'potes',
  nome: NOME,
  dica: chave('Gire cada tampa para o lado da seta, depressa. O lado errado aperta de novo.'),
  Tela: Potes,
  valor: (v) => `🍯 × ${v}`,
  errouComValor: true,
});
