import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { after, test } from 'node:test';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

// TEMPO DE QUEM SAIU (db.ts): excluir a conta apaga o histórico de uso da pessoa, mas as horas dela continuam no total da
// comunidade, só como número — senão um marco já alcançado (o selo das 5 horas de voz) "desacontecia".
const { app, fechar } = await servidorDeTeste();
after(fechar);
const db = await import('../src/db.js');
const banco = new DatabaseSync(process.env.DATABASE_PATH!);

const dona = comToken(app, (await criarConta(app, 'dona')).token);
const amiga = await criarConta(app, 'amiga');
const comunidade = (await dona('GET', '/api/communities')).json()[0].id as number;
const amigaId = (await comToken(app, amiga.token)('GET', '/api/me')).json().id as number;

test('as horas de chamada de quem exclui a conta continuam no total da comunidade, e o histórico dela some', () => {
  const sessao = db.startUsageSession('voice', amigaId, comunidade);
  // 6 horas de chamada
  banco.prepare("UPDATE usage_sessions SET started_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-6 hours') WHERE id = ?").run(sessao);
  db.touchUsageSessions([sessao]);
  const antes = db.fatosDaComunidade(comunidade).segundosDeVoz;
  assert.ok(antes >= 6 * 3600 - 5, 'a sessão contou: ' + antes);

  db.deleteAccount(amigaId);
  assert.equal(
    (banco.prepare('SELECT COUNT(*) AS n FROM usage_sessions WHERE user_id = ?').get(amigaId) as { n: number }).n,
    0,
    'o histórico de uso dela foi apagado',
  );
  assert.equal(db.fatosDaComunidade(comunidade).segundosDeVoz, antes, 'e o total da comunidade não mudou');
});
