/**
 * A COZINHA DA TOCA: AS RECEITAS (05/11/2026). Este arquivo existe em DUAS CÓPIAS IGUAIS BYTE A BYTE, como o voo da Caça:
 * server/src/cozinha-receitas.ts (o servidor confere o prato entregue) e web/src/cozinha/receitas.ts (a cozinha da tela
 * monta o prato). O teste do servidor confere que são iguais: mudou uma, copie sobre a outra. Sem imports, de propósito.
 *
 * Um ITEM é um ingrediente num estado: cru (como sai do caixote), picado (passou pela tábua; a massa, aberta), cozido (no
 * fogão ou no forno) ou queimado (passou do ponto). A massa aberta leva as coberturas em `com`, e a casquinha, o sabor.
 * O prato é a lista dos itens em cima dele; a ordem não importa.
 *
 * MAIS PRATOS (05/11/2026, com o Food Kit da Kenney, CC0): a salsicha, o ovo, o arroz e o peixe vão ao fogão como a carne
 * (o peixe também passa pela tábua, cru, para o sushi). Cachorro-quente, pão com ovo, x-egg, sushi, peixe com arroz e o
 * prato feito, todos nas mesmas estações.
 *
 * O PONTO, CONFERIDO PELO SERVIDOR (06/11/2026, com o pacote de comida da Quaternius, CC0: o bacon, o bife e o ovo cru, frito
 * e queimado). O fogo não é mais só da tela: a tela avisa "pus na estação N" e "tirei da estação N" na hora, e o SERVIDOR
 * mede o tempo pelo relógio dele (`estadoNoFogo`, com a folga da rede a favor de quem joga). Cada item que ele viu sair do
 * fogo no ponto vira uma ficha; o prato entregue só vale se cada item cozido nele tiver a ficha. Queimado não serve a receita
 * nenhuma: vai para a lixeira, e o pedido espera outro.
 */

export type Ingrediente =
  | 'pao'
  | 'carne'
  | 'queijo'
  | 'alface'
  | 'tomate'
  | 'massa'
  | 'calabresa'
  | 'cogumelo'
  | 'casquinha'
  | 'salsicha'
  | 'ovo'
  | 'arroz'
  | 'peixe'
  | 'bacon'
  | 'bife';
export type Sabor = 'chocolate' | 'morango' | 'baunilha';
export type Estado = 'cru' | 'picado' | 'cozido' | 'queimado';

export interface Item {
  ing: Ingrediente;
  estado: Estado;
  /** As coberturas da massa aberta, ou o sabor da casquinha. */
  com?: string[];
}

export const INGREDIENTES: readonly Ingrediente[] = [
  'pao',
  'carne',
  'queijo',
  'alface',
  'tomate',
  'massa',
  'calabresa',
  'cogumelo',
  'casquinha',
  'salsicha',
  'ovo',
  'arroz',
  'peixe',
  'bacon',
  'bife',
];
export const SABORES: readonly Sabor[] = ['chocolate', 'morango', 'baunilha'];

/** O que passa pela tábua (a massa, para abrir). */
export const PICAVEIS: readonly Ingrediente[] = ['queijo', 'alface', 'tomate', 'calabresa', 'cogumelo', 'massa', 'peixe'];
/** O que vai ao fogão, cru (ou já no ponto, para continuar), e sai cozido. */
export const DO_FOGAO: readonly Ingrediente[] = ['carne', 'salsicha', 'ovo', 'arroz', 'peixe', 'bacon', 'bife'];
/** O que vai ao forno (a massa aberta, com ou sem coberturas). */
export const DO_FORNO: readonly Ingrediente[] = ['massa'];
/** O que vai em cima da massa aberta, já picado. */
export const COBERTURAS: readonly Ingrediente[] = ['tomate', 'queijo', 'calabresa', 'cogumelo'];
/** Quanto tempo de tábua até picar. */
export const TEMPO_DE_PICAR_MS = 1600;
/** O fogão (DO_FOGAO) e o forno (a massa aberta): quando fica pronto, e quando queima. */
export const PONTO: Partial<Record<Ingrediente, { pronto: number; queima: number }>> = {
  carne: { pronto: 4500, queima: 11500 },
  salsicha: { pronto: 3500, queima: 10500 },
  ovo: { pronto: 3000, queima: 10000 },
  arroz: { pronto: 5000, queima: 13000 },
  peixe: { pronto: 4500, queima: 11500 },
  bacon: { pronto: 3500, queima: 9500 },
  bife: { pronto: 5500, queima: 12500 },
  massa: { pronto: 6000, queima: 15000 },
};
/** Do ponto em diante, os últimos isto antes de queimar são o "queimando" (a fumaça e o chiado avisam). */
export const AVISO_DE_QUEIMA = 0.4;
/** A folga da rede, a favor de quem joga: o servidor aceita o ponto um pouco antes e um pouco depois do que a tela mostra. */
export const FOLGA_DO_FOGO_MS = 400;
/**
 * As estações de fogo da planta (o id na planta, web/src/cozinha/cozinha.ts, e o tipo): o servidor não conhece a cozinha,
 * só isto. Mudou a planta, mude aqui (o teste da tela confere).
 */
export const ESTACOES_DE_FOGO: Readonly<Record<number, 'fogao' | 'forno'>> = { 1: 'fogao', 2: 'fogao', 3: 'fogao', 10: 'forno' };

/** O que a estação de fogo aceita: no fogão, o que é dele (cru, ou já no ponto para continuar); no forno, a massa aberta. */
export function vaiAoFogo(tipo: 'fogao' | 'forno', i: Item): boolean {
  if (tipo === 'fogao') return DO_FOGAO.includes(i.ing) && i.estado !== 'picado';
  return DO_FORNO.includes(i.ing) && i.estado !== 'cru';
}

/** O tempo de fogo com que um item entra (quem tira no ponto e põe de novo continua do ponto). */
export function tempoInicialNoFogo(i: Item): number {
  const p = PONTO[i.ing];
  if (!p) return 0;
  return i.estado === 'cozido' ? p.pronto : i.estado === 'queimado' ? p.queima : 0;
}

/**
 * Como o item está depois de `tempo` ms de fogo. `folga` (a do servidor) adianta o ponto e atrasa a queima. Antes do ponto,
 * ele fica como entrou (a carne crua, a massa aberta).
 */
export function estadoNoFogo(i: Item, tempo: number, folga = 0): Estado {
  const p = PONTO[i.ing];
  if (!p) return i.estado;
  if (tempo >= p.queima + folga) return 'queimado';
  if (tempo >= p.pronto - folga) return 'cozido';
  return i.estado === 'cozido' || i.estado === 'queimado' ? 'cru' : i.estado;
}
/** Quantos itens cabem num prato. */
export const MAXIMO_NO_PRATO = 5;
/** Quantos pedidos cada um vê na fila. */
export const PEDIDOS_NA_FILA = 4;
/** A partida inteira. */
export const DURACAO_MS = 180_000;

export type IdDaReceita =
  | 'sorvete-chocolate'
  | 'sorvete-morango'
  | 'sorvete-baunilha'
  | 'salada'
  | 'hamburguer'
  | 'x-burguer'
  | 'x-salada'
  | 'pizza-queijo'
  | 'pizza-calabresa'
  | 'pizza-cogumelo'
  | 'cachorro-quente'
  | 'pao-com-ovo'
  | 'x-egg'
  | 'sushi'
  | 'peixe-com-arroz'
  | 'prato-feito'
  | 'cafe-da-manha'
  | 'x-bacon'
  | 'bife-com-arroz'
  | 'bife-com-salada';

/** O que vai no prato (as chaves, ver `chave`) e quanto vale. */
export const RECEITAS: Record<IdDaReceita, { itens: string[]; pontos: number; peso: number }> = {
  'sorvete-chocolate': { itens: ['casquinha:cru[chocolate]'], pontos: 10, peso: 1 },
  'sorvete-morango': { itens: ['casquinha:cru[morango]'], pontos: 10, peso: 1 },
  'sorvete-baunilha': { itens: ['casquinha:cru[baunilha]'], pontos: 10, peso: 1 },
  salada: { itens: ['alface:picado', 'tomate:picado'], pontos: 15, peso: 1.4 },
  hamburguer: { itens: ['pao:cru', 'carne:cozido'], pontos: 15, peso: 2 },
  'x-burguer': { itens: ['pao:cru', 'carne:cozido', 'queijo:picado'], pontos: 20, peso: 1.8 },
  'x-salada': { itens: ['pao:cru', 'carne:cozido', 'alface:picado', 'tomate:picado'], pontos: 25, peso: 1.3 },
  'pizza-queijo': { itens: ['massa:cozido[queijo,tomate]'], pontos: 30, peso: 1.2 },
  'pizza-calabresa': { itens: ['massa:cozido[calabresa,queijo,tomate]'], pontos: 35, peso: 1 },
  'pizza-cogumelo': { itens: ['massa:cozido[cogumelo,queijo,tomate]'], pontos: 35, peso: 1 },
  'cachorro-quente': { itens: ['pao:cru', 'salsicha:cozido'], pontos: 15, peso: 1.4 },
  'pao-com-ovo': { itens: ['pao:cru', 'ovo:cozido'], pontos: 15, peso: 1 },
  'x-egg': { itens: ['pao:cru', 'carne:cozido', 'ovo:cozido', 'queijo:picado'], pontos: 30, peso: 0.9 },
  sushi: { itens: ['arroz:cozido', 'peixe:picado'], pontos: 20, peso: 1.2 },
  'peixe-com-arroz': { itens: ['peixe:cozido', 'arroz:cozido', 'alface:picado'], pontos: 30, peso: 0.9 },
  'prato-feito': { itens: ['arroz:cozido', 'carne:cozido', 'ovo:cozido'], pontos: 30, peso: 0.8 },
  'cafe-da-manha': { itens: ['ovo:cozido', 'bacon:cozido'], pontos: 20, peso: 1.3 },
  'x-bacon': { itens: ['pao:cru', 'carne:cozido', 'bacon:cozido', 'queijo:picado'], pontos: 30, peso: 1 },
  'bife-com-arroz': { itens: ['bife:cozido', 'arroz:cozido'], pontos: 25, peso: 1 },
  'bife-com-salada': { itens: ['bife:cozido', 'alface:picado', 'tomate:picado'], pontos: 30, peso: 0.9 },
};
export const IDS_DAS_RECEITAS = Object.keys(RECEITAS) as IdDaReceita[];

/** O item em texto: "carne:cozido", "massa:cozido[queijo,tomate]" (as coberturas em ordem). */
export function chave(i: Item): string {
  return `${i.ing}:${i.estado}${i.com && i.com.length ? `[${[...i.com].sort().join(',')}]` : ''}`;
}

/** O caminho de volta: a chave vira o item (para o desenho do pedido e o piloto automático). */
export function itemDaChave(k: string): Item {
  const m = /^([a-z]+):([a-z]+)(?:\[([a-z,]*)\])?$/.exec(k);
  if (!m) throw new Error(`chave inválida: ${k}`);
  const item: Item = { ing: m[1] as Ingrediente, estado: m[2] as Estado };
  if (m[3]) item.com = m[3].split(',');
  return item;
}

/** O prato bate com a receita? Os mesmos itens, nem mais nem menos, em qualquer ordem. */
export function confere(receita: IdDaReceita, prato: Item[]): boolean {
  const r = RECEITAS[receita];
  if (!r) return false;
  const a = prato.map(chave).sort();
  const b = [...r.itens].sort();
  return a.length === b.length && a.every((k, n) => k === b[n]);
}

/** O que serve de prato, vindo de fora (o servidor recebe isto da tela): null se não for um prato possível. */
export function normalizarPrato(x: unknown): Item[] | null {
  if (!Array.isArray(x) || x.length === 0 || x.length > MAXIMO_NO_PRATO) return null;
  const itens: Item[] = [];
  for (const v of x) {
    if (!v || typeof v !== 'object') return null;
    const { ing, estado, com } = v as Record<string, unknown>;
    if (!INGREDIENTES.includes(ing as Ingrediente)) return null;
    if (estado !== 'cru' && estado !== 'picado' && estado !== 'cozido' && estado !== 'queimado') return null;
    const item: Item = { ing: ing as Ingrediente, estado };
    if (com !== undefined) {
      if (!Array.isArray(com) || com.length > COBERTURAS.length) return null;
      const validos: readonly string[] = ing === 'casquinha' ? SABORES : COBERTURAS;
      if (!com.every((c) => typeof c === 'string' && validos.includes(c)) || new Set(com).size !== com.length) return null;
      if (com.length) item.com = [...(com as string[])];
    }
    itens.push(item);
  }
  return itens;
}

/**
 * A sequência de pedidos da partida, a mesma para todos (o servidor sorteia; cada um anda nela no próprio ritmo). Os dois
 * primeiros são dos rápidos, para a partida começar andando; depois, pelo peso de cada receita, sem três iguais seguidos.
 */
export function sortearPedidos(aleatorio: () => number, n: number): IdDaReceita[] {
  const rapidos: IdDaReceita[] = ['sorvete-chocolate', 'sorvete-morango', 'sorvete-baunilha', 'hamburguer', 'salada', 'cachorro-quente', 'pao-com-ovo'];
  const lista: IdDaReceita[] = [];
  const total = IDS_DAS_RECEITAS.reduce((s, id) => s + RECEITAS[id].peso, 0);
  while (lista.length < n) {
    let id: IdDaReceita;
    if (lista.length < 2) id = rapidos[Math.floor(aleatorio() * rapidos.length) % rapidos.length];
    else {
      let r = aleatorio() * total;
      id = IDS_DAS_RECEITAS[IDS_DAS_RECEITAS.length - 1];
      for (const k of IDS_DAS_RECEITAS) {
        r -= RECEITAS[k].peso;
        if (r < 0) {
          id = k;
          break;
        }
      }
    }
    if (lista.length >= 2 && lista[lista.length - 1] === id && lista[lista.length - 2] === id) continue;
    lista.push(id);
  }
  return lista;
}
