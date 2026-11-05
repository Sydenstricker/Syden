/**
 * Tocas e Torres (minijogo-tocas.ts): a partida é do site, e o servidor só dá a semente e confere o fim (uma vez, só no Solo, os
 * passos contra o relógio, e a vitória com tempo de jogo de verdade). O relógio aqui é de mão.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { criarTocas, PASSOS_MAX, PRAZO_MS, VITORIA_MIN_PASSOS } from '../src/minijogo-tocas.js';

interface Estado {
  fase: string;
  semente: number;
  partidaId: string;
  resultado: { venceu: boolean; motivo: string; passos: number } | null;
}

function comecar({ solo = true, naSala = [7] }: { solo?: boolean; naSala?: number[] } = {}) {
  let agora = 5_000_000;
  const relogio: { ms: number; depois: () => void }[] = [];
  let terminou: boolean | null = null;
  const ctx = {
    agendar: (ms: number, depois: () => void) => relogio.splice(0, relogio.length, { ms, depois }),
    avisar: () => {},
    terminar: (completa = true) => (terminou = completa),
    naSala: () => naSala,
    nome: () => 'ana',
    comunidade: 0,
    solo,
  };
  const jogo = criarTocas({ agora: () => agora, sorteio: () => 0.25 }).comecar(ctx, { naSala, criadaPor: naSala[0], corpo: {} });
  return {
    jogo,
    estado: () => (typeof jogo === 'string' ? null : (jogo.publico(naSala[0]) as unknown as Estado)),
    passar: (ms: number) => (agora += ms),
    terminou: () => terminou,
    prazo: () => relogio[0].depois(),
  };
}

const seg = (n: number) => n * 1000;

test('só no Solo, e de uma pessoa só', () => {
  assert.equal(typeof comecar({ solo: false }).jogo, 'string');
  assert.equal(typeof comecar({ naSala: [1, 2] }).jogo, 'string');
  const p = comecar();
  assert.ok(typeof p.jogo !== 'string');
  const e = p.estado()!;
  assert.equal(e.fase, 'jogando');
  assert.ok(Number.isInteger(e.semente) && e.semente > 0);
  assert.equal(e.resultado, null);
});

test('a vitória pede tempo de jogo, e os passos não passam do relógio', () => {
  const p = comecar();
  const jogo = p.jogo as Exclude<typeof p.jogo, string>;
  // 10 minutos de passos com 1 minuto no relógio: não
  p.passar(seg(60));
  assert.equal(jogo.acao(7, { tipo: 'fim', venceu: true, motivo: 'centro', passos: 6000 }), 'Sessão inválida.');
  // ganhar em 1 minuto: não
  assert.equal(jogo.acao(7, { tipo: 'fim', venceu: true, motivo: 'centro', passos: 600 }), 'Sessão inválida.');
  assert.ok(VITORIA_MIN_PASSOS > 600);
  // lixo
  assert.equal(jogo.acao(7, { tipo: 'fim', venceu: 'sim', motivo: 'centro', passos: 600 }), 'Sessão inválida.');
  assert.equal(jogo.acao(7, { tipo: 'fim', venceu: true, motivo: 'magia', passos: 600 }), 'Sessão inválida.');
  assert.equal(jogo.acao(7, { tipo: 'fim', venceu: true, motivo: 'centro', passos: 1.5 }), 'Sessão inválida.');
  assert.equal(jogo.acao(7, { tipo: 'outra' }), 'Ação desconhecida.');
  assert.equal(jogo.acao(8, { tipo: 'fim', venceu: true, motivo: 'centro', passos: 6000 }), 'Você está assistindo esta partida.');
  // dez minutos depois (a janela sem foco pode ter pausado: mais relógio que passos vale)
  p.passar(seg(12 * 60));
  assert.equal(jogo.acao(7, { tipo: 'fim', venceu: true, motivo: 'centro', passos: 6000 }), null);
  assert.deepEqual(p.estado()!.resultado, { venceu: true, motivo: 'centro', passos: 6000 });
  assert.equal(p.estado()!.fase, 'fim');
  assert.equal(p.terminou(), true);
  // uma vez só
  assert.equal(jogo.acao(7, { tipo: 'fim', venceu: true, motivo: 'centro', passos: 6000 }), 'Esta rodada já acabou.');
});

test('perder, desistir e o teto do tempo', () => {
  const a = comecar();
  const ja = a.jogo as Exclude<typeof a.jogo, string>;
  a.passar(seg(30));
  assert.equal(ja.acao(7, { tipo: 'desistir', passos: 250 }), null);
  assert.deepEqual(a.estado()!.resultado, { venceu: false, motivo: 'desistiu', passos: 250 });

  const b = comecar();
  const jb = b.jogo as Exclude<typeof b.jogo, string>;
  b.passar(seg(25 * 60));
  // o "tempo" só vale no teto
  assert.equal(jb.acao(7, { tipo: 'fim', venceu: true, motivo: 'tempo', passos: 9000 }), 'Sessão inválida.');
  assert.equal(jb.acao(7, { tipo: 'fim', venceu: false, motivo: 'tempo', passos: PASSOS_MAX + 1 }), 'Sessão inválida.');
  assert.equal(jb.acao(7, { tipo: 'fim', venceu: false, motivo: 'tempo', passos: PASSOS_MAX }), null);
  assert.equal(b.estado()!.resultado!.venceu, false);
});

test('ninguém volta: o prazo fecha a partida como interrompida', () => {
  const p = comecar();
  p.passar(PRAZO_MS);
  p.prazo();
  assert.equal(p.estado()!.fase, 'fim');
  assert.equal(p.terminou(), false);
});
