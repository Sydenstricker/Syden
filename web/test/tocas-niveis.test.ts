/**
 * Tocas e Torres, 19/11/2026: os níveis do computador, os tipos de mapa, o ferreiro, o mercado, o tutorial e o gráfico do fim.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { criarIA, PERFIS } from '../src/tocas/ia';
import {
  alcancavel,
  AMOSTRA_DO_HISTORICO,
  assinatura,
  CENTRO_DE,
  comandar,
  EFEITO_DAS_MELHORIAS,
  MAPAS,
  MELHORIAS,
  MERCADO,
  novaPartida,
  ORDEM_DAS_MELHORIAS,
  passo,
  PASSOS_MAX,
  podeConstruir,
  precoDaTroca,
  ritmoDe,
  temMelhoria,
  UNIDADES,
  type Dono,
  type Sim,
  type TipoPredio,
  type TipoUnidade,
} from '../src/tocas/sim';

const meus = (sim: Sim, dono: Dono, tipo?: TipoUnidade) => sim.unidades.filter((u) => u.dono === dono && (!tipo || u.tipo === tipo));
const centroDe = (sim: Sim, dono: Dono) => sim.predios.find((p) => p.dono === dono && p.tipo === 'centro')!;

function clonar(sim: Sim, dono: Dono, tipo: TipoUnidade, x: number, y: number) {
  const base = sim.unidades.find((u) => u.dono === dono) ?? sim.unidades[0];
  const u = { ...base, dono, id: sim.proximoId++, tipo, x, y, ax: x, ay: y, ordem: { tipo: 'parado' as const }, caminho: [], carga: null, abrigado: 0, antesDoSino: null };
  u.vida = u.vidaMax = UNIDADES[tipo].vida;
  sim.unidades.push(u);
  sim.porId.set(u.id, u);
  return u;
}

/** Constrói o prédio ao lado do centro do dono 0 e termina a obra. */
function construirPronto(sim: Sim, tipo: TipoPredio) {
  const c = centroDe(sim, 0);
  let lugar: { gx: number; gy: number } | null = null;
  for (let gy = c.gy - 4; gy < c.gy + 6 && !lugar; gy++) for (let gx = c.gx + 4; gx < c.gx + 10 && !lugar; gx++) if (podeConstruir(sim, 0, tipo, gx, gy)) lugar = { gx, gy };
  assert.ok(lugar, `lugar para ${tipo}`);
  comandar(sim, 0, { t: 'construir', ids: meus(sim, 0, 'trabalhador').map((u) => u.id), tipo, gx: lugar.gx, gy: lugar.gy });
  passo(sim);
  const p = sim.predios.find((q) => q.tipo === tipo && q.dono === 0)!;
  for (let i = 0; i < 600 && !p.pronto; i++) passo(sim);
  assert.ok(p.pronto, `${tipo} pronto`);
  return p;
}

test('os mapas nascem espelhados e jogáveis: caminho de uma base à outra, e ouro e madeira perto de casa', () => {
  const T = 44;
  const tipo = (sim: Sim, g: number) => (g === 0 ? 'livre' : g < 0 ? String(g) : (sim.porId.get(g) as { tipo: string }).tipo);
  for (const mapa of MAPAS)
    for (let s = 1; s <= 12; s++) {
      const sim = novaPartida(s * 104729, { mapa });
      assert.equal(sim.mapa, mapa);
      for (let y = 0; y < T; y++)
        for (let x = 0; x < T; x++) assert.equal(tipo(sim, sim.grade[y * T + x]), tipo(sim, sim.grade[(T - 1 - y) * T + (T - 1 - x)]), `${mapa} ${s}: casa ${x},${y}`);
      for (const d of [0, 1] as Dono[]) {
        const c = CENTRO_DE[d];
        const o = CENTRO_DE[(1 - d) as Dono];
        const sai = { x: c.gx + 1.5, y: d === 0 ? c.gy - 0.5 : c.gy + 3.5 };
        assert.ok(alcancavel(sim, d, sai.x, sai.y, o.gx, o.gy, o.gx + 2, o.gy + 2), `${mapa} ${s}: sem caminho de ${d}`);
        const perto = (t: 'arvore' | 'ouro') =>
          sim.fontes.filter((f) => f.tipo === t && Math.hypot(f.gx - c.gx, f.gy - c.gy) < 14 && alcancavel(sim, d, sai.x, sai.y, f.gx, f.gy, f.gx, f.gy)).length;
        assert.ok(perto('ouro') >= 4, `${mapa} ${s}: ouro perto de ${d}`);
        assert.ok(perto('arvore') >= 10, `${mapa} ${s}: madeira perto de ${d}`);
      }
      if (mapa === 'lagos') assert.ok(sim.agua.length >= 20, `lagos ${s}: água ${sim.agua.length}`);
      if (mapa === 'ouro') assert.equal(sim.fontes.filter((f) => f.tipo === 'ouro' && f.gx >= 20 && f.gx <= 23 && f.gy >= 20 && f.gy <= 23).length, 16);
      if (mapa === 'floresta')
        assert.ok(sim.fontes.filter((f) => f.tipo === 'arvore').length > novaPartida(s * 104729).fontes.filter((f) => f.tipo === 'arvore').length, 'mais árvores que o campo');
    }
});

test('a mesma semente e os mesmos comandos dão a mesma assinatura, em todo tipo de mapa', () => {
  for (const mapa of MAPAS) {
    const rodar = () => {
      const sim = novaPartida(77, { mapa });
      const a = criarIA(0, PERFIS.dificil);
      const b = criarIA(1, PERFIS.facil);
      while (sim.passo < 2500) {
        a(sim);
        b(sim);
        passo(sim);
      }
      return assinatura(sim);
    };
    assert.equal(rodar(), rodar(), mapa);
  }
});

test('o difícil ganha do fácil na maioria das sementes (dos dois lados do mapa)', () => {
  let dificil = 0;
  let total = 0;
  for (const [s, mapa] of [[1, 'campo'], [2, 'floresta'], [3, 'ouro'], [4, 'lagos']] as const)
    for (const lado of [0, 1] as Dono[]) {
      const sim = novaPartida(s * 7919, { mapa });
      const ias = [criarIA(0, lado === 0 ? PERFIS.dificil : PERFIS.facil), criarIA(1, lado === 1 ? PERFIS.dificil : PERFIS.facil)];
      while (sim.vencedor === null && sim.passo < PASSOS_MAX + 5) {
        ias[0](sim);
        ias[1](sim);
        passo(sim);
      }
      total++;
      if (sim.vencedor === lado) dificil++;
    }
  assert.ok(dificil >= total - 1, `o difícil ganhou ${dificil} de ${total}`);
});

test('o ferreiro: a melhoria custa, demora, é uma por vez, e vale (a coleta, o golpe e a armadura da linha)', () => {
  const sim = novaPartida(3);
  const j = sim.jogadores[0];
  j.recursos = { comida: 2000, madeira: 2000, ouro: 2000 };
  const f = construirPronto(sim, 'ferreiro');
  comandar(sim, 1, { t: 'melhorar', predio: f.id, m: 'machado' });
  passo(sim);
  assert.equal(f.estudo, null, 'de outro dono, nada');
  const madeira = j.recursos.madeira;
  assert.equal(ritmoDe(sim, 0, 'madeira'), 12);
  comandar(sim, 0, { t: 'melhorar', predio: f.id, m: 'machado' });
  passo(sim);
  assert.equal(f.estudo, 'machado');
  assert.equal(j.recursos.madeira, madeira - MELHORIAS.machado.custo.madeira!);
  comandar(sim, 0, { t: 'melhorar', predio: f.id, m: 'arado' });
  passo(sim);
  assert.equal(f.estudo, 'machado', 'uma por vez');
  for (let i = 0; i < MELHORIAS.machado.tempo; i++) passo(sim);
  assert.equal(f.estudo, null);
  assert.ok(temMelhoria(sim, 0, 'machado'));
  assert.ok(sim.historico.length > 0);
  assert.equal(ritmoDe(sim, 0, 'madeira'), 12 - EFEITO_DAS_MELHORIAS.coleta);
  comandar(sim, 0, { t: 'melhorar', predio: f.id, m: 'machado' });
  passo(sim);
  assert.equal(f.estudo, null, 'a mesma de novo, não');
  // o ataque e a armadura dos lanceiros decidem um duelo que seria parelho: lanceiros contra lanceiros
  j.melhorias |= (1 << ORDEM_DAS_MELHORIAS.indexOf('ataqueLanceiro')) | (1 << ORDEM_DAS_MELHORIAS.indexOf('armaduraLanceiro'));
  const longe = (u: { x: number; y: number }) => Math.hypot(u.x - 22, u.y - 18) > 4;
  for (const u of sim.unidades) if (!longe(u)) u.vida = 0;
  passo(sim);
  for (let k = 0; k < 4; k++) {
    clonar(sim, 0, 'lanceiro', 20, 16 + k * 0.6);
    clonar(sim, 1, 'lanceiro', 24, 16 + k * 0.6);
  }
  const lanc = (d: Dono) => meus(sim, d, 'lanceiro').filter((u) => !longe(u) || u.ordem.tipo !== 'parado');
  comandar(sim, 0, { t: 'mover', ids: meus(sim, 0, 'lanceiro').map((u) => u.id), x: 24, y: 17, atacando: true });
  comandar(sim, 1, { t: 'mover', ids: meus(sim, 1, 'lanceiro').map((u) => u.id), x: 20, y: 17, atacando: true });
  for (let i = 0; i < 1500 && meus(sim, 0, 'lanceiro').length && meus(sim, 1, 'lanceiro').length; i++) passo(sim);
  assert.equal(meus(sim, 1, 'lanceiro').length, 0, 'os lanceiros sem melhoria caíram');
  assert.ok(lanc(0).length >= 2, `sobraram ${lanc(0).length}`);
});

test('o mercado, a novidade da era 2: 100 de um recurso por outro, ao preço que anda', () => {
  const sim = novaPartida(3);
  const j = sim.jogadores[0];
  j.recursos = { comida: 1000, madeira: 1000, ouro: 1000 };
  const c = centroDe(sim, 0);
  assert.equal(podeConstruir(sim, 0, 'mercado', c.gx + 5, c.gy), false, 'na era 1 não se constrói');
  j.era = 2;
  const m = construirPronto(sim, 'mercado');
  const antes = { ...j.recursos };
  assert.equal(precoDaTroca(sim, 0, 'madeira', 'ouro'), MERCADO.taxa);
  comandar(sim, 0, { t: 'trocar', predio: m.id, de: 'madeira', para: 'ouro' });
  passo(sim);
  assert.equal(j.recursos.madeira, antes.madeira - MERCADO.lote);
  assert.equal(j.recursos.ouro, antes.ouro + MERCADO.taxa);
  assert.ok(precoDaTroca(sim, 0, 'madeira', 'ouro') < MERCADO.taxa, 'vender de novo dá menos');
  j.recursos.comida = 50;
  comandar(sim, 0, { t: 'trocar', predio: m.id, de: 'comida', para: 'ouro' });
  passo(sim);
  assert.equal(j.recursos.comida, 50, 'sem um lote, não');
});

test('o tutorial: o computador dele não treina tropa nem ataca; e o gráfico do fim vai sendo guardado', () => {
  const sim = novaPartida(5);
  const ia = criarIA(1, PERFIS.tutorial);
  for (let i = 0; i < 6000; i++) {
    ia(sim);
    passo(sim);
  }
  assert.equal(sim.unidades.filter((u) => u.dono === 1 && UNIDADES[u.tipo].combate).length, 0);
  assert.ok(meus(sim, 1, 'trabalhador').length >= 3);
  assert.ok(sim.historico.length >= 6000 / AMOSTRA_DO_HISTORICO);
  assert.ok(sim.historico.at(-1)!.colhido[1] > 0);
});
