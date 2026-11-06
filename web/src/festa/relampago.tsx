import { useEffect, useRef, useState } from 'react';
import { chave, useT } from '../i18n';
import { tocar } from '../somDosJogos';
import { microjogoDaTela, Moldura, useRelogio, useTeclas, type PropsDoMicro } from './comum';

/**
 * QUIZ RELÂMPAGO (05/11/2026, server/src/festa/relampago.ts): cinco perguntas sobre o Syden e a horta, três respostas cada.
 * Responde-se uma vez por pergunta (clique, toque ou as teclas 1, 2 e 3); a certa aparece quando o tempo dela acaba.
 *
 * AS PERGUNTAS SÃO NOSSAS, e a ORDEM DESTA LISTA É A DO SERVIDOR (CERTAS, lá, diz qual das três é a certa; o teste confere que
 * as duas listas têm o mesmo tamanho). Pergunta nova: no fim desta lista e da de lá, nunca no meio. Curtas, sem pegadinha, e
 * nada que só uma cultura saiba.
 */
export const PERGUNTAS: { p: string; o: [string, string, string] }[] = [
  { p: chave('Qual destes cresce debaixo da terra?'), o: [chave('Maçã'), chave('Cenoura'), chave('Cereja')] },
  { p: chave('Quantas orelhas tem um coelho?'), o: [chave('Duas'), chave('Três'), chave('Quatro')] },
  { p: chave('O que o mascote do Syden veste?'), o: [chave('Armadura'), chave('Terno'), chave('Moletom')] },
  { p: chave('Qual destes é uma ferramenta da horta?'), o: [chave('Travesseiro'), chave('Regador'), chave('Guarda-chuva')] },
  { p: chave('Do que uma planta precisa para crescer?'), o: [chave('Água e sol'), chave('Sal e areia'), chave('Leite e mel')] },
  { p: chave('De que cor é a folha da cenoura?'), o: [chave('Azul'), chave('Preta'), chave('Verde')] },
  { p: chave('No quarto, onde o coelho dorme quando a pessoa está ausente?'), o: [chave('Na banheira'), chave('Na cama'), chave('No telhado')] },
  { p: chave('No quarto, o que leva às salas de voz?'), o: [chave('O fone'), chave('O abajur'), chave('O vaso')] },
  { p: chave('No quarto, o que abre os Mini-games?'), o: [chave('A cama'), chave('A janela'), chave('A mesa')] },
  { p: chave('No salão da comunidade, o que abre os Mini-games?'), o: [chave('O fliperama'), chave('A estante'), chave('O balcão')] },
  { p: chave('No salão, a TV leva aonde?'), o: [chave('Ao guarda-roupa'), chave('À sala de voz'), chave('Ao calendário')] },
  { p: chave('Qual destes bichos é uma praga da horta?'), o: [chave('Abelha'), chave('Joaninha'), chave('Lagarta')] },
  { p: chave('Quem ajuda as flores a virar frutos?'), o: [chave('Abelha'), chave('Lagarta'), chave('Lesma')] },
  { p: chave('Quantas patas tem um coelho?'), o: [chave('Duas'), chave('Quatro'), chave('Seis')] },
  { p: chave('O que nasce de uma semente?'), o: [chave('Uma pedra'), chave('Uma nuvem'), chave('Uma planta')] },
  { p: chave('Quantas rodadas tem uma partida da Festa dos coelhos?'), o: [chave('Cinco'), chave('Duas'), chave('Dez')] },
  { p: chave('Em que dia é o aniversário do Syden?'), o: [chave('1º de janeiro'), chave('19 de setembro'), chave('25 de dezembro')] },
  { p: chave('Na Corrida dos coelhos, o kart do mascote parece o quê?'), o: [chave('Um sapato'), chave('Uma banana'), chave('Uma cenoura')] },
  { p: chave('Qual destes é uma fruta vermelha?'), o: [chave('Morango'), chave('Batata'), chave('Cenoura')] },
  { p: chave('Que bicho é o mascote do Syden?'), o: [chave('Gato'), chave('Coelho'), chave('Sapo')] },
  { p: chave('O que a minhoca faz pela horta?'), o: [chave('Come as folhas'), chave('Espanta a chuva'), chave('Afofa a terra')] },
  { p: chave('Qual destes é o mais pesado?'), o: [chave('Uma abóbora'), chave('Uma ervilha'), chave('Um morango')] },
  { p: chave('Quem fica atrás do balcão do salão?'), o: [chave('Um gato'), chave('O coelho do recado'), chave('Ninguém')] },
  { p: chave('O que a estante de troféus do quarto mostra?'), o: [chave('Os livros'), chave('As fotos'), chave('Os pódios dos jogos')] },
  { p: chave('O que um espantalho espanta?'), o: [chave('Os pássaros'), chave('A chuva'), chave('As minhocas')] },
  { p: chave('Quantas patas tem uma aranha?'), o: [chave('Seis'), chave('Oito'), chave('Quatro')] },
  { p: chave('Quantas patas tem um inseto?'), o: [chave('Oito'), chave('Quatro'), chave('Seis')] },
  { p: chave('Na Caça às pragas, o que serve de munição?'), o: [chave('Cenouras'), chave('Pedras'), chave('Bolinhas')] },
  { p: chave('No quarto, o que troca o dia pela noite?'), o: [chave('O tapete'), chave('O abajur'), chave('A planta')] },
  { p: chave('O que dá para fazer com os móveis do seu quarto?'), o: [chave('Vender'), chave('Plantar'), chave('Arrumar como quiser')] },
];

// Os mesmos números do servidor.
const PERGUNTA_MS = 4000;
const ESPERA_MS = 900;
const MOSTRA_MS = 1000;
const PASSO_MS = PERGUNTA_MS + ESPERA_MS + MOSTRA_MS;

interface Dados {
  perguntas?: { q: number; ordem: number[] }[];
  certas?: (number | null)[];
}

const CORES = ['#e07a2e', '#6fa356', '#5b8fc9'];

function Relampago({ dados, inicio, ativo, lance }: PropsDoMicro<Dados>) {
  const t = useT();
  const perguntas = dados.perguntas ?? [];
  const certas = dados.certas ?? [];
  const [minhas, setMinhas] = useState<Map<number, number>>(new Map());
  const agora = useRelogio(ativo);
  const e = agora - inicio;
  const k = Math.max(0, Math.min(perguntas.length - 1, Math.floor(e / PASSO_MS)));
  const dentro = e - k * PASSO_MS;
  const aberta = e >= 0 && dentro < PERGUNTA_MS;
  const pergunta = perguntas[k];
  const texto = pergunta ? PERGUNTAS[pergunta.q] : undefined;
  const certa = certas[k] ?? null;
  const minha = minhas.get(k);
  const acertos = [...minhas].filter(([i, o]) => certas[i] !== null && certas[i] !== undefined && certas[i] === o).length;

  // o som da certa, quando ela chega
  const ouvida = useRef(-1);
  useEffect(() => {
    if (certa === null || ouvida.current === k || minha === undefined) return;
    ouvida.current = k;
    tocar(minha === certa ? 'acerto' : 'erro');
  }, [certa, k, minha]);

  const responder = (opcao: number) => {
    if (!ativo || !aberta || minhas.has(k)) return;
    setMinhas((m) => new Map(m).set(k, opcao));
    tocar('clique');
    lance({ k, opcao, ms: Math.round(dentro) });
  };
  useTeclas(ativo, (ev) => {
    const n = Number(ev.key);
    if (!Number.isInteger(n) || n < 1 || n > 3) return false;
    responder(n - 1);
    return true;
  });

  return (
    <Moldura placar={`✔ × ${acertos}`} fracao={aberta ? dentro / PERGUNTA_MS : 1}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '4px 2px', width: 'min(92vw, 420px)' }}>
        {/* as bolinhas: uma por pergunta, verde ou vermelha depois que a certa saiu */}
        <div aria-hidden="true" style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
          {perguntas.map((_, i) => {
            const c = certas[i];
            const m = minhas.get(i);
            const cor = c === null || c === undefined ? (i === k ? '#f2c46a' : '#8a7a6a55') : m === c ? '#6fa356' : '#d9534f';
            return <span key={i} style={{ width: 12, height: 12, borderRadius: 6, background: cor, display: 'inline-block' }} />;
          })}
        </div>
        {texto && (
          <>
            <p style={{ fontSize: '1.15em', fontWeight: 700, textAlign: 'center', margin: '6px 4px', minHeight: '2.6em' }}>{t(texto.p)}</p>
            <div style={{ display: 'grid', gap: 8 }}>
              {pergunta!.ordem.map((o, pos) => {
                const escolhida = minha === pos;
                const ehCerta = certa === pos;
                const fundo = certa !== null ? (ehCerta ? '#6fa356' : escolhida ? '#d9534f' : '#8a7a6a33') : escolhida ? '#f2c46a' : 'transparent';
                return (
                  <button
                    key={pos}
                    type="button"
                    disabled={!ativo || !aberta || minha !== undefined}
                    onPointerDown={(ev) => {
                      ev.preventDefault();
                      responder(pos);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '10px 12px',
                      borderRadius: 10,
                      border: `3px solid ${CORES[pos]}`,
                      background: fundo,
                      color: fundo === 'transparent' || fundo === '#8a7a6a33' ? 'inherit' : '#2a2320',
                      font: 'inherit',
                      fontSize: '1.05em',
                      textAlign: 'start',
                      opacity: certa !== null && !ehCerta && !escolhida ? 0.55 : 1,
                      cursor: ativo && aberta && minha === undefined ? 'pointer' : 'default',
                    }}
                  >
                    <span
                      aria-hidden="true"
                      style={{ background: CORES[pos], color: '#fff', borderRadius: 6, minWidth: 26, textAlign: 'center', fontWeight: 700 }}
                    >
                      {pos + 1}
                    </span>
                    <span>{t(texto.o[o])}</span>
                    {certa !== null && ehCerta && <span aria-hidden="true" style={{ marginInlineStart: 'auto' }}>✔</span>}
                  </button>
                );
              })}
            </div>
          </>
        )}
        {/* fechada e esperando a certa: a ampulheta */}
        <div aria-hidden="true" style={{ textAlign: 'center', minHeight: '1.4em', fontSize: '1.2em' }}>
          {!aberta && certa === null && e >= 0 ? '⏳' : ''}
        </div>
      </div>
    </Moldura>
  );
}

export default microjogoDaTela({
  id: 'relampago',
  nome: chave('Quiz relâmpago'),
  dica: chave('Escolha a resposta certa antes que o tempo acabe.'),
  Tela: Relampago,
  valor: (v) => `✔ × ${v}`,
  errouComValor: true,
});
