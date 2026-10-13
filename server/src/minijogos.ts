/**
 * OS MINI-GAMES DA SALA DE VOZ (12/10/2026). A turma está na call; alguém aperta o controle e todo mundo
 * joga junto, cada um na própria tela, e a revelação é junta. O primeiro é o "Qual é o tamanho?" (o Size It
 * Up do Syden, decidido em 07/10/2026): um objeto de referência, com o tamanho dito, e ao lado outro que cada
 * um AUMENTA E DIMINUI na própria tela até achar a proporção. O tamanho de verdade aparece para todo mundo ao
 * mesmo tempo, com o palpite de cada um — é aí que a conversa acontece. (Até 13/10/2026 era "qual dos dois é
 * maior", em duas cartas; o Sydenstricker jogou e não era o que ele tinha imaginado.)
 *
 * A PARTIDA MORA SÓ NA MEMÓRIA. Ela dura minutos e não vale nada depois; reiniciar o servidor acaba com
 * ela, como acaba com a chamada. Sem tabela, sem limpeza.
 *
 * QUEM DECIDE É O SERVIDOR: ele sorteia o par, guarda os palpites, conta o tempo e dá os pontos. O tamanho
 * do objeto e o palpite de cada um ficam escondidos até a revelação (antes dela, só se sabe QUEM já
 * confirmou) — senão o último copiaria a turma.
 *
 * Os NOMES dos objetos não estão aqui: o site os tem, traduzidos (web/src/minijogos.ts), e o teste
 * web/test/minijogos.test.ts confere que as duas listas têm os mesmos ids. Aqui ficam só os tamanhos, que
 * é o que decide quem chegou mais perto.
 */

import { placar, type Definicao } from './minijogo-motor.js';

export type Medida = 'altura' | 'comprimento' | 'diametro';

/** O tamanho de cada objeto, em centímetros, e o que foi medido. Valores típicos, de fontes de referência. */
export const OBJETOS: Record<string, { cm: number; medida: Medida }> = {
  bacteria: { cm: 0.0002, medida: 'comprimento' },
  formiga: { cm: 0.5, medida: 'comprimento' },
  joaninha: { cm: 0.7, medida: 'comprimento' },
  abelha: { cm: 1.5, medida: 'comprimento' },
  morango: { cm: 4, medida: 'altura' },
  caracol: { cm: 4, medida: 'comprimento' },
  ovo: { cm: 6, medida: 'altura' },
  camundongo: { cm: 8, medida: 'comprimento' },
  lampada: { cm: 11, medida: 'altura' },
  celular: { cm: 15, medida: 'altura' },
  lapis: { cm: 19, medida: 'comprimento' },
  banana: { cm: 20, medida: 'comprimento' },
  'bola-de-futebol': { cm: 22, medida: 'diametro' },
  'bola-de-basquete': { cm: 24, medida: 'diametro' },
  abacaxi: { cm: 30, medida: 'altura' },
  notebook: { cm: 34, medida: 'comprimento' },
  tulipa: { cm: 40, medida: 'altura' },
  coelho: { cm: 40, medida: 'comprimento' },
  gato: { cm: 46, medida: 'comprimento' },
  cachorro: { cm: 60, medida: 'altura' },
  cadeira: { cm: 85, medida: 'altura' },
  'guarda-chuva': { cm: 100, medida: 'diametro' },
  violao: { cm: 100, medida: 'comprimento' },
  pinguim: { cm: 115, medida: 'altura' },
  flamingo: { cm: 120, medida: 'altura' },
  zebra: { cm: 140, medida: 'altura' },
  vaca: { cm: 145, medida: 'altura' },
  hipopotamo: { cm: 150, medida: 'altura' },
  cavalo: { cm: 160, medida: 'altura' },
  pessoa: { cm: 170, medida: 'altura' },
  bicicleta: { cm: 175, medida: 'comprimento' },
  rinoceronte: { cm: 180, medida: 'altura' },
  lhama: { cm: 180, medida: 'altura' },
  bisao: { cm: 190, medida: 'altura' },
  cama: { cm: 200, medida: 'comprimento' },
  camelo: { cm: 210, medida: 'altura' },
  porta: { cm: 210, medida: 'altura' },
  trator: { cm: 280, medida: 'altura' },
  elefante: { cm: 330, medida: 'altura' },
  mamute: { cm: 330, medida: 'altura' },
  moai: { cm: 400, medida: 'altura' },
  carro: { cm: 450, medida: 'comprimento' },
  girafa: { cm: 550, medida: 'altura' },
  casa: { cm: 600, medida: 'altura' },
  onibus: { cm: 1200, medida: 'comprimento' },
  cacto: { cm: 1200, medida: 'altura' },
  'tiranossauro-rex': { cm: 1230, medida: 'comprimento' },
  braquiossauro: { cm: 1300, medida: 'altura' },
  coqueiro: { cm: 2500, medida: 'altura' },
  'baleia-azul': { cm: 2500, medida: 'comprimento' },
  aviao: { cm: 3950, medida: 'comprimento' },
  'estatua-da-liberdade': { cm: 9300, medida: 'altura' },
  'campo-de-futebol': { cm: 10500, medida: 'comprimento' },
  foguete: { cm: 11060, medida: 'altura' },
  'roda-gigante': { cm: 13500, medida: 'altura' },
  titanic: { cm: 26900, medida: 'comprimento' },
  'torre-eiffel': { cm: 33000, medida: 'altura' },
  'monte-fuji': { cm: 377_600, medida: 'altura' },
  everest: { cm: 884_900, medida: 'altura' },
  lua: { cm: 347_400_000, medida: 'diametro' },
  terra: { cm: 1_274_200_000, medida: 'diametro' },
  jupiter: { cm: 13_982_000_000, medida: 'diametro' },
  sol: { cm: 139_140_000_000, medida: 'diametro' },
};

/**
 * O par é bom quando o objeto é de 1,5× a 20× maior (ou menor) que a referência: menos que isso é empate a
 * olho, e mais que isso o menor vira um ponto na tela.
 */
const RAZAO_MINIMA = 1.5;
const RAZAO_MAXIMA = 20;
/** O palpite é a razão objeto ÷ referência; fora disto é bobagem (o site nem deixa chegar lá). */
export const PALPITE_MINIMO = 1 / 50;
export const PALPITE_MAXIMO = 50;

export const RODADAS = 8;
export const ESTIMANDO_MS = 25_000;
export const REVELANDO_MS = 7_000;
/** O placar final fica na tela por um tempo e some sozinho, se ninguém fechar antes. */
export const PLACAR_MS = 60_000;

/** Sorteia [referência, objeto], dois que ainda não saíram nesta partida. `aleatorio` é trocável para o teste. */
export function sortearPar(usados: Set<string>, aleatorio = Math.random): [string, string] {
  const ids = Object.keys(OBJETOS);
  for (let tentativa = 0; tentativa < 500; tentativa++) {
    const a = ids[Math.floor(aleatorio() * ids.length)];
    const b = ids[Math.floor(aleatorio() * ids.length)];
    if (a === b || usados.has(a) || usados.has(b)) continue;
    const razao = Math.max(OBJETOS[a].cm, OBJETOS[b].cm) / Math.min(OBJETOS[a].cm, OBJETOS[b].cm);
    if (razao >= RAZAO_MINIMA && razao <= RAZAO_MAXIMA) return [a, b];
  }
  // Raríssimo (todos os objetos bons já saíram): libera a repetição.
  return usados.size > 0 ? sortearPar(new Set(), aleatorio) : ['gato', 'cavalo'];
}

export type Fase = 'estimando' | 'revelando' | 'fim';

/** Quantas vezes o objeto é maior que a referência (menos que 1: menor). */
export const razaoReal = (par: [string, string]) => OBJETOS[par[1]].cm / OBJETOS[par[0]].cm;

/**
 * Os pontos de um palpite: 100 na mosca, 50 errando pelo dobro (ou pela metade), zero errando por 4× ou mais.
 * O erro é medido em PROPORÇÃO, não em centímetros: chutar 2 m para 1 m erra tanto quanto chutar 50 cm.
 */
export function pontosDoPalpite(palpite: number, real: number): number {
  const erro = Math.abs(Math.log(palpite / real));
  return Math.round(100 * Math.max(0, 1 - erro / Math.log(4)));
}

/**
 * O "Qual é o tamanho?" como jogo do motor (ver minijogo-motor.ts): 8 rodadas de estimar e revelar. Todo
 * mundo que está na sala começa no placar, com zero: quem não jogar aparece, e não some.
 *
 * O palpite chega ao servidor ENQUANTO a pessoa mexe (o site manda devagar), e não só no "Confirmar": quem
 * deixou o objeto no tamanho certo e não confirmou não perde a rodada para o relógio.
 */
export const tamanho: Definicao = {
  comecar(ctx, { naSala }) {
    let rodada = 1;
    let fase: Fase = 'estimando';
    let par: [string, string] = ['gato', 'cavalo'];
    const usados = new Set<string>();
    const palpites = new Map<number, number>();
    const confirmaram = new Set<number>();
    /** Os pontos de cada um na última revelação. */
    const daRodada = new Map<number, number>();
    const pontos = new Map(naSala.map((id) => [id, 0]));

    function novaRodada() {
      par = sortearPar(usados);
      par.forEach((id) => usados.add(id));
      palpites.clear();
      confirmaram.clear();
      daRodada.clear();
      fase = 'estimando';
      ctx.agendar(ESTIMANDO_MS, revelar);
      ctx.avisar();
    }

    function revelar() {
      if (fase !== 'estimando') return;
      const real = razaoReal(par);
      for (const [userId, palpite] of palpites) {
        const ganhou = pontosDoPalpite(palpite, real);
        daRodada.set(userId, ganhou);
        pontos.set(userId, (pontos.get(userId) ?? 0) + ganhou);
      }
      fase = 'revelando';
      ctx.agendar(REVELANDO_MS, () => {
        if (rodada >= RODADAS) {
          fase = 'fim';
          return ctx.terminar();
        }
        rodada++;
        novaRodada();
      });
      ctx.avisar();
    }

    novaRodada();
    return {
      publico(quem) {
        const revelado = fase !== 'estimando';
        const [ref, alvo] = par;
        return {
          rodada,
          rodadas: RODADAS,
          fase,
          referencia: { id: ref, ...OBJETOS[ref] },
          // O que se mede no objeto (altura, comprimento) se sabe desde o começo; o tamanho, só na revelação.
          objeto: { id: alvo, medida: OBJETOS[alvo].medida, ...(revelado ? { cm: OBJETOS[alvo].cm } : {}) },
          real: revelado ? razaoReal(par) : null,
          meuPalpite: palpites.get(quem) ?? null,
          confirmaram: [...confirmaram],
          palpites: revelado ? [...palpites].map(([userId, palpite]) => ({ userId, palpite, pontos: daRodada.get(userId) ?? 0 })) : null,
          placar: placar(pontos, ctx.nome),
        };
      },
      acao(quem, corpo) {
        if (corpo.tipo !== 'palpite') return 'Ação desconhecida.';
        if (fase !== 'estimando') return 'Agora não é hora de votar.';
        const palpite = corpo.razao;
        if (typeof palpite !== 'number' || !Number.isFinite(palpite) || palpite <= 0) return 'Ação desconhecida.';
        palpites.set(quem, Math.min(PALPITE_MAXIMO, Math.max(PALPITE_MINIMO, palpite)));
        if (!pontos.has(quem)) pontos.set(quem, 0);
        if (corpo.confirmar !== true) return null; // ainda mexendo: os outros não precisam saber
        confirmaram.add(quem);
        // Todo mundo da sala confirmou: revela na hora, sem esperar o relógio.
        if (ctx.naSala().every((id) => confirmaram.has(id))) revelar();
        else ctx.avisar();
        return null;
      },
    };
  },
};
