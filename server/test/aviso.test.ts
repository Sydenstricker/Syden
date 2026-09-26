import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';

// O db.ts ABRE O ARQUIVO no momento em que é importado. Se este teste importasse o aviso lá em cima,
// como de costume, ele mexeria no banco de desenvolvimento de verdade — por isso o banco é escolhido
// primeiro e o import é feito à mão, depois.
const arquivo = join(tmpdir(), `syden-aviso-${randomUUID()}.db`);
process.env.DATABASE_PATH = arquivo;
process.env.LOG_LEVEL = 'silent';

const { apagarAviso, avisoDeAgora, avisoGuardado, guardarAviso, lerAviso } = await import('../src/aviso.js');

after(() => {
  for (const sufixo of ['', '-wal', '-shm']) {
    try {
      rmSync(arquivo + sufixo);
    } catch {
      // No Windows o arquivo continua preso ao processo enquanto o banco está aberto; é lixo em pasta
      // temporária, e o teste não pode falhar por causa disso (o ajuda.ts faz igual).
    }
  }
});

const VALIDO = { texto: 'Manutenção hoje às 22h, o Syden fica fora por uns 10 minutos.', tom: 'manutencao' };

test('um recado precisa de texto e de tipo', () => {
  assert.ok('erro' in lerAviso({ tom: 'manutencao' }), 'sem texto não passa');
  assert.ok('erro' in lerAviso({ texto: 'oi', tom: 'manutencao' }), 'texto de duas letras não é recado');
  assert.ok('erro' in lerAviso({ texto: VALIDO.texto }), 'sem tipo não passa');
  assert.ok('erro' in lerAviso({ texto: VALIDO.texto, tom: 'festa' }), 'tipo inventado não passa');
  assert.ok('erro' in lerAviso({ texto: 'a'.repeat(301), tom: 'recado' }), 'recado quilométrico não cabe na faixa');
  assert.ok('aviso' in lerAviso(VALIDO));
});

test('terminar antes de começar é recusado, senão o recado nunca apareceria', () => {
  assert.ok('erro' in lerAviso({ ...VALIDO, de: '2026-10-01T22:00:00Z', ate: '2026-10-01T21:00:00Z' }));
});

test('data que não é data é recusada em vez de virar recado que nunca aparece', () => {
  assert.ok('erro' in lerAviso({ ...VALIDO, ate: 'amanhã de noite' }));
});

test('recado sem hora nenhuma vale desde já e até alguém apagar', () => {
  const lido = lerAviso(VALIDO);
  assert.ok('aviso' in lido);
  guardarAviso(lido.aviso);
  assert.equal(avisoDeAgora()?.texto, VALIDO.texto);
  apagarAviso();
  assert.equal(avisoDeAgora(), null);
});

test('recado marcado para depois não aparece antes da hora', () => {
  const lido = lerAviso({ ...VALIDO, de: '2026-10-01T22:00:00Z' });
  assert.ok('aviso' in lido);
  guardarAviso(lido.aviso);
  assert.equal(avisoDeAgora(new Date('2026-10-01T20:00:00Z')), null, 'ainda não era hora');
  assert.ok(avisoDeAgora(new Date('2026-10-01T22:30:00Z')), 'já era hora');
  apagarAviso();
});

// Este é o que importa de verdade: a manutenção acaba, quem administra vai dormir, e a faixa vermelha
// não pode amanhecer na tela de todo mundo dizendo que o Syden está fora quando ele está perfeito.
test('recado com hora de terminar some sozinho, sem ninguém precisar apagar', () => {
  const lido = lerAviso({ ...VALIDO, de: '2026-10-01T22:00:00Z', ate: '2026-10-01T23:00:00Z' });
  assert.ok('aviso' in lido);
  guardarAviso(lido.aviso);
  assert.ok(avisoDeAgora(new Date('2026-10-01T22:30:00Z')), 'durante a manutenção, aparece');
  assert.equal(avisoDeAgora(new Date('2026-10-02T09:00:00Z')), null, 'no dia seguinte, não');
  // Mas continua guardado: quem administra abre a tela e vê o que escreveu, para reaproveitar.
  assert.ok(avisoGuardado(), 'o texto não some do formulário só porque a hora passou');
  apagarAviso();
});

test('recado apagado não volta', () => {
  guardarAviso({ texto: 'vale', tom: 'recado', de: null, ate: null });
  assert.ok(avisoDeAgora());
  apagarAviso();
  assert.equal(avisoDeAgora(), null);
  assert.equal(avisoGuardado(), null);
});
