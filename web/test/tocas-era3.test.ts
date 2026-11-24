/**
 * Tocas e Torres, 24/11/2026 (a segunda auditoria, lote E): a ERA 3. O mercado como degrau, o custo e o tempo, a vida e o golpe
 * maiores, a guarda, o canhão, a oficina, o bastião e as três melhorias gerais do ferreiro; o computador chegando nela nos três
 * níveis; e as partidas que não chegam à era 3 dando o mesmo resultado de antes.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { criarIA, NIVEIS, PERFIS, type Perfil } from '../src/tocas/ia';
import {
  assinatura,
  cargaDe,
  CARGA,
  comandar,
  EFEITO_DAS_MELHORIAS,
  ERA2,
  ERA3,
  limparComando,
  MELHORIAS,
  novaPartida,
  ORDEM_DAS_MELHORIAS,
  passo,
  PASSOS_MAX,
  podeAvancarEra,
  podeConstruir,
  PREDIOS,
  temMelhoria,
  UNIDADES,
  type Dono,
  type Sim,
  type TipoDoMapa,
  type TipoPredio,
} from '../src/tocas/sim';

const centroDe = (sim: Sim, dono: Dono) => sim.predios.find((p) => p.dono === dono && p.tipo === 'centro')!;
const trabalhadores = (sim: Sim, dono: Dono) => sim.unidades.filter((u) => u.dono === dono && u.tipo === 'trabalhador');

/** Constrói o prédio ao lado do centro do dono 0 e termina a obra. */
function construirPronto(sim: Sim, tipo: TipoPredio) {
  const c = centroDe(sim, 0);
  let lugar: { gx: number; gy: number } | null = null;
  for (let gy = c.gy - 5; gy < c.gy + 7 && !lugar; gy++) for (let gx = c.gx + 4; gx < c.gx + 12 && !lugar; gx++) if (podeConstruir(sim, 0, tipo, gx, gy)) lugar = { gx, gy };
  assert.ok(lugar, `lugar para ${tipo}`);
  comandar(sim, 0, { t: 'construir', ids: trabalhadores(sim, 0).map((u) => u.id), tipo, gx: lugar.gx, gy: lugar.gy });
  passo(sim);
  const p = sim.predios.find((q) => q.tipo === tipo && q.dono === 0 && !q.pronto)!;
  assert.ok(p, `${tipo} em obra`);
  for (let i = 0; i < 1500 && !p.pronto; i++) passo(sim);
  assert.ok(p.pronto, `${tipo} pronto`);
  return p;
}

/** Avança o dono 0 de era pelo centro (com o que custa) e espera ficar pronto. */
function avancar(sim: Sim) {
  const c = centroDe(sim, 0);
  comandar(sim, 0, { t: 'era', predio: c.id });
  passo(sim);
  assert.ok(c.pesquisa > 0, 'a pesquisa começou');
  for (let i = 0; i < 700 && c.pesquisa > 0; i++) passo(sim);
}

test('a era 3 pede a era 2 e um mercado pronto; custa, demora, e cancelar devolve', () => {
  const sim = novaPartida(5);
  const j = sim.jogadores[0];
  j.recursos = { comida: 5000, madeira: 5000, ouro: 5000 };
  const c = centroDe(sim, 0);
  avancar(sim);
  assert.equal(j.era, 2);
  assert.equal(podeAvancarEra(sim, 0), false, 'sem mercado, não');
  comandar(sim, 0, { t: 'era', predio: c.id });
  passo(sim);
  assert.equal(c.pesquisa, 0, 'o centro recusou sem mercado');
  construirPronto(sim, 'mercado');
  assert.equal(podeAvancarEra(sim, 0), true);
  const antes = { ...j.recursos };
  comandar(sim, 0, { t: 'era', predio: c.id });
  passo(sim);
  assert.ok(c.pesquisa > 0);
  assert.equal(j.recursos.ouro, antes.ouro - ERA3.custo.ouro!);
  assert.equal(j.recursos.comida, antes.comida - ERA3.custo.comida!);
  comandar(sim, 0, { t: 'cancelar', predio: c.id });
  passo(sim);
  assert.equal(c.pesquisa, 0);
  assert.deepEqual(j.recursos, antes, 'cancelar devolve o custo da era 3');
  // agora até o fim: o tempo é o da era 3 (mais longo que o da 2)
  comandar(sim, 0, { t: 'era', predio: c.id });
  passo(sim);
  for (let i = 0; i < ERA2.tempo; i++) passo(sim);
  assert.equal(j.era, 2, 'no tempo da era 2 ainda não');
  for (let i = 0; i < ERA3.tempo && j.era !== 3; i++) passo(sim);
  assert.equal(j.era, 3);
  // a vida acompanha: o trabalhador e o centro com o fator da era 3
  const t = trabalhadores(sim, 0)[0];
  assert.equal(t.vidaMax, Math.round(UNIDADES.trabalhador.vida * ERA3.vidaUnidade));
  assert.equal(c.vidaMax, Math.round(PREDIOS.centro.vida * ERA3.vidaPredio));
  assert.equal(c.era, 3);
  // e não há era 4
  comandar(sim, 0, { t: 'era', predio: c.id });
  passo(sim);
  assert.equal(c.pesquisa, 0);
});

test('o que a era 3 abre: a guarda, a oficina com o canhão, o bastião e as melhorias gerais', () => {
  const sim = novaPartida(7);
  const j = sim.jogadores[0];
  j.recursos = { comida: 9000, madeira: 9000, ouro: 9000 };
  const c = centroDe(sim, 0);
  j.era = 2;
  const quartel = construirPronto(sim, 'quartel');
  const ferreiro = construirPronto(sim, 'ferreiro');
  // na era 2: nada disso
  assert.equal(podeConstruir(sim, 0, 'oficina', c.gx + 6, c.gy - 4), false);
  comandar(sim, 0, { t: 'treinar', predio: quartel.id, unidade: 'guarda' });
  comandar(sim, 0, { t: 'melhorar', predio: ferreiro.id, m: 'forja' });
  passo(sim);
  assert.equal(quartel.fila.length, 0, 'guarda só na era 3');
  assert.equal(ferreiro.estudo, null, 'forja só na era 3');
  j.era = 3;
  const oficina = construirPronto(sim, 'oficina');
  const bastiao = construirPronto(sim, 'bastiao');
  assert.equal(bastiao.tipo, 'bastiao');
  comandar(sim, 0, { t: 'treinar', predio: quartel.id, unidade: 'guarda' });
  comandar(sim, 0, { t: 'treinar', predio: oficina.id, unidade: 'canhao' });
  comandar(sim, 0, { t: 'treinar', predio: quartel.id, unidade: 'canhao' });
  passo(sim);
  assert.deepEqual(quartel.fila, ['guarda'], 'o canhão não sai do quartel');
  assert.deepEqual(oficina.fila, ['canhao']);
  for (let i = 0; i < 300; i++) passo(sim);
  assert.ok(sim.unidades.some((u) => u.dono === 0 && u.tipo === 'guarda'));
  assert.ok(sim.unidades.some((u) => u.dono === 0 && u.tipo === 'canhao'));
  // as três melhorias gerais, uma por vez
  for (const m of ['carrinho', 'forja', 'cota'] as const) {
    comandar(sim, 0, { t: 'melhorar', predio: ferreiro.id, m });
    passo(sim);
    assert.equal(ferreiro.estudo, m);
    for (let i = 0; i < MELHORIAS[m].tempo; i++) passo(sim);
    assert.ok(temMelhoria(sim, 0, m), m);
  }
  assert.equal(cargaDe(sim, 0), EFEITO_DAS_MELHORIAS.carga);
  assert.equal(cargaDe(sim, 1), CARGA);
  // o comando de fora com os nomes novos passa pela limpeza
  assert.deepEqual(limparComando({ t: 'treinar', predio: 3, unidade: 'canhao' }), { t: 'treinar', predio: 3, unidade: 'canhao' });
  assert.deepEqual(limparComando({ t: 'melhorar', predio: 3, m: 'cota' }), { t: 'melhorar', predio: 3, m: 'cota' });
  assert.equal(ORDEM_DAS_MELHORIAS.indexOf('forja'), 9, 'as novas vão no fim (os bits de antes não mudam)');
});

test('a guarda é da linha do lanceiro: as melhorias dele valem para ela, e o arqueiro tem vantagem sobre ela', () => {
  assert.equal(UNIDADES.guarda.linha, 'lanceiro');
  assert.equal(UNIDADES.arqueiro.bonus?.contra, 'lanceiro');
  assert.equal(UNIDADES.guarda.era, 3);
  assert.equal(UNIDADES.canhao.de, 'oficina');
});

/**
 * O RESULTADO DE ANTES: as partidas abaixo foram jogadas pela versão ANTERIOR à era 3 (o computador contra o computador, até o
 * fim). Com o computador sem a era 3 (`era3Desde` vazio), a versão nova tem de dar a mesma assinatura, o mesmo vencedor e o
 * mesmo passo: nada mudou para quem não chega à era 3. (Conferido também passo a passo em 44 partidas, com o 2×2 e os desafios.)
 */
const DE_ANTES: [keyof typeof PERFIS, keyof typeof PERFIS, TipoDoMapa, number, number, Dono, string, string][] = [
  ['dificil', 'facil', 'campo', 11, 12000, 0, 'tempo', '87221c75'],
  ['normal', 'dificil', 'floresta', 22, 10885, 1, 'centro', '77437d71'],
  ['facil', 'normal', 'ouro', 33, 12000, 0, 'tempo', '41416e05'],
  ['dificil', 'dificil', 'lagos', 44, 8636, 0, 'centro', '6ea2044'],
];

test('sem a era 3, a partida é a de antes: a mesma assinatura, o mesmo vencedor e o mesmo fim', () => {
  const semEra3 = (p: Perfil): Perfil => ({ ...p, era3Desde: undefined });
  for (const [x, y, mapa, sem, passos, vencedor, motivo, assin] of DE_ANTES) {
    const sim = novaPartida(sem, { mapa });
    const ias = [criarIA(0, semEra3(PERFIS[x])), criarIA(1, semEra3(PERFIS[y]))];
    while (sim.vencedor === null && sim.passo < PASSOS_MAX + 5) {
      ias[0](sim);
      ias[1](sim);
      passo(sim);
    }
    assert.deepEqual([sim.passo, sim.vencedor, sim.motivo, assinatura(sim)], [passos, vencedor, motivo, assin], `${x}×${y} ${mapa}`);
  }
});

test('o computador chega à era 3 nos três níveis, e usa o que ela abre', () => {
  for (const nivel of NIVEIS) {
    // contra quem não ataca (o do tutorial), e sem a onda de ataque, para a partida durar até o fim
    const sim = novaPartida(31, { mapa: 'campo' });
    const ia = criarIA(0, { ...PERFIS[nivel], primeiroAtaque: 1e9 });
    const outro = criarIA(1, PERFIS.tutorial);
    let era3 = -1;
    let canhoes = 0;
    while (sim.vencedor === null && sim.passo < PASSOS_MAX - 10) {
      ia(sim);
      outro(sim);
      passo(sim);
      if (era3 < 0 && sim.jogadores[0].era === 3) era3 = sim.passo;
      for (const e of sim.eventos) if (e.t === 'treinou' && e.dono === 0 && e.tipo === 'canhao') canhoes++;
    }
    assert.ok(era3 > 0, `${nivel}: chegou à era 3`);
    assert.ok(era3 >= PERFIS[nivel].era3Desde!, `${nivel}: não antes da hora do perfil`);
    const meus = (t: string) => sim.predios.some((p) => p.dono === 0 && p.tipo === t) || sim.unidades.some((u) => u.dono === 0 && u.tipo === t);
    assert.ok(meus('mercado'), `${nivel}: mercado`);
    // o fácil chega tarde e com pouca madeira: a era já é o que ele usa; o normal e o difícil levantam o que ela abre
    if (nivel !== 'facil') assert.ok(meus('oficina') || meus('bastiao'), `${nivel}: oficina ou bastião`);
    if (nivel === 'dificil') {
      assert.ok(canhoes > 0, 'difícil: canhão');
      assert.ok((PERFIS.dificil.melhorias3 ?? []).some((m) => temMelhoria(sim, 0, m)), 'difícil: alguma melhoria da era 3');
    }
  }
});
