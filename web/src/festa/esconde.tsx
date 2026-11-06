import { useEffect, useRef, useState } from 'react';
import { chave, useT } from '../i18n';
import { tocar } from '../somDosJogos';
import { microjogoDaTela, Moldura, useRelogio, useTeclas, type PropsDoMicro } from './comum';
import { COR_DA_TURMA, CoelhoDaTurma, FilaDaTurma, useEntrar } from './lote4-comum';

/**
 * O ESCONDE-ESCONDE NA HORTA (05/11/2026, server/src/festa/esconde.ts): quatro esconderijos; quem tem a lanterna procura, os
 * outros se escondem, e em cada uma das três rodadas todos escolhem ao mesmo tempo. Clique, toque, ou as teclas 1 a 4.
 */

interface Vista {
  lugares?: number;
  etapa?: 'juntando' | 'escolha' | 'mostra' | 'fim';
  rodada?: number;
  restaMs?: number;
  turma?: { busca: boolean; achadoEm: number | null }[];
  eu?: number;
  minha?: number | null;
  mostra?: { rodada: number; olhou: number; onde: (number | null)[] } | null;
}

const LUGAR_X = [45, 115, 185, 255];
const CHAO = 150;

/** Os esconderijos, desenhados com a base em (0, 0). */
function Esconderijo({ tipo }: { tipo: number }) {
  if (tipo === 0)
    // a moita
    return (
      <g>
        <circle cx="-16" cy="-16" r="16" fill="#5d8f47" />
        <circle cx="14" cy="-16" r="17" fill="#5d8f47" />
        <circle cx="0" cy="-30" r="19" fill="#6fa356" />
        <circle cx="-8" cy="-34" r="3" fill="#d9534f" />
        <circle cx="10" cy="-22" r="3" fill="#d9534f" />
      </g>
    );
  if (tipo === 1)
    // o toco
    return (
      <g>
        <rect x="-22" y="-34" width="44" height="34" fill="#8a6548" />
        <ellipse cx="0" cy="-34" rx="22" ry="8" fill="#c9a37a" />
        <ellipse cx="0" cy="-34" rx="12" ry="4" fill="none" stroke="#8a6548" strokeWidth="1.5" />
        <path d="M-10 -20 L-10 -6 M8 -26 L8 -10" stroke="#6e4f38" strokeWidth="2" />
      </g>
    );
  if (tipo === 2)
    // o regador
    return (
      <g>
        <path d="M-20 0 L-16 -38 L16 -38 L20 0 Z" fill="#5b8fc9" />
        <path d="M16 -30 L34 -46" stroke="#5b8fc9" strokeWidth="6" strokeLinecap="round" />
        <path d="M-12 -38 Q0 -56 12 -38" stroke="#3f6c9e" strokeWidth="4" fill="none" />
        <ellipse cx="36" cy="-48" rx="5" ry="3" fill="#3f6c9e" />
      </g>
    );
  // a casinha
  return (
    <g>
      <rect x="-22" y="-32" width="44" height="32" fill="#c95b5b" />
      <path d="M-27 -30 L0 -52 L27 -30 Z" fill="#8e432c" />
      <path d="M-9 0 L-9 -16 Q0 -26 9 -16 L9 0 Z" fill="#3e2a1e" />
    </g>
  );
}

/** A lanterna (quem procura), ou a raposa. */
function Lanterna() {
  return (
    <g>
      <rect x="-5" y="-6" width="10" height="12" rx="2" fill="#5a5a5a" />
      <path d="M-6 -6 L6 -6 L4 -12 L-4 -12 Z" fill="#f2c46a" />
    </g>
  );
}

function Esconde({ dados, inicio, ativo, lance }: PropsDoMicro<Vista>) {
  const t = useT();
  const etapa = dados.etapa ?? 'juntando';
  const rodada = dados.rodada ?? 0;
  const turma = dados.turma ?? [];
  const eu = dados.eu ?? -1;
  const mostra = dados.mostra ?? null;
  const agora = useRelogio(ativo);
  useEntrar(ativo, inicio, agora, lance);

  const souBusca = eu >= 0 && turma[eu]?.busca;
  const raposa = turma.length > 0 && !turma.some((p) => p.busca);
  const achado = eu >= 0 && turma[eu]?.achadoEm !== null && turma[eu]?.achadoEm !== undefined;
  const [escolha, setEscolha] = useState<{ rodada: number; lugar: number } | null>(null);
  const minha = escolha?.rodada === rodada ? escolha.lugar : null;
  const podeEscolher = ativo && etapa === 'escolha' && eu >= 0 && !achado;

  // o relógio da etapa, a partir de quando ela chegou aqui
  const [desde, setDesde] = useState({ chave: '', em: 0, resta: 0 });
  const chaveDaEtapa = `${etapa}-${rodada}`;
  useEffect(() => {
    setDesde({ chave: chaveDaEtapa, em: Date.now(), resta: dados.restaMs ?? 0 });
    if (etapa === 'escolha' && eu >= 0 && !achado) tocar('vez');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chaveDaEtapa]);
  const resta = desde.chave === chaveDaEtapa ? Math.max(0, desde.resta - (agora - desde.em)) : 0;

  // o som da revelação, uma vez por rodada
  const ouvida = useRef(-1);
  useEffect(() => {
    if (!mostra || ouvida.current === mostra.rodada || eu < 0) return;
    ouvida.current = mostra.rodada;
    const achadosAgora = turma.filter((p) => p.achadoEm === mostra.rodada).length;
    if (souBusca) tocar(achadosAgora > 0 ? 'acerto' : 'erro');
    else if (turma[eu]?.achadoEm === mostra.rodada) tocar('erro');
    else if (!achado) tocar('moeda');
  }, [mostra, eu, souBusca, turma, achado]);

  const escolher = (lugar: number) => {
    if (!podeEscolher) return;
    setEscolha({ rodada, lugar });
    tocar('clique');
    lance({ r: rodada, lugar });
  };
  useTeclas(ativo, (ev) => {
    const n = Number(ev.key);
    if (!Number.isInteger(n) || n < 1 || n > 4) return false;
    escolher(n - 1);
    return true;
  });

  const revelando = etapa === 'mostra' && mostra && mostra.rodada === rodada;
  const fracao = etapa === 'escolha' ? 1 - resta / 6000 : etapa === 'mostra' ? 1 : 0;

  return (
    <Moldura placar={`${souBusca ? '🔦' : '🌿'} ${rodada + 1}/3`} fracao={fracao}>
      <FilaDaTurma
        turma={turma.map((p) => ({ texto: p.busca ? '🔦' : p.achadoEm !== null ? '❗' : '🌿', apagado: p.achadoEm !== null }))}
        eu={eu}
      />
      <svg viewBox="0 0 300 175" role="group" aria-label={t(NOME)} style={{ width: 'min(92vw, 460px)', touchAction: 'none' }}>
        <rect x="0" y="0" width="300" height="175" rx="12" fill="#cfe6f2" />
        <rect x="0" y={CHAO - 20} width="300" height={175 - CHAO + 20} rx="12" fill="#8cc66d" />
        <rect x="0" y={CHAO - 20} width="300" height="14" fill="#8cc66d" />
        {/* quem procura, em cima: o coelho com a lanterna, ou a raposa */}
        <g transform="translate(150 30)">
          {raposa ? (
            <text x="0" y="8" textAnchor="middle" fontSize="26">
              🦊
            </text>
          ) : (
            <>
              <CoelhoDaTurma x={0} y={6} cor={COR_DA_TURMA[Math.max(0, turma.findIndex((p) => p.busca)) % COR_DA_TURMA.length]} escala={0.7} />
              <g transform="translate(14 4)">
                <Lanterna />
              </g>
            </>
          )}
        </g>
        {/* a luz da lanterna onde se olhou (ou onde quem procura vai olhar), por baixo de tudo */}
        {LUGAR_X.map((x, lugar) => {
          const olhado = revelando && mostra!.olhou === lugar;
          if (!olhado && !(souBusca && minha === lugar && etapa === 'escolha')) return null;
          return <path key={`luz${lugar}`} d={`M150 44 L${x - 34} ${CHAO + 4} L${x + 34} ${CHAO + 4} Z`} fill="#f7e27a" opacity={olhado ? 0.55 : 0.3} />;
        })}
        {LUGAR_X.map((x, lugar) => {
          const escolhido = minha === lugar;
          const olhado = revelando && mostra!.olhou === lugar;
          const aqui = revelando ? mostra!.onde.map((o, k) => (o === lugar ? k : -1)).filter((k) => k >= 0) : [];
          return (
            <g
              key={lugar}
              style={{ cursor: podeEscolher ? 'pointer' : 'default' }}
              onPointerDown={(ev) => {
                ev.preventDefault();
                escolher(lugar);
              }}
            >
              {/* eu, escondido aqui: as orelhas aparecendo atrás */}
              {!souBusca && escolhido && etapa === 'escolha' && <CoelhoDaTurma x={x + 6} y={CHAO - 30} cor={COR_DA_TURMA[eu % COR_DA_TURMA.length]} escala={0.6} />}
              <g transform={`translate(${x} ${CHAO})`}>
                <Esconderijo tipo={lugar} />
              </g>
              {/* na revelação, quem estava aqui sai de trás */}
              {aqui.map((k, j) => (
                <g key={k}>
                  <CoelhoDaTurma x={x - 14 + j * 14} y={CHAO + 16} cor={COR_DA_TURMA[k % COR_DA_TURMA.length]} escala={0.5} />
                  {olhado && (
                    <text x={x - 14 + j * 14} y={CHAO - 6} textAnchor="middle" fontSize="14" fontWeight="700" fill="#d9534f">
                      !
                    </text>
                  )}
                  {k === eu && <circle cx={x - 14 + j * 14} cy={CHAO + 18} r="3" fill="#f2c46a" />}
                </g>
              ))}
              <text x={x} y={170} textAnchor="middle" fontSize="11" fill="#2f4f2a" aria-hidden="true">
                {lugar + 1}
              </text>
              <rect x={x - 34} y={CHAO - 62} width="68" height="80" fill="transparent" />
            </g>
          );
        })}
      </svg>
    </Moldura>
  );
}

const NOME = chave('Esconde-esconde na horta');

export default microjogoDaTela({
  id: 'esconde',
  nome: NOME,
  dica: chave('Esconda-se onde a lanterna não vai olhar. Quem tem a lanterna procura!'),
  Tela: Esconde,
  // quem procura vale 100 + quantos achou; quem se esconde, as rodadas por que passou
  valor: (v) => (v >= 100 ? `🔦 × ${v - 100}` : `🌿 × ${v}`),
});
