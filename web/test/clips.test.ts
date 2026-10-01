import assert from 'node:assert/strict';
import { describe, it, afterEach } from 'node:test';

// A GRAVAÇÃO EM ROLAGEM, COM UM MediaRecorder DE MENTIRA.
//
// POR QUE VALE UM TESTE. O defeito que motivou este arquivo não se vê olhando: apertar a tesoura não
// abria nada, não dava erro, não deixava rastro. E só acontecia quando o clique caía em cima do
// fechamento automático de trinta em trinta segundos — uma janela de alguns milissegundos a cada
// meio minuto, que ninguém reproduz de propósito.
//
// O dublê abaixo é o mínimo que o clips.ts usa: `start`, `stop`, `state`, `ondataavailable` e
// `onstop`. Ele entrega os bytes de forma ASSÍNCRONA, como o navegador faz — se entregasse na hora,
// a corrida desapareceria e o teste passaria sem medir nada.

class GravadorDeMentira {
  static isTypeSupported = () => true;
  static criados: GravadorDeMentira[] = [];

  state: 'inactive' | 'recording' = 'inactive';
  ondataavailable: ((e: { data: { size: number } }) => void) | null = null;
  onstop: (() => void) | null = null;

  constructor() {
    GravadorDeMentira.criados.push(this);
  }

  start() {
    this.state = 'recording';
  }

  stop() {
    // O estado vira 'inactive' NA HORA, e os eventos chegam depois. É esse descompasso que abre a
    // janela da corrida no navegador de verdade, e é por isso que ele está reproduzido aqui.
    this.state = 'inactive';
    queueMicrotask(() => {
      this.ondataavailable?.({ data: { size: 1234 } });
      this.onstop?.();
    });
  }
}

class BlobDeMentira {
  size = 1234;
  constructor(
    public partes: unknown[],
    public opcoes: { type: string },
  ) {}
}

const stream = { getVideoTracks: () => [{}] } as unknown as MediaStream;

const original = {
  MediaRecorder: (globalThis as Record<string, unknown>).MediaRecorder,
  Blob: (globalThis as Record<string, unknown>).Blob,
};

function montarOAmbiente() {
  GravadorDeMentira.criados = [];
  (globalThis as Record<string, unknown>).MediaRecorder = GravadorDeMentira;
  (globalThis as Record<string, unknown>).Blob = BlobDeMentira;
}

afterEach(() => {
  (globalThis as Record<string, unknown>).MediaRecorder = original.MediaRecorder;
  (globalThis as Record<string, unknown>).Blob = original.Blob;
});

/** O módulo lê `MediaRecorder` do ambiente ao rodar, então ele é importado depois do dublê estar posto. */
async function carregar() {
  montarOAmbiente();
  return import('../src/clips');
}

describe('a gravação em rolagem', () => {
  it('entrega um clipe quando se pede', async () => {
    const { gravarEmRolagem } = await carregar();
    const rolando = gravarEmRolagem(stream);
    assert.ok(rolando, 'devia ter começado a gravar');
    const clipe = await rolando.pegar();
    assert.ok(clipe, 'devia ter devolvido um clipe');
    rolando.parar();
  });

  // ESTE É O TESTE DO DEFEITO. Dois fechamentos ao mesmo tempo: o automático e o da pessoa.
  // O PRAZO NÃO É ENFEITE: no código antigo uma das duas promessas NUNCA se resolvia (o segundo
  // fechar() sobrescrevia o onstop do primeiro), então o teste não falhava — ele PENDURAVA. Teste
  // pendurado some no meio da saída e parece lentidão. Com prazo, ele reprova e diz o que houve.
  it('dois pedidos ao mesmo tempo devolvem clipe nos dois, e não null num deles', { timeout: 5000 }, async () => {
    const { gravarEmRolagem } = await carregar();
    const rolando = gravarEmRolagem(stream);
    assert.ok(rolando);

    // Sem esperar o primeiro: é exatamente o que acontece quando o clique cai em cima do relógio.
    const [um, dois] = await Promise.all([rolando.pegar(), rolando.pegar()]);

    assert.ok(um, 'o primeiro pedido voltou vazio');
    assert.ok(dois, 'o segundo pedido voltou vazio — era o defeito: o botão não fazia nada');
    rolando.parar();
  });

  it('não deixa dois gravadores rodando na mesma transmissão', async () => {
    const { gravarEmRolagem } = await carregar();
    const rolando = gravarEmRolagem(stream);
    assert.ok(rolando);

    await Promise.all([rolando.pegar(), rolando.pegar()]);
    const gravando = GravadorDeMentira.criados.filter((g) => g.state === 'recording');
    assert.equal(gravando.length, 1, `ficaram ${gravando.length} gravadores ligados`);
    rolando.parar();
  });

  it('parar desliga tudo', async () => {
    const { gravarEmRolagem } = await carregar();
    const rolando = gravarEmRolagem(stream);
    assert.ok(rolando);
    rolando.parar();
    assert.equal(await rolando.pegar(), null);
    assert.equal(GravadorDeMentira.criados.filter((g) => g.state === 'recording').length, 0);
  });

  it('sem faixa de vídeo não há o que clipar', async () => {
    const { gravarEmRolagem } = await carregar();
    const semVideo = { getVideoTracks: () => [] } as unknown as MediaStream;
    assert.equal(gravarEmRolagem(semVideo), null);
  });
});
