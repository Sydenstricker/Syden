import assert from 'node:assert/strict';
import { test } from 'node:test';
import { altura, COLUNAS, corvoEm, LARGURA, quedaEm, T, TORRES, type Torre } from '../src/torre/fases';
import { AMOSTRA, amostrar, atingidoEm, fantasmaEm, novoCoelho, passo, passosEmMs, type Comandos } from '../src/torre/fisica';
import { planejar } from '../src/torre/piloto';

/** O piloto automático planeja e sobe a torre; devolve o coelho e o fantasma, como o laço os guarda. */
function subir(f: Torre) {
  const plano = planejar(f, novoCoelho(f));
  assert.ok(plano, `${f.id}: o piloto automático não achou o caminho`);
  const k = novoCoelho(f);
  const caminho: number[] = [];
  for (const c of plano) {
    const antes = k.terminou;
    passo(k, c, f);
    if (!antes) amostrar(k, caminho);
  }
  return { k, caminho };
}

const planos = new Map(TORRES.map((f) => [f.id, subir(f)]));
const servidor = await import('../../server/src/torre.ts');

test('toda torre se sobe até o topo, sem levar pancada, em 35 a 60 s do piloto automático', () => {
  for (const f of TORRES) {
    const { k, caminho } = planos.get(f.id)!;
    assert.equal(k.terminou, true, `${f.id}: não chegou`);
    assert.equal(k.quedas, 0);
    const s = k.chegouEm / 60;
    assert.ok(s >= 35 && s <= 60, `${f.id}: ${s.toFixed(1)} s`);
    assert.equal(caminho.length, 3 * (Math.floor((k.chegouEm - 1) / AMOSTRA) + 1), 'uma amostra a cada 4 passos, até a chegada');
  }
});

test('as medidas das torres batem com as do servidor, e o fantasma honesto passa', () => {
  assert.deepEqual(
    Object.keys(servidor.TORRES_DO_CELEIRO),
    TORRES.map((f) => f.id),
  );
  for (const f of TORRES) {
    const s = servidor.TORRES_DO_CELEIRO[f.id];
    assert.deepEqual(s.largada, [f.largada.x, f.largada.y], `${f.id}: a largada`);
    assert.equal(s.chegada, f.chegada);
    assert.equal(s.largura, LARGURA);
    assert.equal(s.altura, altura(f));
    assert.deepEqual(
      s.postos,
      f.postos.map((p) => [p.x, p.y]),
    );
    const { k, caminho } = planos.get(f.id)!;
    // o mínimo do servidor é 85% do piloto automático (arredondado para baixo): mudou a torre, muda o mínimo
    assert.ok(s.minimo <= Math.floor(k.chegouEm * 0.85), `${f.id}: o mínimo (o piloto fez ${k.chegouEm} passos)`);
    const v = servidor.validarTorre(f.id, {
      passos: k.chegouEm,
      amostras: caminho,
    });
    assert.ok('ok' in v, `${f.id}: o servidor recusou a subida honesta (${'erro' in v ? v.erro : ''})`);
    assert.equal(v.ok.tempoMs, passosEmMs(k.chegouEm));
  }
});

test('a pancada volta ao último andar, e o servidor aceita essa volta', () => {
  const f = TORRES[0];
  const plano = planejar(f, novoCoelho(f))!;
  const k = novoCoelho(f);
  const caminho: number[] = [];
  // sobe pelo plano até o segundo andar, e então fica parado debaixo da pá até ela cair
  let i = 0;
  while (k.posto < 2) {
    passo(k, plano[i++], f);
    amostrar(k, caminho);
  }
  const pa = f.quedas[0];
  const parado: Comandos = { esquerda: false, direita: false, pula: false };
  // anda até debaixo da pá (no degrau onde ela bate) seguindo o caminho do piloto, e espera
  let guarda = 0;
  while (k.quedas === 0 && guarda++ < 4000) {
    const alvoY = pa.y1 + 6;
    const noDegrau = k.noChao && Math.abs(k.y - alvoY) < 1;
    const c: Comandos = noDegrau ? { esquerda: k.x > pa.x + 2, direita: k.x < pa.x - 2, pula: false } : (plano[i++] ?? parado);
    passo(k, c, f);
    amostrar(k, caminho);
  }
  assert.equal(k.quedas, 1, 'levou a pancada');
  assert.deepEqual([k.x, k.y], [f.postos[k.posto].x, f.postos[k.posto].y], 'e voltou ao andar');
  const resto = planejar(f, k, 250)!;
  assert.ok(resto);
  for (const c of resto) {
    const antes = k.terminou;
    passo(k, c, f);
    if (!antes) amostrar(k, caminho);
  }
  assert.ok(k.terminou);
  const v = servidor.validarTorre(f.id, {
    passos: k.chegouEm,
    amostras: caminho,
  });
  assert.ok('ok' in v, 'a volta ao andar não é um salto proibido');
});

test('o mesmo plano dá sempre o mesmo tempo, e o que cai e o corvo dependem só do passo', () => {
  const f = TORRES[1];
  assert.equal(subir(f).k.chegouEm, planos.get(f.id)!.k.chegouEm);
  for (const q of f.quedas) for (const n of [0, 77, 1234]) assert.deepEqual(quedaEm(q, n), quedaEm(q, n + q.periodo));
  // o corvo bate as asas a cada 40 passos e vai e volta a cada período: os dois juntos se repetem
  for (const c of f.corvos) for (const n of [5, 999]) assert.deepEqual(corvoEm(c, n), corvoEm(c, n + c.periodo * 40));
});

test('o que cai avisa antes e para no degrau; ninguém leva pancada parado na largada nem num andar', () => {
  for (const f of TORRES) {
    for (const q of f.quedas) {
      assert.equal(quedaEm(q, -q.desloc)?.estado, 'aviso', 'cada ciclo começa tremendo lá em cima');
      assert.ok(q.y1 > q.y0 + 32);
      assert.ok(q.x > 0 && q.x < COLUNAS * T);
    }
    for (const p of f.postos) for (let n = 0; n < 2000; n += 3) assert.equal(atingidoEm(f, p, n), false, `${f.id}: o posto em ${p.y} é seguro`);
  }
});

test('o servidor recusa o fantasma inventado: em linha reta, teletransportado, ou rápido demais', () => {
  const f = TORRES[2];
  const s = servidor.TORRES_DO_CELEIRO[f.id];
  const reta = (passos: number) => {
    const a: number[] = [];
    for (let p = 1; p <= passos; p += 4) {
      const t = (p - 1) / (passos - 1);
      a.push(Math.round(s.largada[0] * 10), Math.round((s.largada[1] + (s.chegada - 2 - s.largada[1]) * t) * 10), 1);
    }
    return { passos, amostras: a };
  };
  // em linha reta, no tempo mínimo, passa: é o que continua possível, e está escrito em server/src/torre.ts (uns 15% abaixo
  // do bom tempo); um passo a menos, não
  assert.ok('ok' in servidor.validarTorre(f.id, reta(s.minimo)), 'em linha reta, no tempo mínimo');
  assert.ok('erro' in servidor.validarTorre(f.id, reta(s.minimo - 1)), 'abaixo do mínimo');
  // subir depressa demais e esperar lá em cima: as janelas recusam (o tempo total ainda é o do piloto)
  const passos = planos.get(f.id)!.k.chegouEm;
  const rapida: number[] = [];
  for (let p = 1, y = s.largada[1] * 10; p <= passos; p += 4) {
    rapida.push(s.largada[0] * 10, Math.round(y), 1);
    y = Math.max((s.chegada - 2) * 10, y - 230);
  }
  assert.ok('erro' in servidor.validarTorre(f.id, { passos, amostras: rapida }), 'subiu mais que as janelas deixam');
  // o fantasma honesto com um salto para o último andar (que não alcançou)
  const { k, caminho } = planos.get(f.id)!;
  const pulado = [...caminho];
  const ultimo = s.postos[s.postos.length - 1];
  pulado[3 * 50] = ultimo[0] * 10;
  pulado[3 * 50 + 1] = ultimo[1] * 10;
  assert.ok('erro' in servidor.validarTorre(f.id, { passos: k.chegouEm, amostras: pulado }), 'salto para um andar não alcançado');
  // o fantasma honesto cortado no fim (declarando menos passos)
  const curto = caminho.slice(0, caminho.length - 3 * 40);
  assert.ok(
    'erro' in
      servidor.validarTorre(f.id, {
        passos: k.chegouEm - 160,
        amostras: curto,
      }),
    'parou antes do topo',
  );
  // o fantasma da reprodução bate com o laço: no passo 1 ele está na largada (menos de 1 px andado)
  const g = fantasmaEm(caminho, 1)!;
  assert.ok(Math.abs(g.x - f.largada.x) < 1 && g.y === f.largada.y);
});

test('as plataformas que andam, o que cai e os corvos não usam seno nem cosseno (o mesmo número em todo computador)', async () => {
  const { readFileSync } = await import('node:fs');
  for (const arq of ['fases.ts', 'fisica.ts']) {
    const texto = readFileSync(new URL(`../src/torre/${arq}`, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
    assert.doesNotMatch(texto, /Math\.(sin|cos|tan|atan)/, arq);
  }
});

// ---------------- As medalhas e o pulo que cresce com a corrida (19/11/2026) ----------------

test('as medalhas são sobre o tempo do piloto automático (a tabela é a dele)', async () => {
  const { TEMPO_DO_PILOTO, medalhaDaTorre } = await import('../src/torre/fases');
  for (const f of TORRES) {
    const { k } = planos.get(f.id)!;
    assert.equal(TEMPO_DO_PILOTO[f.id], k.chegouEm, `${f.id}: o tempo do piloto mudou (${k.chegouEm})`);
    assert.equal(medalhaDaTorre(f.id, k.chegouEm), 0, 'o tempo do piloto é ouro');
    assert.equal(medalhaDaTorre(f.id, Math.round(k.chegouEm * 1.2)), 1);
    assert.equal(medalhaDaTorre(f.id, Math.round(k.chegouEm * 1.5)), 2);
    assert.equal(medalhaDaTorre(f.id, k.chegouEm * 2), null);
  }
});

test('o pulo correndo sobe mais que o pulo parado', async () => {
  const { vPuloCom, VPULO, VMAX } = await import('../src/torre/fisica');
  assert.equal(vPuloCom(0), VPULO);
  assert.ok(vPuloCom(VMAX) > VPULO * 1.1);
  assert.equal(vPuloCom(-VMAX), vPuloCom(VMAX));
  assert.equal(vPuloCom(VMAX * 3), vPuloCom(VMAX));
  const f = TORRES[0];
  const altura = (correr: boolean) => {
    const k = novoCoelho(f);
    for (let i = 0; i < 30; i++)
      passo(
        k,
        {
          esquerda: false,
          direita: correr && i % 2 === 0 ? true : correr,
          pula: false,
        },
        f,
      );
    const y0 = k.y;
    k.vx = correr ? 110 : 0;
    let topo = k.y;
    for (let i = 0; i < 40; i++) {
      passo(k, { esquerda: false, direita: false, pula: true }, f);
      topo = Math.min(topo, k.y);
    }
    return y0 - topo;
  };
  assert.ok(altura(true) > altura(false), `correndo ${altura(true).toFixed(0)}, parado ${altura(false).toFixed(0)}`);
});

// ---------------- A subida sem fim (24/11/2026) ----------------

test('a subida sem fim: as torres, a física e a regra dela são as MESMAS do servidor, byte a byte (ele refaz a subida)', async () => {
  const { readFileSync } = await import('node:fs');
  for (const nome of ['fases.ts', 'fisica.ts', 'semfim.ts']) {
    const web = readFileSync(new URL(`../src/torre/${nome}`, import.meta.url), 'utf8');
    const srv = readFileSync(new URL(`../../server/src/torre/${nome}`, import.meta.url), 'utf8');
    assert.equal(web, srv, `${nome}: as duas cópias diferem`);
  }
});

test('a torre sem fim: a mesma semente dá a mesma torre, outra dá outra, e nenhum posto fica dentro de um fardo', async () => {
  const { torreSemFim, TRECHOS_DO_SEM_FIM, blocoEm, Bloco } = await import('../src/torre/fases');
  const a = torreSemFim(12345);
  const b = torreSemFim(12345);
  assert.deepEqual([...a.blocos], [...b.blocos]);
  assert.deepEqual(a.quedas, b.quedas);
  assert.notDeepEqual([...torreSemFim(54321).blocos], [...a.blocos]);
  for (const semente of [1, 2, 3, 99, 4242, 777777]) {
    const f = torreSemFim(semente);
    assert.equal(f.postos.length, TRECHOS_DO_SEM_FIM, 'a largada e um posto por andar');
    for (const p of f.postos) {
      const c = Math.floor(p.x / T);
      const l = Math.floor((p.y - 1) / T);
      assert.equal(blocoEm(f, c, l), Bloco.Vazio, `semente ${semente}: o posto (${p.x}, ${p.y}) não tem onde ficar`);
      assert.notEqual(blocoEm(f, c, l - 1), Bloco.Feno);
    }
  }
});

test('a subida sem fim: o piloto sobe andar a andar sem pancada, e o servidor refaz e conta os mesmos andares', async () => {
  const { torreSemFim } = await import('../src/torre/fases');
  const sf = await import('../src/torre/semfim');
  const srv = await import('../../server/src/torre/semfim.ts');
  for (const semente of [8, 4242]) {
    const f = torreSemFim(semente);
    const s = sf.novaSubidaSemFim(semente, f);
    const g = sf.gravadorSemFim();
    // os primeiros 5 andares (o resto é igual e lento para o teste); quem para no meio vale até onde chegou
    while (s.k.posto < 5 && !s.fim) {
      const alvo = s.k.posto;
      const plano = planejar(f, { ...s.k }, 400, 5, 60 * 60, (k) => k.posto > alvo || k.terminou);
      assert.ok(plano, `semente ${semente}: sem caminho no andar ${alvo}`);
      for (const c of plano) {
        g.anotar(c);
        sf.passoSemFim(s, c);
      }
    }
    assert.equal(s.fim, false, 'a água não alcança o piloto nos primeiros andares');
    assert.equal(s.k.quedas, 0);
    const r = srv.refazerSemFim(semente, g.entradas);
    assert.ok(r);
    assert.equal(r.andares, sf.andaresDaSubida(s));
    assert.equal(r.passos, s.k.passos);
    // a mesma subida noutra torre não chega aos mesmos andares
    assert.notEqual(srv.refazerSemFim(semente + 1, g.entradas)?.andares, 5);
  }
});

test('a subida sem fim: parado, a água alcança; e o servidor recusa entradas tortas', async () => {
  const sf = await import('../src/torre/semfim');
  const parado = sf.refazerSemFim(7, [60000, 0]);
  assert.ok(parado && parado.fim && parado.andares === 0);
  // a água espera e depois sobe: parado na largada, acaba entre 6 e 30 s
  assert.ok(parado.passos > sf.AGUA_ESPERA && parado.passos < 30 * 60, `passos: ${parado.passos}`);
  assert.equal(sf.refazerSemFim(7, [10, 8]), null, 'bits fora');
  assert.equal(sf.refazerSemFim(7, [0, 1]), null, 'vezes zero');
  assert.equal(sf.refazerSemFim(7, [1]), null, 'par incompleto');
  assert.equal(sf.refazerSemFim(1.5, [1, 0]), null, 'semente torta');
  assert.equal(sf.refazerSemFim(7, Array.from({ length: 30 }, (_, i) => (i % 2 ? 0 : 60000))), null, 'mais passos que o máximo');
});
