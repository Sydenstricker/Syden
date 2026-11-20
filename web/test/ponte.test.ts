/**
 * A Ponte da toca (web/src/ponte/sim.ts): a regra é a mesma do servidor (server/src/ponte-sim.ts), que refaz a simulação a partir
 * da lista de peças. Aqui: as duas cópias iguais e sem trigonometria, o determinismo, a ponte de referência de cada fase passando e
 * a fraca caindo, a conferência da lista e a ordem do placar.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  ACO,
  BARCO_EM,
  CABO,
  comparar,
  conferir,
  custo,
  faseDe,
  FASES,
  FECHA_EM,
  FECHADA_EM,
  LEVADICA,
  MADEIRA,
  montar,
  passo,
  PASSO,
  PISTA,
  pontePronta,
  SAIDA,
  selosDe,
  semSoltas,
  simular,
  temCanal,
} from '../src/ponte/sim';
import { Fila, filaInicial, fimDaFila, naFila } from '../src/ponte/fila';
import { MODELOS_DA_PONTE } from '../src/ponte/vista';

/** Só a pista, de margem a margem: sem estrutura nenhuma. */
function soPista(largura: number): number[] {
  const p: number[] = [];
  for (let x = 0; x < largura; x += 2) p.push(x, 0, x + 2, 0, PISTA);
  return p;
}

describe('ponte da toca', () => {
  it('as duas cópias da regra são iguais, e a regra não usa seno, cosseno nem o relógio', () => {
    const site = readFileSync(new URL('../src/ponte/sim.ts', import.meta.url));
    const servidor = readFileSync(new URL('../../server/src/ponte-sim.ts', import.meta.url));
    assert.ok(site.equals(servidor), 'web/src/ponte/sim.ts e server/src/ponte-sim.ts mudaram separados: copie uma sobre a outra');
    const texto = site.toString();
    for (const proibido of ['Math.sin', 'Math.cos', 'Math.tan', 'Math.atan', 'Math.exp', 'Math.log', 'Math.pow', 'Math.random', 'Date.now', 'performance'])
      assert.ok(!texto.includes(proibido), proibido);
  });

  it('a ponte de referência de cada fase é válida e PASSA; só a pista, sem estrutura, cai', () => {
    for (const f of FASES) {
      const boa = pontePronta(f);
      assert.equal(conferir(f, boa), null, f.id);
      const r = simular(f, boa);
      assert.equal(r.passou, true, `${f.id}: a de referência não passou`);
      assert.equal(r.progresso, 1000);
      assert.equal(r.custo, custo(boa));
      const fraca = simular(f, soPista(f.largura));
      assert.equal(fraca.passou, false, `${f.id}: só a pista passou`);
      assert.ok(fraca.progresso < 1000);
    }
  });

  it('a mesma lista dá sempre o mesmo resultado, passo a passo', () => {
    const f = faseDe('ravina')!;
    // a de referência com madeira no lugar do aço: ela quebra no meio, e a quebra também tem de ser a mesma
    const lista = pontePronta(f).map((v, i) => (i % 5 === 4 && v === ACO ? MADEIRA : v));
    const valida = semSoltas(f, lista);
    const a = montar(f, valida);
    const b = montar(f, valida);
    while (!a.terminou) {
      passo(a);
      passo(b);
    }
    assert.equal(b.terminou, true);
    assert.equal(a.passo, b.passo);
    assert.equal(a.passou, b.passou);
    assert.equal(a.progresso, b.progresso);
    for (let i = 0; i < a.nos.length; i++) {
      assert.equal(a.nos[i].x, b.nos[i].x);
      assert.equal(a.nos[i].y, b.nos[i].y);
    }
    assert.deepEqual(
      a.barras.map((x) => x.inteira),
      b.barras.map((x) => x.inteira),
    );
  });

  it('a madeira sozinha não segura os vãos grandes: o caminhão pede aço', () => {
    const f = faseDe('pedra')!;
    const soMadeira: number[] = [];
    const boa = pontePronta(f);
    for (let i = 0; i < boa.length; i += 5) {
      const peca = boa.slice(i, i + 5);
      if (peca[4] === ACO && conferir(f, [...soMadeira, peca[0], peca[1], peca[2], peca[3], MADEIRA]) !== null) continue;
      soMadeira.push(peca[0], peca[1], peca[2], peca[3], peca[4] === ACO ? MADEIRA : peca[4]);
    }
    const r = simular(f, semSoltas(f, soMadeira));
    assert.equal(r.passou, false);
  });

  it('a conferência recusa o que está fora da regra', () => {
    const f = faseDe('riacho')!;
    assert.equal(conferir(f, []), null, 'a ponte vazia é válida (e cai)');
    assert.equal(conferir(f, [0, 0, 2, 0, PISTA]), null);
    assert.equal(conferir(f, [0, 0, 2, 0]), 'formato');
    assert.equal(conferir(f, [0, 0, 2, 0, 9]), 'tipo');
    assert.equal(conferir(f, [0, 0, -1, 0, MADEIRA]), 'fora-da-grade');
    assert.equal(conferir(f, [0, 0, 0, 1, MADEIRA]), 'fora-da-grade', 'a coluna da margem só tem as âncoras');
    assert.equal(conferir(f, [0, 0, 3, 0, PISTA]), 'comprimento');
    assert.equal(conferir(f, [0, 0, 1, 2, PISTA]), 'comprimento', 'a pista não passa de 45°');
    assert.equal(conferir(f, [0, 0, 1, 2, MADEIRA]), null, 'a madeira pode');
    assert.equal(conferir(f, [0, 0, 3, 2, ACO]), null, 'o aço vai mais longe');
    assert.equal(conferir(f, [0, 0, 2, 0, PISTA, 2, 0, 0, 0, MADEIRA]), 'repetida');
    assert.equal(conferir(f, [2, 1, 3, 1, MADEIRA]), 'solta');
    assert.equal(conferir(f, [0, 0, 1, 1, MADEIRA, 3, 1, 4, 1, MADEIRA]), 'solta');
  });

  it('o que fica solto cai junto (a montagem tira)', () => {
    const f = faseDe('riacho')!;
    const lista = [0, 0, 1, 1, MADEIRA, 1, 1, 2, 1, MADEIRA, 4, 1, 5, 1, MADEIRA];
    assert.deepEqual(semSoltas(f, lista), [0, 0, 1, 1, MADEIRA, 1, 1, 2, 1, MADEIRA]);
  });

  it('o custo é o preço × o comprimento, e o placar põe quem passou na frente, pelo menor custo', () => {
    assert.equal(custo([0, 0, 2, 0, PISTA]), 300);
    assert.equal(custo([0, 0, 1, 1, MADEIRA]), 141);
    assert.equal(custo([0, 0, 3, 2, ACO]), 1082);
    const a = { passou: true, progresso: 1000, custo: 3000 };
    const b = { passou: true, progresso: 1000, custo: 2500 };
    const c = { passou: false, progresso: 800, custo: 900 };
    const d = { passou: false, progresso: 300, custo: 100 };
    assert.deepEqual([a, c, d, b].sort(comparar), [b, a, c, d]);
  });
  it('a fila do desenho: o tráfego espera na ordem, encostado, e chega à saída antes de a regra soltar cada um (nada pula)', () => {
    for (const f of FASES) {
      const x = filaInicial(f);
      assert.equal(x.length, f.trafego.length);
      assert.equal(x[0], SAIDA, `${f.id}: o primeiro espera na saída`);
      for (let i = 1; i < x.length; i++) assert.ok(x[i] < x[i - 1], `${f.id}: o ${i}º atrás do da frente`);
      assert.ok(fimDaFila(f) < x[x.length - 1]);
      const s = montar(f, pontePronta(f));
      const fila = new Fila(f);
      let antes = fila.atualizar(s, 0).slice();
      while (!s.terminou) {
        const eraFila = s.veiculos.map((_, i) => naFila(s, i));
        passo(s);
        const agora = fila.atualizar(s, PASSO).slice();
        s.veiculos.forEach((v, i) => {
          // quem a regra acabou de soltar já estava na saída, e ninguém anda para trás
          if (eraFila[i] && !naFila(s, i)) assert.ok(Math.abs(antes[i] - SAIDA) < 1e-9, `${f.id}: o ${i}º pulou de ${antes[i]} para ${v.x}`);
          assert.ok(agora[i] >= antes[i] - 1e-9, `${f.id}: o ${i}º andou para trás`);
        });
        antes = agora;
      }
    }
  });

  it('os veículos 3D estão em web/public/ponte, com as texturas e as licenças', () => {
    const pasta = new URL('../public/ponte/', import.meta.url);
    for (const m of MODELOS_DA_PONTE) {
      assert.ok(existsSync(new URL(m, pasta)), `falta ${m}`);
      let json: { images?: { uri?: string }[]; buffers?: { uri?: string }[] };
      const b = readFileSync(new URL(m, pasta));
      if (m.endsWith('.glb')) json = JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString());
      else json = JSON.parse(b.toString());
      for (const u of [...(json.images ?? []), ...(json.buffers ?? [])].map((i) => i.uri).filter(Boolean) as string[])
        assert.ok(existsSync(new URL(u, pasta)), `${m} pede ${u}`);
    }
    for (const l of ['LICENCA-Kenney-Car-Kit.txt', 'LICENCA-KayKit-Halloween-Bits.txt'])
      assert.match(readFileSync(new URL(l, pasta), 'utf8'), /Creative Commons Zero, CC0/, l);
  });

  // ===== 19/11/2026: as fases novas, o orçamento com os selos e o cabo =====

  it('17 fases, ids diferentes, cada uma com o orçamento acima da ponte mais barata que a busca achou', () => {
    assert.equal(FASES.length, 17);
    assert.equal(new Set(FASES.map((f) => f.id)).size, 17);
    for (const f of FASES) assert.ok(f.orcamento > 0 && f.orcamento % 100 === 0, f.id);
  });

  it('os selos: 0 sem passar, 1 passando, 2 no orçamento, 3 com até 3/4 dele', () => {
    const f = faseDe('riacho')!;
    assert.equal(selosDe(f, { passou: false, custo: 1 }), 0);
    assert.equal(selosDe(f, { passou: true, custo: f.orcamento + 1 }), 1);
    assert.equal(selosDe(f, { passou: true, custo: f.orcamento }), 2);
    assert.equal(selosDe(f, { passou: true, custo: (f.orcamento * 3) / 4 }), 3);
  });

  it('o vale com 3 selos: a ponte que a busca achou (com cabos) passa, e o servidor confere igual', () => {
    const f = faseDe('vale')!;
    const p = [0,0,2,0,0,2,0,4,0,0,4,0,6,0,0,6,0,8,0,0,8,0,10,0,0,3,2,5,2,2,5,2,7,2,2,7,2,9,2,2,2,0,3,2,2,3,2,4,0,3,4,0,5,2,1,5,2,6,0,3,6,0,7,2,3,7,2,8,0,1,8,0,9,2,3,9,2,10,0,2,0,-3,2,0,2];
    assert.equal(conferir(f, p), null);
    const r = simular(f, p);
    assert.ok(r.passou);
    assert.equal(selosDe(f, r), 3);
    assert.ok(p.some((v, i) => i % 5 === 4 && v === CABO), 'usa cabo');
  });

  it('o cabo só puxa: pendurado de um apoio alto ele segura; escorando por baixo, não faz força', () => {
    const pendurado = montar(faseDe('pilares')!, [...soPista(10), 0, 3, 2, 0, CABO]);
    for (let i = 0; i < 40; i++) passo(pendurado);
    const cabo = pendurado.barras[pendurado.barras.length - 1];
    assert.ok(cabo.forca > 0, 'puxando');
    const escora = montar(faseDe('riacho')!, [...soPista(6), 0, -2, 2, 0, CABO]);
    for (let i = 0; i < 40; i++) passo(escora);
    const e = escora.barras[escora.barras.length - 1];
    assert.ok(e.forca >= 0, 'nunca empurra');
    // trocado por madeira, a mesma escora empurra
    const madeira = montar(faseDe('riacho')!, [...soPista(6), 0, -2, 2, 0, MADEIRA]);
    for (let i = 0; i < 40; i++) passo(madeira);
    assert.ok(madeira.barras[madeira.barras.length - 1].forca < 0, 'a madeira empurra');
  });

  // ===== 20/11/2026: a levadiça e as fases do barco =====

  it('as 15 fases de antes dão o mesmo resultado de antes da levadiça (os recordes continuam valendo)', () => {
    // a de referência de cada uma: o custo, os passos até o fim e a altura do último nó no passo 200, medidos antes da mudança
    const antes: Record<string, [number, number, number]> = {
      riacho: [3844, 361, 994391207],
      rio: [5290, 491, 1992448653],
      ravina: [12774, 589, 1991555673],
      pilares: [11458, 444, 1994663813],
      pedra: [20676, 670, -1012780208],
      arroio: [3062, 470, 996653066],
      lagoa: [8368, 340, 1985080900],
      cascata: [4310, 388, 995946602],
      brejo: [17940, 671, -2944566090],
      garganta: [15016, 548, 1989651505],
      torres: [11458, 497, 1994912747],
      ilhas: [26802, 628, -1009197213],
      vale: [12774, 577, 1991992131],
      enchente: [8368, 539, 1985080907],
      grande: [29044, 890, -1009901847],
    };
    for (const [id, [c, passos, y]] of Object.entries(antes)) {
      const f = faseDe(id)!;
      assert.equal(temCanal(f), false, id);
      const p = pontePronta(f);
      const r = simular(f, p);
      assert.deepEqual([r.custo, r.passos], [c, passos], id);
      const s = montar(f, p);
      for (let i = 0; i < 200; i++) passo(s);
      assert.equal(Math.round(s.nos[s.nos.length - 1].y * 1e9), y, id);
    }
  });

  it('a levadiça só existe nas fases do barco, e segue a regra da pista (até 45°, até ~2,2 casas)', () => {
    assert.equal(conferir(faseDe('riacho')!, [0, 0, 2, 0, LEVADICA]), 'tipo');
    const f = faseDe('canal')!;
    assert.equal(conferir(f, [0, 0, 2, 0, LEVADICA]), null);
    assert.equal(conferir(f, [0, 0, 1, 2, LEVADICA]), 'comprimento');
    assert.equal(conferir(f, [0, 0, 3, 0, LEVADICA]), 'comprimento');
    assert.equal(custo([0, 0, 2, 0, LEVADICA]), 800);
  });

  it('o barco leva o que atravessa o canal: sem a levadiça a ponte cai; com ela, abre, o barco passa, fecha e o tráfego passa', () => {
    for (const id of ['canal', 'porto']) {
      const f = faseDe(id)!;
      const boa = pontePronta(f);
      assert.ok(boa.some((v, i) => i % 5 === 4 && v === LEVADICA), id);
      // a mesma ponte com pista no lugar da levadiça: o barco a quebra no canal, e o tráfego cai
      const semLevadica = boa.map((v, i) => (i % 5 === 4 && v === LEVADICA ? PISTA : v));
      const s0 = montar(f, semLevadica);
      let quebrouNoBarco = false;
      while (!s0.terminou) {
        passo(s0);
        if (s0.passo > BARCO_EM && s0.passo <= FECHA_EM && s0.eventos.some((e) => e.tipo === 'quebrou')) quebrouNoBarco = true;
      }
      assert.ok(quebrouNoBarco, `${id}: o barco não quebrou a pista`);
      assert.equal(s0.passou, false, id);

      const s = montar(f, boa);
      assert.equal(s.travas.length, s.levadicas.length, `${id}: cada ponta presa ao nó de lá`);
      const pontaAntes = s.levadicas.map((l) => s.nos[l.ponta].y);
      while (s.passo < BARCO_EM + 10) passo(s);
      assert.equal(s.abertura, 1);
      for (const l of s.levadicas) {
        // em pé: a ponta em cima do eixo, e as travas soltas
        assert.ok(Math.abs(s.nos[l.ponta].x - s.nos[l.eixo].x) < 0.05, `${id}: a levadiça não ficou em pé`);
        assert.ok(s.nos[l.ponta].y - s.nos[l.eixo].y > 1.9);
      }
      assert.ok(s.travas.every((t) => !t.presa));
      while (s.passo < FECHADA_EM + 1) passo(s);
      assert.ok(s.travas.every((t) => t.presa), `${id}: a ponta não voltou a prender`);
      s.levadicas.forEach((l, i) => assert.ok(Math.abs(s.nos[l.ponta].y - pontaAntes[i]) < 0.05));
      assert.ok(s.veiculos.every((v) => v.x === SAIDA), `${id}: o tráfego saiu antes de fechar`);
      while (!s.terminou) passo(s);
      assert.equal(s.passou, true, id);
      assert.ok(s.barras.every((b) => b.inteira), `${id}: quebrou alguma peça`);
    }
  });

  it('a levadiça abre para os dois lados (o eixo à direita também passa), e duas pontas no mesmo ponto travam uma na outra', () => {
    const f = faseDe('canal')!;
    const virada = pontePronta(f);
    for (let i = 0; i < virada.length; i += 5)
      if (virada[i + 4] === LEVADICA) {
        virada[i] = 6;
        virada[i + 2] = 4;
      }
    assert.equal(conferir(f, virada), null);
    assert.equal(simular(f, virada).passou, true);
    // as duas metades, cada uma de um lado, se encontram no meio (sem nó comum ali): a segunda ponta trava na primeira
    const semLevadica: number[] = [];
    const boa = pontePronta(f);
    for (let i = 0; i < boa.length; i += 5) if (boa[i + 4] !== LEVADICA) semLevadica.push(...boa.slice(i, i + 5));
    const par = [...semLevadica, 4, 0, 5, 0, LEVADICA, 6, 0, 5, 0, LEVADICA];
    assert.equal(conferir(f, par), null);
    const s = montar(f, par);
    assert.equal(s.travas.length, 1);
    assert.deepEqual([s.travas[0].ponta, s.travas[0].outro], [s.levadicas[1].ponta, s.levadicas[0].ponta]);
    while (s.passo < FECHADA_EM + 1) passo(s);
    assert.equal(s.travas[0].presa, true);
  });

  it('com a levadiça, a mesma lista dá sempre o mesmo resultado, passo a passo', () => {
    const f = faseDe('porto')!;
    const lista = pontePronta(f).map((v, i) => (i % 5 === 4 && v === ACO ? MADEIRA : v));
    const a = montar(f, semSoltas(f, lista));
    const b = montar(f, semSoltas(f, lista));
    while (!a.terminou) {
      passo(a);
      passo(b);
      for (let i = 0; i < a.nos.length; i++) assert.ok(a.nos[i].x === b.nos[i].x && a.nos[i].y === b.nos[i].y);
    }
    assert.deepEqual([a.passo, a.passou, a.progresso], [b.passo, b.passou, b.progresso]);
  });
});

describe('a escolha da fase (20/11/2026)', () => {
  it('toda fase tem a marca de dificuldade, de 1 a 3', async () => {
    const { DIFICULDADE_DAS_FASES, fasesSemDificuldade } = await import('../src/ponte/escolha');
    assert.deepEqual(fasesSemDificuldade(), []);
    for (const v of Object.values(DIFICULDADE_DAS_FASES)) assert.ok(v >= 1 && v <= 3);
    for (const id of Object.keys(DIFICULDADE_DAS_FASES)) assert.ok(faseDe(id), `fase que não existe: ${id}`);
  });

  it('a última ponte de cada fase fica no aparelho, e a que não vale mais pela regra é esquecida', async () => {
    const guardado = new Map<string, string>();
    const antes = (globalThis as { localStorage?: unknown }).localStorage;
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => guardado.get(k) ?? null,
      setItem: (k: string, v: string) => void guardado.set(k, v),
    };
    try {
      const { guardarPonte, lerPonteGuardada } = await import('../src/ponte/escolha');
      const f = FASES[0];
      assert.equal(lerPonteGuardada(f.id), null);
      const ponte = pontePronta(f);
      guardarPonte(f.id, ponte);
      assert.deepEqual(lerPonteGuardada(f.id), ponte);
      // cada fase com a sua
      assert.equal(lerPonteGuardada(FASES[1].id), null);
      // estragada (ou de uma regra antiga que não confere mais): esquecida
      guardado.set(`syden:ponte:${f.id}`, '[1,2,3]');
      assert.equal(lerPonteGuardada(f.id), null);
      guardado.set(`syden:ponte:${f.id}`, 'não é json');
      assert.equal(lerPonteGuardada(f.id), null);
    } finally {
      (globalThis as { localStorage?: unknown }).localStorage = antes;
    }
  });
});
