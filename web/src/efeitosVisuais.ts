// Efeitos visuais da chamada: confete, fogos de artifício e corações, jogados na tela de todo mundo
// da sala ao mesmo tempo. É o irmão visual do soundboard — e some sozinho em poucos segundos.
//
// A FÍSICA MORA AQUI E O DESENHO MORA NO COMPONENTE, de propósito. Assim as regras (quando uma
// partícula morre, quando um foguete explode, quanto o vento empurra) dão para testar sem navegador,
// que é onde os erros ficam escondidos: um efeito que nunca termina vira um canvas desenhando para
// sempre por cima da chamada, gastando bateria de todo mundo sem ninguém perceber.

export type EfeitoVisualId = 'confete' | 'fogos' | 'coracoes';

export const EFEITOS_VISUAIS: { id: EfeitoVisualId; nome: string; emoji: string; dica: string }[] = [
  { id: 'confete', nome: 'Confete', emoji: '🎉', dica: 'Papelzinho colorido caindo na tela.' },
  { id: 'fogos', nome: 'Fogos', emoji: '🎆', dica: 'Foguetes que sobem e explodem em cores.' },
  { id: 'coracoes', nome: 'Corações', emoji: '💖', dica: 'Corações subindo devagar.' },
];

export function ehEfeitoVisual(valor: unknown): valor is EfeitoVisualId {
  return EFEITOS_VISUAIS.some((e) => e.id === valor);
}

export function nomeDoEfeitoVisual(id: EfeitoVisualId): string {
  return EFEITOS_VISUAIS.find((e) => e.id === id)?.nome ?? 'Efeito';
}

/**
 * Teto de partículas vivas ao mesmo tempo, somando TODOS os efeitos na tela.
 *
 * Existe porque o efeito é disparado por qualquer pessoa da sala: cinco amigos clicando junto não
 * podem virar mil e tanto de partículas em cima de uma chamada que já está decodificando vídeo. Quando
 * o teto é atingido, o efeito novo entra menor em vez de ser recusado — ninguém fica sem o seu confete.
 */
export const TETO_DE_PARTICULAS = 420;

/** Quanto tempo um disparo dura, do clique ao último pedacinho sumir. */
export const DURACAO_MS = 5000;

export type Formato = 'papel' | 'faisca' | 'coracao';

export interface Particula {
  x: number;
  y: number;
  vx: number;
  vy: number;
  giro: number;
  giroPasso: number;
  tamanho: number;
  cor: string;
  formato: Formato;
  /** Segundos que ainda faltam para sumir. Zero ou menos: morreu. */
  vida: number;
  /** Quanto a gravidade puxa esta partícula. Confete cai, coração sobe, faísca cai devagar. */
  gravidade: number;
  /** Segundos até virar explosão. Só o foguete usa; as outras partículas ficam em zero. */
  estouraEm: number;
}

const CORES = ['#c8102e', '#e8762c', '#f2c744', '#5f9a4a', '#4a8fd8', '#a45fd8', '#f7f1e6'];

function sorteio<T>(lista: readonly T[], aleatorio: () => number): T {
  return lista[Math.floor(aleatorio() * lista.length)];
}

/**
 * As partículas de um disparo. `largura` e `altura` são as da tela, em pixels de CSS.
 *
 * `aleatorio` é injetado para o teste poder pedir um sorteio previsível; no app é sempre Math.random.
 */
export function criarParticulas(
  id: EfeitoVisualId,
  largura: number,
  altura: number,
  quantas: number,
  aleatorio: () => number = Math.random,
): Particula[] {
  const base = (extra: Partial<Particula>): Particula => ({
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    giro: aleatorio() * Math.PI,
    giroPasso: (aleatorio() - 0.5) * 6,
    tamanho: 8,
    cor: sorteio(CORES, aleatorio),
    formato: 'papel',
    vida: DURACAO_MS / 1000,
    gravidade: 0,
    estouraEm: 0,
    ...extra,
  });

  if (id === 'confete') {
    return Array.from({ length: quantas }, () =>
      base({
        x: aleatorio() * largura,
        // Começam ACIMA da tela, espalhados: caem em chuva em vez de aparecerem todos numa linha só.
        y: -20 - aleatorio() * altura,
        vx: (aleatorio() - 0.5) * 60,
        vy: 140 + aleatorio() * 160,
        tamanho: 6 + aleatorio() * 6,
        formato: 'papel',
      }),
    );
  }

  if (id === 'coracoes') {
    return Array.from({ length: quantas }, () =>
      base({
        x: aleatorio() * largura,
        y: altura + 20 + aleatorio() * altura * 0.6,
        vx: (aleatorio() - 0.5) * 40,
        vy: -(70 + aleatorio() * 70), // sobem
        giroPasso: (aleatorio() - 0.5) * 1.5,
        tamanho: 12 + aleatorio() * 12,
        cor: sorteio(['#ff5c8a', '#ff2d6f', '#ff9ec4', '#e8477f'], aleatorio),
        formato: 'coracao',
      }),
    );
  }

  // Fogos: nascem poucos FOGUETES subindo. Cada um vira um punhado de faíscas ao estourar — é por isso
  // que a quantidade pedida é dividida, senão um clique só já encostaria no teto de partículas.
  const foguetes = Math.max(1, Math.round(quantas / 24));
  return Array.from({ length: foguetes }, () =>
    base({
      x: largura * (0.2 + aleatorio() * 0.6),
      y: altura,
      vx: (aleatorio() - 0.5) * 40,
      vy: -(380 + aleatorio() * 140),
      tamanho: 3,
      formato: 'faisca',
      gravidade: 220,
      estouraEm: 0.7 + aleatorio() * 0.5,
      vida: 3,
    }),
  );
}

/** As faíscas de um foguete que acabou de estourar. */
function estourar(foguete: Particula, aleatorio: () => number): Particula[] {
  const quantas = 22;
  const cor = foguete.cor;
  return Array.from({ length: quantas }, (_, i) => {
    const angulo = (i / quantas) * Math.PI * 2 + aleatorio() * 0.2;
    const forca = 110 + aleatorio() * 90;
    return {
      x: foguete.x,
      y: foguete.y,
      vx: Math.cos(angulo) * forca,
      vy: Math.sin(angulo) * forca,
      giro: 0,
      giroPasso: 0,
      tamanho: 2 + aleatorio() * 2,
      cor,
      formato: 'faisca' as Formato,
      vida: 1 + aleatorio() * 0.8,
      gravidade: 120,
      estouraEm: 0,
    };
  });
}

/**
 * Avança um quadro e devolve as partículas que continuam vivas.
 *
 * Devolve lista nova em vez de mexer na de dentro: é o que deixa o teste comparar "antes e depois" e o
 * componente saber que acabou quando a lista volta vazia.
 */
export function avancar(
  particulas: readonly Particula[],
  dt: number,
  largura: number,
  altura: number,
  aleatorio: () => number = Math.random,
): Particula[] {
  const proximas: Particula[] = [];
  for (const p of particulas) {
    const vida = p.vida - dt;
    if (vida <= 0) continue;

    // O foguete some no ponto mais alto e deixa as faíscas no lugar dele.
    if (p.estouraEm > 0) {
      const estouraEm = p.estouraEm - dt;
      if (estouraEm <= 0) {
        // O estouro só entra se ainda couber: o teto vale para a soma, não para cada efeito.
        if (proximas.length + particulas.length < TETO_DE_PARTICULAS) proximas.push(...estourar(p, aleatorio));
        continue;
      }
      proximas.push({ ...p, estouraEm, vida, x: p.x + p.vx * dt, y: p.y + p.vy * dt, vy: p.vy + p.gravidade * dt });
      continue;
    }

    let x = p.x + p.vx * dt;
    let y = p.y + p.vy * dt;
    const vy = p.vy + p.gravidade * dt;

    // Confete que passa do pé da tela volta pelo alto enquanto o efeito dura: dá a impressão de chuva
    // contínua sem precisar de três vezes mais papel na memória.
    if (p.formato === 'papel' && y > altura + 20) {
      y = -20;
      x = aleatorio() * largura;
    }
    // Coração e faísca não voltam: saiu da tela, acabou. Sem isto, uma faísca jogada para o lado
    // continuaria sendo calculada para sempre, fora da vista.
    if (p.formato !== 'papel' && (y < -60 || y > altura + 60 || x < -60 || x > largura + 60)) continue;

    proximas.push({ ...p, x, y, vy, giro: p.giro + p.giroPasso * dt, vida });
  }
  return proximas;
}

/**
 * Quantas partículas um disparo pode criar agora, sabendo quantas já estão na tela.
 * Nunca devolve menos que um punhado: efeito pedido é efeito visto.
 */
export function quantasCabem(jaNaTela: number, desejadas: number): number {
  return Math.max(12, Math.min(desejadas, TETO_DE_PARTICULAS - jaNaTela));
}

/**
 * Junta um disparo novo ao que já está na tela, respeitando o teto.
 *
 * Precisa existir porque `quantasCabem` tem um piso: com a tela cheia, ela ainda devolve um punhado,
 * para quem clicou não ficar sem ver nada. Cinco pessoas clicando na tela cheia passariam do teto um
 * punhado de cada vez. Aqui as MAIS VELHAS saem na frente para as novas entrarem — o total nunca
 * passa, e o clique de quem chegou por último aparece do mesmo jeito.
 */
export function juntar(atuais: readonly Particula[], novas: readonly Particula[]): Particula[] {
  const todas = [...atuais, ...novas];
  return todas.length <= TETO_DE_PARTICULAS ? todas : todas.slice(todas.length - TETO_DE_PARTICULAS);
}
