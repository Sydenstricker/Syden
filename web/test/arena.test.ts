/**
 * A Arena dos coelhos (web/src/arena/): as contas são uma regra só, e o servidor confere com a CÓPIA dela
 * (server/src/arena/conta.ts). Aqui se confere que as duas cópias são iguais, o andar do meu coelho (a cerca, a árvore, a
 * arrancada), a direção do desenho pela mira e o golpe que o cliente manda. A partida inteira com o piloto automático contra o
 * servidor de verdade mora em server/test/minijogos-bichos-arena.test.ts.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import * as C from '../src/arena/conta.ts';
import { Cliente, comandosVazios, type Quadro } from '../src/arena/regras.ts';
import { direcaoDoDesenho } from '../src/arena/direcao.ts';

test('as duas cópias das contas são iguais byte a byte', () => {
  const doSite = readFileSync(new URL('../src/arena/conta.ts', import.meta.url));
  const doServidor = readFileSync(new URL('../../server/src/arena/conta.ts', import.meta.url));
  assert.ok(doSite.equals(doServidor), 'web/src/arena/conta.ts e server/src/arena/conta.ts diferem');
});

test('os kits: cada elemento tem os quatro golpes, e o forte e o especial são zonas com aviso', () => {
  for (const el of C.ELEMENTOS_DA_ARENA) {
    const k = C.KITS[el];
    assert.ok(k, el);
    for (const tecla of C.TECLAS_DE_GOLPE) assert.ok(k[tecla].dano > 0, `${el} ${tecla}`);
    assert.equal(k.b.forma, 'tiro');
    assert.equal(k.q.forma, 'zona');
    assert.ok(k.q.aviso >= 500, 'o golpe forte avisa');
    assert.equal(k.e.forma, 'zona');
  }
  // os pontos dos suprimentos estão à mesma distância do centro, e nenhum dentro de um obstáculo
  const ds = C.PONTOS_DE_SUPRIMENTO.map(([x, y]) => Math.hypot(x - C.MUNDO_W / 2, y - C.MUNDO_H / 2));
  assert.ok(Math.max(...ds) - Math.min(...ds) < 1);
  for (const cen of C.CENARIOS) for (const [x, y] of C.PONTOS_DE_SUPRIMENTO) assert.equal(C.dentroDeObstaculo(cen, x, y, 0), false, `${cen} ${x},${y}`);
  for (const cen of C.CENARIOS) for (const [x, y] of [...C.NASCER_TODOS, ...C.NASCER_TIME.flat()]) assert.equal(C.dentroDeObstaculo(cen, x, y, 0), false, `nasce em ${cen} ${x},${y}`);
});

test('a direção do desenho: a diagonal mais perto entre as que existem, e as retas quando existirem', () => {
  const diagonais = ['south-east', 'south-west', 'north-east', 'north-west'];
  assert.equal(direcaoDoDesenho(1, 0.1, diagonais), 'south-east');
  assert.equal(direcaoDoDesenho(1, -0.1, diagonais), 'north-east');
  assert.equal(direcaoDoDesenho(1, 0, diagonais), 'south-east', 'o empate vai para o de frente');
  assert.equal(direcaoDoDesenho(-0.2, -1, diagonais), 'north-west');
  assert.equal(direcaoDoDesenho(0, 1, ['south-east', 'south-west', 'south']), 'south', 'com a reta, a reta');
  assert.equal(direcaoDoDesenho(1, 1, []), null);
});

/** Um quadro mínimo do servidor, comigo em (x, y). */
const quadro = (n: number, x: number, y: number, extra: Partial<Quadro> = {}): Quadro => ({
  tipo: 'q',
  n,
  f: 'lutando',
  r: 200_000,
  j: [[7, x, y, 100, 0, 0, 0, 3, 100, 0, 0, 0, 0, 0, 0, 0, 0]],
  p: [],
  z: [],
  s: [],
  e: [],
  ...extra,
});

test('o meu coelho: anda na velocidade dele, não atravessa a árvore, e a arrancada vai mais longe e tem recarga', () => {
  const enviados: Record<string, unknown>[] = [];
  const c = new Cliente(7, 'grama', new Map([[7, ['brotel', 'tisco', 'bolhim']]]), (d) => enviados.push(d as Record<string, unknown>));
  c.chegou(quadro(1, 300, 380), 0);
  const cmd = { ...comandosVazios(), direita: true };
  let agora = 0;
  for (let k = 0; k < 60; k++) c.passo(cmd, 1 / 60, (agora += 1000 / 60), c.vista(agora));
  assert.ok(Math.abs(c.eu.x - (300 + C.VEL)) < 2, `andou ${c.eu.x - 300}`);
  // a arrancada
  const x0 = c.eu.x;
  cmd.arrancada = true;
  for (let k = 0; k < 12; k++) c.passo(cmd, 1 / 60, (agora += 1000 / 60), c.vista(agora));
  assert.ok(c.eu.x - x0 > (C.VEL * 12) / 60 + 30, 'a arrancada leva mais longe');
  assert.ok(enviados.some((d) => d.tipo === 'arrancada'));
  cmd.arrancada = true;
  const antes = enviados.filter((d) => d.tipo === 'arrancada').length;
  c.passo(cmd, 1 / 60, (agora += 1000 / 60), c.vista(agora));
  assert.equal(enviados.filter((d) => d.tipo === 'arrancada').length, antes, 'na recarga, não sai outra');
  // a árvore do meio (640, 448): andando contra ela, o coelho fica do lado de fora
  const d = new Cliente(7, 'grama', new Map([[7, ['brotel']]]), () => {});
  d.chegou(quadro(1, 580, 448), 0);
  for (let k = 0; k < 120; k++) d.passo({ ...comandosVazios(), direita: true }, 1 / 60, k * 16, d.vista(k * 16));
  assert.ok(Math.hypot(d.eu.x - 640, d.eu.y - 448) >= 30 + C.RAIO - 0.5, 'não entra na árvore');
});

test('o golpe: o básico sai na recarga dele, mirado no mouse, e o forte vai com o alvo', () => {
  const enviados: Record<string, unknown>[] = [];
  const c = new Cliente(7, 'grama', new Map([[7, ['bolhim', 'tisco', 'brotel']]]), (d) => enviados.push(d as Record<string, unknown>));
  c.chegou(quadro(1, 300, 380), 0);
  const cmd = { ...comandosVazios(), atacar: true, alvoX: 300, alvoY: 200 };
  let agora = 0;
  for (let k = 0; k < 66; k++) c.passo(cmd, 1 / 60, (agora += 1000 / 60), c.vista(agora));
  const golpes = enviados.filter((d) => d.tipo === 'golpe');
  assert.equal(golpes.length, 3, 'em 1,1 s, três básicos (recarga de 0,5 s)');
  assert.equal(golpes[0].tecla, 'b');
  assert.equal(golpes[0].dy, -1, 'para cima, para o mouse');
  cmd.atacar = false;
  cmd.forte = true;
  cmd.alvoX = 420;
  c.passo(cmd, 1 / 60, (agora += 1000 / 60), c.vista(agora));
  const forte = enviados.filter((d) => d.tipo === 'golpe').at(-1)!;
  assert.equal(forte.tecla, 'q');
  assert.equal(forte.ax, 420);
  // o especial só cheio
  cmd.especial = true;
  c.passo(cmd, 1 / 60, (agora += 1000 / 60), c.vista(agora));
  assert.notEqual(enviados.filter((d) => d.tipo === 'golpe').at(-1)!.tecla, 'e');
});
