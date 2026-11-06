/** O tambor da turma (festa/tambor.ts): cada um repete a batida inteira no ritmo e acrescenta uma; errar tira da roda. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rodadaDeTeste, sorteioFixo } from './festa-ajuda.js';
import { conferirVez, type Batida, type VistaTambor } from '../src/festa/tambor.js';
import { JUNTAR_MS } from '../src/festa/lote4-turma.js';

const ANA = 1;
const BIA = 2;
const CAIO = 3;
type R = ReturnType<typeof rodadaDeTeste>;

const vista = (r: R, q: number) => r.rodada.publico(q).dados as VistaTambor;

/** Toca a batida guardada com um pequeno desvio de ritmo e acrescenta `nova`, depois de ouvir (o pedido chega `rede` ms depois). */
function tocar(r: R, quem: number, rede: number, nova: number, desvio = 30, errar = false) {
  const v = vista(r, quem);
  const batidas: { tambor: number; ms: number }[] = [];
  let ms = 0;
  v.batida.forEach((b, k) => {
    ms += k === 0 ? 0 : b.gap + (k % 2 ? desvio : -desvio);
    batidas.push({ tambor: errar && k === v.batida.length - 1 ? (b.tambor + 1) % 3 : b.tambor, ms });
  });
  ms += v.batida.length === 0 ? 0 : 400;
  batidas.push({ tambor: nova, ms });
  // a tela começa a tocar meio segundo depois de a vez chegar, e manda no fim
  r.avancar(rede / 2 + 500 + ms + rede / 2);
  r.rodada.acao(quem, { tipo: 'acerto', n: v.n, batidas });
}

function comecar(quem: number[], semente = 3) {
  const r = rodadaDeTeste('tambor', { rede: new Map(quem.map((q, k) => [q, 200 + 50 * k])), aleatorio: sorteioFixo(semente) });
  r.em(150);
  for (const q of quem) r.rodada.acao(q, { tipo: 'acerto', entrar: 1 });
  r.em(JUNTAR_MS);
  r.andar();
  return r;
}
const daVez = (r: R, quem: number[]) => quem.find((q) => vista(r, q).eu === vista(r, q).vez)!;

test('tambor: a batida cresce de vez em vez, e quem erra o tambor sai; fica quem sobrar', () => {
  const turma = [ANA, BIA, CAIO];
  const r = comecar(turma);
  const rede = new Map([[ANA, 200], [BIA, 250], [CAIO, 300]]);
  let primeiroAErrar: number | null = null;
  for (let volta = 0; volta < 12 && r.rodada.publico(ANA).fase === 'jogando'; volta++) {
    if (vista(r, ANA).etapa === 'ouvir') r.andar();
    const q = daVez(r, turma);
    // o Caio erra na terceira volta dele
    const errar = q === CAIO && vista(r, q).batida.length >= 6;
    if (errar) primeiroAErrar ??= q;
    tocar(r, q, rede.get(q)!, volta % 3, 30, errar);
    if (volta >= 9 && q === BIA) {
      // a Bia demora: o tempo dela acaba
      break;
    }
  }
  // anda até o fim
  for (let k = 0; k < 20 && r.rodada.publico(ANA).fase === 'jogando'; k++) r.andar();
  assert.equal(r.rodada.publico(ANA).fase, 'revelando');
  assert.equal(primeiroAErrar, CAIO);
  const linhas = r.linhas();
  assert.ok(linhas.every((l) => l.motivo === null));
  assert.equal(r.linhaDe(CAIO).posicao, 3, 'o Caio saiu primeiro');
});

test('tambor: o ritmo errado, a ordem trocada, ou uma vez mais longa do que o tempo que passou não valem', () => {
  const guardada: Batida[] = [{ tambor: 0, gap: 0 }, { tambor: 1, gap: 500 }, { tambor: 2, gap: 300 }];
  assert.ok(conferirVez(guardada, [{ tambor: 0, ms: 0 }, { tambor: 1, ms: 540 }, { tambor: 2, ms: 830 }, { tambor: 0, ms: 1200 }]));
  assert.equal(conferirVez(guardada, [{ tambor: 0, ms: 0 }, { tambor: 1, ms: 900 }, { tambor: 2, ms: 1200 }, { tambor: 0, ms: 1600 }]), null, 'ritmo');
  assert.equal(conferirVez(guardada, [{ tambor: 0, ms: 0 }, { tambor: 2, ms: 500 }, { tambor: 1, ms: 800 }, { tambor: 0, ms: 1200 }]), null, 'ordem');
  assert.equal(conferirVez(guardada, [{ tambor: 0, ms: 0 }, { tambor: 1, ms: 500 }, { tambor: 2, ms: 800 }]), null, 'faltou a nova');
  assert.equal(conferirVez(guardada, [{ tambor: 0, ms: 0 }, { tambor: 1, ms: 500 }, { tambor: 2, ms: 800 }, { tambor: 0, ms: 4000 }]), null, 'pausa longa');

  const r = comecar([ANA]);
  const v = vista(r, ANA);
  assert.equal(v.etapa, 'tocar');
  r.avancar(300);
  // diz ter tocado 3 s em 0,3 s
  r.rodada.acao(ANA, { tipo: 'acerto', n: v.n, batidas: [{ tambor: 0, ms: 0 }, { tambor: 1, ms: 3000 }].slice(0, 1).map((b) => ({ ...b, ms: 0 })) });
  assert.equal(vista(r, ANA).batida.length, 1, 'a primeira, sozinha, vale');
  r.andar();
  const v2 = vista(r, ANA);
  assert.equal(v2.etapa, 'tocar');
  r.avancar(200);
  r.rodada.acao(ANA, { tipo: 'acerto', n: v2.n, batidas: [{ tambor: 0, ms: 0 }, { tambor: 1, ms: 1400 }] });
  assert.equal(vista(r, ANA).turma[0].fora, true, 'mais longa do que o que passou');
  r.ateRevelar();
  assert.equal(r.linhaDe(ANA).valor, 1);
});

test('tambor: quem não está na vez não toca', () => {
  const r = comecar([ANA, BIA], 5);
  const fora = vista(r, ANA).vez === vista(r, ANA).eu ? BIA : ANA;
  r.avancar(800);
  r.rodada.acao(fora, { tipo: 'acerto', n: vista(r, fora).n, batidas: [{ tambor: 0, ms: 0 }] });
  assert.equal(vista(r, ANA).batida.length, 0);
});
