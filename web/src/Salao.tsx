import { type CSSProperties, type ReactNode, useState } from 'react';
import balcaoUrl from './assets/salao/balcao.png';
import fliperamaUrl from './assets/salao/fliperama.png';
import frenteBalcaoUrl from './assets/salao/frente-balcao.png';
import janelaUrl from './assets/salao/janela.png';
import lacoUrl from './assets/salao/laco-vermelho.png';
import regataUrl from './assets/salao/regata.png';
import salaUrl from './assets/salao/sala.png';
import sofa1Url from './assets/salao/sofa-1.png';
import sofa2Url from './assets/salao/sofa-2.png';
import sueterUrl from './assets/salao/sueter.png';
import telaFliperamaUrl from './assets/salao/tela-fliperama.png';
import telaTvUrl from './assets/salao/tela-tv.png';
import trancaUrl from './assets/salao/tranca-roxa.png';
import tv1Url from './assets/salao/tv-1.png';
import tv2Url from './assets/salao/tv-2.png';

/**
 * O SALÃO DA COMUNIDADE (12/10/2026, pedido do Sydenstricker): o quarto é de cada um, o salão é da turma. O início
 * de uma comunidade deixou de ser arte em vetor e virou o salão em pixel art do fim do site — o mesmo lugar, as mesmas
 * peças (e2e/pixel-art/lobby/, copiadas para web/src/assets/salao/), sem gerar arte nova.
 *
 * - CADA FUNÇÃO MORA NUM OBJETO, como no quarto: a TV leva à sala de voz, o fliperama aos mini-games, a estante aos
 *   canais, a janela chama alguém de fora, o balcão é o guarda-roupa, e o quadro na parede tem a cara da comunidade.
 * - O SALÃO ENCHE COM QUEM ESTÁ NA CALL AGORA: cada pessoa na sala de voz ocupa um lugar (o sofá primeiro, depois o
 *   chão em frente à TV, o fliperama, as rodinhas de conversa). Sem ninguém na call, o salão fica vazio — a tela não
 *   finge movimento que não existe. Só o coelho do balcão está sempre lá: é quem recebe e quem lê o recado do dono.
 * - O CLIQUE ACERTA A CAIXA DO OBJETO (o salão não tem máscaras por objeto, que pediriam arte nova); quem usa o
 *   teclado chega pelos botões invisíveis em cada caixa, e o foco acende o mesmo contorno.
 *
 * Etapa 2, ainda não feita: o salão evoluindo com o que a turma faz junta (enfeites por marcos coletivos).
 */

const W = 384;
const H = 192;

type Caixa = [number, number, number, number];

/** Os objetos com função, em pixels do salão (medidos sobre sala.png). */
const OBJETOS: { id: ObjetoDoSalao; caixa: Caixa }[] = [
  { id: 'quadro', caixa: [93, 55, 113, 81] },
  { id: 'janela', caixa: [22, 26, 68, 94] },
  { id: 'estante', caixa: [0, 92, 30, 182] },
  { id: 'tv', caixa: [160, 51, 227, 95] },
  { id: 'fliperama', caixa: [256, 57, 299, 133] },
  { id: 'balcao', caixa: [308, 92, 384, 140] },
];

export type ObjetoDoSalao = 'quadro' | 'janela' | 'estante' | 'tv' | 'fliperama' | 'balcao';
export type AcoesDoSalao = Partial<Record<ObjetoDoSalao, { rotulo: string; sub?: string; onClick: () => void }>>;

/**
 * Os lugares de quem está na call, na ordem em que enchem (as posições e os tempos são os do lobby do site,
 * e2e/pixel-art/lobby/montar.mjs). `quadros` > 1 é faixa animada; as outras respiram um pixel.
 */
const LUGARES: { url: string; caixa: Caixa; quadros?: number; duracao: number; atraso: number }[] = [
  { url: sofa1Url, caixa: [88, 81, 128, 121], quadros: 16, duracao: 5.6, atraso: -1.1 },
  { url: sofa2Url, caixa: [111, 81, 151, 121], quadros: 16, duracao: 6.4, atraso: -3.3 },
  { url: tv1Url, caixa: [152, 109, 179, 136], duracao: 2.9, atraso: -2 },
  { url: tv2Url, caixa: [205, 111, 231, 137], duracao: 3.3, atraso: -0.7 },
  { url: fliperamaUrl, caixa: [256, 78, 301, 145], duracao: 2.6, atraso: -1.5 },
  { url: sueterUrl, caixa: [210, 107, 246, 161], duracao: 3.8, atraso: -2.8 },
  { url: regataUrl, caixa: [236, 108, 271, 161], duracao: 4, atraso: -0.9 },
  { url: trancaUrl, caixa: [42, 105, 79, 160], duracao: 3.2, atraso: -1.7 },
  { url: lacoUrl, caixa: [67, 106, 103, 160], duracao: 3.6, atraso: -0.5 },
];

const posicao = ([x0, y0, x1, y1]: Caixa): CSSProperties => ({
  left: `${(x0 / W) * 100}%`,
  top: `${(y0 / H) * 100}%`,
  width: `${((x1 - x0) / W) * 100}%`,
  height: `${((y1 - y0) / H) * 100}%`,
});

/** Uma peça do salão: imagem parada, ou faixa de `quadros` tocada quadro a quadro. */
function Peca({ url, caixa, quadros, duracao, atraso, gente, titulo, naCall }: {
  url: string;
  caixa: Caixa;
  quadros?: number;
  duracao?: number;
  atraso?: number;
  gente?: boolean;
  titulo?: string;
  /** É alguém que está na call agora (e não o coelho do balcão). */
  naCall?: boolean;
}) {
  const faixa = (quadros ?? 1) > 1;
  return (
    <span
      className={`salao-peca${faixa ? ' faixa' : ''}${gente && !faixa ? ' gente' : ''}${naCall ? ' na-call' : ''}`}
      title={titulo}
      style={
        {
          ...posicao(caixa),
          backgroundImage: `url(${url})`,
          ...(faixa && { backgroundSize: `${(quadros ?? 1) * 100}% 100%` }),
          zIndex: caixa[3],
          '--quadros': quadros ?? 1,
          '--duracao': `${duracao ?? 3}s`,
          '--atraso': `${atraso ?? 0}s`,
        } as CSSProperties
      }
    />
  );
}

export function Salao({ acoes, naCall, quadro }: {
  acoes: AcoesDoSalao;
  /** Os nomes de quem está na call agora, em qualquer sala de voz da comunidade. */
  naCall: string[];
  /** O que vai dentro do quadro da parede: a imagem da comunidade. */
  quadro: ReactNode;
}) {
  const [aceso, setAceso] = useState<ObjetoDoSalao | null>(null);
  const comAcao = OBJETOS.filter((o) => acoes[o.id]);
  const sobra = naCall.length - LUGARES.length;

  return (
    <div className="salao">
      <img className="salao-cena" src={salaUrl} alt="" draggable={false} />
      <Peca url={janelaUrl} caixa={[24, 30, 68, 96]} quadros={16} duracao={6.4} />
      <Peca url={telaTvUrl} caixa={[161, 53, 225, 93]} quadros={9} duracao={2.7} />
      <Peca url={telaFliperamaUrl} caixa={[258, 58, 298, 98]} quadros={9} duracao={1.8} />
      <div className="salao-quadro" style={posicao([96, 58, 110, 78])}>
        {quadro}
      </div>

      {naCall.slice(0, LUGARES.length).map((nome, i) => (
        <Peca key={i} {...LUGARES[i]} gente naCall titulo={nome} />
      ))}
      {sobra > 0 && (
        <span className="salao-mais" aria-hidden="true">
          +{sobra}
        </span>
      )}
      {/* O coelho do balcão, sempre lá: da cintura para baixo, a frente do balcão passa na frente dele. */}
      <Peca url={balcaoUrl} caixa={[332, 71, 371, 129]} duracao={3.5} atraso={-2.4} gente />
      <Peca url={frenteBalcaoUrl} caixa={[336, 90, 384, 138]} />

      {comAcao.map((o) => (
        <span key={`d-${o.id}`} className={`salao-destaque${aceso === o.id ? ' aceso' : ''}`} style={posicao(o.caixa)} aria-hidden="true" />
      ))}
      {comAcao.map((o) => {
        const acao = acoes[o.id]!;
        return (
          <button
            key={o.id}
            type="button"
            className="salao-alvo"
            style={posicao(o.caixa)}
            aria-label={acao.sub ? `${acao.rotulo} — ${acao.sub}` : acao.rotulo}
            onPointerEnter={() => setAceso(o.id)}
            onPointerLeave={() => setAceso(null)}
            onFocus={() => setAceso(o.id)}
            onBlur={() => setAceso(null)}
            onClick={acao.onClick}
          />
        );
      })}
      {aceso && acoes[aceso] && (
        <span
          className="salao-rotulo"
          style={(() => {
            const [x0, y0, x1] = OBJETOS.find((o) => o.id === aceso)!.caixa;
            return { left: `${Math.min(88, Math.max(12, (((x0 + x1) / 2) / W) * 100))}%`, top: `${(y0 / H) * 100}%` };
          })()}
          aria-hidden="true"
        >
          <strong>{acoes[aceso]!.rotulo}</strong>
          {acoes[aceso]!.sub && <small>{acoes[aceso]!.sub}</small>}
        </span>
      )}
    </div>
  );
}
