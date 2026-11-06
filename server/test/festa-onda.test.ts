/** Onda no açude (festa/onda.ts): um contra três. As ondas são carimbadas no servidor; quem cai é a conta do servidor. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rodadaAoVivo } from './festa-ajuda-aovivo.js';
import { sorteioFixo } from './festa-ajuda.js';
import { ONDA_MS, PRIMEIRA_REMADA, VIAGEM_LENTA, VIAGEM_RAPIDA, type QuadroOnda, type VistaOnda } from '../src/festa/onda.js';

const rede = new Map([[1, 200], [2, 300], [3, 250], [4, 220]]);
type R = ReturnType<typeof rodadaAoVivo>;
const vista = (r: R, quem: number) => r.rodada.publico(quem).dados as VistaOnda;
/** Anda o relógio do servidor até `ms` desde o começo. */
const ate = (r: R, ms: number) => r.passos(Math.max(0, Math.ceil((ms - r.passou()) / 50)));

test('onda: um solitário e o grupo, na mesma equipe, e cada um sabe quem é', () => {
  const r = rodadaAoVivo('onda', { rede });
  const d = vista(r, 1);
  assert.equal(d.grupo.length, 3);
  assert.ok(!d.grupo.includes(d.solo));
  assert.deepEqual(r.rodada.publico(1).equipes, [[d.solo], d.grupo]);
  assert.equal((r.rodada.publico(d.grupo[0]).dados as { turma: { eu: number } }).turma.eu, d.grupo[0]);
});

test('onda: com 200 a 300 ms de rede, quem pula na hora fica, quem não pula cai, e o grupo ganha junto', () => {
  const r = rodadaAoVivo('onda', { rede });
  const { solo, grupo } = vista(r, 1);
  const [ana, bia, caio] = grupo;
  // o solitário rema quatro vezes; cada onda sai quando a remada CHEGA ao servidor
  const remadas = [2000, 4500, 7000, 9500];
  const tipos = [0, 1, 0, 1];
  const eventos: [number, () => void][] = [];
  remadas.forEach((s, k) => eventos.push([s - rede.get(solo)! / 2, () => r.mandar(solo, { onda: tipos[k] })]));
  for (const [k, s] of remadas.entries()) {
    // a onda passa pela jangada em A; quem pula a ~300 ms dela, na tela dele (que anda uns 100 ms atrás do servidor)
    const a = s + (tipos[k] ? VIAGEM_LENTA : VIAGEM_RAPIDA);
    for (const quem of [ana, bia, caio]) {
      // o Caio esquece a terceira onda
      if (quem === caio && k === 2) continue;
      const naTela = a - 300;
      eventos.push([naTela + 100, () => r.mandar(quem, { pulo: naTela })]);
    }
  }
  for (const [t, f] of eventos.sort((x, y) => x[0] - y[0])) {
    ate(r, t);
    f();
  }
  ate(r, 12_000);
  assert.equal(vista(r, solo).ondas.length, 4);
  // os quadros levaram as ondas e os pulos a todos
  const q = r.ultimo().q as QuadroOnda;
  assert.equal(q.ondas.length, 4);
  assert.equal(q.pulos[ana].length, 4);
  ate(r, ONDA_MS + 120);
  for (const id of [solo, ...grupo]) r.rodada.acao(id, { tipo: 'resultado' });
  assert.equal(r.fase(), 'revelando');
  for (const id of grupo) {
    assert.equal(r.linhaDe(id).posicao, 1, `${id} ganhou com o grupo`);
    assert.equal(r.linhaDe(id).valor, 1, 'um caiu');
  }
  assert.equal(r.linhaDe(solo).posicao, null);
  assert.equal(r.linhaDe(solo).pontos, 0);
});

test('onda: se todos caem, o solitário ganha sozinho', () => {
  const r = rodadaAoVivo('onda', { rede });
  const { solo, grupo } = vista(r, 1);
  ate(r, 2000);
  r.mandar(solo, { onda: 0 });
  // só um pula, tarde demais (já no meio da passagem)
  ate(r, 2200 + VIAGEM_RAPIDA);
  r.mandar(grupo[0], { pulo: 2050 + VIAGEM_RAPIDA });
  ate(r, ONDA_MS + 100);
  for (const id of [solo, ...grupo]) r.rodada.acao(id, { tipo: 'resultado' });
  assert.equal(r.linhaDe(solo).posicao, 1);
  assert.equal(r.linhaDe(solo).valor, 3);
  for (const id of grupo) assert.equal(r.linhaDe(id).pontos, 0);
});

test('onda: a trapaça óbvia não vale', () => {
  const r = rodadaAoVivo('onda', { rede });
  const { solo, grupo } = vista(r, 1);
  const [ana, bia] = grupo;
  // antes da primeira remada, nada; duas ondas chegando juntas: a segunda não sai; o grupo não rema
  ate(r, PRIMEIRA_REMADA - 300);
  r.mandar(solo, { onda: 0 });
  ate(r, 3000);
  r.mandar(solo, { onda: 1 });
  ate(r, 3000 + VIAGEM_LENTA - VIAGEM_RAPIDA + 200);
  r.mandar(solo, { onda: 0 });
  r.mandar(ana, { onda: 0 });
  ate(r, 4000);
  assert.equal(vista(r, solo).ondas.length, 1, 'só a onda lenta');
  // o pulo com o instante de 1,5 s atrás (depois de ver a onda passar) não vale; nem dois pulos encostados
  const a = vista(r, solo).ondas[0].l + VIAGEM_LENTA;
  ate(r, a - 600);
  r.mandar(bia, { pulo: a - 700 });
  r.mandar(bia, { pulo: a - 300 });
  ate(r, a + 1500);
  r.mandar(ana, { pulo: a - 300 });
  // a onda que chegaria depois do fim não sai
  ate(r, ONDA_MS - 1000);
  r.mandar(solo, { onda: 1 });
  ate(r, ONDA_MS - 900);
  assert.equal(vista(r, solo).ondas.length, 1);
  // o fim mandado cedo não vale
  r.rodada.acao(grupo[2], { tipo: 'resultado' });
  r.ateRevelar();
  assert.equal(r.linhaDe(grupo[2]).motivo, 'invalido');
  // todos caíram na única onda: o solitário ganha
  assert.equal(r.linhaDe(solo).posicao, 1);
  assert.equal(r.linhaDe(solo).valor, 3);
});

test('onda: com robôs, o robô faz qualquer papel, e o resultado de todos bate', () => {
  for (let s = 1; s <= 12; s++) {
    const r = rodadaAoVivo('onda', { rede: new Map([[1, 200]]), robos: [-1, -2, -3], aleatorio: sorteioFixo(s) });
    const d = vista(r, 1);
    const souSolo = d.solo === 1;
    // a pessoa joga o papel dela: no remo, uma onda a cada 1,1 s; na jangada, pula sempre na hora
    for (let t = 1000; t < ONDA_MS; t += 50) {
      ate(r, t);
      if (souSolo && t % 1100 === 0) r.mandar(1, { onda: 0 });
      if (!souSolo) for (const o of vista(r, 1).ondas) if (Math.abs(o.l + (o.tipo ? VIAGEM_LENTA : VIAGEM_RAPIDA) - 300 - t) < 25) r.mandar(1, { pulo: t - 100 });
    }
    assert.ok(vista(r, 1).ondas.length >= 5, `${s}: saíram ondas (${vista(r, 1).ondas.length}), com o ${souSolo ? 'pessoa' : 'robô'} no remo`);
    ate(r, ONDA_MS + 100);
    r.rodada.acao(1, { tipo: 'resultado' });
    const ganhadores = r.linhas().filter((l) => l.posicao === 1).map((l) => l.userId);
    const equipe = ganhadores.includes(d.solo) ? [d.solo] : d.grupo;
    assert.deepEqual(ganhadores.sort(), [...equipe].sort(), `${s}: ganha uma equipe inteira`);
    if (!souSolo) assert.ok(ganhadores.includes(1), `${s}: quem pula sempre na hora não cai, e o grupo ganha`);
  }
});
