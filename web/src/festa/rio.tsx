import { useEffect, useRef, useState } from 'react';
import { chave, useT } from '../i18n';
import { tocar } from '../somDosJogos';
import { CoelhoDeFrente, ehAperto, microjogoDaTela, Moldura, useFormatos, useRelogio, useTeclas, type PropsDoMicro } from './comum';
import { BRACADA_MIN_MS, fuga, mergulhado, podeMergulhar, RIO_FOLGA_MAX, RIO_MS, type DadosRio } from './lote2sim';

/**
 * FUGA DO RIO (05/11/2026, server/src/festa/rio.ts): apertar sem parar para nadar, com o peixe grande atrás, e mergulhar quando
 * desce um tronco. A conta da distância é a mesma do servidor (./lote2sim); as braçadas vão em pacotes de 150 ms, o mergulho
 * na hora.
 */

/** Onde fica o peixe, e quantos pixels vale um da folga. */
const X_DO_PEIXE = 34;
const ESCALA = 1.05;
/** O tronco anda isto por milissegundo na tela (vindo da direita). */
const TRONCO_VEL = 0.13;
const Y_DA_AGUA = 112;
/** O botão de mergulhar (no canto de baixo à direita). */
const BOTAO = { x: 262, y: 166, r: 24 };

function Peixe({ boca }: { boca: number }) {
  return (
    <g>
      <path d="M-34 0 L-48 -14 L-46 0 L-48 14 Z" fill="#4f6f5a" />
      <ellipse cx="0" cy="0" rx="36" ry="17" fill="#6b8f74" stroke="#3f5a48" strokeWidth="2" />
      <path d="M-10 -16 L-2 -26 L8 -16" fill="#5a7d64" />
      <circle cx="20" cy="-6" r="4" fill="#fff" />
      <circle cx="21" cy="-6" r="2" fill="#222" />
      <path d={`M36 ${-2 - boca} L24 2 L36 ${4 + boca}`} fill="#2f3d33" />
      {[-8, 2, 12].map((x) => (
        <path key={x} d={`M${x} 6 L${x + 3} 10`} stroke="#3f5a48" strokeWidth="1.5" />
      ))}
    </g>
  );
}

function Rio({ dados, inicio, ativo, enviar, lance }: PropsDoMicro<DadosRio>) {
  const t = useT();
  const f = useFormatos();
  const troncos = dados.troncos ?? [];
  const bracadas = useRef<number[]>([]);
  const mergulhos = useRef<number[]>([]);
  const pacote = useRef<number[]>([]);
  const [, setBateu] = useState(0);
  const [acabou, setAcabou] = useState<'pego' | 'escapou' | null>(null);
  const agora = useRelogio(ativo || (acabou === 'pego' && Date.now() - inicio < RIO_MS + 1500));
  const e = Math.min(agora - inicio, RIO_MS);

  // as braçadas vão em pacotes (uma mensagem a cada 150 ms, não uma por aperto)
  const mandarPacote = () => {
    if (!pacote.current.length) return;
    lance({ b: pacote.current });
    pacote.current = [];
  };
  useEffect(() => {
    if (!ativo) return;
    const id = setInterval(mandarPacote, 150);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo]);

  const agoraMs = () => Math.round(Date.now() - inicio);
  const nadar = () => {
    if (!ativo || acabou) return;
    const ms = agoraMs();
    if (ms < 0 || ms > RIO_MS) return;
    // a mesma regra do servidor: mais juntas que isto não contam
    const ultima = bracadas.current[bracadas.current.length - 1];
    if (ultima !== undefined && ms - ultima < BRACADA_MIN_MS) return;
    bracadas.current.push(ms);
    pacote.current.push(ms);
    setBateu((n) => n + 1);
  };
  const mergulhar = () => {
    if (!ativo || acabou) return;
    const ms = agoraMs();
    if (ms < 0 || ms > RIO_MS || !podeMergulhar(mergulhos.current[mergulhos.current.length - 1], ms)) return;
    mergulhos.current.push(ms);
    tocar('agua');
    mandarPacote();
    lance({ m: ms });
  };
  useTeclas(ativo && !acabou, (ev) => {
    const k = ev.key.toLowerCase();
    if (k === 'arrowdown' || k === 's') mergulhar();
    else if (ehAperto(ev) || k === 'arrowright' || k === 'd') nadar();
    else return false;
    return true;
  });

  const agoraFuga = fuga(dados, bracadas.current, mergulhos.current, e);
  const golpesAntes = useRef(0);
  useEffect(() => {
    if (!ativo || acabou) return;
    if (agoraFuga.golpes > golpesAntes.current) {
      golpesAntes.current = agoraFuga.golpes;
      tocar('soco');
    }
    if (agoraFuga.pegoEm !== null || e >= RIO_MS) {
      setAcabou(agoraFuga.pegoEm !== null ? 'pego' : 'escapou');
      tocar(agoraFuga.pegoEm !== null ? 'queda' : 'fim');
      mandarPacote();
      enviar({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agora]);

  const folga = acabou === 'pego' ? 0 : agoraFuga.folga;
  const xCoelho = X_DO_PEIXE + 30 + Math.min(folga, RIO_FOLGA_MAX) * ESCALA;
  const embaixo = mergulhado(mergulhos.current, e);
  // a braçada: o coelho sobe e desce um pouco a cada aperto recente
  const ultima = bracadas.current[bracadas.current.length - 1] ?? -1000;
  const balanco = Math.max(0, 1 - (e - ultima) / 150) * 3;
  const vivo = acabou === 'pego' ? (agoraFuga.pegoEm ?? e) : e;
  return (
    <Moldura placar={f.s.format(vivo / 1000)} fracao={e / RIO_MS}>
      <svg
        viewBox="0 0 300 200"
        role="button"
        aria-label={t(NOME)}
        style={{ width: '100%', touchAction: 'none', cursor: ativo ? 'pointer' : 'default', userSelect: 'none' }}
        onPointerDown={(ev) => {
          ev.preventDefault();
          const caixa = ev.currentTarget.getBoundingClientRect();
          const x = ((ev.clientX - caixa.left) / caixa.width) * 300;
          const y = ((ev.clientY - caixa.top) / caixa.height) * 200;
          if ((x - BOTAO.x) ** 2 + (y - BOTAO.y) ** 2 < (BOTAO.r + 8) ** 2) mergulhar();
          else nadar();
        }}
      >
        {/* o céu, a margem e o rio correndo (as ondinhas andam para a esquerda) */}
        <rect x="0" y="0" width="300" height="200" rx="12" fill="#bfe3c4" />
        <rect x="0" y="0" width="300" height="70" rx="12" fill="#cde9f5" />
        <rect x="0" y="62" width="300" height="20" fill="#7cb85a" />
        <rect x="0" y="80" width="300" height="120" fill="#5aa7c8" />
        <rect x="0" y="80" width="300" height="5" fill="#8fcbe2" />
        {Array.from({ length: 12 }, (_, k) => {
          const x = ((k * 37 - e * 0.06) % 330 + 330) % 330 - 15;
          return <path key={k} d={`M${x} ${100 + (k % 4) * 22} q6 -4 12 0`} stroke="#8fcbe2" strokeWidth="2" fill="none" />;
        })}
        {/* os troncos descendo o rio */}
        {troncos.map((tr, k) => {
          const x = xCoelho + (tr - e) * TRONCO_VEL;
          if (x < -40 || x > 340) return null;
          return (
            <g key={k} transform={`translate(${x} ${Y_DA_AGUA - 4})`}>
              <rect x="-26" y="-8" width="52" height="16" rx="8" fill="#8a5a3a" stroke="#5a3a2a" strokeWidth="2" />
              <ellipse cx="22" cy="0" rx="5" ry="7" fill="#c49a6c" stroke="#5a3a2a" strokeWidth="1.5" />
              <path d="M-16 -3 L6 -3 M-10 3 L12 3" stroke="#6e4630" strokeWidth="1.5" />
            </g>
          );
        })}
        {/* o peixe atrás, de boca aberta quando chega perto */}
        <g transform={`translate(${X_DO_PEIXE} ${Y_DA_AGUA + 10})`}>
          <Peixe boca={folga < 40 ? 6 : 2} />
        </g>
        {/* o coelho: nadando (a cabeça para fora) ou mergulhado (só as bolhas) */}
        {embaixo ? (
          <g>
            <ellipse cx={xCoelho} cy={Y_DA_AGUA + 26} rx="11" ry="8" fill="#e8dccb" opacity="0.45" />
            {[0, 1, 2].map((k) => (
              <circle key={k} cx={xCoelho + k * 5 - 5} cy={Y_DA_AGUA - 4 - ((e / 8 + k * 9) % 18)} r="2.5" fill="none" stroke="#e4f3fa" strokeWidth="1.2" />
            ))}
          </g>
        ) : (
          <g transform={`translate(${xCoelho} ${Y_DA_AGUA + 4 - balanco})`}>
            <CoelhoDeFrente escala={0.95} olhos={acabou === 'pego' ? 'tontos' : 'abertos'} />
            <path d="M-14 0 q4 -4 8 0 q4 -4 8 0 q4 -4 8 0" stroke="#e4f3fa" strokeWidth="2" fill="none" transform="translate(-4 2)" />
          </g>
        )}
        {/* o botão de mergulhar: a seta para baixo nas ondas */}
        <g opacity={podeMergulhar(mergulhos.current[mergulhos.current.length - 1], e) ? 1 : 0.4}>
          <circle cx={BOTAO.x} cy={BOTAO.y} r={BOTAO.r} fill="#2f6f8f" stroke="#e4f3fa" strokeWidth="2" />
          <path d={`M${BOTAO.x} ${BOTAO.y - 12} L${BOTAO.x} ${BOTAO.y + 6} M${BOTAO.x - 8} ${BOTAO.y - 2} L${BOTAO.x} ${BOTAO.y + 7} L${BOTAO.x + 8} ${BOTAO.y - 2}`} stroke="#fff" strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <path d={`M${BOTAO.x - 12} ${BOTAO.y + 13} q3 -3 6 0 q3 -3 6 0 q3 -3 6 0 q3 -3 6 0`} stroke="#8fcbe2" strokeWidth="1.8" fill="none" />
        </g>
      </svg>
    </Moldura>
  );
}

const NOME = chave('Fuga do rio');

export default microjogoDaTela({
  id: 'rio',
  nome: NOME,
  dica: chave('Aperte sem parar para nadar. Quando vier um tronco, mergulhe!'),
  Tela: Rio,
  valor: (v, f) => f.s.format(v / 1000),
  errouComValor: true,
});
