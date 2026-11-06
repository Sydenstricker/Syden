import { useState } from 'react';
import { chave, useT } from '../i18n';
import { microjogoDaTela, useRelogio, useTeclas, type PropsDoMicro } from './comum';

// Os mesmos números do servidor (server/src/festa/copos.ts).
const COPOS_MOSTRA_MS = 2000;
const NOME = chave('Jogo dos copos');

const X_DOS_COPOS = [60, 150, 240];
const suave = (p: number) => (p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2);

interface Dados {
  inicial?: number;
  trocas?: [number, number][];
  passos?: number[];
}

/** Os copos: a cenoura aparece, os copos descem e trocam de lugar, e escolhe-se um. */
function Copos({ dados, inicio, ativo, enviar, resposta }: PropsDoMicro<Dados>) {
  const t = useT();
  const [escolhido, setEscolhido] = useState<number | null>(null);
  const trocas = dados.trocas ?? [];
  const passos = dados.passos ?? [];
  const animacao = COPOS_MOSTRA_MS + passos.reduce((a, b) => a + b, 0);
  const revelando = resposta !== null;
  const agora = useRelogio(!revelando && (ativo || Date.now() < inicio + animacao));
  const e = revelando ? Infinity : agora - inicio;

  // onde está cada copo: o copo i começa no lugar i; as trocas já feitas, e a que está andando
  const lugar = [0, 1, 2];
  let andando: { a: number; b: number; p: number } | null = null;
  let tempo = COPOS_MOSTRA_MS;
  for (let i = 0; i < trocas.length; i++) {
    const [a, b] = trocas[i];
    if (e < tempo) break;
    if (e < tempo + passos[i]) {
      andando = { a, b, p: suave((e - tempo) / passos[i]) };
      break;
    }
    const ca = lugar.indexOf(a);
    const cb = lugar.indexOf(b);
    lugar[ca] = b;
    lugar[cb] = a;
    tempo += passos[i];
  }
  const podeEscolher = ativo && e >= animacao && escolhido === null;
  const escolher = (slot: number) => {
    if (!podeEscolher) return;
    setEscolhido(slot);
    enviar({ copo: slot, ms: Math.max(0, Math.round(Date.now() - (inicio + animacao))) });
  };
  useTeclas(podeEscolher, (ev) => {
    const slot = { '1': 0, '2': 1, '3': 2, ArrowLeft: 0, ArrowDown: 1, ArrowRight: 2 }[ev.key];
    if (slot === undefined) return false;
    escolher(slot);
    return true;
  });
  // a cenoura é do copo que começou no lugar inicial
  const copoDaCenoura = dados.inicial ?? 0;
  const levantado = (copo: number) => {
    const slot = lugar[copo];
    if (revelando) return slot === resposta ? -44 : 0;
    if (e < COPOS_MOSTRA_MS - 500) return -44;
    if (e < COPOS_MOSTRA_MS) return -44 * (1 - (e - (COPOS_MOSTRA_MS - 500)) / 500);
    return 0;
  };
  const posicao = (copo: number) => {
    const slot = lugar[copo];
    if (andando && (slot === andando.a || slot === andando.b)) {
      const de = X_DOS_COPOS[slot];
      const para = X_DOS_COPOS[slot === andando.a ? andando.b : andando.a];
      const arco = Math.sin(Math.PI * andando.p) * (slot === andando.a ? -14 : 8);
      return { x: de + (para - de) * andando.p, y: arco };
    }
    return { x: X_DOS_COPOS[slot], y: 0 };
  };
  const cenoura = posicao(copoDaCenoura);
  const cenouraVisivel = revelando ? lugar[copoDaCenoura] === resposta : e < COPOS_MOSTRA_MS;
  return (
    <svg className="festa-copos" viewBox="0 0 300 150" role="group" aria-label={t(NOME)}>
      <rect x="0" y="118" width="300" height="32" fill="#6b4a3a" />
      <rect x="0" y="116" width="300" height="4" fill="#8e6a52" />
      {cenouraVisivel && (
        <g transform={`translate(${cenoura.x} 0)`}>
          <path d="M-9 100 L9 100 L0 118 Z" fill="#e07a2e" />
          <path d="M-3 100 L-7 92 M0 100 L0 90 M3 100 L7 92" stroke="#6fa356" strokeWidth="3" strokeLinecap="round" />
        </g>
      )}
      {[0, 1, 2]
        .slice()
        .sort((a, b) => posicao(a).y - posicao(b).y)
        .map((copo) => {
          const { x, y } = posicao(copo);
          const slot = lugar[copo];
          const marcado = escolhido === slot;
          return (
            <g
              key={copo}
              transform={`translate(${x} ${y + levantado(copo)})`}
              className={`festa-copo${podeEscolher ? ' escolhe' : ''}${marcado ? ' escolhido' : ''}`}
              onPointerDown={(ev) => {
                ev.preventDefault();
                escolher(slot);
              }}
            >
              <path d="M-28 118 L-20 62 L20 62 L28 118 Z" fill={marcado ? '#d0894f' : '#b8743f'} />
              <rect x="-31" y="112" width="62" height="8" rx="2" fill="#8e5530" />
              <rect x="-21" y="59" width="42" height="6" rx="2" fill="#d39a62" />
              <path d="M-12 72 L-15 104" stroke="#d39a62" strokeWidth="3" strokeLinecap="round" opacity="0.6" />
            </g>
          );
        })}
    </svg>
  );
}

export default microjogoDaTela({
  id: 'copos',
  nome: NOME,
  dica: chave('Veja onde fica a cenoura e siga o copo. Acertar mais rápido vale mais.'),
  Tela: Copos,
  valor: (v, f) => f.ms.format(v),
  naRevelacao: true,
});
