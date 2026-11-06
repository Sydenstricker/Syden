/**
 * OS MICROJOGOS DA FESTA DOS COELHOS (05/11/2026). Cada um mora nos próprios arquivos; este registro só os junta.
 * A rodada que os roda (o "prepare-se", o jogo, a revelação, o eco da rede, os robôs) é uma só, em ../minijogo-festa.ts, e
 * serve à Festa e ao Tabuleiro da turma: microjogo registrado aqui entra no sorteio dos dois.
 *
 * ================================================ COMO FAZER UM MICROJOGO NOVO ================================================
 *
 * DOIS ARQUIVOS e UMA LINHA em cada registro:
 *   server/src/festa/<id>.ts   a regra (o contrato `MicrojogoDoServidor`, em ./comum.ts), `export default microjogo({...})`
 *   web/src/festa/<id>.tsx     a tela (o contrato `MicrojogoDaTela`, em web/src/festa/comum.tsx), `export default {...}`
 *   aqui e em web/src/festa/registro.ts:  export { default as <id> } from './<id>.js';   (no site, sem o .js)
 * O id é curto, minúsculo, sem acento, e o mesmo nos dois lados (server/test/festa-registro.test.ts confere). Copie um que
 * se parece com o seu: `alvo` (acertos ao vivo), `forca` (um aperto), `copos` (uma resposta depois de uma animação), `saque`
 * (o sinal que só vai quando sai), `praga`, `ponteiro`, `despensa`, `flor` (os de 05/11).
 *
 * A REDE DECIDE A FORMA. Servidor na Alemanha, turma no Brasil, ~200 ms. Cada um joga NA PRÓPRIA TELA, ao mesmo tempo, e nada
 * depende de interação ao vivo entre as pessoas. O SERVIDOR É DONO do sorteio (`gerar`, só com o `aleatorio` dado), do relógio
 * e das respostas certas. Os dados vão PRONTOS ao site (a lista de pragas, as trocas dos copos), iguais para todos; o que não
 * pode ser visto antes da hora (o sinal do saque, a próxima figura da flor) vai pela `vista`, só quando sai, com `iniciar`
 * marcando o relógio e `avisar` chamando a sala. O jogo começa, em cada tela, no instante marcado (o site recebe `inicio` no
 * relógio dele); tudo o que o site mede é "ms desde o começo".
 *
 * A CONFERÊNCIA ANTI-TRAPAÇA (o que se pode, sem adivinhar quem apertou): cada tempo dito precisa caber no que o servidor viu
 * (`cabe(t)`: nunca depois, antes no máximo a rede daquela pessoa, `abaixo`, medida pelo eco do "prepare-se"). O que se acerta
 * AO VIVO (cada praga, cada pulo) vai na hora pela ação 'acerto' e é conferido no relógio do servidor; mandar a lista inteira no
 * fim deixa o console acertar tudo. A resposta no fim (o 'resultado') vale UMA vez. Reação abaixo de REACAO_MINIMA é chute.
 * Ação que não vale NÃO é erro: só não conta (e o 'resultado' que não vale vira `invalido()`).
 *
 * CONTAS IGUAIS NOS DOIS LADOS: se o servidor refaz uma conta da tela (onde o ponteiro está, a barra de força), use só + − × ÷,
 * Math.sqrt, Math.floor/round/abs/min/max e %, nunca seno, cosseno ou potência fracionária. O DESENHO pode usar o que quiser.
 *
 * OS PONTOS VIRAM POSIÇÃO assim: o `Resultado` de cada um tem a `chave`, MENOR É MELHOR, comparada número a número ([-acertos,
 * ms]: mais acertos, e no empate, menos tempo). Empate total divide a posição e os pontos. `motivo` não nulo ('cedo', 'errou',
 * 'invalido') é zero ponto, sem posição. `valor` é o que a revelação mostra (o site o formata em `texto`).
 *
 * O ROBÔ (o Solo e o Tabuleiro contra o computador): `robo(dados, aleatorio, passouMs)` inventa um resultado PLAUSÍVEL, de
 * quem joga bem mas não perfeito, e nunca mais do que caberia em `passouMs` (a pessoa que termina logo revela a rodada).
 *
 * A TELA: tudo desenhado por código (SVG), entendível sem texto; a dica do "prepare-se" tem UMA frase curta. Teclado E toque.
 * O relógio da tela é `useRelogio` (não desenha com a janela escondida), as teclas `useTeclas`, o som `tocar` de
 * ../somDosJogos. CSS próprio, se precisar, vai em atributos do SVG (o styles.css é de outro dono).
 *
 * COMO TESTAR: server/test/festa-<id>.test.ts, com `rodadaDeTeste` de server/test/festa-ajuda.ts (sem banco: o relógio e o
 * sorteio de mão). O mínimo: o honesto com 200–300 ms de rede passa, a trapaça óbvia é recusada (o tempo fora da hora, o acerto
 * que não existia, a resposta que não bate), o robô cabe no tempo. server/test/festa-registro.test.ts confere o contrato de
 * todos (sorteio repetível, duração, robô) e que os dois registros têm os mesmos ids. Na tela, uma página provisória que monte
 * `RodadaDaFesta` com um estado falso (veja o relatório do agente de 05/11, ou e2e/festa.mjs na sala de verdade).
 * ==============================================================================================================================
 */
export { default as saque } from './saque.js';
export { default as forca } from './forca.js';
export { default as relogio } from './relogio.js';
export { default as copos } from './copos.js';
export { default as siga } from './siga.js';
export { default as alvo } from './alvo.js';
export { default as praga } from './praga.js';
export { default as ponteiro } from './ponteiro.js';
export { default as despensa } from './despensa.js';
export { default as flor } from './flor.js';
export * from './lote1.js';
export * from './lote2.js';
export * from './lote3.js';
export * from './lote4.js';
export * from './lote5.js';
export * from './lote6.js';
