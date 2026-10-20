import { ChevronLeft, ChevronRight } from 'lucide-react';
import { type CSSProperties, type ReactNode, useState } from 'react';
import { Avatar, enderecoDoCoelhoPronto } from './Avatar';
import { useT } from './i18n';
import fliperamaUrl from './assets/salao/fliperama.png';
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
 *   canais, a janela chama alguém de fora, e o quadro na parede tem a cara da comunidade. (O balcão era o guarda-roupa;
 *   saiu em 13/10/2026, decisão dele: "na home não precisa ter guarda-roupa aqui".)
 * - O SALÃO ENCHE COM QUEM ESTÁ NA CALL AGORA: cada pessoa na sala de voz ocupa um lugar (o sofá primeiro, depois o
 *   chão em frente à TV, o fliperama, as rodinhas de conversa). Sem ninguém na call, o salão fica vazio — a tela não
 *   finge movimento que não existe. Só o coelho do balcão está sempre lá: é quem recebe e quem lê o recado do dono.
 *   Quem escolheu um coelho pronto de avatar aparece COM ELE, e todo mundo leva o nome em cima (pedido dele,
 *   13/10/2026: "seria legal se aparecesse o MEU coelho, não UM coelho"). Quem usa foto segue com um coelho do salão.
 * - O CLIQUE ACERTA A CAIXA DO OBJETO (o salão não tem máscaras por objeto, que pediriam arte nova); quem usa o
 *   teclado chega pelos botões invisíveis em cada caixa, e o foco acende o mesmo contorno.
 *
 * A TV AO VIVO (13/10/2026, ideia dele): quando alguém da comunidade transmite a tela, a TV sai da animação e mostra
 * "Ao vivo", quem e o quê; clicar entra na sala já assistindo (a watch party). Com mais de uma transmissão, as setas
 * trocam de canal. A imagem da transmissão NÃO vai para a TV, de propósito: cada pessoa no início baixaria o vídeo sem
 * ter entrado na sala (decisão dele, mesmo dia).
 *
 * Etapa 2, ainda não feita: o salão evoluindo com o que a turma faz junta (enfeites por marcos coletivos).
 */

const W = 384;
/**
 * 266 desde 13/10/2026: a arte é a que o Sydenstricker desenhou para a home — o mesmo salão, com o chão estendido
 * para baixo (a porta, o tapete da entrada, a planta do canto) e o coelho do balcão já pintado. Ela foi reduzida
 * à grade do salão, e a parte de cima ficou no mesmo lugar: as caixas e os lugares de antes continuam valendo.
 * No tapete da entrada mora o recado (quem administra escolhe quem o dá).
 */
const H = 266;

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

/** (microfone e jukebox só existem no salão isométrico, SalaoNovo.tsx: os dois levam ao karaokê.) */
export type ObjetoDoSalao = 'quadro' | 'janela' | 'estante' | 'tv' | 'fliperama' | 'balcao' | 'microfone' | 'jukebox' | 'trofeu';
export type AcoesDoSalao = Partial<Record<ObjetoDoSalao, { rotulo: string; sub?: string; onClick: () => void }>>;

/**
 * Os lugares de quem está na call, na ordem em que enchem (as posições e os tempos são os do lobby do site,
 * e2e/pixel-art/lobby/montar.mjs). `quadros` > 1 é faixa animada; as outras respiram um pixel.
 */
const LUGARES: { url: string; caixa: Caixa; quadros?: number; duracao: number; atraso: number; pe?: number }[] = [
  // `pe`: onde pisa o coelho de corpo inteiro, que está de pé. No sofá, o chão na frente dele (no assento, ele parecia
  // flutuar em pé em cima da almofada — relato de 13/10/2026).
  { url: sofa1Url, caixa: [88, 81, 128, 121], quadros: 16, duracao: 5.6, atraso: -1.1, pe: 139 },
  { url: sofa2Url, caixa: [111, 81, 151, 121], quadros: 16, duracao: 6.4, atraso: -3.3, pe: 141 },
  { url: tv1Url, caixa: [152, 109, 179, 136], duracao: 2.9, atraso: -2 },
  { url: tv2Url, caixa: [205, 111, 231, 137], duracao: 3.3, atraso: -0.7 },
  { url: fliperamaUrl, caixa: [256, 78, 301, 145], duracao: 2.6, atraso: -1.5 },
  { url: sueterUrl, caixa: [210, 107, 246, 161], duracao: 3.8, atraso: -2.8 },
  { url: regataUrl, caixa: [236, 108, 271, 161], duracao: 4, atraso: -0.9 },
  { url: trancaUrl, caixa: [42, 105, 79, 160], duracao: 3.2, atraso: -1.7 },
  { url: lacoUrl, caixa: [67, 106, 103, 160], duracao: 3.6, atraso: -0.5 },
];

/**
 * Onde senta quem NÃO tem coelho pronto. Essa pessoa aparece com a figura do lugar, e diante da TV a figura está sentada
 * no chão, com metade da altura de quem está de pé: ao lado dos corpos inteiros ela parecia minúscula (relato de
 * 13/10/2026). Então quem não tem coelho pronto deixa os dois lugares do chão da TV para o fim (o sofá continua primeiro:
 * a figura sentada ali tem a altura de gente); o corpo inteiro de pé cabe em qualquer lugar.
 */
const SEM_PRONTO = [0, 1, 4, 5, 6, 7, 8, 2, 3];

/** Que lugar cada pessoa ocupa (o índice em LUGARES), na ordem de naCall. */
function distribuir(prontos: boolean[]): number[] {
  const livre = LUGARES.map(() => true);
  const lugar: number[] = prontos.map(() => -1);
  const pegar = (i: number, ordem: number[]) => {
    const j = ordem.find((k) => livre[k]);
    if (j === undefined) return;
    livre[j] = false;
    lugar[i] = j;
  };
  const todos = LUGARES.map((_, k) => k);
  prontos.forEach((p, i) => !p && pegar(i, SEM_PRONTO));
  prontos.forEach((p, i) => lugar[i] < 0 && pegar(i, todos));
  return lugar;
}

/**
 * O CORPO INTEIRO de cada coelho pronto, de pé (13/10/2026, gerado no PixelLab: e2e/pixel-art/avatares/corpos.mjs),
 * em web/public/avatares/coelho-NN-corpo.png, com a largura e a altura em pixels do salão. O coelho pronto em si é só
 * cabeça e ombros, e no sofá ele saía "cortado ao meio" (relato dele). O 16 ainda não tem corpo (o saldo do
 * PixelLab acabou nele): segue com o busto.
 */
const CORPOS: Record<number, [number, number]> = {
  1: [27, 51], 2: [32, 50], 3: [34, 51], 4: [28, 54], 5: [27, 54], 6: [28, 52], 7: [26, 53], 8: [27, 52],
  9: [26, 52], 10: [23, 53], 11: [31, 54], 12: [26, 55], 13: [26, 54], 14: [32, 48], 15: [30, 57],
};
const enderecoDoCorpo = (n: number) => `${import.meta.env.BASE_URL}avatares/coelho-${String(n).padStart(2, '0')}-corpo.png`;

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

/** O que a TV mostra quando há transmissão: o canal da vez e como trocar. */
export interface TvAoVivo {
  userId: number;
  nome: string;
  /** O nome da sala de voz onde a transmissão está. */
  sala: string;
  titulo: string | null;
  canal: number;
  total: number;
  aoTrocar: (passo: 1 | -1) => void;
}

export function Salao({ acoes, naCall, quadro, aoVivo, recado }: {
  acoes: AcoesDoSalao;
  /** Quem está na call agora, em qualquer sala de voz da comunidade: o nome e o coelho pronto, se escolheu um. */
  naCall: { nome: string; pronto: number | null }[];
  /** O que vai dentro do quadro da parede: a imagem da comunidade. */
  quadro: ReactNode;
  /** Alguém transmitindo: a TV vira o canal ao vivo. */
  aoVivo?: TvAoVivo | null;
  /** O recado de quem administra (RecadoDoBalcao), de pé no tapete da entrada. */
  recado?: ReactNode;
}) {
  const t = useT();
  const [aceso, setAceso] = useState<ObjetoDoSalao | null>(null);
  const comAcao = OBJETOS.filter((o) => acoes[o.id]);
  const sobra = naCall.length - LUGARES.length;
  const visiveis = naCall.slice(0, LUGARES.length);
  const lugarDe = distribuir(visiveis.map((p) => Boolean(p.pronto)));

  return (
    <div className="salao">
      <img className="salao-cena" src={salaUrl} alt="" draggable={false} />
      <Peca url={janelaUrl} caixa={[24, 30, 68, 96]} quadros={16} duracao={6.4} />
      {aoVivo ? (
        // Como a etiqueta de quem transmite na lista de pessoas (pedido dele, 13/10/2026): o avatar à esquerda, e ao
        // lado o selo, o nome e a sala; o que se transmite vai embaixo.
        <div className="salao-tv-ao-vivo" style={posicao([161, 53, 225, 93])}>
          <div className="salao-tv-quem">
            <Avatar name={aoVivo.nome} userId={aoVivo.userId} online size={30} />
            <div className="salao-tv-texto">
              <span className="salao-tv-selo">
                <span className="live-dot" aria-hidden="true" /> {t('Ao vivo')}
              </span>
              <strong>{aoVivo.nome}</strong>
              <span className="salao-tv-sala">{t('Em {sala}', { sala: aoVivo.sala })}</span>
            </div>
          </div>
          {aoVivo.titulo && <small>{aoVivo.titulo}</small>}
          {aoVivo.total > 1 && <span className="salao-tv-canal">{`${aoVivo.canal + 1}/${aoVivo.total}`}</span>}
        </div>
      ) : (
        <Peca url={telaTvUrl} caixa={[161, 53, 225, 93]} quadros={9} duracao={2.7} />
      )}
      <Peca url={telaFliperamaUrl} caixa={[258, 58, 298, 98]} quadros={9} duracao={1.8} />
      <div className="salao-quadro" style={posicao([96, 58, 110, 78])}>
        {quadro}
      </div>

      {visiveis.map((pessoa, i) => {
        const lugar = LUGARES[lugarDe[i]];
        const [x0, y0, x1, y1] = lugar.caixa;
        // O coelho pronto de corpo inteiro fica de pé no fundo do lugar, no tamanho em que nasceu; sem corpo (o 16),
        // o busto, um pouco maior que as caixas pequenas da TV.
        const meio = (x0 + x1) / 2;
        const corpo = pessoa.pronto ? CORPOS[pessoa.pronto] : undefined;
        const lado = Math.min(34, y1 - y0 + 6);
        const pe = lugar.pe ?? y1;
        const caixa: Caixa = corpo
          ? [meio - corpo[0] / 2, pe - corpo[1], meio + corpo[0] / 2, pe]
          : pessoa.pronto
            ? [meio - lado / 2, y1 - lado, meio + lado / 2, y1]
            : lugar.caixa;
        return (
          <span key={i}>
            {pessoa.pronto ? (
              <span
                className="salao-peca gente na-call salao-busto"
                title={pessoa.nome}
                style={
                  {
                    ...posicao(caixa),
                    backgroundImage: `url(${corpo ? enderecoDoCorpo(pessoa.pronto) : enderecoDoCoelhoPronto(pessoa.pronto)})`,
                    zIndex: corpo ? pe : y1,
                    '--duracao': `${lugar.duracao}s`,
                    '--atraso': `${lugar.atraso}s`,
                  } as CSSProperties
                }
              />
            ) : (
              <Peca {...lugar} gente naCall titulo={pessoa.nome} />
            )}
            <span className="salao-nome" style={{ left: `${(meio / W) * 100}%`, top: `${(caixa[1] / H) * 100}%`, zIndex: 200 + y1 }}>
              {pessoa.nome}
            </span>
          </span>
        );
      })}
      {sobra > 0 && (
        <span className="salao-mais" aria-hidden="true">
          +{sobra}
        </span>
      )}
      {/* O recado, no tapete da entrada: o coelho escolhido e o balão, dentro da cena. */}
      {recado && <div className="salao-recado">{recado}</div>}

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
      {aoVivo && aoVivo.total > 1 && (
        <>
          <button
            type="button"
            className="salao-tv-seta"
            style={posicao([151, 64, 160, 82])}
            aria-label={t('Transmissão anterior')}
            title={t('Transmissão anterior')}
            onClick={() => aoVivo.aoTrocar(-1)}
          >
            <ChevronLeft />
          </button>
          <button
            type="button"
            className="salao-tv-seta"
            style={posicao([227, 64, 236, 82])}
            aria-label={t('Próxima transmissão')}
            title={t('Próxima transmissão')}
            onClick={() => aoVivo.aoTrocar(1)}
          >
            <ChevronRight />
          </button>
        </>
      )}
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
