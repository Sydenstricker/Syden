/**
 * O quiz de adivinhar (24/10/2026): a comparação das colunas, os temas e a corrida, com um contexto de mentira no lugar
 * da sala (o relógio é chamado à mão).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Contexto } from '../src/minijogo-motor.js';
import { _testeQuiz, bandeiraDaFicha, catalogo, comparar, criarQuiz, distanciaERumo, nomeDoItem, pontosDoQuiz, RODADAS_QUIZ, TEMAS } from '../src/minijogo-quiz.js';

test('Quiz: cada tipo de coluna compara do seu jeito', () => {
  assert.deepEqual(comparar({ id: 'x', tipo: 'igual' }, 'dragon', 'dragon'), { cor: 2 });
  assert.deepEqual(comparar({ id: 'x', tipo: 'igual' }, 'dragon', 'undead'), { cor: 0 });
  assert.deepEqual(comparar({ id: 'x', tipo: 'ordem' }, 2, 5), { cor: 0, seta: 1 }, 'o secreto tem mais');
  assert.deepEqual(comparar({ id: 'x', tipo: 'ordem' }, 0.25, 0.125), { cor: 0, seta: -1 });
  assert.deepEqual(comparar({ id: 'x', tipo: 'conjunto' }, ['walk', 'fly'], ['fly', 'walk']), { cor: 2 }, 'a ordem não importa');
  assert.deepEqual(comparar({ id: 'x', tipo: 'conjunto' }, ['walk', 'fly'], ['walk']), { cor: 1 });
  assert.deepEqual(comparar({ id: 'x', tipo: 'conjunto' }, ['swim'], ['walk']), { cor: 0 });
  assert.deepEqual(comparar({ id: 'x', tipo: 'partes' }, 'lawful evil', 'chaotic evil'), { cor: 1 });
  assert.deepEqual(comparar({ id: 'x', tipo: 'partes' }, 'lawful good', 'chaotic evil'), { cor: 0 });
});

test('Quiz: todo tema tem itens de id único, todas as colunas preenchidas, e o bastante para sortear', () => {
  for (const [id, tema] of Object.entries(TEMAS)) {
    assert.equal(new Set(tema.itens.map((i) => i.id)).size, tema.itens.length, `${id}: id repetido`);
    for (const item of tema.itens) for (const c of tema.colunas) assert.ok(item[c.id] !== undefined, `${id}/${item.id}: sem ${c.id}`);
    // (os estados do Brasil são 27, e saem todos)
    assert.ok(tema.itens.filter(tema.sorteavel ?? (() => true)).length >= (id === 'estados' ? 27 : 30), `${id}: pouco para sortear`);
  }
  assert.ok(TEMAS.monstros.itens.length >= 250);
  assert.ok(TEMAS.mitologia.itens.length >= 100);
  // A mitologia: a mesma é verde, outra do mesmo continente é amarela.
  const coluna = { id: 'mitologia', tipo: 'partes' } as const;
  assert.equal(comparar(coluna, 'grega europa', 'nordica europa').cor, 1);
  assert.equal(comparar(coluna, 'grega europa', 'egipcia africa').cor, 0);
});

test('Quiz: a categoria da mitologia vale para o sorteio e para a lista de chutes', () => {
  const americas = catalogo(TEMAS.mitologia, 'pt-BR', 'americas');
  assert.ok(americas.length >= 10 && americas.length < 30, String(americas.length));
  assert.ok(americas.some((f) => f.nome === 'Tupã') && !americas.some((f) => f.nome === 'Zeus'));
  assert.equal(catalogo(TEMAS.mitologia, 'pt-BR', 'nao-existe').length, TEMAS.mitologia.itens.length, 'sem categoria válida: tudo');
  const s = sala([1]);
  const jogo = criarQuiz(TEMAS.mitologia).comecar(s.ctx, { naSala: [1], criadaPor: 1, corpo: { categoria: 'americas' } });
  assert.ok(typeof jogo !== 'string');
  assert.equal(jogo.publico(1).categoria, 'americas');
  assert.equal(jogo.acao(1, { tipo: 'chute', id: 'Q34201' }), 'Escolha um da lista.', 'Zeus não está nas Américas');
  assert.equal(jogo.acao(1, { tipo: 'chute', id: 'Q7853613' }), null, 'Tupã está');
  for (let r = 0; r < RODADAS_QUIZ; r++) {
    const visto = jogo.publico(1) as { resposta: { id: string } | null };
    s.disparar(); // a rodada acaba (ou a revelação passa)
    if (visto.resposta) assert.ok(americas.some((f) => f.id === visto.resposta!.id), 'o secreto é das Américas');
  }
});

test('Quiz: a distância e o rumo do Worldle', () => {
  // De Brasília a Lisboa: uns 7.300 km, para nordeste.
  const { km, rumo } = distanciaERumo([-15.8, -47.9], [38.7, -9.1]);
  assert.ok(km > 7000 && km < 7600, String(km));
  assert.ok(rumo > 20 && rumo < 60, String(rumo));
  assert.equal(distanciaERumo([0, 10], [0, 20]).rumo, 90, 'pelo equador, para leste');
  const paises = new Map(TEMAS.paises.itens.map((p) => [p.id, p]));
  const coluna = { id: 'local', tipo: 'distancia' } as const;
  assert.deepEqual(comparar(coluna, paises.get('BR')!.local, paises.get('BR')!.local), { cor: 2, km: 0 });
  assert.equal(comparar(coluna, paises.get('AR')!.local, paises.get('UY')!.local).cor, 1, 'vizinho é amarelo');
  assert.equal(comparar(coluna, paises.get('JP')!.local, paises.get('BR')!.local).cor, 0);
  assert.equal(TEMAS.paises.itens.length, 193);
});

test('Quiz: o nome do item na língua de quem lê, com reserva', () => {
  const item = { id: 'x', nome: { en: 'Zeus', 'pt-BR': 'Zeus', el: 'Δίας' } };
  assert.equal(nomeDoItem(item, 'el'), 'Δίας');
  assert.equal(nomeDoItem(item, 'el-GR'), 'Δίας');
  assert.equal(nomeDoItem(item, 'ja'), 'Zeus', 'sem a língua, o inglês');
  assert.deepEqual(catalogo(TEMAS.monstros, 'ja')[0], { id: 'aboleth', nome: 'Aboleth' }, 'o catálogo não leva as colunas');
  const brasil = (idioma: string) => catalogo(TEMAS.paises, idioma).find((p) => p.id === 'BR')!.nome;
  assert.equal(brasil('pt-BR'), 'Brasil');
  assert.equal(brasil('de'), 'Brasilien');
  assert.equal(brasil('xx-nao-existe'), 'Brazil', 'idioma que o Intl não conhece: o inglês');
  const xango = (idioma: string) => catalogo(TEMAS.mitologia, idioma).find((p) => p.id === 'Q1547934')!.nome;
  assert.equal(xango('pt-BR'), 'Xangô', 'os nomes da mitologia vêm do Wikidata, por idioma');
  assert.equal(xango('en'), 'Shango');
});

function sala(ids: number[]) {
  let relogio: (() => void) | null = null;
  let terminou = false;
  const ctx: Contexto = {
    agendar: (_ms, depois) => void (relogio = depois),
    avisar: () => {},
    terminar: () => void (terminou = true),
    naSala: () => ids,
    nome: (id) => `p${id}`,
  };
  return { ctx, disparar: () => relogio?.(), terminou: () => terminou };
}

test('Quiz: a corrida — os outros veem as cores, nunca os chutes, até a revelação', () => {
  _testeQuiz.itens = ['adult-red-dragon', 'aboleth', 'lich'];
  const s = sala([1, 2]);
  const jogo = criarQuiz(TEMAS.monstros).comecar(s.ctx, { naSala: [1, 2], criadaPor: 1, corpo: {} });
  _testeQuiz.itens = null;
  assert.ok(typeof jogo !== 'string');
  type Visto = {
    rodada: number;
    fase: string;
    acertei: boolean;
    resposta: { id: string } | null;
    meu: { id: string; vereditos: { cor: number; seta?: number }[]; valores: Record<string, unknown> }[];
    outros: { userId: number; cores: number[][]; chutes: string[] | null }[];
    placar: { userId: number; pontos: number }[];
  };
  const ver = (quem: number) => jogo.publico(quem) as Visto;

  assert.equal(jogo.acao(1, { tipo: 'chute', id: 'nao-existe' }), 'Escolha um da lista.');
  assert.equal(jogo.acao(1, { tipo: 'chute', id: 'adult-blue-dragon' }), null);
  assert.equal(jogo.acao(1, { tipo: 'chute', id: 'adult-blue-dragon' }), 'Você já chutou esse.');
  const azul = ver(1).meu[0];
  // Azul adulto contra vermelho adulto: mesmo tipo e tamanho, nível 16 contra 17, "leal e mau" contra "caótico e mau".
  assert.deepEqual(
    azul.vereditos.map((v) => v.cor),
    [2, 2, 0, 1, 1],
  );
  assert.equal(azul.vereditos[2].seta, 1, 'o vermelho tem nível maior');
  assert.equal(azul.valores.tipo, 'dragon');
  assert.equal(ver(2).outros.find((o) => o.userId === 1)!.chutes, null, 'o chute dos outros fica escondido');
  assert.equal(ver(2).resposta, null);

  assert.equal(jogo.acao(1, { tipo: 'chute', id: 'adult-red-dragon' }), null);
  assert.ok(ver(1).acertei);
  assert.equal(ver(1).fase, 'chutando', 'o 2 ainda não acertou');
  // O placar ao vivo (02/11/2026): o ponto entra na hora do acerto, e a sala o vê com a rodada ainda correndo.
  assert.equal(ver(2).placar.find((l) => l.userId === 1)!.pontos, pontosDoQuiz(2) + 1, 'o ponto entra na hora do acerto');
  assert.equal(jogo.acao(2, { tipo: 'chute', id: 'adult-red-dragon' }), null);
  assert.equal(ver(1).fase, 'revelando', 'todos acertaram: revela na hora');
  assert.equal(ver(2).resposta!.id, 'adult-red-dragon');
  assert.deepEqual(ver(2).outros.find((o) => o.userId === 1)!.chutes, ['adult-blue-dragon', 'adult-red-dragon']);
  assert.equal(ver(1).placar.find((l) => l.userId === 1)!.pontos, pontosDoQuiz(2) + 1, 'o primeiro a acertar ganha +1');
  assert.equal(ver(1).placar.find((l) => l.userId === 2)!.pontos, pontosDoQuiz(1));

  for (let r = 2; r <= RODADAS_QUIZ; r++) {
    s.disparar(); // a rodada seguinte
    assert.equal(ver(1).rodada, r);
    assert.equal(ver(1).meu.length, 0);
    s.disparar(); // o tempo da rodada acaba sem ninguém acertar
    assert.equal(ver(1).fase, 'revelando');
  }
  s.disparar();
  assert.ok(s.terminou());
});

test('Quiz: as colunas novas da mitologia — o gênero da figura e a família na lista (Wikidata)', () => {
  const porNome = new Map(TEMAS.mitologia.itens.map((f) => [nomeDoItem(f, 'en'), f]));
  const f = (nome: string) => porNome.get(nome)!;
  assert.equal(f('Zeus').genero, 'masculino');
  assert.equal(f('Hera').genero, 'feminino');
  assert.equal(f('Boitatá').genero, '', 'bicho sem gênero dito: vazio, e a tela mostra "—"');
  for (const figura of TEMAS.mitologia.itens) {
    assert.ok(['masculino', 'feminino', 'varia', ''].includes(String(figura.genero)), `${figura.id}: gênero ${figura.genero}`);
    const familia = figura.familia as string[];
    assert.equal(familia[0], figura.id, `${figura.id}: a família começa pela própria figura`);
    // nos dois sentidos: se A tem B na família, B tem A
    for (const outro of familia.slice(1)) assert.ok((TEMAS.mitologia.itens.find((i) => i.id === outro)!.familia as string[]).includes(figura.id));
  }
  const coluna = { id: 'familia', tipo: 'parentes' } as const;
  assert.equal(comparar(coluna, f('Zeus').familia, f('Zeus').familia).cor, 2);
  assert.equal(comparar(coluna, f('Hera').familia, f('Zeus').familia).cor, 1, 'parente do secreto: amarelo');
  assert.equal(comparar(coluna, f('Brigid').familia, f('The Dagda').familia).cor, 1, 'a mesma família de dois não dá verde');
  assert.equal(comparar(coluna, f('Achilles').familia, f('Zeus').familia).cor, 0, 'sem parente na lista: vermelho');
});

test('Quiz: o modo Bandeira dos países — a ficha por rodada, o SVG sem o código, e a categoria', () => {
  assert.equal(catalogo(TEMAS.paises, 'pt-BR', 'bandeira').length, 193, 'todos os países têm bandeira');
  _testeQuiz.itens = ['BR', 'JP', 'AR'];
  const s = sala([1]);
  const jogo = criarQuiz(TEMAS.paises).comecar(s.ctx, { naSala: [1], criadaPor: 1, corpo: { categoria: 'bandeira' } });
  const classico = criarQuiz(TEMAS.paises).comecar(sala([1]).ctx, { naSala: [1], criadaPor: 1, corpo: {} });
  _testeQuiz.itens = null;
  assert.ok(typeof jogo !== 'string' && typeof classico !== 'string');
  assert.equal((classico.publico(1) as { bandeira: unknown }).bandeira, null, 'no clássico não há bandeira');
  const visto = jogo.publico(1) as { categoria: string; bandeira: string };
  assert.equal(visto.categoria, 'bandeira');
  assert.match(visto.bandeira, /^[0-9a-f]{32}$/, 'a ficha é sorteada, nunca o código do país');
  const svg = bandeiraDaFicha(visto.bandeira)!;
  assert.ok(svg.startsWith('<svg'));
  assert.ok(!/flag-icons|[\s"'#.(]br-/i.test(svg), 'o SVG não diz o país');
  assert.equal(bandeiraDaFicha('0'.repeat(32)), null);
  // a próxima rodada tem outra ficha, com outra bandeira
  assert.equal(jogo.acao(1, { tipo: 'chute', id: 'BR' }), null);
  s.disparar();
  const segunda = (jogo.publico(1) as { bandeira: string }).bandeira;
  assert.notEqual(segunda, visto.bandeira);
  assert.notEqual(bandeiraDaFicha(segunda), svg);
});

test('Quiz, os temas do lote D (21/11/2026): elementos, dinossauros, estados do Brasil e animais', () => {
  const { elementos, dinossauros, estados, animais } = TEMAS;
  assert.equal(elementos.itens.length, 118);
  assert.equal(estados.itens.length, 27);
  assert.ok(dinossauros.itens.length >= 60 && animais.itens.length >= 80);
  // os nomes vêm do Wikidata, por idioma; o do elemento leva o símbolo
  const nome = (tema: typeof elementos, id: string, idioma = 'pt-BR') => catalogo(tema, idioma).find((i) => i.id === id)!.nome;
  assert.equal(nome(elementos, 'Fe'), 'Ferro (Fe)');
  assert.equal(nome(elementos, 'Fe', 'en'), 'Iron (Fe)');
  assert.equal(nome(estados, 'SP'), 'São Paulo');
  assert.equal(nome(dinossauros, 'Q14332'), 'Tiranossauro');
  assert.equal(nome(animais, 'Q140'), 'Leão');
  // o bicho sai pelo nome comum, e não pelo científico do rótulo do Wikidata ("Acinonyx jubatus")
  assert.equal(nome(animais, 'Q23907'), 'Guepardo');
  assert.equal(nome(animais, 'Q1126155'), 'Peixe-palhaço');
  assert.equal(nome(animais, 'Q1126155', 'en'), 'Common clownfish');
  // a tabela periódica: o ferro no período 4, grupo 8; o mercúrio e o bromo líquidos; os sintéticos depois do 94 não saem
  const fe = elementos.itens.find((e) => e.id === 'Fe')!;
  assert.deepEqual([fe.periodo, fe.grupo, fe.familia, fe.estado, fe.numero], [4, 8, 'transicao', 'solido', 26]);
  assert.deepEqual(elementos.itens.filter((e) => e.estado === 'liquido').map((e) => e.id).sort(), ['Br', 'Hg']);
  assert.ok(!elementos.sorteavel!(elementos.itens.find((e) => e.id === 'Og')!) && elementos.sorteavel!(fe));
  // os dinossauros raros são só chute
  const raros = dinossauros.itens.filter((d) => d.raro);
  assert.ok(raros.length > 0 && raros.every((d) => !dinossauros.sorteavel!(d)));
  // nos estados, o amarelo da distância é o vizinho (até 900 km), não os 1500 km dos países
  const local = estados.colunas.find((c) => c.id === 'local')!;
  const ponto = (id: string) => estados.itens.find((e) => e.id === id)!.local;
  assert.equal(comparar(local, ponto('RJ'), ponto('SP')).cor, 1, 'RJ e SP são vizinhos');
  assert.equal(comparar(local, ponto('RS'), ponto('BA')).cor, 0);
  assert.equal(comparar(local, ponto('AM'), ponto('PA')).cor, 0);
  assert.equal(comparar({ id: 'local', tipo: 'distancia' }, ponto('AM'), ponto('PA')).cor, 1, 'nos países seria amarelo');
});

test('Quiz, os temas do lote D: uma partida inteira em cada um, com a resposta certa no primeiro chute', () => {
  for (const id of ['elementos', 'dinossauros', 'estados', 'animais']) {
    const tema = TEMAS[id];
    const secreto = tema.itens.filter(tema.sorteavel ?? (() => true))[0];
    _testeQuiz.itens = [secreto.id];
    let relogio: (() => void) | null = null;
    const ctx = { agendar: (_ms: number, f: () => void) => void (relogio = f), avisar: () => {}, terminar: () => {}, naSala: () => [1], nome: () => 'p1' } as unknown as Contexto;
    const jogo = criarQuiz(tema).comecar(ctx, { naSala: [1], criadaPor: 1, corpo: { rodadas: 1 } });
    _testeQuiz.itens = null;
    assert.ok(typeof jogo !== 'string', id);
    assert.equal(jogo.acao(1, { tipo: 'chute', id: secreto.id }), null);
    const visto = jogo.publico(1) as { fase: string; meu: { vereditos: { cor: number }[] }[] };
    assert.equal(visto.fase, 'revelando', id);
    assert.ok(visto.meu[0].vereditos.every((v) => v.cor === 2), `${id}: tudo verde`);
    assert.ok(relogio);
  }
});
