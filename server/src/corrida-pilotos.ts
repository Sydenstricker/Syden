/**
 * OS PILOTOS DO COMPUTADOR DA CORRIDA (24/11/2026, os robôs na sala dentro da classificação): o nome e o avatar de cada robô,
 * pelo id (−1, −2…). É a MESMA lista de web/src/corrida/robos.ts (NOMES_DOS_PILOTOS e o avatar de criarRobos; o teste
 * web/test/corrida.test.ts confere). Os nomes são próprios, iguais em todo idioma, e o 🤖 diz que é o computador.
 */
export const NOMES_DOS_PILOTOS = ['Tico', 'Lola', 'Bento', 'Nina', 'Juca', 'Dora', 'Pipo', 'Zeca', 'Lia', 'Teco', 'Mia'];
export const nomeDoPilotoRobo = (id: number) => `🤖 ${NOMES_DOS_PILOTOS[(-id - 1) % NOMES_DOS_PILOTOS.length]}`;
export const avatarDoPilotoRobo = (id: number) => (((-id - 1) * 5 + 2) % 16) + 1;
