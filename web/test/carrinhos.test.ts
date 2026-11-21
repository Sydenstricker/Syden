import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import * as sim from '../src/carrinhos/sim.ts';
import { criarRobo } from '../src/carrinhos/robo.ts';

/** Os Carrinhos da toca: a regra (carrinhos/sim.ts), que é a mesma do servidor, as pistas, o editor e os robôs. */

const correr = (faixa: number, piloto: (c: sim.Carro) => number, pista = sim.PISTA_PADRAO, voltas = sim.VOLTAS) => {
  const c = sim.novoCarro(faixa, pista, voltas);
  while (!c.chegou && c.passo < sim.PASSOS_MAXIMOS) sim.passo(c, piloto(c));
  return c;
};

test('a regra é o MESMO arquivo no site e no servidor, byte a byte', () => {
  const site = readFileSync(new URL('../src/carrinhos/sim.ts', import.meta.url));
  const servidor = readFileSync(new URL('../../server/src/carrinhos-sim.ts', import.meta.url));
  assert.ok(site.equals(servidor), 'mexeu num, copie no outro');
});

test('a Toca de sempre não mudou: a mesma volta de antes (os recordes e os fantasmas de antes continuam valendo)', () => {
  assert.equal(sim.PISTA_PADRAO.id, 'toca-1');
  assert.equal(sim.PISTA_PADRAO.tracado, 'RRRR+RR++-R-++RR+');
  // a volta de cada faixa, somada como antes: 9 retas e 8 curvas
  sim.PISTA_PADRAO.volta.forEach((v, f) => {
    const raios = sim.PISTA_PADRAO.trechos[f].filter((t) => t.sentido !== 0).map((t) => t.raio);
    assert.equal(raios.length, 8);
    assert.ok(Math.abs(v - (36 + raios.reduce((a, r) => a + 1.5707963267948966 * r, 0))) < 1e-9);
  });
});

for (const id of sim.IDS_DAS_PISTAS) {
  const pista = sim.PISTAS[id];
  test(`a pista "${id}" fecha a volta, passa na conferência do editor, e as fileiras se encaixam`, () => {
    assert.equal(pista.fechamento, 0, 'a volta fecha');
    assert.ok('pista' in sim.validarTracado(pista.tracado), 'as prontas passam pelas mesmas regras do editor');
    assert.equal(pista.pecas.length, pista.tracado.length * 2);
    for (const p of pista.pecas) {
      if (p.tipo !== 'pequena' && p.tipo !== 'grande') continue;
      assert.equal(p.tipo === 'pequena', p.sentido === p.fileira, 'a de dentro é a pequena');
    }
    // cada faixa: os trechos emendam (o fim de um é o começo do outro), também no cruzamento
    pista.trechos.forEach((lista, f) => {
      for (let i = 1; i < lista.length; i++) {
        const fim = sim.poseNaFaixa(pista, f, lista[i].inicio - 1e-9);
        assert.ok(Math.hypot(fim.x - lista[i].x, fim.z - lista[i].z) < 1e-6, `faixa ${f}, trecho ${i}`);
      }
      // e a volta acaba onde começou
      const ultimo = sim.poseNaFaixa(pista, f, pista.volta[f] - 1e-9);
      assert.ok(Math.hypot(ultimo.x - lista[0].x, ultimo.z - lista[0].z) < 1e-6, `faixa ${f}: a volta fecha na faixa`);
    });
  });

  test(`a pista "${id}": o piloto automático fecha 5 e 20 voltas sem sair, e nenhuma faixa leva vantagem (1%)`, () => {
    for (const voltas of [sim.VOLTAS, sim.VOLTAS_DA_RESISTENCIA]) {
      const tempos = [0, 1, 2, 3].map((f) => {
        const c = correr(f, (k) => sim.pilotoAutomatico(k, 0.15), pista, voltas);
        assert.ok(c.chegou);
        assert.equal(c.voltas.length, voltas);
        assert.equal(c.saidas, 0, `faixa ${f}`);
        return c.voltas[voltas - 1];
      });
      assert.ok((Math.max(...tempos) - Math.min(...tempos)) / Math.min(...tempos) < 0.01, `${voltas} voltas: ${tempos}`);
    }
  });
}

test('o cruzamento troca as faixas de lado: a de dentro das curvas "+" passa a ser a de fora', () => {
  const pista = sim.PISTAS['troca-1'];
  assert.ok(pista.tracado.includes('X'));
  const raios = pista.trechos[0].filter((t) => t.sentido === 1).map((t) => t.raio);
  assert.ok(raios.includes(1.5) && raios.includes(4.5), 'a faixa 0 corre curvas "+" por dentro e por fora');
  const cruz = pista.trechos[0].find((t) => t.ladoX || t.ladoZ)!;
  assert.equal(cruz.comprimento, sim.COMPRIMENTO_DA_RETA, 'o mesmo comprimento em todas as faixas');
  assert.equal(Math.hypot(cruz.ladoX, cruz.ladoZ), 3, 'a faixa 0 vai de 1,5 a −1,5');
});

test('o editor: recusa o que não fecha, o que se cruza, o curto e os cruzamentos ímpares; o código vai e volta', () => {
  assert.deepEqual(sim.validarTracado('RRRR+RR'), { erro: 'nao-fecha' });
  assert.deepEqual(sim.validarTracado('RR'), { erro: 'pecas' });
  assert.deepEqual(sim.validarTracado('R++R++'), { erro: 'curta' });
  assert.deepEqual(sim.validarTracado('RRXRR++RRRRR++'), { erro: 'impar' });
  // fecham (no mesmo lugar e no mesmo rumo), mas passam por cima da própria pista
  assert.deepEqual(sim.validarTracado('RRR+R+R+R++R+RRR+R+R'), { erro: 'cruza' });
  assert.deepEqual(sim.validarTracado('R+R++R+--R--'), { erro: 'cruza' });
  // um oval é uma pista de editor que vale
  const oval = 'RRRRR++RRRRR++';
  const ok = sim.validarTracado(oval);
  assert.ok('pista' in ok && ok.pista.id.startsWith('p-'));
  // o código: ida e volta, com a largada levada para a primeira reta e o que não é peça recusado
  assert.equal(sim.lerCodigoDaPista(sim.codigoDaPista(oval)), oval);
  assert.equal(sim.lerCodigoDaPista('sydp1-++RRRRR++RRRRR'), oval, 'minúsculas e a largada na primeira reta');
  assert.equal(sim.lerCodigoDaPista('SYDP1-RRQ'), null);
  assert.equal(sim.lerCodigoDaPista('SYDL1-abc'), null, 'o código do layout do quarto não é de pista');
  assert.equal(sim.lerCodigoDaPista('SYDP1-' + 'R'.repeat(sim.PECAS_NO_MAXIMO + 1)), null);
  // o pedido: o código de uma pista pronta dá a pronta (o mesmo recorde); um código que não vale, nada
  assert.equal(sim.pistaPedida(undefined, sim.codigoDaPista(sim.TRACADOS['zigue-1'])), sim.PISTAS['zigue-1']);
  assert.equal(sim.pistaPedida(undefined, 'SYDP1-RRRR+RR'), null);
  assert.equal(sim.pistaPedida('nao-existe', undefined), null);
  assert.equal(sim.pistaPedida(undefined, undefined), sim.PISTA_PADRAO);
  // o resumo é sempre o mesmo
  assert.equal(sim.resumoDoTracado(oval), sim.resumoDoTracado(oval));
  assert.notEqual(sim.resumoDoTracado(oval), sim.resumoDoTracado('RRRRRR++RRRRRR++'));
});

test('acelerar ao máximo sai na curva, fica fora 1,75 s e volta piscando, parado, ao lugar de onde saiu', () => {
  const c = sim.novoCarro(sim.FAIXA_DO_RECORDE);
  let ev: sim.Evento = null;
  while (ev !== 'saiu') ev = sim.passo(c, sim.ACELERADOR_MAXIMO);
  const saiu = c.passo, onde = c.s;
  assert.notEqual(sim.trechoEm(c.pista, c.faixa, c.s).sentido, 0, 'na curva');
  while (ev !== 'voltou') ev = sim.passo(c, sim.ACELERADOR_MAXIMO);
  assert.equal(c.passo - saiu, sim.FORA_PASSOS);
  assert.equal(c.s, onde);
  assert.equal(c.v, 0);
  assert.equal(c.pisca, sim.PISCA_PASSOS);
  // e a corrida de acelerador cheio chega, mas bem mais devagar
  const cheio = correr(sim.FAIXA_DO_RECORDE, () => sim.ACELERADOR_MAXIMO);
  const bom = correr(sim.FAIXA_DO_RECORDE, (k) => sim.pilotoAutomatico(k, 0.3));
  assert.ok(cheio.saidas > 10);
  assert.ok(cheio.voltas[sim.VOLTAS - 1] > bom.voltas[sim.VOLTAS - 1] * 1.5);
});

test('determinismo: o gravador e o refazer dão a mesma corrida, e o leitor (o fantasma) também, em qualquer pista', () => {
  for (const pista of [sim.PISTA_PADRAO, sim.PISTAS['troca-1']]) {
    const g = sim.gravador();
    const c = correr(
      2,
      (k) => {
        const a = sim.pilotoAutomatico(k, k.passo % 300 < 150 ? 0.1 : -1.5);
        g.anotar(a);
        return a;
      },
      pista,
    );
    const r = sim.refazer(2, g.entradas, pista);
    assert.deepEqual(r.voltas, c.voltas);
    assert.equal(r.saidas, c.saidas);
    assert.ok(sim.entradasValidas(g.entradas));
    const ler = sim.leitor(g.entradas);
    const f = correr(2, () => ler(), pista);
    assert.deepEqual(f.voltas, c.voltas);
  }
  assert.equal(sim.entradasValidas([1, 9]), false);
  assert.equal(sim.entradasValidas([0, 4]), false);
});

test('os robôs terminam, às vezes saindo da pista, e o melhor é mais rápido que o pior', () => {
  const bom = correr(0, criarRobo(11, 0.95));
  const fraco = correr(3, criarRobo(12, 0.4));
  assert.ok(bom.chegou && fraco.chegou);
  assert.ok(bom.voltas[sim.VOLTAS - 1] < fraco.voltas[sim.VOLTAS - 1]);
  let saidas = 0;
  for (let i = 0; i < 12; i++) saidas += correr(i % 4, criarRobo(100 + i, 0.6), sim.PISTAS[sim.IDS_DAS_PISTAS[i % sim.IDS_DAS_PISTAS.length]]).saidas;
  assert.ok(saidas > 0, 'os robôs erram de vez em quando');
});

test('a dificuldade dos robôs (20/11/2026): o difícil aperta de verdade, o fácil folga, e o médio é o de antes', async () => {
  const { HABILIDADE_DOS_ROBOS } = await import('../src/carrinhos/robo.ts');
  assert.deepEqual(HABILIDADE_DOS_ROBOS.medio, [0.92, 0.8, 0.68], 'o médio é o de antes');
  for (const id of ['toca-1', 'caracol-1']) {
    const pista = sim.PISTAS[id];
    const base = correr(sim.FAIXA_DO_RECORDE, (k) => sim.pilotoAutomatico(k, 0.15), pista).voltas.at(-1)!;
    const media = (d: 'facil' | 'medio' | 'dificil') => {
      let soma = 0, n = 0;
      for (let s = 1; s <= 6; s++) for (const h of HABILIDADE_DOS_ROBOS[d]) {
        soma += correr([0, 2, 3][s % 3], criarRobo(s * 7919, h), pista).voltas.at(-1)!;
        n++;
      }
      return soma / n / base;
    };
    const [f, m, d] = [media('facil'), media('medio'), media('dificil')];
    assert.ok(f > m && m > d, `${id}: ${f.toFixed(3)} > ${m.toFixed(3)} > ${d.toFixed(3)}`);
    assert.ok(d < 1.03, `${id}: o difícil fica a menos de 3% do piloto quase perfeito (${d.toFixed(3)})`);
    assert.ok(f > 1.08, `${id}: o fácil fica bem atrás (${f.toFixed(3)})`);
  }
});

test('as medalhas: só nos traçados prontos, sobre o piloto quase perfeito; o piloto dos testes leva o ouro (20/11/2026)', async () => {
  const { FATORES_DOS_CARRINHOS, tempoDoPilotoNosCarrinhos } = await import('../src/carrinhos/medalhas.ts');
  const { medalhaPelosPassos } = await import('../src/medalhasDaCorrida.ts');
  assert.equal(tempoDoPilotoNosCarrinhos('p-qualquer', sim.VOLTAS), null, 'a pista do editor não tem medalha');
  for (const id of sim.IDS_DAS_PISTAS) {
    const base = tempoDoPilotoNosCarrinhos(id, sim.VOLTAS)!;
    assert.ok(base > 0);
    const piloto = correr(sim.FAIXA_DO_RECORDE, (k) => sim.pilotoAutomatico(k, 0.3), sim.PISTAS[id]).voltas.at(-1)!;
    assert.equal(medalhaPelosPassos(base, piloto, FATORES_DOS_CARRINHOS), 0, `${id}: ${piloto} contra ${base}`);
    const cheio = correr(sim.FAIXA_DO_RECORDE, () => sim.ACELERADOR_MAXIMO, sim.PISTAS[id]).voltas.at(-1)!;
    assert.equal(medalhaPelosPassos(base, cheio, FATORES_DOS_CARRINHOS), null, `${id}: o acelerador cheio não ganha medalha`);
  }
});

test('o combustível (21/11/2026): só na resistência; acelerar gasta, soltar não, e parado no box o tanque enche', () => {
  assert.equal(sim.novoCarro(0, sim.PISTA_PADRAO, sim.VOLTAS).combustivel, null);
  const c = sim.novoCarro(0, sim.PISTA_PADRAO, sim.VOLTAS_DA_RESISTENCIA);
  assert.equal(c.combustivel, 1);
  for (let i = 0; i < 120; i++) sim.passo(c, sim.ACELERADOR_MAXIMO);
  const depois = c.combustivel!;
  assert.ok(depois < 1, 'acelerar gasta');
  for (let i = 0; i < 30; i++) sim.passo(c, 0);
  assert.equal(c.combustivel, depois, 'soltar não gasta');
  // o tanque vazio: só se arrasta
  const vazio = sim.novoCarro(0, sim.PISTA_PADRAO, sim.VOLTAS_DA_RESISTENCIA);
  vazio.combustivel = 0;
  for (let i = 0; i < 300; i++) sim.passo(vazio, sim.ACELERADOR_MAXIMO);
  assert.ok(vazio.v <= (sim.VMAX * sim.SEM_COMBUSTIVEL) / sim.ACELERADOR_MAXIMO + 1e-9);
  // parado no box (o trecho antes da linha), enche; parado fora dele, não
  const b = sim.novoCarro(0, sim.PISTA_PADRAO, sim.VOLTAS_DA_RESISTENCIA);
  b.combustivel = 0.5;
  b.s = sim.PISTA_PADRAO.volta[0] - 2;
  assert.ok(sim.noBox(b));
  for (let i = 0; i < 60; i++) sim.passo(b, 0);
  assert.ok(b.combustivel! > 0.5 && b.combustivel! <= 1);
  const f = sim.novoCarro(0, sim.PISTA_PADRAO, sim.VOLTAS_DA_RESISTENCIA);
  f.combustivel = 0.5;
  f.s = 3;
  for (let i = 0; i < 60; i++) sim.passo(f, 0);
  assert.equal(f.combustivel, 0.5);
  // a chave do recorde da resistência é outra (os tempos sem combustível ficam em "@20")
  assert.equal(sim.sufixoDasVoltas(sim.VOLTAS), '');
  assert.equal(sim.sufixoDasVoltas(sim.VOLTAS_DA_RESISTENCIA), '@20c');
});

test('o combustível: o piloto automático para no box e termina as 20 voltas em toda pista e faixa, sem o tanque secar; quem não para seca', () => {
  for (const id of sim.IDS_DAS_PISTAS) {
    for (let faixa = 0; faixa < sim.FAIXAS; faixa++) {
      const c = sim.novoCarro(faixa, sim.PISTAS[id], sim.VOLTAS_DA_RESISTENCIA);
      let menor = 1;
      let paradas = 0;
      let antes = 1;
      let subindo = false;
      while (!c.chegou && c.passo < sim.PASSOS_MAXIMOS) {
        sim.passo(c, sim.pilotoAutomatico(c, 0.3));
        if (c.combustivel! > antes && !subindo) {
          paradas++;
          subindo = true;
        } else if (c.combustivel! < antes) subindo = false;
        menor = Math.min(menor, c.combustivel!);
        antes = c.combustivel!;
      }
      assert.ok(c.chegou, `${id}, faixa ${faixa}`);
      assert.ok(menor > 0, `${id}, faixa ${faixa}: o tanque secou`);
      assert.ok(paradas >= 2, `${id}, faixa ${faixa}: ${paradas} paradas`);
    }
  }
  // quem nunca solta no box (só o acelerador das curvas) seca e se arrasta
  const semBox = sim.novoCarro(0, sim.PISTA_PADRAO, sim.VOLTAS_DA_RESISTENCIA);
  let secou = false;
  while (!semBox.chegou && semBox.passo < sim.PASSOS_MAXIMOS) {
    const cheio = semBox.combustivel;
    semBox.combustivel = 1;
    const g = sim.pilotoAutomatico(semBox, 0.3);
    semBox.combustivel = cheio;
    sim.passo(semBox, g);
    if (semBox.combustivel === 0) secou = true;
  }
  assert.ok(secou);
});
