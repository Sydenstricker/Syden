/**
 * A Horta em cascata (web/src/blocos/sim.ts): a regra é uma só, e o servidor refaz a partida com a CÓPIA dela
 * (server/src/blocos-sim.ts). Aqui se confere que as duas cópias são iguais, e a regra em si: o trio, a cadeia, o combo,
 * os caixotes, o topo e o piloto automático do teste de tela.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { registrarEntrada } from '../src/blocos/entrada.ts';
import { escolherJogada } from '../src/blocos/piloto.ts';
import * as Sim from '../src/blocos/sim.ts';

/** Um tabuleiro de mão: as linhas de baixo, em letras ('.' vazio, '0' a '5', 'x' caixote). */
function montar(linhas: string[]): Sim.Estado {
  const e = Sim.criar(7);
  e.tipo.fill(Sim.VAZIO);
  const base = Sim.LINHAS - linhas.length;
  linhas.forEach((linha, l) => {
    for (let c = 0; c < Sim.COLUNAS; c++) {
      const ch = linha[c];
      e.tipo[(base + l) * Sim.COLUNAS + c] = ch === '.' ? Sim.VAZIO : ch === 'x' ? Sim.CAIXA : Number(ch);
    }
  });
  // a linha que vem por baixo, longe de formar trio
  e.proxima = [5, 4, 5, 4, 5, 4];
  return e;
}
const linha = (e: Sim.Estado, l: number) => Sim.retrato(e).slice(l * 6, l * 6 + 6);
const andar = (e: Sim.Estado, n: number, ao?: (r: Sim.ResultadoDoPasso) => void) => {
  for (let i = 0; i < n; i++) {
    const r = Sim.passo(e);
    ao?.(r);
  }
};

test('as duas cópias da simulação (a do site e a do servidor) são iguais, byte a byte', () => {
  const site = readFileSync(new URL('../src/blocos/sim.ts', import.meta.url));
  const servidor = readFileSync(new URL('../../server/src/blocos-sim.ts', import.meta.url));
  assert.ok(site.equals(servidor), 'web/src/blocos/sim.ts e server/src/blocos-sim.ts mudaram separados: copie uma sobre a outra');
});

test('a mesma semente dá a mesma pilha, sem trio pronto, e outra semente dá outra', () => {
  const a = Sim.criar(42);
  const b = Sim.criar(42);
  assert.equal(Sim.retrato(a), Sim.retrato(b));
  assert.deepEqual(a.proxima, b.proxima);
  assert.notEqual(Sim.retrato(Sim.criar(43)), Sim.retrato(a));
  for (let semente = 1; semente < 60; semente++) {
    const e = Sim.criar(semente);
    let combos = 0;
    andar(e, 1, (r) => (combos += r.combo));
    assert.equal(combos, 0, `a semente ${semente} nasceu com trio`);
  }
});

test('trocar e fazer três iguais: somem, e o que está em cima cai', () => {
  const n = Sim.LINHAS - 1;
  // 0 0 . 0 com um 2 em cima do último: o 0 vai para o buraco (troca com a casa vazia), e os três somem
  const e = montar(['...2..', '00.0..']);
  const r = Sim.passo(e, [[0, 0, n, 2]]);
  assert.equal(r.combo, 3);
  assert.equal(r.cadeia, 0);
  assert.deepEqual(r.ataques, []);
  assert.equal(e.pontos, 30);
  andar(e, Sim.LIMPAR_PASSOS + Sim.FLUTUAR_PASSOS + 4);
  assert.equal(linha(e, n), '...2..', 'o 2 que estava em cima do 0 caiu até o chão');
  // a troca com caixote não vale, nem a de duas casas vazias
  const g = montar(['......', 'x1....']);
  assert.equal(Sim.podeTrocar(g, n, 0), false);
  assert.equal(Sim.podeTrocar(g, n, 3), false);
  assert.equal(Sim.podeTrocar(g, n, 1), true);
});

test('a cadeia: o que cai e combina vale mais, e manda uma linha de caixote', () => {
  // embaixo, três 0 somem; o 1 de cima cai ao lado de dois 1 e combina sozinho
  const e = montar(['.231..', '400011']);
  const resultados: Sim.ResultadoDoPasso[] = [];
  andar(e, 120, (r) => r.combo && resultados.push(r));
  assert.equal(resultados.length, 2);
  assert.deepEqual([resultados[0].combo, resultados[0].cadeia], [3, 0]);
  assert.deepEqual([resultados[1].combo, resultados[1].cadeia], [3, 2]);
  assert.deepEqual(resultados[1].ataques, [{ largura: 6, altura: 1 }]);
  assert.equal(e.pontos, 30 + 30 + Sim.bonusDaCadeia(2));
  assert.equal(e.maiorCadeia, 2);
});

test('o combo: quatro ou mais de uma vez mandam um caixote mais estreito', () => {
  assert.deepEqual(Sim.ataquesDe(3, 0), []);
  assert.deepEqual(Sim.ataquesDe(4, 0), [{ largura: 3, altura: 1 }]);
  assert.deepEqual(Sim.ataquesDe(7, 0), [{ largura: 6, altura: 1 }]);
  assert.deepEqual(Sim.ataquesDe(3, 3), [{ largura: 6, altura: 2 }]);
  assert.deepEqual(Sim.ataquesDe(5, 9), [{ largura: 6, altura: Sim.MAX_ALTURA_DO_LIXO }, { largura: 4, altura: 1 }]);
  // o combo certo, montado já pronto: a coluna 0 com três 2 e a linha de baixo com mais dois
  const g = montar(['2.....', '2.....', '2223..']);
  let comboG = 0;
  let ataques: Sim.Ataque[] = [];
  andar(g, 1, (r) => {
    comboG = r.combo;
    ataques = r.ataques;
  });
  assert.equal(comboG, 5);
  assert.deepEqual(ataques, [{ largura: 4, altura: 1 }]);
  assert.equal(g.pontos, 50 + Sim.bonusDoCombo(5));
});

test('os caixotes: entram no alto, caem como uma linha só, e viram legume quando algo some do lado', () => {
  const n = Sim.LINHAS - 1;
  const e = montar(['001023']);
  Sim.passo(e, [], [{ id: 1, n: 0, largura: 6, altura: 1 }]);
  andar(e, 60);
  assert.equal(linha(e, n - 1), 'xxxxxx', 'a linha de caixote desceu inteira');
  // 0 0 1 0 → trocar (11,2)-(11,3) dá 0 0 0 1: some, e o caixote encostado vira legume
  Sim.passo(e, [[e.passo, 0, n, 2]]);
  andar(e, 1);
  assert.ok(e.estado.slice((n - 1) * 6, n * 6).every((s) => s === Sim.VIRANDO), 'a linha inteira de caixote começou a virar');
  andar(e, Sim.VIRAR_PASSOS + 40);
  assert.ok(!Sim.retrato(e).includes('x'), 'nenhum caixote sobrou');
  // um caixote estreito de 3, o segundo vai para o outro lado
  const f = montar(['012345']);
  Sim.passo(f, [], [
    { id: 1, n: 0, largura: 3, altura: 1 },
    { id: 2, n: 0, largura: 3, altura: 1 },
  ]);
  andar(f, 80);
  assert.equal(linha(f, n - 1), 'xxxxxx');
});

test('sem jogar, a pilha sobe e chega ao topo; no contra o relógio, acaba no tempo', () => {
  const s = Sim.simulacao(5);
  Sim.avancar(s, 1_000_000);
  assert.equal(s.e.fim, 'topo');
  assert.ok(s.e.passo > 20 * 60 && s.e.passo < 60 * 60, `aguentou ${s.e.passo} passos`);
  const t = Sim.simulacao(5, 100);
  Sim.avancar(t, 1_000_000);
  assert.equal(t.e.fim, 'tempo');
  assert.equal(t.e.passo, 100);
  // o "subir" faz a linha entrar logo
  const u = Sim.criar(5);
  const antes = u.linhasGeradas;
  Sim.passo(u, [[0, 1, 0, 0]]);
  andar(u, Sim.UNIDADES_POR_LINHA + 2);
  assert.equal(u.linhasGeradas, antes + 1);
});

test('as jogadas: o formato e o ritmo de uma mão', () => {
  assert.equal(Sim.jogadaValida([0, 0, 11, 4]), true);
  assert.equal(Sim.jogadaValida([0, 0, 11, 5]), false, 'não há casa à direita da última coluna');
  assert.equal(Sim.jogadaValida([0, 2, 0, 0]), false);
  assert.equal(Sim.jogadaValida([1.5, 0, 0, 0]), false);
  assert.equal(Sim.jogadaValida([-1, 0, 0, 0]), false);
  assert.equal(Sim.jogadaValida('0,0,0,0'), false);
  const jogadas: Sim.Jogada[] = [];
  for (let n = 0; n < 30; n++) if (Sim.cabeNoRitmo(jogadas, n)) jogadas.push([n, 0, 11, 0]);
  assert.equal(jogadas.length, Sim.MAX_JOGADAS_POR_SEGUNDO);
  assert.equal(Sim.cabeNoRitmo(jogadas, 60 + 0), true, 'um segundo depois, cabe de novo');
});

test('o piloto automático faz pontos, e a partida refeita com as mesmas jogadas é a mesma', () => {
  for (const semente of [3, 99]) {
    const s = Sim.simulacao(semente);
    while (!s.e.fim && s.e.passo < 60 * 300) {
      const n = s.e.passo;
      if (n % 8 === 0) {
        const j = escolherJogada(s.e);
        if (j && Sim.cabeNoRitmo(s.jogadas, n)) s.jogadas.push(j.tipo === 'subir' ? [n, 1, 0, 0] : [n, 0, j.l, j.c]);
      }
      if (n === 1500) s.lixos.push({ id: 1, n: 1500, largura: 6, altura: 2 });
      Sim.avancar(s, n + 1);
    }
    assert.ok(s.e.pontos > 300, `o piloto fez ${s.e.pontos}`);
    const r = Sim.simulacao(semente);
    r.jogadas = s.jogadas.slice();
    r.lixos = s.lixos.slice();
    Sim.avancar(r, 1e9);
    assert.deepEqual([r.e.passo, r.e.pontos, Sim.retrato(r.e)], [s.e.passo, s.e.pontos, Sim.retrato(s.e)]);
  }
});

test('as trocas: no mínimo 4 passos entre uma e outra, e a que chega antes espera a vez em vez de sumir', () => {
  assert.equal(Sim.trocaNoIntervalo([[10, 0, 11, 0]], 13), false);
  assert.equal(Sim.trocaNoIntervalo([[10, 0, 11, 0]], 14), true);
  assert.equal(Sim.trocaNoIntervalo([[10, 0, 11, 0], [12, 1, 0, 0]], 13), false, 'o "subir" no meio não conta');
  assert.equal(Sim.trocaNoIntervalo([[12, 1, 0, 0]], 12), true);
  const s = Sim.simulacao(3);
  assert.equal(registrarEntrada(s, { tipo: 'troca', l: 11, c: 0 }, 0), true);
  assert.equal(registrarEntrada(s, { tipo: 'troca', l: 11, c: 1 }, 1), false, 'cedo demais: fica na fila');
  assert.equal(registrarEntrada(s, { tipo: 'troca', l: 11, c: 1 }, 4), true);
  assert.deepEqual(s.jogadas, [
    [0, 0, 11, 0],
    [4, 0, 11, 1],
  ]);
});

test('segurar o "subir" não enche o ritmo: ele só é gravado quando faz efeito, e as trocas sempre têm lugar', () => {
  const s = Sim.simulacao(5);
  const trocas: number[] = [];
  // o X segurado a partida inteira, e uma troca pedida a cada passo (mais que qualquer mão)
  for (let n = 0; n < 1200 && !s.e.fim; n++) {
    registrarEntrada(s, { tipo: 'subir' }, n);
    const antes = s.jogadas.length;
    for (let c = 0; c < Sim.COLUNAS - 1; c++) if (registrarEntrada(s, { tipo: 'troca', l: Sim.LINHAS - 1, c }, n) && s.jogadas.length > antes) break;
    if (s.jogadas.length > antes && s.jogadas[s.jogadas.length - 1][1] === 0) trocas.push(n);
    Sim.avancar(s, n + 1);
  }
  // nenhuma janela de 1 s passa do ritmo que o servidor aceita
  for (let i = 0; i < s.jogadas.length; i++) assert.ok(Sim.cabeNoRitmo(s.jogadas.slice(0, i), s.jogadas[i][0]), `a jogada ${i} cabe no ritmo`);
  // e o "subir" não foi gravado passo a passo enquanto não podia fazer nada
  const subidas = s.jogadas.filter((j) => j[1] === 1).length;
  assert.ok(subidas < s.e.passo / 8, `${subidas} "subir" em ${s.e.passo} passos`);
});

// ---------------- A revisão independente de 03/11/2026 ----------------

test('o servidor recusou um lote: as trocas feitas enquanto ele ia continuam, depois da lista aceita, e esperam envio', async () => {
  const { acertarComOServidor } = await import('../src/blocos/acerto.ts');
  // aceitas antes: [10]; o lote em voo levou [20] e [30] (o 30 foi recusado); depois dele, aqui, [40] e [44]
  const local = {
    jogadas: [[10, 0, 5, 1], [20, 0, 5, 2], [30, 0, 5, 3], [40, 0, 6, 1], [44, 0, 6, 2]] as Sim.Jogada[],
    enviadasIdx: 1,
    deBase: 1,
    versao: 0,
    pronto: true,
  };
  const meu = { recebidas: 3, versao: 1, passo: 35, jogadas: [[10, 0, 5, 1], [20, 0, 5, 2]] as Sim.Jogada[] };
  const r = acertarComOServidor(local, meu);
  assert.ok(r.refazer);
  assert.equal(r.recusada, true, 'a tela diz que uma jogada não valeu');
  assert.deepEqual(r.jogadas.map((j) => j[0]), [10, 20, 40, 44], 'as feitas depois do lote ficam');
  assert.equal(r.enviadasIdx, 2, 'e vão no próximo lote');
  assert.equal(r.deBase, 3);
  // uma troca de antes do passo do servidor não pode mais entrar: ela fica de fora, e não as outras
  const r2 = acertarComOServidor({ ...local, jogadas: [...local.jogadas.slice(0, 3), [33, 0, 6, 1], [40, 0, 6, 2]] }, meu);
  assert.deepEqual(r2.jogadas.map((j) => j[0]), [10, 20, 40]);
  // sem recusa, só anda o que o servidor já leu
  const r3 = acertarComOServidor(local, { recebidas: 3, versao: 0, passo: 35, jogadas: null });
  assert.deepEqual([r3.refazer, r3.enviadasIdx, r3.deBase, r3.recusada], [false, 3, 3, false]);
  // o painel aberto de novo (ainda sem a lista): pega a do servidor, sem dizer que algo não valeu
  const r4 = acertarComOServidor({ jogadas: [], enviadasIdx: 0, deBase: 0, versao: 0, pronto: false }, meu);
  assert.deepEqual([r4.refazer, r4.recusada, r4.jogadas.length, r4.enviadasIdx], [true, false, 2, 2]);
});

test('a sincronia do painel aberto de novo é pedida uma vez só (o efeito duplo do modo estrito não a pede de novo)', async () => {
  const { pedirSincroniaUmaVez } = await import('../src/blocos/acerto.ts');
  const g = { pediuSincronia: false };
  let pedidos = 0;
  pedirSincroniaUmaVez(g, () => pedidos++);
  pedirSincroniaUmaVez(g, () => pedidos++);
  assert.equal(pedidos, 1);
});

test('fora da partida no servidor: a tela para, e diz se foi o topo ou a saída da sala', async () => {
  const { foraDoJogo } = await import('../src/blocos/acerto.ts');
  const jogadores = [{ userId: 1, saiu: true }, { userId: 2, saiu: false }];
  assert.equal(foraDoJogo({ meu: { fim: false }, jogadores }, 2), null);
  assert.equal(foraDoJogo({ meu: { fim: true }, jogadores }, 1), 'saiu');
  assert.equal(foraDoJogo({ meu: { fim: true }, jogadores }, 2), 'topo');
  assert.equal(foraDoJogo({ meu: null, jogadores }, 2), null);
});
