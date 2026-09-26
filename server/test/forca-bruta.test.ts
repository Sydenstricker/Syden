import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { criarConta, servidorDeTeste } from './ajuda.js';

let app: FastifyInstance;
let fechar: () => Promise<void>;

before(async () => {
  // Aperta só o freio de conta: quatro erros de senha e trava. O de endereço fica largo (a ajuda põe um
  // valor alto), porque aqui todos os pedidos saem do mesmo 127.0.0.1 e não é ele que está sob teste.
  process.env.FREIO_ERROS_POR_CONTA = '4';
  ({ app, fechar } = await servidorDeTeste());
});
after(() => fechar());

const tentarLogin = (username: string, password: string) =>
  app.inject({ method: 'POST', url: '/api/auth/login', payload: { username, password } });

describe('adivinhar a senha de alguém', () => {
  it('trava a conta depois de errar demais, e diz quando voltar', async () => {
    await criarConta(app, 'gabi');

    // Os quatro erros permitidos: cada um responde "usuário ou senha incorretos".
    for (let i = 0; i < 4; i++) assert.equal((await tentarLogin('gabi', 'chute' + i)).statusCode, 401);

    const travada = await tentarLogin('gabi', 'chute-final');
    assert.equal(travada.statusCode, 429, 'a quinta tentativa errada tinha que ser barrada');
    assert.ok(Number(travada.headers['retry-after']) > 0, 'precisa dizer quantos segundos faltam');
    assert.match(travada.json().error, /minuto/, 'a mensagem tem que ser compreensível para leigo');
  });

  it('a senha certa também é barrada enquanto a conta está travada', async () => {
    // Importa: se a trava valesse só para senha errada, bastaria acertar para passar — e o ataque
    // continuaria funcionando, porque o objetivo dele é justamente descobrir a senha certa.
    assert.equal((await tentarLogin('gabi', 'segredo123')).statusCode, 429);
  });

  it('travar uma conta não trava as outras', async () => {
    await criarConta(app, 'heitor');
    assert.equal((await tentarLogin('heitor', 'segredo123')).statusCode, 200);
  });

  it('errar poucas vezes e acertar zera o contador', async () => {
    await criarConta(app, 'igor');
    assert.equal((await tentarLogin('igor', 'errada')).statusCode, 401);
    assert.equal((await tentarLogin('igor', 'errada')).statusCode, 401);
    assert.equal((await tentarLogin('igor', 'segredo123')).statusCode, 200);
    // Se o acerto não zerasse o contador, estes três erros somariam cinco e a conta travaria.
    for (let i = 0; i < 3; i++) assert.equal((await tentarLogin('igor', 'errada')).statusCode, 401);
  });

  it('nome que não existe não denuncia que não existe', async () => {
    const inexistente = await tentarLogin('ninguem-mesmo', 'chute');
    const existente = await tentarLogin('heitor', 'chute');
    assert.equal(inexistente.statusCode, existente.statusCode);
    assert.equal(inexistente.json().error, existente.json().error, 'a resposta não pode revelar quem tem conta');
  });
});
