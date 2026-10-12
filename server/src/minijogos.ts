/**
 * OS MINI-GAMES DA SALA DE VOZ (12/10/2026). A turma está na call; alguém aperta o controle e todo mundo
 * joga junto, cada um na própria tela, e a revelação é junta. O primeiro é o "Qual é maior?" (o Size It Up
 * do Syden, decidido em 07/10/2026): dois objetos, cada um chuta qual é maior, e o tamanho de verdade
 * aparece para todo mundo ao mesmo tempo — é aí que a conversa acontece.
 *
 * A PARTIDA MORA SÓ NA MEMÓRIA. Ela dura minutos e não vale nada depois; reiniciar o servidor acaba com
 * ela, como acaba com a chamada. Sem tabela, sem limpeza.
 *
 * QUEM DECIDE É O SERVIDOR: ele sorteia o par, guarda os votos, conta o tempo e dá os pontos. O voto de
 * cada um fica escondido até a revelação (antes dela, só se sabe QUEM já votou) — senão o último a votar
 * copiaria a maioria.
 *
 * Os NOMES dos objetos não estão aqui: o site os tem, traduzidos (web/src/minijogos.ts), e o teste
 * web/test/minijogos.test.ts confere que as duas listas têm os mesmos ids. Aqui ficam só os tamanhos, que
 * é o que decide quem acertou.
 */

import { placar, type Definicao } from './minijogo-motor.js';

export type Medida = 'altura' | 'comprimento' | 'diametro';

/** O tamanho de cada objeto, em centímetros, e o que foi medido. Valores típicos, de fontes de referência. */
export const OBJETOS: Record<string, { cm: number; medida: Medida }> = {
  bacteria: { cm: 0.0002, medida: 'comprimento' },
  formiga: { cm: 0.5, medida: 'comprimento' },
  abelha: { cm: 1.5, medida: 'comprimento' },
  morango: { cm: 3, medida: 'comprimento' },
  ovo: { cm: 6, medida: 'altura' },
  'bola-de-tenis': { cm: 6.7, medida: 'diametro' },
  camundongo: { cm: 8, medida: 'comprimento' },
  celular: { cm: 15, medida: 'altura' },
  lapis: { cm: 19, medida: 'comprimento' },
  banana: { cm: 20, medida: 'comprimento' },
  'bola-de-futebol': { cm: 22, medida: 'diametro' },
  pizza: { cm: 35, medida: 'diametro' },
  melancia: { cm: 40, medida: 'comprimento' },
  gato: { cm: 46, medida: 'comprimento' },
  violao: { cm: 100, medida: 'comprimento' },
  pinguim: { cm: 115, medida: 'altura' },
  flamingo: { cm: 120, medida: 'altura' },
  cavalo: { cm: 160, medida: 'altura' },
  pessoa: { cm: 170, medida: 'altura' },
  bicicleta: { cm: 175, medida: 'comprimento' },
  porta: { cm: 210, medida: 'altura' },
  urso: { cm: 240, medida: 'altura' },
  elefante: { cm: 330, medida: 'altura' },
  moai: { cm: 400, medida: 'altura' },
  carro: { cm: 450, medida: 'comprimento' },
  girafa: { cm: 550, medida: 'altura' },
  onibus: { cm: 1200, medida: 'comprimento' },
  'tiranossauro-rex': { cm: 1230, medida: 'comprimento' },
  'baleia-azul': { cm: 2500, medida: 'comprimento' },
  aviao: { cm: 3950, medida: 'comprimento' },
  'piscina-olimpica': { cm: 5000, medida: 'comprimento' },
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

/** O par só é bom quando a resposta não é óbvia nem é empate: de 1,3× a 12× de diferença. */
const RAZAO_MINIMA = 1.3;
const RAZAO_MAXIMA = 12;

export const RODADAS = 8;
export const VOTANDO_MS = 15_000;
export const REVELANDO_MS = 5_000;
/** O placar final fica na tela por um tempo e some sozinho, se ninguém fechar antes. */
export const PLACAR_MS = 60_000;

/** Sorteia um par que ainda não saiu nesta partida. `aleatorio` é trocável para o teste. */
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

export type Fase = 'votando' | 'revelando' | 'fim';

/** Qual dos dois é o maior. */
export const maior = (par: [string, string]): 0 | 1 => (OBJETOS[par[0]].cm >= OBJETOS[par[1]].cm ? 0 : 1);

/**
 * O "Qual é maior?" como jogo do motor (ver minijogo-motor.ts): 8 rodadas de votar e revelar. Todo mundo
 * que está na sala começa no placar, com zero: quem não votar aparece, e não some.
 */
export const tamanho: Definicao = {
  comecar(ctx, { naSala }) {
    let rodada = 1;
    let fase: Fase = 'votando';
    let par: [string, string] = ['gato', 'cavalo'];
    const usados = new Set<string>();
    /** O voto de cada um na rodada: 0 = o da esquerda, 1 = o da direita. */
    const votos = new Map<number, 0 | 1>();
    const pontos = new Map(naSala.map((id) => [id, 0]));

    function novaRodada() {
      par = sortearPar(usados);
      par.forEach((id) => usados.add(id));
      votos.clear();
      fase = 'votando';
      ctx.agendar(VOTANDO_MS, revelar);
      ctx.avisar();
    }

    function revelar() {
      if (fase !== 'votando') return;
      const certo = maior(par);
      for (const [userId, escolha] of votos) pontos.set(userId, (pontos.get(userId) ?? 0) + (escolha === certo ? 1 : 0));
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
      publico() {
        // Os votos e os tamanhos só aparecem depois da revelação — senão o último a votar copiaria a maioria.
        const revelado = fase !== 'votando';
        return {
          rodada,
          rodadas: RODADAS,
          fase,
          par: par.map((id) => ({ id, ...(revelado ? OBJETOS[id] : {}) })),
          votaram: [...votos.keys()],
          votos: revelado ? Object.fromEntries(votos) : null,
          certo: revelado ? maior(par) : null,
          placar: placar(pontos, ctx.nome),
        };
      },
      acao(quem, corpo) {
        if (corpo.tipo !== 'voto') return 'Ação desconhecida.';
        if (fase !== 'votando') return 'Agora não é hora de votar.';
        const escolha = corpo.escolha;
        if (escolha !== 0 && escolha !== 1) return 'Escolha um dos dois.';
        votos.set(quem, escolha);
        if (!pontos.has(quem)) pontos.set(quem, 0);
        // Todo mundo da sala votou: revela na hora, sem esperar o relógio.
        if (ctx.naSala().every((id) => votos.has(id))) revelar();
        else ctx.avisar();
        return null;
      },
    };
  },
};
