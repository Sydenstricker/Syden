import { irPara, type Acao, type Coisa, type Cozinha, type Estacao } from './cozinha';
import { COBERTURAS, DO_FOGAO, PICAVEIS, RECEITAS, chave, confere, itemDaChave, type IdDaReceita, type Ingrediente, type Item } from './receitas';

/**
 * O PILOTO AUTOMÁTICO DA COZINHA (para os testes e o e2e: `window.cozinhaPilotoAutomatico`, só no site de desenvolvimento).
 * Ele cozinha o primeiro pedido da fila como uma pessoa faria, pelas MESMAS regras do teclado e do clique (irPara + Espaço/E),
 * olhando a cozinha a cada vez que fica parado: o prato mora no balcão ao lado da janela, o que precisa de tábua vai à tábua,
 * o que é do fogão (a carne, a salsicha, o ovo, o arroz, o peixe) vai ao fogão — e só se busca com um fogão livre, a pizza aberta recebe as coberturas na tábua e vai ao forno. O que não serve vai para a lixeira.
 */

type Passo = { estacao: number; acao: Acao } | null;

const ehPrato = (c: Coisa | null): c is { tipo: 'prato'; itens: Item[] } => c?.tipo === 'prato';
const ehItem = (c: Coisa | null): c is { tipo: 'item'; item: Item } => c?.tipo === 'item';

/** O que falta no prato para a receita (as chaves), e se ele tem algo que não é dela. */
function comparar(itens: Item[], receita: IdDaReceita) {
  const falta = [...RECEITAS[receita].itens];
  let sobra = false;
  for (const i of itens) {
    const n = falta.indexOf(chave(i));
    if (n >= 0) falta.splice(n, 1);
    else sobra = true;
  }
  return { falta, sobra };
}

export function decidir(k: Cozinha, receita: IdDaReceita): Passo {
  const E = k.estacoes;
  const de = (tipo: Estacao['tipo']) => E.filter((e) => e.tipo === tipo);
  const entrega = de('entrega')[0];
  const montagem = E.find((e) => e.tipo === 'balcao' && e.l === entrega.l && e.c === entrega.c - 1)!;
  const lixeira = de('lixeira')[0];
  const pratos = de('pratos')[0];
  const forno = de('forno')[0];
  const tabuas = de('tabua');
  const fogoes = de('fogao');
  const caixote = (ing: Ingrediente) => E.find((e) => e.tipo === 'caixote' && e.ing === ing)!;
  const vai = (e: Estacao, acao: Acao = 'espaco'): Passo => ({ estacao: e.id, acao });

  const prato = ehPrato(montagem.em) ? montagem.em : null;
  const { falta, sobra } = comparar(prato?.itens ?? [], receita);
  const pizza = falta.find((f) => f.startsWith('massa:cozido'));
  const coberturas = pizza ? (itemDaChave(pizza).com ?? []) : [];
  const precisa = (k2: string) => falta.includes(k2);
  /** A massa aberta (crua) numa tábua, se houver. */
  const base = tabuas.find((t) => ehItem(t.em) && t.em.item.ing === 'massa' && t.em.item.estado === 'picado');
  const tabuaLivre = tabuas.find((t) => t.em === null && t !== base);
  const precisaPicar = (i: Item) =>
    i.estado === 'cru' && PICAVEIS.includes(i.ing) && (precisa(`${i.ing}:picado`) || (i.ing === 'massa' && !!pizza) || (coberturas.includes(i.ing) && !!pizza));

  const mao = k.coelho.mao;
  // ---- com o prato na mão ----
  if (ehPrato(mao)) {
    if (confere(receita, mao.itens)) return vai(entrega);
    if (comparar(mao.itens, receita).sobra) return vai(lixeira);
    if (montagem.em === null || ehItem(montagem.em)) return vai(montagem);
    return vai(lixeira);
  }
  // ---- com um item na mão ----
  if (ehItem(mao)) {
    const i = mao.item;
    const k2 = chave(i);
    if (precisa(k2)) return prato || montagem.em === null ? vai(montagem) : vai(lixeira);
    if (DO_FOGAO.includes(i.ing) && i.estado === 'cru' && precisa(`${i.ing}:cozido`)) {
      const f = fogoes.find((e) => e.em === null);
      return f ? vai(f) : null;
    }
    if (i.ing === 'casquinha' && !i.com?.length) {
      const sabor = falta.map(itemDaChave).find((x) => x.ing === 'casquinha')?.com?.[0];
      const pote = sabor ? E.find((e) => e.tipo === 'sorvete' && e.sabor === sabor) : undefined;
      return pote ? vai(pote, 'usar') : vai(lixeira);
    }
    if (pizza && i.ing === 'massa' && i.estado === 'picado') {
      const completa = coberturas.every((c) => i.com?.includes(c)) && (i.com ?? []).every((c) => coberturas.includes(c));
      if (!(i.com ?? []).every((c) => coberturas.includes(c))) return vai(lixeira);
      if (completa) return forno.em === null ? vai(forno) : null;
      return tabuaLivre ?? tabuas.find((t) => t.em === null) ? vai((tabuaLivre ?? tabuas.find((t) => t.em === null))!) : null;
    }
    if (pizza && base && i.estado === 'picado' && COBERTURAS.includes(i.ing) && coberturas.includes(i.ing) && !(base.em as { item: Item }).item.com?.includes(i.ing))
      return vai(base);
    if (precisaPicar(i)) {
      const t = i.ing === 'massa' ? tabuas.find((x) => x.em === null) : tabuaLivre;
      return t ? vai(t) : null;
    }
    return vai(lixeira);
  }
  // ---- com a mão vazia ----
  if (ehItem(montagem.em)) return precisa(chave(montagem.em.item)) ? vai(pratos) : vai(montagem);
  if (prato && sobra) return vai(montagem);
  if (prato && falta.length === 0) return vai(montagem);
  // o que queimou, para a lixeira
  for (const e of [...fogoes, forno]) if (ehItem(e.em) && e.em.item.estado === 'queimado') return vai(e);
  // o que está no fogão e não serve a este pedido (sobrou de outro), para a lixeira, para o fogão não ficar ocupado
  for (const e of fogoes) if (ehItem(e.em) && !precisa(`${e.em.item.ing}:cozido`)) return vai(e);
  // o que está pronto no fogo
  for (const e of [...fogoes, forno]) if (ehItem(e.em) && precisa(chave(e.em.item))) return prato ? vai(e) : vai(pratos);
  if (!prato) return vai(pratos);
  // a tábua: picar o que está cru, pegar o que já está picado
  for (const t of tabuas) {
    if (!ehItem(t.em)) continue;
    const i = t.em.item;
    if (precisaPicar(i)) return vai(t, 'usar');
    if (t === base) {
      const pronta = coberturas.every((c) => i.com?.includes(c));
      if (pronta && forno.em === null) return vai(t);
      continue;
    }
    if (i.estado === 'picado' && (precisa(chave(i)) || (base && coberturas.includes(i.ing) && !(base.em as { item: Item }).item.com?.includes(i.ing)))) return vai(t);
    if (!precisaPicar(i)) return vai(t); // o que não serve: pega, e na próxima vai para a lixeira
  }
  // o que ainda falta, e ninguém está fazendo
  for (const f of falta) {
    const alvoItem = itemDaChave(f);
    if (alvoItem.estado === 'cozido' && DO_FOGAO.includes(alvoItem.ing)) {
      if (fogoes.some((e) => ehItem(e.em) && e.em.item.ing === alvoItem.ing)) continue;
      // sem fogão livre, espera: com o cru na mão e o fogão cheio, ele travaria
      if (!fogoes.some((e) => e.em === null)) continue;
      return vai(caixote(alvoItem.ing));
    }
    if (alvoItem.ing === 'massa') {
      if (ehItem(forno.em) && forno.em.item.ing === 'massa') continue;
      if (!base && !tabuas.some((t) => ehItem(t.em) && t.em.item.ing === 'massa')) return vai(caixote('massa'));
      if (!base) continue;
      const tem = (base.em as { item: Item }).item.com ?? [];
      for (const c of coberturas) {
        if (tem.includes(c as Ingrediente) || tabuas.some((t) => t !== base && ehItem(t.em) && t.em.item.ing === c)) continue;
        if (!tabuaLivre) break;
        return vai(caixote(c as Ingrediente));
      }
      continue;
    }
    if (alvoItem.estado === 'picado' && tabuas.some((t) => ehItem(t.em) && t.em.item.ing === alvoItem.ing)) continue;
    if (alvoItem.estado === 'picado' && !tabuaLivre) continue;
    return vai(caixote(alvoItem.ing));
  }
  return null;
}

/** Um passo do piloto: se o coelho está parado, escolhe o que fazer. */
export function pilotar(k: Cozinha, receita: IdDaReceita | undefined) {
  const c = k.coelho;
  if (!receita || c.destino || c.picando !== null) return;
  const p = decidir(k, receita);
  if (p) irPara(k, p.estacao, p.acao);
}
