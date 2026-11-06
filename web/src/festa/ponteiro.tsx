import { useEffect, useRef, useState } from 'react';
import { chave, useT } from '../i18n';
import { tocar } from '../somDosJogos';
import { CoelhoDeFrente, ehAperto, microjogoDaTela, Moldura, useRelogio, useTeclas, type PropsDoMicro } from './comum';

/**
 * PULA O PONTEIRO (05/11/2026, server/src/festa/ponteiro.ts): o ponteiro de madeira gira rente ao chão da horta e passa pelo
 * coelho a cada volta, cada vez mais rápido; é preciso estar no ar quando ele passa. Cada pulo vai na hora, e o servidor refaz
 * a mesma conta (só + − e comparação): no ar de `pulo` a `pulo + PULO_MS`, e o próximo só depois de RECARGA_MS no chão.
 */

// Os mesmos números e as mesmas contas do servidor.
const PULO_MS = 520;
const RECARGA_MS = 180;
const podePular = (ultimo: number | undefined, t: number) => ultimo === undefined || t >= ultimo + PULO_MS + RECARGA_MS;
const noAr = (pulo: number, t: number) => pulo <= t && t < pulo + PULO_MS;

/** O centro do canteiro e o tamanho do ponteiro, no desenho (visto meio de cima, por isso a elipse). */
const CX = 150;
const CY = 98;
const RX = 118;
const RY = 62;

function Ponteiro({ dados, inicio, ativo, enviar, lance }: PropsDoMicro<{ passagens?: number[] }>) {
  const t = useT();
  const passagens = dados.passagens ?? [];
  const pulos = useRef<number[]>([]);
  const [, setPulou] = useState(0);
  const [caiu, setCaiu] = useState<{ k: number; em: number } | null>(null);
  const [aguentou, setAguentou] = useState(0);
  const [acabou, setAcabou] = useState(false);
  const agora = useRelogio(ativo || (caiu !== null && Date.now() - caiu.em < 1500));
  const e = agora - inicio;
  const ultima = passagens[passagens.length - 1] ?? 0;

  // cada passagem que chegou: o coelho estava no ar? (a mesma conta do servidor)
  useEffect(() => {
    if (!ativo || caiu || acabou) return;
    let n = aguentou;
    while (n < passagens.length && passagens[n] <= e) {
      if (!pulos.current.some((p) => noAr(p, passagens[n]))) {
        setCaiu({ k: n, em: Date.now() });
        setAguentou(n);
        tocar('queda');
        // o fim vai um instante depois, para o tombo ser visto (sendo o último a terminar, a revelação vem na hora)
        setTimeout(() => enviar({}), 700);
        return;
      }
      n++;
      tocar('moeda');
    }
    if (n !== aguentou) setAguentou(n);
    if (n === passagens.length && passagens.length) {
      setAcabou(true);
      tocar('fim');
      enviar({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [e]);

  const pular = () => {
    if (!ativo || caiu || acabou) return;
    const ms = Math.round(Date.now() - inicio);
    if (ms < 0 || ms > ultima || !podePular(pulos.current[pulos.current.length - 1], ms)) return;
    pulos.current.push(ms);
    setPulou((n) => n + 1);
    tocar('pulo');
    lance({ t: ms });
  };
  useTeclas(ativo && !caiu && !acabou, (ev) => {
    if (!ehAperto(ev) && ev.key !== 'ArrowUp' && ev.key.toLowerCase() !== 'w') return false;
    pular();
    return true;
  });

  // o ângulo do ponteiro: uma volta inteira entre duas passagens, apontando para o coelho (para a frente) em cada uma; antes da
  // primeira, ele vem de trás (meia volta)
  let angulo = Math.PI * 1.5;
  if (passagens.length && e > 0) {
    let k = passagens.findIndex((p) => p > e);
    if (k < 0) k = passagens.length - 1;
    const de = k === 0 ? -passagens[0] : passagens[k - 1];
    const fracao = Math.min(1, (e - de) / (passagens[k] - de));
    angulo = Math.PI / 2 + 2 * Math.PI * fracao;
  }
  const ponta = { x: CX + RX * Math.cos(angulo), y: CY + RY * Math.sin(angulo) };
  // o pulo: uma parábola no tempo do ar
  const pulo = pulos.current[pulos.current.length - 1];
  const p = pulo !== undefined && noAr(pulo, e) ? (e - pulo) / PULO_MS : null;
  const altura = p === null ? 0 : 4 * p * (1 - p) * 34;
  const tombo = caiu ? Math.min(1, (agora - caiu.em) / 250) : 0;
  // o ponteiro na frente do coelho só quando passa por baixo dele
  const ponteiroNaFrente = Math.sin(angulo) > 0.94 && altura > 6;

  const desenharPonteiro = (
    <g>
      <line x1={CX} y1={CY} x2={ponta.x} y2={ponta.y} stroke="#5a3a2a" strokeWidth="11" strokeLinecap="round" />
      <line x1={CX} y1={CY} x2={ponta.x} y2={ponta.y} stroke="#a97c50" strokeWidth="7" strokeLinecap="round" />
      {/* a cenoura na ponta, como a seta de um relógio */}
      <circle cx={ponta.x} cy={ponta.y} r="7" fill="#e07a2e" stroke="#5a3a2a" strokeWidth="2" />
    </g>
  );

  return (
    <Moldura placar={`↻ × ${aguentou}`} fracao={ultima ? e / ultima : 0}>
      <svg
        viewBox="0 0 300 200"
        role="button"
        aria-label={t(NOME)}
        style={{ width: '100%', touchAction: 'none', cursor: ativo ? 'pointer' : 'default' }}
        onPointerDown={(ev) => {
          ev.preventDefault();
          pular();
        }}
      >
        <rect x="0" y="0" width="300" height="200" rx="12" fill="#6fa356" />
        {/* o canteiro redondo, o sulco que o ponteiro vem cavando, e o eixo */}
        <ellipse cx={CX} cy={CY + 4} rx={RX + 14} ry={RY + 10} fill="#8a6548" />
        <ellipse cx={CX} cy={CY + 2} rx={RX - 6} ry={RY - 4} fill="none" stroke="#6e4f38" strokeWidth="3" strokeDasharray="6 8" />
        {[0, 1, 2, 3, 4, 5].map((k) => {
          const a = (k / 6) * 2 * Math.PI + 0.5;
          return <path key={k} d={`M${CX + 70 * Math.cos(a)} ${CY + 36 * Math.sin(a)} q3 -9 6 0 q3 -8 6 0`} fill="#5d8f47" />;
        })}
        {!ponteiroNaFrente && desenharPonteiro}
        <circle cx={CX} cy={CY} r="10" fill="#5a3a2a" />
        <circle cx={CX} cy={CY - 3} r="7" fill="#7a5238" />
        {/* o coelho, na frente do canteiro: a sombra fica no chão, e ele sobe */}
        <ellipse cx={CX} cy={CY + RY + 2} rx={16 - altura / 5} ry={4 - altura / 20} fill="rgba(0,0,0,0.25)" />
        <g transform={`translate(${CX} ${CY + RY - altura}) rotate(${tombo * 80}) scale(1.35)`}>
          <ellipse cx="0" cy="-4" rx="11" ry="8" fill="#e8dccb" />
          <CoelhoDeFrente y={-8} escala={1.05} olhos={caiu ? 'tontos' : 'abertos'} />
        </g>
        {ponteiroNaFrente && desenharPonteiro}
        {caiu && (
          <path
            transform={`translate(${CX + 22} ${CY + RY - 34})`}
            d="M0 -10 L3 -3 L10 -3 L4 2 L6 9 L0 5 L-6 9 L-4 2 L-10 -3 L-3 -3 Z"
            fill="#f2c46a"
          />
        )}
      </svg>
    </Moldura>
  );
}

const NOME = chave('Pula o ponteiro');

export default microjogoDaTela({
  id: 'ponteiro',
  nome: NOME,
  dica: chave('Pule quando o ponteiro passar. Ele fica cada vez mais rápido.'),
  Tela: Ponteiro,
  valor: (v) => `↻ × ${v}`,
  errouComValor: true,
});
