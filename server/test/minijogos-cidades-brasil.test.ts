/**
 * Capitais, o lote C da segunda auditoria (20/11/2026): o tabuleiro do BRASIL INTEIRO (as 27 capitais em 40 casas, escolhido na
 * largada) e as notícias novas (a temporada que dobra ou corta os aluguéis de um grupo por uma rodada, o mutirão, as obras, o
 * IPTU, o perdão da hipoteca…). O relógio e o sorteio são de mão, como em minijogos-cidades.test.ts.
 */
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

const { app, fechar } = await servidorDeTeste();
const mod = await import('../src/minijogo-cidades.js');
const { criarCidades, CASAS, CASAS_DO_BRASIL, CARTAS, VALOR_DA_CARTA, DINHEIRO_INICIAL } = mod;
after(fechar);

let agora = 7_000_000;
/** 0 dá os dados 1 e 1 (duas casas: a primeira notícia nos dois tabuleiros); 0,5 dá 4 e 4. */
let sorte = 0;

const ana = await criarConta(app, 'ana-bra');
const bia = await criarConta(app, 'bia-bra');
const idDe = async (token: string) => (await comToken(app, token)('GET', '/api/me')).json().id as number;
const anaId = await idDe(ana.token);
const biaId = await idDe(bia.token);
const comunidade = (await comToken(app, ana.token)('POST', '/api/communities', { name: 'Turma do Brasil inteiro' })).json() as { id: number };

type Estado = {
  fase: string;
  vez: number | null;
  casas: { tipo: string; uf?: string; grupo?: number; aluguel?: number }[];
  tabuleiro: string;
  temporada: { grupo: number; fator: number; vezes: number } | null;
  jogadores: { userId: number; pos: number; dinheiro: number; falido: boolean }[];
  posses: { casa: number; dono: number; predios: number; hipotecada: boolean; aluguel: number }[];
  historico: { tipo: string; carta?: string; grupo?: number; casa?: number; valor?: number | null }[];
};

function comecar(opcoes: Parameters<typeof criarCidades>[0] = {}, corpo: Record<string, unknown> = {}, inicio = [anaId, biaId], solo = false) {
  // 0,5 deixa a ordem como entrou (a Ana primeiro)
  sorte = 0.5;
  const relogio: { ms: number; depois: () => void }[] = [];
  let terminou = false;
  const ctx = {
    agendar: (ms: number, depois: () => void) => relogio.splice(0, relogio.length, { ms, depois }),
    avisar: () => {},
    terminar: () => {
      terminou = true;
    },
    naSala: () => inicio,
    nome: (id: number) => (id === anaId ? 'ana' : 'bia'),
    comunidade: solo ? 0 : comunidade.id,
    solo,
  };
  const jogo = criarCidades({ agora: () => agora, aleatorio: () => sorte, semDadosIguais: true, ...opcoes }).comecar(ctx, { naSala: inicio, criadaPor: inicio[0], corpo });
  assert.ok(typeof jogo !== 'string');
  return {
    jogo,
    terminou: () => terminou,
    estado: () => jogo.publico(anaId) as unknown as Estado,
    andar() {
      const r = relogio[0];
      agora += r.ms;
      r.depois();
    },
  };
}
const de = (e: Estado, id: number) => e.jogadores.find((j) => j.userId === id)!;
const posse = (e: Estado, casa: number) => e.posses.find((p) => p.casa === casa);
/** A Ana tira dados 1 e 1, a peça chega à notícia da casa 2, e a notícia age. */
function anaNaNoticia(m: ReturnType<typeof comecar>) {
  sorte = 0;
  assert.equal(m.jogo.acao(anaId, { tipo: 'dados' }), null);
  m.andar();
}

test('o Brasil inteiro: 40 casas, as 27 capitais (cada UF uma vez) em 9 grupos, e os cantos de sempre', () => {
  assert.equal(CASAS_DO_BRASIL.length, 40);
  const cidades = CASAS_DO_BRASIL.filter((c) => c.tipo === 'cidade');
  assert.equal(cidades.length, 27);
  assert.equal(new Set(cidades.map((c) => c.uf)).size, 27);
  assert.deepEqual([...new Set(cidades.map((c) => c.grupo))].sort(), [0, 1, 2, 3, 4, 5, 6, 7, 8]);
  // cada grupo tem de 2 a 4 cidades, e os preços sobem com a volta
  for (let g = 0; g < 9; g++) {
    const n = cidades.filter((c) => c.grupo === g).length;
    assert.ok(n >= 2 && n <= 4, `grupo ${g} com ${n}`);
  }
  const precos = cidades.map((c) => c.preco!);
  assert.deepEqual(precos, [...precos].sort((a, b) => a - b));
  for (const c of cidades) assert.ok(c.aluguel! > 0 && c.custo! > 0);
  // os cantos da volta 12 × 10: a largada, o engarrafamento, o feriado e a ferrovia
  assert.deepEqual([0, 11, 20, 31].map((i) => CASAS_DO_BRASIL[i].tipo), ['largada', 'engarrafamento', 'feriado', 'transporte']);
  assert.equal(CASAS_DO_BRASIL.filter((c) => c.tipo === 'transporte').length, 4);
  // as 20 da de 32 estão todas lá
  for (const c of CASAS.filter((k) => k.tipo === 'cidade')) assert.ok(cidades.some((k) => k.uf === c.uf));
});

test('a largada escolhe o tabuleiro: o de 32 é o de fábrica, e o Brasil inteiro anda pela volta de 40', () => {
  assert.equal(comecar().estado().casas.length, 32);
  assert.equal(comecar().estado().tabuleiro, 'capitais');
  const m = comecar({}, { tabuleiro: 'brasil' });
  assert.equal(m.estado().tabuleiro, 'brasil');
  assert.equal(m.estado().casas.length, 40);
  sorte = 0.5;
  m.jogo.acao(anaId, { tipo: 'dados' });
  m.andar();
  assert.equal(de(m.estado(), anaId).pos, 8);
  assert.equal(m.estado().fase, 'compra');
  assert.equal(m.jogo.acao(anaId, { tipo: 'comprar', sim: true }), null);
  assert.equal(de(m.estado(), anaId).dinheiro, DINHEIRO_INICIAL - CASAS_DO_BRASIL[8].preco!);
});

test('as notícias: são 31, sem repetir', () => {
  assert.equal(CARTAS.length, 31);
  assert.equal(new Set(CARTAS).size, CARTAS.length);
});

test('alta temporada: os aluguéis do grupo dobram por uma rodada (uma vez de cada um), e passa', () => {
  const m = comecar({ cartas: ['alta-temporada', 'ciencias'], posses: [[1, biaId]] });
  anaNaNoticia(m);
  const e = m.estado();
  assert.deepEqual(e.temporada, { grupo: 0, fator: 2, vezes: 2 });
  assert.equal(e.historico.at(-1)!.grupo, 0);
  assert.equal(posse(e, 1)!.aluguel, CASAS[1].aluguel! * 2);
  // a vez da Bia: ainda vale
  m.jogo.acao(anaId, { tipo: 'terminar' });
  assert.equal(m.estado().vez, biaId);
  assert.ok(m.estado().temporada);
  // a Bia tira a feira de ciências (+80) e passa; na vez da Ana de novo, acabou
  m.jogo.acao(biaId, { tipo: 'dados' });
  m.andar();
  assert.equal(de(m.estado(), biaId).dinheiro, DINHEIRO_INICIAL + VALOR_DA_CARTA.ciencias!);
  m.jogo.acao(biaId, { tipo: 'terminar' });
  assert.equal(m.estado().vez, anaId);
  assert.equal(m.estado().temporada, null);
  assert.equal(posse(m.estado(), 1)!.aluguel, CASAS[1].aluguel!);
});

test('baixa temporada: metade do aluguel, de preferência num grupo que tem dono', () => {
  const m = comecar({ cartas: ['baixa-temporada'], posses: [[28, biaId, 2]] });
  anaNaNoticia(m);
  const e = m.estado();
  assert.equal(e.temporada!.grupo, CASAS[28].grupo);
  assert.equal(posse(e, 28)!.aluguel, Math.round((CASAS[28].aluguel! * 13) / 2));
});

test('mutirão: um prédio grátis onde a regra deixa; sem onde, o dinheiro', () => {
  const m = comecar({ cartas: ['mutirao'], posses: [[1, anaId], [3, anaId]] });
  anaNaNoticia(m);
  const e = m.estado();
  assert.equal(posse(e, 1)!.predios + posse(e, 3)!.predios, 1);
  assert.equal(de(e, anaId).dinheiro, DINHEIRO_INICIAL);
  assert.ok([1, 3].includes(e.historico.at(-1)!.casa!));
  const sem = comecar({ cartas: ['mutirao'], posses: [[1, anaId]] });
  anaNaNoticia(sem);
  assert.equal(posse(sem.estado(), 1)!.predios, 0);
  assert.equal(de(sem.estado(), anaId).dinheiro, DINHEIRO_INICIAL + VALOR_DA_CARTA.mutirao!);
});

test('obras: no grupo sorteado (o que tem prédio), cada dono paga pelos prédios dele ali', () => {
  const m = comecar({ cartas: ['obras'], posses: [[1, biaId, 2], [3, biaId, 1]] });
  anaNaNoticia(m);
  const e = m.estado();
  assert.equal(e.historico.at(-1)!.grupo, 0);
  assert.equal(de(e, biaId).dinheiro, DINHEIRO_INICIAL - 3 * VALOR_DA_CARTA.obras!);
  assert.equal(de(e, anaId).dinheiro, DINHEIRO_INICIAL);
});

test('IPTU, turistas e o perdão da hipoteca', () => {
  const iptu = comecar({ cartas: ['iptu'], posses: [[1, anaId], [6, anaId], [5, anaId]] });
  anaNaNoticia(iptu);
  // o transporte não é cidade: só duas pagam
  assert.equal(de(iptu.estado(), anaId).dinheiro, DINHEIRO_INICIAL - 2 * VALOR_DA_CARTA.iptu!);
  const turistas = comecar({ cartas: ['turistas'], posses: [[1, anaId], [6, anaId]] });
  anaNaNoticia(turistas);
  assert.equal(de(turistas.estado(), anaId).dinheiro, DINHEIRO_INICIAL + 2 * VALOR_DA_CARTA.turistas!);
  const perdao = comecar({ cartas: ['perdao'], posses: [[6, anaId]] });
  // sem hipoteca, o perdão vira dinheiro
  anaNaNoticia(perdao);
  assert.equal(de(perdao.estado(), anaId).dinheiro, DINHEIRO_INICIAL + VALOR_DA_CARTA.perdao!);
});

test('o perdão devolve a hipoteca mais cara, sem custo (no Brasil inteiro)', () => {
  const m = comecar({ cartas: ['perdao'], posses: [[6, anaId], [8, anaId]] }, { tabuleiro: 'brasil' });
  // a Ana para na própria Palmas (casa 8), hipoteca as duas e passa; a Bia para lá também (hipotecada, sem aluguel) e passa
  sorte = 0.5;
  m.jogo.acao(anaId, { tipo: 'dados' });
  m.andar();
  assert.equal(m.jogo.acao(anaId, { tipo: 'hipotecar', casa: 6 }), null);
  assert.equal(m.jogo.acao(anaId, { tipo: 'hipotecar', casa: 8 }), null);
  m.jogo.acao(anaId, { tipo: 'terminar' });
  m.jogo.acao(biaId, { tipo: 'dados' });
  m.andar();
  m.jogo.acao(biaId, { tipo: 'terminar' });
  const dinheiro = de(m.estado(), anaId).dinheiro;
  // 5 e 5: da casa 8 à 18, a notícia
  sorte = 0.7;
  m.jogo.acao(anaId, { tipo: 'dados' });
  m.andar();
  const e = m.estado();
  assert.equal(de(e, anaId).pos, 18);
  assert.equal(posse(e, 8)!.hipotecada, false, 'a mais cara (Palmas) volta');
  assert.equal(posse(e, 6)!.hipotecada, true);
  assert.equal(e.historico.at(-1)!.casa, 8);
  assert.equal(de(e, anaId).dinheiro, dinheiro);
});

test('o Brasil inteiro com 5 robôs no Solo vai até o fim, com as notícias saindo', () => {
  let semente = 12345;
  const aleatorio = () => ((semente = (semente * 16807) % 2147483647) / 2147483647);
  const m = comecar({ aleatorio, semDadosIguais: false }, { tabuleiro: 'brasil', robos: 5, modo: 'rodadas', rodadas: 30 }, [anaId], true);
  const vistas = new Set<string>();
  for (let k = 0; k < 50_000 && !m.terminou(); k++) {
    for (const o of m.estado().historico) if (o.tipo === 'carta') vistas.add(o.carta!);
    m.andar();
  }
  assert.ok(m.terminou(), 'a partida acabou');
  const e = m.estado();
  assert.equal(e.casas.length, 40);
  for (const j of e.jogadores) assert.ok(j.pos >= 0 && j.pos < 40);
  assert.ok(vistas.size >= 10, `notícias vistas: ${vistas.size}`);
});
