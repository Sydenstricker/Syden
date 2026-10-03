/**
 * COMO A CAPA SE ENCAIXA — a parte do GIF que não cabia.
 *
 * O relato foi "o GIF não coube no mesmo formato". Imagem estática é recortada no navegador, na
 * medida exata da faixa; GIF animado não pode ser, porque redesenhá-lo num canvas guardaria só o
 * primeiro quadro. Ele entra inteiro, e quando a proporção é muito diferente, preencher corta demais.
 *
 * O ajuste é de exibição, e o que esta rota guarda é só isso. As provas aqui são as que, falhando
 * caladas, dariam uma capa torta sem erro em lugar nenhum: valor estranho virando estado inválido,
 * número fora da escala, e quem não administra mexendo na comunidade dos outros.
 */
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

describe('o encaixe da capa', () => {
  let app: FastifyInstance;
  let fechar: () => Promise<void>;
  let dono: ReturnType<typeof comToken>;
  let outro: ReturnType<typeof comToken>;
  let comunidade: number;

  before(async () => {
    ({ app, fechar } = await servidorDeTeste());
    const a = await criarConta(app, 'dona-da-capa');
    dono = comToken(app, a.token);
    const criada = await dono('POST', '/api/communities', { name: 'Casa da Capa' });
    comunidade = JSON.parse(criada.body).id;
    const b = await criarConta(app, 'visitante-da-capa');
    outro = comToken(app, b.token);
  });

  after(async () => fechar?.());

  const ajustar = (quem: ReturnType<typeof comToken>, corpo: unknown) =>
    quem('PUT', `/api/communities/${comunidade}/capa/ajuste`, corpo);

  it('guarda os dois modos', async () => {
    for (const encaixe of ['inteira', 'preencher']) {
      const r = await ajustar(dono, { encaixe, posicao: 50 });
      assert.equal(r.statusCode, 200);
      assert.equal(JSON.parse(r.body).capaEncaixe, encaixe);
    }
  });

  // Palavra que o Syden não conhece não pode virar estado: a tela leria um valor estranho e cairia
  // no padrão de qualquer jeito, mas o banco ficaria guardando lixo que ninguém sabe de onde veio.
  it('modo desconhecido vira o padrão, e não um valor solto', async () => {
    const r = await ajustar(dono, { encaixe: 'esticar', posicao: 50 });
    assert.equal(JSON.parse(r.body).capaEncaixe, 'preencher');
  });

  it('a altura fica entre 0 e 100, venha o que vier', async () => {
    for (const [mandou, esperado] of [
      [50, 50],
      [0, 0],
      [100, 100],
      [-30, 0],
      [9999, 100],
      [33.7, 34],
    ] as const) {
      const r = await ajustar(dono, { encaixe: 'preencher', posicao: mandou });
      assert.equal(JSON.parse(r.body).capaPosicao, esperado, `mandou ${mandou}`);
    }
  });

  it('sem posição nenhuma, fica no meio', async () => {
    const r = await ajustar(dono, { encaixe: 'preencher' });
    assert.equal(JSON.parse(r.body).capaPosicao, 50);
  });

  it('quem não participa não mexe', async () => {
    const r = await ajustar(outro, { encaixe: 'inteira', posicao: 50 });
    assert.equal(r.statusCode, 403);
  });

  // O ajuste viaja junto da comunidade, e é assim que a tela de todo mundo sabe dele sem pedir nada.
  it('o ajuste volta na lista de comunidades de quem participa', async () => {
    await ajustar(dono, { encaixe: 'inteira', posicao: 20 });
    const lista = JSON.parse((await dono('GET', '/api/communities')).body);
    const minha = lista.find((c: { id: number }) => c.id === comunidade);
    assert.equal(minha.capaEncaixe, 'inteira');
    assert.equal(minha.capaPosicao, 20);
  });
});
