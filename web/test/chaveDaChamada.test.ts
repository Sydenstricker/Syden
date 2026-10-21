import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ChamadaCifrada, type ChavesDaChamada } from '../src/chaveDaChamada';

/**
 * Duas, três pessoas numa sala, com um "servidor" de mentira no meio que só repassa (ou, num dos testes, tenta se
 * meter). O que se confere é o que a chamada promete: cada um recebe a chave de mídia dos outros, quem sai deixa de
 * receber a nova, e um servidor que troque as chaves públicas no caminho não consegue entregar chave nenhuma — e
 * ainda faz o código de segurança de cada um sair diferente.
 */

type Recebida = { de: string; indice: number };

function pessoa(id: string) {
  const recebidas: Recebida[] = [];
  const chaves = { definir: (_m: CryptoKey, identidade: string, indice: number) => recebidas.push({ de: identidade, indice }) };
  return { id, recebidas, chaves: chaves as unknown as ChavesDaChamada, chamada: null as ChamadaCifrada | null };
}

type Pessoa = ReturnType<typeof pessoa>;

/** A sala: entrega na ordem, como o socket, e deixa um "intermediário" mexer em cada mensagem antes de entregar. */
async function sala(nomes: string[], intermediario?: (de: string, para: string, dados: string) => string) {
  const gente = new Map(nomes.map((n) => [n, pessoa(n)]));
  const fila: Promise<void>[] = [];
  const entregar = (de: string, para: string, dados: string) => {
    const destino = gente.get(para);
    if (!destino?.chamada) return;
    const final = intermediario ? intermediario(de, para, dados) : dados;
    fila.push(destino.chamada.receber(de, final));
  };
  const esperar = async () => {
    while (fila.length) await fila.shift();
  };
  const entrar = async (p: Pessoa) => {
    p.chamada = await ChamadaCifrada.iniciar(p.chaves, p.id, '7', (para, dados) => entregar(p.id, para, dados), () => {});
    const outros = [...gente.values()].filter((o) => o !== p && o.chamada).map((o) => o.id);
    p.chamada.apresentarA(outros);
    await esperar();
  };
  for (const p of gente.values()) await entrar(p);
  return { gente, esperar };
}

const chavesDe = (p: Pessoa, de: string) => p.recebidas.filter((r) => r.de === de);

describe('a chamada de ponta a ponta', () => {
  it('cada um recebe a chave de mídia de cada outro, e a sua própria', async () => {
    const { gente } = await sala(['1', '2', '3']);
    for (const p of gente.values()) {
      for (const o of gente.values()) assert.ok(chavesDe(p, o.id).length >= 1, `${p.id} não recebeu a chave de ${o.id}`);
    }
  });

  it('todos chegam ao mesmo código de segurança', async () => {
    const { gente } = await sala(['1', '2', '3']);
    const codigos = await Promise.all([...gente.values()].map((p) => p.chamada!.codigo()));
    assert.equal(new Set(codigos).size, 1);
    assert.match(codigos[0], /^\d{4} \d{4} \d{4}$/);
  });

  it('quem sai não recebe a chave nova de quem ficou', async () => {
    const { gente, esperar } = await sala(['1', '2', '3']);
    const [um, dois, tres] = ['1', '2', '3'].map((id) => gente.get(id)!);
    const antes = chavesDe(tres, '1').length;
    tres.chamada!.encerrar();
    await um.chamada!.saiu('3');
    await dois.chamada!.saiu('3');
    await esperar();
    const novaDoUm = chavesDe(um, '1').at(-1)!;
    // O 2 recebeu a chave nova do 1 (o índice seguinte); o 3, nada além do que tinha.
    assert.equal(chavesDe(dois, '1').at(-1)!.indice, novaDoUm.indice);
    assert.notEqual(chavesDe(dois, '1')[0].indice, novaDoUm.indice);
    assert.equal(chavesDe(tres, '1').length, antes);
  });

  it('quem entra recebe só a chave nova, nunca a de antes de chegar', async () => {
    const { gente } = await sala(['1', '2', '3']);
    const [um, tres] = [gente.get('1')!, gente.get('3')!];
    // O 1 trocou a chave quando o 3 entrou; os índices que o 3 recebeu do 1 são só os de depois.
    const doUm = chavesDe(um, '1').map((r) => r.indice);
    const recebidasPeloTres = chavesDe(tres, '1').map((r) => r.indice);
    assert.ok(doUm.length >= 3, 'o 1 trocou de chave a cada um que entrou');
    assert.deepEqual(recebidasPeloTres, [doUm.at(-1)]);
  });

  it('um servidor que troca as chaves públicas no caminho não entrega chave nenhuma, e os códigos não batem', async () => {
    // O "servidor" põe a SUA chave pública no lugar da de cada um. Sem a privada correspondente, ele não abre o que
    // vem embrulhado para ele — e quem recebe a dele embrulha para ele, não para o outro.
    const falso = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
    const pubFalsa = btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.exportKey('raw', falso.publicKey))));
    const { gente } = await sala(['1', '2'], (_de, _para, dados) => {
      const msg = JSON.parse(dados);
      return msg.t === 'ola' ? JSON.stringify({ ...msg, pub: pubFalsa }) : dados;
    });
    const [um, dois] = [gente.get('1')!, gente.get('2')!];
    assert.equal(chavesDe(um, '2').length, 0);
    assert.equal(chavesDe(dois, '1').length, 0);
    assert.notEqual(await um.chamada!.codigo(), await dois.chamada!.codigo());
  });

  it('uma troca perdida no caminho se recupera com o reencontrar', async () => {
    const { gente, esperar } = await sala(['1', '2', '3']);
    const [um, dois] = [gente.get('1')!, gente.get('2')!];
    // o 3 sai; a chave nova do 2 para o 1 se "perde" (como num socket caído): o 1 fica com a velha
    const chamada2 = dois.chamada!;
    const mandarOriginal = (chamada2 as unknown as { enviar: (p: string, d: string) => void }).enviar;
    (chamada2 as unknown as { enviar: (p: string, d: string) => void }).enviar = () => {};
    await chamada2.saiu('3');
    (chamada2 as unknown as { enviar: (p: string, d: string) => void }).enviar = mandarOriginal;
    await um.chamada!.saiu('3');
    await esperar();
    const atualDoDois = chavesDe(dois, '2').at(-1)!.indice;
    assert.notEqual(chavesDe(um, '2').at(-1)!.indice, atualDoDois, 'o 1 ficou com a chave velha do 2');
    await chamada2.reencontrar(['1']);
    await esperar();
    assert.equal(chavesDe(um, '2').at(-1)!.indice, atualDoDois);
  });

  it('mensagem estragada não derruba nada', async () => {
    const { gente } = await sala(['1', '2']);
    const um = gente.get('1')!;
    await um.chamada!.receber('2', 'isto não é json');
    await um.chamada!.receber('2', JSON.stringify({ v: 1, t: 'chave', idx: 99, iv: 'AA==', ct: 'AA==' }));
    await um.chamada!.receber('2', JSON.stringify({ v: 1, t: 'chave', idx: 0, iv: 'AAAAAAAAAAAAAAAA', ct: 'AAAA' }));
    assert.ok(chavesDe(um, '2').length >= 1);
  });
});
