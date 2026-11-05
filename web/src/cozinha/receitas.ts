/**
 * A COZINHA DA TOCA: AS RECEITAS (05/11/2026). Este arquivo existe em DUAS CÓPIAS IGUAIS BYTE A BYTE, como o voo da Caça:
 * server/src/cozinha-receitas.ts (o servidor confere o prato entregue) e web/src/cozinha/receitas.ts (a cozinha da tela
 * monta o prato). O teste do servidor confere que são iguais: mudou uma, copie sobre a outra. Sem imports, de propósito.
 *
 * Um ITEM é um ingrediente num estado: cru (como sai do caixote), picado (passou pela tábua; a massa, aberta), cozido (no
 * fogão ou no forno) ou queimado (passou do ponto). A massa aberta leva as coberturas em `com`, e a casquinha, o sabor.
 * O prato é a lista dos itens em cima dele; a ordem não importa.
 */

export type Ingrediente = 'pao' | 'carne' | 'queijo' | 'alface' | 'tomate' | 'massa' | 'calabresa' | 'cogumelo' | 'casquinha';
export type Sabor = 'chocolate' | 'morango' | 'baunilha';
export type Estado = 'cru' | 'picado' | 'cozido' | 'queimado';

export interface Item {
  ing: Ingrediente;
  estado: Estado;
  /** As coberturas da massa aberta, ou o sabor da casquinha. */
  com?: string[];
}

export const INGREDIENTES: readonly Ingrediente[] = ['pao', 'carne', 'queijo', 'alface', 'tomate', 'massa', 'calabresa', 'cogumelo', 'casquinha'];
export const SABORES: readonly Sabor[] = ['chocolate', 'morango', 'baunilha'];

/** O que passa pela tábua (a massa, para abrir). */
export const PICAVEIS: readonly Ingrediente[] = ['queijo', 'alface', 'tomate', 'calabresa', 'cogumelo', 'massa'];
/** O que vai em cima da massa aberta, já picado. */
export const COBERTURAS: readonly Ingrediente[] = ['tomate', 'queijo', 'calabresa', 'cogumelo'];
/** Quanto tempo de tábua até picar. */
export const TEMPO_DE_PICAR_MS = 1600;
/** O fogão (a carne) e o forno (a massa aberta): quando fica pronto, e quando queima. */
export const PONTO: Record<'carne' | 'massa', { pronto: number; queima: number }> = {
  carne: { pronto: 4500, queima: 11500 },
  massa: { pronto: 6000, queima: 15000 },
};
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
  | 'pizza-cogumelo';

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
  const rapidos: IdDaReceita[] = ['sorvete-chocolate', 'sorvete-morango', 'sorvete-baunilha', 'hamburguer', 'salada'];
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
